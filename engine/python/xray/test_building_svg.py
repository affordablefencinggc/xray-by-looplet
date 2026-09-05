"""Verify editable vectors against the actual Caroline source geometry."""
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import tempfile
import unittest
import xml.etree.ElementTree as ET

from xray.building_svg import architectural_edges, export, included, load_bound_scene, make_svg, NS, VIEWS
from xray.source_building import BuildingError

ROOT = Path(__file__).resolve().parents[3]
SCENE = ROOT / 'public/models/caroline/source-building.json'
SOURCE = ROOT / 'engine/fixtures/caroline-blueprints-renderings-2025-08-08.pdf'
SVG = '{'+NS+'}'


class BuildingSvgTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.scene, cls.sha = load_bound_scene(SCENE, SOURCE)
        cls.parts = {part['id']: part for part in cls.scene['objects']}

    def test_exact_source_identity_and_rejection(self):
        self.assertEqual(self.scene['source']['sha256'], hashlib.sha256(SOURCE.read_bytes()).hexdigest())
        self.assertEqual(self.sha, hashlib.sha256(SCENE.read_bytes()).hexdigest())
        with tempfile.TemporaryDirectory() as temp:
            wrong = Path(temp)/'wrong.pdf'
            wrong.write_bytes(b'%PDF-wrong-source')
            with self.assertRaisesRegex(BuildingError, 'SHA-256'):
                load_bound_scene(SCENE, wrong)

    def test_actual_slab_edges_remove_all_face_diagonals(self):
        part = self.parts['ground-main']
        edges = architectural_edges(part)
        self.assertEqual(len(edges), 12)
        # Each rectangular slab edge changes exactly one coordinate. Every
        # triangulation diagonal changes two, so cannot survive this assertion.
        for a, b in edges:
            self.assertEqual(sum(abs(x-y) > 1e-6 for x, y in zip(a, b)), 1)
        vertices = [tuple(part['positions'][i:i+3]) for i in range(0, len(part['positions']), 3)]
        self.assertTrue(all(a in vertices and b in vertices for a, b in edges))

    def test_actual_planar_roofs_preserve_only_perimeters(self):
        for part in self.parts.values():
            if part['category'] != 'roof':
                continue
            vertices = [tuple(part['positions'][i:i+3]) for i in range(0, len(part['positions']), 3)]
            expected = {tuple(sorted((a, vertices[(i+1) % len(vertices)]))) for i, a in enumerate(vertices)}
            self.assertEqual(set(architectural_edges(part)), expected, part['id'])

    def test_svg_xml_native_paths_provenance_and_finite_canvas(self):
        for view in VIEWS:
            data, metadata = make_svg(self.scene, self.sha, view)
            root = ET.fromstring(data)
            self.assertEqual(root.tag, SVG+'svg')
            self.assertFalse(any(node.tag in {SVG+'image', SVG+'foreignObject', SVG+'script'} for node in root.iter()))
            self.assertNotIn(b'data:image', data)
            bounds = list(map(float, root.attrib['viewBox'].split()))
            self.assertTrue(all(math.isfinite(v) for v in bounds))
            self.assertGreater(bounds[2], 100)
            self.assertGreater(bounds[3], 100)
            self.assertEqual(json.loads(root.find(SVG+'metadata').text), metadata)
            self.assertEqual(metadata['sceneSha256'], self.sha)
            self.assertEqual(metadata['source']['sha256'], self.scene['source']['sha256'])
            paths = root.findall('.//'+SVG+'path')
            self.assertGreater(len(paths), 100)
            count = 0
            for path in paths:
                commands = path.attrib['d']
                self.assertRegex(commands, r'^M')
                self.assertNotRegex(commands, r'[^ML0-9., \-]')
                values = list(map(float, re.findall(r'-?\d+(?:\.\d+)?', commands)))
                self.assertEqual(len(values) % 4, 0)
                self.assertTrue(all(math.isfinite(v) for v in values))
                for x, y in zip(values[::2], values[1::2]):
                    self.assertTrue(0 <= x <= bounds[2] and 0 <= y <= bounds[3])
                count += commands.count('M')
            self.assertEqual(count, metadata['segments'])

    def test_part_ids_source_refs_floor_filters_and_palette_hooks(self):
        for view in VIEWS:
            root = ET.fromstring(make_svg(self.scene, self.sha, view)[0])
            drawing = root.find(SVG+"g[@id='building-edges']")
            groups = drawing.findall(SVG+'g')
            ids = [group.attrib['data-part-id'] for group in groups]
            self.assertEqual(len(ids), len(set(ids)))
            self.assertEqual(set(ids), {part['id'] for part in self.parts.values() if included(part, view)})
            for group in groups:
                part = self.parts[group.attrib['data-part-id']]
                self.assertEqual(group.attrib['id'], 'part-'+hashlib.sha256(part['id'].encode()).hexdigest()[:20])
                self.assertEqual(json.loads(group.find(SVG+'metadata').text)['sourceRefs'], part['sourceRefs'])
                self.assertEqual(group.attrib['data-level'], part['level'])
            self.assertIsNotNone(root.find(SVG+"rect[@id='drawing-background']"))
            self.assertTrue(all(t.attrib['data-palette-role'] == 'text' for t in root.findall(SVG+'text')))

    def test_deterministic_regeneration_matches_public_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest = export(SCENE, SOURCE, temp)
            for result in manifest['outputs']:
                data = (Path(temp)/result['file']).read_bytes()
                self.assertEqual(data, (SCENE.parent/result['file']).read_bytes())
                self.assertEqual(hashlib.sha256(data).hexdigest(), result['sha256'])
            self.assertEqual(manifest, json.loads((SCENE.parent/'wireframe-manifest.json').read_text()))
            for view in VIEWS:
                a = make_svg(self.scene, self.sha, view)[0]
                shuffled = copy.deepcopy(self.scene)
                shuffled['objects'].reverse()
                self.assertEqual(a, make_svg(shuffled, self.sha, view)[0])

    def test_bad_meshes_and_duplicate_ids_rejected(self):
        part = copy.deepcopy(self.parts['ground-main'])
        part['indices'][0] = 999999
        with self.assertRaisesRegex(BuildingError, 'indices'):
            architectural_edges(part)
        part = copy.deepcopy(self.parts['ground-main'])
        part['positions'][0] = float('nan')
        with self.assertRaisesRegex(BuildingError, 'positions'):
            architectural_edges(part)
        scene = copy.deepcopy(self.scene)
        scene['objects'].append(scene['objects'][0])
        with self.assertRaisesRegex(BuildingError, 'Duplicate'):
            make_svg(scene, self.sha, 'axonometric')

    def test_visible_attribution_uses_supplied_source_metadata(self):
        # Reuse actual mesh geometry to isolate generic exporter labeling.
        scene = copy.deepcopy(self.scene)
        scene['source'].update(title='Alternative source drawing', author='Example drafter', license='Example license')
        root = ET.fromstring(make_svg(scene, self.sha, 'ground')[0])
        visible = ' '.join(node.text or '' for node in root.findall(SVG+'text'))
        self.assertIn('Alternative source drawing', visible)
        self.assertIn('Example drafter', visible)
        self.assertIn('Example license', visible)
        self.assertNotIn('Caroline', visible)
        self.assertNotIn('Jay Osborne', visible)
        expected_pages = sorted({ref['page'] for part in scene['objects'] if included(part, 'ground') for ref in part['sourceRefs']})
        self.assertIn('Referenced pages: '+', '.join(map(str, expected_pages)), visible)
        del scene['source']['title']
        root = ET.fromstring(make_svg(scene, self.sha, 'ground')[0])
        self.assertIn(scene['source']['name'], root.find(SVG+'title').text)


if __name__ == '__main__':
    unittest.main()
