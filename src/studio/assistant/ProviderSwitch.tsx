import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Cpu } from "lucide-react";
import { PROVIDERS, useAssistantProvider, type AssistantProvider } from "./provider";
import "./providerSwitch.css";

const nativeBuild = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const providerHint = (provider: AssistantProvider, native: boolean) =>
  native && provider === "minimax"
    ? "Unavailable in this desktop build. Your selection is preserved; no other provider will be used automatically."
    : provider === "minimax"
      ? "M3 supports source images and visible 3D canvas captures, not full-screen screenshots. Older M2 models are text only. No grounded web search."
      : "Supports source images, visible 3D canvas captures and grounded web search. The configured model is shown in connection details.";

export function ProviderOptions({ provider, native, disabled, onChoose }: {
  provider: AssistantProvider; native: boolean; disabled: boolean; onChoose: (provider: AssistantProvider) => void;
}) {
  return <div className="assistant-provider-menu" role="menu" aria-label="Choose a provider">
    {PROVIDERS.map(entry => {
      const unavailable = native && entry.provider === "minimax";
      return <button key={entry.provider} type="button" role="menuitemradio"
        aria-checked={entry.provider === provider} disabled={disabled || unavailable}
        className={`assistant-provider-option${entry.provider === provider ? " is-active" : ""}`}
        onClick={() => { if (!disabled && !unavailable) onChoose(entry.provider); }}>
        <span className="assistant-provider-check">{entry.provider === provider && <Check size={13} />}</span>
        <span className="assistant-provider-text"><strong>{entry.label}{unavailable ? " · Unavailable on desktop" : ""}</strong>
          <span>{providerHint(entry.provider, native)}</span></span>
      </button>;
    })}
  </div>;
}

/**
 * Provider switch, sitting at the right of the row above the composer.
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
  const native = nativeBuild();
  const unavailable = native && provider === "minimax";
  const choose = (value: AssistantProvider) => { setProvider(value); setOpen(false); };

  return <div className="assistant-provider" ref={root}>
    <button
      type="button"
      className="assistant-provider-button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`Provider: ${active.label}${unavailable ? ". Unavailable in this desktop build" : ""}. Change provider`}
      title={providerHint(provider, native)}
      disabled={disabled}
      onClick={() => setOpen((value) => !value)}
    >
      <Cpu size={13} />
      <span className="assistant-provider-name">{active.label}</span>{unavailable && <span>Unavailable</span>}
      <ChevronDown size={12} />
    </button>
    {open && (
      <ProviderOptions provider={provider} native={native} disabled={disabled} onChoose={choose} />
    )}
  </div>;
}
