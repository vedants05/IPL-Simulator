export type StaffAffinityReason = "home" | "played" | "coached" | "current_club" | "long_service";

export interface StaffClubAffinity {
  teamId: string;
  strength: number;
  reasons: StaffAffinityReason[];
}

export interface StaffAffinityProfile {
  homeRegion: string | null;
  homeCountry: string;
  clubs: StaffClubAffinity[];
}

type AffinitySeed = {
  homeRegion?: string;
  clubs?: Partial<Record<string, { strength: number; reasons: StaffAffinityReason[] }>>;
};

const seed = (homeRegion?: string, clubs?: AffinitySeed["clubs"]): AffinitySeed => ({ homeRegion, clubs });

// Only meaningful, defensible links are seeded. Everyone else still receives a
// complete profile from their country and current appointment in the resolver.
const STAFF_AFFINITY_SEEDS: Record<string, AffinitySeed> = {
  "aashish-kapoor": seed("Tamil Nadu", { CSK: { strength: 54, reasons: ["home", "played"] }, GT: { strength: 72, reasons: ["coached"] } }),
  "ab-de-villiers": seed("Gauteng", { RCB: { strength: 96, reasons: ["played", "long_service"] }, DC: { strength: 58, reasons: ["played"] } }),
  "abhay-sharma": seed("Delhi", { DC: { strength: 68, reasons: ["home", "coached"] }, LSG: { strength: 68, reasons: ["coached"] } }),
  "abhishek-nayar": seed("Mumbai", { MI: { strength: 65, reasons: ["home", "played"] }, KKR: { strength: 82, reasons: ["coached", "long_service"] } }),
  "ajit-agarkar": seed("Mumbai", { MI: { strength: 74, reasons: ["home", "played"] }, DC: { strength: 61, reasons: ["played", "coached"] }, KKR: { strength: 55, reasons: ["played"] } }),
  "amit-mishra": seed("Delhi", { DC: { strength: 88, reasons: ["home", "played", "long_service"] }, SRH: { strength: 65, reasons: ["played"] } }),
  "andre-russell": seed("Kingston", { KKR: { strength: 97, reasons: ["played", "long_service"] }, DC: { strength: 48, reasons: ["played"] } }),
  "andy-flower": seed(undefined, { LSG: { strength: 63, reasons: ["coached"] }, RCB: { strength: 78, reasons: ["coached"] }, PBKS: { strength: 55, reasons: ["coached"] } }),
  "anil-kumble": seed("Bengaluru", { RCB: { strength: 90, reasons: ["home", "played", "coached"] }, MI: { strength: 72, reasons: ["coached"] }, PBKS: { strength: 58, reasons: ["coached"] } }),
  "arun-karthik": seed("Tamil Nadu", { CSK: { strength: 76, reasons: ["home", "coached"] }, RCB: { strength: 48, reasons: ["played"] } }),
  "ashish-nehra": seed("Delhi", { DC: { strength: 68, reasons: ["home", "played"] }, GT: { strength: 88, reasons: ["coached", "long_service"] }, SRH: { strength: 54, reasons: ["played"] } }),
  "bharat-arun": seed("Tamil Nadu", { CSK: { strength: 61, reasons: ["home", "played"] }, KKR: { strength: 68, reasons: ["coached"] }, LSG: { strength: 65, reasons: ["coached"] } }),
  "brad-haddin": seed(undefined, { SRH: { strength: 60, reasons: ["coached"] }, PBKS: { strength: 68, reasons: ["coached"] }, KKR: { strength: 48, reasons: ["played"] } }),
  "brendon-mccullum": seed("Otago", { KKR: { strength: 85, reasons: ["played", "coached"] }, CSK: { strength: 55, reasons: ["played"] }, GT: { strength: 48, reasons: ["played"] } }),
  "carl-crowe": seed(undefined, { KKR: { strength: 64, reasons: ["coached"] }, LSG: { strength: 64, reasons: ["coached"] } }),
  "chandrakant-pandit": seed("Mumbai", { MI: { strength: 58, reasons: ["home", "played"] }, KKR: { strength: 70, reasons: ["coached"] } }),
  "dale-steyn": seed("Gauteng", { SRH: { strength: 78, reasons: ["played", "coached"] }, RCB: { strength: 66, reasons: ["played"] }, GT: { strength: 48, reasons: ["played"] } }),
  "daniel-vettori": seed("Auckland", { RCB: { strength: 77, reasons: ["played", "coached"] }, SRH: { strength: 70, reasons: ["coached"] } }),
  "daren-sammy": seed("Saint Lucia", { SRH: { strength: 52, reasons: ["played"] }, RCB: { strength: 44, reasons: ["played"] } }),
  "dinesh-karthik": seed("Chennai", { CSK: { strength: 72, reasons: ["home"] }, KKR: { strength: 78, reasons: ["played", "long_service"] }, RCB: { strength: 73, reasons: ["played", "coached"] }, DC: { strength: 50, reasons: ["played"] }, MI: { strength: 49, reasons: ["played"] } }),
  "dwayne-bravo": seed("Trinidad", { CSK: { strength: 96, reasons: ["played", "coached", "long_service"] }, KKR: { strength: 70, reasons: ["coached"] }, MI: { strength: 51, reasons: ["played"] } }),
  "dishant-yagnik": seed("Rajasthan", { RR: { strength: 82, reasons: ["home", "played", "long_service"] }, KKR: { strength: 58, reasons: ["coached"] } }),
  "eoin-morgan": seed("Dublin", { KKR: { strength: 75, reasons: ["played"] }, RCB: { strength: 42, reasons: ["played"] }, SRH: { strength: 42, reasons: ["played"] }, CSK: { strength: 68, reasons: ["coached"] } }),
  "eric-simons": seed("Cape Town", { CSK: { strength: 94, reasons: ["coached", "long_service"] }, DC: { strength: 55, reasons: ["coached"] } }),
  "gautam-gambhir": seed("Delhi", { DC: { strength: 83, reasons: ["home", "played"] }, KKR: { strength: 97, reasons: ["played", "coached", "long_service"] }, LSG: { strength: 68, reasons: ["coached"] } }),
  "govindamenon-jayakumar": seed("Kerala", { LSG: { strength: 68, reasons: ["coached"] } }),
  "gary-kirsten": seed("Cape Town", { GT: { strength: 62, reasons: ["coached"] }, RCB: { strength: 55, reasons: ["coached"] } }),
  "harbhajan-singh": seed("Punjab", { PBKS: { strength: 78, reasons: ["home"] }, MI: { strength: 93, reasons: ["played", "long_service"] }, CSK: { strength: 61, reasons: ["played"] }, KKR: { strength: 50, reasons: ["played"] } }),
  "hariesh-jaikumar": seed("Tamil Nadu", { CSK: { strength: 66, reasons: ["home"] }, SRH: { strength: 68, reasons: ["coached"] } }),
  "hemang-badani": seed("Tamil Nadu", { CSK: { strength: 69, reasons: ["home"] }, SRH: { strength: 65, reasons: ["coached"] }, DC: { strength: 56, reasons: ["coached"] } }),
  "irfan-pathan": seed("Gujarat", { GT: { strength: 75, reasons: ["home"] }, DC: { strength: 54, reasons: ["played"] }, PBKS: { strength: 59, reasons: ["played"] }, SRH: { strength: 48, reasons: ["played"] } }),
  "jacques-kallis": seed("Cape Town", { KKR: { strength: 91, reasons: ["played", "coached", "long_service"] }, RCB: { strength: 78, reasons: ["played", "long_service"] } }),
  "james-hopes": seed(undefined, { DC: { strength: 65, reasons: ["coached"] }, PBKS: { strength: 67, reasons: ["coached"] } }),
  "justin-langer": seed("Western Australia", { LSG: { strength: 70, reasons: ["coached"] } }),
  "kane-williamson": seed("Tauranga", { SRH: { strength: 91, reasons: ["played", "long_service"] }, GT: { strength: 60, reasons: ["played"] }, LSG: { strength: 64, reasons: ["coached"] } }),
  "kieron-pollard": seed("Trinidad", { MI: { strength: 100, reasons: ["played", "coached", "long_service"] } }),
  "kumar-sangakkara": seed("Kandy", { RR: { strength: 91, reasons: ["coached", "long_service"] }, SRH: { strength: 58, reasons: ["played"] }, PBKS: { strength: 45, reasons: ["played"] } }),
  "lasith-malinga": seed("Galle", { MI: { strength: 100, reasons: ["played", "coached", "long_service"] }, RR: { strength: 55, reasons: ["coached"] } }),
  "mahela-jayawardene": seed("Colombo", { MI: { strength: 96, reasons: ["coached", "long_service"] }, PBKS: { strength: 45, reasons: ["played"] } }),
  "malolan-rangarajan": seed("Tamil Nadu", { CSK: { strength: 67, reasons: ["home"] }, RCB: { strength: 73, reasons: ["coached"] } }),
  "mark-boucher": seed("Gauteng", { MI: { strength: 62, reasons: ["coached"] }, KKR: { strength: 44, reasons: ["played"] } }),
  "matthew-hayden": seed("Queensland", { CSK: { strength: 84, reasons: ["played"] }, GT: { strength: 62, reasons: ["coached"] } }),
  "matthew-wade": seed("Tasmania", { GT: { strength: 62, reasons: ["played"] }, PBKS: { strength: 60, reasons: ["coached"] } }),
  "michael-hussey": seed("Western Australia", { CSK: { strength: 98, reasons: ["played", "coached", "long_service"] }, MI: { strength: 48, reasons: ["played"] } }),
  "mike-hesson": seed("Otago", { RCB: { strength: 65, reasons: ["coached"] }, PBKS: { strength: 53, reasons: ["coached"] } }),
  "mohammad-kaif": seed("Uttar Pradesh", { LSG: { strength: 70, reasons: ["home"] }, DC: { strength: 68, reasons: ["coached"] }, RCB: { strength: 47, reasons: ["played"] } }),
  "morne-morkel": seed("Gauteng", { KKR: { strength: 72, reasons: ["played"] }, LSG: { strength: 65, reasons: ["coached"] }, RR: { strength: 45, reasons: ["played"] } }),
  "ms-dhoni": seed("Jharkhand", { CSK: { strength: 100, reasons: ["played", "coached", "long_service"] } }),
  "munaf-patel": seed("Gujarat", { GT: { strength: 73, reasons: ["home"] }, MI: { strength: 64, reasons: ["played"] }, DC: { strength: 57, reasons: ["coached"] } }),
  "muttiah-muralitharan": seed("Kandy", { CSK: { strength: 61, reasons: ["played"] }, RCB: { strength: 48, reasons: ["played"] }, SRH: { strength: 95, reasons: ["coached", "long_service"] } }),
  "naeem-amin": seed("Gujarat", { GT: { strength: 80, reasons: ["home", "coached"] } }),
  "narender-negi": seed("Delhi", { DC: { strength: 66, reasons: ["home"] }, GT: { strength: 72, reasons: ["coached"] } }),
  "omkar-salvi": seed("Mumbai", { MI: { strength: 70, reasons: ["home"] }, KKR: { strength: 62, reasons: ["coached"] }, RCB: { strength: 66, reasons: ["coached"] } }),
  "paras-mhambrey": seed("Mumbai", { MI: { strength: 86, reasons: ["home", "coached"] } }),
  "parthiv-patel": seed("Gujarat", { GT: { strength: 88, reasons: ["home", "coached"] }, RCB: { strength: 62, reasons: ["played"] }, CSK: { strength: 45, reasons: ["played"] } }),
  "pravin-amre": seed("Mumbai", { MI: { strength: 65, reasons: ["home"] }, DC: { strength: 82, reasons: ["coached", "long_service"] } }),
  "rahul-dravid": seed("Bengaluru", { RCB: { strength: 82, reasons: ["home", "played"] }, RR: { strength: 88, reasons: ["played", "coached", "long_service"] } }),
  "r-sridhar": seed("Hyderabad", { SRH: { strength: 75, reasons: ["home"] }, PBKS: { strength: 56, reasons: ["coached"] } }),
  "rajiv-kumar": seed("Jharkhand", { CSK: { strength: 88, reasons: ["coached", "long_service"] } }),
  "ricky-ponting": seed("Tasmania", { MI: { strength: 68, reasons: ["played", "coached"] }, DC: { strength: 86, reasons: ["coached", "long_service"] }, PBKS: { strength: 70, reasons: ["coached"] }, KKR: { strength: 43, reasons: ["played"] } }),
  "robin-uthappa": seed("Karnataka", { RCB: { strength: 71, reasons: ["home", "played"] }, KKR: { strength: 80, reasons: ["played", "long_service"] }, CSK: { strength: 62, reasons: ["played"] } }),
  "sachin-tendulkar": seed("Mumbai", { MI: { strength: 100, reasons: ["home", "played", "coached", "long_service"] } }),
  "sairaj-bahutule": seed("Mumbai", { MI: { strength: 70, reasons: ["home"] }, RR: { strength: 58, reasons: ["coached"] }, PBKS: { strength: 62, reasons: ["coached"] } }),
  "sanjay-bangar": seed("Maharashtra", { MI: { strength: 60, reasons: ["home"] }, RCB: { strength: 72, reasons: ["coached"] }, PBKS: { strength: 60, reasons: ["coached"] } }),
  "shane-bond": seed("Canterbury", { MI: { strength: 88, reasons: ["coached", "long_service"] }, RR: { strength: 65, reasons: ["coached"] }, KKR: { strength: 47, reasons: ["played"] } }),
  "shane-watson": seed("Queensland", { RR: { strength: 86, reasons: ["played", "long_service"] }, CSK: { strength: 83, reasons: ["played"] }, RCB: { strength: 58, reasons: ["played"] }, DC: { strength: 56, reasons: ["coached"] }, KKR: { strength: 59, reasons: ["coached"] } }),
  "simon-katich": seed("Western Australia", { KKR: { strength: 58, reasons: ["coached"] }, RCB: { strength: 56, reasons: ["coached"] } }),
  "sitanshu-kotak": seed("Gujarat", { GT: { strength: 78, reasons: ["home"] } }),
  "sourav-ganguly": seed("Kolkata", { KKR: { strength: 90, reasons: ["home", "played"] }, DC: { strength: 82, reasons: ["coached", "long_service"] } }),
  "sridharan-sriram": seed("Tamil Nadu", { CSK: { strength: 80, reasons: ["home", "coached"] }, RCB: { strength: 55, reasons: ["coached"] } }),
  "stephen-fleming": seed("Christchurch", { CSK: { strength: 100, reasons: ["played", "coached", "long_service"] } }),
  "suresh-raina": seed("Uttar Pradesh", { LSG: { strength: 73, reasons: ["home"] }, CSK: { strength: 98, reasons: ["played", "long_service"] }, GT: { strength: 45, reasons: ["played"] } }),
  "t-dilip": seed("Hyderabad", { SRH: { strength: 75, reasons: ["home"] } }),
  "tom-moody": seed("Western Australia", { SRH: { strength: 85, reasons: ["coached", "long_service"] }, PBKS: { strength: 55, reasons: ["coached"] } }),
  "trevor-bayliss": seed("New South Wales", { KKR: { strength: 80, reasons: ["coached"] }, SRH: { strength: 65, reasons: ["coached"] }, PBKS: { strength: 55, reasons: ["coached"] } }),
  "trevor-gonsalves": seed("Punjab", { PBKS: { strength: 82, reasons: ["home", "coached"] } }),
  "varun-aaron": seed("Jharkhand", { SRH: { strength: 60, reasons: ["coached"] }, RCB: { strength: 46, reasons: ["played"] }, RR: { strength: 46, reasons: ["played"] } }),
  "vijay-dahiya": seed("Delhi", { DC: { strength: 82, reasons: ["home", "coached"] }, KKR: { strength: 70, reasons: ["coached"] }, LSG: { strength: 55, reasons: ["coached"] } }),
  "vikram-rathour": seed("Punjab", { PBKS: { strength: 76, reasons: ["home"] }, RR: { strength: 68, reasons: ["coached"] } }),
  "virender-sehwag": seed("Delhi", { DC: { strength: 93, reasons: ["home", "played", "long_service"] }, PBKS: { strength: 68, reasons: ["played", "coached"] } }),
  "vvs-laxman": seed("Hyderabad", { SRH: { strength: 94, reasons: ["home", "coached", "long_service"] } }),
  "wasim-jaffer": seed("Mumbai", { MI: { strength: 68, reasons: ["home"] }, PBKS: { strength: 72, reasons: ["coached"] } }),
  "yuvraj-singh": seed("Punjab", { PBKS: { strength: 91, reasons: ["home", "played", "long_service"] }, SRH: { strength: 46, reasons: ["played"] }, RCB: { strength: 45, reasons: ["played"] }, DC: { strength: 60, reasons: ["coached"] } }),
  "zaheer-khan": seed("Mumbai", { MI: { strength: 88, reasons: ["home", "played", "coached"] }, DC: { strength: 72, reasons: ["played", "coached"] }, RCB: { strength: 48, reasons: ["played"] }, LSG: { strength: 58, reasons: ["coached"] } }),
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function resolveStaffAffinityProfile(input: {
  slug: string;
  country?: string | null;
  currentTeamId?: string | null;
}): StaffAffinityProfile {
  const affinitySeed = STAFF_AFFINITY_SEEDS[input.slug] ?? {};
  const clubs = new Map<string, StaffClubAffinity>();
  Object.entries(affinitySeed.clubs ?? {}).forEach(([teamId, value]) => {
    if (!value) return;
    clubs.set(teamId, { teamId, strength: clamp(value.strength), reasons: [...value.reasons] });
  });
  if (input.currentTeamId) {
    const existing = clubs.get(input.currentTeamId);
    clubs.set(input.currentTeamId, existing
      ? { ...existing, strength: Math.max(existing.strength, 68), reasons: Array.from(new Set([...existing.reasons, "current_club" as const])) }
      : { teamId: input.currentTeamId, strength: 68, reasons: ["current_club"] });
  }
  return {
    homeRegion: affinitySeed.homeRegion ?? null,
    homeCountry: input.country?.trim() || "Unknown",
    clubs: Array.from(clubs.values()).sort((left, right) => right.strength - left.strength || left.teamId.localeCompare(right.teamId)),
  };
}

export const getStaffClubAffinity = (profile: StaffAffinityProfile | null | undefined, teamId: string) => (
  profile?.clubs.find((affinity) => affinity.teamId === teamId)?.strength ?? 0
);
