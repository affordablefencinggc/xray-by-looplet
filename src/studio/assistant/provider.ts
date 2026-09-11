import { create } from "zustand";

/**
 * Which model the assistant talks to, chosen by the user from the composer.
 *
 * The choice is a routing decision only: it selects the server route, and every provider answers
 * the same request and response contract. Nothing about permissions, tool policy or the safety
 * manual changes with it.
 *
 * Persisted per browser profile so a reload does not silently move the user back to a provider
 * they switched away from.
 */
export type AssistantProvider = "gemini" | "minimax";

// Start existing profiles on MiniMax as well; subsequent explicit choices persist.
export const PROVIDER_KEY = "xray:assistant-provider:v2";

/** Native builds only carry the Gemini transport, so the switch is web-only. */
export const PROVIDERS: ReadonlyArray<{ provider: AssistantProvider; label: string; endpoint: string; hint: string }> = [
  { provider: "minimax", label: "MiniMax", endpoint: "/api/minimax-ai", hint: "MiniMax. Text and tools only: no image input and no grounded web search." },
  { provider: "gemini", label: "Gemini", endpoint: "/api/assistant-ai", hint: "Google Gemini. Supports images and grounded web search." },
];

export function isAssistantProvider(value: unknown): value is AssistantProvider {
  return value === "gemini" || value === "minimax";
}

/** Missing or unreadable preferences use MiniMax without spending Gemini quota. */
export function readProvider(raw: string | null | undefined): AssistantProvider {
  return isAssistantProvider(raw) ? raw : "minimax";
}

export function providerEndpoint(provider: AssistantProvider): string {
  return (PROVIDERS.find(entry => entry.provider === provider) ?? PROVIDERS[0]).endpoint;
}

/** Never spend another provider's quota to fill a capability gap. */
export function providerSupportsTool(provider: AssistantProvider, name: string): boolean {
  return provider === 'gemini' || !['web_search', 'generate_render_visualisation'].includes(name);
}

export function providerToolError(provider: AssistantProvider, name: string): string {
  const capability = name === 'web_search' ? 'Web search' : 'Image generation';
  return `${capability} requires Gemini and is unavailable with ${providerLabel(provider)} selected. No Gemini request was sent.`;
}

export function providerLabel(provider: AssistantProvider): string {
  return (PROVIDERS.find(entry => entry.provider === provider) ?? PROVIDERS[0]).label;
}

/** A throwing or unavailable storage must never stop the panel from rendering. */
function load(): AssistantProvider {
  try { return readProvider(typeof localStorage === "undefined" ? null : localStorage.getItem(PROVIDER_KEY)); }
  catch { return "minimax"; }
}

export const useAssistantProvider = create<{ provider: AssistantProvider; setProvider: (value: AssistantProvider) => void }>((set) => ({
  provider: load(),
  setProvider: (value) => {
    const provider = readProvider(value);
    try { if (typeof localStorage !== "undefined") localStorage.setItem(PROVIDER_KEY, provider); }
    catch { /* The choice still applies to this session; persistence is a convenience. */ }
    set({ provider });
  },
}));
