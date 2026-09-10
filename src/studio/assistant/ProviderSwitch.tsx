import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Cpu } from "lucide-react";
import { PROVIDERS, useAssistantProvider, type AssistantProvider } from "./provider";
import "./providerSwitch.css";

/**
 * Model switch, sitting at the right of the row above the composer.
 *
 * A menu rather than a segmented control: the permission modes beside it already own that shape,
 * and repeating it would make two unrelated choices look like one group. Collapsed it shows only
 * the active model, so it stays quiet until the user wants it.
 *
 * Disabled while a turn is running. Swapping provider mid-turn would leave the in-flight request
 * answering to one route and its tool calls to another.
 */
export function ProviderSwitch({ disabled = false }: { disabled?: boolean }) {
  const provider = useAssistantProvider((state) => state.provider);
  const setProvider = useAssistantProvider((state) => state.setProvider);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape, so the menu never strands itself over the composer.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); setOpen(false); }
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const active = PROVIDERS.find((entry) => entry.provider === provider) ?? PROVIDERS[0];
  const choose = (value: AssistantProvider) => { setProvider(value); setOpen(false); };

  return <div className="assistant-provider" ref={root}>
    <button
      type="button"
      className="assistant-provider-button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`Model: ${active.label}. Change model`}
      title={active.hint}
      disabled={disabled}
      onClick={() => setOpen((value) => !value)}
    >
      <Cpu size={13} />
      <span className="assistant-provider-name">{active.label}</span>
      <ChevronDown size={12} />
    </button>
    {open && (
      <div className="assistant-provider-menu" role="menu" aria-label="Choose a model">
        {PROVIDERS.map((entry) => (
          <button
            key={entry.provider}
            type="button"
            role="menuitemradio"
            aria-checked={entry.provider === provider}
            className={`assistant-provider-option${entry.provider === provider ? " is-active" : ""}`}
            onClick={() => choose(entry.provider)}
          >
            <span className="assistant-provider-check">{entry.provider === provider && <Check size={13} />}</span>
            <span className="assistant-provider-text">
              <strong>{entry.label}</strong>
              <span>{entry.hint}</span>
            </span>
          </button>
        ))}
      </div>
    )}
  </div>;
}
