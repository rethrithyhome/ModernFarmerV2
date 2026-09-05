import { addDays, todayISO, uid } from "./format";
import { DEFAULT_SPEC } from "./types";
import type {
  DbShape,
  Lot,
  LotInput,
  Material,
  ProcessLog,
  QcTest,
  Recipe,
} from "./types";

const rand = (seed: number) => {
  let s = seed || 7;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s / 2_147_483_648;
  };
};

const today = todayISO();

const materials: Material[] = [
  ["m_manure", "ភួយគោស្រស់", "nitrogen", "kg", 180, 4.2, 2.4, 1.1, 20, 65, "ហ្វាម ព្រៃក្រាំង", 2000],
  ["m_fish", "សំណល់ត្រី (រោងចក្រ)", "nitrogen", "kg", 450, 8.5, 5.2, 1.4, 8, 70, "ត្រីមេកុង កំពង់ផែ", 600],
  ["m_veg", "សំណល់បន្លែផ្សារ", "nitrogen", "kg", 150, 2.6, 0.9, 2.1, 18, 80, "ផ្សារដូង ក្រចេះ", 900],
  ["m_straw", "ស្លឹកស្រូវ", "carbon", "kg", 120, 0.6, 0.1, 1.4, 75, 12, "កសិករ ស្រែកោះកោង", 1800],
  ["m_sawdust", "ស្នៃឈើ + ម្សៅឈើ", "carbon", "kg", 90, 0.1, 0.05, 0.1, 320, 20, "ម្សៅស្រូវ រោងឈើ", 700],
  ["m_ash", "ផេះឈើ", "amendment", "kg", 600, 0, 1.2, 25, 0, 5, "ភូមិ តាគាវ", 150],
  ["m_phos", "ថ្មផូស្វាត", "amendment", "kg", 2200, 0, 12, 0, 0, 2, "នាំចូល វៀតណាម", 120],
  ["m_EM", "មេរោគ EM", "inoculant", "លីត្រ", 4500, 0, 0, 0, 0, 100, "មជ្ឈមណ្ឌលកសិកម្ម", 25],
  ["m_molasses", "ទឹកអំបៅ", "inoculant", "kg", 2800, 1.2, 0.5, 1.5, 0, 22, "រោងចក្រស្ករត្នោត", 120],
  ["m_bag", "ថង់ជី 25 គីឡូ", "packaging", "ថង់", 950, 0, 0, 0, 0, 0, "ដេក ភ្នំពេញ", 800],
].map(
  ([id, name, category, unit, costPerUnit, nPct, pPct, kPct, cnRatio, moisturePct, supplier, reorderQty]) => ({
    id: id as string,
    name: name as string,
    category: category as Material["category"],
    unit: unit as string,
    costPerUnit: costPerUnit as number,
    nPct: nPct as number,
    pPct: pPct as number,
    kPct: kPct as number,
    cnRatio: cnRatio as number,
    moisturePct: moisturePct as number,
    supplier: supplier as string,
    reorderQty: reorderQty as number,
    archived: false,
    createdAt: addDays(today, -220),
  }),
);

const recipe = (
  id: string,
  name: string,
  productName: string,
  targetKg: number,
  yieldPct: number,
  fermentationDays: number,
  lines: [string, number][],
  note: string,
): Recipe => ({
  id,
  name,
  productName,
  targetKg,
  yieldPct,
  fermentationDays,
  spec: { ...DEFAULT_SPEC },
  lines: lines.map(([materialId, qty], i) => ({ materialId, qty, sort: i })),
  status: "active",
  note,
  createdAt: addDays(today, -210),
});

