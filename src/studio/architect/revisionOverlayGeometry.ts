import { primitives, type Primitive } from './drawing.ts';
import type { ArchitectProject, Point } from './model.ts';
import { drawingBounds } from './sheets.ts';

export type OverlayAlignment = { x: number; y: number; rotation: number };
export const originalAlignment: OverlayAlignment = { x: 0, y: 0, rotation: 0 };

export function alignOverlayPoint([x, y]: Point, alignment: OverlayAlignment): Point {
  if (![alignment.x, alignment.y, alignment.rotation].every(Number.isFinite)) throw Error('Alignment must be finite.');
  const angle = alignment.rotation * Math.PI / 180;
  return [x * Math.cos(angle) - y * Math.sin(angle) + alignment.x,
    x * Math.sin(angle) + y * Math.cos(angle) + alignment.y];
}

export function overlayPlan(project: ArchitectProject, levelId: string): Primitive[] {
  if (!project.levels.some(level => level.id === levelId)) throw Error('The selected level is not present in this revision.');
  return primitives(project, levelId, 'plan');
}

export function overlayViewBox(before: Primitive[], after: Primitive[], alignment: OverlayAlignment): string {
  const box = drawingBounds(before);
  const corners: Point[] = [box.min, box.max, [box.min[0], box.max[1]], [box.max[0], box.min[1]]];
  const target = drawingBounds(after);
  const points = [...corners.map(point => alignOverlayPoint(point, alignment)), target.min, target.max];
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  const width = Math.max(1000, Math.max(...points.map(p => p[0])) - minX);
  const height = Math.max(1000, Math.max(...points.map(p => p[1])) - minY);
  const pad = Math.max(width, height) * 0.05;
  return `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`;
}

/** Colour only; model coordinates and quantities never change. */
export function overlayInk(items: Primitive[], colour: string, changed: Set<string>, changesOnly: boolean): Primitive[] {
  return items.filter(item => !changesOnly || (item.id && changed.has(item.id))).map(item => ({
    ...item,
    fill: item.kind === 'text' ? colour : 'none',
    stroke: item.kind === 'text' ? undefined : colour,
    width: Math.max(item.width ?? 10, item.id && changed.has(item.id) ? 28 : 12),
  }));
}
