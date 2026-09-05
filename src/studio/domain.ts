import { z } from "zod";
import {
  calibrationSchema,
  createUnverifiedCalibration,
  IDENTITY_DOCUMENT_TO_CANVAS,
} from "./calibration.ts";

export { calibrationSchema } from "./calibration.ts";
export type { Calibration } from "./calibration.ts";

export const JOB_SCHEMA_VERSION = 2 as const;
export const LEGACY_JOB_SCHEMA_VERSION = 1 as const;

const isoDateTime = z.string().datetime({ offset: true });
const pointSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
const requiredEntityRevision = z
  .number()
  .int()
  .positive()
  .optional()
  .superRefine((revision, context) => {
    if (revision === undefined)
      context.addIssue({ code: "custom", message: "Version 2 entities require a revision." });
  });

export const fenceSystemSchema = z.enum([
  "unselected",
  "colorbond",
  "timber-paling",
  "pool",
  "chain-wire",
  "custom",
]);
export const groundTypeSchema = z.enum([
  "unselected",
  "soil",
  "concrete",
  "rock",
  "retaining-wall",
  "mixed",
]);
export const reviewStatusSchema = z.enum(["draft", "needs-review", "approved", "rejected"]);

export const runCornerSchema = z.object({
  id: z.string().min(1),
  vertexIndex: z.number().int().nonnegative(),
  treatment: z.enum(["standard", "boxed", "mitred", "end", "custom"]),
  notes: z.string().max(500),
});

export const postOverrideSchema = z.object({
  id: z.string().min(1),
  vertexIndex: z.number().int().nonnegative(),
  postSize: z.string().max(120),
  lengthM: z.number().positive().max(10).nullable(),
  embedmentM: z.number().positive().max(5).nullable(),
  notes: z.string().max(500),
});

export const siteDetailsSchema = z.object({
  address: z.string().max(300),
  estimator: z.string().max(120),
  inspectionDate: z.string().max(20),
  notes: z.string().max(5000),
});

export const documentRevisionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(300),
  kind: z.enum(["pdf", "dxf", "svg", "ifc", "unknown"]),
  importedAt: isoDateTime,
  pageCount: z.number().int().positive().nullable(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  source: z.enum(["sample", "web", "desktop"]),
});

export const runSpecificationSchema = z.object({
  system: fenceSystemSchema,
  customSystem: z.string().max(120),
  profile: z.string().max(120),
  heightM: z.number().positive().max(10).nullable(),
  bayWidthM: z.number().positive().max(20).nullable(),
  ground: groundTypeSchema,
  slope: z.enum(["unselected", "level", "stepped", "raked", "mixed"]),
  removalRequired: z.boolean(),
  removalMaterial: z.string().max(120),
  removalLengthM: z.number().positive().max(10000).nullable(),
  disposalRequired: z.boolean(),
  access: z.enum(["unselected", "clear", "restricted", "hand-carry", "plant-required"]),
  sleepers: z.enum(["none", "timber", "concrete", "custom", "unselected"]),
  retainingRequired: z.boolean(),
  retainingType: z.enum([
    "unselected",
    "none",
    "timber-sleeper",
    "concrete-sleeper",
    "masonry",
    "existing",
    "custom",
  ]),
  retainingHeightM: z.number().nonnegative().max(10).nullable(),
  retainingCondition: z.string().max(500),
  corners: z.array(runCornerSchema),
  postOverrides: z.array(postOverrideSchema),
  notes: z.string().max(2000),
});

export const gateSpecificationSchema = z.object({
  widthM: z.number().positive().max(30).nullable(),
  heightM: z.number().positive().max(10).nullable(),
  type: z.enum(["unselected", "single", "double", "sliding", "pedestrian", "custom"]),
  customType: z.string().max(120),
  openingDirection: z.enum([
    "unselected",
    "inward",
    "outward",
    "sliding-left",
    "sliding-right",
    "reversible",
    "not-applicable",
  ]),
  hingeSide: z.enum(["unselected", "left", "right", "double", "not-applicable"]),
  hardware: z.string().max(500),
  latch: z.string().max(200),
  postSize: z.string().max(120),
  finish: z.string().max(200),
  clearanceM: z.number().nonnegative().max(5).nullable(),
  motorised: z.boolean(),
  notes: z.string().max(1000),
});

export const revisionEventSchema = z.object({
  id: z.string().min(1),
  sequence: z.number().int().positive(),
  occurredAt: isoDateTime,
  entityType: z.enum(["job", "run", "gate", "photo"]),
  entityId: z.string().min(1),
  action: z.enum(["create", "update", "delete", "reorder", "link", "unlink", "approve", "reject"]),
  summary: z.string().min(1).max(500),
});

