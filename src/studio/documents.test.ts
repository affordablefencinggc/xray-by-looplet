import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { MAX_PLAN_BYTES } from "./documentContract.ts";
import { inspectPlanBytes, PlanInspectionError } from "./documents.ts";

const encoder = new TextEncoder();
const at = "2026-09-04T00:00:00.000Z";

function bytes(value: string) {
  return encoder.encode(value);
}

function minimalPdf(pageCount = 2) {
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const id = index + 3;
    return `${id} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj`;
  });
  const kids = pages.map((_, index) => `${index + 3} 0 R`).join(" ");
  return bytes([
    "%PDF-1.4",
    "1 0 obj",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "endobj",
    "2 0 obj",
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
    "endobj",
    ...pages,
    "trailer",
    "<< /Root 1 0 R >>",
    "%%EOF",
  ].join("\n"));
}

describe("inspectPlanBytes", () => {
  it("inspects a PDF, hashes the real bytes, and counts page-tree leaves", async () => {
    const source = minimalPdf(2);
    const result = await inspectPlanBytes({ name: "boundary.PDF", bytes: source, source: "web" }, at);

    assert.equal(result.revision.kind, "pdf");
    assert.equal(result.revision.pageCount, 2);
    assert.equal(result.revision.importedAt, at);
    assert.equal(result.binary.mimeType, "application/pdf");
    assert.equal(result.binary.sizeBytes, source.byteLength);
    assert.equal(result.binary.sha256, createHash("sha256").update(source).digest("hex"));
    assert.equal(result.binary.documentId, result.revision.id);
    assert.notEqual(result.binary.bytes, source, "inspection keeps an immutable byte copy");
  });

  it("accepts minimal ASCII DXF and assigns one logical page", async () => {
    const source = bytes("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n");
    const result = await inspectPlanBytes({ name: "site.dxf", bytes: source, source: "desktop" }, at);

    assert.equal(result.revision.kind, "dxf");
    assert.equal(result.revision.pageCount, 1);
    assert.equal(result.binary.mimeType, "application/dxf");
    assert.equal(result.binary.sha256, createHash("sha256").update(source).digest("hex"));
  });

  it("accepts minimal SVG and preserves a supplied takeoff", async () => {
    const source = bytes('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><line x2="1"/></svg>');
    const takeoff = { quantities: [] };
    const result = await inspectPlanBytes({ name: "site.svg", bytes: source, source: "web", takeoff }, at);

    assert.equal(result.revision.pageCount, 1);
    assert.equal(result.binary.mimeType, "image/svg+xml");
    assert.equal(result.takeoff, takeoff);
  });

  it("gives every import a unique document id", async () => {
    const source = minimalPdf(1);
    const first = await inspectPlanBytes({ name: "one.pdf", bytes: source, source: "web" }, at);
    const second = await inspectPlanBytes({ name: "one.pdf", bytes: source, source: "web" }, at);
    assert.notEqual(first.revision.id, second.revision.id);
  });

  it("rejects empty and unsupported files", async () => {
    await assert.rejects(
      inspectPlanBytes({ name: "empty.pdf", bytes: new Uint8Array(), source: "web" }),
      (error: unknown) => error instanceof PlanInspectionError && error.code === "empty",
    );
    await assert.rejects(
      inspectPlanBytes({ name: "model.ifc", bytes: bytes("ISO-10303-21"), source: "web" }),
      (error: unknown) => error instanceof PlanInspectionError && error.code === "unsupported",
    );
  });

  it("rejects extension/content mismatches and bad magic", async () => {
    await assert.rejects(
      inspectPlanBytes({ name: "renamed.pdf", bytes: bytes("<svg></svg>"), source: "web" }),
      (error: unknown) => error instanceof PlanInspectionError && error.code === "type-mismatch" && /SVG data/.test(error.message),
    );
    await assert.rejects(
      inspectPlanBytes({ name: "garbage.dxf", bytes: bytes("not a drawing"), source: "desktop" }),
      (error: unknown) => error instanceof PlanInspectionError && error.code === "type-mismatch",
    );
  });

  it("rejects bytes beyond the 100 MB boundary before hashing", async () => {
    const oversized = new Uint8Array(MAX_PLAN_BYTES + 1);
    await assert.rejects(
      inspectPlanBytes({ name: "huge.pdf", bytes: oversized, source: "web" }),
      (error: unknown) => error instanceof PlanInspectionError && error.code === "too-large",
    );
  });

  it("fails conservatively when a PDF page tree cannot be counted", async () => {
    const source = bytes("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
    await assert.rejects(
      inspectPlanBytes({ name: "uncountable.pdf", bytes: source, source: "web" }),
      (error: unknown) => error instanceof PlanInspectionError && error.code === "malformed" && /page tree/.test(error.message),
    );
  });

  it("rejects a PDF whose declared count contradicts its page tree", async () => {
    const source = new Uint8Array(minimalPdf(2));
    const text = new TextDecoder().decode(source).replace("/Count 2", "/Count 3");
    await assert.rejects(
      inspectPlanBytes({ name: "bad-count.pdf", bytes: bytes(text), source: "web" }),
      (error: unknown) => error instanceof PlanInspectionError && error.code === "malformed" && /does not match/.test(error.message),
    );
  });

  it("counts the repository's compressed and uncompressed PDF fixtures", async () => {
    const fixtures = [
      ["shed-manners-aline.pdf", 5],
      ["residential-ruffles-seeka.pdf", 24],
      ["electrical-schedule.pdf", 1],
    ] as const;
    for (const [name, expectedPages] of fixtures) {
      const path = fileURLToPath(new URL(`../../engine/fixtures/${name}`, import.meta.url));
      const plan = await inspectPlanBytes({ name, bytes: new Uint8Array(await readFile(path)), source: "web" }, at);
      assert.equal(plan.revision.pageCount, expectedPages, name);
      assert.equal(plan.revision.sha256?.length, 64, name);
    }
  });
});
