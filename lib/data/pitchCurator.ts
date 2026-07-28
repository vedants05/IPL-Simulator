/**
 * Canonical home-stadium and pitch-curator data.
 *
 * This module deliberately contains data only. Match simulation, fixture
 * selection and user-interface behaviour should consume this registry later
 * rather than being embedded here.
 *
 * To add another surface in future, append a pitch to the relevant stadium's
 * `pitches` array. Stable stadium and pitch IDs should never be renamed after
 * they have been used by a saved game.
 */

export const PITCH_CURATOR_SCHEMA_VERSION = 3;
export const MIN_BOUNDARY_LENGTH_METRES = 50;
export const MAX_BOUNDARY_EXPANSION_METRES = 5;

export type IplTeamId =
  | "MI"
  | "CSK"
  | "KKR"
  | "RCB"
  | "DC"
  | "LSG"
  | "SRH"
  | "GT"
  | "RR"
  | "PBKS";

export type PitchPreference =
  | "aggressive-batters"
  | "controlled-batters"
  | "high-rated-batters"
  | "openers"
  | "top-order-batters"
  | "middle-order-batters"
  | "pace-bowlers"
  | "high-rated-pace-bowlers"
  | "spin-bowlers"
  | "chasing-team";

export interface ExpectedScoreRange {
  min: number;
  max: number;
}

export interface CuratorPitch {
  id: string;
  name: string;
  type: string;
  characteristics: readonly string[];
  expectedFirstInningsScore: ExpectedScoreRange;
  favours: readonly PitchPreference[];
  doesNotFavour: readonly PitchPreference[];
}

export type OutfieldSpeed = "Measured" | "Balanced" | "Fast" | "Very fast";

export interface OutfieldProfile {
  speed: OutfieldSpeed;
  speedRating: number;
  grass: string;
  drainage: string;
  description: string;
}

export interface HomeStadium {
  id: string;
  teamId: IplTeamId;
  name: string;
  location: string;
  /** Fixed published seating capacity for this stadium. */
  capacity: number;
  /**
   * Representative match boundaries from the pitch centre. Rope placement can
   * change by match and pitch position, so these are gameplay defaults.
   */
  defaultBoundaryDimensions: BoundaryDimensions;
  outfield: OutfieldProfile;
  defaultPitchId: string;
  pitches: readonly CuratorPitch[];
}

export type HomePitchSelections = Record<IplTeamId, string>;
export interface BoundaryDimensions {
  straightMetres: number;
  wideMetres: number;
}
export type HomeBoundaryDimensions = Record<IplTeamId, BoundaryDimensions>;

