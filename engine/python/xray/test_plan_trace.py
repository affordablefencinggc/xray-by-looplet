"""Independent regression tests for the automatic PDF plan linework tracer.

These exercise the geometry heuristics directly on synthetic page data (no PDF
needed) plus one real end-to-end run through pikepdf, so a failure names the
rule that broke rather than only "the extraction changed".
"""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import pikepdf

from xray.plan_trace import (
    COLLINEAR_TOL_MM, OPENING_MIN_MM, PlanTraceError, WALL_MAX_MM, WALL_MIN_MM,
    build_scene, drop_regular_arrays, main, merge_bands, open_wall_bands,
    plan_region, rectangles, subpaths, symbol_rectangles, trace_plan,
    traced_openings, validate_trace_scene, wall_bands, within_region)


def rect_path(x0, y0, x1, y1):
    return [['M', x0, y0], ['L', x1, y0], ['L', x1, y1], ['L', x0, y1], ['Z']]


def page_with(paths, width=1191.0, height=842.0, number=1):
    return {'page': number, 'widthPt': width, 'heightPt': height,
            'paths': [{'commands': commands} for commands in paths]}


def extracted_for(page):
    return {'source': {'name': 'synthetic.pdf', 'sha256': 'a' * 64, 'pageCount': 1},
            'pages': [page]}


class SubpathTests(unittest.TestCase):
    def test_move_line_close_curve_and_open_tail_are_separated(self):
        page = page_with([[
            ['M', 0, 0], ['L', 10, 0], ['L', 10, 10], ['Z'],
            ['M', 50, 50], ['C', 60, 60, 70, 70, 80, 80], ['L', 90, 80],
        ]])
        paths, curves = subpaths(page)
        self.assertEqual(curves, 1)
        self.assertEqual(len(paths), 2)
        self.assertTrue(paths[0]['closed'])
        self.assertFalse(paths[1]['closed'])
        # The curve endpoint is carried forward so the following line attaches.
        self.assertEqual(paths[1]['points'][-1], (90.0, 80.0))

    def test_unknown_command_is_rejected(self):
        with self.assertRaisesRegex(PlanTraceError, 'Unknown path command'):
            subpaths(page_with([[['M', 0, 0], ['Q', 1, 1]]]))

    def test_non_finite_coordinate_is_rejected(self):
        with self.assertRaisesRegex(PlanTraceError, 'supported range'):
            subpaths(page_with([[['M', 0, 0], ['L', float('nan'), 1]]]))


class RectangleTests(unittest.TestCase):
    def test_axis_aligned_quad_is_accepted_and_bounds_are_normalised(self):
        rects, stats = rectangles(page_with([rect_path(100, 300, 1100, 200)]))
        self.assertEqual(rects, [(100.0, 200.0, 1100.0, 300.0)])
        self.assertEqual(stats['notQuad'], 0)
        self.assertEqual(stats['notAxisAligned'], 0)

    def test_l_shape_is_decomposed_exactly_rather_than_bounded(self):
        # An L is two rectangles, not its bounding box: the strips must tile the
        # L exactly (area 7500, not the 10000 a bounding box would claim) and no
        # strip may span the missing quadrant.
        l_shape = [['M', 0, 0], ['L', 100, 0], ['L', 100, 50], ['L', 50, 50],
                   ['L', 50, 100], ['L', 0, 100], ['Z']]
        rects, stats = rectangles(page_with([l_shape]))
        self.assertEqual(stats['polygons'], 1)
        self.assertEqual(stats['notQuad'], 0)
        area = sum((x1 - x0) * (y1 - y0) for x0, y0, x1, y1 in rects)
        self.assertAlmostEqual(area, 7500.0)
        for x0, y0, x1, y1 in rects:
            self.assertFalse(x1 > 50 and y1 > 50, (x0, y0, x1, y1))

    def test_diagonal_quad_is_rejected(self):
        diamond = [['M', 0, 50], ['L', 50, 0], ['L', 100, 50], ['L', 50, 100], ['Z']]
        rects, stats = rectangles(page_with([diamond]))
        self.assertEqual(rects, [])
        self.assertEqual(stats['notAxisAligned'], 1)

    def test_open_subpath_is_never_a_wall_band(self):
        rects, stats = rectangles(page_with([rect_path(0, 0, 100, 100)[:-1]]))
        self.assertEqual(rects, [])
        self.assertEqual(stats['notClosed'], 1)


