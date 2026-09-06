import {
  validateProject,
  unit,
  add,
  mul,
  wallThickness,
  type Point,
  type ArchitectProject,
} from "./model.ts";
import { wallOutline, rectangle, roofFaces, roofTrims, type Polygon } from "./geometry.ts";
export function exportIfc(project: ArchitectProject) {
  const p = validateProject(project),
    lines: string[] = [],
    put = (s: string) => {
      lines.push(`#${lines.length + 1}=${s};`);
      return "#" + lines.length;
    },
    str = (s: string) =>
      "'" +
      s
        .replace(/'/g, "''")
        .replace(
          /[^\x20-\x7e]/g,
          (c) => "\\X2\\" + c.charCodeAt(0).toString(16).padStart(4, "0").toUpperCase() + "\\X0\\",
        ) +
      "'",
    num = (n: number) => (Number.isInteger(n) ? n + "." : String(Number(n.toFixed(6)))),
    guid = (seed: string) => {
      let a = 0xcbf29ce484222325n,
        b = 0x84222325cbf29ce4n;
      for (const c of seed) {
        a = BigInt.asUintN(64, (a ^ BigInt(c.charCodeAt(0))) * 0x100000001b3n);
        b = BigInt.asUintN(64, (b ^ BigInt(c.charCodeAt(0))) * 0x100000001b3n);
      }
      let n = (a << 64n) | b,
        s = "";
      const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
      for (let i = 0; i < 22; i++) {
        s = chars[Number(n & 63n)] + s;
        n >>= 6n;
      }
      return str(s);
    },
    point = (v: number[]) => put("IFCCARTESIANPOINT((" + v.map(num).join(",") + "))"),
    dir = (v: number[]) => put("IFCDIRECTION((" + v.map(num).join(",") + "))"),
    axis = (v: number[]) => put(`IFCAXIS2PLACEMENT3D(${point(v)},$,$)`),
    origin = axis([0, 0, 0]),
    placement = put(`IFCLOCALPLACEMENT($,${origin})`),
    z = dir([0, 0, 1]),
    context = put(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,0.00001,${origin},$)`),
    lengthUnit = put("IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)"),
    areaUnit = put("IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)"),
    volumeUnit = put("IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)"),
    units = put(`IFCUNITASSIGNMENT((${lengthUnit},${areaUnit},${volumeUnit}))`),
    root = put(`IFCPROJECT(${guid(p.id)},$,${str(p.name)},$,$,$,$,(${context}),${units})`),
    site = put(`IFCSITE(${guid(p.id + "site")},$,'Site',$,$,${placement},$,$,.ELEMENT.,$,$,$,$,$)`),
    building = put(
      `IFCBUILDING(${guid(p.id + "building")},$,${str(p.name)},$,$,${placement},$,$,.ELEMENT.,$,$,$)`,
    );
  const aggregate = (a: string, b: string[], seed: string) =>
    put(`IFCRELAGGREGATES(${guid(seed)},$,$,$,${a},(${b.join(",")}))`);
  aggregate(root, [site], p.id + "project-site");
  aggregate(site, [building], p.id + "site-building");
  const levels = new Map(
    p.levels.map((l) => [
      l.id,
      put(
        `IFCBUILDINGSTOREY(${guid(l.id)},$,${str(l.name)},$,$,${placement},$,$,.ELEMENT.,${num(l.elevation)})`,
      ),
    ]),
  );
  aggregate(building, [...levels.values()], p.id + "levels");
  const contained = new Map(p.levels.map((l) => [l.id, [] as string[]]));
  const polyline = (ring: Point[]) => {
    const pts =
      ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]
        ? ring.slice(0, -1)
        : ring;
    const refs = pts.map((v) => point([v[0], -v[1]]));
    return put(`IFCPOLYLINE((${[...refs, refs[0]].join(",")}))`);
  };
  const solid = (rings: Polygon, bottom: number, height: number) => {
    const outer = polyline(rings[0]),
      profile =
        rings.length > 1
          ? put(
              `IFCARBITRARYPROFILEDEFWITHVOIDS(.AREA.,$,${outer},(${rings.slice(1).map(polyline).join(",")}))`,
            )
          : put(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${outer})`);
    return put(`IFCEXTRUDEDAREASOLID(${profile},${axis([0, 0, bottom])},${z},${num(height)})`);
  };
  const shape = (items: string[], type = "SweptSolid") => {
    const rep = put(`IFCSHAPEREPRESENTATION(${context},'Body',${str(type)},(${items.join(",")}))`);
    return put(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
  };
  const walls = new Map<string, string>();
  for (const w of p.walls) {
    const base = p.levels.find((l) => l.id === w.levelId)!.elevation,
      geometry = shape(wallOutline(w, p).map((r) => solid(r, base, w.height))),
      ref = put(
        `IFCWALL(${guid(w.id)},$,${str(w.name)},'Authored layered wall',$,${placement},${geometry},${str(w.id)},.NOTDEFINED.)`,
      );
    walls.set(w.id, ref);
    contained.get(w.levelId)!.push(ref);
    const layers = w.layers.map((l) => {
        const material = put(`IFCMATERIAL(${str(l.name)},${str(l.kind)},$)`);
        return put(
          `IFCMATERIALLAYER(${material},${num(l.thickness)},${l.kind === "void" ? ".T." : ".F."},${str(l.name)},$,$,$)`,
        );
      }),
      set = put(`IFCMATERIALLAYERSET((${layers.join(",")}),${str(w.name + " layers")},$)`),
      usage = put(
        `IFCMATERIALLAYERSETUSAGE(${set},.AXIS2.,.POSITIVE.,${num(-wallThickness(w) / 2)},$)`,
      );
    put(`IFCRELASSOCIATESMATERIAL(${guid(w.id + "layers")},$,$,$,(${ref}),${usage})`);
  }
  for (const o of p.openings) {
    const w = p.walls.find((w) => w.id === o.wallId)!,
      d = unit(w.a, w.b),
      a = add(w.a, mul(d, o.offset - o.width / 2)),
      b = add(w.a, mul(d, o.offset + o.width / 2)),
      base = p.levels.find((l) => l.id === w.levelId)!.elevation + o.sill,
      t = wallThickness(w) / 2,
      geom = shape(rectangle(a, b, -t - 1, t + 1).map((r) => solid(r, base, o.height))),
      opening = put(
        `IFCOPENINGELEMENT(${guid(o.id + "void")},$,${str(o.tag + " opening")},$,$,${placement},${geom},$,.OPENING.)`,
      );
    put(`IFCRELVOIDSELEMENT(${guid(o.id + "void-rel")},$,$,$,${walls.get(w.id)},${opening})`);
    const fillGeom = shape(rectangle(a, b, -20, 20).map((r) => solid(r, base, o.height))),
      fill = put(
        `${o.kind === "door" ? "IFCDOOR" : "IFCWINDOW"}(${guid(o.id)},$,${str(o.tag)},'Nominal opening envelope; hardware unspecified',$,${placement},${fillGeom},${str(o.id)},${num(o.height)},${num(o.width)},${o.kind === "door" ? ".DOOR.,.NOTDEFINED." : ".WINDOW.,.NOTDEFINED."},$)`,
      );
    put(`IFCRELFILLSELEMENT(${guid(o.id + "fill-rel")},$,$,$,${opening},${fill})`);
    contained.get(w.levelId)!.push(fill);
  }
  for (const s of p.slabs) {
    const bottom = p.levels.find((l) => l.id === s.levelId)!.elevation + s.offset - s.thickness,
      geom = shape([solid([s.points], bottom, s.thickness)]),
      ref = put(
        `IFCSLAB(${guid(s.id)},$,${str(s.name)},${str(s.material)},$,${placement},${geom},${str(s.id)},.FLOOR.)`,
      );
    contained.get(s.levelId)!.push(ref);
  }
  for (const r of p.roofs) {
    const base = p.levels.find((l) => l.id === r.levelId)!.elevation + r.offset,
      faces = roofFaces(r).map((f) => {
        const pts = f.points.map((pt, i) => point([pt[0], -pt[1], base + f.heights[i]])),
          loop = put(`IFCPOLYLOOP((${pts.join(",")}))`),
          bound = put(`IFCFACEOUTERBOUND(${loop},.T.)`);
        return put(`IFCFACE((${bound}))`);
      }),
      trimShells = roofTrims(r).map((t) => {
        const refs = t.faces.map((face) => {
          const pts = face.map((pt) => point([pt[0], -pt[2], base + pt[1]])),
            loop = put(`IFCPOLYLOOP((${pts.join(",")}))`),
            bound = put(`IFCFACEOUTERBOUND(${loop},.T.)`);
          return put(`IFCFACE((${bound}))`);
        });
        return put(`IFCCLOSEDSHELL((${refs.join(",")}))`);
      }),
      shell = put(`IFCOPENSHELL((${faces.join(",")}))`),
      surface = put(`IFCFACEBASEDSURFACEMODEL((${[shell, ...trimShells].join(",")}))`),
      geom = shape([surface], "SurfaceModel"),
      ref = put(
        `IFCROOF(${guid(r.id)},$,${str(r.name)},'Roof surface; build-up unspecified',$,${placement},${geom},${str(r.id)},.NOTDEFINED.)`,
      );
    contained.get(r.levelId)!.push(ref);
  }
  for (const [level, refs] of contained)
    if (refs.length)
      put(
        `IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid(level + "containment")},$,$,$,(${refs.join(",")}),${levels.get(level)})`,
      );
  return `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');\nFILE_NAME(${str(p.name + ".ifc")},'${new Date().toISOString()}',('X-Ray'),('Looplet'),'X-Ray architect','X-Ray','Design review required');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n${lines.join("\n")}\nENDSEC;\nEND-ISO-10303-21;\n`;
}