export const reviewDecisionSchema = z
  .object({
    status: reviewStatusSchema,
    decidedAt: isoDateTime.nullable(),
    decidedBy: z.string().max(120),
    note: z.string().max(1000),
  })
  .superRefine((decision, context) => {
    const isDecision = decision.status === "approved" || decision.status === "rejected";
    if (isDecision && decision.decidedAt === null) {
      context.addIssue({
        code: "custom",
        path: ["decidedAt"],
        message: "Approved and rejected decisions require a decision timestamp.",
      });
    }
    if (isDecision && !decision.decidedBy.trim()) {
      context.addIssue({
        code: "custom",
        path: ["decidedBy"],
        message: "Approved and rejected decisions require an actor.",
      });
    }
    if (!isDecision && decision.decidedAt !== null) {
      context.addIssue({
        code: "custom",
        path: ["decidedAt"],
        message: "Draft and needs-review records cannot retain a decision timestamp.",
      });
    }
    if (!isDecision && decision.decidedBy.trim()) {
      context.addIssue({
        code: "custom",
        path: ["decidedBy"],
        message: "Draft and needs-review records cannot retain a decision actor.",
      });
    }
  });

export const fenceRunSchema = z.object({
  id: z.string().min(1),
  revision: requiredEntityRevision,
  sheet: z.number().int().nonnegative(),
  label: z.string().min(1).max(120),
  points: z.array(pointSchema).min(2),
  lengthM: z.number().nonnegative().finite(),
  grossLengthM: z.number().nonnegative().finite().optional(),
  gateDeductionM: z.number().nonnegative().finite().optional(),
  netLengthM: z.number().nonnegative().finite().optional(),
  specification: runSpecificationSchema,
  photoIds: z.array(z.string()),
  review: reviewDecisionSchema,
});

export const gateSchema = z
  .object({
    id: z.string().min(1),
    revision: requiredEntityRevision,
    sheet: z.number().int().nonnegative(),
    label: z.string().min(1).max(120),
    point: pointSchema,
    runId: z.string().nullable(),
    segmentIndex: z.number().int().nonnegative().nullable().optional(),
    segmentT: z.number().min(0).max(1).nullable().optional(),
    photoIds: z.array(z.string()),
    review: reviewDecisionSchema,
  })
  .merge(gateSpecificationSchema);

export const photoEvidenceSchema = z.object({
  id: z.string().min(1),
  revision: z.number().int().positive(),
  name: z.string().min(1).max(300),
  mimeType: z.string().max(120),
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(25 * 1024 * 1024),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  order: z.number().int().nonnegative(),
  addedAt: isoDateTime,
  updatedAt: isoDateTime,
  capturedAt: isoDateTime.nullable(),
  source: z.enum(["web", "desktop"]),
  caption: z.string().max(500),
  runIds: z.array(z.string()),
  gateIds: z.array(z.string()),
});

export const bomLineSchema = z.object({
  id: z.string().min(1),
  item: z.string().min(1),
  quantity: z.number().nonnegative().finite(),
  unit: z.string().min(1).max(20),
  formula: z.string(),
  confidenceTier: z.enum(["reconciled", "single-source", "needs-human"]),
  evidenceIds: z.array(z.string()),
  rate: z.number().nonnegative().finite().nullable(),
  amount: z.number().nonnegative().finite().nullable(),
  reviewRequired: z.boolean(),
});

export const quoteDraftSchema = z.object({
  id: z.string().min(1),
  createdAt: isoDateTime,
  status: z.enum(["unpriced", "ready", "sent"]),
  lines: z.array(bomLineSchema),
  subtotal: z.number().nonnegative().finite().nullable(),
  tax: z.number().nonnegative().finite().nullable(),
  total: z.number().nonnegative().finite().nullable(),
  loopletReceipt: z.string().nullable(),
});

