import { seedDb } from "./seed";
import { readPrefs } from "./prefs";
import { bootstrapCloud, bindLiveState, bindReplace, notifyStoreChanged } from "./sync";
import { cloudConfigured } from "./cloud";
import { addDays, int, todayISO, uid } from "./format";
import { deriveGrade, movementDue, stockOf } from "./engine";
import { DEFAULT_SPEC } from "./types";
import type {
  Customer,
  DbShape,
  Lot,
  LotExtraCost,
  Material,
  MonthlyPlan,
  Overhead,
  ProcessLog,
  QcTest,
  Recipe,
} from "./types";

const KEY = "dijii.compost.v1";
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  // copy first: a listener may unsubscribe while we are iterating
  [...listeners].forEach((fn) => fn());
}

function emptyDb(): DbShape {
  return {
    version: 1,
    materials: [],
    materialMovements: [],
    recipes: [],
    lots: [],
    processLogs: [],
    qcTests: [],
    products: [],
    productMovements: [],
    customers: [],
    plans: [],
    overheads: [],
    meta: { lotSeq: 0, operator: "", seeded: false },
  };
}

/** Older saved datasets may predate a collection — fill the gaps instead of crashing. */
function normalizeDb(raw: Partial<DbShape> | null | undefined): DbShape {
  const base = emptyDb();
  if (!raw || typeof raw !== "object") return base;
  const lists: [keyof DbShape, unknown[] | undefined][] = [
    ["materials", raw.materials],
    ["materialMovements", raw.materialMovements],
    ["recipes", raw.recipes],
    ["lots", raw.lots],
    ["processLogs", raw.processLogs],
    ["qcTests", raw.qcTests],
    ["products", raw.products],
    ["productMovements", raw.productMovements],
    ["customers", raw.customers],
    ["plans", raw.plans],
    ["overheads", raw.overheads],
  ];
  const next: DbShape = { ...base };
  lists.forEach(([key, value]) => {
    (next[key] as unknown[]) = Array.isArray(value) ? value : [];
  });
  next.meta = { ...base.meta, ...(raw.meta ?? {}) };
  return next;
}

function readInitial(): DbShape {
  const startedDemo = readPrefs().started === "demo";
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return startedDemo ? seedDb() : emptyDb();
    const parsed = JSON.parse(raw) as DbShape;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.materials)) {
      return startedDemo ? seedDb() : emptyDb();
    }
    return normalizeDb(parsed);
  } catch {
    return startedDemo ? seedDb() : emptyDb();
  }
}

let state: DbShape = readInitial();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: keep the in-memory state usable for this session
  }
  notifyStoreChanged(state);
}

export const getDb = () => state;

