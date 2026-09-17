# Skills atlas

The ASSISTANT_SKILLS entries by category. Categories are headings here, never separate files.

## Evidence and readiness
| Skill | Does |
| --- | --- |
| Inspect project evidence | Reads identity, sources, recovery and save state. Changes nothing. |
| Check takeoff readiness | Reports missing hashes, calibration, dimensions and specifications. |

## Design
| Skill | Does |
| --- | --- |
| Plan architectural edits | Reads the design in millimetres, proposes an edit plan, applies none. |

## Drafting and viewing
| Skill | Does |
| --- | --- |
| Draft existing model | Animates the mounted model. Creates no geometry. |
| Cinematic tour | Orbits the current drafting model. |
| Drafting status | Reads real viewer and animation telemetry. |

## Research and references
| Skill | Does |
| --- | --- |
| Research materials | Cited web research; prices stay research, never a quote. |
| Compare references | Reads attached images as suggestions, never measured facts. |

## Traps
- Sample-data firewall: sample, inferred and unverified data stay visibly separate from verified
  measurements and are never promoted.
- Calibration before measurement: a page needs a locked two-point ground-truth calibration before a
  trace; verified takeoff also needs matching source SHA-256 identity.
- Evidence states traced, dimensioned and inferred are per part; keep counts, lengths, areas and
  volumes separate.
- Demonstration designs keep their marker through rename-design; do not present one as a real job.
- 64 rounds per send, then the turn pauses with completed actions retained.
- 256 tool calls per send; the next is refused, not executed.
- Permission modes are ask, auto and readonly. Read tools never prompt; ask grants a call once or
  for the chat; readonly blocks edits, navigation, viewer changes and renders.