export const sourceAnnotationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["sketch", "area"]),
  label: z.string().max(200),
  value: z.number().finite().nonnegative(),
  unit: z.string().max(20),
  sheet: z.number().int().nonnegative(),
  points: z.array(pointSchema).min(2).max(100000),
  documentId: z.string().min(1),
  sourceSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  coordinateSpace: z.enum(["source-page-v1", "legacy-unverified"]),
});
export const documentWorkspaceSchema = z.object({
  documentId: z.string().min(1),
  sourceSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  sheet: z.number().int().nonnegative(),
  calibrations: z.array(calibrationSchema),
  runs: z.array(fenceRunSchema),
  gates: z.array(gateSchema),
  annotations: z.array(sourceAnnotationSchema).max(10000),
  photos: z.array(photoEvidenceSchema),
  bom: z.array(bomLineSchema),
  quoteDraft: quoteDraftSchema.nullable(),
  status: z.enum(["draft", "in-review", "quote-ready", "sent"]),
  revisionHistory: z.array(revisionEventSchema).max(1000),
});
const fencingJobDataSchema = z.object({
  schemaVersion: z.literal(JOB_SCHEMA_VERSION),
  id: z.string().min(1),
  revision: z.number().int().positive(),
  name: z.string().min(1).max(200),
  trade: z.literal("fencing"),
  status: z.enum(["draft", "in-review", "quote-ready", "sent"]),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  site: siteDetailsSchema,
  documents: z.array(documentRevisionSchema),
  activeDocumentId: z.string().nullable(),
  calibrations: z.array(calibrationSchema),
  runs: z.array(fenceRunSchema),
  gates: z.array(gateSchema),
  photos: z.array(photoEvidenceSchema),
  bom: z.array(bomLineSchema),
  quoteDraft: quoteDraftSchema.nullable(),
  revisionHistory: z.array(revisionEventSchema).max(1000),
  annotations: z.array(sourceAnnotationSchema).max(10000).optional(),
  documentWorkspaces: z.record(z.string(), documentWorkspaceSchema).optional(),
  activeSheet: z.number().int().nonnegative().optional(),
  componentRegistry: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).max(200),
        note: z.string().max(1000),
      }),
    )
    .max(1000)
    .optional(),
});
function refineFencingJob(
  job: z.infer<typeof fencingJobDataSchema>,
  context: z.RefinementCtx,
): void {
  const documentIds = new Set<string>();
  for (let index = 0; index < job.documents.length; index += 1) {
    const document = job.documents[index];
    if (documentIds.has(document.id)) {
      context.addIssue({
        code: "custom",
        path: ["documents", index, "id"],
        message: `Duplicate document revision ID: ${document.id}.`,
      });
    }
    documentIds.add(document.id);
  }
  if (job.activeDocumentId !== null && !documentIds.has(job.activeDocumentId)) {
    context.addIssue({
      code: "custom",
      path: ["activeDocumentId"],
      message: `Active document ${job.activeDocumentId} is not present in the document revisions.`,
    });
  }
  const sheets = new Set<number>();
  for (let index = 0; index < job.calibrations.length; index += 1) {
    const sheet = job.calibrations[index].sheet;
    if (sheets.has(sheet)) {
      context.addIssue({
        code: "custom",
        path: ["calibrations", index, "sheet"],
        message: `Only one calibration is allowed for sheet ${sheet}.`,
      });
    }
    sheets.add(sheet);
  }
  const runIds = new Set<string>();
  for (let index = 0; index < job.runs.length; index += 1) {
    const run = job.runs[index];
    if (run.revision === undefined) {
      context.addIssue({
        code: "custom",
        path: ["runs", index, "revision"],
        message: "Version 2 fence runs require a revision.",
      });
    }
    if (runIds.has(run.id)) {
      context.addIssue({
        code: "custom",
        path: ["runs", index, "id"],
        message: `Duplicate fence run ID: ${run.id}.`,
      });
    }
    runIds.add(run.id);
    const lengthFieldCount = [run.grossLengthM, run.gateDeductionM, run.netLengthM].filter(
      (value) => value !== undefined,
    ).length;
    if (lengthFieldCount !== 0 && lengthFieldCount !== 3) {
      context.addIssue({
        code: "custom",
        path: ["runs", index],
        message: "Run gross, gate deduction and net lengths must be recorded together.",
      });
    }
    if (
      run.netLengthM !== undefined &&
      run.grossLengthM !== undefined &&
      run.gateDeductionM !== undefined
    ) {
      const expectedNet = Math.max(0, run.grossLengthM - run.gateDeductionM);
      if (
        Math.abs(run.netLengthM - expectedNet) > 1e-9 ||
        Math.abs(run.lengthM - run.netLengthM) > 1e-9
      ) {
        context.addIssue({
          code: "custom",
          path: ["runs", index],
          message: "Run gross, gate deduction, net and compatibility lengths are inconsistent.",
        });
      }
    }
    const cornerIds = new Set<string>();
    const cornerVertices = new Set<number>();
    for (let cornerIndex = 0; cornerIndex < run.specification.corners.length; cornerIndex += 1) {
      const corner = run.specification.corners[cornerIndex];
      if (cornerIds.has(corner.id) || cornerVertices.has(corner.vertexIndex)) {
        context.addIssue({
          code: "custom",
          path: ["runs", index, "specification", "corners", cornerIndex],
          message: "Each run vertex may have only one uniquely identified corner treatment.",
        });
      }
      if (corner.vertexIndex >= run.points.length) {
        context.addIssue({
          code: "custom",
          path: ["runs", index, "specification", "corners", cornerIndex, "vertexIndex"],
          message: "Corner treatment references a vertex outside the run.",
        });
      }
      cornerIds.add(corner.id);
      cornerVertices.add(corner.vertexIndex);
    }
    const postIds = new Set<string>();
    const postVertices = new Set<number>();
    for (let postIndex = 0; postIndex < run.specification.postOverrides.length; postIndex += 1) {
      const post = run.specification.postOverrides[postIndex];
      if (postIds.has(post.id) || postVertices.has(post.vertexIndex)) {
        context.addIssue({
          code: "custom",
          path: ["runs", index, "specification", "postOverrides", postIndex],
          message: "Each run vertex may have only one uniquely identified post override.",
        });
      }
      if (post.vertexIndex >= run.points.length) {
        context.addIssue({
          code: "custom",
          path: ["runs", index, "specification", "postOverrides", postIndex, "vertexIndex"],
          message: "Post override references a vertex outside the run.",
        });
      }
      postIds.add(post.id);
      postVertices.add(post.vertexIndex);
    }
    if (new Set(run.photoIds).size !== run.photoIds.length) {
      context.addIssue({
        code: "custom",
        path: ["runs", index, "photoIds"],
        message: "Run photo links must be unique.",
      });
    }
  }
  const gateIds = new Set<string>();
  for (let index = 0; index < job.gates.length; index += 1) {
    const gate = job.gates[index];
    if (gate.revision === undefined) {
      context.addIssue({
        code: "custom",
        path: ["gates", index, "revision"],
        message: "Version 2 gates require a revision.",
      });
    }
    if (gateIds.has(gate.id)) {
      context.addIssue({
        code: "custom",
        path: ["gates", index, "id"],
        message: `Duplicate gate ID: ${gate.id}.`,
      });
    }
    gateIds.add(gate.id);
    if (
      (gate.segmentIndex === null) !== (gate.segmentT === null) ||
      (gate.segmentIndex === undefined) !== (gate.segmentT === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["gates", index],
        message: "Gate segment index and interpolation must be present together.",
      });
    }
    if (gate.runId) {
      const run = job.runs.find((entry) => entry.id === gate.runId);
      if (!run)
        context.addIssue({
          code: "custom",
          path: ["gates", index, "runId"],
          message: `Gate references missing run ${gate.runId}.`,
        });
      else if (run.sheet !== gate.sheet)
        context.addIssue({
          code: "custom",
          path: ["gates", index, "sheet"],
          message: "Gate and associated run must be on the same sheet.",
        });
      else if (
        gate.segmentIndex === undefined ||
        gate.segmentIndex === null ||
        gate.segmentT === undefined ||
        gate.segmentT === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["gates", index],
          message: "An associated gate requires a segment placement.",
        });
      } else if (gate.segmentIndex >= run.points.length - 1) {
        context.addIssue({
          code: "custom",
          path: ["gates", index, "segmentIndex"],
          message: "Gate segment is outside its associated run.",
        });
      } else {
        const start = run.points[gate.segmentIndex];
        const end = run.points[gate.segmentIndex + 1];
        const expected = {
          x: start.x + (end.x - start.x) * gate.segmentT,
          y: start.y + (end.y - start.y) * gate.segmentT,
        };
        if (Math.hypot(gate.point.x - expected.x, gate.point.y - expected.y) > 1e-6) {
          context.addIssue({
            code: "custom",
            path: ["gates", index, "point"],
            message: "Gate point does not match its segment placement.",
          });
        }
      }
    } else if (gate.segmentIndex !== undefined && gate.segmentIndex !== null) {
      context.addIssue({
        code: "custom",
        path: ["gates", index, "segmentIndex"],
        message: "An unassociated gate cannot retain a segment placement.",
      });
    }
    if (new Set(gate.photoIds).size !== gate.photoIds.length) {
      context.addIssue({
        code: "custom",
        path: ["gates", index, "photoIds"],
        message: "Gate photo links must be unique.",
      });
    }
  }
  const photoIds = new Set<string>();
  const photoOrders = new Set<number>();
  for (let index = 0; index < job.photos.length; index += 1) {
    const photo = job.photos[index];
    if (photoIds.has(photo.id)) {
      context.addIssue({
        code: "custom",
        path: ["photos", index, "id"],
        message: `Duplicate photo evidence ID: ${photo.id}.`,
      });
    }
    if (photoOrders.has(photo.order)) {
      context.addIssue({
        code: "custom",
        path: ["photos", index, "order"],
        message: `Duplicate photo evidence order: ${photo.order}.`,
      });
    }
    if (
      new Set(photo.runIds).size !== photo.runIds.length ||
      new Set(photo.gateIds).size !== photo.gateIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["photos", index],
        message: "Photo evidence links must be unique.",
      });
    }
    for (const runId of photo.runIds) {
      const run = job.runs.find((entry) => entry.id === runId);
      if (!run)
        context.addIssue({
          code: "custom",
          path: ["photos", index, "runIds"],
          message: `Photo references missing run ${runId}.`,
        });
      else if (!run.photoIds.includes(photo.id))
        context.addIssue({
          code: "custom",
          path: ["photos", index, "runIds"],
          message: `Photo and run ${runId} must link to each other.`,
        });
    }
    for (const gateId of photo.gateIds) {
      const gate = job.gates.find((entry) => entry.id === gateId);
      if (!gate)
        context.addIssue({
          code: "custom",
          path: ["photos", index, "gateIds"],
          message: `Photo references missing gate ${gateId}.`,
        });
      else if (!gate.photoIds.includes(photo.id))
        context.addIssue({
          code: "custom",
          path: ["photos", index, "gateIds"],
          message: `Photo and gate ${gateId} must link to each other.`,
        });
    }
    photoIds.add(photo.id);
    photoOrders.add(photo.order);
  }
  for (let expectedOrder = 0; expectedOrder < job.photos.length; expectedOrder += 1) {
    if (!photoOrders.has(expectedOrder)) {
      context.addIssue({
        code: "custom",
        path: ["photos"],
        message: "Photo evidence order must be contiguous from zero.",
      });
      break;
    }
  }
  for (let index = 0; index < job.runs.length; index += 1) {
    for (const photoId of job.runs[index].photoIds) {
      const photo = job.photos.find((entry) => entry.id === photoId);
      if (!photo || !photo.runIds.includes(job.runs[index].id)) {
        context.addIssue({
          code: "custom",
          path: ["runs", index, "photoIds"],
          message: `Run references missing or one-way photo ${photoId}.`,
        });
      }
    }
  }
  for (let index = 0; index < job.gates.length; index += 1) {
    for (const photoId of job.gates[index].photoIds) {
      const photo = job.photos.find((entry) => entry.id === photoId);
      if (!photo || !photo.gateIds.includes(job.gates[index].id)) {
        context.addIssue({
          code: "custom",
          path: ["gates", index, "photoIds"],
          message: `Gate references missing or one-way photo ${photoId}.`,
        });
      }
    }
  }
  const eventIds = new Set<string>();
  const eventSequences = new Set<number>();
  for (let index = 0; index < job.revisionHistory.length; index += 1) {
    const event = job.revisionHistory[index];
    if (
      eventIds.has(event.id) ||
      eventSequences.has(event.sequence) ||
      event.sequence > job.revision
    ) {
      context.addIssue({
        code: "custom",
        path: ["revisionHistory", index],
        message: "Revision events require unique IDs and sequences no newer than the job revision.",
      });
    }
    if (index > 0 && event.sequence <= job.revisionHistory[index - 1].sequence) {
      context.addIssue({
        code: "custom",
        path: ["revisionHistory", index, "sequence"],
        message: "Revision events must be stored in ascending sequence order.",
      });
    }
    eventIds.add(event.id);
    eventSequences.add(event.sequence);
  }

  const activeDocument = job.documents.find((item) => item.id === job.activeDocumentId);
  if (
    job.activeSheet !== undefined &&
    activeDocument?.pageCount != null &&
    job.activeSheet >= activeDocument.pageCount
  )
    context.addIssue({
      code: "custom",
      path: ["activeSheet"],
      message: "Active sheet is outside the selected source.",
    });
  const annotationIds = new Set<string>();
  for (const [index, annotation] of (job.annotations ?? []).entries()) {
    if (
      annotationIds.has(annotation.id) ||
      annotation.documentId !== job.activeDocumentId ||
      annotation.sourceSha256 !== (activeDocument?.sha256 ?? null) ||
      (activeDocument?.pageCount != null && annotation.sheet >= activeDocument.pageCount) ||
      (annotation.kind === "area" && annotation.points.length < 3) ||
      (annotation.coordinateSpace === "source-page-v1" && annotation.sourceSha256 === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["annotations", index],
        message: "Annotation identity, source binding or page is invalid.",
      });
    }
    annotationIds.add(annotation.id);
  }
  const snapshots = Object.entries(job.documentWorkspaces ?? {});
  if (snapshots.length > 100)
    context.addIssue({
      code: "custom",
      path: ["documentWorkspaces"],
      message: "Too many document workspaces.",
    });
  for (const [id, workspace] of snapshots) {
    const source = job.documents.find((item) => item.id === id);
    if (
      !source ||
      id !== workspace.documentId ||
      id === job.activeDocumentId ||
      workspace.sourceSha256 !== (source.sha256 ?? null) ||
      (source.pageCount != null && workspace.sheet >= source.pageCount)
    ) {
      context.addIssue({
        code: "custom",
        path: ["documentWorkspaces", id],
        message: "Workspace source binding or page is invalid.",
      });
      continue;
    }
    // Reuse complete active evidence validation without recursive workspace nesting.
    refineFencingJob(
      {
        ...job,
        ...workspace,
        activeDocumentId: id,
        documentWorkspaces: {},
        activeSheet: workspace.sheet,
      },
      {
        ...context,
        addIssue: (issue) =>
          context.addIssue(
            typeof issue === "string"
              ? { code: "custom", message: issue, path: ["documentWorkspaces", id] }
              : { ...issue, path: ["documentWorkspaces", id, ...(issue.path ?? [])] },
          ),
      },
    );
  }
}
export const fencingJobSchema = fencingJobDataSchema.superRefine(refineFencingJob);

