export interface TeamTheme {
  code: string;
  name: string;
  baseBg: string;
  navActive: string;
  navMuted: string;
  accent: string;
  bidBg: string;
  bidText: string;
  bidMuted: string;
  ctaBg: string;
  ctaText: string;
}

export const TEAM_THEMES: Record<string, TeamTheme> = {
  MI: {
    code: "MI",
    name: "Mumbai Indians",
    baseBg: "#eef0f4",
    navActive: "#111726",
    navMuted: "#8a92a3",
    accent: "#1d55c4",
    bidBg: "#1b2133",
    bidText: "#ffffff",
    bidMuted: "#9aa4bc",
    ctaBg: "#1d55c4",
    ctaText: "#ffffff",
  },
  CSK: {
    code: "CSK",
    name: "Chennai Super Kings",
    baseBg: "#fbf8eb",
    navActive: "#1a1503",
    navMuted: "#8c856e",
    accent: "#ffc72c",
    bidBg: "#12213f",
    bidText: "#ffc72c",
    bidMuted: "#8fa1c2",
    ctaBg: "#ffc72c",
    ctaText: "#12213f",
  },
  RCB: {
    code: "RCB",
    name: "Royal Challengers Bengaluru",
    baseBg: "#f5f2f0",
    navActive: "#141414",
    navMuted: "#968e8a",
    accent: "#d51023",
    bidBg: "#141414",
    bidText: "#d4af37",
    bidMuted: "#a39c94",
    ctaBg: "#d51023",
    ctaText: "#ffffff",
  },
  DC: {
    code: "DC",
    name: "Delhi Capitals",
    baseBg: "#edf2f6",
    navActive: "#091729",
    navMuted: "#7c8896",
    accent: "#2b8fd6",
    bidBg: "#101c2b",
    bidText: "#ffffff",
    bidMuted: "#7a8c9e",
    ctaBg: "#d11a2d",
    ctaText: "#ffffff",
  },
  LSG: {
    code: "LSG",
    name: "Lucknow Super Giants",
    baseBg: "#f5f0f0",
    navActive: "#260505",
    navMuted: "#917d7d",
    accent: "#e31c40",
    bidBg: "#1a1a1a",
    bidText: "#e31c40",
    bidMuted: "#a18e8e",
    ctaBg: "#e31c40",
    ctaText: "#ffffff",
  },
  KKR: {
    code: "KKR",
    name: "Kolkata Knight Riders",
    baseBg: "#f2f0f5",
    navActive: "#1c0e2b",
    navMuted: "#887d94",
    accent: "#6a2c91",
    bidBg: "#201130",
    bidText: "#bca0dc",
    bidMuted: "#867994",
    ctaBg: "#6a2c91",
    ctaText: "#ffffff",
  },
  SRH: {
    code: "SRH",
    name: "Sunrisers Hyderabad",
    baseBg: "#f6f1ee",
    navActive: "#211108",
    navMuted: "#96847a",
    accent: "#ef6a1e",
    bidBg: "#1c1512",
    bidText: "#ef6a1e",
    bidMuted: "#a1928a",
    ctaBg: "#ef6a1e",
    ctaText: "#ffffff",
  },
  GT: {
    code: "GT",
    name: "Gujarat Titans",
    baseBg: "#edf0f5",
    navActive: "#0b111e",
    navMuted: "#7e8796",
    accent: "#1b2133",
    bidBg: "#0b111e",
    bidText: "#eaeef6",
    bidMuted: "#727c8e",
    ctaBg: "#1b2133",
    ctaText: "#ffffff",
  },
  RR: {
    code: "RR",
    name: "Rajasthan Royals",
    baseBg: "#f5edf1",
    navActive: "#260515",
    navMuted: "#967d8a",
    accent: "#ec1c7d",
    bidBg: "#0a1a3a",
    bidText: "#ec1c7d",
    bidMuted: "#8394b5",
    ctaBg: "#ec1c7d",
    ctaText: "#ffffff",
  },
  PBKS: {
    code: "PBKS",
    name: "Punjab Kings",
    baseBg: "#f5f1f1",
    navActive: "#240b0d",
    navMuted: "#968082",
    accent: "#d11a2d",
    bidBg: "#1f1a1a",
    bidText: "#ffffff",
    bidMuted: "#9e8e8f",
    ctaBg: "#d11a2d",
    ctaText: "#ffffff",
  },
};

export function readableOn(bgHex: string): string {
  const hex = bgHex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const getLum = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = 0.2126 * getLum(r) + 0.7152 * getLum(g) + 0.0722 * getLum(b);

  return lum > 0.55 ? "#16130f" : "#ffffff";
}
