import { z } from "zod";

export const COMPONENT_INVENTORY_SCHEMA = "xray.component-inventory/v1" as const;

const id = z
  .string()
  .min(1)
  .max(240)
  .refine((v) => v.trim() === v && v.length > 0, "Identifier cannot have whitespace.");

const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime({ offset: true });

export const point3dSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();
export type Point3D = z.infer<typeof point3dSchema>;

export const boundingBoxSchema = z
  .object({
    xMin: z.number().finite(),
    yMin: z.number().finite(),
    xMax: z.number().finite(),
    yMax: z.number().finite(),
  })
  .strict();
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

export const viewKindSchema = z.enum([
  "plan",
  "section",
  "elevation",
  "detail",
  "schedule",
  "specification",
  "3d",
]);
export type ViewKind = z.infer<typeof viewKindSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Spatial Hierarchy
// ─────────────────────────────────────────────────────────────────────────────

export const buildingSchema = z
  .object({
    id,
    name: z.string().min(1).max(200),
    datum: point3dSchema,
  })
  .strict();
export type Building = z.infer<typeof buildingSchema>;

export const storeySchema = z
  .object({
    id,
    buildingId: id,
    name: z.string().min(1).max(100),
    elevationM: z.number().finite(),
    floorToFloorM: z.number().finite().positive().nullable(),
    datumMark: z.string().max(100).nullable(),
  })
  .strict();
export type Storey = z.infer<typeof storeySchema>;

export const spaceSchema = z
  .object({
    id,
    storeyId: id,
    name: z.string().min(1).max(100),
    category: z.string().max(100),
    boundary: z.array(z.object({ x: z.number().finite(), y: z.number().finite() }).strict()).min(3).nullable(),
  })
  .strict();
export type Space = z.infer<typeof spaceSchema>;

export const gridLineSchema = z
  .object({
    id,
    name: z.string().min(1).max(20),
    axis: z.enum(["X", "Y", "custom"]),
    positionM: z.number().finite(),
  })
  .strict();
export type GridLine = z.infer<typeof gridLineSchema>;

export const spatialHierarchySchema = z
  .object({
    buildings: z.array(buildingSchema),
    storeys: z.array(storeySchema),
    spaces: z.array(spaceSchema),
    grids: z.array(gridLineSchema),
  })
  .strict();
export type SpatialHierarchy = z.infer<typeof spatialHierarchySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Evidence Bindings (Multi-View Drawing Provenance)
// ─────────────────────────────────────────────────────────────────────────────

export const evidenceBindingSchema = z
  .object({
    id,
    documentId: id,
    pageIndex: z.number().int().nonnegative(),
    sha256: hash,
    viewKind: viewKindSchema,
    detailTag: z.string().max(100).nullable(), // e.g. "4/S-501"
    boundingBox: boundingBoxSchema.nullable(),
    verifiedAt: timestamp,
    notes: z.string().max(2000),
  })
  .strict();
export type EvidenceBinding = z.infer<typeof evidenceBindingSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 3. Component Types (Catalog / Spec Definitions)
// ─────────────────────────────────────────────────────────────────────────────

export const componentDisciplineSchema = z.enum([
  "structural",
  "architectural",
  "mechanical",
  "electrical",
  "plumbing",
  "civil",
  "general",
]);
export type ComponentDiscipline = z.infer<typeof componentDisciplineSchema>;

export const dimensionAttributeSchema = z
  .object({
    value: z.number().finite().positive(),
    unit: z.enum(["mm", "cm", "m", "in", "ft"]),
  })
  .strict();

export const componentTypeSchema = z
  .object({
    id, // e.g. "fastener/m20-hex-bolt"
    discipline: componentDisciplineSchema,
    category: z.string().min(1).max(100), // e.g. "fastener", "column", "baseplate"
    standardName: z.string().min(1).max(200), // e.g. "M20 Grade 8.8 Hex Bolt"
    materialGrade: z.string().max(100).nullable(), // e.g. "Grade 8.8", "A992"
    nominalDimensions: z.record(z.string(), dimensionAttributeSchema),
    scheduleTag: z.string().max(50).nullable(), // e.g. "B1", "C1"
  })
  .strict();
