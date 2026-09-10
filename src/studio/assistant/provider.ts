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

export const PROVIDER_KEY = "xray:assistant-provider:v1";

/** Native builds only carry the Gemini transport, so the switch is web-only. */
export const PROVIDERS: ReadonlyArray<{ provider: AssistantProvider; label: string; endpoint: string; hint: string }> = [
  { provider: "gemini", label: "Gemini", endpoint: "/api/assistant-ai", hint: "Google Gemini. Supports images and grounded web search." },
  { provider: "minimax", label: "MiniMax", endpoint: "/api/minimax-ai", hint: "MiniMax. Text and tools only: no image input and no grounded web search." },
];

export function isAssistantProvider(value: unknown): value is AssistantProvider {
  return value === "gemini" || value === "minimax";
}

/** Anything unrecognised falls back to Gemini, the provider the app is verified against. */
export function readProvider(raw: string | null | undefined): AssistantProvider {
  return isAssistantProvider(raw) ? raw : "gemini";
}

export function providerEndpoint(provider: AssistantProvider): string {
  return (PROVIDERS.find(entry => entry.provider === provider) ?? PROVIDERS[0]).endpoint;
}

export function providerLabel(provider: AssistantProvider): string {
  return (PROVIDERS.find(entry => entry.provider === provider) ?? PROVIDERS[0]).label;
}

/** A throwing or unavailable storage must never stop the panel from rendering. */
function load(): AssistantProvider {
  try { return readProvider(typeof localStorage === "undefined" ? null : localStorage.getItem(PROVIDER_KEY)); }
  catch { return "gemini"; }
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
