/**
 * Household solar planning estimates, in THB and kWh. A month has 30 days.
 * Appliance operating days are spaced evenly through the month. Hours crossing
 * midnight wrap into the following day; compressor duty cycles are hourly means.
 * EV driving energy is replenished equally every day during its charging window.
 * Solar follows a normalized 06:00–18:00 sine curve on every representative day.
 * There is no battery, net metering, weather, shading or TOU billing in this model.
 * Annual figures repeat this month 12 times; export income ends after year 10.
 * Simple payback excludes degradation,
 * financing, maintenance, inverter replacement, tax and future tariff changes.
 */

export type ApplianceKind =
  | "ac"
  | "fridge"
  | "tv"
  | "washer"
  | "light"
  | "waterheater"
  | "computer"
  | "custom";
export type TariffVersion = "sep2026" | "legacy";

export interface Appliance {
  id: string;
  name: string;
  kind: ApplianceKind;
  count: number;
  watts: number;
  hoursPerDay: number;
  daysPerMonth: number;
  startHour: number;
  /** Fraction of rated input power, from 0 to 1. */
  dutyCycle: number;
}

export interface EVSettings {
  enabled: boolean;
  kmPerMonth: number;
  kwhPer100km: number;
  /** Percent of wall energy lost before reaching the battery. */
  chargingLossPercent: number;
  startHour: number;
  chargingHours: number;
}

export interface PlannerSettings {
  solarKwp: number;
  peakSunHours: number;
  performanceRatio: number;
  roofAreaM2: number;
  installationCostPerKwp: number;
  /** Baht per kWh, not satang. */
  ftRate: number;
  exportEnabled: boolean;
  exportRate: number;
  tariffVersion?: TariffVersion;
  /** Assumed approved AC export capacity; default matches the 2026 5 kW offer cap. */
  exportPowerLimitKw?: number;
}

export interface HourlyEnergy {
  hour: number;
  /** Average-day kWh in this one-hour interval; numerically also average kW. */
  load: number;
  solar: number;
  selfConsumed: number;
  gridImport: number;
  exported: number;
  curtailed: number;
}

export interface BillBreakdown {
  energyCharge: number;
  ftCharge: number;
  serviceCharge: number;
  vat: number;
  total: number;
}

export interface EnergyResult {
  monthlyLoadKwh: number;
  monthlyHouseholdKwh: number;
  monthlyEvKwh: number;
  daytimeLoadKwh: number;
  solarKwp: number;
  solarKwh: number;
  selfConsumedKwh: number;
  surplusKwh: number;
  exportKwh: number;
  curtailedKwh: number;
  gridImportKwh: number;
  billBefore: number;
  billAfter: number;
  billBeforeBreakdown: BillBreakdown;
  billAfterBreakdown: BillBreakdown;
  monthlySavings: number;
  monthlyExportIncome: number;
  monthlyNetBenefit: number;
  annualBenefit: number;
  installationCost: number;
  paybackYears: number | null;
  recommendedKwp: number;
  roofMaxKwp: number;
  selfConsumptionPercent: number;
  solarCoveragePercent: number;
  hourly: HourlyEnergy[];
  /** Device cost is a proportional share of the variable bill, excluding service. */
  deviceUsage: { id: string; kwh: number; cost: number }[];
}

export const SOURCES = [
  {
    label: "อัตราบ้านอยู่อาศัย เริ่ม ก.ย. 2569 · PEA",
    url: "https://www.pea.co.th/news/corporate-news/2392",
    checkedAt: "2026-09-06",
  },
  {
    label: "ตารางอัตรา 3.0000 / 4.1584 / 4.3583 · กรมประชาสัมพันธ์",
    url: "https://region2.prd.go.th/th/content/category/detail/id/6/cid/9/iid/532031",
    checkedAt: "2026-09-06",
  },
  {
    label: "ค่า Ft ก.ย.–ธ.ค. 2569: 0.1623 บาท/หน่วย · กกพ.",
    url: "https://erc.or.th/th/automatic/",
    checkedAt: "2026-09-06",
  },
  {
    label: "ค่าบริการบ้านอยู่อาศัย 24.62 บาท/เดือน · กกพ.",
    url: "https://www.erc.or.th/th/tariff",
    checkedAt: "2026-09-06",
  },
  {
    label: "ขายไฟส่วนเกิน 2.20 บาท/หน่วย · PEA ปี 2569",
    url: "https://www.pea.co.th/news/corporate-news/2114",
    checkedAt: "2026-09-06",
  },
] as const;

export const TARIFF_LABEL =
  "บ้านอยู่อาศัย MEA 1.2 / PEA 1.1.2 · อัตราเริ่ม ก.ย. 2569";
