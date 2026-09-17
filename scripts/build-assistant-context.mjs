#!/usr/bin/env node
/**
 * Compose the authored assistant context Markdown into the generated system-instruction
 * brief, for both platforms, and prove the two platforms produce the same bytes.
 *
 *   node scripts/build-assistant-context.mjs           write the generated module
 *   node scripts/build-assistant-context.mjs --check    verify only; exit 1 if stale
 *
 * Why generation rather than a runtime read: `?raw` and `import ... with { type: "text" }`
 * both throw ERR_UNKNOWN_FILE_EXTENSION for .md under `node --experimental-strip-types`,
 * and five modules import skills.ts under bare Node (contextBudget.ts, permissions.ts,
 * skills.test.ts, wireframe.test.ts, workbenchTools.test.ts). A raw import would typecheck
 * and bundle, then break four unrelated suites. Generated TypeScript is the only mechanism
 * that works in Vite and in bare Node alike.
 *
 * The native side reaches the same bytes through include_str!, already the established
 * pattern in this crate (src-tauri/src/material_ai.rs:54,59). This script does not edit
 * assistant_ai.rs; it verifies that the Markdown on disk is safe for that path and that a
 * transcription of the Rust normalisation rule yields byte-identical output, so the parity
 * assertion in skills.test.ts cannot be broken by a source file this script accepted. It runs
 * no Rust: what the crate's composition actually produces is proved by
 * system_instruction_appends_the_brief_to_the_safety_manual under cargo test.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  joinManualSections,
  manualBriefProblem,
  normaliseManualMarkdown,
} from "../src/studio/assistant/manualNormalise.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTEXT_DIR = join(ROOT, "src", "studio", "assistant", "context");
const OUTPUT = join(ROOT, "src", "studio", "assistant", "contextManual.gen.ts");
const NATIVE = join(ROOT, "src-tauri", "src", "assistant_ai.rs");

/**
 * Fixed composition order. The brief is one string, so order is meaning: guardrails and the
 * routing table first, the atlases the router points into next, the budgets that bound a
 * turn, then the user's own standing facts last so they qualify everything above them.
 * This list is the contract the Rust side must include_str! in the same order.
 */
const SECTIONS = ["README.md", "app-atlas.md", "skills-atlas.md", "budgets.md", "user.md"];

/**
 * Ceiling on the composed brief, and the budget it is measured against.
 *
 * The instruction is injected out of band (src/lib/assistantAi.server.ts, assistant_ai.rs:283)
 * and re-sent on all eight rounds of every send, and measureContext counts none of it
 * (contextBudget.ts), so growth here is both paid eight times and invisible to the meter.
 * That is why the cost is printed on every run rather than only when the gate trips.
 *
 * BUDGET_TOKENS is the figure the architecture decision published; the ceiling is set higher
 * so the gate catches runaway growth without blocking authoring that is merely over the
 * estimate. Characters convert at the same four-per-token rate measureContext uses
 * (contextBudget.ts:26), so the two numbers are comparable.
 */
const BUDGET_TOKENS = 1600;
const MAX_BRIEF_CHARS = 12000;

/** Reads one section, refusing anything that would make the two normalisers disagree. */
export function readSection(dir, name, { read = readFileSync } = {}) {
  const path = join(dir, name);
  let text;
  try {
    text = read(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { name, path, error: `missing source file: ${path}` };
    }
    throw error;
  }
  // include_str! embeds the file's bytes verbatim and str::from_utf8 rejects a BOM as
  // content, so a BOM would survive into the Rust literal as U+FEFF while JSON.parse of the
  // JS side would not see it. Refuse it rather than silently strip it on one side only.
  if (text.charCodeAt(0) === 0xfeff) {
    return { name, path, error: `${name} starts with a byte-order mark; save it as plain UTF-8` };
  }
  const normalised = normaliseManualMarkdown(text);
  // An empty section normalises to "" and passes every other check, so the brief would compose one
  // section short with exit 0. A section that carries no content is a build failure.
  if (normalised.length === 0) {
    return { name, path, error: `${name} is empty after normalisation; a section must carry content` };
  }
  const problem = manualBriefProblem(normalised);
  if (problem) return { name, path, error: `${name}: ${problem}` };
  return { name, path, text, normalised };
}

