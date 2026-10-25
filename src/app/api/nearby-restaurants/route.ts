import { NextRequest, NextResponse } from "next/server";

const MAX_RESULTS = 80;

function overpassQuery(latitude: number, longitude: number) {
  return `[out:json][timeout:20];(node["amenity"~"restaurant|cafe|fast_food"](around:6000,${latitude},${longitude});way["amenity"~"restaurant|cafe|fast_food"](around:6000,${latitude},${longitude}););out center tags ${MAX_RESULTS};`;
}

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

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Celisafe/1.0 (restaurant discovery)",
      },
      body: new URLSearchParams({ data: overpassQuery(latitude, longitude) }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) throw new Error(`Restaurant lookup returned ${response.status}`);
    const payload = await response.json();
    const places = (payload.elements ?? []).flatMap((element: {
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }) => {
      const tags = element.tags ?? {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!tags.name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];

      const address = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"],
      ].filter(Boolean).join(" ");

      return [{
        id: `${element.type}-${element.id}`,
        name: tags.name,
        latitude: lat,
        longitude: lon,
        address,
        city: tags["addr:city"] ?? "",
        website_url: tags.website ?? tags["contact:website"] ?? "",
        cuisine: tags.cuisine ?? "",
        gluten_free: tags["diet:gluten_free"] ?? "unknown",
        source_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
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