class WallBandTests(unittest.TestCase):
    def test_thickness_and_length_are_measured_in_millimetres(self):
        # 1000 pt x 100 pt at 1 mm/pt is a 1 m long, 100 mm thick wall.
        bands, stats = wall_bands(page_with([rect_path(100, 200, 1100, 300)]), 1.0)
        self.assertEqual(len(bands), 1)
        band = bands[0]
        self.assertEqual(band['axis'], 'h')
        self.assertAlmostEqual(band['thicknessMm'], 100.0)
        self.assertAlmostEqual(band['lengthMm'], 1000.0)
        self.assertAlmostEqual(band['perp'], 250.0)
        self.assertEqual(stats['tooThin'] + stats['tooThick'] + stats['tooShort'], 0)

    def test_thin_thick_and_short_rectangles_are_excluded(self):
        thin = rect_path(100, 200, 1100, 200 + (WALL_MIN_MM - 1))
        thick = rect_path(100, 400, 1100, 400 + (WALL_MAX_MM + 1))
        short = rect_path(100, 600, 400, 700)
        bands, stats = wall_bands(page_with([thin, thick, short]), 1.0)
        self.assertEqual(bands, [])
        self.assertEqual((stats['tooThin'], stats['tooThick'], stats['tooShort']), (1, 1, 1))

    def test_vertical_band_reports_vertical_axis(self):
        bands, _ = wall_bands(page_with([rect_path(100, 200, 200, 1200)]), 1.0)
        self.assertEqual(len(bands), 1)
        self.assertEqual(bands[0]['axis'], 'v')

    def test_unusable_calibration_is_rejected(self):
        for bad in (0, -1, 5000):
            with self.subTest(mm_per_pt=bad), self.assertRaisesRegex(PlanTraceError, 'calibration'):
                wall_bands(page_with([rect_path(0, 0, 100, 50)]), bad)


class MergeAndOpeningTests(unittest.TestCase):
    def test_overlapping_collinear_bands_merge_into_one_run(self):
        bands, _ = wall_bands(page_with([rect_path(100, 200, 600, 300),
                                         rect_path(400, 200, 1000, 300)]), 1.0)
        merged = merge_bands(bands, 1.0)
        self.assertEqual(len(merged), 1)
        self.assertAlmostEqual(merged[0]['a'], 100.0)
        self.assertAlmostEqual(merged[0]['b'], 1000.0)
        self.assertAlmostEqual(merged[0]['lengthMm'], 900.0)

    def test_parallel_bands_beyond_the_tolerance_stay_separate(self):
        offset = COLLINEAR_TOL_MM + 50
        bands, _ = wall_bands(page_with([rect_path(100, 200, 600, 300),
                                         rect_path(100, 200 + offset, 600, 300 + offset)]), 1.0)
        self.assertEqual(len(merge_bands(bands, 1.0)), 2)

    def test_collinear_gap_in_the_opening_band_is_reported(self):
        bands, _ = wall_bands(page_with([rect_path(100, 200, 600, 300),
                                         rect_path(1600, 200, 2600, 300)]), 1.0)
        openings = traced_openings(merge_bands(bands, 1.0), 1.0)
        self.assertEqual(len(openings), 1)
        self.assertAlmostEqual(openings[0]['widthMm'], 1000.0)
        self.assertEqual(openings[0]['axis'], 'h')

    def test_gap_below_the_opening_band_is_not_reported(self):
        gap = OPENING_MIN_MM - 100
        bands, _ = wall_bands(page_with([rect_path(100, 200, 600, 300),
                                         rect_path(600 + gap, 200, 1600 + gap, 300)]), 1.0)
        self.assertEqual(traced_openings(merge_bands(bands, 1.0), 1.0), [])


