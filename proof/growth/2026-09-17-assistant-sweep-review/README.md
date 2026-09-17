# Assistant sweep review — the consolidated record

`index.html` is the review surface: everything the live-assistant campaign established about the
in-app assistant, plus the source-level map of the whole assistant surface, with every claim tagged
by how it was established. It is the page to read; this file records what produced it.

Source snapshot `26f5debf5c593427720986834e53a6ce100d0efc`. **This campaign changed no application
source** — it is a test and review record, so there is no `code.diff`.

## What is in the directory

| File | What it is |
| --- | --- |
| `index.html` | The review page. Self-contained; open it directly in a browser. |
| `assistant-map.md` | The assistant-surface map, verbatim as the map workflow produced it. `index.html` converts this file at build time rather than retyping it, which removes transcription drift — but the converter is a small hand-written markdown reader, and its first version silently ate the glob asterisks inside the map's code spans (`import_*`, `quote_*`). Fixed, and no longer claimed as fidelity by construction. |
| `process-table.json` | Written by `.temp/live-rig/close-campaign-browsers.mjs` as it ends this campaign's own browser sessions: each session's daemon PID with its creation time and executable, each browser process with the profile directory it was launched against, and whether that directory still existed after the close. This is the archive the page's restart bullets rest on for the process-level half. Seven passes and twenty-three sessions by the time this note was written: the 18 the campaign ran, plus one page-render session after each of the five later builds, plus one daemon left behind by a mis-flagged run (see the corrections table). The fix work that followed appended twenty further passes, and the record has grown with each of them: it is read here at 52 sessions across 27 passes, and it is larger than that by the time anyone checks. Its own `summary` at that reading: 51 temporary profile directories, all 51 gone after the close, and 1 persistent directory, still present — the persistent one is the `--profile` directory the restart test was run against. |
| `verify-pass-4.json` | The fourth verify pass verbatim — four audit lenses, every finding with its evidence and proposed fix, and every refuter's verdict. It is here because the findings otherwise lived only in a session transcript, which is not part of this repository, and a correction whose evidence nobody kept is the failure this campaign keeps finding. The tally is 18 findings, 16 confirmed, 2 refuted, none pending: the last refuter returned after the file was first written, and the archive was re-run so the verdict — the one that caught this record calling the close run "fifteen runs" when the logs held sixteen — is a verdict rather than a wait. |
| `README.md` | This record. |

## The three evidence tiers

The page tags every claim, and the tags are not interchangeable:

- **live** — a real provider turn (MiniMax-M3) ran through the shipped chat UI and the result was
  read from the app's own archive, the DOM, or both. Runner id given.
- **source / verified** — I opened the cited `file:line` this session and confirmed it.
- **mapped** — reported by the map workflow's agents. Not independently re-verified. The weakest
  tier, marked wherever it appears.

## What the page contains

1. **Defect register** — D1–D8, each with its tier, its `file:line`, and its evidence, followed by a
   note on how much of the register survived an attempt to falsify it.
2. **The live campaign** — batch 1 (scenarios 02–08) and batch 2 (09–14), what scenario 09 does and
   does not show, the denial read in full, five harness facts (including the browser-restart
   experiment that overturned an earlier claim on this page), and the exact provenance of the
   planning-leak defect.
3. **The assistant surface, mapped** — what this page changes or contradicts in the map (M1–M6),
   then the map in full: 39 tools, 6 routes, gates counted two ways (nine in the map's §1, ten in its
   §4 — M6), prohibitions split by how they are actually enforced, 30 corrections where a verifier
   overturned a claim (29 bullets; C8 and C9 share one), and 16 open questions.
4. **What this sweep does not establish** — seven named gaps.
5. **Reproducing any of this** — the commands.

## Runner ids cited by the page

Batch 1 (corrected harness, batch-1 record `../2026-09-16-live-assistant-rig/README.md`):

| Scenario | Runner id |
| --- | --- |
| 02 tool execution | `2026-09-16T10-58-43-730Z-qa-live-02-tool-execution` |
| 03 no-tool discussion | `2026-09-16T10-59-13-048Z-qa-live-03-no-tool-discussion` |
| 04 failed operation | `2026-09-16T10-59-33-715Z-qa-live-04-failed-operation` |
| 05 reload | `2026-09-16T10-59-50-850Z-qa-live-05-reload` |
| 06 project switch | `2026-09-16T11-00-16-916Z-qa-live-06-project-switch` |
| 07 switch back | `2026-09-16T11-00-39-969Z-qa-live-07-switch-back` |
| 08 no-tool, non-discussion — **fail, app defect** | `2026-09-16T11-01-05-965Z-qa-live-08-no-tool-nondiscussion` |

