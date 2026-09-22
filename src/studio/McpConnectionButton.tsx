import { useState } from 'react';
import { Plug, RefreshCw, Copy } from 'lucide-react';
import { WorkspaceDialog } from './WorkspaceDialog';

export function McpConnectionButton() {
  const [open, setOpen] = useState(false), [checking, setChecking] = useState(false);
  const [config, setConfig] = useState(''), [status, setStatus] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  async function load() {
    setStatus('Loading external model connection settings…');
    try {
      const response = await fetch('/api/mcp-connection'); const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setConfig(JSON.stringify(data.config, null, 2)); setStatus('Configuration ready. Test the external MCP server below.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'External MCP configuration unavailable.'); }
  }
  async function inspect() {
    setChecking(true); setTools([]); setStatus('Starting an external MCP client and testing the engine…');
    try {
      const response = await fetch('/api/mcp-connection', { method: 'POST' }); const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setTools(data.tools); setStatus(`External MCP verified: ${data.tools.length} engine tools discovered and engine_info executed successfully.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'External MCP check failed.'); }
    finally { setChecking(false); }
  }
  return <>
    <button type="button" className="pill" aria-label="MCP connections" title="Connect external models to X-Ray" onClick={() => { setOpen(true); void load(); }}><Plug size={16} /> MCP</button>
    {open && <WorkspaceDialog title="External model connections" onClose={() => setOpen(false)}>
      <div className="mcp-connection-body">
        <p>Connect Claude Desktop, Cursor or another MCP-compatible client to the X-Ray engine on this computer. Your external model launches the server when it connects.</p>
        <p role="status">{status}</p>
        <button type="button" className="pill" disabled={checking || !config} onClick={() => void inspect()}><RefreshCw size={16} /> Test external connection</button>
        <p>Transport: <strong>stdio</strong>. No URL, port or built-in model selection is required.</p>
        <details open><summary>External client configuration</summary><pre>{config || 'Configuration unavailable on this host.'}</pre></details>
        <button type="button" className="pill" disabled={!config} onClick={() => { void navigator.clipboard.writeText(config).then(() => setStatus('External MCP configuration copied.'), () => setStatus('Clipboard unavailable. Select the configuration text to copy it.')); }}><Copy size={16} /> Copy configuration</button>
        <p>These engine tools read source files, perform takeoff and calibration, and produce marked PDFs and wireframe scenes. They do not control the open chat or automatically read this browser’s unsaved project.</p>
        {!!tools.length && <details><summary>Verified external tools ({tools.length})</summary><ul>{tools.map(name => <li key={name}>{name}</li>)}</ul></details>}
      </div>
    </WorkspaceDialog>}
  </>;
}
