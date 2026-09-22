import { z } from "zod";
import { WORKSPACE_ACCESS_LOCK } from "../workspaceRestore.ts";

/** Exclusive lifetime workspace lock (SC-16).
 *
 * Normal editing takes `xray:editing-workspace:v1` in exclusive mode. A second tab does not get a
 * shared write lock. Web Locks is the authority when the browser has it. BroadcastChannel carries
 * the lease heartbeat (every 5s) and the takeover request, and it is the only coordinator when
 * Web Locks is missing.
 *
 * A stale lease is reclaimed only when its own expiry has passed AND the holder has missed three
 * heartbeats. An `expiresAt` in the past with a fresh heartbeat is clock skew, not a dead holder.
 */

export const WORKSPACE_LOCK_SCHEMA = "xray.workspace-lease/v1" as const;
export const WORKSPACE_LOCK_NAME = WORKSPACE_ACCESS_LOCK;
export const LOCK_CHANNEL_NAME = "xray:workspace-lock:v1";
export const LOCK_HEARTBEAT_MS = 5_000;
export const LOCK_STALE_AFTER_MS = 15_000;

const timestamp = z.string().datetime({ offset: true });

export const workspaceLeaseSchema = z
  .object({
    format: z.literal(WORKSPACE_LOCK_SCHEMA),
    projectId: z.string().min(1).max(240),
    holderId: z.string().min(1).max(240),
    mode: z.enum(["exclusive", "read-only"]),
    reason: z.enum(["first-open", "takeover", "stale-reclaim"]),
    acquiredAt: timestamp,
    heartbeatAt: timestamp,
    expiresAt: timestamp,
  })
  .strict()
  .superRefine((lease, context) => {
    const issue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path, message });
    if (lease.heartbeatAt < lease.acquiredAt)
      issue(["heartbeatAt"], "A lease cannot heartbeat before it was acquired.");
    if (lease.expiresAt <= lease.heartbeatAt)
      issue(["expiresAt"], "A lease must expire after its most recent heartbeat.");
  });
export type WorkspaceLease = z.infer<typeof workspaceLeaseSchema>;

export type LeaseDecision =
  | { action: "acquire"; reason: "first-open" }
  | { action: "read-only"; holderId: string }
  | { action: "takeover"; heldSince: string; reason: "stale-reclaim" };

export function decideLease(existing: WorkspaceLease | null, now: Date, selfId: string): LeaseDecision {
  if (!existing || existing.holderId === selfId) return { action: "acquire", reason: "first-open" };
  const heartbeatAt = Date.parse(existing.heartbeatAt);
  const expiresAt = Date.parse(existing.expiresAt);
  const missedHeartbeats = now.getTime() - heartbeatAt >= LOCK_STALE_AFTER_MS;
  const expiryPassed = expiresAt <= now.getTime();
  if (missedHeartbeats && expiryPassed)
    return { action: "takeover", heldSince: existing.acquiredAt, reason: "stale-reclaim" };
  return { action: "read-only", holderId: existing.holderId };
}

export function createLease(input: {
  projectId: string;
  holderId: string;
  reason: WorkspaceLease["reason"];
  now: Date;
  acquiredAt?: Date;
  staleAfterMs?: number;
}): WorkspaceLease {
  const heartbeatAt = input.now;
  const acquiredAt = input.acquiredAt ?? heartbeatAt;
  const expiresAt = new Date(heartbeatAt.getTime() + (input.staleAfterMs ?? LOCK_STALE_AFTER_MS));
  return workspaceLeaseSchema.parse({
    format: WORKSPACE_LOCK_SCHEMA,
    projectId: input.projectId,
    holderId: input.holderId,
    mode: "exclusive",
    reason: input.reason,
    acquiredAt: acquiredAt.toISOString(),
    heartbeatAt: heartbeatAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}

const idField = z.string().min(1).max(240);
export const lockMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heartbeat"), lease: workspaceLeaseSchema }).strict(),
  z.object({ type: z.literal("released"), holderId: idField, projectId: idField }).strict(),
  z.object({ type: z.literal("takeover-request"), fromId: idField, projectId: idField }).strict(),
  z.object({ type: z.literal("yielded"), holderId: idField, projectId: idField, toId: idField }).strict(),
  z.object({ type: z.literal("claim"), holderId: idField, projectId: idField }).strict(),
]);
export type LockMessage = z.infer<typeof lockMessageSchema>;