export type ComponentType = z.infer<typeof componentTypeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 4. Assembly Rules (Typical Detail Specifications: 1:N expansion)
// ─────────────────────────────────────────────────────────────────────────────

export const childComponentQuotaSchema = z
  .object({
    typeId: id,
    count: z.number().int().positive().max(100000),
    role: z.string().min(1).max(100), // e.g. "anchor-bolt", "shear-bolt", "baseplate"
    relativeOffset: point3dSchema.nullable(),
    unresolvedFields: z.array(z.string().min(1).max(100)),
  })
  .strict();
export type ChildComponentQuota = z.infer<typeof childComponentQuotaSchema>;

export const assemblyRuleSchema = z
  .object({
    id, // e.g. "rule/typ-baseplate-c1"
    name: z.string().min(1).max(200),
    revision: revision,
    parentCategory: z.string().min(1).max(100), // e.g. "connection", "column"
    detailEvidenceId: id, // points to EvidenceBinding on the detail sheet
    childQuotas: z.array(childComponentQuotaSchema).min(1),
    notes: z.string().max(2000),
  })
  .strict();
export type AssemblyRule = z.infer<typeof assemblyRuleSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 5. Physical Instances (The Real Building Inventory Graph)
// ─────────────────────────────────────────────────────────────────────────────

export const quantityBasisSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("direct-count") }).strict(),
  z
    .object({
      method: z.literal("detail-rule"),
      ruleId: id,
      parentInstanceId: id,
    })
    .strict(),
  z
    .object({
      method: z.literal("inferred"),
      inferenceReason: z.string().min(1).max(500),
    })
    .strict(),
  z
    .object({
      method: z.literal("manual-review"),
      justification: z.string().min(1).max(500),
    })
    .strict(),
]);
export type QuantityBasis = z.infer<typeof quantityBasisSchema>;

export const instanceReviewSchema = z
  .object({
    status: z.enum(["draft", "verified", "rejected", "stale_revision"]),
    reviewedBy: z.string().max(100).nullable(),
    reviewedAt: timestamp.nullable(),
    note: z.string().max(1000).nullable(),
  })
  .strict();
export type InstanceReview = z.infer<typeof instanceReviewSchema>;

export const physicalInstanceSchema = z
  .object({
    id, // Immutable UUID
    stableIdentifier: id, // Deterministic key (e.g. "conn-c1-lvl3-grid-b4")
    displayMark: z.string().min(1).max(100), // Human label (e.g. "B1", "C1")
    revision: revision,
    typeId: id,
    parentAssemblyInstanceId: id.nullable(),
    spatial: z
      .object({
        buildingId: id.nullable(),
        storeyId: id.nullable(),
        spaceId: id.nullable(),
        nearestGrid: z.string().max(50).nullable(),
        position: point3dSchema.nullable(),
        rotationDeg: z.number().finite().nullable(),
      })
      .strict(),
    phase: z.enum(["new", "existing", "demolish", "temporary"]),
    quantityBasis: quantityBasisSchema,
    unresolvedProperties: z.array(z.string().min(1).max(100)),
    evidenceIds: z.array(id), // Can have multiple evidence links (plan + section + detail)
    review: instanceReviewSchema,
  })
  .strict();
export type PhysicalInstance = z.infer<typeof physicalInstanceSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 6. Complete Inventory Envelope
// ─────────────────────────────────────────────────────────────────────────────

