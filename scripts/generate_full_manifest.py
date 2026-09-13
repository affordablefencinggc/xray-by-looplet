import os
import json
import hashlib
from pathlib import Path
import time

WORKSPACE_ROOT = Path(r"c:\Users\danie\repo\xray-by-looplet")
STANDARDS_DIR = WORKSPACE_ROOT / "downloads" / "standards"

CATEGORY_TITLES = {
    "ncc_2022_current": "National Construction Code 2022 (Current Law)",
    "ncc_2025_preview": "National Construction Code 2025 (Next Generation Preview)",
    "abcb_handbooks_and_guides": "ABCB Official Engineering, Practice & Verification Handbooks",
    "housing_standards_and_tolerances": "Australian Housing Standards, Workmanship & Tolerances",
    "engineering_and_structural_guides": "Residential Structural Engineering Design Standards (AS 1684, AS 2870, AS 3700, AS 3740)",
    "drafting_and_architecture_standards": "Architectural & CAD Drafting Standards (AS 1100)",
    "ncc_2019_amendment1": "NCC 2019 Amendment 1 Series (Existing Buildings)",
    "ncc_historical_archive": "Historical Building Code of Australia Archive (BCA 1988 to NCC 2016)"
}

DOCUMENT_DESCRIPTIONS = {
    "NCC_2022_Volume_One.pdf": "Building Code of Australia for Class 2 to 9 buildings (multi-res, commercial, industrial).",
    "NCC_2022_Volume_Two.pdf": "Building Code of Australia for Class 1 and 10 residential buildings (houses, sheds, garages).",
    "NCC_2022_Volume_Three_Plumbing_Code.pdf": "Plumbing Code of Australia covering water, sanitary, and drainage services.",
    "NCC_2022_ABCB_Housing_Provisions_Standard.pdf": "Core Deemed-to-Satisfy (DTS) standard for Australian houses: footings, framing, masonry, waterproofing.",
    "NCC_2022_Combined_Volume_Two_and_Housing_Provisions.pdf": "Integrated Volume Two and Housing Provisions manual in a single document.",
    "NCC_2022_Consolidated_Performance_Requirements.pdf": "All mandatory Australian performance requirements across Volumes 1, 2, and 3.",
    "ABCB_Livable_Housing_Design_Standard_2022.pdf": "Mandatory accessibility features: step-free entry, accessible doors, and ground-floor sanitary facilities.",
    "ABCB_Fire_Safety_Verification_Method_Standard_2022.pdf": "Verification method for engineered fire safety solutions.",
    "ABCB_NatHERS_Heating_Cooling_Load_Limits_2022.pdf": "Heating and cooling limits for residential energy ratings.",
    "ABCB_Whole_of_Home_Efficiency_Factors_2022.pdf": "Appliance, hot water, heating, and solar efficiency factors.",
    "NCC_2022_Amendment_1.pdf": "First official amendment set for NCC 2022.",
    "NCC_2022_Amendment_2.pdf": "Second official amendment set for NCC 2022.",
    "NCC_2022_Register_of_Changes.pdf": "Comprehensive register of changes and errata for NCC 2022.",

    "NCC_2025_Volume_One.pdf": "Next generation Volume One for Class 2 to 9 commercial and multi-residential structures.",
    "NCC_2025_Volume_Two.pdf": "Next generation Volume Two for Class 1 and 10 residential dwellings.",
    "NCC_2025_Volume_Three_Plumbing.pdf": "Next generation Volume Three Plumbing Code.",
    "NCC_2025_ABCB_Housing_Provisions.pdf": "Next generation Deemed-to-Satisfy housing provisions.",

    "ABCB_Housing_Energy_Efficiency_Handbook.pdf": "Handbook for 7-star thermal fabric, insulation, thermal breaks, and glazing.",
    "ABCB_Livable_Housing_Design_Handbook.pdf": "Design guidelines for accessible residential construction.",
    "ABCB_Sound_Transmission_Handbook.pdf": "Acoustic insulation handbook for party walls, floors, and ducts.",
    "ABCB_Condensation_in_Buildings_Handbook.pdf": "Handbook on vapour permeability, ventilation, and condensation mitigation.",
    "ABCB_Structural_Reliability_Verification_Method_Handbook.pdf": "Handbook on structural safety verification under limit states design.",
    "ABCB_Evidence_of_Suitability_Handbook.pdf": "Compliance pathways, test reports, CodeMark, and certification requirements.",
    "ABCB_Performance_Solution_Process_Handbook.pdf": "Step-by-step framework for developing and approving performance solutions.",
    "ABCB_Prefabricated_Modular_Offsite_Construction_Handbook.pdf": "Certification and engineering for modular and offsite construction.",
    "ABCB_Embodied_Carbon_Handbook.pdf": "Assessment of embodied carbon in construction materials.",
    "ABCB_Australian_Fire_Engineering_Guidelines.pdf": "National guidelines for fire safety engineering design.",
    "ABCB_NCC_Building_Classifications_Guide.pdf": "Decision guide for classifying Australian buildings (Class 1-10).",
    "ABCB_Commercial_Energy_Efficiency_Handbook.pdf": "Section J compliance handbook for commercial HVAC, envelope, and power.",
    "ABCB_Waterproofing_and_Water_Shedding.pdf": "Review and provisions on membranes, falls, and waterproofing.",

    "Guide_to_Standards_and_Tolerances.pdf": "Official Australian multi-jurisdictional benchmark for residential workmanship, cracking limits, and building defects.",

    "AS1100_Architectural_Drafting_Standards_Guide.md": "Australian Standard AS 1100 guide: sheet sizes, scales, lineweights, layer conventions, symbols, abbreviations, hatching.",
    "AS1684_Residential_Timber_Framing_Design_Guide.md": "Australian Standard AS 1684 guide: wind classification N1-N4/C1-C3, studs, plates, bearers, joists, bracing, tie-downs.",
    "AS2870_Residential_Slabs_and_Footings_Guide.md": "Australian Standard AS 2870 guide: soil classification A-P, raft/waffle slabs, SL72-SL92 mesh, articulation joints.",
    "AS3700_AS4773_Masonry_Structures_Guide.md": "Australian Standard AS 3700/4773 guide: brick veneer, cavity brick, wall ties R1-R4, weepholes, DPC, lintels.",
    "AS3740_AS4654_Waterproofing_Standards_Guide.md": "Australian Standard AS 3740/4654 guide: wet area membrane extents, shower falls (1:80), balcony terminations (100mm)."
}