export const HOME_STADIUMS: readonly HomeStadium[] = [
  {
    id: "eden-gardens",
    teamId: "KKR",
    name: "Eden Gardens",
    location: "Kolkata",
    capacity: 67_551,
    defaultBoundaryDimensions: { straightMetres: 71, wideMetres: 69 },
    outfield: {
      speed: "Fast",
      speedRating: 8,
      grass: "Natural grass",
      drainage: "Subsurface drainage",
      description: "A generally quick outfield once dry, with firm ground shots retaining plenty of pace.",
    },
    defaultPitchId: "eden-black-soil-turner",
    pitches: [
      {
        id: "eden-highway-belter",
        name: "The Highway Belter",
        type: "Flat Track",
        characteristics: [
          "Pace bowling comes onto the bat with very little seam movement",
          "Consistent bounce limits deviation for spin bowling",
          "The surface remains hard and true throughout the match",
        ],
        expectedFirstInningsScore: { min: 200, max: 225 },
        favours: ["aggressive-batters", "openers", "top-order-batters", "high-rated-batters"],
        doesNotFavour: ["spin-bowlers"],
      },
      {
        id: "eden-black-soil-turner",
        name: "Black Soil Turner",
        type: "Slow and Dry",
        characteristics: [
          "Spin bowling grips and holds in the surface",
          "Cutters and slower balls become more effective through the middle overs",
          "The pitch slows further as the surface wears",
        ],
        expectedFirstInningsScore: { min: 155, max: 170 },
        favours: ["spin-bowlers", "controlled-batters", "high-rated-batters"],
        doesNotFavour: ["aggressive-batters", "pace-bowlers"],
      },
      {
        id: "eden-night-seamer",
        name: "Night Seamer",
        type: "Green and Moist",
        characteristics: [
          "Seam bowling gains pronounced movement during the opening overs",
          "Hard-length pace bowling receives firm bounce and carry",
          "Movement reduces as the surface dries and flattens",
        ],
        expectedFirstInningsScore: { min: 175, max: 190 },
        favours: ["pace-bowlers", "controlled-batters", "openers", "high-rated-batters"],
        doesNotFavour: ["aggressive-batters"],
      },
    ],
  },
  {
    id: "m-chinnaswamy-stadium",
    teamId: "RCB",
    name: "M. Chinnaswamy Stadium",
    location: "Bengaluru",
    capacity: 33_677,
    defaultBoundaryDimensions: { straightMetres: 65, wideMetres: 60 },
    outfield: {
      speed: "Very fast",
      speedRating: 9,
      grass: "Natural grass",
      drainage: "SubAir vacuum and aeration system",
      description: "A rapid, even outfield supported by forced-air drainage that clears surface water quickly.",
    },
    defaultPitchId: "chinnaswamy-batters-dream",
    pitches: [
      {
        id: "chinnaswamy-batters-dream",
        name: "The Batter's Dream",
        type: "Hard Flat Deck",
        characteristics: [
          "Pace bowling receives speed from the surface but almost no seam deviation",
          "Spin bowling finds very little grip or turn",
          "The pitch stays hard, even and consistent through both innings",
        ],
        expectedFirstInningsScore: { min: 205, max: 235 },
        favours: ["aggressive-batters", "openers", "high-rated-batters"],
        doesNotFavour: ["pace-bowlers", "spin-bowlers"],
      },
      {
        id: "chinnaswamy-two-paced",
        name: "Two-Paced Surface",
        type: "Dry and Cracked",
        characteristics: [
          "Pace-off deliveries grip while harder pace produces variable bounce",
          "Cracks create intermittent turn for spin bowling",
          "The bounce becomes less predictable as the surface wears",
        ],
        expectedFirstInningsScore: { min: 165, max: 180 },
        favours: ["controlled-batters", "spin-bowlers", "high-rated-pace-bowlers"],
        doesNotFavour: ["aggressive-batters"],
      },
    ],
  },
  {
    id: "wankhede-stadium",
    teamId: "MI",
    name: "Wankhede Stadium",
    location: "Mumbai",
    capacity: 33_210,
    defaultBoundaryDimensions: { straightMetres: 72, wideMetres: 66 },
    outfield: {
      speed: "Very fast",
      speedRating: 9,
      grass: "Natural grass",
      drainage: "Upgraded subsurface drainage",
      description: "A compact and consistently quick outfield where well-timed ground strokes lose little speed.",
    },
    defaultPitchId: "wankhede-red-soil-express",
    pitches: [
      {
        id: "wankhede-red-soil-express",
        name: "Red Soil Express",
        type: "Hard Red Soil with High Bounce",
        characteristics: [
          "Hit-the-deck pace bowling receives high bounce and rapid carry",
          "The new ball offers limited early seam movement",
          "The surface remains fast while providing little grip for spin",
        ],
        expectedFirstInningsScore: { min: 195, max: 220 },
        favours: ["pace-bowlers", "aggressive-batters", "openers", "top-order-batters", "chasing-team"],
        doesNotFavour: ["spin-bowlers"],
      },
      {
        id: "wankhede-dry-red-surface",
        name: "Dry Red Surface",
        type: "Turn and Bounce",
        characteristics: [
          "Spin bowling receives sharp turn and additional bounce",
          "Cutters grip more strongly than conventional pace deliveries",
          "The pitch becomes slower as its dry surface wears",
        ],
        expectedFirstInningsScore: { min: 165, max: 180 },
        favours: ["spin-bowlers", "controlled-batters", "high-rated-batters"],
        doesNotFavour: ["aggressive-batters"],
      },
    ],
  },
  {
    id: "ma-chidambaram-stadium",
    teamId: "CSK",
    name: "M. A. Chidambaram Stadium",
    location: "Chennai",
    capacity: 37_505,
    defaultBoundaryDimensions: { straightMetres: 65, wideMetres: 68 },
    outfield: {
      speed: "Balanced",
      speedRating: 7,
      grass: "Renewed natural-grass outfield",
      drainage: "Renewed drainage system",
      description: "The renewed surface is even and reliable, while Chennai humidity can prevent it becoming excessively quick.",
    },
    defaultPitchId: "chepauk-clay-sporting-track",
    pitches: [
      {
        id: "chepauk-dustbowl",
        name: "The Dustbowl",
        type: "Traditional Dry and Low",
        characteristics: [
          "Spin bowling grips and turns from the opening overs",
          "Pace deliveries lose speed while cutters hold in the surface",
          "Bounce becomes lower and turn increases as the pitch deteriorates",
        ],
        expectedFirstInningsScore: { min: 145, max: 160 },
        favours: ["spin-bowlers", "controlled-batters", "middle-order-batters", "high-rated-batters"],
        doesNotFavour: ["aggressive-batters", "pace-bowlers", "chasing-team"],
      },
      {
        id: "chepauk-clay-sporting-track",
        name: "Clay Sporting Track",
        type: "Balanced Clay",
        characteristics: [
          "Seam bowling receives firm bounce and carry early in the innings",
          "Spin bowling gains moderate grip as the clay surface dries",
          "Bounce remains relatively consistent as turn increases later",
        ],
        expectedFirstInningsScore: { min: 170, max: 185 },
        favours: ["high-rated-batters", "pace-bowlers", "spin-bowlers"],
        doesNotFavour: [],
      },
    ],
  },
  {
    id: "arun-jaitley-stadium",
    teamId: "DC",
    name: "Arun Jaitley Stadium",
    location: "Delhi",
    capacity: 37_306,
    defaultBoundaryDimensions: { straightMetres: 70, wideMetres: 65 },
    outfield: {
      speed: "Fast",
      speedRating: 8,
      grass: "Natural grass",
      drainage: "Subsurface drainage",
      description: "A firm urban outfield that usually gives strong value to cleanly struck ground shots.",
    },
    defaultPitchId: "delhi-flat-launchpad",
    pitches: [
      {
        id: "delhi-flat-launchpad",
        name: "Flat Launchpad",
        type: "Ultra-Flat Track",
        characteristics: [
          "Pace bowling comes on quickly with almost no seam movement",
          "Spin bowling receives minimal grip or deviation",
          "The surface remains flat and consistent throughout the match",
        ],
        expectedFirstInningsScore: { min: 200, max: 225 },
        favours: ["aggressive-batters", "openers", "top-order-batters"],
        doesNotFavour: ["pace-bowlers", "spin-bowlers"],
      },
      {
        id: "delhi-sticky-black-soil",
        name: "Sticky Black Soil",
        type: "Low and Slow",
        characteristics: [
          "Cutters and slower pace deliveries grip in the surface",
          "Spin bowling receives low bounce and steady turn",
          "The pitch becomes slower and more difficult to time as it wears",
        ],
        expectedFirstInningsScore: { min: 150, max: 165 },
        favours: ["spin-bowlers", "controlled-batters"],
        doesNotFavour: ["aggressive-batters", "pace-bowlers", "chasing-team"],
      },
    ],
  },
  {
    id: "ekana-cricket-stadium",
    teamId: "LSG",
    name: "BRSABV Ekana Cricket Stadium",
    location: "Lucknow",
    capacity: 47_165,
    defaultBoundaryDimensions: { straightMetres: 70, wideMetres: 65 },
    outfield: {
      speed: "Measured",
      speedRating: 6,
      grass: "Natural grass",
      drainage: "Modern subsurface drainage",
      description: "A broad, well-covered outfield whose fuller grass coverage produces a more measured ball speed.",
    },
    defaultPitchId: "ekana-red-soil-pace-track",
    pitches: [
      {
        id: "ekana-black-soil-fortress",
        name: "Black Soil Fortress",
        type: "Low and Gripping",
        characteristics: [
          "Spin bowling grips heavily and receives low bounce",
          "Cutters and pace-off deliveries hold in the surface",
          "The pitch becomes progressively slower through the match",
        ],
        expectedFirstInningsScore: { min: 140, max: 155 },
        favours: ["spin-bowlers", "controlled-batters", "high-rated-pace-bowlers"],
        doesNotFavour: ["aggressive-batters", "chasing-team"],
      },
      {
        id: "ekana-red-soil-pace-track",
        name: "Red Soil Pace Track",
        type: "Hard and Bouncy",
        characteristics: [
          "Fast bowling receives true bounce and strong carry",
          "Seam movement is most available with the new ball",
          "Spin gains moderate assistance only after the surface begins to wear",
        ],
        expectedFirstInningsScore: { min: 170, max: 185 },
        favours: ["pace-bowlers", "openers", "top-order-batters", "high-rated-batters"],
        doesNotFavour: ["spin-bowlers"],
      },
    ],
  },
  {
    id: "rajiv-gandhi-international-stadium",
    teamId: "SRH",
    name: "Rajiv Gandhi International Cricket Stadium",
    location: "Hyderabad",
    capacity: 39_952,
    defaultBoundaryDimensions: { straightMetres: 70, wideMetres: 67 },
    outfield: {
      speed: "Fast",
      speedRating: 8,
      grass: "Natural grass",
      drainage: "Conventional subsurface drainage",
      description: "A typically quick outfield in dry conditions, with the ball accelerating once it beats the infield.",
    },
    defaultPitchId: "hyderabad-powerplay-highway",
    pitches: [
      {
        id: "hyderabad-powerplay-highway",
        name: "Powerplay Highway",
        type: "Belter",
        characteristics: [
          "Pace bowling skids from the hard surface with little seam movement",
          "Spin bowling receives very little grip or turn",
          "The pitch stays firm and true through both innings",
        ],
        expectedFirstInningsScore: { min: 205, max: 230 },
        favours: ["aggressive-batters", "openers", "top-order-batters"],
        doesNotFavour: ["pace-bowlers", "spin-bowlers"],
      },
      {
        id: "hyderabad-dry-abrasion-track",
        name: "Dry Abrasion Track",
        type: "Slow and Dry",
        characteristics: [
          "Cutters and slower balls grip as the dry surface becomes abrasive",
          "Spin bowling gains turn through the middle overs",
          "The pitch slows and deteriorates steadily during the match",
        ],
        expectedFirstInningsScore: { min: 160, max: 175 },
        favours: ["spin-bowlers", "high-rated-pace-bowlers", "controlled-batters", "middle-order-batters"],
        doesNotFavour: ["aggressive-batters"],
      },
    ],
  },
  {
    id: "narendra-modi-stadium",
    teamId: "GT",
    name: "Narendra Modi Stadium",
    location: "Ahmedabad",
    capacity: 135_000,
    defaultBoundaryDimensions: { straightMetres: 75, wideMetres: 65 },
    outfield: {
      speed: "Fast",
      speedRating: 8,
      grass: "Natural grass",
      drainage: "Modern subsurface drainage",
      description: "A large, uniform playing surface maintained for consistent pace across its extensive outfield.",
    },
    defaultPitchId: "ahmedabad-red-soil-bounce",
    pitches: [
      {
        id: "ahmedabad-red-soil-bounce",
        name: "Red Soil Bounce",
        type: "High Bounce and Pace",
        characteristics: [
          "Hit-the-deck pace bowling receives high bounce and fast carry",
          "Seam bowling gains its strongest movement with the new ball",
          "Spin receives limited grip until the surface begins to wear",
        ],
        expectedFirstInningsScore: { min: 185, max: 205 },
        favours: ["pace-bowlers", "openers", "aggressive-batters", "top-order-batters"],
        doesNotFavour: ["spin-bowlers"],
      },
      {
        id: "ahmedabad-black-soil-slow",
        name: "Black Soil Slow",
        type: "Low Bounce and Spin",
        characteristics: [
          "Spin bowling receives substantial grip with low bounce",
          "Cutters and slower pace deliveries hold in the surface",
          "The pitch becomes slower and offers more turn later in the match",
        ],
        expectedFirstInningsScore: { min: 160, max: 175 },
        favours: ["spin-bowlers", "controlled-batters"],
        doesNotFavour: ["aggressive-batters", "pace-bowlers", "chasing-team"],
      },
      {
        id: "ahmedabad-mixed-soil-deck",
        name: "Mixed Soil Deck",
        type: "Even Contest",
        characteristics: [
          "Seam bowling receives moderate movement during the opening overs",
          "Pace and spin both receive consistent bounce",
          "Spin bowling gains additional turn as the surface wears",
        ],
        expectedFirstInningsScore: { min: 170, max: 185 },
        favours: ["high-rated-batters", "pace-bowlers", "spin-bowlers"],
        doesNotFavour: [],
      },
    ],
  },
  {
    id: "sawai-mansingh-stadium",
    teamId: "RR",
    name: "Sawai Mansingh Stadium",
    location: "Jaipur",
    capacity: 23_400,
    defaultBoundaryDimensions: { straightMetres: 68, wideMetres: 68 },
    outfield: {
      speed: "Balanced",
      speedRating: 7,
      grass: "Natural grass",
      drainage: "Conventional subsurface drainage",
      description: "An even outfield with balanced grass coverage, rewarding placement without becoming exceptionally quick.",
    },
    defaultPitchId: "jaipur-big-boundary-balanced",
    pitches: [
      {
        id: "jaipur-big-boundary-balanced",
        name: "True Bounce Balanced",
        type: "Balanced True-Bounce Surface",
        characteristics: [
          "Seam bowling receives consistent bounce and controlled carry",
          "Spin bowling receives moderate turn without excessive grip",
          "The surface stays balanced from the opening overs into the later stages",
        ],
        expectedFirstInningsScore: { min: 170, max: 185 },
        favours: ["controlled-batters", "high-rated-batters", "pace-bowlers", "spin-bowlers"],
        doesNotFavour: ["aggressive-batters"],
      },
      {
        id: "jaipur-dry-skidder",
        name: "Dry Skidder",
        type: "Low and Dry",
        characteristics: [
          "Pace bowling skids from the surface and stays low",
          "Spin bowling receives subtle grip and turn",
          "The pitch becomes slower as the dry surface wears",
        ],
        expectedFirstInningsScore: { min: 150, max: 165 },
        favours: ["spin-bowlers", "controlled-batters"],
        doesNotFavour: ["aggressive-batters", "pace-bowlers"],
      },
    ],
  },
  {
    id: "maharaja-yadavindra-singh-stadium",
    teamId: "PBKS",
    name: "Maharaja Yadavindra Singh Stadium",
    location: "Mullanpur",
    capacity: 31_150,
    defaultBoundaryDimensions: { straightMetres: 72, wideMetres: 73 },
    outfield: {
      speed: "Fast",
      speedRating: 8,
      grass: "Bermuda Evergreen grass on a sand base",
      drainage: "Herringbone drainage system",
      description: "A firm modern outfield designed to shed water rapidly and return to a consistent playing speed.",
    },
    defaultPitchId: "mullanpur-green-seam-carry",
    pitches: [
      {
        id: "mullanpur-green-seam-carry",
        name: "Green Seam and Carry",
        type: "Seam Friendly",
        characteristics: [
          "Grass cover creates pronounced seam movement with the new ball",
          "Hard-length pace bowling receives strong bounce and carry",
          "Movement eases as the surface dries after the opening overs",
        ],
        expectedFirstInningsScore: { min: 165, max: 180 },
        favours: ["pace-bowlers", "controlled-batters", "openers", "high-rated-batters"],
        doesNotFavour: ["aggressive-batters", "spin-bowlers"],
      },
      {
        id: "mullanpur-hard-power-deck",
        name: "Hard Power Deck",
        type: "Flat Track",
        characteristics: [
          "Pace bowling receives consistent bounce with minimal seam deviation",
          "Spin bowling finds little grip on the hard surface",
          "The pitch remains firm and uniform throughout the match",
        ],
        expectedFirstInningsScore: { min: 190, max: 210 },
        favours: ["aggressive-batters", "openers", "high-rated-batters"],
        doesNotFavour: ["spin-bowlers"],
      },
    ],
  },
] as const;

