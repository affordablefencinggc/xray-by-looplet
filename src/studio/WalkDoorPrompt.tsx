import type { WalkDoorState } from "./WalkDoors.ts";
import "./walkDoors.css";

export function WalkDoorPrompt({ state, onInteract }: { state: WalkDoorState | null; onInteract: () => void }) {
  if (!state) return null;
  const action = state.open ? "Close door" : "Open door";
  return <div className="walk-door-prompt" aria-label="Nearby door" data-busy={state.busy}>
    <div className="walk-door-card">
      <span className="walk-door-label">{state.label}</span>
      <button type="button" onClick={onInteract} disabled={state.busy || !!state.blockedReason} aria-label={`${action}: ${state.label}`}>
        {state.busy ? state.open ? "Closing…" : "Opening…" : action}<kbd aria-hidden="true">E</kbd>
      </button>
      <span className="walk-door-status" role="status">{state.blockedReason ?? (state.busy ? "Reaching for the door" : "Approach and press E, or use the button")}</span>
    </div>
  </div>;
}
