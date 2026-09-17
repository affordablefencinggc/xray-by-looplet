/**
 * Static self-check of the report page: every class used has a rule, every element that must close
 * does, no placeholder or unresolved relative reference survives, and the table markup nests.
 *
 * Run: node proof/growth/2026-09-17-defect-fixes/check-page.mjs
 */
import fs from "node:fs";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const problems = [];

// 1. Classes used in markup vs. classes defined in the stylesheet.
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
// This page has no <body> element of its own (the artifact host supplies it), so the markup starts
// after the stylesheet rather than at a body tag.
const markup = html.slice(html.indexOf("</style>"));
const used = new Set([...markup.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
const undefinedClasses = [...used].filter((name) => !defined.has(name));
if (undefinedClasses.length) problems.push(`classes with no CSS rule: ${undefinedClasses.join(", ")}`);

// 2. Tag balance for the elements that carry the layout.
for (const tag of ["div", "section", "table", "thead", "tbody", "tr", "td", "th", "figure", "blockquote", "pre", "p", "ul", "li", "span", "a"]) {
  const open = (html.match(new RegExp(`<${tag}[\\s>]`, "g")) ?? []).length;
  const close = (html.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
  if (open !== close) problems.push(`<${tag}>: ${open} open, ${close} close`);
}

// 3. Nothing that should have been substituted is left.
for (const pattern of [/\{\{/, /TODO/, /src="\.\.\//, /FIXME/]) {
  if (pattern.test(html)) problems.push(`unresolved placeholder matching ${pattern}`);
}

// 4. Every id referenced by aria-labelledby / href="#..." exists (there are none here, so this is a guard).
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) if (!ids.has(target)) problems.push(`dangling in-page link #${target}`);

// 5. The page must not depend on a stylesheet or script host other than the fonts.
for (const [, url] of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
  if (!/^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/.test(url)) problems.push(`external resource outside the font host: ${url}`);
}

// 6. Both themes define every token before any redefinition, and body paints a background. The two dark
//    blocks are isolated one at a time: slicing from the first `@media` and merging everything after it
//    into one list cannot tell a token defined in both blocks from one defined in only one of them, so it
//    cannot establish "both" — which is what this check is named for.
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf("@media"));
const tokens = [...new Set([...rootBlock.matchAll(/--([\w-]+):/g)].map((m) => m[1]))];
const blockAt = (from) => {
  const open = css.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") { depth -= 1; if (!depth) return css.slice(open, i + 1); }
  }
  return null;
};
const darkBlocks = [...css.matchAll(/@media[^{]*prefers-color-scheme:\s*dark[^{]*\{|:root\[data-theme="dark"\]\s*\{/g)]
  .map((m) => ({ selector: m[0].trim(), body: blockAt(m.index) }))
  .filter((b) => b.body);
if (darkBlocks.length !== 2) problems.push(`dark blocks found: ${darkBlocks.length}, expected 2 — the prefers-color-scheme media query and the [data-theme="dark"] rule`);
const darkCoverage = [];
for (const b of darkBlocks) {
  const inThis = new Set([...b.body.matchAll(/--([\w-]+):/g)].map((m) => m[1]));
  darkCoverage.push(tokens.filter((t) => inThis.has(t)).length);
  const missing = tokens.filter((t) => !inThis.has(t));
  if (missing.length) problems.push(`tokens missing from the dark block \`${b.selector}\`: ${missing.join(", ")}`);
}
if (!/body\s*\{[^}]*background:\s*var\(/.test(css)) problems.push("body does not paint a token background");

// 7. The closing paragraph's inventory of this directory, held in both directions: every artifact it
//    names is on disk, and every file on disk is named by it or matched by a glob it prints. A directory
//    path and a glob name no single file, so they are not resolved; a bare extension names none either.
const footer = html.slice(html.indexOf('<p class="meta">Proof for every claim'));
const footerText = footer.slice(0, footer.indexOf("</p>"));
const named = [...footerText.matchAll(/<code>([^<]+)<\/code>/g)].map((m) => m[1]);
const here = fs.readdirSync(new URL(".", import.meta.url)).sort();
const globRe = (n) => new RegExp("^" + n.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
const covered = (f) => named.some((n) => (n.includes("*") ? globRe(n).test(f) : n === f));
const missing = named.filter((n) => !n.includes("*") && !n.endsWith("/") && !n.startsWith(".") && !here.includes(n));
const unnamed = here.filter((f) => !covered(f));
if (missing.length) problems.push(`the footer names artifacts that are not in this directory: ${missing.join(", ")}`);
if (unnamed.length) problems.push(`files in this directory the footer does not name: ${unnamed.join(", ")}`);

console.log(`${used.size} classes used, ${defined.size} defined, ${tokens.length} tokens (dark blocks cover ${darkCoverage.join(" / ")} of ${tokens.length}), ${named.length} names in the footer over ${here.length} files in this directory.`);
console.log(problems.length ? `\nFAIL\n- ${problems.join("\n- ")}` : "\nPASS: classes, tag balance, substitutions, in-page links, external hosts, both dark blocks, the footer's inventory of this directory and the body's token background all check out.");
process.exitCode = problems.length ? 1 : 0;