const HOME_STADIUM_BY_TEAM = Object.fromEntries(
  HOME_STADIUMS.map((stadium) => [stadium.teamId, stadium]),
) as Record<IplTeamId, HomeStadium>;

const PITCH_BY_ID = new Map(
  HOME_STADIUMS.flatMap((stadium) => stadium.pitches.map((pitch) => [pitch.id, pitch] as const)),
);

export function getHomeStadium(teamId: string): HomeStadium | undefined {
  return HOME_STADIUM_BY_TEAM[teamId as IplTeamId];
}

export function getHomeStadiumName(teamId: IplTeamId): string {
  return HOME_STADIUM_BY_TEAM[teamId].name;
}

export function getCuratorPitch(pitchId: string): CuratorPitch | undefined {
  return PITCH_BY_ID.get(pitchId);
}

export function getDefaultCuratorPitch(teamId: string): CuratorPitch | undefined {
  const stadium = getHomeStadium(teamId);
  return stadium?.pitches.find((pitch) => pitch.id === stadium.defaultPitchId);
}

export function isPitchRegisteredForTeam(teamId: string, pitchId: string): boolean {
  return getHomeStadium(teamId)?.pitches.some((pitch) => pitch.id === pitchId) ?? false;
}

export function createDefaultHomePitchSelections(): HomePitchSelections {
  return Object.fromEntries(
    HOME_STADIUMS.map((stadium) => [stadium.teamId, stadium.defaultPitchId]),
  ) as HomePitchSelections;
}

