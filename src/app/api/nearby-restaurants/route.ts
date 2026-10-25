import { NextRequest, NextResponse } from "next/server";

const MAX_RESULTS = 80;

async function findWithGoogle(latitude: number, longitude: number) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.types",
    },
    body: JSON.stringify({
      textQuery: "celiac friendly gluten free restaurants",
      locationBias: { circle: { center: { latitude, longitude }, radius: 6000 } },
      maxResultCount: 20,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) throw new Error(`Google Places lookup returned ${response.status}`);
  const payload = await response.json();
  return (payload.places ?? []).map((place: {
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    userRatingCount?: number;
    websiteUri?: string;
    googleMapsUri?: string;
    types?: string[];
  }) => ({
    id: `google-${place.id}`,
    name: place.displayName?.text ?? "Restaurant",
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    address: place.formattedAddress ?? "",
    city: "",
    website_url: place.websiteUri ?? "",
    cuisine: (place.types ?? []).filter((type) => type.includes("restaurant") || type.includes("cafe")).join(", "),
    gluten_free: "unknown",
    source_url: place.googleMapsUri ?? "",
    google_rating: place.rating ?? null,
    google_review_count: place.userRatingCount ?? null,
  })).filter((place: { latitude?: number; longitude?: number }) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lon"));

  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  ) {
    return NextResponse.json({ error: "Provide valid map coordinates." }, { status: 400 });
  }

  try {
    if (process.env.GOOGLE_PLACES_API_KEY) {
      const googlePlaces = await findWithGoogle(latitude, longitude);
      if (googlePlaces) {
        return NextResponse.json(googlePlaces, {
          headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
        });
      }
    }

    const deltaLat = 0.06;
    const deltaLon = 0.09;
    const params = new URLSearchParams({
      q: "restaurant",
      viewbox: `${longitude - deltaLon},${latitude + deltaLat},${longitude + deltaLon},${latitude - deltaLat}`,
      bounded: "1",
      format: "jsonv2",
      addressdetails: "1",
      extratags: "1",
      limit: String(MAX_RESULTS),
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "Celisafe/1.0 (restaurant discovery; https://celisafe.vercel.app)" },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) throw new Error(`Restaurant lookup returned ${response.status}`);
    const payload = await response.json();
    const places = payload.flatMap((result: {
      place_id: number;
      osm_id: number;
      osm_type: string;
      lat: string;
      lon: string;
      name?: string;
      display_name?: string;
      address?: Record<string, string>;
      extratags?: Record<string, string>;
    }) => {
      const name = result.name ?? result.extratags?.name;
      const lat = Number(result.lat);
      const lon = Number(result.lon);
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];

      const addressParts = result.address ?? {};
      const cityName = addressParts.city ?? addressParts.town ?? addressParts.village ?? addressParts.suburb ?? "";
      const address = [addressParts.house_number, addressParts.road, cityName].filter(Boolean).join(" ");
      const osmType = result.osm_type === "node" ? "node" : result.osm_type === "way" ? "way" : "relation";

      return [{
        id: `osm-${result.place_id}`,
        name,
        latitude: lat,
        longitude: lon,
        address: address || result.display_name || "",
        city: cityName,
        website_url: result.extratags?.website ?? "",
        cuisine: result.extratags?.cuisine ?? "",
        gluten_free: result.extratags?.["diet:gluten_free"] ?? "unknown",
        source_url: `https://www.openstreetmap.org/${osmType}/${result.osm_id}`,
        google_rating: null,
        google_review_count: null,
      }];
    });

    return NextResponse.json(places.slice(0, MAX_RESULTS), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Could not discover nearby restaurants:", error);
    return NextResponse.json(
      { error: "Nearby restaurant search is temporarily unavailable. Try again shortly." },
      { status: 502 },
    );
  }
}