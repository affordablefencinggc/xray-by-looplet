# Dashboard refresh qualification — 19 September 2026

The generated static dashboard is qualified against its frozen source inputs on **DANS1**. This record does not promote any underlying product slice, certify deployment, or claim live-device acceptance.

## Delivered artifact and exact diff

- Artifact: [XRAY-STATUS-AND-PROOF-DASHBOARD.html](../../../XRAY-STATUS-AND-PROOF-DASHBOARD.html).
- Artifact SHA-256: `04599f17524f6b3035f826d846d2756498207b474aa0057296a02650d02dfe15`.
- [Exact HTML/generator/validator diff](dashboard-exact.diff), SHA-256 `aa383382e524763d6226e26b2c01563ce87915be47bfd77d4e62300b5c392694`.
- [Generator/validator source-only diff](dashboard-source.diff).
- Final campaign: [`dash-d8544ce2ec98`](campaigns/dash-d8544ce2ec98/output/results.json), completed `2026-09-19T12:33:01Z`.
- Source digest: `d8544ce2ec98c8b50d8a1bc0341f47588e42f752b8ccd11aa3558b7297c98c61`.

The root artifact was copied from the tested DANS1 output and its hash matched. A repeated generation was byte-identical. `git diff --check` passed for the artifact and both changed generator/validator scripts after the final generation.

## Executed steps and results

| Step | Recorded result | Evidence |
| --- | --- | --- |
| Package explicit inputs and transfer | 63 named inputs; archive SHA checked on DANS1 | [Source manifest](campaigns/dash-d8544ce2ec98/output/source-manifest.json), [transfer receipt](campaigns/dash-d8544ce2ec98/transfer-results.json) |
| Generate HTML | Exit 0 | [Receipt](campaigns/dash-d8544ce2ec98/output/generate.json), [stdout](campaigns/dash-d8544ce2ec98/output/generate.stdout.log) |
| Validate generated document | **433/433 passed** | [Receipt](campaigns/dash-d8544ce2ec98/output/validate.json), [stdout](campaigns/dash-d8544ce2ec98/output/validate.stdout.log) |
| Repeat generation | Exit 0; byte-identical artifact | [Receipt](campaigns/dash-d8544ce2ec98/output/generate-repeat.json), [repeated artifact](campaigns/dash-d8544ce2ec98/output/repeat-dashboard.html) |
| Build source-derived browser scenario | Exit 0; expected values read from the same staged sources | [Receipt](campaigns/dash-d8544ce2ec98/output/scenario.json), [scenario](campaigns/dash-d8544ce2ec98/output/browser/scenario.json) |
| Raw-CDP browser qualification | **105/105 operations passed**, zero browser errors, all 53 curated images decoded, 11 screenshots | [Per-operation results](campaigns/dash-d8544ce2ec98/output/browser/browser-results.json), [runtime binding](campaigns/dash-d8544ce2ec98/output/browser/run-binding.json) |
| Cleanup and retrieval | Browser gracefully closed, owned static server stopped, no source changes; all 38 returned output hashes verified | [Launcher receipt](campaigns/dash-d8544ce2ec98/output/browser/launcher-results.json), [overall receipt](campaigns/dash-d8544ce2ec98/output/results.json), [output hashes](campaigns/dash-d8544ce2ec98/output/sha256-manifest.json) |

Browser checks covered source-derived headline and catalogue counts; combined search/status/category filters and empty states; tab keyboard navigation; accordion expansion; safe Markdown link/code rendering; gallery filtering; real keyboard lightbox close and focus handling; desktop 1600×1000 and tablet 1024×768 layout; image loading; and zero browser errors. The complete exact opcode list and individual values are retained in the scenario and browser results above.

The displayed A–Z row totals are 375: 6 verified, 108 partial, 19 dependency-blocked, 241 gaps and 1 failed. The headline 114/375 means verified plus partial, not completed. Partial slices do not show a green completed-date tick. SC09 remains partial. Historical screenshots are labelled as historical evidence, not current qualification.

