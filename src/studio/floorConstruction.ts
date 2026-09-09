import * as THREE from "three";

export const FLOOR_STAGES = [
  {
    id: "plumbing",
    title: "Under-slab plumbing",
    detail: "Water and waste mains below the slab, with risers to fixture positions.",
  },
  {
    id: "electrical",
    title: "Under-slab electrical",
    detail: "Supply conduits below the slab and prepared risers to outlet positions.",
  },
  {
    id: "reinforcement",
    title: "Slab reinforcement",
    detail:
      "Two visible reinforcement mats within the future slab. Illustrative layout, not an engineered bar schedule.",
  },
  {
    id: "structure",
    title: "Concrete structure",
    detail:
      "Concrete poured around the prepared service penetrations and reinforcement; columns and beams follow.",
  },
  {
    id: "framing",
    title: "Wall framing",
    detail: "Timber studs, plates and doorway lintels. Open front for inspection.",
  },
  {
    id: "wall-services",
    title: "Wall & ceiling services",
    detail:
      "Distribution board, outlet boxes and overhead lighting conduits after the framing, before insulation and linings.",
  },
  {
    id: "insulation",
    title: "Wall insulation",
    detail: "Insulation batts fitted between the studs and noggins before the plasterboard.",
  },
  {
    id: "gyprock",
    title: "Gyprock",
    detail: "Plasterboard panels over the insulated wall framing.",
  },
  {
    id: "painting",
    title: "Painting",
    detail: "Warm ivory finish with a sage kitchen feature wall.",
  },
  {
    id: "flooring",
    title: "Flooring",
    detail: "Individual oak boards and ceramic bathroom tiles.",
  },
  {
    id: "fixtures",
    title: "Fixtures & fittings",
    detail: "Cabinetry, worktop, sink, tap, shower, vanity and sanitaryware.",
  },
  {
    id: "appliances",
    title: "Appliances & fit-off",
    detail: "Oven, cooktop, refrigerator, lights and finished outlets.",
  },
] as const;
export type FloorStage = (typeof FLOOR_STAGES)[number]["id"];
export type FloorPart = {
  id: string;
  stage: FloorStage;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
};

