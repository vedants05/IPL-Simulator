export type StaffContractConfidence = "confirmed" | "provided" | "supported" | "estimated";

export interface StaffContractSeed {
  teamId: string;
  role: string;
  appointmentYear: number;
  contractEndYear: number | null;
  confidence: StaffContractConfidence;
  sourceUrl: string;
  evidence: string;
}

const seed = (
  teamId: string,
  role: string,
  appointmentYear: number,
  contractEndYear: number,
  confidence: StaffContractConfidence,
  sourceUrl: string,
  evidence: string,
): StaffContractSeed => ({
  teamId,
  role,
  appointmentYear,
  // An appointment date, continued service, or wording such as "upcoming
  // seasons" does not establish a contractual expiry. Keep those records
  // open-ended so the game can treat them as rolling contracts.
  contractEndYear: confidence === "confirmed" || confidence === "provided" ? contractEndYear : null,
  confidence,
  sourceUrl,
  evidence,
});

const CSK_SOURCE = "https://www.iplt20.com/teams/chennai-super-kings/news/announcements";
const DC_2025_SOURCE = "https://www.delhicapitals.in/news/delhi-capitals-announce-new-coaching-staff-ahead-of-ipl-2025";
const DC_MOONEY_SOURCE = "https://www.business-standard.com/cricket/ipl/ipl-2026-delhi-capitals-rope-in-john-mooney-as-new-fielding-coach-126031900754_1.html";
const GT_2026_SOURCE = "https://www.gujarattitansipl.com/news/gujarat-titans-shubharambh-tata-ipl-2026";
const GT_HAYDEN_SOURCE = "https://www.gujarattitansipl.com/news/gujarat-titans-appoint-matthew-hayden-batting-coach-tata-ipl-2026";
const GT_PARTHIV_SOURCE = "https://www.gujarattitansipl.com/news/parthiv-patel-joins-gujarat-titans-as-assistant-coach-for-tata-ipl-2025";
const KKR_SOURCE = "https://www.iplt20.com/teams/kolkata-knight-riders";
const LSG_SOURCE = "https://www.lucknowsupergiants.in/about-us";
const LSG_ARUN_SOURCE = "https://www.lucknowsupergiants.in/news/bharat-arun-joins-lucknow-super-giants-as-bowling-coach";
const MI_SOURCE = "https://www.mumbaiindians.com/amp/news/teachers-day-2025-mumbai-indians-cricket";
const MI_MAHELA_SOURCE = "https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025";
const PBKS_SOURCE = "https://www.punjabkingsipl.in/players";
const PBKS_PONTING_SOURCE = "https://www.punjabkingsipl.in/news/ricky-ponting-ao-appointed-as-new-punjab-kings-head-coach";
const PBKS_BAHUTULE_SOURCE = "https://www.punjabkingsipl.in/news/punjab-kings-announce-appointment-of-veteran-cricketer-sairaj-bahutule-as-new-spin-bowling-coach";
const RCB_SOURCE = "https://www.royalchallengers.com/rcb-cricket-news/news/dinesh-karthik-and-mo-bobat-explain-rcbs-interesting-dugout-dynamics-during";
const RR_SOURCE = "https://www.rajasthanroyals.com/latest-news/kumar-sangakkara-rr-new-head-coach-ipl-2026";
const SRH_SOURCE = "https://www.sunrisershyderabad.in/orange-vault";

