"""mcp_server.py — X-Ray by Looplet as an MCP server.

Copied from danielsivyer4567/xray-by-looplet/server/mcp_server.py.
Stdio transport. Tools: engine_info, run_takeoff, quote_draft,
run_takeoff_calibrated, marked_pdf, wireframe_scene.

Run from repo root:
  PYTHONPATH=engine/python:engine python -m server.mcp_server
"""
from __future__ import annotations

import sys
import math
import os
import tempfile
from pathlib import Path

_ENGINE = Path(__file__).resolve().parents[1]
_PY = _ENGINE / "python"
for p in (_ENGINE, _PY):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from mcp.server.fastmcp import FastMCP
from pydantic import StrictFloat, StrictInt

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
def run_takeoff_calibrated(pdf_path: str, page: StrictInt,
                           p0: list[StrictFloat | StrictInt], p1: list[StrictFloat | StrictInt],
                           known_mm: StrictFloat | StrictInt) -> dict:
    """Run a takeoff with a manual scale calibration on one page: two points in
    PDF coordinates ([x, y] each) and the real-world distance between them (mm).
    The calibrated scale overrides auto-detection for that page."""
    if (type(page) is not int or page < 0 or len(p0) != 2 or len(p1) != 2
            or any(isinstance(v, bool) or not isinstance(v, (int,float)) or not math.isfinite(v) or abs(v)>1e9 for v in [*p0,*p1,known_mm])
            or known_mm <= 0 or p0 == p1):
        raise ValueError("Invalid calibration page, points or positive distance.")
    from xray.preflight import check_input
    import pypdfium2 as pdfium
    if check_input(pdf_path).name != "pdf":
        raise ValueError("Calibration requires a supported PDF source.")
    with pdfium.PdfDocument(pdf_path) as document:
        if page >= len(document):
            raise ValueError("Calibration page is outside the source.")
        width, height = document[page].get_size()
        if any(not 0 <= p[0] <= width or not 0 <= p[1] <= height for p in [p0,p1]):
            raise ValueError("Calibration points are outside the source page.")
    cal = {page: {"p0": list(p0), "p1": list(p1), "known_mm": float(known_mm)}}
    return engine.run(pdf_path, calibrations=cal)


@mcp.tool()
def marked_pdf(pdf_path: str, out_path: str) -> dict:
    """Run a takeoff and write a marked-up PDF (standard annotations + embedded
    takeoff.json) to out_path. Returns the path and quantity count."""
    target = Path(out_path)
    if (not target.is_absolute() or target.suffix.lower() != ".pdf"
            or target.exists() or target.is_symlink() or not target.parent.is_dir()
            or target.parent.resolve() != target.parent):
        raise ValueError("Marked PDF requires an absent absolute output in an existing directory.")
    result = engine.run(pdf_path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(prefix=".xray-marked-", suffix=".pdf", dir=target.parent, delete=False) as handle:
            temporary = Path(handle.name)
        write_marked_pdf(pdf_path, str(temporary), result)
        import pikepdf
        with pikepdf.open(temporary) as output:
            if len(output.pages) != len(result["document"]["pages"]):
                raise ValueError("Marked PDF page inventory mismatch.")
        with temporary.open("r+b") as handle:
            os.fsync(handle.fileno())
        os.link(temporary, target)  # atomic publication; an existing target wins
    except Exception as error:
        raise ValueError("Marked PDF publication failed; no success recorded.") from error
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
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
    # On Windows, first-loading NumPy/ezdxf after AnyIO starts its stdio
    # worker threads can stall native extension initialization. Load an
    # installed CAD runtime before those threads exist, without requiring it
    # for PDF-only installations or changing the ordinary CLI protocol.
    import importlib.util
    if importlib.util.find_spec("ezdxf") is not None:
        import ezdxf  # noqa: F401
    mcp.run()
