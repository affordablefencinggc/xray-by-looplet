"""Bounded PDF path outlines in page points; presentation only, never quantities.

This additive API does not modify engine.run() or its takeoff schema. Text,
images, shadings and explicitly clipped objects are counted as omissions.
Curves remain cubic curves, not guessed wall or component geometry.
"""
from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import math
from pathlib import Path
import sys
from xml.sax.saxutils import escape

MAX_BYTES = 30 * 1024 * 1024
MAX_PAGES = 100
MAX_OBJECTS = 250_000
MAX_PATHS = 200_000
MAX_SEGMENTS = 600_000
MAX_DEPTH = 16
MAX_OUTPUT_BYTES = 80 * 1024 * 1024
IDENTITY = (1., 0., 0., 1., 0., 0.)


class WireframeError(ValueError):
    """Unsupported, malformed or bounded-out source, with no success artifact."""


def _finite(value):
    if not math.isfinite(value) or abs(value) > 1e8:
        raise WireframeError('Unsupported coordinate range.')
    return float(value)


def compose(outer, inner):
    a, b, c, d, e, f = outer
    g, h, i, j, k, l = inner
    return tuple(_finite(v) for v in (a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j, a*k+c*l+e, b*k+d*l+f))


def transform(matrix, x, y):
    a, b, c, d, e, f = matrix
    return [_finite(a*x+c*y+e), _finite(b*x+d*y+f)]


def page_matrix(crop, rotation):
    l, b, r, t = crop
    w, h = r-l, t-b
    if w <= 0 or h <= 0 or rotation not in (0, 90, 180, 270):
        raise WireframeError('Unsupported page box or rotation.')
    return {
        0: ((1, 0, 0, -1, -l, t), w, h),
        90: ((0, 1, 1, 0, -b, -l), h, w),
        180: ((-1, 0, 0, 1, r, -b), w, h),
        270: ((0, -1, -1, 0, t, r), h, w),
    }[rotation]


