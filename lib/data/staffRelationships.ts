export type StaffRelationshipType = "trusted_colleague" | "preferred_assistant" | "inner_circle_assistant" | "essential_staff";

export interface StaffRelationshipSeed {
  headCoachSlug: string;
  staffSlug: string;
  type: StaffRelationshipType;
  strength: number;
  recruitmentBonus: number;
  followChance: number;
  preferredRole: string;
  evidence: string;
  sourceUrl: string;
}

const relationship = (
  headCoachSlug: string, staffSlug: string, type: StaffRelationshipType, strength: number,
  preferredRole: string, evidence: string, sourceUrl: string,
): StaffRelationshipSeed => ({
  headCoachSlug, staffSlug, type, strength, preferredRole, evidence, sourceUrl,
  recruitmentBonus: type === "essential_staff" ? 20 : type === "inner_circle_assistant" ? 18 : type === "preferred_assistant" ? 12 : 7,
  followChance: type === "essential_staff" ? 1 : type === "inner_circle_assistant" ? 0.95 : type === "preferred_assistant" ? 0.75 : 0.45,
});

/** Directed, evidence-backed starting relationships. No relationship is created
 * merely because two staff members share a nationality or a current club. */
export const STAFF_RELATIONSHIP_SEEDS: StaffRelationshipSeed[] = [
  relationship("trevor-bayliss", "paul-farbrace", "essential_staff", 100, "assistant_coach", "Bayliss personally recruited Farbrace as his assistant for Sri Lanka and reunited with him in the same structure for England.", "https://www.bbc.co.uk/sport/cricket/41917102"),
  relationship("ricky-ponting", "james-hopes", "inner_circle_assistant", 96, "pace_bowling_coach", "Hopes worked under Ponting at Delhi and declined a Delhi extension to continue alongside him at Punjab.", "https://www.cricbuzz.com/cricket-news/132208/pbks-retain-brad-haddin-and-sunil-joshi-james-hopes-may-join-support-staff-cricbuzzcom"),
  relationship("rahul-dravid", "vikram-rathour", "inner_circle_assistant", 95, "batting_coach", "After their successful India partnership, Rathour explicitly reunited with Dravid at Rajasthan and described their strong rapport.", "https://www.espn.com/cricket/story/_/id/41338406/ipl-vikram-rathour-joins-rajasthan-royals-batting-coach"),
  relationship("gautam-gambhir", "ryan-ten-doeschate", "inner_circle_assistant", 94, "assistant_coach", "Ten Doeschate moved from Gambhir's KKR group into his India support staff.", "https://www.aajtak.in/sports/cricket/story/gautam-gambhir-coaching-staff-is-inexperienced-ryan-ten-doeschate-abhishek-nayar-not-play-test-cricket-team-india-tspo-dskc-2087793-2024-11-04"),
  relationship("gautam-gambhir", "morne-morkel", "inner_circle_assistant", 93, "pace_bowling_coach", "Morkel worked in Gambhir-led structures at Lucknow before being recommended by Gambhir as bowling coach for his India staff.", "https://www.espn.in/cricket/story/_/id/40856135/morne-morkel-appointed-india-bowling-coach"),
  relationship("mickey-arthur", "grant-flower", "inner_circle_assistant", 92, "batting_coach", "Flower served in Arthur's Pakistan staff and subsequently joined the Sri Lanka coaching structure led by Arthur.", "https://tribune.com.pk/story/1099949/arthurs-roots-to-grow-wings-to-fly-mantra-for-pakistan"),
  relationship("stephen-fleming", "eric-simons", "preferred_assistant", 90, "pace_bowling_coach", "Simons has served for years in Fleming-led Chennai and Joburg Super Kings structures.", "https://www.wisden.com/cricket-news/sa20-2024-coaches-full-list-support-staff-each-sa20-team"),
  relationship("tom-moody", "simon-helmot", "preferred_assistant", 90, "assistant_coach", "Helmot was Moody's long-serving assistant through the original Sunrisers cycle and their later return.", "https://www.espn.com/cricket/story/_/id/34508567/ipl-2023-srh-brian-lara-takes-tom-moody-sunrisers-head-coach"),
  relationship("stephen-fleming", "michael-hussey", "preferred_assistant", 87, "batting_coach", "Hussey has remained a central batting coach throughout Fleming's long-running Chennai staff.", "https://www.iplt20.com/teams/chennai-super-kings"),
  relationship("rahul-dravid", "paras-mhambrey", "preferred_assistant", 86, "pace_bowling_coach", "Mhambrey worked in Dravid-led India pathway and senior national-team structures across multiple cycles.", "https://www.bcci.tv/articles/2021/news/155451/rahul-dravid-appointed-head-coach-of-team-india-men-s-senior-national-team"),
  relationship("mahela-jayawardene", "lasith-malinga", "preferred_assistant", 85, "pace_bowling_coach", "Malinga served as a Mumbai bowling mentor under Jayawardene in 2018 and returned to his later Mumbai coaching group.", "https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025"),
  relationship("ricky-ponting", "pravin-amre", "preferred_assistant", 83, "batting_coach", "Amre was a long-serving senior member of Ponting's Delhi Capitals coaching group.", "https://www.espn.com/cricket/story/_/id/40553669/ricky-ponting-delhi-capitals-part-ways"),
  relationship("tom-moody", "muttiah-muralitharan", "preferred_assistant", 82, "spin_bowling_coach", "Muralitharan was the specialist constant across Moody's long Sunrisers coaching tenure.", "https://www.iplt20.com/teams/sunrisers-hyderabad"),
  relationship("mahela-jayawardene", "kieron-pollard", "preferred_assistant", 81, "batting_coach", "Pollard was a senior leader throughout Jayawardene's title-winning Mumbai tenure and later joined the franchise coaching staff.", "https://www.mumbaiindians.com/news/welcome-back-head-coach-mahela-jayawardene-ipl-2025"),
  relationship("ricky-ponting", "brad-haddin", "preferred_assistant", 78, "assistant_coach", "Haddin forms part of Ponting's senior Punjab support group after their overlapping Australia coaching work.", "https://www.espn.in/cricket/story/_/id/44385100/ipl-2025-brad-haddin-backs-ricky-ponting-view-build-greatest-punjab-kings-team"),
  relationship("rahul-dravid", "t-dilip", "trusted_colleague", 76, "fielding_coach", "Dilip served throughout Dravid's senior India head-coach cycle, including the 2024 T20 World Cup success.", "https://www.bcci.tv/articles/2021/news/155451/rahul-dravid-appointed-head-coach-of-team-india-men-s-senior-national-team"),
  relationship("mickey-arthur", "morne-morkel", "trusted_colleague", 75, "pace_bowling_coach", "Arthur selected Morkel for the Pakistan structure he assembled as team director.", "https://www.wisden.com/cricket-interviews/cricket-interviews/mickey-arthur-i-continually-witness-pakistan-cricket-nailing-it-in-the-foot"),
  relationship("kumar-sangakkara", "trevor-penney", "trusted_colleague", 74, "assistant_coach", "Penney has served in Rajasthan's senior coaching group during Sangakkara's extended cricket-leadership tenure.", "https://www.rajasthanroyals.com/latest-news/kumar-sangakkara-rr-new-head-coach-ipl-2026"),
  relationship("justin-langer", "brad-haddin", "trusted_colleague", 72, "assistant_coach", "Haddin served as Australia's fielding coach during the opening period of Langer's national-team tenure.", "https://www.cricket.com.au/news/3303872/mcdonald-secures-australia-assistant-coach-role"),
];

export const getStaffRelationship = (headCoachSlug: string | null | undefined, staffSlug: string | null | undefined) => (
  headCoachSlug && staffSlug
    ? STAFF_RELATIONSHIP_SEEDS.find((item) => item.headCoachSlug === headCoachSlug && item.staffSlug === staffSlug) ?? null
    : null
);

export const getStaffRelationshipRecruitmentBonus = (headCoachSlug: string | null | undefined, staffSlug: string | null | undefined) => (
  getStaffRelationship(headCoachSlug, staffSlug)?.recruitmentBonus ?? 0
);
