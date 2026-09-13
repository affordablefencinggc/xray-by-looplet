import os
import sys
import time
import json
import hashlib
import urllib.request
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

WORKSPACE_ROOT = Path(r"c:\Users\danie\repo\xray-by-looplet")
HISTORICAL_DIR = WORKSPACE_ROOT / "downloads" / "standards" / "ncc_historical_archive"
HISTORICAL_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

def get_historical_links():
    url = 'https://ncc.abcb.gov.au/editions'
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='ignore')

    matches = re.findall(r'<a\s+[^>]*href=[\'"]([^\'"]+)[\'"][^>]*>(.*?)</a>', html, re.I | re.S)
    items = []
    seen = set()
    for href, text in matches:
        if not any(href.lower().endswith(ext) for ext in ['.pdf', '.zip']):
            continue
        full_url = href if href.startswith('http') else 'https://ncc.abcb.gov.au' + href
        clean_text = " ".join(re.sub(r'<[^>]+>', '', text).split())
        fname = full_url.split('/')[-1]

        # Filter for historical (pre-2019)
        # Note: 2022, 2025, 2019 are already in the main library
        if any(x in fname for x in ['2022', '2025', '2019', 'Livable', 'fire-safety', 'nathers', 'whole-of-home']):
            continue
        if full_url in seen:
            continue
        seen.add(full_url)
        items.append({
            "filename": fname,
            "url": full_url,
            "title": clean_text or fname,
        })
    return items

def download_item(item):
    fname = item["filename"].replace("%20", "_")
    target = HISTORICAL_DIR / fname
    if target.exists() and target.stat().st_size > 5000:
        return {"filename": fname, "status": "cached", "size": target.stat().st_size, "url": item["url"]}

    retries = 2
    for _ in range(retries):
        try:
            req = urllib.request.Request(item["url"], headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read()
                if len(data) > 1000:
                    with open(target, "wb") as f:
                        f.write(data)
                    return {"filename": fname, "status": "downloaded", "size": len(data), "url": item["url"]}
        except Exception:
            pass
    return {"filename": fname, "status": "failed", "size": 0, "url": item["url"]}

def main():
    items = get_historical_links()
    print(f"Found {len(items)} historical NCC/BCA archive documents (1988-2016).")
    results = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(download_item, it): it for it in items}
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)
            print(f"[{res['status'].upper()}] {res['filename']} ({res['size']/(1024*1024):.2f} MB)", flush=True)

    manifest_file = HISTORICAL_DIR / "HISTORICAL_MANIFEST.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"Historical download finished: {len(results)} items saved to {HISTORICAL_DIR}")

if __name__ == "__main__":
    main()
