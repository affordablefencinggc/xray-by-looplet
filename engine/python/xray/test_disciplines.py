"""Tests for disciplines.py — packs surfaced as first-class disciplines.

list_disciplines() must be pure metadata over the live registry: every
registered pack declares a discipline, the list has one entry per pack with
unique ids, and the pack→discipline mapping matches the intended audience
split (who the app presents each discipline to).
"""

from xray.disciplines import list_disciplines
from xray.packs import iter_packs

# the intended pack-name → discipline-id mapping
EXPECTED = {
    "fencing": "fencing",
    "electrical": "electrical",
    "structural-count": "structural",
    "survey": "civil",
    "residential": "architecture",
    "shed": "building",
}


def test_every_registered_pack_declares_a_discipline():
    packs = iter_packs()
    assert len(packs) == len(EXPECTED)  # registry holds exactly the 6 packs
    for p in packs:
        assert getattr(p, "discipline", None), (
            f"pack {p.name!r} has no discipline metadata")
        assert getattr(p, "audience", ""), (
            f"pack {p.name!r} has no audience")
        assert getattr(p, "detect_summary", ""), (
            f"pack {p.name!r} has no detect_summary")


def test_list_disciplines_six_entries_with_unique_ids():
    ds = list_disciplines()
    assert len(ds) == 6
    ids = [d["id"] for d in ds]
    assert len(set(ids)) == len(ids)  # unique ids
    for d in ds:
        assert set(d) == {"id", "label", "audience", "pack", "detect_summary"}
        assert d["label"] and d["audience"] and d["detect_summary"]
        assert d["label"] != d["id"]  # human label, not a bare id echo


def test_discipline_ids_match_the_intended_mapping():
    ds = list_disciplines()
    by_pack = {d["pack"]: d["id"] for d in ds}
    assert by_pack == EXPECTED


def test_list_disciplines_is_pure_metadata():
    # calling it twice returns equal results and never mutates the registry
    a, b = list_disciplines(), list_disciplines()
    assert a == b
    assert len(iter_packs()) == len(EXPECTED)