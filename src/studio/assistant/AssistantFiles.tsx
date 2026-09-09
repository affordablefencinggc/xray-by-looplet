import { useEffect, useState } from 'react';
import { getAssistantFile, listAssistantFiles, type AssistantFile } from './attachmentFiles';
import './assistantFiles.css';

export function AssistantFiles({ projectId, refresh, onAttach, disabled }: { projectId: string; refresh: number; onAttach: (file: AssistantFile) => void; disabled: boolean }) {
  const [files, setFiles] = useState<AssistantFile[]>([]), [error, setError] = useState('');
  useEffect(() => {
    let active = true; setFiles([]); setError('');
    void listAssistantFiles(projectId).then(value => { if (active) setFiles(value); }, e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [projectId, refresh]);
  if (!files.length && !error) return null;
  return <details className="assistant-files"><summary>Project files · {files.length}</summary>
    {error && <p role="alert">{error}</p>}
    <div className="assistant-files-list">{files.map(file => <div key={file.id}>
      <span title={file.name}>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} MB · original saved</small></span>
      <button type="button" disabled={disabled} onClick={() => onAttach(file)} aria-label={`Attach ${file.name}`}>Attach</button>
      <button type="button" aria-label={`Download original ${file.name}`} onClick={() => {
        void getAssistantFile(projectId, file.id).then(({ blob }) => {
          const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }).catch(e => setError(String(e)));
      }}>↓</button>
    </div>)}</div>
  </details>;
}
