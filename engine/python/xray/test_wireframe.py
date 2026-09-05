import copy
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from xray.wireframe import build_scene, roundtrip_check, render_html


def fixture():
    return {'document': {'sha256': 'a'*64}, 'symbols': [
        {'id': 'root/a', 'blockName': 'door', 'x': 12, 'y': -3},
        {'id': 'root/b', 'blockName': '__proto__', 'x': -12, 'y': 8},
    ]}


class WireframeTests(unittest.TestCase):
    def test_placed_identity_coordinates_and_counts_preserved_without_mutation(self):
        data = fixture(); original = copy.deepcopy(data)
        scene = build_scene(data, heights={'door': 2}, default_height=1)
        self.assertEqual(data, original)
        self.assertTrue(roundtrip_check(scene, data)['ok'])
        self.assertEqual(scene['elements'][0]['kind'], 'symbol-extrusion')
        self.assertEqual(scene['elements'][0]['a'], [12, -3, 0])
        self.assertEqual(scene['elements'][0]['heightTier'], 'given')
        self.assertEqual(scene['elements'][1]['heightTier'], 'needs-human')
        self.assertEqual(scene, build_scene(data, heights={'door': 2}, default_height=1))

    def test_empty_missing_duplicate_nonfinite_and_out_of_range_reject(self):
        for symbols in [[], [{'id':'a','blockName':'x'}], [fixture()['symbols'][0]]*2,
                        [{'id':'a','blockName':'x','x':float('nan'),'y':0}],
                        [{'id':'a','blockName':'x','x':1e20,'y':0}]]:
            with self.subTest(symbols=symbols), self.assertRaises(ValueError):
                build_scene({'symbols': symbols})
        self.assertFalse(roundtrip_check({'elements': []}, {'symbols': []})['ok'])

    def test_invalid_heights_reject(self):
        for height in [0, -1, math.nan, math.inf, 1e20, True, '3']:
            with self.subTest(height=height), self.assertRaises(ValueError):
                build_scene(fixture(), default_height=height)
            with self.assertRaises(ValueError):
                build_scene(fixture(), heights={'door': height})

    def test_equal_counts_cannot_hide_changed_identity_type_coordinate_or_source(self):
        original = build_scene(fixture())
        mutations = [lambda s: s['elements'][0].update(nodeId='forged'),
                     lambda s: s['elements'][0].update(type='other'),
                     lambda s: s['elements'][0]['a'].__setitem__(0, 400),
                     lambda s: s['elements'][0]['b'].__setitem__(1, 400),
                     lambda s: s['source'].update(sha256='b'*64),
                     lambda s: s['elements'][0]['b'].__setitem__(2, -1)]
        for mutate in mutations:
            scene = copy.deepcopy(original); mutate(scene)
            self.assertFalse(roundtrip_check(scene, fixture())['ok'])

    def test_viewer_payload_does_not_break_out_of_script(self):
        data = fixture(); data['symbols'][0]['blockName'] = '</script><script>globalThis.injected=1</script>'
        html = render_html(build_scene(data))
        self.assertEqual(html.count('</script>'), 1)
        self.assertIn('\\u003c/script', html)
        self.assertIn('Object.create(null)', html)
        self.assertIn('cv.height!==Math.round(h*dpr)', html)

    def test_actual_cli_empty_input_nonzero_and_no_output(self):
        with tempfile.TemporaryDirectory() as scratch:
            path = Path(scratch) / 'empty.json'; path.write_text('{"symbols":[]}', encoding='utf-8')
            out = Path(scratch) / 'out'
            result = subprocess.run([sys.executable, '-m', 'xray.wireframe', str(path), '--out', str(out)], capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertFalse(out.exists())
            self.assertNotIn(b'OK', result.stdout)


if __name__ == '__main__': unittest.main()
