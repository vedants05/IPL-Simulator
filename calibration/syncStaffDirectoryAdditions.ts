import { STAFF_ADDITION_TRAITS, STAFF_DIRECTORY_ADDITIONS } from "../lib/data/staffDirectoryAdditions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase URL or anon key is missing");

async function main() {
  const slugs = STAFF_DIRECTORY_ADDITIONS.map(({ slug }) => slug);
  const headers = { apikey: key!, authorization: `Bearer ${key!}` };
  const existingResponse = await fetch(`${url}/rest/v1/staff_members?select=slug&slug=in.(${slugs.join(",")})`, { headers });
  if (!existingResponse.ok) throw new Error(`Staff read failed: ${existingResponse.status} ${await existingResponse.text()}`);
  const existing = await existingResponse.json() as { slug: string }[];
  const existingSlugs = new Set(existing.map(({ slug }) => slug));
  const missing = STAFF_DIRECTORY_ADDITIONS.filter(({ slug }) => !existingSlugs.has(slug)).map(({ source_url, ...profile }) => ({
    ...profile,
    secondary_roles: [...profile.secondary_roles],
    current_real_team_id: null,
    real_contract_end_year: null,
    is_available: true,
    is_generated: false,
    is_active: true,
    profile_confidence: "medium",
  }));
  if (missing.length > 0) {
    const insertResponse = await fetch(`${url}/rest/v1/staff_members`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(missing),
    });
    if (!insertResponse.ok) throw new Error(`Staff insert failed: ${insertResponse.status} ${await insertResponse.text()}`);
  }
  const traitsResponse = await fetch(`${url}/rest/v1/staff_traits?select=staff_id&staff_id=in.(${STAFF_DIRECTORY_ADDITIONS.map(({ id }) => id).join(",")})`, { headers });
  if (!traitsResponse.ok) throw new Error(`Staff traits read failed: ${traitsResponse.status} ${await traitsResponse.text()}`);
  const existingTraits = new Set(((await traitsResponse.json()) as { staff_id: string }[]).map(({ staff_id }) => staff_id));
  const missingTraits = STAFF_DIRECTORY_ADDITIONS.filter(({ id }) => !existingTraits.has(id)).map(({ id, slug }) => ({
    staff_id: id,
    ...STAFF_ADDITION_TRAITS[slug],
  }));
  for (const trait of missingTraits) {
    const insertResponse = await fetch(`${url}/rest/v1/staff_traits`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(trait),
    });
    if (!insertResponse.ok) throw new Error(`Staff traits insert failed: ${insertResponse.status} ${await insertResponse.text()}`);
  }
  console.log(`Staff profiles already present: ${existingSlugs.size}; added: ${missing.length}; traits added: ${missingTraits.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
