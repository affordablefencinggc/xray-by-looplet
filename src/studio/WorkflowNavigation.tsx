import { AdjustableTopRow } from './AdjustableTopRow';
import type { Pane } from './store';
import './workflowNavigation.css';

const workflows: { label: string; panes: { id: Pane; label: string }[]; hint: string }[] = [
  { label: 'Drawings', panes: [{ id: 'sheets', label: 'Sheets & files' }], hint: 'Open and organise your source drawings' },
  { label: 'Takeoff', panes: [{ id: 'measure', label: 'Measure' }, { id: 'components', label: 'Quantities & components' }], hint: 'Set the scale, then measure' },
  { label: 'Design', panes: [{ id: 'sketch', label: 'Sketch & redesign' }], hint: 'Draw and edit your building' },
  { label: 'Visualise', panes: [{ id: 'model', label: '3D viewer' }, { id: 'render', label: 'Renders' }], hint: 'Explore and present your design' },
  { label: 'Estimate', panes: [{ id: 'cost', label: 'Costs & pricing' }], hint: 'Review quantities and build your estimate' },
];
const checks: { id: Pane; label: string }[] = [{ id: 'review', label: 'Review issues' }, { id: 'proof', label: 'Evidence & exports' }];

export function WorkflowNavigation({ pane, onSelect }: { pane: Pane; onSelect: (pane: Pane) => void }) {
  const workflow = workflows.find(w => w.panes.some(p => p.id === pane));
  const checking = checks.some(p => p.id === pane);
  const items = checking ? checks : workflow?.panes ?? [{ id: 'overview' as Pane, label: 'Project overview' }];
  const select = (next: Pane) => { window.dispatchEvent(new CustomEvent("xray:expand-top-row", { detail: "mode" })); onSelect(next); };
  return <>
    <AdjustableTopRow id="navigation" label="Navigation" minHeight={44}>
      <nav className="workflow-nav" aria-label="Main workflow">
        <div className="workflow-main-tabs">{workflows.map(w => <button key={w.label} type="button" aria-current={workflow === w ? 'page' : undefined}
          onClick={() => select(workflow === w ? pane : w.panes[0].id)}>{w.label}</button>)}</div>
        <button type="button" className="workflow-checks" aria-current={checking ? 'page' : undefined}
          onClick={() => select(checking ? pane : 'review')}>Checks</button>
      </nav>
    </AdjustableTopRow>
    <AdjustableTopRow id="mode" label="Workspace tools" minHeight={44} compact>
      <nav className="workflow-context" aria-label="Workspace tools">
        <div className="workflow-context-controls">
        <span className="workflow-context-label">{checking ? 'Checks' : workflow?.label ?? 'Project'}</span>
        {items.map(p => <button key={p.id} type="button" aria-current={pane === p.id ? 'page' : undefined}
          onClick={() => onSelect(p.id)}>{p.label}</button>)}
        </div>
        <span className="workflow-context-hint">{checking ? 'Review issues and supporting evidence' : workflow?.hint ?? 'Your project at a glance'}</span>
      </nav>
    </AdjustableTopRow>
  </>;
}