/**
 * Reproduces, statement for statement, what the Rust normaliser documented in
 * manualNormalise.ts produces over include_str!:
 *
 *   text.split('\n')
 *       .map(|l| l.split_ascii_whitespace().collect::<Vec<_>>().join(" "))
 *       .filter(|l| !l.is_empty())
 *       .collect::<Vec<_>>().join(" ")
 *
 * It is written out longhand rather than calling normaliseManualMarkdown so the comparison
 * between the two implementations is a real comparison and not a tautology. Splitting on
 * '\n' alone is sufficient because split_ascii_whitespace then discards the trailing '\r'
 * of a CRLF line as a separator.
 */
export function rustNormaliseEquivalent(text) {
  const out = [];
  for (const line of text.split("\n")) {
    // split_ascii_whitespace splits on [\t\n\f\r ] and yields no empty fields, so joining its
    // output with one space is the collapse and the trim in a single step. U+000B is excluded
    // because Rust's ASCII whitespace set does not contain it, unlike JavaScript's \v; a
    // vertical tab therefore stays inside a word here, exactly as it does in
    // src-tauri/src/assistant_ai.rs:39-45, and is caught downstream by manualBriefProblem.
    const words = line.split(/[\t\n\f\r ]+/).filter((word) => word.length > 0);
    const collapsed = words.join(" ");
    if (collapsed.length > 0) out.push(collapsed);
  }
  return out.join(" ");
}

/** Composes the brief and checks every invariant the two platforms depend on. */
export function composeBrief(dir, { read = readFileSync } = {}) {
  const errors = [];
  const sections = [];
  for (const name of SECTIONS) {
    const section = readSection(dir, name, { read });
    if (section.error) {
      errors.push(section.error);
      continue;
    }
    // The native path is include_str! into a Rust source; the byte sequence the Rust
    // normaliser sees is the file's bytes, so run the Rust-equivalent rule over the same
    // text and require the two results to match before either is used.
    const viaRust = rustNormaliseEquivalent(section.text);
    if (viaRust !== section.normalised) {
      errors.push(`${name}: the JS and Rust normalisers disagree; the section is not portable`);
      continue;
    }
    sections.push(section);
  }
  if (errors.length > 0) return { errors };
  const brief = joinManualSections(sections.map((section) => section.normalised));
  const problem = manualBriefProblem(brief);
  if (problem) return { errors: [`composed brief: ${problem}`] };
  // A triple backtick that begins a line opens a code fence in the Markdown source; the
  // manual's own ```mindmap reference must stay mid-line to survive authoring unchanged.
  if (/(^|\n)\s*```/.test(sections.map((section) => section.text).join("\n"))) {
    return { errors: ["a line starts with ```; keep fenced-block references mid-line"] };
  }
  if (brief.length > MAX_BRIEF_CHARS) {
    return {
      errors: [
        `composed brief is ${brief.length} characters, over the ${MAX_BRIEF_CHARS} ceiling; `
          + "the instruction is re-sent on all eight rounds and measureContext counts none of it",
      ],
    };
  }
  return { brief, sections };
}

/** Renders the generated module. One JSON.stringify'd literal, so it parses as ASCII TS. */
export function renderModule(brief, names = SECTIONS) {
  return [
    "// Generated file, do not edit.",
    "// Written by scripts/build-assistant-context.mjs from src/studio/assistant/context/:",
    ...names.map((name) => `//   ${name}`),
    "// Edit that Markdown and re-run the script; a hand edit here is overwritten and breaks",
    "// byte parity with SYSTEM_INSTRUCTION in src-tauri/src/assistant_ai.rs, which",
    "// src/studio/assistant/skills.test.ts asserts.",
    `export const ASSISTANT_CONTEXT_BRIEF = ${JSON.stringify(brief)};`,
    "",
  ].join("\n");
}

/**
 * Reports whether the native source can produce these bytes, without editing it.
 *
 * The crate composes SYSTEM_INSTRUCTION from include_str! at runtime (assistant_ai.rs:53-61);
 * the hand-written `const SYSTEM_INSTRUCTION: &str` it once held is gone, so only two states
 * remain: all five sections are included, in which case the order is checked here, or they are
 * not, which is a real problem. What the composition then does with those sections is beyond
 * a text reader, and is proved instead by the crate's own
 * system_instruction_appends_the_brief_to_the_safety_manual under cargo test. Nothing here
 * writes to the crate.
 */
