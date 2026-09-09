import test from "node:test";
import assert from "node:assert/strict";
import {
  joinManualSections,
  manualBriefProblem,
  normaliseManualMarkdown,
} from "./manualNormalise.ts";

test("a CRLF checkout and an LF checkout produce identical bytes", () => {
  const lf = "# Purpose\nRead the active design before edits.\n\n- Never bypass permissions.\n";
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.equal(normaliseManualMarkdown(crlf), normaliseManualMarkdown(lf));
  assert.equal(
    normaliseManualMarkdown(crlf),
    "# Purpose Read the active design before edits. - Never bypass permissions.",
  );
  // A lone CR is not a line break in either implementation; it is trimmed as whitespace.
  assert.equal(normaliseManualMarkdown("a\r\nb"), "a b");
});

test("blank and whitespace-only lines are dropped", () => {
  assert.equal(normaliseManualMarkdown("a\n\n\nb"), "a b");
  assert.equal(normaliseManualMarkdown("a\n   \n\t\nb"), "a b");
  assert.equal(normaliseManualMarkdown("\n\na\n\n"), "a");
  assert.equal(normaliseManualMarkdown(""), "");
  assert.equal(normaliseManualMarkdown("\n \t\r\n"), "");
});

test("leading and trailing spaces are trimmed from every line", () => {
  assert.equal(normaliseManualMarkdown("   a   \n\t b \t"), "a b");
  // Markdown list nesting and table alignment are layout, not content.
  assert.equal(normaliseManualMarkdown("- one\n  - two\n    - three"), "- one - two - three");
  assert.equal(normaliseManualMarkdown("| a | b |\n| - | - |"), "| a | b | | - | - |");
});

test("the output never contains a double space", () => {
  const sources = [
    "a\n\nb",
    "  a  \n  b  ",
    "a\n \nb",
    "# Heading\n\n\n\nBody text.\n\n",
    "one\r\n\r\n\r\ntwo",
  ];
  for (const source of sources) {
    const brief = normaliseManualMarkdown(source);
    assert.ok(!brief.includes("  "), `double space in ${JSON.stringify(brief)}`);
    assert.equal(brief, brief.trim());
  }
  // A run of whitespace inside a line collapses too. The KYC template in context/user.md
  // writes empty table cells as "| Name |  |  |", which is a real double space mid-line.
  assert.equal(normaliseManualMarkdown("| Name |  |  |"), "| Name | | |");
  assert.equal(normaliseManualMarkdown("a  b\ta\fb"), "a b a b");
  assert.equal(manualBriefProblem(normaliseManualMarkdown("| Name |  |  |")), null);
});

test("only ASCII whitespace collapses, so the Rust equivalent cannot diverge", () => {
  // Rust's split_ascii_whitespace splits on [\t\n\f\r ] and nothing else. JavaScript's \s
  // additionally matches U+00A0 and the Unicode space separators, so the class is written
  // out longhand; a non-breaking space must survive here and be refused by manualBriefProblem
  // rather than silently collapsing on one platform only.
  const nbsp = "\u00a0";
  assert.equal(normaliseManualMarkdown(`a${nbsp}${nbsp}b`), `a${nbsp}${nbsp}b`);
  assert.match(manualBriefProblem(`a${nbsp}b`) ?? "", /non-ASCII character U\+00A0/);
  const emSpace = "\u2003";
  assert.equal(normaliseManualMarkdown(`a${emSpace}b`), `a${emSpace}b`);
  for (const ws of ["\t", "\f", " "]) {
    assert.equal(normaliseManualMarkdown(`a${ws}${ws}b`), "a b");
  }
});