export interface LockGrant {
  release(): void;
}

export interface WebLockBackend {
  requestExclusive(name: string): Promise<LockGrant | null>;
}

export interface LockBus {
  post(message: LockMessage): void;
  listen(handler: (message: LockMessage) => void): () => void;
  close?(): void;
}

export interface LockClock {
  now(): Date;
  every(ms: number, tick: () => void): () => void;
  wait(ms: number): Promise<void>;
}

export type TakeoverResult = "acquired" | "still-held" | "stale-reclaimed";

export interface WorkspaceLockSession {
  readonly holderId: string;
  readonly projectId: string;
  mode: "exclusive" | "read-only";
  foreignHolderId: string | null;
  lease: WorkspaceLease | null;
  requestTakeover(): Promise<TakeoverResult>;
  release(): void;
  subscribe(listener: () => void): () => void;
  pulse(at?: Date): Promise<void>;
  idle(): Promise<void>;
}

export class WorkspaceLockUnavailableError extends Error {
  constructor() {
    super("This browser cannot keep a single editing session. Open X-Ray in its desktop app or a secure browser window.");
    this.name = "WorkspaceLockUnavailableError";
  }
}

export function createMemoryLockBackend(): WebLockBackend & { heldCount(): number } {
  let grant: LockGrant | null = null;
  return {
    heldCount: () => (grant ? 1 : 0),
    requestExclusive() {
      if (grant) return Promise.resolve(null);
      const current: LockGrant = {
        release() {
          if (grant === current) grant = null;
        },
      };
      grant = current;
      return Promise.resolve(current);
    },
  };
}