def extract_pdf(path, pages=None):
    import pypdfium2 as pdfium
    from pypdfium2 import raw
    source = Path(path)
    if not source.is_file() or source.suffix.lower() != '.pdf' or not 0 < source.stat().st_size <= MAX_BYTES:
        raise WireframeError('Missing, unsupported or oversized PDF input.')
    with source.open('rb') as handle:
        content = handle.read(MAX_BYTES + 1)
    if not 0 < len(content) <= MAX_BYTES:
        raise WireframeError('Captured input exceeds byte limit.')
    if not content.startswith(b'%PDF-'):
        raise WireframeError('Invalid PDF signature.')
    digest = hashlib.sha256(content).hexdigest()
    totals = {'objects': 0, 'paths': 0, 'segments': 0}
    result_pages = []
    with pdfium.PdfDocument(content) as doc:
        if not 0 < len(doc) <= MAX_PAGES:
            raise WireframeError('Page limit exceeded.')
        selection = list(range(1, len(doc)+1)) if pages is None else list(pages)
        if (not selection or len(set(selection)) != len(selection)
                or any(type(p) is not int or not 1 <= p <= len(doc) for p in selection)):
            raise WireframeError('Invalid or duplicate selected page.')
        for page_number in sorted(selection):
            page = doc[page_number-1]
            try:
                # PDFium's effective box intersects inherited CropBox/MediaBox.
                # A raw CropBox may extend beyond the rendered page.
                crop = [_finite(v) for v in page.get_bbox()]
                rotation = page.get_rotation()
                view, width, height = page_matrix(crop, rotation)
                records = []
                omissions = {'text': 0, 'image': 0, 'shading': 0, 'clippedObjects': 0, 'nonPaintingPaths': 0, 'unknown': 0}
                page_counts = {'objects': 0, 'paths': 0, 'segments': 0}

                def walk(parent, parent_matrix, ancestry=(), depth=0):
                    if depth > MAX_DEPTH:
                        raise WireframeError('Form nesting limit exceeded.')
                    count = raw.FPDFPage_CountObjects(parent) if not ancestry else raw.FPDFFormObj_CountObjects(parent)
                    if count < 0 or totals['objects'] + count > MAX_OBJECTS:
                        raise WireframeError('Object count failed or exceeded limit.')
                    for index in range(count):
                        obj_raw = raw.FPDFPage_GetObject(parent, index) if not ancestry else raw.FPDFFormObj_GetObject(parent, index)
                        if not obj_raw:
                            raise WireframeError('Missing PDF object.')
                        obj = pdfium.PdfObject(obj_raw, page=page)
                        totals['objects'] += 1; page_counts['objects'] += 1
                        if totals['objects'] > MAX_OBJECTS:
                            raise WireframeError('Nested object limit exceeded.')
                        identity = ancestry + (index,)
                        clip = raw.FPDFPageObj_GetClipPath(obj)
                        clip_count = raw.FPDFClipPath_CountPaths(clip) if clip else -1
                        if clip_count > 0:
                            omissions['clippedObjects'] += 1
                            continue
                        matrix = compose(parent_matrix, obj.get_matrix().get())
                        if obj.type == raw.FPDF_PAGEOBJ_FORM:
                            walk(obj, matrix, identity, depth+1)
                            continue
                        if obj.type != raw.FPDF_PAGEOBJ_PATH:
                            key = {raw.FPDF_PAGEOBJ_TEXT: 'text', raw.FPDF_PAGEOBJ_IMAGE: 'image', raw.FPDF_PAGEOBJ_SHADING: 'shading'}.get(obj.type, 'unknown')
                            omissions[key] += 1
                            continue
                        count_segments = raw.FPDFPath_CountSegments(obj)
                        if count_segments < 0:
                            raise WireframeError('Invalid path segment count.')
                        totals['paths'] += 1; totals['segments'] += count_segments
                        page_counts['paths'] += 1; page_counts['segments'] += count_segments
                        if totals['paths'] > MAX_PATHS or totals['segments'] > MAX_SEGMENTS:
                            raise WireframeError('Path or segment limit exceeded.')
                        fill = ctypes.c_int(); stroke = ctypes.c_int()
                        if not raw.FPDFPath_GetDrawMode(obj, fill, stroke):
                            raise WireframeError('Path paint mode unavailable.')
                        if not fill.value and not stroke.value:
                            omissions['nonPaintingPaths'] += 1
                            continue
                        commands = []; pending = []; has_move = False
                        display = compose(view, matrix)
                        for n in range(count_segments):
                            segment = raw.FPDFPath_GetPathSegment(obj, n)
                            x = ctypes.c_float(); y = ctypes.c_float()
                            if not segment or not raw.FPDFPathSegment_GetPoint(segment, x, y):
                                raise WireframeError('Invalid path point.')
                            point = transform(display, x.value, y.value)
                            kind = raw.FPDFPathSegment_GetType(segment)
                            if kind == raw.FPDF_SEGMENT_MOVETO:
                                if pending: raise WireframeError('Incomplete cubic path.')
                                commands.append(['M', *point]); has_move = True
                            elif kind == raw.FPDF_SEGMENT_LINETO and has_move and not pending:
                                commands.append(['L', *point])
                            elif kind == raw.FPDF_SEGMENT_BEZIERTO and has_move:
                                pending.extend(point)
                                if len(pending) == 6:
                                    commands.append(['C', *pending]); pending = []
                            else:
                                raise WireframeError('Unsupported path command ordering.')
                            if raw.FPDFPathSegment_GetClose(segment):
                                if pending: raise WireframeError('Incomplete closed cubic path.')
                                commands.append(['Z'])
                        if pending: raise WireframeError('Truncated cubic path.')
                        if commands:
                            records.append({'id': f'p{page_number}/' + '/'.join(map(str, identity)), 'objectIndices': list(identity), 'segmentCount': count_segments, 'commands': commands})
                walk(page, IDENTITY)
                result_pages.append({'page': page_number, 'widthPt': width, 'heightPt': height, 'cropBox': crop, 'rotation': rotation, 'coordinateSystem': 'display-page-top-left-points',
                    'status': 'partial' if records else 'unsupported', 'pathCount': len(records), 'counts': page_counts, 'omissions': omissions, 'paths': records})
            finally:
                page.close()
        source_pages = len(doc)
    data = {'schema': 'xray.source-wireframe/v1', 'kind': 'pdf-path-outlines', 'authority': 'presentation-only-not-quantities-or-building-reconstruction',
        'source': {'name': source.name, 'sha256': digest, 'bytes': len(content), 'pageCount': source_pages},
        'runtime': {'pypdfium2': str(pdfium.PYPDFIUM_INFO), 'pdfium': str(pdfium.PDFIUM_INFO)},
        'status': 'partial' if any(p['paths'] for p in result_pages) else 'unsupported',
        'limits': {'inputBytes': MAX_BYTES, 'pages': MAX_PAGES, 'objects': MAX_OBJECTS, 'paths': MAX_PATHS, 'segments': MAX_SEGMENTS, 'depth': MAX_DEPTH, 'outputBytes': MAX_OUTPUT_BYTES},
        'counts': totals, 'pages': result_pages}
    if len(json.dumps(data, separators=(',', ':'), allow_nan=False).encode()) > MAX_OUTPUT_BYTES:
        raise WireframeError('Output byte limit exceeded.')
    return data


