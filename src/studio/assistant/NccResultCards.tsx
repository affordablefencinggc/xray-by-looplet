import { TopDownMindMap } from './TopDownMindMap';
import { CopyAction } from './CopyAction';
import { useDiagramPreferences } from './diagramPreferences';
import type { NccMatch } from './nccReferences';
import { nccDocumentLabel, readNccMatches } from './nccResultReferences';
import './nccResultCards.css';

export function NccResultCards({ receipt, selected, disabled, onSelect }: {
  receipt: string; selected: NccMatch[]; disabled: boolean; onSelect: (match: NccMatch) => void;
}) {
  const showMap=useDiagramPreferences(state=>state.ncc);
  let matches: NccMatch[] = [];
  try { matches = readNccMatches(JSON.parse(receipt).matches); } catch { return null; }
  if (!matches.length) return null;
  const groups = new Map<string, NccMatch[]>();
  for (const match of matches) groups.set(match.sha256, [...(groups.get(match.sha256) ?? []), match]);
  return <section className="assistant-ncc-results" aria-label="NCC reference results">
    {showMap && <TopDownMindMap label="NCC reference mind map" root={{label:"Matched NCC references",children:[...groups.values()].map(pages=>({label:nccDocumentLabel(pages[0].documentName),children:pages.map(page=>({label:`PDF page ${page.page}${page.section ? ` - ${page.section}` : ''}`,children:[]}))}))}}/>}
    <small className="assistant-ncc-hint">Click below to reference</small>
    {[...groups].map(([hash, pages]) => <div className="assistant-ncc-result-group assistant-copy-target" key={hash}>
      <strong>{nccDocumentLabel(pages[0].documentName)}</strong>
      <CopyAction label="document references" text={pages.map(page=>`${page.documentName} · ${page.edition} · PDF page ${page.page}\n${page.text}`).join('\n\n')}/>
      <small>{pages[0].edition} · {pages.length} matching {pages.length === 1 ? 'page' : 'pages'}</small>
      <div className="assistant-ncc-page-pills">
        {pages.map(match => {
          const added = selected.some(r => r.id === match.id);
          return <button type="button" className="assistant-pill" key={match.id} aria-pressed={added}
            aria-label={`Reference ${nccDocumentLabel(match.documentName)}, PDF page ${match.page}`}
            title={match.text} disabled={disabled || (!added && selected.length >= 6)} onClick={() => onSelect(match)}>
            {added ? '✓ ' : '+ '}{match.section ? `${match.section} · ` : ''}PDF p. {match.page}
          </button>;
        })}
      </div>
    </div>)}
  </section>;
}
