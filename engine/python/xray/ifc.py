"""ifc.py — Direct IFC (Industry Foundation Classes) BIM model parser.

Parses STEP physical files (ISO 10303-21) representing IFC2X3, IFC4, and IFC4X3
BIM models. Extracts spatial hierarchy, building storeys, walls, slabs, roofs,
openings, and property sets for quantity takeoff and structural BOM generation.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class IfcElement:
    id: int
    type: str  # IFCWALL, IFCSLAB, IFCROOF, IFCDOOR, IFCWINDOW, etc.
    name: str = ""
    description: str = ""
    storey: str = ""
    quantities: Dict[str, float] = field(default_factory=dict)
    properties: Dict[str, Any] = field(default_factory=dict)
    bbox: Tuple[float, float, float, float, float, float] = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)


@dataclass
class IfcBimModel:
    filename: str
    schema: str = "IFC4"
    project_name: str = ""
    storeys: List[str] = field(default_factory=list)
    elements: List[IfcElement] = field(default_factory=list)
    quantities_by_type: Dict[str, Dict[str, float]] = field(default_factory=dict)


# Regex patterns for ISO 10303-21 STEP physical files
_SCHEMA_RE = re.compile(r"FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'\s*\)\s*\)", re.I)


def parse_step_entities(content: str) -> Dict[int, Tuple[str, List[Any]]]:
    """Safely strip comments and parse balanced-parentheses STEP entities and nested parameter lists."""
    # 1. Safely strip comments while preserving strings
    clean_chars = []
    i = 0
    n = len(content)
    in_string = False
    while i < n:
        if not in_string and content[i:i+2] == '/*':
            i += 2
            while i < n and content[i:i+2] != '*/':
                i += 1
            i += 2
            continue
        if content[i] == "'":
            # Handle escaped single quote
            if in_string and i + 1 < n and content[i+1] == "'":
                clean_chars.append("''")
                i += 2
                continue
            in_string = not in_string
        clean_chars.append(content[i])
        i += 1
    
    clean_content = "".join(clean_chars)
    
    # 2. Extract and parse entities
    entities = {}
    i = 0
    n = len(clean_content)
    while i < n:
        while i < n and clean_content[i] != '#':
            i += 1
        if i >= n:
            break
        
        # ID
        i += 1
        id_start = i
        while i < n and clean_content[i].isdigit():
            i += 1
        if id_start == i:
            continue
        eid = int(clean_content[id_start:i])
        
        # Expect '='
        while i < n and clean_content[i].isspace():
            i += 1
        if i >= n or clean_content[i] != '=':
            continue
        i += 1
        
        # Type name
        while i < n and clean_content[i].isspace():
            i += 1
        type_start = i
        while i < n and (clean_content[i].isalnum() or clean_content[i] == '_'):
            i += 1
        etype = clean_content[type_start:i].upper()
        
        # Expect '('
        while i < n and clean_content[i].isspace():
            i += 1
        if i >= n or clean_content[i] != '(':
            continue
        i += 1
        
        # Parse balanced params
        param_start = i
        paren_depth = 1
        in_string = False
        while i < n and paren_depth > 0:
            c = clean_content[i]
            if c == "'":
                if in_string and i + 1 < n and clean_content[i+1] == "'":
                    i += 2
                    continue
                in_string = not in_string
            elif not in_string:
                if c == '(':
                    paren_depth += 1
                elif c == ')':
                    paren_depth -= 1
            i += 1
            
        if paren_depth == 0:
            params_str = clean_content[param_start:i-1]
            params = parse_step_params(params_str)
            entities[eid] = (etype, params)
            
            while i < n and clean_content[i] != ';':
                i += 1
            if i < n:
                i += 1
    return entities


def parse_step_params(params_str: str) -> List[Any]:
    """Parse a STEP parameter list into recursive Python lists, strings, enums, numbers."""
    params_str = params_str.strip()
    if not params_str:
        return []
    
    out = []
    i = 0
    n = len(params_str)
    while i < n:
        while i < n and (params_str[i].isspace() or params_str[i] == ','):
            i += 1
        if i >= n:
            break
        
        c = params_str[i]
        if c == "'":
            i += 1
            str_chars = []
            while i < n:
                if params_str[i] == "'":
                    if i + 1 < n and params_str[i+1] == "'":
                        str_chars.append("'")
                        i += 2
                        continue
                    else:
                        i += 1
                        break
                str_chars.append(params_str[i])
                i += 1
            out.append("".join(str_chars))
        elif c == '(':
            i += 1
            list_start = i
            paren_depth = 1
            in_string = False
            while i < n and paren_depth > 0:
                char = params_str[i]
                if char == "'":
                    if in_string and i + 1 < n and params_str[i+1] == "'":
                        i += 2
                        continue
                    in_string = not in_string
                elif not in_string:
                    if char == '(':
                        paren_depth += 1
                    elif char == ')':
                        paren_depth -= 1
                i += 1
            nested_str = params_str[list_start:i-1]
            out.append(parse_step_params(nested_str))
        elif c == '$':
            out.append(None)
            i += 1
        elif c == '#':
            i += 1
            ref_start = i
            while i < n and params_str[i].isdigit():
                i += 1
            out.append(f"#{params_str[ref_start:i]}")
        else:
            val_start = i
            while i < n and not (params_str[i].isspace() or params_str[i] in [',', '(', ')', "'"]):
                i += 1
            val_str = params_str[val_start:i].strip()
            if not val_str:
                continue
            try:
                if '.' in val_str:
                    out.append(float(val_str))
                else:
                    out.append(int(val_str))
            except ValueError:
                out.append(val_str)
    return out


def resolve_step_value(param: Any) -> Any:
    """Normalize wrapped nominal or parsed values."""
    if isinstance(param, (int, float)):
        return param
    if isinstance(param, str):
        if param == ".T.":
            return True
        if param == ".F.":
            return False
        return param
    if isinstance(param, list):
        if len(param) == 1:
            return resolve_step_value(param[0])
        return [resolve_step_value(p) for p in param]
    return param


def extract_single_value(params: List[Any]) -> Any:
    """Extract nominal value from IFCPROPERTYSINGLEVALUE parameters."""
    if len(params) < 3:
        return None
    val = params[2]
    if isinstance(val, str) and len(params) > 3 and isinstance(params[3], list):
        inner_val = params[3]
        return resolve_step_value(inner_val)
    return resolve_step_value(val)


def extract_quantity_value(params: List[Any]) -> float | None:
    """Extract numeric value from IFCQUANTITY* parameters."""
    if len(params) < 4:
        return None
    val = params[3]
    if isinstance(val, str) and len(params) > 4 and isinstance(params[4], list):
        resolved = resolve_step_value(params[4])
    else:
        resolved = resolve_step_value(val)
    
    if isinstance(resolved, (int, float)):
        return float(resolved)
    try:
        return float(resolved)
    except (ValueError, TypeError):
        return None


def parse_ifc_file_pure(filepath: Path) -> IfcBimModel:
    """Zero-dependency pure-Python ISO 10303-21 STEP physical file parser."""
    model = IfcBimModel(filename=filepath.name)

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    schema_match = _SCHEMA_RE.search(content)
    if schema_match:
        model.schema = schema_match.group(1)

    raw_entities = parse_step_entities(content)

    # 1. First Pass: Find project, storeys, and building elements
    elements_map: Dict[int, IfcElement] = {}
    storeys_map: Dict[int, str] = {}

    for eid, (etype, params) in raw_entities.items():
        if etype == "IFCPROJECT":
            if len(params) > 2 and isinstance(params[2], str):
                model.project_name = params[2]
            elif len(params) > 0 and isinstance(params[0], str):
                model.project_name = params[0]
        elif etype == "IFCBUILDINGSTOREY":
            sname = params[2] if len(params) > 2 and isinstance(params[2], str) else (params[0] if len(params) > 0 and isinstance(params[0], str) else f"Storey #{eid}")
            storeys_map[eid] = sname
            model.storeys.append(sname)
        elif etype in [
            "IFCWALL",
            "IFCWALLSTANDARDCASE",
            "IFCSLAB",
            "IFCROOF",
            "IFCDOOR",
            "IFCWINDOW",
            "IFCCOLUMN",
            "IFCBEAM",
            "IFCMEMBER",
            "IFCFOOTING",
        ]:
            name = params[2] if len(params) > 2 and isinstance(params[2], str) else (params[0] if len(params) > 0 and isinstance(params[0], str) else f"{etype} #{eid}")
            desc = params[3] if len(params) > 3 and isinstance(params[3], str) else ""
            elem = IfcElement(
                id=eid,
                type=etype,
                name=name,
                description=desc,
            )
            elements_map[eid] = elem
            model.elements.append(elem)

    # 2. Second Pass: Process relationships, properties, quantities
    for eid, (etype, params) in raw_entities.items():
        if etype == "IFCRELCONTAINEDINSPATIALSTRUCTURE":
            # Link elements to storey
            related_ids = []
            storey_id = None
            for p in params:
                if isinstance(p, list):
                    refs = [x for x in p if isinstance(x, str) and x.startswith("#")]
                    if refs:
                        related_ids = [int(x[1:]) for x in refs]
                elif isinstance(p, str) and p.startswith("#"):
                    storey_id = int(p[1:])
            
            if storey_id in storeys_map:
                sname = storeys_map[storey_id]
                for rel_id in related_ids:
                    if rel_id in elements_map:
                        elements_map[rel_id].storey = sname

        elif etype == "IFCRELDEFINESBYPROPERTIES":
            # Link property set/quantities to elements
            related_ids = []
            prop_def_id = None
            for p in params:
                if isinstance(p, list):
                    refs = [x for x in p if isinstance(x, str) and x.startswith("#")]
                    if refs:
                        related_ids = [int(x[1:]) for x in refs]
                elif isinstance(p, str) and p.startswith("#"):
                    prop_def_id = int(p[1:])
            
            if prop_def_id in raw_entities:
                ptype, pparams = raw_entities[prop_def_id]
                
                # Retrieve the nested property/quantity references
                nested_refs = []
                for pp in pparams:
                    if isinstance(pp, list):
                        nested_refs = [x for x in pp if isinstance(x, str) and x.startswith("#")]
                        break
                
                # Resolve each property/quantity
                for ref in nested_refs:
                    ref_id = int(ref[1:])
                    if ref_id in raw_entities:
                        rtype, rparams = raw_entities[ref_id]
                        if rtype == "IFCPROPERTYSINGLEVALUE" and len(rparams) >= 1:
                            p_name = rparams[0]
                            p_val = extract_single_value(rparams)
                            for rel_id in related_ids:
                                if rel_id in elements_map:
                                    elements_map[rel_id].properties[p_name] = p_val
                        elif rtype in ["IFCQUANTITYLENGTH", "IFCQUANTITYAREA", "IFCQUANTITYVOLUME", "IFCQUANTITYCOUNT", "IFCQUANTITYWEIGHT"] and len(rparams) >= 1:
                            q_name = rparams[0]
                            q_val = extract_quantity_value(rparams)
                            if q_val is not None:
                                for rel_id in related_ids:
                                    if rel_id in elements_map:
                                        elements_map[rel_id].quantities[q_name] = q_val

    _aggregate_quantities(model)
    return model


def parse_ifc_file(filepath: str | Path) -> IfcBimModel:
    """Parse an IFC SPF file into structured BIM model and quantities."""
    p = Path(filepath)
    if not p.exists():
        raise FileNotFoundError(f"IFC file not found: {p}")

    # Optional ifcopenshell integration
    try:
        import ifcopenshell
        import ifcopenshell.util.element
        f = ifcopenshell.open(str(p))
        model = IfcBimModel(filename=p.name)
        model.schema = f.schema

        projects = f.by_type("IfcProject")
        if projects:
            model.project_name = projects[0].Name or ""

        storeys = f.by_type("IfcBuildingStorey")
        for st in storeys:
            model.storeys.append(st.Name or f"Storey #{st.id()}")

        product_types = [
            "IfcWall",
            "IfcWallStandardCase",
            "IfcSlab",
            "IfcRoof",
            "IfcDoor",
            "IfcWindow",
            "IfcColumn",
            "IfcBeam",
            "IfcMember",
            "IfcFooting",
        ]

        for ptype in product_types:
            for item in f.by_type(ptype):
                elem = IfcElement(
                    id=item.id(),
                    type=ptype.upper(),
                    name=item.Name or "",
                    description=getattr(item, "Description", "") or "",
                )
                # Extract spatial structure
                try:
                    for rel in item.ContainedInStructure:
                        if rel.is_a("IfcRelContainedInSpatialStructure") and rel.RelatingStructure.is_a("IfcBuildingStorey"):
                            elem.storey = rel.RelatingStructure.Name or ""
                except Exception:
                    pass

                # Extract quantities
                psets = ifcopenshell.util.element.get_psets(item)
                for pset_name, pvals in psets.items():
                    if "qto" in pset_name.lower() or "quantity" in pset_name.lower():
                        for qk, qv in pvals.items():
                            if isinstance(qv, (int, float)):
                                elem.quantities[qk] = float(qv)
                    else:
                        for pk, pv in pvals.items():
                            elem.properties[pk] = pv

                model.elements.append(elem)

        _aggregate_quantities(model)
        return model
    except ImportError:
        pass

    # Pure-Python STEP scanner
    return parse_ifc_file_pure(p)


def _aggregate_quantities(model: IfcBimModel):
    for elem in model.elements:
        t = elem.type
        if t not in model.quantities_by_type:
            model.quantities_by_type[t] = {"count": 0.0}
        model.quantities_by_type[t]["count"] += 1.0

        for qk, qv in elem.quantities.items():
            if qk not in model.quantities_by_type[t]:
                model.quantities_by_type[t][qk] = 0.0
            model.quantities_by_type[t][qk] += qv
