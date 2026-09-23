// Extracts the text of the downloaded draft quote so its content can be checked against the worksheet.
import { readFileSync, writeFileSync } from "node:fs";
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const task = getDocument({ data: Uint8Array.from(readFileSync(process.argv[2])), verbosity: 0 });
const doc = await task.promise; const pages = [];
for (let i = 1; i <= doc.numPages; i++) { const c = await (await doc.getPage(i)).getTextContent(); pages.push(c.items.map(x => ("str" in x ? x.str : "")).join(" ")); }
const meta = await doc.getMetadata(); await task.destroy();
writeFileSync(process.argv[3], JSON.stringify({ pages: doc.numPages, title: meta.info.Title, text: pages }, null, 1));
console.log(doc.numPages, meta.info.Title); console.log(pages.join("\n---\n"));