const recipes: Recipe[] = [
  recipe(
    "r_rice",
    "រូបមន្ត A · ស្រូវ-ភួយគោ",
    "ជីកំប៉ុស្តិ៍អង្ករ",
    5000,
    62,
    45,
    [
      ["m_manure", 2000],
      ["m_straw", 1200],
      ["m_veg", 1000],
      ["m_sawdust", 600],
      ["m_ash", 80],
      ["m_molasses", 40],
      ["m_EM", 12],
    ],
    "រូបមន្តស្នូលសម្រាប់ផលិតផលលក់ដាច់បំផុត · C:N ដំបូង ~28",
  ),
  recipe(
    "r_rice_enrich",
    "រូបមន្ត A+ · បន្ថែមថ្មផូស្វាត",
    "ជីកំប៉ុស្តិ៍អង្ករ+",
    5000,
    60,
    50,
    [
      ["m_manure", 1900],
      ["m_straw", 1100],
      ["m_veg", 900],
      ["m_sawdust", 500],
      ["m_phos", 200],
      ["m_ash", 80],
      ["m_molasses", 40],
      ["m_EM", 12],
    ],
    "សម្រាប់ស្រែបន្លែ ដែលត្រូវការ P ខ្ពស់",
  ),
  recipe(
    "r_fish",
    "រូបមន្ត B · ជីត្រី",
    "ជីត្រីកំប៉ុស្តិ៍",
    3000,
    58,
    35,
    [
      ["m_fish", 1100],
      ["m_veg", 800],
      ["m_straw", 600],
      ["m_sawdust", 400],
      ["m_ash", 30],
      ["m_molasses", 25],
      ["m_EM", 8],
    ],
    "កំដៅឡើងលឿន ត្រូវកូរយ៉ាងតិច ៣ ដង",
  ),
] as Recipe[];

const products = [
  { id: "p_rice", name: "ជីកំប៉ុស្តិ៍អង្ករ", recipeId: "r_rice", bagSizeKg: 25, pricePerBag: 12500 },
  { id: "p_rice_p", name: "ជីកំប៉ុស្តិ៍អង្ករ+", recipeId: "r_rice_enrich", bagSizeKg: 25, pricePerBag: 16000 },
  { id: "p_fish", name: "ជីត្រីកំប៉ុស្តិ៍", recipeId: "r_fish", bagSizeKg: 25, pricePerBag: 20000 },
];

const productIdForRecipe = (recipeId: string) =>
  products.find((p) => p.recipeId === recipeId)?.id ?? products[0].id;

const scale = (r: Recipe, plannedKg: number): LotInput[] => {
  const factor = plannedKg / r.targetKg;
  return r.lines.map((line) => {
    const m = materials.find((x) => x.id === line.materialId);
    const qty = Math.round(line.qty * factor * 10) / 10;
    return {
      materialId: line.materialId,
      qty,
      unitCost: m?.costPerUnit ?? 0,
      cost: Math.round(qty * (m?.costPerUnit ?? 0)),
    };
  });
};

type Plan = {
  n: number;
  ago: number;
  recipeId: string;
  plannedKg: number;
  yieldShift: number;
  windrow: string;
  status?: Lot["status"];
  stage?: Lot["stage"];
};

