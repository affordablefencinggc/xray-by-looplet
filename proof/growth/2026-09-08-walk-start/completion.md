# Walk-through starting placement

Owned source: `src/studio/WalkStartDialog.tsx`, new `walkStartPlacement.ts`, `walkStartPlacement.test.ts`, `walkStartPlacement.css`. No model generator, model JSON, source PDF, shared store or controller changes were made by this slice.

## Contract

`WalkStart` adds optional `yaw?: number` without removing x/z/elevation/level. Yaw is radians in the THREE camera basis: forward `(-sin(yaw),0,-cos(yaw))`. Returned elevation is the actual selected supporting surface height, including modelled floor finishes or small stepdowns. Controller integration remains root/pointer-agent owned.

Pure exports:

- `listWalkFloors(model)` returns explicitly elevated levels that have geometry.
- `assessWalkStart(model,floorId,{x,z})` returns `{ok:true,placement}` or `{ok:false,reason}`.
- `recommendWalkStarts(model,floorId)` returns up to4distinct supported room/slab suggestions.

Placement uses horizontal triangles near the selected floor elevation, not a floor bounding-box centre. It checks support around a0.30m body radius, rejects nearby clipped obstacle triangles and points inside closed solids, and tests an eye-height viewing fan to avoid starting against a wall. Named common rooms on the main floor elevation are preferred over external/storage areas. Unsupported floor elevations, invalid coordinates/indices, missing support, edges/steps and cramped views refuse placement. Geometry stays unchanged.

Picker recommendations are memoized by model/floor. The default start is a valid suggestion; clicking a plan or using arrow keys validates the new point. Refusal retains the previous marker but disables Start until the user selects a valid point. The final Start click reassesses against the current model. Numbered map markers, an arrow, suggested room names, approximate clear-view distance and heading make the result reviewable. The UI discloses inferred model placement and that later movement remains a free walk-through.

## Verification

`node --experimental-strip-types --test src/studio/walkStartPlacement.test.ts`:5tests passed; `unit-tests.log`.

- Actual Redburn ground and upper model: valid recommendations, expected primary room evidence (lounge/bed1), actual finish elevation0.015/3.135, distinct supports and no source mutation.
- Independent THREE raycasts at eye height confirm all returned headings and their left/right viewing fan have no modelled solid within1.19m.
- Synthetic closed walls, low cabinets and thick solids reject internal/nearby starts while clear locations remain valid.
- Triangle footprint test rejects a point within its AABB but outside the actual floor triangle.
- Unsupported levels, absent floor elevation, corrupt indices, roof-only geometry, nonfinite/outside/edge coordinates refuse placement.
- Actual support height follows a70mm stepdown; enclosed cramped geometry refuses a blank-wall start.

`npm.cmd run typecheck`:exit0 after the selected recommendation contrast correction.

The coordinating agent drove actual dev picker/start integration and reported a useful lounge/kitchen interior at eye height1.665m with heading-1.9635. I inspected `screenshots/growth/2026-09-08-walk-recommended-dev.png`, found the reported selected-title contrast defect and added an explicit scoped ink colour. Root owns the final post-correction screenshot and combined navigation/browser/native gates. Do not treat this report as independent movement/collision/real-hardware verification.

## Frozen SHA-256

- WalkStartDialog.tsx: `5b49eb5f7a26463b0fc93e996b4ba45fea4779e24b0ca7bced7b3d792f347632`
- walkStartPlacement.ts: `b04781eac092b3b2004e6d804acb8ba8580cfd28f85bb00c2740666e3c4f83d1`
- walkStartPlacement.test.ts: `e26b1c6880f21e6cd60c6335d8ecda8f5719d33a430e37c3c99279f146981138`
- walkStartPlacement.css: `90ed00de264539032e8c7d5803b1d6aa34eb5166746538ec7492c2ff100eaa04`

Placement is an inference over modelled surfaces and solids, not surveyed circulation, building compliance or an accessibility assessment. It does not add collision enforcement to subsequent navigation.