export function createMemoryLockBus(): LockBus {
  const listeners = new Set<(message: LockMessage) => void>();
  return {
    post(message) {
      const parsed = lockMessageSchema.parse(message);
      for (const listener of [...listeners]) listener(parsed);
    },
    listen(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
  };
}

export function browserLockBackend(): WebLockBackend | null {
  if (typeof navigator === "undefined" || !navigator.locks) return null;
  return {
    requestExclusive(name) {
      return new Promise((resolve, reject) => {
        let settled = false;
        navigator.locks!.request(name, { mode: "exclusive", ifAvailable: true }, async (lock) => {
          if (!lock) {
            settled = true;
            resolve(null);
            return;
          }
          let release!: () => void;
          const done = new Promise<void>((resolveDone) => {
            release = resolveDone;
          });
          settled = true;
          resolve({ release() { release(); } });
          await done;
        }).catch((error: unknown) => {
          if (!settled) reject(error instanceof Error ? error : Error(String(error)));
        });
      });
    },
  };
}

export function browserLockBus(): LockBus | null {
  if (typeof BroadcastChannel === "undefined") return null;
  const channel = new BroadcastChannel(LOCK_CHANNEL_NAME);
  return {
    post(message) {
      channel.postMessage(lockMessageSchema.parse(message));
    },
    listen(handler) {
      const onMessage = (event: MessageEvent) => {
        const parsed = lockMessageSchema.safeParse(event.data);
        if (parsed.success) handler(parsed.data);
      };
      channel.addEventListener("message", onMessage);
      return () => channel.removeEventListener("message", onMessage);
    },
    close() {
      channel.close();
    },
  };
}

function systemClock(): LockClock {
  return {
    now: () => new Date(),
    every(ms, tick) {
      const id = setInterval(tick, ms);
      return () => clearInterval(id);
    },
    wait: (ms) => new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  };
}

export async function openWorkspaceLock(options: {
  projectId: string;
  holderId?: string;
  backend: WebLockBackend | null;
  bus: LockBus | null;
  clock?: LockClock;
  heartbeatMs?: number;
  staleAfterMs?: number;
  settle?: () => Promise<void>;
  takeoverWait?: () => Promise<void>;
}): Promise<WorkspaceLockSession> {
  const projectId = options.projectId;
  const holderId = options.holderId ?? crypto.randomUUID();
  const backend = options.backend;
  const bus = options.bus;
  const clock = options.clock ?? systemClock();
  const heartbeatMs = options.heartbeatMs ?? LOCK_HEARTBEAT_MS;
  const staleAfterMs = options.staleAfterMs ?? LOCK_STALE_AFTER_MS;
  const settle = options.settle ?? (() => clock.wait(heartbeatMs));
  const takeoverWait = options.takeoverWait ?? (() => clock.wait(heartbeatMs));
  if (!backend && !bus) throw new WorkspaceLockUnavailableError();

  let mode: WorkspaceLockSession["mode"] = "read-only";
  let foreignHolderId: string | null = null;
  let lease: WorkspaceLease | null = null;
  const watch: { lease: WorkspaceLease | null } = { lease: null };
  let grant: LockGrant | null = null;
  let stopped = false;
  let yieldedToUs = false;
  const claims = new Set<string>([holderId]);
  const listeners = new Set<() => void>();
  let tail: Promise<void> = Promise.resolve();

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };
  const track = (work: Promise<void>) => {
    tail = tail.then(() => work).then(() => undefined, () => undefined);
  };
  const post = (message: LockMessage) => {
    bus?.post(message);
  };
  const fallbackMayLead = () => [...claims].sort()[0] === holderId;

  function installExclusive(reason: WorkspaceLease["reason"], at = clock.now()) {
    mode = "exclusive";
    foreignHolderId = null;
    lease = createLease({ projectId, holderId, reason, now: at, staleAfterMs });
    post({ type: "heartbeat", lease });
    notify();
  }

  async function becomeExclusive(reason: WorkspaceLease["reason"]): Promise<boolean> {
    if (stopped) return false;
    // An explicit yield names this tab. A stale reclaim already removed the dead holder.
    // Lowest claim id breaks a tie only for an unsolicited first open on the channel fallback.
    if (!backend && reason === "first-open" && !fallbackMayLead()) return false;
    if (backend) {
      const next = await backend.requestExclusive(WORKSPACE_LOCK_NAME);
      if (!next) return false;
      if (stopped) {
        next.release();
        return false;
      }
      grant = next;
    }
    installExclusive(reason);
    return true;
  }

  function stepDown(foreignId: string) {
    if (stopped || mode !== "exclusive" || grant) return;
    mode = "read-only";
    foreignHolderId = foreignId;
    lease = null;
    notify();
  }

  function onMessage(message: LockMessage) {
    if (stopped || ("projectId" in message && message.projectId !== projectId)) return;
    if (message.type === "heartbeat" && message.lease.projectId !== projectId) return;
    if (message.type === "claim") {
      claims.add(message.holderId);
      return;
    }
    if (message.type === "heartbeat") {
      if (message.lease.holderId === holderId) return;
      watch.lease = message.lease;
      if (mode === "read-only") {
        foreignHolderId = message.lease.holderId;
        notify();
      } else if (!grant && message.lease.holderId < holderId && decideLease(message.lease, clock.now(), holderId).action === "read-only") {
        stepDown(message.lease.holderId);
      }
      return;
    }
    if (message.type === "takeover-request") {
      if (message.fromId === holderId || mode !== "exclusive") return;
      const yielded: LockMessage = { type: "yielded", holderId, projectId, toId: message.fromId };
      mode = "read-only";
      foreignHolderId = message.fromId;
      lease = null;
      const held = grant;
      grant = null;
      held?.release();
      post(yielded);
      notify();
      return;
    }
    if (message.type === "yielded") {
      if (message.holderId !== holderId) claims.delete(message.holderId);
      if (message.toId === holderId) yieldedToUs = true;
      return;
    }
    if (message.type === "released") {
      if (message.holderId === holderId) return;
      claims.delete(message.holderId);
      if (watch.lease?.holderId === message.holderId) watch.lease = null;
      if (mode === "read-only") track(becomeExclusive("first-open").then(() => undefined));
    }
  }

  const unsubscribe = bus?.listen(onMessage) ?? (() => {});

  if (backend) {
    const acquired = await backend.requestExclusive(WORKSPACE_LOCK_NAME);
    if (acquired) {
      grant = acquired;
      const reason = watch.lease && decideLease(watch.lease, clock.now(), holderId).action === "takeover" ? "stale-reclaim" : "first-open";
      installExclusive(reason);
    } else {
      mode = "read-only";
      foreignHolderId = watch.lease?.holderId ?? null;
    }
  } else {
    const announce = () => post({ type: "claim", holderId, projectId });
    announce();
    await settle();
    announce();
    await settle();
    const decision = decideLease(watch.lease, clock.now(), holderId);
    if (decision.action === "read-only") {
      mode = "read-only";
      foreignHolderId = decision.holderId;
    } else if (decision.action === "takeover") {
      claims.delete(watch.lease!.holderId);
      watch.lease = null;
      if (fallbackMayLead()) installExclusive("stale-reclaim");
      else {
        mode = "read-only";
        foreignHolderId = [...claims].sort()[0] === holderId ? null : [...claims].sort()[0];
      }
    } else if (fallbackMayLead()) installExclusive("first-open");
    else {
      mode = "read-only";
      foreignHolderId = [...claims].sort()[0];
    }
  }

  async function pulse(at = clock.now()) {
    if (stopped) return;
    if (mode === "exclusive" && lease) {
      lease = createLease({
        projectId,
        holderId,
        reason: lease.reason,
        now: at,
        acquiredAt: new Date(lease.acquiredAt),
        staleAfterMs,
      });
      post({ type: "heartbeat", lease });
      notify();
      return;
    }
    if (mode !== "read-only" || !watch.lease) return;
    if (decideLease(watch.lease, at, holderId).action !== "takeover") return;
    const deadId = watch.lease.holderId;
    claims.delete(deadId);
    watch.lease = null;
    if (backend || fallbackMayLead()) await becomeExclusive("stale-reclaim");
  }

  const stopTimer = clock.every(heartbeatMs, () => {
    track(pulse());
  });

  async function requestTakeover(): Promise<TakeoverResult> {
    if (stopped) throw Error("This editing session has already been released.");
    if (mode === "exclusive") return "acquired";
    if (watch.lease && decideLease(watch.lease, clock.now(), holderId).action === "takeover") {
      const deadId = watch.lease.holderId;
      claims.delete(deadId);
      watch.lease = null;
      const reclaimed = await becomeExclusive("stale-reclaim");
      return reclaimed ? "stale-reclaimed" : "still-held";
    }
    yieldedToUs = false;
    post({ type: "takeover-request", fromId: holderId, projectId });
    if (!yieldedToUs) await takeoverWait();
    if (yieldedToUs) {
      const acquired = await becomeExclusive("takeover");
      return acquired ? "acquired" : "still-held";
    }
    if (watch.lease && decideLease(watch.lease, clock.now(), holderId).action === "takeover") {
      claims.delete(watch.lease.holderId);
      watch.lease = null;
      const reclaimed = await becomeExclusive("stale-reclaim");
      return reclaimed ? "stale-reclaimed" : "still-held";
    }
    return "still-held";
  }

  function release() {
    if (stopped) return;
    stopped = true;
    stopTimer();
    const wasExclusive = mode === "exclusive";
    const held = grant;
    grant = null;
    mode = "read-only";
    lease = null;
    held?.release();
    if (wasExclusive) post({ type: "released", holderId, projectId });
    unsubscribe();
    bus?.close?.();
    notify();
  }

  return {
    holderId,
    projectId,
    get mode() { return mode; },
    get foreignHolderId() { return foreignHolderId; },
    get lease() { return lease; },
    requestTakeover,
    release,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    pulse,
    idle: async () => { await tail; },
  };
}
