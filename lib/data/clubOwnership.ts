export type OwnershipArchetype =
  | "patron_continuity"
  | "brand_legacy"
  | "corporate_analytical"
  | "hands_on_volatile"
  | "private_equity"
  | "youth_innovator";

export interface ClubOwnershipRecord {
  // Identity & Leadership (3 Explicit Columns)
  team_id: string;
  owner_name: string;
  consortium_name: string;
  ceo_name: string;

  // CEO Attributes
  ceo_involvement: number;
  ceo_patience: number;
  ceo_media_presence: number;
  ceo_ambition: number;

  // Board & Patience Attributes
  ownership_archetype: OwnershipArchetype;
  founding_year: number;
  headquarters: string;
  patience_modifier: number;
  trophy_obsession_level: number;

  // Financial & Investment Attributes
  financial_generosity: number;
  staff_budget_flexibility: number;
  stadium_upgrade_willingness: number;

  // Intervention & Governance Attributes
  meddling_frequency: number;
  lineup_interference_tendency: number;
  scouting_investment_level: number;
  brand_commercial_priority: number;

  // Seasonal Targets
  expected_position_baseline: number;
  min_acceptable_wins: number;
  youth_regen_target_count: number;

  // Narrative & Vision
  vision_statement: string;
  rationale: string;
}

