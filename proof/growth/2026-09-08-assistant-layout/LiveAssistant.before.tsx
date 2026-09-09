import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, Bot, ChevronUp, FileSearch, Minus, PlayCircle, RefreshCw, X } from "lucide-react";
import { useStudio } from "./store";
import { useLiveAssistant } from "./liveAssistantState";
import { type MaterialAiStatus } from "./materialAiTransport";
import { inspectPlanBytes } from "./documents";
import "./liveAssistant.css";
import { LiveAssistantVoice } from "./LiveAssistantVoice";
import { assistantStatus } from "./assistant/transport";
import { callAssistantTool, getAssistantMcp, useAssistantConnection } from "./assistant/session";
import { useAssistantChat } from "./assistant/useAssistantChat";
import { ConversationView } from "./assistant/ConversationView";
import type { ChatImage } from "./assistant/conversation";



export function LiveAssistant() {
  const { open, draft, guide } = useLiveAssistant();
  const binary = useStudio(s => s.activePlanBinary);
  const sheet = useStudio(s => s.sheet);
  const hydrated = useStudio(s => s.persistenceHydrated);
  const pane = useStudio(s => s.pane);
  const jobId = useStudio(s => s.job.id);
  const chat = useAssistantChat(jobId);
  const connection = useAssistantConnection();
  const [attachments, setAttachments] = useState<ChatImage[]>([]);
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
    assistantStatus().then(value => { if (active) setStatus(value); })
      .catch(() => { if (active) setMessage("Connection status is unavailable. Open AI review to check configuration."); });
    void getAssistantMcp().catch(error => { if (active) setMessage(error instanceof Error ? error.message : "MCP connection failed."); });
    input.current?.focus();
    return () => { active = false; };
  }, [open, refresh]);
  useEffect(() => { setAttachments([]); setMessage(""); useLiveAssistant.setState({ draft: "" }); }, [jobId]);
  const collapse = () => { useLiveAssistant.setState({ open: false }); launcher.current?.focus(); };
  const capabilities = async () => {
    try { const session = await getAssistantMcp(); setMessage(`Connected to X-Ray workspace MCP. ${session.tools.length} tools: ${session.tools.map(tool => tool.name).join(", ")}. These are the tools currently available to this assistant.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "MCP connection failed."); }
  };
  const handleDraftsmanChat = async (rawInput: string) => {
    const command = rawInput.trim().toLowerCase();
    const commands: Record<string, string> = { "/draw": "play", "/draft": "play", "/pencil": "play", "/magic-pencil": "play", "/draftsman": "status", "draftsman status": "status", "pause drafting": "pause", "pause drawing": "pause", "replay drafting": "replay", "/tour": "tour" };
    const action = commands[command];
    if (!action || attachments.length) return false;
    try {
      const result = await callAssistantTool("control_draftsman", { expectedJobId: jobId, action }, new AbortController().signal);
      const output = result.content.filter(item => item.type === "text").map(item => item.text || "").join("\n");
      chat.postLocalExchange(rawInput, result.isError ? "Drawing action could not be completed. See the tool result." : "Drawing playback command completed. This animates the existing model; it does not create new geometry.", { toolName: "control_draftsman", text: output, failed: !!result.isError });
    } catch (error) {
      const output = error instanceof Error ? error.message : "Drawing playback failed.";
      chat.postLocalExchange(rawInput, output, { toolName: "control_draftsman", text: output, failed: true });
    }
    return true;
  };
  const sendMessage = async () => {
    if (chat.busy) return;
    const command = draft.trim().toLowerCase().replace(/\s+/g, " ");
    if (!command && !attachments.length) return;
    if (["/mcp", "/capabilities", "/full capabilities", "/ful capabilities", "/mcp full capabilities", "/mcp /full capabilities", "mcp /full capabilities", "mcp /ful capabilities"].includes(command)) {
      await capabilities();
      useLiveAssistant.setState({ draft: "" });
    } else {
      const handled = await handleDraftsmanChat(draft);
      if (handled) {
        useLiveAssistant.setState({ draft: "" });
        return;
      }
      setMessage("");
      const sentDraft = draft;
      try {
        const ok = await chat.send(draft.trim() || "Please inspect the attached image.", attachments);
        if (ok && useLiveAssistant.getState().draft === sentDraft) { useLiveAssistant.setState({ draft: "" }); setAttachments([]); }
      } catch (error) { setMessage(error instanceof Error ? error.message : "Assistant could not start."); }
    }
  };

  const attachImages = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      if (files.length + attachments.length > 2) throw Error("Attach up to two images per message.");
      const added: ChatImage[] = [];
      for (const file of Array.from(files)) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) throw Error("Choose PNG, JPEG or WebP images up to 3 MB each.");
        const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error("Image could not be read.")); reader.readAsDataURL(file); });
        const decoded = new Image(); decoded.src = url; await decoded.decode();
        if (decoded.naturalWidth * decoded.naturalHeight > 24000000) throw Error("Use an image of at most 24 megapixels.");
        added.push({ mimeType: file.type as ChatImage["mimeType"], data: url.split(",")[1] });
      }
      setAttachments(previous => [...previous, ...added]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Image attachment failed."); }
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
          <div className="live-assistant-identity"><strong>Live assistant</strong><span>{connection.connected ? `MCP connected · ${connection.names.length} tools` : "Connecting workspace tools…"}</span><span>{status ? status.available ? `${status.provider} ready` : status.message : "Checking AI connection…"}</span></div>
          <button type="button" className="live-assistant-icon" aria-label="Collapse live assistant" onClick={collapse}><Minus size={18} /></button>
        </header>
        <div className="live-assistant-body">
          <div className="live-assistant-context"><FileSearch size={14} aria-hidden="true" /><span>{binary ? `${binary.name} · Sheet ${sheet + 1}` : "No drawing selected"}</span></div>
          <ConversationView entries={chat.entries} busy={chat.busy} error={chat.error} />
          <LiveAssistantVoice onMessage={setMessage} reply={message || "Tell me what to look for in the drawing. Speak your instructions, review the transcript, then prepare a drawing review. Your drawing is only sent when you choose Send selected sheet to Gemini in AI review."} />
          <div className="live-assistant-suggestions" aria-label="Drawing review suggestions">
            <button type="button" onClick={capabilities}>MCP / capabilities</button>
            <button type="button" onClick={() => void handleDraftsmanChat("draw the tower")}>Magic Pencil: Draw 3D Tower</button>
            <button type="button" onClick={() => void handleDraftsmanChat("tour")}>Cinematic Tour</button>
            <button type="button" onClick={() => void handleDraftsmanChat("blueprint")}>Blueprint Sheet</button>
            <button type="button" onClick={() => void handleDraftsmanChat("draftsman status")}>Draftsman status</button>
            <button type="button" onClick={() => { useLiveAssistant.setState({ draft: "List every visible material on this sheet, with its source evidence. Flag unknown quantities and avoid counting repeated views twice." }); input.current?.focus(); }}>All materials</button>
            <button type="button" onClick={() => { useLiveAssistant.setState({ draft: "Find missing dimensions, quantities and material specifications on this sheet. Keep unsupported values unresolved." }); input.current?.focus(); }}>Missing details</button>
          </div>
          <p className="live-assistant-disclosure">Messages, attached images and requested tool results go to the configured AI provider. Web search runs when requested by the assistant. Chat history stays in this app session.</p>
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
          {!!attachments.length && <div className="assistant-attachments">{attachments.map((image, index) => <div key={index}><img src={`data:${image.mimeType};base64,${image.data}`} alt={`Pending attachment ${index + 1}`} /><button type="button" disabled={chat.busy} aria-label={`Remove attachment ${index + 1}`} onClick={() => setAttachments(previous => previous.filter((_, i) => i !== index))}>Remove</button></div>)}</div>}
          <label className="sr-only" htmlFor="live-assistant-prompt">Message live assistant</label>
          <textarea ref={input} id="live-assistant-prompt" value={draft} maxLength={1500} rows={3}
            placeholder="Ask, draw, search… or type /mcp"
            disabled={chat.busy}
            onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(); } }}
            onChange={event => useLiveAssistant.setState({ draft: event.target.value })} />
          <div className="live-assistant-compose-footer">
            <label className="assistant-attach-button">Image<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={chat.busy} aria-label="Attach images to assistant" onChange={event => { void attachImages(event.target.files); event.target.value = ""; }} /></label>
            <button type="button" onClick={chat.clear} disabled={chat.busy || !chat.entries.length}>New chat</button>
            {chat.busy ? <button type="button" onClick={chat.stop}>Stop</button> : <button type="submit" aria-label="Send assistant message" disabled={!draft.trim() && !attachments.length}><ArrowUpRight size={18} /><span>Send</span></button>}
          </div>
          {binary?.kind === "pdf" && <button type="button" className="assistant-review-link" onClick={prepareReview} disabled={!hydrated || chat.busy}>Prepare drawing review</button>}
        </form>
      </section>}
      <button ref={launcher} type="button" className="live-assistant-launcher" aria-expanded={open} aria-controls="live-assistant-panel" onClick={() => useLiveAssistant.setState({ open: !open })}>
        <Bot size={17} aria-hidden="true"/><strong>Live assistant</strong><span>Drawing tools</span><ChevronUp size={15} className={open ? "is-flipped" : ""}/>
      </button>
    </aside>
  );
}
