export interface StaffClubCulture {
  patienceModifier: number;
  label: "extremely_patient" | "patient" | "slightly_patient" | "neutral" | "slightly_demanding" | "demanding" | "extremely_volatile";
  rationale: string;
}

/**
 * Institutional staff patience, distinct from a future ownership modifier.
 * Positive values protect coaches; negative values increase effective pressure.
 * Values are intentionally restrained except where long-term tenure or repeated
 * turnover supplies a particularly strong real-life pattern.
 */
export const STAFF_CLUB_CULTURES: Record<string, StaffClubCulture> = {
  CSK: { patienceModifier: 10, label: "extremely_patient", rationale: "The league's clearest continuity culture, built around unusually long coaching tenures." },
  DC: { patienceModifier: 0, label: "neutral", rationale: "Recent structural changes are balanced by the seven-season Ponting tenure." },
  GT: { patienceModifier: 8, label: "patient", rationale: "Strong continuity around the coaching structure established at the franchise's launch." },
  KKR: { patienceModifier: 6, label: "patient", rationale: "Head coaches have generally received multi-season cycles rather than single-season judgements." },
  LSG: { patienceModifier: -4, label: "slightly_demanding", rationale: "A young franchise with relatively quick senior coaching and leadership restructuring." },
  MI: { patienceModifier: 4, label: "slightly_patient", rationale: "Usually favours established multi-season coaching cycles, while retaining demanding performance standards." },
  PBKS: { patienceModifier: -8, label: "demanding", rationale: "The strongest long-run pattern of frequent head-coach turnover among current franchises." },
  RCB: { patienceModifier: 2, label: "slightly_patient", rationale: "Generally allows a coaching project more than one season, without CSK-level continuity." },
  RR: { patienceModifier: 4, label: "slightly_patient", rationale: "Recent cricket leadership has generally been retained across multi-season development cycles." },
  SRH: { patienceModifier: -8, label: "demanding", rationale: "Repeated head-coach changes since 2020 indicate materially lower institutional patience." },
};

export const getStaffClubCulture = (teamId: string): StaffClubCulture => (
  STAFF_CLUB_CULTURES[teamId] ?? { patienceModifier: 0, label: "neutral", rationale: "No club-specific culture is configured." }
);

