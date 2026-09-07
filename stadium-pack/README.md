# IPL stadium extension — procedural WebGL prototypes

This pack creates ten configurable stadium scenes inside your existing Next.js / React Three Fiber game. These are editable procedural 3D assets, not GLB files, and not exact architectural replicas. No Blender, downloaded textures, sponsor logos, new model loaders, or additional production dependencies are required.

## Install

To see the models first, extract the ZIP and double-click **preview.html**. Choose a club at the top. This self-contained preview does not access your game or saves. See `VERIFICATION.md` for the checks completed and the browser checks still needed.

1. Back up or commit your current project changes.
2. Add `components/club/StadiumViewer3D.tsx` and the entire `components/club/stadiums/` folder from this pack to the corresponding folder in your game.
3. Keep your existing `stadiumVisualDesigns.ts`. The copy in this pack is unchanged from your upload and is included only for completeness.
4. Integrate the builder using ONE of these routes:
   - If your `StadiumBuilderPage.tsx` has not changed since you uploaded it, replace it with the included version.
   - If it has changed, review `integration.patch`, run `git apply --check <path-to-pack>/integration.patch` from your project root, then apply it with `git apply <path-to-pack>/integration.patch`. If the check fails, merge the small changes manually; do not force the patch or overwrite newer work.
5. Leave `EdenGardensViewer3D.tsx` in place. It is no longer used by the updated builder, but keeping it preserves other imports and provides a fallback. Do not change `package.json` or `pitchCurator.ts`.
6. Run your project's type check and `npm run build`. Open Stadium Builder for each club and select **Stadium viewer**.

The code is checked against React 18.3.1, R3F 8.17.10, Three.js / types 0.170.0, Next.js 14.2.35 and TypeScript 5.6.3. Your complete application was not available, so a full game build still needs to run in your project.

## Controls

- Drag horizontally, or use the left/right buttons, to rotate.
- Overview / Ground view changes camera position.
- Hide roofs exposes seating and makes section selection easier.
- Click a stand, roof, or seat to select its existing builder module. Empty sections remain selectable.
- Day / Night changes the lighting treatment. This is ambient art lighting, not a physical floodlight simulation.
- Detail: medium / low adjusts seating density, seat backs and surface segmentation.
- In overview, + / − changes zoom. Focus the viewer background to use arrow keys and + / −.
- If WebGL fails, return to Plan view; the builder remains usable without 3D.

## Venue art direction

All venues share modular construction but have independent settings. These are approximate design studies, not claims that every roof, stand or colour exactly matches today's venue.

| Club | Venue | Preset treatment |
|---|---|---|
| KKR | Eden Gardens | Existing stand groupings and legacy hospitality overrides; mixed seating and asymmetric tiers |
| RCB | M. Chinnaswamy Stadium | Compact rounded bowl; mixed-height two-tier sections |
| MI | Wankhede Stadium | Blue seating, elongated bowl and segmented canopy |
| CSK | M. A. Chidambaram Stadium | Yellow seating and raised canopy panels |
| DC | Arun Jaitley Stadium | Squarer footprint and uneven stand heights |
| LSG | BRSABV Ekana Cricket Stadium | Broader, deeper seating bowl and sweeping canopy treatment |
| SRH | Rajiv Gandhi International Cricket Stadium | Open/covered stand mix and six mast positions |
| GT | Narendra Modi Stadium | Deep continuous two-tier bowl and roof-ring lighting |
| RR | Sawai Mansingh Stadium | Low open terraces and heritage-style pavilion details |
| PBKS | Maharaja Yadavindra Singh Stadium | Broad footprint and alternating canopy sections |

