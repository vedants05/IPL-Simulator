# Stadium neighbourhood map data

© OpenStreetMap contributors. This derived geographic database and accompanying
source extracts are provided under the Open Database License (ODbL) 1.0:
https://opendatacommons.org/licenses/odbl/1-0/
Source and attribution: https://www.openstreetmap.org/copyright

Each TEAM.json includes the source API URL, bounding box, origin, download
timestamp and way identifiers. TEAM.source.json retains the original response.
Refresh: `node scripts/import-stadium-maps.mjs [TEAM]`.

Transformation: selected ways projected to local metres, X east / Z south,
rounded to centimetres. Origin is the nearest large mapped cricket playing-area
bounding-box centre when available, otherwise the initial venue coordinate.

Not a survey. Multipolygon holes, terrain, exact facades and concourse rooms are
not reconstructed. Missing heights and road widths are renderer estimates.
`layouts.json` is derived by `node scripts/derive-stadium-layouts.mjs` from the
archived extracts. It contains 180 ground/perimeter radii per venue in metres,
source object IDs and dates. Nine perimeter rings use building multipolygons.
Delhi uses a labelled inferred hull of three cricket-stand ways, excluding
neighbouring sports buildings. These are mapped estimates, not survey data.
Architectural detail inside the envelope remains procedural.