test("a vertical tab survives normalisation and is refused, as it does in Rust", () => {
  // U+000B is the one character where JavaScript's notion of whitespace exceeds Rust's:
  // \v inside a character class matches it, but '\u{000b}'.is_ascii_whitespace() is false,
  // so split_ascii_whitespace at src-tauri/src/assistant_ai.rs:41 keeps a vertical tab
  // inside a word. Verified against real rustc: normalising "a\u{000b}b" there yields the
  // bytes [97, 11, 98], not [97, 32, 98]. Collapsing it in JavaScript would therefore make
  // the web brief and the native brief differ by a byte while every JS-only gate agreed,
  // which is precisely the drift the byte-parity contract exists to prevent. It must instead
  // survive to manualBriefProblem and be refused there, the way U+00A0 above already is.
  // Written as an escape, not a literal control byte, so an editor or formatter cannot strip
  // it and leave this assertion passing vacuously.
  const vt = "\u000b";
  assert.equal(normaliseManualMarkdown(`a${vt}b`), `a${vt}b`);
  assert.equal(normaliseManualMarkdown(`a${vt}${vt}b`), `a${vt}${vt}b`);
  assert.match(manualBriefProblem(`a${vt}b`) ?? "", /non-ASCII character U\+000B at index 1/);
  // A vertical tab is not a line break either, so it cannot silently split a line.
  assert.equal(normaliseManualMarkdown(`  a${vt}b  `), `a${vt}b`);
  // Surrounding ASCII whitespace still collapses around it; only the VT itself is preserved.
  assert.equal(normaliseManualMarkdown(`a  ${vt}\tb`), `a ${vt} b`);
  // Line boundaries are the positions the collapse cannot reach, so they are where a built-in
  // trim would silently reinstate the divergence: String.prototype.trim strips U+000B, and Rust's
  // split_ascii_whitespace does not. These four cover both ends, alone and beside real whitespace.
  assert.equal(normaliseManualMarkdown(`${vt}a`), `${vt}a`);
  assert.equal(normaliseManualMarkdown(`a${vt}`), `a${vt}`);
  assert.equal(normaliseManualMarkdown(`  ${vt}a`), `${vt}a`);
  assert.equal(normaliseManualMarkdown(`a${vt}  `), `a${vt}`);
  // A line that is nothing but a vertical tab is real content to Rust, so it must not be dropped
  // as a blank line the way a space-only line is.
  assert.equal(normaliseManualMarkdown(`a\n${vt}\nb`), `a ${vt} b`);
});

test("ASCII-only input round-trips unchanged when it is already one line", () => {
  // Every printable ASCII character except the space itself, which is the one character the
  // collapse acts on. The manual is ASCII-only by contract (2,646 characters, zero
  // non-ASCII), so this is the whole alphabet a section can be written in.
  let ascii = "";
  for (let code = 0x21; code <= 0x7e; code += 1) ascii += String.fromCharCode(code);
  assert.equal(normaliseManualMarkdown(ascii), ascii);
  assert.equal(manualBriefProblem(ascii), null);
  // Single spaces between those characters survive; only runs collapse.
  const spaced = ascii.split("").join(" ");
  assert.equal(normaliseManualMarkdown(spaced), spaced);
  // The characters the manual actually leans on: backticks, quotes, semicolons, slashes.
  const line = "Write replies in Markdown; use a ```mindmap fence. Don't say \"saved\".";
  assert.equal(normaliseManualMarkdown(line), line);
  assert.equal(manualBriefProblem(line), null);
});

test("sections join the way lines do, and empty sections add no space", () => {
  assert.equal(joinManualSections(["a", "b", "c"]), "a b c");
  assert.equal(joinManualSections(["a", "", "b"]), "a b");
  assert.equal(joinManualSections([]), "");
  assert.ok(!joinManualSections(["a", "", "", "b"]).includes("  "));
  // Composing five files is the same operation as composing the lines within one file.
  const files = ["# A\n\nfirst\n", "# B\n\nsecond\n"];
  assert.equal(
    joinManualSections(files.map(normaliseManualMarkdown)),
    normaliseManualMarkdown(files.join("\n\n")),
  );
});

test("a brief is refused when the normaliser was bypassed", () => {
  assert.equal(manualBriefProblem("Read the design before edits."), null);
  // An em dash is the likeliest non-ASCII character to be typed into the Markdown by hand.
  assert.match(
    manualBriefProblem(`millimetres ${"—"} not inches`) ?? "",
    /non-ASCII character U\+2014 at index 12/,
  );
  assert.match(manualBriefProblem(" leading") ?? "", /leading or trailing/);
  assert.match(manualBriefProblem("trailing ") ?? "", /leading or trailing/);
  // A surviving newline means the normaliser was bypassed entirely.
  assert.match(manualBriefProblem("line\nbreak") ?? "", /non-ASCII character U\+000A/);
});
