import { diffDays, int, lastMonths, monthKey, num, todayISO } from "./format";
import { STAGE_ORDER } from "./types";
import type { DbShape, Lot, Material, Product, QcTest, QcResult, Recipe } from "./types";

export const materialById = (db: DbShape, id: string) =>
  db.materials.find((m) => m.id === id);

export const recipeById = (db: DbShape, id: string) =>
  db.recipes.find((r) => r.id === id);

export const lotById = (db: DbShape, id: string) => db.lots.find((l) => l.id === id);

/* --------------------------------- stock ---------------------------------- */

export function stockOf(db: DbShape, materialId: string) {
  return round1(
    db.materialMovements
      .filter((mv) => mv.materialId === materialId)
      .reduce((sum, mv) => sum + (mv.dir === "in" ? mv.qty : -mv.qty), 0),
  );
}

export const stockValueOf = (db: DbShape, materialId: string) => {
  const m = materialById(db, materialId);
  return stockOf(db, materialId) * (m?.costPerUnit ?? 0);
};

export function usageOf(db: DbShape, materialId: string) {
  return db.materialMovements
    .filter((mv) => mv.materialId === materialId && mv.dir === "out")
    .reduce((sum, mv) => sum + mv.qty, 0);
}

export const purchaseValueOf = (db: DbShape) =>
  db.materialMovements
    .filter((mv) => mv.reason === "purchase")
    .reduce((sum, mv) => sum + mv.qty * mv.unitCost, 0);

export const lastPurchaseOf = (db: DbShape, materialId: string) =>
  db.materialMovements
    .filter((mv) => mv.materialId === materialId && mv.dir === "in")
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

/* -------------------------------- recipes --------------------------------- */

export function recipeCost(db: DbShape, recipe: Recipe) {
  let cost = 0;
  let n = 0;
  let p = 0;
  let k = 0;
  let cnWeighted = 0;
  let weight = 0;
  recipe.lines.forEach((line) => {
    const m = materialById(db, line.materialId);
    if (!m) return;
    cost += line.qty * m.costPerUnit;
    n += (line.qty * (m.nPct ?? 0)) / 100;
    p += (line.qty * (m.pPct ?? 0)) / 100;
    k += (line.qty * (m.kPct ?? 0)) / 100;
    if (m.category === "nitrogen" || m.category === "carbon") {
      cnWeighted += (m.cnRatio ?? 0) * line.qty;
      weight += line.qty;
    }
  });
  // dry mass drives the implied N-P-K of the finished product
  let dryKg = 0;
  recipe.lines.forEach((line) => {
    const m = materialById(db, line.materialId);
    if (m) dryKg += line.qty * (1 - Math.min(95, m.moisturePct ?? 20) / 100);
  });
  const nutrients = dryKg * (recipe.yieldPct / 100) * 0.85;
  return {
    cost: Math.round(cost),
    costPerKg: cost / (recipe.targetKg || 1),
    expectedOutKg: Math.round((recipe.targetKg * recipe.yieldPct) / 100),
    nPct: round2((n / (nutrients || 1)) * 100),
    pPct: round2((p / (nutrients || 1)) * 100),
    kPct: round2((k / (nutrients || 1)) * 100),
    cnRatio: weight ? round1(cnWeighted / weight) : undefined,
    totalInputKg: round1(recipe.lines.reduce((sum, l) => sum + l.qty, 0)),
  };
}

/* ---------------------------------- lots ---------------------------------- */

export const lotMaterialsCost = (lot: Lot) => lot.inputs.reduce((sum, i) => sum + i.cost, 0);
export const lotExtrasCost = (lot: Lot) => lot.extraCosts.reduce((sum, c) => sum + c.amount, 0);
export const lotCost = (lot: Lot) => lotMaterialsCost(lot) + lotExtrasCost(lot);
export const lotCostPerKg = (lot: Lot) =>
  lot.actualKg && lot.actualKg > 0 ? lotCost(lot) / lot.actualKg : undefined;
export const lotYieldPct = (lot: Lot) =>
  lot.actualKg !== undefined && lot.plannedKg > 0 ? (lot.actualKg / lot.plannedKg) * 100 : undefined;

export const lotsByRecipe = (db: DbShape, recipeId: string) =>
  db.lots.filter((l) => l.recipeId === recipeId);

export const activeLots = (db: DbShape) =>
  db.lots.filter((l) => l.status === "active" || l.status === "hold");

export const closedLots = (db: DbShape) => db.lots.filter((l) => l.status === "closed");

export const lotProgressDays = (lot: Lot) => diffDays(lot.startDate, lot.closedDate ?? todayISO());

