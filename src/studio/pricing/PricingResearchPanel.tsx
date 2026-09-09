import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  PRICING_RESEARCH_MAX_RESULTS,
  PRICING_RESEARCH_VERSION,
  estimateSearchCredits,
  isSupplierHostname,
  pricingResearchFailureSchema,
  pricingResearchResultSchema,
  summarisePricingResearch,
  type PricingResearchFailure,
  type PricingResearchRequestInput,
  type PricingResearchResult,
} from "./pricingResearch.ts";
import "./pricingResearch.css";

const ROUTE = "/api/pricing-research";
const COUNTRIES: Array<[string, string]> = [["AU", "Australia"], ["NZ", "New Zealand"], ["GB", "United Kingdom"], ["US", "United States"], ["CA", "Canada"]];
const UNAVAILABLE = "Supplier research service unavailable in this build.";

type ProviderStatus = { provider: string; configured: boolean; available: boolean; message: string };
type StatusState = { phase: "loading" } | { phase: "ready"; status: ProviderStatus } | { phase: "unavailable"; message: string };
type RunState =
  | { phase: "idle" }
  | { phase: "running"; startedAt: string }
  | { phase: "result"; result: PricingResearchResult }
  | { phase: "failure"; failure: PricingResearchFailure; httpStatus: number | null };

const FAILURE_LABEL: Record<PricingResearchFailure["code"], string> = {
  "not-configured": "Provider not configured", disabled: "Disabled by the operator", unauthorized: "Credential rejected",
  "payment-required": "No provider credit", "rate-limited": "Rate limited", timeout: "Timed out", cancelled: "Cancelled",
  "invalid-response": "Invalid provider response", "too-large": "Response too large", "upstream-error": "Provider error",
  busy: "Another search is running", "invalid-request": "Request rejected",
};

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
const statusOf = (state: StatusState) =>
  state.phase === "loading" ? "loading" : state.phase === "unavailable" ? "unavailable" : state.status.available ? "available" : state.status.configured ? "disabled" : "not-configured";
const timestamp = (iso: string) => { const date = new Date(iso); return Number.isNaN(date.getTime()) ? iso : `${date.toLocaleString()} (${iso})`; };

/**
 * Bounded, user-initiated supplier link search. Collects evidence links only:
 * nothing here is stored, and no price book rate or project cost changes.
 */
