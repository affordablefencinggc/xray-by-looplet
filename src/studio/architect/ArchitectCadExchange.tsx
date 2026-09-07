import { useEffect, useRef, useState } from "react";
import { exportDxf, importDxf } from "./exchange";
import { exportIfc } from "./ifc";
import type { ArchitectProject } from "./model";
import { CAD_LIMIT, convertCad, getCadStatus, type CadStatus } from "./cadTransport";

type ImportResult = Awaited<ReturnType<typeof importDxf>>;
function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ArchitectCadExchange({
  project,
  confirm,
  onImport,
  onError,
}: {
  project: ArchitectProject;
  confirm: (message: string) => Promise<boolean>;
  onImport: (result: ImportResult) => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<CadStatus>({ available: false });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [importDiagnostics, setImportDiagnostics] = useState<string[]>([]);
  const pending = useRef<AbortController | null>(null);
  const current = useRef(project);
  current.current = project;
  useEffect(() => {
    let live = true;
    void getCadStatus()
      .then((s) => {
        if (live) setStatus(s);
      })
      .catch(() => {
        if (live)
          setStatus({
            available: false,
            reason:
              "Local DWG translator unavailable. Use DXF or reinstall the current desktop build.",
          });
      });
    return () => {
      live = false;
      pending.current?.abort();
    };
  }, []);
  async function run(task: (signal: AbortSignal) => Promise<void>) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setNotice("");
    try {
      await task(controller.signal);
    } catch (e) {
      if (controller.signal.aborted)
        setNotice("CAD conversion cancelled. Your design is unchanged.");
      else onError(String(e));
    } finally {
      pending.current = null;
      setBusy(false);
    }
  }
  function unchanged(snapshot: ArchitectProject, signal: AbortSignal) {
    if (signal.aborted) throw Error("CAD conversion cancelled.");
    if (current.current.id !== snapshot.id || current.current.revision !== snapshot.revision)
      throw Error(
        "Your design changed during CAD import. Import again to review it against the current design.",
      );
  }
  return (
    <footer className="arch-exchange">
      <span>CAD exchange</span>
      <button
        disabled={busy}
        onClick={() =>
          void run(async (signal) => {
            const dxf = await exportDxf(project);
            if (!signal.aborted) download(dxf, "architect-design.dxf", "application/dxf");
          })
        }
      >
        Export DXF
      </button>
      <button
        disabled={busy || !status.available}
        title={status.reason}
        onClick={() =>
          void run(async (signal) => {
            const result = await convertCad(
              "to-dwg",
              new TextEncoder().encode(await exportDxf(project)),
              signal,
            );
            if (signal.aborted) return;
            download(result.bytes, "architect-design.dwg", "application/acad");
            setNotice(
              `DWG exported locally: ${result.entityCount} drawing entities. Keep a DXF or backup to retain editable assemblies.`,
            );
          })
        }
      >
        Export DWG
      </button>
      <label className="arch-file-button">
        {status.available ? "Import DXF / DWG" : "Import DXF"}
        <input
          type="file"
          accept={status.available ? ".dxf,.dwg" : ".dxf"}
          hidden
          disabled={busy}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (!file) return;
            const snapshot = project;
            void run(async (signal) => {
              if (!file.size || file.size > CAD_LIMIT)
                throw Error("CAD file is empty or exceeds 12 MB.");
              const bytes = new Uint8Array(await file.arrayBuffer());
              const isDwg =
                /\.dwg$/i.test(file.name) ||
                /^AC10\d\d/.test(new TextDecoder().decode(bytes.subarray(0, 6)));
              const converted = isDwg ? await convertCad("to-dxf", bytes, signal) : null;
              const result = await importDxf(
                new TextDecoder().decode(converted?.bytes ?? bytes),
                snapshot.id,
              );
              if (isDwg) {
                result.project.name = "Imported DWG reference geometry";
                result.warnings.unshift(
                  "DWG imported as 2D reference geometry; assemblies and original level structure are not restored.",
                );
                setImportDiagnostics(converted?.warnings ?? []);
                if (converted?.warnings.length)
                  result.warnings.push(
                    `${converted.warnings.length} CAD compatibility warning(s) recorded in Import diagnostics.`,
                  );
              }
              unchanged(snapshot, signal);
              const summary = result.parametric
                ? "This restores the X-Ray parametric design."
                : `${result.project.lines.length} lines, ${result.project.circles.length} circles and ${result.project.arcs.length} arcs. ${result.warnings.join(" ")}`;
              if (
                !(await confirm(
                  `${summary}\n\nReplace the current design? Export a backup first if needed. Undo remains available.`,
                ))
              )
                return;
              unchanged(snapshot, signal);
              onImport(result);
            });
          }}
        />
      </label>
      <button
        disabled={busy}
        onClick={() => {
          try {
            download(exportIfc(project), "architect-design.ifc", "application/x-step");
          } catch (e) {
            onError(String(e));
          }
        }}
      >
        Export IFC
      </button>
      {busy && (
        <>
          <span role="status">Converting CAD…</span>
          <button onClick={() => pending.current?.abort()}>Cancel CAD</button>
        </>
      )}
      {notice && (
        <p className="arch-note" role="status">
          {notice}
        </p>
      )}
      {importDiagnostics.length > 0 && (
        <details>
          <summary>Import diagnostics ({importDiagnostics.length})</summary>
          <ul>{importDiagnostics.map((message, i) => <li key={i}>{message}</li>)}</ul>
        </details>
      )}
      <details>
        <summary>Exchange coverage</summary>
        <p>
          DXF: plan vectors and unchanged X-Ray parametric round trips. DWG: local Windows desktop
          conversion, R14–2018 format import and 2013 format export. DWG exchanges drawing geometry;
          retain a DXF or backup for editable assemblies. External CAD imports supported 2D lines
          and curves as references. Blocks, text and unsupported entities are reported when skipped.
          IFC: modelled walls, openings, slabs and roof surfaces. Web users can exchange DXF. No
          structural or regulatory certification is implied.
        </p>
        {!status.available && status.reason && <p>{status.reason}</p>}
      </details>
    </footer>
  );
}