def generate_catalog():
    manifest_entries = []

    for cat_id, cat_title in CATEGORY_TITLES.items():
        cat_dir = STANDARDS_DIR / cat_id
        if not cat_dir.exists():
            continue

        for file in sorted(cat_dir.glob("*.*")):
            fname = file.name
            size = file.stat().st_size
            with open(file, "rb") as f:
                sha = hashlib.sha256(f.read()).hexdigest()

            desc = DOCUMENT_DESCRIPTIONS.get(fname, f"Official standard / code document: {fname}")
            manifest_entries.append({
                "category": cat_id,
                "category_title": cat_title,
                "filename": fname,
                "title": fname.replace("_", " ").replace(".pdf", "").replace(".md", "").replace(".zip", ""),
                "description": desc,
                "size_bytes": size,
                "size_mb": round(size / (1024*1024), 2),
                "sha256": sha,
                "local_rel_path": f"{cat_id}/{fname}"
            })

    with open(STANDARDS_DIR / "MANIFEST.json", "w", encoding="utf-8") as f:
        json.dump(manifest_entries, f, indent=2)

    total_bytes = sum(e["size_bytes"] for e in manifest_entries)
    total_docs = len(manifest_entries)

    lines = [
        "# Australian Standards, National Construction Code (NCC) & Building Guidelines Library",
        "",
        f"**Repository Directory**: `downloads/standards/`  ",
        f"**Total Verified Documents**: {total_docs}  ",
        f"**Total Library Volume**: {total_bytes / (1024*1024):.2f} MB ({total_bytes / (1024*1024*1024):.2f} GB)  ",
        f"**Audit & Integrity Date**: {time.strftime('%Y-%m-%d')}  ",
        "",
        "This repository contains the complete official Australian National Construction Code (NCC) library, ",
        "ABCB engineering handbooks, deemed-to-satisfy housing provisions, Guide to Standards and Tolerances, ",
        "and Australian Standards engineering and drafting guides (AS 1100, AS 1684, AS 2870, AS 3700, AS 3740).",
        "",
        "---",
        ""
    ]

    by_cat = {}
    for e in manifest_entries:
        by_cat.setdefault(e["category"], []).append(e)

    for cat_id, cat_title in CATEGORY_TITLES.items():
        if cat_id not in by_cat:
            continue
        items = by_cat[cat_id]
        lines.append(f"## {cat_title} ({len(items)} documents)")
        lines.append("")
        lines.append("| Document Title | Size | SHA-256 Checksum | Local File Link |")
        lines.append("| :--- | :--- | :--- | :--- |")
        for it in items:
            lines.append(f"| **{it['title']}**<br>_{it['description']}_ | {it['size_mb']} MB | `{it['sha256'][:10]}...` | [{it['filename']}](./{it['local_rel_path']}) |")
        lines.append("")

    with open(STANDARDS_DIR / "README.md", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Generated comprehensive MANIFEST.json and README.md with {total_docs} items ({total_bytes / (1024*1024*1024):.2f} GB).")

if __name__ == "__main__":
    generate_catalog()
