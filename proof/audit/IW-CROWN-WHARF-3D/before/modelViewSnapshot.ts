type Vector3 = readonly [number, number, number];
export type ModelViewSnapshot = Readonly<{
  schema: "xray.model-view/v1";
  documentId: string;
  sourceSha256: string;
  sceneId: string;
  sceneSha256: string;
  view: Readonly<{ wireframe: boolean; roof: boolean; cutaway: boolean; explode: boolean; plan: boolean; level: "all" | "ground" | "upper" }>;
  capturedAt: string;
  camera: Readonly<{
    projection: "perspective" | "orthographic";
    position: Vector3;
    target: Vector3;
    up: Vector3;
    zoom: number;
    near: number;
    far: number;
    projectionMatrix: readonly number[];
  }>;
}>;
type ModelViewInput = Omit<ModelViewSnapshot, "schema" | "capturedAt">;
const listeners = new Set<() => void>();
let latest: ModelViewSnapshot | null = null, recorded: ModelViewSnapshot | null = null;
let latestInputKey = "";
const finite = (value: number) => Number.isFinite(value) && Math.abs(value) <= 1e12;
const matches = (snapshot: ModelViewSnapshot | null, documentId: string | null | undefined, sourceSha256: string | null | undefined) => Boolean(snapshot && snapshot.documentId === documentId && snapshot.sourceSha256 === sourceSha256);
const notify = () => listeners.forEach(listener => listener());

/** Only the verified Three.js Model scene publishes this bounded session value. */
export function publishModelView(input: ModelViewInput): ModelViewSnapshot {
  const camera = input.camera;
  if (!input.documentId || input.documentId.length > 300 || !/^[a-f0-9]{64}$/.test(input.sourceSha256) || !/^[a-f0-9]{64}$/.test(input.sceneSha256) || !/^[a-z0-9-]{1,100}$/.test(input.sceneId)) throw Error("Invalid model view source identity");
  if (![input.view.wireframe, input.view.roof, input.view.cutaway, input.view.explode, input.view.plan].every(value => typeof value === "boolean") || !["all", "ground", "upper"].includes(input.view.level) || input.view.plan !== (camera.projection === "orthographic")) throw Error("Invalid model view options");
  if (!["perspective", "orthographic"].includes(camera.projection) || ![camera.position, camera.target, camera.up].every(vector => vector.length === 3 && vector.every(finite)) || camera.up.every(value => value === 0) || !(camera.zoom > 0) || !finite(camera.zoom) || !(camera.near > 0) || !(camera.far > camera.near) || !finite(camera.far) || camera.projectionMatrix.length !== 16 || !camera.projectionMatrix.every(finite)) throw Error("Invalid model view camera");
  const key = JSON.stringify(input);
  if (latest && key === latestInputKey) return latest;
  const vector = (value: Vector3): Vector3 => Object.freeze([...value]) as unknown as Vector3;
  latest = Object.freeze({ schema: "xray.model-view/v1", documentId: input.documentId, sourceSha256: input.sourceSha256, sceneId: input.sceneId, sceneSha256: input.sceneSha256, view: Object.freeze({ ...input.view }), capturedAt: new Date().toISOString(), camera: Object.freeze({ ...camera, position: vector(camera.position), target: vector(camera.target), up: vector(camera.up), projectionMatrix: Object.freeze([...camera.projectionMatrix]) }) });
  latestInputKey = key; notify(); return latest;
}
export const subscribeModelViews = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const latestModelView = () => latest;
export const recordedModelView = () => recorded;
export const matchingModelView = (snapshot: ModelViewSnapshot | null, documentId: string | null | undefined, sourceSha256: string | null | undefined) => matches(snapshot, documentId, sourceSha256) ? snapshot : null;
export function recordModelView(documentId: string, sourceSha256: string): ModelViewSnapshot {
  const snapshot = matchingModelView(latest, documentId, sourceSha256);
  if (!snapshot) throw Error("Open the matching source in Model before recording its camera.");
  recorded = snapshot; notify(); return recorded;
}
/** A source change invalidates both snapshots; leaving Model for Render does not. */
export function invalidateModelViews(documentId: string | null | undefined, sourceSha256: string | null | undefined) {
  let changed = false;
  if (latest && !matches(latest, documentId, sourceSha256)) { latest = null; latestInputKey = ""; changed = true; }
  if (recorded && !matches(recorded, documentId, sourceSha256)) { recorded = null; changed = true; }
  if (changed) notify();
}
