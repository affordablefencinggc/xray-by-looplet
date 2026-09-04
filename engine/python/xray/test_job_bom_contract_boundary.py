"""SC-07 Python proofs for the frozen job-to-BOM JSON boundary.

These tests intentionally validate the source-controlled fixtures against the
canonical JSON Schema.  They do not rewrite fixtures and they do not execute a
packaged engine or sidecar.
"""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import unittest

from jsonschema import Draft202012Validator, FormatChecker

from .job_bom import BOM_SCHEMA, JOB_SCHEMA, build_bom, compute_input_digest


REPOSITORY = Path(__file__).parents[3]
FIXTURES = REPOSITORY / "engine" / "fixtures" / "bom-contract"
CONTRACT = json.loads(
    (REPOSITORY / "contracts" / "xray-job-bom-v1.schema.json").read_text(
        encoding="utf-8"
    )
)
VALIDATOR = Draft202012Validator(CONTRACT, format_checker=FormatChecker())
STEMS = ("colorbond", "timber-paling", "chain-wire", "concrete-allowance")
UNKNOWN_FIELDS = ("surprise", "extra")
FORBIDDEN_COMMERCIAL_FIELDS = (
    "rate",
    "amount",
    "tax",
    "margin",
    "quote",
    "quoteStatus",
    "receipt",
    "loopletReceipt",
    "handoff",
    "target",
)


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def errors(value: object) -> list[str]:
    return [error.message for error in VALIDATOR.iter_errors(value)]


def redigest(request: dict) -> dict:
    request["inputDigest"] = compute_input_digest(request)
    return request


def object_at(value: dict, path: tuple[object, ...]) -> dict:
    current: object = value
    for part in path:
        current = current[part]  # type: ignore[index]
    if not isinstance(current, dict):
        raise AssertionError(f"Fixture path {path!r} is not an object")
    return current


def keys_at_every_depth(value: object) -> set[str]:
    keys: set[str] = set()
    if isinstance(value, dict):
        keys.update(value)
        for child in value.values():
            keys.update(keys_at_every_depth(child))
    elif isinstance(value, list):
        for child in value:
            keys.update(keys_at_every_depth(child))
    return keys


