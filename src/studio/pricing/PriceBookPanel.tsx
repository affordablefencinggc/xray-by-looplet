import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Download, FileUp, Plus, RefreshCw } from "lucide-react";
import { addPricedLine, appendPriceBookRevision, editPriceBook, parsePriceCsv, previewPriceRows, priceBookError,
  priceCsvTemplate, priceImportSchema, priceLineAmount, priceRevisionCsv, pricedWorksheetCsv, pricedWorksheetTotals, readBrowserPriceBooks, removePricedLine,
  resolvePricedLine, savePriceBooks, suggestPriceMapping, PRICE_CSV_LIMIT,
  type CsvTable, type PriceBook, type PriceBookLibrary, type PriceBookSession, type PriceImport, type PriceMapping } from "./priceBooks.ts";
import "./priceBooks.css";
import { workbookPriceTable, type PriceWorkbook } from "./priceWorkbookTable.ts";
import { readPriceWorkbookInWorker } from "./priceWorkbookClient.ts";

type SourceFile = { fileName: string; sizeBytes: number; sha256: string } & ({ kind: "csv"; text: string } | { kind: "xlsx"; workbook: PriceWorkbook });
type RateSelection = { bookId: string; revision: number; sourceLine: number };
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const taxLabel = (basis: string) => basis === "inclusive" ? "tax included" : basis === "exclusive" ? "tax excluded" : "tax unspecified";