export type FencingJob = z.infer<typeof fencingJobSchema>;
export type SiteDetails = z.infer<typeof siteDetailsSchema>;
export type DocumentRevision = z.infer<typeof documentRevisionSchema>;
export type FenceRun = z.infer<typeof fenceRunSchema>;
export type RunSpecification = z.infer<typeof runSpecificationSchema>;
export type RunCorner = z.infer<typeof runCornerSchema>;
export type PostOverride = z.infer<typeof postOverrideSchema>;
export type GateRecord = z.infer<typeof gateSchema>;
export type GateSpecification = z.infer<typeof gateSpecificationSchema>;
export type PhotoEvidence = z.infer<typeof photoEvidenceSchema>;
export type RevisionEvent = z.infer<typeof revisionEventSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type BomLine = z.infer<typeof bomLineSchema>;
export type QuoteDraft = z.infer<typeof quoteDraftSchema>;

export function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

export function createReviewDecision(): ReviewDecision {
  return { status: "draft", decidedAt: null, decidedBy: "", note: "" };
}

export function createRunSpecification(): RunSpecification {
  return {
    system: "unselected",
    customSystem: "",
    profile: "",
    heightM: null,
    bayWidthM: null,
    ground: "unselected",
    slope: "unselected",
    removalRequired: false,
    removalMaterial: "",
    removalLengthM: null,
    disposalRequired: false,
    access: "unselected",
    sleepers: "unselected",
    retainingRequired: false,
    retainingType: "unselected",
    retainingHeightM: null,
    retainingCondition: "",
    corners: [],
    postOverrides: [],
    notes: "",
  };
}

