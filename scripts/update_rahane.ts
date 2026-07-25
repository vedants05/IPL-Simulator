import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");
const envFile = fs.readFileSync(envPath, "utf8");
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

const url = urlMatch ? urlMatch[1].trim() : "";
const key = keyMatch ? keyMatch[1].trim() : "";

if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

async function main() {
  const selectUrl = `${url}/rest/v1/players?name=eq.Ajinkya%20Rahane&select=name,has_batted_at_3,has_batted_at_4,has_batted_at_5,has_batted_at_6,has_batted_at_7`;
  const selectRes = await fetch(selectUrl, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const before = await selectRes.json();
  console.log("Current state for Ajinkya Rahane in Supabase:", before);

  const updateUrl = `${url}/rest/v1/players?name=eq.Ajinkya%20Rahane`;
  const updateRes = await fetch(updateUrl, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      has_batted_at_4: false,
      has_batted_at_5: false,
      has_batted_at_6: false,
      has_batted_at_7: false,
    }),
  });
  const after = await updateRes.json();
  console.log("Update response for Ajinkya Rahane from Supabase:", after);
}

main();
