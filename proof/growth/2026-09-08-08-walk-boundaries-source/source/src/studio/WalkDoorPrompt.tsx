import type { CSSProperties } from "react";
import type { WalkDoorState } from "./WalkDoors.ts";
import "./walkDoors.css";

export function WalkDoorPrompt({ state, onInteract }: { state: WalkDoorState | null; onInteract: () => void }) {
  if (!state) return null;
  const action = state.open ? "Close door" : "Open door";
  return <div className="walk-door-prompt" aria-label="Nearby door" data-busy={state.busy} style={{ "--door-progress": state.progress } as CSSProperties}>
    {state.busy && <svg className="walk-door-arm" viewBox="0 0 240 180" aria-hidden="true">
      <g className="walk-door-arm-reach"><path className="walk-door-sleeve" d="M226 184 169 95 139 116 173 184Z" /><path className="walk-door-hand" d="m170 101-16-25-7-29c-1-5-8-5-8 1l2 19-10-26c-2-5-8-3-7 2l7 29-14-19c-4-5-9 0-6 4l12 25-11-9c-5-3-9 2-5 6l20 22 17 12Z" /><path className="walk-door-hand-line" d="m127 83 14 5 9 12" /></g>
    </svg>}
    <div className="walk-door-card">
      <span className="walk-door-label">{state.label}</span>
      <button type="button" onClick={onInteract} disabled={state.busy || !!state.blockedReason} aria-label={`${action}: ${state.label}`}>
        {state.busy ? state.open ? "Closing…" : "Opening…" : action}<kbd aria-hidden="true">E</kbd>
      </button>
      <span className="walk-door-status" role="status">{state.blockedReason ?? (state.busy ? "Reaching for the door" : "Approach and press E, or use the button")}</span>
    </div>
  </div>;
}
