import type { StaffRatingRole } from "../logic/staffRatings";

export type NationalStaffFormat = "t20" | "test";

export interface NationalStaffSeed {
  countryId: string;
  format: NationalStaffFormat;
  role: StaffRatingRole;
  startSeason: number;
  endSeason: number | null;
  sourceUrl: string;
}

// Existing directory members with current national appointments. Club and
// national contracts are exclusive in the game. England's Test post is
// separate from its T20 staff. Unreported terms use an in-game review date.
export const NATIONAL_STAFF_SEEDS: Record<string, NationalStaffSeed> = {
  "gautam-gambhir": { countryId: "IND", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.bcci.tv/news/article/mr-gautam-gambhir-appointed-as-head-coach-team-india-senior-men" },
  "brendon-mccullum": { countryId: "ENG", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.ecb.co.uk/news/4534153" },
  "stephen-fleming": { countryId: "ENG", format: "test", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "user-directed England Test appointment" },
  "andrew-mcdonald": { countryId: "AUS", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.cricket.com.au/high-performance/coaching" },
  "shukri-conrad": { countryId: "SA", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.icc-cricket.com/news/south-africa-name-new-all-format-head-coach" },
  "rob-walter": { countryId: "NZ", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2028, sourceUrl: "https://www.icc-cricket.com/news/stead-replacement-named-as-new-zealand-men-s-coach" },
  "daren-sammy": { countryId: "WI", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.icc-cricket.com/news/windies-great-to-take-over-as-all-format-head-coach-in-2025" },
  "gary-kirsten": { countryId: "SL", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2028, sourceUrl: "https://www.icc-cricket.com/news/sri-lanka-appoint-new-head-coach-for-men-s-team" },
  "mike-hesson": { countryId: "PAK", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.icc-cricket.com/news/pakistan-appoint-seasoned-leader-as-white-ball-head-coach" },
  "richard-pybus": { countryId: "AFG", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.icc-cricket.com/news/aghanistan-appoint-new-head-coach-after-trott-s-departure" },
  "dav-whatmore": { countryId: "MAS", format: "t20", role: "head_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.icc-cricket.com/news/malaysia-launches-national-cricket-centre-for-long-term-growth" },
  "sitanshu-kotak": { countryId: "IND", format: "t20", role: "batting_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.icc-cricket.com/news/padikkal-tons-up-again-as-india-dominate-day-1-in-colombo" },
  "morne-morkel": { countryId: "IND", format: "t20", role: "pace_bowling_coach", startSeason: 2026, endSeason: 2029, sourceUrl: "https://www.icc-cricket.com/news/morkel-understands-key-to-success-in-sri-lanka" },
  "kevin-pietersen": { countryId: "ENG", format: "t20", role: "mentor", startSeason: 2026, endSeason: 2027, sourceUrl: "https://www.ecb.co.uk/news/4573221/kevin-pietersen-appointed-specialist-mentor-to-england-mens-white-ball-teams" },
  "marcus-trescothick": { countryId: "ENG", format: "t20", role: "batting_coach", startSeason: 2026, endSeason: 2027, sourceUrl: "https://www.ecb.co.uk/news/4573221/kevin-pietersen-appointed-specialist-mentor-to-england-mens-white-ball-teams" },
  "sarah-taylor": { countryId: "ENG", format: "t20", role: "wicketkeeping_coach", startSeason: 2026, endSeason: 2027, sourceUrl: "https://www.ecb.co.uk/news/4573221/kevin-pietersen-appointed-specialist-mentor-to-england-mens-white-ball-teams" },
  "troy-cooley": { countryId: "ENG", format: "t20", role: "pace_bowling_coach", startSeason: 2026, endSeason: 2028, sourceUrl: "https://www.ecb.co.uk/news/4437734/cooley-appointed-as-mens-elite-national-pace-bowling-lead" },
};

export const NATIONAL_STAFF_SEED_REVISION = 3;
