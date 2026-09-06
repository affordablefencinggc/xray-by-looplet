import type { RunCorner, RunSpecification } from "./domain";
import type { EditableFenceRun } from "./tracing";
import type { ConstructionRunQuantity } from "./construction/runQuantity";

export type SpecificationPanelProps = {
  run: EditableFenceRun;
  onUpdate: (runId: string, expectedRevision: number, patch: Partial<RunSpecification>) => void;
  error?: string | null;
  quantity?: ConstructionRunQuantity;
};

const SYSTEMS: readonly [RunSpecification["system"], string][] = [
  ["unselected", "Select system"], ["colorbond", "Colorbond / Metal"], ["timber-paling", "Timber paling / Siding"],
  ["pool", "Pool barrier"], ["chain-wire", "Chain wire / Mesh"], ["custom", "Custom"],
];

export function SpecificationPanel({ run, onUpdate, error = null, quantity }: SpecificationPanelProps) {
  const spec = run.specification;
  const general = spec.constructionEnabled !== false ? spec.construction : undefined;
  const patch = (value: Partial<RunSpecification>) => onUpdate(run.id, run.revision, value);
  const patchGeneral = (value: Partial<NonNullable<RunSpecification["construction"]>>) => {
    if (general) patch({ construction: { ...general, ...value } });
  };
  const updateCorner = (vertexIndex: number, treatment: RunCorner["treatment"] | "none") => {
    const existing = spec.corners.find((corner) => corner.vertexIndex === vertexIndex);
    if (treatment === "none") {
      patch({ corners: spec.corners.filter((corner) => corner.vertexIndex !== vertexIndex) });
      return;
    }
    patch({ corners: existing
      ? spec.corners.map((corner) => corner.id === existing.id ? { ...corner, treatment } : corner)
      : [...spec.corners, { id: newSpecificationId("corner"), vertexIndex, treatment, notes: "" }],
    });
  };
  const updateCornerNotes = (corner: RunCorner, notes: string) => patch({
    corners: spec.corners.map((entry) => entry.id === corner.id ? { ...entry, notes } : entry),
  });
  const addPostOverride = (vertexIndex: number) => patch({
    postOverrides: [...spec.postOverrides, { id: newSpecificationId("post"), vertexIndex, postSize: "", lengthM: null, embedmentM: null, notes: "" }],
  });
  const updatePostOverride = (id: string, value: Partial<RunSpecification["postOverrides"][number]>) => patch({
    postOverrides: spec.postOverrides.map((entry) => entry.id === id ? { ...entry, ...value } : entry),
  });

  return (
    <section className="specification-panel" aria-labelledby="run-specification-heading">
      <header className="specification-heading-row">
        <div><span className="eyebrow">Estimator inputs</span><h2 id="run-specification-heading">Run specification</h2></div>
        <span className="trace-revision">Revision {run.revision}</span>
      </header>

      {error ? <div className="specification-error" role="alert"><strong>Run specification needs attention</strong><span>{error}</span></div> : null}

      <SelectField label="Takeoff type" value={general ? "construction" : "fencing"} onChange={(value) => patch({ constructionEnabled: value === "construction", construction: spec.construction ?? (value === "construction" ? {
        assembly: "generic", trade: "", quantity: "length", widthM: null, depthM: null, reference: "",
      } : undefined) })} options={[["fencing", "Fencing"], ["construction", "General construction"]]} />
      {general ? <>
        <div className="specification-grid">
          <SelectField label="Construction assembly" value={general.assembly} onChange={(assembly) => patchGeneral({ assembly: assembly as typeof general.assembly })} options={[["generic", "General assembly"], ["wall", "Wall"], ["partition", "Partition"], ["slab", "Slab / strip"], ["conduit", "Conduit / route"]]} />
          <TextField label="Trade / work package" value={general.trade} onChange={(trade) => patchGeneral({ trade })} placeholder="Concrete, electrical, interiors…" />
          <SelectField label="Quantity basis" value={general.quantity} onChange={(value) => patchGeneral({ quantity: value as typeof general.quantity })} options={[["length", "Run length (m)"], ["area", "Strip / face area (m²)"], ["volume", "Rectangular volume (m³)"]]} />
          {general.quantity !== "length" ? <NumberField label="Section width / height (m)" value={general.widthM} min={0.000001} step="any" max={10000} onChange={(widthM) => patchGeneral({ widthM })} /> : null}
          {general.quantity === "volume" ? <NumberField label="Section depth / thickness (m)" value={general.depthM} min={0.000001} step="any" max={1000} onChange={(depthM) => patchGeneral({ depthM })} /> : null}
          <TextField wide label="Quantity source reference" value={general.reference} onChange={(reference) => patchGeneral({ reference })} placeholder="Drawing detail or schedule supporting these dimensions" />
        </div>
        <div className="specification-group" role="status" aria-label="General run quantity">
          <strong>{quantity?.value != null ? `${Number(quantity.value.toPrecision(10))} ${quantity.unit}` : "Quantity unavailable"}</strong>
          <p>{quantity?.reason ?? quantity?.formula ?? "Verify the source and scale to calculate."}</p>
          <p>Gross traced length × section dimensions. Openings and overlaps are not deducted. This is measured geometry; packaged storage volume and weight belong in the material register.</p>
          <small>Review: {run.review.status}. General takeoffs do not generate fencing materials.</small>
        </div>
      </> : <>
      <div className="specification-grid">
        <SelectField label="Assembly / system" value={spec.system} onChange={(value) => patch({ system: value as RunSpecification["system"] })} options={SYSTEMS} />
        <TextField label="Profile / product" value={spec.profile} onChange={(profile) => patch({ profile })} placeholder="Panel or product profile" />
        {spec.system === "custom" ? <TextField wide label="Custom system" value={spec.customSystem} onChange={(customSystem) => patch({ customSystem })} placeholder="Describe the assembly / system" /> : null}
        <NumberField label="Height (m)" value={spec.heightM} max={10} onChange={(heightM) => patch({ heightM })} placeholder="1.8" />
        <NumberField label="Bay width (m)" value={spec.bayWidthM} max={20} onChange={(bayWidthM) => patch({ bayWidthM })} placeholder="2.4" />
        <SelectField label="Ground" value={spec.ground} onChange={(value) => patch({ ground: value as RunSpecification["ground"] })} options={[["unselected", "Select ground"], ["soil", "Soil"], ["concrete", "Concrete"], ["rock", "Rock"], ["retaining-wall", "Retaining wall"], ["mixed", "Mixed"]]} />
        <SelectField label="Slope" value={spec.slope} onChange={(value) => patch({ slope: value as RunSpecification["slope"] })} options={[["unselected", "Select slope"], ["level", "Level"], ["stepped", "Stepped"], ["raked", "Raked"], ["mixed", "Mixed"]]} />
        <SelectField label="Access" value={spec.access} onChange={(value) => patch({ access: value as RunSpecification["access"] })} options={[["unselected", "Select access"], ["clear", "Clear"], ["restricted", "Restricted"], ["hand-carry", "Hand carry"], ["plant-required", "Plant required"]]} />
        <SelectField label="Sleepers" value={spec.sleepers} onChange={(value) => patch({ sleepers: value as RunSpecification["sleepers"] })} options={[["unselected", "Select sleepers"], ["none", "None"], ["timber", "Timber"], ["concrete", "Concrete"], ["custom", "Custom"]]} />
      </div>

      <details className="specification-group" open={spec.removalRequired}>
        <summary><span>Existing structure / element removal</span><small>{spec.removalRequired ? "Included" : "Not included"}</small></summary>
        <div className="specification-grid">
          <ToggleField wide label="Removal required" detail="Include demolition or removal of existing elements" checked={spec.removalRequired} onChange={(removalRequired) => patch({ removalRequired })} />
          {spec.removalRequired ? <>
            <TextField label="Removal material" value={spec.removalMaterial} onChange={(removalMaterial) => patch({ removalMaterial })} placeholder="Timber, steel…" />
            <NumberField label="Removal length (m)" value={spec.removalLengthM} max={10000} onChange={(removalLengthM) => patch({ removalLengthM })} />
            <ToggleField wide label="Disposal required" detail="Remove demolition waste from site" checked={spec.disposalRequired} onChange={(disposalRequired) => patch({ disposalRequired })} />
          </> : null}
        </div>
      </details>

      <details className="specification-group" open={spec.retainingRequired}>
        <summary><span>Retaining</span><small>{spec.retainingRequired ? "Required" : "Not required"}</small></summary>
        <div className="specification-grid">
          <ToggleField wide label="Retaining required" detail="Capture retaining work on this run" checked={spec.retainingRequired} onChange={(retainingRequired) => patch({ retainingRequired })} />
          {spec.retainingRequired ? <>
            <SelectField label="Retaining type" value={spec.retainingType} onChange={(value) => patch({ retainingType: value as RunSpecification["retainingType"] })} options={[["unselected", "Select type"], ["none", "None"], ["timber-sleeper", "Timber sleeper"], ["concrete-sleeper", "Concrete sleeper"], ["masonry", "Masonry"], ["existing", "Existing"], ["custom", "Custom"]]} />
            <NumberField label="Retaining height (m)" value={spec.retainingHeightM} min={0} max={10} onChange={(retainingHeightM) => patch({ retainingHeightM })} />
            <TextField wide label="Retaining condition" value={spec.retainingCondition} onChange={(retainingCondition) => patch({ retainingCondition })} placeholder="Existing wall, edge and condition" />
          </> : null}
        </div>
      </details>

      <details className="specification-group">
        <summary><span>Corner treatments</span><small>{spec.corners.length} set</small></summary>
        <div className="vertex-specification-list">
          {run.points.map((_, vertexIndex) => {
            const corner = spec.corners.find((entry) => entry.vertexIndex === vertexIndex);
            return <div className="vertex-specification-row" key={`corner-${vertexIndex}`}>
              <strong>Vertex {vertexIndex + 1}</strong>
              <select aria-label={`Vertex ${vertexIndex + 1} corner treatment`} value={corner?.treatment ?? "none"} onChange={(event) => updateCorner(vertexIndex, event.currentTarget.value as RunCorner["treatment"] | "none")}>
                <option value="none">No treatment</option><option value="standard">Standard</option><option value="boxed">Boxed</option><option value="mitred">Mitred</option><option value="end">End</option><option value="custom">Custom</option>
              </select>
              {corner ? <input aria-label={`Vertex ${vertexIndex + 1} corner notes`} value={corner.notes} onChange={(event) => updateCornerNotes(corner, event.currentTarget.value)} placeholder="Corner notes" /> : null}
            </div>;
          })}
        </div>
      </details>

      <details className="specification-group">
        <summary><span>Post overrides</span><small>{spec.postOverrides.length} set</small></summary>
        <div className="vertex-specification-list">
          {run.points.map((_, vertexIndex) => {
            const post = spec.postOverrides.find((entry) => entry.vertexIndex === vertexIndex);
            return <div className="post-override-row" key={`post-${vertexIndex}`}>
              <strong>Vertex {vertexIndex + 1}</strong>
              {post ? <>
                <input aria-label={`Vertex ${vertexIndex + 1} post size`} value={post.postSize} onChange={(event) => updatePostOverride(post.id, { postSize: event.currentTarget.value })} placeholder="Post size" />
                <input aria-label={`Vertex ${vertexIndex + 1} post length metres`} type="number" min="0.01" max="10" step="0.01" value={post.lengthM ?? ""} onChange={(event) => updatePostOverride(post.id, { lengthM: numberOrNull(event.currentTarget.value) })} placeholder="Length m" />
                <input aria-label={`Vertex ${vertexIndex + 1} embedment metres`} type="number" min="0.01" max="5" step="0.01" value={post.embedmentM ?? ""} onChange={(event) => updatePostOverride(post.id, { embedmentM: numberOrNull(event.currentTarget.value) })} placeholder="Embed m" />
                <input aria-label={`Vertex ${vertexIndex + 1} post notes`} value={post.notes} onChange={(event) => updatePostOverride(post.id, { notes: event.currentTarget.value })} placeholder="Post notes" />
                <button type="button" className="specification-remove" onClick={() => patch({ postOverrides: spec.postOverrides.filter((entry) => entry.id !== post.id) })}>Remove override</button>
              </> : <button type="button" className="button button-secondary" onClick={() => addPostOverride(vertexIndex)}>Add post override</button>}
            </div>;
          })}
        </div>
      </details>

      </>}
      <label className="field"><span>Run notes</span><textarea rows={3} value={spec.notes} onChange={(event) => patch({ notes: event.currentTarget.value })} placeholder="Special construction, access or estimating notes" /></label>
    </section>
  );
}

function TextField({ label, value, onChange, placeholder, wide = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; wide?: boolean }) {
  return <label className={`field${wide ? " field-wide" : ""}`}><span>{label}</span><input value={value} onChange={(event) => onChange(event.currentTarget.value)} placeholder={placeholder} /></label>;
}

function NumberField({ label, value, onChange, min = 0.01, max, placeholder, step = 0.01 }: { label: string; value: number | null; onChange: (value: number | null) => void; min?: number; max: number; placeholder?: string; step?: number | "any" }) {
  return <label className="field"><span>{label}</span><input type="number" inputMode="decimal" min={min} max={max} step={step} value={value ?? ""} onChange={(event) => onChange(numberOrNull(event.currentTarget.value))} placeholder={placeholder} /></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <label className="field"><span>{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>;
}

function ToggleField({ label, detail, checked, onChange, wide = false }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void; wide?: boolean }) {
  return <label className={`check-row${wide ? " field-wide" : ""}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} /><span><strong>{label}</strong><small>{detail}</small></span></label>;
}

function numberOrNull(value: string) {
  return value === "" ? null : Number(value);
}

function newSpecificationId(prefix: string) {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${prefix}-${token}`;
}
