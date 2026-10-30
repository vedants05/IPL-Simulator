import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Bundled public game data only; never used by the hosted website. */
export async function readDesktopData(name: "players" | "teams" | "staff" | "retentions") {
  if (process.env.IPL_DESKTOP !== "1" || !process.env.IPL_DESKTOP_DATA) return null;
  return JSON.parse(await readFile(join(process.env.IPL_DESKTOP_DATA, `${name}.json`), "utf8"));
}
