import { NextResponse } from "next/server";
import { fetchPlayersFromSupabase } from "@/lib/supabase/fetchPlayers";

export async function GET() {
  try {
    const players = await fetchPlayersFromSupabase();
    return NextResponse.json(players);
  } catch (error: any) {
    console.error("API error fetching players:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