export function createGateSpecification(): GateSpecification {
  return {
    widthM: null,
    heightM: null,
    type: "unselected",
    customType: "",
    openingDirection: "unselected",
    hingeSide: "unselected",
    hardware: "",
    latch: "",
    postSize: "",
    finish: "",
    clearanceM: null,
    motorised: false,
    notes: "",
  };
}

export function createDefaultJob(now = new Date().toISOString()): FencingJob {
  return {
    schemaVersion: JOB_SCHEMA_VERSION,
    id: createId("job"),
    revision: 1,
    name: "Ruffles Road",
    trade: "fencing",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    site: {
      address: "356 Ruffles Road, Willow Vale",
      estimator: "",
      inspectionDate: "",
      notes: "",
    },
    documents: [
      {
        id: "doc-sample",
        name: "Ruffles.pdf",
        kind: "pdf",
        importedAt: now,
        pageCount: 1,
        sha256: null,
        source: "sample",
      },
    ],
    activeDocumentId: "doc-sample",
    calibrations: [createUnverifiedCalibration(0)],
    runs: [],
    gates: [],
    photos: [],
    bom: [],
    quoteDraft: null,
    revisionHistory: [],
  };
}

export function parseFencingJob(value: unknown): FencingJob {
  const candidate = typeof value === "string" ? JSON.parse(value) : value;
  return fencingJobSchema.parse(migrateLegacyJob(candidate));
}

