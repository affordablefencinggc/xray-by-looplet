import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const KEY = 'xray:plan-model-split:v1';
export function clampPlanSplit(value: number) { return Number.isFinite(value) ? Math.min(75, Math.max(25, value)) : 52; }

export function PlanModelSplit({ plan, model }: { plan: ReactNode; model: ReactNode }) {
  const [split, setSplit] = useState(52);
  useEffect(() => { try { const saved = localStorage.getItem(KEY); if (saved !== null) setSplit(clampPlanSplit(Number(saved))); } catch { /* session layout remains usable */ } }, []);
  function update(value: number) {
    const next = clampPlanSplit(value); setSplit(next);
    try { localStorage.setItem(KEY, String(next)); } catch { /* session layout remains usable */ }
  }
  return <div className={`arch-canvases ${model ? 'with-three' : ''}`} style={{ '--plan-split': `${split}fr`, '--model-split': `${100 - split}fr` } as CSSProperties}>
    {plan}
    {model && <><div className="arch-view-divider" role="separator" aria-label="Resize plan and 3D view" aria-orientation="vertical" aria-valuemin={25} aria-valuemax={75} aria-valuenow={split} tabIndex={0}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const box = event.currentTarget.parentElement!.getBoundingClientRect(); update((event.clientX - box.left) / box.width * 100); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) { event.preventDefault(); update(event.key === 'Home' ? 52 : split + (event.key === 'ArrowLeft' ? -2 : 2)); } }}
      title="Drag left or right to resize. Arrow keys adjust; Home resets." />{model}</>}
  </div>;
}