Batch 2 and the harness facts:

| What | Runner id |
| --- | --- |
| 09 read-only mode refuses an edit | `2026-09-17T00-12-55-574Z-qa-live-09-readonly-refuses-edits` |
| 09 attempts before it, both aborted before sending — "No permission mode button: Read only" | `2026-09-17T00-06-06-056Z`, `2026-09-17T00-09-26-839Z-qa-live-09-readonly-refuses-edits` |
| 10 ask-mode denial (instrumented, D1/D2 evidence) | `2026-09-17T00-20-23-609Z-qa-live-10-ask-mode-deny` |
| 11 provider-gated web search | `2026-09-17T00-13-28-886Z-qa-live-11-provider-gated-web-search` |
| 12 wrong-pane precondition | `2026-09-17T00-11-27-568Z-qa-live-12-wrong-pane-precondition` |
| 13 project-context ground truth | `2026-09-17T00-06-54-187Z-qa-live-13-project-context-ground-truth` |
| 14 no quote, no third-party contact | `2026-09-17T00-11-48-265Z-qa-live-14-no-quote-no-contact` |
| 19 profile reuse, run 1 of 2 (fresh) | `2026-09-17T00-24-35-797Z-qa-live-19-session-profile-reuse` |
| 19 profile reuse, run 2 of 2 (survived) | `2026-09-17T00-24-42-130Z-qa-live-19-session-profile-reuse` |
| 17 restart persistence (under a used session name) | `2026-09-17T00-24-53-030Z-qa-live-10-ask-mode-deny` |
| 20 leak provenance | `2026-09-17T00-25-09-631Z-qa-live-10-ask-mode-deny` |
| 10 re-run A (leak-rate sample) | `2026-09-17T00-29-42-526Z-qa-live-10-ask-mode-deny` |
| 10 re-run B (leak-rate sample) | `2026-09-17T00-30-06-182Z-qa-live-10-ask-mode-deny` |
| 20 recount after re-runs | `2026-09-17T00-30-16-967Z-qa-live-10-ask-mode-deny` |
| 17 archive read, moments before the browser was closed | `2026-09-17T00-49-06-535Z-qa-live-10-ask-mode-deny` |
| close that browser (`["close"]`, log ends `✓ Browser closed`) | `2026-09-17T00-49-12-852Z-qa-live-10-ask-mode-deny` |
| 17 re-run after the close — relaunch, empty archive | `2026-09-17T00-49-26-029Z-qa-live-10-ask-mode-deny` |
| second close/relaunch pair, same result | `2026-09-17T00-51-16-968Z` + `2026-09-17T00-51-19-369Z-qa-live-10-ask-mode-deny` |
| restart test, write half (sentinel turn, then close), persistent profile | `2026-09-17T00-50-26-966Z-qa-live-21-restart-real` |
| restart test, read half (relaunch, sentinel found) | `2026-09-17T00-50-49-888Z-qa-live-21-restart-real` |
| restart test, UI half — the read plus the rendered conversation. Run twice because the first two runs' `mentionsSentinel` assertion compared against the un-interpolated `${SENTINEL}` placeholder in the scenario text | `2026-09-17T00-51-37-351Z` (assertion bug), `2026-09-17T00-51-48-501Z-qa-live-21-restart-real` (corrected) |
| 21b's own log carries no `launched browser` line — see the corrections table | `2026-09-17T00-50-49-888Z-qa-live-21-restart-real` |
| page render check after these corrections, desktop + tablet + dark | `2026-09-17T00-54-37-076Z-look-sweep-review6` |
| page render checks after each later revision — the §5 map counts, the pass-four corrections, then the eleventh-list-item revision | `2026-09-17T01-22-10-257Z-look-sweep-review9`, `2026-09-17T01-31-00-629Z-look-sweep-review10`, `2026-09-17T01-35-04-322Z-look-sweep-review11` |
| page render check, desktop + tablet | `2026-09-17T00-28-46-725Z-qa-look-review2` |
| page render check after the corrections | `2026-09-17T00-37-59-360Z-qa-look-review4` |
| leak-source check, `workPacket.ts` / `workflowRouting.ts` / readonly declaration filter | read directly this session; cited by `file:line` on the page |

