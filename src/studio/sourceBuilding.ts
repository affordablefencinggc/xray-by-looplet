import { z } from "zod";

export const BUILDING_SCENE_URL = "/models/ruffles/source-building.json";
export const BUILDING_SOURCE_URL = "/models/ruffles/source.pdf";
export const BUILDING_CATALOG = [
  {
    id: "redburn",
    title: "Redburn BR250157",
    sceneUrl: "/models/redburn/source-building.json",
    sourceUrl: "/models/redburn/source.pdf",
    sha256: "b57956f76b5dc893ac2b28a021f3f92e345807e326d6b1f8313e373f9145ad38",
    sample: false,
  },
  {
    id: "crown-wharf",
    title: "Crown Wharf A4 tower",
    sceneUrl: "/models/crown-wharf/source-building.json",
    sourceUrl: "/models/crown-wharf/source.pdf",
    sha256: "32a99e7680a94f7690bc1639913563f279a3452bcb9f0dd4e4ef63997ab2639a",
    sample: false,
  },
  {
    id: "caroline",
    title: "Caroline",
    sceneUrl: "/models/caroline/source-building.json",
    sourceUrl: "/models/caroline/source.pdf",
    sha256: "f62cf82411d5343fd67f2c51b9a0092d70c885c147f9e7b417a6204b4edf11eb",
    sample: false,
  },
  {
    id: "ruffles",
    title: "Ruffles sample",
    sceneUrl: BUILDING_SCENE_URL,
    sourceUrl: BUILDING_SOURCE_URL,
    sha256: "7bc2b13848091c42d8601d9acc8d8b8888cff193c32b416c9d61478887864a33",
    sample: true,
  },
] as const;
export const ROOF_CATEGORIES = new Set(["roof", "roof-trim", "solar", "skylight"]);
export const WALL_CATEGORIES = new Set(["wall", "window", "door", "trim"]);
const number = z.number().finite().min(-10000).max(10000);
const point = z.tuple([number, number]);
const vector = z.tuple([number, number, number]);
const evidence = z.enum(["traced", "dimensioned", "inferred"]);
const sourceRef = z
  .object({
    page: z.number().int().min(1).max(1000),
    region: z.tuple([number, number, number, number]),
    trace: z.array(point).max(10000).optional(),
    dimension: z
      .object({
        value: z.number().finite().positive(),
        unit: z.string().max(20),
        text: z.string().max(300),
      })
      .strict()
      .optional(),
    evidenceState: evidence,
    note: z.string().max(3000),
  })
  .strict();
const object = z
  .object({
    level: z.enum(["ground", "upper", "roof"]).optional(),
    storey: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional(),
    id: z.string().min(1).max(200),
    category: z.enum([
      "wall",
      "room",
      "roof",
      "roof-trim",
      "slab",
      "column",
      "window",
      "door",
      "fixture",
      "solar",
      "skylight",
      "trim",
      "fence",
      "stair",
    ]),
    label: z.string().min(1).max(300),
    positions: z.array(number).min(9).max(600000),
    indices: z.array(z.number().int().nonnegative()).min(3).max(600000),
    material: z.string().min(1).max(100),
    sourceRefs: z.array(sourceRef).min(1).max(30),
    evidenceState: evidence,
    note: z.string().max(3000).optional(),
  })
  .strict();
