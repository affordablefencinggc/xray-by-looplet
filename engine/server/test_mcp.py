"""MCP server smoke tests. Skips cleanly if `mcp` isn't installed."""
import asyncio
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
for p in (ROOT, ROOT / "python"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

pytest.importorskip("mcp", reason="mcp not installed")
from server.mcp_server import (mcp, engine_info, quote_draft, run_takeoff,  # noqa: E402
                               list_disciplines)

FIXTURES = ROOT / "fixtures"


def test_tools_registered():
    names = {t.name for t in asyncio.run(mcp.list_tools())}
    assert {"run_takeoff", "quote_draft", "marked_pdf",
            "run_takeoff_calibrated", "engine_info", "wireframe_scene",
            "list_disciplines"} <= names


def test_list_disciplines_tool_runs():
    ds = list_disciplines()
    assert len(ds) == 6
    assert {d["id"] for d in ds} == {
        "fencing", "electrical", "structural", "civil", "architecture", "building"}
    for d in ds:
        assert d["label"] and d["audience"] and d["pack"] and d["detect_summary"]


def test_engine_info():
    info = engine_info()
    assert info["engine"] == "xray-by-looplet"
    assert info["version"]


def test_quote_draft_tool_runs():
    d = quote_draft(str(FIXTURES / "electrical-schedule.pdf"))
    assert d["summary"]["lines"] == 13
    assert d["engine"]["name"] == "xray-by-looplet"


def test_run_takeoff_tool_runs():
    r = run_takeoff(str(FIXTURES / "shed-manners-aline.pdf"))
    assert any(q["id"] == "qty-frames" for q in r["quantities"])
