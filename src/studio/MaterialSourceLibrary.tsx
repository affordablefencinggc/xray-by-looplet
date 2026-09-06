import { useRef, useState } from "react";
import { THORNTON_LIBRARY } from "./construction/thorntonLibrary";
import { openMaterialLibrarySource } from "./materialLibrarySource";
import type { MaterialSource } from "./construction/projectMaterials";

export function MaterialSourceLibrary({
  disabled,
  onOpened,
}: {
  disabled: boolean;
  onOpened: (source: MaterialSource) => Promise<void>;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState("");
  async function open(item: (typeof THORNTON_LIBRARY)[number]) {
    setBusy(item.sha256);
    setError("");
    try {
      await openMaterialLibrarySource(item);
      await onOpened({
        name: item.name,
        sha256: item.sha256,
        pageCount: item.pageCount,
        discipline: item.discipline,
      });
      if (details.current) details.current.open = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <details ref={details} className="takeoff-inspector">
      <summary>Public project library · Thornton Fire Station 8 · 1,260 pages</summary>
      <p>
        Ten original source documents, including architectural, structural, site, landscape,
        services and specifications. Drawing issue dates vary; review revisions and exclusions.
        Fire-station alerting is not a sprinkler-system design.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="material-library">
        {THORNTON_LIBRARY.map((item) => (
          <div key={item.sha256}>
            <div>
              <b>{item.name.replace("Thornton Fire Station 8 — ", "")}</b>
              <p>
                {item.pageCount} pages · {item.issue} · {(item.sizeBytes / 1024 / 1024).toFixed(1)}{" "}
                MB
              </p>
              <small>{item.note}</small>
            </div>
            <button className="pill" disabled={disabled || !!busy} onClick={() => void open(item)}>
              {busy === item.sha256 ? "Opening…" : `Open ${item.name.split(" — ")[1]} source`}
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
