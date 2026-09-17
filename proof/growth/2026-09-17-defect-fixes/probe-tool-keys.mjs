/**
 * D4's executed evidence, post-fix.
 *
 * Read-only: builds the real tool catalogue and prints, for every tool, the top-level property names
 * its inputSchema declares, against the three classifications the fix introduced and against every
 * key `describeToolIntent` reads.
 *
 * The pre-fix probe (`.temp/live-rig/probe-tool-keys.mjs`) read a hard-coded list containing
 * `sheetIndex`, `page`, `reviewer`, `decidedBy` and `knownDistanceM` and printed "(NOTHING)" beside
 * each - prompt branches that could never fire. This one reads `INTENT_KEYS` from the module that
 * ships, so the list and the branches cannot drift apart again, and prints who declares each.
 *
 * Run: node proof/growth/2026-09-17-defect-fixes/probe-tool-keys.mjs
 */
import { createDefaultJob } from "../../../src/studio/domain.ts";
import { createAppTools } from "../../../src/studio/assistant/appTools.ts";
import { isAssistantEditTool, isAssistantEffectfulTool, isAssistantGatedTool } from "../../../src/studio/assistant/skills.ts";
import { INTENT_KEYS, TOOL_TITLES } from "../../../src/studio/assistant/permissions.ts";

const job = createDefaultJob();
const state = {
  job, pane: "sheets", sheet: 0, hydrationStatus: "ready", persistenceHydrated: true,
  persistenceRecoveryBlocked: false, persistenceError: null, lastSavedJobRevision: job.revision,
  setPane() {}, saveCurrentProject() { return { ok: true, error: null }; },
};
const port = {
  getState: () => state,
  architect: async () => ({ pendingDraft: false, project: null }),
  architectAvailable: () => false,
  capture: async () => ({ content: [{ type: "image", mimeType: "image/png", data: "x" }] }),
  draftsman: async () => ({ ok: true }),
  draftsmanAvailable: () => true,
};

const tools = createAppTools(port);
const declared = new Map(tools.map((tool) => [tool.name, Object.keys(tool.inputSchema?.properties ?? {})]));
const classOf = (name) => (isAssistantEditTool(name) ? "EDIT" : isAssistantEffectfulTool(name) ? "EFFECT" : "read");

console.log(`${tools.length} tools in the catalogue.\n`);
for (const [name, keys] of [...declared].sort()) {
  console.log(`${classOf(name).padEnd(7)}${isAssistantGatedTool(name) ? "GATED " : "      "}${name.padEnd(34)} ${keys.join(", ")}`);
}

const gated = [...declared.keys()].filter(isAssistantGatedTool);
const effect = [...declared.keys()].filter(isAssistantEffectfulTool);
console.log(`\ngated (must be judged by the permission mode): ${gated.length}`);
console.log(`  project edits: ${gated.filter(isAssistantEditTool).length}`);
console.log(`  effectful non-edits: ${effect.length} - ${effect.join(", ")}`);
console.log(`  effectful tools that are ALSO edits (must be none): ${effect.filter(isAssistantEditTool).join(", ") || "(none)"}`);
console.log(`read-only tools: ${[...declared.keys()].filter((n) => !isAssistantGatedTool(n)).length}`);

console.log("\n=== every key describeToolIntent reads, and who declares it ===");
let dead = 0;
for (const key of INTENT_KEYS) {
  const owners = [...declared].filter(([, keys]) => keys.includes(key)).map(([name]) => name);
  const gatedOwners = owners.filter(isAssistantGatedTool);
  if (!gatedOwners.length) dead += 1;
  console.log(`${key.padEnd(18)} declared by ${owners.length ? owners.join(", ") : "(NOTHING)"}`);
  console.log(`${"".padEnd(18)}   …of which gated: ${gatedOwners.length ? gatedOwners.join(", ") : "(none)"}`);
}
console.log(`\nbranches that can never fire (declared by no gated tool): ${dead}`);
console.log(`gated tools with no user-facing title (must be none): ${gated.filter((name) => !TOOL_TITLES[name]).join(", ") || "(none)"}`);
console.log(`titles with no gated tool (dead rows, must be none): ${Object.keys(TOOL_TITLES).filter((name) => !isAssistantGatedTool(name)).join(", ") || "(none)"}`);

const editOnly = gated.filter((name) => !isAssistantEditTool(name));
console.log(`\n=== gated tools that are NOT project edits (D5/D8's new class) ===`);
for (const name of editOnly) console.log(`${name.padEnd(34)} "${TOOL_TITLES[name]}"`);

/* Every reading above is also an assertion. A probe that only prints cannot fail, and a check that cannot
   fail establishes nothing: this file set no exit code at all until an audit pointed out that the note
   called it "stricter than a unit test" while it was the one executable in the bundle that could not
   disagree with anything. Three of the ten readings are the invariants `permissions.test.ts` already
   asserts (key coverage, a title for every gated tool, no title without one); the counts, the effectful
   class and the dead-row emptiness are what this probe adds to it, and they are pinned to the figures the
   note states, so a catalogue that moves fails here rather than making the note quietly wrong. */
const failures = [];
const expect = (what, got, want) => { if (got !== want) failures.push(`${what}: ${got}, expected ${want}`); };
const readOnly = [...declared.keys()].filter((n) => !isAssistantGatedTool(n));
expect("tools in the catalogue", tools.length, 38);
expect("gated tools", gated.length, 17);
expect("gated tools that are project edits", gated.filter(isAssistantEditTool).length, 12);
expect("gated tools that are not edits (the effectful class)", editOnly.length, 5);
expect("effectful tools", effect.length, 5);
expect("read-only tools", readOnly.length, 21);
expect("effectful tools that are also edits", effect.filter(isAssistantEditTool).length, 0);
expect("prompt branches that can never fire", dead, 0);
expect("gated tools with no user-facing title", gated.filter((n) => !TOOL_TITLES[n]).length, 0);
expect("titles with no gated tool", Object.keys(TOOL_TITLES).filter((n) => !isAssistantGatedTool(n)).length, 0);

const checked = 10;
console.log(`\n${failures.length ? `FAIL\n- ${failures.join("\n- ")}` : `PASS — ${checked} of ${checked} readings are the ones the note states.`}`);
process.exitCode = failures.length ? 1 : 0;