export function stageCounts(db: DbShape) {
  const counts = new Map<Lot["stage"], number>();
  STAGE_ORDER.forEach((s) => counts.set(s, 0));
  activeLots(db).forEach((l) => counts.set(l.stage, (counts.get(l.stage) ?? 0) + 1));
  return STAGE_ORDER.filter((s) => s !== "finished").map((stage) => ({
    stage,
    count: counts.get(stage) ?? 0,
  }));
}

/** Stage the lot should be in today, from its own start date. */
export function expectedStage(db: DbShape, lot: Lot) {
  const recipe = recipeById(db, lot.recipeId);
  const days = diffDays(lot.startDate, todayISO());
  const ferm = recipe?.fermentationDays ?? 40;
  if (days < 2) return "mixing" as const;
  if (days < ferm * 0.35) return "fermentation" as const;
  if (days < ferm) return "curing" as const;
  return "sieving" as const;
}

export const isOverdue = (db: DbShape, lot: Lot) => {
  if (lot.status !== "active") return false;
  return todayISO() > lot.targetDate;
};

/* ------------------------------ process logs ------------------------------ */

export const logsForLot = (db: DbShape, lotId: string) =>
  db.processLogs
    .filter((l) => l.lotId === lotId)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

export type TempFlag = "cold" | "good" | "hot" | "overheated" | "none";

export function tempFlag(tempC?: number): TempFlag {
  if (tempC === undefined) return "none";
  if (tempC < 40) return "cold";
  if (tempC <= 55) return "good";
  if (tempC <= 70) return "hot";
  return "overheated";
}

export const TEMP_HINT: Record<TempFlag, string> = {
  cold: "ត្រជាក់ពេក (<40°C) — បន្ថែមសារធាតុ N រួចកូរឱ្យខ្យល់ចូល",
  good: "សីតុណ្ហភាពល្អសម្រាប់ផ្កាម",
  hot: "កំពុងក្តៅល្អ (55–70°C) — រក្សាសំណើម និងកូររៀងរាល់ ៣–៥ ថ្ងៃ",
  overheated: "ក្តៅពេក (>70°C) — កូរជារបៀង ហើយបាញ់ទឹកដើម្បីបន្ថយកំដៅ",
  none: "មិនទាន់មានការវាស់",
};

export function turningAdvice(db: DbShape, lotId: string) {
  const logs = logsForLot(db, lotId);
  const lastTurn = [...logs].reverse().find((l) => l.turned);
  const daysSince = lastTurn ? diffDays(lastTurn.date, todayISO()) : logs.length ? diffDays(logs[0].date, todayISO()) : 99;
  return {
    daysSince,
    need: daysSince >= 3,
    lastTurnDate: lastTurn?.date,
  };
}

export function lotHealth(db: DbShape, lot: Lot) {
  const logs = logsForLot(db, lot.id);
  const last = logs.at(-1);
  const flags: string[] = [];
  const flag = tempFlag(last?.tempC);
  if (last && flag !== "none" && flag !== "good" && flag !== "hot") flags.push(TEMP_HINT[flag]);
  if (last?.moisturePct !== undefined && last.moisturePct < 40)
    flags.push("សំណើមទាបពេក (<40%) — បាញ់ទឹកបន្ថែម");
  if (last?.moisturePct !== undefined && last.moisturePct > 62)
    flags.push("សំណើមខ្ពស់ពេក (>62%) — បន្ថែមវត្ថុធាតុ C ហើយកូរ");
  const turn = turningAdvice(db, lot.id);
  if (turn.need) flags.push("លើស ៣ ថ្ងៃមិនទាន់កូររបៀង");
  return { lastLog: last, flag, advice: flags };
}

/* ----------------------------------- QC ----------------------------------- */

export type QcCheck = { label: string; value?: number; ok?: boolean; rule: string };

export function qcChecks(db: DbShape, test: QcTest): QcCheck[] {
  const lot = lotById(db, test.lotId);
  const spec = lot ? recipeById(db, lot.recipeId)?.spec : undefined;
  if (!spec) return [];
  const range = (label: string, value: number | undefined, min?: number, max?: number, unit = "") => ({
    label,
    value,
    rule: `${min ?? "—"}–${max ?? "—"}${unit}`,
    ok:
      value === undefined
        ? undefined
        : (min === undefined || value >= min) && (max === undefined || value <= max),
  });
  return [
    range("pH", test.ph, spec.phMin, spec.phMax),
    range("សំណើម", test.moisturePct, spec.moistureMin, spec.moistureMax, "%"),
    range("សារធាតុសរីរាង្គ OM", test.omPct, spec.omMin, undefined, "%"),
    range("អាសូត N", test.nPct, spec.nMin, undefined, "%"),
    range("សមាមាត្រ C:N", test.cnRatio, undefined, spec.cnMax),
    {
      label: "អណ្តាតប្រៃ EC",
      value: test.ecMs,
      rule: "≤ 8 mS/cm",
      ok: test.ecMs === undefined ? undefined : test.ecMs <= 8,
    },
    {
      label: "កាកសំណល់",
      value: test.impurityPct,
      rule: "≤ 2%",
      ok: test.impurityPct === undefined ? undefined : test.impurityPct <= 2,
    },
  ];
}

