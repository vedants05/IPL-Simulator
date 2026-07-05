import * as fs from "fs";
import * as path from "path";
import { PLAYERS } from "../lib/data/players";

const overrides: Record<string, Partial<typeof PLAYERS[0]>> = {
  "virat-kohli": { isOpener: true },
  "tristan-stubbs": {
    isPartTimeWk: true,
    isWicketkeeper: true,
    role: "Batsman",
    hasBattedAt3: false,
    hasBattedAt4: true,
    hasBattedAt5: true,
    hasBattedAt6: true
  },
  "josh-inglis": {
    isOpener: true,
    hasBattedAt3: true,
    hasBattedAt4: true,
    hasBattedAt5: true,
    hasBattedAt6: true
  },
  "hardik-pandya": { hasBattedAt3: false, hasBattedAt4: false },
  "tim-david": { hasBattedAt4: false, hasBattedAt5: false },
  "rinku-singh": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: true },
  "shivam-dube": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false },
  "ms-dhoni": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false, hasBattedAt6: false },
  "dewald-brevis": { hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: true },
  "tim-seifert": {
    onlyOpensOrBenched: true,
    hasBattedAt4: false,
    hasBattedAt5: false,
    hasBattedAt6: false
  },
  "quinton-de-kock": { onlyOpensOrBenched: true },
  "prithvi-shaw": { onlyOpensOrBenched: true },
  "rahmanullah-gurbaz": { onlyOpensOrBenched: true },
  "rajat-patidar": { hasBattedAt3: false, hasBattedAt4: true },
  "angkrish-raghuvanshi": { hasBattedAt4: true },
  "shashank-singh": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false },
  "axar-patel": { hasBattedAt3: false, hasBattedAt4: false },
  "heinrich-klaasen": { hasBattedAt3: false },
  "ishan-kishan": { isOpener: true, hasBattedAt3: true },
  "ramandeep-singh": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false, hasBattedAt6: false },
  "jitesh-sharma": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false },
  "nicholas-pooran": { hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: true },
  "ravindra-jadeja": { hasBattedAt3: false, hasBattedAt4: false },
  "sam-curran": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false, hasBattedAt6: false },
  "ashutosh-sharma": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false },
  "sameer-rizvi": { hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: true },
  "washington-sundar": { hasBattedAt3: false, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: true },
  "rishabh-pant": { hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: true },
  "nitish-rana": { hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: false },
  "tilak-varma": { isOpener: false },
  "ryan-rickelton": { isOpener: true, hasBattedAt3: true, hasBattedAt4: false, hasBattedAt5: false, hasBattedAt6: false },
  "cameron-green": { isOpener: true, hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: true },
  "shreyas-iyer": { hasBattedAt3: false, hasBattedAt4: true },
  "dhruv-jurel": { hasBattedAt3: true },
  "mitchell-marsh": { isOpener: true, hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: true },
  "suryansh-shedge": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false },
  "ayush-badoni": { hasBattedAt6: true },
  "prabhsimran-singh": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false, hasBattedAt6: false },
  "aiden-markram": { hasBattedAt3: true, hasBattedAt4: true, hasBattedAt5: true, hasBattedAt6: true },
  "devdutt-padikkal": { hasBattedAt5: true },
  "romario-shepherd": { hasBattedAt3: false, hasBattedAt4: false, hasBattedAt5: false }
};

// Apply overrides
for (const p of PLAYERS) {
  if (overrides[p.id]) {
    Object.assign(p, overrides[p.id]);
  }
}

// Write back to lib/data/players.ts
const filePath = path.join(__dirname, "..", "lib", "data", "players.ts");
const newContent = `import { Player } from "@/lib/types";

export const PLAYERS: Player[] = ${JSON.stringify(PLAYERS, null, 2)};

export const PLAYERS_SEED: Player[] = PLAYERS;
`;

fs.writeFileSync(filePath, newContent, "utf-8");
console.log("Successfully applied all player position overrides directly to the players database!");
