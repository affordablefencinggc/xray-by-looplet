"""Deterministic fencing job-to-BOM rules kernel for ``xray.job-to-bom/v1``.

The browser compiler owns evidence and review readiness.  This module is an
independent, pure rules implementation: it accepts only the frozen JSON value,
reads no ambient state, and emits an ``xray.bom/v1`` value.  It deliberately
does not calculate prices or stock orders.
"""

from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from datetime import datetime
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP, localcontext
from hashlib import sha256
import json
import re
from typing import Any, Mapping


JOB_SCHEMA = "xray.job-to-bom/v1"
BOM_SCHEMA = "xray.bom/v1"
RULESET = "fencing-v1"
PI = Decimal("3.141592653589793")

_ROOT_KEYS = {
    "schema", "requestId", "inputDigest", "job", "document",
    "verifiedAssets", "calibrations", "runs", "gates", "evidence",
    "recipeSet",
}
_RUN_KEYS = {
    "id", "revision", "sheet", "label", "recipeId", "segments", "vertices",
    "storedLengths", "specification", "photoIds", "approval",
}
_SPEC_KEYS = {
    "system", "customSystem", "profile", "heightMm", "bayWidthMm", "ground",
    "slope", "removalRequired", "removalMaterial", "removalLengthMm",
    "disposalRequired", "access", "sleepers", "retainingRequired",
    "retainingType", "retainingHeightMm", "retainingCondition", "notes",
}
_GATE_KEYS = {
    "id", "revision", "sheet", "label", "runId", "segmentIndex",
    "centreOffsetMm", "widthMm", "heightMm", "type", "customType",
    "openingDirection", "hingeSide", "hardware", "latch", "postSize",
    "finish", "clearanceMm", "motorised", "hardwareModelId", "leafCount",
    "boundaryPostCount", "hingeSetCount", "latchCount", "dropBoltCount",
    "photoIds", "approval",
}
_RECIPE_KEYS = {
    "id", "revision", "system", "profile", "maxBayWidthMm", "postSpacingMm",
    "materialModel", "footings", "allowances", "gateHardwareModels",
    "supportedSlopes", "supportedGround", "supportedGateTypes",
    "supportedRetainingTypes", "supportsSleepers", "assumptions", "components",
}
_COMPONENT_KEYS = {
    "id", "itemCode", "description", "unit", "basis", "factor", "assumptionIds",
}
_ASSUMPTION_KEYS = {
    "id", "key", "label", "value", "unit", "source", "effectiveAt", "status",
    "acceptedBy", "acceptedAt",
}
_FOOTING_KEYS = {"postRole", "diameterMm", "depthMm", "assumptionIds"}
_ALLOWANCE_KEYS = {
    "id", "componentIds", "percent", "roundingIncrement", "roundingUnit",
    "source", "effectiveAt", "status", "acceptedBy", "acceptedAt", "assumptionIds",
}
_HARDWARE_MODEL_KEYS = {
    "id", "gateType", "widthMm", "leafCount", "boundaryPostCount",
    "hingeSetCount", "latchCount", "dropBoltCount", "assumptionIds",
}
_MATERIAL_KEYS = {
    "colorbond": {"kind", "effectiveSheetCoverMm", "railRows", "gateBoundaryPostRole", "assumptionIds"},
    "timber-paling": {"kind", "palingCoverMm", "railRows", "gateBoundaryPostRole", "assumptionIds"},
    "chain-wire": {"kind", "meshHeightMm", "meshRollLengthMm", "meshRollReusePolicy", "topRailRows", "braceEveryIncidentStrainerEnd", "gateBoundaryPostRole", "assumptionIds"},
    "explicit": {"kind", "system", "ruleKey", "gateBoundaryPostRole", "assumptionIds"},
}
_BASES = {
    "per-ordinary-post", "per-end-post", "per-corner-post", "per-junction-post",
    "per-strainer-post", "per-bay", "per-gate-post",
    "per-incident-strainer-end", "per-infill-sheet", "per-paling", "rail-cuts",
    "rail-lm", "mesh-lm", "mesh-m2", "per-gate-opening", "per-gate-leaf",
    "per-hinge-set", "per-latch", "per-drop-bolt", "concrete-m3",
    "per-removal-lm", "per-retaining-lm",
}
_UNITS = {"ea", "lm", "m2", "m3", "kg", "t", "L"}
_SYSTEMS = {"colorbond", "timber-paling", "pool", "chain-wire", "custom"}
_SLOPES = {"level", "stepped", "raked", "mixed"}
_GROUNDS = {"soil", "concrete", "rock", "retaining-wall", "mixed"}
_GATE_TYPES = {"single", "double", "sliding", "pedestrian", "custom"}
_RETAINING_TYPES = {"none", "timber-sleeper", "concrete-sleeper", "masonry", "existing", "custom"}
_CANONICAL_DECIMAL = re.compile(r"^(?:0|[1-9]\d*)(?:\.\d*[1-9])?$")
_MAX_SAFE_INTEGER = 9_007_199_254_740_991
_ROLE_BASIS = {
    "ordinary": "per-ordinary-post", "end": "per-end-post",
    "corner": "per-corner-post", "junction": "per-junction-post",
    "strainer": "per-strainer-post", "gate": "per-gate-post",
}