export function inspectNative(source, names = SECTIONS) {
  // Only the real include_str! form counts. A loose `context/<name>"` test also matches a comment
  // or a doc string, which reported mode:"include_str" for a crate that includes nothing.
  const includeOf = (name) => `include_str!("../../src/studio/assistant/context/${name}")`;
  const included = names.filter((name) => source.includes(includeOf(name)));
  if (included.length === names.length) {
    // Order must come from the position each include_str! occupies in the Rust source; deriving it
    // by filtering the fixed list made the comparison a tautology that could never fail.
    const order = names
      .slice()
      .sort((a, b) => source.indexOf(includeOf(a)) - source.indexOf(includeOf(b)));
    const ordered = order.join(",") === names.join(",");
    return {
      mode: "include_str",
      ordered,
      note: ordered
        ? "assistant_ai.rs includes all five sections in the fixed order"
        : `assistant_ai.rs includes all five sections but in the order ${order.join(", ")}`,
    };
  }
  if (included.length > 0) {
    return {
      mode: "partial",
      note: `assistant_ai.rs includes only ${included.join(", ")}; the remaining sections `
        + "would be dropped from the native brief",
    };
  }
  return {
    mode: "unknown",
    note: "assistant_ai.rs does not include_str! any context section; the native brief would be empty",
  };
}

function main(argv) {
  const check = argv.includes("--check");
  if (!existsSync(CONTEXT_DIR)) {
    console.error(`[assistant-context] source folder not found: ${CONTEXT_DIR}`);
    console.error("[assistant-context] expected: " + SECTIONS.join(", "));
    return 1;
  }
  const result = composeBrief(CONTEXT_DIR);
  if (result.errors) {
    for (const error of result.errors) console.error(`[assistant-context] ${error}`);
    return 1;
  }
  const { brief, sections } = result;
  for (const section of sections) {
    const chars = section.normalised.length;
    console.log(
      `[assistant-context] ${section.name.padEnd(16)} ${String(chars).padStart(5)} characters`
        + ` ~${Math.ceil(chars / 4)} tokens`,
    );
  }
  const tokens = Math.ceil(brief.length / 4);
  console.log(
    `[assistant-context] composed brief: ${brief.length} characters ~${tokens} tokens`
      + ` (ceiling ${MAX_BRIEF_CHARS} characters), ASCII only, no double spaces`,
  );
  if (tokens > BUDGET_TOKENS) {
    // Not a failure: the ceiling is the gate. This is the published cost moving, and it is
    // charged on every round of every send on both platforms, uncounted by the meter. The round
    // count is deliberately not restated here: it is DEFAULT_EXECUTION_BUDGET.maxRounds
    // (executionBudget.ts), configurable per browser, and the figure that used to sit in this
    // comment had gone eight times stale against it.
    console.log(
      `[assistant-context] over the published ${BUDGET_TOKENS}-token budget by`
        + ` ${tokens - BUDGET_TOKENS} tokens; the cost is paid on every round of every send`
        + " (DEFAULT_EXECUTION_BUDGET.maxRounds) and measureContext counts none of it",
    );
  }
  // No Rust is executed here. This compares normaliseManualMarkdown against
  // rustNormaliseEquivalent, a longhand JS transcription of the Rust rule, so it proves the
  // sections are portable under that rule, not that the crate agrees. The crate's own value is
  // proved by system_instruction_appends_the_brief_to_the_safety_manual in
  // src-tauri/src/assistant_ai.rs, which cargo test runs.
  console.log(
    "[assistant-context] every section survives the transcribed Rust normalisation rule"
      + " identically (no Rust executed; cargo test proves the crate)",
  );

  const native = inspectNative(readFileSync(NATIVE, "utf8"));
  console.log(`[assistant-context] native: ${native.note}`);
  if (native.mode === "include_str" && !native.ordered) return 1;
  if (native.mode === "partial" || native.mode === "unknown") return 1;

  const module = renderModule(brief);
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8") : null;
  if (current === module) {
    console.log(`[assistant-context] ${OUTPUT} is up to date`);
    return 0;
  }
  if (check) {
    console.error(`[assistant-context] ${OUTPUT} is stale; run node scripts/build-assistant-context.mjs`);
    return 1;
  }
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, module, "utf8");
  console.log(`[assistant-context] wrote ${OUTPUT}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
