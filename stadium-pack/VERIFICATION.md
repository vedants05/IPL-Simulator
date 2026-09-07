# Verification record

## Passed

- Strict TypeScript checking of the integrated builder, viewer, definitions, geometry generator and state types against the reported production library versions.
- Browser-target production bundling for the standalone preview.
- All 10 stadium definitions resolve and reference valid existing stand templates.
- Both detail levels generate finite position, normal, colour and instance-matrix values for all 10 venues.
- All seat instance IDs map back to a valid builder module.
- Geometry generation leaves supplied module data unchanged.
- Empty stadiums and empty individual sections generate safely.
- Selected-section builds generate safely.
- Construction, refurbishment, cleared, completed and cancelled state resolution checks.
- Explicit resource disposal, including repeated cleanup calls.
- Default scene geometry stays within the 60-mesh test budget.

## Not verified here

- The local browser could not launch, so rendered appearance, pointer picking, camera transitions, WebGL fallback behaviour and actual frame rate have NOT been browser-verified.
- This is not a successful full Next.js game build: only the supplied files and their dependencies were available.
- Persistence through complete gameplay project schedules still needs an in-game check using a disposable save.
- Stadium architecture has not been compared against surveyed plans or a full photographic reference set.

## Local preview

Extract the archive, then open `preview.html` in a current desktop browser. It is self-contained and makes no network requests for models, textures or scripts. Select a club in the header. It uses representative module fixtures; it does not read, write or load any game save.

## Required integration smoke test

1. Build the full game. Confirm existing diagnostics separately from new ones.
2. Open all ten clubs; switch between Plan view and Stadium viewer.
3. Rotate, zoom, enter Ground view, toggle roofs, lighting and detail.
4. Click terraces, roofs and seats. Confirm the correct module ID is selected and dragging does not select a section.
5. Use the plan to select empty modules. Check that they can also be selected in the 3D viewer.
6. In a disposable save, inspect demolition, cleared and construction phases, followed by completion.
7. Switch teams/saves and reload. Confirm saved modules, plans and history remain separate.
8. Test an upgraded four-tier section and a low-end machine at low detail.
9. Close/reopen the viewer repeatedly and check renderer memory settles rather than growing continually.

Do not use the generated seat count as gameplay capacity or the rendered pitch/boundary as physical calibration data.