const plans: Plan[] = [
  { n: 1, ago: 205, recipeId: "r_rice", plannedKg: 5000, yieldShift: -4, windrow: "W1" },
  { n: 2, ago: 188, recipeId: "r_fish", plannedKg: 3000, yieldShift: 1, windrow: "W4" },
  { n: 3, ago: 170, recipeId: "r_rice", plannedKg: 6000, yieldShift: -1, windrow: "W2" },
  { n: 4, ago: 150, recipeId: "r_rice_enrich", plannedKg: 5000, yieldShift: -6, windrow: "W1" },
  { n: 5, ago: 128, recipeId: "r_fish", plannedKg: 3000, yieldShift: 3, windrow: "W3" },
  { n: 6, ago: 106, recipeId: "r_rice", plannedKg: 5500, yieldShift: 0, windrow: "W2" },
  { n: 7, ago: 84, recipeId: "r_rice_enrich", plannedKg: 5000, yieldShift: 2, windrow: "W1" },
  { n: 8, ago: 62, recipeId: "r_fish", plannedKg: 4000, yieldShift: -9, windrow: "W4" },
  { n: 9, ago: 58, recipeId: "r_rice", plannedKg: 6000, yieldShift: 1, windrow: "W2" },
  { n: 10, ago: 22, recipeId: "r_rice", plannedKg: 5000, yieldShift: 0, windrow: "W1", stage: "sieving" },
  { n: 11, ago: 12, recipeId: "r_fish", plannedKg: 3000, yieldShift: 0, windrow: "W3", stage: "fermentation" },
  { n: 12, ago: 4, recipeId: "r_rice_enrich", plannedKg: 5000, yieldShift: 0, windrow: "W5", stage: "mixing" },
  {
    n: 13,
    ago: 34,
    recipeId: "r_rice_enrich",
    plannedKg: 5000,
    yieldShift: 0,
    windrow: "W6",
    stage: "curing",
    status: "hold",
  },
];

/** A closed lot never has a close date in the future. */
const closeDateOf = (start: string, offsetDays: number) => {
  const target = addDays(start, offsetDays);
  return target > today ? today : target;
};

function buildLots() {
  const lots: Lot[] = [];
  const logs: ProcessLog[] = [];
  const tests: QcTest[] = [];
  const next = rand(20260905);

  plans.forEach((plan) => {
    const r = recipes.find((x) => x.id === plan.recipeId)!;
    const start = addDays(today, -plan.ago);
    const closed = plan.stage === undefined;
    // only a closed lot books finished stock; open lots keep planned quantities
    const yieldActual = closed ? r.yieldPct + plan.yieldShift : undefined;
    const actualKg = yieldActual === undefined ? undefined : Math.round((plan.plannedKg * yieldActual) / 100 / 5) * 5;
    const code = `LOT-${start.slice(2, 4)}${start.slice(5, 7)}-${String(plan.n).padStart(3, "0")}`;
    const lot: Lot = {
      id: `l_${plan.n}`,
      code,
      recipeId: r.id,
      windrow: plan.windrow,
      plannedKg: plan.plannedKg,
      actualKg,
      stage: closed ? "finished" : plan.stage!,
      status: closed ? "closed" : plan.status ?? "active",
      startDate: start,
      targetDate: addDays(start, r.fermentationDays),
      closedDate: closed ? closeDateOf(start, r.fermentationDays + 10) : undefined,
      operator: plan.n % 2 ? "សុខ ដារ៉ា" : "ចាន់ វិរៈ",
      inputs: scale(r, plan.plannedKg),
      extraCosts: [
        {
          id: uid("c"),
          category: "labour",
          amount: Math.round(plan.plannedKg * 65),
          date: start,
          note: "កម្មករ ៣ នាក់",
        },
        {
          id: uid("c"),
          category: "energy",
          amount: Math.round(180_000 + plan.plannedKg * 18),
          date: addDays(start, 5),
          note: "ម៉ាស៊ីនកូរ និងដឹកជញ្ជូន",
        },
      ],
      createdAt: start,
    };
    if (!closed) {
      lot.extraCosts = lot.extraCosts.filter((c) => c.category === "labour");
    }
    lots.push(lot);

    // windrow monitoring readings
    const readings = Math.max(1, Math.min(6, Math.round((plan.ago > 30 ? 30 : plan.ago) / 6)));
    for (let i = 0; i < readings; i += 1) {
      const day = i * 6 + 2;
      const heat = i < 2 ? 34 + i * 18 : i < 4 ? 62 + next() * 8 : 48 + next() * 6;
      const date = addDays(start, day);
      if (date > today) break;
      logs.push({
        id: uid("pl"),
        lotId: lot.id,
        date,
        tempC: Math.round(heat * 10) / 10,
        moisturePct: Math.round((52 - i * 3 + next() * 6) * 10) / 10,
        ph: Math.round((6.4 + next() * 1.2) * 10) / 10,
        turned: i % 2 === 1,
        operator: lot.operator,
        note: i === 2 ? "កំដៅឡើងខ្ពស់ ត្រូវកូរម្តងទៀត" : undefined,
      });
    }

    // QC tests: one in-process for active lots, final for closed/late lots
    if (plan.ago > 30) {
      const bad = plan.n === 8;
      tests.push({
        id: uid("qc"),
        lotId: lot.id,
        date: addDays(start, 33),
        sampleType: "in_process",
        ph: 6.8 + next(),
        moisturePct: 41 + next() * 3,
        cnRatio: bad ? 31 : 21 + next() * 3,
        result: bad ? "pending" : "pass",
        tester: "បណ្ឌិត គីមី ដារ៉ីន",
        note: bad ? "C:N ខ្ពស់ជាងស្តង់ដារ រង់ចាំវិភាគម្តងទៀត" : undefined,
        createdAt: addDays(start, 33),
      });
    }
    if (closed) {
      const om = 33 + next() * 9;
      const spec = r.spec;
      const n = r.id === "r_fish" ? 2.1 + next() : 1.3 + next() * 0.8;
      const cn = 14 + next() * 7;
      const fail = plan.yieldShift < -5;
      tests.push({
        id: uid("qc"),
        lotId: lot.id,
        date: addDays(start, r.fermentationDays + 8),
        sampleType: "final",
        omPct: Math.round(om * 10) / 10,
        nPct: Math.round(n * 100) / 100,
        pPct: Math.round((r.id === "r_rice_enrich" ? 3.4 : 1.8) * 100) / 100,
        kPct: Math.round((1.6 + next()) * 100) / 100,
        cnRatio: Math.round(cn * 10) / 10,
        ph: Math.round((7 + next()) * 10) / 10,
        moisturePct: Math.round((29 + next() * 7) * 10) / 10,
        ecMs: Math.round(2.4 + next() * 1.3),
        impurityPct: Math.round(next() * 2 * 10) / 10,
        result: fail ? "fail" : om >= spec.omMin && n >= spec.nMin && cn <= spec.cnMax ? "pass" : "fail",
        tester: "បណ្ឌិត គីមី ដារ៉ីន",
        note: fail ? "សំណល់ប្រេងច្រើន មិនសាកសមប្រើស្រូវ" : undefined,
        createdAt: addDays(start, r.fermentationDays + 9),
      });
    }
  });

  return { lots, logs, tests };
}

