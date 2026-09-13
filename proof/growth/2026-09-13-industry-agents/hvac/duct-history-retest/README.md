# HVAC actual-tool retry after history correction

PASS. The unchanged explicit synthetic fixture was submitted once at 2026-09-13T09:53:17Z in the existing DANS1 visible Edge HVAC profile (port 9342, target C881A561953E464791A17AF4579C59F6).

The configured assistant actually called calculate_draft_duct_material once, with model execution origin. The real receipt returned 16 m² developed area and 64 kg sheet mass, draft-unverified, verifiedQuoteEligible false, and explicit exclusions. The final response and Developer review correctly reported that receipt. Exact project JSON remained unchanged. One reload preserved the exact turn entries and execution origin; no error, idle. The reloaded screenshot was visually inspected and shows the fresh review legibly.

See verdict.json, before.json, after.json, reloaded.json, result.png and reloaded.png. send/capture/reload scripts document the actual raw-CDP interactions. Root-owned browser PID 10208 and tunnel remain running for handoff. Last observer activity 09:56:30Z; no further model request.

This proves explicit synthetic straight-duct arithmetic and response persistence, not drawing-derived takeoff, fitting quantities, engineering sizing or a verified quote. Earlier failed attempts are preserved in sibling folders rather than replaced.
