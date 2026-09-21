import assert from "node:assert/strict";
import { summarizeIplSeasonMatchLogs } from "../lib/logic/playerHistory";

assert.deepEqual(summarizeIplSeasonMatchLogs([
  { id: "ipl-1", batting: "72 (44)", bowling: "DNB" },
  { id: "ipl-2", batting: "DNB", bowling: "3/24 (4)" },
  { id: "ipl-3", batting: "0 (1)", bowling: "0/19 (2.3)" },
  { id: "ipl-2", batting: "DNB", bowling: "3/24 (4)" },
]), { matches: 3, runs: 72, wickets: 3 });
assert.equal(summarizeIplSeasonMatchLogs(undefined), undefined);
assert.equal(summarizeIplSeasonMatchLogs([]), undefined);
console.log("IPL team-history match-log verification passed.");