/** Project-local supplier imports and explicitly priced worksheet. Existing takeoff and quote rates are untouched. */
export function PriceBookPanel({ jobId }: { jobId: string }) {
  const [session, setSession] = useState<PriceBookSession | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"library" | "import" | "worksheet">("library"), [archived, setArchived] = useState(false), [search, setSearch] = useState("");
  const [file, setFile] = useState<SourceFile | null>(null), [delimiter, setDelimiter] = useState<"," | ";" | "\t">(","), [mapping, setMapping] = useState<PriceMapping | null>(null);
  const [worksheet, setWorksheet] = useState(""), [headerRow, setHeaderRow] = useState(1), [readingWorkbook, setReadingWorkbook] = useState(false);
  const [name, setName] = useState(""), [targetId, setTargetId] = useState(""), [supplier, setSupplier] = useState(""), [currency, setCurrency] = useState("AUD"), [decimals, setDecimals] = useState(2);
  const [tax, setTax] = useState<"inclusive" | "exclusive" | "unspecified">("unspecified"), [taxPercent, setTaxPercent] = useState(""), [effectiveDate, setEffectiveDate] = useState(""), [sourceReference, setSourceReference] = useState("");
  const [review, setReview] = useState<PriceImport | null>(null), [selection, setSelection] = useState<RateSelection | null>(null), [quantity, setQuantity] = useState("");
  const input = useRef<HTMLInputElement>(null), generation = useRef(0), currentJob = useRef(jobId); currentJob.current = jobId;
  const workbookRead = useRef<AbortController | null>(null);
  useEffect(() => {
    generation.current++; workbookRead.current?.abort(); setBusy(false); setReadingWorkbook(false); setSession(readBrowserPriceBooks(jobId)); setFile(null); setMapping(null); setReview(null); setSelection(null); setNotice(""); setTargetId(""); setTab("library");
    return () => { generation.current++; workbookRead.current?.abort(); };
  }, [jobId]);
  const value = session?.value.jobId === jobId ? session.value : null;
  const selectedSheet = file?.kind === "xlsx" ? file.workbook.sheets.find(sheet => sheet.name === worksheet) : null;
  const { table, parseError } = useMemo((): { table: CsvTable | null; parseError: string } => {
    try { return { table: file?.kind === "csv" ? parsePriceCsv(file.text, delimiter, headerRow) : selectedSheet ? workbookPriceTable(selectedSheet, headerRow) : null, parseError: "" }; }
    catch (error) { return { table: null, parseError: priceBookError(error) }; }
  }, [file, delimiter, headerRow, selectedSheet]);
  function changeSource(next: { worksheet?: string; headerRow?: number; delimiter?: typeof delimiter }) {
    const selectedWorksheet = next.worksheet ?? worksheet, selectedHeader = next.headerRow ?? headerRow, separator = next.delimiter ?? delimiter;
    setWorksheet(selectedWorksheet); setHeaderRow(selectedHeader); setDelimiter(separator); setReview(null);
    try {
      const sheet = file?.kind === "xlsx" ? file.workbook.sheets.find(item => item.name === selectedWorksheet) : null;
      const updated = file?.kind === "csv" ? parsePriceCsv(file.text, separator, selectedHeader) : sheet ? workbookPriceTable(sheet, selectedHeader) : null;
      setMapping(updated ? suggestPriceMapping(updated.headers) : null);
    } catch { setMapping(null); }
  }
  const rows = table && mapping ? previewPriceRows(table, mapping) : null;
  const book = value?.books.find(b => b.id === selection?.bookId), revision = book?.revisions.find(r => r.revision === selection?.revision), rate = revision?.rows.find(r => r.sourceLine === selection?.sourceLine);
  let amount = "", quantityError = "";
  if (rate && revision && quantity) try { amount = priceLineAmount(rate.rate, quantity, revision.metadata.amountDecimals); } catch (error) { quantityError = priceBookError(error); }
  async function save(next: PriceBookLibrary, message: string) {
    if (!session || busy) return false;
    const savingJob = jobId;
    setBusy(true); setNotice("");
    try { const saved = await savePriceBooks(session, next); if (currentJob.current === savingJob) { setSession(saved); setNotice(message); } return true; }
    catch (error) { if (currentJob.current === savingJob) setNotice(priceBookError(error)); return false; }
    finally { setBusy(false); }
  }
  async function chooseFile(candidate: File | undefined) {
    if (!candidate) return;
    const ticket = ++generation.current; setBusy(true); setNotice(""); setReview(null); setFile(null); setMapping(null);
    try {
      if (!candidate.size || candidate.size > PRICE_CSV_LIMIT) throw Error("Choose a non-empty CSV or XLSX file up to 2 MB.");
      if (!/\.(csv|tsv|xlsx)$/i.test(candidate.name)) throw Error("Choose a CSV, TSV or XLSX file. Legacy XLS, XLSM and password-protected workbooks are not supported.");
      const bytes = await candidate.arrayBuffer();
      const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
      if (ticket !== generation.current) return;
      const common = { fileName: candidate.name, sizeBytes: candidate.size, sha256 };
      setName(candidate.name.replace(/\.(csv|tsv|xlsx)$/i, "").slice(0, 120)); setWorksheet(""); setHeaderRow(1);
      if (/\.xlsx$/i.test(candidate.name)) {
        const controller = new AbortController(); workbookRead.current?.abort(); workbookRead.current = controller; setReadingWorkbook(true);
        const workbook = await readPriceWorkbookInWorker(bytes, controller.signal);
        if (ticket === generation.current) setFile({ ...common, kind: "xlsx", workbook });
      } else {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes), separator = /\.tsv$/i.test(candidate.name) ? "\t" : delimiter;
        setDelimiter(separator); setFile({ ...common, kind: "csv", text });
        try { const parsed = parsePriceCsv(text, separator); setHeaderRow(parsed.headerLine ?? 1); setMapping(suggestPriceMapping(parsed.headers)); } catch { /* Header row/separator can be corrected in the preview. */ }
      }
    } catch (error) { if (ticket === generation.current) setNotice(priceBookError(error)); }
    finally { if (ticket === generation.current) { setBusy(false); setReadingWorkbook(false); } }
  }
  function prepareReview() {
    try {
      if (!file || !table || !mapping || !rows || rows.errors.length) throw Error("Resolve the sheet and row errors before review.");
      if (!targetId && !name.trim()) throw Error("Name this price book.");
      if (taxPercent && !/^\d{1,3}(?:\.\d{1,6})?$/.test(taxPercent)) throw Error("Tax percent must be a decimal from 0 to 100.");
      setReview(priceImportSchema.parse({ metadata: { supplier, currency, amountDecimals: decimals, taxBasis: tax,
        taxPercent: tax === "unspecified" || !taxPercent ? null : Number(taxPercent), effectiveDate, sourceReference },
        source: { fileName: file.fileName, sha256: file.sha256, sizeBytes: file.sizeBytes, kind: file.kind, headerRow,
          ...(file.kind === "xlsx" ? { worksheet } : { delimiter }), headers: table.headers, mapping }, rows: rows.rows }));
      setNotice("");
    } catch (error) { setNotice(priceBookError(error)); }
  }
  function useRate(b: PriceBook, rev: number, sourceLine: number) { setSelection({ bookId: b.id, revision: rev, sourceLine }); setQuantity(""); setTab("worksheet"); setNotice(""); }
  const disabled = busy || !value || session?.blocked;
  return <section className="price-books" aria-label="Project price books" data-price-import-state={readingWorkbook ? "loading" : review ? "review" : file ? parseError || rows?.errors.length ? "invalid" : table && mapping ? "ready" : "choose-sheet" : "idle"} data-price-import-rows={rows?.rows.length ?? 0}>
    <header><div><h2>Price books</h2><p>Import supplier sheets, preserve revisions and apply chosen rates to a priced worksheet.</p></div>
      <button className="pill" disabled={busy} onClick={() => { setSession(readBrowserPriceBooks(jobId)); setReview(null); setNotice("Library reloaded."); }}><RefreshCw size={16} />Reload library</button></header>
    <div className="price-tabs" role="group" aria-label="Price book views">
      <button className="pill" aria-pressed={tab === "library"} onClick={() => setTab("library")}>Library ({value?.books.length ?? 0})</button>
      <button className="pill" aria-pressed={tab === "import"} onClick={() => setTab("import")}><FileUp size={16} />Import price sheet</button>
      <button className="pill" aria-pressed={tab === "worksheet"} onClick={() => setTab("worksheet")}>Priced worksheet ({value?.worksheet.length ?? 0})</button>
    </div>
    {session?.error && <p className="price-notice" role="alert">{session.error}</p>}
    {notice && <p className="price-notice" role="status">{notice}</p>}
    <p className="price-help">Saved with this project on this device. Your existing reference sheet remains available in Settings. Worksheet quantities are entered by you; takeoff quantities and quotes are separate.</p>
    {tab === "import" && <>
      <div className="price-actions"><button className="pill" disabled={disabled} onClick={() => input.current?.click()}><FileUp size={16} />Choose CSV or Excel workbook</button>
        <button className="pill" onClick={() => download(priceCsvTemplate(), "price-book-template.csv")}><Download size={16} />CSV template</button></div>
      <input ref={input} hidden type="file" accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Supplier price file" onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ""; }} />
      <p className="price-help">CSV/TSV or XLSX, up to 2 MB / 5,000 rates. Select one worksheet and its header row. Formulas are never calculated; mapped formula cells must be replaced with reviewed values. Rates use decimal points and up to 6 decimal places, without currency symbols or thousands separators.</p>
      {readingWorkbook && <div className="price-notice" role="status"><p>Reading workbook worksheets…</p><button className="pill" onClick={() => { generation.current++; workbookRead.current?.abort(); setReadingWorkbook(false); setBusy(false); setNotice("Workbook import cancelled. Saved price books are unchanged."); }}>Cancel workbook reading</button></div>}
      {file && <>
        <p><strong>{file.fileName}</strong> · {file.sizeBytes.toLocaleString()} bytes</p>
        {!review && <div className="price-fields">
          {file.kind === "csv" ? <label>Separator<select aria-label="Price file separator" value={delimiter} onChange={e => changeSource({ delimiter: e.target.value as typeof delimiter })}><option value=",">Comma</option><option value=";">Semicolon</option><option value={"\t"}>Tab</option></select></label> : <label>Workbook worksheet<select aria-label="Workbook worksheet" value={worksheet} onChange={e => changeSource({ worksheet: e.target.value, headerRow: 1 })}><option value="">Choose a worksheet</option>{file.workbook.sheets.map(sheet => <option key={sheet.name} value={sheet.name}>{sheet.name}{sheet.issue ? " (needs a smaller table)" : ""}</option>)}</select></label>}
          <label>Header row<input aria-label="Price header row" type="number" min={1} max={100} value={headerRow || ""} onChange={e => changeSource({ headerRow: Number(e.target.value) })} /></label>
          <label>Save as<select value={targetId} onChange={e => setTargetId(e.target.value)}><option value="">New price book</option>{value?.books.filter(b => !b.archived).map(b => <option key={b.id} value={b.id}>New revision of {b.name}</option>)}</select></label>
          {!targetId && <label>Price book name<input maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>}
          <label>Supplier<input maxLength={200} value={supplier} onChange={e => setSupplier(e.target.value)} /></label>
          <label>Currency code<input maxLength={3} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} /></label>
          <label>Amount decimal places<select value={decimals} onChange={e => setDecimals(Number(e.target.value))}>{[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Tax basis<select value={tax} onChange={e => setTax(e.target.value as typeof tax)}><option value="unspecified">Unspecified</option><option value="exclusive">Tax excluded</option><option value="inclusive">Tax included</option></select></label>
          {tax !== "unspecified" && <label>Tax percent (optional)<input inputMode="decimal" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} placeholder="Leave blank if unknown" /></label>}
          <label>Effective date<input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} /></label>
          <label className="price-wide">Source reference<input maxLength={2000} value={sourceReference} onChange={e => setSourceReference(e.target.value)} placeholder="Supplier quote number, catalogue or source URL" /></label>
        </div>}
        {!review && selectedSheet && <details className="price-source-preview" open><summary>Worksheet preview — first 8 populated rows</summary><p className="price-help">Use the row numbers to choose your headings. {selectedSheet.formulaCells} formula cells detected in this sheet. Formula values are not read or calculated.</p><div className="price-table-wrap"><table><thead><tr><th>Row</th>{Array.from({ length: Math.min(8, selectedSheet.rows[0]?.cells.length ?? 0) }, (_, i) => <th key={i}>{String.fromCharCode(65 + i)}</th>)}</tr></thead><tbody>{selectedSheet.rows.slice(0, 8).map(row => <tr key={row.line}><th>{row.line}</th>{row.cells.slice(0, 8).map((cell, i) => <td key={i}>{row.cellErrors?.[i] ? <span title={row.cellErrors[i]}>Needs review</span> : cell}</td>)}</tr>)}</tbody></table></div></details>}
        {parseError && <p role="alert">{parseError}</p>}
        {!review && table && mapping && <fieldset><legend>Match your columns</legend><div className="price-fields">{(["stockCode", "description", "unit", "rate"] as const).map(field => <label key={field}>{({ stockCode: "Stock code (optional)", description: "Description", unit: "Unit", rate: "Rate" })[field]}<select value={mapping[field] ?? -1} onChange={e => setMapping({ ...mapping, [field]: Number(e.target.value) < 0 ? null : Number(e.target.value) })}>{field === "stockCode" && <option value={-1}>No stock code</option>}{table.headers.map((header, i) => <option key={i} value={i}>{i + 1}: {header || "Unnamed column"}</option>)}</select></label>)}</div></fieldset>}
        {!!rows?.errors.length && <div className="price-notice" role="alert"><strong>Import blocked until these lines are corrected</strong><ul>{rows.errors.map((error, i) => <li key={i}>{error}</li>)}</ul><p>No rates have been saved.</p></div>}
        {rows && !rows.errors.length && <><p>{rows.rows.length} valid rates · previewing the first {Math.min(20, rows.rows.length)}</p><div className="price-table-wrap"><table><thead><tr><th>Source line</th><th>Stock code</th><th>Description</th><th>Unit</th><th>Rate</th></tr></thead><tbody>{rows.rows.slice(0, 20).map(row => <tr key={row.sourceLine}><td>{row.sourceLine}</td><td>{row.stockCode || "—"}</td><td>{row.description}</td><td className="price-scalar">{row.unit}</td><td className="price-scalar">{row.rate}</td></tr>)}</tbody></table></div></>}
        {review ? <div className="price-review"><h3>Review before saving</h3><p>{targetId ? `Append revision to ${value?.books.find(b => b.id === targetId)?.name}` : `Create ${name}`} · {review.rows.length} rates</p>
          <p>{review.metadata.supplier} · {review.metadata.currency} · {taxLabel(review.metadata.taxBasis)}{review.metadata.taxPercent !== null ? ` (${review.metadata.taxPercent}%)` : ""} · effective {review.metadata.effectiveDate}</p>
          <p>{review.metadata.sourceReference}</p><p className="price-help">{review.source.kind === "xlsx" ? `Worksheet: ${review.source.worksheet} · ` : ""}Header row: {review.source.headerRow ?? 1}. Existing revisions and priced lines remain unchanged. Saving the book does not apply any rate.</p>
          <div className="price-actions"><button className="pill primary" disabled={disabled} onClick={() => { if (value) { try { const next = appendPriceBookRevision(value, review, name, targetId || null); void save(next, "Price book revision saved. Choose a rate in the library to price a line.").then(ok => { if (ok) { setReview(null); setFile(null); setTab("library"); } }); } catch (error) { setNotice(priceBookError(error)); } } }}>Save reviewed price book</button><button className="pill" disabled={busy} onClick={() => setReview(null)}>Back to mapping</button></div>
        </div> : <button className="pill primary" disabled={disabled || !rows || !!rows.errors.length || !!parseError} onClick={prepareReview}>Review import</button>}
      </>}
    </>}
    {tab === "library" && <>
      <div className="price-toolbar"><label>Find a price book<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or supplier" /></label><button className="pill" aria-pressed={archived} onClick={() => setArchived(!archived)}><Archive size={16} />{archived ? "Show active" : "Show archived"}</button></div>
      {!value?.books.some(b => b.archived === archived) && <div className="price-empty"><h3>{archived ? "No archived price books" : "Keep supplier pricing in one place"}</h3><p>Import a supplier sheet, check its columns and source, then save a named revision. Every applied line keeps the rate version you chose.</p></div>}
      {value?.books.filter(b => b.archived === archived && `${b.name} ${b.revisions.at(-1)?.metadata.supplier}`.toLowerCase().includes(search.toLowerCase())).map(b => <BookCard key={b.id} book={b} disabled={!!disabled} onUse={(rev, line) => useRate(b, rev, line)} onSaveName={nextName => { try { void save(editPriceBook(value, b.id, { name: nextName }), "Price book renamed."); } catch (error) { setNotice(priceBookError(error)); } }} onArchive={() => { try { void save(editPriceBook(value, b.id, { archived: !b.archived }), b.archived ? "Price book restored." : "Price book archived. Applied lines are preserved."); } catch (error) { setNotice(priceBookError(error)); } }} />)}
    </>}
    {tab === "worksheet" && <>
      <p className="price-help">Apply a saved rate by entering its quantity in the stated unit. Amounts use your selected decimal precision and half-up rounding. No tax, freight, waste, markup or currency conversion is added.</p>
      {!!value?.worksheet.length && <><button className="pill" onClick={() => download(pricedWorksheetCsv(value), "project-priced-worksheet.csv")}><Download size={16} />Export priced worksheet CSV</button><div className="price-review"><h3>Worksheet subtotals</h3>{pricedWorksheetTotals(value).map((total, i) => <p key={i}><strong>{total.currency} {total.amount}</strong> · {taxLabel(total.taxBasis)}{total.taxPercent !== null ? ` (${total.taxPercent}%)` : ""} · {total.count} lines</p>)}<p className="price-help">Subtotals sum rounded line amounts. Different currencies, tax bases and amount precisions stay separate.</p></div></>}
      {rate && revision && book && <div className="price-review"><h3>Review priced line</h3><p><strong>{rate.description}</strong> · {rate.stockCode || "No stock code"}</p><p>{rate.rate} {revision.metadata.currency} / {rate.unit} · {taxLabel(revision.metadata.taxBasis)} · {book.name} revision {revision.revision}</p>
        {book.revisions.length > revision.revision && <p>A newer revision exists. This line will use the older revision you selected.</p>}
        <label>Quantity ({rate.unit})<input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>{quantityError && <p role="alert">{quantityError}</p>}
        {amount && <p className="price-amount">Line amount: {revision.metadata.currency} {amount} · {taxLabel(revision.metadata.taxBasis)}</p>}
        <div className="price-actions"><button className="pill primary" disabled={disabled || !amount} onClick={() => { if (value && selection) { try { void save(addPricedLine(value, selection.bookId, selection.revision, selection.sourceLine, quantity), "Reviewed rate applied to the priced worksheet.").then(ok => { if (ok) setSelection(null); }); } catch (error) { setNotice(priceBookError(error)); } } }}><Plus size={16} />Add reviewed priced line</button><button className="pill" onClick={() => setSelection(null)}>Cancel line</button></div>
      </div>}
      {!value?.worksheet.length && <div className="price-empty"><h3>No priced lines yet</h3><p>Open a price book in the library and choose Use rate. You will review the quantity and amount before adding it.</p><button className="pill" onClick={() => setTab("library")}>Browse price books</button></div>}
      {value?.worksheet.map(line => { const resolved = resolvePricedLine(value, line); return <article className="price-book-card" key={line.id}><h3>{resolved.row.description}</h3><p>{line.quantity} {resolved.row.unit} × {resolved.row.rate} = <strong>{resolved.revision.metadata.currency} {resolved.amount}</strong> · {taxLabel(resolved.revision.metadata.taxBasis)}</p><p className="price-help">{resolved.book.name} · revision {line.bookRevision} · source line {line.sourceLine} · {resolved.revision.metadata.supplier} · effective {resolved.revision.metadata.effectiveDate}</p><p className="price-help">{resolved.revision.metadata.sourceReference}</p>{resolved.outdated && <p>Newer pricing is available. This applied line retains its original rate.</p>}<details><summary>Remove this priced line</summary><p>This removes the worksheet line. The source price book remains.</p><button className="pill" disabled={disabled} onClick={() => { try { void save(removePricedLine(value, line.id), "Priced line removed; source rates preserved."); } catch (error) { setNotice(priceBookError(error)); } }}>Confirm remove priced line</button></details></article>; })}
    </>}
  </section>;
}