function migrateLegacyJob(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const source = value as Record<string, unknown>;
  if (source.schemaVersion === JOB_SCHEMA_VERSION) return value;
  if (source.schemaVersion !== LEGACY_JOB_SCHEMA_VERSION) return value;
  const calibrated = migrateVersionOneCalibrations(source) as Record<string, unknown>;
  const traced = migrateVersionOneTrace(calibrated) as Record<string, unknown>;
  const runs = Array.isArray(traced.runs)
    ? traced.runs.map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
        const run = entry as Record<string, unknown>;
        const specification =
          run.specification &&
          typeof run.specification === "object" &&
          !Array.isArray(run.specification)
            ? (run.specification as Partial<RunSpecification>)
            : {};
        return { ...run, specification: { ...createRunSpecification(), ...specification } };
      })
    : traced.runs;
  const gates = Array.isArray(traced.gates)
    ? traced.gates.map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
        const gate = {
          ...createGateSpecification(),
          ...(entry as Record<string, unknown>),
        } as Record<string, unknown>;
        if (
          typeof gate.runId === "string" &&
          (gate.segmentIndex === null || gate.segmentIndex === undefined)
        ) {
          const run = Array.isArray(runs)
            ? (runs.find(
                (candidate) =>
                  candidate &&
                  typeof candidate === "object" &&
                  (candidate as Record<string, unknown>).id === gate.runId,
              ) as Record<string, unknown> | undefined)
            : undefined;
          const points = Array.isArray(run?.points)
            ? (run.points as Array<{ x: number; y: number }>)
            : [];
          const point =
            gate.point && typeof gate.point === "object" && !Array.isArray(gate.point)
              ? (gate.point as { x: number; y: number })
              : undefined;
          const placement = point ? nearestLegacyGatePlacement(points, point) : null;
          if (placement) return { ...gate, ...placement };
        }
        return gate;
      })
    : traced.gates;
  const photos = Array.isArray(traced.photos)
    ? traced.photos.map((entry, order) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
        const photo = entry as Record<string, unknown>;
        return {
          revision: 1,
          sha256: null,
          order,
          updatedAt: photo.addedAt,
          capturedAt: null,
          source: "web",
          ...photo,
        };
      })
    : traced.photos;
  return {
    ...traced,
    schemaVersion: JOB_SCHEMA_VERSION,
    revision: 1,
    runs,
    gates,
    photos,
    revisionHistory: [],
  };
}

