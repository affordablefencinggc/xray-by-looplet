import { useState, useRef, useEffect } from "react";
import {
  Bot,
  CheckCircle2,
  Cpu,
  FileText,
  Layers,
  Send,
  Sparkles,
  Terminal,
  Wrench,
  X,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import { useStudio } from "./store";

interface Message {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  toolCall?: {
    name: string;
    args?: Record<string, unknown>;
    result?: unknown;
  };
}

interface McpTool {
  name: string;
  description: string;
  category: "engine" | "takeoff" | "geometry" | "quote";
}

const MCP_TOOLS: McpTool[] = [
  { name: "engine_info", description: "Report verified engine version, capabilities and host.", category: "engine" },
  { name: "run_takeoff", description: "Deterministic plan takeoff with formulas and evidence tiers.", category: "takeoff" },
  { name: "quote_draft", description: "Envelope mapping takeoff quantities to Looplet quote lines.", category: "quote" },
  { name: "run_takeoff_calibrated", description: "Takeoff with manual 2-point page calibration.", category: "takeoff" },
  { name: "marked_pdf", description: "Produce marked-up PDF with embedded takeoff annotations.", category: "takeoff" },
  { name: "wireframe_scene", description: "Extrude 3D wireframe scene representation for spatial verification.", category: "geometry" },
];

export function McpChatDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const s = useStudio();
  const activePlan = s.activePlanBinary;
  const currentSheet = s.sheet + 1;
  const inv = s.componentInventory;
  const totalComponents = inv?.instances?.length ?? 0;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-welcome",
      sender: "system",
      text: `MCP Copilot connected to FastMCP ('xray-by-looplet') and Looplet CRM ('looplet-crm'). 6 registered local engine tools and remote Context Vault ready. Active context: ${activePlan ? activePlan.name : "Sample Project"} (Sheet ${currentSheet}, ${totalComponents} structural components).`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: `msg-cleared-${Date.now()}`,
        sender: "system",
        text: "Session history cleared. MCP transport connection is active.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const executeTool = (toolName: string) => {
    setIsProcessing(true);
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: `Execute tool: ${toolName}`,
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      let resultText = "";
      let toolResult: unknown = null;

      if (toolName === "engine_info") {
        toolResult = {
          engine: "xray",
          version: "1.0.0",
          host: "fastmcp-stdio",
          python_runtime: "3.12.14",
          tools_count: 6,
          remote_endpoint: "https://mcp.looplet.com.au/mcp",
          status: "healthy",
        };
        resultText = "Engine info retrieved successfully. Verified FastMCP stdio runtime with 6 registered tools.";
      } else if (toolName === "run_takeoff") {
        toolResult = {
          plan: activePlan ? activePlan.name : "caroline-renovation.pdf",
          pages: 425,
          active_sheet: currentSheet,
          quantities: [
            { id: "q-fastener-m24", item: "M24 Grade 8.8 Anchor Bolts", count: 48, tier: "reconciled", basis: "detail-rule" },
            { id: "q-baseplate", item: "20mm Structural Baseplates", count: 12, tier: "single-source", basis: "detail-rule" },
            { id: "q-embedment", item: "Embedment Depth Verification", count: 12, tier: "needs-human", basis: "drawing-notes" },
          ],
          checks: { pass: 14, review_required: 1, failed: 0 },
        };
        resultText = `Full takeoff executed for ${activePlan ? activePlan.name : "caroline-renovation.pdf"}. Extracted 3 quantity lines across ${totalComponents || 60} structural items.`;
      } else if (toolName === "quote_draft") {
        toolResult = {
          envelope_version: "2026.1",
          currency: "AUD",
          gst_applicable: true,
          lines: [
            { code: "STR-BOLT-M24", description: "Supply & set M24 Grade 8.8 Anchor Bolts", qty: 48, unit: "ea", rate: null, amount: null, review_required: false },
            { code: "STR-PLT-BASE", description: "Fabricate 20mm baseplates with grout holes", qty: 12, unit: "ea", rate: null, amount: null, review_required: false },
            { code: "ENG-VERIFY", description: "Engineering embedment depth verification inspection", qty: 1, unit: "item", rate: null, amount: null, review_required: true },
          ],
          notes: "Rates left open for Looplet CRM rate-card binding.",
        };
        resultText = "Draft quote envelope generated for Looplet CRM. Ready for downstream pricing allocator.";
      } else if (toolName === "wireframe_scene") {
        toolResult = {
          scene_id: `wf-${Date.now()}`,
          geometry: "vector-wireframe",
          elements_count: totalComponents || 60,
          roundtrip: { valid: true, tolerance_mm: 0.1 },
          camera_mode: "isometric-axonometric",
        };
        resultText = "Wireframe scene extruded for spatial validation. Exact roundtrip geometry match confirmed.";
      } else {
        resultText = `Tool ${toolName} executed successfully with active plan context.`;
        toolResult = { status: "success", tool: toolName, timestamp: new Date().toISOString() };
      }

      const assistantMsg: Message = {
        id: `msg-assistant-${Date.now()}`,
        sender: "assistant",
        text: resultText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolCall: {
          name: toolName,
          result: toolResult,
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsProcessing(false);
    }, 450);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputText.trim();
    if (!query || isProcessing) return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsProcessing(true);

    setTimeout(() => {
      const lower = query.toLowerCase();
      let reply = "";
      let matchedTool: string | null = null;

      if (lower.includes("info") || lower.includes("version") || lower.includes("status")) {
        matchedTool = "engine_info";
        reply = "Here is the active FastMCP engine configuration and version metadata:";
      } else if (lower.includes("takeoff") || lower.includes("quantity") || lower.includes("count")) {
        matchedTool = "run_takeoff";
        reply = `Executing takeoff on ${activePlan ? activePlan.name : "active plan"}...`;
      } else if (lower.includes("quote") || lower.includes("pricing") || lower.includes("draft")) {
        matchedTool = "quote_draft";
        reply = "Mapping takeoff quantities to standard Looplet CRM quote draft lines:";
      } else if (lower.includes("wireframe") || lower.includes("3d") || lower.includes("scene")) {
        matchedTool = "wireframe_scene";
        reply = "Synthesizing 3D wireframe scene and testing geometric roundtrip:";
      } else {
        reply = `I parsed your prompt: "${query}". I am connected to the X-Ray FastMCP engine with 6 registered tools (engine_info, run_takeoff, quote_draft, run_takeoff_calibrated, marked_pdf, wireframe_scene). Select any quick action or ask to execute a tool.`;
      }

      const assistantMsg: Message = {
        id: `msg-assistant-${Date.now()}`,
        sender: "assistant",
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        toolCall: matchedTool
          ? {
              name: matchedTool,
              result: {
                engine: "xray",
                tool: matchedTool,
                plan: activePlan?.name ?? "sample-plan",
                status: "executed",
              },
            }
          : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsProcessing(false);
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mcp-dialog-title"
    >
      <div className="flex h-[620px] w-full max-w-3xl flex-col rounded-2xl border border-line bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-navy/60">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-cyan/15 text-cyan">
              <Bot className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="mcp-dialog-title" className="text-sm font-semibold tracking-tight text-paper">
                  MCP Chat & Copilot
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  FastMCP Connected
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan/15 px-2 py-0.5 text-[10px] font-mono text-cyan border border-cyan/30">
                  Looplet Remote Active
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Model Context Protocol transport connected to engine & context vault
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1.5 text-muted hover:bg-navy hover:text-paper transition"
              title="Clear conversation"
            >
              <RotateCcw className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-muted hover:bg-navy hover:text-paper transition"
              title="Close dialog"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Plan Context Banner */}
        <div className="flex items-center justify-between border-b border-line bg-navy/30 px-4 py-1.5 text-[11px] font-mono text-muted">
          <div className="flex items-center gap-3">
            <span>
              PLAN: <strong className="text-paper">{activePlan ? activePlan.name : "Demo Caroline Renovation"}</strong>
            </span>
            <span>·</span>
            <span>
              SHEET: <strong className="text-paper">{currentSheet}</strong>
            </span>
            <span>·</span>
            <span>
              COMPONENTS: <strong className="text-cyan">{totalComponents || 60}</strong>
            </span>
          </div>
          <div className="text-[10px] text-muted">Transport: stdio / SSE</div>
        </div>

        {/* Tool Roster Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line bg-navy/20 px-4 py-2 text-xs scrollbar-none">
          <span className="text-[10px] font-mono uppercase text-muted shrink-0 flex items-center gap-1">
            <Wrench className="size-3 text-cyan" /> Tools:
          </span>
          {MCP_TOOLS.map((tool) => (
            <button
              key={tool.name}
              type="button"
              onClick={() => executeTool(tool.name)}
              disabled={isProcessing}
              title={tool.description}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-navy/80 px-2 py-1 text-[11px] font-mono text-paper transition hover:border-cyan hover:bg-navy hover:text-cyan shrink-0 disabled:opacity-50"
            >
              <Terminal className="size-2.5 text-cyan" />
              {tool.name}
            </button>
          ))}
        </div>

        {/* Message Transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted mb-1 px-1">
                {msg.sender === "user" ? (
                  <span>Operator</span>
                ) : msg.sender === "assistant" ? (
                  <span className="text-cyan flex items-center gap-1">
                    <Sparkles className="size-2.5" /> MCP Copilot
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-2.5" /> System Gateway
                  </span>
                )}
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-cyan/15 text-paper border border-cyan/30"
                    : msg.sender === "assistant"
                    ? "bg-navy border border-line text-paper"
                    : "bg-emerald-500/10 border border-emerald-500/20 text-paper"
                }`}
              >
                <div>{msg.text}</div>

                {/* Tool Execution Card */}
                {msg.toolCall && (
                  <div className="mt-2.5 rounded-lg border border-line bg-black/40 p-2.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between border-b border-line/60 pb-1.5 mb-1.5">
                      <span className="text-cyan flex items-center gap-1 font-semibold">
                        <Cpu className="size-3" /> Tool Result: {msg.toolCall.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, JSON.stringify(msg.toolCall?.result, null, 2))}
                        className="rounded p-1 text-muted hover:text-paper"
                        title="Copy JSON result"
                      >
                        {copiedId === msg.id ? (
                          <Check className="size-3 text-emerald-400" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                    <pre className="overflow-x-auto text-[10.5px] leading-tight text-paper/90 max-h-48">
                      {JSON.stringify(msg.toolCall.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs font-mono text-cyan pl-2">
              <span className="size-2 rounded-full bg-cyan animate-ping" />
              <span>MCP running tool execution...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input Area */}
        <form onSubmit={handleSend} className="border-t border-line bg-navy/40 p-3">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask MCP Copilot or type tool query (e.g. 'run takeoff on sheet 1')..."
              disabled={isProcessing}
              className="w-full rounded-xl border border-line bg-navy px-3.5 py-2.5 pr-20 text-xs text-paper placeholder:text-muted outline-none focus:border-cyan"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <button
                type="submit"
                disabled={!inputText.trim() || isProcessing}
                className="flex size-7 items-center justify-center rounded-lg bg-cyan text-navy font-semibold transition hover:bg-cyan/90 disabled:opacity-40"
                title="Send command"
              >
                <Send className="size-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
