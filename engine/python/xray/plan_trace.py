"""plan_trace.py — automatic PDF plan linework tracer (walls and openings).

This is the additive bridge between the bounded vector extractor
(`xray.source_wireframe.extract_pdf`) and the existing source-building contract
(`xray.source_building.SCHEMA`). It emits the SAME `xray.source-building/v1`
scene the curated models use, so the existing viewer, evidence and validation
plumbing accepts its output unchanged — the difference is that the geometry is
derived from the drawing's own vector paths instead of a hand-made trace file.

What it does
------------
1. Reuses the bounded PDF extractor (no new parser, no new dependency).
2. Reads closed, axis-aligned quadrilateral paths. On CAD-exported plans a wall
   is drawn either as a filled/stroked thin rectangle (poche) or as a pair of
   parallel lines; this module measures the rectangles directly, so a wall's
   THICKNESS is measured from the drawing rather than assumed.
3. Records gaps between collinear wall bands as traced openings.

What it deliberately does NOT do
--------------------------------
* It is not an architectural classifier: it does not decide that a rectangle is
  a "bedroom wall" rather than a title block, and it does not name rooms.
* Wall HEIGHT and opening head/sill heights are presentation inferences, never
  read from the drawing, and are labelled `inferred` per object.
* The source calibration (mm per PDF point) is CALLER-SUPPLIED and its
  verification status is carried through into the scene. This module never
  invents a scale.
* It produces NO quantities. Nothing here is a takeoff.

Every emitted object carries `sourceRefs` {page, region, trace, note} in page
points, so a reviewer can put the claim back on the sheet it came from.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

from xray.source_building import SCHEMA
from xray.source_wireframe import WireframeError, extract_pdf

# NOTE: xray.source_building.validate_scene is deliberately NOT used here. It
# additionally enforces two rules that only hold for the curated hand-made
# models - a fixed 1191 x 842 page box and at least 100 objects. An automatic
# trace of one sheet legitimately produces fewer objects on any page size, so
# reusing it would force this module to fabricate geometry to pass. The schema
# invariants it enforces are re-implemented below, unchanged in substance.

# --- real-world wall bands (mm). A wall thinner than WALL_MIN_MM is linework
# (a hatch stroke or a shadow), a band thicker than WALL_MAX_MM is a room, a
# stair or a title-block cell rather than a wall.
WALL_MIN_MM = 60.0
WALL_MAX_MM = 400.0
# Bands are merged when their centrelines sit within this distance (mm).
COLLINEAR_TOL_MM = 30.0
# A traced gap is reported as an opening only inside this width band (mm).
OPENING_MIN_MM = 600.0
OPENING_MAX_MM = 3600.0
# Ignore stub walls shorter than this (mm) — they are nearly always dimension
# ticks, grid bubbles and hatch remnants.
MIN_WALL_LENGTH_MM = 500.0
# An edge counts as axis-aligned when its direction is within this angle.
AXIS_TOL_DEG = 1.5

MAX_SHAPES = 60_000
MAX_WALLS = 6_000
# Presentation-only: assumed storey height and lintel depth, never measured.
DEFAULT_WALL_HEIGHT_M = 2.70
DEFAULT_HEAD_DEPTH_M = 0.60

# Top/bottom box faces then the four sides (the index layout the curated
# scenes use, so downstream consumers need no special case).
BOX_INDICES = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
               1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]


class PlanTraceError(ValueError):
    """Unsupported input or an unusable calibration. No scene is written."""


def _fin(v):
    v = float(v)
    if not math.isfinite(v) or abs(v) > 1e8:
        raise PlanTraceError('Coordinate outside the supported range.')
    return v


def subpaths(page):
    """Split a page's path commands into straight subpaths.

    Returns (subpaths, curves_skipped) where each subpath is
    {'points': [(x, y), ...], 'closed': bool}. Cubic segments are counted and
    their endpoint is carried forward so a following LINETO still attaches to
    the right point, but a curve is never approximated into a straight wall.
    """
    out = []
    curves = 0
    for path in page.get('paths') or []:
        points = []
        for command in path.get('commands') or []:
            op = command[0]
            if op == 'M':
                if len(points) >= 2:
                    out.append({'points': points, 'closed': False})
                points = [(_fin(command[1]), _fin(command[2]))]
            elif op == 'L':
                if points:
                    points.append((_fin(command[1]), _fin(command[2])))
            elif op == 'C':
                curves += 1
                if points:
                    points.append((_fin(command[5]), _fin(command[6])))
            elif op == 'Z':
                if len(points) >= 2:
                    out.append({'points': points, 'closed': True})
                points = []
            else:
                raise PlanTraceError('Unknown path command.')
        if len(points) >= 2:
            out.append({'points': points, 'closed': False})
    return out, curves


def _dedupe(points, tolerance=0.05):
    unique = [points[0]]
    for point in points[1:]:
        if math.dist(point, unique[-1]) > tolerance:
            unique.append(point)
    if len(unique) > 2 and math.dist(unique[0], unique[-1]) <= tolerance:
        unique.pop()
    return unique


def _axis_aligned(points, tolerance_deg=AXIS_TOL_DEG):
    allowed = math.cos(math.radians(tolerance_deg))
    for a, b in zip(points, points[1:] + points[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy)
        if length <= 0:
            return False
        if abs(dx) / length < allowed and abs(dy) / length < allowed:
            return False
    return True


def rectangles(page, tolerance_deg=AXIS_TOL_DEG):
    """Axis-aligned closed quads as (x0, y0, x1, y1) in page points.

    Returns (rectangles, stats). Only genuine four-corner closed paths are
    accepted: an L-shaped or multi-segment outline is ignored rather than
    reduced to its bounding box, which would fabricate a wall thickness.
    """
    rects = []
    stats = {'subpaths': 0, 'curvesSkipped': 0, 'notClosed': 0,
             'notQuad': 0, 'notAxisAligned': 0}
    paths, curves = subpaths(page)
    stats['curvesSkipped'] = curves
    for subpath in paths:
        stats['subpaths'] += 1
        if not subpath['closed']:
            stats['notClosed'] += 1
            continue
        points = _dedupe(subpath['points'])
        if len(points) != 4:
            stats['notQuad'] += 1
            continue
        if not _axis_aligned(points, tolerance_deg):
            stats['notAxisAligned'] += 1
            continue
        xs = sorted(point[0] for point in points)
        ys = sorted(point[1] for point in points)
        if xs[3] - xs[0] <= 0 or ys[3] - ys[0] <= 0:
            stats['notQuad'] += 1
            continue
        rects.append((xs[0], ys[0], xs[3], ys[3]))
        if len(rects) > MAX_SHAPES:
            raise PlanTraceError('Shape limit exceeded.')
    return rects, stats


def wall_bands(page, mm_per_pt):
    """Thin axis-aligned rectangles measured as wall bands.

    Returns (bands, stats). Every band is expressed in page points plus its
    measured thickness in millimetres, so the caller keeps both the real-world
    claim and the evidence point that produced it.
    """
    if not (0 < mm_per_pt < 1000):
        raise PlanTraceError('Unusable calibration.')
    rects, stats = rectangles(page)
    stats = dict(stats)
    stats['rectangles'] = len(rects)
    stats.update({'tooThin': 0, 'tooThick': 0, 'tooShort': 0})
    bands = []
    for x0, y0, x1, y1 in rects:
        width_pt, height_pt = x1 - x0, y1 - y0
        width_mm, height_mm = width_pt * mm_per_pt, height_pt * mm_per_pt
        thickness_mm, length_mm = min(width_mm, height_mm), max(width_mm, height_mm)
        if thickness_mm < WALL_MIN_MM:
            stats['tooThin'] += 1
            continue
        if thickness_mm > WALL_MAX_MM:
            stats['tooThick'] += 1
            continue
        if length_mm < MIN_WALL_LENGTH_MM:
            stats['tooShort'] += 1
            continue
        if width_pt >= height_pt:
            axis, perp, a, b = 'h', (y0 + y1) / 2.0, x0, x1
        else:
            axis, perp, a, b = 'v', (x0 + x1) / 2.0, y0, y1
        bands.append({'axis': axis, 'perp': perp, 'a': a, 'b': b,
                      'thicknessMm': thickness_mm, 'lengthMm': length_mm,
                      'rect': (x0, y0, x1, y1)})
        if len(bands) > MAX_WALLS:
            raise PlanTraceError('Wall band limit exceeded.')
    return bands, stats


def merge_bands(bands, mm_per_pt):
    """Merge bands that share a centreline into one wall run.

    A cavity wall and a poche wall describe the same wall with different
    linework; unmerged they would double-count it. Bands merge only when their
    centrelines are within COLLINEAR_TOL_MM and their extents overlap, so two
    genuinely separate walls a room apart are never fused.
    """
    tolerance = COLLINEAR_TOL_MM / mm_per_pt
    merged = []
    for axis in ('h', 'v'):
        group = sorted((b for b in bands if b['axis'] == axis), key=lambda b: (b['perp'], b['a']))
        for band in group:
            target = None
            for candidate in merged:
                if candidate['axis'] != axis:
                    continue
                if abs(candidate['perp'] - band['perp']) > tolerance:
                    continue
                if band['a'] > candidate['b'] or band['b'] < candidate['a']:
                    continue
                target = candidate
                break
            if target is None:
                entry = dict(band)
                entry['_n'] = 1
                merged.append(entry)
            else:
                low, high = min(target['a'], band['a']), max(target['b'], band['b'])
                count = target['_n'] + 1
                target['perp'] = (target['perp'] * target['_n'] + band['perp']) / count
                target['a'], target['b'] = low, high
                target['_n'] = count
                if band['thicknessMm'] > target['thicknessMm']:
                    target['thicknessMm'] = band['thicknessMm']
                    target['rect'] = band['rect']
                target['lengthMm'] = (high - low) * mm_per_pt
    for band in merged:
        band.pop('_n', None)
    return merged


def traced_openings(bands, mm_per_pt):
    """Gaps between collinear merged bands, inside the opening width band.

    Honest by construction: the gap is traced, but the drawing at this level of
    extraction does not say whether it is a door, a window or simply two
    separate walls, so the caller labels it `inferred`.
    """
    openings = []
    for axis in ('h', 'v'):
        group = sorted((b for b in bands if b['axis'] == axis), key=lambda b: (b['perp'], b['a']))
        for left, right in zip(group, group[1:]):
            if abs(left['perp'] - right['perp']) > COLLINEAR_TOL_MM / mm_per_pt:
                continue
            gap_mm = (right['a'] - left['b']) * mm_per_pt
            if not OPENING_MIN_MM <= gap_mm <= OPENING_MAX_MM:
                continue
            openings.append({'axis': axis, 'perp': (left['perp'] + right['perp']) / 2.0,
                             'a': left['b'], 'b': right['a'],
                             'thicknessMm': max(left['thicknessMm'], right['thicknessMm']),
                             'widthMm': gap_mm})
    return openings


MATERIALS = {
    'wall': {'color': '#e4ddcc', 'roughness': 0.88},
    'opening': {'color': '#65a5b0', 'opacity': 0.45, 'roughness': 0.25},
}


def _clamp(value, low, high):
    return max(low, min(high, value))


def _reference(number, rect, note, state, page_w, page_h, trace=None):
    x0, y0, x1, y1 = rect
    corners = trace or [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    return {
        'page': number,
        'region': [_clamp(x0 - 3, 0, page_w), _clamp(y0 - 3, 0, page_h),
                   _clamp(x1 + 3, 0, page_w), _clamp(y1 + 3, 0, page_h)],
        'trace': [[_clamp(px, 0, page_w), _clamp(py, 0, page_h)] for px, py in corners],
        'evidenceState': state,
        'note': note,
    }


def _extents(axis, perp, a, b, thickness_pt):
    half = thickness_pt / 2.0
    if axis == 'h':
        return a, b, perp - half, perp + half
    return perp - half, perp + half, a, b


def _extents_rect(shape, mm_per_pt):
    """(x0, y0, x1, y1) in page points for a band or a traced gap."""
    thickness_pt = shape['thicknessMm'] / mm_per_pt
    x0, x1, y0, y1 = _extents(shape['axis'], shape['perp'], shape['a'], shape['b'], thickness_pt)
    return (x0, y0, x1, y1)


def _box(shape, mm_per_pt, page_w, page_h):
    """Eight box corners in scene metres, bottom face first then top."""
    metres = mm_per_pt / 1000.0
    thickness_pt = shape['thicknessMm'] / mm_per_pt
    x0, x1, y0, y1 = _extents(shape['axis'], shape['perp'], shape['a'], shape['b'], thickness_pt)
    bottom, top = shape['bottom'], shape['top']
    positions = []
    for level in (bottom, top):
        for px, py in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
            positions.extend([round(px * metres, 5), round(level, 5), round(py * metres, 5)])
    return positions


def build_scene(extracted, number, mm_per_pt, wall_height_m=DEFAULT_WALL_HEIGHT_M,
                head_depth_m=DEFAULT_HEAD_DEPTH_M, scale=None):
    """Turn one extracted page into a validated xray.source-building/v1 scene."""
    page = next((p for p in extracted['pages'] if p['page'] == number), None)
    if page is None:
        raise PlanTraceError('Selected page is not in the extraction.')
    page_w, page_h = float(page['widthPt']), float(page['heightPt'])
    if page_w <= 0 or page_h <= 0:
        raise PlanTraceError('Page has no usable extent.')

    raw, stats = wall_bands(page, mm_per_pt)
    bands = merge_bands(raw, mm_per_pt)
    gaps = traced_openings(bands, mm_per_pt)

    objects = []
    for index, band in enumerate(sorted(bands, key=lambda b: (b['axis'], b['perp'], b['a'])), 1):
        band = dict(band)
        band['bottom'], band['top'] = 0.0, float(wall_height_m)
        references = [_reference(
            number, band['rect'],
            'Wall band outline traced in page points; band thickness is measured '
            'from the drawing. Wall height is a presentation assumption, not a '
            'dimension read from this sheet.', 'traced', page_w, page_h)]
        objects.append({
            'id': f'wall-{band["axis"]}-{index}', 'category': 'wall',
            'label': f'{band["lengthMm"]:.0f} mm wall',
            'positions': _box(band, mm_per_pt, page_w, page_h),
            'indices': list(BOX_INDICES), 'material': 'wall',
            'sourceRefs': references, 'evidenceState': 'traced',
        })

    head = min(float(head_depth_m), float(wall_height_m))
    for index, gap in enumerate(sorted(gaps, key=lambda g: (g['axis'], g['perp'], g['a'])), 1):
        gap = dict(gap)
        gap['bottom'], gap['top'] = float(wall_height_m) - head, float(wall_height_m)
        rect = _extents_rect(gap, mm_per_pt)
        references = [_reference(
            number, rect,
            f'Traced {gap["widthMm"]:.0f} mm gap between collinear wall bands. '
            'The drawing at this extraction level does not distinguish a door, a '
            'window or two separate walls, and the head height shown is inferred, '
            'not measured.', 'inferred', page_w, page_h)]
        objects.append({
            'id': f'opening-{index}', 'category': 'opening',
            'label': f'{gap["widthMm"]:.0f} mm opening',
            'positions': _box(gap, mm_per_pt, page_w, page_h),
            'indices': list(BOX_INDICES), 'material': 'opening',
            'sourceRefs': references, 'evidenceState': 'inferred',
        })

    thicknesses = sorted(band['thicknessMm'] for band in bands)
    median = thicknesses[len(thicknesses) // 2] if thicknesses else 0.0
    positions = [o['positions'] for o in objects]
    if positions:
        mins = [min(p[k] for p in positions for k in range(d, len(p), 3)) for d in range(3)]
        maxs = [max(p[k] for p in positions for k in range(d, len(p), 3)) for d in range(3)]
    else:
        mins, maxs = [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]

    calibration = dict(scale or {})
    verified = bool(calibration.get('verified'))
    scene = {
        'schema': SCHEMA,
        'source': {'name': extracted['source']['name'],
                   'sha256': extracted['source']['sha256'],
                   'pageCount': extracted['source']['pageCount']},
        'units': 'm',
        'coordinateSystem': (f'+X drawing right; +Y up; +Z drawing down; origin is '
                             f'page {number} point (0,0), the top-left of the page box.'),
        'bounds': {'min': mins, 'max': maxs},
        'materials': MATERIALS,
        'objects': objects,
        'assumptions': [
            'Automatic vector linework trace of one sheet. This is NOT a coordinated '
            'CAD/BIM model and NOT a quantity schedule; nothing here is a takeoff.',
            f'Calibration {calibration.get("value") or "unspecified"} '
            f'({mm_per_pt:g} mm per PDF point) was supplied by the caller and is '
            + ('recorded as verified.' if verified else
               'NOT verified - it rests on a paper-size assumption, so every '
               'real-world length here inherits that uncertainty.'),
            'A wall band is a closed axis-aligned quadrilateral whose measured '
            f'thickness falls between {WALL_MIN_MM:g} and {WALL_MAX_MM:g} mm. Open '
            'double-line walls, curved walls, hatched poché that is not a closed '
            'quad, and all diagonal geometry are not yet recovered.',
            'Wall height is a presentation assumption and opening head/sill heights '
            'are inferred; neither is read from the drawing.',
            'A traced opening is a gap between collinear wall bands inside the '
            f'{OPENING_MIN_MM:g}-{OPENING_MAX_MM:g} mm band. The drawing does not say '
            'whether it is a door, a window or two separate walls, and openings are '
            'not currently subtracted from wall lengths.',
            'Room identity, room names, internal/external classification, slabs, '
            'roofs, services and finishes are not attempted by this module.',
        ],
        'sourceSheets': [{'page': number, 'title': f'Page {number}', 'role': 'plan'}],
        'summary': {
            'wallRuns': len(bands),
            'openings': len(gaps),
            'objects': len(objects),
            'wallHeightM': float(wall_height_m),
            'thicknessMm': {
                'min': round(thicknesses[0], 1) if thicknesses else None,
                'median': round(median, 1) if thicknesses else None,
                'max': round(thicknesses[-1], 1) if thicknesses else None,
            },
            'method': ('automatic vector linework trace: closed axis-aligned wall '
                       'bands plus collinear gap detection'),
            'status': 'automatic-approximate',
            'calibration': {'mmPerPt': mm_per_pt,
                            'value': calibration.get('value'),
                            'verified': verified},
        },
        'diagnostics': dict(stats),
    }
    if len(objects) > 20_000:
        raise PlanTraceError('Object limit exceeded.')
    if not objects:
        raise PlanTraceError('No wall bands found on this page; no scene written.')
    validate_trace_scene(scene)
    return scene


def validate_trace_scene(scene):
    """Schema invariants for an AUTOMATIC trace scene.

    Mirrors the substance of xray.source_building.validate_scene - contract,
    unique ids, finite positions, in-range indices, non-degenerate triangles,
    material declared, non-empty source references inside the page box - without
    the two curated-model-only rules documented at the top of this module.
    """
    if scene.get('schema') != SCHEMA or scene.get('units') != 'm':
        raise PlanTraceError('Invalid scene contract.')
    page_count = scene['source']['pageCount']
    if not isinstance(page_count, int) or page_count < 1:
        raise PlanTraceError('Invalid source page count.')
    ids = set()
    for obj in scene['objects']:
        if obj['id'] in ids:
            raise PlanTraceError('Duplicate object id.')
        ids.add(obj['id'])
        positions, indices = obj['positions'], obj['indices']
        if (not positions or len(positions) % 3
                or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in positions)):
            raise PlanTraceError('Invalid mesh positions.')
        if (not indices or len(indices) % 3
                or not all(isinstance(i, int) and 0 <= i < len(positions) // 3 for i in indices)):
            raise PlanTraceError('Invalid mesh indices.')
        if not obj['sourceRefs'] or obj['material'] not in scene['materials']:
            raise PlanTraceError('Missing source/material.')
        for triangle in range(0, len(indices), 3):
            a, b, c = [positions[k * 3:k * 3 + 3] for k in indices[triangle:triangle + 3]]
            u = [b[j] - a[j] for j in range(3)]
            v = [c[j] - a[j] for j in range(3)]
            cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
                     u[0] * v[1] - u[1] * v[0]]
            if sum(component * component for component in cross) <= 1e-18:
                raise PlanTraceError('Degenerate triangle in mesh.')
        for reference in obj['sourceRefs']:
            if not 1 <= reference['page'] <= page_count:
                raise PlanTraceError('Invalid source page.')
            left, top, right, bottom = reference['region']
            if not 0 <= left <= right or not 0 <= top <= bottom:
                raise PlanTraceError('Invalid source region.')
            if any(not (0 <= point[0] and 0 <= point[1]) for point in reference.get('trace', [])):
                raise PlanTraceError('Trace lies outside the page box.')
    return True


def trace_plan(pdf_path, number, mm_per_pt, wall_height_m=DEFAULT_WALL_HEIGHT_M,
               head_depth_m=DEFAULT_HEAD_DEPTH_M, scale=None):
    """Extract one page and return a validated source-building scene."""
    extracted = extract_pdf(str(pdf_path), [int(number)])
    page = extracted['pages'][0]
    if page.get('pathCount', 0) == 0:
        raise PlanTraceError('Selected page carries no vector paths; nothing to trace.')
    return build_scene(extracted, int(number), float(mm_per_pt),
                       wall_height_m, head_depth_m, scale)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=('Automatic PDF plan linework tracer: walls and traced openings '
                     'as an xray.source-building/v1 scene. Not building '
                     'reconstruction and not quantities.'))
    parser.add_argument('pdf')
    parser.add_argument('--page', type=int, required=True, help='one-based page to trace')
    parser.add_argument('--mm-per-pt', type=float, required=True,
                        help='caller-supplied calibration: millimetres of real world '
                             'per PDF point')
    parser.add_argument('--out', required=True, help='path for the scene JSON')
    parser.add_argument('--wall-height', type=float, default=DEFAULT_WALL_HEIGHT_M)
    parser.add_argument('--head-depth', type=float, default=DEFAULT_HEAD_DEPTH_M)
    parser.add_argument('--scale-value', default=None,
                        help='e.g. 1:100, recorded for provenance only')
    parser.add_argument('--scale-verified', action='store_true',
                        help='assert the supplied calibration was independently verified')
    args = parser.parse_args(argv)
    try:
        scale = {'value': args.scale_value, 'verified': bool(args.scale_verified),
                 'mmPerPt': args.mm_per_pt}
        scene = trace_plan(args.pdf, args.page, args.mm_per_pt,
                           args.wall_height, args.head_depth, scale)
        text = json.dumps(scene, separators=(',', ':'), allow_nan=False)
        out = Path(args.out)
        if out.exists():
            raise PlanTraceError('Refusing to overwrite an existing scene.')
        if out.parent and str(out.parent):
            out.parent.mkdir(parents=True, exist_ok=True)
        with out.open('x', encoding='utf-8', newline='\n') as handle:
            handle.write(text)
        print(json.dumps({
            'status': scene['summary']['status'],
            'page': args.page,
            'sourceSha256': scene['source']['sha256'],
            'wallRuns': scene['summary']['wallRuns'],
            'openings': scene['summary']['openings'],
            'objects': scene['summary']['objects'],
            'thicknessMm': scene['summary']['thicknessMm'],
            'calibrationVerified': scene['summary']['calibration']['verified'],
            'sceneSha256': hashlib.sha256(text.encode()).hexdigest(),
        }))
        return 0
    except PlanTraceError as error:
        print('error: ' + str(error), file=sys.stderr)
        return 2
    except WireframeError:
        print('error: Unsupported or unreadable PDF source.', file=sys.stderr)
        return 2
    except OSError:
        print('error: Exclusive output write failed.', file=sys.stderr)
        return 2
    except Exception as error:  # never a raw traceback in a host-invoked CLI
        print(f'error: trace failed ({type(error).__name__}).', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
