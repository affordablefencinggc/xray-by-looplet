import { useDiagramPreferences } from './assistant/diagramPreferences';
import { setDeveloperMode, useDeveloperMode } from './assistant/developerPreferences';
import { MonkeyPanel } from './assistant/MonkeyPanel';
import { useMonkeyRecorder, startMonkey, finishMonkey, updateMonkey } from './assistant/monkeyRecorder';
import { monkeyReviewPrompt } from './assistant/monkeyWorkflow';
import { suggestSlashCommands } from './assistant/slashCommands';
import { ChatHistoryPanel } from './assistant/ChatHistoryPanel';
import { nccReferencePrompt, type NccMatch } from './assistant/nccReferences';
import { nccDocumentLabel } from './assistant/nccResultReferences';
import { NccLibrary } from "./assistant/NccLibraryPanel";
import { ExecutionSettings } from './assistant/ExecutionSettings';
import { AssistantFiles } from './assistant/AssistantFiles';
import { ASSISTANT_FILE_ACCEPT, MAX_ASSISTANT_FILES, attachmentImagePreview, storeAssistantFile, validateAssistantFile, type AssistantFile } from './assistant/attachmentFiles';
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
  FolderOpen,
  BookOpen,
  PanelRight,
  PanelRightClose,
} from "lucide-react";
import { useStudio } from "./store";
import { CANVAS_FOCUS_EVENT } from "./canvasFocus";
import { useLiveAssistant } from "./liveAssistantState";
import { type MaterialAiStatus } from "./materialAiTransport";
import { inspectPlanBytes } from "./documents";
import "./assistantPanel.css";
import { LiveAssistantVoice } from "./LiveAssistantVoice";
import { assistantStatus } from "./assistant/transport";
import { callAssistantTool, getAssistantMcp, useAssistantConnection } from "./assistant/session";
import { useAssistantChat } from "./assistant/useAssistantChat";
import { WorkPacketPanel } from "./assistant/WorkPacketPanel";
import { ConversationView } from "./assistant/ConversationView";
import { useAssistantPanel } from "./assistant/useAssistantPanel";
import { ASSISTANT_SKILLS } from "./assistant/skills";
// [SC-18 projects/corners/rail] begin: imports
import { ASSISTANT_RAIL_TOGGLE_EVENT } from "./assistantRailMode";
import { saveFencingJob } from "./persistence";
import { closeTab, openTab, readRegistry, readTabs, writeTabs, emptyRegistry } from "./projectRegistry";
import { PROJECT_LIBRARY_CHANGED } from "./projectArchive";
import { listProjects, resolveTabs, switchProject } from "./assistant/projectSwitch";
import { ProjectStrip, ProjectsDrawer } from "./assistant/AssistantProjects";
import { useAssistantRailDocked } from "./assistant/useAssistantPanel";
import { cornerCursor, cornerHitBoxes, type Corner } from "./assistant/panelCorners";
// [SC-18 projects/corners/rail] end: imports
// Context budget + rich replies (pills, inline answers, handover to a new chat).
import { PermissionControls } from "./assistant/PermissionControls";
import { usePermissions } from "./assistant/permissions";
import { latestReplyImage, suggestionsFor } from "./assistant/richReply";
import { hasArchitectController } from "./assistant/architectBridge";
import { isNativeShell } from "./assistant/renderTool";
import type { ChatImage } from "./assistant/conversation";
import {
  BUILDING_STYLES,
  REFERENCE_KINDS,
  referenceMessage,
  type ReferenceImage,
  type ReferenceKind,
} from "./assistant/referenceImages";

// [SC-18 projects/corners] begin: module helpers
/** The registry, shelf and tab keys live in localStorage; null when the browser blocks it. */
function projectStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const CORNER_LABEL: Record<Corner, string> = {
  nw: "top-left",
  ne: "top-right",
  sw: "bottom-left",
  se: "bottom-right",
};
// [SC-18 projects/corners] end: module helpers