const { lots, logs, tests } = buildLots();

/** Consumption movements come from the lots; purchases land the balance on បច្ចុប្បន្ឝស្តុក. */
const targetStock: Record<string, number> = {
  m_manure: 2600,
  m_fish: 380, // below reorder → alert
  m_veg: 1250,
  m_straw: 2400,
  m_sawdust: 900,
  m_ash: 240,
  m_phos: 60,
  m_EM: 34,
  m_molasses: 155,
  m_bag: 1200,
};

function movementsFor() {
  const moves: DbShape["materialMovements"] = [];
  lots.forEach((lot) => {
    lot.inputs.forEach((input) => {
      moves.push({
        id: uid("mv"),
        materialId: input.materialId,
        dir: "out",
        qty: input.qty,
        unitCost: input.unitCost,
        reason: "lot",
        lotId: lot.id,
        operator: lot.operator,
        date: lot.startDate,
        note: `ប្រើ ${lot.code}`,
      });
    });
  });
  materials.forEach((m) => {
    const used = moves
      .filter((x) => x.materialId === m.id && x.dir === "out")
      .reduce((sum, x) => sum + x.qty, 0);
    const buys: [number, number][] = [
      [Math.round((used * 0.55 + targetStock[m.id] * 0.35) * 10) / 10, -215],
      [Math.round((used * 0.45 + targetStock[m.id] * 0.25) * 10) / 10, -136],
      [Math.round(targetStock[m.id] * 0.4 * 10) / 10, -47],
    ];
    const totalIn = buys.reduce((sum, [qty]) => sum + qty, 0);
    const loss = Math.max(0, Math.round((totalIn - used - targetStock[m.id]) * 10) / 10);
    buys.forEach(([qty, dayOffset], i) => {
      moves.push({
        id: uid("mv"),
        materialId: m.id,
        dir: "in",
        qty,
        unitCost: Math.round(m.costPerUnit * (1 + i * 0.04)),
        reason: "purchase",
        operator: "នាង មុនី",
        date: addDays(today, dayOffset),
        note: "ទិញចូលតាមផែនការរដូវ",
      });
    });
    if (loss > 0) {
      moves.push({
        id: uid("mv"),
        materialId: m.id,
        dir: "out",
        qty: loss,
        unitCost: 0,
        reason: m.category === "packaging" ? "adjust" : "spoilage",
        operator: "ចាន់ វិរៈ",
        date: addDays(today, -60),
        note: "ហៀនខូច/បាត់បង់នៅទីតាំង",
      });
    }
  });
  return moves;
}

