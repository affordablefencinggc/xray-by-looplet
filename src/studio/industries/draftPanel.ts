/** Controlled industry forms. The shared host owns project-scoped draft storage. */
export type IndustryDraftPanelProps<T> = {
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
};
