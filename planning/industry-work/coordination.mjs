import { industries } from '../professional-coverage/industries.mjs';

// Root owns shared contracts, UI integration, canonical ledgers and git staging.
// These assignments authorize no worker writes outside its listed paths.
const active = new Map([
  ['IND-29', 'roofing'],
  ['IND-30', 'hvac'],
  ['IND-38', 'quantity-surveying'],
]);
// IND-01 is first priority but owns no directory: its core is shared, so its work is
// assigned per file and grants no worker a whole tree. IND-43 is retained but deferred
// and consumes no worker slot. Neither takes a `worker` entry, so both keep the
// exclusive-path set disjoint.
const firstPriority = 'IND-01';
const deferred = new Set(['IND-43']);
export const assignments = industries.map(({ id, name }) => {
  const worker = active.get(id);
  return {
    id, name, worker: worker ?? null,
    state: worker ? 'assigned'
      : id === firstPriority ? 'first-priority'
      : deferred.has(id) ? 'deferred' : 'queued',
    writePaths: worker ? [
      `src/studio/industries/${worker}/`,
      `planning/industry-work/${worker}.md`,
      `proof/growth/2026-09-13-industry-agents/${worker}/`,
    ] : [],
  };
});

export function validateOwnership(rows = assignments) {
  const ids = new Set();
  const paths = [];
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error(`Duplicate industry: ${row.id}`);
    ids.add(row.id);
    for (const path of row.writePaths) {
      if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
        throw new Error(`Invalid ownership path: ${path}`);
      }
      for (const previous of paths) {
        if (path === previous || (previous.endsWith('/') && path.startsWith(previous)) ||
          (path.endsWith('/') && previous.startsWith(path))) {
          throw new Error(`Overlapping ownership: ${previous} / ${path}`);
        }
      }
      paths.push(path);
    }
  }
  return { industries: ids.size, ownedPaths: paths.length };
}
