"""dxf.py — Direct DXF/DWG vector parser module.

Extracts CAD linework, polylines, circles, layers, and text from AutoCAD DXF
files, producing native X-Ray vector entities for 2D/3D takeoff and wireframe viewing.
Implements pure-Python streaming DXF reader with optional ezdxf acceleration.
"""
from __future__ import annotations

import math
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class DxfEntity:
    type: str  # LINE, LWPOLYLINE, CIRCLE, ARC, TEXT, DIMENSION, POINT
    layer: str
    points: List[Tuple[float, float, float]]
    properties: Dict[str, Any] = field(default_factory=dict)
    length: float = 0.0


@dataclass
class DxfModel:
    filename: str
    layers: Dict[str, List[DxfEntity]] = field(default_factory=dict)
    bounds: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    units: str = "mm"
    scale_factor: float = 1.0
    total_length: float = 0.0


def parse_dxf_stream(lines: List[str]) -> DxfModel:
    """Pure-python streaming DXF group-code parser."""
    model = DxfModel(filename="stream")
    current_section: Optional[str] = None
    i = 0
    n = len(lines)

    current_entity: Optional[Dict[str, Any]] = None
    entities: List[DxfEntity] = []

    # Vertex coordinates tracking for LWPOLYLINE and VERTEX entities
    vx = vy = vz = 0.0

    while i < n - 1:
        code_str = lines[i].strip()
        val_str = lines[i + 1].strip()
        i += 2

        try:
            code = int(code_str)
        except ValueError:
            continue

        if code == 0:
            # Commit the vertex before moving to next entity / boundary
            if current_entity and current_entity.get("_in_vertex"):
                current_entity["coords"].append((vx, vy, vz))
                current_entity["_in_vertex"] = False
                vx = vy = vz = 0.0

            # Section or Entity Boundary
            if val_str == "SECTION":
                pass
            elif val_str == "ENDSEC":
                current_section = None
            elif current_section == "ENTITIES":
                # Finalize previous entity
                if val_str == "VERTEX" and current_entity and current_entity.get("type") in ["POLYLINE", "LWPOLYLINE"]:
                    current_entity["_in_vertex"] = True
                elif val_str == "SEQEND" and current_entity and current_entity.get("type") in ["POLYLINE", "LWPOLYLINE"]:
                    ent = _build_entity(current_entity)
                    if ent:
                        entities.append(ent)
                    current_entity = None
                else:
                    if current_entity:
                        ent = _build_entity(current_entity)
                        if ent:
                            entities.append(ent)
                    if val_str not in ["VERTEX", "SEQEND"]:
                        current_entity = {"type": val_str, "layer": "0", "coords": []}
                    else:
                        current_entity = None
        elif code == 2 and current_section is None:
            current_section = val_str
        elif current_section == "ENTITIES" and current_entity:
            # Entity fields
            if current_entity.get("_in_vertex"):
                if code == 10:
                    vx = float(val_str)
                elif code == 20:
                    vy = float(val_str)
                elif code == 30:
                    vz = float(val_str)
            else:
                if code == 8:
                    current_entity["layer"] = val_str
                elif code == 10:
                    if current_entity["type"] == "LWPOLYLINE":
                        vx = float(val_str)
                    else:
                        current_entity["x"] = float(val_str)
                elif code == 20:
                    if current_entity["type"] == "LWPOLYLINE":
                        vy = float(val_str)
                        current_entity["coords"].append((vx, vy, 0.0))
                    else:
                        current_entity["y"] = float(val_str)
                elif code == 30:
                    current_entity["z"] = float(val_str)
                elif code == 11:
                    current_entity["x1"] = float(val_str)
                elif code == 21:
                    current_entity["y1"] = float(val_str)
                elif code == 31:
                    current_entity["z1"] = float(val_str)
                elif code == 40:
                    current_entity["radius"] = float(val_str)
                elif code == 50:
                    current_entity["start_angle"] = float(val_str)
                elif code == 51:
                    current_entity["end_angle"] = float(val_str)
                elif code == 1:
                    current_entity["text"] = val_str
                elif code == 42:
                    current_entity["measured"] = float(val_str)

    if current_entity:
        if current_entity.get("_in_vertex"):
            current_entity["coords"].append((vx, vy, vz))
        ent = _build_entity(current_entity)
        if ent:
            entities.append(ent)

    # Aggregate by layer
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    total_len = 0.0

    for ent in entities:
        layer = ent.layer or "0"
        if layer not in model.layers:
            model.layers[layer] = []
        model.layers[layer].append(ent)
        total_len += ent.length

        for p in ent.points:
            min_x = min(min_x, p[0])
            min_y = min(min_y, p[1])
            max_x = max(max_x, p[0])
            max_y = max(max_y, p[1])

    if min_x != float("inf"):
        model.bounds = (min_x, min_y, max_x, max_y)
    model.total_length = total_len
    return model


