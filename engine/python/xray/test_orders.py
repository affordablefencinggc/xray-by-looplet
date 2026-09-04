import math

import pytest

from xray.orders import (
    MAX_EXACT_CUTLIST_PIECES,
    Allowance,
    CannotSource,
    ExactCutLimitExceeded,
    StockProfile,
    apply_allowances,
    convert_linear,
    convert_uniform,
    pack_cutlist,
)
from xray.quantify import Quantity


def bin_values(bins):
    return [(entry.pieces, entry.offcut_m) for entry in bins]


def test_exact_cutlist_beats_known_first_fit_counterexample():
    # Descending first-fit uses [4,4], [3,3,3], [3]. The exact answer is two.
    result = pack_cutlist([4, 4, 3, 3, 3, 3], 10)

    assert bin_values(result) == [([4.0, 3.0, 3.0], 0.0),
                                  ([4.0, 3.0, 3.0], 0.0)]


def test_exact_cutlist_accounts_for_kerf_between_pieces_only():
    no_kerf = pack_cutlist([2, 2], 4, kerf=0)
    with_kerf = pack_cutlist([2, 2], 4, kerf=0.01)

    assert bin_values(no_kerf) == [([2.0, 2.0], 0.0)]
    assert bin_values(with_kerf) == [([2.0], 2.0), ([2.0], 2.0)]


def test_exact_cutlist_is_value_canonical_across_input_order():
    expected = bin_values(pack_cutlist([4, 4, 3, 3, 3, 3], 10))

    for shuffled in (
        [3, 4, 3, 4, 3, 3],
        [3, 3, 3, 3, 4, 4],
        [4, 3, 3, 4, 3, 3],
    ):
        assert bin_values(pack_cutlist(shuffled, 10)) == expected


def test_exact_cutlist_refuses_work_above_documented_bound():
    with pytest.raises(ExactCutLimitExceeded, match="at most 18 pieces"):
        pack_cutlist([1] * (MAX_EXACT_CUTLIST_PIECES + 1), 10)


def test_cutlist_empty_and_sourcing_failure_are_explicit():
    assert pack_cutlist([], 6) == []
    with pytest.raises(CannotSource, match="exceeds stock length"):
        pack_cutlist([6.1], 6)


@pytest.mark.parametrize(
    ("pieces", "stock", "kerf"),
    [
        ([0], 6, 0),
        ([-1], 6, 0),
        ([math.nan], 6, 0),
        ([math.inf], 6, 0),
        ([1], 0, 0),
        ([1], -6, 0),
        ([1], math.inf, 0),
        ([1], 6, -0.1),
        ([1], 6, math.nan),
    ],
)
def test_cutlist_rejects_invalid_dimensions(pieces, stock, kerf):
    with pytest.raises(ValueError):
        pack_cutlist(pieces, stock, kerf=kerf)


def test_bom_quantity_remains_distinct_from_pack_rounded_purchase_quantity():
    measured = Quantity(
        id="q-posts", trade="fencing", item="posts", qty=3, unit="ea",
        formula="three evidenced post sites", tier="single-source",
        evidence=["run-1"],
    )
    result = convert_uniform(
        2.4,
        int(measured.qty),
        StockProfile("post", preferred=(2.4,), pack_size=4),
    )

    assert measured.qty == 3
    assert measured.order_qty is None
    assert result.order_qty == 4
    assert result.reusable_remnant_m == 0
    assert result.kerf_loss_m == 0
    assert result.pack_spare_m == 2.4
    assert result.total_offcut_m == 2.4
    assert result.purchase[0].offcut_m == 0


def test_uniform_partial_last_stock_reports_aggregate_remnant():
    result = convert_uniform(
        2.4,
        3,
        StockProfile("rail", preferred=(4.8,)),
    )

    assert result.order_qty == 2
    assert result.pieces_per_length == 2
    assert result.reusable_remnant_m == 2.4
    assert result.kerf_loss_m == 0
    assert result.pack_spare_m == 0
    assert result.total_offcut_m == 2.4
    assert result.purchase[0].offcut_m == 2.4


def test_uniform_reports_kerf_and_reusable_remnant_without_conflating_them():
    result = convert_uniform(
        1.9,
        3,
        StockProfile("rail", preferred=(4.0,), kerf_m=0.01),
    )

    assert result.order_qty == 2
    assert result.kerf_loss_m == 0.01
    assert result.reusable_remnant_m == pytest.approx(2.29)
    assert result.total_offcut_m == pytest.approx(2.30)
    assert result.purchase[0].offcut_m == pytest.approx(2.29)


