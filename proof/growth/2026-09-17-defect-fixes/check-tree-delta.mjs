/**
 * The working tree's relation to `code.diff`, measured rather than asserted.
 *
 * The note claims that `code.diff` is the diff of the three commits, and that the working tree carries
 * two further comment-only corrections the commits do not — a `skills.ts` docstring and a
 * `skills.test.ts` comment — and nothing else. This is that claim, run.
 *
 * It is deliberately state-aware, because the state it describes will not last: the corrections may be
 * committed later, at which point the delta is empty and this script must say so rather than report a
 * failure. It fails only on the thing the claim rules out — a delta that is not one of those two files,
 * or a changed line that is not a comment line.
 *
 * The three commits are pinned by the range `push.out.txt` records rather than written as `HEAD~3`:
 * anything committed on this branch afterwards moves HEAD, and this check is about the change, not about
 * how many commits have landed since. The round that committed the proof bundles re-anchored it for
 * exactly that reason — a range written `HEAD~3` would have started failing on a commit that has nothing
 * to do with `code.diff`. The readings it prints are the same ones; the range they are printed for no
 * longer moves.
 *
 * Run from the repository root: node proof/growth/2026-09-17-defect-fixes/check-tree-delta.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const BUNDLE = "proof/growth/2026-09-17-defect-fixes/";
const CORRECTIONS = ["src/studio/assistant/skills.ts", "src/studio/assistant/skills.test.ts"];

/* git writes its CRLF advice to stderr, and an execFileSync that inherits stderr would mix it into the
   captured text — the reason the first attempt at this comparison found no common prefix. */
const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const lines = (t) => t.split("\n").filter(Boolean);
let failures = 0;
const check = (label, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : ` — ${detail}`}`);
};

console.log("check-tree-delta — the working tree against code.diff\n");

/* The range is pinned to the push's own record — `<base>..<head>` as the terminal reported it and as the
   remote read back — so that nothing below depends on where HEAD happens to be when this runs. */
const push = fs.readFileSync(BUNDLE + "push.out.txt", "utf8");
const pinned = /\b([0-9a-f]{7,40})\.\.([0-9a-f]{7,40})\b/.exec(push);
if (!pinned) { console.error("push.out.txt carries no <base>..<head> range — there is nothing to anchor to."); process.exit(1); }
const [, BASE, TIP] = pinned;
/* A reading that does not move when later commits land: ancestry is monotone, so this line prints the same
   before and after them — which is the property the pinning exists for. It is printed, not asserted, so the
   count of checks stays what the page quotes. */
const tipInHead = (() => { try { git(["merge-base", "--is-ancestor", TIP, "HEAD"]); return true; } catch { return false; } })();
console.log(`the three commits are pinned to push.out.txt's range: ${BASE}..${TIP} — the pinned tip is in HEAD's history: ${tipInHead ? "yes" : "no"}\n`);

/* 1. code.diff is the diff of the three commits, byte for byte. */
const committed = git(["diff", BASE, TIP]);
const codeDiff = fs.readFileSync(BUNDLE + "code.diff", "utf8");
check(
  `code.diff is byte-identical to \`git diff ${BASE} ${TIP}\``,
  codeDiff === committed,
  `${Buffer.byteLength(codeDiff)} bytes in code.diff, ${Buffer.byteLength(committed)} in the committed diff`,
);

/* 2. Which tracked paths differ from HEAD at all. */
const dirty = lines(git(["diff", "--name-only", "HEAD"]));
const strays = dirty.filter((p) => !CORRECTIONS.includes(p));
const clean = dirty.length === 0;
console.log(
  clean
    ? "\nThe working tree matches HEAD: the corrections in this delta have been committed, so the comparison\nbelow is the empty one and the two comment hunks are now part of the committed diff."
    : `\nPaths differing from HEAD: ${dirty.join(", ")}`,
);
check("every path differing from HEAD is one of the two corrected files", strays.length === 0, strays.length ? strays.join(", ") : "none");

/* 3. For every other path the three commits touched, the working-tree diff is the committed one. */
const committedPaths = lines(git(["diff", "--name-only", BASE, TIP]));
const others = committedPaths.filter((p) => !CORRECTIONS.includes(p));
const sameBytes = others.every((p) => git(["diff", BASE, TIP, "--", p]) === git(["diff", BASE, "--", p]));
check(`the other ${others.length} committed paths carry an identical diff in the working tree`, sameBytes);

/* 4. Every line the delta adds or removes is a comment line. */
const delta = git(["diff", "HEAD", "--", ...CORRECTIONS]);
const changed = lines(delta).filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
const code = changed.filter((l) => !/^[+-]\s*(\/\/|\*|\/\*)/.test(l));
check(
  "every changed line in those two files is a comment line",
  code.length === 0,
  `${changed.length} lines changed, ${code.length} not comments`,
);

/* 5. The same relation, taken over the paths the change itself touches: an unrestricted `git diff <the
   pinned base>` would also count every file committed on this branch since — the proof bundles among them —
   which is not what this comparison is about. Over the change's own paths the reading is the note's, and it
   does not move when later commits land. */
const working = git(["diff", BASE, "--", ...committedPaths]);
const addedBytes = Buffer.byteLength(working) - Buffer.byteLength(committed);
console.log(`\ncode.diff ${Buffer.byteLength(codeDiff)} bytes; git diff ${BASE} over the change's own ${committedPaths.length} paths on this tree ${Buffer.byteLength(working)} bytes (+${addedBytes})`);
check("the comparison adds nothing when the tree is clean, or only these two files' hunks when it is not", clean ? addedBytes === 0 : addedBytes > 0);

/* 6. The two files still parse as the language they are, so a comment edit did not break them. */
const testFile = CORRECTIONS[1];
const run = execFileSync(process.execPath, ["--experimental-strip-types", "--test", testFile], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] });
const tally = (what) => new RegExp(`^(?:#|\\u2139) ${what} (\\d+)$`, "m").exec(run)?.[1];
const pass = tally("pass");
const fail = tally("fail");
check(
  `${testFile} still runs and passes with the corrected comment in it`,
  fail === "0" && pass !== undefined,
  `pass ${pass}, fail ${fail}`,
);

console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${6 - failures} of 6 checks pass.`);
process.exit(failures ? 1 : 0);
