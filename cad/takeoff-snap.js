/**
 * Best-effort snap-to-vector for X-Ray measure tools.
 * Pure math + optional pdf.js operator-list extraction. No DOM.
 * Raster / empty paths degrade to no snap (never throws).
 */

/** Default magnet radius in CSS overlay pixels. */
export const DEFAULT_SNAP_RADIUS_PX = 12

/** Hard caps so huge vector PDFs cannot freeze the main thread. */
export const DEFAULT_MAX_SNAP_POINTS = 2500
export const DEFAULT_MAX_OPS = 80_000

/**
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 */
export function distPx(a, b) {
  return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y))
}

/**
 * PDF user-space (bottom-left origin) → CSS overlay (top-left), media box at 0,0.
 * @param {number} x
 * @param {number} y
 * @param {number} pageHeightPt
 * @param {number} cssScale
 */
export function pdfUserToCss(x, y, pageHeightPt, cssScale) {
  const s = Number(cssScale)
  const h = Number(pageHeightPt)
  if (!(s > 0) || !(h > 0) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }
  return { x: x * s, y: (h - y) * s }
}

/**
 * Nearest candidate point within radius, or null.
 * @param {{x:number,y:number}} cursor
 * @param {Array<{x:number,y:number}>|null|undefined} candidates
 * @param {number} [radiusPx]
 * @returns {{ x:number, y:number, kind:'point', dist:number }|null}
 */
export function snapToPoints(cursor, candidates, radiusPx = DEFAULT_SNAP_RADIUS_PX) {
  if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return null
  const r = Number(radiusPx)
  if (!(r > 0) || !candidates || !candidates.length) return null
  let best = null
  let bestD = r
  for (const p of candidates) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    const d = distPx(cursor, p)
    if (d <= bestD) {
      bestD = d
      best = { x: p.x, y: p.y, kind: 'point', dist: d }
    }
  }
  return best
}

/**
 * Project cursor onto segment AB; snap if projection on segment is within radius.
 * @param {{x:number,y:number}} cursor
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {number} [radiusPx]
 * @returns {{ x:number, y:number, kind:'segment', dist:number }|null}
 */
