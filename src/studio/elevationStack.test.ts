import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildElevationStack } from "./elevationStack.ts";
import { HOUSE } from "./geometry.ts";

describe("Elevation Stack Engine", () => {
  it("generates 1 floor when floors=1 in standing mode", () => {
    const elems = buildElevationStack({
      buildingSegs: HOUSE.B,
      roofSegs: HOUSE.R,
      floors: 1,
      pose: "standing",
      skin: "navy",
    });

    const bldElems = elems.filter((e) => e.type.startsWith("bld_floor_0"));
    assert.equal(bldElems.length, HOUSE.B.length);

    const roofElems = elems.filter((e) => e.type === "roof");
    assert.equal(roofElems.length, HOUSE.R.length);
  });

  it("stacks 3 floors vertically with correct Z offsets and slab bands", () => {
    const elems = buildElevationStack({
      buildingSegs: HOUSE.B,
      roofSegs: HOUSE.R,
      floors: 3,
      pose: "standing",
      skin: "navy",
      floorHeight: 2.8,
    });

    // Should have 3 building floor sets
    const floor0 = elems.filter((e) => e.type === "bld_floor_0");
    const floor1 = elems.filter((e) => e.type === "bld_floor_1");
    const floor2 = elems.filter((e) => e.type === "bld_floor_2");

    assert.equal(floor0.length, HOUSE.B.length);
    assert.equal(floor1.length, HOUSE.B.length);
    assert.equal(floor2.length, HOUSE.B.length);

    // Floor 1 should be shifted up by 2.8m compared to Floor 0
    assert.equal(Math.round((floor1[0].a[2] - floor0[0].a[2]) * 10) / 10, 2.8);
    // Floor 2 should be shifted up by 5.6m compared to Floor 0
    assert.equal(Math.round((floor2[0].a[2] - floor0[0].a[2]) * 10) / 10, 5.6);

    // Roof should be on Floor 2 (zOffset = 5.6)
    const roofElems = elems.filter((e) => e.type === "roof");
    assert.equal(roofElems.length, HOUSE.R.length);

    // Should have slab bands for floors 1 and 2
    const slab1 = elems.filter((e) => e.type === "slab_band_1");
    const slab2 = elems.filter((e) => e.type === "slab_band_2");
    assert.equal(slab1.length, 4);
    assert.equal(slab2.length, 4);
  });

  it("applies explode vertical separation between storeys", () => {
    const normal = buildElevationStack({
      buildingSegs: HOUSE.B,
      roofSegs: HOUSE.R,
      floors: 2,
      pose: "standing",
      skin: "navy",
      floorHeight: 2.8,
      explode: 0,
    });

    const exploded = buildElevationStack({
      buildingSegs: HOUSE.B,
      roofSegs: HOUSE.R,
      floors: 2,
      pose: "standing",
      skin: "navy",
      floorHeight: 2.8,
      explode: 1.5,
    });

    const normalFloor1 = normal.find((e) => e.type === "bld_floor_1")!;
    const explodedFloor1 = exploded.find((e) => e.type === "bld_floor_1")!;

    // Exploded floor 1 should be 1.5m higher than normal floor 1
    assert.equal(Math.round((explodedFloor1.a[2] - normalFloor1.a[2]) * 10) / 10, 1.5);
  });

  it("dims non-active floors when activeFloor is specified", () => {
    const elems = buildElevationStack({
      buildingSegs: HOUSE.B,
      roofSegs: HOUSE.R,
      floors: 2,
      pose: "standing",
      skin: "navy",
      activeFloor: 1, // Only Floor 1 active, Floor 0 dimmed
    });

    const floor0 = elems.find((e) => e.type === "bld_floor_0")!;
    const floor1 = elems.find((e) => e.type === "bld_floor_1")!;

    assert.ok(floor0.colour.includes("0.25")); // Dimmed
    assert.ok(!floor1.colour.includes("0.25")); // Full brightness
  });

  it("generates datum elevation level lines", () => {
    const elems = buildElevationStack({
      buildingSegs: HOUSE.B,
      roofSegs: HOUSE.R,
      floors: 2,
      pose: "standing",
      skin: "navy",
    });

    const datum0 = elems.find((e) => e.type === "datum_level_0");
    const datum1 = elems.find((e) => e.type === "datum_level_1");
    assert.ok(datum0);
    assert.ok(datum1);
  });
});
