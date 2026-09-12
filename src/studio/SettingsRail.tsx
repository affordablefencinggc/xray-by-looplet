import { useEffect, useState } from "react";
import { Expand, Minimize, X, UserRound } from "lucide-react";
import { useStudio } from "./store";
import { RAIL_WIDTHS_CHANGED_EVENT, DEFAULT_RAILS, RAIL_LAYOUT_KEY, readRailWidths } from "./railLayout";
import { useCurrentUserState } from "../lib/auth/use-current-user";
import { authEnabled, signOut } from "../lib/auth/client";

export type SettingsSection =
  "Appearance" | "Layout" | "Measurement" | "Price sheets" | "Administration" | "Account";
export function AccountButton({ onClick }: { onClick: () => void }) {
  const { user, isPending } = useCurrentUserState();
  const real = user && !user.isDevFallback ? user : null;
  return (
    <button
      className="account-button"
      onClick={onClick}
      aria-label={real ? "Your account" : "Log in"}
    >
      <span className="account-avatar">
        {real?.primaryEmail?.[0]?.toUpperCase() ?? <UserRound size={15} />}
      </span>
      <span>{isPending ? "Account…" : (real?.primaryEmail ?? "Log in")}</span>
    </button>
  );
}

export function SettingsRail({
  section,
  setSection,
  onClose,
  onOpenPlan,
}: {
  section: SettingsSection;
  setSection: (s: SettingsSection) => void;
  onClose: () => void;
  onOpenPlan: () => void;
}) {
  const s = useStudio(),
    { user } = useCurrentUserState();
  const real = user && !user.isDevFallback ? user : null;
  const [error, setError] = useState("");
  const [widths, setWidths] = useState(DEFAULT_RAILS);
  useEffect(() => {
    try { setWidths(readRailWidths(localStorage.getItem(RAIL_LAYOUT_KEY))); } catch { /* defaults */ }
    const update = (event: Event) => setWidths(readRailWidths(JSON.stringify((event as CustomEvent).detail)));
    window.addEventListener(RAIL_WIDTHS_CHANGED_EVENT, update);
    return () => window.removeEventListener(RAIL_WIDTHS_CHANGED_EVENT, update);
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  const resize = (side: "left" | "right", value: number) => {
    const next = { ...widths, [side]: value };
    setWidths(next);
    window.dispatchEvent(new CustomEvent("xray:rail-layout", { detail: next }));
  };
  const wide = widths.right > DEFAULT_RAILS.right;
  return (
    <aside className="workspace-settings" data-wide={wide} aria-label="Settings">
      <header>
        <div>
          <span className="kicker">Workspace configuration</span>
          <h2>Settings</h2>
        </div>
        <button
          className="pill"
          aria-label={wide ? "Narrow settings" : "Expand settings"}
          onClick={() => resize("right", wide ? DEFAULT_RAILS.right : 600)}
        >
          {wide ? <Minimize size={16} /> : <Expand size={16} />}
        </button>
        <button className="pill" aria-label="Close settings" onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <nav aria-label="Settings sections">
        {(
          [
            "Appearance",
            "Layout",
            "Measurement",
            "Price sheets",
            "Administration",
            "Account",
          ] as SettingsSection[]
        ).map((name) => (
          <button
            key={name}
            aria-pressed={section === name}
            onClick={() => {
              setSection(name);
              if (name === "Price sheets") resize("right", 600);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {section === "Appearance" && (
          <>
            <h3>Themes & model appearance</h3>
            <p>Set the workspace colour scheme.</p>
            <div className="settings-actions">
              <button
                className="pill"
                aria-pressed={s.skin === "paper"}
                onClick={() => s.setSkin("paper")}
              >
                Cream
              </button>
              <button
                className="pill"
                aria-pressed={s.skin === "navy"}
                onClick={() => s.setSkin("navy")}
              >
                Charcoal
              </button>
            </div>
            <p>
              Solid-model colours, lighting, background effects and wire settings are available in
              the model’s Visual settings.
            </p>
            <button
              className="pill"
              onClick={() => {
                s.setPane("model");
                onClose();
              }}
            >
              Open model appearance
            </button>
          </>
        )}
        {section === "Layout" && (
          <>
            <h3>Menu widths</h3>
            <p>Drag either inner menu edge, or set its default width here.</p>
            {(["left", "right"] as const).map((side) => (
              <label key={side}>
                {side === "left" ? "Left menu" : "Right menu"}
                <input
                  type="range"
                  aria-label={`${side} menu width`}
                  min={side === "left" ? 200 : 320}
                  max={side === "left" ? 440 : 600}
                  value={widths[side]}
                  onChange={(e) => resize(side, Number(e.target.value))}
                />
                <output>{widths[side]} px</output>
              </label>
            ))}
            <button
              className="pill"
              onClick={() => {
                setWidths(DEFAULT_RAILS);
                window.dispatchEvent(
                  new CustomEvent("xray:rail-layout", { detail: DEFAULT_RAILS }),
                );
              }}
            >
              Reset menu widths
            </button>
            <p>
              The bottom diagnostics header can be dragged upward, clicked to open, and clicked
              again to collapse.
            </p>
          </>
        )}
        {section === "Measurement" && (
          <>
            <h3>Drawing controls</h3>
            <label>
              <input type="checkbox" checked={s.snappingEnabled} onChange={s.toggleSnapping} />
              Snap to vectors
            </label>
            <label>
              <input type="checkbox" checked={s.showSrc} onChange={() => s.toggle("showSrc")} />
              Show source vectors
            </label>
            <label>
              <input type="checkbox" checked={s.showMan} onChange={() => s.toggle("showMan")} />
              Show manual markups
            </label>
            <button
              className="pill"
              onClick={() => {
                s.setPane("measure");
                onClose();
              }}
            >
              Open calibration & measurement
            </button>
            <p>
              Scale is calibrated against each drawing. Changing display settings never changes its
              measured dimensions.
            </p>
          </>
        )}
        {section === "Price sheets" && <PriceSheets />}
        {section === "Administration" && (
          <>
            <h3>Project & diagnostics</h3>
            <p>
              Saved work: {s.hydrationStatus}. Source: {s.activePlanBinary?.name ?? "No plan open"}.
            </p>
            <div className="settings-actions">
              <button className="pill" onClick={onOpenPlan}>
                Open plan
              </button>
              <button className="pill" onClick={() => { s.toggle("capsOpen"); onClose(); }}>
                Capabilities & live checklist
              </button>
              <button
                className="pill"
                onClick={() => {
                  s.setPane("proof");
                  onClose();
                }}
              >
                Evidence & proof
              </button>
              <button
                className="pill"
                onClick={() => {
                  s.setPane("components");
                  onClose();
                }}
              >
                Material import & backups
              </button>
            </div>
            <p>
              Organization permissions and shared administration require a connected account
              service.
            </p>
          </>
        )}
        {section === "Account" && (
          <>
            <h3>{real ? "Your account" : "Log in to X-Ray"}</h3>
            <div className="settings-account-card">
              <span className="account-avatar">
                <UserRound size={20} />
              </span>
              <strong>{real?.primaryEmail ?? "Not signed in"}</strong>
            </div>
            {real ? (
              <button
                className="pill"
                onClick={() => void signOut().catch((e) => setError(String(e)))}
              >
                Log out
              </button>
            ) : (
              <p>
                {authEnabled
                  ? "Account sign-in is awaiting its configured provider."
                  : "This desktop workspace has no connected account service yet. Your plans remain saved on this device. Email sign-in will be available once the account service is connected."}
              </p>
            )}
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </div>
    </aside>
  );
}

type PriceRow = { id: string; description: string; unit: string; rate: string };
function PriceSheets() {
  const [rows, setRows] = useState<PriceRow[]>([]),
    [currency, setCurrency] = useState("AUD"),
    [status, setStatus] = useState("");
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("xray.price-sheet.v1") ?? "null");
      if (v) {
        if (
          !Array.isArray(v.rows) ||
          v.rows.length > 1000 ||
          !v.rows.every(
            (r: PriceRow) =>
              r && [r.id, r.description, r.unit, r.rate].every((x) => typeof x === "string"),
          )
        )
          throw Error();
        setRows(v.rows);
        setCurrency(["AUD", "NZD", "USD", "GBP", "EUR"].includes(v.currency) ? v.currency : "AUD");
      }
    } catch {
      setStatus("Saved price sheet could not be read. It has not been overwritten.");
    }
  }, []);
  const save = () => {
    if (
      rows.some(
        (r) =>
          !r.description.trim() ||
          !r.unit.trim() ||
          !r.rate.trim() ||
          !Number.isFinite(Number(r.rate)) ||
          Number(r.rate) < 0,
      )
    ) {
      setStatus("Each line needs a description, unit and non-negative rate.");
      return;
    }
    try {
      localStorage.setItem("xray.price-sheet.v1", JSON.stringify({ currency, rows }));
      setStatus("Price sheet saved on this device.");
    } catch {
      setStatus("Could not save. Your previous price sheet is preserved.");
    }
  };
  return (
    <>
      <h3>Reference price sheet</h3>
      <p>
        Maintain supplier rates here. These reference rates are not automatically applied to takeoff
        quantities or quotes.
      </p>
      <label>
        Currency
        <select
          value={currency}
          onChange={(e) => {
            setCurrency(e.target.value);
            setStatus("");
          }}
        >
          {["AUD", "NZD", "USD", "GBP", "EUR"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="settings-price-list">
        {rows.map((r, i) => (
          <div key={r.id}>
            <input
              aria-label={`Description ${i + 1}`}
              placeholder="Material or service"
              maxLength={200}
              value={r.description}
              onChange={(e) => {
                setRows(
                  rows.map((v) => (v.id === r.id ? { ...v, description: e.target.value } : v)),
                );
                setStatus("");
              }}
            />
            <input
              aria-label={`Unit ${i + 1}`}
              placeholder="m, m², each"
              maxLength={30}
              value={r.unit}
              onChange={(e) => {
                setRows(rows.map((v) => (v.id === r.id ? { ...v, unit: e.target.value } : v)));
                setStatus("");
              }}
            />
            <input
              aria-label={`Rate ${i + 1}`}
              type="number"
              min="0"
              step="0.01"
              value={r.rate}
              onChange={(e) => {
                setRows(rows.map((v) => (v.id === r.id ? { ...v, rate: e.target.value } : v)));
                setStatus("");
              }}
            />
            <button
              className="pill"
              aria-label={`Remove rate ${i + 1}`}
              onClick={() => {
                setRows(rows.filter((v) => v.id !== r.id));
                setStatus("");
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="settings-actions">
        <button
          className="pill"
          disabled={rows.length >= 1000}
          onClick={() => {
            setRows([
              ...rows,
              { id: crypto.randomUUID(), description: "", unit: "each", rate: "" },
            ]);
            setStatus("");
          }}
        >
          Add rate
        </button>
        <button className="pill-dark" onClick={save}>
          Save price sheet
        </button>
      </div>
      <p role="status">{status}</p>
    </>
  );
}
