import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, it } from "node:test";

import type { BomBuildRequest, BomBuildResponse } from "./bomContract.ts";
import { createBomState } from "./bomState.ts";
import { createDefaultJob } from "./domain.ts";
import { resetStudioHydrationForTests, useStudio } from "./store.ts";

const FIXTURES = new URL("../../engine/fixtures/bom-contract/", import.meta.url);
const T0 = "2026-09-04T00:00:00.000Z";
const T1 = "2026-09-04T00:00:01.000Z";

async function fixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(new URL(name, FIXTURES), "utf8"));
}

describe("studio durable BOM integration", () => {
  let request: BomBuildRequest;
  let response: BomBuildResponse;

  beforeEach(async () => {
    request = await fixture("colorbond.request.json");
    response = await fixture("colorbond.response.json");
    const job = {
      ...createDefaultJob(T0),
      id: request.job.id,
      revision: request.job.revision,
      activeDocumentId: request.document.id,
      documents: [
        {
          id: request.document.id,
          name: request.document.name,
          kind: request.document.kind,
          importedAt: T0,
          pageCount: 1,
          sha256: request.document.sha256,
          source: "web" as const,
        },
      ],
    };
    resetStudioHydrationForTests();
    useStudio.setState({
      job,
      bomState: createBomState(job.id),
      bomPersistenceError: null,
      persistenceHydrated: false,
    });
  });

  it("begins and atomically commits only the response bound to the active job revision", () => {
    useStudio.getState().beginBomGeneration(request, T0);
    const committed = useStudio.getState().completeBomGeneration(response, T1);
    assert.equal(committed.ok, true);
    assert.deepEqual(useStudio.getState().bomState.snapshot?.response, response);
    assert.equal(useStudio.getState().bomState.pending, null);
  });

  it("marks the retained snapshot stale as soon as the job revision changes", () => {
    useStudio.getState().beginBomGeneration(request, T0);
    useStudio.getState().completeBomGeneration(response, T1);
    const snapshot = useStudio.getState().bomState.snapshot;

    useStudio.setState((state) => ({ job: { ...state.job, revision: state.job.revision + 1 } }));

    assert.deepEqual(useStudio.getState().bomState.snapshot, snapshot);
    assert.deepEqual(useStudio.getState().bomState.invalidation?.reasons, ["job-changed"]);
  });

  it("retains but invalidates the snapshot when recipe decisions change", () => {
    useStudio.getState().beginBomGeneration(request, T0);
    useStudio.getState().completeBomGeneration(response, T1);
    const snapshot = useStudio.getState().bomState.snapshot;

    useStudio.getState().reconcileBomRecipeSet(
      {
        ...request.recipeSet,
        revision: request.recipeSet.revision + 1,
        digest: "d".repeat(64),
      },
      "2026-09-04T00:00:02.000Z",
    );

    assert.deepEqual(useStudio.getState().bomState.snapshot, snapshot);
    assert.deepEqual(useStudio.getState().bomState.invalidation?.reasons, ["recipe-changed"]);
  });

  it("rejects a late completion after the active job changes", () => {
    useStudio.getState().beginBomGeneration(request, T0);
    useStudio.setState((state) => ({ job: { ...state.job, revision: state.job.revision + 1 } }));

    const late = useStudio.getState().completeBomGeneration(response, T1);
    assert.equal(late.ok, false);
    assert.equal(late.reason, "no-pending-build");
    assert.equal(useStudio.getState().bomState.snapshot, null);
  });

  it("retains historical engine snapshot but cancels and rejects pending output after a source switch", () => {
    useStudio.getState().beginBomGeneration(request, T0);
    useStudio.getState().completeBomGeneration(response, T1);
    const snapshot = useStudio.getState().bomState.snapshot;
    useStudio.getState().beginBomGeneration(request, T0);
    useStudio.setState((state) => ({
      job: {
        ...state.job,
        activeDocumentId: "other-source",
        documents: [
          ...state.job.documents,
          {
            ...state.job.documents[0],
            id: "other-source",
            sha256: "f".repeat(64),
          },
        ],
      },
    }));
    assert.deepEqual(useStudio.getState().bomState.snapshot, snapshot);
    assert.equal(useStudio.getState().bomState.pending, null);
    assert.ok(useStudio.getState().bomState.invalidation?.reasons.includes("source-changed"));
    assert.equal(useStudio.getState().completeBomGeneration(response, T1).ok, false);
    assert.deepEqual(useStudio.getState().bomState.snapshot, snapshot);
  });

  it("refuses to start a request compiled from a stale job or source", () => {
    assert.throws(
      () =>
        useStudio
          .getState()
          .beginBomGeneration(
            { ...request, job: { ...request.job, revision: request.job.revision - 1 } },
            T0,
          ),
      /active job revision/i,
    );
    assert.throws(
      () =>
        useStudio.getState().beginBomGeneration(
          {
            ...request,
            document: { ...request.document, sha256: `b${request.document.sha256.slice(1)}` },
          },
          T0,
        ),
      /verified source document/i,
    );
    assert.equal(useStudio.getState().bomState.pending, null);
  });
});
