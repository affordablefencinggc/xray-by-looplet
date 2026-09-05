# Source building scene contract

`xray.source-building/v1`, metres, +X drawing right, +Y elevation up, +Z drawing down. This is a curated reconstruction of the SHA-256-bound Ruffles source, not automatic semantic PDF extraction. Preliminary/source-approximate dimensions are not construction quantities.

Top-level: `schema`, `source {name,sha256,pageCount}`, `units`, `coordinateSystem`, `bounds {min:[x,y,z],max:[x,y,z]}`, `materials` (keys map to `{color,opacity?,roughness?,metalness?}`), `objects`, `assumptions[]`, `sourceSheets[]`, `summary`.

Each `objects[]`: `{id,category,label,positions:number[],indices:number[],material:string,sourceRefs:[{page,region:[left,top,right,bottom],trace?,dimension?,evidenceState,note}],evidenceState,note?}`. Positions are flat xyz; indices form triangles. Source regions and traces use displayed PDF page points, top-left origin, 1191x842. Categories: wall, roof, slab, column, window, door, fixture, solar, skylight, trim, fence. Every mesh has source references. Walls are split around actual openings; mesh triangles never fill an opening. Roof meshes are traced individual slope faces and closure/gable faces. Roof details are separate hideable objects.

Output: `public/models/ruffles/source-building.json`; source images `public/models/ruffles/source-page-{11,13,15,16,17,18,19}.png`. Builder: `engine/python/xray/source_building.py`; curated source trace: `engine/fixtures/ruffles-source-trace.json`. Evidence: `proof/audit/IW-REAL-3D/geometry/`. UI ownership is separate.

SourceSheets entries: `{page,title,image,width:1191,height:842,role}`; image is absolute web path. `assumptions` entries are strings explaining approximation and undisclosed interiors. Roof OFF should hide roof/solar/skylight/roof trim; wall cutaway should preserve slab/interior/fixtures. No terrain or hidden room layout invented.