def _build_entity(data: Dict[str, Any]) -> Optional[DxfEntity]:
    etype = data.get("type", "").upper()
    layer = data.get("layer", "0")

    if etype == "LINE":
        x0, y0, z0 = data.get("x", 0.0), data.get("y", 0.0), data.get("z", 0.0)
        x1, y1, z1 = data.get("x1", 0.0), data.get("y1", 0.0), data.get("z1", 0.0)
        dist = math.hypot(x1 - x0, y1 - y0, z1 - z0)
        return DxfEntity(
            type="LINE",
            layer=layer,
            points=[(x0, y0, z0), (x1, y1, z1)],
            length=dist,
        )
    elif etype in ["LWPOLYLINE", "POLYLINE"]:
        pts = data.get("coords", [])
        if not pts and "x" in data and "y" in data:
            pts = [(data["x"], data["y"], data.get("z", 0.0))]
        dist = 0.0
        for j in range(len(pts) - 1):
            dist += math.hypot(pts[j+1][0] - pts[j][0], pts[j+1][1] - pts[j][1], pts[j+1][2] - pts[j][2])
        return DxfEntity(
            type=etype,
            layer=layer,
            points=pts,
            length=dist,
        )
    elif etype == "CIRCLE":
        cx, cy, cz = data.get("x", 0.0), data.get("y", 0.0), data.get("z", 0.0)
        r = data.get("radius", 1.0)
        circ = 2 * math.pi * r
        return DxfEntity(
            type="CIRCLE",
            layer=layer,
            points=[(cx, cy, cz)],
            properties={"radius": r},
            length=circ,
        )
    elif etype == "ARC":
        cx, cy, cz = data.get("x", 0.0), data.get("y", 0.0), data.get("z", 0.0)
        r = data.get("radius", 1.0)
        start_angle = data.get("start_angle", 0.0)
        end_angle = data.get("end_angle", 360.0)
        angle_diff = (end_angle - start_angle) % 360
        arc_len = (angle_diff / 360.0) * (2 * math.pi * r)
        return DxfEntity(
            type="ARC",
            layer=layer,
            points=[(cx, cy, cz)],
            properties={"radius": r, "start_angle": start_angle, "end_angle": end_angle},
            length=arc_len,
        )
    elif etype in ["TEXT", "MTEXT"]:
        cx, cy, cz = data.get("x", 0.0), data.get("y", 0.0), data.get("z", 0.0)
        text = data.get("text", "")
        return DxfEntity(
            type="TEXT",
            layer=layer,
            points=[(cx, cy, cz)],
            properties={"text": text},
            length=0.0,
        )
    elif etype == "DIMENSION":
        measured = data.get("measured", 0.0)
        text = data.get("text", "")
        return DxfEntity(
            type="DIMENSION",
            layer=layer,
            points=[],
            properties={"text": text, "measured": measured},
            length=measured,
        )
    elif etype == "POINT":
        cx, cy, cz = data.get("x", 0.0), data.get("y", 0.0), data.get("z", 0.0)
        return DxfEntity(
            type="POINT",
            layer=layer,
            points=[(cx, cy, cz)],
            length=0.0,
        )
    return None


