# X-Ray desktop (Tauri 2 + Rust) and MCP

Looplet’s construction SKU is **Tauri 2 + Rust**. The web studio is the
webview. Rust owns the file picker and spawns the takeoff engine.

```
studio (this repo, port 8080)
        │  invoke xray_pick_plan / xray_run_takeoff
        ▼
src-tauri  →  engine/host  →  frozen xray-engine  OR  python3 -m xray run
                                      │
                                      ▼
                               takeoff.json  (quantities; never an LLM)
```

Commands (`src-tauri/src/lib.rs`):

| command | role |
|---|---|
| `xray_pick_plan` | native PDF / DXF / SVG picker |
| `xray_run_takeoff` | spawn engine, return parsed JSON |
| `xray_engine_status` | sidecar path / python src present |

Engine resolution (`engine/host`): `XRAY_ENGINE_PATH` → `engine/bin/xray-engine` → `python3 -m xray`.

## MCP (agent surface)

Same engine, stdio. This is how an agent sees a takeoff.

```
PYTHONPATH=engine/python:engine python -m server.mcp_server
```

| tool | role |
|---|---|
| `engine_info` | name + version |
| `run_takeoff` | PDF → takeoff.json |
| `quote_draft` | takeoff → Looplet quote lines (rates empty) |
| `run_takeoff_calibrated` | takeoff with a measured scale |
| `marked_pdf` | write annotated PDF |
| `wireframe_scene` | extrude takeoff to a 3D scene (height assumed) |

Pin `mcp>=1.2,<2` (FastMCP). The original repo’s tests expect that API.

## On your machine

Needs Rust, GTK/WebKit (Linux) or WebView2 (Windows), and either a frozen
`xray-engine` binary or Python 3 + `engine/python/requirements.txt`.

```bash
cargo test --manifest-path engine/host/Cargo.toml
PYTHONPATH=engine/python:engine python -m pytest engine/server/test_mcp.py
npm run tauri:dev
```

This sandbox has **no WebKit**, so the native window cannot open here. The
host crate, MCP, and the web studio can.