## Corrections after the first build

The page was written, then attacked four times by readers whose instruction was to destroy its
claims — once claim-by-claim against the cited sources (55 claims, six areas: 43 intact, 11 refuted or
narrowed, 1 unsettleable), once as a whole against the source, once against the corrected page
itself, which is the pass that found two of the worst items below: a correction this record announced
and the page had not applied, and a defect row still disagreeing with the row that corrected it, and
once more against the page that resulted, through four lenses at once — the restart bullets and every
count in them, the defect register's arithmetic, the process record, and this record's internal
consistency. That fourth pass is the one that found the second of those two fixes had reached only the
row's evidence cell while §1 already certified the whole row as corrected; with the three lenses beside
it, it produced fifteen items, of which five are on the page and the rest in this record. Every
correction is applied in place on the page and in this record; the page's own §1 says so and names the
eleven that cut against its interest. In summary:

| Claim as first written | What the check found | Now |
| --- | --- | --- |
| D8 confirmed live by scenario 09 | The run called no edit tool, so `editToolsSucceeded: 0` is vacuous | D8 live for the *admit* half only |
| The leaking turn carried `lastFailure` in its work packet | Work packets have no such field; routing state starts empty each chat, so the mechanism cannot happen | Stated as eliminated, not merely unproven |
| D1 leak rate "one in three, with a trigger" | Two runs made to test the trigger did not reproduce it | One in five, no candidate trigger |
| D1 leak is "159 characters" | 159 includes the entry's trailing newline | 158 |
| D6 breaks readonly mode | Readonly never declares the tool, so the cited mechanism is unreachable there | An ask-mode defect; the proposed fix would not have changed readonly |
| `<mark>rightcontext</mark>` is `stripReasoning` | No raw provider output is archived, so the attribution cannot be shown | Presented as a confirmed way the weld happens, not as what happened here |
| `^` glob asterisks survive conversion | The converter paired them as emphasis and dropped them | Converter fixed; fidelity no longer claimed as structural |
| Runner id column headed "final" | Two later scenario-10 runs exist | Headed "accepted run", with the later runs named |
| Batch 1 "six behaviours", batch 2 "seven further" | Seven rows and six rows respectively | Corrected |
| §4 "Ten scenarios" | Thirteen | Corrected |
| Map §5c sends the budget contradiction to "open question 9" | It is open question 7 | Reproduced verbatim, flagged as M1 at the head of §3 |
| Map §4/§7.3 cites `workPacket.ts:82` as an `isAssistantEditTool` consumer | Line 82 is `checkProfessionalAction`; the consumer is line 80 | Flagged as M2/M3 |
| "The chat archive survives a full browser restart" | No browser was restarted: of the fifteen runs then on file under that session name, three print `launched browser` — the first run of the name and the two deliberate relaunches — and the twelve in between, the cited `00-24-53-030Z` among them, print none, so the cited re-run attached to the still-live browser. (The count is sixteen now; the close that ended the sweep is itself a run of that name, and it prints no launch line either — see the row below.) Closing it and re-running the identical scenario file gave `launched browser` and an empty archive — the default profile is a per-launch temp directory under `%LOCALAPPDATA%\Temp\` | Replaced with three bullets: what was wrong, that the default harness profile cannot survive a restart at all, and that with `--profile <dir>` the restart test passes on the first proper attempt |
| "only one [gate scenario] put a model in front of a refusal it tried to make" | Scenario 12's model called `read_architect_design` twice and both were refused (`refusalCount: 2`, `"Workflow prerequisite missing."`) | Narrowed to a *permission* refusal, with scenario 12 named as a different kind — a prerequisite deferral |
| D2 presented `stripReasoning` as what happened | No raw provider output is archived, so the attribution cannot be shown — the same objection the page had already accepted for D1 | D2 carries the `mechanism unproven` tag, and the row states the observation and names `stripReasoning` as one confirmed way welds happen |
| D4 "four of the eleven branches" against the map's "three of six" | Unflagged disagreement on the same function, contrary to the page's own §3 policy. Then the row itself was attacked: "four" mixed two rules, and the map's "six" **is** reconstructible | New M5 row — eleven branches; **three** read a key no tool declares, **six** can never run at a prompt; the map's sentence glues the two rules together and is incoherent either way. D4 restated on the six-branch rule, which now explains its `kind`/`decision` cases through D6 |
| "the assistant is told both, 120 characters apart" | The cited offsets 10 598 and 10 982 are 384 apart | 384, with the atlas's own 80-character self-contradiction noted |
| "the final scenario-10 run" | Two later scenario-10 runs exist; the thread described is from `00-20-23-609Z` | "the instrumented scenario-10 run (`00-20-23-609Z`)" |
| "six: **five** reads" in scenario 09 | Four reads are named, and four reads + one failed read + one view tool = the six | "four reads" |
| "Five cut against this page's own interest" | Six items followed | Six, eight after the second pass added the M5 reversal and the three over-stated restart claims, and ten after the third added the correction this page certified without applying and the D4/M5 arithmetic disagreement |
| "Batch 1 ran at 1024×768 and desktop 1600×1000" | One batch-1 scenario (05) had a tablet pass; the rest ran desktop only | Stated per scenario |
| "39 tools, 6 routes, 9 gates" | The map counts its gates twice and disagrees with itself: §1's orientation lists nine and ends with the declaration filter; §4 heads ten, dropping that and adding `isAssistantEditTool` and `checkProject` | New M6 row, with both readings stated; the "9" is no longer stated as the count |
| The offline assertion suite ran "against its own log" | Three of the five cases were pinned to earlier runs, not the runs this page cites — 11, 12 and 14. (10 has no dumpable archive in any run and its case is synthetic, which its own comment says.) Re-run against the cited runs, scenario 12's third mutation was **missed**: it rewrote one refused read, but the cited run refused that read twice, and the shipped assertion only requires *some* refusal to carry a recognized text | Suite re-pinned to the cited runs for 11/12/14 and the mutation rewritten to strip every refused read. All five now pass on the runs the page cites, all mutations throw, no control is rejected. The shipped scenario text is untouched, so the recorded `scenarioSha256` values still hold |
| "Repeated under a second name, same result" | Both close/relaunch pairs ran under `qa-live-10-ask-mode-deny`; no second session name is involved | "Repeated a second time under the same session name" |
| 21b "relaunched with the same session name and the same profile — a new daemon (PID 32024) and a new browser (PID 84336), both created after the close" | The run's own log carries **no** `launched browser` line, although the builder that made it requires one (`.temp/live-rig/build-21.mjs:23`); no PID appears in any run record, and the run reports carry no profile field at all. The sentence that replaced it then cited the `--profile` argument to `build-21.mjs:594-595` — a line that does not exist, in a file of 127 lines | The browser start now rests on the archived process table (`process-table.json`, written at close), the missing launch line is stated in the bullet, and the `--profile` argument is cited to this page's own reproduce block, while the process table is cited for what that argument *produced* — the record has no command-line field, only the resulting `userDataDir`, which for that browser is `.temp/live-rig/chrome-profile-restart`, the one entry not under `%LOCALAPPDATA%\Temp` |
| Bullet 1: "a reused name carries state only while its browser is still running" | Stated unconditionally, and bullet 4 is its counterexample — the `--profile` run found the sentinel after its browser had been closed | Qualified: true of the default profile only — **and the qualification did not reach the page in that pass**; see the row below for what it took |
| `21-restart-after-read.png` and `21-restart-after-ui.png` presented as two captures | Byte-identical — same sha256 `1b012ff9…`, same 145 572 bytes | The bullet says so, and gives the reason the second capture adds nothing |
| The default profile path printed as `%LOCALAPPDATA%Tempagent-browser-chrome-<guid>` | The builder wrote single backslashes inside a template literal, which drops them | Printed with separators, written as `&#92;` so escaping cannot eat them again |
| "offset 10 598 … in a 12 450-character brief" | Those are file offsets in the 12 450-character generated file; the `ASSISTANT_CONTEXT_BRIEF` literal it exports is 11 991 characters and the two texts sit at 10 142 and 10 526 inside it | Both frames given; 384 and 80 unchanged |
| "Scenario 09's accepted run is the only run of its scenario" | Three runs of that scenario exist — two aborted before sending with "No permission mode button: Read only" | "its last and only completed one", with the aborts named; the single-run scenario is 13 |
| "Scenario 10 has two later runs … kept as the leak-rate sample and the recount after them" | The recount is a third run, `00-30-16-967Z`, and it ran the planning-leak scenario | Both later runs are leak-rate samples; the recount is named as a scenario-20 run |
| "the instrumented scenario-10 run (00-20-23-609Z, the run whose DOM was captured)" | All three scenario-10 runs logged a DOM capture | "the one whose captured rows match its archive thread" |
| §5: "51 distinct files are cited, with 138 line references. Every file exists and every cited line is inside its file. One name, `contract.ts`, is shared by two files" | The check that backs this sentence walked only `src`, `scripts` and `src-tauri`, so a citation to a builder script under `.temp/live-rig` was not even a candidate for it — and the page was by then carrying `build-21.mjs:594-595`, in a file of 127 lines. The same check counted the six-row M table as five, because its regex opened on M1's own cell and counted what followed | The walk covers `.temp` as well; the out-of-range citation is gone; the counter reads six. The sentence now reports 51 files, 139 references, none unresolved and none past the end of its file, and names all four shared filenames rather than one |
| `process-table.json`'s printed summary: "temporary profile dirs seen: 18; still existing after close: 1" | The console line used a bare `/Temp/i` test, which also matches the repository's own `.temp/` — so it counted the persistent `--profile` directory as temporary and reported it as a temporary directory that had survived. The record written by the same run used a stricter predicate and said 17 and 17 | One predicate, used for both the console line and the record, so the two can no longer disagree: each pass's temporary directories under `%LOCALAPPDATA%\Temp` are counted and re-checked, and every one so far has gone after its browser closed — 17 of 17 in the first pass (that pass closed 18 browsers, and one of them, `qa-live-21-restart-real`, ran against the persistent `--profile` directory, so the strict predicate never counted it as temporary), 22 of 22 across the seven passes this campaign's own closes recorded — while the single persistent directory is still present |
| `sessionFileGone: false` read as "the close leaves the session file behind" | The first pass read the field in the instant the close returned, for all 18 sessions; by the time the record was read back those files were gone. In the second pass the same field was `false` and the first re-check 200 ms later found the file gone — the two checks are microseconds apart | `session-file-note.mjs` states the race in the record itself, and every close from the second pass on samples the file until it disappears. One source of truth for the wording: the cleanup and the patch that corrected the stored note both read that file |
| This record's row "Bullet 1 … Qualified: true of the default profile only" | The page had **not** been qualified. §2 still read "a reused name carries state *only while its browser is still running*" with no restriction, while §1's list certified that all three restart claims were "corrected in place in §2" — a correction announced and not applied, and one bullet 4 falsifies. The verifying pass found the claim and the text four sections apart | §2 carries the qualifier and names the persistent-`--profile` experiment as the exception; §1's list says the earlier version of itself claimed the correction before it was made; and the list carries the whole thing as its own item, because a reader cannot catch a correction that was announced and not applied |
| D4: "Four read keys no tool declares anywhere … `page` … `kind`/`decision`" | 4 + 1 + 2 = 7, one more than the six branches the same row had just named — and M5, three rows later, said **three** branches read such keys. D4 was counting keys and labelling them branches; three branches read four keys, because `:69` reads `reviewer` and `decidedBy` | The partition is stated as 3 + 1 + 2 with each branch's line number, and §1's list now carries the self-contradiction as its own item — **and the fix reached only the row's evidence cell**: the defect sentence kept its "four … the fifth" wording through two further passes while §1 certified that "D4 now reads 3 + 1 + 2". A fourth pass, comparing the two cells of the same row, closed it; the defect cell now reads three/fourth/last two, and §1's item records the half-application rather than only the final state |
| "Fifteen runs now exist under that session name … The twelve in between" | Sixteen logs exist under `qa-live-10-ask-mode-deny`, and the sixteenth is this campaign's own: closing that browser at the end of the sweep wrote `01-11-40-522Z` under the same session name. Still three launch lines and thirteen that print none | Sixteen and thirteen, with the added close run named and the reason the count moved stated in the bullet |
| §5: "13 headings, 66 table rows, 46 bullets, 25 numbered lines" | 66 was a hand count that folded the map's 4 header rows in with its body rows, so a reader counting the map's rows could not reproduce it — and unlike the other two mechanical checks, this one had no script behind it at all | The builder now counts each of the four quantities twice, from the markdown and from what it emitted, throws instead of writing the page when they disagree, and prints `13 headings, 4 tables with 62 body rows (66 rows including the header rows), 46 bullets, 25 numbered lines`; the bullet states the split and says the number is the builder's |
| **This campaign's own render run passed `--cdp 9222`** | The runner launches its own browser — every archived render log opens `[agent-browser] launched browser` — so the port override pointed the run at whatever was already listening on 9222 instead. The log carries a single line, `✗ Operation timed out`, on the scenario's first opcode (`set viewport`): no page of this campaign was opened, nothing under `proof/growth` was written by the run, and the only effect on the foreign target was a viewport request that itself timed out. It left a registered daemon with no Chrome child, `look-sweep-review10`, PID 83864 created 11:25:33 | The daemon was closed through the CLI `close` like every other session, and the scenario re-run without the flag: `2026-09-17T01-31-00-629Z-look-sweep-review10`, 22 commands, exit 0, 1.99 s. The record's pass list carries the orphaned pass; because `sessionsClosed` is keyed by session name, the successful run's entry replaced the orphan's, so the orphaned daemon is named here rather than in the record |
| "Second run, same name, seven seconds later" | The two scenario-19 runs are `00-24-35-797Z` and `00-24-42-130Z` — 6.333 s between their start times, and about 4.3 s between the first ending and the second starting | The two run ids are given and the gap is stated as six and a third seconds |
| "the persistent-`--profile` experiment two bullets later" (page, twice) | §2's list holds five bullets and the experiment is the fourth; it is three after the bullet that points at it, and "two" only works if the withdrawn-claim note is not counted as one. The §1 occurrence points out of its own list into §2's, where "two" and "three" are both readings | §2 says "three bullets later"; §1 says "the persistent-profile experiment in §2", naming the section instead of counting across lists |
| Page and record both: "the machine's own record of that argument is the browser's command line in `process-table.json`" | The record has no command-line field. Its browser objects carry `pid`, `name`, `created`, `userDataDir`, `stillAlive`, `dirStillExists`, and the only key in the whole file matching command/arg is `shutdownCommand`. The `--profile` argument is not in the record; what it produced is | Both now say the process table holds the directory the argument produced — `userDataDir` = `.temp/live-rig/chrome-profile-restart`, the one entry not under `%LOCALAPPDATA%\Temp` — and the argument itself is cited to the reproduce block |
| Page: "this page's own §6 certified as applied" (and the same attribution in this record) | The page has no §6: its numbered sections are 1–5 (`defects`, `campaign`, `map`, `gaps`, `reproduce`). The only "6." on it is the reproduced map's own section 6, about claims C1–C30. The restart certification is in §1's list | Both now say §1's list |
| Page: the two restart screenshots "filed for it" (for run `00-50-49-888Z`) | Both files are byte-identical at 145 572 bytes and `sha256 1b012ff9…`, as claimed — but both carry mtime `00:51:49`, and `00-51-48-501Z` runs the same 12-opcode 21b scenario, so the pair on disk was written a minute after the cited run by the corrected re-run that was made for the assertion bug | The byte-identity claim stands; the provenance is now stated, with the writing run named |
| This record: "every directory the record lists is gone" | False by twelve words: the same sentence says the one persistent `--profile` directory is still present, and the record lists it with `dirStillExists: true` | "every temporary directory the record lists is gone", with the persistent one named |
| This record: "the record counts … the two Chrome profile GUIDs" | The record has no GUID field. Its 21 GUID-shaped strings are all inside `browsers[*].userDataDir`; there is no pair of GUIDs anywhere in it | The row names the twenty-one `agent-browser-chrome-<guid>` directory names, which is what it meant |
| This record and the probe comment: the citation check "walks `src`, `scripts`, `src-tauri` and `.temp/live-rig`" | The code walks all of `.temp` — `probe-citations.mjs` line 30 — and always did; only its comment, and the sentence that copied the comment, said `live-rig`. That is also why the pre-change snapshots under `.temp/` appear as candidates | Both say `.temp`; the probe's comment records that the narrower wording was the source of the error |
| This record: "(18 of 18)" temporary profile directories, twice | Stale in both places, and contradicting this record's own summary two rows above: the count was 20 when the pass ran and is 22 now, because each close pass adds one and the first pass's 18 is not the whole record | The Limits row and the correction row both give the count and say it grows per pass — 17 of 17 in the first pass (one of its 18 browsers was the persistent-`--profile` restart run), 22 of 22 across this campaign's own seven passes |
| This record: "the record now stands at 36 sessions across 13 passes", its `summary` "reads 35 temporary profile directories", and "(18 of 18) … in the first pass" | Three readings of a file that keeps growing, found by an audit of the sibling proof bundle. The first two were true when written and were falsified by every pass since — the record holds 52 sessions across 27 passes, and 51 temporary profile directories — and the third was never true: that pass closed 18 browsers, one of them, `qa-live-21-restart-real`, against the persistent `--profile` directory, so the strict predicate counted 17. The correction cell two rows above had already said the record "said 17 and 17" while printing 18 in the same cell | The figures are time-scoped and name the summary fields they quote ("read here at 51 sessions across 25 passes, and it is larger than that by the time anyone checks"); both first-pass counts read 17 of 17 and say why the pass closed 18 browsers. Made by the audit recorded in `../2026-09-17-defect-fixes/README.md` |
| This record: "its summary counts 22 temporary profile directories all gone", "its twenty-two `agent-browser-chrome-<guid>` names" and "the temporary profile directory is gone after its browser closes (22 of 22)" | The campaign's own subset printed as the record's `summary`: 22 and 23 are this campaign's figures across its own seven passes (23 sessions, 22 temporary directories, 1 persistent), while `summary` covers every pass in the file and reads 50 of 50 — the construction the row two above already calls out, in three more places, against a file that grows with every pass | Each of the three is scoped to this campaign's own closes, with the file's `summary` quoted beside it at a named reading (50 of 50). The two rows these were written into had been split across lines mid-cell by the edit that wrote them, which ends a markdown table row; they are single rows again |

