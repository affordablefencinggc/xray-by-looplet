import { useEffect, useState } from "react";
import { Bot, ArrowRight } from "lucide-react";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { useStudio } from "./store";
import { getMaterialAiStatus, type MaterialAiStatus } from "./materialAiTransport";

export function McpChatDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<MaterialAiStatus | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    getMaterialAiStatus()
      .then((s) => {
        if (active) setStatus(s);
      })
      .catch(() => {
        if (active) setError("AI service status unavailable.");
      });
    return () => {
      active = false;
    };
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <WorkspaceDialog title="AI tools" onClose={onClose}>
      <div className="material-ai-panel material-ai-tools">
        <div className="material-ai-heading">
          <Bot size={24} />
          <div>
            <strong>Drawing intelligence</strong>
            <p>Source-backed proposals, reviewed by you.</p>
          </div>
        </div>
        <section className="material-ai-section">
          <strong>Material interpretation</strong>
          <p>{error || status?.message || "Checking AI configuration..."}</p>
          <p>
            Use Components, then Project material takeoff, then AI review to interpret a selected PDF sheet,
            inspect each source region and reconcile materials with your inventory.
          </p>
          <button
            className="pill material-ai-open-components"
            onClick={() => {
              useStudio.getState().setPane("components");
              onClose();
            }}
          >
            Open Components <ArrowRight size={15} />
          </button>
        </section>
        <section className="material-ai-section">
          <strong>Conversational tool control (planned)</strong>
          <p>
            This panel does not execute chat commands or report an MCP connection. Use the dedicated
            app tools for measurements, model views, exports and evidence.
          </p>
        </section>
      </div>
    </WorkspaceDialog>
  );
}
