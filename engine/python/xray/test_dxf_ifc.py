"""Unit tests for DXF and IFC parser modules."""

import math
import tempfile
from pathlib import Path
import pytest
from xray.dxf import parse_dxf_stream, parse_dxf_file
from xray.ifc import parse_ifc_file

def test_dxf_parsing():
    sample_dxf = """0
SECTION
2
ENTITIES
0
LINE
8
WALLS
10
0.0
20
0.0
30
0.0
11
10.0
21
0.0
31
0.0
0
CIRCLE
8
COLUMNS
10
5.0
20
5.0
30
0.0
40
0.5
0
ENDSEC
0
EOF
"""
    model = parse_dxf_stream(sample_dxf.splitlines())
    assert "WALLS" in model.layers
    assert "COLUMNS" in model.layers
    assert len(model.layers["WALLS"]) == 1
    assert model.layers["WALLS"][0].type == "LINE"
    assert model.layers["WALLS"][0].length == 10.0
    assert len(model.layers["COLUMNS"]) == 1
    assert model.layers["COLUMNS"][0].type == "CIRCLE"
    print("test_dxf_parsing: PASS")

def test_dxf_multi_vertex_polyline():
    # Test LWPOLYLINE multi-vertex
    lwpolyline_dxf = """0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
OUTLINE
10
0.0
20
0.0
10
3.0
20
4.0
0
ENDSEC
0
EOF
"""
    model = parse_dxf_stream(lwpolyline_dxf.splitlines())
    assert "OUTLINE" in model.layers
    entities = model.layers["OUTLINE"]
    assert len(entities) == 1
    assert entities[0].type == "LWPOLYLINE"
    assert len(entities[0].points) == 2
    assert entities[0].points[0] == (0.0, 0.0, 0.0)
    assert entities[0].points[1] == (3.0, 4.0, 0.0)
    assert entities[0].length == 5.0  # hypot(3, 4)

    # Test old-style POLYLINE with VERTEX sub-entities
    polyline_dxf = """0
SECTION
2
ENTITIES
0
POLYLINE
8
CONTOUR
0
VERTEX
8
CONTOUR
10
10.0
20
10.0
30
1.0
0
VERTEX
8
CONTOUR
10
13.0
20
14.0
30
1.0
0
SEQEND
0
ENDSEC
0
EOF
"""
    model2 = parse_dxf_stream(polyline_dxf.splitlines())
    assert "CONTOUR" in model2.layers
    entities2 = model2.layers["CONTOUR"]
    assert len(entities2) == 1
    assert entities2[0].type == "POLYLINE"
    assert len(entities2[0].points) == 2
    assert entities2[0].points[0] == (10.0, 10.0, 1.0)
    assert entities2[0].points[1] == (13.0, 14.0, 1.0)
    assert entities2[0].length == 5.0  # hypot(3, 4)
    print("test_dxf_multi_vertex_polyline: PASS")

def test_dxf_circle_arc_dim_point():
    sample_entities = """0
SECTION
2
ENTITIES
0
CIRCLE
8
LAYER_A
10
0.0
20
0.0
30
0.0
40
10.0
0
ARC
8
LAYER_A
10
0.0
20
0.0
30
0.0
40
10.0
50
0.0
51
90.0
0
DIMENSION
8
LAYER_B
42
25.4
1
25.4 mm (FIELD VERIFY)
0
POINT
8
LAYER_B
10
1.5
20
2.5
30
3.5
0
ENDSEC
0
EOF
"""
    model = parse_dxf_stream(sample_entities.splitlines())
    assert "LAYER_A" in model.layers
    assert "LAYER_B" in model.layers

    layer_a = model.layers["LAYER_A"]
    assert len(layer_a) == 2
    
    # CIRCLE assertion
    circle = next(e for e in layer_a if e.type == "CIRCLE")
    assert math.isclose(circle.length, 2 * math.pi * 10.0)
    assert circle.properties["radius"] == 10.0

    # ARC assertion
    arc = next(e for e in layer_a if e.type == "ARC")
    assert math.isclose(arc.length, 0.25 * 2 * math.pi * 10.0)
    assert arc.properties["start_angle"] == 0.0
    assert arc.properties["end_angle"] == 90.0

    layer_b = model.layers["LAYER_B"]
    assert len(layer_b) == 2

    # DIMENSION assertion
    dim = next(e for e in layer_b if e.type == "DIMENSION")
    assert dim.length == 25.4
    assert dim.properties["measured"] == 25.4
    assert dim.properties["text"] == "25.4 mm (FIELD VERIFY)"

    # POINT assertion
    point = next(e for e in layer_b if e.type == "POINT")
    assert point.points[0] == (1.5, 2.5, 3.5)
    assert point.length == 0.0

    print("test_dxf_circle_arc_dim_point: PASS")

def test_dwg_file_parsing_unsupported():
    # Create a mock DWG file with AC version magic bytes
    with tempfile.NamedTemporaryFile("wb", suffix=".dwg", delete=False) as f:
        f.write(b"AC1015_some_fake_dwg_binary_data")
        tmp_path = f.name

    try:
        # Calling parse_dxf_file on a .dwg file should try parse_dwg_file, 
        # which raises ValueError (since ODA File Converter is not installed)
        with pytest.raises(ValueError) as exc_info:
            parse_dxf_file(tmp_path)
        
        err_msg = str(exc_info.value)
        assert "Failed to parse DWG file" in err_msg
        assert "ODA File Converter" in err_msg
        print("test_dwg_file_parsing_unsupported: PASS")
    finally:
        Path(tmp_path).unlink(missing_ok=True)

def test_ifc_parsing():
    sample_ifc = """ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0123',#2,'Sample Project',$,$,$,$,$,$);
#10=IFCBUILDINGSTOREY('0124',#2,'Ground Floor',$,$,$,$,$,$,$);
#20=IFCWALL('0125',#2,'Exterior Wall - North','Brick Veneer',$,$,$,$);
#21=IFCWALL('0126',#2,'Exterior Wall - South','Brick Veneer',$,$,$,$);
#30=IFCSLAB('0127',#2,'Floor Slab','Concrete 100mm',$,$,$,$);
ENDSEC;
END-10303-21;
"""
    with tempfile.NamedTemporaryFile("w", suffix=".ifc", delete=False) as f:
        f.write(sample_ifc)
        tmp_path = f.name

    try:
        model = parse_ifc_file(tmp_path)
        assert model.schema == "IFC4"
        assert model.project_name == "Sample Project"
        assert "Ground Floor" in model.storeys
        assert len(model.elements) == 3
        assert model.quantities_by_type["IFCWALL"]["count"] == 2.0
        assert model.quantities_by_type["IFCSLAB"]["count"] == 1.0
        print("test_ifc_parsing: PASS")
    finally:
        Path(tmp_path).unlink(missing_ok=True)

if __name__ == "__main__":
    test_dxf_parsing()
    test_dxf_multi_vertex_polyline()
    test_dxf_circle_arc_dim_point()
    test_dwg_file_parsing_unsupported()
    test_ifc_parsing()
    print("All DXF and IFC parser tests passed successfully!")
