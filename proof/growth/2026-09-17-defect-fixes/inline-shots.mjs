/**
 * Inlines this page's screenshots as data URIs so the report stands alone as a local file.
 *
 * Idempotent: a src already inlined is left alone, so re-running after an edit re-inlines only what
 * changed. Run: node proof/growth/2026-09-17-defect-fixes/inline-shots.mjs
 */
import fs from "node:fs";

const page = new URL("./index.html", import.meta.url);
const html = fs.readFileSync(page, "utf8");
const refs = [...new Set([...html.matchAll(/src="(\.\.\/[^"]+\.png)"/g)].map((m) => m[1]))];

let out = html;
let inlined = 0;
let bytes = 0;
for (const ref of refs) {
  const file = new URL(ref, page);
  const data = fs.readFileSync(file);
  bytes += data.length;
  out = out.replaceAll(`src="${ref}"`, `src="data:image/png;base64,${data.toString("base64")}"`);
  inlined += 1;
  console.log(`${ref} -> ${Math.round(data.length / 1024)} KB inlined`);
}
fs.writeFileSync(page, out);
console.log(`\n${inlined} screenshot(s), ${Math.round(bytes / 1024)} KB of PNG, page now ${Math.round(out.length / 1024)} KB.`);
