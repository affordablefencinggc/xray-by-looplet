"""Unit tests for wireframe.py — scene build + round-trip parity gate."""

import copy
import json

from xray.wireframe import _PALETTE, build_scene, render_html, roundtrip_check

TAKEOFF = {
    "engine": "xray-by-looplet",
    "document": {"path": "plan.pdf", "units": {"resolved": "mm"}},
    "symbols": [
        {"id": "n1", "blockName": "COL", "x": 1.0, "y": 2.0},
        {"id": "n2", "blockName": "BEAM", "x": 3.0, "y": 4.0},
        {"id": "n3", "blockName": "COL", "x": 5.0, "y": 6.0},
    ],
}


def test_build_scene_elements_faithful_to_measured_positions():
    scene = build_scene(TAKEOFF, heights={"COL": 3.0})
    assert len(scene["elements"]) == 3
    n1 = next(e for e in scene["elements"] if e["nodeId"] == "n1")
    assert n1["type"] == "COL" and n1["kind"] == "column"
    assert n1["a"] == [1.0, 2.0, 0.0]
    assert n1["b"] == [1.0, 2.0, 3.0]          # supplied height
    assert n1["heightTier"] == "given"


def test_build_scene_assumed_height_flagged_needs_human():
    scene = build_scene(TAKEOFF, heights={"COL": 3.0})
    beam = next(e for e in scene["elements"] if e["type"] == "BEAM")
    assert beam["heightTier"] == "needs-human"
    assert scene["meta"]["heightBasis"] == "assumed"
    # assumed height = 25% of the plan extent: span = max(4, 4) = 4 -> 1.0
    assert scene["meta"]["assumedHeight"] == 1.0
    assert beam["b"][2] == 1.0


def test_build_scene_all_heights_given_no_assumption():
    scene = build_scene(TAKEOFF, heights={"COL": 3.0, "BEAM": 0.4})
    assert scene["meta"]["heightBasis"] == "given"
    assert scene["meta"]["assumedHeight"] is None


def test_build_scene_explicit_default_height_used_when_unsupplied():
    scene = build_scene(TAKEOFF, default_height=2.5)
    beam = next(e for e in scene["elements"] if e["type"] == "BEAM")
    assert beam["b"][2] == 2.5
    assert beam["heightTier"] == "needs-human"


def test_build_scene_types_counts_and_deterministic_colours():
    scene = build_scene(TAKEOFF)
    names = [t["name"] for t in scene["types"]]
    assert names == ["BEAM", "COL"]            # sorted, deterministic
    assert scene["types"][0]["count"] == 1
    assert scene["types"][1]["count"] == 2
    assert scene["types"][0]["colour"] == _PALETTE[0]
    assert scene["types"][1]["colour"] == _PALETTE[1]
    col = next(e for e in scene["elements"] if e["nodeId"] == "n1")
    assert col["colour"] == _PALETTE[1]


def test_build_scene_bounds_cover_all_endpoints():
    scene = build_scene(TAKEOFF, heights={"COL": 3.0, "BEAM": 0.4})
    assert scene["bounds"]["min"] == [1.0, 2.0, 0.0]
    assert scene["bounds"]["max"] == [5.0, 6.0, 3.0]


def test_build_scene_carries_source_and_engine_and_is_pure():
    snapshot = copy.deepcopy(TAKEOFF)
    scene = build_scene(TAKEOFF)
    assert TAKEOFF == snapshot                  # input never mutated
    assert scene["engine"] == "xray-by-looplet"
    assert scene["source"]["documentPath"] == "plan.pdf"
    assert scene["source"]["units"] == "mm"
    assert scene["sceneVersion"] == "0.1"
    # JSON round-trip safe (no tuples / non-serialisable values)
    json.dumps(scene)


# --------------------------------------------------------- roundtrip_check

def test_roundtrip_check_passes_when_scene_matches_takeoff():
    scene = build_scene(TAKEOFF)
    check = roundtrip_check(scene, TAKEOFF)
    assert check["ok"] is True
    assert check["byType"] == {"COL": 2, "BEAM": 1}
    assert check["mismatches"] == {}


def test_roundtrip_check_flags_missing_elements():
    scene = build_scene(TAKEOFF)
    scene["elements"] = [e for e in scene["elements"] if e["type"] != "BEAM"]
    check = roundtrip_check(scene, TAKEOFF)
    assert check["ok"] is False
    assert check["mismatches"] == {"BEAM": {"scene": 0, "takeoff": 1}}


def test_roundtrip_check_flags_extra_elements():
    scene = build_scene(TAKEOFF)
    scene["elements"].append({"type": "PHANTOM", "a": [0, 0, 0], "b": [0, 0, 1]})
    check = roundtrip_check(scene, TAKEOFF)
    assert check["ok"] is False
    assert check["mismatches"]["PHANTOM"] == {"scene": 1, "takeoff": 0}


def test_roundtrip_check_handles_empty_inputs():
    check = roundtrip_check({"elements": []}, {"symbols": []})
    assert check["ok"] is True and check["byType"] == {}


# ------------------------------------------------------------- render_html

def test_render_html_embeds_scene_and_escapes_title():
    scene = build_scene(TAKEOFF, heights={"COL": 3.0})
    html = render_html(scene, title='Plan <A>"1"')
    assert "Plan &lt;A&gt;&quot;1&quot;" in html
    assert "const S={" in html                  # inline scene payload
    assert '"nodeId":"n1"' in html
    assert '<b>2</b>' in html                   # COL count in the type button
    assert "3 components from the drawing" in html


def test_render_html_warns_when_height_assumed():
    scene = build_scene(TAKEOFF)                # no heights supplied
    html = render_html(scene, title="x")
    assert "height assumed for view" in html