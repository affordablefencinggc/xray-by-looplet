"""Independent geometry/provenance checks on the real source-bound building."""
import copy
import hashlib
import json
import math
from pathlib import Path
import tempfile
import unittest
from xray.source_building import build_scene, validate_scene, BuildingError
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'engine/fixtures/residential-ruffles-seeka.pdf'
TRACE=ROOT/'engine/fixtures/ruffles-source-trace.json'

def normal(a,b,c):
 u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
 return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]

class SourceBuildingTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.scene=build_scene(SOURCE,TRACE)
 def test_exact_source_and_trace_binding(self):
  self.assertEqual(self.scene['source']['sha256'],hashlib.sha256(SOURCE.read_bytes()).hexdigest())
  with tempfile.TemporaryDirectory() as d:
   wrong=Path(d)/'different.pdf';wrong.write_bytes(SOURCE.read_bytes()+b'\nchanged')
   with self.assertRaisesRegex(BuildingError,'SHA-256'):build_scene(wrong,TRACE)
 def test_indices_finite_nonzero_triangles_and_source_bounds(self):
  validate_scene(self.scene)
  for o in self.scene['objects']:
   p=o['positions']
   for i in range(0,len(o['indices']),3):
    a,b,c=[p[k*3:k*3+3] for k in o['indices'][i:i+3]]
    self.assertGreater(sum(x*x for x in normal(a,b,c)),1e-15,o['id'])
   for r in o['sourceRefs']:
    for x,z in r.get('trace',[]):self.assertTrue(0<=x<=1191 and 0<=z<=842,(o['id'],r))
 def test_real_height_extent_and_dimensioned_wall(self):
  ys=[y for o in self.scene['objects'] for y in o['positions'][1::3]]
  self.assertGreater(max(ys),5);self.assertLess(min(ys),0)
  wall=next(o for o in self.scene['objects'] if o['id']=='north-existing-solid-last')
  self.assertAlmostEqual(max(wall['positions'][1::3]),2.72)
  self.assertEqual(self.scene['summary']['wallRuns'],33)
 def test_wall_openings_are_actual_gaps(self):
  trace=json.loads(TRACE.read_text());scale=trace['calibration']['pointsPerMetre'];ox,oz=trace['calibration']['origin']
  for w in trace['walls']:
   a,b=w['a'],w['b'];dx=b[0]-a[0];dz=b[1]-a[1];ll=dx*dx+dz*dz
   pieces=[o for o in self.scene['objects'] if o['category']=='wall' and o['id'].startswith(w['id']+'-')]
   for opening in w['openings']:
    midpoint=(opening['start']+opening['end'])/2;ymid=(opening['bottom']+opening['top'])/2
    for piece in pieces:
     ps=piece['positions'];ts=[(((ps[i]*scale+ox)-a[0])*dx+((ps[i+2]*scale+oz)-a[1])*dz)/ll for i in range(0,len(ps),3)]
     covers=min(ts)+1e-5<midpoint<max(ts)-1e-5 and min(ps[1::3])+1e-5<ymid<max(ps[1::3])-1e-5
     self.assertFalse(covers,(w['id'],opening['id'],piece['id']))
 def test_solar_skylight_and_flyover_coplanarity(self):
  for o in self.scene['objects']:
   if o['category'] not in ['solar','skylight'] and o['id'] not in ['patio-flyover','cat-flyover']:continue
   ps=[o['positions'][i:i+3] for i in range(0,len(o['positions']),3)];n=normal(*ps[:3]);length=math.sqrt(sum(v*v for v in n))
   for p in ps:self.assertLess(abs(sum(n[j]*(p[j]-ps[0][j]) for j in range(3)))/length,1e-4,o['id'])
   if 'flyover' in o['id']:
    slope=math.degrees(math.atan2(math.hypot(n[0],n[2]),abs(n[1])))
    self.assertAlmostEqual(slope,6.9,places=2)
 def test_roof_slopes_use_source_pitch(self):
  pitches=[]
  for o in self.scene['objects']:
   if o['category']!='roof' or 'flyover' in o['id']:continue
   ps=o['positions']
   for i in range(0,len(o['indices']),3):
    pts=[ps[j*3:j*3+3] for j in o['indices'][i:i+3]];n=normal(*pts)
    pitches.append(math.degrees(math.atan2(math.hypot(n[0],n[2]),abs(n[1]))))
  close=sum(abs(p-22.5)<.2 for p in pitches)
  self.assertGreater(close/len(pitches),.90)
 def test_every_roof_group_is_coplanar(self):
  for o in self.scene['objects']:
   if o['category']!='roof':continue
   ps=[o['positions'][i:i+3] for i in range(0,len(o['positions']),3)]
   # Use the largest face as reference, so rounded tiny intersection slivers do
   # not magnify the five-decimal serialization tolerance in the fitted normal.
   tris=[[ps[i] for i in o['indices'][j:j+3]] for j in range(0,len(o['indices']),3)]
   a,b,c=max(tris,key=lambda q:sum(v*v for v in normal(*q)))
   n=normal(a,b,c);length=math.sqrt(sum(v*v for v in n))
   self.assertGreater(length,0)
   for p in ps:self.assertLess(abs(sum(n[j]*(p[j]-a[j]) for j in range(3)))/length,1e-4,o['id'])
 def test_rejects_forged_mesh_and_source_region(self):
  s=copy.deepcopy(self.scene);s['objects'][0]['positions'][0]=float('nan')
  with self.assertRaisesRegex(BuildingError,'positions'):validate_scene(s)
  s=copy.deepcopy(self.scene);s['objects'][0]['indices'][0]=999999
  with self.assertRaisesRegex(BuildingError,'indices'):validate_scene(s)
  s=copy.deepcopy(self.scene);s['objects'][0]['sourceRefs'][0]['trace']=[[-1,1]]
  with self.assertRaisesRegex(BuildingError,'outside'):validate_scene(s)
if __name__=='__main__':unittest.main()