export const componentInventorySchema = z
  .object({
    schema: z.literal(COMPONENT_INVENTORY_SCHEMA),
    projectId: id,
    revision: revision,
    spatial: spatialHierarchySchema,
    types: z.array(componentTypeSchema),
    assemblyRules: z.array(assemblyRuleSchema),
    evidence: z.array(evidenceBindingSchema),
    instances: z.array(physicalInstanceSchema),
  })
  .strict()
  .superRefine((inv, ctx) => {
    // 1. Evidence uniqueness
    const evidenceIds = new Set<string>();
    inv.evidence.forEach((ev, idx) => {
      if (evidenceIds.has(ev.id)) {
        ctx.addIssue({ code: "custom", path: ["evidence", idx, "id"], message: `Duplicate evidence ID: ${ev.id}` });
      }
      evidenceIds.add(ev.id);
    });

    // 2. Types uniqueness
    const typeIds = new Set<string>();
    inv.types.forEach((t, idx) => {
      if (typeIds.has(t.id)) {
        ctx.addIssue({ code: "custom", path: ["types", idx, "id"], message: `Duplicate component type ID: ${t.id}` });
      }
      typeIds.add(t.id);
    });

    // 3. Assembly rules refer to valid evidence and types
    inv.assemblyRules.forEach((rule, rIdx) => {
      if (!evidenceIds.has(rule.detailEvidenceId)) {
        ctx.addIssue({
          code: "custom",
          path: ["assemblyRules", rIdx, "detailEvidenceId"],
          message: `Assembly rule references unknown detail evidence: ${rule.detailEvidenceId}`,
        });
      }
      rule.childQuotas.forEach((quota, qIdx) => {
        if (!typeIds.has(quota.typeId)) {
          ctx.addIssue({
            code: "custom",
            path: ["assemblyRules", rIdx, "childQuotas", qIdx, "typeId"],
            message: `Child quota references unknown component type: ${quota.typeId}`,
          });
        }
      });
    });

    // 4. Instance integrity
    const instanceIds = new Set<string>();
    const stableIdentifiers = new Set<string>();
    inv.instances.forEach((inst, idx) => {
      if (instanceIds.has(inst.id)) {
        ctx.addIssue({ code: "custom", path: ["instances", idx, "id"], message: `Duplicate instance ID: ${inst.id}` });
      }
      instanceIds.add(inst.id);

      if (stableIdentifiers.has(inst.stableIdentifier)) {
        ctx.addIssue({
          code: "custom",
          path: ["instances", idx, "stableIdentifier"],
          message: `Duplicate physical component detected with same stableIdentifier: ${inst.stableIdentifier}`,
        });
      }
      stableIdentifiers.add(inst.stableIdentifier);

      if (!typeIds.has(inst.typeId)) {
        ctx.addIssue({
          code: "custom",
          path: ["instances", idx, "typeId"],
          message: `Instance references unknown component type: ${inst.typeId}`,
        });
      }

      inst.evidenceIds.forEach((eId) => {
        if (!evidenceIds.has(eId)) {
          ctx.addIssue({
            code: "custom",
            path: ["instances", idx, "evidenceIds"],
            message: `Instance references unknown evidence ID: ${eId}`,
          });
        }
      });

      if (inst.parentAssemblyInstanceId !== null) {
        const parentExists = inv.instances.some((p) => p.id === inst.parentAssemblyInstanceId);
        if (!parentExists) {
          ctx.addIssue({
            code: "custom",
            path: ["instances", idx, "parentAssemblyInstanceId"],
            message: `Instance references unknown parent assembly ID: ${inst.parentAssemblyInstanceId}`,
          });
        }
      }
    });
  });
export type ComponentInventory = z.infer<typeof componentInventorySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 7. Graph Operations & Deterministic Resolvers
// ─────────────────────────────────────────────────────────────────────────────

export function createEmptyInventory(projectId: string): ComponentInventory {
  return {
    schema: COMPONENT_INVENTORY_SCHEMA,
    projectId,
    revision: 1,
    spatial: { buildings: [], storeys: [], spaces: [], grids: [] },
    types: [],
    assemblyRules: [],
    evidence: [],
    instances: [],
  };
}

export function addEvidenceBinding(
  inventory: ComponentInventory,
  evidence: EvidenceBinding,
): ComponentInventory {
  if (inventory.evidence.some((e) => e.id === evidence.id)) {
    throw new Error(`Evidence ID already exists: ${evidence.id}`);
  }
  return {
    ...inventory,
    evidence: [...inventory.evidence, evidence],
    revision: inventory.revision + 1,
  };
}

