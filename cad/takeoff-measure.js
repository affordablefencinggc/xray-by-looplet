/**
 * Pure measure math for X-Ray CAD (Bluebeam-style scale + length/area/count).
 * No DOM. Unit-testable from the app via the TS twin.
 */

/** @param {{x:number,y:number}} a @param {{x:number,y:number}} b */
export function distPx(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

/** Polyline length in pixels */
export function polylineLengthPx(points) {
  if (!points || points.length < 2) return 0
  let n = 0
  for (let i = 1; i < points.length; i++) n += distPx(points[i - 1], points[i])
  return n
}

/** Shoelace polygon area in px² (absolute) */
export function polygonAreaPx2(points) {
  if (!points || points.length < 3) return 0
  let a = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    a += points[i].x * points[j].y - points[j].x * points[i].y
  }
  return Math.abs(a) / 2
}

/**
 * Scale: known real length (metres) for a measured pixel distance.
 * @returns {number} pixels per metre
 */
export function scaleFromCalibration(pxLength, realMetres) {
  const px = Number(pxLength)
  const m = Number(realMetres)
  if (!(px > 0) || !(m > 0)) throw new Error('Calibration needs positive pixel and real length')
  return px / m
}

export function pxToMetres(px, pxPerM) {
  if (!(pxPerM > 0)) return null
  return px / pxPerM
}

export function px2ToMetres2(px2, pxPerM) {
  if (!(pxPerM > 0)) return null
  return px2 / (pxPerM * pxPerM)
}

/** Stable palette so fence posts vs mesh (etc.) stay visually distinct. */
export const MARKUP_PALETTE = [
  '#2d6cdf',
  '#0a7d33',
  '#c45c26',
  '#7b5ea7',
  '#0e8a8a',
  '#b33a3a',
  '#5c6bc0',
  '#8d6e63',
  '#00897b',
  '#d81b60',
  '#f9a825',
  '#3949ab',
]

/**
 * Group key for colour + legend: subject label first, else trade, else kind.
 * @param {object|null|undefined} m
 */
export function groupKeyForMarkup(m) {
  const subject = String(m?.subject || '').trim()
  if (subject) return subject.toLowerCase()
  const trade = String(m?.trade || '').trim()
  if (trade) return trade.toLowerCase()
  return String(m?.kind || 'measure').toLowerCase()
}

/** Display label for a group key (prefer original subject casing from markup). */
export function groupLabelForMarkup(m) {
  const subject = String(m?.subject || '').trim()
  if (subject) return subject
  const trade = String(m?.trade || '').trim()
  if (trade) return trade
  return String(m?.kind || 'Measure')
}

/**
 * @param {string} str
 */
