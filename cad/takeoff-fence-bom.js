/**
 * takeoff-fence-bom.js — industry order list from fence spec + run length.
 * Pure, unit-testable. No DOM. Spacing/height defaults are STATED (needs-human
 * until a human confirms). Never invents a run length.
 */

export const DEFAULT_POST_SPACING_M = 2.4
export const DEFAULT_HEIGHT_M = 1.2
export const DEFAULT_FOOT_DIA_M = 0.25
export const DEFAULT_FOOT_DEPTH_M = 0.6

/**
 * @param {object} q fence quantity from takeoff
 * @returns {number|null} height in metres if parseable
 */
export function parseHeightM(q) {
  const blob = `${q?.item || ''} ${q?.notes || ''} ${q?.formula || ''}`
  const mm = /(\d{3,4})\s*mm/i.exec(blob)
  if (mm) return Number(mm[1]) / 1000
  const m = /(\d+(?:\.\d+)?)\s*m\b/i.exec(blob)
  if (m) {
    const v = Number(m[1])
    if (v > 0 && v < 5) return v
  }
  // "post-and-rail @ 1.2 m high"
  const at = /@\s*(\d+(?:\.\d+)?)\s*m/i.exec(blob)
  if (at) return Number(at[1])
  return null
}

export function parseGateCount(quantities) {
  const g = (quantities || []).find(
    (q) => q.id === 'q-fence-gates' || /^gates?$/i.test(String(q.item || '')),
  )
  if (g && Number.isFinite(Number(g.qty))) return Math.max(0, Math.round(Number(g.qty)))
  return 0
}

/**
 * Expand a measured fence run into orderable BOM lines.
 * @param {{
 *   lengthLm: number,
 *   heightM?: number,
 *   spacingM?: number,
 *   gateCount?: number,
 *   system?: string,
 *   planName?: string,
 * }} opts
 */
