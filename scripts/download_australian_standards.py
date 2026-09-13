import os
import sys
import time
import json
import hashlib
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

WORKSPACE_ROOT = Path(r"c:\Users\danie\repo\xray-by-looplet")
STANDARDS_DIR = WORKSPACE_ROOT / "downloads" / "standards"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

# Master Catalog of Australian Standards, NCC, Handbooks, Guides
CATALOG = [
    # =========================================================================
    # NCC 2022 (Current Active National Construction Code)
    # =========================================================================
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Volume One (Class 2 to 9 Commercial & Multi-Residential)",
        "filename": "NCC_2022_Volume_One.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/ncc2022-volume-one.pdf",
        "edition": "NCC 2022",
        "description": "Primary building code for multi-residential, commercial, industrial, public and healthcare buildings."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Volume Two (Class 1 and 10 Residential Buildings)",
        "filename": "NCC_2022_Volume_Two.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/ncc2022-volume-two.pdf",
        "edition": "NCC 2022",
        "description": "Primary building code for detached houses, townhouses, garages, sheds, and swimming pools."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 ABCB Housing Provisions Standard",
        "filename": "NCC_2022_ABCB_Housing_Provisions_Standard.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/ncc2022-abcb-housing-provisions.pdf",
        "edition": "NCC 2022",
        "description": "Comprehensive Deemed-to-Satisfy (DTS) standard for residential houses: earthworks, footings, framing, masonry, roofing, waterproofing, and finishes."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Combined Volume Two and Housing Provisions",
        "filename": "NCC_2022_Combined_Volume_Two_and_Housing_Provisions.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/ncc2022-combined-vol2-housing-provisions.pdf",
        "edition": "NCC 2022",
        "description": "Combined reference containing both Volume Two performance requirements and the complete Housing Provisions."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Volume Three (Plumbing Code of Australia)",
        "filename": "NCC_2022_Volume_Three_Plumbing_Code.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/ncc2022-volume-three.pdf",
        "edition": "NCC 2022",
        "description": "Plumbing Code of Australia covering water services, sanitary plumbing, drainage, stormwater, and heating/cooling."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Consolidated Performance Requirements",
        "filename": "NCC_2022_Consolidated_Performance_Requirements.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/ncc2022-consolidated-performance-requirements.pdf",
        "edition": "NCC 2022",
        "description": "Consolidated set of all mandatory performance requirements across Volume One, Volume Two, and Volume Three."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Livable Housing Design Standard",
        "filename": "ABCB_Livable_Housing_Design_Standard_2022.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2023/Livable-Housing-Design-Standard-2022-1.3.pdf",
        "edition": "NCC 2022 (v1.3)",
        "description": "Mandatory standard for accessible housing features under NCC 2022."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Fire Safety Verification Method Standard",
        "filename": "ABCB_Fire_Safety_Verification_Method_Standard_2022.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2022/fire-safety-verification-method-standard-2022.pdf",
        "edition": "NCC 2022",
        "description": "Verification method for fire engineering performance solutions."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 NatHERS Heating and Cooling Load Limits Standard",
        "filename": "ABCB_NatHERS_Heating_Cooling_Load_Limits_2022.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2022/nathers-heating-cooling-load-limits-2022.pdf",
        "edition": "NCC 2022",
        "description": "Heating and cooling load limit standard for residential energy ratings."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Whole-of-Home Efficiency Factors Standard",
        "filename": "ABCB_Whole_of_Home_Efficiency_Factors_2022.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2022/whole-of-home-efficiency-factors-2022.pdf",
        "edition": "NCC 2022",
        "description": "Energy efficiency factors for fixed appliances, heating, cooling, hot water, and on-site solar."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Amendment 1",
        "filename": "NCC_2022_Amendment_1.pdf",
        "url": "https://ncc.abcb.gov.au/sites/default/files/resources/2025/NCC%202022%20Amdt%201%20v1.1.pdf",
        "edition": "NCC 2022 Amdt 1",
        "description": "Official amendments to NCC 2022 series (v1.1)."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Amendment 2",
        "filename": "NCC_2022_Amendment_2.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2025/NCC%202022%20Amdt%202_0.pdf",
        "edition": "NCC 2022 Amdt 2",
        "description": "Official second amendment set to NCC 2022."
    },
    {
        "category": "ncc_2022_current",
        "title": "NCC 2022 Register of Changes Since Publication",
        "filename": "NCC_2022_Register_of_Changes.pdf",
        "url": "https://abcb.gov.au/sites/default/files/resources/2023/Updated%20NCC%202022%20register%20of%20changes%20since%20publication.pdf",
        "edition": "NCC 2022",
        "description": "Detailed register of changes and errata since first publication of NCC 2022."
    },

    # =========================================================================
    # NCC 2025 (Next Generation Series)
    # =========================================================================
    {
        "category": "ncc_2025_preview",
        "title": "NCC 2025 Volume One",
        "filename": "NCC_2025_Volume_One.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/NCC-2025-Volume-One.pdf",
        "edition": "NCC 2025",
        "description": "Next generation Volume One for commercial and multi-residential structures."
    },
    {
        "category": "ncc_2025_preview",
        "title": "NCC 2025 Volume Two",
        "filename": "NCC_2025_Volume_Two.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/NCC-2025-Volume-Two.pdf",
        "edition": "NCC 2025",
        "description": "Next generation Volume Two for residential Class 1 and 10 buildings."
    },
    {
        "category": "ncc_2025_preview",
        "title": "NCC 2025 Volume Three (Plumbing Code)",
        "filename": "NCC_2025_Volume_Three_Plumbing.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/NCC-2025-Volume-Three.pdf",
        "edition": "NCC 2025",
        "description": "Next generation Volume Three Plumbing Code."
    },
    {
        "category": "ncc_2025_preview",
        "title": "NCC 2025 ABCB Housing Provisions Standard",
        "filename": "NCC_2025_ABCB_Housing_Provisions.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/NCC-2025-Housing-Provisions.pdf",
        "edition": "NCC 2025",
        "description": "Next generation deemed-to-satisfy housing provisions for residential construction."
    },

    # =========================================================================
    # ABCB Handbooks, Engineering & Verification Method Guides
    # =========================================================================
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Housing Energy Efficiency Handbook",
        "filename": "ABCB_Housing_Energy_Efficiency_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2024/Housing%20energy%20efficiency%20handbook.pdf",
        "edition": "2024 Edition",
        "description": "Technical guidance on thermal fabric, insulation, thermal bridging, and NCC 7-star compliance."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Livable Housing Design Handbook",
        "filename": "ABCB_Livable_Housing_Design_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2026/NCC%202025%20Livable%20Housing%20Design%20handbook_1.pdf",
        "edition": "2025/2026 Edition",
        "description": "Detailed design handbook for step-free entries, accessible doorways, corridor widths, and sanitary facilities."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Sound Transmission and Acoustic Insulation Handbook",
        "filename": "ABCB_Sound_Transmission_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2024/Sound-transmission-handbook-2022-final.pdf",
        "edition": "2024 Edition",
        "description": "Acoustic design guidance for party walls, floors, and services penetrations in residential buildings."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Condensation in Buildings Handbook",
        "filename": "ABCB_Condensation_in_Buildings_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2026/NCC%202025%20Condensation%20in%20building%20handbook.pdf",
        "edition": "2025/2026 Edition",
        "description": "Vapour permeable membranes, sub-floor ventilation, roof space exhaust, and interstitial condensation prevention."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Structural Reliability Verification Method Handbook",
        "filename": "ABCB_Structural_Reliability_Verification_Method_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2026/NCC%202025%20Structural%20reliability%20Verification%20Method%20handbook.pdf",
        "edition": "2025/2026 Edition",
        "description": "Engineering methods for verifying structural robustness and safety under limit states design."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Evidence of Suitability Handbook",
        "filename": "ABCB_Evidence_of_Suitability_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2024/NCC%202022%20%20Evidence%20of%20suitability%20handbook.pdf",
        "edition": "2024 Edition",
        "description": "Compliance pathways, test reports, CodeMark certification, and engineering certificates under NCC Part A5."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Performance Solution Process Handbook",
        "filename": "ABCB_Performance_Solution_Process_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2024/NCC%202022-%20Performance%20Solution%20Process%20handbook.pdf",
        "edition": "2024 Edition",
        "description": "Step-by-step methodology for developing, certifying, and approving performance solutions under NCC A2G2."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Prefabricated, Modular and Offsite Construction Handbook",
        "filename": "ABCB_Prefabricated_Modular_Offsite_Construction_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2024/Prefabricated%2C%20modular%20and%20offsite%20construction%20handbook%20NCC%202022%20Final.pdf",
        "edition": "2024 Edition",
        "description": "Design, manufacture, transportation, and certification requirements for volumetric modular and panelised construction."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Embodied Carbon in Buildings Handbook",
        "filename": "ABCB_Embodied_Carbon_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2026/Embodied-carbon-handbook.pdf",
        "edition": "2026 Edition",
        "description": "Measurement and lifecycle assessment of embodied carbon in construction materials and building assemblies."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Australian Fire Engineering Guidelines (AFEG)",
        "filename": "ABCB_Australian_Fire_Engineering_Guidelines.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2026/NCC%202025%20Australian%20fire%20engineering%20guidelines_0.pdf",
        "edition": "2025/2026 Edition",
        "description": "National fire engineering design framework for performance solutions in complex buildings."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "NCC Building Classifications Guide",
        "filename": "ABCB_NCC_Building_Classifications_Guide.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2026/NCC%20building%20classifications.pdf",
        "edition": "2026 Edition",
        "description": "Official guide and decision tree for classifying buildings from Class 1 through Class 10."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Commercial Energy Efficiency Handbook",
        "filename": "ABCB_Commercial_Energy_Efficiency_Handbook.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2026/NCC%202025%20Commercial%20energy%20efficiency%20handbook.pdf",
        "edition": "2025/2026 Edition",
        "description": "Section J compliance handbook for commercial envelopes, HVAC, lighting, and power monitoring."
    },
    {
        "category": "abcb_handbooks_and_guides",
        "title": "Waterproofing and Water Shedding Technical Review",
        "filename": "ABCB_Waterproofing_and_Water_Shedding.pdf",
        "url": "https://www.abcb.gov.au/sites/default/files/resources/2024/PCD-2025-Waterproofing-and-water-shedding.pdf",
        "edition": "2024 Edition",
        "description": "Detailed provisions on membrane falls, flashings, internal wet areas (AS 3740) and external balconies (AS 4654)."
    },

    # =========================================================================
    # Australian Housing Standards, Quality & Tolerances
    # =========================================================================
    {
        "category": "housing_standards_and_tolerances",
        "title": "Guide to Standards and Tolerances (NSW Fair Trading / VBA / QBCC / ACT / Tasmania)",
        "filename": "Guide_to_Standards_and_Tolerances.pdf",
        "url": "https://www.fairtrading.nsw.gov.au/__data/assets/pdf_file/0009/369945/Guide_to_Standards_and_Tolerances.pdf",
        "edition": "Official Multi-Jurisdictional Edition",
        "description": "Definitive Australian benchmark for building quality, acceptable tolerances, cracking thresholds, and defect classification for domestic building work."
    },

    # =========================================================================
    # NCC 2019 (Amendment 1 Series - Widely Cited for Existing Buildings)
    # =========================================================================
    {
        "category": "ncc_2019_amendment1",
        "title": "NCC 2019 Volume One Amendment 1",
        "filename": "NCC_2019_Volume_One_Amendment_1.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/NCC_2019_Volume_One_Amendment%201_1.pdf",
        "edition": "NCC 2019 Amdt 1",
        "description": "Volume One 2019 Amendment 1 for Class 2 to 9 buildings."
    },
    {
        "category": "ncc_2019_amendment1",
        "title": "NCC 2019 Volume Two Amendment 1",
        "filename": "NCC_2019_Volume_Two_Amendment_1.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/NCC_2019_Volume_Two_Amendment%201_0.pdf",
        "edition": "NCC 2019 Amdt 1",
        "description": "Volume Two 2019 Amendment 1 for Class 1 and 10 residential buildings (includes 3.0 Acceptable Construction Practice)."
    },
    {
        "category": "ncc_2019_amendment1",
        "title": "NCC 2019 Volume Three Amendment 1",
        "filename": "NCC_2019_Volume_Three_Amendment_1.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/NCC_2019_Volume_Three_Amendment%201_0.pdf",
        "edition": "NCC 2019 Amdt 1",
        "description": "Volume Three 2019 Amendment 1 Plumbing Code of Australia."
    },
    {
        "category": "ncc_2019_amendment1",
        "title": "NCC 2019 Guide to the BCA Amendment 1",
        "filename": "NCC_2019_Guide_to_the_BCA_Amendment_1.pdf",
        "url": "https://ncc.abcb.gov.au/system/files/ncc/NCC_2019_BCA_Guide_Amendment%201_0.pdf",
        "edition": "NCC 2019 Amdt 1",
        "description": "Comprehensive explanatory handbook and commentary on BCA provisions."
    },
]

