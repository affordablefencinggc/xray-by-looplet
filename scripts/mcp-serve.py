"""mcp-serve.py — Standalone FastMCP Server Runner for X-Ray by Looplet.

Supports:
  stdio: python scripts/mcp-serve.py --transport=stdio (default)
  sse:   python scripts/mcp-serve.py --transport=sse --port=8000
"""
import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE_PY = ROOT / "engine" / "python"
ENGINE = ROOT / "engine"

for p in (str(ROOT), str(ENGINE), str(ENGINE_PY)):
    if p not in sys.path:
        sys.path.insert(0, p)

from engine.server.mcp_server import mcp


def main():
    parser = argparse.ArgumentParser(description="X-Ray FastMCP Server Runner")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse", "streamable-http"],
        default="stdio",
        help="Transport mode (stdio or sse)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for SSE transport (default: 8000)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host for SSE transport (default: 127.0.0.1)",
    )
    args = parser.parse_args()

    if args.transport == "sse":
        mcp.settings.port = args.port
        mcp.settings.host = args.host
        print(f"[+] Starting X-Ray FastMCP server in SSE mode on http://{args.host}:{args.port}/sse", file=sys.stderr)
        mcp.run(transport="sse")
    elif args.transport == "streamable-http":
        mcp.settings.port = args.port
        mcp.settings.host = args.host
        print(f"[+] Starting X-Ray FastMCP server in Streamable-HTTP mode on http://{args.host}:{args.port}/mcp", file=sys.stderr)
        mcp.run(transport="streamable-http")
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
