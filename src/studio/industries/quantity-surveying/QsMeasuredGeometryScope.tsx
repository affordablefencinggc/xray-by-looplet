import { useMemo, type ReactNode } from "react";
import type { FencingJob } from "../../domain.ts";
import { qsMeasuredGeometry } from "./qsMeasuredGeometry.ts";
import { QsMeasuredGeometryContext } from "./qsMeasuredGeometryContext.ts";

/** Supplies QS with live measured entities without changing the shared
 * roofing/HVAC/quantity workbench contract or coupling forms to the store. */
export function QsMeasuredGeometryScope({ job, activeSheet, sourceReady, children }: {
  job: FencingJob;
  activeSheet: number;
  sourceReady: boolean;
  children: ReactNode;
}) {
  const entities = useMemo(() => qsMeasuredGeometry(job, activeSheet, sourceReady), [job, activeSheet, sourceReady]);
  return <QsMeasuredGeometryContext.Provider value={entities}>{children}</QsMeasuredGeometryContext.Provider>;
}
