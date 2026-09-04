import { MAX_PLAN_BYTES, type DesktopPlanPayload, type ImportedPlan } from "./documentContract.ts";
import { inspectPlanBytes, PlanInspectionError } from "./documents.ts";

export type XRayHost = "tauri" | "web";

export class PlanImportCancelledError extends Error {
  constructor() {
    super("Plan import cancelled.");
    this.name = "PlanImportCancelledError";
  }
}

export function detectHost(hostWindow: unknown = typeof window === "undefined" ? undefined : window): XRayHost {
  if (hostWindow && typeof hostWindow === "object") {
    try {
      const internals = (hostWindow as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
      if (internals && typeof internals === "object" && typeof (internals as { invoke?: unknown }).invoke === "function") return "tauri";
    } catch {
      // A hostile or partially initialised host object is not an active bridge.
    }
  }
  return "web";
}

/**
 * Pick, read and inspect a plan using one contract in every host.
 *
 * Cancellation rejects with `PlanImportCancelledError` so callers can leave
 * their current document untouched without manufacturing an invalid plan.
 */
export async function pickAndImportPlan(): Promise<ImportedPlan> {
  if (detectHost() === "tauri") return importDesktopPlan();
  return importWebPlan();
}

async function importDesktopPlan(): Promise<ImportedPlan> {
  const { invoke } = await import("@tauri-apps/api/core");
  const unknownPayload = await invoke<unknown>("xray_import_plan");
  if (unknownPayload === null) throw new PlanImportCancelledError();

  const payload = parseDesktopPayload(unknownPayload);
  const bytes = decodeDesktopBytes(payload);
  const imported = await inspectPlanBytes({
    name: payload.name,
    bytes,
    source: "desktop",
    takeoff: payload.takeoff,
  });

  if (imported.binary.kind !== payload.kind || imported.binary.mimeType !== payload.mimeType) {
    throw new PlanInspectionError(
      "type-mismatch",
      "The desktop file metadata did not match its inspected plan contents.",
    );
  }
  return {
    ...imported,
    note: payload.takeoff
      ? `${imported.note} Local takeoff completed.`
      : `${imported.note} Local takeoff is not available yet.`,
  };
}

async function importWebPlan(): Promise<ImportedPlan> {
  const file = await pickWebPlan();
  return importPlanFile(file);
}

export async function importPlanFile(file: File): Promise<ImportedPlan> {
  if (file.size === 0) throw new PlanInspectionError("empty", `${file.name} is empty.`);
  if (file.size > MAX_PLAN_BYTES) {
    throw new PlanInspectionError(
      "too-large",
      `${file.name} is larger than the 100 MB plan limit. Export a smaller plan set and try again.`,
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return inspectPlanBytes({ name: file.name, bytes, source: "web", takeoff: null });
}

function pickWebPlan(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,.pdf,.dxf,.svg,image/svg+xml";
    input.hidden = true;
    document.body.append(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      if (file) resolve(file);
      else reject(new PlanImportCancelledError());
    };

    input.addEventListener("change", () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => finish(null), { once: true });
    input.click();
  });
}

function parseDesktopPayload(value: unknown): DesktopPlanPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PlanInspectionError("malformed", "The desktop host returned an invalid plan payload.");
  }
  const payload = value as Partial<DesktopPlanPayload>;
  const kindOk = payload.kind === "pdf" || payload.kind === "dxf" || payload.kind === "svg";
  const sizeOk =
    Number.isSafeInteger(payload.sizeBytes) &&
    Number(payload.sizeBytes) > 0 &&
    Number(payload.sizeBytes) <= MAX_PLAN_BYTES;
  if (
    typeof payload.name !== "string" ||
    !kindOk ||
    typeof payload.mimeType !== "string" ||
    !sizeOk ||
    typeof payload.bytesBase64 !== "string" ||
    !("takeoff" in payload)
  ) {
    throw new PlanInspectionError("malformed", "The desktop host returned incomplete plan data.");
  }

  const expectedEncodedLength = Math.ceil(Number(payload.sizeBytes) / 3) * 4;
  if (payload.bytesBase64.length !== expectedEncodedLength) {
    throw new PlanInspectionError("malformed", "The desktop plan byte count did not match its payload.");
  }
  return payload as DesktopPlanPayload;
}

function decodeDesktopBytes(payload: DesktopPlanPayload): Uint8Array {
  let decoded: string;
  try {
    decoded = globalThis.atob(payload.bytesBase64);
  } catch {
    throw new PlanInspectionError("malformed", "The desktop host returned invalid base64 plan data.");
  }
  if (decoded.length !== payload.sizeBytes) {
    throw new PlanInspectionError("malformed", "The decoded desktop plan size did not match its payload.");
  }
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}
