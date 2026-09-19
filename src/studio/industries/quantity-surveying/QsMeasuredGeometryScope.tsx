import { useMemo, type ReactNode } from "react";
import type { FencingJob } from "../../domain.ts";
import { qsMeasuredGeometry } from "./qsMeasuredGeometry.ts";
import { QsMeasuredGeometryContext } from "./qsMeasuredGeometryContext.ts";
import type { PriceBookSession } from "../../pricing/priceBooks.ts";
import { QsPricingContext, qsPricingSource } from "./qsPricingContext.ts";

/** Supplies QS with live measured entities without changing the shared
 * roofing/HVAC/quantity workbench contract or coupling forms to the store. */
export function QsMeasuredGeometryScope({ job, activeSheet, sourceReady, priceBookSession, children }: {
  job: FencingJob;
  activeSheet: number;
  sourceReady: boolean;
  priceBookSession?: PriceBookSession | null;
  children: ReactNode;
}) {
  const entities = useMemo(() => qsMeasuredGeometry(job, activeSheet, sourceReady), [job, activeSheet, sourceReady]);
  const pricing = useMemo(() => qsPricingSource(job.id, priceBookSession, sourceReady), [job.id, priceBookSession, sourceReady]);
  return <QsMeasuredGeometryContext.Provider value={entities}>
    <QsPricingContext.Provider value={pricing}>{children}</QsPricingContext.Provider>
  </QsMeasuredGeometryContext.Provider>;
}
