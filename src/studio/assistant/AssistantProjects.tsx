import { FolderOpen, FolderPlus, X } from "lucide-react";
import "./assistantProjects.css";
import type { ProjectRow, ProjectTab } from "./projectSwitch";

/**
 * Assistant projects UI (SC-18): the active-project pill with its open tabs above the composer,
 * and the "Projects" drawer opened from the "+" menu. Both are presentational; LiveAssistant owns
 * the tab list (projectRegistry.ts) and the switch (projectSwitch.ts).
 */

function formatUpdated(iso: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  try {
    return new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return new Date(time).toISOString();
  }
}

export function ProjectStrip({
  active,
  tabs,
  disabled,
  onSelect,
  onClose,
}: {
  active: { id: string; name: string };
  /** Every open tab, resolved to a name; the active project is selected when it is among them. */
  tabs: ProjectTab[];
  disabled: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const activeHasTab = tabs.some((tab) => tab.id === active.id);
  return (
    <div className="assistant-project-strip">
      <div className="assistant-project-pill" data-project-id={active.id}>
        <FolderOpen size={13} aria-hidden="true" />
        <strong className="assistant-project-name" title={active.name}>
          {active.name}
        </strong>
        {activeHasTab && (
          <button
            type="button"
            className="assistant-project-close"
            aria-label="Close project tab"
            title="Close this project's tab (the project is kept)"
            disabled={disabled}
            onClick={() => onClose(active.id)}
          >
            <X size={12} />
          </button>
        )}
      </div>
      {tabs.length > 0 && (
        <div className="assistant-project-tabs" role="tablist" aria-label="Open project tabs">
          {tabs.map((tab) => {
            const selected = tab.id === active.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className="assistant-project-tab"
                title={selected ? `${tab.name} (open)` : `Switch to ${tab.name}`}
                disabled={disabled}
                onClick={() => {
                  if (!selected) onSelect(tab.id);
                }}
              >
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProjectsDrawer({
  rows,
  tabs,
  disabled,
  onOpen,
  onOpenTab,
  onNew,
}: {
  rows: ProjectRow[];
  /** Ids already in the tab strip. */
  tabs: readonly string[];
  disabled: boolean;
  onOpen: (id: string) => void;
  onOpenTab: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="assistant-project-drawer">
      <p>
        Switch the workspace and this chat between projects. The open project is saved first, and
        every project keeps its own conversation.
      </p>
      <button type="button" className="assistant-project-new" disabled={disabled} onClick={onNew}>
        <FolderPlus size={15} />
        New project
      </button>
      <ul className="assistant-project-list" role="list">
        {rows.map((row) => {
          const inTab = tabs.includes(row.id);
          return (
            <li key={row.id} className={row.current ? "is-current" : undefined} data-project-id={row.id}>
              <span className="assistant-project-meta">
                <strong title={row.name}>{row.name}</strong>
                <small>
                  {row.current ? "Open now · " : ""}
                  {formatUpdated(row.updatedAt)}
                </small>
              </span>
              <span className="assistant-project-actions">
                <button
                  type="button"
                  aria-label={`Open ${row.name}`}
                  disabled={disabled || row.current}
                  onClick={() => onOpen(row.id)}
                >
                  Open
                </button>
                <button
                  type="button"
                  aria-label={`Open in a tab: ${row.name}`}
                  disabled={disabled || inTab}
                  onClick={() => onOpenTab(row.id)}
                >
                  {inTab ? "In a tab" : "Open in a tab"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
