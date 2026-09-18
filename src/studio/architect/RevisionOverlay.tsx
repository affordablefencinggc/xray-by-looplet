import { useMemo, useState } from 'react';
import type { ArchitectProject } from './model';
import type { IssueRecord } from './issueHistory';
import { extractProjectModel, type RevisionDeltaReport } from './revisionDelta';
import { DrawingPrimitives } from './DrawingPrimitives';
import { originalAlignment, overlayInk, overlayPlan, overlayViewBox } from './revisionOverlayGeometry';
import { cloudedRevision, revisionDeltaRegister } from './revisionClouding';
import './revisionOverlay.css';

export function RevisionOverlay({ baseline, target, report }: {
  baseline: IssueRecord; target: IssueRecord | ArchitectProject; report: RevisionDeltaReport;
}) {
  const before = useMemo(() => extractProjectModel(baseline), [baseline]);
  const after = useMemo(() => extractProjectModel(target), [target]);
  const [beforeLevel, setBeforeLevel] = useState(before.levels[0]?.id ?? '');
  const [afterLevel, setAfterLevel] = useState(after.levels[0]?.id ?? '');
  const [alignment, setAlignment] = useState(originalAlignment);
  const [showBefore, setShowBefore] = useState(true), [showAfter, setShowAfter] = useState(true);
  const [changesOnly, setChangesOnly] = useState(false), [opacity, setOpacity] = useState(0.65);
  const [showClouds, setShowClouds] = useState(false);
  const activeBeforeLevel = before.levels.some(l => l.id === beforeLevel) ? beforeLevel : before.levels[0]?.id;
  const activeAfterLevel = after.levels.some(l => l.id === afterLevel) ? afterLevel : after.levels[0]?.id;
  // Clouds are drawn over the later revision's plan, on the level being shown there.
  const clouded = useMemo(() => {
    try {
      if (!showClouds || !activeAfterLevel) return null;
      const register = revisionDeltaRegister(report.geometry, before, after);
      return cloudedRevision(register, activeAfterLevel, after, report.target.designRevision || report.target.revision);
    } catch { return null; }
  }, [showClouds, report, before, after, activeAfterLevel]);
  const changes = useMemo(() => {
    const ids = new Set<string>();
    for (const group of [report.geometry.walls, report.geometry.openings, report.geometry.slabs, report.geometry.roofs]) {
      for (const item of [...group.added, ...group.removed, ...group.changed]) ids.add(item.id);
    }
    for (const item of report.annotations.items) if (item.id.includes(':')) ids.add(item.id.slice(item.id.indexOf(':') + 1));
    // A moved/changed wall also moves its hosted opening and dimension symbols.
    for (const project of [before, after]) {
      for (const item of [...project.openings, ...project.dimensions]) if (ids.has(item.wallId)) ids.add(item.id);
    }
    return ids;
  }, [report, before, after]);
  const plans = useMemo(() => {
    try {
      if (!activeBeforeLevel || !activeAfterLevel) throw Error('Both revisions need a level to show a plan overlay.');
      return { before: overlayPlan(before, activeBeforeLevel), after: overlayPlan(after, activeAfterLevel), error: '' };
    } catch (error) { return { before: [], after: [], error: error instanceof Error ? error.message : 'Plan overlay unavailable.' }; }
  }, [before, after, activeBeforeLevel, activeAfterLevel]);
  return <details className="revision-overlay">
    <summary>Plan revision overlay</summary>
    <p>Earlier revision in rose; later revision in blue. Changed elements have heavier outlines. Alignment applies only to this preview; saved coordinates and quantity differences stay unchanged.</p>
    <div className="revision-overlay-controls">
      <label>Earlier level<select aria-label="Earlier revision level" value={activeBeforeLevel ?? ''} onChange={e => setBeforeLevel(e.target.value)}>{before.levels.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
      <label>Later level<select aria-label="Later revision level" value={activeAfterLevel ?? ''} onChange={e => setAfterLevel(e.target.value)}>{after.levels.map(l => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
      <label><input type="checkbox" checked={showBefore} onChange={e => setShowBefore(e.target.checked)} />Earlier · Rev {report.baseline.revision}</label>
      <label><input type="checkbox" checked={showAfter} onChange={e => setShowAfter(e.target.checked)} />Later · Rev {report.target.revision}</label>
      <label><input type="checkbox" checked={changesOnly} onChange={e => setChangesOnly(e.target.checked)} />Changed elements only</label>
      <label><input type="checkbox" checked={showClouds} onChange={e => setShowClouds(e.target.checked)} />Revision clouds</label>
    </div>
    <div className="revision-overlay-controls">
      {(['x', 'y', 'rotation'] as const).map(axis => <label key={axis}>{axis === 'rotation' ? 'Earlier rotation (°)' : `Earlier ${axis.toUpperCase()} (mm)`}<input type="number" aria-label={`Earlier ${axis}`} min={axis === 'rotation' ? -180 : -1000000} max={axis === 'rotation' ? 180 : 1000000} step={axis === 'rotation' ? 1 : 100} value={alignment[axis]} onChange={e => { const value = e.target.valueAsNumber; if (Number.isFinite(value)) setAlignment(current => ({ ...current, [axis]: Math.max(axis === 'rotation' ? -180 : -1000000, Math.min(axis === 'rotation' ? 180 : 1000000, value)) })); }} /></label>)}
      <label>Earlier opacity<input aria-label="Earlier opacity" type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>
      <button type="button" onClick={() => setAlignment(originalAlignment)}>Reset alignment</button>
    </div>
    {plans.error ? <p role="alert">{plans.error}</p> : <>
      <svg role="img" aria-label="Plan overlay of earlier and later revisions" className="revision-overlay-plan" viewBox={overlayViewBox(plans.before, plans.after, alignment)}>
        {showBefore && <g data-overlay-layer="earlier" opacity={opacity} transform={`translate(${alignment.x} ${alignment.y}) rotate(${alignment.rotation})`}><DrawingPrimitives items={overlayInk(plans.before, '#b33c68', changes, changesOnly)} /></g>}
        {showAfter && <g data-overlay-layer="later"><DrawingPrimitives items={overlayInk(plans.after, '#176aaf', changes, changesOnly)} /></g>}
        {clouded && <g data-overlay-layer="clouds" aria-label={`Revision clouds for Rev ${clouded.revision}`}>
          {clouded.clouds.map(cloud => <polyline
            key={cloud.id}
            data-cloud-id={cloud.id}
            data-cloud-status={cloud.status}
            points={cloud.points.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke="#c2410c"
            strokeWidth={Math.max(cloud.scallopRadius / 3, 6)}
            strokeLinejoin="round"
          />)}
          {clouded.marks.map(mark => <text
            key={mark.id}
            data-delta-mark={mark.id}
            x={mark.anchor[0]}
            y={mark.anchor[1]}
            fill="#c2410c"
            fontSize={Math.max(clouded.clouds.find(c => mark.id === `mark:${c.id}`)?.scallopRadius ?? 60, 40) * 1.6}
            fontWeight="700"
          >{mark.label}</text>)}
        </g>}
      </svg>
      {!showBefore && !showAfter && <p role="status">Both layers are hidden. Enable a revision above to show it.</p>}
      {changesOnly && <p>Only changed elements visible on the selected levels are shown. Notes and specification-only edits may have no visible shape difference; read the detailed comparison below.</p>}
      {showClouds && clouded && clouded.entries === 0 && <p role="status">No geometric changes are recorded on this level, so there is nothing to cloud.</p>}
      {showClouds && clouded && clouded.entries > 0 && <p className="revision-cloud-note" data-cloud-count={clouded.entries}>{clouded.entries} revision cloud{clouded.entries === 1 ? '' : 's'} mark the changed work on this level. Each encloses the union of an element's earlier and later position, so a relocated wall is clouded where it was as well as where it is.</p>}
    </>}
  </details>;
}
