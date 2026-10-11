"""disciplines.py — surface trade packs as first-class DISCIPLINES.

The engine measures trades via packs (packs_*.py). Clients — the X-Ray app
presented to engineers, architects, draftsmen and builders — need those packs
presented as disciplines: a stable id, a human label, the audience each one
serves, and one line on what drawing evidence triggers its pack.

This module is pure metadata: it reads the live pack registry and never runs a
takeoff (no quantify(), and detect() is only ever probed on an empty context).
"""
from __future__ import annotations

# Importing the pack modules populates the live registry — the same imports
# engine.py makes before a run. Without these, _registry is empty.
import xray.packs_electrical  # noqa: F401  (registers ElectricalPack)
import xray.packs_fencing  # noqa: F401  (registers FencingPack)
import xray.packs_residential  # noqa: F401  (registers ResidentialPack)
import xray.packs_shed  # noqa: F401  (registers ShedPack)
import xray.packs_structural  # noqa: F401  (registers StructuralCountPack)
import xray.packs_survey  # noqa: F401  (registers SurveyPack)

from xray.packs import Pack, PackContext, iter_packs

# Human labels per discipline id. A pack may declare its own `discipline_label`
# to override; otherwise the id is title-cased as a fallback.
_DISCIPLINE_LABELS = {
    "fencing": "Fencing & external works",
    "electrical": "Electrical",
    "structural": "Structural",
    "civil": "Civil & survey",
    "architecture": "Architecture",
    "building": "Building",
}


def _label(pack: Pack) -> str:
    override = getattr(pack, "discipline_label", None)
    if override:
        return str(override)
    did = getattr(pack, "discipline", None) or ""
    return _DISCIPLINE_LABELS.get(did) or did.replace("-", " ").title()


def _detect_summary(pack: Pack) -> str:
    """The pack's own one-line trigger summary, falling back to a safe probe.

    Preferred source is the pack's `detect_summary` class attribute (static
    metadata, zero risk). If a pack never declared one, probe detect() on an
    empty context — wrapped so a broken detect can never break the listing;
    the summary then simply reports that the pack applies (True/False is all an
    empty probe can honestly say).
    """
    declared = getattr(pack, "detect_summary", "") or ""
    if declared:
        return declared
    try:
        applies = bool(pack.detect(PackContext(entities=[], checks=[],
                                               tables=[], pages=[])))
        return (f"applies when the pack's detect() fires"
                f"{' (it does not on an empty document)' if not applies else ''}")
    except Exception as e:
        return f"trigger unknown (detect probe failed: {type(e).__name__})"


def list_disciplines() -> list[dict]:
    """One entry per registered pack that declares a discipline.

    Returns [{id, label, audience, pack, detect_summary}] ordered by registry
    order (the same order a takeoff consults packs in).
    """
    out = []
    for p in iter_packs():
        did = getattr(p, "discipline", None)
        if not did:
            continue
        out.append({
            "id": did,
            "label": _label(p),
            "audience": getattr(p, "audience", "") or "",
            "pack": p.name,
            "detect_summary": _detect_summary(p),
        })
    return out