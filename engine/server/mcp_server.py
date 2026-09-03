"""mcp_server.py — X-Ray by Looplet as an MCP server.

Copied from danielsivyer4567/xray-by-looplet/server/mcp_server.py.
Stdio transport. Tools: engine_info, run_takeoff, quote_draft,
run_takeoff_calibrated, marked_pdf, wireframe_scene.

Run from repo root:
  PYTHONPATH=engine/python:engine python -m server.mcp_server
"""
from __future__ import annotations

import sys
from pathlib import Path

_ENGINE = Path(__file__).resolve().parents[1]
_PY = _ENGINE / "python"
for p in (_ENGINE, _PY):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from mcp.server.fastmcp import FastMCP

from xray import ENGINE_NAME, __version__, engine
from xray.markup_writer import write_marked_pdf
from xray.wireframe import build_scene, roundtrip_check

from server.quote_lines import build_quote_draft

mcp = FastMCP("xray-by-looplet")


@mcp.tool()
def engine_info() -> dict:
    """Return the engine name and version."""
    return {"engine": ENGINE_NAME, "version": __version__, "host": "mcp"}


@mcp.tool()
def run_takeoff(pdf_path: str) -> dict:
    """Run a full takeoff on a plan PDF. Returns the structured takeoff result:
    entities, verification checks, and quantities with formulas, trust tiers
    (reconciled / single-source / needs-human) and evidence."""
    return engine.run(pdf_path)


@mcp.tool()
def quote_draft(pdf_path: str) -> dict:
    """Run a takeoff and map it to draft quote lines — the Looplet-ready
    envelope: quote_lines (with basis, tier, review_required), flags, summary.
    rate/amount are left null for a downstream pricing step to fill."""
    return build_quote_draft(engine.run(pdf_path))


@mcp.tool()
def run_takeoff_calibrated(pdf_path: str, page: int,
                           p0: list, p1: list, known_mm: float) -> dict:
    """Run a takeoff with a manual scale calibration on one page: two points in
    PDF coordinates ([x, y] each) and the real-world distance between them (mm).
    The calibrated scale overrides auto-detection for that page."""
    cal = {int(page): {"p0": list(p0), "p1": list(p1), "known_mm": float(known_mm)}}
    return engine.run(pdf_path, calibrations=cal)


@mcp.tool()
def marked_pdf(pdf_path: str, out_path: str) -> dict:
    """Run a takeoff and write a marked-up PDF (standard annotations + embedded
    takeoff.json) to out_path. Returns the path and quantity count."""
    result = engine.run(pdf_path)
    write_marked_pdf(pdf_path, out_path, result)
    return {"marked_pdf": out_path,
            "quantities": len(result.get("quantities", [])),
            "checks": len(result.get("checks", []))}


@mcp.tool()
def wireframe_scene(pdf_path: str, height: float | None = None) -> dict:
    """Run a takeoff and extrude it into a 3D wireframe scene (presentation only;
    height is assumed unless supplied — never a quantity)."""
    tk = engine.run(pdf_path)
    scene = build_scene(tk, default_height=height)
    check = roundtrip_check(scene, tk)
    return {"scene": scene, "roundtrip": check}


if __name__ == "__main__":
    mcp.run()
