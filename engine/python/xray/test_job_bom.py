"""Executable golden and failure-mode tests for the independent Python BOM kernel."""

from __future__ import annotations

from copy import deepcopy
from decimal import Decimal
import json
from pathlib import Path
import unittest

from .job_bom import _analyse_run, _assign_topology_roles, _expression, _recipe_metrics, build_bom, compute_input_digest


FIXTURES = Path(__file__).parents[2] / "fixtures" / "bom-contract"


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def redigest(request: dict) -> dict:
    request["inputDigest"] = compute_input_digest(request)
    return request


class JobBomGoldenTests(unittest.TestCase):
    def test_worked_a_and_b_distribute_each_segment_deterministically(self) -> None:
        request = fixture("colorbond.request.json")
        recipe = request["recipeSet"]["recipes"][0]
        run = deepcopy(request["runs"][0])
        run["segments"] = [{"index": 0, "lengthMm": 2500}]
        run["vertices"] = [
            {"index": 0, "topologyNodeId": "n0", "cornerTreatment": "end", "postOverride": None},
            {"index": 1, "topologyNodeId": "n1", "cornerTreatment": "end", "postOverride": None},
        ]
        run["storedLengths"] = {"grossMm": 2500, "gateDeductionMm": 0, "netMm": 2500}
        analysis = _analyse_run(run, [], recipe)
        self.assertEqual(analysis["residuals"][0]["bayLengthsMm"], [1250, 1250])

        run["segments"] = [{"index": 0, "lengthMm": 5000}]
        run["storedLengths"] = {"grossMm": 5000, "gateDeductionMm": 0, "netMm": 5000}
        analysis = _analyse_run(run, [], recipe)
        self.assertEqual(analysis["residuals"][0]["bayLengthsMm"], [1667, 1667, 1666])

        run["segments"] = [{"index": 0, "lengthMm": 4800}, {"index": 1, "lengthMm": 3000}]
        run["vertices"] = [
            {"index": 0, "topologyNodeId": "sheet:0:x:0:y:0", "cornerTreatment": "end", "postOverride": None},
            {"index": 1, "topologyNodeId": "sheet:0:x:4.8:y:0", "cornerTreatment": "standard", "postOverride": None},
            {"index": 2, "topologyNodeId": "sheet:0:x:4.8:y:3", "cornerTreatment": "end", "postOverride": None},
        ]
        run["storedLengths"] = {"grossMm": 7800, "gateDeductionMm": 0, "netMm": 7800}
        analysis = _analyse_run(run, [], recipe)
        self.assertEqual([length for span in analysis["residuals"] for length in span["bayLengthsMm"]], [2400, 2400, 1500, 1500])
        self.assertEqual(len(analysis["sites"]), 5)
        analyses = {run["id"]: analysis}
        _assign_topology_roles([run], {}, {recipe["id"]: recipe}, analyses)
        self.assertEqual(analysis["roles"]["corner"], 1)

    def test_standard_collinear_internal_vertex_is_ordinary_not_corner(self) -> None:
        request = fixture("colorbond.request.json")
        recipe = request["recipeSet"]["recipes"][0]
        run = deepcopy(request["runs"][0])
        run["segments"] = [{"index": 0, "lengthMm": 2400}, {"index": 1, "lengthMm": 2400}]
        run["vertices"] = [
            {"index": 0, "topologyNodeId": "sheet:0:x:0:y:0", "cornerTreatment": "end", "postOverride": None},
            {"index": 1, "topologyNodeId": "sheet:0:x:2.4:y:0", "cornerTreatment": "standard", "postOverride": None},
            {"index": 2, "topologyNodeId": "sheet:0:x:4.8:y:0", "cornerTreatment": "end", "postOverride": None},
        ]
        run["storedLengths"] = {"grossMm": 4800, "gateDeductionMm": 0, "netMm": 4800}
        analysis = _analyse_run(run, [], recipe)
        analyses = {run["id"]: analysis}
        _assign_topology_roles([run], {}, {recipe["id"]: recipe}, analyses)
        self.assertEqual(analysis["roles"]["end"], 2)
        self.assertEqual(analysis["roles"]["ordinary"], 1)
        self.assertEqual(analysis["roles"]["corner"], 0)

    def test_odd_width_gate_preserves_half_millimetre_residuals(self) -> None:
        request = fixture("colorbond.request.json")
        recipe = request["recipeSet"]["recipes"][0]
        run = deepcopy(request["runs"][0])
        gate = deepcopy(request["gates"][0])
        gate["widthMm"] = 1001
        run["storedLengths"] = {"grossMm": 10000, "gateDeductionMm": 1001, "netMm": 8999}
        analysis = _analyse_run(run, [gate], recipe)
        lengths = [length for span in analysis["residuals"] for length in span["bayLengthsMm"]]
        self.assertEqual(lengths, [1750, Decimal("1749.5"), Decimal("1833.5"), 1833, 1833])
        self.assertEqual(sum(lengths), Decimal(8999))

    def test_full_segment_gate_keeps_both_boundary_sites_as_gate_posts(self) -> None:
        request = fixture("colorbond.request.json")
        recipe = request["recipeSet"]["recipes"][0]
        run = deepcopy(request["runs"][0])
        gate = deepcopy(request["gates"][0])
        gate.update({"centreOffsetMm": 5000, "widthMm": 10000})
        run["storedLengths"] = {"grossMm": 10000, "gateDeductionMm": 10000, "netMm": 0}
        analysis = _analyse_run(run, [gate], recipe)
        analyses = {run["id"]: analysis}
        _assign_topology_roles([run], {}, {recipe["id"]: recipe}, analyses)
        self.assertEqual(analysis["roles"]["gate"], 2)
        self.assertEqual(analysis["roles"]["end"], 0)

    def test_chain_t_counts_only_residual_incidences_at_winning_strainers(self) -> None:
        request = fixture("chain-wire.request.json")
        recipe = request["recipeSet"]["recipes"][0]
        edges = (
            ("sheet:0:x:0:y:0", "sheet:0:x:3:y:0"),
            ("sheet:0:x:3:y:0", "sheet:0:x:6:y:0"),
            ("sheet:0:x:3:y:0", "sheet:0:x:3:y:3"),
        )
        runs = []
        analyses = {}
        for index, (start, end) in enumerate(edges):
            run = deepcopy(request["runs"][0])
            run["id"] = f"chain-{index}"
            run["segments"] = [{"index": 0, "lengthMm": 3000}]
            run["vertices"] = [
                {"index": 0, "topologyNodeId": start, "cornerTreatment": "end", "postOverride": None},
                {"index": 1, "topologyNodeId": end, "cornerTreatment": "end", "postOverride": None},
            ]
            run["storedLengths"] = {"grossMm": 3000, "gateDeductionMm": 0, "netMm": 3000}
            runs.append(run)
            analyses[run["id"]] = _analyse_run(run, [], recipe)
        _assign_topology_roles(runs, {}, {recipe["id"]: recipe}, analyses)
        metrics = _recipe_metrics(recipe, runs, [], analyses)
        self.assertEqual(metrics["per-strainer-post"], 3)
        self.assertEqual(metrics["per-junction-post"], 1)
        self.assertEqual(metrics["per-incident-strainer-end"], 3)

    def test_worked_c_exact_topology_node_is_counted_once_as_a_junction(self) -> None:
        request = fixture("colorbond.request.json")
        recipe = request["recipeSet"]["recipes"][0]
        runs = []
        analyses = {}
        for index, (start, end) in enumerate((("sheet:0:x:0:y:0", "sheet:0:x:2.4:y:0"), ("sheet:0:x:2.4:y:0", "sheet:0:x:4.8:y:0"), ("sheet:0:x:2.4:y:0", "sheet:0:x:2.4:y:2.4"))):
            run = deepcopy(request["runs"][0])
            run["id"] = f"run-{index}"
            run["segments"] = [{"index": 0, "lengthMm": 2400}]
            run["vertices"] = [
                {"index": 0, "topologyNodeId": start, "cornerTreatment": "end", "postOverride": None},
                {"index": 1, "topologyNodeId": end, "cornerTreatment": "end", "postOverride": None},
            ]
            run["storedLengths"] = {"grossMm": 2400, "gateDeductionMm": 0, "netMm": 2400}
            runs.append(run)
            analyses[run["id"]] = _analyse_run(run, [], recipe)
        recipes = {recipe["id"]: recipe}
        _assign_topology_roles(runs, {}, recipes, analyses)
        self.assertEqual(sum(sum(item["roles"].values()) for item in analyses.values()), 4)
        self.assertEqual(sum(item["roles"]["junction"] for item in analyses.values()), 1)

    def test_cross_run_shared_endpoint_uses_global_physical_geometry(self) -> None:
        for name, end_node, treatment, expected_role in (
            ("right-angle", "sheet:0:x:2.4:y:2.4", "end", "corner"),
            ("collinear", "sheet:0:x:4.8:y:0", "end", "ordinary"),
            ("explicit", "sheet:0:x:4.8:y:0", "boxed", "corner"),
        ):
            with self.subTest(name=name):
                request = fixture("colorbond.request.json")
                recipe = request["recipeSet"]["recipes"][0]
                shared = "sheet:0:x:2.4:y:0"
                runs = []
                analyses = {}
                for run_id, start, end, shared_treatment in (
                    ("run-a", "sheet:0:x:0:y:0", shared, "end"),
                    ("run-b", shared, end_node, treatment),
                ):
                    run = deepcopy(request["runs"][0])
                    run["id"] = run_id
                    run["segments"] = [{"index": 0, "lengthMm": 2400}]
                    run["vertices"] = [
                        {"index": 0, "topologyNodeId": start, "cornerTreatment": shared_treatment, "postOverride": None},
                        {"index": 1, "topologyNodeId": end, "cornerTreatment": "end", "postOverride": None},
                    ]
                    run["storedLengths"] = {"grossMm": 2400, "gateDeductionMm": 0, "netMm": 2400}
                    runs.append(run)
                    analyses[run_id] = _analyse_run(run, [], recipe)
                _assign_topology_roles(runs, {}, {recipe["id"]: recipe}, analyses)
                self.assertEqual(sum(item["roles"][expected_role] for item in analyses.values()), 1)
                if expected_role == "ordinary":
                    self.assertEqual(sum(item["roles"]["corner"] for item in analyses.values()), 0)

    def test_frozen_requests_match_byte_equivalent_golden_values(self) -> None:
        for stem in ("colorbond", "timber-paling", "chain-wire", "concrete-allowance"):
            with self.subTest(stem=stem):
                actual = build_bom(fixture(f"{stem}.request.json"))
                expected = fixture(f"{stem}.response.json")
                self.assertEqual(
                    json.dumps(actual, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(expected, ensure_ascii=False, separators=(",", ":")),
                )

    def test_overlap_blocks_without_a_bom(self) -> None:
        request = fixture("colorbond.request.json")
        second = deepcopy(request["gates"][0])
        second.update({"id": "gate-person", "label": "Person gate", "centreOffsetMm": 5000})
        request["gates"].append(second)
        response = build_bom(redigest(request))
        self.assertFalse(response["ok"])
        self.assertNotIn("bom", response)
        self.assertEqual(response["issues"][0]["code"], "gate-overlap")

    def test_unknown_root_and_nested_keys_fail_closed(self) -> None:
        for mutate in (
            lambda value: value.update({"surprise": True}),
            lambda value: value["runs"][0]["specification"].update({"defaultSpacingMm": 2400}),
            lambda value: value["recipeSet"]["recipes"][0]["components"][0].update({"rate": "9.99"}),
        ):
            request = fixture("colorbond.request.json")
            mutate(request)
            response = build_bom(redigest(request))
            self.assertFalse(response["ok"])
            self.assertEqual(response["issues"][0]["code"], "contract")

    def test_digest_mismatch_fails_closed(self) -> None:
        request = fixture("timber-paling.request.json")
        request["runs"][0]["segments"][0]["lengthMm"] += 1
        response = build_bom(request)
        self.assertFalse(response["ok"])
        self.assertEqual(response["issues"][0]["path"], "inputDigest")

    def test_typed_gate_hardware_cannot_be_overridden_by_free_text(self) -> None:
        request = fixture("colorbond.request.json")
        request["gates"][0]["hardware"] = "No hinges, infer three leaves"
        self.assertTrue(build_bom(redigest(request))["ok"])
        request["gates"][0]["leafCount"] = 3
        response = build_bom(redigest(request))
        self.assertFalse(response["ok"])
        self.assertIn("typed hardware model", response["issues"][0]["message"])

    def test_outputs_never_contain_commercial_or_order_fields(self) -> None:
        forbidden = {"rate", "amount", "tax", "margin", "orderQuantity", "supplierId", "transmissionState"}
        response = build_bom(fixture("chain-wire.request.json"))
        def walk(value: object) -> None:
            if isinstance(value, dict):
                self.assertFalse(forbidden.intersection(value))
                for child in value.values(): walk(child)
            elif isinstance(value, list):
                for child in value: walk(child)
        walk(response)

    def test_concrete_decimal_stages_are_frozen(self) -> None:
        response = build_bom(fixture("concrete-allowance.request.json"))
        line = response["bom"]["lines"][0]
        values = {item["name"]: item["value"] for item in line["calculation"]["operands"]}
        self.assertEqual(values["raw-full-precision"], "0.201454628911445476125")
        self.assertEqual(values["raw-display-round-half-up-6"], "0.201455")
        self.assertEqual(values["allowed-full-precision"], "0.2216000918025900237375")
        self.assertEqual(values["allowed-display-round-half-up-6"], "0.2216")
        self.assertEqual(line["quantity"]["value"], "0.23")

    def test_allowances_reject_ambiguous_targets_units_and_increments(self) -> None:
        def duplicate_component_id(request: dict) -> None:
            request["recipeSet"]["recipes"][0]["allowances"][0]["componentIds"].append("concrete")

        def stacked_allowance(request: dict) -> None:
            allowance = deepcopy(request["recipeSet"]["recipes"][0]["allowances"][0])
            allowance["id"] = "allowance-concrete-second"
            request["recipeSet"]["recipes"][0]["allowances"].append(allowance)

        def mismatched_unit(request: dict) -> None:
            request["recipeSet"]["recipes"][0]["allowances"][0]["roundingUnit"] = "L"

        def zero_increment(request: dict) -> None:
            request["recipeSet"]["recipes"][0]["allowances"][0]["roundingIncrement"] = "0"

        for mutate in (duplicate_component_id, stacked_allowance, mismatched_unit, zero_increment):
            request = fixture("concrete-allowance.request.json")
            mutate(request)
            response = build_bom(redigest(request))
            self.assertFalse(response["ok"])
            self.assertNotIn("bom", response)

    def test_malformed_scalar_shapes_fail_closed(self) -> None:
        def set_value(path: tuple[object, ...], value: object):
            def mutate(request: dict) -> None:
                target: object = request
                for key in path[:-1]: target = target[key]  # type: ignore[index]
                target[path[-1]] = value  # type: ignore[index]
            return mutate

        cases = (
            ("numeric canonical decimal", set_value(("calibrations", 0, "metresPerUnit"), 1.0)),
            ("integer-as-boolean", set_value(("runs", 0, "specification", "removalRequired"), 1)),
            ("invalid slope", set_value(("runs", 0, "specification", "slope"), "vertical")),
            ("negative nullable mm", set_value(("gates", 0, "clearanceMm"), -1)),
            ("float hardware count", set_value(("gates", 0, "hingeSetCount"), 2.5)),
            ("integer motorised", set_value(("gates", 0, "motorised"), 0)),
            ("string material dimension", set_value(("recipeSet", "recipes", 0, "materialModel", "effectiveSheetCoverMm"), "762")),
            ("wrong material role", set_value(("recipeSet", "recipes", 0, "materialModel", "gateBoundaryPostRole"), "strainer")),
            ("numeric component factor", set_value(("recipeSet", "recipes", 0, "components", 0, "factor"), 1)),
            ("invalid supported ground", set_value(("recipeSet", "recipes", 0, "supportedGround", 0), "sand")),
            ("string supports sleepers", set_value(("recipeSet", "recipes", 0, "supportsSleepers"), "false")),
            ("empty document name", set_value(("document", "name"), "")),
            ("zero post override length", None),
            ("numeric allowance percent", None),
            ("blank acceptance actor", set_value(("recipeSet", "recipes", 0, "assumptions", 0, "acceptedBy"), "   ")),
        )
        for name, mutate in cases:
            with self.subTest(name=name):
                if name in {"zero post override length", "numeric allowance percent"}:
                    request = fixture("concrete-allowance.request.json")
                    if name == "zero post override length":
                        request["runs"][0]["vertices"][0]["postOverride"] = {"postSize": "100 x 100", "lengthMm": 0, "embedmentMm": None, "notes": ""}
                    else:
                        request["recipeSet"]["recipes"][0]["allowances"][0]["percent"] = 10
                else:
                    request = fixture("colorbond.request.json")
                    mutate(request)  # type: ignore[operator]
                response = build_bom(redigest(request))
                self.assertFalse(response["ok"])
                self.assertNotIn("bom", response)

    def test_fractional_lengths_are_truthful_in_calculation_expression(self) -> None:
        request = fixture("chain-wire.request.json")
        run = request["runs"][0]
        gate = request["gates"][0]
        recipe = request["recipeSet"]["recipes"][0]
        run["segments"][0]["lengthMm"] = 10500
        run["vertices"][1]["topologyNodeId"] = "sheet:0:x:10.5:y:0"
        run["storedLengths"] = {"grossMm": 10500, "gateDeductionMm": 1000, "netMm": 9500}
        gate["widthMm"] = 1000
        recipe["gateHardwareModels"][0]["widthMm"] = 1000
        response = build_bom(redigest(request))
        self.assertTrue(response["ok"])
        mesh = next(line for line in response["bom"]["lines"] if line["itemCode"] == "CW-MESH-LM")
        self.assertEqual(mesh["calculation"]["expression"], "10.5 lm gross - 1 lm gate = 9.5 lm")

    def test_four_strainers_without_a_gate_never_claim_gate_boundaries(self) -> None:
        request = fixture("chain-wire.request.json")
        recipe = request["recipeSet"]["recipes"][0]
        runs = []
        analyses = {}
        for index, y in enumerate((0, 2)):
            run = deepcopy(request["runs"][0])
            run["id"] = f"separate-{index}"
            run["segments"] = [{"index": 0, "lengthMm": 3000}]
            run["vertices"] = [
                {"index": 0, "topologyNodeId": f"sheet:0:x:0:y:{y}", "cornerTreatment": "end", "postOverride": None},
                {"index": 1, "topologyNodeId": f"sheet:0:x:3:y:{y}", "cornerTreatment": "end", "postOverride": None},
            ]
            run["storedLengths"] = {"grossMm": 3000, "gateDeductionMm": 0, "netMm": 3000}
            runs.append(run); analyses[run["id"]] = _analyse_run(run, [], recipe)
        _assign_topology_roles(runs, {}, {recipe["id"]: recipe}, analyses)
        expression, _ = _expression("per-strainer-post", recipe, runs, [], analyses, "4")
        self.assertEqual(expression, "4 strainer posts")

    def test_allowance_assumption_is_added_to_component_lineage(self) -> None:
        request = fixture("concrete-allowance.request.json")
        component = request["recipeSet"]["recipes"][0]["components"][0]
        component["assumptionIds"] = ["a-footing"]
        response = build_bom(redigest(request))
        self.assertTrue(response["ok"])
        self.assertEqual(response["bom"]["lines"][0]["assumptionRefs"], ["a-footing", "a-allowance"])


if __name__ == "__main__":
    unittest.main()
