import copy
from pathlib import Path
import tempfile
import unittest
import contextlib
import io
from unittest.mock import patch

import pikepdf
import pypdfium2 as pdfium

from xray.source_wireframe import extract_pdf, page_matrix, render_svg, WireframeError


def source_fixture(path):
    """Synthetic source with known nested placement, curve, closed path and clipping."""
    pdf = pikepdf.Pdf.new()
    page = pdf.add_blank_page(page_size=(400, 300))
    page.CropBox = pikepdf.Array([10, 20, 310, 220]); page.Rotate = 90
    inner = pdf.make_stream(b'0 0 m 10 0 l 10 10 l h S 20 0 m 21 0 22 1 23 3 c S')
    inner.Type = pikepdf.Name('/XObject'); inner.Subtype = pikepdf.Name('/Form'); inner.BBox = pikepdf.Array([-100,-100,200,200])
    inner.Resources = pikepdf.Dictionary()
    outer = pdf.make_stream(b'q 0 1 -1 0 20 10 cm /Inner Do Q')
    outer.Type = pikepdf.Name('/XObject'); outer.Subtype = pikepdf.Name('/Form'); outer.BBox = pikepdf.Array([-100,-100,300,300])
    outer.Resources = pikepdf.Dictionary(XObject=pikepdf.Dictionary(Inner=inner))
    page.Resources = pikepdf.Dictionary(XObject=pikepdf.Dictionary(Outer=outer))
    page.Contents = pdf.make_stream(b'q 2 0 0 2 30 40 cm /Outer Do Q q 100 100 10 10 re W n 90 90 m 130 130 l S Q')
    pdf.save(path, deterministic_id=True)


class SourceWireframeTests(unittest.TestCase):
    def test_nested_transform_crop_rotation_curves_closed_paths_and_clipping(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'nested.pdf'; source_fixture(path)
            first = extract_pdf(path); second = extract_pdf(path)
            self.assertEqual(first, second)
            page = first['pages'][0]
            self.assertEqual((page['widthPt'], page['heightPt']), (200, 300))
            self.assertEqual(page['status'], 'partial')
            commands = [c for p in page['paths'] for c in p['commands']]
            self.assertIn(['M', 40, 60], commands)
            self.assertIn(['L', 60, 60], commands)
            self.assertIn(['L', 60, 40], commands)
            self.assertTrue(any(c[0] == 'C' and len(c) == 7 for c in commands))
            self.assertIn(['Z'], commands)
            self.assertGreaterEqual(page['omissions']['clippedObjects'], 1)
            self.assertTrue(all(len(p['objectIndices']) >= 3 for p in page['paths']))
            with pdfium.PdfDocument(path) as doc:
                image = doc[0].render(scale=2).to_pil().convert('RGB')
                # Known horizontal nested line at displayed page (50,60).
                self.assertLess(min(sum(image.getpixel((x,y))) for x in range(97,104) for y in range(117,124)), 300)
            self.assertIn('M40 60', render_svg(page))

    def test_all_page_rotations_have_expected_corner_mapping(self):
        from xray.source_wireframe import transform
        expected = {0:[0,200], 90:[0,0], 180:[300,0], 270:[200,300]}
        for rotation, coordinate in expected.items():
            matrix, _, _ = page_matrix([10,20,310,220], rotation)
            self.assertEqual(transform(matrix, 10,20), coordinate)

    def test_crop_outside_media_uses_effective_rendered_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'crop.pdf'
            pdf = pikepdf.Pdf.new(); page = pdf.add_blank_page(page_size=(400,300))
            page.CropBox = pikepdf.Array([-100,-100,600,700]); page.Rotate = 90
            page.Contents = pdf.make_stream(b'10 20 m 100 20 l S'); pdf.save(path)
            data = extract_pdf(path)['pages'][0]
            self.assertEqual(data['cropBox'], [0,0,400,300])
            with pdfium.PdfDocument(path) as doc:
                self.assertEqual((data['widthPt'], data['heightPt']), doc[0].get_size())

    def test_bounds_and_invalid_selection_fail_without_truncation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'nested.pdf'; source_fixture(path)
            for limit in ['MAX_BYTES', 'MAX_PAGES', 'MAX_OBJECTS', 'MAX_PATHS', 'MAX_SEGMENTS', 'MAX_DEPTH', 'MAX_OUTPUT_BYTES']:
                with self.subTest(limit=limit), patch('xray.source_wireframe.'+limit, 0), self.assertRaises(WireframeError):
                    extract_pdf(path)
            for pages in [[], [0], [1,1], [2], [True]]:
                with self.assertRaises(WireframeError): extract_pdf(path, pages)

    def test_raster_or_empty_page_is_explicitly_unsupported(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'empty.pdf'
            pdf = pikepdf.Pdf.new(); pdf.add_blank_page(); pdf.save(path)
            data = extract_pdf(path)
            self.assertEqual(data['status'], 'unsupported')
            self.assertEqual(data['pages'][0]['pathCount'], 0)

    def test_nested_objects_cannot_spend_outer_sibling_budget_twice(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'nested.pdf'; source_fixture(path)
            count = extract_pdf(path)['counts']['objects']
            with patch('xray.source_wireframe.MAX_OBJECTS', count-1), self.assertRaises(WireframeError):
                extract_pdf(path)

    def test_raster_is_not_converted_into_fake_vector_geometry(self):
        from PIL import Image, ImageDraw
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'raster.pdf'
            image = Image.new('RGB', (300,200), 'white')
            ImageDraw.Draw(image).rectangle((10,10,200,180), outline='black', width=3)
            image.save(path, 'PDF')
            data = extract_pdf(path)
            self.assertEqual(data['status'], 'unsupported')
            self.assertEqual(data['pages'][0]['omissions']['image'], 1)

    def test_cli_exclusive_output_failure_no_success_manifest(self):
        from xray.source_wireframe import main
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'nested.pdf'; source_fixture(source)
            existing = Path(directory) / 'exists'; existing.mkdir()
            marker = existing / 'keep.txt'; marker.write_text('keep')
            with contextlib.redirect_stdout(io.StringIO()) as stdout, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main([str(source),'--out',str(existing)]), 2)
            self.assertEqual(stdout.getvalue(), '')
            self.assertEqual(marker.read_text(), 'keep')
            output = Path(directory) / 'partial'
            original = Path.open
            def fail_write(path, *args, **kwargs):
                if path.name == 'index.html': raise OSError('simulated write failure')
                return original(path, *args, **kwargs)
            with patch.object(Path,'open',fail_write), contextlib.redirect_stdout(io.StringIO()) as stdout, contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(main([str(source),'--out',str(output)]), 2)
            self.assertEqual(stdout.getvalue(), '')
            self.assertFalse((output/'complete.json').exists())


if __name__ == '__main__': unittest.main()