class SceneTests(unittest.TestCase):
    def scene_for(self, commands, mm_per_pt=1.0, **kwargs):
        return build_scene(extracted_for(page_with(commands)), 1, mm_per_pt, **kwargs)

    def test_walls_and_openings_become_validated_meshes(self):
        scene = self.scene_for([rect_path(100, 200, 600, 300),
                                rect_path(1600, 200, 2100, 300)])
        self.assertTrue(validate_trace_scene(scene))
        self.assertEqual(scene['schema'], 'xray.source-building/v1')
        self.assertEqual(scene['units'], 'm')
        self.assertEqual(scene['summary']['wallRuns'], 2)
        self.assertEqual(scene['summary']['openings'], 1)
        walls = [o for o in scene['objects'] if o['category'] == 'wall']
        self.assertEqual(len(walls), 2)
        for wall in walls:
            self.assertEqual(len(wall['positions']), 24)
            self.assertEqual(min(wall['positions'][1::3]), 0.0)
            self.assertEqual(max(wall['positions'][1::3]), 2.70)
            self.assertEqual(wall['material'], 'wall')
        opening = next(o for o in scene['objects'] if o['category'] == 'opening')
        self.assertEqual(opening['material'], 'opening')
        self.assertGreater(opening['positions'][1::3][4], 0.0)

    def test_wall_height_and_head_depth_are_honoured(self):
        scene = self.scene_for([rect_path(100, 200, 600, 300),
                                rect_path(1600, 200, 2100, 300)],
                               wall_height_m=3.0, head_depth_m=0.4)
        self.assertEqual(sorted({v for o in scene['objects'] for v in o['positions'][1::3]}),
                         [0.0, 2.6, 3.0])

    def test_unverified_calibration_is_disclosed_in_the_scene(self):
        scene = self.scene_for([rect_path(100, 200, 1100, 300)],
                               scale={'value': '1:100', 'verified': False})
        self.assertFalse(scene['summary']['calibration']['verified'])
        self.assertTrue(any('NOT verified' in line for line in scene['assumptions']))
        verified = self.scene_for([rect_path(100, 200, 1100, 300)],
                                  scale={'value': '1:100', 'verified': True})
        self.assertTrue(verified['summary']['calibration']['verified'])

    def test_a_page_with_no_wall_bands_writes_no_scene(self):
        with self.assertRaisesRegex(PlanTraceError, 'No wall bands'):
            self.scene_for([rect_path(0, 0, 10, 10)])

    def test_unknown_page_is_rejected(self):
        with self.assertRaisesRegex(PlanTraceError, 'not in the extraction'):
            build_scene(extracted_for(page_with([rect_path(100, 200, 1100, 300)])), 2, 1.0)

    def test_diagnostics_record_what_was_discarded(self):
        scene = self.scene_for([rect_path(100, 200, 1100, 300), rect_path(0, 0, 10, 10)])
        self.assertEqual(scene['diagnostics']['tooThin'], 1)
        self.assertEqual(scene['diagnostics']['rectangles'], 2)


class ValidatorTests(unittest.TestCase):
    def base_scene(self):
        return build_scene(extracted_for(
            page_with([rect_path(100, 200, 600, 300),
                       rect_path(1600, 200, 2100, 300)])), 1, 1.0)

    def test_forged_scenes_are_rejected(self):
        import copy
        base = self.base_scene()
        self.assertGreaterEqual(len(base['objects']), 2)

        def forged(change):
            scene = copy.deepcopy(base)
            change(scene)
            return scene

        def duplicate_id(scene):
            scene['objects'][1]['id'] = scene['objects'][0]['id']

        def nan_position(scene):
            scene['objects'][0]['positions'][0] = float('nan')

        def out_of_range_index(scene):
            scene['objects'][0]['indices'][0] = 99

        def unknown_material(scene):
            scene['objects'][0]['material'] = 'invented'

        def no_refs(scene):
            scene['objects'][0]['sourceRefs'] = []

        def bad_page(scene):
            scene['objects'][0]['sourceRefs'][0]['page'] = 7

        def bad_region(scene):
            scene['objects'][0]['sourceRefs'][0]['region'] = [10, 10, 5, 20]

        def outside_trace(scene):
            scene['objects'][0]['sourceRefs'][0]['trace'] = [[-1, 0]]

        def wrong_units(scene):
            scene['units'] = 'mm'

        def no_pages(scene):
            scene['source']['pageCount'] = 0

        def degenerate(scene):
            indices = list(scene['objects'][0]['indices'])
            indices[1] = indices[0]
            scene['objects'][0]['indices'] = indices

        cases = [(duplicate_id, 'Duplicate object id'),
                 (nan_position, 'Invalid mesh positions'),
                 (out_of_range_index, 'Invalid mesh indices'),
                 (unknown_material, 'Missing source/material'),
                 (no_refs, 'Missing source/material'),
                 (bad_page, 'Invalid source page'),
                 (bad_region, 'Invalid source region'),
                 (outside_trace, 'outside the page box'),
                 (wrong_units, 'Invalid scene contract'),
                 (no_pages, 'page count'),
                 (degenerate, 'Degenerate triangle')]
        for change, message in cases:
            with self.subTest(message=message), self.assertRaisesRegex(PlanTraceError, message):
                validate_trace_scene(forged(change))


