/**
 * Migration runner.
 *
 * Applies every *.sql file in scripts/migrations/ in filename order, exactly once.
 * Applied files are recorded in the schema_migrations table so re-running is safe.
 *
 * Requires a direct Postgres connection string in .env.local:
 *   SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres
 * (or the pooled connection string from Supabase → Project Settings → Database).
 *
 * Run with: npx tsx scripts/migrate.ts
 */
import * as fs from "fs";
import * as path from "path";
import { Client } from "pg";

// Minimal .env.local loader (no extra deps).
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key]) continue;
    process.env[key] = rawVal.replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      "Missing SUPABASE_DB_URL in .env.local.\n" +
        "Get it from Supabase → Project Settings → Database → Connection string (URI)."
    );
    process.exit(1);
  }

  const dir = path.join(process.cwd(), "scripts", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.name));

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), "utf-8");
      console.log(`apply ${file} ...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        ran++;
        console.log(`  ok  ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`  FAILED ${file} — rolled back`);
        throw err;
      }
    }

    console.log(`\nDone. ${ran} migration(s) applied, ${files.length - ran} skipped.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
