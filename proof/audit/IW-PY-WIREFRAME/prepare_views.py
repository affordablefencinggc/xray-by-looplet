import hashlib
import json
from pathlib import Path
import sys
import pypdfium2 as pdfium
from xray.source_wireframe import main
from xray.test_source_wireframe import source_fixture
from xray.wireframe import build_scene, render_html

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT/'proof/audit/IW-PY-WIREFRAME'
rows = []
for key, name in [('residential','residential-ruffles-seeka'),('shed','shed-manners-aline')]:
    source = ROOT/f'engine/fixtures/{name}.pdf'; target = OUT/f'{key}-final'
    exit_code = main([str(source), '--out', str(target)])
    if exit_code: raise RuntimeError('Extraction failed')
    data = json.loads((target/'scene.json').read_text())
    selected = max(data['pages'], key=lambda p:p['pathCount'])
    with pdfium.PdfDocument(source) as doc:
        page = doc[selected['page']-1]
        image = page.render(scale=min(2,1600/page.get_width())).to_pil()
        image.save(OUT/f'{key}-source.png')
    before = f'<!doctype html><html><head><meta charset="utf-8"><title>Actual source PDF · {key}</title><style>body{{margin:0;padding:20px;background:#f5f1e8;color:#292b2c;font:16px Segoe UI}}h1{{margin:0 0 8px;font-size:25px}}p{{margin:8px 0}}img{{display:block;max-width:100%;max-height:calc(100vh - 150px);margin:auto;object-fit:contain}}</style></head><body><h1>Actual source PDF · {name}</h1><p>Page {selected["page"]} of {len(data["pages"])} · existing project plan · PDFium render, before path extraction view</p><p>SHA-256 {data["source"]["sha256"]}</p><img src="{key}-source.png" alt="Original PDF page rendered from source bytes"></body></html>'
    (OUT/f'{key}-source.html').write_text(before,encoding='utf-8')
    rows.append({'key':key,'source':source.relative_to(ROOT).as_posix(),'selectedPage':selected['page'],'pathCount':selected['pathCount'],'omissions':selected['omissions'],'sourceSha256':data['source']['sha256']})
source_fixture(OUT/'synthetic-transform.pdf')
main([str(OUT/'synthetic-transform.pdf'),'--out',str(OUT/'transform-final')])
with pdfium.PdfDocument(OUT/'synthetic-transform.pdf') as document:
    document[0].render(scale=2).to_pil().save(OUT/'synthetic-transform-source.png')
hostile={'symbols':[{'id':'a','blockName':'</script><script>globalThis.injected=1</script>','x':0,'y':0},{'id':'b','blockName':'__proto__','x':5,'y':5}]}
(OUT/'hostile-viewer.html').write_text(render_html(build_scene(hostile)),encoding='utf-8')
(OUT/'view-sources.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps(rows,indent=2))
