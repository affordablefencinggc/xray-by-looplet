"""Catalogue downloaded originals without treating summaries as published standards."""
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / 'downloads' / 'standards'

def catalogue():
    entries = []
    for path in sorted(LIBRARY.glob('*/*')):
        if not path.is_file() or path.suffix.lower() not in ('.pdf', '.zip', '.md'):
            continue
        with path.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        kind = {'.pdf': 'source_pdf', '.zip': 'source_archive', '.md': 'unverified_summary'}[path.suffix.lower()]
        if path.suffix == '.pdf':
            with path.open('rb') as stream:
                if not stream.read(8).startswith(b'%PDF-'):
                    raise ValueError(f'Invalid PDF header: {path.name}')
        if path.suffix == '.zip':
            with zipfile.ZipFile(path) as archive:
                if archive.testzip() is not None:
                    raise ValueError(f'Corrupt archive: {path.name}')
        category = path.parent.name.replace('_current', '').replace('_preview', '')
        years = re.findall(r'(?:19|20)\d{2}', path.name)
        entries.append(dict(id=digest, title=path.stem.replace('_', ' '), filename=path.name,
            category=category, edition=years[0] if years else None, kind=kind,
            applicability='Not assessed; confirm edition, jurisdiction and project date',
            authority='Unverified summary, not the published standard' if kind == 'unverified_summary' else 'Downloaded source; bibliographic verification pending',
            sha256=digest, size_bytes=path.stat().st_size,
            local_path=path.relative_to(LIBRARY).as_posix(),
            object_path=f'originals/{category}/{digest[:16]}/{path.name}'))
    for entry in entries:
        if entry['size_bytes'] > 50*1024*1024:
            parts = []
            with (LIBRARY/entry['local_path']).open('rb') as stream:
                offset = 0
                while data := stream.read(40*1024*1024):
                    parts.append(dict(object_path=entry['object_path']+f'.part{len(parts)+1:04}',
                        offset=offset,size_bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
                    offset += len(data)
            entry['storage_parts'] = parts
    result = dict(schema_version=1, bucket='xray-standards', documents=entries)
    (LIBRARY / 'CATALOG.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    lines = ['# X-Ray construction reference library', '',
        'Original downloads are retained unchanged. This catalogue does not establish which code applies to a project.',
        'Markdown reference summaries are not licensed copies of Australian Standards and must not be cited as such.', '',
        '| Document | Category | Type |', '| --- | --- | --- |']
    for e in entries:
        lines.append(f"| [{e['title']}](./{e['local_path']}) | {e['category']} | {e['kind']} |")
    (LIBRARY / 'LIBRARY.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps(dict(documents=len(entries), bytes=sum(e['size_bytes'] for e in entries), summaries=sum(e['kind']=='unverified_summary' for e in entries))))

if __name__ == '__main__':
    catalogue()
