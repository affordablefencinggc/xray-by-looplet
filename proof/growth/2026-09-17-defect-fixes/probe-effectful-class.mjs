/**
 * Executes the claims §2 and §3 of the report page make about the effectful tool class, against the
 * real modules — not against a re-implementation of them.
 *
 * The page's rejected-alternative paragraph says three things that have to be true, and one of them
 * used to be false on the page and in `skills.ts`'s own docstring ("adding these five to EDIT_TOOLS
 * would have changed nothing"). This probe settles each of them by running the predicates:
 *
 *   1. Declaration: `assistantToolAllowed` is unchanged by EDIT membership for these five, because
 *      the VIEW_TOOLS disjunct already decides the result. Proven by flipping `allowProjectEdits`
 *      and showing the answer does not move (the second disjunct is the only one that flag reads),
 *      with the predicate's own source quoted.
 *   2. The gate: `permissionVerdict` DID key on `isAssistantEditTool` alone before the fix — read
 *      out of git for the commit that changed it — so adding the five to that set would have gated
 *      them exactly as this change does. That half is why the class was needed; the next two are
 *      why membership in EDIT_TOOLS was the wrong way to get it.
 *   3. The three readers that mean *writes the project record*: the packet's pending-action refusal
 *      (`workPacket.ts:81`), the same predicate in the runtime's pre-flight, and
 *      `contextBudget.isStateChangingTool`. Each is shown deciding on `isAssistantEditTool` — for
 *      the five, on the disjunct that is false — with the deciding source line quoted, plus the
 *      partition of the real 38-name tool catalogue across the three sets.
 *   4. Nothing an effectful tool returns can clear a pending action: `isConfirmedRejection` answers
 *      false for every name that is not one of the two draw tools, whatever receipt it is handed.
 *
 * Run from the repo root: node proof/growth/2026-09-17-defect-fixes/probe-effectful-class.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";

const A = "../../../src/studio/assistant/";
const skills = await import(A + "skills.ts");
const permissions = await import(A + "permissions.ts");
const contextBudget = await import(A + "contextBudget.ts");
const workPacket = await import(A + "workPacket.ts");
const actionOutcome = await import(A + "actionOutcome.ts");
const { appTools } = await import(A + "appTools.ts");

const checks = [];
const check = (label, ok, detail = "") => { checks.push({ label, ok, detail }); };
const line = (f, n) => readFileSync("src/studio/assistant/" + f, "utf8").split("\n")[n - 1].trim();
/**
 * The first line of `f` containing `needle`, so a predicate is located by what it is rather than by a
 * number a comment inserted above it would falsify — which is what happened to this probe's own
 * hard-coded `skills.ts:138` when this pass corrected the docstring above it.
 */
const findLine = (f, needle) => {
  const i = readFileSync("src/studio/assistant/" + f, "utf8").split("\n").findIndex((l) => l.includes(needle));
  if (i === -1) throw new Error(`probe: no line in src/studio/assistant/${f} contains ${JSON.stringify(needle)}`);
  return i + 1;
};

/** The five names, read out of the catalogue through the exported predicate rather than retyped. */
const catalogue = appTools.map((t) => t.name);
const EFFECTFUL = catalogue.filter(skills.isAssistantEffectfulTool);
const EDITS = catalogue.filter(skills.isAssistantEditTool);
/** VIEW membership, read through the predicate's first disjunct: `assistantToolAllowed(name, false)`. */
const declaredRead = (n) => skills.assistantToolAllowed(n, false);
const DECLARED_ONLY = catalogue.filter((n) => declaredRead(n) && !skills.isAssistantEditTool(n));
/** Of those, the ones that are neither edits nor effectful — the third part of the split. */
const PURE_READS = DECLARED_ONLY.filter((n) => !skills.isAssistantEffectfulTool(n));
const UNCLASSIFIED = catalogue.filter((n) => !declaredRead(n) && !skills.isAssistantEditTool(n) && !skills.isAssistantEffectfulTool(n));
const EDIT_WITNESS = "save_project";
const DRAW_WITNESS = "draw_architect_elements";