Logs, reports and the runner's own copy of each scenario are in `../runner/`; screenshots are in
`../../../screenshots/growth/`.

## Builders

- `.temp/live-rig/build-review-page.mjs` — converts `assistant-map.md` and the hand-written live
  sections into `index.html`. Re-run it after editing the map. It counts the map's headings, table
  rows, bullets and numbered lines twice — once from the markdown, once from what it emitted — and
  throws instead of writing the page when the two disagree, so §5's map-reproduction numbers are
  printed by the build rather than counted by hand.
- `.temp/live-rig/build-19.mjs`, `build-20.mjs`, `build-look.mjs` — the scenario builders for the
  harness facts and the page render check.
- `.temp/live-rig/run-assertions-offline.mjs` — executes every archive-only assertion against its
  own runner log, plus mutations that must throw and controls that must not, so an over-eager
  assertion cannot pass unnoticed.
- `.temp/live-rig/close-campaign-browsers.mjs` — the owned-process cleanup. It reads the process
  table for the sessions this campaign created (`qa-*`, `look-sweep-*`), checks each daemon's PID,
  creation time and executable, ends each browser through the CLI's own `close` rather than a kill,
  and writes `process-table.json`. Dry run by default; `--apply` acts. A later pass appends the
  sessions started after the previous one instead of replacing the record.