export function LiveAssistant() {
  const monkey=useMonkeyRecorder();
  const [dismissedCommands,setDismissedCommands]=useState<string|null>(null);
  const { open, draft, guide } = useLiveAssistant();
  const binary = useStudio((s) => s.activePlanBinary);
  const sheet = useStudio((s) => s.sheet);
  const hydrated = useStudio((s) => s.persistenceHydrated);
  const jobId = useStudio((s) => s.job.id);
  // [SC-18 projects/rail] begin: project identity for the pill/drawer and the dock state
  const jobName = useStudio((s) => s.job.name);
  const jobUpdatedAt = useStudio((s) => s.job.updatedAt);
  const docked = useAssistantRailDocked();
  const [tabs, setTabs] = useState<string[]>([]);
  const [registry, setRegistry] = useState(emptyRegistry);
  const [switching, setSwitching] = useState(false);
  const switchLock = useRef(false);
  // [SC-18 projects/rail] end
  const pane = useStudio((s) => s.pane);
  const chat = useAssistantChat(jobId);
  // The Architectural workspace registers its controller after mount; re-render so the
  // "Select a shape to reference" pill appears as soon as the plan canvas is on screen.
  const [, setArchitectReady] = useState(0);
  useEffect(() => {
    const bump = () => setArchitectReady((value) => value + 1);
    window.addEventListener("xray:architect-controller-ready", bump);
    return () => window.removeEventListener("xray:architect-controller-ready", bump);
  }, []);
  // [SC-20 permissions] the mode lives in permissions.ts; "auto" is what the old per-message checkbox meant.
  const permissionMode = usePermissions((state) => state.mode);
  const allowProjectEdits = permissionMode === "auto";
  const sendLock = useRef(false);
  const connection = useAssistantConnection();
  const [pendingFiles, setPendingFiles] = useState<AssistantFile[]>([]);
  const [fileRefresh, setFileRefresh] = useState(0);
  const [attachments, setAttachments] = useState<ReferenceImage[]>([]);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [menu, setMenu] = useState(false);
  const selectedNcc = useLiveAssistant(state => state.nccReferences) ?? [];
  const selectNcc = (match: NccMatch) => {
    const refs = useLiveAssistant.getState().nccReferences ?? [];
    if (refs.some(r => r.id === match.id) || refs.length >= 6) return;
    useLiveAssistant.setState({ nccReferences: [...refs, match], draftProjectId: jobId });
    setNccScope(false);
  };
  const diagrams=useDiagramPreferences();
  const developerMode=useDeveloperMode();
  const [nccScope, setNccScope] = useState(false);
  const [nccTopic, setNccTopic] = useState("");
  const [drawer, setDrawer] = useState<
    "skills" | "references" | "help" | "settings" | "projects" | "history" | "ncc" | null
  >(null);
  const [dragOver, setDragOver] = useState(false);
  const [readingImages, setReadingImages] = useState(false);
  const panel = useAssistantPanel();
  const [status, setStatus] = useState<MaterialAiStatus | null>(null);
  const [message, setMessage] = useState("");
  const [continued, setContinued] = useState(0);
  // Focus the composer after "Continue this in a new chat" once React has re-enabled it.
  useEffect(() => {
    if (continued) input.current?.focus();
  }, [continued]);
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
  // Reopening always returns to the active conversation, never a stale drawer.
  useEffect(() => { if(open){setDrawer(null);setMenu(false);followMessages.current=true;} },[open]);
  useEffect(() => {
    if (!open) return;
    if (drawer) {
      const frame=requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=0;});
      return ()=>cancelAnimationFrame(frame);
    }
    followMessages.current = true;
    const frame=requestAnimationFrame(()=>{if(body.current)body.current.scrollTop=body.current.scrollHeight;});
    return ()=>cancelAnimationFrame(frame);
  }, [open, chat.id, chat.loadingHistory, chat.entries, chat.busy, drawer]);
  useEffect(() => {
    const element=body.current;
    if(!open || drawer || !element)return;
    let frame=0;
    const follow=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(followMessages.current)element.scrollTop=element.scrollHeight;});};
    const observer=new ResizeObserver(follow);
    observer.observe(element);
    const conversation=element.querySelector('.assistant-conversation');
    if(conversation)observer.observe(conversation);
    element.addEventListener('load',follow,true);
    return ()=>{observer.disconnect();element.removeEventListener('load',follow,true);cancelAnimationFrame(frame);};
  },[open,drawer,chat.id,chat.loadingHistory]);
  // The connection light on the collapsed rail needs the probe on mount, not only once the panel opens.
  useEffect(() => {
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
    if (!hydrated) return;
    setAttachments([]); setPendingFiles([]);
    setReferences([]);
    setMenu(false);
    setDrawer(null);
    setDragOver(false);
    setMessage("");
    const ui = useLiveAssistant.getState();
    useLiveAssistant.setState({ draft: ui.draftProjectId == null || ui.draftProjectId === jobId ? ui.draft : "", draftProjectId: jobId, nccReferences: ui.draftProjectId == null || ui.draftProjectId === jobId ? (ui.nccReferences ?? []) : [] });
  }, [jobId, hydrated]);
  // [SC-18 projects] begin: registry + tab strip state (re-read per project and when the drawer opens)
  const projectsOpen = drawer === "projects";
  const [libraryVersion, setLibraryVersion] = useState(0);
  useEffect(() => {
    const refreshLibrary = () => setLibraryVersion(value => value + 1);
    window.addEventListener(PROJECT_LIBRARY_CHANGED, refreshLibrary);
    window.addEventListener("storage", refreshLibrary);
    return () => { window.removeEventListener(PROJECT_LIBRARY_CHANGED, refreshLibrary); window.removeEventListener("storage", refreshLibrary); };
  }, []);
  useEffect(() => {
    const storage = projectStorage();
    if (!storage) return;
    const stored = readRegistry(storage);
    const storedTabs = readTabs(storage);
    // Tabs whose project is neither open nor indexed cannot be opened: prune them from storage too.
    const kept = resolveTabs(storedTabs, stored, { id: jobId, name: jobName }).map((tab) => tab.id);
    setRegistry(stored);
    setTabs(kept.length === storedTabs.length ? storedTabs : writeTabs(storage, kept));
  }, [jobId, jobName, projectsOpen, libraryVersion]);
  // [SC-18 projects] end
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
    if (!action || attachments.length || pendingFiles.length) return false;
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
  /**
   * Sends `text` with the current attachments and permission. The composer calls it with the
   * draft; reply pills and the inline answer call it with their own text (the draft is left alone).
   */
  const sendText = async (text: string) => {
    if (sendLock.current || chat.busy || readingImages) return;
    sendLock.current = true;
    const sendingJob = jobId;
    const fromDraft = text === draft;
    try {
      followMessages.current = true;
      setDrawer(null);
      setMenu(false);
      const command = text.trim().toLowerCase().replace(/\s+/g, " ");
      if (!command && !attachments.length && !pendingFiles.length) return;
      const candidates=suggestSlashCommands(text);
      if(candidates.length&&!candidates.some(item=>item.command===command)&&!['/draft','/pencil','/magic-pencil','/mcp'].includes(command)) {
        setDismissedCommands(null);setMessage('Choose a suggested slash command, then send.');return;
      }
      if (command==='/monkeysee'||command==='/monkeydo') {
        if(chat.loadingHistory||!hydrated){setMessage('Wait for your project and saved chat to finish opening.');return;}
        try {
          if(command==='/monkeysee') {
            startMonkey(sendingJob);
            chat.postLocalExchange(text,'Monkey see is recording your actions inside X-Ray to a local background record. Work normally, then send /monkeydo to stop and review. Closing this panel keeps recording; switching projects stops it. Text entry, passwords and other applications are not recorded.');
            if(fromDraft)useLiveAssistant.setState({draft:''});
          } else {
            const recording=finishMonkey();
            if(!recording.events.length){setMessage('Recording stopped with no X-Ray actions. Use /monkeysee, demonstrate the workflow, then /monkeydo.');return;}
            const before=chat.latestReply();
            const completed=await chat.send(monkeyReviewPrompt(recording),[],false,'',()=>{if(projectRef.current===sendingJob&&fromDraft)useLiveAssistant.setState({draft:''});},true);
            if(projectRef.current===sendingJob&&completed){const review=chat.latestReply();if(review&&review!==before)updateMonkey({...recording,status:'review',review});}
          }
        } catch(e) {setMessage(e instanceof Error?e.message:String(e));}
        return;
      }
      if (fromDraft && nccScope) {
        setNccTopic(text.trim());
        setDrawer("ncc");
        setMessage("Select the matching NCC references to use in your answer. Your question and attachments are retained.");
        return;
      }
      if (
        !attachments.length && !pendingFiles.length &&
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
        if (projectRef.current !== sendingJob) return;
        if (fromDraft) useLiveAssistant.setState({ draft: "" });
      } else {
        const handled = await handleDraftsmanChat(text);
        if (projectRef.current !== sendingJob) return;
        if (handled) {
          if (fromDraft) useLiveAssistant.setState({ draft: "" });
          return;
        }
        setMessage("");
        const sentDraft = draft;
        // Pills and inline answers travel alone; pending attachments stay with the draft.
        const sending = fromDraft ? attachments : [];
        const documents = fromDraft ? pendingFiles : [];
        const refs = fromDraft ? selectedNcc : [];
        const fileContext = (documents.length ? JSON.stringify({ files: documents, retrievalTool: 'read_assistant_file', evidence: 'unverified' }) : '') + (refs.length ? nccReferencePrompt(refs) : '');
        try {
          await chat.send(
            documents.length ? `${text.trim() || 'Please inspect the attached files.'}\nAttached: ${documents.map(file => file.name).join(', ')}` : sending.length ? referenceMessage(text, sending) : text.trim(),
            sending.map(({ mimeType, data }) => ({ mimeType, data })),
            allowProjectEdits,
            fileContext,
            () => {
              if (projectRef.current === sendingJob && fromDraft && useLiveAssistant.getState().draft === sentDraft) {
                useLiveAssistant.setState({ draft: "" });
                setAttachments([]); setPendingFiles([]);
                useLiveAssistant.setState({ nccReferences: [] });
              }
            },
          );
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Assistant could not start.");
        }
      }
    } finally {
      sendLock.current = false;
    }
  };
  const sendMessage = () => sendText(draft);
  /** Open the working canvas locally; no model request or project edit is needed. */
  const openCanvas = async () => {
    if (loading || chat.busy || switching) return;
    setLoading(true);
    setMessage("");
    const current = useStudio.getState();
    const target = current.pane === "model" || current.designedBuilding ? "model" : "sketch";
    try {
      const result = await callAssistantTool("navigate_workspace", {
        expectedJobId: current.job.id,
        pane: target,
      }, new AbortController().signal);
      if (projectRef.current !== current.job.id) return;
      if (result.isError) {
        throw Error(result.content.filter(item => item.type === "text").map(item => item.text).join("\n") || "Canvas could not be opened.");
      }
      if (target === "sketch") {
        const drawingTab = [...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Architectural views"] button')]
          .find(button => button.textContent?.trim() === "Drawing studio");
        drawingTab?.click();
      }
      window.dispatchEvent(new Event(CANVAS_FOCUS_EVENT));
      setMenu(false);
      setDrawer(null);
      setMessage(target === "model" ? "Model canvas open." : "Drawing canvas open with live 3D.");
    } catch (error) {
      if (projectRef.current === current.job.id) setMessage(error instanceof Error ? error.message : "Canvas could not be opened.");
    } finally {
      setLoading(false);
    }
  };
  /** A chat image (tool or assistant output) becomes a pending "Reference" attachment. */
  const attachChatImage = (image: ChatImage) => {
    if (chat.busy || readingImages) return;
    if (attachments.some((item) => item.data === image.data)) {
      setMessage("That image is already attached to your next message.");
      return;
    }
    if (attachments.length + pendingFiles.length >= MAX_ASSISTANT_FILES) {
      setMessage("Attach up to 20 files per message. Remove one to add this reference.");
      return;
    }
    const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/webp" ? "webp" : "jpg";
    setAttachments((previous) => [
      ...previous,
      { id: crypto.randomUUID(), name: `chat-image-${previous.length + 1}.${extension}`, kind: "Reference", mimeType: image.mimeType, data: image.data },
    ]);
    setMessage("Image attached as a reference for your next message.");
    followMessages.current = true;
  };
  /** Carries the work over: handover note first, then a fresh transcript (nothing sent until the next message). */
  const continueChat = async (sourceId?: string) => {
    if (chat.busy || readingImages) return;
    try { if (!await chat.continueInNewChat(sourceId)) return; }
    catch(e) { setMessage(e instanceof Error ? e.message : 'Chat could not be saved.'); return; }
    setAttachments([]); setPendingFiles([]);
    setMenu(false);
    setDrawer(null);
    setMessage("Continued in a new chat. The handover above is context for the assistant; your draft is kept.");
    followMessages.current = true;
    setContinued((value) => value + 1);
  };
  const lastReply = chat.entries.filter((entry) => entry.kind === "assistant").at(-1);
  const suggestions = suggestionsFor({
    pane,
    lastReplyText: lastReply?.text ?? "",
    hasDesign: hasArchitectController(),
    native: isNativeShell(),
    hasImages: latestReplyImage(chat.entries) !== null,
  });
  // Interaction estimate only; the work-packet preflight budgets actual requests separately.
  const meter = { label: `Interaction ≈${chat.tokens.toLocaleString()} tokens`, title: 'Estimated interaction text; work packets and source records are stored separately.' };

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
      if (files.length > MAX_ASSISTANT_FILES || (!libraryOnly && files.length + attachments.length + pendingFiles.length > MAX_ASSISTANT_FILES))
        throw Error("Choose up to 20 files per selection or message.");
      const added: ReferenceImage[] = [];
      const documents: AssistantFile[] = [];
      for (const file of Array.from(files)) {
        validateAssistantFile(file);
        if (projectRef.current !== project) return;
        setMessage(`Saving ${file.name}...`);
        const stored = await storeAssistantFile(project, file, fraction => {
          if (projectRef.current === project) setMessage(`Saving ${file.name} - ${Math.round(fraction * 100)}%`);
        });
        if (projectRef.current !== project) return;
        setFileRefresh(value => value + 1);
        if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
          try { const preview = await attachmentImagePreview(file); added.push({ ...preview, id: stored.id, name: file.name, kind }); }
          catch { documents.push(stored); }
        } else documents.push(stored);
      }
      if (projectRef.current !== project) return;
      setReferences((previous) => [...previous, ...added].slice(-50));
      if (!libraryOnly) setPendingFiles(previous => [...previous, ...documents]);
      if (!libraryOnly) setAttachments((previous) => [...previous, ...added]);
      setMessage(
        libraryOnly
          ? "Added to References. Choose Use in message when ready."
          : "Files saved. Previews and selected pages are sent to the assistant; originals stay in Project files.",
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
  const choosePrompt = (text: string) => {
    useLiveAssistant.setState({ draft: text });
    setDrawer(null);
    setMenu(false);
    input.current?.focus();
  };
  const newChat = async () => {
    if (chat.busy || readingImages) return;
    try { if(!await chat.clear())return; }
    catch(e) { setMessage(e instanceof Error ? e.message : 'Chat could not be saved.'); return; }
    setAttachments([]); setPendingFiles([]);
    setMessage("");
    setMenu(false);
    setDrawer(null);
    useLiveAssistant.setState({ draft: "", guide: false });
    input.current?.focus();
  };
  // [SC-18 projects] begin: switch orchestration (projectSwitch.ts) and tab bookkeeping
  const openProject = async (targetId: string | null) => {
    if (switchLock.current) return;
    if (targetId !== null && targetId === jobId) {
      setDrawer(null);
      return;
    }
    const storage = projectStorage();
    if (!storage) {
      setMessage("Browser storage is unavailable, so projects cannot be switched.");
      return;
    }
    switchLock.current = true;
    setSwitching(true);
    setMessage(targetId === null ? "Creating a new project…" : "Switching project…");
    try {
      const result = await switchProject(targetId, {
        store: {
          getState: () => useStudio.getState(),
          setState: (patch) => useStudio.setState(patch),
        },
        storage,
        saveJob: (job, options) => saveFencingJob(job, undefined, options),
        busy: chat.busy || readingImages,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setTabs(result.tabs);
      setRegistry(result.registry);
      // The store now holds the target: the [jobId] effect closes the drawer and clears the
      // message, and useAssistantChat(jobId) shows that project's own conversation.
    } finally {
      switchLock.current = false;
      setSwitching(false);
    }
  };
  const persistTabs = (next: string[]) => {
    const storage = projectStorage();
    setTabs(storage ? writeTabs(storage, next) : next);
  };
  /** Adds a tab without switching; closing a tab never deletes the project. */
  const openProjectTab = (id: string) => persistTabs(openTab(tabs, id));
  const closeProjectTab = (id: string) => persistTabs(closeTab(tabs, id));
  // [SC-18 projects] end
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
  const skills = ASSISTANT_SKILLS;
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
        accept={ASSISTANT_FILE_ACCEPT}
        multiple
        disabled={chat.busy || readingImages}
        aria-label="Attach files to assistant"
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
          {/* [SC-18 corners] begin: pinch any corner (hidden in rail mode by assistantPanel.css) */}
          {cornerHitBoxes({ x: 0, y: 0, width: rect.width, height: rect.height }).map((box) => (
            <button
              key={box.corner}
              type="button"
              className="assistant-corner"
              data-corner={box.corner}
              aria-label={`Resize from the ${CORNER_LABEL[box.corner]} corner`}
              title="Drag to resize · arrow keys resize · Home resets"
              style={{
                left: box.x,
                top: box.y,
                width: box.size,
                height: box.size,
                cursor: cornerCursor(box.corner),
              }}
              onPointerDown={(e) => panel.pointerDown(e, box.corner)}
              onPointerMove={panel.pointerMove}
              onPointerUp={panel.pointerUp}
              onPointerCancel={panel.pointerUp}
              onLostPointerCapture={panel.pointerUp}
              onKeyDown={(e) => panel.keyboard(e, box.corner)}
            />
          ))}
          {/* [SC-18 corners] end */}
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
            {/* [SC-18 rail] begin: dock/undock; WorkspaceRails toggles rail mode on the event */}
            <button
              type="button"
              className="live-assistant-icon assistant-dock-toggle"
              aria-label={docked ? "Undock from the right menu" : "Dock into the right menu"}
              aria-pressed={docked}
              title={docked ? "Undock from the right menu" : "Dock into the right menu"}
              onClick={() => window.dispatchEvent(new CustomEvent(ASSISTANT_RAIL_TOGGLE_EVENT))}
            >
              {docked ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
            </button>
            {/* [SC-18 rail] end */}
            <button
              type="button"
              className="live-assistant-icon"
              aria-label="Collapse live assistant"
              onClick={collapse}
            >
              <Minus size={17} />
            </button>
          </header>
          <div className="assistant-canvas-action">
            <button
              type="button"
              onClick={() => void openCanvas()}
              disabled={!hydrated || loading || chat.busy || switching}
              title="Expand the canvas beside the sidebar; keep the chat in place"
            >
              <Maximize2 size={15} aria-hidden="true" />
              Open canvas
            </button>
          </div>
          <WorkPacketPanel projectId={jobId} current={chat.workPacket} />
          <MonkeyPanel record={monkey.records.filter(r=>r.projectId===jobId).at(-1)} error={monkey.error} busy={chat.busy||chat.loadingHistory} onReview={()=>{
            if(chat.busy){try{finishMonkey();setMessage('Recording stopped. Review it when the current assistant response finishes.');}catch(e){setMessage(String(e));}}
            else void sendText('/monkeydo');
          }} onSaved={()=>setFileRefresh(value=>value+1)}/>
          <AssistantFiles projectId={jobId} refresh={fileRefresh} disabled={chat.busy || readingImages} onAttach={file => {
            if (pendingFiles.some(f => f.id === file.id)) return;
            if (pendingFiles.length + attachments.length >= MAX_ASSISTANT_FILES) { setMessage("Attach up to 20 files per message."); return; }
            setPendingFiles(previous => [...previous, file]);
          }} />
          <div
            className="live-assistant-body"
            ref={body}
            onScroll={(event) => {
              const el = event.currentTarget;
              if(!drawer) followMessages.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
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
                        : drawer === "projects"
                          ? "Projects"
                          : drawer === "ncc" ? "NCC" : drawer === "history" ? "Chat history" : "Assistant settings"}
                </strong>
              </div>
            )}
            {drawer === "ncc" && <NccLibrary initialTopic={nccTopic} onAttach={text => {
              const current = useLiveAssistant.getState().draft;
              if (current.length + text.length > 100000) { setMessage("The question is too long to add these references. Shorten it first; your draft is preserved."); return; }
              useLiveAssistant.setState({ draft: current + text });
              setNccScope(false);
              setDrawer(null); setMessage("NCC references added. Write your question, then send when ready.");
              requestAnimationFrame(() => input.current?.focus());
            }} />}
            {drawer === "history" && <ChatHistoryPanel threads={chat.history} disabled={chat.busy || readingImages || chat.loadingHistory}
              onOpen={async id => {try {if(await chat.restoreHistory(id)){followMessages.current=true;setMessage('');setDrawer(null);}}catch(e){setMessage(e instanceof Error?e.message:'Chat could not be opened.');}}}
              onContinue={id => void continueChat(id)}
              onArchive={async id => {try {if(await chat.archiveHistory(id))setMessage('Chat archived. It remains available under Archived chats.');}catch(e){setMessage(e instanceof Error?e.message:'Chat could not be archived.');}}}
            />}
            {!drawer && (
              <>
                {/* [PROVENANCE] Names the open project first and always. Anyone reading over a
                    shoulder can see which job is loaded without opening a menu, so an assistant
                    action can never be mistaken for work on someone else's project. */}
                <div className="live-assistant-context">
                  <FileSearch size={12} />
                  <span title={binary?.name ? `${jobName} · ${binary.name}` : jobName}>
                    <strong className="live-assistant-context-project">{jobName}</strong>
                    {binary ? ` · ${binary.name} · Sheet ${sheet + 1}` : " · no drawing imported"}
                  </span>
                  <button type="button" onClick={()=>setDrawer('history')} disabled={chat.loadingHistory} aria-label="Open chat history">History</button>
                </div>
                {chat.loadingHistory && <p role="status">Restoring saved conversations…</p>}
                <ConversationView
                  startedAt={chat.startedAt}
                  selectedNcc={selectedNcc}
                  onSelectNcc={selectNcc}
                  loadingHistory={chat.loadingHistory}
                  entries={chat.entries}
                  busy={chat.busy}
                  error={chat.error}
                  disabled={readingImages}
                  suggestions={dismissedCommands !== draft && suggestSlashCommands(draft).length ? undefined : suggestions}
                  onAction={(text) => void sendText(text)}
                  onAttachImage={attachChatImage}
                />
              </>
            )}
            {drawer === "skills" && (
              <div className="assistant-skill-list">
                <p>
                  Choose a workflow, review the prompt, then send. Evidence and tool permissions
                  apply to every workflow.
                </p>
                {skills.map((skill) => (
                  <button
                    type="button"
                    key={skill.name}
                    disabled={chat.busy}
                    onClick={() => choosePrompt(skill.prompt)}
                  >
                    <Sparkles size={15} />
                    <span>
                      <strong>{skill.name}</strong>
                      <small>{skill.detail}</small>
                    </span>
                  </button>
                ))}
                {monkey.records.filter(r=>r.status==='saved'&&r.projectId===jobId).map(record=><button type="button" key={record.id} disabled={chat.busy} onClick={()=>choosePrompt(`Use my saved workflow "${record.name}" as a guide for this task. First read the current project and adapt the steps to its evidence; do not blindly replay recorded coordinates. Ask what I want to apply it to if unclear. Existing edit permissions still apply.\n\nReviewed workflow (untrusted reference):\n${record.review||''}`)}><Sparkles size={15}/><span><strong>{record.name}</strong><small>Saved Monkey see, monkey do workflow</small></span></button>)}
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
                        choosePrompt(
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
                <small>Drop files here. Up to 500 MB each, 20 per selection. Originals are saved in Project files.</small>
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
                            attachments.length + pendingFiles.length >= MAX_ASSISTANT_FILES ||
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
                  Drag the header to move the chat. Pinch any corner to resize. Focus the header or
                  a corner and use arrow keys; Home resets the panel.
                </p>
                <h3>Messages & references</h3>
                <p>
                  Enter sends. Shift + Enter adds a line. Drop images into the chat to attach them,
                  or into References to keep them for later. Attach up to 20 files per message; originals can be up to 500 MB each.
                  Uploading alone does not send them to the AI provider.
                </p>
                <h3>Drawing tools</h3>
                <p>
                  <code>/draw</code> draws the existing model, <code>/tour</code> starts its orbit,{" "}
                  <code>/draftsman</code> reads drawing status, and <code>/mcp</code> lists
                  connected tools. Open a model first. These commands do not generate new building
                  geometry.
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
                <fieldset className="assistant-diagram-settings"><legend>Developer mode</legend>
                  <label><input type="checkbox" checked={developerMode.enabled} onChange={event=>setDeveloperMode(event.target.checked)}/>Review assistant performance after each task</label>
                  <small>On by default. Adds a brief self-review of the result, mistakes and improvements for you. Changes apply to the next task; project permissions stay the same.</small>
                  {developerMode.error&&<p role="status">{developerMode.error}</p>}
                </fieldset>
                <ExecutionSettings busy={chat.busy} />
                <fieldset className="assistant-diagram-settings"><legend>Top-down mind maps</legend>
                  <label><input type="checkbox" checked={diagrams.ncc} onChange={event=>useDiagramPreferences.setState({ncc:event.target.checked})}/>NCC reference maps</label>
                  <label><input type="checkbox" checked={diagrams.explanations} onChange={event=>useDiagramPreferences.setState({explanations:event.target.checked})}/>Explanation maps</label>
                  <small>Collapsible maps with Mermaid source. NCC maps cover retrieved documents and pages, not the whole code.</small>
                </fieldset>
                <strong>Skills and guardrails</strong>
                <ul className="assistant-guardrails">
                  <li>Inspect, navigate, capture and research with the available tools.</li>
                  <li>
                    Drawing edits, undo and saving require the permission below for each message.
                  </li>
                  <li>
                    Source identity and calibration stay protected. Assumptions never become
                    verified quantities.
                  </li>
                  <li>
                    No quote issuing, publishing or external messages. Tool actions have visible
                    receipts.
                  </li>
                  <li>
                    Stops on stale project state; limits tool steps and blocks repeated call IDs.
                  </li>
                </ul>
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
                  when you send. Conversations are saved on this device. New chat keeps the previous
                  conversation in History. Reference selections stay in this app session.
                </p>
              </div>
            )}
            {/* [SC-18 projects] begin: Projects drawer */}
            {drawer === "projects" && (
              <ProjectsDrawer
                rows={listProjects(registry, { id: jobId, name: jobName, updatedAt: jobUpdatedAt })}
                tabs={tabs}
                disabled={switching}
                onOpen={(id) => void openProject(id)}
                onOpenTab={openProjectTab}
                onNew={() => void openProject(null)}
              />
            )}
            {/* [SC-18 projects] end */}
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
          {/* [SC-18 composer chrome] begin: silver footer under a separation line; the composer stays white */}
          <div className="assistant-footer">
          {dismissedCommands!==draft&&suggestSlashCommands(draft).length>0&&<div className="assistant-command-suggestions" role="group" aria-label="Slash command suggestions">
            <small>{suggestSlashCommands(draft).some(item=>item.command.startsWith(draft.trim().toLowerCase()))?'Commands':'Did you mean?'}</small>
            {suggestSlashCommands(draft).map(item=><button type="button" key={item.command} disabled={chat.busy||switching} aria-label={`Use ${item.command}: ${item.label}`} onClick={()=>{choosePrompt(item.command);setDismissedCommands(item.command);}}><strong>{item.command}</strong><span>{item.label}</span></button>)}
          </div>}
          {/* [SC-20 permissions] begin: mode control (ask / edit freely / read only) and the per-call prompt */}
          {/* Disabled mid-turn: swapping provider would leave an in-flight request answering to one route and its tool calls to another. */}
          <PermissionControls compact disabled={chat.busy || switching} projectControl={<ProjectStrip compact
            active={{id:jobId,name:jobName}} tabs={resolveTabs(tabs,registry,{id:jobId,name:jobName})}
            disabled={switching || chat.busy} onSelect={id=>void openProject(id)} onClose={closeProjectTab}
          />} />
          {/* [SC-20 permissions] end */}
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
            {!!selectedNcc.length && <div className="assistant-ncc-pending" aria-label="Selected NCC references">{selectedNcc.map(ref => <button className="assistant-pill" type="button" key={ref.id} title={ref.text} aria-label={`Remove NCC reference ${nccDocumentLabel(ref.documentName)}, PDF page ${ref.page}`} onClick={() => useLiveAssistant.setState({ nccReferences: selectedNcc.filter(item => item.id !== ref.id) })}><span>{nccDocumentLabel(ref.documentName)}</span> &middot; p. {ref.page} &times;</button>)}</div>}
            {nccScope && <div className="assistant-file-pending"><button type="button" aria-label="Remove NCC search scope" onClick={() => setNccScope(false)}>NCC · search uploaded references ×</button></div>}
            {!!pendingFiles.length && <div className="assistant-file-pending">{pendingFiles.map(file => <button type="button" key={file.id} aria-label={`Remove attached file ${file.name}`} onClick={() => setPendingFiles(items => items.filter(item => item.id !== file.id))}>{file.name} &middot; {(file.size / 1024 / 1024).toFixed(1)} MB &times;</button>)}</div>}
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
              maxLength={100000}
              rows={2}
              placeholder="Ask anything about your project…"
              disabled={switching || chat.busy || chat.loadingHistory}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData('text/plain');
                const selected = event.currentTarget.selectionEnd - event.currentTarget.selectionStart;
                if (pasted.length + draft.length - selected > 100000) {
                  event.preventDefault();
                  setMessage('This message exceeds 100,000 characters. Attach the document instead; your existing draft has been kept.');
                }
              }}
              onKeyDown={(event) => {
                if(event.key==='Escape'){setDismissedCommands(draft);return;}
                if(event.key==='ArrowDown'&&dismissedCommands!==draft&&suggestSlashCommands(draft).length){event.preventDefault();document.querySelector<HTMLButtonElement>('.assistant-command-suggestions button')?.focus();return;}
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
                      Upload files - up to 500 MB each
                    </button>
                    {/* [SC-18 projects] begin: "+" menu entry */}
                    <button
                      type="button"
                      role="menuitem"
                      className="assistant-projects-item"
                      disabled={switching}
                      onClick={() => openDrawer("projects")}
                    >
                      <FolderOpen size={16} />
                      Projects
                    </button>
                    {/* [SC-18 projects] end */}
                    <button type="button" role="menuitem" onClick={() => { setNccScope(true); setNccTopic(""); openDrawer("ncc"); }}>
                      <BookOpen size={16} /> NCC
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
                  : attachments.length + pendingFiles.length
                    ? `${attachments.length + pendingFiles.length}/20 files`
                    : "Enter to send"}
              </span>
              {chat.busy ? (
                <button
                  key="stop"
                  type="button"
                  className="assistant-composer-button assistant-send"
                  aria-label="Stop assistant response"
                  onClick={(event) => {
                    // Stopping swaps this control back to Submit. Cancel the
                    // original click's default action before React replaces it.
                    event.preventDefault();
                    event.stopPropagation();
                    chat.stop();
                  }}
                >
                  <span>
                    <i className="assistant-stop-square" />
                  </span>
                </button>
              ) : (
                <button
                  key="send"
                  type="submit"
                  className="assistant-composer-button assistant-send"
                  aria-label={nccScope ? "Find NCC references" : "Send assistant message"}
                  disabled={switching || readingImages || chat.loadingHistory || (!draft.trim() && !attachments.length && !pendingFiles.length)}
                >
                  <span>
                    <ArrowUp size={17} />
                  </span>
                </button>
              )}
            </div>
          </form>
          <div className="assistant-footer-status">
            <span
              className="assistant-context-meter"
              data-level="ok"
              title={meter.title}
              role="status"
              aria-label={`${meter.label} used, ${meter.title}`}
            >
              {meter.label}
            </span>
            <p className="assistant-bottom-note">Review AI suggestions against your source drawings.</p>
          </div>
          </div>
          {/* [SC-18 composer chrome] end */}
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
        {!monkey.error&&monkey.records.some(r=>r.projectId===jobId&&r.status==='recording')&&<small>● Recording</small>}
        <i
          className={`assistant-status-light ${status?.available ? "is-on" : "is-off"}`}
          role="img"
          aria-label={status?.available ? "Assistant connected" : "Assistant not connected"}
          title={status?.available ? "Connected" : statusLabel}
        />
        <ChevronUp size={14} className={open ? "is-flipped" : ""} />
      </button>
    </aside>,
    document.body,
  );
}