console.log("A. The catalogue: three sets, and the split they make (skills.ts)\n");
console.log(`   ${catalogue.length} names in appTools`);
console.log(`   ${EDITS.length} edit tools:            ${EDITS.join(", ")}`);
console.log(`   ${EFFECTFUL.length} effectful, not edits:  ${EFFECTFUL.join(", ")}`);
console.log(`   ${DECLARED_ONLY.length} declared reads (VIEW_TOOLS), of which ${PURE_READS.length} are neither edits nor effectful`);
console.log(`   ${UNCLASSIFIED.length} in none of the three (never declared, never gated): ${UNCLASSIFIED.join(", ") || "none"}`);
check("the effectful class is exactly five names", EFFECTFUL.length === 5, EFFECTFUL.join(", "));
check("no name is both an edit and effectful", EDITS.every((n) => !EFFECTFUL.includes(n)));
check(`the catalogue splits into ${EDITS.length} edits + ${EFFECTFUL.length} effectful + ${PURE_READS.length} other reads = ${EDITS.length + EFFECTFUL.length + PURE_READS.length}`,
  UNCLASSIFIED.length === 0 && EDITS.length + EFFECTFUL.length + PURE_READS.length === catalogue.length
  && EFFECTFUL.every((n) => DECLARED_ONLY.includes(n)) && EDITS.every((n) => !DECLARED_ONLY.includes(n)),
  `catalogue ${catalogue.length}; the five effectful are also declared reads, so the printed ${DECLARED_ONLY.length} contains them`);

console.log("\n   predicate sources, each located by its own content rather than by a hard-coded number:");
const SOURCES = [
  ["skills.ts", "export const isAssistantEditTool"],
  ["skills.ts", "export const isAssistantEffectfulTool"],
  ["skills.ts", "export const isAssistantGatedTool"],
  ["skills.ts", "return VIEW_TOOLS.has(name)"],
  ["contextBudget.ts", "export const STATE_CHANGING_TOOL"],
  ["contextBudget.ts", "export const isStateChangingTool"],
  ["workPacket.ts", "if (packet.pendingAction && isAssistantEditTool(tool))"],
  ["actionOutcome.ts", "export function isConfirmedRejection"],
  ["permissions.ts", 'if (!isAssistantGatedTool(toolName)) return "allowed";'],
];
const CITES = {};
for (const [f, needle] of SOURCES) {
  const n = findLine(f, needle);
  CITES[needle] = `${f}:${n}`;
  console.log(`     ${f}:${n}  ${line(f, n)}`);
  check(`${f}:${n} is the line the probe means to cite`, line(f, n).includes(needle.slice(0, 24)));
}

console.log("\nB. Declaration: `assistantToolAllowed(name, allowProjectEdits)`\n");
console.log("   name                        allowProjectEdits=false   =true   moves?");
const declarationUnchanged = [];
for (const n of [...EFFECTFUL, EDIT_WITNESS, DRAW_WITNESS]) {
  const off = skills.assistantToolAllowed(n, false);
  const on = skills.assistantToolAllowed(n, true);
  const moves = off !== on;
  if (moves) declarationUnchanged.push(n);
  console.log(`   ${n.padEnd(28)} ${String(off).padEnd(24)} ${String(on).padEnd(7)} ${moves ? "yes" : "no"}`);
}
console.log("\n   The predicate is `VIEW_TOOLS.has(name) || (allowProjectEdits && EDIT_TOOLS.has(name))`");
console.log("   (skills.ts:145). Flipping `allowProjectEdits` can only move an answer whose first");
console.log("   disjunct is false; if the answer holds, VIEW_TOOLS decided it and no EDIT membership");
console.log("   can change it. That is exactly the case for all five.");
for (const n of EFFECTFUL) {
  check(`declaration for ${n} is decided by VIEW_TOOLS, so EDIT membership cannot move it`,
    skills.assistantToolAllowed(n, false) === true && skills.assistantToolAllowed(n, true) === true);
}
check("the witness edit tool's declaration DOES move with allowProjectEdits (the flag is live)",
  skills.assistantToolAllowed(EDIT_WITNESS, false) === false && skills.assistantToolAllowed(EDIT_WITNESS, true) === true);

