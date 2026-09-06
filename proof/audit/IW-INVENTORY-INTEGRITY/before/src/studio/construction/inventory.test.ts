import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyInventory,
  addEvidenceBinding,
  addComponentType,
  addAssemblyRule,
  addPhysicalInstance,
  bindEvidenceToInstance,
  instantiateAssembly,
  updateDisplayMark,
  updateAssemblyRule,
  queryInventory,
  componentInventorySchema,
  type EvidenceBinding,
  type ComponentType,
  type AssemblyRule,
  type ChildComponentQuota,
  type PhysicalInstance,
} from "./inventory.ts";

describe("Evidence-Backed Component Inventory Schema (xray.component-inventory/v1)", () => {
  const dummyHash = "a".repeat(64);
  const now = "2026-09-06T00:00:00.000Z";

  it("proves multi-view deduplication: 1 physical bolt appearing on plan, section, and detail", () => {
    let inv = createEmptyInventory("proj-hospital-01");

    // 1. Register 3 distinct drawing evidence records for the same physical location
    const evPlan: EvidenceBinding = {
      id: "ev-s101-plan",
      documentId: "doc-atascadero-main",
      pageIndex: 12, // Sheet S-101
      sha256: dummyHash,
      viewKind: "plan",
      detailTag: null,
      boundingBox: { xMin: 100, yMin: 200, xMax: 120, yMax: 220 },
      verifiedAt: now,
      notes: "Column C1 location on Level 3 framing plan",
    };
    const evSection: EvidenceBinding = {
      id: "ev-s201-section",
      documentId: "doc-atascadero-main",
      pageIndex: 45, // Sheet S-201
      sha256: dummyHash,
      viewKind: "section",
      detailTag: "A/S-201",
      boundingBox: { xMin: 300, yMin: 400, xMax: 350, yMax: 500 },
      verifiedAt: now,
      notes: "Building section through Grid B showing column base",
    };
    const evDetail: EvidenceBinding = {
      id: "ev-s501-detail",
      documentId: "doc-atascadero-main",
      pageIndex: 82, // Sheet S-501
      sha256: dummyHash,
      viewKind: "detail",
      detailTag: "4/S-501",
      boundingBox: { xMin: 50, yMin: 60, xMax: 180, yMax: 190 },
      verifiedAt: now,
      notes: "Enlarged baseplate connection detail",
    };

    inv = addEvidenceBinding(inv, evPlan);
    inv = addEvidenceBinding(inv, evSection);
    inv = addEvidenceBinding(inv, evDetail);

    // 2. Register Bolt component type
    const boltType: ComponentType = {
      id: "fastener/m20-hex-bolt",
      discipline: "structural",
      category: "fastener",
      standardName: "M20 x 100mm Grade 8.8 Hex Bolt",
      materialGrade: "Grade 8.8",
      nominalDimensions: {
        diameter: { value: 20, unit: "mm" },
        length: { value: 100, unit: "mm" },
      },
      scheduleTag: "B1",
    };
    inv = addComponentType(inv, boltType);

    // 3. Create single physical instance of the bolt
    const boltInstance: PhysicalInstance = {
      id: "bolt-c1-anchor-1",
      stableIdentifier: "conn-c1-anchor-1-grid-b4",
      displayMark: "B1",
      revision: 1,
      typeId: "fastener/m20-hex-bolt",
      parentAssemblyInstanceId: null,
      spatial: {
        buildingId: "bld-main",
        storeyId: "lvl-3",
        spaceId: "room-mech-301",
        nearestGrid: "B-4",
        position: { x: 12.5, y: 34.2, z: 14.8 },
        rotationDeg: 0,
      },
      phase: "new",
      quantityBasis: { method: "direct-count" },
      unresolvedProperties: [],
      evidenceIds: ["ev-s101-plan"], // initially seen on plan
      review: { status: "verified", reviewedBy: "estimator-dan", reviewedAt: now, note: "Confirmed on plan" },
    };
    inv = addPhysicalInstance(inv, boltInstance);

    // 4. Bind Section and Detail evidence to the SAME physical bolt
    inv = bindEvidenceToInstance(inv, "bolt-c1-anchor-1", "ev-s201-section");
    inv = bindEvidenceToInstance(inv, "bolt-c1-anchor-1", "ev-s501-detail");

    // VERIFICATION:
    // Exactly 1 physical bolt in inventory, with 3 verified multi-view evidence links
    const query = queryInventory(inv, { category: "fastener" });
    assert.equal(query.totalCount, 1, "Must be exactly 1 physical bolt, not 3 duplicates across sheets");
    assert.equal(query.instances[0].evidenceIds.length, 3, "Must retain plan, section, and detail evidence");
    assert.deepEqual(query.instances[0].evidenceIds, [
      "ev-s101-plan",
      "ev-s201-section",
      "ev-s501-detail",
    ]);
  });

  it("solves the 12 connections * 4 bolts = 48 bolts problem deterministically", () => {
    let inv = createEmptyInventory("proj-hospital-01");

    // Evidence for Detail 4/S-501
    const evDetail: EvidenceBinding = {
      id: "ev-detail-4-s501",
      documentId: "doc-atascadero-main",
      pageIndex: 82,
      sha256: dummyHash,
      viewKind: "detail",
      detailTag: "4/S-501",
      boundingBox: { xMin: 50, yMin: 60, xMax: 180, yMax: 190 },
      verifiedAt: now,
      notes: "Typical Baseplate Detail: 4x M20 bolts per connection",
    };
    inv = addEvidenceBinding(inv, evDetail);

    // Component Types
    const connType: ComponentType = {
      id: "conn/baseplate-type-1",
      discipline: "structural",
      category: "connection",
      standardName: "Typical Baseplate Connection",
      materialGrade: "Grade 350",
      nominalDimensions: {},
      scheduleTag: "BP1",
    };
    const boltType: ComponentType = {
      id: "fastener/m20-hex-bolt",
      discipline: "structural",
      category: "fastener",
      standardName: "M20 x 100mm Grade 8.8 Hex Bolt",
      materialGrade: "Grade 8.8",
      nominalDimensions: { diameter: { value: 20, unit: "mm" } },
      scheduleTag: "B1",
    };
    inv = addComponentType(inv, connType);
    inv = addComponentType(inv, boltType);

    // Typical Detail Assembly Rule (4 bolts per connection)
    const rule: AssemblyRule = {
      id: "rule-typ-baseplate-4bolt",
      name: "Detail 4/S-501 Baseplate",
      revision: 1,
      parentCategory: "connection",
      detailEvidenceId: "ev-detail-4-s501",
      childQuotas: [
        {
          typeId: "fastener/m20-hex-bolt",
          count: 4,
          role: "anchor-bolt",
          relativeOffset: null,
          unresolvedFields: [],
        },
      ],
      notes: "Applies to all C1 column bases",
    };
    inv = addAssemblyRule(inv, rule);

    // Instantiate 12 physical connections on Level 3 (Grid lines 1 to 12 along Grid B)
    const connectionIds: string[] = [];
    for (let i = 1; i <= 12; i++) {
      const connId = `conn-c1-col-${String(i).padStart(2, "0")}`;
      const connInstance: PhysicalInstance = {
        id: connId,
        stableIdentifier: `spatial-bld1-lvl3-grid-b-${i}`,
        displayMark: `C1.${i}`,
        revision: 1,
        typeId: "conn/baseplate-type-1",
        parentAssemblyInstanceId: null,
        spatial: {
          buildingId: "bld-1",
          storeyId: "lvl-3",
          spaceId: null,
          nearestGrid: `B-${i}`,
          position: { x: i * 6.0, y: 18.0, z: 12.0 },
          rotationDeg: 0,
        },
        phase: "new",
        quantityBasis: { method: "direct-count" },
        unresolvedProperties: [],
        evidenceIds: ["ev-detail-4-s501"],
        review: { status: "verified", reviewedBy: "eng-reviewer", reviewedAt: now, note: "Plan verified" },
      };
      inv = addPhysicalInstance(inv, connInstance);
      connectionIds.push(connId);
    }

    // Now apply the assembly rule across all 12 connections
    for (const connId of connectionIds) {
      const result = instantiateAssembly(inv, connId, "rule-typ-baseplate-4bolt", "system-rule-engine");
      inv = result.inventory;
      assert.equal(result.childInstanceIds.length, 4, "Each connection must yield exactly 4 bolts");
    }

    // VERIFICATION:
    // Total connections = 12
    // Total bolts = 48
    const connQuery = queryInventory(inv, { category: "connection" });
    const boltQuery = queryInventory(inv, { category: "fastener" });

    assert.equal(connQuery.totalCount, 12, "Must have exactly 12 connection instances");
    assert.equal(boltQuery.totalCount, 48, "Must have exactly 48 bolt instances (12 x 4)");

    // Every bolt must point to its specific parent connection
    for (const bolt of boltQuery.instances) {
      assert.ok(bolt.parentAssemblyInstanceId, "Bolt must reference parent connection");
      assert.ok(connectionIds.includes(bolt.parentAssemblyInstanceId!), "Parent must be one of the 12 connections");
      assert.equal(bolt.quantityBasis.method, "detail-rule");
      assert.equal((bolt.quantityBasis as { ruleId: string }).ruleId, "rule-typ-baseplate-4bolt");
    }
  });

  it("isolates display marks: renaming B1 does not mutate stable IDs or break evidence links", () => {
    let inv = createEmptyInventory("proj-hospital-01");

    const ev: EvidenceBinding = {
      id: "ev-1",
      documentId: "doc-1",
      pageIndex: 0,
      sha256: dummyHash,
      viewKind: "plan",
      detailTag: null,
      boundingBox: null,
      verifiedAt: now,
      notes: "",
    };
    inv = addEvidenceBinding(inv, ev);

    const type: ComponentType = {
      id: "fastener/bolt-a",
      discipline: "structural",
      category: "fastener",
      standardName: "Standard Bolt",
      materialGrade: null,
      nominalDimensions: {},
      scheduleTag: null,
    };
    inv = addComponentType(inv, type);

    const inst: PhysicalInstance = {
      id: "inst-001",
      stableIdentifier: "stable-pos-key-x10-y20",
      displayMark: "B1",
      revision: 1,
      typeId: "fastener/bolt-a",
      parentAssemblyInstanceId: null,
      spatial: { buildingId: null, storeyId: null, spaceId: null, nearestGrid: null, position: null, rotationDeg: null },
      phase: "new",
      quantityBasis: { method: "direct-count" },
      unresolvedProperties: [],
      evidenceIds: ["ev-1"],
      review: { status: "draft", reviewedBy: null, reviewedAt: null, note: null },
    };
    inv = addPhysicalInstance(inv, inst);

    // Rename display mark B1 -> Bolt-North-Anchor-01
    inv = updateDisplayMark(inv, "inst-001", "Bolt-North-Anchor-01");

    const updated = inv.instances.find((i) => i.id === "inst-001");
    assert.ok(updated);
    assert.equal(updated.displayMark, "Bolt-North-Anchor-01");
    assert.equal(updated.stableIdentifier, "stable-pos-key-x10-y20", "Stable ID must remain unchanged");
    assert.deepEqual(updated.evidenceIds, ["ev-1"], "Evidence references must remain unchanged");
  });

  it("propagates assembly rule updates deterministically: changing 4 bolts to 6 bolts yields 72 bolts", () => {
    let inv = createEmptyInventory("proj-hospital-01");

    const evDetail: EvidenceBinding = {
      id: "ev-det",
      documentId: "doc-1",
      pageIndex: 1,
      sha256: dummyHash,
      viewKind: "detail",
      detailTag: "1/S-501",
      boundingBox: null,
      verifiedAt: now,
      notes: "",
    };
    inv = addEvidenceBinding(inv, evDetail);

    const connType: ComponentType = {
      id: "conn/base",
      discipline: "structural",
      category: "connection",
      standardName: "Base",
      materialGrade: null,
      nominalDimensions: {},
      scheduleTag: null,
    };
    const boltType: ComponentType = {
      id: "fastener/m20",
      discipline: "structural",
      category: "fastener",
      standardName: "M20 Bolt",
      materialGrade: null,
      nominalDimensions: {},
      scheduleTag: null,
    };
    inv = addComponentType(inv, connType);
    inv = addComponentType(inv, boltType);

    const rule: AssemblyRule = {
      id: "rule-conn",
      name: "Detail Rule",
      revision: 1,
      parentCategory: "connection",
      detailEvidenceId: "ev-det",
      childQuotas: [{ typeId: "fastener/m20", count: 4, role: "bolt", relativeOffset: null, unresolvedFields: [] }],
      notes: "",
    };
    inv = addAssemblyRule(inv, rule);

    // 12 connections
    for (let i = 1; i <= 12; i++) {
      inv = addPhysicalInstance(inv, {
        id: `conn-${i}`,
        stableIdentifier: `stable-conn-${i}`,
        displayMark: `C.${i}`,
        revision: 1,
        typeId: "conn/base",
        parentAssemblyInstanceId: null,
        spatial: { buildingId: null, storeyId: null, spaceId: null, nearestGrid: null, position: null, rotationDeg: null },
        phase: "new",
        quantityBasis: { method: "direct-count" },
        unresolvedProperties: [],
        evidenceIds: ["ev-det"],
        review: { status: "verified", reviewedBy: "eng", reviewedAt: now, note: null },
      });
      const res = instantiateAssembly(inv, `conn-${i}`, "rule-conn");
      inv = res.inventory;
    }

    assert.equal(queryInventory(inv, { category: "fastener" }).totalCount, 48);

    // Now update rule from 4 to 6 bolts
    inv = updateAssemblyRule(
      inv,
      "rule-conn",
      [{ typeId: "fastener/m20", count: 6, role: "bolt", relativeOffset: null, unresolvedFields: [] }],
      "lead-structural-engineer",
    );

    // VERIFICATION:
    // 12 connections * 6 bolts = 72 bolts!
    const boltQuery = queryInventory(inv, { category: "fastener" });
    assert.equal(boltQuery.totalCount, 72, "12 connections with 6 bolts must equal exactly 72 bolts");
  });

  it("captures unresolved properties explicitly without hallucinating missing values", () => {
    let inv = createEmptyInventory("proj-hospital-01");

    const ev: EvidenceBinding = {
      id: "ev-unresolved-callout",
      documentId: "doc-1",
      pageIndex: 10,
      sha256: dummyHash,
      viewKind: "detail",
      detailTag: "Callout 3",
      boundingBox: null,
      verifiedAt: now,
      notes: "Drawing note states: 'Provide anchor bolts as required by manufacturer'",
    };
    inv = addEvidenceBinding(inv, ev);

    const boltType: ComponentType = {
      id: "fastener/unspecified-anchor",
      discipline: "structural",
      category: "fastener",
      standardName: "Unspecified Anchor Bolt",
      materialGrade: null,
      nominalDimensions: {},
      scheduleTag: null,
    };
    inv = addComponentType(inv, boltType);

    const rule: AssemblyRule = {
      id: "rule-unresolved",
      name: "Unresolved Anchor Rule",
      revision: 1,
      parentCategory: "connection",
      detailEvidenceId: "ev-unresolved-callout",
      childQuotas: [
        {
          typeId: "fastener/unspecified-anchor",
          count: 4,
          role: "anchor",
          relativeOffset: null,
          unresolvedFields: ["diameter", "embedment-depth", "steel-grade"], // explicit missing engineering parameters
        },
      ],
      notes: "Requires structural engineer RFI",
    };
    inv = addAssemblyRule(inv, rule);

    inv = addPhysicalInstance(inv, {
      id: "conn-unresolved-01",
      stableIdentifier: "pos-c1",
      displayMark: "C1",
      revision: 1,
      typeId: "fastener/unspecified-anchor",
      parentAssemblyInstanceId: null,
      spatial: { buildingId: null, storeyId: null, spaceId: null, nearestGrid: null, position: null, rotationDeg: null },
      phase: "new",
      quantityBasis: { method: "direct-count" },
      unresolvedProperties: [],
      evidenceIds: ["ev-unresolved-callout"],
      review: { status: "draft", reviewedBy: null, reviewedAt: null, note: null },
    });

    const res = instantiateAssembly(inv, "conn-unresolved-01", "rule-unresolved");
    inv = res.inventory;

    // VERIFICATION:
    const query = queryInventory(inv, { hasUnresolvedProperties: true });
    assert.equal(query.unresolvedCount, 4, "Must flag all 4 child bolts as having unresolved properties");
    assert.deepEqual(query.instances[0].unresolvedProperties, [
      "diameter",
      "embedment-depth",
      "steel-grade",
    ]);

    // Entire inventory envelope passes Zod validation
    assert.equal(componentInventorySchema.safeParse(inv).success, true);
  });

  it("rejects duplicate physical components sharing the same stableIdentifier even with different instance IDs", () => {
    let inv = createEmptyInventory("proj-dup-test");

    const ev: EvidenceBinding = {
      id: "ev-dup-plan",
      documentId: "doc-1",
      pageIndex: 1,
      sha256: dummyHash,
      viewKind: "plan",
      detailTag: null,
      boundingBox: null,
      verifiedAt: now,
      notes: "Plan sheet",
    };
    inv = addEvidenceBinding(inv, ev);

    const compType: ComponentType = {
      id: "comp/column-c1",
      discipline: "structural",
      category: "column",
      standardName: "Column 310UC158",
      materialGrade: "300PLUS",
      nominalDimensions: {},
      scheduleTag: "C1",
    };
    inv = addComponentType(inv, compType);

    const instance1: PhysicalInstance = {
      id: "inst-uuid-1",
      stableIdentifier: "pos-grid-b4-lvl3", // Real spatial key
      displayMark: "C1",
      revision: 1,
      typeId: "comp/column-c1",
      parentAssemblyInstanceId: null,
      spatial: { buildingId: null, storeyId: null, spaceId: null, nearestGrid: "B-4", position: null, rotationDeg: null },
      phase: "new",
      quantityBasis: { method: "direct-count" },
      unresolvedProperties: [],
      evidenceIds: ["ev-dup-plan"],
      review: { status: "draft", reviewedBy: null, reviewedAt: null, note: null },
    };
    inv = addPhysicalInstance(inv, instance1);

    // Attempting to add a second record with a different UUID but the SAME spatial stableIdentifier
    const instance2Duplicate: PhysicalInstance = {
      id: "inst-uuid-2-different",
      stableIdentifier: "pos-grid-b4-lvl3", // SAME spatial key!
      displayMark: "C1-Second-Detection",
      revision: 1,
      typeId: "comp/column-c1",
      parentAssemblyInstanceId: null,
      spatial: { buildingId: null, storeyId: null, spaceId: null, nearestGrid: "B-4", position: null, rotationDeg: null },
      phase: "new",
      quantityBasis: { method: "direct-count" },
      unresolvedProperties: [],
      evidenceIds: ["ev-dup-plan"],
      review: { status: "draft", reviewedBy: null, reviewedAt: null, note: null },
    };

    // 1. addPhysicalInstance must reject it with an explicit message
    assert.throws(
      () => addPhysicalInstance(inv, instance2Duplicate),
      /Duplicate physical components are forbidden/i,
    );

    // 2. Direct schema parse with both records must also fail superRefine
    const rawInvWithDups = {
      ...inv,
      instances: [...inv.instances, instance2Duplicate],
    };
    const parseResult = componentInventorySchema.safeParse(rawInvWithDups);
    assert.equal(parseResult.success, false);
    if (!parseResult.success) {
      const issue = parseResult.error.issues.find((i) => i.path.includes("stableIdentifier"));
      assert.ok(issue, "Must produce a schema validation issue for duplicate stableIdentifier");
      assert.match(issue.message, /Duplicate physical component detected with same stableIdentifier/);
    }
  });

  it("preserves surviving components in place (retains custom display mark, section evidence, review, and revision 3) when assembly rule updates from 4 to 6 bolts", () => {
    let inv = createEmptyInventory("proj-rule-update-test");

    const evPlan: EvidenceBinding = {
      id: "ev-plan-1",
      documentId: "doc-1",
      pageIndex: 1,
      sha256: dummyHash,
      viewKind: "plan",
      detailTag: null,
      boundingBox: null,
      verifiedAt: now,
      notes: "Plan framing",
    };
    const evSection: EvidenceBinding = {
      id: "ev-sec-custom",
      documentId: "doc-1",
      pageIndex: 20,
      sha256: dummyHash,
      viewKind: "section",
      detailTag: "B/S-201",
      boundingBox: null,
      verifiedAt: now,
      notes: "User-added section reference",
    };
    const evDetail: EvidenceBinding = {
      id: "ev-det-orig",
      documentId: "doc-1",
      pageIndex: 50,
      sha256: dummyHash,
      viewKind: "detail",
      detailTag: "4/S-501",
      boundingBox: null,
      verifiedAt: now,
      notes: "Original 4-bolt detail",
    };

    inv = addEvidenceBinding(inv, evPlan);
    inv = addEvidenceBinding(inv, evSection);
    inv = addEvidenceBinding(inv, evDetail);

    const connType: ComponentType = {
      id: "conn-c1",
      discipline: "structural",
      category: "connection",
      standardName: "Baseplate C1",
      materialGrade: "Grade 350",
      nominalDimensions: {},
      scheduleTag: "C1",
    };
    const boltType: ComponentType = {
      id: "bolt-m20",
      discipline: "structural",
      category: "fastener",
      standardName: "M20 Bolt",
      materialGrade: "Grade 8.8",
      nominalDimensions: {},
      scheduleTag: "B1",
    };
    inv = addComponentType(inv, connType);
    inv = addComponentType(inv, boltType);

    const rule: AssemblyRule = {
      id: "rule-conn-c1",
      name: "C1 Baseplate 4-Bolt Assembly",
      revision: 1,
      parentCategory: "connection",
      detailEvidenceId: "ev-det-orig",
      childQuotas: [{ typeId: "bolt-m20", count: 4, role: "bolt", relativeOffset: null, unresolvedFields: [] }],
      notes: "Detail 4/S-501",
    };
    inv = addAssemblyRule(inv, rule);

    // Create 1 parent connection
    inv = addPhysicalInstance(inv, {
      id: "conn-parent-01",
      stableIdentifier: "pos-c1-col1",
      displayMark: "C1.01",
      revision: 1,
      typeId: "conn-c1",
      parentAssemblyInstanceId: null,
      spatial: { buildingId: null, storeyId: null, spaceId: null, nearestGrid: "B-1", position: null, rotationDeg: null },
      phase: "new",
      quantityBasis: { method: "direct-count" },
      unresolvedProperties: [],
      evidenceIds: ["ev-plan-1"],
      review: { status: "verified", reviewedBy: "Engineer A", reviewedAt: now, note: "Initial check" },
    });

    // Expand rule: 4 bolts instantiated
    const expandRes = instantiateAssembly(inv, "conn-parent-01", "rule-conn-c1");
    inv = expandRes.inventory;
    assert.equal(inv.instances.length, 5); // 1 parent + 4 bolts

    // Now USER EDITS Bolt #1:
    // 1. Gives it a custom display mark
    // 2. Binds a section evidence reference (ev-sec-custom)
    // 3. Verifies it with a review note
    // 4. Advances revision to 3
    const bolt1Id = "conn-parent-01-child-bolt-1";
    inv = bindEvidenceToInstance(inv, bolt1Id, "ev-sec-custom");
    inv = updateDisplayMark(inv, bolt1Id, "Custom-Bolt-NorthWest");

    // Manually advance revision to 3 to simulate intermediate edits
    inv = {
      ...inv,
      instances: inv.instances.map((inst) =>
        inst.id === bolt1Id
          ? {
              ...inst,
              revision: 3,
              review: {
                status: "verified" as const,
                reviewedBy: "Chief Structural Engineer",
                reviewedAt: now,
                note: "Critical load-bearing corner bolt approved with section callout",
              },
            }
          : inst,
      ),
    };

    const bolt1BeforeUpdate = inv.instances.find((i) => i.id === bolt1Id)!;
    assert.equal(bolt1BeforeUpdate.displayMark, "Custom-Bolt-NorthWest");
    assert.equal(bolt1BeforeUpdate.revision, 3);
    assert.ok(bolt1BeforeUpdate.evidenceIds.includes("ev-sec-custom"));
    assert.equal(bolt1BeforeUpdate.review.status, "verified");

    // NOW UPDATE THE ASSEMBLY RULE: Change quota from 4 to 6 bolts!
    const newQuotas: ChildComponentQuota[] = [
      { typeId: "bolt-m20", count: 6, role: "bolt", relativeOffset: null, unresolvedFields: [] },
    ];
    inv = updateAssemblyRule(inv, "rule-conn-c1", newQuotas, "Chief Structural Engineer");

    // Total instances must now be 1 parent + 6 bolts = 7
    assert.equal(inv.instances.length, 7);

    // CRITICAL CHECK: Surviving Bolt #1 MUST BE PRESERVED IN PLACE!
    const bolt1AfterUpdate = inv.instances.find((i) => i.id === bolt1Id);
    assert.ok(bolt1AfterUpdate, "Bolt #1 must still exist");
    assert.equal(bolt1AfterUpdate.displayMark, "Custom-Bolt-NorthWest", "Must preserve custom display mark!");
    assert.equal(bolt1AfterUpdate.revision, 3, "Must preserve revision 3, not reset to 1!");
    assert.ok(bolt1AfterUpdate.evidenceIds.includes("ev-sec-custom"), "Must preserve user-attached section evidence!");
    assert.equal(bolt1AfterUpdate.review.status, "verified", "Must preserve review status!");
    assert.equal(bolt1AfterUpdate.review.reviewedBy, "Chief Structural Engineer");

    // New bolts #5 and #6 exist and have initial revision 1
    const bolt5 = inv.instances.find((i) => i.id === "conn-parent-01-child-bolt-5");
    const bolt6 = inv.instances.find((i) => i.id === "conn-parent-01-child-bolt-6");
    assert.ok(bolt5, "New bolt #5 must be added");
    assert.ok(bolt6, "New bolt #6 must be added");
    assert.equal(bolt5.revision, 1);
    assert.equal(bolt6.revision, 1);

    // Entire inventory envelope is valid
    assert.equal(componentInventorySchema.safeParse(inv).success, true);

    // NOW SHRINK THE ASSEMBLY RULE: Change quota from 6 to 2 bolts!
    const shrinkQuotas: ChildComponentQuota[] = [
      { typeId: "bolt-m20", count: 2, role: "bolt", relativeOffset: null, unresolvedFields: [] },
    ];
    inv = updateAssemblyRule(inv, "rule-conn-c1", shrinkQuotas, "Chief Structural Engineer");

    // Total instances must now be 1 parent + 2 bolts = 3
    assert.equal(inv.instances.length, 3);
    const bolt1AfterShrink = inv.instances.find((i) => i.id === bolt1Id);
    assert.ok(bolt1AfterShrink, "Bolt #1 must survive shrinkage");
    assert.equal(bolt1AfterShrink.displayMark, "Custom-Bolt-NorthWest");
    assert.equal(bolt1AfterShrink.revision, 3);
    assert.ok(bolt1AfterShrink.evidenceIds.includes("ev-sec-custom"));

    // Bolts 3, 4, 5, 6 must be pruned
    assert.equal(inv.instances.some((i) => i.id === "conn-parent-01-child-bolt-3"), false);
    assert.equal(inv.instances.some((i) => i.id === "conn-parent-01-child-bolt-5"), false);

    assert.equal(componentInventorySchema.safeParse(inv).success, true);
  });

  it("updates rule-derived properties (e.g. M20 to M24, and unresolved embedment requirement) across all surviving components while preserving custom marks and evidence", () => {
    let inv = createEmptyInventory("proj-m24-test");

    const evDetail: EvidenceBinding = {
      id: "ev-det-c1",
      documentId: "doc-1",
      pageIndex: 82,
      sha256: dummyHash,
      viewKind: "detail",
      detailTag: "4/S-501",
      boundingBox: null,
      verifiedAt: now,
      notes: "Baseplate Detail",
    };
    inv = addEvidenceBinding(inv, evDetail);

    const m20Type: ComponentType = {
      id: "fastener/m20-bolt",
      discipline: "structural",
      category: "fastener",
      standardName: "M20 Structural Bolt",
      materialGrade: "Grade 8.8",
      nominalDimensions: {},
      scheduleTag: "B1",
    };
    const m24Type: ComponentType = {
      id: "fastener/m24-bolt",
      discipline: "structural",
      category: "fastener",
      standardName: "M24 Heavy Duty Structural Bolt",
      materialGrade: "Grade 10.9",
      nominalDimensions: {},
      scheduleTag: "B2",
    };
    const connType: ComponentType = {
      id: "conn/baseplate",
      discipline: "structural",
      category: "connection",
      standardName: "Baseplate",
      materialGrade: "Grade 350",
      nominalDimensions: {},
      scheduleTag: "C1",
    };

    inv = addComponentType(inv, m20Type);
    inv = addComponentType(inv, m24Type);
    inv = addComponentType(inv, connType);

    const ruleM20: AssemblyRule = {
      id: "rule-baseplate-bolts",
      name: "Column Baseplate Rule",
      revision: 1,
      parentCategory: "connection",
      detailEvidenceId: "ev-det-c1",
      childQuotas: [{ typeId: "fastener/m20-bolt", count: 4, role: "bolt", relativeOffset: null, unresolvedFields: [] }],
      notes: "Detail 4/S-501",
    };
    inv = addAssemblyRule(inv, ruleM20);

    // Create 12 connections
    for (let i = 1; i <= 12; i++) {
      const num = String(i).padStart(2, "0");
      inv = addPhysicalInstance(inv, {
        id: `conn-${num}`,
        stableIdentifier: `conn-grid-b-${i}`,
        displayMark: `C1.${num}`,
        revision: 1,
        typeId: "conn/baseplate",
        parentAssemblyInstanceId: null,
        spatial: { buildingId: null, storeyId: null, spaceId: null, nearestGrid: `B-${i}`, position: null, rotationDeg: null },
        phase: "new",
        quantityBasis: { method: "direct-count" },
        unresolvedProperties: [],
        evidenceIds: ["ev-det-c1"],
        review: { status: "verified", reviewedBy: null, reviewedAt: null, note: null },
      });
      const res = instantiateAssembly(inv, `conn-${num}`, "rule-baseplate-bolts");
      inv = res.inventory;
    }

    // Verify initially: 48 M20 bolts, 0 M24 bolts, 0 unresolved items
    const qInitial = queryInventory(inv);
    assert.equal(qInitial.countsByType["fastener/m20-bolt"], 48);
    assert.equal(qInitial.countsByType["fastener/m24-bolt"] ?? 0, 0);
    assert.equal(qInitial.unresolvedCount, 0);

    // USER adds custom mark and custom review to Bolt #1
    const customBoltId = "conn-01-child-bolt-1";
    inv = updateDisplayMark(inv, customBoltId, "Custom-Anchor-North");

    // NOW UPDATE RULE: Switch from M20 to M24 bolts AND add unresolved embedment-depth requirement!
    const ruleM24Quotas: ChildComponentQuota[] = [
      {
        typeId: "fastener/m24-bolt",
        count: 4,
        role: "bolt",
        relativeOffset: null,
        unresolvedFields: ["embedment-depth-verification"],
      },
    ];
    inv = updateAssemblyRule(inv, "rule-baseplate-bolts", ruleM24Quotas, "Senior Structural Engineer");

    // VERIFY:
    // 1. All 48 bolts are now M24 bolts (0 M20 bolts remaining)
    const qUpdated = queryInventory(inv);
    assert.equal(qUpdated.countsByType["fastener/m24-bolt"], 48, "Must report 48 M24 bolts");
    assert.equal(qUpdated.countsByType["fastener/m20-bolt"] ?? 0, 0, "Must report 0 M20 bolts");

    // 2. All 48 bolts report unresolved embedment-depth-verification!
    assert.equal(qUpdated.unresolvedCount, 48, "Must report 48 unresolved items");
    const sampleBolt = inv.instances.find((i) => i.id === customBoltId)!;
    assert.ok(sampleBolt.unresolvedProperties.includes("embedment-depth-verification"));

    // 3. User custom display mark is PRESERVED!
    assert.equal(sampleBolt.displayMark, "Custom-Anchor-North", "User custom display mark must be preserved");

    // 4. Passes complete schema validation
    assert.equal(componentInventorySchema.safeParse(inv).success, true);
  });
});

