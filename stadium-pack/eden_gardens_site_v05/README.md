# Eden Gardens — mapped site corrections, v05

Use `eden_gardens_exterior_LOD2.glb` for the first review. It contains the stadium, corrected floodlights, pavilion, roads, boundary walls and gates, basic nearby buildings, the Maidan and Hooghly River. All coordinates are metres, glTF Y-up. Load one of the four combined GLBs at a time through your existing Three.js/R3F loader and orbit controls.

## Corrections from v04

- All four floodlight assemblies moved to the OpenStreetMap lighting-tower coordinates. Each entire assembly is rotated about its foundation so its light array faces the pitch. Heights are retained from the earlier model.
- The geographical alignment changes from an estimated 348° to approximately 330° for the stadium's local positive-Y axis, based on satellite pitch/pavilion alignment. The stadium itself retains its familiar local axes; surrounding geographical features are transformed into that frame.
- The previous circular clipping of roads is removed. Public road centre-lines follow map geometry directly, including the separate road lines beside the pavilion and nearby junctions.
- The artificial 20 m pavilion rear extension is removed. With the corrected bearing, the original rear position has the appropriate relationship to the mapped road.
- The circular site pad and uniform circular perimeter are replaced by a site apron and a boundary following the stadium's immediate surroundings. Four roadside gate positions use mapped coordinates. Five other access openings and the wall trace remain inferred.
- The mapped Maidan outline, paths, nearby playing-ground footprints, ponds, sparse trees and basic nearby building masses provide the wider setting. The Hooghly riverbank is retained from mapped geometry.

## Tower positions

Local values below use the authoring axes (X, Y horizontal, Z up). In glTF/Three.js they map to `(X, Z, -Y)`.

| Tower | Map node | Previous X, Y (m) | Corrected X, Y (m) |
|---|---|---|---|
| T1 | 12143393748 | -78, 106 | -92.74, 107.80 |
| T2 | 12143393749 | 37, 116 | 57.54, 123.24 |
| T3 | 12143393750 | 85, -103 | 87.41, -111.78 |
| T4 | 12143393747 | -86, -99 | -83.57, -107.94 |

The map node coordinates are location evidence, not a certified survey. The geographical origin remains 88.34329°E, 22.56460°N. The context extent is approximately 2.15 km east–west and 3.1 km north–south, covering the stadium and northern/central Maidan context; it is not an exhaustive model of Kolkata.

## Accuracy limits

Road centre-lines, four tower locations, four roadside gates, mapped building footprints and the Maidan/river boundaries are source-based. Road widths, untagged building heights, exact wall alignment, inferred access openings and tree positions are estimates. Gate names in the file are descriptive model labels, not official gate numbers. Existing interior seating and stand geometry retain their previous limitations. This is a proportional visual model, not an as-built survey or a walkable site simulation.

The four stadium detail variants retain the existing individual seats at the three higher levels. The basic surroundings use the same geometry across the variants. The entire highest-detail scene expands to about 10.59 million triangles; LOD2 about 1.98 million; LOD3 about 318,000. Automatic LOD selection is not encoded in these alternative GLBs. The prior full master remains in the v02 package and is unchanged.

`eden_exterior_context.glb` is additions only. It does not include relocated tower meshes or the CAB lettering inserted during assembly. Use the combined files for this review; using the add-on alone with an older model does not apply the tower corrections. Advanced integrations can reproduce the assembly using the source scripts and `exterior_manifest.json`.

## Camera suggestions

For Three.js Y-up, start at `[240,220,340]` looking at `[0,8,12]`. For the pavilion road use `[30,27,220]` looking at `[0,12,117]`. Use a far plane of at least 6000 m to view the full surroundings. Keep the user's game lights and tone mapping. Do not scale or rotate the root when combining with other stadium assets.

## Validation

Four combined GLBs passed the Khronos core glTF validator with zero errors and warnings. That validator does not support the inherited instancing extension; a separate Three.js loading check verified the seat counts, required site objects, absence of the old circular pad, and tower foundation placement within 1 cm of the converted mapped coordinates. This tolerance verifies the export arithmetic, not the accuracy of the underlying map. Actual exported LOD2 geometry was used for the four PNG previews. Browser frame rate and in-game integration have not been measured here.

## Sources and attribution

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), licensed under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Display attribution when using the mapped setting. Map extracts and source generators are included under `sources/`. Original map sources include [the surrounding area](https://www.openstreetmap.org/#map=16/22.5646/88.3433), [Maidan boundary](https://www.openstreetmap.org/relation/9102486), [Hooghly boundary](https://www.openstreetmap.org/relation/18133767), and lighting tower nodes [T1](https://www.openstreetmap.org/node/12143393748), [T2](https://www.openstreetmap.org/node/12143393749), [T3](https://www.openstreetmap.org/node/12143393750), [T4](https://www.openstreetmap.org/node/12143393747).

The north bearing and qualitative site arrangement were cross-checked against [Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) for the stadium area. Imagery is not redistributed in this package or used as a texture. The supplied street/aerial photographs remain the façade references; their portraits and advertisements are not reproduced.

Rebuilding requires the earlier v02 GLBs as input, Python with numpy/Pillow/shapely, Node with Three.js/glTF-Transform/gltf-validator, and a C++ compiler for CPU previews. The provided scripts depend on the included earlier generator stages. The complete build uses `build_eden_site_v05.py` followed by `assemble_eden_v03.mjs eden_gardens_site_v05` from the project root with the earlier v02 directory available.
