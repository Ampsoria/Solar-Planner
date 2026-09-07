import assert from "node:assert/strict";
import test from "node:test";
import { planSceneInventory } from "../app/lib/scene-inventory.ts";
import type { SceneAppliance } from "../app/lib/scene-inventory.ts";

test("each physical appliance has a distinct identity and position", () => {
  const devices: SceneAppliance[] = [
    { id: "ac-a", kind: "ac", count: 2 },
    { id: "ac-b", kind: "ac", count: 1 },
    { id: "fridge", kind: "fridge", count: 1 },
  ];
  const { units } = planSceneInventory(devices);
  assert.equal(units.length, 4);
  assert.equal(new Set(units.map((unit) => unit.key)).size, 4);
  assert.equal(new Set(units.map(({ x, z }) => `${x}:${z}`)).size, 4);
  assert.deepEqual(
    units.map((unit) => unit.key),
    ["ac-a:0", "ac-a:1", "ac-b:0", "fridge:0"],
  );
});

test("adding and removing units retains the identities of surviving units", () => {
  const device: SceneAppliance = { id: "tv", kind: "tv", count: 1 };
  assert.deepEqual(
    planSceneInventory([{ ...device, count: 2 }]).units.map((unit) => unit.key),
    ["tv:0", "tv:1"],
  );
  assert.deepEqual(
    planSceneInventory([device]).units.map((unit) => unit.key),
    ["tv:0"],
  );
  assert.equal(planSceneInventory([]).units.length, 0);
  assert.equal(planSceneInventory([{ ...device, count: 0 }]).units.length, 0);
});

test("every appliance kind and large valid inventories remain uncapped", () => {
  const kinds: SceneAppliance["kind"][] = [
    "ac",
    "fridge",
    "tv",
    "washer",
    "light",
    "waterheater",
    "computer",
    "custom",
  ];
  const devices = kinds.map((kind) => ({ id: kind, kind, count: 100 }));
  const { units, width, depth } = planSceneInventory(devices);
  assert.equal(units.length, 800);
  for (const kind of kinds)
    assert.equal(units.filter((unit) => unit.kind === kind).length, 100);
  assert.equal(new Set(units.map(({ x, z }) => `${x}:${z}`)).size, 800);
  assert.ok(width > 7 && depth > 7);
  assert.ok(
    units.every(({ x }) => x < 2.34),
    "appliances stay clear of the EV parking strip",
  );
});
