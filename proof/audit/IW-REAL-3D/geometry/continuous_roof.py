from pathlib import Path
p=Path('engine/python/xray/source_building.py');s=p.read_text(encoding='utf-8-sig');start=s.index('    # Traced pitched roof surface graph;');end=s.index('    def slope_panel',start)
new='''    # Continuous intersecting roof masses. Source drawing provides the plan and
    # approximate pitch, but no surveyed ridge elevations. Their junctions are
    # explicitly inferred, rather than turning conflicting traces into warped faces.
    rt=trace['roofRegistration']['toFloorTranslation']
    masses=[('main',[-56,255,515,645]),('east',[362,255,891,562]),
            ('front-cross',[127,409,490,662]),('porch',[485,441,620,610]),
            ('carport',[-230,385,138,615])]
    k=math.tan(math.radians(22.5))/scale
    def roof_height(x,z):
        found=[]
        for name,(left,top,right,bottom) in masses:
            if left-1e-7<=x<=right+1e-7 and top-1e-7<=z<=bottom+1e-7:
                values=[(x-left,'west'),(right-x,'east'),(z-top,'north'),(bottom-z,'south')]
                distance,side=min(values)
                found.append((2.72+max(0,distance)*k,name+'-'+side))
        return max(found) if found else (2.72,'edge')
    def breaks(axis):
        edges=sorted({r[i] for _,r in masses for i in ([0,2] if axis==0 else [1,3])})
        result=[]
        for left,right in zip(edges,edges[1:]):
            steps=math.ceil((right-left)/5)
            result.extend(left+(right-left)*j/steps for j in range(steps))
        return result+[edges[-1]]
    xs,zs=breaks(0),breaks(1);groups={}
    for x0,x1 in zip(xs,xs[1:]):
        for z0,z1 in zip(zs,zs[1:]):
            if not any(l<=(x0+x1)/2<=r and t<=(z0+z1)/2<=b for _,(l,t,r,b) in masses):continue
            raw=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]]
            _,key=roof_height((x0+x1)/2,(z0+z1)/2)
            g=groups.setdefault(key,{'v':[],'i':[],'points':[]});base=len(g['v'])
            g['v'].extend(xyz([x+rt[0],z+rt[1]],roof_height(x,z)[0]) for x,z in raw)
            g['i'].extend([base,base+2,base+1,base,base+3,base+2]);g['points'].extend(raw)
    for key,g in groups.items():
        # Bounded source regions point back to the actual page, including the west
        # extension which appears on page15 rather than negative page16 coordinates.
        ps=g['points'];page=15 if min(v[0] for v in ps)<0 else 16
        sourcepts=[[x+266,z+108] for x,z in ps] if page==15 else ps
        left=min(p[0] for p in sourcepts);top=min(p[1] for p in sourcepts)
        right=max(p[0] for p in sourcepts);bottom=max(p[1] for p in sourcepts)
        refs=[ref(page,[[left,top],[right,bottom]],'inferred',
                  'Source-bound roof mass extent; continuous hip intersections inferred from approx22.5degree pitch. Grid triangles approximate intersection boundaries.'),
              ref(18,[[80,28],[535,220]],'dimensioned','Approx22.5degree pitch and2.72m ceiling.')]
        mesh('roof-'+key,'roof',key.replace('-',' ')+' roof plane',g['v'],g['i'],'roof',refs,'inferred')
'''
s=s[:start]+new+s[end:];s=s.replace("len(trace['roofFaces'])+2","sum(o['category']=='roof' for o in objects)");s=s.replace('Local junction simplification can alter individual plane pitch.','Continuous source-bound hip mass intersections are inferred; grid triangles approximate intersection boundaries.');p.write_text(s,encoding='utf8')