const productMoves = lots
  .filter((lot) => lot.actualKg)
  .map((lot, i) => ({
    id: uid("pm"),
    productId: productIdForRecipe(lot.recipeId),
    dir: "in" as const,
    qtyKg: lot.actualKg!,
    unitPrice: 0,
    lotId: lot.id,
    reason: "produce" as const,
    operator: lot.operator,
    date: lot.closedDate ?? lot.startDate,
    note: `ផលិតពី ${lot.code}`,
  }));

const customers: DbShape["customers"] = [
  {
    id: "c_phsar",
    name: "កសិដ្ឋាន ផ្សារឆ្នើម",
    phone: "012 345 678",
    type: "farm",
    location: "កណ្តាល, តាងូ",
    creditLimit: 2_000_000,
    note: "បន្លែចម្អិន · និយមទិញរៀងរាល់ ២ ខែ",
    createdAt: addDays(today, -200),
  },
  {
    id: "c_mockda",
    name: "សហគមន៍ ម៉ុកដា",
    phone: "077 888 210",
    type: "coop",
    location: "កណ្តាល, អង្គរសន្ទល់",
    creditLimit: 1_200_000,
    note: "សមាជិក ៤៥ នាក់ ។ ត្រូវការថង់ 25 គ.ក",
    createdAt: addDays(today, -180),
  },
  {
    id: "c_akouphou",
    name: "អ្នកចែកចាយ អង្គរភូ",
    phone: "098 765 432",
    type: "dealer",
    location: "សៀមរាប, ក្រុង",
    creditLimit: 4_000_000,
    note: "យកទៅលក់បន្ត ។ ទាមទារបញ្ចុះតម្លៃ 5%",
    createdAt: addDays(today, -150),
  },
  {
    id: "c_trnot",
    name: "កសិដ្ឋាន ត្នោត",
    type: "farm",
    location: "តាកែវ, បាទឹ",
    note: "សាកសមបំផុតសម្រាប់ជីត្រី",
    createdAt: addDays(today, -60),
  },
];

const monthlyPlans: DbShape["plans"] = [
  { month: addDays(today, -150).slice(0, 7), targetKg: 9000, note: "បើករដូវ" },
  { month: addDays(today, -120).slice(0, 7), targetKg: 10500 },
  { month: addDays(today, -90).slice(0, 7), targetKg: 10500, note: "ទទួលបន្ថែមវិក្កយបត្រ" },
  { month: addDays(today, -60).slice(0, 7), targetKg: 12000 },
  { month: addDays(today, -30).slice(0, 7), targetKg: 12000 },
  {
    month: today.slice(0, 7),
    targetKg: 13500,
    note: "គោលដៅខ្ពស់ — បំពេញការបញ្ជាទិញរបស់អ្នកចែកចាយ និងសហគមន៍",
  },
  { month: addDays(today, 30).slice(0, 7), targetKg: 11000, note: "រដូវបន្លែ" },
];

