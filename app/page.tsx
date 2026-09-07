"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type CSSProperties,
  type InputHTMLAttributes,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  CarFront,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Cpu,
  Info,
  Leaf,
  Lightbulb,
  Minus,
  Moon,
  PanelTop,
  Pause,
  Pencil,
  Play,
  Plus,
  Refrigerator,
  Rotate3D,
  Save,
  Settings2,
  Snowflake,
  Sparkles,
  Sun,
  Trash2,
  Tv,
  WashingMachine,
  Waves,
  X,
  Zap,
} from "lucide-react";
import EnergyScene from "./components/EnergyScene";
import {
  APPLIANCE_PRESETS,
  DEFAULT_APPLIANCES,
  DEFAULT_EV,
  DEFAULT_SETTINGS,
  SOURCES,
  EXPORT_NOTE,
  calculateEnergy,
  type Appliance,
  type EVSettings,
  type PlannerSettings,
} from "./lib/energy";

const fmt = (n: number, digits = 0) =>
  new Intl.NumberFormat("th-TH", { maximumFractionDigits: digits }).format(
    Number.isFinite(n) ? n : 0,
  );
const money = (n: number) => `฿${fmt(n)}`;
const STORAGE_KEY = "ampsoria-solar-plan-v1";
const icons = {
  ac: Snowflake,
  fridge: Refrigerator,
  tv: Tv,
  washer: WashingMachine,
  light: Lightbulb,
  waterheater: Waves,
  computer: Cpu,
  custom: Zap,
};
const emptyAppliance: Appliance = {
  id: "",
  name: "",
  kind: "custom",
  watts: 100,
  count: 1,
  hoursPerDay: 4,
  daysPerMonth: 30,
  startHour: 18,
  dutyCycle: 1,
};
function DeviceIcon({ kind, size = 20 }: { kind: string; size?: number }) {
  const Icon = icons[kind as keyof typeof icons] ?? Zap;
  return <Icon size={size} strokeWidth={1.7} />;
}
function Field({
  label,
  unit,
  children,
  hint,
}: {
  label: string;
  unit?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        {children}
        {unit && <span className="input-unit">{unit}</span>}
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}
// Preserve an in-progress number (including an empty field) while typing.
// Commit only finite values; clamp on blur so large minimums do not fight input.
function NumberInput({
  value,
  onChange,
  min,
  max,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & { value: number }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      value={editing ?? value}
      onFocus={() => setEditing(String(value))}
      onChange={(event) => {
        setEditing(event.target.value);
        const n = event.target.valueAsNumber;
        if (
          Number.isFinite(n) &&
          n >= Number(min ?? -Infinity) &&
          n <= Number(max ?? Infinity)
        )
          onChange?.(event);
      }}
      onBlur={(event) => {
        const n = event.target.valueAsNumber;
        if (Number.isFinite(n)) {
          event.target.value = String(
            Math.min(
              Number(max ?? Infinity),
              Math.max(Number(min ?? -Infinity), n),
            ),
          );
          onChange?.(event);
        }
        setEditing(null);
      }}
    />
  );
}
function HourOptions() {
  return (
    <>
      {Array.from({ length: 24 }, (_, i) => (
        <option key={i} value={i}>
          {String(i).padStart(2, "0")}:00 น.
        </option>
      ))}
    </>
  );
}

function ApplianceDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: Appliance | null;
  onClose: () => void;
  onSave: (a: Appliance) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Appliance>(initial ?? emptyAppliance);
  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  function update<K extends keyof Appliance>(key: K, value: Appliance[K]) {
    setDraft((a) => ({ ...a, [key]: value }));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      id: draft.id || crypto.randomUUID(),
    });
  }
  return (
    <dialog
      ref={dialog}
      className="device-dialog"
      aria-labelledby="device-dialog-title"
      onCancel={onClose}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">MAKE IT YOUR HOME</span>
            <h2 id="device-dialog-title">
              {initial ? "แก้ไขเครื่องใช้ไฟฟ้า" : "เพิ่มพลังงานให้บ้านของคุณ"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="ปิด">
            <X size={22} />
          </button>
        </div>
        {!initial && (
          <>
            <p className="muted">เลือกอุปกรณ์เริ่มต้น หรือกำหนดสเปกของคุณเอง</p>
            <div className="preset-grid">
              {APPLIANCE_PRESETS.map((p) => (
                <button
                  key={p.kind}
                  className={`preset ${draft.kind === p.kind ? "selected" : ""}`}
                  onClick={() => setDraft({ ...p, id: "" })}
                >
                  <DeviceIcon kind={p.kind} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <form onSubmit={submit} className="device-form">
          <Field label="ชื่ออุปกรณ์">
            <input
              required
              maxLength={60}
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="เช่น แอร์ห้องนอน"
            />
          </Field>
          <div className="form-grid">
            <Field label="กำลังไฟ" unit="วัตต์">
              <NumberInput
                type="number"
                min="1"
                max="50000"
                required
                value={draft.watts}
                onChange={(e) => update("watts", Number(e.target.value))}
              />
            </Field>
            <Field label="จำนวน" unit="เครื่อง">
              <NumberInput
                type="number"
                min="1"
                max="100"
                step="1"
                required
                value={draft.count}
                onChange={(e) => update("count", Number(e.target.value))}
              />
            </Field>
            <Field label="เปิดวันละ" unit="ชั่วโมง">
              <NumberInput
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                required
                value={draft.hoursPerDay}
                onChange={(e) => update("hoursPerDay", Number(e.target.value))}
              />
            </Field>
            <Field label="ใช้เดือนละ" unit="วัน">
              <NumberInput
                type="number"
                min="1"
                max="30"
                step="1"
                required
                value={draft.daysPerMonth}
                onChange={(e) => update("daysPerMonth", Number(e.target.value))}
              />
            </Field>
            <Field label="เวลาเริ่มใช้งาน">
              <select
                value={draft.startHour}
                onChange={(e) => update("startHour", Number(e.target.value))}
              >
                <HourOptions />
              </select>
            </Field>
            <Field
              label="สัดส่วนทำงานจริง"
              unit="%"
              hint="แอร์และตู้เย็นมีช่วงตัดการทำงาน"
            >
              <NumberInput
                type="number"
                min="1"
                max="100"
                step="1"
                required
                value={Math.round(draft.dutyCycle * 100)}
                onChange={(e) =>
                  update("dutyCycle", Number(e.target.value) / 100)
                }
              />
            </Field>
          </div>
          <div className="form-preview">
            <Zap size={18} />
            <span>
              ประมาณ{" "}
              <strong>
                {fmt(
                  (draft.watts *
                    draft.count *
                    draft.hoursPerDay *
                    draft.daysPerMonth *
                    draft.dutyCycle) /
                    1000,
                  1,
                )}{" "}
                kWh
              </strong>{" "}
              / เดือน
            </span>
          </div>
          <button className="primary-button full" type="submit">
            <Check size={18} />
            {initial ? "บันทึกการแก้ไข" : "เพิ่มอุปกรณ์เข้าบ้าน"}
          </button>
        </form>
      </div>
    </dialog>
  );
}

export default function Home() {
  const [appliances, setAppliances] = useState<Appliance[]>(DEFAULT_APPLIANCES);
  const [ev, setEv] = useState<EVSettings>(DEFAULT_EV);
  const [settings, setSettings] = useState<PlannerSettings>(DEFAULT_SETTINGS);
  const [night, setNight] = useState(false),
    [playing, setPlaying] = useState(true);
  const [tab, setTab] = useState<"devices" | "ev">("devices");
  const [modal, setModal] = useState<{ initial: Appliance | null } | null>(
    null,
  );
  const [toast, setToast] = useState(""),
    [saved, setSaved] = useState(false),
    [selectedHour, setSelectedHour] = useState(12);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const result = useMemo(
    () => calculateEnergy(appliances, ev, settings),
    [appliances, ev, settings],
  );
  function announce(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const plan = JSON.parse(raw);
        const numeric = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v);
        const devicesValid =
          Array.isArray(plan.appliances) &&
          plan.appliances.length <= 100 &&
          plan.appliances.every(
            (a: Appliance) =>
              typeof a.id === "string" &&
              typeof a.name === "string" &&
              a.name.length <= 60 &&
              typeof a.kind === "string" &&
              [
                a.watts,
                a.count,
                a.hoursPerDay,
                a.daysPerMonth,
                a.startHour,
                a.dutyCycle,
              ].every(numeric) &&
              a.watts > 0 &&
              a.watts <= 50000 &&
              Number.isInteger(a.count) &&
              a.count >= 1 &&
              a.count <= 100 &&
              a.hoursPerDay > 0 &&
              a.hoursPerDay <= 24 &&
              a.daysPerMonth >= 1 &&
              a.daysPerMonth <= 30 &&
              a.startHour >= 0 &&
              a.startHour <= 23 &&
              a.dutyCycle > 0 &&
              a.dutyCycle <= 1,
          );
        const validObject = (o: Record<string, unknown>, defaults: object) =>
          o &&
          Object.entries(defaults).every(
            ([k, v]) =>
              typeof o[k] === typeof v &&
              (typeof v !== "number" || numeric(o[k])),
          );
        const restoredEv = { ...DEFAULT_EV, ...plan.ev };
        const restoredSettings = { ...DEFAULT_SETTINGS, ...plan.settings };
        // Load browser-only saved state after the first render matches the server.
        if (
          plan.version === 1 &&
          devicesValid &&
          validObject(restoredEv, DEFAULT_EV) &&
          Number.isInteger(restoredEv.count) &&
          restoredEv.count >= 0 &&
          restoredEv.count <= 6 &&
          validObject(restoredSettings, DEFAULT_SETTINGS)
        ) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setAppliances(plan.appliances);
          setEv(restoredEv);
          setSettings(restoredSettings);
          setSaved(true);
        }
      }
    } catch {
      /* Storage can be disabled. The calculator remains available. */
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  function updateSettings<K extends keyof PlannerSettings>(
    key: K,
    value: PlannerSettings[K],
  ) {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }
  function updateEv<K extends keyof EVSettings>(key: K, value: EVSettings[K]) {
    setEv((s) => ({ ...s, [key]: value }));
    setSaved(false);
  }
  function savePlan() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, appliances, ev, settings }),
      );
      setSaved(true);
      announce("บันทึกแผนไว้ในเบราว์เซอร์นี้แล้ว");
    } catch {
      announce("บันทึกไม่ได้ กรุณาดาวน์โหลดสรุปเก็บไว้");
    }
  }
  function saveAppliance(a: Appliance) {
    setAppliances((prev) =>
      prev.some((x) => x.id === a.id)
        ? prev.map((x) => (x.id === a.id ? a : x))
        : [...prev, a],
    );
    setSaved(false);
    setModal(null);
  }
  function changeCount(id: string, delta: number) {
    setAppliances((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, count: Math.max(1, Math.min(100, a.count + delta)) }
          : a,
      ),
    );
    setSaved(false);
  }
  function removeDevice(id: string) {
    setAppliances((prev) => prev.filter((a) => a.id !== id));
    setSaved(false);
  }
  function addSceneItem(kind: "light" | "ev") {
    if (kind === "ev") {
      setEv((previous) => ({
        ...previous,
        enabled: true,
        count: previous.enabled ? Math.min(6, previous.count + 1) : 1,
      }));
    } else {
      const existing = appliances.find(
        (item) => item.kind === "light" && item.count < 100,
      );
      if (existing) changeCount(existing.id, 1);
      else if (appliances.length < 100) {
        const preset = APPLIANCE_PRESETS.find((item) => item.kind === "light")!;
        setAppliances((previous) => [
          ...previous,
          { ...preset, id: crypto.randomUUID() },
        ]);
      }
    }
    setSaved(false);
  }
  function downloadReport() {
    const escape = (v: unknown) =>
      `"${String(v)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows: unknown[][] = [
      ["Ampsoria Solar Planner", "ประมาณการ 30 วัน/เดือน"],
      [
        "อุปกรณ์",
        "จำนวน",
        "วัตต์",
        "ชม./วัน",
        "วัน/เดือน",
        "เวลาเริ่ม",
        "สัดส่วนทำงาน",
        "kWh/เดือน",
      ],
      ...appliances.map((a) => [
        a.name,
        a.count,
        a.watts,
        a.hoursPerDay,
        a.daysPerMonth,
        `${a.startHour}:00`,
        a.dutyCycle,
        result.deviceUsage.find((d) => d.id === a.id)?.kwh ?? 0,
      ]),
      [],
      ["EV kWh/เดือน", result.monthlyEvKwh],
      ["จำนวนรถ EV", ev.enabled ? ev.count : 0],
      ["EV km/คัน/เดือน", ev.kmPerMonth],
      ["ลดไฟที่ซื้อ เปอร์เซ็นต์", result.solarCoveragePercent],
      ["ลดค่าไฟ เปอร์เซ็นต์", result.billReductionPercent],
      ["ขนาดโซลาร์ kWp", result.solarKwp],
      ["ใช้ไฟรวม kWh/เดือน", result.monthlyLoadKwh],
      ["โซลาร์ผลิต kWh/เดือน", result.solarKwh],
      ["โซลาร์ใช้เอง kWh/เดือน", result.selfConsumedKwh],
      ["ซื้อไฟ kWh/เดือน", result.gridImportKwh],
      ["ขายไฟ kWh/เดือน", result.exportKwh],
      ["ค่าไฟก่อน บาท/เดือน", result.billBefore],
      ["ค่าไฟหลัง บาท/เดือน", result.billAfter],
      ["ค่าไฟที่ประหยัด บาท/เดือน", result.monthlySavings],
      ["รายได้ขายไฟ บาท/เดือน", result.monthlyExportIncome],
      ["ประโยชน์รวมปีแรก บาท", result.annualBenefit],
      ["งบติดตั้ง บาท", result.installationCost],
      ["คืนทุน ปี", result.paybackYears ?? "ไม่เกิดการคืนทุน"],
      [],
      ["สมมติฐาน", JSON.stringify(settings)],
      ["EV", JSON.stringify(ev)],
      [
        "หมายเหตุ",
        "ประมาณการ ไม่ใช่ใบเสนอราคา ขายไฟต้องได้รับอนุมัติ รายได้ขายไฟสิ้นสุดปีที่10 ไม่มีแบตเตอรี่ ไม่รวมเสื่อมสภาพและค่าบำรุงรักษา",
      ],
      ["เครดิตผู้สร้าง", "Ampsoria"],
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Ampsoria-Solar-Plan.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("ดาวน์โหลดสรุปแผนแล้ว");
  }
  function selectScene(kind: "solar" | "home" | "ev") {
    if (kind === "ev") setTab("ev");
    if (kind === "home") setTab("devices");
    document
      .getElementById(kind === "solar" ? "solar" : "appliances")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const currentHour = result.hourly[night ? 21 : 12],
    chartHour = result.hourly[selectedHour];
  const chartMax = Math.max(
    1,
    ...result.hourly.map((h) => Math.max(h.load, h.solar)),
  );
  const usageMax = Math.max(1, ...result.deviceUsage.map((a) => a.kwh));
  const sliderMax = Math.min(30, Math.floor(result.roofMaxKwp * 2) / 2);
  const billParts = result.billBefore.toFixed(2).split(".");
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#overview" aria-label="Ampsoria หน้าหลัก">
            <span className="brand-symbol">
              <Zap size={22} fill="currentColor" />
            </span>
            <span>
              ampsoria<span className="brand-dot">.</span>
              <small>SOLAR PLANNER</small>
            </span>
          </a>
          <nav aria-label="เมนูหลัก">
            <a className="active" href="#overview">
              ภาพรวมบ้าน
            </a>
            <a href="#appliances">เครื่องใช้ไฟฟ้า</a>
            <a href="#solar">วางแผนโซลาร์</a>
          </nav>
          <button
            className={`save-button ${saved ? "is-saved" : ""}`}
            onClick={savePlan}
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            <span>{saved ? "บันทึกแล้ว" : "บันทึกแผน"}</span>
          </button>
        </div>
      </header>
      <main>
        <section className="intro" id="overview">
          <div>
            <div className="eyebrow">
              <span className="live-dot" />A BRIGHTER HOME STARTS HERE
            </div>
            <h1>
              พลังงานที่ใช่ <span>สำหรับบ้านคุณ.</span>
            </h1>
            <p>
              รู้จักการใช้ไฟของคุณ เลือกโซลาร์ให้พอดี
              แล้วมองเห็นความคุ้มค่าก่อนติดตั้ง
            </p>
          </div>
          <a className="text-link intro-link" href="#method">
            <CircleHelp size={17} />
            คำนวณอย่างไร
            <ArrowUpRight size={15} />
          </a>
        </section>
        <div className="hero-grid">
          <section
            className={`scene-card ${night ? "night" : ""}`}
            aria-label="แบบจำลองบ้านสามมิติ"
          >
            <div className="scene-heading">
              <div className="scene-title">
                <span className="live-dot" />
                <span>
                  บ้านพลังงานของคุณ<small>SIMULATED AVERAGE DAY</small>
                </span>
              </div>
              <span className="scene-mode">INTERACTIVE 3D</span>
            </div>
            <div className="scene-canvas">
              <EnergyScene
                night={night}
                solarKw={result.solarKwp}
                evEnabled={ev.enabled && ev.count > 0}
                evCount={ev.enabled ? ev.count : 0}
                evCharging={
                  ev.enabled &&
                  ev.kmPerMonth > 0 &&
                  ((night ? 21 : 12) - ev.startHour + 24) % 24 <
                    ev.chargingHours
                }
                appliances={appliances}
                playing={playing}
                onSelect={selectScene}
              />
            </div>
            <div className="scene-badge solar-badge">
              <span className="badge-icon sun-icon">
                <Sun size={17} />
              </span>
              <div>
                <small>พลังงานจากโซลาร์</small>
                <strong>
                  {fmt(currentHour.solar, 2)} <span>kW</span>
                </strong>
              </div>
              <span className="badge-pulse" />
            </div>
            <div className="scene-badge home-badge">
              <span className="badge-icon purple-icon">
                <Zap size={17} />
              </span>
              <div>
                <small>บ้านใช้ไฟ · วันเฉลี่ย</small>
                <strong>
                  {fmt(currentHour.load, 2)} <span>kW</span>
                </strong>
              </div>
            </div>
            <div className="scene-bottom">
              <span className="scene-hint">
                <Rotate3D size={16} />
                ลากเพื่อหมุน · แตะบ้านเพื่อแก้ไข
              </span>
              <div className="scene-controls">
                <button
                  className="motion-button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={
                    playing ? "หยุดภาพเคลื่อนไหว" : "เล่นภาพเคลื่อนไหว"
                  }
                >
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <div className="day-switch" aria-label="ช่วงเวลาจำลอง">
                  <button
                    className={!night ? "selected" : ""}
                    onClick={() => setNight(false)}
                    aria-pressed={!night}
                  >
                    <Sun size={14} />
                    <span>12:00</span>
                  </button>
                  <button
                    className={night ? "selected" : ""}
                    onClick={() => setNight(true)}
                    aria-pressed={night}
                  >
                    <Moon size={14} />
                    <span>21:00</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
          <aside className="summary-card">
            <div className="summary-top">
              <span className="label">ภาพรวมพลังงานของคุณ</span>
              <span className="round-icon">
                <Zap size={18} />
              </span>
            </div>
            <p className="summary-subtitle">ค่าไฟก่อนติดโซลาร์ / เดือน</p>
            <div className="bill-number">
              ฿{fmt(Number(billParts[0]))}
              <span>.{billParts[1]}</span>
            </div>
            <div className="consumption-pill">
              <span className="live-dot" />
              {fmt(result.monthlyLoadKwh, 1)} kWh <span>ต่อเดือน</span>
            </div>
            <div className="summary-coverage">
              <Sun size={14} />
              โซลาร์ลดไฟที่ซื้อได้{" "}
              <strong>{fmt(result.solarCoveragePercent, 1)}%</strong>
            </div>
            <div className="summary-divider" />
            <div className="summary-row">
              <span>ค่าไฟหลังติดโซลาร์</span>
              <strong>
                {money(result.billAfter)}
                <small> / เดือน</small>
              </strong>
            </div>
            <div className="summary-row">
              <span>รายได้ขายไฟคืน</span>
              <strong>
                {money(result.monthlyExportIncome)}
                <small> / เดือน</small>
              </strong>
            </div>
            <div className="saving-highlight">
              <div>
                <span>ประหยัด + รายได้รวม</span>
                <strong>
                  {money(result.monthlyNetBenefit)}
                  <small> / เดือน</small>
                </strong>
              </div>
              <span className="saving-arrow">
                <ArrowUpRight size={27} />
              </span>
            </div>
            <a className="mint-button" href="#solar">
              ออกแบบระบบโซลาร์ของฉัน
              <ArrowRight size={18} />
            </a>
            <small className="summary-note">
              ประมาณการจากแผนตัวอย่าง · ปรับให้ตรงบ้านคุณได้
            </small>
          </aside>
        </div>
        <div className="scene-actions">
          <span>
            <Rotate3D size={16} />
            <strong>
              {appliances.reduce((sum, a) => sum + a.count, 0)}
            </strong>{" "}
            เครื่องใช้ไฟฟ้า · <strong>{ev.enabled ? ev.count : 0}</strong> รถ EV{" "}
            <small>เพิ่ม 1 ชิ้น = โมเดล 1 ชิ้น</small>
          </span>
          <div>
            <button
              onClick={() => addSceneItem("light")}
              disabled={
                appliances.length >= 100 &&
                !appliances.some((a) => a.kind === "light" && a.count < 100)
              }
            >
              <Plus size={14} />
              <Lightbulb size={16} />
              หลอดไฟ
            </button>
            <button
              onClick={() => addSceneItem("ev")}
              disabled={ev.enabled && ev.count >= 6}
            >
              <Plus size={14} />
              <CarFront size={16} />
              รถ EV
            </button>
          </div>
        </div>
        <section className="metric-grid" aria-label="สรุปแผนโซลาร์">
          <div className="metric-card">
            <span className="metric-icon mint-icon">
              <PanelTop size={22} />
            </span>
            <div>
              <span className="metric-label">ขนาดโซลาร์แนะนำ</span>
              <strong>
                {fmt(result.recommendedKwp, 1)} <small>kWp</small>
              </strong>
              <span className="metric-caption">เน้นผลิตเพื่อใช้เองในบ้าน</span>
            </div>
            <span className="metric-tag">SMART FIT</span>
          </div>
          <div className="metric-card">
            <span className="metric-icon yellow-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <span className="metric-label">มูลค่าที่ได้ในปีแรก</span>
              <strong>
                {money(result.annualBenefit)} <small>/ ปี</small>
              </strong>
              <span className="metric-caption">ค่าไฟที่ลดลง + รายได้ขายไฟ</span>
            </div>
          </div>
          <div className="metric-card">
            <span className="metric-icon lavender-icon">
              <Clock3 size={22} />
            </span>
            <div>
              <span className="metric-label">ระยะคืนทุนเบื้องต้น</span>
              <strong>
                {result.paybackYears && result.installationCost > 0
                  ? fmt(result.paybackYears, 1)
                  : "—"}{" "}
                <small>
                  {result.paybackYears && result.installationCost > 0
                    ? "ปี"
                    : ""}
                </small>
              </strong>
              <span className="metric-caption">
                จากงบติดตั้ง {money(result.installationCost)}
              </span>
            </div>
          </div>
        </section>
        <div className="workspace-grid">
          <section className="panel appliances-panel" id="appliances">
            <div className="section-heading">
              <div>
                <span className="eyebrow">01 / YOUR LIFESTYLE</span>
                <h2>บ้านคุณ ใช้อะไรบ้าง?</h2>
                <p>ใส่อุปกรณ์และเวลาใช้งาน เพื่อให้แผนใกล้ชีวิตจริง</p>
              </div>
              <button
                className="primary-button add-button"
                onClick={() => setModal({ initial: null })}
                disabled={appliances.length >= 100}
              >
                <Plus size={17} />
                <span>เพิ่มอุปกรณ์</span>
              </button>
            </div>
            <div
              className="tabs"
              role="tablist"
              tabIndex={-1}
              aria-label="ประเภทการใช้ไฟ"
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "devices"
                      : event.key === "End"
                        ? "ev"
                        : tab === "devices"
                          ? "ev"
                          : "devices";
                  setTab(next);
                  document.getElementById(`${next}-tab`)?.focus();
                }
              }}
            >
              <button
                role="tab"
                id="devices-tab"
                tabIndex={tab === "devices" ? 0 : -1}
                aria-controls="devices-panel"
                aria-selected={tab === "devices"}
                className={tab === "devices" ? "selected" : ""}
                onClick={() => setTab("devices")}
              >
                เครื่องใช้ไฟฟ้า{" "}
                <span className="count-badge">{appliances.length}</span>
              </button>
              <button
                role="tab"
                id="ev-tab"
                tabIndex={tab === "ev" ? 0 : -1}
                aria-controls="ev-panel"
                aria-selected={tab === "ev"}
                className={tab === "ev" ? "selected" : ""}
                onClick={() => setTab("ev")}
              >
                <CarFront size={17} />
                รถยนต์ไฟฟ้า {ev.enabled && <span className="tiny-dot" />}
              </button>
            </div>
            {tab === "devices" ? (
              <div
                id="devices-panel"
                role="tabpanel"
                aria-labelledby="devices-tab"
              >
                <div className="appliance-table">
                  <div className="table-head">
                    <span>อุปกรณ์</span>
                    <span>จำนวน</span>
                    <span>ชม. / วัน</span>
                    <span>หน่วย / เดือน</span>
                    <span />
                  </div>
                  {appliances.map((a) => {
                    const usage =
                      result.deviceUsage.find((d) => d.id === a.id)?.kwh ?? 0;
                    return (
                      <div className="device-row" key={a.id}>
                        <button
                          className={`device-name ${a.kind}`}
                          onClick={() => setModal({ initial: a })}
                        >
                          <span className="device-icon">
                            <DeviceIcon kind={a.kind} />
                          </span>
                          <span>
                            <strong>{a.name}</strong>
                            <small>
                              {fmt(a.watts)} W ·{" "}
                              {String(a.startHour).padStart(2, "0")}:00 น.
                            </small>
                          </span>
                        </button>
                        <div className="stepper">
                          <button
                            aria-label={`ลดจำนวน ${a.name}`}
                            disabled={a.count <= 1}
                            onClick={() => changeCount(a.id, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span>{a.count}</span>
                          <button
                            aria-label={`เพิ่มจำนวน ${a.name}`}
                            disabled={a.count >= 100}
                            onClick={() => changeCount(a.id, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button
                          className="hours-button"
                          onClick={() => setModal({ initial: a })}
                          aria-label={`แก้ไขเวลาของ ${a.name}`}
                        >
                          {fmt(a.hoursPerDay, 2)}
                          <Pencil size={10} />
                        </button>
                        <div className="usage-cell">
                          <strong>
                            {fmt(usage, 1)}
                            <small> kWh</small>
                          </strong>
                          <span className="usage-track">
                            <i
                              style={{
                                width: `${Math.max(2, (usage / usageMax) * 100)}%`,
                              }}
                            />
                          </span>
                        </div>
                        <button
                          className="delete-button"
                          onClick={() => removeDevice(a.id)}
                          aria-label={`ลบ ${a.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {!appliances.length && (
                  <div className="empty-state">
                    <Lightbulb size={28} />
                    <h3>เริ่มจากอุปกรณ์ชิ้นแรก</h3>
                    <p>ลองเพิ่มแอร์ ตู้เย็น หรืออุปกรณ์ที่คุณใช้ทุกวัน</p>
                    <button
                      className="primary-button"
                      onClick={() => setModal({ initial: null })}
                    >
                      <Plus size={16} />
                      เพิ่มอุปกรณ์
                    </button>
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    <Info size={14} />
                    แตะชื่ออุปกรณ์เพื่อปรับกำลังไฟและเวลา
                  </span>
                  <strong>
                    รวม {fmt(result.monthlyHouseholdKwh, 1)}{" "}
                    <small>kWh / เดือน</small>
                  </strong>
                </div>
              </div>
            ) : (
              <div
                id="ev-panel"
                role="tabpanel"
                aria-labelledby="ev-tab"
                className="ev-panel"
              >
                <div className="ev-intro">
                  <span className="ev-big-icon">
                    <CarFront size={34} />
                  </span>
                  <div>
                    <h3>ให้รถของคุณเป็นส่วนหนึ่งของแผน</h3>
                    <p>คำนวณจากระยะทางและเวลาชาร์จที่บ้าน</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={ev.enabled}
                      onChange={(e) => updateEv("enabled", e.target.checked)}
                      aria-label="รวมรถ EV ในการคำนวณ"
                    />
                    <span />
                  </label>
                </div>
                <div className="ev-count-row">
                  <div>
                    <strong>จำนวนรถในบ้าน</strong>
                    <small>
                      แต่ละคันใช้ระยะทางและเวลาชาร์จเดียวกัน · สูงสุด 6 คัน
                    </small>
                  </div>
                  <div className="stepper">
                    <button
                      aria-label="ลดรถ EV 1 คัน"
                      disabled={!ev.enabled || ev.count === 0}
                      onClick={() => updateEv("count", ev.count - 1)}
                    >
                      <Minus size={16} />
                    </button>
                    <span>{ev.enabled ? ev.count : 0}</span>
                    <button
                      aria-label="เพิ่มรถ EV 1 คัน"
                      disabled={ev.enabled && ev.count >= 6}
                      onClick={() => addSceneItem("ev")}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <fieldset
                  disabled={!ev.enabled || ev.count === 0}
                  className="ev-fields"
                >
                  <div className="form-grid">
                    <Field
                      label="ระยะทางต่อรถ 1 คัน"
                      unit="กม. / เดือน"
                      hint="นับเฉพาะระยะทางที่เติมไฟจากบ้าน"
                    >
                      <NumberInput
                        type="number"
                        min="0"
                        max="30000"
                        step="100"
                        value={ev.kmPerMonth}
                        onChange={(e) =>
                          updateEv(
                            "kmPerMonth",
                            Math.max(
                              0,
                              Math.min(30000, Number(e.target.value)),
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="อัตราสิ้นเปลืองรถ" unit="kWh / 100 กม.">
                      <NumberInput
                        type="number"
                        min="1"
                        max="60"
                        step="0.5"
                        value={ev.kwhPer100km}
                        onChange={(e) =>
                          updateEv(
                            "kwhPer100km",
                            Math.max(1, Math.min(60, Number(e.target.value))),
                          )
                        }
                      />
                    </Field>
                    <Field label="เวลาเริ่มชาร์จ">
                      <select
                        value={ev.startHour}
                        onChange={(e) =>
                          updateEv("startHour", Number(e.target.value))
                        }
                      >
                        <HourOptions />
                      </select>
                    </Field>
                    <Field label="ช่วงเวลาที่ชาร์จต่อวัน" unit="ชั่วโมง">
                      <NumberInput
                        type="number"
                        min="1"
                        max="24"
                        step="1"
                        value={ev.chargingHours}
                        onChange={(e) =>
                          updateEv(
                            "chargingHours",
                            Math.max(1, Math.min(24, Number(e.target.value))),
                          )
                        }
                      />
                    </Field>
                    <Field label="การสูญเสียระหว่างชาร์จ" unit="%">
                      <NumberInput
                        type="number"
                        min="0"
                        max="40"
                        value={ev.chargingLossPercent}
                        onChange={(e) =>
                          updateEv(
                            "chargingLossPercent",
                            Math.max(0, Math.min(40, Number(e.target.value))),
                          )
                        }
                      />
                    </Field>
                    <div className="ev-total">
                      <BatteryCharging size={23} />
                      <span>
                        <small>ไฟสำหรับชาร์จรถ</small>
                        <strong>
                          {fmt(result.monthlyEvKwh, 1)}{" "}
                          <small>kWh / เดือน</small>
                        </strong>
                      </span>
                    </div>
                  </div>
                </fieldset>
                <div className="insight">
                  <Sun size={19} />
                  <p>
                    <strong>ลองเลื่อนเวลาชาร์จมาเป็นกลางวัน</strong>{" "}
                    โซลาร์จะช่วยลดไฟที่ซื้อได้มากขึ้น
                    โดยระบบเฉลี่ยพลังงานชาร์จเป็นรายวัน
                  </p>
                </div>
                <button
                  className="recommend-button"
                  disabled={!ev.enabled}
                  onClick={() => updateEv("startHour", 10)}
                >
                  <Sun size={15} />
                  ลองชาร์จ EV เวลา 10:00 น.
                  <ArrowUpRight size={15} />
                </button>
              </div>
            )}
          </section>
          <section className="panel solar-panel" id="solar">
            <div className="section-heading">
              <div>
                <span className="eyebrow">02 / YOUR SOLAR PLAN</span>
                <h2>ออกแบบแสงแดดของคุณ</h2>
              </div>
              <span className="section-icon">
                <Sun size={23} />
              </span>
            </div>
            <div className="solar-size-heading">
              <span>ขนาดระบบที่ต้องการ</span>
              <strong>
                {fmt(result.solarKwp, 1)} <small>kWp</small>
              </strong>
            </div>
            <input
              className="solar-range"
              type="range"
              min="0"
              max={Math.max(0.5, sliderMax)}
              step="0.5"
              disabled={sliderMax === 0}
              value={Math.min(settings.solarKwp, sliderMax)}
              aria-label="ขนาดระบบโซลาร์ kWp"
              onChange={(e) =>
                updateSettings("solarKwp", Number(e.target.value))
              }
              style={
                {
                  "--range-progress": `${(result.solarKwp / Math.max(0.5, sliderMax)) * 100}%`,
                } as CSSProperties
              }
            />
            <div className="range-labels">
              <span>0 kWp</span>
              <span>{fmt(sliderMax, 1)} kWp</span>
            </div>
            <div className="coverage-highlight" aria-live="polite">
              <div>
                <span>ติด {fmt(result.solarKwp, 1)} kWp ลดไฟที่ซื้อได้</span>
                <strong>
                  {fmt(result.solarCoveragePercent, 1)}
                  <small>%</small>
                </strong>
              </div>
              <span className="coverage-sun">
                <Sun size={27} />
              </span>
              <div className="coverage-meter">
                <i style={{ width: `${result.solarCoveragePercent}%` }} />
              </div>
              <p>
                โซลาร์ใช้เอง {fmt(result.selfConsumedKwh, 1)} จาก{" "}
                {fmt(result.monthlyLoadKwh, 1)} kWh/เดือน
              </p>
              <small>
                ค่าไฟลดลง {fmt(result.billReductionPercent, 1)}% หรือ{" "}
                {money(result.monthlySavings)}/เดือน · ยังไม่รวมรายได้ขายไฟ
              </small>
            </div>
            <div className="coverage-target">
              <label htmlFor="coverage-goal">อยากลดไฟที่ซื้อจากการไฟฟ้า</label>
              <select
                id="coverage-goal"
                value={settings.coverageTargetPercent ?? 50}
                onChange={(event) =>
                  updateSettings(
                    "coverageTargetPercent",
                    Number(event.target.value),
                  )
                }
              >
                {[25, 50, 75, 100].map((percent) => (
                  <option key={percent} value={percent}>
                    {percent}% ของไฟที่ใช้
                  </option>
                ))}
              </select>
              {result.monthlyLoadKwh === 0 ? (
                <p>เพิ่มอุปกรณ์หรือรถ EV เพื่อคำนวณขนาดโซลาร์</p>
              ) : result.coverageTargetKwp !== null ? (
                <>
                  <p>
                    ระบบตั้งแต่{" "}
                    <strong>{fmt(result.coverageTargetKwp, 1)} kWp</strong>{" "}
                    รองรับเป้าหมายนี้ได้ในแบบจำลอง
                  </p>
                  <button
                    className="primary-button full"
                    onClick={() =>
                      updateSettings("solarKwp", result.coverageTargetKwp!)
                    }
                  >
                    <PanelTop size={16} />
                    ใช้ขนาดตามเป้าหมาย
                    <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <p>
                  ด้วยเวลาใช้ไฟและพื้นที่หลังคานี้ โซลาร์ช่วยได้สูงสุด{" "}
                  <strong>{fmt(result.maximumCoveragePercent, 1)}%</strong>{" "}
                  ลองย้ายโหลดมาช่วงกลางวันหรือเพิ่มพื้นที่หลังคา
                  ไฟกลางคืนยังต้องซื้อหากไม่มีแบตเตอรี่
                </p>
              )}
            </div>
            <button
              className="recommend-button"
              onClick={() => updateSettings("solarKwp", result.recommendedKwp)}
            >
              <Sparkles size={15} />
              <span>
                เน้นใช้โซลาร์เอง · {fmt(result.recommendedKwp, 1)} kWp
              </span>
              <ArrowUpRight size={15} />
            </button>
            <div className="solar-detail-row">
              <span>ผลิตไฟได้ประมาณ</span>
              <strong>
                {fmt(result.solarKwh)} <small>kWh / เดือน</small>
              </strong>
            </div>
            <div className="solar-detail-row">
              <span>ใช้โซลาร์เองได้</span>
              <strong>
                {fmt(result.selfConsumptionPercent)}
                <small> % ของที่ผลิต</small>
              </strong>
            </div>
            <div
              className="energy-split"
              aria-label={`โซลาร์ใช้เอง ${fmt(result.selfConsumptionPercent)} เปอร์เซ็นต์`}
            >
              <span style={{ width: `${result.selfConsumptionPercent}%` }} />
            </div>
            <div className="split-legend">
              <span>
                <i />
                ใช้เอง {fmt(result.selfConsumedKwh)} หน่วย
              </span>
              <span>
                <i />
                ส่วนเกิน {fmt(result.surplusKwh)} หน่วย
              </span>
            </div>
            <div className="export-setting">
              <div className="export-title">
                <span className="export-icon">
                  <ArrowUpRight size={19} />
                </span>
                <div>
                  <strong>จำลองขายไฟคืน</strong>
                  <small>{fmt(settings.exportRate, 2)} บาท / kWh</small>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.exportEnabled}
                    onChange={(e) =>
                      updateSettings("exportEnabled", e.target.checked)
                    }
                    aria-label="จำลองการขายไฟคืน"
                  />
                  <span />
                </label>
              </div>
              <p>
                {settings.exportEnabled
                  ? "จำลองกรณีได้รับอนุมัติขายไฟแล้ว จำกัดกำลังส่งออก 5 kW ต่อมิเตอร์"
                  : "เปิดเพื่อจำลองกรณีได้รับอนุมัติขายไฟ ไฟส่วนเกินไม่หักกลบกับไฟที่ซื้อ"}
              </p>
            </div>
            <details className="advanced-settings">
              <summary>
                <Settings2 size={15} />
                ปรับสมมติฐาน
                <ChevronDown size={15} />
              </summary>
              <div className="advanced-fields">
                <Field label="พื้นที่หลังคาที่ใช้งานได้" unit="ตร.ม.">
                  <NumberInput
                    type="number"
                    min="0"
                    max="500"
                    step="5"
                    value={settings.roofAreaM2}
                    onChange={(e) => {
                      const roof = Math.max(
                        0,
                        Math.min(500, Number(e.target.value)),
                      );
                      setSettings((s) => ({
                        ...s,
                        roofAreaM2: roof,
                        solarKwp: Math.min(
                          s.solarKwp,
                          Math.floor((roof / 5) * 2) / 2,
                        ),
                      }));
                      setSaved(false);
                    }}
                  />
                </Field>
                <Field label="ชั่วโมงแดดเต็มกำลัง" unit="ชม. / วัน">
                  <NumberInput
                    type="number"
                    min="1"
                    max="7"
                    step="0.1"
                    value={settings.peakSunHours}
                    onChange={(e) =>
                      updateSettings(
                        "peakSunHours",
                        Math.max(1, Math.min(7, Number(e.target.value))),
                      )
                    }
                  />
                </Field>
                <Field label="ประสิทธิภาพระบบ" unit="%">
                  <NumberInput
                    type="number"
                    min="40"
                    max="100"
                    value={Math.round(settings.performanceRatio * 100)}
                    onChange={(e) =>
                      updateSettings(
                        "performanceRatio",
                        Math.max(
                          0.4,
                          Math.min(1, Number(e.target.value) / 100),
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="งบติดตั้งต่อ kWp" unit="บาท">
                  <NumberInput
                    type="number"
                    min="1000"
                    max="200000"
                    step="1000"
                    value={settings.installationCostPerKwp}
                    onChange={(e) =>
                      updateSettings(
                        "installationCostPerKwp",
                        Math.max(
                          1000,
                          Math.min(200000, Number(e.target.value)),
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="ค่า Ft ตามบิลจริง" unit="บาท / kWh">
                  <NumberInput
                    type="number"
                    min="-2"
                    max="5"
                    step="0.0001"
                    value={settings.ftRate}
                    onChange={(e) =>
                      updateSettings(
                        "ftRate",
                        Math.max(-2, Math.min(5, Number(e.target.value))),
                      )
                    }
                  />
                </Field>
                <Field label="อัตรารับซื้อที่ได้รับอนุมัติ" unit="บาท / kWh">
                  <NumberInput
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    value={settings.exportRate}
                    onChange={(e) =>
                      updateSettings(
                        "exportRate",
                        Math.max(0, Math.min(10, Number(e.target.value))),
                      )
                    }
                  />
                </Field>
              </div>
            </details>
          </section>
        </div>
        <section className="panel chart-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">03 / FOLLOW THE ENERGY</span>
              <h2>ใช้ไฟเวลาไหน ก็สำคัญพอกัน</h2>
              <p>
                การใช้ไฟและการผลิตโซลาร์ในวันเฉลี่ย ·
                แตะแท่งกราฟเพื่อดูรายละเอียด
              </p>
            </div>
            <div className="chart-legend">
              <span>
                <i className="solar-key" />
                โซลาร์ผลิต
              </span>
              <span>
                <i className="load-key" />
                ใช้ไฟทั้งหมด
              </span>
            </div>
          </div>
          <div className="chart-readout" aria-live="polite">
            <strong>{String(selectedHour).padStart(2, "0")}:00</strong>
            <span>
              ใช้ไฟ <b>{fmt(chartHour.load, 2)} kW</b>
            </span>
            <span>
              โซลาร์ <b>{fmt(chartHour.solar, 2)} kW</b>
            </span>
            <span>
              ซื้อไฟ <b>{fmt(chartHour.gridImport, 2)} kW</b>
            </span>
          </div>
          <div className="chart-layout">
            <div className="chart-y">
              <span>{fmt(chartMax, 1)} kW</span>
              <span>{fmt(chartMax / 2, 1)}</span>
              <span>0</span>
            </div>
            <div className="chart-area">
              <div className="chart-grid-lines">
                <i />
                <i />
                <i />
              </div>
              <div className="bars">
                {result.hourly.map((h) => (
                  <button
                    className={`hour-bar ${selectedHour === h.hour ? "selected" : ""} ${h.hour >= 6 && h.hour < 18 ? "daylight" : ""}`}
                    key={h.hour}
                    aria-label={`${h.hour}:00 ใช้ไฟ ${fmt(h.load, 2)} กิโลวัตต์ โซลาร์ ${fmt(h.solar, 2)} กิโลวัตต์`}
                    aria-pressed={selectedHour === h.hour}
                    onClick={() => setSelectedHour(h.hour)}
                  >
                    <span className="bar-pair">
                      <i
                        className="solar-bar"
                        style={{ height: `${(h.solar / chartMax) * 100}%` }}
                      />
                      <i
                        className="load-bar"
                        style={{ height: `${(h.load / chartMax) * 100}%` }}
                      />
                    </span>
                    <small>
                      {h.hour % 3 === 0
                        ? `${String(h.hour).padStart(2, "0")}:00`
                        : ""}
                    </small>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="chart-insight">
            <span className="insight-symbol">
              <Lightbulb size={18} />
            </span>
            <p>
              <strong>ให้แดดทำงาน ในเวลาที่คุณใช้ไฟ</strong>
              <span>
                โซลาร์ครอบคลุมการใช้ไฟได้ {fmt(result.solarCoveragePercent)}%
                ในแผนนี้ การย้ายงานซักผ้าหรือชาร์จ EV
                มาใกล้เที่ยงช่วยเพิ่มการใช้โซลาร์โดยตรง
              </span>
            </p>
          </div>
        </section>
        <section className="method-panel" id="method">
          <div className="method-heading">
            <div>
              <span className="eyebrow">BUILT ON CLEAR ASSUMPTIONS</span>
              <h2>รู้ที่มาของตัวเลข ก่อนตัดสินใจ</h2>
            </div>
            <button className="outline-button" onClick={downloadReport}>
              <ArrowDownToLine size={17} />
              ดาวน์โหลดสรุปแผน
            </button>
          </div>
          <div className="method-grid">
            <div>
              <span className="method-number">01</span>
              <h3>เริ่มจากพฤติกรรมจริง</h3>
              <p>
                วัตต์ × จำนวน × ชั่วโมง × วันใช้งาน × สัดส่วนทำงาน ÷ 1,000
                เป็นหน่วยต่อเดือน จำลอง 30
                วันและกระจายวันใช้งานทั่วเดือนตามเวลาเริ่มใช้
              </p>
            </div>
            <div>
              <span className="method-number">02</span>
              <h3>คิดไฟที่ใช้เองเป็นรายชั่วโมง</h3>
              <p>
                โซลาร์ใช้กับโหลดช่วงเดียวกันก่อน ส่วนที่ขาดซื้อจากการไฟฟ้า
                ส่วนเกินขายได้เมื่อได้รับอนุมัติ ยังไม่มีแบตเตอรี่
                แนะนำขนาดที่ใช้ไฟผลิตเองอย่างน้อย 70% หากทำได้ เริ่มขั้นต่ำ 0.5
                kWp เมื่อมีโหลดกลางวัน
              </p>
            </div>
            <div>
              <span className="method-number">03</span>
              <h3>ประมาณการอย่างมีบริบท</h3>
              <p>
                ค่าไฟบ้านอยู่อาศัยอัตราปกติ รวมค่าบริการ Ft และ VAT 7% ไม่รองรับ
                TOU หรือสิทธิ์ไฟฟรี คืนทุนแบบง่ายไม่รวมดอกเบี้ย การเสื่อมสภาพ
                และค่าบำรุงรักษา โดยหยุดรายได้ขายไฟหลังปีที่ 10
              </p>
            </div>
          </div>
          <details className="sources-details">
            <summary>
              <Info size={15} />
              อัตราที่ใช้ แหล่งอ้างอิง และข้อจำกัด
              <ChevronDown size={15} />
            </summary>
            <div className="sources-content">
              <p>
                <strong>ค่าไฟอ้างอิงกันยายน 2569:</strong> บ้านอยู่อาศัย MEA 1.2
                / PEA 1.1.2: 0–200 หน่วย 3.0000 บาท, 201–400 หน่วย 4.1584 บาท,
                มากกว่า 400 หน่วย 4.3583 บาท ค่าบริการ 24.62 บาท/เดือน ค่า Ft
                ตั้งต้น 0.1623 บาท/หน่วย สำหรับ ก.ย.–ธ.ค. 2569 ปรับ Ft
                ได้ตามบิลจริง
              </p>
              <p>
                <strong>การขายไฟคืน:</strong> {EXPORT_NOTE} รายได้เป็นการจำลอง
                ไม่ใช่การรับประกันการเข้าร่วมโครงการ
              </p>
              <p>
                <strong>ข้อจำกัด:</strong> แบบจำลองใช้แดดเหมือนกันทุกวัน
                จึงไม่ใช่การพยากรณ์ สภาพอากาศ เงาบัง ทิศและความเอียงหลังคามีผล
                พื้นที่เบื้องต้น 5 ตร.ม./kWp
                ควรสำรวจหน้างานและตรวจโครงสร้างก่อนเลือกติดตั้ง
                แผนที่บันทึกอยู่เฉพาะในเบราว์เซอร์นี้
              </p>
              <div className="source-links">
                {SOURCES.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.label}
                    <ArrowUpRight size={13} />
                  </a>
                ))}
              </div>
            </div>
          </details>
        </section>
        <div className="closing-note">
          <Leaf size={16} />
          <span>บ้านที่ดีขึ้น เริ่มจากเข้าใจพลังงานของเรา</span>
        </div>
      </main>
      <footer>
        <a className="footer-brand" href="#overview">
          ampsoria<span>.</span>
        </a>
        <span>
          Designed & created by <strong>Ampsoria</strong>
        </span>
        <span>
          SOLAR PLANNER <i />
          2026
        </span>
      </footer>
      {modal && (
        <ApplianceDialog
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSave={saveAppliance}
        />
      )}
      <div className={`toast ${toast ? "visible" : ""}`} role="status">
        <Check size={17} />
        {toast}
      </div>
    </>
  );
}