export function addComponentType(
  inventory: ComponentInventory,
  componentType: ComponentType,
): ComponentInventory {
  if (inventory.types.some((t) => t.id === componentType.id)) {
    throw new Error(`Component type already exists: ${componentType.id}`);
  }
  return {
    ...inventory,
    types: [...inventory.types, componentType],
    revision: inventory.revision + 1,
  };
}

export function addAssemblyRule(
  inventory: ComponentInventory,
  rule: AssemblyRule,
): ComponentInventory {
  if (inventory.assemblyRules.some((r) => r.id === rule.id)) {
    throw new Error(`Assembly rule already exists: ${rule.id}`);
  }
  const verified = componentInventorySchema.parse({
    ...inventory,
    assemblyRules: [...inventory.assemblyRules, rule],
    revision: inventory.revision + 1,
  });
  return verified;
}

export function addPhysicalInstance(
  inventory: ComponentInventory,
  instance: PhysicalInstance,
): ComponentInventory {
  if (inventory.instances.some((i) => i.id === instance.id)) {
    throw new Error(`Physical instance already exists: ${instance.id}`);
  }
  if (inventory.instances.some((i) => i.stableIdentifier === instance.stableIdentifier)) {
    throw new Error(
      `Physical component with stableIdentifier already exists: ${instance.stableIdentifier}. Duplicate physical components are forbidden; attach additional drawing evidence to the existing instance instead.`,
    );
  }
  const verified = componentInventorySchema.parse({
    ...inventory,
    instances: [...inventory.instances, instance],
    revision: inventory.revision + 1,
  });
  return verified;
}

export function bindEvidenceToInstance(
  inventory: ComponentInventory,
  instanceId: string,
  evidenceId: string,
): ComponentInventory {
  if (!inventory.evidence.some((e) => e.id === evidenceId)) {
    throw new Error(`Cannot bind unknown evidence ID: ${evidenceId}`);
  }
  const target = inventory.instances.find((i) => i.id === instanceId);
  if (!target) throw new Error(`Unknown instance ID: ${instanceId}`);
  if (target.evidenceIds.includes(evidenceId)) return inventory;

  const updatedInstances = inventory.instances.map((i) =>
    i.id === instanceId
      ? { ...i, evidenceIds: [...i.evidenceIds, evidenceId], revision: i.revision + 1 }
      : i,
  );

  return {
    ...inventory,
    instances: updatedInstances,
    revision: inventory.revision + 1,
  };
}

/**
 * Solves the 1:N Detail-to-Instance Topology:
 * Given a parent instance (e.g. a Connection C1) and an AssemblyRule (e.g. 4x M20 bolts),
 * expands deterministically into exact child physical instances.
 */
