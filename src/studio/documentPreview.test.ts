import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const cacheRoot = resolve("node_modules/.cache");
mkdirSync(cacheRoot, { recursive: true });
const compiledDir = mkdtempSync(join(cacheRoot, "document-preview-test-"));
const compiledPath = join(compiledDir, "DocumentPreview.cjs");
const source = readFileSync(join(here, "DocumentPreview.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
  fileName: "DocumentPreview.tsx",
}).outputText;
writeFileSync(compiledPath, compiled);
const require = createRequire(import.meta.url);
const { dxfToSvgGeometry } = require(compiledPath) as typeof import("./DocumentPreview");

after(() => rmSync(compiledDir, { recursive: true, force: true }));

const wrapEntities = (entities: string) => `0\nSECTION\n2\nENTITIES\n${entities}\n0\nENDSEC\n0\nEOF\n`;

describe("DXF document preview geometry", () => {
  it("converts LINE and closed LWPOLYLINE entities into bounded SVG paths", () => {
    const dxf = wrapEntities([
      "0", "LINE", "10", "0", "20", "0", "11", "10", "21", "5",
      "0", "LWPOLYLINE", "70", "1", "10", "0", "20", "0", "10", "4", "20", "0", "10", "4", "20", "3",
    ].join("\n"));
    const geometry = dxfToSvgGeometry(dxf);

    assert.ok(geometry);
    assert.equal(geometry.entityCount, 2);
    assert.equal(geometry.pointCount, 5);
    assert.equal(geometry.paths[0].closed, false);
    assert.equal(geometry.paths[1].closed, true);
    assert.match(geometry.paths[1].d, / Z$/);
    assert.match(geometry.viewBox, /^0 0 [\d.]+ [\d.]+$/);
    assert.doesNotMatch(geometry.paths.map((path) => path.d).join(""), /[<>"']/);
  });

  it("reads classic POLYLINE and VERTEX sequences from Uint8Array bytes", () => {
    const dxf = wrapEntities([
      "0", "POLYLINE", "70", "1",
      "0", "VERTEX", "10", "1", "20", "2",
      "0", "VERTEX", "10", "5", "20", "2",
      "0", "VERTEX", "10", "5", "20", "8",
      "0", "SEQEND",
    ].join("\n"));
    const geometry = dxfToSvgGeometry(new TextEncoder().encode(dxf));

    assert.ok(geometry);
    assert.equal(geometry.entityCount, 1);
    assert.equal(geometry.pointCount, 3);
    assert.equal(geometry.paths[0].closed, true);
    assert.match(geometry.paths[0].d, /^M /);
  });

  it("fails closed for malformed or unsupported ASCII DXF content", () => {
    assert.equal(dxfToSvgGeometry("not a dxf"), null);
    assert.equal(dxfToSvgGeometry(wrapEntities("0\nCIRCLE\n10\n5\n20\n5\n40\n2")), null);
    assert.equal(dxfToSvgGeometry(wrapEntities("0\nLINE\n10\nNaN\n20\n0\n11\n4\n21\n4")), null);
  });
});
