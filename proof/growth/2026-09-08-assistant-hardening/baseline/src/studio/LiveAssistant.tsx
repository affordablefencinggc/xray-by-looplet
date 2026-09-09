import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  ChevronUp,
  FileSearch,
  Minus,
  PlayCircle,
  RefreshCw,
  X,
  Plus,
  ImagePlus,
  Sparkles,
  CircleHelp,
  MessageSquarePlus,
  Settings2,
  Grip,
  Maximize2,
  Images,
  Mic,
} from "lucide-react";
import { useStudio } from "./store";
import { useLiveAssistant } from "./liveAssistantState";
import { type MaterialAiStatus } from "./materialAiTransport";
import { inspectPlanBytes } from "./documents";
import "./assistantPanel.css";
import { LiveAssistantVoice } from "./LiveAssistantVoice";
import { assistantStatus } from "./assistant/transport";
import { callAssistantTool, getAssistantMcp, useAssistantConnection } from "./assistant/session";
import { useAssistantChat } from "./assistant/useAssistantChat";
import { ConversationView } from "./assistant/ConversationView";
import { useAssistantPanel } from "./assistant/useAssistantPanel";
import {
  BUILDING_STYLES,
  REFERENCE_KINDS,
  referenceMessage,
  validateReferenceFile,
  type ReferenceImage,
  type ReferenceKind,
} from "./assistant/referenceImages";