console.log("\nC. The gate: `permissionVerdict(name, mode, grantedForChat)`\n");
console.log("   name                        ask        ask+grant   auto       readonly");
const modes = (n) => [permissions.permissionVerdict(n, "ask", new Set()), permissions.permissionVerdict(n, "ask", new Set([n])),
  permissions.permissionVerdict(n, "auto", new Set()), permissions.permissionVerdict(n, "readonly", new Set())];
for (const n of [...EFFECTFUL, EDIT_WITNESS, DRAW_WITNESS]) {
  console.log(`   ${n.padEnd(28)} ${modes(n).map((v) => v.padEnd(10)).join(" ")}`);
}
for (const n of EFFECTFUL) {
  check(`the gate prompts for ${n} in ask mode, allows it with a grant, blocks it read-only`,
    permissions.permissionVerdict(n, "ask", new Set()) === "ask"
    && permissions.permissionVerdict(n, "ask", new Set([n])) === "allowed"
    && permissions.permissionVerdict(n, "auto", new Set()) === "allowed"
    && permissions.permissionVerdict(n, "readonly", new Set()) === "blocked");
}

const before = execFileSync("git", ["show", "88e2e52^:src/studio/assistant/permissions.ts"], { encoding: "utf8" });
const beforeVerdict = before.split("\n").filter((l) => /return "allowed"|isAssistantEditTool|isAssistantGatedTool/.test(l)).map((l) => l.trim());
console.log("\n   The same function before this change (git show 88e2e52^:src/studio/assistant/permissions.ts):");
for (const l of beforeVerdict) console.log("     " + l);
check("before the change the gate keyed on EDIT_TOOLS membership alone, so the five would have been gated by it",
  beforeVerdict.some((l) => l === 'if (!isAssistantEditTool(toolName)) return "allowed";')
  && !before.includes("isAssistantGatedTool"),
  beforeVerdict.join(" | "));

console.log("\nD. The readers that mean *writes the project record*\n");
/** Every read of isAssistantEditTool in src, outside tests: its own definition, its import and a
 *  `from "…"` clause are not reads. The gate consumes it through isAssistantGatedTool (skills.ts:143). */