## Screenshot inspection

All eleven final screenshots were visually inspected by the producing agent. Text and status chips were legible; tablet controls and source metadata wrapped; no blank state, overlapping content or horizontal page clipping was observed. Lightbox content uses its own vertical scrolling with the close control available.

| State | Desktop | Tablet |
| --- | --- | --- |
| Summary and catalogue counts | [1600×1000](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-summary-desktop-1600x1000.png) | [1024×768](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-summary-tablet-1024x768.png) |
| Combined filters | [1600×1000](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-combined-filters-desktop-1600x1000.png) | — |
| Expanded SC09 evidence | [1600×1000](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-expanded-evidence-desktop-1600x1000.png) | [1024×768](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-expanded-evidence-tablet-1024x768.png) |
| Open roadmap | [1600×1000](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-open-roadmap-desktop-1600x1000.png) | — |
| Filtered historical gallery | [1600×1000](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-filtered-gallery-desktop-1600x1000.png) | — |
| Image lightbox | [1600×1000](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-lightbox-desktop-1600x1000.png) | [1024×768](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-lightbox-tablet-1024x768.png) |
| A–Z filtered catalogue | [1600×1000](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-az-filter-desktop-1600x1000.png) | [1024×768](campaigns/dash-d8544ce2ec98/output/browser/captures/dashboard-az-filter-tablet-1024x768.png) |

## Input provenance and scope

The source manifest explicitly names two Markdown documents, the curated-image manifest, exactly 53 existing images, and the generator/validator/runner helpers. No untracked older runner, app source archive or broad proof-directory copy was used.

| Source | SHA-256 |
| --- | --- |
| `PROFESSIONAL-A-Z-CHECKLIST.md` | `3269d930e238eb5f43aea095d0c27fc64530c6ceebfe87e5913202fe04b15ec7` |
| `XRAY-PRODUCTION-CLOSEOUT-LEDGER.md` | `38621dafcc188ae8a49dfdbc3c85302df043b3ba3a34cb5c7e49dee57f5ae700` |
| `dashboard-curated-images.json` | `1aeba0ca6ce902b9a12a9a6eaae575a58ba28b40d3905a3bb4a316ba847062b5` |
| `scripts/build-full-dashboard.mjs` | `817c2ca76f6f5ffd3a194b91b8ba1b89f8cf0bf1e8be8e76ef7b771e561e73d9` |
| `scripts/validate-dashboard.mjs` | `aeeb7c3a10650770d80d20500d4f6eb4ddc5018d495e3625fc442ed815c6a541` |

Runtime was Node v24.20.0 and Chrome 153.0.8010.50 on DANS1. The unique static origin used port 8090 and the isolated raw-CDP browser used port 9338; no app build or app server was started by this campaign. Both SSH orchestration and executable workers independently check the DANS1 host.

Only the two named Markdown sources and curated images were staged. Other repository evidence links were syntax-checked, not all navigated. Historical image decoding proves asset availability, not the application behavior depicted. This is not an offline-font test, physical tablet test, app regression suite, production build test or deployment test.

## Reproduction and retained iterations

Run `proof/growth/2026-09-19-dashboard-refresh/invoke-static.ps1` from the repository. It packages exact inputs locally, then runs generation, validation and browser testing remotely on guarded DANS1. A source digest identifies the campaign; existing campaign directories are deliberately not overwritten. The final preserved campaign can be audited without executing anything.

Earlier iterations remain separate: `dash-329a6d2103c2` exposed sticky-header click occlusion; `dash-ae13f06c3cfe` passed browser operations but visual inspection found the misleading partial-slice completion tick; `dash-ef2174d1ae50` preceded the final Markdown source freeze; `dash-66f8f562870e` passed functional proof but generated trailing whitespace. The final `dash-d8544ce2ec98` reran every gate after those fixes. None of the earlier artifacts was overwritten or relabelled as the final run.

No ledger/checklist row was promoted by this dashboard qualification. Overall product completion, source acceptance, deployment and human live-device acceptance remain governed by the ledger.
