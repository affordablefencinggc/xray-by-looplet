import { Check, ShieldCheck, ShieldQuestion, Eye, X } from "lucide-react";
import { PERMISSION_MODES, usePermissions, type PermissionMode } from "./permissions";
import "./permissionControls.css";
import { ProviderSwitch } from "./ProviderSwitch";

const ICONS: Record<PermissionMode, (props: { size?: number }) => React.ReactNode> = { ask: ShieldQuestion, auto: ShieldCheck, readonly: Eye };

/**
 * The permission mode control and, in ask mode, the prompt for the tool call waiting on the user.
 * A hidden mirror checkbox keeps the old automation contract (`.assistant-permission input` checked
 * ⇔ "Edit freely") so existing runner scenarios keep working; people use the visible buttons.
 */
export function PermissionControls({ disabled = false, compact = false, projectControl }: { disabled?: boolean; compact?: boolean; projectControl?: React.ReactNode }) {
  const mode = usePermissions((state) => state.mode);
  const pending = usePermissions((state) => state.pending);
  const setMode = usePermissions((state) => state.setMode);
  const decide = usePermissions((state) => state.decide);
  return <div className="assistant-permissions">
    {pending && (
      <div className="assistant-permission-card" role="alertdialog" aria-labelledby={`perm-${pending.id}`} aria-describedby={`perm-${pending.id}-summary`}>
        <div className="assistant-permission-card-text">
          <strong id={`perm-${pending.id}`}>The assistant wants to: {pending.title}</strong>
          <span id={`perm-${pending.id}-summary`}>{pending.summary}</span>
        </div>
        <div className="assistant-permission-card-actions">
          <button type="button" className="assistant-permission-allow" aria-label="Allow once" onClick={() => decide(pending.id, "once")}><Check size={14} />Allow once</button>
          <button type="button" className="assistant-permission-allow-chat" aria-label="Allow for this chat" onClick={() => decide(pending.id, "chat")}><ShieldCheck size={14} />Allow for this chat</button>
          <button type="button" className="assistant-permission-deny" aria-label="Deny" onClick={() => decide(pending.id, "deny")}><X size={14} />Deny</button>
        </div>
      </div>
    )}
    {/* [PROVIDER] The mode group and the model switch share one row: modes left, model right. */}
    <div className={`assistant-controls-row${compact ? ' is-compact' : ''}`}>
    {projectControl}
    <div className="assistant-permission" role={compact ? undefined : 'radiogroup'} aria-label={compact ? undefined : 'Permissions'}>
      <input
        type="checkbox"
        className="assistant-permission-mirror"
        tabIndex={-1}
        aria-hidden="true"
        checked={mode === "auto"}
        disabled={disabled}
        onChange={(event) => setMode(event.target.checked ? "auto" : "ask")}
      />
      {compact ? <select aria-label="Assistant permissions" value={mode} disabled={disabled} title={PERMISSION_MODES.find(value=>value.mode===mode)?.hint} onChange={event=>setMode(event.target.value as PermissionMode)}>
        {PERMISSION_MODES.map(value=><option key={value.mode} value={value.mode}>{value.label}</option>)}
      </select> : PERMISSION_MODES.map(({ mode: value, label, hint }) => {
        const Icon = ICONS[value];
        return <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          className={`assistant-permission-mode${mode === value ? " is-active" : ""}`}
          title={hint}
          disabled={disabled}
          onClick={() => setMode(value)}
        >
          <Icon size={13} />
          {label}
        </button>;
      })}
    </div>
    <ProviderSwitch disabled={disabled} />
    </div>
  </div>;
}
