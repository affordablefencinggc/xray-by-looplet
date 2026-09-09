import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Bot, ChevronUp, FileSearch, Minus, PlayCircle, RefreshCw, X } from "lucide-react";
import { useStudio } from "./store";
import { useLiveAssistant } from "./liveAssistantState";
import { getMaterialAiStatus, type MaterialAiStatus } from "./materialAiTransport";
import { inspectPlanBytes } from "./documents";
import "./liveAssistant.css";
import { LiveAssistantVoice } from "./LiveAssistantVoice";

export function LiveAssistant() {
  const { open, draft, guide } = useLiveAssistant();
  const binary = useStudio(s => s.activePlanBinary);
  const sheet = useStudio(s => s.sheet);
  const hydrated = useStudio(s => s.persistenceHydrated);
  const pane = useStudio(s => s.pane);
  const [alignment, setAlignment] = useState<CSSProperties>({});
  const [status, setStatus] = useState<MaterialAiStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const workspace = launcher.current?.closest(".workspace-rails");
    if (!workspace) return;
    const rails = Array.from(workspace.querySelectorAll<HTMLElement>(".studio-right-rail, .building-inspector, .measure-inspector"));
    const measure = () => {
      const rail = rails.find(element => element.getBoundingClientRect().width > 0 && getComputedStyle(element).display !== "none");
      const rect = rail?.getBoundingClientRect();
      setAlignment(rect && rect.width >= 280 && rect.right <= innerWidth + 1
        ? { width: rect.width, right: Math.max(0, innerWidth - rect.right) } : {});
    };
    const observer = new ResizeObserver(measure);
    rails.forEach(rail => observer.observe(rail));
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [pane, open]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setStatus(null);
    getMaterialAiStatus().then(value => { if (active) setStatus(value); })
      .catch(() => { if (active) setMessage("Connection status is unavailable. Open AI review to check configuration."); });
    input.current?.focus();
    return () => { active = false; };
  }, [open, refresh]);
  const collapse = () => { useLiveAssistant.setState({ open: false }); launcher.current?.focus(); };
  const capabilities = () => {
    setMessage("MCP is not connected to this assistant. Available here: drawing-review instructions, voice transcription and the Sketch guide. The local engine defines six tools: engine_info, run_takeoff, run_takeoff_calibrated, quote_draft, marked_pdf and wireframe_scene. Assistant execution is not connected yet; no tool has been run.");
  };
  const sendMessage = () => {
    const command = draft.trim().toLowerCase().replace(/\s+/g, " ");
    if (!command) return;
    if (["/mcp", "/capabilities", "/full capabilities", "/ful capabilities", "/mcp full capabilities", "/mcp /full capabilities", "mcp /full capabilities", "mcp /ful capabilities"].includes(command)) {
      capabilities();
      useLiveAssistant.setState({ draft: "" });
    } else {
      setMessage("Chat and MCP execution are not connected yet. Your message remains below. For a PDF drawing, choose Prepare review to use these instructions in AI review.");
    }
  };
  const prepareReview = () => {
    if (!binary || binary.kind !== "pdf") { setMessage("Open a PDF drawing to prepare an AI review."); return; }
    useLiveAssistant.setState({
      open: false,
      review: { id: crypto.randomUUID(), documentId: binary.documentId, sha256: binary.sha256, page: sheet + 1, focus: draft.trim() },
    });
    useStudio.getState().setPane("components");
  };
  const practice = async () => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/examples/sketch-practice-room.svg");
      if (!response.ok) throw Error("Practice plan could not be opened.");
      const imported = await inspectPlanBytes({ name: "DEMONSTRATION - Sketch practice room.svg", bytes: new Uint8Array(await response.arrayBuffer()), source: "web", takeoff: null });
      await useStudio.getState().importPlan(imported);
      useStudio.getState().setPane("measure");
      setMessage("Practice plan opened. Enter 6 m, then pick points A and B and lock the scale.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Practice plan could not be opened."); }
    finally { setLoading(false); }
  };
  return (
    <aside className={`live-assistant ${open ? "is-open" : ""}`} style={alignment} aria-label="Live assistant">
      {open && <section className="live-assistant-panel" id="live-assistant-panel" role="region" aria-label="Drawing assistant panel"
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); collapse(); } }}>
        <header className="live-assistant-header">
          <span className="live-assistant-emblem"><Bot size={25} aria-hidden="true" /></span>
          <div className="live-assistant-identity"><strong>Live assistant</strong><span>{status ? status.configured ? `${status.provider} configured` : "Connect AI in drawing review" : "Checking connection…"}</span></div>
          <button type="button" className="live-assistant-icon" aria-label="Collapse live assistant" onClick={collapse}><Minus size={18} /></button>
        </header>
        <div className="live-assistant-body">
          <div className="live-assistant-context"><FileSearch size={14} aria-hidden="true" /><span>{binary ? `${binary.name} · Sheet ${sheet + 1}` : "No drawing selected"}</span></div>
          <LiveAssistantVoice onMessage={setMessage} reply={message || "Tell me what to look for in the drawing. Speak your instructions, review the transcript, then prepare a drawing review. Your drawing is only sent when you choose Send selected sheet to Gemini in AI review."} />
          <div className="live-assistant-suggestions" aria-label="Drawing review suggestions">
            <button type="button" onClick={capabilities}>MCP / capabilities</button>
            <button type="button" onClick={() => { useLiveAssistant.setState({ draft: "List every visible material on this sheet, with its source evidence. Flag unknown quantities and avoid counting repeated views twice." }); input.current?.focus(); }}>All materials</button>
            <button type="button" onClick={() => { useLiveAssistant.setState({ draft: "Find missing dimensions, quantities and material specifications on this sheet. Keep unsupported values unresolved." }); input.current?.focus(); }}>Missing details</button>
          </div>
          <p className="live-assistant-disclosure">Opens AI review with these instructions. The drawing is sent only when you press “Send selected sheet to Gemini” there.</p>
          {guide && <section className="live-assistant-guide" aria-label="Sketch walkthrough">
            <div><strong>Your first Sketch</strong><button type="button" className="live-assistant-icon" aria-label="Close Sketch guide" onClick={() => useLiveAssistant.setState({ guide: false })}><X size={15}/></button></div>
            <ol><li><b>Open the practice plan.</b> A labelled 6 × 4 m room.</li><li><b>Measure → Known distance: 6 m.</b> Pick A and B, then Lock scale.</li><li><b>Sketch → Manual layer.</b> Click A → B → C → D → A.</li><li><b>Commit trace.</b> The outline saves as an annotation. Esc cancels unfinished points.</li></ol>
            <button type="button" className="live-assistant-practice" disabled={loading || !hydrated} onClick={practice}>{loading ? "Opening practice plan…" : "Open practice plan"}<ArrowUpRight size={15}/></button>
            <p>Demonstration data. Sketch annotations do not create walls, quantities or a 3D model.</p>
          </section>}
          {message && <p className="live-assistant-message" role="status">{message}</p>}
        </div>
        <footer className="live-assistant-footer"><button type="button" onClick={() => useLiveAssistant.setState({ guide: !guide })} aria-expanded={guide}><PlayCircle size={16}/>Sketch guide</button><span>{status?.configured ? status.model : "Drawing workspace"}</span><button type="button" className="live-assistant-icon" aria-label="Refresh assistant connection" onClick={() => { setMessage(""); setRefresh(v => v + 1); }}><RefreshCw size={15}/></button></footer>
        <form className="live-assistant-composer" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
          <label className="sr-only" htmlFor="live-assistant-prompt">Message live assistant</label>
          <textarea ref={input} id="live-assistant-prompt" value={draft} maxLength={1500} rows={3}
            placeholder="Message or type /mcp for capabilities"
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(); } }}
            onChange={event => useLiveAssistant.setState({ draft: event.target.value })} />
          <div className="live-assistant-compose-footer">
            <button type="button" onClick={prepareReview} disabled={!hydrated || binary?.kind !== "pdf"}>Prepare review</button>
            <button type="submit" aria-label="Send assistant message" disabled={!draft.trim()}><ArrowUpRight size={18} /><span>Send</span></button>
          </div>
        </form>
      </section>}
      <button ref={launcher} type="button" className="live-assistant-launcher" aria-expanded={open} aria-controls="live-assistant-panel" onClick={() => useLiveAssistant.setState({ open: !open })}>
        <Bot size={17} aria-hidden="true"/><strong>Live assistant</strong><span>Drawing tools</span><ChevronUp size={15} className={open ? "is-flipped" : ""}/>
      </button>
    </aside>
  );
}
