"""One-off private import using bounded, expiring signed URLs; never stores service keys."""
import concurrent.futures
import hashlib
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / 'downloads' / 'standards'
ENDPOINT = 'https://aulmqnykpfqnmvjpfyaz.supabase.co/functions/v1/xray-standards-import-20260913'
TOKEN = (ROOT / '.temp/ncc-upload/token').read_text().strip()
PROOF = ROOT / 'proof/growth/2026-09-13-ncc-library'

def sign(action, path=''):
    request = urllib.request.Request(ENDPOINT, json.dumps(dict(action=action,path=path)).encode(),
        {'Content-Type':'application/json','x-import-token':TOKEN}, method='POST')
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)

def transfer(entry):
    path = LIBRARY / entry['local_path']
    content_type = 'application/octet-stream' if 'offset' in entry else {'.pdf':'application/pdf','.zip':'application/zip','.md':'text/markdown','.json':'application/json'}[path.suffix]
    for attempt in range(3):
        try:
            # Existing files are verified, never overwritten.
            try:
                result = sign('upload', entry['object_path'])
                with path.open('rb') as stream:
                    stream.seek(entry.get('offset',0))
                    payload = stream.read(entry['size_bytes'])
                request = urllib.request.Request(result['signedUrl'], payload,
                    {'Content-Type':content_type,'x-upsert':'false'}, method='PUT')
                with urllib.request.urlopen(request, timeout=240) as response:
                    response.read()
            except urllib.error.HTTPError as error:
                message = error.read().decode(errors='replace')
                if 'already exists' not in message.lower() and 'duplicate' not in message.lower():
                    raise RuntimeError(f'Upload HTTP {error.code}: {message[:160]}') from None
            result = sign('verify', entry['object_path'])
            digest = hashlib.sha256()
            size = 0
            with urllib.request.urlopen(result['signedUrl'], timeout=240) as response:
                while chunk := response.read(1024*1024):
                    digest.update(chunk)
                    size += len(chunk)
            if digest.hexdigest() != entry['sha256'] or size != entry['size_bytes']:
                raise ValueError('Cloud readback does not match the local original')
            return dict(object_path=entry['object_path'],sha256=digest.hexdigest(),bytes=size,verified=True)
        except Exception as error:
            if attempt == 2:
                # Exception URLs may contain signed tokens: omit them from logs.
                return dict(object_path=entry['object_path'],verified=False,error=type(error).__name__)
            time.sleep(2 * (attempt+1))

def main():
    PROOF.mkdir(parents=True,exist_ok=True)
    if not sign('init').get('ready'):
        raise RuntimeError('Private storage is unavailable')
    documents = json.loads((LIBRARY/'CATALOG.json').read_text())['documents']
    entries = []
    for document in documents:
        if 'storage_parts' in document:
            entries.extend(dict(part,local_path=document['local_path']) for part in document['storage_parts'])
        else:
            entries.append(document)
    for name in ('CATALOG.json','LIBRARY.md'):
        content = (LIBRARY/name).read_bytes()
        entries.append(dict(local_path=name,object_path='catalog/'+name,sha256=hashlib.sha256(content).hexdigest(),size_bytes=len(content)))
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        for future in concurrent.futures.as_completed([executor.submit(transfer,e) for e in entries]):
            result = future.result()
            results.append(result)
            (PROOF/'cloud-readback.json').write_text(json.dumps(dict(project='aulmqnykpfqnmvjpfyaz',bucket='xray-standards',public=False,results=results),indent=2))
            print(f"{len(results)}/{len(entries)} {'verified' if result['verified'] else 'FAILED'} {result['object_path']}",flush=True)
    if not all(r['verified'] for r in results):
        raise SystemExit(1)

if __name__ == '__main__':
    main()