- `.temp/live-rig/session-file-note.mjs` — the one copy of the wording the cleanup record uses for the
  session-file race, read by the cleanup and by `patch-record-note.mjs`, so a stored note and the note
  the next run would write cannot drift apart.
- `.temp/live-rig/probe-citations.mjs`, `probe-page-corrections.mjs`, `probe-record-consistency.mjs`,
  `probe-brief-encoding.mjs`, `probe-s2-bullets.mjs` — the read-only checks behind the page's §5. The
  first is the one whose
  blind spot is recorded above: it
  walks `src`, `scripts`, `src-tauri` and `.temp` — the whole of `.temp`, so the pre-change snapshots
  under it are candidates like any other file — and its own counter had to be fixed. The third exists
  because the fourth verify pass attacked this record's internal consistency and found four places
  where it contradicted itself or the page: it reads every count the record states about the process
  table and the logs back out of `process-table.json` and `proof/growth/runner/`, so the same drift
  fails a check instead of waiting for a reader. The fifth prints §2's bullets in order and every
  occurrence of the pointer phrase the pass found miscounted, so that a distance between two bullets
  is a reading rather than a claim.
- `.temp/live-rig/archive-pass4.mjs` — writes the fourth verify pass out of its workflow journal into
  `verify-pass-4.json` beside the page it audited. It counts a finding as confirmed only where a
  refuter's verdict says so and lists the rest as pending, so the totals in that file cannot claim
  more than the run actually returned; the file was re-written once the last verdict arrived.