export const CLUB_OWNERSHIPS: Record<string, ClubOwnershipRecord> = {
  CSK: {
    team_id: "CSK",
    owner_name: "N. Srinivasan & Gurunath Family",
    consortium_name: "Chennai Super Kings Cricket Ltd",
    ceo_name: "K.S. Viswanathan",
    ownership_archetype: "patron_continuity",
    founding_year: 2008,
    headquarters: "Chennai, Tamil Nadu",
    ceo_involvement: 12,
    ceo_patience: 18,
    ceo_media_presence: 8,
    ceo_ambition: 17,
    patience_modifier: 12,
    trophy_obsession_level: 15,
    financial_generosity: 17,
    staff_budget_flexibility: 16,
    stadium_upgrade_willingness: 15,
    meddling_frequency: 2,
    lineup_interference_tendency: 1,
    scouting_investment_level: 16,
    brand_commercial_priority: 14,
    expected_position_baseline: 2,
    min_acceptable_wins: 8,
    youth_regen_target_count: 2,
    vision_statement: "Stability, loyalty, and unwavering trust in cricket experts above short-term noise.",
    rationale: "Unmatched continuity culture. Extremely patient with cricket leadership and shields staff during slumps."
  },
  MI: {
    team_id: "MI",
    owner_name: "Nita Ambani & Akash Ambani",
    consortium_name: "Reliance Industries Ltd (Indiawin Sports)",
    ceo_name: "Rahul Sanghvi",
    ownership_archetype: "brand_legacy",
    founding_year: 2008,
    headquarters: "Mumbai, Maharashtra",
    ceo_involvement: 16,
    ceo_patience: 14,
    ceo_media_presence: 10,
    ceo_ambition: 20,
    patience_modifier: 4,
    trophy_obsession_level: 20,
    financial_generosity: 20,
    staff_budget_flexibility: 20,
    stadium_upgrade_willingness: 19,
    meddling_frequency: 7,
    lineup_interference_tendency: 6,
    scouting_investment_level: 20,
    brand_commercial_priority: 19,
    expected_position_baseline: 2,
    min_acceptable_wins: 9,
    youth_regen_target_count: 3,
    vision_statement: "The global benchmark for T20 excellence. Winning is not a goal; it is the standard.",
    rationale: "Elite brand standards and top financial backing. Expects titles and playoff qualification every season."
  },
  KKR: {
    team_id: "KKR",
    owner_name: "Shah Rukh Khan, Jay Mehta & Juhi Chawla",
    consortium_name: "Knight Riders Sports Pvt Ltd",
    ceo_name: "Venky Mysore",
    ownership_archetype: "patron_continuity",
    founding_year: 2008,
    headquarters: "Kolkata, West Bengal",
    ceo_involvement: 18,
    ceo_patience: 16,
    ceo_media_presence: 15,
    ceo_ambition: 18,
    patience_modifier: 6,
    trophy_obsession_level: 16,
    financial_generosity: 18,
    staff_budget_flexibility: 17,
    stadium_upgrade_willingness: 16,
    meddling_frequency: 4,
    lineup_interference_tendency: 3,
    scouting_investment_level: 17,
    brand_commercial_priority: 18,
    expected_position_baseline: 3,
    min_acceptable_wins: 8,
    youth_regen_target_count: 2,
    vision_statement: "Fearless, attractive cricket backed by long-term faith in coaching leadership.",
    rationale: "Strong loyalty to coaching staff across multi-year cycles. Supports aggressive cricket identity."
  },
  RCB: {
    team_id: "RCB",
    owner_name: "Diageo Executive Board",
    consortium_name: "Royal Challengers Sports Pvt Ltd (United Spirits)",
    ceo_name: "Rajesh Menon",
    ownership_archetype: "corporate_analytical",
    founding_year: 2008,
    headquarters: "Bengaluru, Karnataka",
    ceo_involvement: 15,
    ceo_patience: 13,
    ceo_media_presence: 14,
    ceo_ambition: 19,
    patience_modifier: -2,
    trophy_obsession_level: 18,
    financial_generosity: 19,
    staff_budget_flexibility: 18,
    stadium_upgrade_willingness: 17,
    meddling_frequency: 8,
    lineup_interference_tendency: 8,
    scouting_investment_level: 14,
    brand_commercial_priority: 20,
    expected_position_baseline: 3,
    min_acceptable_wins: 8,
    youth_regen_target_count: 2,
    vision_statement: "Unrivalled fan engagement and commercial prestige paired with elite T20 performance.",
    rationale: "Corporate oversight with high brand equity expectations. Moderate patience for multi-season rebuilds."
  },
  LSG: {
    team_id: "LSG",
    owner_name: "Sanjiv Goenka",
    consortium_name: "RPSG Group (RPSG Sports Pvt Ltd)",
    ceo_name: "Vinod Bisht",
    ownership_archetype: "hands_on_volatile",
    founding_year: 2022,
    headquarters: "Lucknow, Uttar Pradesh",
    ceo_involvement: 17,
    ceo_patience: 8,
    ceo_media_presence: 12,
    ceo_ambition: 19,
    patience_modifier: -5,
    trophy_obsession_level: 17,
    financial_generosity: 17,
    staff_budget_flexibility: 16,
    stadium_upgrade_willingness: 15,
    meddling_frequency: 17,
    lineup_interference_tendency: 14,
    scouting_investment_level: 14,
    brand_commercial_priority: 15,
    expected_position_baseline: 3,
    min_acceptable_wins: 8,
    youth_regen_target_count: 2,
    vision_statement: "Immediate results, fierce competitiveness, and constant pursuit of perfection.",
    rationale: "Highly vocal ownership with quick reactions to dry spells. Demands fast turnarounds."
  },
  PBKS: {
    team_id: "PBKS",
    owner_name: "Preity Zinta, Ness Wadia & Mohit Burman",
    consortium_name: "KPH Dream Cricket Pvt Ltd",
    ceo_name: "Satish Menon",
    ownership_archetype: "hands_on_volatile",
    founding_year: 2008,
    headquarters: "Mohali, Punjab",
    ceo_involvement: 14,
    ceo_patience: 7,
    ceo_media_presence: 16,
    ceo_ambition: 16,
    patience_modifier: -8,
    trophy_obsession_level: 15,
    financial_generosity: 15,
    staff_budget_flexibility: 14,
    stadium_upgrade_willingness: 13,
    meddling_frequency: 16,
    lineup_interference_tendency: 12,
    scouting_investment_level: 13,
    brand_commercial_priority: 16,
    expected_position_baseline: 4,
    min_acceptable_wins: 7,
    youth_regen_target_count: 2,
    vision_statement: "High energy, fresh starts, and breaking through into sustained playoff contention.",
    rationale: "History of frequent leadership and coaching restructuring. Low institutional patience."
  },
  SRH: {
    team_id: "SRH",
    owner_name: "Kalanithi Maran & Kaviya Maran",
    consortium_name: "SUN TV Network Ltd",
    ceo_name: "Kaviya Maran",
    ownership_archetype: "hands_on_volatile",
    founding_year: 2013,
    headquarters: "Hyderabad, Telangana",
    ceo_involvement: 19,
    ceo_patience: 8,
    ceo_media_presence: 19,
    ceo_ambition: 18,
    patience_modifier: -7,
    trophy_obsession_level: 16,
    financial_generosity: 16,
    staff_budget_flexibility: 15,
    stadium_upgrade_willingness: 14,
    meddling_frequency: 13,
    lineup_interference_tendency: 10,
    scouting_investment_level: 15,
    brand_commercial_priority: 12,
    expected_position_baseline: 4,
    min_acceptable_wins: 7,
    youth_regen_target_count: 2,
    vision_statement: "Disciplined tactical execution, prudent spending, and ruthless accountability.",
    rationale: "Strict performance accountability. Quick to restructure coaching staff after missed playoff campaigns."
  },
  GT: {
    team_id: "GT",
    owner_name: "CVC Capital Partners & Torrent Group",
    consortium_name: "Irelia Company Pte Ltd",
    ceo_name: "Arvinder Singh",
    ownership_archetype: "private_equity",
    founding_year: 2022,
    headquarters: "Ahmedabad, Gujarat",
    ceo_involvement: 13,
    ceo_patience: 15,
    ceo_media_presence: 9,
    ceo_ambition: 17,
    patience_modifier: 8,
    trophy_obsession_level: 14,
    financial_generosity: 17,
    staff_budget_flexibility: 16,
    stadium_upgrade_willingness: 18,
    meddling_frequency: 4,
    lineup_interference_tendency: 2,
    scouting_investment_level: 16,
    brand_commercial_priority: 13,
    expected_position_baseline: 3,
    min_acceptable_wins: 8,
    youth_regen_target_count: 3,
    vision_statement: "Data-backed decisions, empowerment of coaching leadership, and strategic asset growth.",
    rationale: "Data-driven, private-equity approach. Gives established coaching structures stability and space."
  },
  RR: {
    team_id: "RR",
    owner_name: "Manoj Badale & RedBird Capital Partners",
    consortium_name: "Emerging Media IPL Ltd",
    ceo_name: "Jake Lush McCrum",
    ownership_archetype: "youth_innovator",
    founding_year: 2008,
    headquarters: "Jaipur, Rajasthan",
    ceo_involvement: 17,
    ceo_patience: 15,
    ceo_media_presence: 16,
    ceo_ambition: 17,
    patience_modifier: 10,
    trophy_obsession_level: 13,
    financial_generosity: 15,
    staff_budget_flexibility: 15,
    stadium_upgrade_willingness: 14,
    meddling_frequency: 5,
    lineup_interference_tendency: 3,
    scouting_investment_level: 20,
    brand_commercial_priority: 11,
    expected_position_baseline: 4,
    min_acceptable_wins: 7,
    youth_regen_target_count: 4,
    vision_statement: "Pioneering youth scouting, high-performance academies, and process over panic.",
    rationale: "Heavy emphasis on academy scouting and process over short-term fixes. Patient with young squads."
  },
  DC: {
    team_id: "DC",
    owner_name: "Parth Jindal (JSW) & Kiran Kumar Grandhi (GMR)",
    consortium_name: "JSW Sports & GMR Sports Pvt Ltd",
    ceo_name: "Sunil Gupta",
    ownership_archetype: "corporate_analytical",
    founding_year: 2008,
    headquarters: "New Delhi, Delhi",
    ceo_involvement: 15,
    ceo_patience: 12,
    ceo_media_presence: 11,
    ceo_ambition: 17,
    patience_modifier: 1,
    trophy_obsession_level: 15,
    financial_generosity: 16,
    staff_budget_flexibility: 15,
    stadium_upgrade_willingness: 15,
    meddling_frequency: 8,
    lineup_interference_tendency: 6,
    scouting_investment_level: 17,
    brand_commercial_priority: 15,
    expected_position_baseline: 3,
    min_acceptable_wins: 8,
    youth_regen_target_count: 3,
    vision_statement: "Building a sustainable championship contender powered by Indian grassroots development.",
    rationale: "Dual corporate partnership. Balances multi-season coaching stability with high playoff expectations."
  }
};

export function getClubOwnership(teamId: string): ClubOwnershipRecord {
  return CLUB_OWNERSHIPS[teamId] ?? CLUB_OWNERSHIPS.CSK;
}

export function getAllClubOwnerships(): Record<string, ClubOwnershipRecord> {
  return CLUB_OWNERSHIPS;
}
