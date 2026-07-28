export interface AuctionDescriptor {
  title: string;
  detail: string;
}

export const TEAM_AUCTION_DESCRIPTORS: Record<string, AuctionDescriptor> = {
  MI: {
    title: "Young Talent & All-Rounder Powerhouse",
    detail: "Aggressively targets marquee superstars, high-impact all-rounders, and elite Indian youth prospects.",
  },
  CSK: {
    title: "Veteran Loyalty & Squad Depth",
    detail: "Prioritizes experienced battle-tested veterans, high player retention, deep squad rotation, and spin choke options.",
  },
  KKR: {
    title: "Spin Specialists & Match-Winning All-Rounders",
    detail: "Focuses heavily on world-class spin bowling and premium overseas/Indian game-changing all-rounders.",
  },
  RCB: {
    title: "Marquee Superstars & Powerhouse Batting",
    detail: "Aggressively bids on top-tier international batting superstars and marquee match-winners.",
  },
  DC: {
    title: "Pace Attack & Experienced Core",
    detail: "Builds around experienced leadership, elite overseas pace bowlers, and reliable squad balance.",
  },
  SRH: {
    title: "Ultra-Aggressive Batting & Youth Focus",
    detail: "Targets explosive overseas power-hitters, aggressive openers, and high-upside young talent.",
  },
  PBKS: {
    title: "Opportunistic Bidding & Overseas Impact",
    detail: "Flexible auction approach targeting big-ticket overseas all-rounders and high-impact fast bowlers.",
  },
  RR: {
    title: "Pace Precision & Young Indian Core",
    detail: "Disciplined valuation focusing heavily on young Indian prospects and lethal fast bowling options.",
  },
  GT: {
    title: "Bowling Strength & Deep Squad Utility",
    detail: "Prioritizes top-tier Indian pace bowling, balanced squad depth, and tactical versatility over individual stardom.",
  },
  LSG: {
    title: "Pace Battery & Explosive Top-Order",
    detail: "Hunts high-velocity Indian pacers and dominant overseas top-order batters with strong squad depth.",
  },
};

export function getTeamAuctionDescriptor(teamId: string): AuctionDescriptor | undefined {
  return TEAM_AUCTION_DESCRIPTORS[teamId.toUpperCase()];
}