export function snapToSegment(cursor, a, b, radiusPx = DEFAULT_SNAP_RADIUS_PX) {
  if (!cursor || !a || !b) return null
  const r = Number(radiusPx)
  if (!(r > 0)) return null
  const ax = Number(a.x)
  const ay = Number(a.y)
  const bx = Number(b.x)
  const by = Number(b.y)
  if (![ax, ay, bx, by, cursor.x, cursor.y].every(Number.isFinite)) return null
  const abx = bx - ax
  const aby = by - ay
  const len2 = abx * abx + aby * aby
  if (!(len2 > 0)) return snapToPoints(cursor, [a], r)
  let t = ((cursor.x - ax) * abx + (cursor.y - ay) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const px = ax + t * abx
  const py = ay + t * aby
  const d = Math.hypot(cursor.x - px, cursor.y - py)
  if (d > r) return null
  return { x: px, y: py, kind: 'segment', dist: d }
}

/**
 * Best snap among points and segments (closest wins).
 * @param {{x:number,y:number}} cursor
 * @param {{ points?: Array<{x:number,y:number}>, segments?: Array<{a:{x:number,y:number}, b:{x:number,y:number}}>, radiusPx?: number }} [opts]
 * @returns {{ x:number, y:number, kind:'point'|'segment', dist:number }|null}
 */
export function snapCursor(cursor, opts = {}) {
  const radiusPx = opts.radiusPx != null ? Number(opts.radiusPx) : DEFAULT_SNAP_RADIUS_PX
  let best = snapToPoints(cursor, opts.points, radiusPx)
  for (const seg of opts.segments || []) {
    if (!seg) continue
    const hit = snapToSegment(cursor, seg.a, seg.b, radiusPx)
    if (!hit) continue
    if (!best || hit.dist < best.dist) best = hit
  }
  return best
}

/**
 * Apply snap or return original cursor. Always a finite point or null cursor passthrough.
 * @param {{x:number,y:number}|null|undefined} cursor
 * @param {object} [opts] same as snapCursor
 */
export function applySnap(cursor, opts = {}) {
  if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return cursor || null
  const hit = snapCursor(cursor, opts)
  if (!hit) return { x: cursor.x, y: cursor.y, snapped: false }
  return { x: hit.x, y: hit.y, snapped: true, kind: hit.kind, dist: hit.dist }
}

/**
 * Markup endpoints as always-available CSS snap points (same page).
 * @param {Array<{page?: number, points?: Array<{x:number,y:number}>}>|null|undefined} markups
 * @param {number} pageIndex
 */
export function collectMarkupSnapPoints(markups, pageIndex) {
  const page = Number(pageIndex)
  const out = []
  if (!(page >= 1) || !markups) return out
  for (const m of markups) {
    if (!m || Number(m.page) !== page || !Array.isArray(m.points)) continue
    for (const p of m.points) {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out.push({ x: p.x, y: p.y })
    }
  }
  return out
}

/**
 * Map PDF-space targets into CSS overlay space for the current zoom.
 * @param {{ points?: Array<{x:number,y:number}>, segments?: Array<{a:any,b:any}>, source?: string }} targets
 * @param {number} pageHeightPt
 * @param {number} cssScale
 */
export function mapSnapTargetsToCss(targets, pageHeightPt, cssScale) {
  const points = []
  const segments = []
  for (const p of targets?.points || []) {
    const c = pdfUserToCss(p.x, p.y, pageHeightPt, cssScale)
    if (c) points.push(c)
  }
  for (const seg of targets?.segments || []) {
    if (!seg?.a || !seg?.b) continue
    const a = pdfUserToCss(seg.a.x, seg.a.y, pageHeightPt, cssScale)
    const b = pdfUserToCss(seg.b.x, seg.b.y, pageHeightPt, cssScale)
    if (a && b) segments.push({ a, b })
  }
  return {
    points,
    segments,
    source: targets?.source || 'empty',
  }
}

/**
 * Best-effort extract of corners + line segments from a pdf.js operator list.
 * Never throws. Caps work for large vector drawings.
 *
 * Handles legacy moveTo/lineTo/rectangle ops and modern constructPath batches
 * when present. Raster-only pages return source: 'empty'.
 *
 * @param {{ fnArray?: Array<number|string>, argsArray?: Array<any> }|null|undefined} opList
 * @param {{ maxPoints?: number, maxOps?: number, ops?: Record<string, number> }|null|undefined} [opts]
 * @returns {{ points: Array<{x:number,y:number}>, segments: Array<{a:{x:number,y:number}, b:{x:number,y:number}}>, source: 'vector'|'empty'|'error' }}
 */
export function extractSnapTargetsFromOperatorList(opList, opts = {}) {
  try {
    return extractSnapTargetsFromOperatorListUnsafe(opList, opts)
  } catch {
    return { points: [], segments: [], source: 'error' }
  }
}

function extractSnapTargetsFromOperatorListUnsafe(opList, opts = {}) {
  const maxPoints = Number(opts.maxPoints) > 0 ? Number(opts.maxPoints) : DEFAULT_MAX_SNAP_POINTS
  const maxOps = Number(opts.maxOps) > 0 ? Number(opts.maxOps) : DEFAULT_MAX_OPS
  const fnArray = opList?.fnArray
  const argsArray = opList?.argsArray
  if (!Array.isArray(fnArray) || !Array.isArray(argsArray)) {
    return { points: [], segments: [], source: 'empty' }
  }

  // pdf.js OPS ids — numeric defaults match common pdf.js 2.x/3.x/4.x builds;
  // callers may pass opts.ops from pdfjsLib.OPS when available.
  const OPS = {
    moveTo: 13,
    lineTo: 14,
    curveTo: 15,
    curveTo2: 16,
    curveTo3: 17,
    closePath: 18,
    rectangle: 19,
    constructPath: 91,
    ...(opts.ops || {}),
  }

  const pointKey = (x, y) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`
  const seen = new Set()
  const points = []
  const segments = []

  const addPoint = (x, y) => {
    if (points.length >= maxPoints) return false
    if (!Number.isFinite(x) || !Number.isFinite(y)) return true
    const k = pointKey(x, y)
    if (seen.has(k)) return true
    seen.add(k)
    points.push({ x, y })
    return true
  }

  const addSegment = (ax, ay, bx, by) => {
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) return
    if (ax === bx && ay === by) return
    if (segments.length < maxPoints) segments.push({ a: { x: ax, y: ay }, b: { x: bx, y: by } })
    addPoint(ax, ay)
    addPoint(bx, by)
  }

  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let hasSub = false
  const n = Math.min(fnArray.length, argsArray.length, maxOps)

  for (let i = 0; i < n; i++) {
    if (points.length >= maxPoints) break
    const fn = fnArray[i]
    const args = argsArray[i]

    // Modern pdf.js: constructPath(ops, data)
    if (fn === OPS.constructPath || fn === 'constructPath') {
      parseConstructPath(args, addPoint, addSegment, maxPoints)
      continue
    }

    if (fn === OPS.moveTo || fn === 'moveTo') {
      const x = Number(args?.[0])
      const y = Number(args?.[1])
      cx = x
      cy = y
      sx = x
      sy = y
      hasSub = true
      addPoint(x, y)
      continue
    }
    if (fn === OPS.lineTo || fn === 'lineTo') {
      const x = Number(args?.[0])
      const y = Number(args?.[1])
      if (hasSub) addSegment(cx, cy, x, y)
      cx = x
      cy = y
      hasSub = true
      continue
    }
    if (fn === OPS.rectangle || fn === 'rectangle') {
      const x = Number(args?.[0])
      const y = Number(args?.[1])
      const w = Number(args?.[2])
      const h = Number(args?.[3])
      if ([x, y, w, h].every(Number.isFinite)) {
        addSegment(x, y, x + w, y)
        addSegment(x + w, y, x + w, y + h)
        addSegment(x + w, y + h, x, y + h)
        addSegment(x, y + h, x, y)
      }
      continue
    }
    if (fn === OPS.closePath || fn === 'closePath') {
      if (hasSub) addSegment(cx, cy, sx, sy)
      cx = sx
      cy = sy
      continue
    }
    // Curves: only corner endpoints (magnet at curve ends, not full flatten)
    if (fn === OPS.curveTo || fn === 'curveTo') {
      const x = Number(args?.[4])
      const y = Number(args?.[5])
      if (hasSub) addSegment(cx, cy, x, y)
      addPoint(Number(args?.[0]), Number(args?.[1]))
      addPoint(Number(args?.[2]), Number(args?.[3]))
      cx = x
      cy = y
      hasSub = true
    }
  }

  return {
    points,
    segments,
    source: points.length || segments.length ? 'vector' : 'empty',
  }
}

/**
 * Parse constructPath args: [ops, coords] or similar.
 * ops entries are small ints; coords is a float array of x,y pairs in sequence.
 */
function parseConstructPath(args, addPoint, addSegment, maxPoints) {
  if (!args || !args.length) return
  // Common shapes: [ops, data] or [ops, data, minMax]
  let ops = null
  let data = null
  if (Array.isArray(args[0]) || (args[0] && typeof args[0].length === 'number' && typeof args[0] !== 'string')) {
    ops = args[0]
    data = args[1]
  } else if (Array.isArray(args)) {
    // Some builds pass a single object
    ops = args.ops || args[0]
    data = args.data || args[1]
  }
  if (!ops || !data || typeof data.length !== 'number') return

  // Path op codes inside constructPath (pdf.js PathType / DrawOPS subset)
  // 0 = moveTo (2 nums), 1 = lineTo (2), 2 = curveTo (6), 3 = quadratic? varies
  // Also seen: OPS.moveTo=0 style in internal path
  let di = 0
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let hasSub = false
  const read = (n) => {
    const out = []
    for (let k = 0; k < n; k++) {
      out.push(Number(data[di++]))
    }
    return out
  }

  for (let oi = 0; oi < ops.length; oi++) {
    if (di >= data.length) break
    const op = ops[oi]
    // Heuristic: moveTo consumes 2, lineTo 2, curveTo 6, close 0, rect 4
    if (op === 0 || op === 'moveTo' || op === 13) {
      const [x, y] = read(2)
      cx = x
      cy = y
      sx = x
      sy = y
      hasSub = true
      if (!addPoint(x, y)) return
    } else if (op === 1 || op === 'lineTo' || op === 14) {
      const [x, y] = read(2)
      if (hasSub) addSegment(cx, cy, x, y)
      cx = x
      cy = y
      hasSub = true
    } else if (op === 2 || op === 'curveTo' || op === 15) {
      const nums = read(6)
      if (nums.length === 6) {
        addPoint(nums[0], nums[1])
        addPoint(nums[2], nums[3])
        if (hasSub) addSegment(cx, cy, nums[4], nums[5])
        cx = nums[4]
        cy = nums[5]
        hasSub = true
      }
    } else if (op === 3 || op === 'closePath' || op === 18) {
      if (hasSub) addSegment(cx, cy, sx, sy)
      cx = sx
      cy = sy
    } else if (op === 4 || op === 'rectangle' || op === 19) {
      const [x, y, w, h] = read(4)
      if ([x, y, w, h].every(Number.isFinite)) {
        addSegment(x, y, x + w, y)
        addSegment(x + w, y, x + w, y + h)
        addSegment(x + w, y + h, x, y + h)
        addSegment(x, y + h, x, y)
      }
    } else {
      // Unknown op — stop this constructPath batch rather than desync coords
      break
    }
    if (typeof addPoint === 'function') {
      // addPoint returns false when full
    }
  }
}