class OpenWallPairTests(unittest.TestCase):
    """Parallel open strokes paired into walls, and the guards around it."""

    @staticmethod
    def run_page(runs):
        return page_with([[['M', x0, y0], ['L', x1, y1]] for x0, y0, x1, y1 in runs])

    def test_two_parallel_runs_become_one_measured_band(self):
        bands, gaps, stats = open_wall_bands(
            self.run_page([(100, 200, 1100, 200), (100, 300, 1100, 300)]), 1.0)
        self.assertEqual(len(bands), 1)
        self.assertEqual(stats['paired'], 1)
        self.assertAlmostEqual(bands[0]['thicknessMm'], 100.0)
        self.assertAlmostEqual(bands[0]['lengthMm'], 1000.0)
        self.assertEqual(bands[0]['axis'], 'h')

    def test_separation_outside_the_wall_band_is_never_paired(self):
        too_close = self.run_page([(100, 200, 1100, 200),
                                   (100, 200 + WALL_MIN_MM - 10, 1100, 200 + WALL_MIN_MM - 10)])
        self.assertEqual(open_wall_bands(too_close, 1.0)[0], [])
        too_far = self.run_page([(100, 200, 1100, 200),
                                 (100, 200 + WALL_MAX_MM + 50, 1100, 200 + WALL_MAX_MM + 50)])
        self.assertEqual(open_wall_bands(too_far, 1.0)[0], [])

    def test_a_stroke_is_never_used_as_both_sides_of_two_walls(self):
        bands, _, stats = open_wall_bands(
            self.run_page([(100, 200, 1100, 200), (100, 300, 1100, 300),
                           (100, 400, 1100, 400)]), 1.0)
        self.assertEqual(len(bands), 1)
        self.assertEqual(stats['paired'], 1)

    def test_barely_overlapping_runs_are_not_a_wall(self):
        bands, _, _ = open_wall_bands(
            self.run_page([(100, 200, 2000, 200), (1900, 300, 2100, 300)]), 1.0)
        self.assertEqual(bands, [])

    def test_best_overlapping_partner_wins_over_a_nearer_one(self):
        # A at y=200 (x 100..1100); C at y=260 is closer but overlaps A by only
        # 500 mm; B at y=300 overlaps A over its full 1000 mm and is the real
        # facing line, so the measured thickness must be 100 mm.
        bands, _, _ = open_wall_bands(
            self.run_page([(100, 200, 1100, 200),
                           (600, 260, 1600, 260),
                           (100, 300, 1100, 300)]), 1.0)
        self.assertIn(100.0, [round(b['thicknessMm'], 3) for b in bands])

    def test_a_stroke_shorter_than_the_minimum_is_never_paired(self):
        bands, _, stats = open_wall_bands(
            self.run_page([(100, 200, 1100, 200), (100, 300, 300, 300)]), 1.0)
        self.assertEqual(bands, [])
        self.assertEqual(stats['viableRuns'], 1)

    def test_gap_between_pieces_facing_one_wall_is_reported_as_an_opening(self):
        # One 2500 mm face at y=200, met by two 500 mm pieces at y=300 with a
        # 1000 mm gap between them: one wall in two runs, one opening.
        bands, gaps, _ = open_wall_bands(
            self.run_page([(100, 200, 2600, 200),
                           (100, 300, 600, 300),
                           (1600, 300, 2100, 300)]), 1.0)
        self.assertEqual(len(bands), 2)
        self.assertEqual(len(gaps), 1)
        self.assertAlmostEqual(gaps[0]['widthMm'], 1000.0)
        self.assertEqual(gaps[0]['axis'], 'h')

    def test_unusable_calibration_is_rejected(self):
        with self.assertRaisesRegex(PlanTraceError, 'calibration'):
            open_wall_bands(self.run_page([(0, 0, 1000, 0)]), 0)

    def test_scene_attributes_paired_walls_to_the_open_pair_source(self):
        # Regression: the paired flag was once dropped, so the summary credited
        # every open double-line wall to the closed-quad reader.
        scene = build_scene(
            extracted_for(self.run_page([(100, 200, 1100, 200), (100, 300, 1100, 300)])),
            1, 1.0)
        self.assertEqual(scene['summary']['wallRuns'], 1)
        self.assertEqual(scene['summary']['fromOpenPairs'], 1)
        self.assertEqual(scene['summary']['fromClosedBands'], 0)
        self.assertEqual(scene['summary']['wallHeightM'], 2.70)


