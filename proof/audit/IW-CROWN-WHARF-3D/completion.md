# Crown Wharf A4 structural 3D ? completion

Approved by user: "can you do the 3d building?"
Recovery: feat/model-wireframe-navigation at 3a16e98d6b28cdcb391fc753fe849ddee2dd9ffe. Shared changes preserved; no staging, commit, merge or publication.

## Delivered
- Reproducible model generator and original-source assets in public/models/crown-wharf. Ground, levels 01?31, roof and lift overruns: 33 selectable storey references, 2,180 rendering meshes.
- Source: Arup Crown Wharf Canning Town Block A4 structural appendix, PDF pages 27?36 of 36. Original SHA-256 32a99e7680a94f7690bc1639913563f279a3452bcb9f0dd4e4ef63997ab2639a.
- Written grid chains and floor elevations anchor manually approximated geometry. Floor isolation, correct high-rise camera fit, floor explosion, original-sheet evidence, and real PNG export. Legacy Caroline controls retained.
- Storey schema validates identity, ordering and membership. Camera records support bounded storey IDs. Floor changes clear stale part selection and restrict the part list; per-source options reset safely when changing models.

## Limits
This is a structural review visualization, not Altitude, a BIM import, fabrication model or verified inventory. All generated parts are explicitly inferred. Typical columns are repeated indicatively through lower storeys; transfer and upper column changes require further coordination. Ground and stepped slabs are simplified. Foundations, lower ground, beams, stairs, reinforcement, facade, glazing, fitout, MEP and fasteners are omitted. No mesh count, concrete volume, mass, or storage volume is presented as a verified physical quantity. The model preserves drawing elevation datum; +108.690 m is an indicative top-of-upstand elevation, not a claim of height above local ground. Source restrictions and assumptions are visible in the inspector and exported PNG footer.

## Verification
- npm run typecheck: pass. npm test: 587 pass (198 script + 389 TypeScript); 0 fail. npm run build: pass. DATABASE_URL absent; migration script correctly skips its external DB step.
- 9 actual browser scenarios pass in EACH of dev and final production output, zero console/page errors. These exercise all 33 storey selections and exact visible-mesh membership, original PDF SHA, plan/evidence page 34, cutaway, clearing hidden selections, wireframe, explosion, orbit/zoom/fit, roof toggle, reload recovery, mobile controls/overflow and Caroline legacy floor regression.
- Real exported PNGs inspected: full tower, alternate orbit, roof, level-18 plan/cutaway, wireframe; desktop/mobile application captures also inspected. Reports: screenshots/crown-wharf-3d/{dev,built}/report.json. Replay: node proof/audit/IW-CROWN-WHARF-3D/browser-proof.mjs <dev-or-built-url>.
- Generic browser smoke: desktop/mobile content visible, zero errors or overflow, built output does not diverge from dev. Default share-card note applies to this plain construction utility; no custom card required. Final screenshots/smoke verdicts inspected.
- Initial browser evidence-selector check exposed an ambiguous implicit select label. Explicit Building part aria-label added; final reruns pass. Initial failure screenshots retained with clear filenames.
- Windows environment has no sh/agent-browser: existing startup.sh preserved; equivalent npm scripts and Playwright Edge used. Temporary QA services stopped; services-stopped.txt verifies no listeners.

## Recovery artifacts
- implementation.patch: exact before/after task changes plus new generator, tests and replay.
- source-hashes.json: implementation and generated-source asset hashes.
- typecheck.txt, test.txt, build.txt and exit JSONs.
- public/models/crown-wharf/README.md: reproducibility, source and assumptions.

In the app: Model ? Crown Wharf A4 tower ? Open plan in 3D. Select a floor, orbit or use Plan, select a component for evidence, and export PNG.