export function transact(mutate: (draft: DbShape) => void) {
  const draft = structuredClone(state);
  mutate(draft);
  state = draft;
  persist();
  notify();
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function replaceAll(next: DbShape) {
  state = next;
  persist();
  notify();
}

/* ---------------------------------- import/export ------------------------- */

export const exportJson = () => JSON.stringify(state, null, 2);

export function importJson(text: string): { ok: boolean; text: string } {
  try {
    const parsed = JSON.parse(text) as DbShape;
    if (!parsed || parsed.version !== 1) {
      return { ok: false, text: "ឯកសារនេះមិនមែនជាទិន្នន័យរបស់ កសិករទំនើប ទេ" };
    }
    replaceAll(normalizeDb(parsed));
    return { ok: true, text: "បានបញ្ចូលទិន្នន័យដោយជោគជ័យ" };
  } catch {
    return { ok: false, text: "មិនអាចអានឯកសារ JSON បានទេ" };
  }
}

const isEmpty = (d: DbShape) =>
  !d.materials.length && !d.lots.length && !d.recipes.length && !d.products.length && !d.customers.length;

/** True until the operator picks demo or blank data on first run. */
export const hasNoDataset = () => isEmpty(state) && !state.meta.seeded;

/** Load the 7-month demo dataset (also used for the settings "restock" action). */
export const resetSeed = () => replaceAll(seedDb());
export const clearData = () =>
  replaceAll({ ...emptyDb(), meta: { lotSeq: 0, operator: state.meta.operator, seeded: true } });

export const setOperator = (operator: string) =>
  transact((d) => {
    d.meta.operator = operator;
  });

/* ---------------------------------- materials ----------------------------- */

export const newMaterial = (input: Partial<Material> & { openingStock?: number }) =>
  transact((d) => {
    const m: Material = {
      id: uid("m"),
      name: input.name ?? "មិនមានឈ្មោះ",
      category: input.category ?? "carbon",
      unit: input.unit ?? "kg",
      costPerUnit: input.costPerUnit ?? 0,
      nPct: input.nPct,
      pPct: input.pPct,
      kPct: input.kPct,
      cnRatio: input.cnRatio,
      moisturePct: input.moisturePct,
      supplier: input.supplier,
      reorderQty: input.reorderQty ?? 0,
      note: input.note,
      archived: false,
      createdAt: todayISO(),
    };
    d.materials.push(m);
    if (input.openingStock) {
      d.materialMovements.push({
        id: uid("mv"),
        materialId: m.id,
        dir: "in",
        qty: input.openingStock,
        unitCost: m.costPerUnit,
        reason: "purchase",
        operator: d.meta.operator,
        date: todayISO(),
        note: "ស្តុកដំបូង",
      });
    }
  });

export const updateMaterial = (id: string, patch: Partial<Material>) =>
  transact((d) => {
    const m = d.materials.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
  });

export const stockIn = (
  materialId: string,
  qty: number,
  unitCost: number,
  reason: "purchase" | "adjust",
  date: string,
  note?: string,
) =>
  transact((d) => {
    d.materialMovements.push({
      id: uid("mv"),
      materialId,
      dir: "in",
      qty,
      unitCost,
      reason,
      operator: d.meta.operator,
      date,
      note,
    });
  });

export const countStock = (materialId: string, counted: number, date: string) =>
  transact((d) => {
    const current = stockOf(d, materialId);
    const delta = Math.round((counted - current) * 100) / 100;
    if (Math.abs(delta) < 0.01) return;
    const m = d.materials.find((x) => x.id === materialId);
    d.materialMovements.push({
      id: uid("mv"),
      materialId,
      dir: delta > 0 ? "in" : "out",
      qty: Math.abs(delta),
      unitCost: m?.costPerUnit ?? 0,
      reason: "adjust",
      operator: d.meta.operator,
      date,
      note: `រាប់ស្តុកពិត (${current} → ${counted})`,
    });
  });

/* ---------------------------------- recipes ------------------------------- */

export const saveRecipe = (recipe: Recipe) =>
  transact((d) => {
    const idx = d.recipes.findIndex((r) => r.id === recipe.id);
    const clean: Recipe = {
      ...recipe,
      spec: { ...DEFAULT_SPEC, ...recipe.spec },
      lines: recipe.lines.filter((l) => l.materialId && l.qty > 0),
    };
    if (idx >= 0) d.recipes[idx] = clean;
    else d.recipes.push({ ...clean, id: uid("r"), createdAt: todayISO() });
  });

export const setRecipeStatus = (id: string, status: Recipe["status"]) =>
  transact((d) => {
    const r = d.recipes.find((x) => x.id === id);
    if (r) r.status = status;
  });

/* ---------------------------------- lots ---------------------------------- */

export type LotOpenResult = { ok: boolean; code?: string; lotId?: string; problems: string[] };

let lastLotResult: LotOpenResult = { ok: false, problems: [] };
export const getLotResult = () => lastLotResult;

export function openLot(input: {
  recipeId: string;
  plannedKg: number;
  windrow: string;
  startDate: string;
  operator: string;
  note?: string;
}): LotOpenResult {
  const problems: string[] = [];
  const draft = structuredClone(state);
  const recipe = draft.recipes.find((r) => r.id === input.recipeId);
  if (!recipe) {
    lastLotResult = { ok: false, problems: ["រកមិនឃើញរូបមន្ត"] };
    return lastLotResult;
  }
  const factor = input.plannedKg / recipe.targetKg;
  const inputs = recipe.lines.map((line) => {
    const m = draft.materials.find((x) => x.id === line.materialId);
    const qty = Math.round(line.qty * factor * 10) / 10;
    return {
      materialId: line.materialId,
      qty,
      unitCost: m?.costPerUnit ?? 0,
      cost: Math.round(qty * (m?.costPerUnit ?? 0)),
    };
  });
  inputs.forEach((input2) => {
    const m = draft.materials.find((x) => x.id === input2.materialId);
    const available = stockOf(draft, input2.materialId);
    if (!m) return;
    if (available < input2.qty) {
      problems.push(
        `${m.name} ខ្វះ ${Math.round((input2.qty - available) * 10) / 10} ${m.unit} (មាន ${available})`,
      );
    }
  });
  if (problems.length) {
    lastLotResult = { ok: false, problems };
    return lastLotResult;
  }

  draft.meta.lotSeq += 1;
  const code = `LOT-${input.startDate.slice(2, 4)}${input.startDate.slice(5, 7)}-${String(
    draft.meta.lotSeq,
  ).padStart(3, "0")}`;
  const lot: Lot = {
    id: uid("l"),
    code,
    recipeId: recipe.id,
    windrow: input.windrow,
    plannedKg: input.plannedKg,
    stage: "mixing",
    status: "active",
    startDate: input.startDate,
    targetDate: addDays(input.startDate, recipe.fermentationDays),
    operator: input.operator || draft.meta.operator,
    inputs,
    extraCosts: [],
    note: input.note,
    createdAt: todayISO(),
  };
  draft.lots.push(lot);
  inputs.forEach((used) => {
    draft.materialMovements.push({
      id: uid("mv"),
      materialId: used.materialId,
      dir: "out",
      qty: used.qty,
      unitCost: used.unitCost,
      reason: "lot",
      lotId: lot.id,
      operator: lot.operator,
      date: lot.startDate,
      note: `ប្រើក្នុង ${code}`,
    });
  });
  state = draft;
  persist();
  notify();
  lastLotResult = { ok: true, code, lotId: lot.id, problems: [] };
  return lastLotResult;
}

/**
 * Add feedstock to a lot after it was opened (a top-up during composting).  The weight
 * leaves stock the same way the opening consumption did, so cost/kg stays true.
 */
export function addLotMaterial(input: {
  lotId: string;
  materialId: string;
  qty: number;
  date: string;
  note?: string;
}): { ok: boolean; short: number } {
  const draft = structuredClone(state);
  const lot = draft.lots.find((l) => l.id === input.lotId);
  const material = draft.materials.find((m) => m.id === input.materialId);
  if (!lot || !material) return { ok: false, short: 0 };
  const available = stockOf(draft, material.id);
  if (input.qty > available) {
    lastTopUp = { ok: false, short: round2(input.qty - available) };
    return lastTopUp;
  }
  const unitCost = material.costPerUnit;
  const cost = Math.round(input.qty * unitCost);
  const existing = lot.inputs.find((i) => i.materialId === material.id);
  if (existing) {
    existing.qty = round2(existing.qty + input.qty);
    existing.cost += cost;
    existing.unitCost = unitCost;
  } else {
    lot.inputs.push({ materialId: material.id, qty: round2(input.qty), unitCost, cost });
  }
  lot.plannedKg = round2(lot.plannedKg + input.qty);
  draft.materialMovements.push({
    id: uid("mv"),
    materialId: material.id,
    dir: "out",
    qty: round2(input.qty),
    unitCost,
    reason: "lot",
    lotId: lot.id,
    operator: draft.meta.operator,
    date: input.date,
    note: `បន្ថែមក្នុង ${lot.code}${input.note ? ` · ${input.note}` : ""}`,
  });
  state = draft;
  persist();
  notify();
  lastTopUp = { ok: true, short: 0 };
  return lastTopUp;
}

let lastTopUp: { ok: boolean; short: number } = { ok: false, short: 0 };
export const getTopUpResult = () => lastTopUp;

const round2 = (v: number) => Math.round(v * 100) / 100;

export const setLotStage = (id: string, stage: Lot["stage"]) =>
  transact((d) => {
    const lot = d.lots.find((l) => l.id === id);
    if (lot) lot.stage = stage;
  });

export const setLotStatus = (id: string, status: Lot["status"]) =>
  transact((d) => {
    const lot = d.lots.find((l) => l.id === id);
    if (lot) {
      lot.status = status;
      if (status === "rejected") {
        // return unused material weight to stock so the count stays honest
        lot.inputs.forEach((used) => {
          d.materialMovements.push({
            id: uid("mv"),
            materialId: used.materialId,
            dir: "in",
            qty: used.qty,
            unitCost: used.unitCost,
            reason: "adjust",
            lotId: lot.id,
            operator: d.meta.operator,
            date: todayISO(),
            note: `ដកវត្ថុធាតុត្រឡប់ ${lot.code} (បដិសេធ)`,
          });
        });
        lot.actualKg = 0;
        lot.stage = "finished";
        lot.closedDate = todayISO();
      }
    }
  });

export const addLotCost = (id: string, cost: Omit<LotExtraCost, "id">) =>
  transact((d) => {
    const lot = d.lots.find((l) => l.id === id);
    if (lot) lot.extraCosts.push({ ...cost, id: uid("c") });
  });

export const removeLotCost = (id: string, costId: string) =>
  transact((d) => {
    const lot = d.lots.find((l) => l.id === id);
    if (lot) lot.extraCosts = lot.extraCosts.filter((c) => c.id !== costId);
  });

export function closeLot(input: {
  lotId: string;
  actualKg: number;
  date: string;
  productId?: string;
}) {
  const draft = structuredClone(state);
  const lot = draft.lots.find((l) => l.id === input.lotId);
  if (!lot) return;
  const recipe = draft.recipes.find((r) => r.id === lot.recipeId);
  const product =
    draft.products.find((p) => p.id === input.productId) ??
    draft.products.find((p) => p.recipeId === lot.recipeId) ??
    draft.products[0];
  lot.actualKg = input.actualKg;
  lot.status = "closed";
  lot.stage = "finished";
  lot.closedDate = input.date;
  if (product && input.actualKg > 0) {
    draft.productMovements.push({
      id: uid("pm"),
      productId: product.id,
      dir: "in",
      qtyKg: input.actualKg,
      unitPrice: 0,
      lotId: lot.id,
      reason: "produce",
      operator: draft.meta.operator,
      date: input.date,
      note: `ផលិតពី ${lot.code}${recipe ? ` · ${recipe.name}` : ""}`,
    });
  }
  state = draft;
  persist();
  notify();
}

/* ---------------------------------- process & QC -------------------------- */

export const addProcessLog = (log: Omit<ProcessLog, "id">) =>
  transact((d) => {
    d.processLogs.push({ ...log, id: uid("pl") });
    const lot = d.lots.find((l) => l.id === log.lotId);
    if (lot && lot.stage === "mixing") lot.stage = "windrow";
  });

export const addQcTest = (test: Omit<QcTest, "id" | "createdAt" | "grade"> & { grade?: QcTest["grade"] }) =>
  transact((d) => {
    const measurements = {
      lotId: test.lotId,
      date: test.date,
      sampleType: test.sampleType,
      omPct: test.omPct,
      nPct: test.nPct,
      pPct: test.pPct,
      kPct: test.kPct,
      cnRatio: test.cnRatio,
      ph: test.ph,
      moisturePct: test.moisturePct,
      ecMs: test.ecMs,
      impurityPct: test.impurityPct,
      tester: test.tester,
      note: test.note,
    };
    d.qcTests.push({
      ...measures(measurements),
      ...test,
      result: test.result,
      grade: test.grade ?? (test.sampleType === "final" ? deriveGrade(d, measurements) : undefined),
      id: uid("qc"),
      createdAt: todayISO(),
    });
  });

const measures = (t: Omit<QcTest, "id" | "createdAt" | "result" | "grade">) => t;

export const setQcResult = (id: string, result: QcTest["result"]) =>
  transact((d) => {
    const t = d.qcTests.find((x) => x.id === id);
    if (t) t.result = result;
  });

/* ---------------------------------- products ------------------------------ */

export const saveProduct = (input: {
  id?: string;
  name: string;
  recipeId?: string;
  bagSizeKg: number;
  pricePerBag: number;
  pricePerBagB?: number;
  pricePerBagC?: number;
  note?: string;
}) =>
  transact((d) => {
    if (input.id) {
      const p = d.products.find((x) => x.id === input.id);
      if (p) {
        p.name = input.name;
        p.recipeId = input.recipeId;
        p.bagSizeKg = input.bagSizeKg;
        p.pricePerBag = input.pricePerBag;
        p.pricePerBagB = input.pricePerBagB;
        p.pricePerBagC = input.pricePerBagC;
        p.note = input.note;
      }
      return;
    }
    d.products.push({
      id: uid("p"),
      name: input.name,
      recipeId: input.recipeId,
      bagSizeKg: input.bagSizeKg,
      pricePerBag: input.pricePerBag,
      pricePerBagB: input.pricePerBagB,
      pricePerBagC: input.pricePerBagC,
      note: input.note,
      createdAt: todayISO(),
    });
  });

export const productMovement = (input: {
  productId: string;
  dir: "in" | "out";
  qtyKg: number;
  unitPrice: number;
  reason: "dispatch" | "return" | "adjust" | "produce";
  party?: string;
  customerId?: string;
  lotId?: string;
  amount?: number;
  paid?: number;
  paymentMethod?: "cash" | "transfer" | "credit";
  date: string;
  note?: string;
}) =>
  transact((d) => {
    d.productMovements.push({
      id: uid("pm"),
      ...input,
      operator: d.meta.operator,
    });
  });

/** Grade prices for a product, kept optional so older rows still work. */
export const setProductPrices = (id: string, pricePerBag: number, b?: number, c?: number) =>
  transact((d) => {
    const item = d.products.find((x) => x.id === id);
    if (!item) return;
    item.pricePerBag = pricePerBag;
    item.pricePerBagB = b;
    item.pricePerBagC = c;
  });

/* ---------------------------------- plans --------------------------------- */

export const savePlan = (plan: MonthlyPlan) =>
  transact((d) => {
    const idx = d.plans.findIndex((p) => p.month === plan.month);
    const clean: MonthlyPlan = {
      month: plan.month,
      targetKg: Math.max(0, Math.round(isFinite(plan.targetKg) ? plan.targetKg : 0)),
      note: plan.note?.trim() ? plan.note.trim() : undefined,
    };
    if (idx >= 0) d.plans[idx] = clean;
    else d.plans.push(clean);
  });

export const removePlan = (month: string) =>
  transact((d) => {
    d.plans = d.plans.filter((p) => p.month !== month);
  });

/* -------------------------------- overheads -------------------------------- */

export const saveOverhead = (input: { id?: string; month: string; category: Overhead["category"]; amount: number; note?: string }) =>
  transact((d) => {
    if (input.id) {
      const row = d.overheads.find((x) => x.id === input.id);
      if (row) {
        row.category = input.category;
        row.amount = Math.max(0, Math.round(input.amount));
        row.note = input.note;
        row.month = input.month;
      }
      return;
    }
    d.overheads.push({
      id: uid("o"),
      month: input.month,
      category: input.category,
      amount: Math.max(0, Math.round(input.amount)),
      note: input.note,
      createdAt: todayISO(),
    });
  });

export const removeOverhead = (id: string) =>
  transact((d) => {
    d.overheads = d.overheads.filter((o) => o.id !== id);
  });

/* -------------------------------- customers -------------------------------- */

export const saveCustomer = (input: Partial<Customer> & { name: string }) =>
  transact((d) => {
    if (input.id) {
      const c = d.customers.find((x) => x.id === input.id);
      if (c) Object.assign(c, input);
      return;
    }
    d.customers.push({
      id: uid("c"),
      name: input.name,
      phone: input.phone,
      type: input.type ?? "farm",
      location: input.location,
      creditLimit: input.creditLimit,
      note: input.note,
      createdAt: todayISO(),
    });
  });

/** Record a payment against a customer's open dispatch, oldest first. */
export const payCustomer = (customerId: string, amount: number, method: "cash" | "transfer") =>
  transact((d) => {
    let left = Math.max(0, Math.round(amount));
    const open = d.productMovements
      .filter((mv) => mv.dir === "out" && mv.customerId === customerId)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    open.forEach((mv) => {
      if (left <= 0) return;
      const due = movementDue(mv);
      if (due <= 0) return;
      const put = Math.min(due, left);
      mv.paid = (mv.paid ?? 0) + put;
      mv.paymentMethod = method;
      left -= put;
    });
    if (left > 0 && open.length) {
      // an over-payment stays on the newest dispatch so the ledger still adds up
      const newest = open[open.length - 1];
      newest.note = `${newest.note ?? ""} · សល់បង់មកមុន ${int(left)}`.trim();
    }
  });

/* --------------------------------- cloud wire ------------------------------- */

bindLiveState(getDb);
bindReplace(replaceAll);

/**
 * Startup: when Supabase settings exist, adopt the cloud workspace (or upload this
 * device into an empty one).  Never blocks the first paint — the local snapshot renders
 * immediately and the cloud result replaces it when it lands.
 */
export function startCloudSync(): Promise<{ adopted: "cloud" | "device"; counts: Record<string, number> }> {
  if (!cloudConfigured()) return Promise.resolve({ adopted: "device", counts: {} });
  return bootstrapCloud(state);
}
