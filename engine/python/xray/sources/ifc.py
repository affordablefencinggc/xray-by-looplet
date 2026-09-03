"""ifc.py — the IFC source adapter."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from xray.ifc import parse_ifc_file
from xray.sources.base import (
    Measure, PageRead, ReadResult, SourceAdapter, Symbol, register,
)

IFC_TRADE = {
    "IFCWALL": "cladding",
    "IFCWALLSTANDARDCASE": "cladding",
    "IFCSLAB": "concrete",
    "IFCROOF": "roofing",
    "IFCDOOR": "openings",
    "IFCWINDOW": "openings",
    "IFCCOLUMN": "structural steel",
    "IFCBEAM": "structural steel",
}


def trade_for_ifc(etype: str) -> str:
    return IFC_TRADE.get(etype.upper(), "")


class IfcAdapter(SourceAdapter):
    name = "ifc"

    def can_read(self, path: str | Path) -> bool:
        return str(path).lower().endswith(".ifc")

    def read(self, path: str | Path) -> ReadResult:
        model = parse_ifc_file(path)

        symbols: list[Symbol] = []
        geometry: list[Measure] = []

        # Convert each IfcElement to a Symbol (counted entity) and/or Measures
        for elem in model.elements:
            attribs = {}
            attribs.update(elem.properties)
            attribs.update(elem.quantities)
            attribs["name"] = elem.name
            attribs["description"] = elem.description
            attribs["storey"] = elem.storey

            symbols.append(Symbol(
                block_name=elem.type,
                layer=elem.storey or "0",
                x=0.0,
                y=0.0,
                attribs=attribs,
                id=str(elem.id),
                trade=trade_for_ifc(elem.type),
            ))

            trade = trade_for_ifc(elem.type)
            for qk, qv in elem.quantities.items():
                qk_lower = qk.lower()
                if "length" in qk_lower or "height" in qk_lower or "width" in qk_lower or "thickness" in qk_lower:
                    geometry.append(Measure(
                        kind="line",
                        value=float(qv),
                        layer=elem.storey or elem.type,
                        trade=trade,
                        id=f"{elem.id}-{qk}",
                    ))
                elif "area" in qk_lower:
                    geometry.append(Measure(
                        kind="polyline",
                        value=0.0,
                        area=float(qv),
                        layer=elem.storey or elem.type,
                        trade=trade,
                        id=f"{elem.id}-{qk}",
                    ))
                else:
                    geometry.append(Measure(
                        kind="dimension",
                        value=float(qv),
                        layer=elem.storey or elem.type,
                        trade=trade,
                        id=f"{elem.id}-{qk}",
                    ))

        # IFC has 1 logical page representing the BIM model space
        pages = [PageRead(
            words=[],
            raw_word_count=0,
            width_pt=0.0,
            height_pt=0.0,
            kind="vector",
        )]

        units = {
            "declared": "m",
            "resolved": "m",
            "basis": "standard metric",
            "mismatch": False,
            "verified": True,
        }

        for g in geometry:
            g.unit = units["resolved"]

        return ReadResult(
            pages=pages,
            producer="ifc-parser",
            symbols=symbols,
            geometry=geometry,
            units=units,
            provenance={"suspect": False, "reasons": []},
        )


register(IfcAdapter())