export function createDefaultHomeBoundaryDimensions(): HomeBoundaryDimensions {
  return Object.fromEntries(
    HOME_STADIUMS.map((stadium) => [
      stadium.teamId,
      { ...stadium.defaultBoundaryDimensions },
    ]),
  ) as HomeBoundaryDimensions;
}

const normalizeBoundaryMetres = (value: number, maximum: number) => Math.round(Math.min(
  maximum,
  Math.max(MIN_BOUNDARY_LENGTH_METRES, value),
));

export interface StadiumBoundaryLimits {
  minimum: number;
  straightMaximum: number;
  wideMaximum: number;
}

export function getStadiumBoundaryLimits(teamId: string): StadiumBoundaryLimits | undefined {
  const stadium = getHomeStadium(teamId);
  if (!stadium) return undefined;
  return {
    minimum: MIN_BOUNDARY_LENGTH_METRES,
    straightMaximum: stadium.defaultBoundaryDimensions.straightMetres + MAX_BOUNDARY_EXPANSION_METRES,
    wideMaximum: stadium.defaultBoundaryDimensions.wideMetres + MAX_BOUNDARY_EXPANSION_METRES,
  };
}

const LEGACY_DEFAULT_BOUNDARY_LENGTHS: Record<IplTeamId, number> = {
  KKR: 70,
  RCB: 63,
  MI: 69,
  CSK: 67,
  DC: 68,
  LSG: 68,
  SRH: 69,
  GT: 70,
  RR: 68,
  PBKS: 73,
};

