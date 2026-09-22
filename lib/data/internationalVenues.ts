export const INTERNATIONAL_VENUES: Record<string, string[]> = {
  IND: [
    "Narendra Modi Stadium, Ahmedabad", "Wankhede Stadium, Mumbai", "Eden Gardens, Kolkata",
    "M. Chinnaswamy Stadium, Bengaluru", "M. A. Chidambaram Stadium, Chennai",
    "Arun Jaitley Stadium, Delhi", "Rajiv Gandhi International Stadium, Hyderabad",
  ],
  AUS: [
    "Melbourne Cricket Ground, Melbourne", "Sydney Cricket Ground, Sydney",
    "Adelaide Oval, Adelaide", "The Gabba, Brisbane", "Perth Stadium, Perth",
  ],
  ENG: [
    "Lord's, London", "The Oval, London", "Edgbaston, Birmingham",
    "Old Trafford, Manchester", "Headingley, Leeds", "Trent Bridge, Nottingham",
    "Rose Bowl, Southampton",
  ],
  SA: [
    "Wanderers Stadium, Johannesburg", "Newlands, Cape Town", "SuperSport Park, Centurion",
    "Kingsmead, Durban", "St George's Park, Gqeberha",
  ],
  NZ: [
    "Eden Park, Auckland", "Bay Oval, Mount Maunganui", "Sky Stadium, Wellington",
    "Hagley Oval, Christchurch", "University Oval, Dunedin",
  ],
  WI: [
    "Kensington Oval, Bridgetown", "Providence Stadium, Guyana",
    "Brian Lara Cricket Academy, Trinidad", "Daren Sammy Cricket Ground, Saint Lucia",
    "Sir Vivian Richards Stadium, Antigua",
  ],
  SL: [
    "R. Premadasa Stadium, Colombo", "Pallekele International Stadium, Kandy",
    "Rangiri Dambulla International Stadium, Dambulla", "SSC Ground, Colombo",
    "Mahinda Rajapaksa International Stadium, Hambantota",
  ],
};

const WORLD_CUP_HOST_ROTATION = [["IND", "SL"], ["AUS", "NZ"], ["ENG"], ["SA"], ["WI"]];

export function worldCupHosts(season: number): string[] {
  const edition = Math.max(0, Math.floor((season - 2026) / 2));
  return WORLD_CUP_HOST_ROTATION[edition % WORLD_CUP_HOST_ROTATION.length];
}

export function bilateralVenue(hostCountry: string, matchNumber: number, seriesSeed: number): string {
  const venues = INTERNATIONAL_VENUES[hostCountry] ?? [`${hostCountry} National Cricket Ground`];
  return venues[(matchNumber - 1 + seriesSeed) % venues.length];
}

export function worldCupVenue(season: number, fixtureIndex: number, knockoutOffset = 0): string {
  const venues = worldCupHosts(season).flatMap((country) => INTERNATIONAL_VENUES[country] ?? []);
  if (!venues.length) return "International Cricket Stadium";
  return venues[(fixtureIndex + knockoutOffset) % venues.length];
}
