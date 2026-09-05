const nf = new Intl.NumberFormat("km-KH", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("km-KH", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const nf2 = new Intl.NumberFormat("km-KH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const int = (v: number) => nf.format(Math.round(v));

export const num = (v: number, digits = 1) =>
  digits === 0 ? nf.format(v) : digits === 1 ? nf1.format(v) : nf2.format(v);

export const money = (v: number) => `${nf.format(Math.round(v))} រៀល`;

export const moneyShort = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${nf1.format(v / 1_000_000)} លាន`;
  if (abs >= 1_000) return `${nf.format(v / 1_000)} ពាន់`;
  return nf.format(v);
};

export const kg = (v: number) => `${nf.format(Math.round(v))} គ.ក`;

export const pct = (v: number, digits = 0) => `${num(v, digits)}%`;

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Local-time formatting: Date#toISOString shifts the day in UTC+ timezones. */
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export const todayISO = () => isoOf(new Date());

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoOf(d);
};

export const diffDays = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) /
      86_400_000,
  );

const MONTHS_KH = [
  "មករា",
  "កុម្ភៈ",
  "មីនា",
  "មេសា",
  "ឧសភា",
  "មិថុនា",
  "កក្កដា",
  "សីហា",
  "កញ្ញា",
  "តុលា",
  "វិច្ឆិកា",
  "ធ្នូ",
];

/** 2026-09-05 → «៥ កញ្ញា 2026» style, using latin digits for legibility. */
export const dateKh = (iso: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${int(d)} ${MONTHS_KH[m - 1]} ${y}`;
};

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_KH[m - 1]} ${String(y).slice(2)}`;
};

export const monthKey = (iso: string) => iso.slice(0, 7);

export const lastMonths = (count: number, endISO = todayISO()) => {
  const [year, month] = endISO.slice(0, 7).split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const idx = year * 12 + (month - 1) - i;
    keys.push(`${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`);
  }
  return keys;
};

export const relDay = (iso: string) => {
  const d = diffDays(iso, todayISO());
  if (d === 0) return "ថ្ងៃនេះ";
  if (d === 1) return "ម្សិលមិញ";
  if (d > 1) return `${int(d)} ថ្ងៃមុន`;
  return `${int(-d)} ថ្ងៃទៀត`;
};

export const numInput = (value: string) => {
  const cleaned = value.replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Display units in Khmer: the stored keys stay Latin (kg, l, bag) for portability. */
export const unitLabel = (unit: string) => {
  const map: Record<string, string> = { kg: "គ.ក", g: "ក្រាម", t: "តោន", l: "លីត្រ", bag: "ថង់", pcs: "គ្រាប់" };
  return map[unit] ?? unit;
};