// Phase-1 seed data: these describe the real-world starting state of a new
// 2026 career. `estimated` is deliberate where franchises disclose the role
// but not the private contract term. It must never be presented as confirmed.
export const STAFF_CONTRACT_SEEDS: Record<string, StaffContractSeed> = {
  "aashish-kapoor": seed("GT", "spin_bowling_coach", 2022, 2027, "provided", GT_2026_SOURCE, "User-confirmed contract expiry in 2027."),
  "abhay-sharma": seed("LSG", "fielding_coach", 2026, 2027, "estimated", LSG_SOURCE, "Listed in the reconstructed 2026 LSG group; no term disclosed, so a two-season initial game contract is used."),
  "abhishek-nayar": seed("KKR", "head_coach", 2026, 2027, "provided", KKR_SOURCE, "User-confirmed contract expiry in 2027, citing Gulf News."),
  "andre-russell": seed("KKR", "batting_coach", 2026, 2027, "provided", KKR_SOURCE, "User-confirmed contract expiry in 2027."),
  "andy-flower": seed("RCB", "head_coach", 2024, 2030, "provided", RCB_SOURCE, "User-confirmed contract expiry in 2030."),
  "arun-karthik": seed("CSK", "coach", 2026, 2027, "estimated", CSK_SOURCE, "Promoted from the Super Kings pathway into the 2026 senior group; no term disclosed, so a two-season first contract is used."),
  "ashish-nehra": seed("GT", "head_coach", 2022, 2027, "provided", GT_2026_SOURCE, "User-confirmed contract expiry in 2027."),
  "bharat-arun": seed("LSG", "pace_bowling_coach", 2026, 2027, "provided", LSG_ARUN_SOURCE, "User-confirmed contract expiry in 2027."),
  "brad-haddin": seed("PBKS", "batting_coach", 2025, 2027, "provided", PBKS_SOURCE, "User-confirmed contract expiry in 2027."),
  "carl-crowe": seed("LSG", "spin_bowling_coach", 2026, 2027, "provided", LSG_SOURCE, "User-confirmed contract expiry in 2027, citing The Times of India."),
  "carl-hopkinson": seed("MI", "fielding_coach", 2025, 2026, "provided", MI_SOURCE, "User-confirmed 2026 expiry, operating on an annual review cycle."),
  "daniel-vettori": seed("SRH", "head_coach", 2024, 2026, "estimated", SRH_SOURCE, "Official SRH 2026 media confirms Vettori's third season; no extension term is public, so the current three-season cycle ends in 2026."),
  "dinesh-karthik": seed("RCB", "batting_coach", 2025, 2027, "provided", RCB_SOURCE, "User-confirmed contract expiry in 2027."),
  "dishant-yagnik": seed("KKR", "fielding_coach", 2026, 2027, "estimated", KKR_SOURCE, "Part of KKR's new 2026 coaching group; no public term, so a two-season initial deal is assumed."),
  "dwayne-bravo": seed("KKR", "mentor", 2025, 2027, "provided", KKR_SOURCE, "User-confirmed contract expiry in 2027."),
  "eoin-morgan": seed("CSK", "head_coach", 2026, 2030, "provided", CSK_SOURCE, "User-directed CSK head-coach appointment with a contract expiry in 2030."),
  "eric-simons": seed("CSK", "pace_bowling_coach", 2018, 2026, "estimated", CSK_SOURCE, "Long-serving CSK consultant active in 2026; the private rolling arrangement is conservatively seeded only through the current season."),
  "govindamenon-jayakumar": seed("LSG", "batting_coach", 2026, 2027, "provided", LSG_SOURCE, "User-confirmed contract expiry in 2027."),
  "hariesh-jaikumar": seed("SRH", "batting_coach", 2026, 2027, "estimated", SRH_SOURCE, "Included in SRH's 2026 specialist group; no term disclosed, so a two-season new appointment is assumed."),
  "sourav-ganguly": seed("DC", "head_coach", 2026, 2029, "provided", DC_2025_SOURCE, "User-directed DC head-coach appointment with a contract expiry in 2029."),
  "yuvraj-singh": seed("DC", "batting_coach", 2026, 2027, "estimated", DC_2025_SOURCE, "User-directed DC batting-coach appointment; the contract is estimated through 2027."),
  "james-franklin": seed("SRH", "assistant_coach", 2026, 2027, "estimated", SRH_SOURCE, "Included in the 2026 SRH staff dataset; no public contract term, so a two-season appointment is assumed."),
  "james-hopes": seed("PBKS", "pace_bowling_coach", 2025, 2027, "provided", PBKS_SOURCE, "User-confirmed contract expiry in 2027."),
  "john-mooney": seed("DC", "fielding_coach", 2026, 2027, "estimated", DC_MOONEY_SOURCE, "Appointed ahead of IPL 2026 with no disclosed term; a standard two-season first contract is used."),
  "justin-langer": seed("LSG", "head_coach", 2024, 2027, "provided", LSG_SOURCE, "User-confirmed contract expiry in 2027, citing The Times of India."),
  "kane-williamson": seed("LSG", "mentor", 2026, 2027, "provided", LSG_SOURCE, "User-confirmed contract expiry in 2027, citing Indiatimes; role includes mentor and strategic-adviser responsibilities."),
  "kieron-pollard": seed("MI", "batting_coach", 2023, 2027, "provided", MI_SOURCE, "User-confirmed 2027 expiry within a rolling multi-franchise contract arrangement."),
  "kumar-sangakkara": seed("RR", "head_coach", 2026, 2027, "provided", RR_SOURCE, "User-confirmed contract expiry in 2027; Sangakkara serves as Head Coach and Director of Cricket."),
  "lance-klusener": seed("LSG", "assistant_coach", 2024, 2027, "provided", LSG_SOURCE, "User-confirmed contract expiry in 2027."),
  "lasith-malinga": seed("MI", "pace_bowling_coach", 2024, 2027, "provided", MI_SOURCE, "User-confirmed contract expiry in 2027."),
  "mahela-jayawardene": seed("MI", "head_coach", 2025, 2027, "provided", MI_MAHELA_SOURCE, "User-confirmed contract expiry in 2027."),
  "malolan-rangarajan": seed("RCB", "spin_bowling_coach", 2024, 2026, "estimated", RCB_SOURCE, "Confirmed in RCB's 2026 think-tank; no expiry is public, so the current three-season cycle ends in 2026."),
  "matthew-hayden": seed("GT", "mentor", 2026, 2027, "provided", GT_HAYDEN_SOURCE, "User-confirmed contract expiry in 2027."),
  "matthew-wade": seed("PBKS", "coach", 2026, 2027, "provided", PBKS_SOURCE, "User-confirmed contract expiry in 2027."),
  "michael-hussey": seed("CSK", "batting_coach", 2018, 2026, "estimated", CSK_SOURCE, "Long-serving CSK batting coach active in 2026; the private rolling arrangement is conservatively seeded through the current season."),
  "ms-dhoni": seed("CSK", "mentor", 2026, 2026, "estimated", CSK_SOURCE, "User-directed CSK mentor appointment on a rolling contract."),
  "munaf-patel": seed("DC", "pace_bowling_coach", 2025, 2026, "supported", DC_2025_SOURCE, "Part of Delhi's rebuilt 2025 staff and confirmed again in 2026; no guaranteed 2027 term is published."),
  "muttiah-muralitharan": seed("SRH", "spin_bowling_coach", 2015, 2026, "estimated", SRH_SOURCE, "Long-serving SRH specialist active in official 2026 media; the rolling deal is conservatively seeded through 2026."),
  "naeem-amin": seed("GT", "pace_bowling_coach", 2022, 2027, "provided", GT_2026_SOURCE, "User-confirmed contract expiry in 2027."),
  "narender-negi": seed("GT", "fielding_coach", 2022, 2027, "provided", GT_2026_SOURCE, "User-confirmed contract expiry in 2027."),
  "omkar-salvi": seed("RCB", "pace_bowling_coach", 2025, 2027, "provided", RCB_SOURCE, "User-confirmed contract expiry in 2027."),
  "paras-mhambrey": seed("MI", "pace_bowling_coach", 2025, 2027, "provided", MI_SOURCE, "User-confirmed contract expiry in 2027."),
  "parthiv-patel": seed("GT", "batting_coach", 2025, 2027, "provided", GT_PARTHIV_SOURCE, "User-confirmed contract expiry in 2027, citing Business Standard; public reporting describes a combined assistant and batting-coach remit."),
  "rajiv-kumar": seed("CSK", "fielding_coach", 2018, 2026, "estimated", CSK_SOURCE, "Long-serving CSK support coach active in 2026; no public expiry, so the rolling appointment is seeded through this season."),
  "richard-das-neves": seed("RR", "spin_bowling_coach", 2026, 2026, "estimated", RR_SOURCE, "The role is present in the supplied 2026 dataset but not named on RR's public senior support-staff page; a one-season low-certainty seed avoids inventing a longer deal."),
  "richard-halsall": seed("RCB", "fielding_coach", 2026, 2027, "provided", RCB_SOURCE, "User-confirmed contract expiry in 2027."),
  "ricky-ponting": seed("PBKS", "head_coach", 2025, 2028, "confirmed", PBKS_PONTING_SOURCE, "PBKS explicitly stated Ponting would guide the team for four seasons beginning in 2025; user also confirmed 2028 citing India Today."),
  "ryan-cook": seed("LSG", "coach", 2026, 2027, "estimated", LSG_SOURCE, "Included in the rebuilt 2026 LSG staff; no public duration, so a two-season appointment is used."),
  "sachin-tendulkar": seed("MI", "mentor", 2014, 2026, "estimated", MI_SOURCE, "Long-standing honorary/mentor association rather than a disclosed fixed-term coaching deal; seeded through the current season for later in-game renewal."),
  "sairaj-bahutule": seed("PBKS", "spin_bowling_coach", 2026, 2027, "provided", PBKS_BAHUTULE_SOURCE, "User-confirmed contract expiry in 2027."),
  "amit-mishra": seed("DC", "spin_bowling_coach", 2026, 2027, "estimated", DC_MOONEY_SOURCE, "User-directed DC spin-bowling-coach appointment; the contract is estimated through 2027."),
  "shane-bond": seed("RR", "pace_bowling_coach", 2024, 2027, "provided", RR_SOURCE, "User-confirmed contract expiry in 2027."),
  "shane-watson": seed("KKR", "batting_coach", 2026, 2027, "provided", KKR_SOURCE, "User-confirmed contract expiry in 2027, citing Hindustan Times; public reporting labels Watson assistant coach while the current game assignment remains batting coach."),
  "simon-helmot": seed("SRH", "fielding_coach", 2026, 2027, "estimated", SRH_SOURCE, "Included in the 2026 SRH group without a published term; a two-season appointment is assumed."),
  "sridharan-sriram": seed("CSK", "spin_bowling_coach", 2025, 2026, "estimated", CSK_SOURCE, "Joined the CSK specialist group for the current cycle and remained in 2026; no later term is published."),
  "tim-southee": seed("KKR", "pace_bowling_coach", 2026, 2027, "provided", KKR_SOURCE, "User-confirmed contract expiry in 2027."),
  "trevor-gonsalves": seed("PBKS", "coach", 2025, 2028, "estimated", PBKS_SOURCE, "Member of the PBKS support group built around Ponting; his term is private, so alignment with the four-season project is an estimate."),
  "trevor-penney": seed("RR", "assistant_coach", 2026, 2027, "provided", RR_SOURCE, "User-confirmed contract expiry in 2027."),
  "varun-aaron": seed("SRH", "pace_bowling_coach", 2026, 2027, "estimated", SRH_SOURCE, "Official SRH 2026 media confirms Aaron in the coaching group; no duration disclosed, so a two-season first contract is used."),
  "vikram-rathour": seed("RR", "batting_coach", 2025, 2027, "provided", RR_SOURCE, "User-confirmed contract expiry in 2027."),
};

export const getStaffContractSeed = (slug: string) => STAFF_CONTRACT_SEEDS[slug] ?? null;
