import { createContext, useContext } from "react";
import type { PriceBookLibrary, PriceBookSession } from "../../pricing/priceBooks.ts";

export type QsPricingSource = {
  projectId: string;
  library: PriceBookLibrary | null;
  loading: boolean;
  error: string | null;
  sourceReady: boolean;
};

/** A corrupt session contains an empty recovery value. Never expose that value
 * as a successfully loaded supplier library, or reuse a prior project's data. */
export function qsPricingSource(projectId: string, session: PriceBookSession | null | undefined, sourceReady: boolean): QsPricingSource {
  if (!session || session.value.jobId !== projectId)
    return { projectId, library: null, loading: true, error: null, sourceReady };
  if (session.blocked || session.error)
    return { projectId, library: null, loading: false, error: session.error ?? "Saved supplier rates need recovery before pricing.", sourceReady };
  return { projectId, library: session.value, loading: false, error: null, sourceReady };
}

export const QsPricingContext = createContext<QsPricingSource | null>(null);
export const useQsPricing = () => useContext(QsPricingContext);
