import { createElement, type ReactNode } from "react";
import type { RestoreOperation } from "./workspaceRestore.ts";

export const READ_ONLY_NOTICE = "Project is currently open in another window (Read-Only Mode)";
export const TAKE_OVER_LABEL = "Take Over Session";

export function canMountStudio(state: { ready: boolean; readOnly: boolean; quarantined: boolean }): boolean {
  return state.ready && !state.readOnly && !state.quarantined;
}

export function WorkspaceRecoveryScreen(props: {
  busy: boolean;
  error: string;
  operation: RestoreOperation | null;
  exclusive: boolean;
  readOnly: boolean;
  quarantined: boolean;
  foreignHolderId: string | null;
  onRetry: () => void;
  onFinish: () => void;
  onTakeOver: () => void;
  onDownloadRequested: () => void;
  onDownloadRecovery: () => void;
}): ReactNode {
  const { busy, error, operation, exclusive, readOnly, quarantined, foreignHolderId } = props;
  const terminal = operation?.phase === "verified" || operation?.phase === "rolled-back";
  const access = quarantined ? "quarantined" : readOnly ? "read-only" : operation ? "restore" : "opening";
  const heading = quarantined
    ? "Editing paused"
    : readOnly
      ? READ_ONLY_NOTICE
      : operation
        ? "Restore project"
        : "Opening your workspace";
  const status = operation
    ? "Checking the saved snapshot and recovery journal. Editing will open after verification."
    : "Checking saved work…";
  const buttons: ReactNode[] = [];
  if (!quarantined && readOnly)
    buttons.push(createElement("button", { key: "takeover", type: "button", onClick: props.onTakeOver, disabled: busy }, TAKE_OVER_LABEL));
  if (exclusive && operation && (terminal || operation.phase === "requested"))
    buttons.push(createElement("button", { key: "finish", type: "button", onClick: props.onFinish }, terminal ? "Open workspace" : "Cancel restore and open workspace"));
  buttons.push(createElement("button", { key: "retry", type: "button", onClick: props.onRetry }, "Retry"));
  if (operation)
    buttons.push(createElement("button", { key: "requested", type: "button", onClick: props.onDownloadRequested }, "Download requested backup"));
  if (operation?.plan)
    buttons.push(createElement("button", { key: "recovery", type: "button", onClick: props.onDownloadRecovery }, "Download recovery copy"));

  return createElement("main", { className: "workspace-startup", "aria-busy": busy },
    createElement("section", { "aria-label": "Workspace recovery", "data-workspace-access": access },
      createElement("header", null,
        createElement("p", null, "X-Ray workspace"),
        createElement("h1", null, heading),
      ),
      busy ? createElement("p", { role: "status" }, status) : createElement("div", null,
        readOnly && !quarantined ? createElement("p", { role: "status" }, foreignHolderId
          ? `Editing tools stay closed in this window while ${foreignHolderId} holds the session.`
          : "Editing tools stay closed in this window.") : null,
        operation?.message ? createElement("p", { role: "status" }, operation.message) : null,
        error ? createElement("p", { role: "alert" }, error) : null,
        operation?.phase === "recovery-required" ? createElement("p", null, "Keep both packages below. Retry recovery before making further edits.") : null,
        createElement("div", { className: "workspace-startup-actions" }, buttons),
      ),
    ),
  );
}
