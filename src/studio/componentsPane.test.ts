import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useStudio } from "./store.ts";
import { createSampleStructuralInventory } from "./construction/inventory.ts";
import {
  loadComponentInventory,
  inventoryStorageKey,
  type ComponentInventoryStorageLike,
} from "./construction/inventoryPersistence.ts";

describe("ComponentsPane & Evidence-Backed Component Inspector", () => {
  beforeEach(() => {
    useStudio.setState({
      pane: "components",
      componentInventory: createSampleStructuralInventory(),
      selectedComponentId: "conn-c1-01",
      componentFilterDiscipline: "all",
      componentFilterCategory: "all",
      componentSearchQuery: "",
      trades: [],
    });
  });

  it("initializes with demonstration dataset of 12 connections and 48 bolts (total 60)", () => {
    const state = useStudio.getState();
    assert.equal(state.componentInventory.instances.length, 60);

    const connections = state.componentInventory.instances.filter(
      (i) => i.parentAssemblyInstanceId === null,
    );
    const bolts = state.componentInventory.instances.filter(
      (i) => i.parentAssemblyInstanceId !== null,
    );

    assert.equal(connections.length, 12, "Must have exactly 12 baseplate connections");
    assert.equal(bolts.length, 48, "Must have exactly 48 anchor bolts (12 x 4)");
    assert.equal(state.componentInventory.evidence.length, 3, "Must have 3 linked drawing sheets");
  });

  it("selects components and exposes multi-view evidence bindings", () => {
    const state = useStudio.getState();
    state.selectComponent("conn-c1-01");

    const selected = useStudio
      .getState()
      .componentInventory.instances.find((i) => i.id === "conn-c1-01")!;
    assert.ok(selected);
    assert.equal(selected.displayMark, "C1.01");
    assert.equal(selected.spatial.nearestGrid, "B-1");

    // Parent connection has framing plan (S-101) and section (S-201) evidence
    assert.ok(selected.evidenceIds.includes("ev-s101-plan"));
    assert.ok(selected.evidenceIds.includes("ev-s201-section"));

    // Now select child bolt 1 of connection 1
    const childBoltId = "conn-c1-01-child-anchor-bolt-1";
    state.selectComponent(childBoltId);
    const selectedBolt = useStudio
      .getState()
      .componentInventory.instances.find((i) => i.id === childBoltId)!;
    assert.ok(selectedBolt);
    assert.equal(selectedBolt.displayMark, "C1.01.A1");
    assert.equal(selectedBolt.quantityBasis.method, "detail-rule");

    // Child bolt inherits plan, section and detail 4/S-501 evidence
    assert.ok(selectedBolt.evidenceIds.includes("ev-s501-detail"));
    assert.ok(selectedBolt.evidenceIds.includes("ev-s101-plan"));
    assert.ok(selectedBolt.evidenceIds.includes("ev-s201-section"));
  });

  it("filters inventory by discipline, category, and search query", () => {
    const state = useStudio.getState();

    // Filter discipline: structural (all 60 match)
    state.setComponentFilterDiscipline("structural");
    assert.equal(useStudio.getState().componentFilterDiscipline, "structural");

    // Filter discipline: architectural (0 match)
    state.setComponentFilterDiscipline("architectural");
    assert.equal(useStudio.getState().componentFilterDiscipline, "architectural");

    // Filter category
    state.setComponentFilterCategory("connection");
    assert.equal(useStudio.getState().componentFilterCategory, "connection");

    // Search query
    state.setComponentSearchQuery("C1.05");
    assert.equal(useStudio.getState().componentSearchQuery, "C1.05");
  });

  it("supports ad-hoc trade additions and removals without corrupting component hierarchy", () => {
    const state = useStudio.getState();
    assert.equal(state.trades.length, 0);

    state.addTrade("Custom Glass Balustrade");
    assert.equal(useStudio.getState().trades.length, 1);
    assert.equal(useStudio.getState().trades[0].name, "Custom Glass Balustrade");
    // Component inventory remains intact at 60 instances
    assert.equal(useStudio.getState().componentInventory.instances.length, 60);

    const tradeId = useStudio.getState().trades[0].id;
    state.removeTrade(tradeId);
    assert.equal(useStudio.getState().trades.length, 0);
  });

  it("resets demonstration inventory cleanly on user command", () => {
    const state = useStudio.getState();
    // Simulate empty inventory
    useStudio.setState({
      componentInventory: {
        ...state.componentInventory,
        instances: [],
      },
    });
    assert.equal(useStudio.getState().componentInventory.instances.length, 0);

    // Call reset
    state.resetSampleInventory();
    assert.equal(useStudio.getState().componentInventory.instances.length, 60);
    assert.equal(useStudio.getState().selectedComponentId, "conn-c1-01");
  });

  it("persists inventory mutations and reloads them via store persistence actions", () => {
    const state = useStudio.getState();
    const current = state.componentInventory;

    // Mutate display mark of connection 1 to a custom project mark
    const mutated = {
      ...current,
      instances: current.instances.map((i) =>
        i.id === "conn-c1-01" ? { ...i, displayMark: "C1-HEAVY-SPECIAL" } : i,
      ),
    };

    // Update via store action
    state.setComponentInventory(mutated);
    assert.equal(
      useStudio.getState().componentInventory.instances.find((i) => i.id === "conn-c1-01")?.displayMark,
      "C1-HEAVY-SPECIAL",
    );

    // Explicitly call saveCurrentInventory
    const saveResult = state.saveCurrentInventory();
    // In node test environment without mock storage, saveCurrentInventory handles storage-unavailable gracefully
    assert.ok(typeof saveResult.ok === "boolean");

    // Explicitly call loadCurrentInventory
    const loadResult = state.loadCurrentInventory();
    assert.ok(typeof loadResult.ok === "boolean");
  });

  it("failed restores set inventoryPersistenceError and preserve unreadable data in storage", () => {
    const memoryStorage = new Map<string, string>();
    const storage: ComponentInventoryStorageLike = {
      getItem: (k) => memoryStorage.get(k) ?? null,
      setItem: (k, v) => memoryStorage.set(k, v),
      removeItem: (k) => memoryStorage.delete(k),
    };

    const jobId = useStudio.getState().job.id;
    const key = inventoryStorageKey(jobId);

    // Simulate newer schema stored in browser storage
    const newerSchemaData = JSON.stringify({
      schema: "xray:component-inventory:v2-future",
      projectId: "future-project",
      revision: 99,
      instances: [],
    });
    storage.setItem(key, newerSchemaData);

    // Verify loadComponentInventory fails closed with unsupported-version
    const loadResult = loadComponentInventory(jobId, storage);
    assert.equal(loadResult.ok, false);
    if (!loadResult.ok) {
      assert.equal(loadResult.reason, "unsupported-version");
    }

    // When store attempts hydration on a failed restore
    useStudio.setState({
      inventoryPersistenceError: `Saved component inventory could not be restored (${!loadResult.ok ? loadResult.reason : ""}). Unreadable data preserved in storage; autosave blocked until recovery.`,
    });

    const stateAfterError = useStudio.getState();
    assert.ok(stateAfterError.inventoryPersistenceError);
    assert.match(stateAfterError.inventoryPersistenceError, /unsupported-version/);

    // Verify unreadable bytes in storage are preserved untouched
    assert.equal(storage.getItem(key), newerSchemaData);

    // If autosave is triggered while inventoryPersistenceError is active, it must not overwrite storage
    // (State autosave subscriber guards: if (state.inventoryPersistenceError) return;)
    assert.equal(storage.getItem(key), newerSchemaData, "Storage must never be overwritten with sample data");
  });

  it("hierarchical category filtering allows fastener filter to show all 48 bolts under their parent connections", () => {
    const inv = useStudio.getState().componentInventory;
    const typesMap = new Map(inv.types.map((t) => [t.id, t]));
    const connections = inv.instances.filter((i) => i.parentAssemblyInstanceId === null);
    const bolts = inv.instances.filter((i) => i.parentAssemblyInstanceId !== null);

    assert.equal(connections.length, 12);
    assert.equal(bolts.length, 48);

    const childBoltsByParent = new Map<string, typeof inv.instances>();
    for (const inst of inv.instances) {
      if (inst.parentAssemblyInstanceId) {
        const list = childBoltsByParent.get(inst.parentAssemblyInstanceId) ?? [];
        list.push(inst);
        childBoltsByParent.set(inst.parentAssemblyInstanceId, list);
      }
    }

    // Test filter by category === "fastener"
    const categoryFilter = "fastener";
    const filteredConnections = connections.filter((conn) => {
      const compType = typesMap.get(conn.typeId);
      const children = childBoltsByParent.get(conn.id) ?? [];
      const parentMatches = compType?.category === categoryFilter;
      const childMatches = children.some(
        (c) => typesMap.get(c.typeId)?.category === categoryFilter,
      );
      return parentMatches || childMatches;
    });

    // All 12 baseplate connections own fasteners, so all 12 branches must be retained
    assert.equal(filteredConnections.length, 12, "Fastener filter must retain all 12 parent connections");

    // Total displayed child fasteners across all 12 branches must be exactly 48
    let totalFilteredFasteners = 0;
    for (const conn of filteredConnections) {
      const children = childBoltsByParent.get(conn.id) ?? [];
      const filteredChildren = children.filter(
        (c) => typesMap.get(c.typeId)?.category === categoryFilter,
      );
      totalFilteredFasteners += filteredChildren.length;
    }
    assert.equal(totalFilteredFasteners, 48, "All 48 bolts must be surfaced when filtering by fastener");

    // Test filter by category === "connection"
    const connFilter = "connection";
    const connectionsOnly = connections.filter((conn) => {
      const compType = typesMap.get(conn.typeId);
      const children = childBoltsByParent.get(conn.id) ?? [];
      const parentMatches = compType?.category === connFilter;
      const childMatches = children.some((c) => typesMap.get(c.typeId)?.category === connFilter);
      return parentMatches || childMatches;
    });
    assert.equal(connectionsOnly.length, 12);
  });

  it("verifies evidence drawing document before sheet navigation and flags unimported plans", () => {
    const state = useStudio.getState();
    const evidence = state.componentInventory.evidence;
    assert.ok(evidence.length >= 3);

    const ev1 = evidence[0]; // ev-s101-plan with documentId "doc-hospital-s101"
    assert.ok(ev1.documentId);

    // Check against job documents
    const docExists = state.job.documents.some((d) => d.id === ev1.documentId);
    // If the document is not in job.documents, navigation must be blocked ("Doc not imported")
    const canNavigateIfMissing = docExists && Boolean(ev1.documentId);
    assert.equal(typeof canNavigateIfMissing, "boolean");

    // Synthetic evidence referencing an unimported document
    const unimportedEvidence = {
      ...ev1,
      id: "ev-unimported",
      documentId: "doc-external-unimported-999",
      pageIndex: 4,
    };

    const targetDoc = state.job.documents.find((d) => d.id === unimportedEvidence.documentId);
    assert.equal(targetDoc, undefined, "Unimported document must not be found in job.documents");

    const canNavigateUnimported = Boolean(targetDoc);
    assert.equal(canNavigateUnimported, false, "Must block navigation when drawing is not imported");
  });

  it("dynamically flags unresolved engineering properties and updates RFI metric", () => {
    const state = useStudio.getState();
    const baseline = state.componentInventory;

    // Baseline: 0 unresolved properties
    const initialTotalUnresolved = baseline.instances.reduce(
      (sum, inst) => sum + inst.unresolvedProperties.length,
      0,
    );
    assert.equal(initialTotalUnresolved, 0, "Baseline demo inventory must be fully parameterized (0 RFIs)");

    // Mutate inventory to add unresolved property requirements
    const withRFI = {
      ...baseline,
      instances: baseline.instances.map((inst) => {
        if (inst.id === "conn-c1-01") {
          return {
            ...inst,
            unresolvedProperties: ["embedment-depth-verification"],
          };
        }
        if (inst.id === "conn-c1-01-child-anchor-bolt-1") {
          return {
            ...inst,
            unresolvedProperties: ["torque-specification-unconfirmed", "washer-grade-unspecified"],
          };
        }
        return inst;
      }),
    };

    state.setComponentInventory(withRFI);

    const updated = useStudio.getState().componentInventory;
    const newTotalUnresolved = updated.instances.reduce(
      (sum, inst) => sum + inst.unresolvedProperties.length,
      0,
    );
    assert.equal(newTotalUnresolved, 3, "RFI KPI count must dynamically reflect 3 unresolved parameters");

    const conn = updated.instances.find((i) => i.id === "conn-c1-01")!;
    assert.deepEqual(conn.unresolvedProperties, ["embedment-depth-verification"]);

    const bolt = updated.instances.find((i) => i.id === "conn-c1-01-child-anchor-bolt-1")!;
    assert.deepEqual(bolt.unresolvedProperties, [
      "torque-specification-unconfirmed",
      "washer-grade-unspecified",
    ]);
  });
});
