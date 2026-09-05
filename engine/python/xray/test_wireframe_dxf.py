import unittest
import ezdxf
from ezdxf.math import Matrix44
from xray.sources.dxf import expand_inserts


class NestedPlacementTests(unittest.TestCase):
    def test_nested_translation_rotation_reflection_nonuniform_scale_and_basepoint(self):
        doc = ezdxf.new()
        leaf = doc.blocks.new('LEAF'); leaf.add_line((0,0),(1,1))
        nested = doc.blocks.new('NESTED', base_point=(1,2))
        child = nested.add_blockref('LEAF',(3,4), dxfattribs={'rotation': 90, 'xscale': 2, 'yscale': .5})
        assembly = doc.blocks.new('ASSEMBLY', base_point=(-2,1))
        mid = assembly.add_blockref('NESTED',(5,2), dxfattribs={'rotation': 90, 'xscale': -1, 'yscale': 3})
        parent = doc.modelspace().add_blockref('ASSEMBLY',(40,50), dxfattribs={'rotation': 45, 'xscale': 2, 'yscale': .5})
        symbols = list(expand_inserts(doc.modelspace(), doc.blocks))
        self.assertEqual(len(symbols), 3)
        expected = (mid.matrix44() @ parent.matrix44()).transform(child.dxf.insert)
        self.assertAlmostEqual(symbols[2].x, expected.x)
        self.assertAlmostEqual(symbols[2].y, expected.y)
        self.assertEqual(symbols[2].id, '/'.join([parent.dxf.handle, mid.dxf.handle, child.dxf.handle]))
        self.assertEqual(symbols[2].parent_id, symbols[1].id)
        import math
        full = child.matrix44() @ mid.matrix44() @ parent.matrix44()
        axis = full.transform_direction((1,0,0))
        self.assertAlmostEqual(symbols[2].xscale*math.cos(math.radians(symbols[2].rotation)), axis.x)
        self.assertAlmostEqual(symbols[2].xscale*math.sin(math.radians(symbols[2].rotation)), axis.y)
        child.dxf.rotation = 30
        with self.assertRaisesRegex(ValueError, 'sheared'):
            list(expand_inserts(doc.modelspace(), doc.blocks))

    def test_nondefault_ocs_fails_closed(self):
        doc = ezdxf.new(); block=doc.blocks.new('BLOCK');block.add_line((0,0),(1,1))
        doc.modelspace().add_blockref('BLOCK',(1,2),dxfattribs={'extrusion':(0,1,0)})
        with self.assertRaisesRegex(ValueError,'OCS'):
            list(expand_inserts(doc.modelspace(),doc.blocks))

    def test_cyclic_and_excessively_nested_blocks_fail_instead_of_truncate(self):
        doc = ezdxf.new(); a = doc.blocks.new('A'); a.add_blockref('A',(0,0))
        doc.modelspace().add_blockref('A',(0,0))
        with self.assertRaises(ValueError): list(expand_inserts(doc.modelspace(), doc.blocks))


if __name__ == '__main__': unittest.main()