class RegularArrayTests(unittest.TestCase):
    """Stair treads, hatching and dimension ticks must not read as walls."""

    @staticmethod
    def bands_at(perps, axis='h', a=100.0, b=1200.0, thickness=100.0):
        return [{'axis': axis, 'perp': perp, 'a': a, 'b': b,
                 'thicknessMm': thickness, 'lengthMm': (b - a),
                 'rect': (a, perp, b, perp)} for perp in perps]

    def test_uniform_close_spaced_chain_is_dropped(self):
        kept, stats = drop_regular_arrays(self.bands_at([200, 430, 660, 890, 1120]), 1.0)
        self.assertEqual(kept, [])
        self.assertEqual(stats['dropped'], 5)

    def test_two_close_parallel_walls_survive(self):
        kept, stats = drop_regular_arrays(self.bands_at([200, 500]), 1.0)
        self.assertEqual(len(kept), 2)
        self.assertEqual(stats['dropped'], 0)

    def test_irregular_chain_survives(self):
        kept, stats = drop_regular_arrays(self.bands_at([200, 300, 1500, 1560, 3000]), 1.0)
        self.assertEqual(len(kept), 5)
        self.assertEqual(stats['dropped'], 0)

    def test_non_overlapping_bands_are_never_chained(self):
        left = self.bands_at([200, 430, 660, 890], a=100.0, b=400.0)
        right = self.bands_at([200, 430, 660, 890], a=900.0, b=1200.0)
        kept, stats = drop_regular_arrays(left + right, 1.0)
        self.assertEqual(len(kept), 8)
        self.assertEqual(stats['dropped'], 0)

    def test_empty_input_is_safe(self):
        self.assertEqual(drop_regular_arrays([], 1.0), ([], {'dropped': 0}))


class PlanRegionTests(unittest.TestCase):
    @staticmethod
    def clustered_page():
        paths = [[['M', 40, 40 + index * 45], ['L', 780, 40 + index * 45]]
                 for index in range(14)]
        paths.append(rect_path(1100, 760, 1160, 820))
        return page_with(paths)

    def test_region_covers_the_dense_block_and_excludes_the_stray(self):
        region = plan_region(self.clustered_page(), columns=8)
        self.assertIsNotNone(region)
        left, top, right, bottom = region
        self.assertLess(left, 100.0)
        self.assertLess(top, 100.0)
        self.assertLess(right, 1000.0)
        self.assertLess(bottom, 760.0)

    def test_a_sparse_page_yields_no_region_so_nothing_is_filtered(self):
        self.assertIsNone(plan_region(page_with([rect_path(0, 0, 100, 50)]), columns=8))
        self.assertTrue(within_region(None, 'h', 500, 0, 100))

    def test_within_region_uses_the_band_midpoint(self):
        region = (100.0, 100.0, 500.0, 500.0)
        self.assertTrue(within_region(region, 'h', 300, 200, 400))
        self.assertFalse(within_region(region, 'h', 300, 600, 800))
        self.assertTrue(within_region(region, 'v', 300, 200, 400))
        self.assertFalse(within_region(region, 'v', 700, 200, 400))


