# Stadium render accuracy

## Map-backed surroundings

All ten venues load cached OpenStreetMap geometry from public/stadiums/maps.
The importer retains source responses, way IDs, bounding boxes and download dates.
The derived database is ODbL with visible attribution. No game-time OSM requests.

Mapped building footprints, roads, railways, water, parking and green areas use
fixed metric positions (X east, Z south). Upgrades no longer move the neighbourhood.
The old invented circular roads, radial avenues and landmark placements were removed.
Sparse map coverage is not filled with fabricated landmarks.

The origin uses the nearest large mapped cricket playing-area bounding-box centre
where available. POI markers can indicate entrances instead of field centres.
Building heights default to 9m, or mapped levels times 3m, unless height is tagged.
Road widths are estimates unless tagged. Bridge elevation is a placeholder.

**Not an exact digital twin:** the importer currently handles ways, not multipolygon
holes. Terrain is flat. Facades and concourses are not surveyed. The editable bowl
now follows the mapped field and building envelopes. Internal partitions, named
stand bearings and heights remain estimates. Large game upgrades can overlap
real-world features. Those features are not moved to hide the conflict.

## Existing detail features

Shared procedural templates provide seats, openings, stairs, curved roofs, glazing,
hospitality rooms and optional crowd motion. New buildable styles include sandstone
arcade, Victorian pavilion, glass sky lounge, tensile terrace and asymmetric grandstand.
These are fictional upgrade designs, not measured replicas. Inspection cameras,
distance-based whole-stadium LOD, reduced-motion support and dated construction
visuals do not change save capacities or project timing.

## Evidence still required

Current survey plans, licensed aerial imagery and registered photographs are needed
for exact stand envelopes, facades and internal circulation. A photograph alone
cannot establish hidden rooms or dimensions. A dated reference located in research:
[Hemang Rindani's Eden Gardens photograph (2018)](https://commons.wikimedia.org/wiki/File:Eden_Gardens_Cricket_Stadium.jpg).
It has not been used as a texture or treated as a current survey.

## Checks

Run npx tsc --noEmit and npx --no-install tsx calibration/stadiums.test.ts.
Tests cover all ten map datasets and three rendering details, finite geometry,
module selection IDs, save immutability, resource disposal and construction stages.
They do not prove visual accuracy or source completeness.

## Metric geometry and modular integration

`scripts/derive-stadium-layouts.mjs` derives `public/stadiums/maps/layouts.json`
from the archived OSM extracts. It assembles nine outer building multipolygons.
Delhi uses an explicitly inferred hull of cricket-stand ways 464253922/3/4;
the adjacent rectangular sports buildings are excluded. Each venue has 180
ground/perimeter radial samples, source IDs, source dates and ODbL attribution.
Centimetre rounding is storage precision, not a claim of centimetre accuracy.

`siteGeometry.ts` maps the existing editable modules into these metre-scale
envelopes. The 2D plan and 3D renderer use the same section order and a south-up
plan projection. Saved IDs, capacities and project dates remain authoritative.
Linked replacement sections share tier levels, including across old stand
boundaries; unselected stands retain their original geometry. Extra tiers expand
their sections while the field and geographic surroundings keep their scale.
Camera framing follows the full upgraded envelope.

The rendered pitch is 20.12 by 3.05 metres, following
[MCC Law 6](https://www.lords.org/MCC/The-Laws-of-Cricket/The-pitch).
Wankhede's full cantilever projection uses the architect's published 25 metres:
[PK Das project description](https://pkdas.com/wankhede-stadium-executed-mumbai-project-40-1-40.php).
GT's identifiable original 2020 bowl receives a visual-only two-tier correction,
following [Populous](https://populous.com/showcases/narendra-modi-stadium).
Later four-tier construction retains its chosen design. Game capacity is unchanged.

No third-party GLB/glTF stadium model was installed. This is a procedural
approximation fitted to mapped envelopes, not a surveyed digital twin. Exact
facades, internal circulation, roof profiles and every stand location still need
architectural evidence. Online commercial models are potential future assets,
not dependencies of the current renderer.

Additional regression: `npx --no-install tsx calibration/stadiumGeometry.test.ts`
checks source envelopes, consistent section mapping, inverse metric transforms,
cross-boundary replacements, unchanged neighbours and GT save compatibility.

## Live integration verification

An isolated test career on localhost was used to open all ten teams' actual Club
stadium-builder pages, select two adjacent sections and open each 3D viewer.
All ten exposed 24 selectable sections and rendered one canvas without browser
exceptions. Screenshots were inspected separately from the geometry assertions.
The test profile is separate from the user's save. Punjab's live ID is PBKS;
PBK is also accepted by the renderer/builder as a compatibility alias, retaining
the caller's existing storage key. Inspection camera positions are cached between
changes to the venue, selected section, geometry or camera mode.

With the metric geometry, isolated 180-frame Chrome previews on the Radeon 780M
reported Eden median 12.2ms / p95 18.3ms and all-four-tier GT median 24.2ms / p95
25.5ms, the latter after adaptive resolution reached .9. These measure fixed-camera
rendering with crowds, not whole-game frame rates; the stress preview used Eden's
neighbourhood context. The live ten-venue checks load each venue's own map.

## September 2026 quality pass

- Match-day fencing with open access gaps; supported gates, queue rails,
  awning kiosks, concession signs, bins and benches around the model apron.
- Continuous site ground and bounded, deterministic decorative vegetation
  constrained to mapped parks, avoiding mapped buildings and road corridors.
- Facade-window shading follows mapped building footprints; window placement,
  coping, kiosks, gates and tree locations are generic decoration, not surveyed.
- Screen towers occupy roof-free upper-stand bays and face inward. Eden's
  stand-integrated arrangement was checked against the match-day image in
  [OneCricket's Eden report](https://cricket.one/cricket-analysis/eden-gardens-ipl-records-ahead-of-kkr-vs-lsg/661a3b8078fa27f525187d19).
  The picture is a reference only, not redistributed as a texture. Precise
  azimuths/placements across all ten grounds remain unverified.
- Ground-aimed lamp banks, stronger physical light output, soft bloom,
  textured turf, cavity shading, seat rails and richer concourse detail.
- Automatic resolution control and whole-stadium LOD. Expensive ambient
  occlusion is reserved for higher rendering budgets. Shadows update only
  when structure/visibility changes. Selection no longer rebuilds geometry.

Isolated Chrome tests on this computer used the Radeon 780M (not the available
RTX 4060). At 1400×950 with decorative crowds and high geometry: Eden median
17.9ms, p95 27.1ms; all-four-tier GT stress case median 18.3ms, p95 42.5ms after
adaptive resolution reduced to .85. These are 180-frame fixed-camera previews,
not full-game benchmarks or a guaranteed frame rate. All four static camera
checks reported no browser errors. Full real-life accuracy for every stadium
was not established by this time-limited pass.
