export interface TeamTheme {
  code: string;
  name: string;
  baseBg: string;
  navActive: string;
  navMuted: string;
  accent: string;
  bowlingBar: string;
  bidBg: string;
  bidTinge: string;
  bidText: string;
  bidMuted: string;
  ctaBg: string;
  ctaText: string;
  overlayGradient: string;
  overlayText: string;
}

export const TEAM_THEMES: Record<string, TeamTheme> = {
  MI: {
    code: "MI",
    name: "Mumbai Indians",
    baseBg: "#efece3",
    navActive: "#111726",
    navMuted: "#8a92a3",
    accent: "#008cff",
    bowlingBar: "#ffc72c",
    bidBg: "#0f1322",
    bidTinge: "linear-gradient(135deg, rgba(0,140,255,0.18), rgba(209,171,62,0.08))",
    bidText: "#ffffff",
    bidMuted: "#9cb1d6",
    ctaBg: "#008cff",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #10316b 0%, #0a1e42 100%)",
    overlayText: "#ffffff",
  },
  CSK: {
    code: "CSK",
    name: "Chennai Super Kings",
    baseBg: "#efece3",
    navActive: "#1a1503",
    navMuted: "#8c856e",
    accent: "#ffc72c",
    bowlingBar: "#141414",
    bidBg: "#12141a",
    bidTinge: "linear-gradient(135deg, rgba(255,199,44,0.14), rgba(233,83,13,0.08))",
    bidText: "#ffc72c",
    bidMuted: "#8fa1c2",
    ctaBg: "#ffc72c",
    ctaText: "#12141a",
    overlayGradient: "linear-gradient(135deg, #1c180c 0%, #0d0b06 100%)",
    overlayText: "#ffc72c",
  },
  RCB: {
    code: "RCB",
    name: "Royal Challengers Bengaluru",
    baseBg: "#efece3",
    navActive: "#141414",
    navMuted: "#968e8a",
    accent: "#d51023",
    bowlingBar: "#d4af37",
    bidBg: "#141414",
    bidTinge: "linear-gradient(135deg, rgba(213,16,35,0.15), rgba(212,175,55,0.06))",
    bidText: "#d4af37",
    bidMuted: "#a39c94",
    ctaBg: "#d51023",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #1a0a0c 0%, #0a0405 100%)",
    overlayText: "#d4af37",
  },
  DC: {
    code: "DC",
    name: "Delhi Capitals",
    baseBg: "#efece3",
    navActive: "#0b1d33",
    navMuted: "#728499",
    accent: "#00a0e3",
    bowlingBar: "#d11a2d",
    bidBg: "#0d1117",
    bidTinge: "linear-gradient(135deg, rgba(0,160,227,0.16), rgba(13,26,45,0.16))",
    bidText: "#00a0e3",
    bidMuted: "#a4c2e6",
    ctaBg: "#d11a2d",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #0d1b2e 0%, #08101d 100%)",
    overlayText: "#ffffff",
  },
  GT: {
    code: "GT",
    name: "Gujarat Titans",
    baseBg: "#efece3",
    navActive: "#0b121f",
    navMuted: "#788394",
    accent: "#e5b842",
    bowlingBar: "#1b2133",
    bidBg: "#0e131d",
    bidTinge: "linear-gradient(135deg, rgba(27,33,51,0.16), rgba(229,184,66,0.10))",
    bidText: "#e5b842",
    bidMuted: "#8590a6",
    ctaBg: "#1b2133",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #111a2e 0%, #070d17 100%)",
    overlayText: "#e5b842",
  },
  LSG: {
    code: "LSG",
    name: "Lucknow Super Giants",
    baseBg: "#efece3",
    navActive: "#0c1a30",
    navMuted: "#798da3",
    accent: "#0057e2",
    bowlingBar: "#e21f26",
    bidBg: "#0a0e17",
    bidTinge: "linear-gradient(135deg, rgba(0,87,226,0.14), rgba(10,20,38,0.14))",
    bidText: "#ffffff",
    bidMuted: "#798da3",
    ctaBg: "#e21f26",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #07101f 0%, #030812 100%)",
    overlayText: "#ffffff",
  },
  PBKS: {
    code: "PBKS",
    name: "Punjab Kings",
    baseBg: "#efece3",
    navActive: "#260508",
    navMuted: "#967d80",
    accent: "#d11a2d",
    bowlingBar: "#ffc72c",
    bidBg: "#141111",
    bidTinge: "linear-gradient(135deg, rgba(209,26,45,0.14), rgba(220,221,223,0.06))",
    bidText: "#ffffff",
    bidMuted: "#dcdddf",
    ctaBg: "#d11a2d",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #1c0b0c 0%, #0a0405 100%)",
    overlayText: "#ffffff",
  },
  KKR: {
    code: "KKR",
    name: "Kolkata Knight Riders",
    baseBg: "#efece3",
    navActive: "#1c0e2b",
    navMuted: "#887d94",
    accent: "#6a2c91",
    bowlingBar: "#ffc72c",
    bidBg: "#140f1a",
    bidTinge: "linear-gradient(135deg, rgba(106,44,145,0.16), rgba(184,145,47,0.06))",
    bidText: "#ffc72c",
    bidMuted: "#867994",
    ctaBg: "#6a2c91",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #160a24 0%, #090410 100%)",
    overlayText: "#ffc72c",
  },
  SRH: {
    code: "SRH",
    name: "Sunrisers Hyderabad",
    baseBg: "#efece3",
    navActive: "#211108",
    navMuted: "#96847a",
    accent: "#ef6a1e",
    bowlingBar: "#ffc72c",
    bidBg: "#1a1411",
    bidTinge: "linear-gradient(135deg, rgba(239,106,30,0.16), rgba(0,0,0,0))",
    bidText: "#ef6a1e",
    bidMuted: "#a1928a",
    ctaBg: "#ef6a1e",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #1c0e08 0%, #090402 100%)",
    overlayText: "#ef6a1e",
  },
  RR: {
    code: "RR",
    name: "Rajasthan Royals",
    baseBg: "#efece3",
    navActive: "#260515",
    navMuted: "#967d8a",
    accent: "#ec1c7d",
    bowlingBar: "#0057e2",
    bidBg: "#0f1424",
    bidTinge: "linear-gradient(135deg, rgba(236,28,125,0.16), rgba(10,26,58,0.10))",
    bidText: "#ec1c7d",
    bidMuted: "#8394b5",
    ctaBg: "#ec1c7d",
    ctaText: "#ffffff",
    overlayGradient: "linear-gradient(135deg, #120e24 0%, #080a14 100%)",
    overlayText: "#ffffff",
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
