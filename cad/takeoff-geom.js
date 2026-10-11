// takeoff-geom.js — the pure geometry/indexing math behind the CAD rail's
// click-to-highlight. Extracted from cad.html so it can be unit-tested headless
// (no DOM, no pdf.js, no browser). cad.html imports these; the module must stay
// free of any DOM reference.
//
// Why this exists: highlight correctness depends on three easy-to-break rules —
// the 0-based/1-based page mismatch, evidence ids that may point at a check
// rather than an entity, and the bbox->CSS-pixel mapping. A browser drive proves
// them once; these tests prove them on every run.

/**
 * Engine quirk: `entity.page` is 0-based, but `document.pages[].n` and pdf.js
 * page numbers are 1-based. Detect the base from the data rather than assuming,
 * so a takeoff that is already 1-based is not shifted off the end of the set.
 *
 * @param {Array<{page?: number}>} entities
 * @returns {number} offset to ADD to entity.page to get a pdf.js page number
 */
export function detectPageOffset(entities) {
  let minP = Infinity;
  for (const e of entities || []) {
    if (Number.isInteger(e?.page)) minP = Math.min(minP, e.page);
  }
  return minP === 0 ? 1 : 0;
}

/**
 * Build id -> object lookups for entities and checks.
 * @returns {{entIndex: Map, chkIndex: Map}}
 */
export function indexTakeoff(takeoff) {
  const entIndex = new Map();
  const chkIndex = new Map();
  for (const e of takeoff?.entities || []) if (e?.id) entIndex.set(e.id, e);
  for (const c of takeoff?.checks || []) if (c?.id) chkIndex.set(c.id, c);
  return { entIndex, chkIndex };
}

/**
 * Resolve one quantity's `evidence` ids into locatable boxes.
 *
 * An evidence id may name an entity (has a bbox directly) OR a check, whose own
 * `evidence` list names entities — so checks are followed one level. Entries
 * that resolve to nothing, or that lack a usable bbox/page, are dropped rather
 * than emitted as a box at (0,0).
 *
 * @returns {Array<{page: number, bbox: number[]}>} page is 1-based (pdf.js)
 */
export function resolveEvidence(quantity, entIndex, chkIndex, pageOffset = 0) {
  const out = [];
  const add = (ent) => {
    if (ent && Array.isArray(ent.bbox) && ent.bbox.length === 4 && Number.isInteger(ent.page)) {
      out.push({
        page: ent.page + (pageOffset || 0),
        bbox: ent.bbox,
        id: ent.id || '',
        text: ent.text || ent.label || '',
      });
    }
  };
  for (const id of quantity?.evidence || []) {
    if (entIndex.has(id)) add(entIndex.get(id));
    else if (chkIndex.has(id)) {
      for (const eid of chkIndex.get(id).evidence || []) add(entIndex.get(eid));
    }
  }
  return out;
}

/**
 * Map a bbox in PDF points to CSS pixels for the overlay.
 *
 * bbox is [x0,y0,x1,y1] with a top-left origin, y-down, in points — the same
 * convention the overlay uses, so this is a pure scale with no flip. Width and
 * height are floored at MIN_PX so a zero-height entity stays clickable/visible.
 *
 * NOTE: assumes the page media box starts at (0,0), true for effectively all
 * plans. If a plan ever has a non-zero media-box origin, map through pdf.js
 * `viewport.convertToViewportPoint` instead.
 */
export const MIN_PX = 4;

export function bboxToCss(bbox, cssScale) {
  const [x0, y0, x1, y1] = bbox;
  return {
    left: x0 * cssScale,
    top: y0 * cssScale,
    width: Math.max(MIN_PX, (x1 - x0) * cssScale),
    height: Math.max(MIN_PX, (y1 - y0) * cssScale),
  };
}

/**
 * CSS px per PDF point for a page: the fit width times the zoom, over the page
 * width in points. Highlights and canvas MUST use the same value or boxes drift
 * from the text on zoom.
 */
export function cssScaleFor(fitWidth, zoom, pageWidthPt) {
  return (fitWidth * zoom) / pageWidthPt;
}
