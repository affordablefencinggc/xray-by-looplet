# Touch-accessible full binding provenance

Requirement: make the full recorded geometry/source hashes available without hover, while retaining current binding status as the pricing authority.

Source: frozen `9abf4c807030`; [exact ledger/styles diff](../source.diff), [manifest](../../2026-09-19-sc09-entity-highlight/preflight/9abf4c807030/source-manifest.json). Native `details/summary` exposes at-binding identities without rewriting them.

DANS1 dev **84/84** and production **89/89 PASS**; the actual accessible CDP click opens/closes the disclosure. Target measured **459×44 px**. Full 64-character geometry and source hashes match the recorded row identity and independently digested source bytes, fit the evidence cell, and do not overflow the estimate pane. Stale/withheld status is unchanged. [Production result](../campaigns/sc09-9abf4c807030-built2/output/browser-results.json), [dev result](../campaigns/sc09-9abf4c807030-combined2/output/browser-results.json).

[Production tablet screenshot](../campaigns/sc09-9abf4c807030-built2/output/production-captures/sc09-full-binding-provenance-tablet-1024x768.png) visually inspected: both hashes wrap completely and labels distinguish historical binding identity from current status.

Limits: tablet-sized Chrome viewport, not a physical touch-device result; no other geometry-family claim. [Build and cleanup record](../PRODUCTION.md).