export function PricingResearchPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<StatusState>({ phase: "loading" });
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [query, setQuery] = useState(""), [country, setCountry] = useState("AU"), [domain, setDomain] = useState(""), [limit, setLimit] = useState(PRICING_RESEARCH_MAX_RESULTS);
  const [formError, setFormError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    // Only the provider status is read on mount; a search starts from the button alone.
    const probe = new AbortController();
    fetch(ROUTE, { method: "GET", cache: "no-store", signal: probe.signal })
      .then(async (response) => {
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const json = (await response.json()) as Partial<ProviderStatus>;
        if (typeof json.configured !== "boolean" || typeof json.available !== "boolean" || typeof json.message !== "string") throw Error("shape");
        setStatus({ phase: "ready", status: { provider: String(json.provider ?? "Firecrawl"), configured: json.configured, available: json.available, message: json.message } });
      })
      .catch(() => { if (!probe.signal.aborted) setStatus({ phase: "unavailable", message: UNAVAILABLE }); });
    return () => { probe.abort(); controller.current?.abort(); };
  }, []);

  async function startSearch() {
    if (run.phase === "running" || !query.trim()) return;
    const hostname = domain.trim().toLowerCase();
    if (hostname && !isSupplierHostname(hostname)) { setFormError("Enter one public supplier hostname, for example www.bunnings.com.au, or leave it blank."); return; }
    setFormError("");
    const requestId = newRequestId(), startedAt = new Date().toISOString();
    const body: PricingResearchRequestInput = {
      schema: PRICING_RESEARCH_VERSION, query: query.trim().slice(0, 200), country, limit, projectId, requestId,
      ...(hostname ? { includeDomains: [hostname] } : {}),
    };
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setRun({ phase: "running", startedAt });
    const finish = (next: RunState) => { if (controller.current === abort) { controller.current = null; setRun(next); } };
    const failed = (code: PricingResearchFailure["code"], message: string, retryable: boolean, httpStatus: number | null) =>
      finish({ phase: "failure", httpStatus, failure: { schema: PRICING_RESEARCH_VERSION, requestId, code, message, retryable, startedAt, finishedAt: new Date().toISOString() } });
    try {
      const response = await fetch(ROUTE, {
        method: "POST", cache: "no-store", signal: abort.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      let json: { result?: unknown; failure?: unknown } = {};
      try { json = await response.json(); } catch { /* handled below as invalid-response */ }
      if (json.failure) {
        const failure = pricingResearchFailureSchema.safeParse(json.failure);
        if (failure.success) return finish({ phase: "failure", failure: failure.data, httpStatus: response.status });
      }
      if (response.ok && json.result) {
        const result = pricingResearchResultSchema.safeParse(json.result);
        if (result.success && result.data.requestId === requestId) return finish({ phase: "result", result: result.data });
      }
      failed("invalid-response", `The supplier research service answered with an unexpected response (HTTP ${response.status}). No links were kept.`, false, response.status);
    } catch {
      if (abort.signal.aborted) failed("cancelled", "Search cancelled. Any late response is discarded; provider billing for the attempt is unknown.", true, null);
      else failed("upstream-error", UNAVAILABLE, true, null);
    }
  }
  function cancelSearch() {
    controller.current?.abort();
  }

  const providerState = statusOf(status);
  const running = run.phase === "running";
  const statusMessage = status.phase === "loading" ? "Checking supplier research availability…" : status.phase === "unavailable" ? status.message : status.status.message;
  const summary = run.phase === "result" ? summarisePricingResearch(run.result) : null;
  return <section className="pricing-research" aria-label="Supplier product research" data-research-status={providerState} data-research-state={run.phase}>
    <header><div><h2>Supplier product research</h2><p>Search the web for supplier product pages to use as pricing evidence. Results are links only: nothing is saved and no rate or project cost changes.</p></div></header>
    <p className="price-notice pricing-research-status" role="status" data-research-status-message>{status.phase === "ready" ? `${status.status.provider}: ` : ""}{statusMessage}</p>
    <form className="pricing-research-form" onSubmit={(event) => { event.preventDefault(); void startSearch(); }}>
      <div className="price-fields">
        <label className="price-wide">Product query<input id="pricing-research-query" name="query" maxLength={200} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="90x45 MGP10 treated pine" autoComplete="off" /></label>
        <label>Country<select name="country" value={country} onChange={(e) => setCountry(e.target.value)}>{COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}</select></label>
        <label>Max results<select name="limit" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>{Array.from({ length: PRICING_RESEARCH_MAX_RESULTS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="price-wide">Supplier domain (optional, include only)<input name="domain" maxLength={253} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="www.bunnings.com.au" autoComplete="off" inputMode="url" /></label>
      </div>
      {formError && <p className="price-notice" role="alert">{formError}</p>}
      <p className="price-help">Nominal cost {estimateSearchCredits(limit)} provider credits for up to {limit} web link{limit === 1 ? "" : "s"} (documented estimate, not a provider maximum). Reported usage is shown with each result.</p>
      <div className="price-actions">
        <button type="submit" className="pill primary" disabled={running || !query.trim()}><Search size={16} />Search supplier products</button>
        {running && <button type="button" className="pill" onClick={cancelSearch}><X size={16} />Cancel search</button>}
      </div>
    </form>
    {running && <p className="price-notice" role="status">Searching {country} for “{query.trim()}”… started {timestamp(run.startedAt)}.</p>}
    {run.phase === "failure" && <div className="price-notice pricing-research-failure" role="alert" data-failure-code={run.failure.code} data-failure-http={run.httpStatus ?? ""}>
      <strong>{FAILURE_LABEL[run.failure.code]} ({run.failure.code}{run.httpStatus ? `, HTTP ${run.httpStatus}` : ""})</strong>
      <p>{run.failure.message}</p>
      <p className="price-help">Request {run.failure.requestId || "not sent"} · finished {timestamp(run.failure.finishedAt)} · {run.failure.retryable ? "You may try again; nothing retries automatically." : "Retrying will not help until the cause is fixed."} Existing price books are unchanged.</p>
      <div className="price-actions"><button type="button" className="pill" disabled={!query.trim()} onClick={() => void startSearch()}>Try again</button></div>
    </div>}
    {run.phase === "result" && summary && <div className="price-review pricing-research-result" role="status" data-candidate-count={summary.count}>
      <h3>{summary.headline}</h3>
      <p className="price-help">Country {summary.country}{summary.location ? ` · ${summary.location}` : ""} · supplier filter {summary.supplier ?? "none (any supplier)"} · searched {timestamp(summary.timestamp)} · request {run.result.requestId}{run.result.providerJobId ? ` · provider job ${run.result.providerJobId}` : ""}</p>
      <p className="price-help">Nominal credit estimate {summary.nominalCreditEstimate} · reported credits {summary.creditsReported}.</p>
      {run.result.warning && <p role="status">{run.result.warning}</p>}
      {summary.count === 0 ? <p>No public supplier links were returned for this query.</p> : <ol className="pricing-research-links">{run.result.candidates.map((candidate, index) => <li key={`${index}-${candidate.url}`}>
        <a href={candidate.url} target="_blank" rel="noopener noreferrer">{candidate.title || candidate.url}</a>
        <span className="pricing-research-url">{candidate.url}</span>
        {candidate.description && <p className="price-help">{candidate.description}</p>}
      </li>)}</ol>}
      <p className="price-help">Research collects evidence links only. Open a link to read the supplier page yourself; importing a reviewed rate stays a separate, explicit price book step. No rate has changed.</p>
    </div>}
  </section>;
}
