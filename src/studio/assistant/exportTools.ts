import { z } from "zod";
import type { FencingJob } from "../domain.ts";
import { exportDxf } from "../architect/exchange.ts";
import { exportIfc } from "../architect/ifc.ts";
import { designQuantities } from "../architect/geometry.ts";
import type { ArchitectProject } from "../architect/model.ts";
import { exportDrawingPdf, exportMaterialSnapshotPdf, saveDownload, sheetViewports } from "../architect/sheets.ts";
import { authoredSheets, changeAuthoredSheets } from "../architect/authoredSheetSet.ts";
import { exportSheetRegister, readSheetLifecycle, sheetSourceIdentity } from "../sheetLifecycle.ts";

const id = z.string().min(1).max(100);
export const exportFormats = ["dxf", "ifc", "drawing-pdf", "material-pdf", "sheet-register"] as const;
export type ExportFormat = (typeof exportFormats)[number];
/** expectedRevision binds the authored design revision for design formats and the project record revision for the sheet register. sheetId is only accepted with drawing-pdf. */
export const exportDesignSchema = z.object({
  expectedJobId: id, expectedRevision: z.number().int().positive(), format: z.enum(exportFormats), sheetId: id.optional(),
}).strict().superRefine((value, context) => {
  if (value.sheetId !== undefined && value.format !== "drawing-pdf")
    context.addIssue({ code: "custom", path: ["sheetId"], message: "sheetId only selects a drawing sheet for the drawing-pdf format." });
});
export type ExportDesignInput = z.infer<typeof exportDesignSchema>;

export type ExportDeliveryDeps = {
  /** Hands the exact bytes to the user; the browser wiring is `browserDownload`. When absent the receipt reports downloaded: false. */
  download?(name: string, bytes: Uint8Array, mimeType: string): void | Promise<void>;
  /** Receipt scope for a non-browser download handler (MCP/headless callers must say where the bytes went); defaults to the browser-download statement. */
  deliveryScope?: string;
  /** SHA-256 of the exact bytes as lowercase hex; defaults to WebCrypto. */
  digest?(bytes: Uint8Array): Promise<string>;
};
export type SheetRegisterJob = Pick<FencingJob, "id" | "revision" | "documents" | "activeDocumentId">;
/** The design formats read the mounted authored design; the sheet register reads the project record and the Sheets pane sidecar. */
export type ExportSources = {
  project?: ArchitectProject | null;
  job?: SheetRegisterJob | null;
  storage?: Pick<Storage, "getItem"> | null;
};

export const EXPORT_SCOPE = "File offered by the browser download; nothing was uploaded or sent anywhere.";
// eslint-disable-next-line no-control-regex
const FILE_NAME_FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/g;

/** byteOffset-safe SHA-256 hex over exactly the bytes passed (mirrors documents.ts hashBytes). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw Error("Secure hashing is unavailable in this session, so the export was not delivered.");
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return [...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", source))].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Browser delivery: the same Blob + anchor path the Sketch export buttons use (sheets.ts saveDownload). */
export function browserDownload(name: string, bytes: Uint8Array, mimeType: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") throw Error("Downloading an export requires a browser.");
  saveDownload(bytes, name, mimeType);
}

type Generated = { bytes: Uint8Array; fileName: string; mimeType: string; deterministic: boolean; detail: Record<string, unknown> };

function encode(text: string): Uint8Array { return new TextEncoder().encode(text); }
function fail(format: ExportFormat, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  throw Error(`${format} export did not complete: ${message}`);
}

async function generateDesignFile(project: ArchitectProject, input: ExportDesignInput): Promise<Generated> {
  const { format } = input;
  try {
    if (format === "dxf") {
      return { bytes: encode(await exportDxf(project)), fileName: "architect-design.dxf", mimeType: "application/dxf", deterministic: true,
        detail: { levels: project.levels.length, units: "mm", note: "AC1027 DXF with the parametric model embedded in comment lines; the same design produces identical bytes." } };
    }
    if (format === "ifc") {
      return { bytes: encode(exportIfc(project)), fileName: "architect-design.ifc", mimeType: "application/x-step", deterministic: false,
        detail: { schema: "IFC4", note: "The IFC header carries the export timestamp, so repeated exports of the same design differ in sha256." } };
    }
    if (format === "drawing-pdf") {
      const view = input.sheetId ? changeAuthoredSheets(project, { type: "select", sheetId: input.sheetId }) : project;
      const set = authoredSheets(view), active = set.sheets.find(sheet => sheet.id === set.activeId);
      const number = view.sheet.number.trim();
      return { bytes: await exportDrawingPdf(view), fileName: `${(number || "Drawing sheet").replace(FILE_NAME_FORBIDDEN, "_")}.pdf`, mimeType: "application/pdf", deterministic: false,
        detail: { sheetId: set.activeId, sheetName: active?.name ?? null, sheetNumber: view.sheet.number, paper: view.sheet.size, scale: view.sheet.scale, viewports: sheetViewports(view).length, pageCount: 1,
          note: "Vector drawing of one authored sheet; the PDF carries creation dates, so repeated exports differ in sha256." } };
    }
    const snapshot = await exportMaterialSnapshotPdf(project);
    return { bytes: snapshot.bytes, fileName: `Authored design revision ${project.revision}.pdf`, mimeType: "application/pdf", deterministic: true,
      detail: { pageCount: snapshot.pageCount, quantityRows: designQuantities(project).rows.filter(row => row.areaM2 > 1e-9).length, importedAsEvidence: false, materialRegisterSynced: false,
        note: "Download only. The snapshot was not imported as plan evidence and the material register was not synced; use the Sync design materials control for that." } };
  } catch (error) {
    fail(format, error);
  }
}