export function hashString(str) {
  let h = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * @param {string} key
 * @param {string[]} [palette]
 */
export function colorForGroupKey(key, palette = MARKUP_PALETTE) {
  const pal = palette && palette.length ? palette : MARKUP_PALETTE
  return pal[hashString(key) % pal.length]
}

/**
 * @param {object|null|undefined} m
 * @param {string[]} [palette]
 */
export function colorForMarkup(m, palette = MARKUP_PALETTE) {
  return colorForGroupKey(groupKeyForMarkup(m), palette)
}

/**
 * #rrggbb + alpha → rgba() for area fills.
 * @param {string} hex
 * @param {number} alpha 0..1
 */
export function hexWithAlpha(hex, alpha) {
  const h = String(hex || '').replace('#', '')
  if (h.length !== 6) return `rgba(45,108,223,${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = Number(alpha)
  return `rgba(${r},${g},${b},${Number.isFinite(a) ? a : 0.2})`
}

/**
 * Legend rows: one entry per subject/label group with colour + totals.
 * Counts with the same label share a group (and colour).
 * @param {Array<object>|null|undefined} markups
 * @returns {Array<{ key:string, label:string, color:string, markupCount:number, totalQty:number, unit:string, kinds:string[] }>}
 */
export function groupMarkupsByLabel(markups) {
  /** @type {Map<string, { key:string, label:string, color:string, markupCount:number, totalQty:number, unit:string, kinds:Set<string> }>} */
  const map = new Map()
  for (const m of markups || []) {
    if (!m || m.status === 'excluded') continue
    const key = groupKeyForMarkup(m)
    let g = map.get(key)
    if (!g) {
      g = {
        key,
        label: groupLabelForMarkup(m),
        color: colorForGroupKey(key),
        markupCount: 0,
        totalQty: 0,
        unit: m.unit || '',
        kinds: new Set(),
      }
      map.set(key, g)
    }
    g.markupCount += 1
    g.kinds.add(String(m.kind || 'measure'))
    if (m.kind === 'count') g.totalQty += Math.max(1, Math.round(Number(m.qty) || 1))
    else if (Number(m.qty) > 0) g.totalQty += Number(m.qty)
    if (m.unit) g.unit = m.unit
  }
  return [...map.values()]
    .map((g) => ({
      key: g.key,
      label: g.label,
      color: g.color,
      markupCount: g.markupCount,
      totalQty: Math.round(g.totalQty * 1000) / 1000,
      unit: g.unit,
      kinds: [...g.kinds],
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

/**
 * Build a takeoff quantity from a markup.
 * Preserves subject group (item + group + color) for quote export.
 * @param {object} m
 */
export function markupToQuantity(m) {
  const tier = m.tier || 'single-source'
  const group = groupKeyForMarkup(m)
  const color = colorForMarkup(m)
  const base = {
    id: m.id,
    trade: m.trade || 'measured',
    item: m.subject || m.kind || 'Measure',
    group,
    color,
    unit: m.unit || 'ea',
    formula: m.formula || '',
    tier,
    notes: m.notes || 'Measured on plan in X-Ray',
    category: 'xray-markup',
  }
  if (m.kind === 'length') {
    return {
      ...base,
      qty: round3(m.qty),
      unit: m.unit || 'lm',
      formula: m.formula || `measured length = ${round3(m.qty)} lm`,
    }
  }
  if (m.kind === 'area') {
    return {
      ...base,
      qty: round3(m.qty),
      unit: m.unit || 'm²',
      formula: m.formula || `measured area = ${round3(m.qty)} m²`,
    }
  }
  if (m.kind === 'count') {
    return {
      ...base,
      qty: Math.max(1, Math.round(m.qty || 1)),
      unit: m.unit || 'ea',
      formula: m.formula || `count = ${Math.round(m.qty || 1)}`,
    }
  }
  return {
    ...base,
    qty: Number(m.qty) > 0 ? Number(m.qty) : 1,
  }
}

export function markupsToQuantities(markups) {
  return (markups || [])
    .filter((m) => m && m.status !== 'excluded' && Number(m.qty) > 0)
    .map(markupToQuantity)
}

/**
 * Merge engine quantities with measured markups (markups win same id).
 */
export function mergeQuantities(engineQs, markupQs) {
  const map = new Map()
  for (const q of engineQs || []) {
    const k = q.id || `${q.trade}:${q.item}:${q.qty}`
    map.set(k, q)
  }
  for (const q of markupQs || []) {
    map.set(q.id || `${q.trade}:${q.item}:${q.qty}`, q)
  }
  return [...map.values()]
}

function round3(n) {
  return Math.round(Number(n) * 1000) / 1000
}

export function newMarkupId(kind) {
  return `mu-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Undo stack helpers (pure) — last markup wins for Ctrl+Z / Undo.
 * Count markups that accumulate points: drop one point; empty count is removed.
 * @param {Array<object>} markups
 * @returns {Array<object>}
 */
export function removeLastMarkup(markups) {
  if (!markups || !markups.length) return []
  const next = markups.slice()
  const last = next[next.length - 1]
  if (last && last.kind === 'count' && Array.isArray(last.points) && last.points.length > 1) {
    const pts = last.points.slice(0, -1)
    next[next.length - 1] = {
      ...last,
      points: pts,
      qty: pts.length,
    }
    return next
  }
  next.pop()
  return next
}

/** @param {Array<object>} markups @param {string} id */
export function removeMarkupById(markups, id) {
  if (!markups || !markups.length || id == null) return markups ? markups.slice() : []
  return markups.filter((m) => m && m.id !== id)
}

/** Empty markup stack (Clear all). */
export function clearMarkups() {
  return []
}

/**
 * Find markup by id.
 * @param {Array<object>|null|undefined} markups
 * @param {string|null|undefined} id
 * @returns {object|null}
 */
export function findMarkupById(markups, id) {
  if (!markups || id == null) return null
  return markups.find((m) => m && m.id === id) || null
}

/**
 * Rename subject/label without re-measure. Empty label is ignored (store unchanged).
 * @param {Array<object>|null|undefined} markups
 * @param {string|null|undefined} id
 * @param {string|null|undefined} subject
 * @returns {Array<object>}
 */
export function renameMarkupById(markups, id, subject) {
  if (!markups || !markups.length || id == null) return markups ? markups.slice() : []
  const label = String(subject ?? '').trim()
  if (!label) return markups.slice()
  return markups.map((m) => {
    if (!m || m.id !== id) return m
    return { ...m, subject: label }
  })
}

/**
 * First point of a markup for jump-to scroll anchor, or null.
 * @param {object|null|undefined} markup
 * @returns {{x:number,y:number}|null}
 */
export function markupAnchorPoint(markup) {
  if (!markup || !Array.isArray(markup.points) || !markup.points.length) return null
  const p = markup.points[0]
  if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
  return { x: p.x, y: p.y }
}

/**
 * Read calibrated scale for a page. Returns null if missing or invalid.
 * @param {Record<string|number, number>|null|undefined} scales
 * @param {number|null|undefined} pageIndex 1-based
 * @returns {number|null}
 */
export function getPageScale(scales, pageIndex) {
  if (pageIndex == null || !(Number(pageIndex) >= 1)) return null
  if (!scales || typeof scales !== 'object') return null
  const raw = scales[pageIndex] ?? scales[String(pageIndex)]
  const v = Number(raw)
  return v > 0 ? v : null
}

/**
 * Immutable set of scale for one page after calibration.
 * @param {Record<string|number, number>|null|undefined} scales
 * @param {number} pageIndex
 * @param {number} pxPerM
 * @returns {Record<string, number>}
 */
export function setPageScale(scales, pageIndex, pxPerM) {
  if (!(Number(pageIndex) >= 1)) throw new Error('Page index must be >= 1')
  const n = Number(pxPerM)
  if (!(n > 0)) throw new Error('Scale needs positive pixels per metre')
  const next = {}
  if (scales && typeof scales === 'object') {
    for (const [k, v] of Object.entries(scales)) {
      if (Number(v) > 0) next[String(k)] = Number(v)
    }
  }
  next[String(pageIndex)] = n
  return next
}

/** @param {Record<string|number, number>|null|undefined} scales @param {number|null|undefined} pageIndex */
export function isPageCalibrated(scales, pageIndex) {
  return getPageScale(scales, pageIndex) != null
}

/**
 * Length/area require a calibrated page. Count does not.
 * @returns {string|null} null when allowed; otherwise toast reason
 */
export function requirePageScale(scales, pageIndex) {
  if (pageIndex == null || !(Number(pageIndex) >= 1)) {
    return 'Pick a page first'
  }
  if (!isPageCalibrated(scales, pageIndex)) {
    return `Calibrate Scale on page ${pageIndex} first`
  }
  return null
}

/**
 * Chip label for the active page. Shows lock when calibrated.
 * @returns {{ text: string, calibrated: boolean, title: string }}
 */
export function formatScaleChip(scales, pageIndex) {
  const page = pageIndex != null && Number(pageIndex) >= 1 ? Number(pageIndex) : null
  const px = getPageScale(scales, page)
  if (page != null && px != null) {
    return {
      text: `p${page} · 🔒 ${Math.round(px)} px/m`,
      calibrated: true,
      title: `Page ${page} scale locked: ${Math.round(px)} pixels per metre. Re-run Scale on this page to recalibrate.`,
    }
  }
  if (page != null) {
    return {
      text: `p${page} · scale ?`,
      calibrated: false,
      title: `Page ${page} has no scale. Use Scale (two clicks + metres) before Length or Area.`,
    }
  }
  return {
    text: 'scale ?',
    calibrated: false,
    title: 'Plan scale (per page). Open a plan and calibrate each sheet you measure.',
  }
}

/**
 * Migrate legacy single pxPerM into per-page map.
 * @param {number|null|undefined} pxPerM
 * @param {Array<{page?: number|null}>|null|undefined} markups
 * @param {Record<string|number, number>|null|undefined} scaleByPage
 * @returns {Record<string, number>}
 */
export function migrateLegacyScale(pxPerM, markups, scaleByPage) {
  const fromMap = {}
  if (scaleByPage && typeof scaleByPage === 'object') {
    for (const [k, v] of Object.entries(scaleByPage)) {
      if (Number(v) > 0 && Number(k) >= 1) fromMap[String(k)] = Number(v)
    }
  }
  if (Object.keys(fromMap).length) return fromMap
  const n = Number(pxPerM)
  if (!(n > 0)) return {}
  const pages = new Set()
  for (const m of markups || []) {
    const p = Number(m && m.page)
    if (p >= 1) pages.add(p)
  }
  if (!pages.size) pages.add(1)
  const out = {}
  for (const p of pages) out[String(p)] = n
  return out
}

/**
 * Append live cursor as provisional last vertex (for rubber-band draft).
 * @param {Array<{x:number,y:number}>|null|undefined} points
 * @param {{x:number,y:number}|null|undefined} cursor
 * @returns {Array<{x:number,y:number}>}
 */
export function appendDraftCursor(points, cursor) {
  const base = Array.isArray(points) ? points.slice() : []
  if (!cursor) return base
  const x = Number(cursor.x)
  const y = Number(cursor.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return base
  base.push({ x, y })
  return base
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * Live dimension readout for an in-progress draft (length / area / scale).
 * Never returns NaN text — falls back to px when unscaled; null when nothing to show.
 * @param {'length'|'area'|'scale'|string|null|undefined} mode
 * @param {Array<{x:number,y:number}>|null|undefined} points including optional cursor vertex
 * @param {number|null|undefined} pxPerM
 * @returns {{ text:string, unit:string, scaled:boolean, px:number, value:number|null }|null}
 */
export function formatDraftReadout(mode, points, pxPerM) {
  if (!mode || mode === 'count') return null
  const pts = Array.isArray(points) ? points : []
  if (mode === 'length' || mode === 'scale') {
    if (pts.length < 2) return null
    const px = polylineLengthPx(pts)
    if (!(px > 0) || !Number.isFinite(px)) return null
    if (mode === 'scale') {
      return { text: `${Math.round(px)} px`, unit: 'px', scaled: false, px, value: null }
    }
    const ppm = Number(pxPerM)
    if (!(ppm > 0)) {
      return { text: `${Math.round(px)} px`, unit: 'px', scaled: false, px, value: null }
    }
    const m = pxToMetres(px, ppm)
    if (m == null || !Number.isFinite(m)) return null
    return { text: `${round2(m)} lm`, unit: 'lm', scaled: true, px, value: m }
  }
  if (mode === 'area') {
    if (pts.length < 3) return null
    const px2 = polygonAreaPx2(pts)
    if (!(px2 > 0) || !Number.isFinite(px2)) return null
    const ppm = Number(pxPerM)
    if (!(ppm > 0)) {
      return { text: `${Math.round(px2)} px²`, unit: 'px²', scaled: false, px: px2, value: null }
    }
    const m2 = px2ToMetres2(px2, ppm)
    if (m2 == null || !Number.isFinite(m2)) return null
    return { text: `${round2(m2)} m²`, unit: 'm²', scaled: true, px: px2, value: m2 }
  }
  return null
}
