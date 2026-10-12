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


def decompose_rectilinear(points):
    """Split an axis-aligned polygon into exact rectangles by vertical slabs.

    A connected run of wall poche is one FILLED path with many vertices, not a
    set of four-corner quads, so reading only quads misses most of the wall
    structure. Even-odd scanline pairing inside each x slab recovers it exactly:
    the strips tile the polygon rather than approximating it, which a bounding
    box would not.
    """
    xs = sorted({point[0] for point in points})
    if len(xs) < 2:
        return []
    edges = []
    for a, b in zip(points, points[1:] + points[:1]):
        if abs(a[1] - b[1]) <= 1e-9:
            edges.append((a[1], min(a[0], b[0]), max(a[0], b[0])))
    rects = []
    for x0, x1 in zip(xs, xs[1:]):
        if x1 - x0 <= 0:
            continue
        middle = (x0 + x1) / 2.0
        crossings = sorted(y for y, low, high in edges if low <= middle <= high)
        for low, high in zip(crossings[0::2], crossings[1::2]):
            if high - low > 0:
                rects.append((x0, low, x1, high))
                if len(rects) > MAX_SHAPES:
                    raise PlanTraceError('Shape limit exceeded.')
    return rects


def rectangles(page, tolerance_deg=AXIS_TOL_DEG):
    """Axis-aligned rectangles as (x0, y0, x1, y1) in page points.

    Returns (rectangles, stats). Four-corner quads are taken directly; larger
    axis-aligned closed paths are decomposed exactly into rectangles, so a
    filled wall run is measured rather than dropped. A non-orthogonal or open
    outline is ignored instead of being reduced to its bounding box.
    """
    rects = []
    stats = {'subpaths': 0, 'curvesSkipped': 0, 'notClosed': 0, 'notQuad': 0,
             'notAxisAligned': 0, 'polygons': 0, 'polygonRectangles': 0}
    paths, curves = subpaths(page)
    stats['curvesSkipped'] = curves
    for subpath in paths:
        stats['subpaths'] += 1
        if not subpath['closed']:
            stats['notClosed'] += 1
            continue
        points = _dedupe(subpath['points'])
        if len(points) < 3:
            stats['notQuad'] += 1
            continue
        if not _axis_aligned(points, tolerance_deg):
            stats['notAxisAligned'] += 1
            continue
        if len(points) == 4:
            xs = sorted(point[0] for point in points)
            ys = sorted(point[1] for point in points)
            if xs[3] - xs[0] <= 0 or ys[3] - ys[0] <= 0:
                stats['notQuad'] += 1
                continue
            rects.append((xs[0], ys[0], xs[3], ys[3]))
        else:
            stats['polygons'] += 1
            for rect in decompose_rectilinear(points):
                if rect[2] - rect[0] <= 0 or rect[3] - rect[1] <= 0:
                    continue
                rects.append(rect)
                stats['polygonRectangles'] += 1
        if len(rects) > MAX_SHAPES:
            raise PlanTraceError('Shape limit exceeded.')
    return rects, stats


def _run_tuple(pending):
    axis, perp, low, high = pending
    if axis == 'h':
        return (low, perp, high, perp)
    return (perp, low, perp, high)


