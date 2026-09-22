import { useState } from 'react';
import { Plug, RefreshCw } from 'lucide-react';
import { WorkspaceDialog } from './WorkspaceDialog';
import { getAssistantMcp, useAssistantConnection } from './assistant/session';
import { assistantStatus } from './assistant/transport';
import { useAssistantProvider } from './assistant/provider';

export function McpConnectionButton() {
  const connection = useAssistantConnection();
  const provider = useAssistantProvider(s => s.provider);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');
  async function inspect() {
    setChecking(true);
    setStatus('Checking workspace tools and AI provider…');
    try {
      const [session, ai] = await Promise.all([getAssistantMcp(), assistantStatus(provider)]);
      setStatus(`${session.tools.length} workspace tools connected. ${ai.message}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Connection check failed.'); }
    finally { setChecking(false); }
  }
  return <>
    <button type="button" className="pill" aria-label="MCP connections" title={connection.connected ? `${connection.names.length} workspace tools connected` : 'Check MCP connection'} onClick={() => { setOpen(true); void inspect(); }}>
      <Plug size={16} /> MCP
    </button>
    {open && <WorkspaceDialog title="MCP connections" onClose={() => setOpen(false)}>
      <div className="mcp-connection-body">
      <p>MCP connects the live assistant to X-Ray’s workspace tools. The built-in connection starts automatically; no server address is needed.</p>
      <p role="status">{status}</p>
      <p>Selected AI provider: <strong>{provider === 'minimax' ? 'MiniMax' : 'Gemini'}</strong>. Change it beside the live assistant’s message box.</p>
      <button type="button" className="pill" disabled={checking} onClick={() => void inspect()}><RefreshCw size={16} /> Check connection</button>
      <p>AI provider availability is separate from the workspace tool connection. Existing project-edit permissions still apply.</p>
      <details><summary>Available workspace tools ({connection.names.length})</summary><ul>{connection.names.map(name => <li key={name}>{name}</li>)}</ul></details>
      {connection.error && <p role="alert">{connection.error}</p>}
      </div>
    </WorkspaceDialog>}
  </>;
}
