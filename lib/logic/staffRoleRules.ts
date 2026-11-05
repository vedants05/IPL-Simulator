export const HEAD_COACH_SECONDARY_ROLES = ["batting_coach", "pace_bowling_coach", "spin_bowling_coach", "fielding_coach"] as const;

export function staffRolesAreCompatible(roles: readonly string[]): boolean {
  return !roles.includes("head_coach") || roles.every(role => role === "head_coach"
    || HEAD_COACH_SECONDARY_ROLES.some(allowed => allowed === role));
}
