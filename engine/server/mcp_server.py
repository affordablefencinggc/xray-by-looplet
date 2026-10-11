"""mcp_server.py — X-Ray by Looplet as an MCP server.

Copied from danielsivyer4567/xray-by-looplet/server/mcp_server.py.
Stdio transport. Tools: engine_info, list_disciplines, run_takeoff,
quote_draft, run_takeoff_calibrated, marked_pdf, wireframe_scene.

Run from repo root:
  PYTHONPATH=engine/python:engine python -m server.mcp_server
"""
from __future__ import annotations

import logging
import os
import sys
import threading
from collections import OrderedDict
from pathlib import Path

_ENGINE = Path(__file__).resolve().parents[1]
_PY = _ENGINE / "python"
for p in (_ENGINE, _PY):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from mcp.server.fastmcp import FastMCP

from xray import ENGINE_NAME, __version__, engine
from xray.disciplines import list_disciplines as _list_disciplines
from xray.markup_writer import write_marked_pdf
from xray.wireframe import build_scene, roundtrip_check

from server.quote_lines import build_quote_draft

mcp = FastMCP("xray-by-looplet")

logger = logging.getLogger("server.mcp_server")

# --- per-plan takeoff cache -------------------------------------------------
# A full takeoff is the expensive part of every tool call, and an MCP client
# often calls marked_pdf / wireframe_scene back-to-back on the same plan. The
# cache is keyed by (resolved path, mtime, size): the key is re-statted on EVERY
# call, so an edited or re-saved plan produces a new key and a stale entry can
# never be served. Bounded to _CACHE_MAX entries; the oldest is evicted first.
_CACHE_MAX = 8
_TAKEOFF_CACHE: "OrderedDict[tuple, dict]" = OrderedDict()
_TAKEOFF_CACHE_LOCK = threading.Lock()


def _cache_key(pdf_path: str) -> tuple | None:
    """Cache key from the file's current identity, or None if it can't be
    statted (uncacheable — e.g. a bad path; engine.run will raise anyway)."""
    try:
        st = os.stat(pdf_path)
    except OSError:
        return None
    return (str(Path(pdf_path).resolve()), st.st_mtime_ns, st.st_size)


def _cached_takeoff(pdf_path: str) -> dict:
    """engine.run(pdf_path), memoized per (path, mtime, size).

    Thread-safe: every touch of the cache happens under the lock. Only a
    successful run is stored, and a hit is moved to the newest slot so the
    bound evicts the least recently used plan.
    """
    key = _cache_key(pdf_path)
    if key is not None:
        with _TAKEOFF_CACHE_LOCK:
            hit = _TAKEOFF_CACHE.get(key)
            if hit is not None:
                _TAKEOFF_CACHE.move_to_end(key)
                logger.debug("takeoff cache hit: %s", key[0])
                return hit
    result = engine.run(pdf_path)
    if key is not None:
        with _TAKEOFF_CACHE_LOCK:
            _TAKEOFF_CACHE[key] = result
            _TAKEOFF_CACHE.move_to_end(key)
            while len(_TAKEOFF_CACHE) > _CACHE_MAX:
                _TAKEOFF_CACHE.popitem(last=False)
    return result


@mcp.tool()
def engine_info() -> dict:
    """Return the engine name and version."""
    return {"engine": ENGINE_NAME, "version": __version__, "host": "mcp"}


@mcp.tool()
def list_disciplines() -> list:
    """List the trade disciplines the engine can measure — one entry per pack:
    {id, label, audience, pack, detect_summary}. Lets a client present X-Ray to
    engineers, architects, draftsmen and builders without running a takeoff."""
    return _list_disciplines()


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
    result = _cached_takeoff(pdf_path)
    write_marked_pdf(pdf_path, out_path, result)
    return {"marked_pdf": out_path,
            "quantities": len(result.get("quantities", [])),
            "checks": len(result.get("checks", []))}


@mcp.tool()
def wireframe_scene(pdf_path: str, height: float | None = None) -> dict:
    """Run a takeoff and extrude it into a 3D wireframe scene (presentation only;
    height is assumed unless supplied — never a quantity)."""
    tk = _cached_takeoff(pdf_path)
    scene = build_scene(tk, default_height=height)
    check = roundtrip_check(scene, tk)
    return {"scene": scene, "roundtrip": check}


if __name__ == "__main__":
    mcp.run()
