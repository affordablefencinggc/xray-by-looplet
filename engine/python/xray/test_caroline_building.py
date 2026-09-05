"""Real-source Caroline geometry regressions; no synthetic building fixture."""
import copy,hashlib,json,math,tempfile,unittest
from pathlib import Path
from xray.caroline_building import build_scene,validate_scene,Builder,FT
from xray.source_building import BuildingError
ROOT=Path(__file__).resolve().parents[3];SOURCE=ROOT/'engine/fixtures/caroline-blueprints-renderings-2025-08-08.pdf';TRACE=ROOT/'engine/fixtures/caroline-source-trace.json'
def normal(a,b,c):
 u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
class CarolineTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.scene=build_scene(SOURCE,TRACE);cls.trace=json.loads(TRACE.read_text());cls.parts={o['id']:o for o in cls.scene['objects']}
 def test_source_identity_copy_and_rejection(self):
  self.assertEqual(self.scene['source']['sha256'],hashlib.sha256(SOURCE.read_bytes()).hexdigest());self.assertEqual(SOURCE.read_bytes(),(ROOT/'public/models/caroline/source.pdf').read_bytes())
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'wrong.pdf';p.write_bytes(SOURCE.read_bytes()+b'x')
   with self.assertRaisesRegex(BuildingError,'SHA-256'):build_scene(p,TRACE)
 def test_finite_nondegenerate_meshes_and_original_page_bounds(self):
  validate_scene(self.scene)
  for o in self.scene['objects']:
   p=o['positions']
   for i in range(0,len(o['indices']),3):
    abc=[p[j*3:j*3+3] for j in o['indices'][i:i+3]];self.assertGreater(sum(v*v for v in normal(*abc)),1e-17,o['id'])
   for r in o['sourceRefs']:
    self.assertIn(r['page'],range(1,19));l,t,rr,b=r['region'];self.assertTrue(0<=l<=rr<=1584 and 0<=t<=b<=1224)
 def test_exact_floor_datums_nominal_trace_tolerance(self):
  self.assertEqual(self.scene['floorElevations']['ground'],0);self.assertAlmostEqual(self.scene['floorElevations']['upper'],9*FT)
  p=self.parts['ground-main']['positions'];self.assertAlmostEqual(max(p[::3])-min(p[::3]),24*FT,places=5)
  self.assertLess(abs((max(p[2::3])-min(p[2::3]))-16*FT),.02)
  for key in ['upper-floor-west','upper-floor-front']:self.assertAlmostEqual(max(self.parts[key]['positions'][1::3]),9*FT)
 def test_all_roof_surfaces_coplanar_and_source_pitches(self):
  for o in self.scene['objects']:
   if o['category']!='roof':continue
   ps=[o['positions'][i:i+3] for i in range(0,len(o['positions']),3)];a,b,c=[ps[i] for i in o['indices'][:3]];n=normal(a,b,c);ln=math.sqrt(sum(v*v for v in n))
   for p in ps:self.assertLess(abs(sum(n[j]*(p[j]-a[j]) for j in range(3)))/ln,2e-6,o['id'])
   pitch=math.hypot(n[0],n[2])/abs(n[1]);self.assertAlmostEqual(pitch,.625 if o['id'].startswith('main-roof') else .25,places=5)
   self.assertEqual(o['evidenceState'],'inferred');self.assertTrue(any(r['evidenceState']=='dimensioned' for r in o['sourceRefs']))
  ps=self.parts['main-roof-north']['positions'];self.assertAlmostEqual(min(ps[1::3]),17.5*FT);self.assertAlmostEqual(max(ps[1::3]),23*FT)
  self.assertAlmostEqual(max(ps[::3])-min(ps[::3]),25*FT,places=5)
 def test_gable_closes_against_actual_roof(self):
  mid=693;scale=FT/18
  for id in ['gable-west','gable-east']:
   p=self.parts[id]['positions'];points=[p[i:i+3] for i in range(0,len(p),3)]
   for x,y,z in points[2:]:self.assertAlmostEqual(y,23*FT-abs((z/scale+548)-mid)*scale*.625,places=5)
 def test_true_upper_stairwell_and_raised_platform(self):
  # Interior of the actual source stairwell: x603..665,z548..640.
  x=(620-233)*FT/18;z=(580-548)*FT/18
  for o in self.scene['objects']:
   if o['level']!='upper' or o['category'] not in ['slab','room']:continue
   p=o['positions'];self.assertFalse(min(p[::3])<x<max(p[::3]) and min(p[2::3])<z<max(p[2::3]),o['id'])
  steps=[o for o in self.scene['objects'] if o['category']=='stair'];self.assertEqual(len(steps),14)
  tops=sorted(max(o['positions'][1::3]) for o in steps)
  for i,y in enumerate(tops):self.assertAlmostEqual(y,(i+1)*9*FT/14,places=5)
  platform=self.parts['raised-closet-platform']['positions'];self.assertAlmostEqual(max(platform[1::3])-9*FT,3*FT)
 def test_rear_gable_closes_against_both_lower_roof_planes(self):
  cap=self.parts['rear-gable-closure'];self.assertEqual(cap['category'],'roof-trim')
  ps=[cap['positions'][i:i+3] for i in range(0,len(cap['positions']),3)]
  ridge=2.66+155*(FT/18)*.25
  for x,y,z in ps[2:]:self.assertAlmostEqual(y,ridge-abs(x/(FT/18)+233-522)*(FT/18)*.25,places=5)
  self.assertEqual({r['page'] for r in cap['sourceRefs']},{8,17})
 def test_front_steps_descend_away_and_join_deck(self):
  steps=[self.parts['front-step-'+str(i)]['positions'] for i in range(3)]
  deck=self.parts['veranda-deck']['positions']
  self.assertAlmostEqual(max(steps[0][1::3]),max(deck[1::3]))
  self.assertAlmostEqual(min(steps[0][2::3]),max(deck[2::3]))
  for i,p in enumerate(steps):
   self.assertAlmostEqual(min(p[1::3]),-.64)
   self.assertAlmostEqual(max(p[1::3]),-.025-i*.205)
   if i:
    self.assertLess(max(p[1::3]),max(steps[i-1][1::3]))
    self.assertAlmostEqual(min(p[2::3]),max(steps[i-1][2::3]))
  self.assertAlmostEqual(max(steps[-1][1::3])-(-.64),.205)
 def test_wall_meshes_preserve_all_source_openings(self):
  scale=FT/18
  for w in self.trace['walls']:
   a,c=w['a'],w['b'];dx=c[0]-a[0];dz=c[1]-a[1];ll=dx*dx+dz*dz;floor=0 if w['level']=='ground' else 9*FT
   parts=[o for o in self.scene['objects'] if o['category']=='wall' and o['id'].startswith(w['id']+'-')]
   for opening in w['openings']:
    mid=(opening['start']+opening['end'])/2
    if opening['kind']=='window':ymid=floor+{1:1.5,2:2,3:3}[opening['type']]*FT+{1:6,2:5,3:3.5}[opening['type']]*FT/2
    else:ymid=floor+1
    for o in parts:
     p=o['positions'];tt=[((p[i]/scale+233-a[0])*dx+(p[i+2]/scale+548-a[1])*dz)/ll for i in range(0,len(p),3)]
     self.assertFalse(min(tt)+1e-5<mid<max(tt)-1e-5 and min(p[1::3])+1e-5<ymid<max(p[1::3])-1e-5,(w['id'],opening['id'],o['id']))
 def test_invalid_opening_interval_rejected(self):
  w=copy.deepcopy(next(w for w in self.trace['walls'] if w['openings']));w['openings'][0]['end']=1.2
  with self.assertRaisesRegex(BuildingError,'opening'):Builder(self.trace).wall(w)
 def test_foundation_supports_present_and_levels_explicit(self):
  walls=[o for o in self.scene['objects'] if o['id'].startswith('foundation-wall')];self.assertEqual(len(walls),6)
  for o in walls:self.assertAlmostEqual(min(o['positions'][1::3]),-.64);self.assertAlmostEqual(max(o['positions'][1::3]),-.254)
  self.assertTrue(all(o['level'] in ['ground','upper','roof'] for o in self.scene['objects']))
  self.assertEqual(self.scene['source']['license'],'CC BY-SA 4.0')
if __name__=='__main__':unittest.main()