function nearestLegacyGatePlacement(
  points: Array<{ x: number; y: number }>,
  point: { x: number; y: number },
): { point: { x: number; y: number }; segmentIndex: number; segmentT: number } | null {
  let best: {
    point: { x: number; y: number };
    segmentIndex: number;
    segmentT: number;
    distance: number;
  } | null = null;
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const denominator = dx * dx + dy * dy;
    if (denominator === 0) continue;
    const segmentT = Math.max(
      0,
      Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator),
    );
    const projected = { x: start.x + dx * segmentT, y: start.y + dy * segmentT };
    const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
    if (!best || distance < best.distance)
      best = { point: projected, segmentIndex, segmentT, distance };
  }
  return best && { point: best.point, segmentIndex: best.segmentIndex, segmentT: best.segmentT };
}

function migrateVersionOneTrace(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const job = value as Record<string, unknown>;
  if (job.schemaVersion !== LEGACY_JOB_SCHEMA_VERSION) return value;
  return {
    ...job,
    runs: Array.isArray(job.runs)
      ? job.runs.map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
          const run = entry as Record<string, unknown>;
          const legacyLength = run.lengthM;
          return {
            revision: 1,
            grossLengthM: legacyLength,
            gateDeductionM: 0,
            netLengthM: legacyLength,
            ...run,
          };
        })
      : job.runs,
    gates: Array.isArray(job.gates)
      ? job.gates.map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
          return {
            revision: 1,
            segmentIndex: null,
            segmentT: null,
            ...(entry as Record<string, unknown>),
          };
        })
      : job.gates,
  };
}

function migrateVersionOneCalibrations(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const job = value as Record<string, unknown>;
  if (job.schemaVersion !== LEGACY_JOB_SCHEMA_VERSION || !Array.isArray(job.calibrations))
    return value;
  return {
    ...job,
    calibrations: job.calibrations.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
      const legacy = entry as Record<string, unknown>;
      if ("transform" in legacy || "candidates" in legacy) return entry;
      const source = legacy.source;
      const hasUsableSource = source === "manual" || source === "declared" || source === "inferred";
      const points =
        Array.isArray(legacy.points) && legacy.points.length === 2 ? legacy.points : null;
      const knownDistanceM =
        typeof legacy.knownDistanceM === "number" && legacy.knownDistanceM > 0
          ? legacy.knownDistanceM
          : null;
      const candidateSource =
        source === "manual" && (!points || !knownDistanceM) ? "declared" : source;
      const legacyCandidateId = `legacy-sheet-${String(legacy.sheet)}`;
      const candidates = hasUsableSource
        ? [
            {
              id: legacyCandidateId,
              source: candidateSource,
              metresPerUnit: legacy.metresPerUnit,
              confidence: legacy.confidence,
              inputDistance:
                source === "manual" && knownDistanceM ? { value: knownDistanceM, unit: "m" } : null,
              knownDistanceM,
              points,
              provenance: {
                method: "legacy-v1-migration",
                evidence: "Scale retained from the version 1 calibration record.",
                documentId: null,
              },
            },
          ]
        : [];
      const canRemainLocked = legacy.locked === true && candidates.length === 1;
      return {
        ...legacy,
        locked: canRemainLocked,
        transform: { ...IDENTITY_DOCUMENT_TO_CANVAS },
        inputDistance: candidates[0]?.inputDistance ?? null,
        candidates,
        selectedCandidateId: canRemainLocked ? legacyCandidateId : null,
        conflict: null,
        ...(source === "manual" && candidateSource === "declared" ? { source: "declared" } : {}),
      };
    }),
  };
}