def render_svg(page):
    def number(value):
        return format(value, '.12g')
    paths = ''.join('<path d="' + ' '.join(c[0] + ' '.join(number(v) for v in c[1:]) for c in p['commands']) + '"/>' for p in page['paths'])
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {number(page["widthPt"])} {number(page["heightPt"])}"><title>Page {page["page"]} source path outlines, partial presentation only</title><g fill="none" stroke="#d9e5ee" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round">{paths}</g></svg>'


def render_viewer(data):
    manifest = {k: v for k, v in data.items() if k != 'pages'}
    manifest['pages'] = [{k: v for k, v in p.items() if k != 'paths'} for p in data['pages']]
    payload = json.dumps(manifest, separators=(',', ':'), allow_nan=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    title = escape(data['source']['name'])
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · source wireframe</title>
<style>:root{{--bg:#09131e;--ink:#d9e5ee;--muted:#a7bbc9;--line:#334a5b}}*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 'Segoe UI',sans-serif}}header{{padding:16px 24px;border-bottom:1px solid var(--line)}}h1{{font-size:24px;margin:0 0 8px}}p{{margin:6px 0}}.note{{color:var(--muted);font-size:13px}}nav{{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:12px}}button,select{{min-height:40px;background:var(--bg);color:var(--ink);border:1px solid var(--line);padding:6px 12px;font:inherit}}button{{cursor:pointer}}#viewport{{height:calc(100vh - 220px);min-height:300px;overflow:auto;padding:20px}}#drawing{{display:block;margin:auto;width:100%;height:100%;object-fit:contain;transform-origin:top left}}#empty{{padding:40px}}a{{color:var(--ink)}}</style></head><body><header><h1>{title}</h1><p>Actual PDF path outlines · PARTIAL · 2D presentation only</p><p class="note">Text, images, shading and clipped objects are omitted and counted. No walls, component counts, heights or quantities are inferred.</p><p id="facts" class="note"></p><nav><label>Page <select id="page"></select></label><button id="previous">Previous</button><button id="next">Next</button><button id="zoomIn">Zoom +</button><button id="zoomOut">Zoom −</button><button id="fit">Fit</button><a href="scene.json">Source-bound JSON</a></nav></header><div id="viewport"><img id="drawing" alt="Extracted PDF source path outlines"><p id="empty" hidden>No supported vector paths on this page.</p></div>
<script>const DATA={payload};const select=document.getElementById('page'),drawing=document.getElementById('drawing'),empty=document.getElementById('empty');let zoom=1;
for(const p of DATA.pages){{const o=document.createElement('option');o.value=p.page;o.textContent=p.page+' · '+p.pathCount+' paths';select.append(o)}}
function show(){{const p=DATA.pages.find(p=>p.page===Number(select.value));zoom=1;resize();drawing.hidden=!p.pathCount;empty.hidden=!!p.pathCount;if(p.pathCount)drawing.src='page-'+p.page+'.svg';else drawing.removeAttribute('src');document.getElementById('facts').textContent='Page '+p.page+' / '+DATA.source.pageCount+' · '+p.pathCount+' paths · '+p.counts.segments+' source segments · omissions '+JSON.stringify(p.omissions)+' · source '+DATA.source.sha256.slice(0,16)+'… · page points';}}
function resize(){{drawing.style.width=zoom*100+'%';drawing.style.height=zoom*100+'%'}}select.onchange=show;document.getElementById('previous').onclick=()=>{{select.selectedIndex=Math.max(0,select.selectedIndex-1);show()}};document.getElementById('next').onclick=()=>{{select.selectedIndex=Math.min(DATA.pages.length-1,select.selectedIndex+1);show()}};document.getElementById('zoomIn').onclick=()=>{{zoom=Math.min(4,zoom*1.25);resize()}};document.getElementById('zoomOut').onclick=()=>{{zoom=Math.max(.5,zoom/1.25);resize()}};document.getElementById('fit').onclick=()=>{{zoom=1;resize()}};select.value=DATA.pages.reduce((a,b)=>b.pathCount>a.pathCount?b:a).page;show();</script></body></html>'''


def main(argv=None):
    parser = argparse.ArgumentParser(description='Extract bounded PDF source path outlines; not building reconstruction.')
    parser.add_argument('pdf'); parser.add_argument('--out', required=True)
    parser.add_argument('--pages', help='Comma-separated one-based pages; default all pages')
    args = parser.parse_args(argv)
    try:
        selection = None if args.pages is None else [int(p) for p in args.pages.split(',')]
        data = extract_pdf(args.pdf, selection)
        if data['status'] == 'unsupported':
            raise WireframeError('No supported PDF vector paths; no wireframe generated.')
        content = json.dumps(data, separators=(',', ':'), allow_nan=False)
        artifacts = {'scene.json': content, 'index.html': render_viewer(data)}
        for page in data['pages']:
            if page['paths']: artifacts[f'page-{page["page"]}.svg'] = render_svg(page)
        if sum(len(v.encode()) for v in artifacts.values()) > MAX_OUTPUT_BYTES:
            raise WireframeError('Aggregate output byte limit exceeded.')
        out = Path(args.out)
        out.mkdir(parents=False, exist_ok=False)
        for name, text in artifacts.items():
            with (out / name).open('x', encoding='utf-8', newline='\n') as handle:
                handle.write(text)
        completion = {'status': 'partial', 'sourceSha256': data['source']['sha256'], 'artifacts': {name: hashlib.sha256(text.encode()).hexdigest() for name, text in artifacts.items()}}
        with (out / 'complete.json').open('x', encoding='utf-8', newline='\n') as handle:
            json.dump(completion, handle, separators=(',', ':'))
        print(json.dumps({'status': data['status'], 'sourceSha256': data['source']['sha256'], 'pages': len(data['pages']), 'paths': sum(p['pathCount'] for p in data['pages']), 'segments': data['counts']['segments']}))
        return 0
    except Exception as error:
        print('error: ' + (str(error) if isinstance(error, WireframeError) else 'Source extraction or exclusive output failed.'), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
