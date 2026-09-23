# V1 finish — handoffs

Work these in order. Each file is self-contained: goal, starting state, numbered steps, exit check and proof. The plan and dates are in `FINISH-LINE.md` (repo root).

| # | Handoff | Dates | Needs from Daniel |
|---|---|---|---|
| 00 | [Ledger hygiene and scope freeze](00-ledger-hygiene.md) | Thu 24 Sep | Scope-freeze confirmation |
| 01 | [Stability blockers](01-stability.md) | 25–30 Sep | — |
| 02 | [Industry worksheets closeout](02-industry-worksheets.md) | 1–12 Oct | HVAC SC-12 velocity ruling (by 30 Sep) |
| 03 | [Fencing and estimating chain](03-fencing-estimating.md) | 13–22 Oct | Gate hardware prices (9 Oct), a real fence job (16 Oct) |
| 04 | [Everyday workspace and recovery](04-workspace-recovery.md) | 23 Oct–3 Nov | — |
| 05 | [Assistant reliability](05-assistant.md) | 4–10 Nov | — |
| 06 | [Release](06-release.md) | 11–18 Nov | Code-signing certificate (order by 25 Sep), clean Windows VM (10 Nov) |

## Rules that apply to every handoff

1. Read `AGENTS.md`, `AGENTS.project.md`, `.agents/skills/ledger/SKILL.md`, `.agents/skills/xray-engine/SKILL.md` and `.agents/skills/fast-cdp-testing/SKILL.md` first.
2. **Done** means an exact code diff plus executed or inspected proof under `proof/growth/<date>-<topic>/`. That proof is a runner report, test log, inspected screenshots and a README. A visible button or a green build is not proof.
3. Stage explicit paths only (`git add --pathspec-from-file`); never `git add -A`. Every commit message carries `# checkpoint: <topic-name>`; invent the name from the topic. Push only with Daniel's approval.
4. Scan every changed file for `.env.local` secrets before committing (the snippet is in each proof README from 2026-09-23).
5. Stop owned test processes within 10 minutes of last use, closing by identity-checked PID only. Never touch Daniel's installed app while it is running.
6. Scope is tablet, laptop and desktop only; no phones.
7. When a section passes its exit check, tick its items in the source TODO or ledger with proof links, then update `FINISH-LINE.md` status.

## Shared toolkit (proven 23 Sep 2026)

1. **Unit tests.** `npm run test:src` fails on Windows with "The command line is too long". Run the same files directly:
   `node --experimental-strip-types --test $(node -e "const s=require('./package.json').scripts['test:src'];console.log([...s.matchAll(/\S+\.test\.ts/g)].map(m=>m[0]).join(' '))")`
   Rust: `cd src-tauri && cargo test --release`. Types: `npx tsc --noEmit`.
2. **Dans1 build with the qualified engine.** Copy `package-web.mjs`, `package-native.mjs` and `orchestrate.mjs` from `proof/growth/2026-09-23-tidy-up/` into your stage folder and replace the path in each. Then run, with `PATH` starting `/c/Windows/System32` for bsdtar:
   - `node package-web.mjs`
   - `node package-native.mjs`
   - `node orchestrate.mjs transfer`
   - `node orchestrate.mjs build`
   - `node orchestrate.mjs collect`

   The engine package is `C:\Users\danie\XRayBuilds\industry-visible-20260913\native-engine-selected-20260913` (SHA-256 `e4693d8f…`). The run ID comes from the web source only; if only native code changed, rename the old Dans1 `runs\<id>` and `incoming\<id>` folders (to keep them) before rebuilding.
3. **Native QA.** `launch.mjs` in the same folder starts a Dans1 exe in a fresh isolated profile with loopback CDP. `run.sh <name>` streams a JSON scenario through `scripts/fast-cdp-test.mjs`, and `setfield.js` sets React inputs by label. The fence setup scenarios are e1-setup, e2-fence, e3-bom, p1-import and p2-map in `proof/growth/2026-09-23-quote-handover/scenarios/`. They load Redburn sheet 12 at 1:250, trace a fence with a 2 m double gate, build the BOM, import the AFGC rates and map the materials.
4. **Native dialogs** (folder picker, confirm) can be driven with Windows UI Automation or Win32 by the dialog's HWND; see the quote-handover README.
5. **Install.** Check the setup hash, confirm the user app is closed, run `setup.exe /S`, then `cmp` the installed exe with the tested one: only a 3-byte bundle marker should differ.