function BookCard({ book, disabled, onUse, onSaveName, onArchive }: { book: PriceBook; disabled: boolean; onUse: (revision: number, line: number) => void; onSaveName: (name: string) => void; onArchive: () => void }) {
  const [revisionNumber, setRevisionNumber] = useState(book.revisions.length), [query, setQuery] = useState(""), [draftName, setDraftName] = useState(book.name);
  const revision = book.revisions.find(r => r.revision === revisionNumber) ?? book.revisions.at(-1)!;
  const matches = revision.rows.filter(r => `${r.stockCode} ${r.description} ${r.unit}`.toLowerCase().includes(query.toLowerCase()));
  return <article className="price-book-card"><h3>{book.name}</h3><p>{revision.metadata.supplier} · {revision.metadata.currency} · {taxLabel(revision.metadata.taxBasis)} · effective {revision.metadata.effectiveDate}</p><p className="price-help">{revision.metadata.sourceReference}</p>
    <div className="price-actions"><label>Price book revision<select value={revision.revision} onChange={e => setRevisionNumber(Number(e.target.value))}>{[...book.revisions].reverse().map(r => <option key={r.revision} value={r.revision}>Revision {r.revision} · {r.metadata.effectiveDate}</option>)}</select></label><button className="pill" onClick={() => download(priceRevisionCsv(book, revision.revision), `${book.name.replace(/[^a-z0-9_-]/gi, "-")}-r${revision.revision}.csv`)}><Download size={16} />Export revision CSV</button><button className="pill" disabled={disabled} onClick={onArchive}>{book.archived ? "Restore price book" : "Archive price book"}</button></div>
    <details><summary>Rename price book</summary><div className="price-toolbar"><label>New price book name<input maxLength={120} value={draftName} onChange={e => setDraftName(e.target.value)} /></label><button className="pill" disabled={disabled || !draftName.trim()} onClick={() => onSaveName(draftName)}>Save name</button></div></details>
    <details><summary>Browse {revision.rows.length} rates and source details</summary><p className="price-help">{revision.source.fileName}{revision.source.kind === "xlsx" ? ` · worksheet ${revision.source.worksheet}` : ""} · header row {revision.source.headerRow ?? 1} · imported {new Date(revision.importedAt).toLocaleString()} · SHA-256 {revision.source.sha256}</p><label>Find a rate<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Description, stock code or unit" /></label>
      <p className="price-help">{matches.length} matches · showing up to 50</p><div className="price-table-wrap"><table><thead><tr><th>Description</th><th>Code</th><th>Unit</th><th>Rate</th><th>Action</th></tr></thead><tbody>{matches.slice(0, 50).map(row => <tr key={row.sourceLine}><td>{row.description}</td><td>{row.stockCode || "—"}</td><td>{row.unit}</td><td>{row.rate}</td><td><button className="pill" disabled={disabled || book.archived} onClick={() => onUse(revision.revision, row.sourceLine)}>Use rate</button></td></tr>)}</tbody></table></div>
    </details>
  </article>;
}