class JobBomContractBoundaryTests(unittest.TestCase):
    def assert_rejected(self, value: object) -> None:
        self.assertTrue(errors(value), "mutated value unexpectedly matched the contract")

    def test_br_001_exact_schema_versions_and_frozen_fixtures_validate(self) -> None:
        Draft202012Validator.check_schema(CONTRACT)
        for stem in STEMS:
            with self.subTest(stem=stem):
                request = fixture(f"{stem}.request.json")
                response = fixture(f"{stem}.response.json")
                self.assertEqual(request["schema"], JOB_SCHEMA)
                self.assertEqual(response["schema"], BOM_SCHEMA)
                self.assertEqual(errors(request), [])
                self.assertEqual(errors(response), [])

        for schema in (None, "xray.job-to-bom", "xray.job-to-bom/v0", "xray.job-to-bom/v2", "xray.job-to-bmo/v1"):
            with self.subTest(request_schema=schema):
                request = fixture("colorbond.request.json")
                if schema is None:
                    request.pop("schema")
                else:
                    request["schema"] = schema
                request = redigest(request)
                self.assert_rejected(request)
                response = build_bom(request)
                self.assertFalse(response["ok"])
                self.assertEqual(response["schema"], BOM_SCHEMA)
                self.assertEqual(response["issues"][0]["code"], "contract")

        for stem in ("colorbond",):
            for schema in (None, "xray.bom", "xray.bom/v0", "xray.bom/v2", "xray.bmo/v1"):
                with self.subTest(response_schema=schema):
                    response = fixture(f"{stem}.response.json")
                    if schema is None:
                        response.pop("schema")
                    else:
                        response["schema"] = schema
                    self.assert_rejected(response)

    def test_br_002_unknown_request_field_is_rejected_at_every_fixture_object_shape(self) -> None:
        cases = (
            ("colorbond", ()),
            ("colorbond", ("job",)),
            ("colorbond", ("document",)),
            ("colorbond", ("verifiedAssets", 0)),
            ("colorbond", ("calibrations", 0)),
            ("colorbond", ("runs", 0)),
            ("colorbond", ("runs", 0, "segments", 0)),
            ("colorbond", ("runs", 0, "vertices", 0)),
            ("colorbond", ("runs", 0, "storedLengths")),
            ("colorbond", ("runs", 0, "specification")),
            ("colorbond", ("runs", 0, "approval")),
            ("colorbond", ("gates", 0)),
            ("colorbond", ("gates", 0, "approval")),
            ("colorbond", ("evidence", 0)),
            ("colorbond", ("evidence", 1)),
            ("colorbond", ("recipeSet",)),
            ("colorbond", ("recipeSet", "recipes", 0)),
            ("colorbond", ("recipeSet", "recipes", 0, "materialModel")),
            ("colorbond", ("recipeSet", "recipes", 0, "footings", 0)),
            ("concrete-allowance", ("recipeSet", "recipes", 0, "allowances", 0)),
            ("colorbond", ("recipeSet", "recipes", 0, "gateHardwareModels", 0)),
            ("colorbond", ("recipeSet", "recipes", 0, "assumptions", 0)),
            ("colorbond", ("recipeSet", "recipes", 0, "components", 0)),
        )
        for stem, path in cases:
            for field in UNKNOWN_FIELDS:
                with self.subTest(stem=stem, path=path, field=field):
                    request = fixture(f"{stem}.request.json")
                    object_at(request, path)[field] = True
                    request = redigest(request)
                    self.assert_rejected(request)
                    response = build_bom(request)
                    self.assertFalse(response["ok"])
                    self.assertEqual(response["issues"][0]["code"], "contract")

    def test_br_003_same_unknown_field_is_rejected_in_success_and_error_outputs(self) -> None:
        success_cases = (
            (),
            ("bom",),
            ("bom", "recipeSet"),
            ("bom", "ruleset"),
            ("bom", "lines", 0),
            ("bom", "lines", 0, "quantity"),
            ("bom", "lines", 0, "calculation"),
            ("bom", "lines", 0, "calculation", "result"),
            ("bom", "lines", 0, "evidenceRefs", 0),
            ("bom", "assumptions", 0),
            ("bom", "summary"),
        )
        for path in success_cases:
            for field in UNKNOWN_FIELDS:
                with self.subTest(branch="success", path=path, field=field):
                    response = fixture("colorbond.response.json")
                    object_at(response, path)[field] = True
                    self.assert_rejected(response)

        operand_response = fixture("concrete-allowance.response.json")
        for field in UNKNOWN_FIELDS:
            operand_response = fixture("concrete-allowance.response.json")
            object_at(operand_response, ("bom", "lines", 0, "calculation", "operands", 0))[
                field
            ] = True
            self.assert_rejected(operand_response)

        for field in UNKNOWN_FIELDS:
            warning_response = fixture("chain-wire.response.json")
            object_at(warning_response, ("bom", "warnings", 0))[field] = True
            self.assert_rejected(warning_response)

        invalid_request = fixture("colorbond.request.json")
        invalid_request["schema"] = "xray.job-to-bom/v2"
        error_response = build_bom(redigest(invalid_request))
        self.assertEqual(errors(error_response), [])
        for path in ((), ("issues", 0)):
            for field in UNKNOWN_FIELDS:
                with self.subTest(branch="error", path=path, field=field):
                    mutated = deepcopy(error_response)
                    object_at(mutated, path)[field] = True
                    self.assert_rejected(mutated)

    def test_br_003_generated_outputs_and_failure_branch_are_strictly_validated(self) -> None:
        for stem in STEMS:
            with self.subTest(stem=stem):
                generated = build_bom(fixture(f"{stem}.request.json"))
                self.assertEqual(errors(generated), [])

        success = fixture("colorbond.response.json")
        corruptions = (
            lambda value: value.pop("requestId"),
            lambda value: value["bom"].pop("summary"),
            lambda value: value["bom"]["lines"][0]["quantity"].update({"value": 1}),
            lambda value: value["bom"]["lines"][0].update({"category": "priced-item"}),
            lambda value: value.update({"ok": False}),
        )
        for index, corrupt in enumerate(corruptions):
            with self.subTest(success_corruption=index):
                mutated = deepcopy(success)
                corrupt(mutated)
                self.assert_rejected(mutated)

        invalid_request = fixture("colorbond.request.json")
        invalid_request["schema"] = "xray.job-to-bom/v2"
        failure = build_bom(redigest(invalid_request))
        self.assertEqual(errors(failure), [])
        for index, corrupt in enumerate(
            (
                lambda value: value.pop("inputDigest"),
                lambda value: value.update({"issues": []}),
                lambda value: value.update({"ok": True}),
            )
        ):
            with self.subTest(error_corruption=index):
                mutated = deepcopy(failure)
                corrupt(mutated)
                self.assert_rejected(mutated)

    def test_br_033_pricing_quote_receipt_and_handoff_fields_fail_closed(self) -> None:
        for field in FORBIDDEN_COMMERCIAL_FIELDS:
            with self.subTest(direction="request-root", field=field):
                request = fixture("colorbond.request.json")
                request[field] = "forbidden"
                request = redigest(request)
                self.assert_rejected(request)
                response = build_bom(request)
                self.assertFalse(response["ok"])
                self.assertEqual(response["issues"][0]["code"], "contract")

            with self.subTest(direction="request-component", field=field):
                request = fixture("colorbond.request.json")
                request["recipeSet"]["recipes"][0]["components"][0][field] = "forbidden"
                request = redigest(request)
                self.assert_rejected(request)
                response = build_bom(request)
                self.assertFalse(response["ok"])
                self.assertEqual(response["issues"][0]["code"], "contract")

            for path in ((), ("bom",), ("bom", "lines", 0)):
                with self.subTest(direction="response", field=field, path=path):
                    response = fixture("colorbond.response.json")
                    object_at(response, path)[field] = "forbidden"
                    self.assert_rejected(response)

        for stem in STEMS:
            with self.subTest(direction="generated-output", stem=stem):
                output = build_bom(fixture(f"{stem}.request.json"))
                self.assertTrue(output["ok"])
                self.assertFalse(
                    set(FORBIDDEN_COMMERCIAL_FIELDS).intersection(
                        keys_at_every_depth(output)
                    )
                )


if __name__ == "__main__":
    unittest.main()
