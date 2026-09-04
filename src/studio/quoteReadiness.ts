import { getJobBlockers, type FencingJob, type JobBlocker } from "./domain.ts";

export type AssetState = "idle" | "loading" | "ready" | "missing" | "corrupt" | "unverified";

export type AssetReadiness = {
  state: AssetState;
  message: string | null;
};

export type RuntimeAssetReadiness = {
  document: AssetReadiness;
  photos: Record<string, AssetReadiness>;
};

export type RuntimeJobBlocker =
  | JobBlocker
  | {
      code: "document-original" | "photo-original" | "hydration";
      message: string;
      entityId?: string;
    };

export type QuoteReadiness = {
  ready: boolean;
  blockers: RuntimeJobBlocker[];
};

export const EMPTY_RUNTIME_ASSET_READINESS: RuntimeAssetReadiness = {
  document: { state: "idle", message: null },
  photos: {},
};

/** Combines deterministic domain blockers with verified runtime-original availability. */
export function getQuoteReadiness(
  job: FencingJob,
  runtime: RuntimeAssetReadiness,
  hydrationSettled = true,
): QuoteReadiness {
  const blockers: RuntimeJobBlocker[] = [...getJobBlockers(job)];
  if (!hydrationSettled) {
    blockers.push({
      code: "hydration",
      message: "Saved job and original assets are still loading.",
    });
    return { ready: false, blockers };
  }

  const activeDocument = job.documents.find((document) => document.id === job.activeDocumentId);
  if (activeDocument && activeDocument.source !== "sample") {
    if (runtime.document.state !== "ready") {
      blockers.push({
        code: "document-original",
        entityId: activeDocument.id,
        message:
          runtime.document.message ??
          `${activeDocument.name} original bytes have not been verified.`,
      });
    }
  }

  for (const photo of job.photos) {
    const asset = runtime.photos[photo.id];
    if (!asset || asset.state !== "ready") {
      blockers.push({
        code: "photo-original",
        entityId: photo.id,
        message: asset?.message ?? `${photo.name} original bytes have not been verified.`,
      });
    }
  }
  return { ready: blockers.length === 0, blockers };
}
