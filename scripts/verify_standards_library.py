import os
import sys
import json
import hashlib
from pathlib import Path

WORKSPACE_ROOT = Path(r"c:\Users\danie\repo\xray-by-looplet")
STANDARDS_DIR = WORKSPACE_ROOT / "downloads" / "standards"

def check_pdf_header(filepath):
    try:
        with open(filepath, "rb") as f:
            header = f.read(8)
            return header.startswith(b"%PDF-") or filepath.suffix.lower() == ".zip"
    except Exception:
        return False

def main():
    print(f"Auditing standards repository at: {STANDARDS_DIR}")
    print("File checks only: not publisher, edition, currency or applicability verification.")

    categories = [
        "ncc_2022_current",
        "ncc_2025_preview",
        "abcb_handbooks_and_guides",
        "housing_standards_and_tolerances",
        "engineering_and_structural_guides",
        "drafting_and_architecture_standards",
        "ncc_2019_amendment1",
        "ncc_historical_archive"
    ]

    total_files = 0
    total_bytes = 0
    cat_summary = {}

    for cat in categories:
        cat_dir = STANDARDS_DIR / cat
        if not cat_dir.exists():
            cat_summary[cat] = {"count": 0, "bytes": 0, "status": "missing"}
            continue

        files = list(cat_dir.glob("*.*"))
        valid_files = 0
        cat_bytes = 0

        for f in files:
            size = f.stat().st_size
            if size > 1000:
                is_valid = True
                if f.suffix.lower() == ".pdf":
                    is_valid = check_pdf_header(f)
                if is_valid:
                    valid_files += 1
                    cat_bytes += size

        total_files += valid_files
        total_bytes += cat_bytes
        cat_summary[cat] = {
            "count": valid_files,
            "total_files": len(files),
            "bytes": cat_bytes,
            "mb": round(cat_bytes / (1024*1024), 2),
            "status": "file_header_checked",
            "currency": "not_verified",
            "applicability": "not_assessed"
        }

    print("\n--- STANDARDS AUDIT REPORT ---")
    for cat, info in cat_summary.items():
        print(f"[{info['status'].upper()}] {cat:<36}: {info['count']} valid files ({info.get('mb', 0)} MB)")

    print(f"\nTOTAL FILES PASSING BASIC FILE CHECKS: {total_files}")
    print(f"TOTAL REPOSITORY VOLUME: {total_bytes / (1024*1024):.2f} MB ({total_bytes / (1024*1024*1024):.2f} GB)")

    audit_path = STANDARDS_DIR / "AUDIT_SUMMARY.json"
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump({
            "total_documents": total_files,
            "total_bytes": total_bytes,
            "total_gb": round(total_bytes / (1024*1024*1024), 3),
            "categories": cat_summary
        }, f, indent=2)

    print(f"Saved audit summary to: {audit_path}")

if __name__ == "__main__":
    main()