export function instantiateAssembly(
  inventory: ComponentInventory,
  parentInstanceId: string,
  ruleId: string,
  actor?: string,
): { inventory: ComponentInventory; childInstanceIds: string[] } {
  const parent = inventory.instances.find((i) => i.id === parentInstanceId);
  if (!parent) throw new Error(`Parent instance not found: ${parentInstanceId}`);
  const rule = inventory.assemblyRules.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Assembly rule not found: ${ruleId}`);

  const childInstances: PhysicalInstance[] = [];
  const childIds: string[] = [];

  for (const quota of rule.childQuotas) {
    for (let idx = 1; idx <= quota.count; idx++) {
      const childId = `${parent.id}-child-${quota.role}-${idx}`;
      const childStableId = `${parent.stableIdentifier}-${quota.role}-${idx}`;
      const displayMark = `${parent.displayMark}.${quota.role[0].toUpperCase()}${idx}`;

      const childPos =
        parent.spatial.position && quota.relativeOffset
          ? {
              x: parent.spatial.position.x + quota.relativeOffset.x,
              y: parent.spatial.position.y + quota.relativeOffset.y,
              z: parent.spatial.position.z + quota.relativeOffset.z,
            }
          : parent.spatial.position;

      const instance: PhysicalInstance = {
        id: childId,
        stableIdentifier: childStableId,
        displayMark,
        revision: 1,
        typeId: quota.typeId,
        parentAssemblyInstanceId: parent.id,
        spatial: {
          ...parent.spatial,
          position: childPos,
        },
        phase: parent.phase,
        quantityBasis: {
          method: "detail-rule",
          ruleId: rule.id,
          parentInstanceId: parent.id,
        },
        unresolvedProperties: [...quota.unresolvedFields],
        // Inherit detail evidence from the rule, plus parent's evidence
        evidenceIds: Array.from(new Set([rule.detailEvidenceId, ...parent.evidenceIds])),
        review: {
          status: "draft",
          reviewedBy: actor ?? null,
          reviewedAt: actor ? new Date().toISOString() : null,
          note: `Instantiated from ${rule.name}`,
        },
      };

      childInstances.push(instance);
      childIds.push(childId);
    }
  }

  const nextInventory = componentInventorySchema.parse({
    ...inventory,
    instances: [...inventory.instances, ...childInstances],
    revision: inventory.revision + 1,
  });

  return { inventory: nextInventory, childInstanceIds: childIds };
}

/**
 * Renaming a human display mark (e.g. B1 -> Bolt-North) preserves the stable internal ID,
 * parent link, and evidence links without breaking references.
 */
export function updateDisplayMark(
  inventory: ComponentInventory,
  instanceId: string,
  newDisplayMark: string,
): ComponentInventory {
  const target = inventory.instances.find((i) => i.id === instanceId);
  if (!target) throw new Error(`Unknown instance ID: ${instanceId}`);
  if (target.displayMark === newDisplayMark) return inventory;

  const updatedInstances = inventory.instances.map((i) =>
    i.id === instanceId
      ? { ...i, displayMark: newDisplayMark.trim(), revision: i.revision + 1 }
      : i,
  );

  return {
    ...inventory,
    instances: updatedInstances,
    revision: inventory.revision + 1,
  };
}

/**
 * Propagates an updated assembly rule: preserves surviving rule-generated children
 * in place, retaining identity, user marks, evidence and review annotations.
 * Material changes advance the component revision and invalidate prior approval;
 * count-only changes leave surviving components unchanged.
 */
export function updateAssemblyRule(
  inventory: ComponentInventory,
  ruleId: string,
  newChildQuotas: ChildComponentQuota[],
  actor: string,
): ComponentInventory {
  const existingRule = inventory.assemblyRules.find((r) => r.id === ruleId);
  if (!existingRule) throw new Error(`Unknown assembly rule: ${ruleId}`);

  const updatedRule: AssemblyRule = {
    ...existingRule,
    revision: existingRule.revision + 1,
    childQuotas: newChildQuotas,
  };

  // Find all children currently generated by this rule
  const childrenOfRule = inventory.instances.filter(
    (i) => i.quantityBasis.method === "detail-rule" && i.quantityBasis.ruleId === ruleId,
  );
  const affectedParentIds = Array.from(
    new Set(
      childrenOfRule.map(
        (c) => (c.quantityBasis as { parentInstanceId: string }).parentInstanceId,
      ),
    ),
  );

  // Map existing children by stableIdentifier to preserve all surviving metadata in place
  const existingChildMap = new Map<string, PhysicalInstance>(
    childrenOfRule.map((c) => [c.stableIdentifier, c]),
  );

  const keptOrNewChildren: PhysicalInstance[] = [];
  const now = new Date().toISOString();

  for (const parentId of affectedParentIds) {
    const parent = inventory.instances.find((i) => i.id === parentId);
    if (!parent) continue;

    for (const quota of newChildQuotas) {
      for (let idx = 1; idx <= quota.count; idx++) {
        const childStableId = `${parent.stableIdentifier}-${quota.role}-${idx}`;
        const existingChild = existingChildMap.get(childStableId);

        if (existingChild) {
          // Match the previous quota by role: type may have changed, identity has not.
          const previousQuota = existingRule.childQuotas.find((q) => q.role === quota.role);
          const evidenceIds = existingChild.evidenceIds.includes(updatedRule.detailEvidenceId)
            ? existingChild.evidenceIds
            : [...existingChild.evidenceIds, updatedRule.detailEvidenceId];

          const childPos =
            parent.spatial.position && quota.relativeOffset
              ? {
                  x: parent.spatial.position.x + quota.relativeOffset.x,
                  y: parent.spatial.position.y + quota.relativeOffset.y,
                  z: parent.spatial.position.z + quota.relativeOffset.z,
                }
              : parent.spatial.position;

          // Replace requirements owned by the previous rule; retain unrelated
          // component-specific flags. The old quota also covers existing v1 data.
          const previousRuleFields = new Set(previousQuota?.unresolvedFields ?? []);
          const mergedUnresolved = Array.from(
            new Set([
              ...existingChild.unresolvedProperties.filter((field) => !previousRuleFields.has(field)),
              ...quota.unresolvedFields,
            ]),
          );
          const materialChanged =
            existingChild.typeId !== quota.typeId ||
            existingChild.spatial.position?.x !== childPos?.x ||
            existingChild.spatial.position?.y !== childPos?.y ||
            existingChild.spatial.position?.z !== childPos?.z ||
            existingChild.unresolvedProperties.length !== mergedUnresolved.length ||
            mergedUnresolved.some((field) => !existingChild.unresolvedProperties.includes(field));

          keptOrNewChildren.push({
            ...existingChild,
            revision: existingChild.revision + (materialChanged ? 1 : 0),
            review: materialChanged && existingChild.review.status !== "draft"
              ? { ...existingChild.review, status: "stale_revision" }
              : existingChild.review,
            typeId: quota.typeId,
            spatial: {
              ...existingChild.spatial,
              position: childPos,
            },
            quantityBasis: {
              method: "detail-rule",
              ruleId: updatedRule.id,
              parentInstanceId: parent.id,
            },
            unresolvedProperties: mergedUnresolved,
            evidenceIds,
          });
        } else {
          // NEW COMPONENT: Instantiate fresh instance
          const childId = `${parent.id}-child-${quota.role}-${idx}`;
          const displayMark = `${parent.displayMark}.${quota.role[0].toUpperCase()}${idx}`;
          const childPos =
            parent.spatial.position && quota.relativeOffset
              ? {
                  x: parent.spatial.position.x + quota.relativeOffset.x,
                  y: parent.spatial.position.y + quota.relativeOffset.y,
                  z: parent.spatial.position.z + quota.relativeOffset.z,
                }
              : parent.spatial.position;

          const combinedEvidence = Array.from(
            new Set([...parent.evidenceIds, updatedRule.detailEvidenceId]),
          );

          const newInstance: PhysicalInstance = {
            id: childId,
            stableIdentifier: childStableId,
            displayMark,
            revision: 1,
            typeId: quota.typeId,
            parentAssemblyInstanceId: parent.id,
            spatial: {
              buildingId: parent.spatial.buildingId,
              storeyId: parent.spatial.storeyId,
              spaceId: parent.spatial.spaceId,
              nearestGrid: parent.spatial.nearestGrid,
              position: childPos,
              rotationDeg: parent.spatial.rotationDeg,
            },
            phase: parent.phase,
            quantityBasis: {
              method: "detail-rule",
              ruleId: updatedRule.id,
              parentInstanceId: parent.id,
            },
            unresolvedProperties: [...quota.unresolvedFields],
            evidenceIds: combinedEvidence,
            review: {
              status: "draft",
              reviewedBy: actor,
              reviewedAt: now,
              note: `Generated by assembly rule ${updatedRule.id} (rev ${updatedRule.revision})`,
            },
          };
          keptOrNewChildren.push(newInstance);
        }
      }
    }
  }

  // Other instances not generated by this rule are completely preserved
  const otherInstances = inventory.instances.filter(
    (i) => !(i.quantityBasis.method === "detail-rule" && i.quantityBasis.ruleId === ruleId),
  );

  const updatedInventory: ComponentInventory = {
    ...inventory,
    assemblyRules: inventory.assemblyRules.map((r) => (r.id === ruleId ? updatedRule : r)),
    instances: [...otherInstances, ...keptOrNewChildren],
    revision: inventory.revision + 1,
  };

  return componentInventorySchema.parse(updatedInventory);
}

export type InventoryQueryFilter = {
  storeyId?: string;
  discipline?: ComponentDiscipline;
  category?: string;
  typeId?: string;
  hasUnresolvedProperties?: boolean;
};

export function queryInventory(
  inventory: ComponentInventory,
  filter: InventoryQueryFilter = {},
) {
  const typeMap = new Map(inventory.types.map((t) => [t.id, t]));

  const matching = inventory.instances.filter((inst) => {
    if (filter.storeyId && inst.spatial.storeyId !== filter.storeyId) return false;
    const compType = typeMap.get(inst.typeId);
    if (!compType) return false;
    if (filter.discipline && compType.discipline !== filter.discipline) return false;
    if (filter.category && compType.category !== filter.category) return false;
    if (filter.typeId && inst.typeId !== filter.typeId) return false;
    if (
      filter.hasUnresolvedProperties !== undefined &&
      (inst.unresolvedProperties.length > 0) !== filter.hasUnresolvedProperties
    )
      return false;
    return true;
  });

  const countsByType: Record<string, number> = {};
  let unresolvedCount = 0;

  for (const inst of matching) {
    countsByType[inst.typeId] = (countsByType[inst.typeId] ?? 0) + 1;
    if (inst.unresolvedProperties.length > 0) unresolvedCount++;
  }

  return {
    instances: matching,
    totalCount: matching.length,
    countsByType,
    unresolvedCount,
  };
}

/**
 * Creates a deterministic, multi-view verified sample inventory:
 * - 1 Building ("Main Hospital Building"), 1 Storey ("Level 03", elevation 12.0m), Grid B
 * - 3 Evidence Bindings: S-101 (plan), S-201 (section), S-501 (detail 4/S-501)
 * - 2 Component Types: Connection C1 and M20 Structural Bolt B1
 * - 1 Assembly Rule: 4x M20 bolts per Baseplate C1
 * - 12 Connection instances along Grid B, expanded deterministically into 48 bolts (total: 60 instances)
 */
export function createSampleStructuralInventory(): ComponentInventory {
  const dummyHash = "a".repeat(64);
  const now = "2026-09-06T00:00:00.000Z";

  let inv = createEmptyInventory("proj-atascadero-expansion");

  inv.spatial = {
    buildings: [
      { id: "bldg-main", name: "Main Hospital Building", datum: { x: 0, y: 0, z: 0 } },
    ],
    storeys: [
      {
        id: "storey-lvl3",
        buildingId: "bldg-main",
        name: "Level 03",
        elevationM: 12.0,
        floorToFloorM: 4.2,
        datumMark: "RL +12.000",
      },
    ],
    spaces: [],
    grids: [
      {
        id: "grid-b",
        name: "B",
        axis: "Y",
        positionM: 15.0,
      },
    ],
  };

  const evPlan: EvidenceBinding = {
    id: "ev-s101-plan",
    documentId: "doc-hospital-main",
    pageIndex: 12, // Sheet S-101 (page 13)
    sha256: dummyHash,
    viewKind: "plan",
    detailTag: null,
    boundingBox: { xMin: 120, yMin: 200, xMax: 850, yMax: 650 },
    verifiedAt: now,
    notes: "Level 3 Framing Plan: 12 column locations along Grid B (Grids 1-12)",
  };

  const evSection: EvidenceBinding = {
    id: "ev-s201-section",
    documentId: "doc-hospital-main",
    pageIndex: 45, // Sheet S-201 (page 46)
    sha256: dummyHash,
    viewKind: "section",
    detailTag: "A/S-201",
    boundingBox: { xMin: 50, yMin: 150, xMax: 900, yMax: 800 },
    verifiedAt: now,
    notes: "Building Section B-B showing continuous Grid B column line",
  };

  const evDetail: EvidenceBinding = {
    id: "ev-s501-detail",
    documentId: "doc-hospital-main",
    pageIndex: 82, // Sheet S-501 (page 83)
    sha256: dummyHash,
    viewKind: "detail",
    detailTag: "4/S-501",
    boundingBox: { xMin: 300, yMin: 400, xMax: 600, yMax: 700 },
    verifiedAt: now,
    notes: "Detail 4/S-501: Typical 4-Bolt Column Baseplate Connection",
  };

  inv = addEvidenceBinding(inv, evPlan);
  inv = addEvidenceBinding(inv, evSection);
  inv = addEvidenceBinding(inv, evDetail);

  const connType: ComponentType = {
    id: "conn-typ-c1",
    discipline: "structural",
    category: "connection",
    standardName: "Column Baseplate Connection C1",
    materialGrade: "Grade 350 Steel",
    nominalDimensions: {
      length: { value: 450, unit: "mm" },
      width: { value: 450, unit: "mm" },
      thickness: { value: 32, unit: "mm" },
    },
    scheduleTag: "C1",
  };

  const boltType: ComponentType = {
    id: "fastener/m20-hex-bolt",
    discipline: "structural",
    category: "fastener",
    standardName: "M20 x 100mm Grade 8.8 Hex Structural Bolt",
    materialGrade: "Grade 8.8 Galvanized",
    nominalDimensions: {
      diameter: { value: 20, unit: "mm" },
      length: { value: 100, unit: "mm" },
    },
    scheduleTag: "B1",
  };

  inv = addComponentType(inv, connType);
  inv = addComponentType(inv, boltType);

  const assemblyRule: AssemblyRule = {
    id: "rule/typ-baseplate-c1",
    name: "Typical 4-Bolt Column Baseplate Connection",
    revision: 1,
    parentCategory: "connection",
    detailEvidenceId: "ev-s501-detail",
    childQuotas: [
      {
        typeId: "fastener/m20-hex-bolt",
        count: 4,
        role: "anchor-bolt",
        relativeOffset: { x: 0, y: 0, z: -0.15 },
        unresolvedFields: [],
      },
    ],
    notes: "AS 4100 Clause 9.1: 4x M20 Grade 8.8 bolts per baseplate C1 per Detail 4/S-501",
  };

  inv = addAssemblyRule(inv, assemblyRule);

  // Instantiate 12 column baseplate connections along Grid B
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, "0");
    const connInstance: PhysicalInstance = {
      id: `conn-c1-${num}`,
      stableIdentifier: `conn-c1-lvl3-grid-b${i}`,
      displayMark: `C1.${num}`,
      revision: 1,
      typeId: "conn-typ-c1",
      parentAssemblyInstanceId: null,
      spatial: {
        buildingId: "bldg-main",
        storeyId: "storey-lvl3",
        spaceId: null,
        nearestGrid: `B-${i}`,
        position: { x: (i - 1) * 9.0, y: 15.0, z: 12.0 },
        rotationDeg: 0,
      },
      phase: "new",
      quantityBasis: { method: "direct-count" },
      unresolvedProperties: [],
      evidenceIds: ["ev-s101-plan", "ev-s201-section"],
      review: {
        status: "verified",
        reviewedBy: "Chief Structural Engineer",
        reviewedAt: now,
        note: "Plan location verified on S-101 and section alignment on S-201",
      },
    };
    inv = addPhysicalInstance(inv, connInstance);
  }

  // Deterministically instantiate the 4-bolt assembly rule across all 12 connections (12 x 4 = 48 bolts)
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(2, "0");
    const res = instantiateAssembly(inv, `conn-c1-${num}`, "rule/typ-baseplate-c1", "Chief Structural Engineer");
    inv = res.inventory;
  }

  return inv;
}
