import type { Appliance } from "./energy.ts";

export type SceneAppliance = Pick<Appliance, "id" | "kind" | "count">;

/** One stable identity and one separate display position for every physical unit. */
export function planSceneInventory(appliances: SceneAppliance[]) {
  const units = appliances.flatMap((device) =>
    Array.from(
      { length: Math.max(0, Math.floor(device.count)) },
      (_, index) => ({
        key: `${device.id}:${index}`,
        kind: device.kind,
      }),
    ),
  );
  const columns = Math.min(
    Math.max(units.length, 1),
    Math.max(6, Math.ceil(Math.sqrt(units.length))),
  );
  const rows = Math.ceil(units.length / columns);
  const spacing = 1.18;
  return {
    units: units.map((unit, slot) => ({
      ...unit,
      x: 2.34 - columns * spacing + ((slot % columns) + 0.5) * spacing,
      z: 4.45 + Math.floor(slot / columns) * spacing,
    })),
    width: columns * spacing,
    centerX: 2.34 - (columns * spacing) / 2,
    depth: Math.max(rows, 1) * spacing,
  };
}
