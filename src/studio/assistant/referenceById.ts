import { hasArchitectController, requestArchitectTool } from "./architectBridge";
import { describeArchitectEntity, insertReference, mergeDraft, type ArchitectLike } from "./canvasReference";
import { useLiveAssistant } from "../liveAssistantState";
import { useStudio } from "../store";

/**
 * "Point at" an entity the assistant mentioned: an ID chip in a reply resolves against the mounted
 * Architectural workspace and lands in the composer as a full reference (kind, level, geometry).
 * When the workspace is not open the bare ID still goes in, so the model knows exactly which
 * element the user means. Nothing is sent.
 */
export async function referenceEntityById(id: string): Promise<"resolved" | "bare"> {
  if (hasArchitectController()) {
    try {
      const result = (await requestArchitectTool("read", { expectedJobId: useStudio.getState().job.id })) as { project?: ArchitectLike } | null;
      const ref = result?.project ? describeArchitectEntity(result.project, id) : null;
      if (ref) { insertReference(ref); return "resolved"; }
    } catch {
      // fall through to the bare reference
    }
  }
  const draft = mergeDraft(useLiveAssistant.getState().draft, `[Reference · id ${id}]`);
  useLiveAssistant.setState({ draft, open: true });
  return "bare";
}

/** Quotes a reply block into the composer ("Reply" button) and focuses the prompt. Nothing is sent. */
export function quoteIntoComposer(quote: string): void {
  const current = useLiveAssistant.getState().draft;
  const draft = current.trim() ? `${current.trimEnd()}\n${quote}` : quote;
  useLiveAssistant.setState({ draft: draft.slice(0, 1500), open: true });
  if (typeof document !== "undefined" && typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => {
      const prompt = document.getElementById("live-assistant-prompt") as HTMLTextAreaElement | null;
      if (!prompt) return;
      prompt.focus();
      prompt.setSelectionRange(prompt.value.length, prompt.value.length);
    });
}
