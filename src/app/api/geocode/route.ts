import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length > 180) {
    return NextResponse.json({ error: "Provide a location to search." }, { status: 400 });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      headers: { "User-Agent": "Celisafe/1.0 (celiac-friendly restaurant map)" },
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!response.ok) throw new Error("Location lookup failed");
    const results = await response.json();
    const result = results[0];
    if (!result) return NextResponse.json({ error: "We couldn’t find that location." }, { status: 404 });

    return NextResponse.json({ latitude: Number(result.lat), longitude: Number(result.lon), label: result.display_name });
  } catch (error) {
    console.error("Could not geocode location:", error);
    return NextResponse.json({ error: "Location lookup is temporarily unavailable." }, { status: 502 });
  }
}