export function explodeFenceBom(opts) {
  const lengthLm = Number(opts.lengthLm)
  if (!Number.isFinite(lengthLm) || lengthLm <= 0) {
    throw new Error('Enter a fence run length greater than 0 (lm)')
  }
  const heightM = Number(opts.heightM) > 0 ? Number(opts.heightM) : DEFAULT_HEIGHT_M
  const spacingM =
    Number(opts.spacingM) > 0 ? Number(opts.spacingM) : DEFAULT_POST_SPACING_M
  const gateCount = Math.max(0, Math.round(Number(opts.gateCount) || 0))
  const system = opts.system || 'post-and-rail'
  const footDia = DEFAULT_FOOT_DIA_M
  const footDepth = DEFAULT_FOOT_DEPTH_M

  const posts = Math.ceil(lengthLm / spacingM) + 1
  const railsLm = Math.round(lengthLm * 2 * 100) / 100
  const meshM2 = Math.round(lengthLm * heightM * 100) / 100
  const concreteM3 =
    Math.round(posts * Math.PI * Math.pow(footDia / 2, 2) * footDepth * 1000) /
    1000

  const trade = 'fencing'
  const tier = 'needs-human' // defaults stated — estimator confirms
  const lines = [
    {
      id: 'bom-fence-run',
      trade,
      item: `Fence run — ${system}`,
      qty: round2(lengthLm),
      unit: 'lm',
      formula: `your measured run = ${round2(lengthLm)} lm`,
      tier: 'single-source',
      notes: 'Length entered by estimator from plan/site — not invented by X-Ray',
      category: 'xray-bom',
    },
    {
      id: 'bom-fence-posts',
      trade,
      item: 'Fence posts',
      qty: posts,
      unit: 'ea',
      formula: `ceil(${round2(lengthLm)}/${spacingM})+1 = ${posts}`,
      tier,
      notes: `Post spacing ${spacingM} m centres (AU default — confirm on site)`,
      category: 'xray-bom',
    },
    {
      id: 'bom-fence-rails',
      trade,
      item: 'Rails (2-rail)',
      qty: railsLm,
      unit: 'lm',
      formula: `2 × ${round2(lengthLm)} = ${railsLm}`,
      tier,
      notes: '2-rail assumption for post & rail — confirm rail count',
      category: 'xray-bom',
    },
    {
      id: 'bom-fence-mesh',
      trade,
      item: 'Mesh / infill',
      qty: meshM2,
      unit: 'm²',
      formula: `${round2(lengthLm)} × ${heightM} m height = ${meshM2}`,
      tier,
      notes: `Height ${heightM} m from plan markups or override`,
      category: 'xray-bom',
    },
    {
      id: 'bom-fence-footings',
      trade,
      item: 'Post footings',
      qty: posts,
      unit: 'ea',
      formula: `1 per post = ${posts}`,
      tier,
      notes: `Default Ø${footDia * 1000}×${footDepth * 1000} mm — site call`,
      category: 'xray-bom',
    },
    {
      id: 'bom-fence-concrete',
      trade,
      item: 'Footing concrete',
      qty: concreteM3,
      unit: 'm³',
      formula: `${posts} × π×(${footDia}/2)²×${footDepth} = ${concreteM3}`,
      tier,
      notes: 'Volume from default footing size — confirm before pour',
      category: 'xray-bom',
    },
    {
      id: 'bom-fence-caps',
      trade,
      item: 'Post caps',
      qty: posts,
      unit: 'ea',
      formula: `1 per post = ${posts}`,
      tier,
      notes: 'Optional finish — confirm',
      category: 'xray-bom',
    },
  ]

  if (gateCount > 0) {
    lines.push({
      id: 'bom-fence-gates',
      trade,
      item: 'Gates (from plan callouts)',
      qty: gateCount,
      unit: 'ea',
      formula: `gate callouts / count = ${gateCount}`,
      tier: 'needs-human',
      notes: 'Confirm manual vs electric sliding + hardware sets',
      category: 'xray-bom',
    })
  }

  return {
    lengthLm: round2(lengthLm),
    heightM,
    spacingM,
    gateCount,
    system,
    lines,
    summary: {
      posts,
      railsLm,
      meshM2,
      concreteM3,
      gates: gateCount,
    },
  }
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * Coerce a measured length into a positive lm value for the fence BOM field.
 * @param {unknown} lm
 * @returns {number|null}
 */
export function coerceFenceBomLengthLm(lm) {
  const n = Number(lm)
  if (!Number.isFinite(n) || !(n > 0)) return null
  return Math.round(n * 1000) / 1000
}

/**
 * Labels that clearly refer to a fence run (optional UX copy).
 * @param {unknown} text
 */
export function isFenceLikeLabel(text) {
  return /fence|fencing|mesh|post[\s-]*(&|and)?[\s-]*rail|boundary|palisade|chain[\s-]?link|paling/i.test(
    String(text || ''),
  )
}

/**
 * Any finished length with positive qty can seed the BOM lm field (one-click path).
 * @param {{ kind?: string, qty?: number, status?: string }|string|null|undefined} markupOrSubject
 */
export function shouldSeedFenceBomFromLength(markupOrSubject) {
  if (markupOrSubject == null) return false
  // Subject string: caller already has a positive lm — always allow seed.
  if (typeof markupOrSubject === 'string') return true
  if (markupOrSubject.kind && markupOrSubject.kind !== 'length') return false
  if (markupOrSubject.status === 'excluded') return false
  return coerceFenceBomLengthLm(markupOrSubject.qty) != null
}

/**
 * Sum of positive length markups (lm). Excluded rows skipped.
 * @param {Array<{ kind?: string, qty?: number, status?: string }>|null|undefined} markups
 */
export function totalMeasuredLengthLm(markups) {
  let s = 0
  for (const m of markups || []) {
    if (!m || m.kind !== 'length' || m.status === 'excluded') continue
    const q = Number(m.qty)
    if (Number.isFinite(q) && q > 0) s += q
  }
  return Math.round(s * 1000) / 1000
}

/**
 * Length to place in the fence BOM lm input after measure.
 * mode 'latest' (default) uses the last length markup; 'sum' totals all lengths.
 * @param {Array<object>|null|undefined} markups
 * @param {'latest'|'sum'} [mode]
 * @returns {number|null}
 */
export function fenceBomLengthFromMarkups(markups, mode = 'latest') {
  const lengths = (markups || []).filter(
    (m) => m && m.kind === 'length' && m.status !== 'excluded' && Number(m.qty) > 0,
  )
  if (!lengths.length) return null
  if (mode === 'sum') return coerceFenceBomLengthLm(totalMeasuredLengthLm(lengths))
  return coerceFenceBomLengthLm(lengths[lengths.length - 1].qty)
}

/**
 * Merge engine takeoff quantities with BOM lines for quote export.
 * BOM lines replace vague lot-scope fence lines.
 */
export function mergeTakeoffWithBom(takeoff, bomLines) {
  const base = (takeoff?.quantities || []).filter(
    (q) =>
      !/^q-fence-system$|^q-fence-mesh$|^q-fence-gates$/i.test(q.id || '') &&
      !String(q.category || '').includes('xray-bom'),
  )
  // Keep residential / other trades; swap fence lots for real BOM
  return {
    ...takeoff,
    quantities: [...bomLines, ...base],
  }
}
