import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await getSupabaseClient()
      .from("travel_restaurant_feedback")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Could not load restaurant feedback:", error);
    return NextResponse.json({ error: "Could not load ratings and notes." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
    const memberName = typeof body.memberName === "string" ? body.memberName.trim().slice(0, 50) : "";
    const score = Number(body.score);
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";

    if (!restaurantId || !memberName || !Number.isInteger(score) || score < 1 || score > 5) {
      return NextResponse.json({ error: "Enter your name and choose a score from 1 to 5." }, { status: 400 });
    }

    const { data, error } = await getSupabaseClient()
      .from("travel_restaurant_feedback")
      .upsert({ restaurant_id: restaurantId, member_name: memberName, score, notes, updated_at: new Date().toISOString() } as never, {
        onConflict: "restaurant_id,member_name",
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Could not save restaurant feedback:", error);
    return NextResponse.json({ error: "Could not save your rating and note." }, { status: 500 });
  }
}
