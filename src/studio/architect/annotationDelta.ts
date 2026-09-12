import type { ArchitectProject } from './model.ts';
import type { IssueRecord } from './issueHistory.ts';

const categories = {
  lines: 'Line', circles: 'Circle', arcs: 'Arc', grids: 'Grid',
  roomTags: 'Room tag', dimensions: 'Dimension',
} as const;

export type AnnotationChange = {
  id: string;
  category: string;
  status: 'added' | 'removed' | 'changed';
  changes: string[];
};
export type AnnotationDelta = {
  items: AnnotationChange[];
  unavailable: string[];
  counts: { added: number; removed: number; changed: number };
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'unavailable';
}

/** Compare saved drafting data; missing historical fields are never treated as empty. */
export function compareAnnotations(baseline: ArchitectProject | IssueRecord, target: ArchitectProject | IssueRecord): AnnotationDelta {
  const data = (source: ArchitectProject | IssueRecord) => 'schema' in source ? source : source.snapshot;
  const before = data(baseline), after = data(target);
  const items: AnnotationChange[] = [], unavailable: string[] = [];
  for (const [key, label] of Object.entries(categories) as [keyof typeof categories, string][]) {
    const left = before?.[key], right = after?.[key];
    if (!Array.isArray(left) || !Array.isArray(right)) { unavailable.push(`${label} comparison unavailable: a revision has no saved ${key}.`); continue; }
    const leftMap = new Map(left.map(item => [item.id, item]));
    const rightMap = new Map(right.map(item => [item.id, item]));
    for (const id of [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort()) {
      const a = leftMap.get(id), b = rightMap.get(id);
      const fields = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].filter(k => k !== 'id' && k !== 'revision').sort();
      const changes = fields.filter(k => canonical(a?.[k]) !== canonical(b?.[k])).map(k => `${k}: ${a ? canonical(a[k]) : 'absent'} → ${b ? canonical(b[k]) : 'absent'}`);
      if (!a || !b || changes.length) items.push({ id: `${key}:${id}`, category: label, status: !a ? 'added' : !b ? 'removed' : 'changed', changes });
    }
  }
  for (const [key, label] of [['notes', 'Project notes'], ['section', 'Section marker']] as const) {
    const a = before?.[key], b = after?.[key];
    if (a === undefined || b === undefined) unavailable.push(`${label} comparison unavailable: a revision has no saved ${key}.`);
    else if (canonical(a) !== canonical(b)) items.push({ id: key, category: label, status: 'changed', changes: [`${canonical(a)} → ${canonical(b)}`] });
  }
  return { items, unavailable, counts: {
    added: items.filter(i => i.status === 'added').length,
    removed: items.filter(i => i.status === 'removed').length,
    changed: items.filter(i => i.status === 'changed').length,
  } };
}
