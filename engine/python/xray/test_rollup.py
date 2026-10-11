"""Unit tests for rollup.py — whole-building aggregation from a floor takeoff."""

from xray.rollup import project_rollup

TAKEOFF = {
    "quantities": [
        {"id": "q-area-gf", "item": "gross floor area", "qty": 120.0,
         "unit": "m2", "tier": "single-source"},
        {"id": "q-col-1", "item": "column 200UC59.5", "qty": 8,
         "unit": "ea", "tier": "single-source"},
        {"id": "q-beam-1", "item": "beam 310UB40.4", "qty": 4,
         "unit": "ea", "tier": "single-source"},
    ]
}


def totals_by_item(r):
    return {t["item"]: t for t in r["totals"]}


def test_building_height_from_floor_count_and_storey():
    r = project_rollup(TAKEOFF, floors=3, floor_height_m=3.5)
    h = totals_by_item(r)["building height"]
    assert h["qty"] == 10.5 and h["unit"] == "m"
    assert h["tier"] == "needs-human"
    assert h["formula"] == "3 floors x 3.5 m storey = 10.5 m"
    assert "not the drawing" in h["notes"]


def test_column_line_length_aggregates_columns_only():
    r = project_rollup(TAKEOFF, floors=3, floor_height_m=3.5)
    assert r["perFloorColumns"] == 8          # beams are not columns
    cl = totals_by_item(r)["column-line length"]
    assert cl["qty"] == 84.0                  # 8 columns x 10.5 m
    assert cl["unit"] == "m" and cl["tier"] == "needs-human"
    assert cl["formula"] == "8 columns x 10.5 m height = 84.0 m"


def test_total_built_area_multiplies_per_floor_area():
    r = project_rollup(TAKEOFF, floors=3, floor_height_m=3.5)
    a = totals_by_item(r)["total built area"]
    assert a["qty"] == 360.0 and a["unit"] == "m2"
    assert a["formula"] == "120.0 m2/floor x 3 floors = 360.0 m2"
    # area tier was single-source -> no extra warning, but the parameter caveat stays
    assert "per-floor area was tier 'single-source'" in a["notes"]
    assert "confirm it first" not in a["notes"]
    assert "supplied floor count" in a["notes"]


def test_every_total_is_needs_human():
    r = project_rollup(TAKEOFF, floors=2, floor_height_m=3.0)
    assert r["totals"]
    assert all(t["tier"] == "needs-human" for t in r["totals"])


def test_flagged_area_uncertainty_carries_forward():
    takeoff = {"quantities": [
        {"id": "q-area-1", "item": "floor area", "qty": 100.0,
         "unit": "m2", "tier": "needs-human"}]}
    r = project_rollup(takeoff, floors=2, floor_height_m=3.0)
    a = totals_by_item(r)["total built area"]
    assert a["qty"] == 200.0
    assert "confirm it first" in a["notes"]


def test_no_columns_means_no_column_line_row():
    takeoff = {"quantities": [
        {"id": "q-area-1", "item": "floor area", "qty": 100.0,
         "unit": "m2", "tier": "single-source"}]}
    r = project_rollup(takeoff, floors=2, floor_height_m=3.0)
    assert r["perFloorColumns"] == 0
    items = totals_by_item(r)
    assert "column-line length" not in items
    assert set(items) == {"building height", "total built area"}


def test_no_area_means_no_area_row():
    takeoff = {"quantities": [
        {"id": "q-col-1", "item": "column", "qty": 5, "unit": "ea",
         "tier": "single-source"}]}
    r = project_rollup(takeoff, floors=2, floor_height_m=3.0)
    assert set(totals_by_item(r)) == {"building height", "column-line length"}


def test_empty_takeoff_only_yields_building_height():
    r = project_rollup({"quantities": []}, floors=4, floor_height_m=2.7)
    assert r["perFloorColumns"] == 0
    assert [t["item"] for t in r["totals"]] == ["building height"]
    assert r["totals"][0]["qty"] == 10.8
    assert r["floors"] == 4 and r["floorHeightM"] == 2.7


def test_column_match_is_case_insensitive_and_ea_only():
    takeoff = {"quantities": [
        {"item": "COLUMN pad", "qty": 2, "unit": "ea"},
        {"item": "column", "qty": 1.5, "unit": "lm"},   # linear, not a count
        {"item": "beam", "qty": 3, "unit": "ea"}]}
    r = project_rollup(takeoff, floors=1, floor_height_m=3.0)
    assert r["perFloorColumns"] == 2