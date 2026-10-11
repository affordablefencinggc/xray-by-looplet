"""Unit tests for orders.py — deterministic stock-length cut optimiser."""

import math

import pytest

from xray.orders import (Allowance, CannotSource, CutBin, Purchase,
                         apply_allowances, convert_linear, convert_uniform,
                         kg_per_m_from_designation, pack_cutlist, weight_kg)


def profile(**kw):
    from xray.orders import StockProfile
    base = dict(name="test", preferred=(2.7,))
    base.update(kw)
    return StockProfile(**base)


# ------------------------------------------------------------ allowances

def test_apply_allowances_multiplies_in_order_and_audits():
    allowances = [Allowance("waste", 1.05, "AS 1684 table"),
                  Allowance("handling", 1.02, "site rule")]
    adjusted, records = apply_allowances(100.0, allowances)
    assert math.isclose(adjusted, 107.1)
    assert len(records) == 2
    assert records[0] == {"name": "waste", "factor": 1.05,
                          "source": "AS 1684 table",
                          "from": 100.0, "to": 105.0}
    assert records[1]["from"] == 105.0 and records[1]["to"] == 107.1


def test_apply_allowances_empty():
    adjusted, records = apply_allowances(42.0, [])
    assert adjusted == 42.0 and records == []


# -------------------------------------------------------- convert_uniform

def test_exact_stock_length_buys_at_length_with_zero_drop():
    r = convert_uniform(2.7, 33, profile(preferred=(2.7, 3.0)))
    assert r.method == "exact-stock"
    assert r.order_qty == 33
    assert r.stock_length_m == 2.7
    assert r.pieces_per_length == 1
    assert r.total_offcut_m == 0.0
    assert r.purchase == [Purchase(2.7, 33, 0.0)]


def test_exact_stock_pack_rounding_adds_spare_drop():
    r = convert_uniform(2.7, 33, profile(preferred=(2.7,), pack_size=10))
    assert r.order_qty == 40
    assert math.isclose(r.total_offcut_m, 7 * 2.7)
    assert math.isclose(r.yield_pct, 82.5)
    assert "7 spare from pack rounding" in r.notes


def test_cut_fallback_minimises_total_offcut():
    # 0.9 m from 5.4 m: 6 per length, 6 lengths, 2.7 m total drop
    # 0.9 m from 6.0 m: 6 per length, 6 lengths, 6.3 m total drop -> worse
    r = convert_uniform(0.9, 33, profile(preferred=(),
                                         fallback=(5.4, 6.0)))
    assert r.method == "cut-from-5.4m"
    assert r.pieces_per_length == 6
    assert r.order_qty == 6
    assert math.isclose(r.total_offcut_m, 2.7)
    assert math.isclose(r.purchase[0].offcut_m, 0.0)


def test_cut_fallback_accounts_for_kerf_between_pieces():
    # kerf 0.1: (6.0+0.1)/(1.5+0.1) -> 3 pieces per length
    r = convert_uniform(1.5, 7, profile(preferred=(6.0,), kerf_m=0.1))
    assert r.pieces_per_length == 3
    assert r.order_qty == 3
    assert math.isclose(r.total_offcut_m, 18.0 - 10.5)
    assert math.isclose(r.purchase[0].offcut_m, 6.0 - (3 * 1.5 + 2 * 0.1))
def test_cut_fallback_raises_when_nothing_fits():
    with pytest.raises(CannotSource):
        convert_uniform(3.5, 2, profile(preferred=(2.0,)))


def test_zero_count_is_a_noop_order():
    r = convert_uniform(2.7, 0, profile())
    assert r.method == "none" and r.order_qty == 0 and r.purchase == []


def test_delivered_weight_when_kg_per_m_supplied():
    r = convert_uniform(2.7, 33, profile(preferred=(2.7,), kg_per_m=10.0))
    assert math.isclose(r.delivered_weight_kg, 33 * 2.7 * 10.0)


def test_as_dict_shape_for_quantity_purchase():
    d = convert_uniform(2.7, 33, profile(preferred=(2.7,))).as_dict()
    assert set(d) == {"order_qty", "purchase", "total_offcut_m",
                      "yield_pct", "method", "delivered_weight_kg", "notes"}
    assert d["order_qty"] == 33
    assert d["purchase"] == [{"stock_length_m": 2.7, "count": 33,
                              "offcut_m": 0.0}]


# ----------------------------------------------------------- pack_cutlist

def test_pack_cutlist_first_fit_decreasing():
    bins = pack_cutlist([3.0, 2.9, 2.8, 1.0, 1.5, 1.5], 6.0)
    assert len(bins) == 3
    assert [b.pieces for b in bins] == [[3.0, 2.9], [2.8, 1.5, 1.5], [1.0]]
    assert math.isclose(bins[0].offcut_m, 0.1)
    assert math.isclose(sum(b.offcut_m for b in bins),
                        3 * 6.0 - sum([3.0, 2.9, 2.8, 1.0, 1.5, 1.5]))
    for b in bins:
        assert isinstance(b, CutBin)
        assert b.pieces == sorted(b.pieces, reverse=True)
        assert b.stock_length_m == 6.0


def test_pack_cutlist_is_deterministic():
    pieces = [3.0, 2.9, 2.8, 1.0, 1.5, 1.5, 2.2, 4.1]
    a = pack_cutlist(pieces, 6.0)
    b = pack_cutlist(list(reversed(pieces)), 6.0)  # input order must not matter
    assert [(x.stock_length_m, x.pieces, x.offcut_m) for x in a] == \
           [(x.stock_length_m, x.pieces, x.offcut_m) for x in b]


def test_pack_cutlist_respects_kerf():
    # 3 pieces of 2.0 + 2 kerfs of 0.1 = 6.2 > 6.0 -> second length needed
    bins = pack_cutlist([2.0, 2.0, 2.0], 6.0, kerf=0.1)
    assert len(bins) == 2
    assert bins[0].pieces == [2.0, 2.0]


def test_pack_cutlist_raises_when_piece_exceeds_stock():
    with pytest.raises(CannotSource):
        pack_cutlist([7.0], 6.0)


# --------------------------------------------------------- convert_linear

def test_convert_linear_prefers_min_drop_then_longer_stock():
    r = convert_linear(87.7, profile(preferred=(6.0, 5.4)))
    assert r.method == "linear-from-6m"
    assert r.order_qty == 15                    # ceil(87.7 / 6.0)
    assert math.isclose(r.total_offcut_m, 90.0 - 87.7)
    assert math.isclose(r.yield_pct, 97.4)
    assert r.pieces_per_length == 0             # sum-based, no cut list


def test_convert_linear_zero_run():
    r = convert_linear(0.0, profile(preferred=(6.0,)))
    assert r.method == "none" and r.order_qty == 0


# --------------------------------------------------- steel designation kg/m

def test_kg_per_m_from_designation():
    assert kg_per_m_from_designation("310UB40.4") == 40.4
    assert kg_per_m_from_designation("200UC59.5") == 59.5
    assert kg_per_m_from_designation("75PFC9.3") == 9.3
    assert kg_per_m_from_designation("M12 bolt") is None


def test_weight_kg():
    assert math.isclose(weight_kg(3.0, 40.4), 121.2)