export type DiagnosticLevel = "log" | "info" | "warn" | "error";
export type DiagnosticEntry = { id: number; time: number; level: DiagnosticLevel; source: "console" | "window" | "workspace"; message: string };
export const DIAGNOSTIC_LIMIT = 200;
const MESSAGE_LIMIT = 2000;

/** Snapshot values without invoking getters/toJSON or retaining application objects. */
export function diagnosticText(values: readonly unknown[]): string {
  const seen = new WeakSet<object>();
  let remaining = MESSAGE_LIMIT;
  const text = (input: string) => { const result = input.slice(0, remaining); remaining -= result.length; return result; };
  function value(input: unknown, depth: number): string {
    if (remaining <= 0) return "";
    if (typeof input === "string") return text(input);
    if (input === null || typeof input !== "object") return text(typeof input === "function" ? "[Function]" : String(input));
    if (seen.has(input)) return text("[Circular]");
    if (depth > 2) return text("[Object]");
    seen.add(input);
    try {
      const keys: string[] = [];
      // Error details are not enumerable. Read their descriptors, not getters.
      for (const key of ["name", "message", "stack"]) if (Object.getOwnPropertyDescriptor(input, key)) keys.push(key);
      let inspected = 0;
      for (const key in input) {
        if (keys.length >= 12 || inspected++ >= 24 || remaining <= 0) break;
        if (!keys.includes(key) && Object.getOwnPropertyDescriptor(input, key)) keys.push(key);
      }
      return text("{") + keys.map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        return text(`${key}: `) + (descriptor && "value" in descriptor ? value(descriptor.value, depth + 1) : text("[Accessor]"));
      }).join(", ") + text("}");
    } catch { return text("[Unreadable object]"); }
  }
  return values.slice(0, 12).map(item => value(item, 0)).join(" ").slice(0, MESSAGE_LIMIT);
}

export function createDiagnosticBuffer(limit = DIAGNOSTIC_LIMIT) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > DIAGNOSTIC_LIMIT) throw new Error("Invalid diagnostic limit");
  let entries: readonly DiagnosticEntry[] = [], sequence = 0;
  return {
    snapshot: () => entries,
    append(level: DiagnosticLevel, source: DiagnosticEntry["source"], values: readonly unknown[]) {
      entries = [...entries, { id: ++sequence, time: Date.now(), level, source, message: diagnosticText(values) }].slice(-limit);
      return entries;
    },
    clear() { entries = []; },
  };
}

export function captureConsole(target: Pick<Console, DiagnosticLevel>, record: (level: DiagnosticLevel, values: readonly unknown[]) => void) {
  let active = true, recording = false;
  const restores: (() => void)[] = [];
  for (const level of ["log", "info", "warn", "error"] as const) {
    const previous = target[level];
    const wrapper = (...values: unknown[]) => {
      try { previous.apply(target, values); }
      finally {
        if (active && !recording) {
          recording = true;
          try { record(level, values); } catch { /* Diagnostics must not break console behavior. */ }
          finally { recording = false; }
        }
      }
    };
    target[level] = wrapper;
    restores.push(() => { if (target[level] === wrapper) target[level] = previous; });
  }
  return () => { active = false; restores.forEach(restore => restore()); };
}
