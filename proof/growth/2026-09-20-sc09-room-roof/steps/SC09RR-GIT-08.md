# SC09RR-GIT-08 — evidence-preserving checkpoints

User requested cleanup of the accumulated working tree. Product changes, failed and passing evidence, dashboard updates and inherited audit work were checkpointed separately. Unfinished SC-09 work remains explicitly WIP; no push or merge was performed.

Git's default text normalization would change captured CRLF receipt bytes. The campaign is now excluded from text conversion, following the existing evidence rules in this repository.

- [Exact attributes diff](../source/evidence-attributes.patch).
- [Executed Git index/raw-file equality check](../source/git-byte-integrity.json): every campaign path checked; zero mismatches required before commit. This is a Git integrity check, not a product test.
- [Inspected dashboard screenshot](../campaigns/sc09rr-fc02f13bc904-dashboard-css5/output/captures/dashboard-sc09-desktop-1600x1000.png). It demonstrates the retained partial status and proof links, not Git byte equality.

No source, screenshot or failed-run record was deleted to reduce the change count.