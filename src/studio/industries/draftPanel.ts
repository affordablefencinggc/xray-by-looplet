import type { IndustrySourceState } from "./sourceBinding.ts";

/** Controlled industry forms. The shared host owns project-scoped draft storage, and supplies the
 * current project source state so a worksheet can report whether its binding is still current.
 * Panels read no project store themselves.
 */
export type IndustryDraftPanelProps<T> = {
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
  source: IndustrySourceState;
};
