/** A process-local cost bound, not user authentication or a distributed quota.
 * Independent chats may run concurrently; duplicate in-flight request IDs may not.
 * Client chat state still prevents overlapping edits inside one conversation.
 */
export function createAssistantTurnGate(limit = 3) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid assistant concurrency limit');
  const active = new Set<string>();
  return {
    acquire(requestId: string) {
      if (active.has(requestId)) return { accepted: false, reason: 'duplicate' } as const;
      if (active.size >= limit) return { accepted: false, reason: 'capacity' } as const;
      active.add(requestId);
      let released = false;
      return {
        accepted: true as const,
        release() {
          if (released) return;
          released = true;
          active.delete(requestId);
        },
      };
    },
  };
}

// Shared by the two chat providers so changing provider cannot double this bound.
export const assistantTurnGate = createAssistantTurnGate();
