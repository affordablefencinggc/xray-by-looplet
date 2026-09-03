#!/usr/bin/env python3
"""
scripts/demo-proof-hardware.py
Demonstrates X-Ray's deterministic hardware, bolt, and nut calculation
for both highrise structural steel connections and residential framing.
"""

import sys
from pathlib import Path

# Add engine/python to path
sys.path.insert(0, str(Path(__file__).parent.parent / "engine" / "python"))

try:
    from xray.assemblies import WallInput, expand_wall
    from xray.quantify import Quantity
except ImportError:
    from engine.python.xray.assemblies import WallInput, expand_wall  # type: ignore
    from engine.python.xray.quantify import Quantity  # type: ignore

def demo_highrise_structural_hardware(floors: int = 16, bays_x: int = 6, bays_y: int = 4):
    """
    Demonstrates deterministic structural column & beam connection hardware count
    for a multi-storey/highrise commercial tower.
    """
    print(f"\n==================================================================")
    print(f" [HIGHRISE] STRUCTURAL STEEL & HARDWARE AUDIT: {floors} STOREYS")
    print(f"==================================================================")
    
    # 1. Grid of columns: (bays_x + 1) * (bays_y + 1)
    cols_per_floor = (bays_x + 1) * (bays_y + 1)
    total_columns = cols_per_floor * floors
    
    # 2. Beams per floor:
    # X-direction beams: bays_x * (bays_y + 1)
    # Y-direction beams: bays_y * (bays_x + 1)
    beams_per_floor = (bays_x * (bays_y + 1)) + (bays_y * (bays_x + 1))
    total_beams = beams_per_floor * floors
    
    # 3. Connection Schedules (Standard Structural Engineering Recipes):
    # - Baseplates (Ground level only): 4x M24 Grade 8.8 chemical anchor bolts + 8 washers + 4 locknuts per column
    baseplates = cols_per_floor
    m24_baseplate_bolts = baseplates * 4
    m24_baseplate_nuts = baseplates * 4
    m24_baseplate_washers = baseplates * 8
    
    # - Column Splices (Every 2 storeys starting at L2):
    splice_levels = floors // 2 - 1
    total_splices = cols_per_floor * splice_levels
    # Type SP-1: 8x M20 Grade 8.8 bolts + 16 hardened washers + 8 locknuts per splice
    m20_splice_bolts = total_splices * 8
    m20_splice_nuts = total_splices * 8
    m20_splice_washers = total_splices * 16
    
    # - Beam-to-Column Moment/Shear Connections (2 connections per beam):
    total_beam_connections = total_beams * 2
    # Type BC-1 Shear Tab: 4x M20 Grade 8.8 high-strength bolts + 8 washers + 4 nuts
    m20_beam_bolts = total_beam_connections * 4
    m20_beam_nuts = total_beam_connections * 4
    m20_beam_washers = total_beam_connections * 8
    
    # Total Hardware Rollup
    total_bolts = m24_baseplate_bolts + m20_splice_bolts + m20_beam_bolts
    total_nuts = m24_baseplate_nuts + m20_splice_nuts + m20_beam_nuts
    total_washers = m24_baseplate_washers + m20_splice_washers + m20_beam_washers

    print(f"Structural Framework:")
    print(f"  * Storeys:                  {floors}")
    print(f"  * Columns:                  {total_columns} members ({cols_per_floor}/floor)")
    print(f"  * Beams:                    {total_beams} members ({beams_per_floor}/floor)")
    print(f"  * Column Splices:           {total_splices} connections (every 2 floors)")
    print(f"  * Beam Framing Connections: {total_beam_connections} connections")
    print(f"\nExact Bolt & Nut Itemized Bill of Materials (BOM):")
    print(f"  [1] M24 Grade 8.8 Baseplate Anchors:   {m24_baseplate_bolts:>6} ea  (4 bolts/baseplate)")
    print(f"  [2] M20 Grade 8.8 Column Splice Bolts: {m20_splice_bolts:>6} ea  (8 bolts/splice)")
    print(f"  [3] M20 Grade 8.8 Beam Shear Bolts:    {m20_beam_bolts:>6} ea  (4 bolts/connection)")
    print(f"  --------------------------------------------------------")
    print(f"  >> TOTAL STRUCTURAL BOLTS:             {total_bolts:>6} ea")
    print(f"  >> TOTAL STRUCTURAL NUTS:              {total_nuts:>6} ea")
    print(f"  >> TOTAL HARDENED WASHERS:             {total_washers:>6} ea")

def demo_framing_and_fixings():
    """
    Demonstrates deterministic fixing calculation for measured wall takeoff via xray.assemblies.
    """
    print(f"\n==================================================================")
    print(f" [FRAMING] DETERMINISTIC RESIDENTIAL FRAMING & FIXING EXPANSION")
    print(f"==================================================================")
    wall = WallInput(length_m=18.0, height_m=2.7, label="W-EXT-01", evidence=("cad:lwpolyline-882",))
    expanded = expand_wall(wall)
    for q in expanded:
        print(f"  * {q.item:<26} : {q.qty:>6} {q.unit:<3} | Formula: {q.formula}")

if __name__ == "__main__":
    demo_highrise_structural_hardware(floors=16)
    demo_framing_and_fixings()
