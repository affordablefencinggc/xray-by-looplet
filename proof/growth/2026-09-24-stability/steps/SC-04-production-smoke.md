# SC-04: current production smoke boundary

Status: current built-output journey PASS; historical 404 cause OPEN.

The current SC-09 production journey passes 138/138 with hydration ready, rendered desktop/tablet views and zero browser resource/runtime errors; HVAC production passes 46/46. Built output is from 8a6226fc93a6, whose 727 product src files remain hash-identical. It was not rebuilt or deployed this turn.

[Production results](../sc09-production-results.json), [source identity](../source-identity.json), [inspected screenshot](../captures/production-css-reloaded-desktop.png), [exact runner/record diff](../changes.diff).

The historical COMPLEX-PLAN smoke JSON names three 404 messages but does not retain the failing URLs. Its asset failure cannot honestly be identified as the same defect as the older development reload stall. No repeat of the complete 58-page import trial, physical tablet, installer, native macOS/Linux or deployment acceptance is claimed.
