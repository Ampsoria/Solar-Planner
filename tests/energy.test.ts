import assert from "node:assert/strict";
import test from "node:test";
// Node 22's strip-types runner requires an explicit extension.
import {
  calculateEnergy,
  calculateBill,
  calculateBillBreakdown,
  DEFAULT_APPLIANCES,
  DEFAULT_EV,
  DEFAULT_SETTINGS,
} from "../app/lib/energy.ts";
import type { Appliance } from "../app/lib/energy";

const close = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} differs from ${expected}`,
  );
const noEv = { ...DEFAULT_EV, enabled: false };
const device = (changes: Partial<Appliance> = {}): Appliance => ({
  id: "test",
  kind: "custom",
  name: "Test",
  watts: 1000,
  count: 1,
  hoursPerDay: 1,
  daysPerMonth: 30,
  startHour: 12,
  dutyCycle: 1,
  ...changes,
});

test("September 2026 tiers charge only incremental units and retain service at zero use", () => {
  close(calculateBillBreakdown(200, 0).energyCharge, 600);
  close(calculateBillBreakdown(400, 0).energyCharge, 600 + 200 * 4.1584);
  close(
    calculateBillBreakdown(401, 0).energyCharge,
    600 + 200 * 4.1584 + 4.3583,
  );
  close(calculateBill(0, 0), 24.62 * 1.07);
  close(
    calculateBill(500, 0.1623),
    (600 + 200 * 4.1584 + 100 * 4.3583 + 500 * 0.1623 + 24.62) * 1.07,
  );
  close(
    calculateBillBreakdown(400, 0, "legacy").energyCharge,
    150 * 3.2484 + 250 * 4.2218,
  );
});

test("energy balances hold in monthly totals and every representative hour", () => {
  for (const exportEnabled of [false, true]) {
    const result = calculateEnergy(DEFAULT_APPLIANCES, DEFAULT_EV, {
      ...DEFAULT_SETTINGS,
      exportEnabled,
    });
    close(result.monthlyLoadKwh, result.selfConsumedKwh + result.gridImportKwh);
    close(
      result.solarKwh,
      result.selfConsumedKwh + result.exportKwh + result.curtailedKwh,
    );
    close(
      result.monthlyLoadKwh,
      result.hourly.reduce((sum, hour) => sum + hour.load * 30, 0),
    );
    for (const hour of result.hourly) {
      close(hour.load, hour.selfConsumed + hour.gridImport);
      close(hour.solar, hour.selfConsumed + hour.exported + hour.curtailed);
      for (const value of Object.values(hour))
        assert.ok(Number.isFinite(value) && value >= 0);
    }
    close(
      result.monthlyNetBenefit,
      result.monthlySavings + result.monthlyExportIncome,
    );
    close(result.annualBenefit, result.monthlyNetBenefit * 12);
  }
});

test("night EV imports all charging energy, including 10% wall-to-battery loss", () => {
  const night = calculateEnergy([], DEFAULT_EV, DEFAULT_SETTINGS);
  close(night.monthlyEvKwh, 200);
  close(night.selfConsumedKwh, 0);
  close(night.gridImportKwh, 200);
  assert.equal(night.recommendedKwp, 0);
  const day = calculateEnergy(
    [],
    { ...DEFAULT_EV, startHour: 10 },
    DEFAULT_SETTINGS,
  );
  assert.ok(day.selfConsumedKwh > 0);
  assert.ok(day.billAfter < night.billAfter);
  assert.ok(day.recommendedKwp > night.recommendedKwp);
});

test("switching export on adds separate income without changing the electricity bill", () => {
  const off = calculateEnergy(DEFAULT_APPLIANCES, DEFAULT_EV, {
    ...DEFAULT_SETTINGS,
    exportEnabled: false,
  });
  const on = calculateEnergy(DEFAULT_APPLIANCES, DEFAULT_EV, {
    ...DEFAULT_SETTINGS,
    exportEnabled: true,
  });
  assert.equal(off.exportKwh, 0);
  assert.equal(off.monthlyExportIncome, 0);
  assert.ok(off.curtailedKwh > 0);
  close(off.billAfter, on.billAfter);
  close(off.recommendedKwp, on.recommendedKwp);
  close(on.monthlyExportIncome, on.exportKwh * 2.2);
  close(on.monthlySavings, off.monthlySavings);
});

test("fractional windows crossing midnight conserve energy and schedule on correct hours", () => {
  const result = calculateEnergy(
    [
      device({
        startHour: 23.5,
        hoursPerDay: 2,
        daysPerMonth: 12,
        count: 2,
        dutyCycle: 0.5,
      }),
    ],
    noEv,
    { ...DEFAULT_SETTINGS, solarKwp: 0 },
  );
  close(result.monthlyLoadKwh, 24);
  close(result.hourly[23].load * 30, 6);
  close(result.hourly[0].load * 30, 12);
  close(result.hourly[1].load * 30, 6);
  close(result.monthlySavings, 0);
});

test("infrequent appliances do not receive solar credit on days they are off", () => {
  const result = calculateEnergy(
    [device({ watts: 10000, daysPerMonth: 1 })],
    noEv,
    DEFAULT_SETTINGS,
  );
  close(result.monthlyLoadKwh, 10);
  close(result.selfConsumedKwh, result.hourly[12].solar);
});

test("zero loads and zero roof yield finite results without invented savings or payback", () => {
  const empty = calculateEnergy([], noEv, DEFAULT_SETTINGS);
  assert.equal(empty.monthlyLoadKwh, 0);
  assert.equal(empty.selfConsumedKwh, 0);
  assert.equal(empty.recommendedKwp, 0);
  assert.equal(empty.monthlyNetBenefit, 0);
  assert.equal(empty.paybackYears, null);
  const noRoof = calculateEnergy(DEFAULT_APPLIANCES, DEFAULT_EV, {
    ...DEFAULT_SETTINGS,
    roofAreaM2: 0,
  });
  assert.equal(noRoof.solarKwh, 0);
  assert.equal(noRoof.installationCost, 0);
  assert.equal(noRoof.recommendedKwp, 0);
  close(noRoof.billBefore, noRoof.billAfter);
});

test("roof and 5 kW export constraints are enforced while retaining solar balance", () => {
  const roof = calculateEnergy(
    [device({ hoursPerDay: 12, startHour: 6 })],
    noEv,
    { ...DEFAULT_SETTINGS, solarKwp: 20, roofAreaM2: 7 },
  );
  close(roof.solarKwp, 1.4);
  assert.ok(roof.recommendedKwp <= 1.4);
  const huge = calculateEnergy([], noEv, {
    ...DEFAULT_SETTINGS,
    solarKwp: 30,
    roofAreaM2: 200,
    exportEnabled: true,
    exportPowerLimitKw: 100,
  });
  assert.ok(huge.hourly.every((hour) => hour.exported <= 5 + 1e-9));
  assert.ok(huge.curtailedKwh > 0);
  close(huge.solarKwh, huge.exportKwh + huge.curtailedKwh);
});

test("recommendation only offers half-kWp systems that fit the roof", () => {
  const daytimeLoad = [device({ watts: 10000, startHour: 6, hoursPerDay: 12 })];
  const tooSmall = calculateEnergy(daytimeLoad, noEv, {
    ...DEFAULT_SETTINGS,
    roofAreaM2: 2.49,
  });
  assert.equal(tooSmall.recommendedKwp, 0);
  const firstSize = calculateEnergy(daytimeLoad, noEv, {
    ...DEFAULT_SETTINGS,
    roofAreaM2: 2.5,
  });
  assert.equal(firstSize.recommendedKwp, 0.5);
  const betweenSizes = calculateEnergy(daytimeLoad, noEv, {
    ...DEFAULT_SETTINGS,
    roofAreaM2: 6.5,
  });
  assert.equal(betweenSizes.recommendedKwp, 1);
});

test("payback does not assume export income continues after the 10-year contract", () => {
  const onlyExport = calculateEnergy([], noEv, {
    ...DEFAULT_SETTINGS,
    exportEnabled: true,
  });
  assert.ok(onlyExport.annualBenefit > 0);
  assert.ok(onlyExport.annualBenefit * 10 < onlyExport.installationCost);
  assert.equal(onlyExport.paybackYears, null);
  const cheaper = calculateEnergy([], noEv, {
    ...DEFAULT_SETTINGS,
    exportEnabled: true,
    installationCostPerKwp: 20000,
  });
  close(
    cheaper.paybackYears as number,
    cheaper.installationCost / cheaper.annualBenefit,
  );
  const partlyUsed = calculateEnergy(DEFAULT_APPLIANCES, DEFAULT_EV, {
    ...DEFAULT_SETTINGS,
    exportEnabled: true,
    installationCostPerKwp: 100000,
  });
  assert.ok((partlyUsed.paybackYears as number) > 10);
  close(
    partlyUsed.paybackYears as number,
    10 +
      (partlyUsed.installationCost - partlyUsed.annualBenefit * 10) /
        (partlyUsed.monthlySavings * 12),
  );
});

test("invalid numeric inputs are bounded and never leak NaN into totals", () => {
  const result = calculateEnergy(
    [device({ watts: NaN, count: -1, hoursPerDay: Infinity })],
    {
      ...DEFAULT_EV,
      kmPerMonth: Infinity,
      chargingHours: 0,
      chargingLossPercent: 100,
    },
    { ...DEFAULT_SETTINGS, solarKwp: NaN, ftRate: NaN, roofAreaM2: -20 },
  );
  for (const value of Object.values(result))
    if (typeof value === "number")
      assert.ok(Number.isFinite(value) && value >= 0);
  assert.equal(result.monthlyLoadKwh, 0);
});

test("adding and removing EVs scales per-car energy exactly", () => {
  const one = calculateEnergy(
    [],
    { ...DEFAULT_EV, count: 1 },
    DEFAULT_SETTINGS,
  );
  const two = calculateEnergy(
    [],
    { ...DEFAULT_EV, count: 2 },
    DEFAULT_SETTINGS,
  );
  const none = calculateEnergy(
    [],
    { ...DEFAULT_EV, count: 0 },
    DEFAULT_SETTINGS,
  );
  close(two.monthlyEvKwh, one.monthlyEvKwh * 2);
  close(two.gridImportKwh, one.gridImportKwh * 2);
  close(none.monthlyEvKwh, 0);
});

test("coverage target returns the smallest half-kWp system that actually reduces imports", () => {
  const devices = [device({ startHour: 9, hoursPerDay: 7 })];
  const settings = {
    ...DEFAULT_SETTINGS,
    roofAreaM2: 100,
    coverageTargetPercent: 50,
  };
  const plan = calculateEnergy(devices, noEv, settings);
  assert.ok(plan.coverageTargetKwp !== null);
  const fitted = calculateEnergy(devices, noEv, {
    ...settings,
    solarKwp: plan.coverageTargetKwp as number,
  });
  const smaller = calculateEnergy(devices, noEv, {
    ...settings,
    solarKwp: (plan.coverageTargetKwp as number) - 0.5,
  });
  assert.ok(fitted.solarCoveragePercent >= 50);
  assert.ok(smaller.solarCoveragePercent < 50);
  close(
    fitted.solarCoveragePercent,
    (1 - fitted.gridImportKwh / fitted.monthlyLoadKwh) * 100,
  );
});

test("night usage cannot reach a daytime solar target even with ample roof or export", () => {
  const plan = calculateEnergy([], DEFAULT_EV, {
    ...DEFAULT_SETTINGS,
    roofAreaM2: 500,
    exportEnabled: true,
    coverageTargetPercent: 100,
  });
  assert.equal(plan.coverageTargetKwp, null);
  assert.equal(plan.maximumCoveragePercent, 0);
  assert.equal(plan.solarCoveragePercent, 0);
  assert.equal(plan.billReductionPercent, 0);
});