class SymbolTests(unittest.TestCase):
    """A window is a wall-thickness rectangle carrying glazing rules."""

    @staticmethod
    def page_with_symbol(rules, extra_walls=()):
        # A 700 mm x 120 mm symbol at 1 mm/pt, with optional glazing rules. Sized
        # so the page stays too sparse for the density grid to pick a plan
        # region, which would otherwise filter synthetic fixtures.
        paths = [rect_path(100, 200, 800, 320)]
        for index in range(rules):
            # 20 mm apart, so no two rules can pair into a thin "wall".
            y = 230 + index * 20
            paths.append([['M', 120, y], ['L', 780, y]])
        for wall in extra_walls:
            paths.append(rect_path(*wall))
        return page_with(paths)

    def test_rectangle_with_internal_rules_is_a_symbol(self):
        symbols = symbol_rectangles(self.page_with_symbol(3), 1.0)
        self.assertEqual(len(symbols), 1)
        self.assertEqual(symbols[0]['rules'], 3)
        self.assertAlmostEqual(symbols[0]['widthMm'], 700.0)
        self.assertAlmostEqual(symbols[0]['thicknessMm'], 120.0)

    def test_plain_wall_stub_of_the_same_shape_is_not_a_symbol(self):
        self.assertEqual(symbol_rectangles(self.page_with_symbol(0), 1.0), [])

    def test_one_internal_rule_is_not_enough_evidence(self):
        self.assertEqual(symbol_rectangles(self.page_with_symbol(1), 1.0), [])

    def test_a_symbol_scene_reports_it_as_an_opening_not_a_wall(self):
        # A symbol beside a real wall: the wall must stay a wall and the symbol
        # must become the opening, not a second wall.
        page = self.page_with_symbol(3, extra_walls=[(100, 400, 1100, 600)])
        scene = build_scene(extracted_for(page), 1, 1.0)
        self.assertEqual(scene['summary']['wallRuns'], 1)
        self.assertEqual(scene['summary']['openings'], 1)
        self.assertEqual(scene['diagnostics']['symbols'], 1)
        self.assertEqual(sorted(o['category'] for o in scene['objects']),
                         ['opening', 'wall'])

    def test_unusable_calibration_is_rejected(self):
        with self.assertRaisesRegex(PlanTraceError, 'calibration'):
            symbol_rectangles(self.page_with_symbol(3), 0)


class EndToEndTests(unittest.TestCase):
    """One real pikepdf source, so the extractor-to-scene path is exercised."""

    @staticmethod
    def plan_fixture(path):
        pdf = pikepdf.Pdf.new()
        page = pdf.add_blank_page(page_size=(1191, 842))
        page.Contents = pdf.make_stream(
            b'1 w 100 200 m 1100 200 l 1100 300 l 100 300 l h S '
            b'1800 200 m 2800 200 l 2800 300 l 1800 300 l h S')
        pdf.save(path, deterministic_id=True)

    def test_real_pdf_yields_measured_walls_and_a_traced_opening(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'plan.pdf'
            self.plan_fixture(source)
            scene = trace_plan(source, 1, 1.0, scale={'value': '1:100', 'verified': False})
            self.assertEqual(scene['summary']['wallRuns'], 2)
            self.assertEqual(scene['summary']['openings'], 1)
            self.assertEqual(scene['summary']['thicknessMm'],
                             {'min': 100.0, 'median': 100.0, 'max': 100.0})
            self.assertEqual(scene['summary']['status'], 'automatic-approximate')
            for obj in scene['objects']:
                for reference in obj['sourceRefs']:
                    self.assertEqual(reference['page'], 1)
                    self.assertEqual(reference['evidenceState'],
                                     'traced' if obj['category'] == 'wall' else 'inferred')

    def test_page_without_vector_paths_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'empty.pdf'
            pdf = pikepdf.Pdf.new()
            pdf.add_blank_page()
            pdf.save(source)
            with self.assertRaisesRegex(PlanTraceError, 'no vector paths'):
                trace_plan(source, 1, 1.0)

    def test_cli_writes_the_scene_and_refuses_to_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'plan.pdf'
            self.plan_fixture(source)
            out = Path(directory) / 'scene.json'
            with contextlib.redirect_stdout(io.StringIO()) as stdout:
                code = main([str(source), '--page', '1', '--mm-per-pt', '1',
                             '--out', str(out), '--scale-value', '1:100'])
            self.assertEqual(code, 0)
            payload = json.loads(stdout.getvalue())
            self.assertEqual(payload['wallRuns'], 2)
            self.assertFalse(payload['calibrationVerified'])
            self.assertEqual(json.loads(out.read_text(encoding='utf-8'))['schema'],
                             'xray.source-building/v1')
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main([str(source), '--page', '1', '--mm-per-pt', '1',
                                       '--out', str(out)]), 2)

    def test_cli_reports_a_missing_source_without_a_traceback(self):
        with tempfile.TemporaryDirectory() as directory:
            with contextlib.redirect_stderr(io.StringIO()) as stderr:
                code = main([str(Path(directory) / 'absent.pdf'), '--page', '1',
                             '--mm-per-pt', '1', '--out', str(Path(directory) / 'out.json')])
            self.assertEqual(code, 2)
            self.assertNotIn('Traceback', stderr.getvalue())


if __name__ == '__main__':
    unittest.main()