const readers = [];
const walk = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = dir + "/" + e;
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.tsx?$/.test(p) || /\.test\.tsx?$/.test(p)) continue;
    readFileSync(p, "utf8").split("\n").forEach((l, i) => {
      if (!/isAssistantEditTool\(/.test(l)) return;
      if (/^\s*import\b|from ["']/.test(l)) return;
      if (/export const isAssistantEditTool\b/.test(l)) return;
      readers.push(`${p.replace(/\\/g, "/")}:${i + 1}  ${l.trim().slice(0, 110)}`);
    });
  }
};
walk("src/studio/assistant");
console.log("   every read of isAssistantEditTool in src, outside tests:");
for (const r of readers) console.log("     " + r);
check("isAssistantEditTool has exactly five readers, and the gate is one of them",
  readers.length === 5 && readers.some((r) => r.startsWith(`src/studio/assistant/${CITES["export const isAssistantGatedTool"]} `)),
  readers.length + " readers");
const permSrc = readFileSync("src/studio/assistant/permissions.ts", "utf8");
check("the gate reads it through isAssistantGatedTool, not directly",
  /isAssistantGatedTool\(toolName\)/.test(permSrc) && !/isAssistantEditTool/.test(permSrc));

const packet = { projectId: "p", pendingAction: "pending-1", snapshot: { projectRevision: 1, designRevision: 1, sources: [] } };
const snapshot = { projectId: "p", recoveryBlocked: false, projectRevision: 1, designRevision: 1, sources: [] };
const blocked = (n) => {
  try { workPacket.checkPacketIntegrity({ ...packet }, n, {}, snapshot); return "runs"; }
  catch (e) { return /no durable outcome/.test(e.message) ? "BLOCKED by the pending action" : "other: " + e.message; }
};
console.log("\n   workPacket.ts:81 — `if (packet.pendingAction && isAssistantEditTool(tool)) throw`");
console.log("   with an unresolved pending action on the packet:");
for (const n of [...EFFECTFUL, EDIT_WITNESS, DRAW_WITNESS]) console.log(`     ${n.padEnd(28)} ${blocked(n)}`);
for (const n of EFFECTFUL) check(`${n} does not trip the pending-action refusal`, blocked(n) === "runs");
check("the witness edit tool DOES trip it — the refusal is decided by EDIT membership", blocked(EDIT_WITNESS) === "BLOCKED by the pending action");

console.log("\n   contextBudget.isStateChangingTool(name) — `isAssistantEditTool(name) || STATE_CHANGING_TOOL.test(name)`");
console.log("   name                        edit?   prefix-regex?   isStateChangingTool");
for (const n of [...EFFECTFUL, EDIT_WITNESS, DRAW_WITNESS]) {
  console.log(`   ${n.padEnd(28)} ${String(skills.isAssistantEditTool(n)).padEnd(7)} ${String(contextBudget.STATE_CHANGING_TOOL.test(n)).padEnd(15)} ${contextBudget.isStateChangingTool(n)}`);
}
for (const n of EFFECTFUL) {
  check(`${n} is not state-changing today, and neither disjunct holds for it`,
    contextBudget.isStateChangingTool(n) === false && !contextBudget.STATE_CHANGING_TOOL.test(n) && !skills.isAssistantEditTool(n));
}

console.log("\nE. What can clear a pending action: `isConfirmedRejection` (actionOutcome.ts:16-19)\n");
const receipt = { isError: true, _meta: { "xray.execution": { status: "not-executed", phase: "architect-preparation", projectId: "p", designRevision: 1 } } };
console.log("   handed the one receipt shape that clears one (the architect-preparation receipt):");
for (const n of [...EFFECTFUL, EDIT_WITNESS, DRAW_WITNESS, "edit_architect_elements"]) {
  console.log(`     ${n.padEnd(28)} ${actionOutcome.isConfirmedRejection(n, receipt, { projectId: "p", designRevision: 1 })}`);
}
for (const n of EFFECTFUL) {
  check(`${n} can never clear a pending action by rejection`, actionOutcome.isConfirmedRejection(n, receipt, { projectId: "p", designRevision: 1 }) === false);
}
check("only the two draw tools can — the check is on the tool name, not the receipt",
  actionOutcome.isConfirmedRejection(DRAW_WITNESS, receipt, { projectId: "p", designRevision: 1 }) === true
  && actionOutcome.isConfirmedRejection("edit_architect_elements", receipt, { projectId: "p", designRevision: 1 }) === true
  && actionOutcome.isConfirmedRejection(EDIT_WITNESS, receipt, { projectId: "p", designRevision: 1 }) === false);

/* ------------------------------------------------------------------------------------------------
 * G. Every source citation the page and the README print, resolved against the tree.
 *
 * This pass corrected a comment in `skills.ts`, which moved every line below it — and both documents
 * cited three of those lines by number, so they silently came to point at the docstring instead of the
 * predicate. A cite that no longer lands on the thing it names is the same failure the prose had, so
 * the probe now resolves each `file.ext:N` both documents print and refuses one that lands on a blank
 * line or on a comment. Numbers the documents state can therefore no longer drift from the source
 * without this failing.
 *
 * What the token scan can and cannot see: it needs the filename in front of each `:N`, so a shorthand
 * continuation (`skills.ts:101`, `:104`, `:111-113`) and a range's second endpoint
 * (`workbenchStructure.ts:46-63`) carry no filename of their own and are not resolved — only the token
 * that spells out its own file is. The counts this section prints say so.
 * ---------------------------------------------------------------------------------------------- */
const DOCS = ["proof/growth/2026-09-17-defect-fixes/index.html", "proof/growth/2026-09-17-defect-fixes/README.md"];
/** basename -> paths, for every source file the documents could be citing. */
const byName = new Map();
const indexDir = (dir) => {
  for (const e of readdirSync(dir)) {
    const p = dir + "/" + e;
    if (statSync(p).isDirectory()) { if (!/node_modules|target|[\\/]\.git/.test(p)) indexDir(p); continue; }
    if (!/\.(ts|tsx|mjs|js|rs)$/.test(p)) continue;
    const b = p.slice(p.lastIndexOf("/") + 1);
    if (!byName.has(b)) byName.set(b, []);
    byName.get(b).push(p.replace(/\\/g, "/"));
  }
};
for (const d of ["src", "scripts", "src-tauri/src"]) indexDir(d);

const CITE_RE = /([A-Za-z0-9_./-]*[A-Za-z0-9_-]\.(?:ts|tsx|mjs|js|rs)):(\d+)/g;
const cited = [];
for (const doc of DOCS) {
  const text = readFileSync(doc, "utf8");
  for (const m of text.matchAll(CITE_RE)) {
    const [, raw, numStr] = m;
    const named = raw.includes("/") ? [raw] : (byName.get(raw) ?? []);
    const path = named.find((p) => { try { return statSync(p).isFile(); } catch { return false; } });
    cited.push({ doc: doc.split("/").pop(), raw, n: Number(numStr), path: path ?? null });
  }
}
const unresolved = cited.filter((c) => !c.path);
const blank = [];
const comment = [];
console.log(`\nG. Every file.ext:N token the two documents print — ${cited.length} occurrences, ${new Set(cited.map((c) => `${c.raw}:${c.n}`)).size} distinct — resolved\n`);
for (const c of cited) {
  if (!c.path) { console.log(`   ??  ${c.doc}  ${c.raw}:${c.n}  — no such file in the tree`); continue; }
  const src = readFileSync(c.path, "utf8").split("\n");
  const text = (src[c.n - 1] ?? "").trim();
  const isBlank = text === "";
  const isComment = /^(\/\/|\*|\/\*|<!--)/.test(text);
  if (isBlank) blank.push(c);
  if (isComment) comment.push(c);
  console.log(`   ${isBlank ? "BLANK" : isComment ? "COMMENT" : "ok   "}  ${c.doc}  ${c.raw}:${c.n}  ${text.slice(0, 100)}`);
}
check("every cited source file exists in the tree", unresolved.length === 0,
  unresolved.map((c) => `${c.raw}:${c.n}`).join(", "));
check("no citation lands on a blank line", blank.length === 0,
  blank.map((c) => `${c.doc} ${c.raw}:${c.n}`).join(", "));
check("no citation lands on a comment line — the drift this pass introduced",
  comment.length === 0, comment.map((c) => `${c.doc} ${c.raw}:${c.n}`).join(", "));
/** The cites both documents are required to print: the deciding lines the prose rests on. A document
 *  that stops printing one of them has dropped the claim, so each is asserted — the loop below used to
 *  push a constant `true` and could therefore never fail. */
const REQUIRED_IN_DOCS = ["skills.ts:145", "contextBudget.ts:93", "contextBudget.ts:95", "workPacket.ts:81", "actionOutcome.ts:16"];
for (const [needle, cite] of Object.entries(CITES)) {
  if (!REQUIRED_IN_DOCS.includes(cite)) continue;
  const stated = cited.some((c) => `${c.raw}:${c.n}` === cite);
  check(`a document prints ${cite}, the line where ${JSON.stringify(needle.slice(0, 30))} is`, stated);
}

console.log(`   ${Object.values(CITES).length - REQUIRED_IN_DOCS.length} probed lines no document is required to print (recorded above, not asserted)`);

const bad = checks.filter((c) => !c.ok);
console.log(`\nF. ${checks.length - bad.length} of ${checks.length} checks pass${bad.length ? " — FAILURES:" : "."}`);
for (const c of bad) console.log(`   FAIL ${c.label}${c.detail ? " — " + c.detail : ""}`);
if (bad.length) process.exitCode = 1;
