import fs from 'node:fs';import crypto from 'node:crypto';const d='proof/audit/IW-REDBURN-3D';const rows=[];for(const name of fs.readdirSync('public/models/redburn')){const bytes=fs.readFileSync('public/models/redburn/'+name);rows.push({file:'public/models/redburn/'+name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}fs.writeFileSync(d+'/assets.json',JSON.stringify(rows,null,2));let todo=fs.readFileSync('REDBURN-3D-TODO.md','utf8').replaceAll('- [ ] SC-','- [x] SC-');todo+='\nVerified: typecheck; 655 JS/TS tests; web and NSIS builds; 9 UI scenarios on dev, built desktop assets, built web output, packaged and installed Windows app. User-requested recording repeat also passed. Code diff and screenshots: proof/audit/IW-REDBURN-3D/completion.md.\n';fs.writeFileSync('REDBURN-3D-TODO.md',todo);
const completion=`# Redburn BR250157 / local installed reconstruction
Branch: feat/model-wireframe-navigation. Existing workspace/index preserved; no staging, commit, merge or push.

- Original supplied PDF retained byte-for-byte: b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38; all13 sheets rendered locally. No external publication.
- Authored Three.js reconstruction:186 selectable assemblies; lower/upper floors, room layouts, aperture geometry, louvres/bifolds, stairs, terrace, carport/court, roof pitches, fixtures and cladding. Generator and source asset hashes retained.
- Source catalog, optional initial camera/plan orientation and edge styling integrated. All new metadata validates; old scenes remain supported. New regressions are in npm test.
- Source measurements do not make this exact CAD/BIM. Placements, roof intersections, terrain, profiles and unspecified details are inferred. RL22.50/100 mm outdoor-step discrepancy explicitly unresolved. No verified material quantities claimed.

## Verification
Typecheck passed; npm test655 tests passed (198 +457). New tests bind original bytes, reject modified bytes/invalid camera bases, verify actual holes through wall/cladding meshes at named glazing centres, and verify floor isolation. Web and NSIS builds passed.

Nine UI scenarios pass on dev, production web output, built desktop assets, packaged Windows executable and installed copy: import/hash, orbit, lower plan, upper cutaway, selection/source reference, wireframe/explode, reload, wrong-document guard, mobile overflow/content. Zero page or console errors. Exact on-screen native run repeated at user request for recording; native-recording-repeat.log records pass.

Packaged native tests need normal Windows permissions: sandbox launch opened a window but did not expose the WebView2 test connection; approved normal-permission retry passed. This is Playwright/CDP UI automation, not a claim of a working MCP connection. Linux-only preview:restart is unavailable on Windows; npm run preview successfully served the actual Vercel build for web verification.

Installed SHA256: ebb1aaa6760d1c1498760f9317abbcf4991ddb61042bc6108575f0b31a29bd67. Verified against tested build5981a8d01034ef9af76ea0b8b583ac0994855993ed0fa3e8009266b7e1c7c7a8 allowing only the single Tauri UNK-to-NSS marker. Previous executable backed up; user profile retained; normal installed app reopened via existing local-settings launcher. No credentials printed or copied.

## Evidence
[Exact code diff](code.diff), [asset hash manifest](assets.json), [repeatable UI test](browser-qa.mjs), [installed UI verdict](installed-qa.json), [package identity](bundle-identity.json).

[Installed exterior](../../../screenshots/redburn/installed-01-exterior.png), [lower plan](../../../screenshots/redburn/installed-03-lower-plan.png), [upper plan](../../../screenshots/redburn/installed-04-upper-plan.png), [cutaway](../../../screenshots/redburn/installed-05-upper-cutaway.png). Screenshots visually reviewed. Model assemblies are not stock counts.
`;
fs.writeFileSync(d+'/completion.md',completion);for(const file of['COMPLETE-CHECKLIST.md','LOOPLET_BRANCH_RELEASE_LEDGER.md'])fs.appendFileSync(file,'\n- '+(file.startsWith('COMPLETE')?'[x] ':'')+'2026-09-06 | feat/model-wireframe-navigation | Redburn BR250157 Three.js reconstruction installed:186 source-linked assemblies, original13-page PDF, plan/cutaway views. Typecheck,655 tests, web/NSIS builds and9 UI scenarios across web/native plus filming repeat passed. Inferred geometry and unresolved outdoor datum remain explicit; no quantity accuracy claim. Proof: proof/audit/IW-REDBURN-3D/completion.md. No stage/commit/merge/push.\n');