/** The lot each historical sale came from, so the invoice can show its QR + grade. */
function sourceLotId(productId: string, date: string) {
  const recipeId = products.find((p) => p.id === productId)?.recipeId;
  const candidates = lots
    .filter((l) => l.status === "closed" && l.closedDate && l.closedDate <= date)
    .filter((l) => (recipeId ? l.recipeId === recipeId : true))
    .sort((a, b) => ((a.closedDate ?? "") < (b.closedDate ?? "") ? 1 : -1));
  return candidates[0]?.id;
}

const dispatches: DbShape["productMovements"] = [
  ["p_rice", 4500, "c_phsar", 0.6],
  ["p_fish", 1200, "c_mockda", 1],
  ["p_rice_p", 1500, "c_mockda", 1],
  ["p_rice", 6000, "c_akouphou", 0.35],
  ["p_fish", 900, "c_trnot", 1],
].map(([productId, qtyKg, customerId, payRatio], i) => {
  const product = products.find((p) => p.id === (productId as string))!;
  const customer = customers.find((c) => c.id === (customerId as string))!;
  const unitPrice = product.pricePerBag / product.bagSizeKg;
  const amount = Math.round((qtyKg as number) * unitPrice);
  return {
    id: uid("pm"),
    productId: productId as string,
    dir: "out" as const,
    qtyKg: qtyKg as number,
    unitPrice,
    customerId: customerId as string,
    party: customer.name,
    amount,
    paid: Math.round(amount * (payRatio as number)),
    paymentMethod: (payRatio === 1 ? "transfer" : "credit") as "transfer" | "credit",
    reason: "dispatch" as const,
    operator: "នាង មុនី",
    date: addDays(today, -150 + i * 35),
    lotId: sourceLotId(productId as string, addDays(today, -150 + i * 35)),
    note: i === 3 ? "ដឹកដោយឡានធ្ងន់ · សល់បង់ 65%" : undefined,
  };
});

/** Shared plant cost for every month the demo spans, so cost/kg includes it. */
function builtOverheads() {
  const rows: DbShape["overheads"] = [];
  for (let back = 9; back >= 0; back -= 1) {
    const month = addDays(today, -back * 30).slice(0, 7);
    rows.push({
      id: `o_l_${month}`,
      month,
      category: "labour",
      amount: 780_000 + (8 - back) * 10_000,
      note: "បុគ្គលិកផ្ទាល់ ៤ នាក់",
      createdAt: addDays(today, -back * 30),
    });
    rows.push({
      id: `o_e_${month}`,
      month,
      category: "energy",
      amount: 210_000 + (8 - back) * 6_000,
      note: "ត្រាក់ទ័រ + ម៉ាស៊ីនកូរ",
      createdAt: addDays(today, -back * 30),
    });
    if (back % 3 === 0) {
      rows.push({
        id: `o_r_${month}`,
        month,
        category: "rent",
        amount: 300_000,
        note: "កន្លែងសម្រាកជី",
        createdAt: addDays(today, -back * 30),
      });
    }
  }
  return rows;
}

export const seedDb = (): DbShape => ({
  version: 1,
  materials,
  materialMovements: movementsFor(),
  recipes,
  lots,
  processLogs: logs,
  qcTests: tests,
  products: products.map((p) => ({ ...p, createdAt: addDays(today, -210) })),
  productMovements: [...productMoves, ...dispatches],
  customers,
  plans: monthlyPlans,
  overheads: builtOverheads(),
  meta: {
    lotSeq: lots.length,
    operator: "សុខ ដារ៉ា",
    seeded: true,
  },
});
