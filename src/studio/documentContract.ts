import type { DocumentRevision } from "./domain";

export const MAX_PLAN_BYTES = 100 * 1024 * 1024;
export const PLAN_CONTENT_DB = "xray-plan-content-v1";
export const PLAN_CONTENT_STORE = "documents";

export type SupportedPlanKind = Extract<DocumentRevision["kind"], "pdf" | "dxf" | "svg">;

export type PlanBinary = {
  documentId: string;
  name: string;
  kind: SupportedPlanKind;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  bytes: Uint8Array;
};

export type ImportedPlan = {
  revision: DocumentRevision;
  binary: PlanBinary;
  takeoff: unknown | null;
  note: string;
};

export type StoredPlanContent = Omit<PlanBinary, "bytes"> & {
  bytes: ArrayBuffer;
};

export interface PlanContentStore {
  get(documentId: string): Promise<StoredPlanContent | null>;
  put(content: StoredPlanContent): Promise<void>;
  remove(documentId: string): Promise<void>;
}

export type DesktopPlanPayload = {
  name: string;
  kind: SupportedPlanKind;
  mimeType: string;
  sizeBytes: number;
  bytesBase64: string;
  takeoff: unknown | null;
};