function generateSheetRegister(job: SheetRegisterJob, storage: Pick<Storage, "getItem">): Generated {
  const document = job.documents.find(doc => doc.id === job.activeDocumentId);
  if (!document) throw Error("No source drawing is open.");
  const identity = sheetSourceIdentity(job.id, document);
  if (!identity) throw Error(document.source === "sample" ? "The active source is the bundled sample; sample sheets are not exported as a register." : "The active source has no verified identity yet.");
  try {
    const lifecycle = readSheetLifecycle(identity, storage);
    const text = exportSheetRegister(lifecycle, document.name);
    return { bytes: encode(text), fileName: `${document.name.replace(/[^a-z0-9_-]/gi, "_")}.sheet-register.json`, mimeType: "application/json", deterministic: true,
      detail: { documentId: document.id, sourceName: document.name, sourceSha256: identity.sha256, pageCount: identity.pageCount, lifecycleRevision: lifecycle.revision,
        sheets: lifecycle.pages.length, archived: lifecycle.pages.filter(page => page.archived).length,
        note: lifecycle.revision === 0 ? "No sheet organisation has been saved for this source yet; the register lists the original pages with default names." : "Register read from the same saved sidecar the Sheets pane uses." } };
  } catch (error) {
    fail("sheet-register", error);
  }
}

export type ExportReceipt = {
  projectId: string; expectedRevision: number; format: ExportFormat; fileName: string; mimeType: string;
  bytes: Uint8Array; byteLength: number; sha256: string; deterministic: boolean;
  downloaded: boolean; savedToDiskVerified: false; readbackVerified: false; scope: string;
} & Record<string, unknown>;

/**
 * Generates one export exactly once through the existing exporters, hashes the exact bytes, hands the same Uint8Array to deps.download
 * and returns a receipt. Nothing is written to the project record, the design or any sidecar; no file path is ever known.
 */
export async function exportDesign(sources: ExportSources, input: unknown, deps: ExportDeliveryDeps = {}): Promise<ExportReceipt> {
  const args = exportDesignSchema.parse(input);
  let generated: Generated;
  if (args.format === "sheet-register") {
    const job = sources.job;
    if (!job) throw Error("Project context is unavailable. Read project context again.");
    if (job.id !== args.expectedJobId) throw Error("The active project changed. Read project context again.");
    if (job.revision !== args.expectedRevision) throw Error("The project revision changed. Read project context again before exporting.");
    if (!sources.storage) throw Error("Sheet organisation storage is unavailable in this session.");
    generated = generateSheetRegister(job, sources.storage);
  } else {
    const project = sources.project;
    if (!project) throw Error("Open Sketch → Architectural workspace and read the design before exporting.");
    if (project.id !== args.expectedJobId) throw Error("The active project changed. Read project context again.");
    if (project.revision !== args.expectedRevision) throw Error("The design revision changed. Read the design again before exporting.");
    generated = await generateDesignFile(project, args);
  }
  const { bytes, fileName, mimeType, deterministic, detail } = generated;
  if (bytes.byteLength === 0) throw Error(`${args.format} export produced no bytes; nothing was delivered.`);
  const sha256 = await (deps.digest ?? sha256Hex)(bytes);
  let downloaded = false;
  if (deps.download) { await deps.download(fileName, bytes, mimeType); downloaded = true; }
  const design = args.format === "sheet-register" ? {} : { designName: sources.project!.name, demonstration: /demonstration/i.test(sources.project!.name) };
  return {
    ...detail, ...design,
    projectId: args.expectedJobId, expectedRevision: args.expectedRevision, format: args.format, fileName, mimeType,
    bytes, byteLength: bytes.byteLength, sha256, deterministic,
    downloaded, savedToDiskVerified: false, readbackVerified: false,
    scope: downloaded ? (deps.deliveryScope ?? EXPORT_SCOPE) : "File generated but no download handler was available; nothing was uploaded or sent anywhere.",
  };
}

/** Receipt for the assistant transcript: the same fields without the raw bytes. */
export function describeExportReceipt(receipt: ExportReceipt): Omit<ExportReceipt, "bytes"> {
  const { bytes: _bytes, ...rest } = receipt;
  return rest;
}
