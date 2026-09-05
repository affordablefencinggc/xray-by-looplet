import ctypes
import json
from collections import Counter
from pathlib import Path
import pypdfium2 as pdfium
from pypdfium2 import raw

root = Path(__file__).resolve().parents[3]
rows = []
for source in (root / 'engine/fixtures').glob('*.pdf'):
    pages = []
    with pdfium.PdfDocument(source) as document:
        for number in range(len(document)):
            page = document[number]
            types = Counter(); segment_types = Counter(); paths = segments = clipped = 0; levels = Counter()
            for obj in page.get_objects(max_depth=12):
                types[obj.type] += 1; levels[obj.level] += 1
                if obj.type != raw.FPDF_PAGEOBJ_PATH: continue
                paths += 1; count = raw.FPDFPath_CountSegments(obj); segments += count
                clip = raw.FPDFPageObj_GetClipPath(obj)
                if clip and raw.FPDFClipPath_CountPaths(clip) > 0: clipped += 1
                for n in range(count):
                    segment_types[raw.FPDFPathSegment_GetType(raw.FPDFPath_GetPathSegment(obj, n))] += 1
            pages.append({'page': number + 1, 'size': page.get_size(), 'rotation': page.get_rotation(), 'crop': page.get_cropbox(), 'objects': dict(types), 'levels': dict(levels), 'paths': paths, 'segments': segments, 'clippedPaths': clipped, 'segmentTypes': dict(segment_types)})
            page.close()
    rows.append({'source': source.name, 'pages': pages})
out = root / 'proof/audit/IW-PY-WIREFRAME/path-inventory-attempt-02.json'
out.write_text(json.dumps({'pypdfium2': str(pdfium.PYPDFIUM_INFO), 'sources': rows}, indent=2), encoding='utf-8')
for row in rows:
    print(row['source'], 'pages', len(row['pages']), 'paths', sum(p['paths'] for p in row['pages']), 'segments', sum(p['segments'] for p in row['pages']), 'clipped', sum(p['clippedPaths'] for p in row['pages']))
