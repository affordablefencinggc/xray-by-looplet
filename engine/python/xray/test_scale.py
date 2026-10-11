"""Unit tests for scale.py — per-page scale voting / normalization."""

import math

from xray.scale import (MM_PER_PT, calibrate, infer_paper_size, vote_scale)


class Ent:
    """Duck-typed entity: only .type, .raw, .bbox are consulted."""

    def __init__(self, type, raw, bbox, value=None):
        self.type = type
        self.raw = raw
        self.bbox = bbox
        self.value = value


def scale_ent(raw, bbox, value="SCALE 1:200"):
    return Ent("SCALE", raw, bbox, value)


# ------------------------------------------------------------- paper size

def test_infer_paper_size_a4_both_orientations():
    # A4 = 297 x 210 mm -> 841.89 x 595.28 pt
    assert infer_paper_size(841.89, 595.28) == "A4"
    assert infer_paper_size(595.28, 841.89) == "A4"


def test_infer_paper_size_a1():
    # A1 = 841 x 594 mm
    w = 841.0 / MM_PER_PT
    h = 594.0 / MM_PER_PT
    assert infer_paper_size(w, h) == "A1"
    assert infer_paper_size(h, w) == "A1"


def test_infer_paper_size_unknown():
    assert infer_paper_size(1000.0, 700.0) is None
    assert infer_paper_size(300.0, 300.0) is None


# ------------------------------------------------------------ calibration

def test_calibrate_from_two_points():
    # 3-4-5 triangle: 5 pt of paper = 3500 mm of real world -> 700 mm/pt
    r = calibrate((0.0, 0.0), (3.0, 4.0), 3500.0)
    assert r["verified"] is True
    assert r["confidence"] == 1.0
    assert r["methods"] == ["manual-calibration"]
    assert math.isclose(r["mmPerPt"], 700.0)
    assert r["value"] == f"1:{round(700.0 / MM_PER_PT)}"


def test_calibrate_rejects_degenerate_input():
    r = calibrate((1.0, 1.0), (1.0, 1.0), 3500.0)
    assert r["value"] is None and r["verified"] is False and r["confidence"] == 0.0
    r2 = calibrate((0.0, 0.0), (3.0, 4.0), -5.0)
    assert r2["value"] is None and r2["mmPerPt"] is None


# ------------------------------------------------------------- vote_scale

def test_no_evidence_returns_none():
    r = vote_scale([], (1000.0, 700.0), None)
    assert r["value"] is None
    assert r["mmPerPt"] is None
    assert r["methods"] == []
    assert r["confidence"] == 0.0
    assert r["verified"] is False


def test_declared_beats_titleblock_entity():
    # declared weight 3.0 > title-block weight 2.0
    ents = [scale_ent("SCALE 1:200", (800.0, 600.0, 900.0, 620.0))]
    r = vote_scale(ents, (1000.0, 700.0), "1:500")
    assert r["value"] == "1:500"
    assert r["methods"] == ["declared"]
    assert r["verified"] is True
    assert math.isclose(r["mmPerPt"], MM_PER_PT * 500)


def test_titleblock_beats_onpage():
    # title-block 1:200 (2.0) vs on-page 1:100 (1.0); no A-series prior here
    ents = [
        scale_ent("SCALE 1:200", (800.0, 600.0, 900.0, 620.0)),
        scale_ent("1:100", (100.0, 100.0, 150.0, 110.0)),
    ]
    r = vote_scale(ents, (1000.0, 700.0), None)
    assert r["value"] == "1:200"
    assert r["methods"] == ["titleblock-scale"]
    assert math.isclose(r["confidence"], round(2.0 / 3.0, 3))


def test_onpage_scale_reinforced_by_paper_prior():
    # A4 page adds a weak 1:100 prior that agrees with the on-page stamp
    ents = [scale_ent("1:100", (100.0, 100.0, 150.0, 110.0))]
    r = vote_scale(ents, (595.28, 841.89), None)
    assert r["value"] == "1:100"
    assert set(r["methods"]) == {"onpage-scale", "paper-size"}
    assert r["confidence"] == 1.0
    assert r["verified"] is True


def test_paper_prior_only_is_not_verified():
    r = vote_scale([], (595.28, 841.89), None)
    assert r["value"] == "1:100"
    assert r["methods"] == ["paper-size"]
    assert r["verified"] is False
    assert r["confidence"] == 1.0
    assert math.isclose(r["mmPerPt"], MM_PER_PT * 100)


def test_conflicting_stamps_tiebreak_to_smaller_ratio():
    # equal weights -> the (votes, -ratio) key prefers the smaller ratio
    ents = [
        scale_ent("1:100", (100.0, 100.0, 150.0, 110.0)),
        scale_ent("1:50", (300.0, 100.0, 350.0, 110.0)),
    ]
    r = vote_scale(ents, (1000.0, 700.0), None)
    assert r["value"] == "1:50"
    assert math.isclose(r["confidence"], 0.5)   # winner holds half the votes


def test_non_scale_entities_ignored_and_bad_raw_skipped():
    ents = [
        Ent("DIM", "4500", (10.0, 10.0, 40.0, 20.0), 4500),
        Ent("SCALE", "not a ratio", (100.0, 100.0, 150.0, 110.0)),
    ]
    r = vote_scale(ents, (1000.0, 700.0), None)
    assert r["value"] is None


def test_page_rect_four_tuple_supported():
    ents = [scale_ent("1:100", (100.0, 100.0, 150.0, 110.0))]
    r = vote_scale(ents, (0.0, 0.0, 1000.0, 700.0), None)  # (x0, y0, x1, y1)
    assert r["value"] == "1:100"
    assert r["methods"] == ["onpage-scale"]


def test_manual_calibration_mmPerPt_wins_over_everything():
    ents = [scale_ent("SCALE 1:200", (800.0, 600.0, 900.0, 620.0))]
    r = vote_scale(ents, (1000.0, 700.0), "1:500",
                   calibration={"mmPerPt": 700.0})
    assert r["methods"] == ["manual-calibration"]
    assert r["verified"] is True
    assert math.isclose(r["mmPerPt"], 700.0)


def test_manual_calibration_p0_p1_known_mm():
    r = vote_scale([], (1000.0, 700.0), None,
                   calibration={"p0": (0.0, 0.0), "p1": (3.0, 4.0),
                                "known_mm": 3500.0})
    assert r["verified"] is True
    assert math.isclose(r["mmPerPt"], 700.0)