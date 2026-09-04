"""orders.py — deterministic order/cut conversion (measured qty -> orderable stock).

WHY this exists
---------------
A takeoff says "87.7 lm of framing" or "33 studs". A builder orders *pieces of
real stock lengths*. This module keeps the measured requirement separate from
the whole-stock purchase conversion and records each source and allowance.

WHAT this is
------------
A pure, deterministic converter that turns a required quantity into `order_qty`
+ `purchase[{stock_length_m, count, offcut_m}]` — the fields already on Quantity.
Uniform pieces choose the sourceable stock length with the least purchased waste.
Mixed cut lists use an exact bounded bin-packing search. Sum-only linear conversion
remains explicitly an estimate because a total length is not a member cut list.
Nothing here is probabilistic: the same value multiset produces the same output.

HOW it stays honest
-------------------
The measured quantity is evidence and never changes. This layer only INTERPRETS
it for purchasing, and every step is auditable: the chosen method, reusable
remnant, kerf, unopened pack spares, and each named allowance with its source
travel in the result. No magic numbers — a waste factor is a named `Allowance`
with a `source`, not an opaque percentage.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass


# Exact bin packing is exponential. Refuse larger problems instead of silently
# falling back to a heuristic and mislabelling it optimal. Callers must split a
# large schedule into independently sourceable batches or use a reviewed solver.
MAX_EXACT_CUTLIST_PIECES = 18
FLOAT_EPSILON = 1e-9


@dataclass(frozen=True)
class Allowance:
    """A named, sourced multiplicative factor (1.05 = +5%). Modelled separately
    (not bundled into one opaque waste %) so a reviewer sees exactly why."""
    name: str
    factor: float
    source: str


@dataclass(frozen=True)
class StockProfile:
    """How a material is bought. Lengths in metres.

    preferred: ordinary source candidates (e.g. [2.7, 3.0]).
    fallback:  additional source candidates when preferred sizes are unavailable.
    available: which lengths are actually purchasable now; None = all of
               preferred+fallback are available.
    kerf_m:    saw kerf consumed per cut between pieces.
    pack_size: order in multiples of this many pieces (bundles); 1 = singles.
    kg_per_m:  mass per metre for weight rollup; None = weight not computed.
    """
    name: str
    preferred: tuple[float, ...]
    fallback: tuple[float, ...] = ()
    available: tuple[float, ...] | None = None
    kerf_m: float = 0.0
    pack_size: int = 1
    kg_per_m: float | None = None

    def sourceable(self) -> set[float]:
        if self.available is not None:
            return set(self.available)
        return set(self.preferred) | set(self.fallback)


@dataclass
class Purchase:
    """One aggregated buy line for one stock length.

    `offcut_m` is the total reusable remnant from stock that is actually cut. It
    excludes kerf and unopened pieces added only by pack rounding; those are
    reported separately on OrderResult.
    """
    stock_length_m: float
    count: int
    offcut_m: float


@dataclass
class OrderResult:
    order_qty: int                       # stock pieces to buy (== sum of purchase counts)
    stock_length_m: float                # chosen stock length
    pieces_per_length: int               # required pieces cut from one stock length
    total_offcut_m: float                # legacy total: purchased length - product length
    yield_pct: float                     # used / purchased length, 0..100
    method: str                          # exact-stock | cut-from-* | linear-sum-estimate-*
    purchase: list[Purchase]
    delivered_weight_kg: float | None = None
    notes: str = ""
    reusable_remnant_m: float = 0.0
    kerf_loss_m: float = 0.0
    pack_spare_m: float = 0.0

    def as_dict(self) -> dict:
        """Shape that drops straight into Quantity.purchase / order_qty."""
        return {
            "order_qty": self.order_qty,
            "purchase": [
                {"stock_length_m": p.stock_length_m, "count": p.count,
                 "offcut_m": round(p.offcut_m, 4)} for p in self.purchase],
            "total_offcut_m": round(self.total_offcut_m, 4),
            "yield_pct": round(self.yield_pct, 1),
            "method": self.method,
            "delivered_weight_kg": (round(self.delivered_weight_kg, 2)
                                    if self.delivered_weight_kg is not None else None),
            "notes": self.notes,
            "reusable_remnant_m": round(self.reusable_remnant_m, 4),
            "kerf_loss_m": round(self.kerf_loss_m, 4),
            "pack_spare_m": round(self.pack_spare_m, 4),
        }


class CannotSource(Exception):
    """No stocked length can yield even one of the required pieces -> needs-human."""


class ExactCutLimitExceeded(CannotSource):
    """The exact mixed-cut problem exceeds the deliberately bounded search."""


def _finite(value: float, name: str) -> float:
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"{name} must be finite")
    return value


def _validate_profile(profile: StockProfile) -> list[float]:
    if not isinstance(profile.pack_size, int) or isinstance(profile.pack_size, bool) or profile.pack_size < 1:
        raise ValueError("pack_size must be a positive integer")
    kerf = _finite(profile.kerf_m, "kerf_m")
    if kerf < 0:
        raise ValueError("kerf_m cannot be negative")
    if profile.kg_per_m is not None and _finite(profile.kg_per_m, "kg_per_m") < 0:
        raise ValueError("kg_per_m cannot be negative")
    available = sorted({_finite(value, "stock length") for value in profile.sourceable()})
    if any(value <= 0 for value in available):
        raise ValueError("stock lengths must be greater than zero")
    if not available:
        raise CannotSource("no stocked length configured")
    return available


def apply_allowances(base_qty: float, allowances: list[Allowance]) -> tuple[float, list[dict]]:
    """Multiply base by each named factor in order. Returns (adjusted, records).
    Records are audit rows — every factor keeps its name and source."""
    adjusted = _finite(base_qty, "base_qty")
    if adjusted < 0:
        raise ValueError("base_qty cannot be negative")
    records: list[dict] = []
    for a in allowances:
        if not a.name.strip():
            raise ValueError("allowance name cannot be empty")
        if not a.source.strip():
            raise ValueError(f"allowance {a.name!r} requires a source")
        factor = _finite(a.factor, f"allowance {a.name!r} factor")
        if factor < 1:
            raise ValueError(
                f"allowance {a.name!r} factor must be at least 1; "
                "represent reductions separately")
        before = adjusted
        adjusted *= factor
        records.append({"name": a.name, "factor": factor, "source": a.source,
                        "from": round(before, 4), "to": round(adjusted, 4)})
    return adjusted, records


def _pieces_per_length(stock: float, cut: float, kerf: float) -> int:
    """Max whole pieces of `cut` from one `stock` length, accounting for kerf.
    n pieces need n*cut + (n-1)*kerf <= stock (kerf sits BETWEEN pieces)."""
    if cut <= 0 or stock < cut:
        return 0
    # solve largest n: n*cut + (n-1)*kerf <= stock
    n = int((stock + kerf) / (cut + kerf) + 1e-9)
    return max(n, 0)


def _round_to_pack(qty: int, pack: int) -> int:
    if not isinstance(pack, int) or isinstance(pack, bool) or pack < 1:
        raise ValueError("pack size must be a positive integer")
    if pack == 1:
        return qty
    return math.ceil(qty / pack) * pack


def convert_uniform(cut_len_m: float, count: int, profile: StockProfile) -> OrderResult:
    """Convert N identical fixed-length pieces (e.g. studs) into a buy plan.

    1. If the piece length is itself a stocked length -> buy `count` of it (0 drop).
    2. Else choose the sourceable length with the least total purchased waste
       after pack rounding (tie: fewer stock pieces, then longer stock).
    Raises CannotSource if nothing stocked can yield even one piece.
    """
    cut_len_m = _finite(cut_len_m, "cut_len_m")
    if cut_len_m <= 0:
        raise ValueError("cut_len_m must be greater than zero")
    if not isinstance(count, int) or isinstance(count, bool) or count < 0:
        raise ValueError("count must be a non-negative integer")
    avail = _validate_profile(profile)
    if count == 0:
        return OrderResult(0, cut_len_m, 0, 0.0, 100.0, "none", [], notes="zero required")
    kerf = profile.kerf_m

    # 1) exact stock length available
    if any(abs(s - cut_len_m) < FLOAT_EPSILON for s in avail):
        order = _round_to_pack(count, profile.pack_size)
        wpk = (order * cut_len_m * profile.kg_per_m
               if profile.kg_per_m is not None else None)
        spare = order - count
        pack_spare = spare * cut_len_m
        total_unused = pack_spare
        return OrderResult(
            order_qty=order, stock_length_m=cut_len_m, pieces_per_length=1,
            total_offcut_m=total_unused,
            yield_pct=round(100.0 * (count * cut_len_m) / (order * cut_len_m), 1),
            method="exact-stock",
            purchase=[Purchase(cut_len_m, order, 0.0)],
            delivered_weight_kg=wpk,
            notes=(f"bought at exact {cut_len_m:g} m length"
                   + (f"; {spare} unopened spare from pack rounding" if spare else "")),
            reusable_remnant_m=0.0,
            kerf_loss_m=0.0,
            pack_spare_m=pack_spare)

    # 2) cut from a longer stocked length; pick the min-waste option
    candidates = [s for s in avail if s >= cut_len_m - FLOAT_EPSILON]
    best = None
    for stock in candidates:
        per = _pieces_per_length(stock, cut_len_m, kerf)
        if per < 1:
            continue
        lengths = math.ceil(count / per)
        order = _round_to_pack(lengths, profile.pack_size)
        total_unused = order * stock - count * cut_len_m
        key = (round(total_unused, 9), order, -stock)
        if best is None or key < best[0]:
            best = (key, stock, lengths, order, per)
    if best is None:
        raise CannotSource(
            f"no stocked length yields a {cut_len_m:g} m piece "
            f"(stocked: {sorted(avail)})")

    _, stock, lengths, order, per = best
    full_bins, last_count = divmod(count, per)
    used_bin_piece_counts = [per] * full_bins + ([last_count] if last_count else [])
    kerf_loss = sum(max(0, pieces - 1) * kerf for pieces in used_bin_piece_counts)
    reusable_remnant = lengths * stock - count * cut_len_m - kerf_loss
    pack_spare = (order - lengths) * stock
    total_unused = reusable_remnant + kerf_loss + pack_spare
    wpk = (order * stock * profile.kg_per_m
           if profile.kg_per_m is not None else None)
    return OrderResult(
        order_qty=order, stock_length_m=stock, pieces_per_length=per,
        total_offcut_m=round(total_unused, 4),
        yield_pct=round(100.0 * (count * cut_len_m) / (order * stock), 1),
        method=f"cut-from-{stock:g}m",
        purchase=[Purchase(stock, order, round(reusable_remnant, 4))],
        delivered_weight_kg=wpk,
        notes=(f"{cut_len_m:g} m not stocked -> up to {per} per {stock:g} m length; "
               f"{reusable_remnant:g} m reusable remnant, {kerf_loss:g} m kerf"
               + (f", {order - lengths} unopened pack spare(s)" if order != lengths else "")),
        reusable_remnant_m=round(reusable_remnant, 4),
        kerf_loss_m=round(kerf_loss, 4),
        pack_spare_m=round(pack_spare, 4))


@dataclass
class CutBin:
    """One stock length and the mixed pieces cut from it (a real cut list)."""
    stock_length_m: float
    pieces: list[float]
    offcut_m: float


def _canonical_bins(piece_bins: list[list[float]], stock_len: float,
                    kerf: float) -> list[CutBin]:
    """Return value-canonical bins, independent of input-list ordering."""
    normalized = [sorted(pieces, reverse=True) for pieces in piece_bins]
    normalized.sort(key=lambda pieces: tuple(-piece for piece in pieces))
    return [CutBin(
        stock_length_m=stock_len,
        pieces=pieces,
        offcut_m=round(
            stock_len - sum(pieces) - max(0, len(pieces) - 1) * kerf, 4),
    ) for pieces in normalized]


def _first_fit_incumbent(pieces: list[float], stock_len: float,
                         kerf: float) -> list[list[float]]:
    """Deterministic upper bound only; never exposed or claimed as optimal."""
    bins: list[list[float]] = []
    for piece in pieces:
        for placed in bins:
            used = sum(placed) + max(0, len(placed) - 1) * kerf
            if used + kerf + piece <= stock_len + FLOAT_EPSILON:
                placed.append(piece)
                break
        else:
            bins.append([piece])
    return bins


def pack_cutlist(cut_lengths: list[float], stock_len: float,
                 kerf: float = 0.0) -> list[CutBin]:
    """Exactly pack a bounded mixed cut list into identical stock lengths.

    Objective order is: (1) fewest stock lengths, then (2) least aggregate
    reusable remnant, then (3) deterministic value-canonical output. With one
    stock length, objectives 1 and 2 are aligned: for a fixed bin count, total
    remnant and kerf are fixed. Descending first-fit supplies only an upper
    bound; branch-and-bound proves that no smaller solution exists.

    Exact bin packing is exponential, so inputs above
    `MAX_EXACT_CUTLIST_PIECES` are rejected. There is no silent heuristic
    fallback. Input order is not a tie-break: equal value multisets return
    identical bins even when shuffled.
    """
    stock_len = _finite(stock_len, "stock_len")
    kerf = _finite(kerf, "kerf")
    if stock_len <= 0:
        raise ValueError("stock_len must be greater than zero")
    if kerf < 0:
        raise ValueError("kerf cannot be negative")
    if len(cut_lengths) > MAX_EXACT_CUTLIST_PIECES:
        raise ExactCutLimitExceeded(
            f"exact cut list supports at most {MAX_EXACT_CUTLIST_PIECES} pieces; "
            f"received {len(cut_lengths)}")

    pieces = sorted(
        (_finite(piece, f"cut_lengths[{index}]")
         for index, piece in enumerate(cut_lengths)),
        reverse=True)
    if any(piece <= 0 for piece in pieces):
        raise ValueError("cut lengths must be greater than zero")
    if pieces and pieces[0] > stock_len + FLOAT_EPSILON:
        raise CannotSource(
            f"piece {pieces[0]:g} m exceeds stock length {stock_len:g} m")
    if not pieces:
        return []

    # n pieces with inter-piece kerfs fit iff sum(piece + kerf) <= stock + kerf.
    capacity = stock_len + kerf
    effective = [piece + kerf for piece in pieces]
    incumbent = _first_fit_incumbent(pieces, stock_len, kerf)
    best: list[list[float]] = [list(group) for group in incumbent]
    best_count = len(best)
    bins: list[dict] = []

    suffix_total = [0.0] * (len(effective) + 1)
    for index in range(len(effective) - 1, -1, -1):
        suffix_total[index] = suffix_total[index + 1] + effective[index]

    def search(index: int) -> None:
        nonlocal best, best_count
        if index == len(pieces):
            if len(bins) < best_count:
                best = [list(entry["pieces"]) for entry in bins]
                best_count = len(bins)
            return

        free = sum(entry["remaining"] for entry in bins)
        uncovered = max(0.0, suffix_total[index] - free)
        additional_lower_bound = math.ceil(uncovered / capacity - FLOAT_EPSILON)
        if len(bins) + additional_lower_bound > best_count:
            return

        item = effective[index]
        piece = pieces[index]
        candidates = sorted(
            (entry["remaining"] - item, bin_index)
            for bin_index, entry in enumerate(bins)
            if entry["remaining"] + FLOAT_EPSILON >= item)
        seen_remaining = set()
        for _, bin_index in candidates:
            entry = bins[bin_index]
            # Only bit-identical capacities are symmetric. Rounding here could
            # prune the sole feasible branch for near-boundary decimal cuts.
            symmetry_key = float(entry["remaining"]).hex()
            if symmetry_key in seen_remaining:
                continue
            seen_remaining.add(symmetry_key)
            entry["remaining"] -= item
            entry["pieces"].append(piece)
            search(index + 1)
            entry["pieces"].pop()
            entry["remaining"] += item

        if len(bins) + 1 <= best_count:
            bins.append({"remaining": capacity - item, "pieces": [piece]})
            search(index + 1)
            bins.pop()

    search(0)
    return _canonical_bins(best, stock_len, kerf)


def kg_per_m_from_designation(name: str) -> float | None:
    """AS/NZS steel sections encode mass/m in the name: 310UB40.4 -> 40.4,
    200UC59.5 -> 59.5. Returns the trailing mass, or None if not encoded."""
    m = re.search(r"(?:UB|UC|PFC|TFB|UBP|RSJ)\s*(\d+(?:\.\d+)?)\s*$", name, re.I)
    return float(m.group(1)) if m else None


def weight_kg(length_m: float, kg_per_m: float) -> float:
    """Deterministic member/stock weight for logistics and cranage totals."""
    return length_m * kg_per_m


def convert_linear(total_m: float, profile: StockProfile) -> OrderResult:
    """Cover a linear run of `total_m` with whole stock lengths.

    HONEST LIMITATION: from a *sum* of lengths this is an estimate — order
    `ceil(total / stock)` lengths and note it. The exact cut-optimal answer
    needs the individual member lengths (a cut list); feed those to
    `pack_cutlist` instead. For a linear run we prefer the length that
    minimises total drop (tie: longer stock -> fewer joins).
    """
    total_m = _finite(total_m, "total_m")
    if total_m < 0:
        raise ValueError("total_m cannot be negative")
    avail = _validate_profile(profile)
    if total_m == 0:
        return OrderResult(0, 0.0, 0, 0.0, 100.0, "none", [], notes="zero required")
    best = None
    for stock in avail:
        lengths = math.ceil(total_m / stock - 1e-9)
        order = _round_to_pack(lengths, profile.pack_size)
        total_unused = order * stock - total_m
        key = (round(total_unused, 9), order, -stock)
        if best is None or key < best[0]:
            best = (key, stock, lengths, order)
    if best is None:
        raise CannotSource("no stocked length configured")
    _, stock, lengths, order = best
    reusable_remnant = lengths * stock - total_m
    pack_spare = (order - lengths) * stock
    total_unused = reusable_remnant + pack_spare
    wpk = (order * stock * profile.kg_per_m
           if profile.kg_per_m is not None else None)
    return OrderResult(
        order_qty=order, stock_length_m=stock, pieces_per_length=0,
        total_offcut_m=round(total_unused, 4),
        yield_pct=round(100.0 * total_m / (order * stock), 1),
        method=f"linear-sum-estimate-from-{stock:g}m",
        purchase=[Purchase(stock, order, round(reusable_remnant, 4))],
        delivered_weight_kg=wpk,
        notes=(f"{order} x {stock:g} m covers {total_m:g} m run (sum-based "
               f"estimate; exact cut needs a member cut list)"
               + (f"; {order - lengths} unopened pack spare(s)" if order != lengths else "")),
        reusable_remnant_m=round(reusable_remnant, 4),
        kerf_loss_m=0.0,
        pack_spare_m=round(pack_spare, 4))


# Note: the *application* layer that maps a takeoff quantity -> a buy plan lives
# in xray.hardening (the config/wiring pass). This module is the single pure
# conversion kernel it calls.
