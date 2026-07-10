import { NextResponse } from "next/server";
import { fetchTeamsFromSupabase } from "@/lib/supabase/fetchTeams";

export async function GET() {
  try {
    const teams = await fetchTeamsFromSupabase();
    return NextResponse.json(teams);
  } catch (error: any) {
    console.error("API error fetching teams:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
