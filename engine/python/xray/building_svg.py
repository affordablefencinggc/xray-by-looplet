"""Native vector X-ray wireframes from source-bound building meshes.

This is a projection of curated geometry, not automatic PDF interpretation.
Concealed edges remain visible. Coplanar triangulation diagonals are removed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from xray.source_building import BuildingError

NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
MAX_BYTES = 32 * 1024 * 1024
OMITTED_LABELS = {'Clapboard reveal', 'Shutter louver', 'Rear gable clapboard reveal', 'Roof edge flashing'}
VIEWS = ('axonometric', 'ground', 'upper')
POLICY = 'X-ray: concealed architectural edges remain visible; no hidden-line occlusion. Coplanar triangulation diagonals, room overlays and repetitive clapboard/louver/flashing detail are omitted.'


def read_bounded(path):
    with Path(path).open('rb') as stream:
        data = stream.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise BuildingError('Input exceeds 32 MiB limit')
    return data


def load_bound_scene(scene_path, source_path):
    raw = read_bounded(scene_path)
    scene = json.loads(raw)
    if scene.get('schema') != 'xray.source-building/v1' or scene.get('units') != 'm':
        raise BuildingError('Expected source-building v1 geometry in metres')
    if hashlib.sha256(read_bounded(source_path)).hexdigest() != scene['source']['sha256']:
        raise BuildingError('Source PDF SHA-256 does not match geometry')
    return scene, hashlib.sha256(raw).hexdigest()


def architectural_edges(part):
    """Weld coincident vertices and keep boundaries or noncoplanar creases."""
    raw, indices = part['positions'], part['indices']
    if not raw or len(raw) % 3 or not all(math.isfinite(v) for v in raw):
        raise BuildingError('Invalid mesh positions')
    points = [tuple(round(v, 6) for v in raw[i:i + 3]) for i in range(0, len(raw), 3)]
    if not indices or len(indices) % 3 or any(type(i) is not int or not 0 <= i < len(points) for i in indices):
        raise BuildingError('Invalid mesh triangle indices')
    adjacency = {}
    for i in range(0, len(indices), 3):
        a, b, c = (points[j] for j in indices[i:i + 3])
        u, v = [b[j] - a[j] for j in range(3)], [c[j] - a[j] for j in range(3)]
        n = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        length = math.sqrt(sum(x*x for x in n))
        if length < 1e-12:
            raise BuildingError('Degenerate mesh triangle')
        n = tuple(x / length for x in n)
        for p, q in ((a, b), (b, c), (c, a)):
            adjacency.setdefault(tuple(sorted((p, q))), []).append(n)
    threshold = math.cos(math.radians(1))
    return sorted(edge for edge, normals in adjacency.items() if len(normals) == 1 or
                  any(abs(sum(a*b for a, b in zip(normals[0], n))) < threshold for n in normals[1:]))


def included(part, view):
    return (part['category'] != 'room' and part['label'] not in OMITTED_LABELS and
            (view == 'axonometric' or part['level'] == view))


def project(point, matrix):
    return tuple(sum(a*b for a, b in zip(row, point)) for row in matrix)


def make_svg(scene, scene_sha, view):
    if view not in VIEWS:
        raise BuildingError('Unknown vector projection')
    matrix = [[1/math.sqrt(2), 0, -1/math.sqrt(2)], [1/math.sqrt(6), -2/math.sqrt(6), 1/math.sqrt(6)]] if view == 'axonometric' else [[1, 0, 0], [0, 0, 1]]
    groups, all_points, seen_ids = [], [], set()
    for part in sorted(scene['objects'], key=lambda p: p['id']):
        if part['id'] in seen_ids:
            raise BuildingError('Duplicate part ID')
        seen_ids.add(part['id'])
        if not included(part, view):
            continue
        edges = set()
        for a, b in architectural_edges(part):
            p, q = (tuple(round(v, 6) for v in project(pt, matrix)) for pt in (a, b))
            if math.dist(p, q) > 1e-6:
                edges.add(tuple(sorted((p, q))))
        if edges:
            edges = sorted(edges)
            groups.append((part, edges))
            all_points.extend(p for edge in edges for p in edge)
    if not all_points:
        raise BuildingError('Projection has no geometry')
    low = [min(p[i] for p in all_points) for i in range(2)]
    high = [max(p[i] for p in all_points) for i in range(2)]
    scale, margin, top = 100, 42, 104
    width = max(850, (high[0]-low[0])*scale+2*margin)
    height = (high[1]-low[1])*scale+top+90
    offset = [(width-(high[0]-low[0])*scale)/2-low[0]*scale, top-low[1]*scale]
    def node(parent, name, attrs=None, text=None):
        item = ET.SubElement(parent, '{'+NS+'}'+name, attrs or {})
        item.text = text
        return item
    root = ET.Element('{'+NS+'}svg', {'viewBox': f'0 0 {width:.4f} {height:.4f}', 'width': f'{width:.4f}', 'height': f'{height:.4f}', 'role': 'img', 'aria-labelledby': 'drawing-title drawing-description'})
    source = scene['source']
    source_title = source.get('title') or source['name']
    title = source_title + ' — ' + ('axonometric wireframe' if view == 'axonometric' else view + ' floor wireframe')
    node(root, 'title', {'id': 'drawing-title'}, title)
    node(root, 'desc', {'id': 'drawing-description'}, POLICY)
    metadata = {'schema': 'xray.building-wireframe/v1', 'source': scene['source'], 'sceneSha256': scene_sha, 'units': 'm', 'view': view, 'projectionMatrix': matrix, 'svgUnitsPerMetre': scale, 'translation': offset, 'projectedBoundsMetres': {'min': low, 'max': high}, 'hiddenEdgePolicy': POLICY, 'omittedLabels': sorted(OMITTED_LABELS), 'parts': len(groups), 'segments': sum(len(e) for _, e in groups)}
    node(root, 'metadata', {'id': 'source-provenance'}, json.dumps(metadata, sort_keys=True))
    node(root, 'rect', {'id': 'drawing-background', 'width': '100%', 'height': '100%', 'fill': '#ffffff'})
    text_attrs = {'x': str(margin), 'font-family': 'Arial, sans-serif', 'fill': '#20352f', 'data-palette-role': 'text'}
    node(root, 'text', {**text_attrs, 'y': '34', 'font-size': '21', 'font-weight': '600'}, title)
    node(root, 'text', {**text_attrs, 'y': '57', 'font-size': '12'}, 'Actual source geometry · X-ray edges include concealed parts · Curated approximate reconstruction')
    node(root, 'text', {**text_attrs, 'y': '76', 'font-size': '11'}, 'Vector units: 100 SVG units per metre in the declared orthographic projection.')
    drawing = node(root, 'g', {'id': 'building-edges', 'fill': 'none', 'stroke': '#294b40', 'stroke-width': '.8', 'stroke-linejoin': 'round', 'stroke-linecap': 'round'})
    for part, edges in groups:
        group = node(drawing, 'g', {'id': 'part-'+hashlib.sha256(part['id'].encode()).hexdigest()[:20], 'data-part-id': part['id'], 'data-category': part['category'], 'data-level': part['level']})
        node(group, 'title', text=part['label'])
        node(group, 'metadata', text=json.dumps({'sourceRefs': part['sourceRefs'], 'evidenceState': part['evidenceState']}, sort_keys=True))
        commands = []
        for a, b in edges:
            commands.append(f'M{a[0]*scale+offset[0]:.4f},{a[1]*scale+offset[1]:.4f}L{b[0]*scale+offset[0]:.4f},{b[1]*scale+offset[1]:.4f}')
        node(group, 'path', {'d': ' '.join(commands), 'vector-effect': 'non-scaling-stroke'})
    pages = sorted({ref['page'] for part, _ in groups for ref in part['sourceRefs']})
    attribution = source.get('author') or 'Source author not specified'
    license_label = ('Adaptation '+source['license']) if source.get('license') else 'Source license not specified'
    footer = attribution+' · '+license_label+' · Referenced pages: '+', '.join(map(str, pages))
    node(root, 'text', {**text_attrs, 'y': f'{height-53:.4f}', 'font-size': '11'}, footer)
    node(root, 'text', {**text_attrs, 'y': f'{height-35:.4f}', 'font-size': '9'}, 'PDF SHA-256: '+scene['source']['sha256'])
    node(root, 'text', {**text_attrs, 'y': f'{height-19:.4f}', 'font-size': '9'}, 'Scene SHA-256: '+scene_sha)
    return ET.tostring(root, encoding='utf-8', xml_declaration=True), metadata


def export(scene_path, source_path, out):
    scene, scene_sha = load_bound_scene(scene_path, source_path)
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    for view in VIEWS:
        data, metadata = make_svg(scene, scene_sha, view)
        name = 'wireframe-'+view+'.svg'
        (out/name).write_bytes(data)
        results.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'parts': metadata['parts'], 'segments': metadata['segments']})
    manifest = {'schema': 'xray.building-wireframe-manifest/v1', 'sourceSha256': scene['source']['sha256'], 'sceneSha256': scene_sha, 'hiddenEdgePolicy': POLICY, 'outputs': results}
    (out/'wireframe-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('scene', type=Path)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(export(args.scene, args.source, args.out), indent=2))


if __name__ == '__main__':
    main()