export function deriveQcResult(db: DbShape, test: Omit<QcTest, "id" | "createdAt" | "result">): QcResult {
  const checks = qcChecks(db, { ...test, result: "pending" } as QcTest);
  const measured = checks.filter((c) => c.value !== undefined);
  if (!measured.length) return "pending";
  return measured.every((c) => c.ok) ? "pass" : "fail";
}

/**
 * Grade from the measured checks: everything inside spec is A, one soft miss (within
 * 15% of the limit) is still sellable as B, anything worse is C.
 */
export function deriveGrade(db: DbShape, test: Omit<QcTest, "id" | "createdAt" | "result" | "grade">): "A" | "B" | "C" {
  const checks = qcChecks(db, { ...test, result: "pending" } as QcTest);
  const measured = checks.filter((c) => c.value !== undefined);
  if (!measured.length) return "A";
  const numbers = [
    test.ph,
    test.moisturePct,
    test.omPct,
    test.nPct,
    test.cnRatio,
    test.ecMs,
    test.impurityPct,
  ].filter((v): v is number => v !== undefined);
  if (measured.every((c) => c.ok)) return "A";
  const lot = lotById(db, test.lotId);
  const spec = lot ? recipeById(db, lot.recipeId)?.spec : undefined;
  if (!spec) return "C";
  const softMiss = (v: number | undefined, lo?: number, hi?: number) => {
    if (v === undefined) return true;
    const tolLo = lo === undefined ? -Infinity : lo * 0.85;
    const tolHi = hi === undefined ? Infinity : hi * 1.15;
    return v >= tolLo && v <= tolHi;
  };
  const softOnly =
    softMiss(test.ph, spec.phMin, spec.phMax) &&
    softMiss(test.moisturePct, spec.moistureMin, spec.moistureMax) &&
    softMiss(test.omPct, spec.omMin, undefined) &&
    softMiss(test.nPct, spec.nMin, undefined) &&
    softMiss(test.cnRatio, undefined, spec.cnMax) &&
    softMiss(test.ecMs, undefined, 8) &&
    softMiss(test.impurityPct, undefined, 2);
  return softOnly ? "B" : "C";
}

/** Price per bag for a lot carrying this grade. */
export function pricePerBagFor(
  product: Product | undefined,
  grade?: "A" | "B" | "C",
) {
  if (!product) return 0;
  if (grade === "B") return product.pricePerBagB ?? Math.round(product.pricePerBag * 0.85);
  if (grade === "C") return product.pricePerBagC ?? Math.round(product.pricePerBag * 0.6);
  return product.pricePerBag;
}

export const lotGrade = (db: DbShape, lotId: string): "A" | "B" | "C" | undefined => {
  const test = finalQcOf(db, lotId);
  if (!test) return undefined;
  return test.grade ?? (test.result === "pass" ? "A" : "B");
};

export const qcTestsForLot = (db: DbShape, lotId: string) =>
  db.qcTests.filter((t) => t.lotId === lotId).sort((a, b) => (a.date < b.date ? 1 : -1));

export const finalQcOf = (db: DbShape, lotId: string) =>
  qcTestsForLot(db, lotId).find((t) => t.sampleType === "final");

export function qcPassRate(db: DbShape, months = 6) {
  const from = `${lastMonths(months)[0]}-01`;
  const tests = db.qcTests.filter(
    (t) => t.sampleType === "final" && t.date >= from && t.result !== "pending",
  );
  if (!tests.length) return { rate: undefined, tested: 0, failed: 0 };
  const failed = tests.filter((t) => t.result === "fail").length;
  return {
    rate: ((tests.length - failed) / tests.length) * 100,
    tested: tests.length,
    failed,
  };
}

/* ------------------------------- products --------------------------------- */

export const productStockKg = (db: DbShape, productId: string) =>
  round1(
    db.productMovements
      .filter((mv) => mv.productId === productId)
      .reduce((sum, mv) => sum + (mv.dir === "in" ? mv.qtyKg : -mv.qtyKg), 0),
  );

export const productBags = (db: DbShape, productId: string) => {
  const p = db.products.find((x) => x.id === productId);
  if (!p) return 0;
  return Math.floor(productStockKg(db, productId) / (p.bagSizeKg || 1));
};

export const productRevenue = (db: DbShape, productId: string) =>
  db.productMovements
    .filter((mv) => mv.productId === productId && mv.dir === "out")
    .reduce((sum, mv) => sum + mv.qtyKg * mv.unitPrice, 0);