export const FT_LABEL = "Ft ก.ย.–ธ.ค. 2569";
export const EXPORT_NOTE =
  "จำลองเมื่อได้รับอนุมัติและทำสัญญาขายไฟแล้ว โครงการ PEA ปี 2569 รับซื้อ 2.20 บาท/หน่วย 10 ปี เสนอขายไม่เกิน 5 kW ต่อมิเตอร์ ผู้สมัครต้องเป็นเจ้าของมิเตอร์บ้านอยู่อาศัยและมีชื่อผู้ใช้ไฟตรงกัน ทั้งนี้ขึ้นกับโควตาและเงื่อนไขการไฟฟ้าในพื้นที่";
export const MODEL_NOTE =
  "ประมาณการ 30 วัน ไม่มีแบตเตอรี่ ใช้รูปแบบแดดเฉลี่ยทุกวัน กำลังไฟเครื่องใช้เป็นค่าตัวอย่าง ปรับตามฉลากและพฤติกรรมจริง แนะนำขนาดจากไฟที่ใช้พร้อมการผลิตโซลาร์และพื้นที่หลังคา";

export const APPLIANCE_PRESETS: Appliance[] = [
  {
    id: "preset-ac",
    kind: "ac",
    name: "เครื่องปรับอากาศ",
    count: 1,
    watts: 900,
    hoursPerDay: 8,
    daysPerMonth: 30,
    startHour: 20,
    dutyCycle: 0.65,
  },
  {
    id: "preset-fridge",
    kind: "fridge",
    name: "ตู้เย็น",
    count: 1,
    watts: 150,
    hoursPerDay: 24,
    daysPerMonth: 30,
    startHour: 0,
    dutyCycle: 0.4,
  },
  {
    id: "preset-tv",
    kind: "tv",
    name: "สมาร์ททีวี",
    count: 1,
    watts: 100,
    hoursPerDay: 5,
    daysPerMonth: 30,
    startHour: 18,
    dutyCycle: 1,
  },
  {
    id: "preset-washer",
    kind: "washer",
    name: "เครื่องซักผ้า",
    count: 1,
    watts: 500,
    hoursPerDay: 1,
    daysPerMonth: 12,
    startHour: 10,
    dutyCycle: 1,
  },
  {
    id: "preset-light",
    kind: "light",
    name: "หลอดไฟ LED",
    count: 1,
    watts: 60,
    hoursPerDay: 6,
    daysPerMonth: 30,
    startHour: 18,
    dutyCycle: 1,
  },
  {
    id: "preset-waterheater",
    kind: "waterheater",
    name: "เครื่องทำน้ำอุ่น",
    count: 1,
    watts: 3500,
    hoursPerDay: 0.5,
    daysPerMonth: 30,
    startHour: 7,
    dutyCycle: 1,
  },
  {
    id: "preset-computer",
    kind: "computer",
    name: "คอมพิวเตอร์",
    count: 1,
    watts: 200,
    hoursPerDay: 8,
    daysPerMonth: 22,
    startHour: 9,
    dutyCycle: 1,
  },
  {
    id: "preset-custom",
    kind: "custom",
    name: "เครื่องใช้ไฟฟ้าอื่น ๆ",
    count: 1,
    watts: 100,
    hoursPerDay: 2,
    daysPerMonth: 30,
    startHour: 10,
    dutyCycle: 1,
  },
];

export const DEFAULT_APPLIANCES: Appliance[] = APPLIANCE_PRESETS.slice(
  0,
  5,
).map((device, index) => ({
  ...device,
  id: `device-${index + 1}`,
  count: device.kind === "ac" ? 2 : device.count,
}));

export const DEFAULT_EV: EVSettings = {
  enabled: true,
  kmPerMonth: 1200,
  kwhPer100km: 15,
  chargingLossPercent: 10,
  startHour: 22,
  chargingHours: 6,
};

export const DEFAULT_SETTINGS: PlannerSettings = {
  solarKwp: 3,
  peakSunHours: 4.7,
  performanceRatio: 0.8,
  roofAreaM2: 40,
  installationCostPerKwp: 35000,
  ftRate: 0.1623,
  exportEnabled: false,
  exportRate: 2.2,
  tariffVersion: "sep2026",
  exportPowerLimitKw: 5,
};

const DAYS = 30;
const HOURS = DAYS * 24;
const SERVICE_CHARGE = 24.62;
const VAT_RATE = 0.07;
const ROOF_M2_PER_KWP = 5; // Planning allowance only; excludes setbacks/structural constraints.
const SOLAR_SHAPE = Array.from({ length: 24 }, (_, hour) =>
  hour >= 6 && hour < 18 ? Math.sin((Math.PI * (hour + 0.5 - 6)) / 12) : 0,
);
const SOLAR_SHAPE_TOTAL = SOLAR_SHAPE.reduce((sum, value) => sum + value, 0);

