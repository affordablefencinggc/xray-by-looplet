import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ASSISTANT_OPERATING_MANUAL,
  ASSISTANT_SAFETY_MANUAL,
  ASSISTANT_SKILLS,
  assistantToolAllowed,
  isAssistantEditTool,
  isAssistantEffectfulTool,
  isAssistantGatedTool,
} from "./skills.ts";
import { ASSISTANT_CONTEXT_BRIEF } from "./contextManual.gen.ts";
import { joinManualSections, normaliseManualMarkdown } from "./manualNormalise.ts";
import { DEFAULT_EXECUTION_BUDGET } from "./executionBudget.ts";

// [SC-22 context] begin
/** The fixed composition order both platforms must use (build-assistant-context.mjs). */
const SECTIONS = ["README.md", "app-atlas.md", "skills-atlas.md", "budgets.md", "user.md"];
const nativeSource = () =>
  fs.readFileSync(new URL("../../../src-tauri/src/assistant_ai.rs", import.meta.url), "utf8");

// The old assertion read SYSTEM_INSTRUCTION as one source literal. The native side now composes
// it from include_str! at compile time, so there is no literal to parse; parity is proved by
// rebuilding the same composition from the same inputs and comparing the parts the two sources
// still hold verbatim.
test("the composed manual is the safety rules followed by the authored context brief", () => {
  const composed = SECTIONS.map((name) =>
    normaliseManualMarkdown(
      fs.readFileSync(new URL(`./context/${name}`, import.meta.url), "utf8"),
    ),
  );
  assert.equal(`${ASSISTANT_SAFETY_MANUAL} ${joinManualSections(composed)}`, ASSISTANT_OPERATING_MANUAL);
  // An append, not a substitution: WIRING.md records that 20 of the 21 safety clauses appear
  // nowhere in the brief, so a substitution would ship without them.
  assert.ok(ASSISTANT_OPERATING_MANUAL.startsWith(ASSISTANT_SAFETY_MANUAL));
  assert.ok(ASSISTANT_OPERATING_MANUAL.length > ASSISTANT_SAFETY_MANUAL.length);
});

test("the native brief includes the same five sections in the same order", () => {
  const native = nativeSource();
  const positions = SECTIONS.map((name) => {
    const include = `include_str!("../../src/studio/assistant/context/${name}")`;
    const at = native.indexOf(include);
    assert.notEqual(at, -1, `assistant_ai.rs does not include ${name}`);
    return at;
  });
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(
      positions[i] > positions[i - 1],
      `${SECTIONS[i]} is included before ${SECTIONS[i - 1]}`,
    );
  }
});

// Reading the file as text cannot observe what SYSTEM_INSTRUCTION evaluates to, so the tests
// above pass unchanged when the composition at assistant_ai.rs:53-61 collapses to a bare brief
// and leaves SAFETY_MANUAL dead. The crate's own guard
// (assistant_ai.rs, system_instruction_appends_the_brief_to_the_safety_manual) proves the value;
// this asserts the shape a text reader can still see, so substitution is caught here too.
test("the native composition appends the brief to the safety manual with one space", () => {
  const native = nativeSource();
  assert.match(
    native,
    /format!\("\{SAFETY_MANUAL\} \{brief\}"\)/,
    "assistant_ai.rs no longer joins SAFETY_MANUAL and brief with exactly one space",
  );
  // The section join is the same single space (manualNormalise.ts joinManualSections); two
  // spaces there would break the no-double-space invariant the ceiling test leans on.
  const composition = native.slice(
    native.indexOf("static SYSTEM_INSTRUCTION"),
    native.indexOf("// [SC-22 context] end"),
  );
  assert.ok(composition.length > 0, "the SYSTEM_INSTRUCTION composition block is missing");
  assert.match(
    composition,
    /\.join\(" "\);?\s*$|\.join\(" "\)\s*;/m,
    "the native section join is not a single space",
  );
  for (const separator of composition.match(/\.join\("[^"]*"\)/g) ?? []) {
    assert.equal(separator, '.join(" ")', "a native join separator is not a single space");
  }
});

test("web and native providers hold identical safety rules", () => {
  const literal = nativeSource().match(/const SAFETY_MANUAL: &str = (".*");/)?.[1];
  assert.ok(literal);
  assert.equal(JSON.parse(literal), ASSISTANT_SAFETY_MANUAL);
});
// [SC-22 context] end

test("effectful non-edits are classified apart from reads and from project edits", () => {
  for (const name of ["navigate_workspace", "show_design_in_model", "hide_designed_model", "control_draftsman", "generate_render_visualisation"]) {
    assert.equal(isAssistantEffectfulTool(name), true, name);
    assert.equal(isAssistantGatedTool(name), true, name);
    // Deliberately NOT edits: edit membership drives the record-changing readers — the context
    // handover's state-changing list, the packet's refusal, the runtime's pre-flight and the `edits`
    // alias — so adding these five would put a pane move into that bookkeeping. Declaration is not
    // the reason: assistantToolAllowed tests VIEW_TOOLS first, and the assertion below is what says
    // the model's tool list is unchanged either way.
    assert.equal(isAssistantEditTool(name), false, name);
    assert.equal(assistantToolAllowed(name, false), true, name);
  }
  for (const name of ["read_project_context", "capture_workspace_image", "read_source_sheets"]) {
    assert.equal(isAssistantEffectfulTool(name), false, name);
    assert.equal(isAssistantGatedTool(name), false, name);
  }
  for (const name of ["draw_architect_elements", "save_project"]) {
    assert.equal(isAssistantEffectfulTool(name), false, name);
    assert.equal(isAssistantGatedTool(name), true, name);
  }
});

test("the brief carries the shipped execution defaults and not the superseded pair", () => {
  // The manual is re-sent on every round, so a stale figure here contradicts budgets.md inside the
  // same string and is read by the model as the real limit.
  assert.doesNotMatch(ASSISTANT_CONTEXT_BRIEF, /Twelve rounds per send|Twenty-four tool calls per send/);
  assert.match(ASSISTANT_CONTEXT_BRIEF, new RegExp(`${DEFAULT_EXECUTION_BUDGET.maxRounds} rounds per send`));
  assert.match(ASSISTANT_CONTEXT_BRIEF, new RegExp(`${DEFAULT_EXECUTION_BUDGET.maxToolCalls} tool calls per send`));
});

test("drawing edits and save require explicit permission; new or destructive tools fail closed", () => {
  for (const name of ["draw_architect_elements", "undo_architect_change", "save_project"]) {
    assert.equal(assistantToolAllowed(name, false), false);
    assert.equal(assistantToolAllowed(name, true), true);
  }
  for (const name of [
    "delete_project",
    "approve_quote",
    "set_calibration",
    "send_email",
    "new_unknown_tool",
  ]) {
    assert.equal(assistantToolAllowed(name, false), false);
    assert.equal(assistantToolAllowed(name, true), false);
  }
  for (const name of [
    "read_project_context",
    "navigate_workspace",
    "web_search",
    "control_draftsman",
  ]) {
    assert.equal(assistantToolAllowed(name, false), true);
  }
});

test("skills expose usable editable workflows and retain evidence limits", () => {
  assert.equal(new Set(ASSISTANT_SKILLS.map((s) => s.name)).size, ASSISTANT_SKILLS.length);
  assert.ok(ASSISTANT_SKILLS.every((s) => s.prompt.length && s.detail.length));
  assert.match(
    ASSISTANT_SKILLS.find((s) => s.name === "Check takeoff readiness")!.prompt,
    /two-point calibration/,
  );
});
