import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { movementVector } from "./navigationMovement.ts";
import { railWidth, readRailWidths, DEFAULT_RAILS } from "./railLayout.ts";
import {
  emptyLocation,
  locationKey,
  planBounds,
  partMapBounds,
  validateLocation,
} from "./componentLocation.ts";
import { parseSourceBuilding } from "./sourceBuilding.ts";
import { DEFAULT_APPEARANCE, parseBuildingAppearance } from "./buildingAppearance.ts";
const model = parseSourceBuilding(
    JSON.parse(
      readFileSync(
        new URL("../../public/models/crown-wharf/source-building.json", import.meta.url),
        "utf8",
      ),
    ),
  ),
  part = model.objects.find((p) => p.id === "L18-slab")!;
const move = (codes: string[], yaw = 0, pitch = 0, mode: "fly" | "walk" = "fly") =>
  movementVector(new Set(codes), yaw, pitch, mode);
test("first-person strafing follows camera right and forward follows mouse heading", () => {
  for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)],
      forward = [-Math.sin(yaw), 0, -Math.cos(yaw)];
    const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);
    assert.ok(dot(move(["KeyA"], yaw), right) < -0.99);
    assert.ok(dot(move(["KeyD"], yaw), right) > 0.99);
    assert.ok(dot(move(["KeyW"], yaw), forward) > 0.99);
    assert.ok(dot(move(["KeyS"], yaw), forward) < -0.99);
  }
});
test("diagonal movement is normalized; opposite keys cancel and walkthrough holds altitude", () => {
  assert.ok(Math.abs(Math.hypot(...move(["KeyW", "KeyD", "Space"])) - 1) < 1e-8);
  assert.equal(Math.hypot(...move(["KeyW", "KeyS", "KeyA", "KeyD"])), 0);
  assert.ok(move(["KeyW"], 0, 0.5)[1] > 0);
  assert.equal(move(["KeyW", "Space"], 0, 0.5, "walk")[1], 0);
  assert.ok(move(["ControlLeft"])[1] < 0);
  assert.ok(move(["Space"])[1] > 0);
});
test("menu widths reject malformed preferences and retain usable central space", () => {
  for (const raw of [null, "bad", "[]", '{"left":"200","right":400}'])
    assert.deepEqual(readRailWidths(raw), DEFAULT_RAILS);
  assert.deepEqual(readRailWidths('{"left":1,"right":99999}'), { left: 200, right: 1000 });
  assert.equal(railWidth("right", 600, 1200, 300), 480);
  assert.equal(railWidth("left", NaN, 1600, 400), 260);
});
test("location annotations are bounded by their actual floor and require a room name", () => {
  const b = planBounds(model.objects.filter((p) => p.storey === part.storey));
  const room: [number, number, number, number] = [b[0] + 1, b[1] + 1, b[0] + 4, b[1] + 4];
  const note = { ...emptyLocation(), roomName: "Meeting room", roomBounds: room };
  assert.deepEqual(validateLocation(note, model, part), note);
  for (const patch of [
    { roomName: " " },
    { roomBounds: [b[0] - 1, b[1], b[2], b[3]] },
    { roomBounds: [0, 0, Infinity, 2] },
    { roomBounds: [3, 2, 1, 0] },
    { note: "x".repeat(2001) },
  ])
    assert.throws(() => validateLocation({ ...note, ...patch }, model, part));
});
test("saved location identity separates source revisions and components", () => {
  assert.notEqual(locationKey(model, part), locationKey(model, model.objects[0]));
  assert.notEqual(
    locationKey(model, part),
    locationKey({ ...model, source: { ...model.source, sha256: "f".repeat(64) } }, part),
  );
});
test("part map keeps the component visible even when a linked room is elsewhere on its floor", () => {
  const column = model.objects.find((p) => p.id === "L18-column-0")!,
    p = planBounds([column]),
    room: [number, number, number, number] = [10, 10, 14, 14],
    v = partMapBounds(column, room);
  for (const b of [p, room]) {
    assert.ok(v[0] < b[0] && v[1] < b[1] && v[2] > b[2] && v[3] > b[3]);
  }
});
test("legacy appearance preferences migrate and weather/model settings validate", () => {
  const old = {
    preset: "chrome",
    background: "#E4E6E9",
    wire: "#414952",
    opacity: 0.82,
    lighting: 1,
    shadows: true,
  };
  assert.equal(parseBuildingAppearance(old).modelPalette, "source");
  assert.equal(parseBuildingAppearance(old).environment, "studio");
  for (const patch of [
    { environment: "future" },
    { modelColor: "red" },
    { modelPalette: "future" },
    { weatherIntensity: NaN },
    { weatherIntensity: 2 },
    { animateWeather: 1 },
  ])
    assert.throws(() => parseBuildingAppearance({ ...DEFAULT_APPEARANCE, ...patch }));
});