function bounded(
  value: number,
  min: number,
  max: number,
  fallback = min,
): number {
  return Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function calculateBillBreakdown(
  kwh: number,
  ftRate = DEFAULT_SETTINGS.ftRate,
  tariffVersion: TariffVersion = "sep2026",
): BillBreakdown {
  const units = bounded(kwh, 0, 1e9);
  const firstLimit = tariffVersion === "legacy" ? 150 : 200;
  const rates =
    tariffVersion === "legacy" ? [3.2484, 4.2218, 4.4217] : [3, 4.1584, 4.3583];
  const energyCharge =
    Math.min(units, firstLimit) * rates[0] +
    Math.min(Math.max(units - firstLimit, 0), 400 - firstLimit) * rates[1] +
    Math.max(units - 400, 0) * rates[2];
  const ftCharge = units * bounded(ftRate, -3, 5, DEFAULT_SETTINGS.ftRate);
  const subtotal = Math.max(0, energyCharge + ftCharge + SERVICE_CHARGE);
  const vat = subtotal * VAT_RATE;
  return {
    energyCharge,
    ftCharge,
    serviceCharge: SERVICE_CHARGE,
    vat,
    total: subtotal + vat,
  };
}

export function calculateBill(
  kwh: number,
  ftRate = DEFAULT_SETTINGS.ftRate,
  tariffVersion: TariffVersion = "sep2026",
): number {
  return calculateBillBreakdown(kwh, ftRate, tariffVersion).total;
}

/** Add a constant-power window with fractional hours, wrapping at month-end. */
function addWindow(
  load: number[],
  day: number,
  start: number,
  hours: number,
  powerKw: number,
) {
  let position = day * 24 + start;
  const end = position + hours;
  while (position < end - 1e-9) {
    const next = Math.min(Math.floor(position) + 1, end);
    load[Math.floor(position) % HOURS] += (next - position) * powerKw;
    position = next;
  }
}

export function calculateEnergy(
  appliances: Appliance[],
  ev: EVSettings,
  settings: PlannerSettings,
): EnergyResult {
  const load = Array<number>(HOURS).fill(0);
  const deviceUsage = appliances.slice(0, 500).map((device) => {
    const count = Math.floor(bounded(device.count, 0, 100));
    const watts = bounded(device.watts, 0, 50000);
    const hours = bounded(device.hoursPerDay, 0, 24);
    const days = Math.floor(bounded(device.daysPerMonth, 0, DAYS));
    const start = bounded(device.startHour, 0, 23.999);
    const power = ((count * watts) / 1000) * bounded(device.dutyCycle, 0, 1, 1);
    for (let day = 0; day < DAYS; day++) {
      if (
        Math.floor(((day + 1) * days) / DAYS) > Math.floor((day * days) / DAYS)
      )
        addWindow(load, day, start, hours, power);
    }
    return { id: device.id, kwh: power * hours * days, cost: 0 };
  });
  const monthlyHouseholdKwh = deviceUsage.reduce(
    (sum, device) => sum + device.kwh,
    0,
  );
  const monthlyEvKwh = ev.enabled
    ? (bounded(ev.kmPerMonth, 0, 30000) * bounded(ev.kwhPer100km, 0, 100)) /
      100 /
      (1 - bounded(ev.chargingLossPercent, 0, 50) / 100)
    : 0;
  const evHours = bounded(ev.chargingHours, 0.25, 24, 6);
  for (let day = 0; day < DAYS; day++)
    addWindow(
      load,
      day,
      bounded(ev.startHour, 0, 23.999),
      evHours,
      monthlyEvKwh / DAYS / evHours,
    );

  const roofMaxKwp = bounded(settings.roofAreaM2, 0, 500) / ROOF_M2_PER_KWP;
  const solarKwp = Math.min(bounded(settings.solarKwp, 0, 30), roofMaxKwp);
  const dailyYieldPerKwp =
    bounded(settings.peakSunHours, 0, 8) *
    bounded(settings.performanceRatio, 0, 1);
  const solarPerKwp = SOLAR_SHAPE.map(
    (weight) => (weight / SOLAR_SHAPE_TOTAL) * dailyYieldPerKwp,
  );
  const hourly: HourlyEnergy[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    load: 0,
    solar: solarPerKwp[hour] * solarKwp,
    selfConsumed: 0,
    gridImport: 0,
    exported: 0,
    curtailed: 0,
  }));
  let selfConsumedKwh = 0;
  let exportKwh = 0;
  let curtailedKwh = 0;
  let daytimeLoadKwh = 0;
  const exportLimit = settings.exportEnabled
    ? bounded(settings.exportPowerLimitKw ?? 5, 0, 5, 5)
    : 0;
  for (let index = 0; index < HOURS; index++) {
    const hour = index % 24;
    const solar = hourly[hour].solar;
    const self = Math.min(load[index], solar);
    const surplus = Math.max(0, solar - self);
    const exported = Math.min(surplus, exportLimit);
    const curtailed = surplus - exported;
    selfConsumedKwh += self;
    exportKwh += exported;
    curtailedKwh += curtailed;
    if (SOLAR_SHAPE[hour] > 0) daytimeLoadKwh += load[index];
    hourly[hour].load += load[index] / DAYS;
    hourly[hour].selfConsumed += self / DAYS;
    hourly[hour].gridImport += Math.max(0, load[index] - self) / DAYS;
    hourly[hour].exported += exported / DAYS;
    hourly[hour].curtailed += curtailed / DAYS;
  }

  const monthlyLoadKwh = monthlyHouseholdKwh + monthlyEvKwh;
  const solarKwh = solarKwp * dailyYieldPerKwp * DAYS;
  const gridImportKwh = Math.max(0, monthlyLoadKwh - selfConsumedKwh);
  const tariffVersion =
    settings.tariffVersion === "legacy" ? "legacy" : "sep2026";
  const billBeforeBreakdown = calculateBillBreakdown(
    monthlyLoadKwh,
    settings.ftRate,
    tariffVersion,
  );
  const billAfterBreakdown = calculateBillBreakdown(
    gridImportKwh,
    settings.ftRate,
    tariffVersion,
  );
  const billBefore = billBeforeBreakdown.total;
  const billAfter = billAfterBreakdown.total;
  const monthlySavings = Math.max(0, billBefore - billAfter);
  const monthlyExportIncome =
    exportKwh * bounded(settings.exportRate, 0, 10, 2.2);
  const monthlyNetBenefit = monthlySavings + monthlyExportIncome;
  const annualBenefit = monthlyNetBenefit * 12;
  const installationCost =
    solarKwp * bounded(settings.installationCostPerKwp, 0, 200000, 35000);
  const annualSavings = monthlySavings * 12;
  const contractedBenefit = annualBenefit * 10;
  let paybackYears: number | null = null;
  if (installationCost > 0 && annualBenefit > 0) {
    if (installationCost <= contractedBenefit)
      paybackYears = installationCost / annualBenefit;
    else if (annualSavings > 0)
      paybackYears =
        10 + (installationCost - contractedBenefit) / annualSavings;
  }

  // Largest half-kWp system with >=70% direct self-use; no export income drives
  // sizing. A small positive daytime load gets at most a 0.5-kWp starting point
  // when no candidate reaches the target. A site survey must confirm feasibility.
  let recommendedKwp = 0;
  if (daytimeLoadKwh > 1e-9 && dailyYieldPerKwp > 0 && roofMaxKwp >= 0.5) {
    recommendedKwp = 0.5;
    for (let size = 0.5; size <= Math.min(30, roofMaxKwp); size += 0.5) {
      const self = load.reduce(
        (sum, demand, index) =>
          sum + Math.min(demand, solarPerKwp[index % 24] * size),
        0,
      );
      if (self / (size * dailyYieldPerKwp * DAYS) >= 0.7) recommendedKwp = size;
      else break;
    }
  }
  const variableBill = Math.max(
    0,
    billBefore - SERVICE_CHARGE * (1 + VAT_RATE),
  );
  for (const device of deviceUsage)
    device.cost =
      monthlyLoadKwh > 0 ? (variableBill * device.kwh) / monthlyLoadKwh : 0;

  return {
    monthlyLoadKwh,
    monthlyHouseholdKwh,
    monthlyEvKwh,
    daytimeLoadKwh,
    solarKwp,
    solarKwh,
    selfConsumedKwh,
    surplusKwh: exportKwh + curtailedKwh,
    exportKwh,
    curtailedKwh,
    gridImportKwh,
    billBefore,
    billAfter,
    billBeforeBreakdown,
    billAfterBreakdown,
    monthlySavings,
    monthlyExportIncome,
    monthlyNetBenefit,
    annualBenefit,
    installationCost,
    paybackYears,
    recommendedKwp,
    roofMaxKwp,
    selfConsumptionPercent:
      solarKwh > 0 ? Math.min(100, (selfConsumedKwh / solarKwh) * 100) : 0,
    solarCoveragePercent:
      monthlyLoadKwh > 0
        ? Math.min(100, (selfConsumedKwh / monthlyLoadKwh) * 100)
        : 0,
    hourly,
    deviceUsage,
  };
}