def open_runs(page, tolerance_deg=AXIS_TOL_DEG, collinear_pt=0.75):
    """Axis-aligned straight runs from OPEN subpaths, as (x1, y1, x2, y2).

    Consecutive collinear segments of one subpath are re-joined into a single
    run. A CAD wall is usually emitted as many short segments, one per vertex;
    without this join a 6 m wall arrives as a dozen 0.5 m pieces and neither the
    pairing nor the reported lengths mean anything.

    Diagonal strokes are excluded rather than snapped, so a diagonal is never
    turned into a wall.
    """
    runs = []
    allowed = math.cos(math.radians(tolerance_deg))
    paths, _ = subpaths(page)
    for subpath in paths:
        if subpath['closed']:
            continue
        points = _dedupe(subpath['points'])
        pending = None
        for a, b in zip(points, points[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = math.hypot(dx, dy)
            if length <= 0:
                continue
            horizontal = abs(dx) / length >= allowed
            vertical = abs(dy) / length >= allowed
            if not (horizontal or vertical):
                if pending is not None:
                    runs.append(_run_tuple(pending))
                    pending = None
                continue
            axis = 'h' if horizontal else 'v'
            if axis == 'h':
                perp, low, high = (a[1] + b[1]) / 2.0, min(a[0], b[0]), max(a[0], b[0])
            else:
                perp, low, high = (a[0] + b[0]) / 2.0, min(a[1], b[1]), max(a[1], b[1])
            joins = (pending is not None and pending[0] == axis
                     and abs(pending[1] - perp) <= collinear_pt
                     and low <= pending[3] + collinear_pt
                     and high >= pending[2] - collinear_pt)
            if joins:
                pending = (axis, perp, min(pending[2], low), max(pending[3], high))
            else:
                if pending is not None:
                    runs.append(_run_tuple(pending))
                pending = (axis, perp, low, high)
            if len(runs) > MAX_SHAPES:
                raise PlanTraceError('Run limit exceeded.')
        if pending is not None:
            runs.append(_run_tuple(pending))
    return runs


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


# --- plan-region isolation -------------------------------------------------
# A sheet is not all plan: the title block, revision schedule and sheet margins
# carry dense non-plan linework. The plan is the largest contiguous dense block
# of axis-aligned linework, so it is found by density rather than by assuming a
# corner, which keeps working when a title block moves or is vertical.

REGION_COLUMNS = 48
REGION_MARGIN_PT = 12.0


def _density_grid(page, columns=REGION_COLUMNS):
    """Count linework samples per cell across the whole sheet."""
    width, height = float(page['widthPt']), float(page['heightPt'])
    if width <= 0 or height <= 0:
        raise PlanTraceError('Page has no usable extent.')
    rows = max(1, int(round(columns * height / width)))
    counts = [[0] * columns for _ in range(rows)]
    cell_w, cell_h = width / columns, height / rows
    step = max(1.0, min(cell_w, cell_h) / 2.0)

    def mark(x, y):
        column = min(columns - 1, max(0, int(x / cell_w)))
        row = min(rows - 1, max(0, int(y / cell_h)))
        counts[row][column] += 1

    def sample(x0, y0, x1, y1):
        span = math.hypot(x1 - x0, y1 - y0)
        steps = max(1, int(span / step))
        for index in range(steps + 1):
            t = index / steps
            mark(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)

    rects, _ = rectangles(page)
    for x0, y0, x1, y1 in rects:
        # One mark per band: its centre is enough to place a single wall.
        mark((x0 + x1) / 2.0, (y0 + y1) / 2.0)
    for x0, y0, x1, y1 in open_runs(page):
        sample(x0, y0, x1, y1)
    return counts, columns, rows, cell_w, cell_h


def plan_region(page, columns=REGION_COLUMNS, sensitivity=1.0):
    """Bounding box (x0, y0, x1, y1) in page points of the densest block.

    Returns None when the sheet is too uniform to separate a plan from its
    surrounding furniture, in which case the caller must NOT filter.
    """
    counts, columns, rows, cell_w, cell_h = _density_grid(page, columns)
    nonzero = sorted(value for row in counts for value in row if value > 0)
    if len(nonzero) < columns * 2:
        return None
    threshold = max(1.0, (sum(nonzero) / len(nonzero)) * sensitivity)
    dense = [[value >= threshold for value in row] for row in counts]
    if not any(any(row) for row in dense):
        return None

    seen = [[False] * columns for _ in range(rows)]
    best = None
    for start_row in range(rows):
        for start_column in range(columns):
            if seen[start_row][start_column] or not dense[start_row][start_column]:
                continue
            stack = [(start_row, start_column)]
            seen[start_row][start_column] = True
            members = []
            while stack:
                row, column = stack.pop()
                members.append((row, column))
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nr, nc = row + dr, column + dc
                    if 0 <= nr < rows and 0 <= nc < columns and not seen[nr][nc] \
                            and dense[nr][nc]:
                        seen[nr][nc] = True
                        stack.append((nr, nc))
            if best is None or len(members) > len(best):
                best = members
    if not best:
        return None
    row_lo = min(r for r, _ in best)
    row_hi = max(r for r, _ in best)
    column_lo = min(c for _, c in best)
    column_hi = max(c for _, c in best)
    return (max(0.0, column_lo * cell_w - REGION_MARGIN_PT),
            max(0.0, row_lo * cell_h - REGION_MARGIN_PT),
            min(float(page['widthPt']), (column_hi + 1) * cell_w + REGION_MARGIN_PT),
            min(float(page['heightPt']), (row_hi + 1) * cell_h + REGION_MARGIN_PT))


def within_region(region, axis, perp, a, b):
    """True when a band's midpoint sits inside the plan region (None = keep)."""
    if region is None:
        return True
    x0, y0, x1, y1 = region
    mid_a, mid_perp = (a + b) / 2.0, perp
    x, y = (mid_a, mid_perp) if axis == 'h' else (mid_perp, mid_a)
    return x0 <= x <= x1 and y0 <= y <= y1


# --- open double-line wall recovery ----------------------------------------
# A CAD plan very often draws a wall as a PAIR of parallel strokes rather than a
# closed poche rectangle. Reading only closed quads misses those walls entirely;
# this pairs each stroke with its nearest parallel partner when the separation is
# a plausible wall thickness and the runs overlap enough to be one wall.

PAIR_OVERLAP_RATIO = 0.5


def _normalised_run(x0, y0, x1, y1):
    horizontal = abs(x1 - x0) >= abs(y1 - y0)
    if horizontal:
        return 'h', (y0 + y1) / 2.0, min(x0, x1), max(x0, x1)
    return 'v', (x0 + x1) / 2.0, min(y0, y1), max(y0, y1)


def open_wall_bands(page, mm_per_pt):
    """Walls drawn as two parallel open lines, paired into measured bands.

    Both strokes must be at least MIN_WALL_LENGTH_MM long: a plan's run
    population is otherwise dominated by hatch, tick and text strokes whose
    median length is a few centimetres, and pairing those produces nonsense.
    Each stroke is then matched to the candidate partner that OVERLAPS it most,
    not merely to the first one sitting nearby, so a wall pairs with its own
    facing line rather than with a neighbouring wall's.
    """
    if not (0 < mm_per_pt < 1000):
        raise PlanTraceError('Unusable calibration.')
    runs = [_normalised_run(*run)
            for run in open_runs(page, collinear_pt=COLLINEAR_TOL_MM / mm_per_pt)]
    viable = [run for run in runs if (run[3] - run[2]) * mm_per_pt >= MIN_WALL_LENGTH_MM]
    stats = {'runs': len(runs), 'viableRuns': len(viable), 'paired': 0, 'faces': 0}
    bands = []
    gaps = []
    used_face = set()
    used_partner = set()
    # Longest stroke first, so a wall's outer face claims its own facing pieces
    # before a shorter stroke can claim them as part of something else.
    for index in sorted(range(len(viable)), key=lambda i: -(viable[i][3] - viable[i][2])):
        if index in used_face or index in used_partner:
            continue
        run = viable[index]
        for side in (-1, 1):
            candidates = []
            for other_index, other in enumerate(viable):
                if other_index == index or other_index in used_partner \
                        or other_index in used_face or other[0] != run[0]:
                    continue
                delta = other[1] - run[1]
                if delta == 0 or (delta > 0) != (side > 0):
                    continue
                gap_mm = abs(delta) * mm_per_pt
                if gap_mm < WALL_MIN_MM or gap_mm > WALL_MAX_MM:
                    continue
                low, high = max(run[2], other[2]), min(run[3], other[3])
                overlap_mm = (high - low) * mm_per_pt
                shorter_mm = min(run[3] - run[2], other[3] - other[2]) * mm_per_pt
                if overlap_mm < MIN_WALL_LENGTH_MM or overlap_mm < shorter_mm * PAIR_OVERLAP_RATIO:
                    continue
                candidates.append((overlap_mm, other_index, other, low, high, gap_mm))
            # One face can be met by several pieces, but never by two pieces that
            # cover the same stretch of it - that would count one wall twice.
            candidates.sort(key=lambda item: -item[0])
            accepted = []
            for candidate in candidates:
                if any(not (candidate[4] <= taken[3] or candidate[3] >= taken[4])
                       for taken in accepted):
                    continue
                accepted.append(candidate)
            if not accepted:
                continue
            # A gap between two pieces meeting the SAME face is an opening in that
            # wall. Measuring it here, along the face, is what keeps openings
            # detectable now that a wall run can span several pieces.
            by_position = sorted(accepted, key=lambda item: item[3])
            for previous, following in zip(by_position, by_position[1:]):
                width_mm = (following[3] - previous[4]) * mm_per_pt
                if not OPENING_MIN_MM <= width_mm <= OPENING_MAX_MM:
                    continue
                mean_gap = (previous[5] + following[5]) / 2.0
                gaps.append({'axis': run[0],
                             'perp': run[1] + side * (mean_gap / mm_per_pt) / 2.0,
                             'a': previous[4], 'b': following[3],
                             'thicknessMm': max(previous[5], following[5]),
                             'widthMm': width_mm})
            used_face.add(index)
            stats['faces'] += 1
            for overlap_mm, other_index, other, low, high, gap_mm in accepted:
                used_partner.add(other_index)
                perp = (run[1] + other[1]) / 2.0
                half = gap_mm / mm_per_pt / 2.0
                rect = ((low, perp - half, high, perp + half) if run[0] == 'h'
                        else (perp - half, low, perp + half, high))
                bands.append({'axis': run[0], 'perp': perp, 'a': low, 'b': high,
                              'thicknessMm': gap_mm, 'lengthMm': overlap_mm,
                              'rect': rect, 'paired': True})
                stats['paired'] += 1
                if len(bands) > MAX_WALLS:
                    raise PlanTraceError('Wall band limit exceeded.')
    return bands, gaps, stats


def drop_regular_arrays(bands, mm_per_pt, min_members=4, max_spacing_mm=450.0,
                        spacing_ratio=1.6):
    """Discard stair treads, hatching and dimension ticks.

    Those are regular, close-spaced, mutually overlapping parallel bands. A real
    wall layout is not regular at that pitch, so a run of at least `min_members`
    bands with near-uniform spacing is dropped while a pair of genuinely close
    parallel walls survives.
    """
    if not bands:
        return [], {'dropped': 0}
    keep = []
    dropped = 0
    for axis in ('h', 'v'):
        group = sorted((b for b in bands if b['axis'] == axis),
                       key=lambda b: (b['perp'], b['a']))
        index = 0
        while index < len(group):
            chain = [group[index]]
            cursor = index + 1
            while cursor < len(group):
                previous, current = chain[-1], group[cursor]
                if (current['perp'] - previous['perp']) * mm_per_pt > max_spacing_mm:
                    break
                if current['a'] > previous['b'] or current['b'] < previous['a']:
                    break
                chain.append(current)
                cursor += 1
            spacings = [(b['perp'] - a['perp']) * mm_per_pt
                        for a, b in zip(chain, chain[1:])]
            if (len(chain) >= min_members and spacings
                    and max(spacings) <= min(spacings) * spacing_ratio):
                dropped += len(chain)
                index = cursor
                continue
            keep.append(group[index])
            index += 1
    return keep, {'dropped': dropped}


# --- window and door symbols ------------------------------------------------
# Rendering Wardoo sheet 6 shows how this drawing actually works: a window is a
# rectangle of roughly wall thickness carrying several parallel glazing rules,
# sitting in a gap in the wall poche. Such a rectangle has exactly the shape
# wall_bands accepts, so without this check a window is counted as a wall AND, by
# merging with the poche either side of it, it closes the very gap that identifies
# the opening.

SYMBOL_MIN_RULES = 2
SYMBOL_SPAN_RATIO = 0.8


def symbol_rectangles(page, mm_per_pt):
    """Wall-thickness rectangles carrying internal parallel rules.

    That is what a window or door symbol looks like on this drawing: the internal
    rules are the glazing or leaf lines, and they are the evidence that separates
    a symbol from a plain wall stub of the same size.
    """
    if not (0 < mm_per_pt < 1000):
        raise PlanTraceError('Unusable calibration.')
    rects, _ = rectangles(page)
    runs = [_normalised_run(*run)
            for run in open_runs(page, collinear_pt=COLLINEAR_TOL_MM / mm_per_pt)]
    symbols = []
    for x0, y0, x1, y1 in rects:
        width_pt, height_pt = x1 - x0, y1 - y0
        thickness_mm = min(width_pt, height_pt) * mm_per_pt
        if not WALL_MIN_MM <= thickness_mm <= WALL_MAX_MM:
            continue
        horizontal = width_pt >= height_pt
        axis = 'h' if horizontal else 'v'
        span_low, span_high = (x0, x1) if horizontal else (y0, y1)
        inside_low, inside_high = (y0, y1) if horizontal else (x0, x1)
        span_mm = (span_high - span_low) * mm_per_pt
        if span_mm < OPENING_MIN_MM:
            continue
        rules = 0
        for run in runs:
            if run[0] != axis:
                continue
            if not inside_low + 1e-6 < run[1] < inside_high - 1e-6:
                continue
            if (run[2] >= span_low + 1e-6 and run[3] <= span_high - 1e-6
                    and (run[3] - run[2]) >= (span_high - span_low) * SYMBOL_SPAN_RATIO):
                rules += 1
        if rules >= SYMBOL_MIN_RULES:
            symbols.append({'axis': axis, 'perp': (inside_low + inside_high) / 2.0,
                            'a': span_low, 'b': span_high,
                            'thicknessMm': thickness_mm, 'lengthMm': span_mm,
                            'widthMm': span_mm, 'rules': rules,
                            'rect': (x0, y0, x1, y1)})
    return symbols


def merge_gaps(groups, mm_per_pt):
    """Union of opening candidates, dropping ones that overlap a wider report.

    The same opening can be found twice - once between two merged bands and once
    along the wall face that produced them - so overlapping candidates on the same
    line are reduced to the single widest report rather than counted twice.
    """
    candidates = sorted((gap for group in groups for gap in group),
                        key=lambda gap: -gap['widthMm'])
    tolerance = COLLINEAR_TOL_MM / mm_per_pt
    kept = []
    for gap in candidates:
        if any(gap['axis'] == other['axis']
               and abs(gap['perp'] - other['perp']) <= tolerance
               and not (gap['b'] <= other['a'] or gap['a'] >= other['b'])
               for other in kept):
            continue
        kept.append(gap)
    return kept


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

    region = plan_region(page)
    raw, stats = wall_bands(page, mm_per_pt)
    paired, face_gaps, pair_stats = open_wall_bands(page, mm_per_pt)
    # A window or door symbol is a wall-thickness rectangle carrying glazing or
    # leaf rules. It must not become a wall: doing so also merges with the poche
    # either side and closes the gap that identifies the opening.
    symbols = [symbol for symbol in symbol_rectangles(page, mm_per_pt)
               if within_region(region, symbol['axis'], symbol['perp'],
                                symbol['a'], symbol['b'])]
    symbol_rects = {symbol['rect'] for symbol in symbols}
    raw = [band for band in raw if band['rect'] not in symbol_rects]
    inside = [band for band in raw + paired
              if within_region(region, band['axis'], band['perp'], band['a'], band['b'])]
    outside = len(raw) + len(paired) - len(inside)
    bands, array_stats = drop_regular_arrays(merge_bands(inside, mm_per_pt), mm_per_pt)
    kept_gaps = [gap for gap in face_gaps
                 if within_region(region, gap['axis'], gap['perp'], gap['a'], gap['b'])]
    symbol_gaps = [{key: symbol[key] for key in
                    ('axis', 'perp', 'a', 'b', 'thicknessMm', 'widthMm', 'rules')}
                   for symbol in symbols]
    gaps = merge_gaps([traced_openings(bands, mm_per_pt), kept_gaps, symbol_gaps],
                      mm_per_pt)
    stats = dict(stats)
    stats.update({'closedBands': len(raw), 'openWallBands': len(paired),
                  'pairedRuns': pair_stats['paired'], 'outsideRegion': outside,
                  'symbols': len(symbols),
                  'droppedRegular': array_stats['dropped'],
                  'region': [round(v, 1) for v in region] if region else None})

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
            'A wall band is either a closed axis-aligned quadrilateral or a pair of '
            f'parallel open strokes, with a measured thickness between {WALL_MIN_MM:g} '
            f'and {WALL_MAX_MM:g} mm. Curved walls and diagonal geometry are still '
            'not recovered, and neither are walls outside the detected plan region.',
            'Wall bands are isolated by drawing density: only the densest contiguous '
            'block of the sheet is kept, so title-block and margin linework is '
            'excluded. Regular close-spaced parallel bands (stair treads, hatching, '
            'dimension ticks) are discarded.',
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
            'fromClosedBands': sum(1 for band in bands if not band.get('paired')),
            'fromOpenPairs': sum(1 for band in bands if band.get('paired')),
            'excludedOutsideRegion': outside,
            'excludedRegularArray': array_stats['dropped'],
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
            'fromClosedBands': scene['summary']['fromClosedBands'],
            'fromOpenPairs': scene['summary']['fromOpenPairs'],
            'excludedOutsideRegion': scene['summary']['excludedOutsideRegion'],
            'excludedRegularArray': scene['summary']['excludedRegularArray'],
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