export function LiveAssistant() {
  const { open, draft, guide } = useLiveAssistant();
  const binary = useStudio((s) => s.activePlanBinary);
  const sheet = useStudio((s) => s.sheet);
  const hydrated = useStudio((s) => s.persistenceHydrated);
  const jobId = useStudio((s) => s.job.id);
  const chat = useAssistantChat(jobId);
  const connection = useAssistantConnection();
  const [attachments, setAttachments] = useState<ReferenceImage[]>([]);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState<"skills" | "references" | "help" | "settings" | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [readingImages, setReadingImages] = useState(false);
  const panel = useAssistantPanel();
  const [status, setStatus] = useState<MaterialAiStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    uploadKind = useRef<ReferenceKind>("Reference"),
    uploadLibrary = useRef(false),
    uploadLock = useRef(false),
    projectRef = useRef(jobId);
  projectRef.current = jobId;
  const body = useRef<HTMLDivElement>(null),
    followMessages = useRef(true),
    menuRoot = useRef<HTMLDivElement>(null),
    plusButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
      if (!menuRoot.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menu]);
  useEffect(() => {
    if (body.current && followMessages.current && !drawer)
      body.current.scrollTop = body.current.scrollHeight;
  }, [chat.entries, chat.busy, message, drawer]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setStatus(null);
    assistantStatus()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch(() => {
        if (active)
          setMessage("Connection status is unavailable. Open AI review to check configuration.");
      });
    void getAssistantMcp().catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "MCP connection failed.");
    });
    input.current?.focus();
    return () => {
      active = false;
    };
  }, [open, refresh]);
  useEffect(() => {
    setAttachments([]);
    setReferences([]);
    setMenu(false);
    setDrawer(null);
    setDragOver(false);
    setMessage("");
    useLiveAssistant.setState({ draft: "" });
  }, [jobId]);
  const collapse = () => {
    setMenu(false);
    useLiveAssistant.setState({ open: false });
    launcher.current?.focus();
  };
  const capabilities = async () => {
    try {
      const session = await getAssistantMcp();
      setMessage(
        `Connected to X-Ray workspace MCP. ${session.tools.length} tools: ${session.tools.map((tool) => tool.name).join(", ")}. These are the tools currently available to this assistant.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MCP connection failed.");
    }
  };
  const handleDraftsmanChat = async (rawInput: string) => {
    const command = rawInput.trim().toLowerCase();
    const commands: Record<string, string> = {
      "/draw": "play",
      "/draft": "play",
      "/pencil": "play",
      "/magic-pencil": "play",
      "/draftsman": "status",
      "draftsman status": "status",
      "pause drafting": "pause",
      "pause drawing": "pause",
      "replay drafting": "replay",
      "/tour": "tour",
      tour: "tour",
      "draw the tower": "play",
    };
    const action = commands[command];
    if (!action || attachments.length) return false;
    try {
      const result = await callAssistantTool(
        "control_draftsman",
        { expectedJobId: jobId, action },
        new AbortController().signal,
      );
      const output = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text || "")
        .join("\n");
      chat.postLocalExchange(
        rawInput,
        result.isError
          ? "Drawing action could not be completed. See the tool result."
          : "Drawing playback command completed. This animates the existing model; it does not create new geometry.",
        { toolName: "control_draftsman", text: output, failed: !!result.isError },
      );
    } catch (error) {
      const output = error instanceof Error ? error.message : "Drawing playback failed.";
      chat.postLocalExchange(rawInput, output, {
        toolName: "control_draftsman",
        text: output,
        failed: true,
      });
    }
    return true;
  };
  const sendMessage = async () => {
    if (chat.busy || readingImages) return;
    followMessages.current = true;
    setDrawer(null);
    setMenu(false);
    const command = draft.trim().toLowerCase().replace(/\s+/g, " ");
    if (!command && !attachments.length) return;
    if (
      !attachments.length &&
      [
        "/mcp",
        "/capabilities",
        "/full capabilities",
        "/ful capabilities",
        "/mcp full capabilities",
        "/mcp /full capabilities",
        "mcp /full capabilities",
        "mcp /ful capabilities",
      ].includes(command)
    ) {
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
        const ok = await chat.send(
          attachments.length ? referenceMessage(draft, attachments) : draft.trim(),
          attachments.map(({ mimeType, data }) => ({ mimeType, data })),
        );
        if (ok && useLiveAssistant.getState().draft === sentDraft) {
          useLiveAssistant.setState({ draft: "" });
          setAttachments([]);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Assistant could not start.");
      }
    }
  };

  const attachImages = async (
    files: FileList | File[] | null,
    kind: ReferenceKind = "Reference",
    libraryOnly = false,
  ) => {
    if (!files?.length) return;
    if (uploadLock.current || chat.busy) {
      setMessage("Wait for the current upload or response, or stop the assistant first.");
      return;
    }
    uploadLock.current = true;
    setReadingImages(true);
    const project = jobId;
    try {
      if (!libraryOnly && files.length + attachments.length > 2)
        throw Error(
          "Attach up to two images per message. Keep additional inspiration in References.",
        );
      if (files.length + references.length > 12)
        throw Error(
          "Keep up to twelve reference images per project in this session. Remove a reference to add another.",
        );
      const added: ReferenceImage[] = [];
      for (const file of Array.from(files)) {
        validateReferenceFile(file);
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(Error("Image could not be read."));
          reader.readAsDataURL(file);
        });
        const decoded = new Image();
        decoded.src = url;
        await decoded.decode();
        if (decoded.naturalWidth * decoded.naturalHeight > 24000000)
          throw Error("Use an image of at most 24 megapixels.");
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          kind,
          mimeType: file.type as ReferenceImage["mimeType"],
          data: url.split(",")[1],
        });
      }
      if (projectRef.current !== project) return;
      setReferences((previous) => [...previous, ...added]);
      if (!libraryOnly) setAttachments((previous) => [...previous, ...added]);
      setMessage(
        libraryOnly
          ? "Added to References. Choose Use in message when ready."
          : "Images attached. Review them before sending.",
      );
    } catch (error) {
      if (projectRef.current === project)
        setMessage(error instanceof Error ? error.message : "Image attachment failed.");
    } finally {
      uploadLock.current = false;
      setReadingImages(false);
    }
  };
  const chooseImages = (kind: ReferenceKind = "Reference", libraryOnly = false) => {
    uploadKind.current = kind;
    uploadLibrary.current = libraryOnly;
    setMenu(false);
    fileInput.current?.click();
  };
  const openDrawer = (value: typeof drawer) => {
    setDrawer(value);
    setMenu(false);
    followMessages.current = true;
  };
  const usePrompt = (text: string) => {
    useLiveAssistant.setState({ draft: text });
    setDrawer(null);
    setMenu(false);
    input.current?.focus();
  };
  const newChat = () => {
    if (chat.busy || readingImages) return;
    chat.clear();
    setAttachments([]);
    setMessage("");
    setMenu(false);
    setDrawer(null);
    useLiveAssistant.setState({ draft: "", guide: false });
    input.current?.focus();
  };
  const prepareReview = () => {
    if (!binary || binary.kind !== "pdf") {
      setMessage("Open a PDF drawing to prepare an AI review.");
      return;
    }
    useLiveAssistant.setState({
      open: false,
      review: {
        id: crypto.randomUUID(),
        documentId: binary.documentId,
        sha256: binary.sha256,
        page: sheet + 1,
        focus: draft.trim(),
      },
    });
    useStudio.getState().setPane("components");
  };
  const practice = async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/examples/sketch-practice-room.svg");
      if (!response.ok) throw Error("Practice plan could not be opened.");
      const imported = await inspectPlanBytes({
        name: "DEMONSTRATION - Sketch practice room.svg",
        bytes: new Uint8Array(await response.arrayBuffer()),
        source: "web",
        takeoff: null,
      });
      await useStudio.getState().importPlan(imported);
      useStudio.getState().setPane("measure");
      setMessage("Practice plan opened. Enter 6 m, then pick points A and B and lock the scale.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Practice plan could not be opened.");
    } finally {
      setLoading(false);
    }
  };
  if (!panel.rect) return null;
  const rect = panel.rect;
  const statusLabel = chat.busy
    ? "Working"
    : status?.available
      ? connection.connected
        ? "Connected"
        : "Connecting tools"
      : status
        ? "Connection needed"
        : "Connecting";
  const skills = [
    {
      name: "Draft existing model",
      detail: "Animate the model with Magic Pencil.",
      prompt: "/draw",
    },
    { name: "Cinematic tour", detail: "Orbit the current drafting model.", prompt: "/tour" },
    {
      name: "Drafting status",
      detail: "Read the current model and animation status.",
      prompt: "/draftsman",
    },
    {
      name: "Find materials",
      detail: "List visible materials and source evidence.",
      prompt:
        "List the visible materials on this drawing with source evidence. Keep unknown quantities unresolved.",
    },
    {
      name: "Check missing details",
      detail: "Identify gaps without inventing dimensions.",
      prompt:
        "Find missing dimensions and material specifications in this drawing. Keep unsupported values unresolved.",
    },
    {
      name: "Compare references",
      detail: "Compare your attached styles and inspiration.",
      prompt:
        "Compare the attached references. Describe their form, materials, facade rhythm and daylight strategy. Suggest a coherent direction for my project; distinguish suggestions from verified drawing facts.",
    },
  ];
  return createPortal(
    <aside
      className={`live-assistant ${open ? "is-open" : ""} ${panel.gesturing ? "is-gesturing" : ""}`}
      style={{ left: rect.x, top: open ? rect.y : rect.y + rect.height + 8, width: rect.width }}
      aria-label="Live assistant"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        useLiveAssistant.setState({ open: true });
        void attachImages(
          event.dataTransfer.files,
          drawer === "references" ? "Inspiration" : "Reference",
          drawer === "references",
        );
      }}
    >
      <input
        ref={fileInput}
        className="assistant-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        disabled={chat.busy || readingImages}
        aria-label="Attach images to assistant"
        onChange={(event) => {
          void attachImages(event.target.files, uploadKind.current, uploadLibrary.current);
          event.target.value = "";
        }}
      />
      {open && (
        <section
          className="live-assistant-panel"
          id="live-assistant-panel"
          style={{ height: rect.height }}
          role="region"
          aria-label="Drawing assistant panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              if (menu) {
                setMenu(false);
                plusButton.current?.focus();
              } else if (drawer) setDrawer(null);
              else collapse();
            }
          }}
        >
          <button
            type="button"
            className="assistant-resize-handle"
            aria-label="Resize live assistant"
            title="Drag to resize · arrow keys adjust · Home resets"
            onPointerDown={(e) => panel.pointerDown(e, "resize")}
            onPointerMove={panel.pointerMove}
            onPointerUp={panel.pointerUp}
            onPointerCancel={panel.pointerUp}
            onLostPointerCapture={panel.pointerUp}
            onKeyDown={(e) => panel.keyboard(e, "resize")}
          >
            <Maximize2 size={12} />
          </button>
          <header className="live-assistant-header">
            <button
              type="button"
              className="assistant-move-handle"
              aria-label="Move live assistant"
              title="Drag to move · arrow keys move · Home resets"
              onPointerDown={(e) => panel.pointerDown(e, "move")}
              onPointerMove={panel.pointerMove}
              onPointerUp={panel.pointerUp}
              onPointerCancel={panel.pointerUp}
              onLostPointerCapture={panel.pointerUp}
              onKeyDown={(e) => panel.keyboard(e, "move")}
              onDoubleClick={panel.reset}
            >
              <Bot size={19} />
              <span>
                <strong>Live assistant</strong>
                <small>
                  <i className={status?.available ? "is-ready" : ""} />
                  {statusLabel}
                </small>
              </span>
              <Grip size={13} className="assistant-drag-grip" />
            </button>
            <button
              type="button"
              className="live-assistant-icon"
              aria-label="Assistant settings"
              aria-expanded={drawer === "settings"}
              onClick={() => openDrawer(drawer === "settings" ? null : "settings")}
            >
              <Settings2 size={16} />
            </button>
            <button
              type="button"
              className="live-assistant-icon"
              aria-label="Collapse live assistant"
              onClick={collapse}
            >
              <Minus size={17} />
            </button>
          </header>
          <div
            className="live-assistant-body"
            ref={body}
            onScroll={(event) => {
              const el = event.currentTarget;
              followMessages.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            }}
          >
            {drawer && (
              <div className="assistant-drawer-heading">
                <button
                  type="button"
                  className="live-assistant-icon"
                  aria-label="Back to conversation"
                  onClick={() => setDrawer(null)}
                >
                  <ArrowLeft size={15} />
                </button>
                <strong>
                  {drawer === "skills"
                    ? "Skills"
                    : drawer === "references"
                      ? "References & inspiration"
                      : drawer === "help"
                        ? "Help"
                        : "Connection & voice"}
                </strong>
              </div>
            )}
            {!drawer && (
              <>
                <div className="live-assistant-context">
                  <FileSearch size={12} />
                  <span title={binary?.name}>
                    {binary ? `${binary.name} · Sheet ${sheet + 1}` : "Your drawing workspace"}
                  </span>
                </div>
                <ConversationView entries={chat.entries} busy={chat.busy} error={chat.error} />
              </>
            )}
            {drawer === "skills" && (
              <div className="assistant-skill-list">
                <p>Choose a workflow, review the prompt, then send.</p>
                {skills.map((skill) => (
                  <button
                    type="button"
                    key={skill.name}
                    disabled={chat.busy}
                    onClick={() => usePrompt(skill.prompt)}
                  >
                    <Sparkles size={15} />
                    <span>
                      <strong>{skill.name}</strong>
                      <small>{skill.detail}</small>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    useLiveAssistant.setState({ guide: true });
                    setDrawer("help");
                  }}
                >
                  <PlayCircle size={15} />
                  <span>
                    <strong>Sketch walkthrough</strong>
                    <small>Learn calibration and tracing with a practice plan.</small>
                  </span>
                </button>
              </div>
            )}
            {drawer === "references" && (
              <div className="assistant-reference-library">
                <p>
                  Build a direction with style briefs and your own images. References stay in this
                  project’s app session, including across New chat.
                </p>
                <h3>Building styles</h3>
                <div className="assistant-style-list">
                  {BUILDING_STYLES.map((style) => (
                    <button
                      key={style.name}
                      type="button"
                      disabled={chat.busy}
                      onClick={() =>
                        usePrompt(
                          style.brief +
                            " Use any attached inspiration as references. Ask for missing project requirements before suggesting a layout.",
                        )
                      }
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
                <h3>
                  Inspiration & materials <span>{references.length}/12</span>
                </h3>
                <button
                  type="button"
                  className="assistant-reference-upload"
                  disabled={readingImages || chat.busy}
                  onClick={() => chooseImages("Inspiration", true)}
                >
                  <ImagePlus size={17} />
                  Add reference images
                </button>
                <small>Drop images here, or add PNG, JPEG or WebP files. Up to 3 MB each.</small>
                <div className="assistant-reference-grid">
                  {references.map((image) => (
                    <article key={image.id}>
                      <img src={`data:${image.mimeType};base64,${image.data}`} alt={image.name} />
                      <strong title={image.name}>{image.name}</strong>
                      <select
                        aria-label={`Reference purpose for ${image.name}`}
                        value={image.kind}
                        onChange={(e) => {
                          const kind = e.target.value as ReferenceKind;
                          setReferences((previous) =>
                            previous.map((v) => (v.id === image.id ? { ...v, kind } : v)),
                          );
                          setAttachments((previous) =>
                            previous.map((v) => (v.id === image.id ? { ...v, kind } : v)),
                          );
                        }}
                      >
                        {REFERENCE_KINDS.map((kind) => (
                          <option key={kind}>{kind}</option>
                        ))}
                      </select>
                      <div>
                        <button
                          type="button"
                          disabled={
                            chat.busy ||
                            attachments.length >= 2 ||
                            attachments.some((v) => v.id === image.id)
                          }
                          onClick={() => {
                            setAttachments((previous) => [...previous, image]);
                            setMessage("Reference attached to your next message.");
                          }}
                        >
                          {attachments.some((v) => v.id === image.id)
                            ? "Attached"
                            : "Use in message"}
                        </button>
                        <button
                          type="button"
                          className="live-assistant-icon"
                          aria-label={`Remove reference ${image.name}`}
                          disabled={chat.busy}
                          onClick={() => {
                            setReferences((previous) => previous.filter((v) => v.id !== image.id));
                            setAttachments((previous) => previous.filter((v) => v.id !== image.id));
                          }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {!references.length && (
                  <p className="assistant-reference-empty">
                    Facade photos, floor-plan details, material palettes, buildings you love—drop
                    your inspiration here.
                  </p>
                )}
              </div>
            )}
            {drawer === "help" && (
              <div className="assistant-help">
                <h3>Make the workspace your own</h3>
                <p>
                  Drag the header to move the chat. Drag its upper-right corner to resize. Focus
                  either handle and use arrow keys; Home resets the panel.
                </p>
                <h3>Messages & references</h3>
                <p>
                  Enter sends. Shift + Enter adds a line. Drop images into the chat to attach them,
                  or into References to keep them for later. Send up to two images at a time.
                  Uploading alone does not send them to the AI provider.
                </p>
                <h3>Drawing tools</h3>
                <p>
                  <code>/draw</code> draws the existing model, <code>/tour</code> starts its orbit,{" "}
                  <code>/draftsman</code> reads drawing status, and <code>/mcp</code> lists connected
                  tools. Open a model first. These commands do not generate new building geometry.
                </p>
                <button
                  type="button"
                  className="assistant-text-action"
                  onClick={() => useLiveAssistant.setState({ guide: !guide })}
                >
                  <PlayCircle size={15} />
                  Sketch walkthrough
                </button>
                <button type="button" className="assistant-text-action" onClick={panel.reset}>
                  <Maximize2 size={15} />
                  Reset panel position & size
                </button>
                <button
                  type="button"
                  className="assistant-text-action"
                  onClick={() => void capabilities()}
                >
                  View connected tools
                </button>
              </div>
            )}
            {drawer === "settings" && (
              <div className="assistant-connection-settings">
                <p>
                  <strong>AI provider</strong>
                  <br />
                  {status
                    ? status.available
                      ? `${status.provider} · ${status.model}`
                      : status.message
                    : "Checking connection…"}
                </p>
                <p>
                  <strong>Workspace tools</strong>
                  <br />
                  {connection.connected
                    ? `${connection.names.length} tools connected`
                    : connection.error || "Connecting…"}
                </p>
                <button
                  type="button"
                  className="assistant-text-action"
                  onClick={() => {
                    setMessage("");
                    setRefresh((v) => v + 1);
                  }}
                >
                  <RefreshCw size={14} />
                  Refresh connection
                </button>
                <LiveAssistantVoice
                  onMessage={setMessage}
                  reply={
                    chat.entries.filter((e) => e.kind === "assistant").at(-1)?.text ||
                    message ||
                    "Ask me about your drawing or attach a reference image."
                  }
                />
                <p className="live-assistant-disclosure">
                  Messages, selected images and requested tool results go to the configured provider
                  when you send. Chat and references stay in this app session. New chat clears the
                  conversation, not your project.
                </p>
              </div>
            )}
            {guide && drawer === "help" && (
              <section className="live-assistant-guide" aria-label="Sketch walkthrough">
                <strong>Your first Sketch</strong>
                <ol>
                  <li>Open the labelled 6 × 4 m practice plan.</li>
                  <li>Measure → Known distance: 6 m. Pick A and B, then Lock scale.</li>
                  <li>Sketch → Manual layer. Click A → B → C → D → A.</li>
                  <li>Commit trace. Esc cancels unfinished points.</li>
                </ol>
                <button
                  type="button"
                  className="assistant-text-action"
                  disabled={loading || !hydrated}
                  onClick={practice}
                >
                  {loading ? "Opening…" : "Open practice plan"}
                  <ArrowUpRight size={14} />
                </button>
                <p>Demonstration annotations do not create walls or verified quantities.</p>
              </section>
            )}
            {message && (
              <p className="live-assistant-message" role="status">
                {message}
              </p>
            )}
          </div>
          <form
            className="live-assistant-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files).filter((f) =>
                f.type.startsWith("image/"),
              );
              if (files.length) {
                event.preventDefault();
                void attachImages(files);
              }
            }}
          >
            {!!attachments.length && (
              <div className="assistant-attachments">
                {attachments.map((image, index) => (
                  <div key={image.id}>
                    <img
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt={`Pending attachment ${index + 1}: ${image.name}`}
                    />
                    <span title={image.name}>
                      {image.kind}
                      <small>{image.name}</small>
                    </span>
                    <button
                      type="button"
                      className="live-assistant-icon"
                      disabled={chat.busy}
                      aria-label={`Remove attachment ${index + 1}`}
                      onClick={() =>
                        setAttachments((previous) => previous.filter((v) => v.id !== image.id))
                      }
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="sr-only" htmlFor="live-assistant-prompt">
              Message live assistant
            </label>
            <textarea
              ref={input}
              id="live-assistant-prompt"
              value={draft}
              maxLength={1500}
              rows={2}
              placeholder="Ask anything about your project…"
              disabled={chat.busy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              onChange={(event) => useLiveAssistant.setState({ draft: event.target.value })}
            />
            <div className="live-assistant-compose-footer">
              <div className="assistant-add-root" ref={menuRoot}>
                <button
                  ref={plusButton}
                  type="button"
                  className="assistant-composer-button assistant-plus"
                  aria-label="Add to assistant"
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  onClick={() => setMenu(!menu)}
                >
                  <span>
                    <Plus size={18} />
                  </span>
                </button>
                {menu && (
                  <div
                    className="assistant-add-menu"
                    role="menu"
                    aria-label="Add to assistant menu"
                    onKeyDown={(event) => {
                      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                      event.preventDefault();
                      const items = Array.from(
                        event.currentTarget.querySelectorAll<HTMLButtonElement>(
                          "button:not(:disabled)",
                        ),
                      );
                      const current = items.indexOf(document.activeElement as HTMLButtonElement);
                      const next =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? items.length - 1
                            : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) %
                              items.length;
                      items[next]?.focus();
                    }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      disabled={chat.busy || readingImages}
                      onClick={() => chooseImages()}
                    >
                      <ImagePlus size={16} />
                      Upload images
                    </button>
                    <button type="button" role="menuitem" onClick={() => openDrawer("references")}>
                      <Images size={16} />
                      References & inspiration
                    </button>
                    <button type="button" role="menuitem" onClick={() => openDrawer("skills")}>
                      <Sparkles size={16} />
                      Skills
                    </button>
                    <button type="button" role="menuitem" onClick={() => openDrawer("help")}>
                      <CircleHelp size={16} />
                      Help
                    </button>
                    <button type="button" role="menuitem" onClick={() => openDrawer("settings")}>
                      <Mic size={16} />
                      Voice & connection
                    </button>
                    {binary?.kind === "pdf" && (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!hydrated || chat.busy}
                        onClick={prepareReview}
                      >
                        <FileSearch size={16} />
                        Prepare drawing review
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      className="assistant-new-chat"
                      disabled={chat.busy || readingImages}
                      onClick={newChat}
                    >
                      <MessageSquarePlus size={16} />
                      New chat
                    </button>
                  </div>
                )}
              </div>
              <span className="assistant-composer-hint">
                {readingImages
                  ? "Reading images…"
                  : attachments.length
                    ? `${attachments.length}/2 images`
                    : "Enter to send"}
              </span>
              {chat.busy ? (
                <button
                  type="button"
                  className="assistant-composer-button assistant-send"
                  aria-label="Stop assistant response"
                  onClick={chat.stop}
                >
                  <span>
                    <i className="assistant-stop-square" />
                  </span>
                </button>
              ) : (
                <button
                  type="submit"
                  className="assistant-composer-button assistant-send"
                  aria-label="Send assistant message"
                  disabled={readingImages || (!draft.trim() && !attachments.length)}
                >
                  <span>
                    <ArrowUp size={17} />
                  </span>
                </button>
              )}
            </div>
          </form>
          <p className="assistant-bottom-note">
            Review AI suggestions against your source drawings.
          </p>
          {dragOver && (
            <div className="assistant-drop-target">
              <ImagePlus size={26} />
              <strong>
                {drawer === "references"
                  ? "Drop inspiration into References"
                  : "Drop images to attach"}
              </strong>
              <span>PNG · JPEG · WebP</span>
            </div>
          )}
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        className="live-assistant-launcher"
        aria-expanded={open}
        aria-controls="live-assistant-panel"
        onClick={() => useLiveAssistant.setState({ open: !open })}
      >
        <Bot size={16} />
        <strong>Live assistant</strong>
        <ChevronUp size={14} className={open ? "is-flipped" : ""} />
      </button>
    </aside>,
    document.body,
  );
}