/** Authored illustrative apartment, metres. No source-plan or engineering claims. */
export function createFloorComponents() {
  const group = new THREE.Group();
  const parts: FloorPart[] = [];
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string, metalness = 0, roughness = 0.78) => {
    const key = `${color}:${metalness}:${roughness}`;
    if (!materials.has(key))
      materials.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return materials.get(key)!;
  };
  const add = (
    id: string,
    stage: FloorStage,
    geometry: THREE.BufferGeometry,
    position: number[],
    color: string,
    metalness = 0,
  ) => {
    const mesh = new THREE.Mesh(geometry, material(color, metalness));
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = id;
    mesh.userData.stage = stage;
    group.add(mesh);
    parts.push({ id, stage, mesh });
    return mesh;
  };
  const box = (
    id: string,
    stage: FloorStage,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    metal = 0,
  ) => add(id, stage, new THREE.BoxGeometry(w, h, d), [x, y, z], color, metal);
  const pipe = (
    id: string,
    stage: FloorStage,
    a: number[],
    b: number[],
    radius: number,
    color: string,
    metal = 0.45,
  ) => {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      delta = to.clone().sub(from);
    const mesh = add(
      id,
      stage,
      new THREE.CylinderGeometry(radius, radius, delta.length(), 8),
      from.clone().add(to).multiplyScalar(0.5).toArray(),
      color,
      metal,
    );
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };
  const penetrations: [number, number, number][] = [
    ...[-3.72, -3.55].flatMap((z) =>
      [-3.4, 3.7, 4.7].map((x) => [x, z, 0.05] as [number, number, number]),
    ),
    [4.85, -3.2, 0.11],
    [4.5, -0.8, 0.09],
    [3.2, -2.4, 0.08],
    ...[-4.5, -2.5, 0, 2.5, 4.5].map((x) => [x, -3.75, 0.045] as [number, number, number]),
  ];
  const slabShape = new THREE.Shape();
  slabShape.moveTo(-6, -4.5);
  slabShape.lineTo(6, -4.5);
  slabShape.lineTo(6, 4.5);
  slabShape.lineTo(-6, 4.5);
  slabShape.closePath();
  for (const [x, z, r] of penetrations) {
    const hole = new THREE.Path();
    hole.absarc(x, -z, r, 0, Math.PI * 2, true);
    slabShape.holes.push(hole);
  }
  const slabGeometry = new THREE.ExtrudeGeometry(slabShape, {
    depth: 0.32,
    bevelEnabled: false,
    curveSegments: 8,
  });
  slabGeometry.rotateX(-Math.PI / 2);
  add("Concrete floor slab", "structure", slabGeometry, [0, -0.32, 0], "#aaa89f");
  for (const x of [-5.65, 0, 5.65])
    for (const z of [-4.15, 4.15]) {
      box(`Concrete column ${x},${z}`, "structure", x, 1.65, z, 0.38, 3.3, 0.38, "#b6b4aa");
      for (const y of [0.85, 1.7, 2.55])
        box(`Formwork joint ${x},${z},${y}`, "structure", x, y, z, 0.384, 0.012, 0.384, "#8d8b84");
    }
  for (const z of [-4.15, 4.15])
    box(`Concrete beam ${z}`, "structure", 0, 3.15, z, 11.7, 0.32, 0.34, "#aaa89f");
  for (const x of [-5.65, 5.65])
    box(`Side beam ${x}`, "structure", x, 3.15, 0, 0.34, 0.32, 8.3, "#aaa89f");
  // Rear wall and bathroom partition, with a 1m doorway in the partition.
  for (const [x, z, w] of [
    [0, -4, 11.3],
    [3.9, 1, 3.5],
  ] as number[][]) {
    box(`Bottom plate ${z}`, "framing", x, 0.065, z, w, 0.09, 0.09, "#b78652");
    box(`Top plate ${z}`, "framing", x, 2.94, z, w, 0.09, 0.09, "#b78652");
    for (let s = -w / 2; s <= w / 2; s += 0.56) {
      if (z === 1 && s < -0.65) continue;
      box(`Stud ${z}:${s}`, "framing", x + s, 1.5, z, 0.045, 2.85, 0.09, "#c49965");
      box(`Noggin ${z}:${s}`, "framing", x + s + 0.25, 1.35, z, 0.46, 0.045, 0.09, "#b78652");
    }
  }
  for (const x of [-5.5, 5.5]) {
    box(`Side bottom plate ${x}`, "framing", x, 0.065, -1.5, 0.09, 0.09, 5, "#b78652");
    box(`Side top plate ${x}`, "framing", x, 2.94, -1.5, 0.09, 0.09, 5, "#b78652");
    for (let z = -3.8; z <= 0.7; z += 0.56)
      box(`Side stud ${x}:${z}`, "framing", x, 1.5, z, 0.09, 2.85, 0.045, "#c49965");
  }
  const cold = "#548b9f",
    hot = "#b86e42",
    waste = "#555e62";
  for (const [z, c] of [
    [-3.72, cold],
    [-3.55, hot],
  ] as [number, string][]) {
    pipe(`Water main ${c}`, "plumbing", [-4.7, -0.52, z], [4.8, -0.52, z], 0.026, c);
    for (const x of [-3.4, 3.7, 4.7])
      pipe(`Water branch ${c}:${x}`, "plumbing", [x, -0.52, z], [x, 1.02, z], 0.022, c);
  }
  pipe("Waste collector", "plumbing", [-3.4, -0.62, -3.2], [4.85, -0.62, -3.2], 0.065, waste);
  pipe("Soil stack", "plumbing", [4.85, -0.62, -3.2], [4.85, 3.4, -3.2], 0.075, waste);
  pipe("WC waste branch", "plumbing", [4.85, -0.62, -3.2], [4.5, -0.59, -0.8], 0.055, waste);
  pipe("Shower waste branch", "plumbing", [4.4, -0.62, -3.2], [3.2, -0.59, -2.4], 0.045, waste);
  box("Distribution board", "wall-services", -5.35, 1.65, -2.1, 0.16, 0.56, 0.42, "#737a78", 0.3);
  for (const x of [-4.5, -2.5, 0, 2.5, 4.5]) {
    pipe(
      `Under-slab electrical feed ${x}`,
      "electrical",
      [-5.2, -0.43, -3.75],
      [x, -0.43, -3.75],
      0.019,
      "#b99039",
    );
    pipe(
      `Outlet conduit ${x}`,
      "electrical",
      [x, -0.43, -3.75],
      [x, 0.48, -3.75],
      0.018,
      "#727c7b",
    );
    box(`Outlet box ${x}`, "wall-services", x, 0.48, -3.69, 0.14, 0.15, 0.055, "#3d575d");
  }
  for (const x of [-3, 0, 3]) {
    pipe(
      `Lighting conduit ${x}`,
      "wall-services",
      [x, 2.78, -3.75],
      [x, 2.78, 1.5],
      0.017,
      "#a88638",
    );
    pipe(`Pendant feed ${x}`, "wall-services", [x, 2.78, 0], [x, 2.25, 0], 0.012, "#474947");
  }
  for (let x = -4.8; x < 5.4; x += 1.2) {
    box(`Rear plasterboard ${x}`, "gyprock", x, 1.5, -3.92, 1.19, 2.9, 0.025, "#d5d2c7");
    box(
      `Paint rear ${x}`,
      "painting",
      x,
      1.5,
      -3.898,
      1.19,
      2.9,
      0.012,
      x < -1 ? "#8c9b8b" : "#e5ddcc",
    );
  }
  for (const x of [-5.43, 5.43]) {
    box(`Side plasterboard ${x}`, "gyprock", x, 1.5, -1.5, 0.025, 2.9, 5, "#d5d2c7");
    box(
      `Paint side ${x}`,
      "painting",
      x + (x < 0 ? 0.022 : -0.022),
      1.5,
      -1.5,
      0.012,
      2.9,
      5,
      "#e5ddcc",
    );
  }
  box("Bathroom plasterboard", "gyprock", 4.15, 1.5, 1.055, 2.5, 2.9, 0.025, "#d5d2c7");
  box("Bathroom paint", "painting", 4.15, 1.5, 1.078, 2.5, 2.9, 0.012, "#e5ddcc");
  for (let z = -3.8; z < 4; z += 0.27)
    for (let x = -5.3; x < 5.2; x += 1.8) {
      if (x > 1.8 && z < 1) continue;
      const tone = ["#b78d60", "#c59c6a", "#bd9366", "#cfaa7b"][
        Math.abs(Math.round(x * 7 + z * 19)) % 4
      ];
      box(`Oak board ${x}:${z}`, "flooring", x + 0.81, 0.034, z, 1.78, 0.045, 0.26, tone);
    }
  for (let x = 2.5; x < 5.3; x += 0.55)
    for (let z = -3.65; z < 0.8; z += 0.55)
      box(`Bath tile ${x}:${z}`, "flooring", x, 0.038, z, 0.542, 0.05, 0.542, "#c8c8bf");
  for (let x = -4.5; x < 0.5; x += 0.82) {
    box(`Kitchen cabinet ${x}`, "fixtures", x, 0.48, -3.27, 0.8, 0.91, 1.1, "#9b7450");
    box(`Cabinet front ${x}`, "fixtures", x, 0.5, -2.703, 0.76, 0.82, 0.035, "#aa835b");
    box(`Handle ${x}`, "fixtures", x, 0.82, -2.665, 0.28, 0.023, 0.023, "#b9ab83", 0.65);
  }
  box("Stone worktop left", "fixtures", -4.12, 0.965, -3.26, 1.6, 0.06, 1.15, "#e6e2d6");
  box("Stone worktop right", "fixtures", -0.98, 0.965, -3.26, 3, 0.06, 1.15, "#e6e2d6");
  box("Sink rim", "fixtures", -2.91, 0.965, -3.26, 0.77, 0.065, 1.12, "#aeb6b5", 0.75);
  box("Sink bowl", "fixtures", -2.91, 1.003, -3.26, 0.57, 0.012, 0.65, "#57696a", 0.65);
  pipe(
    "Kitchen tap stem",
    "fixtures",
    [-2.91, 0.99, -3.64],
    [-2.91, 1.3, -3.64],
    0.025,
    "#b3bab7",
    0.85,
  );
  pipe(
    "Kitchen tap spout",
    "fixtures",
    [-2.91, 1.3, -3.64],
    [-2.91, 1.3, -3.3],
    0.025,
    "#b3bab7",
    0.85,
  );
  box("Shower tray", "fixtures", 3.05, 0.12, -2.9, 1.22, 0.12, 1.6, "#e5e3db");
  pipe("Shower rail", "fixtures", [2.52, 0.5, -3.7], [2.52, 2.28, -3.7], 0.022, "#aeb6b5", 0.8);
  pipe("Shower arm", "fixtures", [2.52, 2.28, -3.7], [2.52, 2.28, -3.4], 0.022, "#aeb6b5", 0.8);
  box("Rain shower head", "fixtures", 2.52, 2.27, -3.38, 0.22, 0.026, 0.22, "#aeb6b5", 0.8);
  box("Vanity", "fixtures", 4.78, 0.57, -2.9, 0.85, 0.88, 1.05, "#9b7450");
  box("Vanity basin", "fixtures", 4.78, 1.04, -2.9, 0.88, 0.08, 1.08, "#efeee6");
  box("Vanity mirror", "fixtures", 5.38, 1.85, -2.9, 0.015, 0.9, 0.85, "#899ea0", 0.9);
  const toilet = add(
    "Toilet bowl",
    "fixtures",
    new THREE.SphereGeometry(0.29, 16, 10),
    [4.45, 0.38, -0.3],
    "#ecece5",
  );
  toilet.scale.set(1, 0.6, 1.4);
  box("Toilet pedestal", "fixtures", 4.45, 0.18, -0.35, 0.32, 0.36, 0.42, "#ecece5");
  box("Toilet cistern", "fixtures", 4.45, 0.64, -0.72, 0.54, 0.62, 0.2, "#ecece5");
  box("Oven", "appliances", -0.4, 0.48, -2.677, 0.7, 0.66, 0.075, "#323b3e", 0.6);
  box("Oven glass", "appliances", -0.4, 0.42, -2.63, 0.56, 0.4, 0.018, "#142129", 0.25);
  box("Oven handle", "appliances", -0.4, 0.74, -2.6, 0.54, 0.026, 0.038, "#bdc0b9", 0.8);
  box("Induction hob", "appliances", -0.4, 1.006, -3.22, 0.68, 0.022, 0.7, "#172326", 0.3);
  for (const x of [-0.58, -0.22])
    for (const z of [-3.4, -3.06]) {
      const ring = add(
        `Hob ring ${x}:${z}`,
        "appliances",
        new THREE.TorusGeometry(0.11, 0.008, 4, 24),
        [x, 1.022, z],
        "#8a928f",
        0.4,
      );
      ring.rotation.x = Math.PI / 2;
    }
  box("Fridge", "appliances", -4.75, 1.1, -1.95, 0.91, 2.15, 0.86, "#b7bdb7", 0.65);
  box("Fridge door seam", "appliances", -4.75, 0.72, -1.514, 0.87, 0.014, 0.012, "#596563");
  box("Fridge handle", "appliances", -4.39, 1.49, -1.49, 0.035, 0.55, 0.04, "#697571", 0.7);
  for (const x of [-3, 0, 3]) {
    add(
      `Pendant shade ${x}`,
      "appliances",
      new THREE.ConeGeometry(0.26, 0.24, 24, 1, true),
      [x, 2.25, 0],
      "#d4b77b",
      0.4,
    );
    add(
      `Pendant diffuser ${x}`,
      "appliances",
      new THREE.CylinderGeometry(0.22, 0.22, 0.022, 24),
      [x, 2.13, 0],
      "#fff0ce",
    );
  }
  for (const x of [-4.5, -2.5, 0, 2.5, 4.5])
    box(`Outlet face ${x}`, "appliances", x, 0.48, -3.867, 0.15, 0.16, 0.018, "#edece4");

  // Under-slab branches terminate at fixture risers, rather than floating above the pour.
  pipe("WC waste riser", "plumbing", [4.5, -0.59, -0.8], [4.5, 0.25, -0.8], 0.055, waste);
  pipe("Shower waste riser", "plumbing", [3.2, -0.59, -2.4], [3.2, 0.13, -2.4], 0.045, waste);
  const steelRun = (
    id: string,
    axis: "x" | "z",
    level: number,
    fixed: number,
    min: number,
    max: number,
  ) => {
    let segments: [number, number][] = [[min, max]];
    for (const [x, z, r] of penetrations) {
      const cross = axis === "x" ? z : x,
        center = axis === "x" ? x : z,
        clear = r + 0.025;
      if (Math.abs(fixed - cross) >= clear) continue;
      const gap = Math.sqrt(clear * clear - (fixed - cross) ** 2);
      segments = segments.flatMap(([a, b]) =>
        center + gap <= a || center - gap >= b
          ? [[a, b]]
          : (
              [
                [a, Math.max(a, center - gap)],
                [Math.min(b, center + gap), b],
              ] as [number, number][]
            ).filter(([lo, hi]) => hi - lo > 0.02),
      );
    }
    segments.forEach(([a, b], i) =>
      pipe(
        id + ":" + i,
        "reinforcement",
        axis === "x" ? [a, level, fixed] : [fixed, level, a],
        axis === "x" ? [b, level, fixed] : [fixed, level, b],
        0.0075,
        "#6a7072",
        0.55,
      ),
    );
  };
  for (const layer of [-0.1, -0.23]) {
    for (let z = -4.2; z <= 4.2; z += 0.3)
      steelRun("Slab steel X " + layer + ":" + z, "x", layer, z, -5.7, 5.7);
    for (let x = -5.7; x <= 5.7; x += 0.3)
      steelRun("Slab steel Z " + layer + ":" + x, "z", layer - 0.018, x, -4.2, 4.2);
  }
  for (const [x, z, w] of [
    [0, -4, 11.3],
    [3.9, 1, 3.5],
  ])
    for (let a = -w / 2; a + 0.56 <= w / 2; a += 0.56) {
      if (z === 1 && a < -0.65) continue;
      for (const [y, h] of [
        [0.72, 1.19],
        [2.13, 1.48],
      ])
        box(
          "Wall batt " + z + ":" + a + ":" + y,
          "insulation",
          x + a + 0.28,
          y,
          z,
          0.505,
          h,
          0.078,
          "#d5c28c",
        );
    }
  for (const x of [-5.5, 5.5])
    for (let z = -3.8; z + 0.56 <= 0.7; z += 0.56)
      box(
        "Side batt " + x + ":" + z,
        "insulation",
        x,
        1.5,
        z + 0.28,
        0.078,
        2.79,
        0.505,
        "#d5c28c",
      );

  group.updateMatrixWorld(true);
  return {
    group,
    parts,
    dispose() {
      parts.forEach((p) => p.mesh.geometry.dispose());
      materials.forEach((m) => m.dispose());
      group.removeFromParent();
    },
  };
}
