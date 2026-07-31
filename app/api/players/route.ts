import { NextResponse } from "next/server";
import { mapRowsToPlayers } from "@/lib/supabase/fetchPlayers";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase error fetching players:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No player data found in Supabase" }, { status: 404 });
    }

    const players = mapRowsToPlayers(data);
    return NextResponse.json(players);
  } catch (error: any) {
    console.error("API error fetching players from Supabase:", error);
    return NextResponse.json({ error: error?.message || "Unknown error" }, { status: 500 });
  }
}
