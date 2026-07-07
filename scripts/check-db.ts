import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
const get = (k: string) => (env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1] || "").replace(/^["']|["']$/g, "").trim();

const supabase = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("NEXT_PUBLIC_SUPABASE_ANON_KEY"));

async function main() {
  for (const table of ["players", "ipl_history"]) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) console.log(`${table}: ERROR — ${error.message}`);
    else console.log(`${table}: ${count} rows`);
  }
}
main();