class ContractError(ValueError):
    """A fail-closed contract or capability violation."""

    def __init__(self, code: str, message: str, entity_id: str | None = None,
                 path: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.entity_id = entity_id
        self.path = path


def canonical_input_json(request: Mapping[str, Any]) -> str:
    """Return the exact canonical JSON used by the TypeScript boundary."""
    value = deepcopy(dict(request))
    value.pop("requestId", None)
    value.pop("inputDigest", None)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def compute_input_digest(request: Mapping[str, Any]) -> str:
    return sha256(canonical_input_json(request).encode("utf-8")).hexdigest()


def build_bom(request: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and evaluate a frozen request, returning ``xray.bom/v1``."""
    candidate_id = request.get("requestId") if isinstance(request, Mapping) else None
    request_id = candidate_id if isinstance(candidate_id, str) and candidate_id else "invalid-request"
    digest = request.get("inputDigest") if isinstance(request, Mapping) else None
    try:
        _validate_request(request)
        if compute_input_digest(request) != request["inputDigest"]:
            raise ContractError("contract", "inputDigest does not match canonical request content.", None, "inputDigest")
        return _evaluate(request)
    except ContractError as error:
        return {
            "schema": BOM_SCHEMA,
            "ok": False,
            "requestId": request_id,
            "inputDigest": digest if _is_sha256(digest) else None,
            "issues": [_issue(error.code, str(error), error.entity_id, error.path)],
        }
    except (KeyError, TypeError, ValueError, ArithmeticError) as error:
        return {
            "schema": BOM_SCHEMA,
            "ok": False,
            "requestId": request_id,
            "inputDigest": digest if _is_sha256(digest) else None,
            "issues": [_issue("contract", f"Invalid frozen BOM request: {error}", None, None)],
        }


def _evaluate(request: Mapping[str, Any]) -> dict[str, Any]:
    runs = sorted(request["runs"], key=lambda item: item["id"])
    gates = sorted(request["gates"], key=lambda item: item["id"])
    recipes = {item["id"]: item for item in request["recipeSet"]["recipes"]}
    gates_by_run: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for gate in gates:
        gates_by_run[gate["runId"]].append(gate)

    analyses: dict[str, dict[str, Any]] = {}
    for run in runs:
        recipe = recipes[run["recipeId"]]
        analyses[run["id"]] = _analyse_run(run, gates_by_run[run["id"]], recipe)

    _assign_topology_roles(runs, gates_by_run, recipes, analyses)

    lines: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    assumptions: list[dict[str, Any]] = []
    seen_assumptions: set[str] = set()
    for recipe in request["recipeSet"]["recipes"]:
        if any(run["recipeId"] == recipe["id"] for run in runs):
            for assumption in recipe["assumptions"]:
                if assumption["id"] not in seen_assumptions:
                    seen_assumptions.add(assumption["id"])
                    assumptions.append(deepcopy(assumption))

    for recipe in sorted(request["recipeSet"]["recipes"], key=lambda item: item["id"]):
        recipe_runs = [run for run in runs if run["recipeId"] == recipe["id"]]
        if not recipe_runs:
            continue
        recipe_gates = [gate for gate in gates if any(run["id"] == gate["runId"] for run in recipe_runs)]
        metrics = _recipe_metrics(recipe, recipe_runs, recipe_gates, analyses)
        for component in recipe["components"]:
            basis = component["basis"]
            raw = metrics.get(basis, Decimal(0))
            if raw == 0:
                continue
            quantity, operands = _component_quantity(component, raw, recipe, metrics)
            if quantity == 0:
                continue
            lines.append(_line(component, recipe, recipe_runs, recipe_gates, analyses, quantity, operands))

        model = recipe["materialModel"]
        if model["kind"] == "chain-wire":
            net_mm = sum(analyses[run["id"]]["net_mm"] for run in recipe_runs)
            warnings.append(_issue(
                "unsupported-configuration",
                f"Roll ordering remains a separate SC-07 order-kernel operation; this BOM records {_decimal(Decimal(net_mm) / 1000)} lm raw mesh and the explicit reuse policy only.",
                recipe_runs[0]["id"],
                "recipeSet.materialModel.meshRollReusePolicy",
            ))

    lines.sort(key=lambda item: item["id"])
    bom = {
        "jobId": request["job"]["id"],
        "jobRevision": request["job"]["revision"],
        "inputDigest": request["inputDigest"],
        "documentSha256": request["document"]["sha256"],
        "recipeSet": {
            "id": request["recipeSet"]["id"],
            "revision": request["recipeSet"]["revision"],
            "digest": request["recipeSet"]["digest"],
        },
        "ruleset": {"id": RULESET, "version": 1},
        "status": "review-ready",
        "lines": lines,
        "assumptions": assumptions,
        "blockers": [],
        "warnings": warnings,
        "summary": {"lineCount": len(lines), "needsHumanCount": 0, "blockerCount": 0},
    }
    return {"schema": BOM_SCHEMA, "ok": True, "requestId": request["requestId"], "bom": bom}


def _analyse_run(run: Mapping[str, Any], gates: list[Mapping[str, Any]],
                 recipe: Mapping[str, Any]) -> dict[str, Any]:
    by_segment: dict[int, list[Mapping[str, Any]]] = defaultdict(list)
    for gate in gates:
        by_segment[gate["segmentIndex"]].append(gate)
    limit = min(run["specification"]["bayWidthMm"], recipe["postSpacingMm"])
    residuals: list[dict[str, Any]] = []
    sites: dict[tuple[Any, ...], set[str]] = defaultdict(set)
    net2 = 0
    for segment in run["segments"]:
        index, length = segment["index"], segment["lengthMm"]
        intervals: list[tuple[int, int, Mapping[str, Any]]] = []
        for gate in by_segment[index]:
            start2 = gate["centreOffsetMm"] * 2 - gate["widthMm"]
            end2 = gate["centreOffsetMm"] * 2 + gate["widthMm"]
            if start2 < 0 or end2 > length * 2:
                raise ContractError("gate-placement", f"{gate['label']} must fit wholly inside segment {index}.", gate["id"], "gates.widthMm")
            intervals.append((start2, end2, gate))
        intervals.sort(key=lambda item: (item[0], item[2]["id"]))
        for previous, current in zip(intervals, intervals[1:]):
            if current[0] < previous[1]:
                raise ContractError("gate-overlap", f"Gate openings overlap on {run['id']} segment {index}.", current[2]["id"], "gates")
        cursor2 = 0
        for start2, end2, gate in intervals:
            if start2 > cursor2:
                _add_residual(run, index, cursor2, start2, limit, residuals, sites)
                net2 += start2 - cursor2
            sites[_site_key(run, index, start2)].add("gate")
            sites[_site_key(run, index, end2)].add("gate")
            cursor2 = end2
        if cursor2 < length * 2:
            _add_residual(run, index, cursor2, length * 2, limit, residuals, sites)
            net2 += length * 2 - cursor2
        if not intervals:
            sites[_site_key(run, index, 0)].add("boundary")
            sites[_site_key(run, index, length * 2)].add("boundary")
    gross = sum(item["lengthMm"] for item in run["segments"])
    gate_mm = sum(gate["widthMm"] for gate in gates)
    if net2 % 2:
        raise ContractError("contract", "Integer gate widths must leave an integer total net length.", run["id"], "runs.storedLengths.netMm")
    net_mm = net2 // 2
    if (gross, gate_mm, net_mm) != (
        run["storedLengths"]["grossMm"], run["storedLengths"]["gateDeductionMm"], run["storedLengths"]["netMm"]
    ):
        raise ContractError("length-mismatch", f"{run['label']} stored lengths do not reconcile.", run["id"], "runs.storedLengths")
    return {"residuals": residuals, "sites": sites, "siteRoles": {}, "net_mm": net_mm, "gross_mm": gross, "roles": defaultdict(int)}


def _add_residual(run: Mapping[str, Any], segment: int, start2: int, end2: int,
                  limit: int, residuals: list[dict[str, Any]],
                  sites: dict[tuple[Any, ...], set[str]]) -> None:
    span2 = end2 - start2
    if span2 <= 0:
        return
    bays = (span2 + (limit * 2) - 1) // (limit * 2)
    if span2 % 2 == 0:
        # Match the frozen TypeScript rule for whole-millimetre residuals:
        # distribute whole millimetres first, with the remainder assigned to
        # the earliest bays. Half-millimetre units are reserved for residuals
        # created by odd-width gate boundaries.
        span_mm = span2 // 2
        quotient_mm, remainder_mm = divmod(span_mm, bays)
        lengths2 = [2 * (quotient_mm + (1 if index < remainder_mm else 0)) for index in range(bays)]
    else:
        quotient2, remainder2 = divmod(span2, bays)
        lengths2 = [quotient2 + (1 if index < remainder2 else 0) for index in range(bays)]
    lengths = [Decimal(length2) / 2 for length2 in lengths2]
    residuals.append({"segment": segment, "start2": start2, "end2": end2, "spanMm": Decimal(span2) / 2, "bayLengthsMm": lengths})
    sites[_site_key(run, segment, start2)].add("boundary")
    position2 = start2
    for length2 in lengths2[:-1]:
        position2 += length2
        sites[_site_key(run, segment, position2)].add("ordinary")
    sites[_site_key(run, segment, end2)].add("boundary")


def _site_key(run: Mapping[str, Any], segment: int, position2: int) -> tuple[Any, ...]:
    length2 = run["segments"][segment]["lengthMm"] * 2
    if position2 == 0:
        return ("node", run["vertices"][segment]["topologyNodeId"])
    if position2 == length2:
        return ("node", run["vertices"][segment + 1]["topologyNodeId"])
    return ("run", run["id"], segment, position2)


def _assign_topology_roles(runs: list[Mapping[str, Any]], gates_by_run: Mapping[str, list[Mapping[str, Any]]],
                           recipes: Mapping[str, Mapping[str, Any]], analyses: dict[str, dict[str, Any]]) -> None:
    degree: dict[str, int] = defaultdict(int)
    treatments: dict[str, set[str]] = defaultdict(set)
    neighbours: dict[str, list[tuple[Decimal, Decimal]]] = defaultdict(list)
    for run in runs:
        for segment in run["segments"]:
            index = segment["index"]
            left_id = run["vertices"][index]["topologyNodeId"]
            right_id = run["vertices"][index + 1]["topologyNodeId"]
            left = _topology_coordinate(left_id, run["id"])
            right = _topology_coordinate(right_id, run["id"])
            if left[0] != right[0] or left[0] != run["sheet"]:
                raise ContractError("contract", "A run cannot cross sheets inside its topology.", run["id"], "runs.vertices.topologyNodeId")
            vector = (right[1] - left[1], right[2] - left[2])
            if vector == (Decimal(0), Decimal(0)):
                raise ContractError("contract", "A positive segment requires distinct topology coordinates.", run["id"], "runs.vertices.topologyNodeId")
            degree[left_id] += 1
            degree[right_id] += 1
            neighbours[left_id].append(vector)
            neighbours[right_id].append((-vector[0], -vector[1]))
        for vertex in run["vertices"]:
            treatments[vertex["topologyNodeId"]].add(vertex["cornerTreatment"])
    global_sites: dict[tuple[Any, ...], dict[str, Any]] = {}
    for run in runs:
        for key, markers in analyses[run["id"]]["sites"].items():
            site = global_sites.setdefault(key, {"markers": set(), "runIds": [], "recipeIds": set()})
            site["markers"].update(markers)
            site["runIds"].append(run["id"])
            site["recipeIds"].add(run["recipeId"])
    run_by_id = {run["id"]: run for run in runs}
    for key, site in sorted(global_sites.items(), key=lambda item: repr(item[0])):
        if len(site["recipeIds"]) != 1:
            raise ContractError("unsupported-configuration", "One physical topology site cannot select post capabilities from multiple recipes.", None, "runs.vertices.topologyNodeId")
        owner_id = min(site["runIds"])
        run = run_by_id[owner_id]
        model = recipes[run["recipeId"]]["materialModel"]
        markers = site["markers"]
        if "gate" in markers:
            role = model["gateBoundaryPostRole"]
        elif key[0] == "node" and degree[key[1]] >= 3:
            role = "junction"
        elif key[0] == "node" and (
            treatments[key[1]] & {"boxed", "mitred", "custom"}
            or _physical_node_is_corner(neighbours[key[1]])
        ):
            role = "corner"
        elif key[0] == "node" and degree[key[1]] == 1:
            role = "strainer" if model["kind"] == "chain-wire" else "end"
        else:
            role = "ordinary"
        for run_id in site["runIds"]:
            analyses[run_id]["siteRoles"][key] = role
        analyses[owner_id]["roles"][role] += 1


def _physical_node_is_corner(vectors: list[tuple[Decimal, Decimal]]) -> bool:
    if len(vectors) != 2:
        return False
    left, right = vectors
    cross = left[0] * right[1] - left[1] * right[0]
    dot = left[0] * right[0] + left[1] * right[1]
    # Outward vectors at a straight-through node point in opposite directions.
    return cross != 0 or dot >= 0


_TOPOLOGY_NODE = re.compile(r"^sheet:(\d+):x:([^:]+):y:([^:]+)$")


def _topology_coordinate(node_id: str, run_id: str) -> tuple[int, Decimal, Decimal]:
    match = _TOPOLOGY_NODE.fullmatch(node_id)
    if match is None:
        raise ContractError("contract", "Standard internal vertices require canonical document-space topology coordinates.", run_id, "runs.vertices.topologyNodeId")
    try:
        x, y = Decimal(match.group(2)), Decimal(match.group(3))
        if not x.is_finite() or not y.is_finite():
            raise ContractError("contract", "Topology coordinates must be finite decimals.", run_id, "runs.vertices.topologyNodeId")
        return int(match.group(1)), x, y
    except ArithmeticError as error:
        raise ContractError("contract", "Topology coordinates must be finite decimals.", run_id, "runs.vertices.topologyNodeId") from error


def _recipe_metrics(recipe: Mapping[str, Any], runs: list[Mapping[str, Any]], gates: list[Mapping[str, Any]],
                    analyses: Mapping[str, Mapping[str, Any]]) -> dict[str, Decimal]:
    metrics: dict[str, Decimal] = defaultdict(Decimal)
    model = recipe["materialModel"]
    all_bays: list[Decimal] = []
    for run in runs:
        analysis = analyses[run["id"]]
        for role, count in analysis["roles"].items():
            metrics[_ROLE_BASIS[role]] += Decimal(count)
        for residual in analysis["residuals"]:
            all_bays.extend(residual["bayLengthsMm"])
            if model["kind"] == "chain-wire" and model["braceEveryIncidentStrainerEnd"]:
                start = _site_key(run, residual["segment"], residual["start2"])
                end = _site_key(run, residual["segment"], residual["end2"])
                metrics["per-incident-strainer-end"] += Decimal(
                    int(analysis["siteRoles"].get(start) == "strainer")
                    + int(analysis["siteRoles"].get(end) == "strainer")
                )
        if run["specification"]["removalRequired"]:
            length = run["specification"]["removalLengthMm"]
            if length is None:
                raise ContractError("unsupported-configuration", "Removal length is required when removal is selected.", run["id"], "runs.specification.removalLengthMm")
            metrics["per-removal-lm"] += Decimal(length) / 1000
        if run["specification"]["retainingRequired"]:
            metrics["per-retaining-lm"] += Decimal(analysis["net_mm"]) / 1000
    metrics["per-bay"] = Decimal(len(all_bays))
    net_mm = sum(analyses[run["id"]]["net_mm"] for run in runs)
    if model["kind"] == "colorbond":
        metrics["per-infill-sheet"] = Decimal(sum(_ceil_ratio(length, model["effectiveSheetCoverMm"]) for length in all_bays))
        metrics["rail-cuts"] = Decimal(len(all_bays) * model["railRows"])
        metrics["rail-lm"] = Decimal(net_mm) * Decimal(model["railRows"]) / 1000
    elif model["kind"] == "timber-paling":
        metrics["per-paling"] = Decimal(sum(_ceil_ratio(length, model["palingCoverMm"]) for length in all_bays))
        metrics["rail-cuts"] = Decimal(len(all_bays) * model["railRows"])
        metrics["rail-lm"] = Decimal(net_mm) * Decimal(model["railRows"]) / 1000
    elif model["kind"] == "chain-wire":
        metrics["mesh-lm"] = Decimal(net_mm) / 1000
        metrics["mesh-m2"] = Decimal(net_mm) * Decimal(model["meshHeightMm"]) / Decimal(1_000_000)
        metrics["rail-lm"] = Decimal(net_mm) * Decimal(model["topRailRows"]) / 1000
    elif model["kind"] == "explicit":
        raise ContractError("unsupported-configuration", f"Explicit material rule {model['ruleKey']} has no fencing-v1 kernel.", recipe["id"], "recipeSet.materialModel")
    metrics["per-gate-opening"] = Decimal(len(gates))
    metrics["per-gate-leaf"] = Decimal(sum(gate["leafCount"] for gate in gates))
    metrics["per-hinge-set"] = Decimal(sum(gate["hingeSetCount"] for gate in gates))
    metrics["per-latch"] = Decimal(sum(gate["latchCount"] for gate in gates))
    metrics["per-drop-bolt"] = Decimal(sum(gate["dropBoltCount"] for gate in gates))
    metrics["concrete-m3"] = _concrete(recipe, metrics)
    return metrics


def _concrete(recipe: Mapping[str, Any], metrics: Mapping[str, Decimal]) -> Decimal:
    with localcontext() as context:
        context.prec = 50
        total = Decimal(0)
        footing_roles = {footing["postRole"] for footing in recipe["footings"]}
        if any(component["basis"] == "concrete-m3" for component in recipe["components"]):
            missing = [role for role, basis in _ROLE_BASIS.items() if metrics.get(basis, Decimal(0)) and role not in footing_roles]
            if missing:
                raise ContractError("unsupported-configuration", f"Concrete component lacks footing rules for: {', '.join(sorted(missing))}.", recipe["id"], "recipeSet.footings")
        for footing in recipe["footings"]:
            count = metrics.get(_ROLE_BASIS[footing["postRole"]], Decimal(0))
            radius = Decimal(footing["diameterMm"]) / Decimal(2000)
            depth = Decimal(footing["depthMm"]) / Decimal(1000)
            total += count * PI * radius * radius * depth
        return total


def _component_quantity(component: Mapping[str, Any], raw: Decimal, recipe: Mapping[str, Any],
                        metrics: Mapping[str, Decimal]) -> tuple[Decimal, list[dict[str, Any]]]:
    with localcontext() as context:
        context.prec = 50
        value = raw * Decimal(component["factor"])
        operands: list[dict[str, Any]] = []
        applicable = [allowance for allowance in recipe["allowances"] if component["id"] in allowance["componentIds"]]
        if len(applicable) > 1:
            raise ContractError("unsupported-configuration", f"Component {component['id']} has multiple allowances with no declared ordering.", component["id"], "recipeSet.allowances")
        for allowance in applicable:
            if allowance["status"] != "accepted":
                raise ContractError("assumption", f"Allowance {allowance['id']} is unresolved.", recipe["id"], "recipeSet.allowances")
            raw_value = value
            display_raw = raw_value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
            multiplier = Decimal(1) + Decimal(allowance["percent"]) / 100
            value = raw_value * multiplier
            display_allowed = value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
            increment = Decimal(allowance["roundingIncrement"])
            value = (value / increment).to_integral_value(rounding=ROUND_CEILING) * increment
            component_assumption = component["assumptionIds"][0]
            allowance_assumption = allowance["assumptionIds"][0]
            operands = [
                _operand("raw-full-precision", raw_value, component["unit"], component_assumption),
                _operand("raw-display-round-half-up-6", display_raw, component["unit"], component_assumption),
                _operand("allowed-full-precision", raw_value * multiplier, component["unit"], allowance_assumption),
                _operand("allowed-display-round-half-up-6", display_allowed, component["unit"], allowance_assumption),
            ]
        return value, operands


def _line(component: Mapping[str, Any], recipe: Mapping[str, Any], runs: list[Mapping[str, Any]],
          gates: list[Mapping[str, Any]], analyses: Mapping[str, Mapping[str, Any]],
          quantity: Decimal, operands: list[dict[str, Any]]) -> dict[str, Any]:
    basis = component["basis"]
    value = _decimal(quantity)
    system_key = {"colorbond": "colorbond", "timber-paling": "timber", "chain-wire": "chain"}.get(recipe["system"], recipe["system"])
    evidence = _evidence(basis, recipe, runs, gates)
    line_id = _line_id(component)
    description = _description(component["description"], basis, quantity)
    expression, rule_id = _expression(basis, recipe, runs, gates, analyses, value)
    return {
        "id": line_id,
        "groupKey": f"{system_key}|{component['itemCode']}|{component['unit']}",
        "category": _category(basis),
        "itemCode": component["itemCode"],
        "description": description,
        "quantity": {"value": value, "unit": component["unit"]},
        "calculation": {
            "ruleId": rule_id, "ruleVersion": 1, "expression": expression,
            "operands": operands, "result": {"value": value, "unit": component["unit"]},
        },
        "confidenceTier": "single-source",
        "evidenceRefs": evidence,
        "assumptionRefs": _assumption_lineage(component, recipe, gates),
    }


def _assumption_lineage(component: Mapping[str, Any], recipe: Mapping[str, Any],
                        gates: list[Mapping[str, Any]]) -> list[str]:
    refs = list(component["assumptionIds"])
    basis = component["basis"]
    dependencies: list[list[str]] = []
    if basis in {"per-incident-strainer-end", "per-bay", "per-infill-sheet", "per-paling", "rail-cuts", "rail-lm", "mesh-lm", "mesh-m2"}:
        dependencies.append(list(recipe["materialModel"]["assumptionIds"]))
    if basis == "concrete-m3":
        dependencies.append([ref for footing in recipe["footings"] for ref in footing["assumptionIds"]])
    if basis in {"per-gate-post", "per-gate-opening", "per-gate-leaf", "per-hinge-set", "per-latch", "per-drop-bolt"}:
        used = {gate["hardwareModelId"] for gate in gates}
        dependencies.append([ref for model in recipe["gateHardwareModels"] if model["id"] in used for ref in model["assumptionIds"]])
    applicable = [allowance for allowance in recipe["allowances"] if component["id"] in allowance["componentIds"]]
    dependencies.extend(list(allowance["assumptionIds"]) for allowance in applicable)
    for dependency in dependencies:
        if not set(refs).intersection(dependency):
            refs.extend(sorted(set(dependency) - set(refs)))
    return refs


def _expression(basis: str, recipe: Mapping[str, Any], runs: list[Mapping[str, Any]], gates: list[Mapping[str, Any]],
                analyses: Mapping[str, Mapping[str, Any]], value: str) -> tuple[str, str]:
    bays = [length for run in runs for residual in analyses[run["id"]]["residuals"] for length in residual["bayLengthsMm"]]
    sites = sum(sum(analyses[run["id"]]["roles"].values()) for run in runs)
    model = recipe["materialModel"]
    role_counts: dict[str, int] = defaultdict(int)
    for run in runs:
        for role, count in analyses[run["id"]]["roles"].items(): role_counts[role] += count
    if basis == "per-end-post": return (f"{value} end posts" if value != "2" or recipe["system"] == "timber-paling" else "two outer run endpoints = 2 end posts", "post-role-sites")
    if basis == "per-gate-post": return ("two gate boundaries = 2 gate posts" if recipe["system"] == "colorbond" and value == "2" else f"{value} gate posts", "post-role-sites")
    if basis == "per-ordinary-post":
        if recipe["system"] == "chain-wire": return (f"{sites} sites - {role_counts['strainer']} strainer sites = {value} line post", "chain-post-roles")
        if recipe["system"] == "colorbond": return (f"{sites} physical sites - {role_counts['end']} ends - {role_counts['gate']} gate boundaries = {value} ordinary posts", "post-role-sites")
        return (f"{value} ordinary posts", "post-role-sites")
    if basis == "per-strainer-post":
        gate_boundaries = sum(gate["boundaryPostCount"] for gate in gates)
        outer_strainers = role_counts["strainer"] - gate_boundaries
        if value == "4" and outer_strainers == 2 and gate_boundaries == 2:
            return ("two outer ends + two gate boundaries = 4 strainers", "chain-post-roles")
        return (f"{value} strainer posts", "chain-post-roles")
    if basis == "per-incident-strainer-end": return (f"{value} residual-span incident strainer ends", "incident-strainer-ends")
    if basis == "per-infill-sheet": return (f"ceil each bay [{','.join(map(str, bays))}] / {model['effectiveSheetCoverMm']} = {value} sheets", "infill-sheets-per-bay")
    if basis == "per-paling": return (f"sum ceil([{','.join(map(str, bays))}] / {model['palingCoverMm']}) = {value}", "palings-per-distributed-bay")
    if basis == "rail-cuts": return (f"{len(bays)} bays × {model['railRows']} rail rows = {value} cuts", "rail-cuts")
    if basis == "rail-lm":
        rows = model.get("railRows", model.get("topRailRows", 0)); net = _decimal(Decimal(sum(analyses[run["id"]]["net_mm"] for run in runs)) / 1000)
        noun = "net fence" if recipe["system"] == "colorbond" else "net"
        return (f"{net} lm {noun} × {rows} {'top rail row' if recipe['system'] == 'chain-wire' else 'rail rows'} = {value} lm", "rail-length")
    if basis == "mesh-lm":
        gross = _decimal(Decimal(sum(analyses[run["id"]]["gross_mm"] for run in runs)) / 1000); gate = _decimal(Decimal(sum(item["widthMm"] for item in gates)) / 1000)
        return (f"{gross} lm gross - {gate} lm gate = {value} lm", "mesh-net-length")
    if basis == "mesh-m2":
        net = _decimal(Decimal(sum(analyses[run["id"]]["net_mm"] for run in runs)) / 1000)
        return (f"{net} lm × {_decimal(Decimal(model['meshHeightMm']) / 1000)} m = {value} m2", "mesh-area")
    if basis == "per-gate-opening": return ("one approved gate opening = 1" if value == "1" else f"{len(gates)} approved gate openings = {value}", "gate-opening")
    if basis == "per-gate-leaf":
        gate_label = f"{gates[0]['type']}-gate" if gates and len({gate['type'] for gate in gates}) == 1 else "gate"
        return (f"typed {gate_label} model = {value} leaves", "typed-gate-hardware")
    if basis == "per-hinge-set": return (f"typed gate model = {value} hinge sets", "typed-gate-hardware")
    if basis == "per-latch": return (f"typed gate model = {value} latch", "typed-gate-hardware")
    if basis == "per-drop-bolt": return (f"typed gate model = {value} drop bolt", "typed-gate-hardware")
    if basis == "concrete-m3":
        grouped: dict[tuple[int, int], int] = defaultdict(int)
        for footing in recipe["footings"]:
            grouped[(footing["diameterMm"], footing["depthMm"])] += role_counts[footing["postRole"]]
        terms = []
        for (diameter, depth), count in sorted(grouped.items()):
            if count:
                radius = _decimal(Decimal(diameter) / 2000); depth_m = _decimal(Decimal(depth) / 1000)
                terms.append(f"{count}×π×{radius}²×{depth_m}")
        allowances = [item for item in recipe["allowances"] if any(component["basis"] == "concrete-m3" and component["id"] in item["componentIds"] for component in recipe["components"])]
        if allowances:
            allowance = allowances[0]
            multiplier = format(Decimal(1) + Decimal(allowance["percent"]) / 100, ".2f")
            return (f"ROUND_UP_INCREMENT(({' + '.join(terms)}) × {multiplier}, {allowance['roundingIncrement']}) = {value} m3", "role-footing-concrete")
        return (f"{' + '.join(terms)} = {value} m3", "role-footing-concrete")
    return (f"{basis} × component factor = {value}", basis)


def _evidence(basis: str, recipe: Mapping[str, Any], runs: list[Mapping[str, Any]], gates: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    run_refs = [{"kind": "run", "id": item["id"], "revision": item["revision"]} for item in runs]
    gate_refs = [{"kind": "gate", "id": item["id"], "revision": item["revision"]} for item in gates]
    if basis == "per-gate-post": return gate_refs
    if basis in {"per-gate-opening", "per-gate-leaf", "per-hinge-set", "per-latch", "per-drop-bolt"}: return gate_refs
    if basis == "per-strainer-post": return run_refs + gate_refs
    if basis == "concrete-m3": return run_refs + gate_refs + [{"kind": "recipe", "id": recipe["id"], "revision": recipe["revision"]}]
    return run_refs


def _line_id(component: Mapping[str, Any]) -> str:
    overrides = {
        "GATE-DROP-BOLT": "bom-gate-drop-bolt",
    }
    if component["itemCode"] in overrides:
        return overrides[component["itemCode"]]
    value = component["id"]
    for suffix in ("end", "gate", "ordinary"):
        value = value.replace(f"-post-{suffix}", f"-{suffix}-post")
    if component["basis"] == "rail-lm" and value.endswith("-top"):
        value += "-rail"
    return f"bom-{value}"


def _description(description: str, basis: str, quantity: Decimal) -> str:
    if quantity == 1 or basis in {"per-ordinary-post", "per-end-post", "per-corner-post", "per-junction-post", "per-strainer-post", "per-gate-post"}: return description
    replacements = {"assembly": "assemblies", "leaf": "leaves", "paling": "palings", "cut": "cuts", "sheet": "sheets", "set": "sets", "post": "posts", "opening": "openings", "bolt": "bolts", "latch": "latches"}
    for singular, plural in replacements.items():
        if description.endswith(singular): return description[:-len(singular)] + plural
    return description


def _category(basis: str) -> str:
    if basis.endswith("post"): return "post"
    if basis in {"per-infill-sheet", "per-paling", "mesh-lm", "mesh-m2"}: return "infill"
    if basis in {"rail-cuts", "rail-lm"}: return "rail"
    if basis in {"per-gate-opening", "per-gate-leaf"}: return "gate"
    if basis in {"per-hinge-set", "per-latch", "per-drop-bolt"}: return "gate-hardware"
    if basis == "concrete-m3": return "concrete"
    if basis == "per-retaining-lm": return "retaining"
    if basis == "per-removal-lm": return "removal"
    return "other"


def _operand(name: str, value: Decimal, unit: str, assumption_id: str) -> dict[str, Any]:
    return {"name": name, "value": _decimal(value), "unit": unit, "evidenceRefs": [{"kind": "assumption", "id": assumption_id}]}


def _decimal(value: Decimal) -> str:
    if not value.is_finite() or value < 0: raise ContractError("contract", "A BOM decimal must be finite and non-negative.")
    rendered = format(value, "f")
    if "." in rendered: rendered = rendered.rstrip("0").rstrip(".")
    return rendered or "0"


def _ceil_ratio(value: Decimal, divisor: int) -> int:
    return int((value / Decimal(divisor)).to_integral_value(rounding=ROUND_CEILING))


def _validate_request(value: Mapping[str, Any]) -> None:
    if not isinstance(value, Mapping): raise ContractError("contract", "Request must be an object.")
    _exact(value, _ROOT_KEYS, "request")
    if value["schema"] != JOB_SCHEMA: raise ContractError("contract", f"Unsupported schema {value['schema']!r}.", None, "schema")
    _id(value["requestId"], "requestId"); _sha(value["inputDigest"], "inputDigest")
    _exact(value["job"], {"id", "revision"}, "job"); _id(value["job"]["id"], "job.id"); _positive(value["job"]["revision"], "job.revision")
    _exact(value["document"], {"id", "name", "kind", "sha256"}, "document"); _id(value["document"]["id"], "document.id"); _bounded_text(value["document"]["name"], "document.name", 1, 300); _sha(value["document"]["sha256"], "document.sha256")
    if value["document"]["kind"] not in {"pdf", "dxf", "svg"}: raise ContractError("contract", "Unsupported document kind.", value["document"]["id"], "document.kind")
    _list(value["verifiedAssets"], "verifiedAssets", minimum=1); _list(value["calibrations"], "calibrations"); _list(value["evidence"], "evidence")
    for index, asset in enumerate(value["verifiedAssets"]):
        _exact(asset, {"kind", "id", "sha256"}, f"verifiedAssets.{index}"); _sha(asset["sha256"], f"verifiedAssets.{index}.sha256")
        _id(asset["id"], f"verifiedAssets.{index}.id")
        if asset["kind"] not in {"document", "photo"}: raise ContractError("contract", "Unknown verified asset kind.", asset["id"], f"verifiedAssets.{index}.kind")
    for index, calibration in enumerate(value["calibrations"]):
        _exact(calibration, {"id", "sheet", "candidateId", "digest", "metresPerUnit"}, f"calibrations.{index}"); _sha(calibration["digest"], f"calibrations.{index}.digest")
        _id(calibration["id"], f"calibrations.{index}.id"); _id(calibration["candidateId"], f"calibrations.{index}.candidateId"); _nonnegative(calibration["sheet"], f"calibrations.{index}.sheet"); _canonical(calibration["metresPerUnit"], f"calibrations.{index}.metresPerUnit")
    for index, evidence in enumerate(value["evidence"]):
        kind = evidence.get("kind") if isinstance(evidence, Mapping) else None
        keys = {
            "document": {"kind", "id", "sha256"},
            "calibration": {"kind", "id", "sheet", "candidateId", "digest", "metresPerUnit"},
            "photo": {"kind", "id", "revision", "sha256"},
        }.get(kind)
        if keys is None: raise ContractError("contract", "Unknown evidence kind.", None, f"evidence.{index}.kind")
        _exact(evidence, keys, f"evidence.{index}")
        _id(evidence["id"], f"evidence.{index}.id")
        if "sha256" in evidence: _sha(evidence["sha256"], f"evidence.{index}.sha256")
        if "digest" in evidence: _sha(evidence["digest"], f"evidence.{index}.digest")
        if kind == "calibration": _nonnegative(evidence["sheet"], f"evidence.{index}.sheet"); _id(evidence["candidateId"], f"evidence.{index}.candidateId"); _canonical(evidence["metresPerUnit"], f"evidence.{index}.metresPerUnit")
        if kind == "photo": _positive(evidence["revision"], f"evidence.{index}.revision")
    _ascending_unique([item["sheet"] for item in value["calibrations"]], "calibrations")
    _unique([f"{item['kind']}:{item['id']}" for item in value["verifiedAssets"]], "verifiedAssets")
    _unique([f"{item['kind']}:{item['id']}" for item in value["evidence"]], "evidence")
    verified = {(item["kind"], item["id"]): item["sha256"] for item in value["verifiedAssets"]}
    if verified.get(("document", value["document"]["id"])) != value["document"]["sha256"]: raise ContractError("document-original", "Active document lacks a matching verified original.", value["document"]["id"], "verifiedAssets")
    document_evidence = [item for item in value["evidence"] if item["kind"] == "document" and item["id"] == value["document"]["id"]]
    if len(document_evidence) != 1 or document_evidence[0]["sha256"] != value["document"]["sha256"]: raise ContractError("evidence", "Active document evidence does not match.", value["document"]["id"], "evidence")
    for calibration in value["calibrations"]:
        matches = [item for item in value["evidence"] if item["kind"] == "calibration" and item["id"] == calibration["id"]]
        if len(matches) != 1 or any(matches[0][key] != calibration[key] for key in ("sheet", "candidateId", "digest", "metresPerUnit")): raise ContractError("calibration", "Calibration evidence does not match.", calibration["id"], "calibrations")
    photo_evidence = {item["id"]: item for item in value["evidence"] if item["kind"] == "photo"}
    for photo_id, photo in photo_evidence.items():
        if verified.get(("photo", photo_id)) != photo["sha256"]: raise ContractError("photo-original", "Photo evidence lacks a matching verified original.", photo_id, "verifiedAssets")
    _list(value["runs"], "runs", minimum=1); _list(value["gates"], "gates")
    _exact(value["recipeSet"], {"id", "revision", "digest", "recipes"}, "recipeSet"); _id(value["recipeSet"]["id"], "recipeSet.id"); _positive(value["recipeSet"]["revision"], "recipeSet.revision"); _sha(value["recipeSet"]["digest"], "recipeSet.digest")
    _list(value["recipeSet"]["recipes"], "recipeSet.recipes", minimum=1)
    recipes: dict[str, Mapping[str, Any]] = {}
    for index, recipe in enumerate(value["recipeSet"]["recipes"]):
        _validate_recipe(recipe, f"recipeSet.recipes.{index}")
        if recipe["id"] in recipes: raise ContractError("contract", "Recipe ids must be unique.", recipe["id"], "recipeSet.recipes")
        recipes[recipe["id"]] = recipe
    run_ids: set[str] = set()
    for index, run in enumerate(value["runs"]):
        _validate_run(run, f"runs.{index}")
        if run["id"] in run_ids: raise ContractError("contract", "Run ids must be unique.", run["id"], "runs")
        run_ids.add(run["id"])
        if run["recipeId"] not in recipes: raise ContractError("recipe", "Run references an unknown recipe.", run["id"], f"runs.{index}.recipeId")
        recipe = recipes[run["recipeId"]]
        if run["specification"]["system"] != recipe["system"] or run["specification"]["profile"] != recipe["profile"]: raise ContractError("recipe", "Run system/profile does not match recipe.", run["id"], f"runs.{index}.recipeId")
        if run["specification"]["bayWidthMm"] > recipe["maxBayWidthMm"]: raise ContractError("unsupported-configuration", "Approved bay width exceeds recipe capability.", run["id"], f"runs.{index}.specification.bayWidthMm")
        specification = run["specification"]
        if specification["slope"] not in recipe["supportedSlopes"]: raise ContractError("unsupported-configuration", "Run slope is unsupported by its recipe.", run["id"], f"runs.{index}.specification.slope")
        if specification["ground"] not in recipe["supportedGround"]: raise ContractError("unsupported-configuration", "Run ground is unsupported by its recipe.", run["id"], f"runs.{index}.specification.ground")
        if specification["sleepers"] != "none" and not recipe["supportsSleepers"]: raise ContractError("unsupported-configuration", "Run sleepers are unsupported by its recipe.", run["id"], f"runs.{index}.specification.sleepers")
        if specification["retainingRequired"] and specification["retainingType"] not in recipe["supportedRetainingTypes"]: raise ContractError("unsupported-configuration", "Run retaining type is unsupported by its recipe.", run["id"], f"runs.{index}.specification.retainingType")
        if any(photo_id not in photo_evidence for photo_id in run["photoIds"]): raise ContractError("evidence", "Run references unknown photo evidence.", run["id"], f"runs.{index}.photoIds")
    _ascending_unique([run["id"] for run in value["runs"]], "runs")
    gate_ids: set[str] = set()
    for index, gate in enumerate(value["gates"]):
        _validate_gate(gate, f"gates.{index}")
        if gate["id"] in gate_ids: raise ContractError("contract", "Gate ids must be unique.", gate["id"], "gates")
        gate_ids.add(gate["id"])
        if gate["runId"] not in run_ids: raise ContractError("gate-placement", "Gate references an unknown run.", gate["id"], f"gates.{index}.runId")
        run = next(item for item in value["runs"] if item["id"] == gate["runId"]); recipe = recipes[run["recipeId"]]
        if gate["sheet"] != run["sheet"] or gate["segmentIndex"] >= len(run["segments"]): raise ContractError("gate-placement", "Gate does not reference a segment on its run sheet.", gate["id"], f"gates.{index}.segmentIndex")
        models = [item for item in recipe["gateHardwareModels"] if item["id"] == gate["hardwareModelId"]]
        if len(models) != 1: raise ContractError("unsupported-configuration", "Gate hardware model is not supported by its recipe.", gate["id"], f"gates.{index}.hardwareModelId")
        model = models[0]
        if gate["type"] not in recipe["supportedGateTypes"]: raise ContractError("unsupported-configuration", "Gate type is unsupported by its recipe.", gate["id"], f"gates.{index}.type")
        if model["gateType"] != gate["type"] or model["widthMm"] != gate["widthMm"]: raise ContractError("unsupported-configuration", "Gate type and width do not match its typed hardware model.", gate["id"], f"gates.{index}.hardwareModelId")
        if gate["boundaryPostCount"] != 2: raise ContractError("contract", "A gate interval must declare its two physical boundary posts.", gate["id"], f"gates.{index}.boundaryPostCount")
        for key in ("leafCount", "boundaryPostCount", "hingeSetCount", "latchCount", "dropBoltCount"):
            if gate[key] != model[key]: raise ContractError("contract", f"Gate {key} does not match its typed hardware model.", gate["id"], f"gates.{index}.{key}")
        if any(photo_id not in photo_evidence for photo_id in gate["photoIds"]): raise ContractError("evidence", "Gate references unknown photo evidence.", gate["id"], f"gates.{index}.photoIds")
    _ascending_unique([gate["id"] for gate in value["gates"]], "gates")


def _validate_run(run: Mapping[str, Any], path: str) -> None:
    _exact(run, _RUN_KEYS, path); _id(run["id"], f"{path}.id"); _positive(run["revision"], f"{path}.revision"); _nonnegative(run["sheet"], f"{path}.sheet"); _bounded_text(run["label"], f"{path}.label", 1, 120); _id(run["recipeId"], f"{path}.recipeId"); _list(run["segments"], f"{path}.segments", 1); _list(run["vertices"], f"{path}.vertices", 2)
    if len(run["vertices"]) != len(run["segments"]) + 1: raise ContractError("contract", "Run requires one more vertex than segment.", run["id"], f"{path}.vertices")
    for index, segment in enumerate(run["segments"]):
        _exact(segment, {"index", "lengthMm"}, f"{path}.segments.{index}"); _nonnegative(segment["index"], f"{path}.segments.{index}.index"); _positive(segment["lengthMm"], f"{path}.segments.{index}.lengthMm")
        if segment["index"] != index: raise ContractError("contract", "Segment indexes must be contiguous.", run["id"], f"{path}.segments.{index}.index")
    for index, vertex in enumerate(run["vertices"]):
        _exact(vertex, {"index", "topologyNodeId", "cornerTreatment", "postOverride"}, f"{path}.vertices.{index}")
        _nonnegative(vertex["index"], f"{path}.vertices.{index}.index"); _id(vertex["topologyNodeId"], f"{path}.vertices.{index}.topologyNodeId"); _enum(vertex["cornerTreatment"], {"standard", "boxed", "mitred", "end", "custom"}, f"{path}.vertices.{index}.cornerTreatment")
        if vertex["index"] != index: raise ContractError("contract", "Vertex indexes must be contiguous.", run["id"], f"{path}.vertices.{index}.index")
        if vertex["postOverride"] is not None:
            override = vertex["postOverride"]
            _exact(override, {"postSize", "lengthMm", "embedmentMm", "notes"}, f"{path}.vertices.{index}.postOverride")
            _bounded_text(override["postSize"], f"{path}.vertices.{index}.postOverride.postSize", 1, 120); _nullable_positive(override["lengthMm"], f"{path}.vertices.{index}.postOverride.lengthMm"); _nullable_positive(override["embedmentMm"], f"{path}.vertices.{index}.postOverride.embedmentMm"); _bounded_text(override["notes"], f"{path}.vertices.{index}.postOverride.notes", 0, 500)
    _exact(run["storedLengths"], {"grossMm", "gateDeductionMm", "netMm"}, f"{path}.storedLengths"); _exact(run["specification"], _SPEC_KEYS, f"{path}.specification")
    for key in ("grossMm", "gateDeductionMm", "netMm"): _nonnegative(run["storedLengths"][key], f"{path}.storedLengths.{key}")
    specification = run["specification"]
    _enum(specification["system"], _SYSTEMS, f"{path}.specification.system"); _bounded_text(specification["customSystem"], f"{path}.specification.customSystem", 0, 120); _bounded_text(specification["profile"], f"{path}.specification.profile", 1, 120)
    for key in ("heightMm", "bayWidthMm"): _positive(run["specification"][key], f"{path}.specification.{key}")
    _enum(specification["ground"], _GROUNDS, f"{path}.specification.ground"); _enum(specification["slope"], _SLOPES, f"{path}.specification.slope")
    _boolean(specification["removalRequired"], f"{path}.specification.removalRequired"); _bounded_text(specification["removalMaterial"], f"{path}.specification.removalMaterial", 0, 120); _nullable_positive(specification["removalLengthMm"], f"{path}.specification.removalLengthMm"); _boolean(specification["disposalRequired"], f"{path}.specification.disposalRequired")
    _enum(specification["access"], {"clear", "restricted", "hand-carry", "plant-required"}, f"{path}.specification.access"); _enum(specification["sleepers"], {"none", "timber", "concrete", "custom"}, f"{path}.specification.sleepers")
    _boolean(specification["retainingRequired"], f"{path}.specification.retainingRequired"); _enum(specification["retainingType"], _RETAINING_TYPES, f"{path}.specification.retainingType"); _nullable_nonnegative(specification["retainingHeightMm"], f"{path}.specification.retainingHeightMm"); _bounded_text(specification["retainingCondition"], f"{path}.specification.retainingCondition", 0, 500); _bounded_text(specification["notes"], f"{path}.specification.notes", 0, 2000)
    _ids(run["photoIds"], f"{path}.photoIds"); _unique(run["photoIds"], f"{path}.photoIds")
    _approval(run["approval"], run["revision"], f"{path}.approval")


def _validate_gate(gate: Mapping[str, Any], path: str) -> None:
    _exact(gate, _GATE_KEYS, path)
    _id(gate["id"], f"{path}.id"); _nonnegative(gate["sheet"], f"{path}.sheet"); _bounded_text(gate["label"], f"{path}.label", 1, 120); _id(gate["runId"], f"{path}.runId")
    for key in ("revision", "widthMm", "heightMm", "leafCount", "boundaryPostCount"): _positive(gate[key], f"{path}.{key}")
    for key in ("segmentIndex", "centreOffsetMm", "hingeSetCount", "latchCount", "dropBoltCount"): _nonnegative(gate[key], f"{path}.{key}")
    _enum(gate["type"], _GATE_TYPES, f"{path}.type"); _bounded_text(gate["customType"], f"{path}.customType", 0, 120); _enum(gate["openingDirection"], {"inward", "outward", "sliding-left", "sliding-right", "reversible", "not-applicable"}, f"{path}.openingDirection"); _enum(gate["hingeSide"], {"left", "right", "double", "not-applicable"}, f"{path}.hingeSide")
    _bounded_text(gate["hardware"], f"{path}.hardware", 1, 500); _bounded_text(gate["latch"], f"{path}.latch", 1, 200); _bounded_text(gate["postSize"], f"{path}.postSize", 1, 120); _bounded_text(gate["finish"], f"{path}.finish", 0, 200); _nullable_nonnegative(gate["clearanceMm"], f"{path}.clearanceMm"); _boolean(gate["motorised"], f"{path}.motorised"); _id(gate["hardwareModelId"], f"{path}.hardwareModelId"); _ids(gate["photoIds"], f"{path}.photoIds"); _unique(gate["photoIds"], f"{path}.photoIds")
    _approval(gate["approval"], gate["revision"], f"{path}.approval")


def _validate_recipe(recipe: Mapping[str, Any], path: str) -> None:
    _exact(recipe, _RECIPE_KEYS, path); _id(recipe["id"], f"{path}.id"); _positive(recipe["revision"], f"{path}.revision"); _enum(recipe["system"], _SYSTEMS, f"{path}.system"); _bounded_text(recipe["profile"], f"{path}.profile", 1, 120); _positive(recipe["maxBayWidthMm"], f"{path}.maxBayWidthMm"); _positive(recipe["postSpacingMm"], f"{path}.postSpacingMm")
    kind = recipe["materialModel"].get("kind") if isinstance(recipe["materialModel"], Mapping) else None
    if kind not in _MATERIAL_KEYS: raise ContractError("contract", "Unknown material model.", recipe.get("id"), f"{path}.materialModel.kind")
    _exact(recipe["materialModel"], _MATERIAL_KEYS[kind], f"{path}.materialModel")
    if kind != "explicit" and kind != recipe["system"]: raise ContractError("contract", "Material model does not match recipe system.", recipe["id"], f"{path}.materialModel")
    if kind == "explicit" and recipe["materialModel"]["system"] != recipe["system"]: raise ContractError("contract", "Explicit material model does not match recipe system.", recipe["id"], f"{path}.materialModel.system")
    for name in ("footings", "allowances", "gateHardwareModels", "assumptions", "components", "supportedSlopes", "supportedGround", "supportedGateTypes", "supportedRetainingTypes"): _list(recipe[name], f"{path}.{name}", 1 if name in {"assumptions", "components", "supportedSlopes", "supportedGround", "supportedRetainingTypes"} else 0)
    model = recipe["materialModel"]
    _ids(model["assumptionIds"], f"{path}.materialModel.assumptionIds", minimum=1)
    if kind == "colorbond": _positive(model["effectiveSheetCoverMm"], f"{path}.materialModel.effectiveSheetCoverMm"); _positive(model["railRows"], f"{path}.materialModel.railRows"); _literal(model["gateBoundaryPostRole"], "gate", f"{path}.materialModel.gateBoundaryPostRole")
    elif kind == "timber-paling": _positive(model["palingCoverMm"], f"{path}.materialModel.palingCoverMm"); _positive(model["railRows"], f"{path}.materialModel.railRows"); _literal(model["gateBoundaryPostRole"], "gate", f"{path}.materialModel.gateBoundaryPostRole")
    elif kind == "chain-wire": _positive(model["meshHeightMm"], f"{path}.materialModel.meshHeightMm"); _positive(model["meshRollLengthMm"], f"{path}.materialModel.meshRollLengthMm"); _enum(model["meshRollReusePolicy"], {"reuse-across-spans", "separate-roll-per-span"}, f"{path}.materialModel.meshRollReusePolicy"); _nonnegative(model["topRailRows"], f"{path}.materialModel.topRailRows"); _boolean(model["braceEveryIncidentStrainerEnd"], f"{path}.materialModel.braceEveryIncidentStrainerEnd"); _literal(model["gateBoundaryPostRole"], "strainer", f"{path}.materialModel.gateBoundaryPostRole")
    else: _enum(model["system"], {"pool", "custom"}, f"{path}.materialModel.system"); _bounded_text(model["ruleKey"], f"{path}.materialModel.ruleKey", 1, 120); _enum(model["gateBoundaryPostRole"], {"gate", "strainer"}, f"{path}.materialModel.gateBoundaryPostRole")
    _enums(recipe["supportedSlopes"], _SLOPES, f"{path}.supportedSlopes"); _enums(recipe["supportedGround"], _GROUNDS, f"{path}.supportedGround"); _enums(recipe["supportedGateTypes"], _GATE_TYPES, f"{path}.supportedGateTypes"); _enums(recipe["supportedRetainingTypes"], _RETAINING_TYPES, f"{path}.supportedRetainingTypes"); _boolean(recipe["supportsSleepers"], f"{path}.supportsSleepers")
    assumption_ids = {item.get("id") for item in recipe["assumptions"] if isinstance(item, Mapping)}
    component_ids = {item.get("id") for item in recipe["components"] if isinstance(item, Mapping)}
    for index, item in enumerate(recipe["footings"]):
        _exact(item, _FOOTING_KEYS, f"{path}.footings.{index}"); _enum(item["postRole"], set(_ROLE_BASIS), f"{path}.footings.{index}.postRole"); _positive(item["diameterMm"], f"{path}.footings.{index}.diameterMm"); _positive(item["depthMm"], f"{path}.footings.{index}.depthMm"); _ids(item["assumptionIds"], f"{path}.footings.{index}.assumptionIds", minimum=1)
    for index, item in enumerate(recipe["allowances"]):
        _exact(item, _ALLOWANCE_KEYS, f"{path}.allowances.{index}")
        _id(item["id"], f"{path}.allowances.{index}.id"); _ids(item["componentIds"], f"{path}.allowances.{index}.componentIds", minimum=1); _canonical(item["percent"], f"{path}.allowances.{index}.percent"); _canonical(item["roundingIncrement"], f"{path}.allowances.{index}.roundingIncrement"); _enum(item["roundingUnit"], _UNITS, f"{path}.allowances.{index}.roundingUnit"); _bounded_text(item["source"], f"{path}.allowances.{index}.source", 1, 500); _iso_datetime(item["effectiveAt"], f"{path}.allowances.{index}.effectiveAt"); _attribution(item, f"{path}.allowances.{index}"); _ids(item["assumptionIds"], f"{path}.allowances.{index}.assumptionIds", minimum=1)
        if Decimal(item["roundingIncrement"]) <= 0: raise ContractError("contract", "Allowance increment and unit are invalid.", item["id"], f"{path}.allowances.{index}")
        if not set(item["componentIds"]).issubset(component_ids): raise ContractError("contract", "Allowance references an unknown component.", item["id"], f"{path}.allowances.{index}.componentIds")
        units = {component["unit"] for component in recipe["components"] if component["id"] in item["componentIds"]}
        if units != {item["roundingUnit"]}: raise ContractError("contract", "Allowance rounding unit must equal every referenced component unit.", item["id"], f"{path}.allowances.{index}.roundingUnit")
    for index, item in enumerate(recipe["gateHardwareModels"]):
        _exact(item, _HARDWARE_MODEL_KEYS, f"{path}.gateHardwareModels.{index}"); _id(item["id"], f"{path}.gateHardwareModels.{index}.id"); _enum(item["gateType"], _GATE_TYPES, f"{path}.gateHardwareModels.{index}.gateType"); _positive(item["widthMm"], f"{path}.gateHardwareModels.{index}.widthMm"); _positive(item["leafCount"], f"{path}.gateHardwareModels.{index}.leafCount"); _positive(item["boundaryPostCount"], f"{path}.gateHardwareModels.{index}.boundaryPostCount")
        for key in ("hingeSetCount", "latchCount", "dropBoltCount"): _nonnegative(item[key], f"{path}.gateHardwareModels.{index}.{key}")
        _ids(item["assumptionIds"], f"{path}.gateHardwareModels.{index}.assumptionIds", minimum=1)
        if item["gateType"] not in recipe["supportedGateTypes"]: raise ContractError("contract", "Gate hardware model names an unsupported type.", item["id"], f"{path}.gateHardwareModels.{index}.gateType")
    for index, item in enumerate(recipe["assumptions"]):
        _exact(item, _ASSUMPTION_KEYS, f"{path}.assumptions.{index}")
        _id(item["id"], f"{path}.assumptions.{index}.id"); _bounded_text(item["key"], f"{path}.assumptions.{index}.key", 1, 120); _bounded_text(item["label"], f"{path}.assumptions.{index}.label", 1, 300); _canonical(item["value"], f"{path}.assumptions.{index}.value"); _enum(item["unit"], _UNITS | {"mm", "ratio"}, f"{path}.assumptions.{index}.unit"); _bounded_text(item["source"], f"{path}.assumptions.{index}.source", 1, 500); _iso_datetime(item["effectiveAt"], f"{path}.assumptions.{index}.effectiveAt"); _attribution(item, f"{path}.assumptions.{index}")
    for index, item in enumerate(recipe["components"]):
        _exact(item, _COMPONENT_KEYS, f"{path}.components.{index}")
        _id(item["id"], f"{path}.components.{index}.id"); _bounded_text(item["itemCode"], f"{path}.components.{index}.itemCode", 1, 120); _bounded_text(item["description"], f"{path}.components.{index}.description", 1, 300); _enum(item["basis"], _BASES, f"{path}.components.{index}.basis"); _enum(item["unit"], _UNITS, f"{path}.components.{index}.unit"); _canonical(item["factor"], f"{path}.components.{index}.factor"); _ids(item["assumptionIds"], f"{path}.components.{index}.assumptionIds")
    _unique([item["id"] for item in recipe["components"]], f"{path}.components")
    _unique([item["id"] for item in recipe["assumptions"]], f"{path}.assumptions")
    _unique([item["id"] for item in recipe["allowances"]], f"{path}.allowances")
    _unique([f"{item['itemCode']}:{item['unit']}" for item in recipe["components"]], f"{path}.components.itemCode-unit")
    _unique([_line_id(item) for item in recipe["components"]], f"{path}.components.lineId")
    _unique([item["postRole"] for item in recipe["footings"]], f"{path}.footings.postRole")
    _unique([item["id"] for item in recipe["gateHardwareModels"]], f"{path}.gateHardwareModels")
    _unique([f"{item['gateType']}:{item['widthMm']}" for item in recipe["gateHardwareModels"]], f"{path}.gateHardwareModels.capability")
    allowance_targets = [component_id for allowance in recipe["allowances"] for component_id in allowance["componentIds"]]
    _unique(allowance_targets, f"{path}.allowances.componentIds")
    refs = list(recipe["materialModel"]["assumptionIds"])
    refs += [ref for item in recipe["footings"] + recipe["allowances"] + recipe["gateHardwareModels"] + recipe["components"] for ref in item["assumptionIds"]]
    if not set(refs).issubset(assumption_ids): raise ContractError("assumption", "Recipe references an unknown assumption.", recipe["id"], f"{path}.assumptions")
    assumptions_by_id = {item["id"]: item for item in recipe["assumptions"]}
    unresolved = [assumption_id for assumption_id in refs if assumptions_by_id[assumption_id]["status"] != "accepted"]
    if unresolved: raise ContractError("assumption", "Every referenced assumption must be accepted.", unresolved[0], f"{path}.assumptions")


def _approval(value: Mapping[str, Any], revision: int, path: str) -> None:
    _exact(value, {"status", "entityRevision", "decidedAt", "decidedBy", "note"}, path)
    _literal(value["status"], "approved", f"{path}.status"); _positive(value["entityRevision"], f"{path}.entityRevision"); _iso_datetime(value["decidedAt"], f"{path}.decidedAt"); _bounded_text(value["decidedBy"], f"{path}.decidedBy", 1, 120, trim=True); _bounded_text(value["note"], f"{path}.note", 0, 1000)
    if value["entityRevision"] != revision: raise ContractError("review", "Approval is not bound to the current revision.", None, path)


def _exact(value: Any, keys: set[str], path: str) -> None:
    if not isinstance(value, Mapping): raise ContractError("contract", f"{path} must be an object.", None, path)
    actual = set(value)
    if actual != keys:
        detail = sorted(actual - keys) or sorted(keys - actual)
        raise ContractError("contract", f"{path} has unknown or missing keys: {', '.join(detail)}.", None, path)


def _list(value: Any, path: str, minimum: int = 0) -> None:
    if not isinstance(value, list) or len(value) < minimum: raise ContractError("contract", f"{path} must be an array with at least {minimum} entries.", None, path)


def _bounded_text(value: Any, path: str, minimum: int, maximum: int, trim: bool = False) -> None:
    if not isinstance(value, str) or len(value) < minimum or len(value) > maximum or (trim and not value.strip()): raise ContractError("contract", f"{path} must be a string between {minimum} and {maximum} characters.", None, path)


def _id(value: Any, path: str) -> None: _bounded_text(value, path, 1, 240)
def _ids(value: Any, path: str, minimum: int = 0) -> None:
    _list(value, path, minimum)
    for index, item in enumerate(value): _id(item, f"{path}.{index}")
def _unique(values: list[Any], path: str) -> None:
    if len(set(values)) != len(values): raise ContractError("contract", f"{path} contains duplicate identities.", None, path)
def _ascending_unique(values: list[Any], path: str) -> None:
    _unique(values, path)
    if values != sorted(values): raise ContractError("contract", f"{path} must be stored in ascending order.", None, path)
def _positive(value: Any, path: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0 or value > _MAX_SAFE_INTEGER: raise ContractError("contract", f"{path} must be a positive safe integer.", None, path)
def _nonnegative(value: Any, path: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > _MAX_SAFE_INTEGER: raise ContractError("contract", f"{path} must be a non-negative safe integer.", None, path)
def _nullable_positive(value: Any, path: str) -> None:
    if value is not None: _positive(value, path)
def _nullable_nonnegative(value: Any, path: str) -> None:
    if value is not None: _nonnegative(value, path)
def _boolean(value: Any, path: str) -> None:
    if not isinstance(value, bool): raise ContractError("contract", f"{path} must be a boolean.", None, path)
def _enum(value: Any, choices: set[str], path: str) -> None:
    if not isinstance(value, str) or value not in choices: raise ContractError("contract", f"{path} has an unsupported value.", None, path)
def _enums(value: Any, choices: set[str], path: str) -> None:
    _list(value, path)
    for index, item in enumerate(value): _enum(item, choices, f"{path}.{index}")
def _literal(value: Any, expected: str, path: str) -> None:
    if value != expected or not isinstance(value, str): raise ContractError("contract", f"{path} must equal {expected!r}.", None, path)
def _canonical(value: Any, path: str) -> None:
    if not isinstance(value, str) or _CANONICAL_DECIMAL.fullmatch(value) is None: raise ContractError("contract", f"{path} must be a canonical non-negative decimal string.", None, path)
def _iso_datetime(value: Any, path: str) -> None:
    if not isinstance(value, str) or "T" not in value or (not value.endswith("Z") and re.search(r"[+-]\d{2}:\d{2}$", value) is None): raise ContractError("contract", f"{path} must be an ISO datetime with an offset.", None, path)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ContractError("contract", f"{path} must be an ISO datetime with an offset.", None, path) from error
    if parsed.tzinfo is None: raise ContractError("contract", f"{path} must include an offset.", None, path)
def _attribution(value: Mapping[str, Any], path: str) -> None:
    _enum(value["status"], {"accepted", "unresolved"}, f"{path}.status"); _iso_datetime(value["effectiveAt"], f"{path}.effectiveAt")
    accepted_by, accepted_at = value["acceptedBy"], value["acceptedAt"]
    if accepted_by is not None: _bounded_text(accepted_by, f"{path}.acceptedBy", 0, 120)
    if accepted_at is not None: _iso_datetime(accepted_at, f"{path}.acceptedAt")
    if value["status"] == "accepted" and (not isinstance(accepted_by, str) or not accepted_by.strip() or accepted_at is None): raise ContractError("assumption", "Accepted entries require attributed acceptance.", value.get("id"), path)
    if value["status"] == "unresolved" and (accepted_by is not None or accepted_at is not None): raise ContractError("contract", "Unresolved entries cannot retain acceptance attribution.", value.get("id"), path)
def _is_sha256(value: Any) -> bool: return isinstance(value, str) and len(value) == 64 and all(char in "0123456789abcdef" for char in value)
def _sha(value: Any, path: str) -> None:
    if not _is_sha256(value): raise ContractError("contract", f"{path} must be a lowercase SHA-256.", None, path)
def _issue(code: str, message: str, entity_id: str | None, path: str | None) -> dict[str, Any]: return {"code": code, "message": message, "entityId": entity_id, "path": path}


__all__ = ["BOM_SCHEMA", "JOB_SCHEMA", "RULESET", "build_bom", "canonical_input_json", "compute_input_digest"]
