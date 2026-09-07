import { useDesignConfirmation } from "./useDesignConfirmation";
﻿import { useRef, useState } from "react";
import { restoreMaterialDatabase, saveMaterialDatabase } from "../projectMaterialsPersistence";
import { inspectPlanBytes } from "../documents";
import { useStudio } from "../store";
import { designSyncSummary, syncDesignMaterials } from "./materialBridge";
import { exportMaterialSnapshotPdf } from "./sheets";
import type { ArchitectProject } from "./model";
export function SyncDesignMaterials({
  project: p,
  onError,
}: {
  project: ArchitectProject;
  onError: (s: string) => void;
}) {
  const { confirmDesign, confirmation } = useDesignConfirmation();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    latest = useRef(p);
  latest.current = p;
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const session = await restoreMaterialDatabase(p.id);
            if (session.blocked)
              throw Error(session.error ?? "Material register recovery required.");
            const counts = designSyncSummary(p, session.value);
            if (!counts.add && !counts.update && !counts.retire) {
              setMessage("Material register already matches this design revision.");
              return;
            }
            if (
              !(await confirmDesign(
                `Sync authored design quantities? Add ${counts.add}, update ${counts.update}, retire ${counts.retire} rows to zero. A source PDF snapshot will be saved. Source-plan takeoffs remain separate.`,
              ))
            )
              return;
            const snapshot = await exportMaterialSnapshotPdf(p),
              name = `Authored design revision ${p.revision}.pdf`,
              imported = await inspectPlanBytes({ name, bytes: snapshot.bytes, source: "web" });
            if (latest.current.revision !== p.revision || useStudio.getState().job.id !== p.id)
              throw Error("Design changed during preparation. Retry sync.");
            await useStudio.getState().importPlan(imported);
            const next = syncDesignMaterials(p, session.value, {
                sha256: imported.binary.sha256,
                name,
                pageCount: snapshot.pageCount,
                discipline: "Architectural",
              }),
              saved = await saveMaterialDatabase(session, next);
            if (saved.error) throw Error(saved.error);
            setMessage(
              `${counts.add} added, ${counts.update} updated, ${counts.retire} retired. Source PDF saved; review in Components → Project material takeoff.`,
            );
          } catch (e) {
            onError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving evidence and quantities…" : "Sync to project material register"}
      </button>
      {message && (
        <p role="status" className="arch-note">
          {message}
        </p>
      )}
      {confirmation}
    </>
  );
}