def test_uniform_stock_choice_includes_pack_rounding_in_waste_objective():
    result = convert_uniform(
        2.0,
        3,
        StockProfile("member", preferred=(3.0, 4.0), pack_size=2),
    )

    # 2 x 4 m is ordered exactly as one pack and wastes 2 m. Four 3 m pieces
    # would waste 6 m after rounding two required pieces up to a two-piece pack.
    assert result.stock_length_m == 4.0
    assert result.order_qty == 2
    assert result.total_offcut_m == 2.0


def test_linear_conversion_is_explicitly_a_sum_based_estimate():
    result = convert_linear(
        10,
        StockProfile("rail", preferred=(6.0, 4.0)),
    )

    # This API deliberately does not claim a mixed 6+4 cut plan from only a sum.
    assert result.order_qty == 2
    assert result.stock_length_m == 6.0
    assert result.total_offcut_m == 2.0
    assert result.method == "linear-sum-estimate-from-6m"
    assert "sum-based estimate" in result.notes


def test_linear_pack_rounding_keeps_remnant_and_spares_distinct():
    result = convert_linear(
        7,
        StockProfile("rail", preferred=(4.0,), pack_size=4),
    )

    assert result.order_qty == 4
    assert result.reusable_remnant_m == 1.0
    assert result.pack_spare_m == 8.0
    assert result.total_offcut_m == 9.0
    assert result.purchase[0].offcut_m == 1.0


def test_linear_stock_choice_includes_pack_rounding_in_estimated_waste():
    result = convert_linear(
        7,
        StockProfile("rail", preferred=(4.0, 3.0), pack_size=3),
    )

    # Before pack rounding, two 4 m lengths look best (1 m remainder). Ordering
    # in threes makes 3 x 3 m the lower-waste purchase: 9 m rather than 12 m.
    assert result.stock_length_m == 3.0
    assert result.order_qty == 3
    assert result.total_offcut_m == 2.0


def test_no_sourceable_stock_fails_closed():
    empty = StockProfile("member", preferred=())
    unavailable = StockProfile("member", preferred=(6.0,), available=(2.0,))

    with pytest.raises(CannotSource, match="no stocked length"):
        convert_linear(1, empty)
    with pytest.raises(CannotSource, match="no stocked length yields"):
        convert_uniform(3, 1, unavailable)


@pytest.mark.parametrize("pack_size", [0, -1, 1.5, True])
def test_profile_requires_positive_integer_pack_size(pack_size):
    with pytest.raises(ValueError, match="pack_size"):
        convert_uniform(2, 1, StockProfile("member", preferred=(2,), pack_size=pack_size))


@pytest.mark.parametrize("stock", [0, -1, math.nan, math.inf])
def test_profile_rejects_invalid_stock_lengths(stock):
    with pytest.raises(ValueError, match="stock lengths|stock length"):
        convert_linear(1, StockProfile("member", preferred=(stock,)))


def test_named_allowances_do_not_mutate_the_measured_requirement():
    measured_quantity = 10
    adjusted, records = apply_allowances(
        measured_quantity,
        [Allowance("breakage", 1.05, "approved company rule")],
    )

    assert measured_quantity == 10
    assert adjusted == 10.5
    assert records == [{
        "name": "breakage",
        "factor": 1.05,
        "source": "approved company rule",
        "from": 10.0,
        "to": 10.5,
    }]


@pytest.mark.parametrize(
    "allowance",
    [
        Allowance("", 1.05, "source"),
        Allowance("breakage", 1.05, ""),
        Allowance("breakage", 0.95, "source"),
        Allowance("breakage", math.nan, "source"),
    ],
)
def test_allowances_require_name_source_and_nonreducing_finite_factor(allowance):
    with pytest.raises(ValueError):
        apply_allowances(10, [allowance])


def test_order_result_serialization_preserves_purchase_breakdown():
    result = convert_uniform(
        2.4,
        3,
        StockProfile("post", preferred=(2.4,), pack_size=4),
    ).as_dict()

    assert result["order_qty"] == 4
    assert result["reusable_remnant_m"] == 0
    assert result["kerf_loss_m"] == 0
    assert result["pack_spare_m"] == 2.4
    assert result["purchase"] == [{
        "stock_length_m": 2.4,
        "count": 4,
        "offcut_m": 0.0,
    }]
