import { useEffect, useRef, useState } from "react";
import { WorkspaceDialog } from "../WorkspaceDialog";

export function useDesignConfirmation() {
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((accepted: boolean) => void) | null>(null);
  useEffect(() => () => { pending.current?.(false); }, []);
  const finish = (accepted: boolean) => {
    pending.current?.(accepted);
    pending.current = null;
    setMessage(null);
  };
  const confirmDesign = (text: string) => new Promise<boolean>(resolve => {
    pending.current?.(false);
    pending.current = resolve;
    setMessage(text);
  });
  const confirmation = message === null ? null : (
    <WorkspaceDialog title="Review design change" onClose={() => finish(false)}>
      <div className="arch-confirmation">
        <p>{message}</p>
        <div className="arch-button-row">
          <button autoFocus onClick={() => finish(false)}>Cancel change</button>
          <button onClick={() => finish(true)}>Confirm design change</button>
        </div>
      </div>
    </WorkspaceDialog>
  );
  return { confirmDesign, confirmation };
}
