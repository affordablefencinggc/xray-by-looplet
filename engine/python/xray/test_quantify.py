"""Unit tests for quantify.py — shed rule pack (deterministic quantities)."""

import math

from xray.quantify import shed_pack

SPEC = {"L": 16.0, "W": 9.0, "eave": 4.2, "pitch": 10.0, "bays": 4}


class Ent:
    def __init__(self, id, type, value=None, raw=""):
        self.id = id
        self.type = type
        self.value = value
        self.raw = raw


class Check:
    def __init__(self, id, kind, status, detail):
        self.id = id
        self.kind = kind
        self.status = status
        self.detail = detail


def by_id(qs, qid):
    return next(q for q in qs if q.id == qid)


def test_frames_bays_plus_one_single_source_without_check():
    qs = shed_pack(SPEC, [], [])
    f = by_id(qs, "qty-frames")
    assert f.qty == 5.0 and f.unit == "ea"
    assert f.tier == "single-source"
    assert f.formula == "bays + 1 = 4 + 1 = 5"
    assert "spec token only" in f.notes


def test_frames_reconciled_by_count_check():
    check = Check("chk-1", "count", "pass",
                  "PORTAL RAFTER OVER label appears 5 times")
    qs = shed_pack(SPEC, [], [check])
    f = by_id(qs, "qty-frames")
    assert f.tier == "reconciled"
    assert "chk-1" in f.evidence
    assert "confirmed by label count check" in f.notes


def test_portal_steel_matches_documented_expectation():
    # CONTEXT.md: 5 frames -> 87.7 lm
    qs = shed_pack(SPEC, [], [])
    p = by_id(qs, "qty-portal-steel")
    assert p.qty == 87.7 and p.unit == "lm"
    rafter = (9.0 / 2.0) / math.cos(math.radians(10.0))
    assert math.isclose(p.qty, round(5 * (2 * 4.2 + 2 * rafter), 1))


def test_roof_sheeting_matches_documented_expectation():
    # CONTEXT.md: 2 x L x rafter = 146.2 m2
    qs = shed_pack(SPEC, [], [])
    r = by_id(qs, "qty-roof-sheeting")
    assert r.qty == 146.2 and r.unit == "m2"
    assert r.tier == "single-source"


def test_openings_grouped_by_tag_label():
    ents = [Ent("e0-0", "TAG", "D3"), Ent("e0-1", "TAG", "D3"),
            Ent("e0-2", "TAG", "D3"), Ent("e0-3", "TAG", "W2"),
            Ent("e0-4", "DIM", 4500)]
    qs = shed_pack(SPEC, ents, [])
    d3 = by_id(qs, "qty-opening-d3")
    assert d3.qty == 3.0 and d3.unit == "ea" and d3.tier == "single-source"
    assert d3.evidence == ["e0-0", "e0-1", "e0-2"]
    assert d3.item == "opening D3"
    w2 = by_id(qs, "qty-opening-w2")
    assert w2.qty == 1.0


def test_wall_cladding_needs_human_without_open_bay():
    qs = shed_pack(SPEC, [], [])
    c = by_id(qs, "qty-wall-cladding")
    assert c.tier == "needs-human"
    assert c.qty == 217.1                      # 134.4 side + 82.7 gable ends
    assert "no OPEN-bay label found" in c.notes


def test_wall_cladding_deducts_open_bay_both_sides():
    ents = [Ent("e0-9", "LABEL", raw="BAY 1 OPEN")]
    qs = shed_pack(SPEC, ents, [])
    c = by_id(qs, "qty-wall-cladding")
    assert c.tier == "needs-human"
    assert c.qty == 183.5                      # 217.1 - 2 x 4.0 x 4.2
    assert "OPEN bay" in c.notes
    assert "e0-9" in c.evidence


def test_spec_entity_used_as_evidence_when_present():
    spec_ent = Ent("e0-0", "SPEC", value=dict(SPEC))
    qs = shed_pack(SPEC, [spec_ent], [])
    assert "e0-0" in by_id(qs, "qty-frames").evidence
    assert "e0-0" in by_id(qs, "qty-roof-sheeting").evidence


def test_quantities_are_deterministic():
    a = shed_pack(SPEC, [], [])
    b = shed_pack(SPEC, [], [])
    assert [(q.id, q.qty, q.unit, q.tier) for q in a] == \
           [(q.id, q.qty, q.unit, q.tier) for q in b]