import { NextResponse } from "next/server";
import { readDesktopData } from "@/lib/server/desktopData";
import { fetchTeamsFromSupabase } from "@/lib/supabase/fetchTeams";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bundled = await readDesktopData("teams");
    if (bundled) return NextResponse.json(bundled);
    const teams = await fetchTeamsFromSupabase();
    return NextResponse.json(teams);
  } catch (error: any) {
    console.error("API error fetching teams:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