export const stockAgeOfProduct = (db: DbShape, productId: string) =>
  db.productMovements
    .filter((mv) => mv.productId === productId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

/* ------------------------------- reporting -------------------------------- */

export function monthlySeries(db: DbShape, months = 12) {
  const keys = lastMonths(months);
  const map = new Map(
    keys.map((k) => [
      k,
      { key: k, producedKg: 0, cost: 0, shared: 0, lots: 0, dispatchKg: 0, revenue: 0 },
    ]),
  );
  // shared plant cost is booked to the month the finished output belongs to
  db.overheads.forEach((o) => {
    const row = map.get(o.month);
    if (row) row.shared += o.amount;
  });
  db.lots.forEach((lot) => {
    if (lot.status !== "closed" || !lot.closedDate) return;
    const row = map.get(monthKey(lot.closedDate));
    if (!row) return;
    row.producedKg += lot.actualKg ?? 0;
    row.cost += lotCost(lot);
    row.lots += 1;
  });
  db.productMovements.forEach((mv) => {
    const row = map.get(monthKey(mv.date));
    if (!row) return;
    if (mv.dir === "out") {
      row.dispatchKg += mv.qtyKg;
      row.revenue += mv.qtyKg * mv.unitPrice;
    }
  });
  return keys.map((k) => {
    const row = map.get(k)!;
    const full = row.cost + row.shared;
    return {
      ...row,
      costPerKg: row.producedKg ? row.cost / row.producedKg : undefined,
      fullCostPerKg: row.producedKg ? full / row.producedKg : undefined,
    };
  });
}

export function costBreakdown(db: DbShape, lot: Lot) {
  const byMaterial = lot.inputs
    .map((i) => ({
      label: materialById(db, i.materialId)?.name ?? "—",
      amount: i.cost,
    }))
    .sort((a, b) => b.amount - a.amount);
  const extras = new Map<string, number>();
  lot.extraCosts.forEach((c) => extras.set(c.category, (extras.get(c.category) ?? 0) + c.amount));
  return { byMaterial, extras: [...extras].map(([category, amount]) => ({ category, amount })) };
}

export function topMaterials(db: DbShape, limit = 6) {
  const totals = new Map<string, { qty: number; cost: number }>();
  db.lots.forEach((lot) =>
    lot.inputs.forEach((i) => {
      const prev = totals.get(i.materialId) ?? { qty: 0, cost: 0 };
      totals.set(i.materialId, { qty: prev.qty + i.qty, cost: prev.cost + i.cost });
    }),
  );
  return [...totals]
    .map(([materialId, v]) => ({ material: materialById(db, materialId), ...v }))
    .filter((r) => r.material)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
}

export function stockValuation(db: DbShape) {
  return db.materials
    .filter((m) => !m.archived)
    .map((m) => ({ material: m, qty: stockOf(db, m.id), value: stockValueOf(db, m.id) }))
    .sort((a, b) => b.value - a.value);
}

/* --------------------------------- money ---------------------------------- */

/** Invoiced total for a movement; falls back to qty x unit price. */
export function movementAmount(mv: DbShape["productMovements"][number]) {
  if (mv.amount !== undefined) return Math.round(mv.amount);
  return Math.round(mv.qtyKg * (mv.unitPrice ?? 0));
}

/** Unpaid balance of a movement (0 for receipts and non-customer rows). */
export function movementDue(mv: DbShape["productMovements"][number]) {
  if (mv.dir !== "out") return 0;
  return Math.max(0, movementAmount(mv) - Math.round(mv.paid ?? 0));
}

/* -------------------------------- customers ------------------------------- */

export const customerById = (db: DbShape, id?: string) =>
  id ? db.customers.find((c) => c.id === id) : undefined;

export const movementsOfCustomer = (db: DbShape, customerId: string) =>
  db.productMovements
    .filter((mv) => mv.customerId === customerId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

export interface CustomerStats {
  id: string;
  name: string;
  kg: number;
  amount: number;
  paid: number;
  due: number;
  orders: number;
  lastDate?: string;
  favouriteProduct?: string;
}

export function customerStats(db: DbShape, customerId: string): CustomerStats | undefined {
  const customer = customerById(db, customerId);
  if (!customer) return undefined;
  const rows = movementsOfCustomer(db, customerId);
  let kgTotal = 0;
  let amount = 0;
  let paid = 0;
  let orders = 0;
  const perProduct = new Map<string, number>();
  rows.forEach((mv) => {
    if (mv.dir !== "out") return;
    kgTotal += mv.qtyKg;
    amount += movementAmount(mv);
    paid += Math.round(mv.paid ?? 0);
    orders += 1;
    perProduct.set(mv.productId, (perProduct.get(mv.productId) ?? 0) + mv.qtyKg);
  });
  const top = [...perProduct].sort((a, b) => b[1] - a[1])[0];
  return {
    id: customerId,
    name: customer.name,
    kg: round1(kgTotal),
    amount,
    paid,
    due: rows.reduce((sum, mv) => sum + movementDue(mv), 0),
    orders,
    lastDate: rows[0]?.date,
    favouriteProduct: top ? db.products.find((p) => p.id === top[0])?.name : undefined,
  };
}

export const allCustomerStats = (db: DbShape) =>
  db.customers
    .map((c) => customerStats(db, c.id))
    .filter((x): x is CustomerStats => x !== undefined)
    .sort((a, b) => b.amount - a.amount);

export const outstandingTotal = (db: DbShape) =>
  db.productMovements.reduce((sum, mv) => sum + movementDue(mv), 0);

export function customerAging(db: DbShape, customerId: string) {
  const today = todayISO();
  const buckets = { current: 0, d30: 0, d60: 0, older: 0 };
  movementsOfCustomer(db, customerId).forEach((mv) => {
    const due = movementDue(mv);
    if (!due) return;
    const age = diffDays(mv.date, today);
    if (age <= 30) buckets.current += due;
    else if (age <= 60) buckets.d30 += due;
    else if (age <= 90) buckets.d60 += due;
    else buckets.older += due;
  });
  return buckets;
}

/* -------------------------- overhead + purchase plan ----------------------- */

export const overheadsIn = (db: DbShape, month: string) => db.overheads.filter((o) => o.month === month);

export const overheadTotalIn = (db: DbShape, month: string) =>
  Math.round(overheadsIn(db, month).reduce((sum, o) => sum + o.amount, 0));

/** Shared plant cost is spread over the month's finished output. */
export function overheadRatePerKg(db: DbShape, month: string) {
  const produced = producedIn(db, month);
  const total = overheadTotalIn(db, month);
  if (!produced || !total) return undefined;
  return total / produced;
}

/** Direct lot cost plus the share of that month's overhead. */
export function lotFullCost(db: DbShape, lot: Lot) {
  const direct = lotCost(lot);
  const month = lot.closedDate ? monthKey(lot.closedDate) : undefined;
  const rate = month ? overheadRatePerKg(db, month) : undefined;
  const share = rate && lot.actualKg ? Math.round(rate * lot.actualKg) : 0;
  return { direct, share, total: direct + share, rate };
}

export function lotFullCostPerKg(db: DbShape, lot: Lot) {
  const { total } = lotFullCost(db, lot);
  return lot.actualKg && lot.actualKg > 0 ? total / lot.actualKg : undefined;
}

export const mostUsedRecipe = (db: DbShape) => {
  const tally = new Map<string, number>();
  db.lots.forEach((l) => tally.set(l.recipeId, (tally.get(l.recipeId) ?? 0) + l.plannedKg));
  const top = [...tally].sort((a, b) => b[1] - a[1])[0];
  return recipeById(db, top?.[0] ?? "");
};

export interface PurchaseRow {
  materialId: string;
  name: string;
  unit: string;
  need: number;
  stock: number;
  short: number;
  cost: number;
  supplier?: string;
}

/**
 * Work backwards from the month's target: how much finished compost is still missing,
 * what feedstock that needs, what is already in the yard, and therefore what to buy —
 * with the money attached, so the plan turns into a purchasing list.
 */
export function purchasePlan(db: DbShape, month: string, recipeId?: string) {
  const row = planRows(db, 1, month).find((r) => r.month === month) ?? planRows(db, 1)[0];
  const recipe = recipeId ? recipeById(db, recipeId) : mostUsedRecipe(db);
  if (!recipe || !row?.target) {
    return {
      recipe,
      missingKg: 0,
      feedNeeded: 0,
      target: row?.target ?? 0,
      projected: row?.projected ?? 0,
      rows: [] as PurchaseRow[],
      total: 0,
      openLots: row?.lots ?? 0,
    };
  }
  const missingKg = Math.max(0, row.target - row.projected);
  // the recipe's targetKg is feed weight, so gross it up by the expected yield first
  const feedNeeded = round1((missingKg / (recipe.yieldPct / 100 || 1)) * 1);
  const factor = feedNeeded / (recipe.targetKg || 1);
  const rows: PurchaseRow[] = recipe.lines.map((line) => {
    const m = materialById(db, line.materialId);
    const need = round1(line.qty * factor);
    const stock = m ? stockOf(db, m.id) : 0;
    const short = round1(Math.max(0, need - stock));
    return {
      materialId: line.materialId,
      name: m?.name ?? "—",
      unit: m?.unit ?? "kg",
      need,
      stock,
      short,
      cost: Math.round(short * (m?.costPerUnit ?? 0)),
      supplier: m?.supplier,
    };
  });
  return {
    recipe,
    target: row.target,
    projected: row.projected,
    missingKg: round1(missingKg),
    feedNeeded,
    rows: rows.sort((a, b) => b.short - a.short),
    total: rows.reduce((sum, r) => sum + r.cost, 0),
    openLots: row.lots,
  };
}

/* ---------------------------------- plans --------------------------------- */

export const planOf = (db: DbShape, month: string) => db.plans.find((p) => p.month === month);

export const lotsStartingIn = (db: DbShape, month: string) =>
  db.lots.filter((l) => monthKey(l.startDate) === month);

export const producedIn = (db: DbShape, month: string) =>
  round1(
    db.lots
      .filter((l) => l.status === "closed" && l.closedDate && monthKey(l.closedDate) === month)
      .reduce((sum, l) => sum + (l.actualKg ?? 0), 0),
  );

/** Closed lots inside a month are already booked; open lots are expected output. */
export function planRows(db: DbShape, months = 6, lastMonth?: string) {
  // an explicit end month lets a future plan (and its purchase list) be inspected
  const keys = lastMonth ? monthsUpTo(lastMonth, months) : lastMonths(months, todayISO());
  return keys.map((month) => {
    const plan = planOf(db, month);
    const done = producedIn(db, month);
    const inbound = db.lots
      .filter((l) => l.status !== "closed" && l.status !== "rejected" && monthKey(l.closedDate ?? l.targetDate) === month)
      .reduce((sum, l) => sum + (l.plannedKg * ((recipeById(db, l.recipeId)?.yieldPct ?? 60) / 100)), 0);
    const target = plan?.targetKg ?? 0;
    return {
      month,
      target,
      done,
      inbound: round1(inbound),
      projected: round1(done + inbound),
      gap: round1(target - done - inbound),
      progress: target ? Math.min(150, ((done + inbound) / target) * 100) : undefined,
      lots: lotsStartingIn(db, month).length,
      note: plan?.note,
    };
  });
}

/* -------------------------------- windrows -------------------------------- */

export type YardCell = {
  windrow: string;
  lot?: Lot;
  tempC?: number;
  moisturePct?: number;
  daysSinceTurn: number;
  needsTurning: boolean;
  flags: string[];
  /** Two-or-three-word token that fits a yard tile. */
  task?: string;
  finalQc?: QcResult;
};

/**
 * Yard layout by windrow label: the lot currently occupying each row (the latest open
 * one, otherwise the latest closed one) plus what the field worker needs at a glance.
 */
export function yardMap(db: DbShape): YardCell[] {
  const open = activeLots(db);
  const labels = new Set<string>(open.map((l) => l.windrow.trim() || "គ្មានលេខ"));
  db.lots.forEach((l) => labels.add(l.windrow.trim() || "គ្មានលេខ"));
  const sort = (a: string, b: string) => {
    const na = Number(a.replace(/\D/g, ""));
    const nb = Number(b.replace(/\D/g, ""));
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
  };
  return [...labels]
    .sort(sort)
    .map((windrow) => {
      const here = db.lots
        .filter((l) => (l.windrow.trim() || "គ្មានលេខ") === windrow)
        .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
      const lot = here.find((l) => l.status === "active" || l.status === "hold") ?? here[0];
      if (!lot) return { windrow, daysSinceTurn: 0, needsTurning: false, flags: [], task: undefined } as YardCell;
      const health = lotHealth(db, lot);
      const turn = turningAdvice(db, lot.id);
      const finalTest = finalQcOf(db, lot.id);
      return {
        windrow,
        lot,
        tempC: health.lastLog?.tempC,
        moisturePct: health.lastLog?.moisturePct,
        daysSinceTurn: turn.daysSince,
        needsTurning: turn.need && lot.status === "active",
        flags: lot.status === "active" ? health.advice : [],
        task: lot.status === "active" ? yardTask(lot, health.flag, turn.need) : undefined,
        finalQc: finalTest?.result,
      };
    });
}

/* --------------------------------- alerts --------------------------------- */

export type Alert = {
  level: "danger" | "warn" | "info";
  title: string;
  detail: string;
  to?: string;
};

export function alertsFor(db: DbShape): Alert[] {
  const alerts: Alert[] = [];
  db.materials
    .filter((m) => !m.archived && m.category !== "packaging")
    .forEach((m) => {
      const qty = stockOf(db, m.id);
      if (qty <= 0) {
        alerts.push({ level: "danger", title: `អស់ស្តុក៖ ${m.name}`, detail: "ត្រូវទិញចូលមុនបើក Lot ថ្មី", to: "materials" });
      } else if (qty < m.reorderQty) {
        alerts.push({
          level: "warn",
          title: `ស្តុកទាប៖ ${m.name}`,
          detail: `${num(qty)} ${m.unit} · កម្រិតត្រូវបញ្ជាទិញ ${num(m.reorderQty)} ${m.unit}`,
          to: "materials",
        });
      }
    });
  const late = activeLots(db).filter((lot) => isOverdue(db, lot));
  if (late.length) {
    alerts.push({
      level: "warn",
      title: `Lot លើសកាលកំណត់ ${int(late.length)} បាន`,
      detail: `${late.map((l) => l.code).join(", ")} · គោលដៅចាស់គេ ${late[late.length - 1].targetDate}`,
      to: "lots",
    });
  }
  // one line per kind of field task, not one per lot: four near-identical cards read as noise
  const tasks = new Map<string, string[]>();
  activeLots(db).forEach((lot) => {
    const advice = lotHealth(db, lot).advice[0];
    if (!advice) return;
    const list = tasks.get(advice) ?? [];
    if (!list.includes(lot.code)) list.push(lot.code);
    tasks.set(advice, list);
  });
  [...tasks]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .forEach(([advice, codes]) => {
      alerts.push({
        level: advice.includes("កូរ") ? "warn" : "info",
        title: `${advice} (${int(codes.length)} Lot)`,
        detail: codes.slice(0, 4).join(", ") + (codes.length > 4 ? ` +${codes.length - 4}` : ""),
        to: "lots",
      });
    });
  const current = planRows(db, 1)[0];
  if (current && current.target && current.gap > 0) {
    alerts.push({
      level: current.gap > current.target * 0.35 ? "warn" : "info",
      title: `ផែនការខែនេះនៅខ្វះ ${int(current.gap)} គ.ក`,
      detail: `គោលដៅ ${int(current.target)} · រួច ${int(current.done)} · កំពុងផ្កាម ${int(current.inbound)}`,
      to: "plan",
    });
  }
  db.customers.forEach((c) => {
    const stats = customerStats(db, c.id);
    if (!stats?.due) return;
    if (c.creditLimit && stats.due > c.creditLimit) {
      alerts.push({
        level: "danger",
        title: `ជំពាក់លើសដែនកំណត់៖ ${c.name}`,
        detail: `សល់ជំពាក់ ${num(stats.due / 1000)} ពាន់ រៀល · ដែនកំណត់ ${num((c.creditLimit ?? 0) / 1000)} ពាន់`,
        to: "customers",
      });
    }
  });
  db.qcTests
    .filter((t) => t.result === "fail")
    .slice(0, 4)
    .forEach((t) => {
      const lot = lotById(db, t.lotId);
      alerts.push({
        level: "danger",
        title: `មិនជាប់ស្តង់ដារគុណភាព`,
        detail: `${lot?.code ?? "—"} · ធ្វើតេស្ត ${t.date}`,
        to: "qc",
      });
    });
  return alerts;
}

/** `YYYY-MM` window that ends at a chosen month, so a future plan can be inspected. */
function monthsUpTo(last: string, count: number) {
  const [y, m] = last.split("-").map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const idx = y * 12 + (m - 1) - i;
    keys.push(`${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`);
  }
  return keys;
}

/* -------------------------------- helpers --------------------------------- */

export function round1(v: number) {
  return Math.round(v * 10) / 10;
}

export function round2(v: number) {
  return Math.round(v * 100) / 100;
}

export const activeMaterialCount = (db: DbShape) =>
  db.materials.filter((m: Material) => !m.archived).length;

export function planForLot(db: DbShape, recipe: Recipe, plannedKg: number) {
  const factor = plannedKg / (recipe.targetKg || 1);
  return recipe.lines.map((line) => {
    const m = materialById(db, line.materialId);
    const qty = round1(line.qty * factor);
    const available = stockOf(db, line.materialId);
    return {
      materialId: line.materialId,
      name: m?.name ?? "—",
      unit: m?.unit ?? "kg",
      qty,
      unitCost: m?.costPerUnit ?? 0,
      cost: Math.round(qty * (m?.costPerUnit ?? 0)),
      available,
      short: qty - available,
    };
  });
}

/* ---------------------------- traceability report --------------------------- */

export interface LotTrace {
  lot: Lot;
  recipe?: Recipe;
  grade?: "A" | "B" | "C";
  inputs: {
    name: string;
    unit: string;
    qty: number;
    cost: number;
    supplier?: string;
    lastPurchase?: string;
  }[];
  monitoring: {
    readings: number;
    tempMin?: number;
    tempMax?: number;
    turns: number;
    lastReading?: string;
    days: number;
  };
  qc: QcTest[];
  outbound: {
    movementId: string;
    date: string;
    product?: string;
    qtyKg: number;
    amount: number;
    due: number;
    customer?: string;
    customerId?: string;
  }[];
  totals: { inputCost: number; directCost: number; sharedCost: number; fullCost: number; perKg: number; soldKg: number; revenue: number; due: number };
}

/**
 * Everything one lot touched, in and out — the answer when a customer calls about a
 * bag, or when a batch has to be explained to an inspector.
 */
export function lotTrace(db: DbShape, lotId: string): LotTrace | undefined {
  const lot = lotById(db, lotId);
  if (!lot) return undefined;
  const recipe = recipeById(db, lot.recipeId);
  const logs = logsForLot(db, lot.id).filter((l) => l.tempC !== undefined);
  const temps = logs.map((l) => l.tempC as number);
  const full = lotFullCost(db, lot);
  const outbound = db.productMovements
    .filter((mv) => mv.lotId === lot.id || (mv.reason === "produce" && false))
    .filter((mv) => mv.dir === "out")
    .map((mv) => ({
      movementId: mv.id,
      date: mv.date,
      product: db.products.find((p) => p.id === mv.productId)?.name,
      qtyKg: mv.qtyKg,
      amount: movementAmount(mv),
      due: movementDue(mv),
      customer: customerById(db, mv.customerId)?.name ?? mv.party,
      customerId: mv.customerId,
    }));
  const sold = db.productMovements
    .filter((mv) => mv.reason === "produce" && mv.lotId === lot.id)
    .reduce((sum, mv) => sum + mv.qtyKg, 0);
  return {
    lot,
    recipe,
    grade: lotGrade(db, lot.id),
    inputs: lot.inputs.map((input) => {
      const m = materialById(db, input.materialId);
      const purchase = db.materialMovements
        .filter((mv) => mv.materialId === input.materialId && mv.dir === "in")
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      return {
        name: m?.name ?? "—",
        unit: m?.unit ?? "kg",
        qty: input.qty,
        cost: input.cost,
        supplier: m?.supplier,
        lastPurchase: purchase?.date,
      };
    }),
    monitoring: {
      readings: logs.length,
      tempMin: temps.length ? Math.min(...temps) : undefined,
      tempMax: temps.length ? Math.max(...temps) : undefined,
      turns: db.processLogs.filter((l) => l.lotId === lot.id && l.turned).length,
      lastReading: logs.at(-1)?.date,
      days: diffDays(lot.startDate, lot.closedDate ?? todayISO()),
    },
    qc: qcTestsForLot(db, lot.id),
    outbound,
    totals: {
      inputCost: lotMaterialsCost(lot),
      directCost: full.direct,
      sharedCost: full.share,
      fullCost: full.total,
      perKg: lot.actualKg ? Math.round(full.total / lot.actualKg) : 0,
      soldKg: round1(sold),
      revenue: outbound.reduce((sum, o) => sum + o.amount, 0),
      due: outbound.reduce((sum, o) => sum + o.due, 0),
    },
  };
}

/** Everything a customer took, with the lot each bag came from.  */
export function customerLots(db: DbShape, customerId: string) {
  const seen = new Map<string, { lot?: Lot; kg: number }>();
  db.productMovements
    .filter((mv) => mv.customerId === customerId && mv.dir === "out")
    .forEach((mv) => {
      const lot = mv.lotId ? lotById(db, mv.lotId) : undefined;
      if (!lot) return;
      const prev = seen.get(lot.id) ?? { lot, kg: 0 };
      prev.kg += mv.qtyKg;
      seen.set(lot.id, prev);
    });
  return [...seen.values()].sort((a, b) => (a.lot!.startDate < b.lot!.startDate ? 1 : -1));
}

/** Kg a lot delivered to finished stock, and how much of it is still unsold. */
export function lotProducedKg(db: DbShape, lotId: string) {
  return round1(
    db.productMovements
      .filter((mv) => mv.lotId === lotId && mv.dir === "in" && mv.reason === "produce")
      .reduce((sum, mv) => sum + mv.qtyKg, 0),
  );
}

export function lotRemainingKg(db: DbShape, lotId: string) {
  const out = db.productMovements
    .filter((mv) => mv.lotId === lotId && mv.dir === "out")
    .reduce((sum, mv) => sum + mv.qtyKg, 0);
  return round1(lotProducedKg(db, lotId) - out);
}

/** Closed lots of this product that still hold unsold compost, newest first. */
export function lotsWithStock(db: DbShape, productId: string, recipeId?: string) {
  return db.lots
    .filter((l) => l.status === "closed" && (recipeId ? l.recipeId === recipeId : true))
    .map((l) => ({ lot: l, remaining: lotRemainingKg(db, l.id), grade: lotGrade(db, l.id) }))
    .filter((row) => row.remaining > 0)
    .sort((a, b) => ((a.lot.closedDate ?? "") < (b.lot.closedDate ?? "") ? 1 : -1));
}

/** The one thing to do at this windrow, short enough for a tile. */
function yardTask(lot: Lot, flag: TempFlag, needsTurn: boolean): string | undefined {
  if (lot.stage === "mixing") return "រៀបចាក់";
  if (flag === "overheated") return "ក្តៅពេក";
  if (needsTurn) return "ត្រូវកូរ";
  if (flag === "cold") return "ត្រជាក់";
  return undefined;
}
