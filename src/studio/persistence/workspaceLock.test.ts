import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { canMountStudio, READ_ONLY_NOTICE, TAKE_OVER_LABEL, WorkspaceRecoveryScreen } from "../workspaceRecoveryScreen.ts";
import {
  LOCK_STALE_AFTER_MS,
  WORKSPACE_LOCK_NAME,
  createLease,
  createMemoryLockBackend,
  createMemoryLockBus,
  decideLease,
  openWorkspaceLock,
  workspaceLeaseSchema,
  type LockClock,
  type WorkspaceLease,
} from "./workspaceLock.ts";

const PROJECT = "project-1";
const T0 = "2026-09-22T00:00:00.000Z";

function clockAt(start = T0): LockClock & { set(iso: string): void } {
  let current = new Date(start);
  return {
    now: () => new Date(current.getTime()),
    set(iso) { current = new Date(iso); },
    every: () => () => {},
    wait: () => Promise.resolve(),
  };
}

function lease(now: Date, holderId = "holder", reason: WorkspaceLease["reason"] = "first-open"): WorkspaceLease {
  return createLease({ projectId: PROJECT, holderId, reason, now });
}

async function flush() {
  for (let step = 0; step < 8; step += 1) await Promise.resolve();
}

describe("SC-16 workspace lock", () => {
  it("B1 rejects a heartbeat that precedes acquisition", async () => {
    const sample = lease(new Date(T0));
    await assert.rejects(async () => workspaceLeaseSchema.parse({ ...sample, heartbeatAt: "2026-09-21T23:00:00.000Z" }), /cannot heartbeat before/);
  });

  it("B2 rejects an expiry equal to the heartbeat", async () => {
    const sample = lease(new Date(T0));
    await assert.rejects(async () => workspaceLeaseSchema.parse({ ...sample, expiresAt: sample.heartbeatAt }), /expire after/);
  });

  it("B5 gives the exclusive lock to exactly one of two racing tabs", async () => {
    const backend = createMemoryLockBackend();
    const bus = createMemoryLockBus();
    const clock = clockAt();
    const [first, second] = await Promise.all([
      openWorkspaceLock({ projectId: PROJECT, holderId: "tab-a", backend, bus, clock }),
      openWorkspaceLock({ projectId: PROJECT, holderId: "tab-b", backend, bus, clock }),
    ]);
    assert.deepEqual([first.mode, second.mode].sort(), ["exclusive", "read-only"]);
    assert.equal(backend.heldCount(), 1);
    assert.equal(WORKSPACE_LOCK_NAME, "xray:editing-workspace:v1");
  });

  it("B6 keeps a clock-skewed lease read-only instead of taking it over", () => {
    const heartbeat = new Date(T0);
    const sample = workspaceLeaseSchema.parse({
      ...lease(heartbeat),
      expiresAt: new Date(heartbeat.getTime() + 1).toISOString(),
    });
    const decision = decideLease(sample, new Date(heartbeat.getTime() + 1000), "reader");
    assert.equal(decision.action, "read-only");
    if (decision.action === "read-only") assert.equal(decision.holderId, "holder");
  });

  it("B7 reclaims a holder that missed three heartbeats after its own expiry", () => {
    const heartbeat = new Date(T0);
    const sample = lease(heartbeat);
    const decision = decideLease(sample, new Date(heartbeat.getTime() + LOCK_STALE_AFTER_MS), "reader");
    assert.deepEqual(decision, { action: "takeover", heldSince: sample.acquiredAt, reason: "stale-reclaim" });
  });

  it("times out a takeover while the holder is still heartbeating and still holds the lock", async () => {
    const backend = createMemoryLockBackend();
    const bus = createMemoryLockBus();
    const clock = clockAt();
    await backend.requestExclusive(WORKSPACE_LOCK_NAME);
    let releaseWait!: () => void;
    const waitGate = new Promise<void>((resolve) => { releaseWait = resolve; });
    const opening = openWorkspaceLock({
      projectId: PROJECT, holderId: "reader", backend, bus, clock,
      takeoverWait: () => waitGate,
    });
    bus.post({ type: "heartbeat", lease: lease(clock.now()) });
    const reader = await opening;
    assert.equal(reader.mode, "read-only");
    assert.equal(reader.foreignHolderId, "holder");
    const pending = reader.requestTakeover();
    releaseWait();
    assert.equal(await pending, "still-held");
    assert.equal(reader.mode, "read-only");
    assert.equal(backend.heldCount(), 1);
  });

  it("releases the lock so the read-only tab can acquire it", async () => {
    const backend = createMemoryLockBackend();
    const bus = createMemoryLockBus();
    const clock = clockAt();
    const holder = await openWorkspaceLock({ projectId: PROJECT, holderId: "holder", backend, bus, clock });
    const reader = await openWorkspaceLock({ projectId: PROJECT, holderId: "reader", backend, bus, clock });
    assert.equal(holder.mode, "exclusive");
    assert.equal(reader.mode, "read-only");
    holder.release();
    await reader.idle();
    assert.equal(holder.mode, "read-only");
    assert.equal(reader.mode, "exclusive");
    assert.equal(reader.lease?.reason, "first-open");
    assert.equal(backend.heldCount(), 1);
  });

  it("hands a live session to the tab that asks to take over", async () => {
    const backend = createMemoryLockBackend();
    const bus = createMemoryLockBus();
    const clock = clockAt();
    const holder = await openWorkspaceLock({ projectId: PROJECT, holderId: "holder", backend, bus, clock });
    const opening = openWorkspaceLock({
      projectId: PROJECT, holderId: "reader", backend, bus, clock,
      takeoverWait: () => new Promise(() => {}),
    });
    await holder.pulse();
    const reader = await opening;
    assert.equal(reader.foreignHolderId, "holder");
    assert.equal(await reader.requestTakeover(), "acquired");
    assert.equal(reader.mode, "exclusive");
    assert.equal(reader.lease?.reason, "takeover");
    assert.equal(holder.mode, "read-only");
    assert.equal(backend.heldCount(), 1);
  });

  it("reclaims a dead holder once the lock is free and the lease is stale", async () => {
    const backend = createMemoryLockBackend();
    const bus = createMemoryLockBus();
    const clock = clockAt();
    const grant = await backend.requestExclusive(WORKSPACE_LOCK_NAME);
    const opening = openWorkspaceLock({ projectId: PROJECT, holderId: "reader", backend, bus, clock });
    bus.post({ type: "heartbeat", lease: lease(new Date(T0)) });
    const reader = await opening;
    assert.ok(grant);
    grant.release();
    const later = new Date(new Date(T0).getTime() + LOCK_STALE_AFTER_MS);
    await reader.pulse(later);
    assert.equal(reader.mode, "exclusive");
    assert.equal(reader.lease?.reason, "stale-reclaim");
    assert.equal(backend.heldCount(), 1);
  });

  it("elects one leader when Web Locks is missing and both tabs announce together", async () => {
    const bus = createMemoryLockBus();
    const clock = clockAt();
    const gates: Array<() => void> = [];
    const settle = () => new Promise<void>((resolve) => gates.push(resolve));
    const first = openWorkspaceLock({ projectId: PROJECT, holderId: "b", backend: null, bus, clock, settle });
    const second = openWorkspaceLock({ projectId: PROJECT, holderId: "a", backend: null, bus, clock, settle });
    assert.equal(gates.length, 2);
    gates.splice(0).forEach((resolve) => resolve());
    await flush();
    assert.equal(gates.length, 2);
    gates.splice(0).forEach((resolve) => resolve());
    const [higher, lower] = await Promise.all([first, second]);
    assert.equal(lower.mode, "exclusive");
    assert.equal(lower.holderId, "a");
    assert.equal(higher.mode, "read-only");
    assert.equal(higher.foreignHolderId, "a");
  });

  it("shows the read-only notice and Take Over Session without mounting the studio", () => {
    const markup = renderToStaticMarkup(createElement(WorkspaceRecoveryScreen, {
      busy: false,
      error: "",
      operation: null,
      exclusive: false,
      readOnly: true,
      quarantined: false,
      foreignHolderId: "tab-a",
      onRetry() {},
      onFinish() {},
      onTakeOver() {},
      onDownloadRequested() {},
      onDownloadRecovery() {},
    }));
    assert.match(markup, new RegExp(READ_ONLY_NOTICE.replace(/[()]/g, "\\$&")));
    assert.match(markup, new RegExp(TAKE_OVER_LABEL));
    assert.match(markup, /data-workspace-access="read-only"/);
    assert.equal(canMountStudio({ ready: true, readOnly: true, quarantined: false }), false);
    assert.equal(canMountStudio({ ready: true, readOnly: false, quarantined: false }), true);
    const paused = renderToStaticMarkup(createElement(WorkspaceRecoveryScreen, {
      busy: false,
      error: "Recovery journal is corrupt.",
      operation: null,
      exclusive: true,
      readOnly: false,
      quarantined: true,
      foreignHolderId: null,
      onRetry() {},
      onFinish() {},
      onTakeOver() {},
      onDownloadRequested() {},
      onDownloadRecovery() {},
    }));
    assert.equal(paused.includes(TAKE_OVER_LABEL), false);
    assert.equal(canMountStudio({ ready: true, readOnly: false, quarantined: true }), false);
  });
});
