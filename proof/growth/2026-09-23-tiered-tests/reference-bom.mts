// Runs the app's own compile step and the TypeScript BOM rules (parity-checked against the Python engine)
// on the exact job + recipe set saved by the native app. Reference only: not the desktop engine.
import { readFileSync, writeFileSync } from "node:fs";
import { compileBomRequest } from "../../../src/studio/bomCompiler.ts";
import { buildBom } from "../../../src/studio/bomRules.ts";
const [jobFile, recipeFile, outFile] = process.argv.slice(2);
const job = JSON.parse(readFileSync(jobFile, "utf8"));
const recipeSet = JSON.parse(readFileSync(recipeFile, "utf8"))[0][1].recipeSet;
const compiled = await compileBomRequest({ job, runtimeAssets: { document: { state: "ready", message: null }, photos: {} }, hydrationSettled: true, recipeSet, requestId: "reference-" + job.revision });
if (!compiled.ok) { console.log(JSON.stringify(compiled.issues, null, 1)); process.exit(1); }
const response = await buildBom(compiled.request);
writeFileSync(outFile, JSON.stringify({ request: compiled.request, response }, null, 1));
const lines = (response as any).lines ?? (response as any).result?.lines ?? (response as any).bom?.lines;
console.log(JSON.stringify(Object.keys(response)), JSON.stringify(lines ? lines.map((l: any) => [l.itemCode, l.description, l.quantity, l.unit]) : response).slice(0, 3000));
