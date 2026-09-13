"""Selected recipe acceptance with a complete, digest-bound library."""
from copy import deepcopy
import unittest

from .job_bom import build_bom, compute_input_digest
from .test_job_bom import fixture


def mixed_request():
    request = fixture("colorbond.request.json")
    for stem in ("timber-paling", "chain-wire"):
        recipe = deepcopy(fixture(f"{stem}.request.json")["recipeSet"]["recipes"][0])
        for assumption in recipe["assumptions"]:
            assumption.update(status="unresolved", acceptedBy=None, acceptedAt=None)
        request["recipeSet"]["recipes"].append(recipe)
    request["inputDigest"] = compute_input_digest(request)
    return request


class SelectedRecipeAcceptanceTests(unittest.TestCase):
    def test_unused_unaccepted_library_preserves_selected_output_and_request(self):
        request = mixed_request()
        before = deepcopy(request)
        response = build_bom(request)
        expected = build_bom(fixture("colorbond.request.json"))
        self.assertTrue(response["ok"], response)
        for key in ("lines", "assumptions"):
            self.assertEqual(response["bom"][key], expected["bom"][key])
        self.assertEqual(request, before)

    def test_selected_unresolved_assumption_still_rejected(self):
        request = mixed_request()
        request["recipeSet"]["recipes"][0]["assumptions"][0].update(
            status="unresolved", acceptedBy=None, acceptedAt=None)
        request["inputDigest"] = compute_input_digest(request)
        response = build_bom(request)
        self.assertFalse(response["ok"])
        self.assertEqual(response["issues"][0]["code"], "assumption")

    def test_unused_recipe_integrity_still_rejected(self):
        for case in ("unknown-reference", "unknown-field", "false-attribution"):
            with self.subTest(case=case):
                request = mixed_request()
                recipe = request["recipeSet"]["recipes"][1]
                if case == "unknown-reference":
                    recipe["materialModel"]["assumptionIds"] = ["missing-assumption"]
                elif case == "unknown-field":
                    recipe["unexpected"] = True
                else:
                    recipe["assumptions"][0]["acceptedBy"] = "Not accepted"
                request["inputDigest"] = compute_input_digest(request)
                self.assertFalse(build_bom(request)["ok"])

    def test_unused_recipe_remains_digest_bound(self):
        request = mixed_request()
        request["recipeSet"]["recipes"][1]["assumptions"][0]["label"] = "Changed"
        response = build_bom(request)
        self.assertFalse(response["ok"])
        self.assertEqual(response["issues"][0]["path"], "inputDigest")

    def test_allowance_acceptance_is_required_for_selected_recipe_only(self):
        allowance_request = fixture("concrete-allowance.request.json")
        recipe = allowance_request["recipeSet"]["recipes"][0]
        recipe["allowances"][0].update(status="unresolved", acceptedBy=None, acceptedAt=None)
        allowance_request["inputDigest"] = compute_input_digest(allowance_request)
        self.assertFalse(build_bom(allowance_request)["ok"])
        request = mixed_request()
        recipe["id"] = "unused-allowance-recipe"
        request["recipeSet"]["recipes"].append(recipe)
        request["inputDigest"] = compute_input_digest(request)
        self.assertTrue(build_bom(request)["ok"])
