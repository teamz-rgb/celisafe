import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await getSupabaseClient()
      .from("travel_restaurants")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Could not load restaurants:", error);
    return NextResponse.json({ error: "Could not load restaurants. Check Supabase setup." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    if (!name || !city) return NextResponse.json({ error: "Restaurant name and city are required." }, { status: 400 });

    const rating = body.reviewRating === "" || body.reviewRating == null ? null : Number(body.reviewRating);
    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
      return NextResponse.json({ error: "Public review rating must be between 0 and 5." }, { status: 400 });
    }

    const googleRating = body.googleRating === "" || body.googleRating == null ? null : Number(body.googleRating);
    const yelpRating = body.yelpRating === "" || body.yelpRating == null ? null : Number(body.yelpRating);
    const latitude = body.latitude === "" || body.latitude == null ? null : Number(body.latitude);
    const longitude = body.longitude === "" || body.longitude == null ? null : Number(body.longitude);
    if ([googleRating, yelpRating].some((value) => value !== null && (!Number.isFinite(value) || value < 0 || value > 5))) {
      return NextResponse.json({ error: "Google and Yelp ratings must be between 0 and 5." }, { status: 400 });
    }
    if ((latitude === null) !== (longitude === null) || (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude!) > 180))) {
      return NextResponse.json({ error: "Enter valid latitude and longitude coordinates together." }, { status: 400 });
    }

    const { data, error } = await getSupabaseClient()
      .from("travel_restaurants")
      .insert({
        name,
        city,
        address: typeof body.address === "string" ? body.address.trim() : "",
        website_url: typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "",
        cuisine: typeof body.cuisine === "string" ? body.cuisine.trim() : "",
        google_rating: googleRating,
        yelp_rating: yelpRating,
        review_rating: rating,
        celiac_notes: typeof body.celiacNotes === "string" ? body.celiacNotes.trim() : "",
        latitude,
        longitude,
      } as never)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Could not save restaurant:", error);
    return NextResponse.json({ error: "Could not save restaurant. Check Supabase setup." }, { status: 500 });
  }
}
