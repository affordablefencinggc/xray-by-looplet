# PROOF-BYTES-04 — preserve captured evidence through Git

The repository normalizes text line endings. Local PowerShell receipts contain CRLF bytes whose exact SHA-256 values are recorded by the runner. Add campaign-specific `-text` rules and restage the original captured bytes so Git storage preserves those hashes. No historical run is relabelled or regenerated.

- [Exact attribute diff](../source/clean-stage.patch).
- [Executed byte verification](../machine/evidence-byte-check.json): all 85 manifest entries across the first local campaigns match both working files and staged Git blobs, zero failures.
- [Companion real browser screenshot](../trial1/captures/corrupt-archive-rejected.png): demonstrates the actual archive integrity rejection campaign. A screenshot cannot prove Git blob byte identity; the executed hash comparison is the evidence for that property.

The prior commit's normalized text blobs are superseded by the restored exact receipt bytes in this checkpoint. Scenario outcomes remain unchanged. New local campaign files use the same preservation rule.
