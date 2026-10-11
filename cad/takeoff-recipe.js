// takeoff-recipe.js — component recipe expansion for the X-Ray CAD rail.
// Pure (no DOM). Config defaults only; every row is tagged needs-human when
// it rests on spacing/height assumptions. Engine purchase[] always wins when
// present (caller decides). Unit-tested via vitest importing this module.

/**
 * @param {object} q quantity from takeoff.json
 * @returns {{ key: string, title: string, note: string, table: { head: string[], rows: string[][] } } | null}
 */
export function recipeForQuantity(q) {
  const item = String(q?.item || '').toLowerCase()
  const unit = String(q?.unit || '').toLowerCase()
  const formula = String(q?.formula || '').toLowerCase()
  const trade = String(q?.trade || '').toLowerCase()
  const blob = item + formula + trade
  const qty = Number(q?.qty)
  if (!Number.isFinite(qty) || qty <= 0) return null

  const fmtQty = (v) =>
    typeof v === 'number' ? (Math.round(v * 100) / 100).toString() : String(v ?? '')

  const isLm = /^(lm|m|mtr|metre|meter|lin|l\.m)/.test(unit)
  const isM2 = /^(m2|m²|sqm|sq\.?\s*m)/.test(unit)
  const isM3 = /^(m3|m³|cum)/.test(unit)
  const isFence =
    /fence|colorbond|colourbond|paling|chain.?mesh|post.?&?.?rail|mesh|pool.?fence/.test(
      blob,
    )
  const isWall = /wall|stud|frame|partition|plaster|gyprock/.test(blob)
  const isRoof = /roof|batten|rafter|tile|sheet/.test(blob)
  const isConc = /concrete|slab|footing|pier/.test(blob)
  const isGate = /gate/.test(item)
  /** @type {string[][]} */
  const rows = []

  if (isFence && isLm && !isGate) {
    const spacing = 2.4
    const posts = Math.ceil(qty / spacing) + 1
    const rails = Math.round(qty * 2 * 100) / 100
    const heightM = (() => {
      const m =
        /(\d+(?:\.\d+)?)\s*(?:mm)?\s*(?:high|h\b)/i.exec(
          String(q.item || '') +
            ' ' +
            String(q.notes || '') +
            ' ' +
            String(q.formula || ''),
        )
      if (!m) return 1.2
      const v = Number(m[1])
      return v > 20 ? v / 1000 : v
    })()
    const mesh = Math.round(qty * heightM * 100) / 100
    const footDia = 0.25
    const footDepth = 0.6
    const conc =
      Math.round(
        posts * Math.PI * Math.pow(footDia / 2, 2) * footDepth * 1000,
      ) / 1000
    rows.push([
      'Posts',
      String(posts),
      'ea',
      `ceil(${fmtQty(qty)}/${spacing})+1 · spacing ${spacing}m default`,
      'needs-human',
    ])
    rows.push([
      'Rails (2-rail)',
      String(rails),
      'lm',
      `2 × ${fmtQty(qty)} lm run`,
      'needs-human',
    ])
    rows.push([
      'Mesh / infill',
      String(mesh),
      'm²',
      `${fmtQty(qty)} × ${heightM}m height (parsed or 1.2m default)`,
      'needs-human',
    ])
    rows.push([
      'Footings',
      String(posts),
      'ea',
      `Ø${footDia * 1000}×${footDepth * 1000}mm default per post`,
      'needs-human',
    ])
    rows.push([
      'Concrete',
      String(conc),
      'm³',
      `${posts} × π×(${footDia}/2)²×${footDepth}`,
      'needs-human',
    ])
    rows.push(['Post caps', String(posts), 'ea', '1 per post', 'needs-human'])
  } else if (isGate) {
    rows.push([
      'Gate leaf',
      '1',
      'ea',
      'from takeoff item',
      q.tier || 'single-source',
    ])
    rows.push([
      'Gate posts',
      '2',
      'ea',
      'standard pair — confirm site',
      'needs-human',
    ])
    rows.push([
      'Hardware set',
      '1',
      'ea',
      'latches/hinges/motors per spec',
      'needs-human',
    ])
  } else if (isWall && isLm) {
    const studSp = 0.6
    rows.push([
      'Studs',
      String(Math.ceil(qty / studSp) + 1),
      'ea',
      `ceil(${fmtQty(qty)}/${studSp})+1 · ${studSp}m centres default`,
      'needs-human',
    ])
    rows.push([
      'Top/bottom plates',
      String(Math.round(qty * 2 * 100) / 100),
      'lm',
      `2 × ${fmtQty(qty)}`,
      'needs-human',
    ])
    rows.push([
      'Noggins',
      String(Math.round(qty * 100) / 100),
      'lm',
      '1 row default — confirm height',
      'needs-human',
    ])
  } else if (isWall && isM2) {
    rows.push([
      'Plasterboard',
      String(fmtQty(qty)),
      'm²',
      'measured area',
      q.tier || 'single-source',
    ])
    rows.push([
      'Insulation',
      String(fmtQty(qty)),
      'm²',
      'same area — confirm R-value',
      'needs-human',
    ])
    rows.push([
      'Skirting',
      '—',
      'lm',
      'derive from room perimeter (not on this line)',
      'needs-human',
    ])
  } else if (isRoof && isM2) {
    rows.push([
      'Roof cover',
      String(fmtQty(qty)),
      'm²',
      q.formula || 'measured',
      q.tier || 'single-source',
    ])
    rows.push([
      'Waste allowance',
      String(Math.round(qty * 1.15 * 100) / 100),
      'm²',
      '×1.15 roof waste default',
      'needs-human',
    ])
    rows.push([
      'Battens',
      '—',
      'lm',
      'depends on sheet/tile system',
      'needs-human',
    ])
  } else if (isConc && (isM3 || isM2)) {
    rows.push([
      isM3 ? 'Concrete volume' : 'Slab area',
      String(fmtQty(qty)),
      q.unit || '',
      q.formula || 'measured',
      q.tier || 'single-source',
    ])
    rows.push(['Formwork', '—', 'm²', 'from perimeter — confirm', 'needs-human'])
    rows.push(['Mesh / reo', '—', 'm²', 'rate per design', 'needs-human'])
  } else if (isM2) {
    rows.push([
      'Area item',
      String(fmtQty(qty)),
      'm²',
      q.formula || 'measured',
      q.tier || 'single-source',
    ])
    rows.push([
      'Waste allowance',
      String(Math.round(qty * 1.1 * 100) / 100),
      'm²',
      '×1.10 default waste',
      'needs-human',
    ])
  } else if (isLm) {
    rows.push([
      'Run length',
      String(fmtQty(qty)),
      unit || 'lm',
      q.formula || 'measured',
      q.tier || 'single-source',
    ])
  } else {
    // Scope / each items (for example, labelled residential work): still expand into
    // a single explicit component row so the inspector always has structure.
    rows.push([
      q.item || 'Item',
      String(fmtQty(qty)),
      q.unit || 'ea',
      q.formula || 'from takeoff',
      q.tier || 'single-source',
    ])
    if (String(q.tier) === 'single-source' || String(q.tier) === 'needs-human') {
      rows.push([
        'Human confirm',
        '1',
        'task',
        'tier requires estimator review before pricing',
        'needs-human',
      ])
    }
  }

  return {
    key: 'components',
    title: 'Components (recipe)',
    note: 'Config defaults — not measured. Confirm spacing/height/footing before pricing. Engine purchase[] overrides this when present.',
    table: { head: ['component', 'qty', 'unit', 'basis', 'tier'], rows },
  }
}

/**
 * Deterministic fence posts for a linear run (stated spacing).
 * Exposed for tests so they hit the same formula as the recipe table.
 */
export function fencePostsForRun(runLm, spacingM = 2.4) {
  const qty = Number(runLm)
  const spacing = Number(spacingM)
  if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(spacing) || spacing <= 0) {
    return null
  }
  return Math.ceil(qty / spacing) + 1
}