The venue roster comes from your supplied game data. The [official IPL venue list](https://www.iplt20.com/venues) provides a roster cross-check. [Populous's Narendra Modi Stadium project](https://populous.com/showcases/narendra-modi-stadium) provides architectural context for its broad bowl and lighting treatment. These sources do not establish precise dimensions for this geometry; roof profiles, palettes and stand arrangements remain artistic approximations.

## Saves and gameplay

- Existing storage keys and saved modules are retained. The renderer never mutates the modules passed to it.
- Existing saves keep their own templates, roofs, empty sections, and upgrades. They receive the new venue footprint, palette and lighting, but are **not forcibly converted** to a fresh preset.
- The fresh non-KKR builder uses each venue's initial stand/roof templates. Starting capacity values remain the builder's existing values. Changing these initial templates can affect future upgrade calculations, because the existing game's calculations depend on template multipliers.
- KKR retains the original `createEdenModules()` defaults unchanged.
- Switching club/save remounts builder state to prevent one club's in-memory data being written to another club's storage key.
- Capacity discrepancies between the builder and `pitchCurator.ts` are deliberately not reconciled in this visual task.
- Visible seats are a representative sample, **not the gameplay seating capacity**. Lower detail does not reduce gameplay capacity.
- Pitch dimensions retain the legacy 3.2 × 21 presentation units. Rendered boundaries are not authoritative match distances; wiring custom boundary edits into 3D is a separate change.
- The DOM/CSS playable match renderer is untouched.
- No save reset or data migration is necessary. Use a new disposable save to inspect fresh architectural presets.

## Files for developers

| File | Purpose |
|---|---|
| `StadiumViewer3D.tsx` | Client canvas, camera, controls, error fallback and module picking |
| `stadiums/definitions.ts` | Ten venue profiles; edit this for footprint, palette, row count, roof treatment, lights and default stand types |
| `stadiums/buildStadium.ts` | Pure Three.js geometry generator with explicit disposal |
| `stadiums/types.ts` | Viewer contract and construction-state resolution |
| `StadiumBuilderPage.tsx` | Integrated copy of your uploaded builder |
| `integration.patch` | Reviewable changes to the builder only |
| `tests/fixtures.ts` | Standalone preview fixtures, not game save data |
| `tests/stadiums.test.ts` | Geometry, state, budget and disposal checks |
| `preview.html` | Self-contained, offline-capable preview with sample modules |

`buildStadium(definition, modules, options)` returns `{ group, roofs, stats, dispose }`. Add `group` to a Three scene, then call `dispose()` after removing it. Selection colours are supplied through `options.selected`. Object `userData.moduleId` and instanced-seat `userData.moduleIds[instanceId]` identify the builder section. The React wrapper owns this lifecycle and is compatible with StrictMode effect replays.

## Performance and limitations

Repeated seats use two stadium-wide instanced meshes at medium detail, and one at low detail. Concrete, bays and terrace rows are batched per section. Rendering pauses when the camera and controls are idle. These choices follow [R3F's instancing and on-demand rendering guidance](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

In the shipped fixtures, medium detail generates 41–53 meshes, approximately 254k–793k triangles and 7.5k–26.8k visible seats. Low detail generates 40–52 meshes and about 100k–262k triangles. These are generated geometry counts, not measured FPS; upgrades can increase them.

This is a first-pass modular asset system. It does not include surveyed facades, detailed surrounding cityscapes, crowd animation, baked lightmaps, automatic distance LOD, physically accurate lighting or an export pipeline. Selection changes rebuild geometry; very large custom configurations may benefit from updating instance colours in place later.

To run the included tests, keep this folder structure and use your project's existing `tsx` runner: `npx --no-install tsx <path-to-pack>/tests/stadiums.test.ts`. Do not install the validation dependencies used during generation into your production project.

## Small Codex handoff

Ask Codex to integrate and verify this implementation, not regenerate the stadiums:

> Integrate this IPL stadium pack into my existing game. Read its README first. Add the new viewer and stadiums folder, preserve my existing stadiumVisualDesigns.ts, and merge integration.patch into StadiumBuilderPage.tsx without overwriting newer changes. Keep the old Eden viewer, gameplay data, dependencies, and saves intact. Run the type check and build, then smoke-test all ten clubs, section picking, camera controls, roof toggling, and a construction project in a disposable save. Report any remaining failures. Do not redesign or regenerate the models.