def _parse_ezdxf_msp(msp: Any, model: DxfModel) -> None:
    """Helper to parse ezdxf modelspace entities into DxfModel."""
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    total_len = 0.0

    for e in msp:
        etype = e.dxftype()
        layer = getattr(e.dxf, "layer", "0")
        ent: Optional[DxfEntity] = None

        if etype == "LINE":
            s = e.dxf.start
            end = e.dxf.end
            dist = math.hypot(end.x - s.x, end.y - s.y, end.z - s.z)
            ent = DxfEntity(
                type="LINE",
                layer=layer,
                points=[(s.x, s.y, s.z), (end.x, end.y, end.z)],
                length=dist,
            )
        elif etype in ["LWPOLYLINE", "POLYLINE"]:
            try:
                pts = [(v[0], v[1], 0.0) for v in e.get_points()]
            except Exception:
                pts = []
            dist = 0.0
            for j in range(len(pts) - 1):
                dist += math.hypot(pts[j+1][0] - pts[j][0], pts[j+1][1] - pts[j][1], pts[j+1][2] - pts[j][2])
            ent = DxfEntity(type=etype, layer=layer, points=pts, length=dist)
        elif etype == "CIRCLE":
            cx, cy, cz = e.dxf.center.x, e.dxf.center.y, e.dxf.center.z
            r = e.dxf.radius
            circ = 2 * math.pi * r
            ent = DxfEntity(
                type="CIRCLE",
                layer=layer,
                points=[(cx, cy, cz)],
                properties={"radius": r},
                length=circ,
            )
        elif etype == "ARC":
            cx, cy, cz = e.dxf.center.x, e.dxf.center.y, e.dxf.center.z
            r = e.dxf.radius
            start_angle = e.dxf.start_angle
            end_angle = e.dxf.end_angle
            angle_diff = (end_angle - start_angle) % 360
            arc_len = (angle_diff / 360.0) * (2 * math.pi * r)
            ent = DxfEntity(
                type="ARC",
                layer=layer,
                points=[(cx, cy, cz)],
                properties={"radius": r, "start_angle": start_angle, "end_angle": end_angle},
                length=arc_len,
            )
        elif etype in ["TEXT", "MTEXT"]:
            try:
                cx, cy, cz = e.dxf.insert.x, e.dxf.insert.y, e.dxf.insert.z
            except Exception:
                cx = cy = cz = 0.0
            text = getattr(e.dxf, "text", "") or ""
            ent = DxfEntity(
                type="TEXT",
                layer=layer,
                points=[(cx, cy, cz)],
                properties={"text": text},
                length=0.0,
            )
        elif etype == "DIMENSION":
            try:
                measured = float(e.get_measurement())
            except Exception:
                measured = 0.0
            text = getattr(e.dxf, "text", "") or ""
            ent = DxfEntity(
                type="DIMENSION",
                layer=layer,
                points=[],
                properties={"text": text, "measured": measured},
                length=measured,
            )
        elif etype == "POINT":
            try:
                loc = e.dxf.location
                px, py, pz = loc.x, loc.y, loc.z
            except Exception:
                px = py = pz = 0.0
            ent = DxfEntity(
                type="POINT",
                layer=layer,
                points=[(px, py, pz)],
                length=0.0,
            )

        if ent:
            if layer not in model.layers:
                model.layers[layer] = []
            model.layers[layer].append(ent)
            total_len += ent.length
            for pt in ent.points:
                min_x = min(min_x, pt[0])
                min_y = min(min_y, pt[1])
                max_x = max(max_x, pt[0])
                max_y = max(max_y, pt[1])

    if min_x != float("inf"):
        model.bounds = (min_x, min_y, max_x, max_y)
    model.total_length = total_len


def parse_dwg_file(filepath: str | Path) -> DxfModel:
    """Parse an AutoCAD DWG file by converting it via ezdxf's odafc addon or raising a clear error."""
    p = Path(filepath)
    if not p.exists():
        raise FileNotFoundError(f"DWG file not found: {p}")

    try:
        import ezdxf
        from ezdxf.addons import odafc
    except ImportError:
        raise ImportError(
            "ezdxf is required to parse DWG files. Please run 'pip install ezdxf' first."
        )

    try:
        doc = odafc.readfile(str(p))
        msp = doc.modelspace()
        model = DxfModel(filename=p.name)
        _parse_ezdxf_msp(msp, model)
        return model
    except Exception as e:
        raise ValueError(
            f"Failed to parse DWG file '{p.name}'. Direct binary DWG parsing "
            "requires the ODA File Converter (odafc) to be installed and configured in ezdxf. "
            "Alternatively, please pre-convert your DWG files to DXF format. "
            f"Original error: {e}"
        ) from e


def parse_dxf_file(filepath: str | Path) -> DxfModel:
    """Parse a DXF or DWG file from disk and return structured DxfModel."""
    p = Path(filepath)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {p}")

    if p.suffix.lower() == ".dwg":
        return parse_dwg_file(p)

    # Check for ezdxf optional package
    try:
        import ezdxf
        doc = ezdxf.readfile(str(p))
        msp = doc.modelspace()
        model = DxfModel(filename=p.name)
        _parse_ezdxf_msp(msp, model)
        return model
    except ImportError:
        pass

    # Fallback to pure-Python group-code parser
    with open(p, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    model = parse_dxf_stream(lines)
    model.filename = p.name
    return model