export function normalizeHomeBoundaryDimensions(value: unknown): HomeBoundaryDimensions {
  const normalized = createDefaultHomeBoundaryDimensions();
  if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;

  const supplied = value as Record<string, unknown>;
  HOME_STADIUMS.forEach((stadium) => {
    const boundary = supplied[stadium.teamId];
    const limits = getStadiumBoundaryLimits(stadium.teamId)!;
    if (typeof boundary === "number" && Number.isFinite(boundary)) {
      if (boundary === LEGACY_DEFAULT_BOUNDARY_LENGTHS[stadium.teamId]) {
        normalized[stadium.teamId] = { ...stadium.defaultBoundaryDimensions };
        return;
      }
      normalized[stadium.teamId] = {
        straightMetres: normalizeBoundaryMetres(boundary, limits.straightMaximum),
        wideMetres: normalizeBoundaryMetres(boundary, limits.wideMaximum),
      };
      return;
    }
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) return;
    const candidate = boundary as Partial<BoundaryDimensions>;
    normalized[stadium.teamId] = {
      straightMetres: typeof candidate.straightMetres === "number"
        && Number.isFinite(candidate.straightMetres)
        ? normalizeBoundaryMetres(candidate.straightMetres, limits.straightMaximum)
        : stadium.defaultBoundaryDimensions.straightMetres,
      wideMetres: typeof candidate.wideMetres === "number"
        && Number.isFinite(candidate.wideMetres)
        ? normalizeBoundaryMetres(candidate.wideMetres, limits.wideMaximum)
        : stadium.defaultBoundaryDimensions.wideMetres,
    };
  });
  return normalized;
}

export type AdditionalHomePitchIds = Partial<Record<IplTeamId, readonly string[]>>;

export function normalizeHomePitchSelections(
  value: unknown,
  additionalPitchIds: AdditionalHomePitchIds = {},
): HomePitchSelections {
  const normalized = createDefaultHomePitchSelections();
  if (!value || typeof value !== "object" || Array.isArray(value)) return normalized;

  const supplied = value as Record<string, unknown>;
  HOME_STADIUMS.forEach((stadium) => {
    const pitchId = supplied[stadium.teamId];
    const isAdditionalPitch = typeof pitchId === "string"
      && (additionalPitchIds[stadium.teamId] ?? []).includes(pitchId);
    if (
      typeof pitchId === "string"
      && (isPitchRegisteredForTeam(stadium.teamId, pitchId) || isAdditionalPitch)
    ) {
      normalized[stadium.teamId] = pitchId;
    }
  });
  return normalized;
}