export type JobBlocker = {
  code:
    | "document"
    | "calibration"
    | "runs"
    | "run-specification"
    | "gate-specification"
    | "photo-evidence"
    | "review";
  message: string;
  entityId?: string;
};

export function missingRunSpecificationFields(specification: RunSpecification): string[] {
  const missing: string[] = [];
  if (specification.system === "unselected") missing.push("system");
  if (specification.system === "custom" && !specification.customSystem.trim())
    missing.push("custom system");
  if (!specification.profile.trim()) missing.push("profile");
  if (specification.heightM === null) missing.push("height");
  if (specification.bayWidthM === null) missing.push("bay width");
  if (specification.ground === "unselected") missing.push("ground");
  if (specification.slope === "unselected") missing.push("slope");
  if (specification.access === "unselected") missing.push("access");
  if (specification.sleepers === "unselected") missing.push("sleepers");
  if (specification.removalRequired) {
    if (!specification.removalMaterial.trim()) missing.push("removal material");
    if (specification.removalLengthM === null) missing.push("removal length");
  }
  if (specification.retainingRequired) {
    if (specification.retainingType === "unselected" || specification.retainingType === "none")
      missing.push("retaining type");
    if (specification.retainingHeightM === null) missing.push("retaining height");
  }
  return missing;
}

export function missingGateSpecificationFields(gate: GateRecord): string[] {
  const missing: string[] = [];
  if (gate.widthM === null) missing.push("width");
  if (gate.heightM === null) missing.push("height");
  if (gate.type === "unselected") missing.push("type");
  if (gate.type === "custom" && !gate.customType.trim()) missing.push("custom type");
  if (gate.openingDirection === "unselected") missing.push("opening direction");
  if (gate.hingeSide === "unselected") missing.push("hinge side");
  if (!gate.hardware.trim()) missing.push("hardware");
  if (!gate.latch.trim()) missing.push("latch");
  if (!gate.postSize.trim()) missing.push("post size");
  return missing;
}

export function getJobBlockers(job: FencingJob): JobBlocker[] {
  const blockers: JobBlocker[] = [];
  const activeDocument = job.documents.find((document) => document.id === job.activeDocumentId);
  if (!activeDocument || activeDocument.source === "sample") {
    blockers.push({ code: "document", message: "Import or select a source document." });
  }
  const measurementSheets = [...new Set(job.runs.map((run) => run.sheet))];
  const sheetsNeedingCalibration = measurementSheets.length > 0 ? measurementSheets : [0];
  for (const sheet of sheetsNeedingCalibration) {
    const calibration = job.calibrations.find((entry) => entry.sheet === sheet);
    if (
      !calibration?.locked ||
      calibration.source === "unverified" ||
      (activeDocument?.source !== "sample" && calibration.coordinateSpace !== "source-page-v1")
    ) {
      blockers.push({
        code: "calibration",
        message:
          calibration?.locked &&
          calibration.coordinateSpace !== "source-page-v1" &&
          activeDocument?.source !== "sample"
            ? `Sheet ${sheet + 1} uses legacy source coordinates. Export the preserved evidence before a reviewed retrace; quantities are unverified.`
            : `Confirm and lock the drawing scale for sheet ${sheet + 1}.`,
      });
    }
  }
  if (job.runs.length === 0)
    blockers.push({ code: "runs", message: "Trace at least one fence run." });
  for (const run of job.runs) {
    const missing = missingRunSpecificationFields(run.specification);
    if (missing.length > 0) {
      blockers.push({
        code: "run-specification",
        message: `${run.label} needs ${missing.join(", ")}.`,
        entityId: run.id,
      });
    }
    if (run.review.status !== "approved") {
      blockers.push({
        code: "review",
        message: `${run.label} has not been approved.`,
        entityId: run.id,
      });
    }
  }
  for (const gate of job.gates) {
    const missing = missingGateSpecificationFields(gate);
    if (missing.length > 0) {
      blockers.push({
        code: "gate-specification",
        message: `${gate.label} needs ${missing.join(", ")}.`,
        entityId: gate.id,
      });
    }
    if (gate.review.status !== "approved") {
      blockers.push({
        code: "review",
        message: `${gate.label} has not been approved.`,
        entityId: gate.id,
      });
    }
  }
  for (const photo of job.photos) {
    if (photo.sha256 === null) {
      blockers.push({
        code: "photo-evidence",
        message: `${photo.name} needs its original image bytes reattached.`,
        entityId: photo.id,
      });
    }
  }
  return blockers;
}
