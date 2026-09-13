import base64
import hashlib
from pathlib import Path
import tempfile
import unittest
from xray.assistant_geometry import inspect, region_box, lines
from xray.source_wireframe import WireframeError
from xray.test_source_wireframe import source_fixture


class AssistantGeometryTests(unittest.TestCase):
    def test_regions_reject_invalid_bounds(self):
        for region in [[.9, 0, .2, 1], [0, 0, 0, 1], [float('nan'), 0, 1, 1]]:
            with self.assertRaises(WireframeError):
                region_box(region, 400, 300)
        self.assertEqual(region_box([.25, .25, .5, .5], 400, 300), [100, 75, 200, 150])

    def test_lines_preserve_source_ids_and_endpoints_and_skip_curves(self):
        paths = [{'id': 'p3/5', 'commands': [['M', 0, 0], ['L', 10, 0], ['C', 20, 0, 20, 10, 10, 10], ['Z']]}]
        result = lines(paths, [5, 0, 1, 1])
        self.assertEqual(result[0], {'id': 'p3/5/s1', 'a': [0, 0], 'b': [10, 0], 'lengthPt': 10.0})
        self.assertEqual([r['id'] for r in result], ['p3/5/s1', 'p3/5/s3'])
        self.assertEqual(result[1]['b'], [0, 0])  # closed path retains its real closing edge

    def test_real_pdf_crop_rotation_and_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'fixture.pdf'
            source_fixture(path)
            content = path.read_bytes()
        request = dict(pdfBase64=base64.b64encode(content).decode(), sha256=hashlib.sha256(content).hexdigest(), page=1)
        result = inspect(request)
        self.assertEqual((result['widthPt'], result['heightPt']), (200, 300))
        self.assertTrue(result['segments'])
        self.assertTrue(result['image']['data'].startswith('iVBORw0KGgo'))
        self.assertEqual(result['sourceSha256'], request['sha256'])
        segment = result['segments'][0]
        mapped = inspect({**request, 'scaleSegmentId': segment['id'], 'knownLengthMm': 820})
        self.assertAlmostEqual(mapped['scaleMapping']['mmPerPt'], 820/segment['lengthPt'])
        self.assertAlmostEqual(next(s for s in mapped['segments'] if s['id']==segment['id'])['lengthMm'], 820)
        with self.assertRaises(WireframeError):
            inspect({**request, 'scaleSegmentId': 'invented', 'knownLengthMm': 820})
        with self.assertRaises(WireframeError):
            inspect({**request, 'sha256': '0'*64})
        with self.assertRaises(WireframeError):
            inspect({**request, 'page': 2})


if __name__ == '__main__':
    unittest.main()