def download_file(item):
    cat = item["category"]
    target_dir = STANDARDS_DIR / cat
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / item["filename"]

    # Check if already downloaded with non-zero size
    if target_file.exists() and target_file.stat().st_size > 10000:
        size = target_file.stat().st_size
        with open(target_file, "rb") as f:
            sha = hashlib.sha256(f.read()).hexdigest()
        print(f"[CACHED] {item['filename']} ({size / (1024*1024):.2f} MB)", flush=True)
        return {**item, "status": "cached", "size_bytes": size, "sha256": sha, "local_path": str(target_file)}

    print(f"[START] Downloading {item['filename']}...", flush=True)
    retries = 3
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(item["url"], headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                if len(data) < 1000:
                    raise ValueError(f"Downloaded content too small: {len(data)} bytes")
                with open(target_file, "wb") as f:
                    f.write(data)
                sha = hashlib.sha256(data).hexdigest()
                size = len(data)
                print(f"[SUCCESS] {item['filename']} ({size / (1024*1024):.2f} MB)", flush=True)
                return {**item, "status": "downloaded", "size_bytes": size, "sha256": sha, "local_path": str(target_file)}
        except Exception as e:
            print(f"[WARN] Attempt {attempt} failed for {item['filename']}: {e}", flush=True)
            time.sleep(2)

    print(f"[ERROR] Failed to download {item['filename']} after {retries} attempts.", flush=True)
    return {**item, "status": "failed", "size_bytes": 0, "sha256": None, "local_path": None}

def build_manifest_and_readme(results):
    manifest_path = STANDARDS_DIR / "MANIFEST.json"
    readme_path = STANDARDS_DIR / "README.md"

    # Save manifest
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    total_bytes = sum(r.get("size_bytes", 0) for r in results)
    total_mb = total_bytes / (1024 * 1024)
    success_count = sum(1 for r in results if r.get("status") in ["cached", "downloaded"])

    # Group by category
    cats = {}
    for r in results:
        cats.setdefault(r["category"], []).append(r)

    category_titles = {
        "ncc_2022_current": "National Construction Code 2022 (Current Australian Law)",
        "ncc_2025_preview": "National Construction Code 2025 (Next Generation)",
        "abcb_handbooks_and_guides": "ABCB Official Engineering, Architectural & Practice Handbooks",
        "housing_standards_and_tolerances": "Australian Housing Standards, Workmanship & Tolerances",
        "ncc_2019_amendment1": "NCC 2019 Amendment 1 (Historical Reference Series)"
    }

    lines = [
        "# Australian Standards, National Construction Code (NCC) & Building Guidelines Library",
        "",
        f"**Repository Location**: `downloads/standards/`  ",
        f"**Total Documents**: {len(results)}  ",
        f"**Successfully Acquired**: {success_count} / {len(results)}  ",
        f"**Total Download Volume**: {total_mb:.1f} MB  ",
        f"**Generated**: {time.strftime('%Y-%m-%d %H:%M:%S')}  ",
        "",
        "This repository contains the complete official Australian National Construction Code (NCC) series, ",
        "ABCB technical engineering handbooks, deemed-to-satisfy housing provisions, and Australian building ",
        "workmanship and tolerance standards. All documents are indexed and ready for automated clause citation, ",
        "takeoff verification, and architectural drafting reference.",
        "",
        "---",
        ""
    ]

    for cat_id, items in cats.items():
        title = category_titles.get(cat_id, cat_id)
        lines.append(f"## {title}")
        lines.append("")
        lines.append("| Document Title | Edition | Size | Checksum (SHA-256) | File Link |")
        lines.append("| :--- | :--- | :--- | :--- | :--- |")
        for it in items:
            size_str = f"{it.get('size_bytes', 0)/(1024*1024):.2f} MB" if it.get("size_bytes") else "N/A"
            sha_short = it.get("sha256", "")[:10] + "..." if it.get("sha256") else "N/A"
            fname = it["filename"]
            rel_link = f"[{fname}](./{cat_id}/{fname})"
            lines.append(f"| **{it['title']}**<br>_{it['description']}_ | {it['edition']} | {size_str} | `{sha_short}` | {rel_link} |")
        lines.append("")

    with open(readme_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nSaved MANIFEST.json ({len(results)} items) and README.md at {STANDARDS_DIR}", flush=True)

def main():
    print(f"Starting download of {len(CATALOG)} Australian Standards & NCC documents...", flush=True)
    STANDARDS_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    # Download concurrently with 4 workers to respect server bandwidth while downloading quickly
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(download_file, item): item for item in CATALOG}
        for future in as_completed(futures):
            res = future.result()
            results.append(res)

    results.sort(key=lambda x: (x["category"], x["filename"]))
    build_manifest_and_readme(results)
    print("Download and indexing completed successfully!", flush=True)

if __name__ == "__main__":
    main()
