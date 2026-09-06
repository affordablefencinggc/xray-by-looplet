import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BUILDING_CATALOG,
  fetchBuildingBytes,
  parseSourceBuilding,
  sourceBytesMatch,
  type SourceBuilding,
} from "./sourceBuilding";
import { useStudio } from "./store";
import { floorKey } from "./componentLocation";
import { ComponentLocationMaps } from "./ComponentLocationMaps";
type Context = {
  model: SourceBuilding | null;
  error: string;
  selected: string;
  select: (id: string) => void;
  available: boolean;
};
const SourceContext = createContext<Context>({
  model: null,
  error: "",
  selected: "",
  select: () => {},
  available: false,
});
export const useSourceComponents = () => useContext(SourceContext);
export function SourceComponentsProvider({ children }: { children: ReactNode }) {
  const binary = useStudio((s) => s.activePlanBinary),
    pane = useStudio((s) => s.pane);
  const [model, setModel] = useState<SourceBuilding | null>(null),
    [error, setError] = useState(""),
    [selected, select] = useState("");
  const config = BUILDING_CATALOG.find((c) => c.sha256 === binary?.sha256);
  useEffect(() => {
    if (pane !== "components") return;
    const abort = new AbortController();
    setModel(null);
    setError("");
    select("");
    if (!config || !binary) return;
    void fetchBuildingBytes(config.sceneUrl, 20 * 1024 * 1024, abort.signal)
      .then(async (bytes) => {
        const parsed = parseSourceBuilding(JSON.parse(new TextDecoder().decode(bytes)));
        if (!(await sourceBytesMatch(parsed, binary.bytes, binary.sha256)))
          throw Error("Model does not match this original drawing.");
        if (!abort.signal.aborted) {
          setModel(parsed);
          select(parsed.objects[0].id);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e.message ?? e));
      });
    return () => abort.abort();
  }, [pane, config, binary]);
  return (
    <SourceContext.Provider value={{ model, error, selected, select, available: !!config }}>
      {children}
    </SourceContext.Provider>
  );
}
export function SourceComponentsList() {
  const { model, error, selected, select } = useSourceComponents();
  const [floor, setFloor] = useState("all"),
    [category, setCategory] = useState("all"),
    [search, setSearch] = useState("");
  const groups = useMemo(() => {
    const map = new Map<
      string,
      typeof model extends null ? never : NonNullable<typeof model>["objects"]
    >();
    for (const p of model?.objects ?? []) {
      if (
        (floor !== "all" && floorKey(p) !== floor) ||
        (category !== "all" && p.category !== category) ||
        (search && !`${p.label} ${p.id}`.toLowerCase().includes(search.toLowerCase()))
      )
        continue;
      const k = floorKey(p);
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    return [...map];
  }, [model, floor, category, search]);
  if (error) return <p role="alert">{error}</p>;
  if (!model) return <p role="status">Checking source-linked components…</p>;
  return (
    <section className="source-components" aria-label="Source building components">
      <header>
        <span className="kicker">Source-linked model parts</span>
        <h1>{model.source.title ?? model.source.name}</h1>
        <p>
          Rendering parts with drawing references. Approximate geometry is not a verified physical
          stock count.
        </p>
      </header>
      <div className="component-filters">
        <label>
          Floor
          <select aria-label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)}>
            <option value="all">All floors</option>
            {[...new Set(model.objects.map(floorKey))].map((k) => (
              <option key={k} value={k}>
                {model.storeys?.find((s) => s.id === k)?.label ?? k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {[...new Set(model.objects.map((p) => p.category))].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Search parts
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Column, slab, part ID…"
          />
        </label>
      </div>
      <p>
        {groups.reduce((n, [, p]) => n + p.length, 0)} matching model parts · select one to locate
        it in the right menu.
      </p>
      {groups.map(([key, parts]) => (
        <details
          className="source-component-floor"
          key={key}
          open={
            floor !== "all" ||
            category !== "all" ||
            !!search.trim() ||
            parts.some((p) => p.id === selected)
          }
        >
          <summary>
            {model.storeys?.find((s) => s.id === key)?.label ?? key}
            <span>{parts.length} parts</span>
          </summary>
          <div>
            {parts.map((p) => (
              <button
                key={p.id}
                className="source-component-row"
                aria-pressed={p.id === selected}
                onClick={() => select(p.id)}
              >
                <span>
                  <b>{p.label}</b>
                  <small>{p.id}</small>
                </span>
                <span>{p.category}</span>
                <span>{p.evidenceState}</span>
              </button>
            ))}
          </div>
        </details>
      ))}
      {!groups.length && <p>No parts match these filters.</p>}
    </section>
  );
}
export function SourceComponentsInspector() {
  const { model, error, selected } = useSourceComponents();
  const part = model?.objects.find((p) => p.id === selected);
  return (
    <aside
      className="studio-right-rail source-component-inspector"
      aria-label="Component inspector"
    >
      {model && part ? (
        <>
          <ComponentLocationMaps key={part.id} model={model} part={part} />
          <h2>{part.label}</h2>
          <dl>
            <dt>Part ID</dt>
            <dd>{part.id}</dd>
            <dt>Category</dt>
            <dd>{part.category}</dd>
            <dt>Evidence</dt>
            <dd>{part.evidenceState}</dd>
            <dt>Source pages</dt>
            <dd>{[...new Set(part.sourceRefs.map((r) => r.page))].join(", ")}</dd>
          </dl>
          <p>{part.note}</p>
          <details>
            <summary>Drawing references</summary>
            {part.sourceRefs.map((r, i) => (
              <p key={i}>
                Page {r.page}: {r.note}
              </p>
            ))}
          </details>
        </>
      ) : (
        <p>{error || "Select a source-linked part to inspect its location."}</p>
      )}
    </aside>
  );
}
