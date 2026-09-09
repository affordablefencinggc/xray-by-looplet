/**
 * Markdown to system-instruction normalisation, shared by the generator and the tests.
 *
 * The assistant manual is authored as Markdown in src/studio/assistant/context/ but must
 * reach the model as one single-line string. Two independent implementations produce that
 * string — this one, used by scripts/build-assistant-context.mjs to generate
 * contextManual.gen.ts, and a Rust one over include_str! in src-tauri/src/assistant_ai.rs
 * (the include_str! pattern is already established at src-tauri/src/material_ai.rs:54,59).
 * skills.test.ts asserts the two are byte-identical, so this function is the single
 * definition of the rule and must not be inlined or duplicated.
 *
 * The rule is deliberately the smallest one that both languages implement identically with
 * no locale, Unicode or regex-engine behaviour in play:
 *   1. Split on /\r?\n/ so a CRLF checkout and an LF checkout give the same result. The
 *      repository carries no .gitattributes, so a Windows clone can legitimately hold CRLF.
 *   2. Collapse each run of ASCII whitespace within a line to one space, then trim the line.
 *      Markdown indentation (list nesting) and table padding are layout, not content. The
 *      collapse is what lets the house style keep using tables: the KYC template in
 *      context/user.md writes empty cells as "| Name |  |  |", which is two real spaces
 *      mid-line and would otherwise reach the model verbatim.
 *   3. Drop lines that are empty after trimming, so blank separator lines and
 *      whitespace-only lines never become double spaces.
 *   4. Join with a single space.
 * Steps 2 to 4 together are what guarantee the output contains no double space, which is the
 * property the parity test and the ceiling test both lean on.
 *
 * Rust equivalent (each step maps one-to-one, no crate required):
 *   text.split('\n')
 *       .map(|l| l.split_ascii_whitespace().collect::<Vec<_>>().join(" "))
 *       .filter(|l| !l.is_empty())
 *       .collect::<Vec<_>>().join(" ")
 * split_ascii_whitespace already discards leading, trailing and repeated separators, so the
 * trim in step 2 needs no separate Rust statement. Its separator set is [\t\n\f\r ] — five
 * characters, not six: U+000B is not ASCII whitespace to Rust, so it is not whitespace here
 * either and is refused as non-ASCII instead.
 * Neither language's built-in trim may be used for step 2. U+000B is ASCII (0x0B) yet
 * JavaScript's String.prototype.trim strips it yet Rust's split_ascii_whitespace does not,
 * so "both sides are ASCII-only" is not sufficient to make the trims agree — they diverge on
 * that one character at a line boundary. Step 2 therefore trims with the same explicit
 * [\t\n\f\r ] set it collapses with, and Rust needs no separate trim statement at all.
 * Splitting on '\n' alone is sufficient in Rust because \r is in that separator set.
 */

/**
 * Collapses authored Markdown into the single-line form the system instruction carries.
 *
 * Returns "" for input that holds no non-whitespace content. The result never begins or
 * ends with a space and never contains two adjacent spaces.
 */
export function normaliseManualMarkdown(text: string): string {
  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    // [\t\n\f\r ] is exactly Rust's ASCII whitespace set: u8::is_ascii_whitespace defines it
    // as space, \t, \n, \f and \r. U+000B is deliberately absent even though JavaScript's \v
    // matches it, because split_ascii_whitespace does not treat a vertical tab as a separator
    // (verified: '\u{000b}'.is_ascii_whitespace() is false). Collapsing it here would rewrite
    // on this platform a byte the Rust normaliser at src-tauri/src/assistant_ai.rs:39-45
    // preserves verbatim, breaking the byte-parity contract skills.test.ts asserts. Left
    // uncollapsed, a vertical tab reaches manualBriefProblem below and is refused as
    // non-ASCII, the way U+00A0 already is. The class is written out longhand rather than
    // using \s, which in JavaScript additionally matches U+00A0 and the Unicode space
    // separators and would diverge the other way.
    // The trim must use the same five-character set as the collapse. String.prototype.trim strips
    // U+000B, so a plain .trim() here would delete at a line boundary exactly the byte the collapse
    // deliberately preserves, reinstating the divergence in the one position the collapse cannot
    // reach. Rust needs no counterpart statement: split_ascii_whitespace already discards leading
    // and trailing separators and does not count U+000B among them.
    const collapsed = line.replace(/[\t\n\f\r ]+/g, " ").replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "");
    if (collapsed.length > 0) lines.push(collapsed);
  }
  return lines.join(" ");
}

/**
 * Joins already-normalised sections the same way lines are joined, so composing five files
 * is the same operation as composing the lines within one file. Empty sections are dropped
 * rather than contributing a double space.
 */
export function joinManualSections(sections: readonly string[]): string {
  return sections.filter((section) => section.length > 0).join(" ");
}

/**
 * Reports why a normalised brief would be unsafe to ship, or null when it is sound.
 *
 * Non-ASCII text is refused because the collapse in normaliseManualMarkdown acts only on
 * ASCII whitespace, so a non-breaking space or an em space would survive on both platforms
 * and reach the model as content, and because the string is embedded in a Rust source
 * literal. A double space, a leading or trailing space, or a surviving newline all mean the
 * normaliser was bypassed; a newline is caught by the ASCII check, U+000A being outside the
 * printable range.
 */
export function manualBriefProblem(brief: string): string | null {
  if (/[^\x20-\x7e]/.test(brief)) {
    const index = brief.search(/[^\x20-\x7e]/);
    const code = brief.codePointAt(index) ?? 0;
    return `non-ASCII character U+${code.toString(16).toUpperCase().padStart(4, "0")} at index ${index}`;
  }
  if (brief.includes("  ")) return `double space at index ${brief.indexOf("  ")}`;
  if (brief !== brief.trim()) return "leading or trailing whitespace";
  return null;
}