## Process record

Checked at the end of the campaign, per the project's process rule.

| Process | State | Identity check |
| --- | --- | --- |
| Dev server, isolated origin `127.0.0.1:8085` | **retained** | PID 50804, `node.exe`, `vite.js dev --host 127.0.0.1 --port 8085 --strictPort`, created 2026-09-16 20:48:04 +10:00 — all three matched the record before this check. Kept because scenarios and page renders still need it. |
| User-facing preview on `:8080` | **untouched** | Not owned by this campaign. |
| Batch-2 sequential runner, PID 45248 | **already exited** | Recorded in `.temp/live-rig/batch2-owned.json` as `run-batch2.mjs 10-ask-mode-deny`, created 2026-09-17 00:20:23Z. Verified GONE at this check; no stop was issued. The record file is kept as the record rather than deleted. |
| CDP browsers launched per scenario | **left running by the runner, and that is what the restart finding turned on** | An earlier version of this row said the runner closed each browser it launched. It does not: a run attaches to the browser its session name points at if one is still alive, and `launched browser` is printed only when it had to start one. The proof is in the logs — sixteen runs under `qa-live-10-ask-mode-deny` and three launch lines, the first run of the name and the two relaunches this session made deliberately. Browsers are ended only by an explicit `["close"]` (see the close runs in the table above), which is what the restart test uses. |
| This campaign's own CDP sessions — 23 in all | **ended, in seven passes, each through that CLI `close`** | Pass one closed the 18 sessions the campaign had run (`qa-*`, `look-sweep-*`); the later passes closed the page-render session started after each of the five later builds, and one daemon orphaned by a mis-flagged run of that same render scenario. Every close reported exit 0, its daemon gone and its Chrome gone; `process-table.json` carries the PIDs, creation times and executables that were re-read before each one, and this campaign's own closes left 22 temporary profile directories, all 22 gone, with the one persistent `--profile` directory still present — the file's own `summary`, which counts every pass in it rather than this campaign's seven, reads 51 temporary profile directories, all 51 gone, at the reading recorded above. The three sessions this campaign did not create (`ghl-brief`, `looplet-qa`, `smoke`) were listed and left alone, and are still registered. Three agent-browser Chrome browsers are still running on this machine, and **none** of their profile directories appears anywhere in the record — every temporary directory the record lists is gone (the one persistent directory it lists, `.temp/live-rig/chrome-profile-restart`, is the restart test's and is still there) — which is how the campaign's own are told apart from what is left. That they belong to those three sessions is inference, not a reading: their parent processes are `explorer.exe` (two of them) and a PID that has since exited, not the three registered daemons. |

## Limits

- One provider (MiniMax-M3 through the app's own adapter). Nothing here is a statement about any
  other model.
- The restart experiment rests on two kinds of evidence, and they are not the same tier. Archived in
  the run records: the `launched browser` line, the `✓ Browser closed` line, the scenario sha256 shared
  by the pre-close and post-close runs, the archive counts before and after, and the sentinel found on
  the far side. Archived in `process-table.json` — machine-read, but written at close rather than
  during the run, so it is evidence of the machine's state and not part of the run's own record: the
  daemon PIDs with their creation times and executables, the browser PIDs, the profile directory each
  browser was launched against, and whether that directory survived the close — the profile directory
  is the only identifier in the record, and the `agent-browser-chrome-<guid>` names this campaign's own closes left in it — 22 of them — are
  what the "GUIDs" in an earlier version of this row meant. That archive also carries one thing no log
  holds: the temporary profile directory is gone after its browser closes — 22 of 22 across this campaign's own closes, and 51 of 51 in the file's `summary` at the reading above — while the
  `--profile` directory used for the restart test is still there.
- Synthetic QA fixtures only; no customer drawing, quantity or price.
- Desktop and tablet widths; phones excluded by project instruction.
- The map half is a **source reading** — the map executed nothing. Its own closing section says so.
- The planning-leak defect was observed **once in five attempts**. Two further runs made to test a
  suspected trigger did not reproduce it, and the trigger itself was then eliminated against the
  source — the proposed mechanism cannot happen. There is no candidate trigger and no usable rate.
