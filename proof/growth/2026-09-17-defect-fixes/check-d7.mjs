/**
 * D7's executed evidence.
 *
 * Asserts, against the generated file that ships and against the atlas source it is built from, that the
 * manual carries the shipped execution defaults and that the superseded pair is absent from both, and
 * reports the brief's length against its ceiling.
 *
 * Run: node proof/growth/2026-09-17-defect-fixes/check-d7.mjs
 */
import fs from "node:fs";
import { ASSISTANT_CONTEXT_BRIEF } from "../../../src/studio/assistant/contextManual.gen.ts";
import { DEFAULT_EXECUTION_BUDGET } from "../../../src/studio/assistant/executionBudget.ts";

const CEILING = 12_000;
const superseded = ["Twelve rounds per send", "Twenty-four tool calls per send"];
const source = fs.readFileSync(new URL("../../../src/studio/assistant/context/skills-atlas.md", import.meta.url), "utf8");

for (const phrase of superseded) {
  console.log(`${phrase.padEnd(34)} in brief: ${ASSISTANT_CONTEXT_BRIEF.includes(phrase)} | in atlas: ${source.includes(phrase)}`);
}
const wanted = [`${DEFAULT_EXECUTION_BUDGET.maxRounds} rounds per send`, `${DEFAULT_EXECUTION_BUDGET.maxToolCalls} tool calls per send`];
for (const phrase of wanted) console.log(`${phrase.padEnd(34)} in brief: ${ASSISTANT_CONTEXT_BRIEF.includes(phrase)}`);
console.log(`\nbrief length: ${ASSISTANT_CONTEXT_BRIEF.length} of a ${CEILING} ceiling — ${CEILING - ASSISTANT_CONTEXT_BRIEF.length} characters of headroom.`);
console.log(`rounds per send: ${ASSISTANT_CONTEXT_BRIEF.match(/(\d+) rounds per send/)?.[0] ?? "(no match)"}`);
console.log(`tool calls per send: ${ASSISTANT_CONTEXT_BRIEF.match(/(\d+) tool calls per send/)?.[0] ?? "(no match)"}`);
console.log(`shipped defaults: ${DEFAULT_EXECUTION_BUDGET.maxRounds} rounds, ${DEFAULT_EXECUTION_BUDGET.maxToolCalls} tool calls`);
/* Both halves of the claim the note and the page make — the superseded pair absent from the brief *and*
   from the atlas — are asserted. The atlas half used to be printed and then dropped: `failures` was built
   from the brief alone, so a superseded figure that had survived in the atlas source would have printed
   `in atlas: true` and the check would still have exited 0. */
const failures = superseded.filter((phrase) => ASSISTANT_CONTEXT_BRIEF.includes(phrase) || source.includes(phrase))
  .concat(wanted.filter((phrase) => !ASSISTANT_CONTEXT_BRIEF.includes(phrase)));
console.log(failures.length ? `\nFAIL: ${failures.join(" / ")}` : "\nPASS: the brief states the shipped defaults, and the superseded pair is absent from the brief and from the atlas source.");
process.exitCode = failures.length ? 1 : 0;