const sceneSchema = z
  .object({
    schema: z.literal("xray.source-building/v1"),
    source: z
      .object({
        name: z.string().min(1).max(300),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        pageCount: z.number().int().min(1).max(1000),
        title: z.string().min(1).max(300).optional(),
        author: z.string().min(1).max(300).optional(),
        license: z.string().min(1).max(100).optional(),
        licenseUrl: z
          .string()
          .url()
          .max(1000)
          .refine((v) => new URL(v).protocol === "https:")
          .optional(),
      })
      .strict(),
    units: z.literal("m"),
    coordinateSystem: z.string().min(1).max(300),
    presentation: z.object({
      cameraDirection: vector.refine((v) => v[1] > 0 && Math.hypot(v[0], v[2]) > 0),
      planUp: vector.refine((v) => v[1] === 0 && Math.hypot(v[0], v[2]) > 0).optional(),
      edgeOpacity: z.number().min(0).max(1),
    }).strict().optional(),
    bounds: z.object({ min: vector, max: vector }).strict(),
    floorElevations: z.object({ ground: number, upper: number }).strict().optional(),
    storeys: z.array(z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).refine((id) => !["all", "ground", "upper"].includes(id)),
      label: z.string().min(1).max(100),
      elevation: number,
    }).strict()).min(1).max(100).optional(),
    materials: z.record(
      z.string().min(1).max(100),
      z
        .object({
          color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
          opacity: z.number().min(0).max(1).optional(),
          roughness: z.number().min(0).max(1).optional(),
          metalness: z.number().min(0).max(1).optional(),
        })
        .strict(),
    ),
    objects: z.array(object).min(1).max(5000),
    assumptions: z.array(z.string().max(3000)).min(1).max(100),
    sourceSheets: z
      .array(
        z
          .object({
            page: z.number().int().min(1).max(1000),
            title: z.string().min(1).max(300),
            image: z.string().regex(/^\/models\/[a-z0-9-]+\/source-page-\d+\.png$/),
            width: z.number().positive().max(10000),
            height: z.number().positive().max(10000),
            role: z.string().max(100),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
    summary: z
      .object({
        floors: z.number().int().min(1).max(100).optional(),
        wallRuns: z.number().int().nonnegative(),
        openings: z.number().int().nonnegative(),
        apertures: z.number().int().nonnegative().optional(),
        roofFaces: z.number().int().nonnegative(),
        objects: z.number().int().positive(),
        visibleNamedRooms: z.number().int().nonnegative(),
        method: z.string().max(300),
        status: z.string().max(100),
      })
      .strict(),
  })
  .strict();

export type SourceBuilding = z.infer<typeof sceneSchema>;
export type BuildingPart = SourceBuilding["objects"][number];

export function parseSourceBuilding(input: unknown): SourceBuilding {
  const scene = sceneSchema.parse(input),
    ids = new Set<string>(),
    sheets = new Map(scene.sourceSheets.map((s) => [s.page, s]));
  if (
    sheets.size !== scene.sourceSheets.length ||
    scene.sourceSheets.some((s) => s.page > scene.source.pageCount)
  )
    throw Error("Source sheet identity is inconsistent.");
  if (
    scene.bounds.min.some((v, i) => v >= scene.bounds.max[i]) ||
    scene.summary.objects !== scene.objects.length
  )
    throw Error("Scene bounds or object count is inconsistent.");
  if (
    scene.floorElevations &&
    (scene.floorElevations.upper <= scene.floorElevations.ground ||
      scene.floorElevations.ground < scene.bounds.min[1] ||
      scene.floorElevations.upper > scene.bounds.max[1])
  )
    throw Error("Floor elevations are outside the source building.");
  let coordinates = 0;
  const storeys = new Map(scene.storeys?.map((s) => [s.id, s]));
  if (scene.storeys && (storeys.size !== scene.storeys.length || scene.storeys.some((s, i) =>
    s.elevation < scene.bounds.min[1] || s.elevation > scene.bounds.max[1] ||
    (i > 0 && s.elevation <= scene.storeys![i - 1].elevation))))
    throw Error("Storey identities or elevations are inconsistent.");
  for (const part of scene.objects) {
    if ((scene.storeys && !part.storey) || (part.storey && !storeys.has(part.storey)))
      throw Error("Part refers to an unavailable storey.");
    if (ids.has(part.id) || !Object.hasOwn(scene.materials, part.material))
      throw Error("Duplicate part or missing material.");
    ids.add(part.id);
    coordinates += part.positions.length;
    if (
      coordinates > 3000000 ||
      part.positions.length % 3 ||
      part.indices.length % 3 ||
      part.indices.some((i) => i >= part.positions.length / 3)
    )
      throw Error("Invalid or oversized triangle mesh.");
    if (
      part.positions.some(
        (v, i) => v < scene.bounds.min[i % 3] - 0.01 || v > scene.bounds.max[i % 3] + 0.01,
      )
    )
      throw Error("Part exceeds declared scene bounds.");
    for (const ref of part.sourceRefs) {
      const sheet = sheets.get(ref.page);
      if (!sheet) throw Error("Part refers to an unavailable source sheet.");
      const [l, t, r, b] = ref.region;
      if (l < 0 || t < 0 || r <= l || b <= t || r > sheet.width || b > sheet.height)
        throw Error("Source region is outside the original sheet.");
      if (ref.trace?.some(([x, y]) => x < 0 || y < 0 || x > sheet.width || y > sheet.height))
        throw Error("Source trace is outside the original sheet.");
    }
  }
  return scene;
}

export function buildingPartOnFloor(part: BuildingPart, floor: string): boolean {
  if (floor === "all") return true;
  if (part.storey) return part.storey === floor;
  if (floor === "ground") return part.level !== "upper" && part.level !== "roof";
  if (floor === "upper") return part.level !== "ground";
  return false;
}

export async function sourceBytesMatch(
  scene: SourceBuilding,
  bytes: Uint8Array,
  declaredSha256: string,
): Promise<boolean> {
  if (
    !bytes.byteLength ||
    bytes.byteLength > 100 * 1024 * 1024 ||
    declaredSha256 !== scene.source.sha256
  )
    return false;
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return (
    Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("") ===
    scene.source.sha256
  );
}

export async function fetchBuildingBytes(
  url: string,
  limit: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw Error(`Source asset could not be loaded (${response.status}).`);
  if (Number(response.headers.get("content-length")) > limit)
    throw Error("Source asset exceeds the supported size.");
  const reader = response.body?.getReader();
  if (!reader) throw Error("Source asset stream is unavailable.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > limit) throw Error("Source asset exceeds the supported size.");
      chunks.push(next.value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
