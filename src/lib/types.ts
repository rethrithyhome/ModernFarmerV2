export type MaterialCategory =
  | "nitrogen"
  | "carbon"
  | "amendment"
  | "inoculant"
  | "packaging";

export type LotStage =
  | "mixing"
  | "windrow"
  | "fermentation"
  | "curing"
  | "sieving"
  | "bagging"
  | "finished";

export type LotStatus = "active" | "hold" | "rejected" | "closed";

export type QcResult = "pass" | "fail" | "pending";

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  costPerUnit: number;
  nPct?: number;
  pPct?: number;
  kPct?: number;
  cnRatio?: number;
  moisturePct?: number;
  supplier?: string;
  reorderQty: number;
  note?: string;
  archived: boolean;
  createdAt: string;
}

/** qty is always expressed for one `Material.unit` and one recipe `targetKg`. */
export interface MaterialMovement {
  id: string;
  materialId: string;
  dir: "in" | "out";
  qty: number;
  unitCost: number;
  reason: "purchase" | "lot" | "adjust" | "spoilage";
  lotId?: string;
  operator: string;
  date: string;
  note?: string;
}

export interface QcSpec {
  phMin: number;
  phMax: number;
  moistureMin: number;
  moistureMax: number;
  cnMax: number;
  omMin: number;
  nMin: number;
}

export interface RecipeLine {
  materialId: string;
  qty: number;
  sort?: number;
}

export interface Recipe {
  id: string;
  name: string;
  productName: string;
  targetKg: number;
  yieldPct: number;
  fermentationDays: number;
  spec: QcSpec;
  lines: RecipeLine[];
  status: "active" | "archived";
  note?: string;
  createdAt: string;
}

export interface LotInput {
  materialId: string;
  qty: number;
  unitCost: number;
  cost: number;
}

export interface LotExtraCost {
  id: string;
  category: "labour" | "energy" | "transport" | "screening" | "other";
  amount: number;
  date: string;
  note?: string;
}

export interface Lot {
  id: string;
  code: string;
  recipeId: string;
  windrow: string;
  plannedKg: number;
  actualKg?: number;
  stage: LotStage;
  status: LotStatus;
  startDate: string;
  targetDate: string;
  closedDate?: string;
  operator: string;
  inputs: LotInput[];
  extraCosts: LotExtraCost[];
  note?: string;
  createdAt: string;
}

export interface ProcessLog {
  id: string;
  lotId: string;
  date: string;
  tempC?: number;
  moisturePct?: number;
  ph?: number;
  turned: boolean;
  operator: string;
  note?: string;
}

export interface QcTest {
  id: string;
  lotId: string;
  date: string;
  sampleType: "in_process" | "final";
  omPct?: number;
  nPct?: number;
  pPct?: number;
  kPct?: number;
  cnRatio?: number;
  ph?: number;
  moisturePct?: number;
  ecMs?: number;
  impurityPct?: number;
  result: QcResult;
  /** A = sells at list, B = discounted, C = only as low-grade/soil conditioner. */
  grade?: "A" | "B" | "C";
  tester: string;
  note?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  recipeId?: string;
  bagSizeKg: number;
  pricePerBag: number;
  /** Price for a lot whose final QC came out grade B or C (list price = grade A). */
  pricePerBagB?: number;
  pricePerBagC?: number;
  note?: string;
  createdAt: string;
}

export interface ProductMovement {
  id: string;
  productId: string;
  dir: "in" | "out";
  qtyKg: number;
  unitPrice: number;
  lotId?: string;
  party?: string;
  customerId?: string;
  /** Invoiced total for this movement; defaults to qtyKg × unitPrice when absent. */
  amount?: number;
  /** Amount the customer has already paid against this movement. */
  paid?: number;
  paymentMethod?: "cash" | "transfer" | "credit";
  reason: "produce" | "dispatch" | "return" | "adjust";
  operator: string;
  date: string;
  note?: string;
}

export type CustomerType = "farm" | "coop" | "dealer" | "home" | "other";

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  type: CustomerType;
  location?: string;
  creditLimit?: number;
  note?: string;
  createdAt: string;
}

/** Planned finished output for one calendar month, in kg. */
export interface MonthlyPlan {
  month: string;
  targetKg: number;
  note?: string;
}

/**
 * A month's shared plant cost (staff on the payroll, machine fuel, shed rent…).
 * It is not tied to one lot, so it is spread over that month's finished output.
 */
export interface Overhead {
  id: string;
  month: string;
  category: "labour" | "energy" | "rent" | "equipment" | "other";
  amount: number;
  note?: string;
  createdAt: string;
}

export const OVERHEAD_LABEL: Record<Overhead["category"], string> = {
  labour: "បុគ្គលិកប្រចាំ",
  energy: "ប្រេង · ភ្លើង",
  rent: "ជួលកន្លែង",
  equipment: "ម៉ាស៊ីន · ជួសជុល",
  other: "ផ្សេងៗ",
};

export interface DbShape {
  version: 1;
  materials: Material[];
  materialMovements: MaterialMovement[];
  recipes: Recipe[];
  lots: Lot[];
  processLogs: ProcessLog[];
  qcTests: QcTest[];
  products: Product[];
  productMovements: ProductMovement[];
  customers: Customer[];
  plans: MonthlyPlan[];
  overheads: Overhead[];
  meta: { lotSeq: number; operator: string; seeded: boolean };
}

export const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  nitrogen: "សារធាតុអាសូត (N)",
  carbon: "សារធាតុកាបូន (C)",
  amendment: "សារធាតុបន្ថែម",
  inoculant: "មេរោគ (EM)",
  packaging: "សម្ភារៈវេចខ្ចប់",
};

export const CATEGORY_RANK: MaterialCategory[] = [
  "nitrogen",
  "carbon",
  "amendment",
  "inoculant",
  "packaging",
];

export const STAGE_LABEL: Record<LotStage, string> = {
  mixing: "លាយវត្ថុធាតុ",
  windrow: "តម្ពុងរបៀង",
  fermentation: "ផ្កាម",
  curing: "សម្ងួត",
  sieving: "ច្រោះ",
  bagging: "ខ្ចប់",
  finished: "បញ្ចប់",
};

export const STAGE_ORDER: LotStage[] = [
  "mixing",
  "windrow",
  "fermentation",
  "curing",
  "sieving",
  "bagging",
  "finished",
];

export const STATUS_LABEL: Record<LotStatus, string> = {
  active: "កំពុងផលិត",
  hold: "ផ្អាក",
  rejected: "បដិសេធ",
  closed: "បញ្ចប់",
};

export const EXTRA_LABEL: Record<LotExtraCost["category"], string> = {
  labour: "កម្លាំងពលកម្ម",
  energy: "ប្រេង/ភ្លើង",
  transport: "ដឹកជញ្ជូន",
  screening: "ច្រោះ/បុក",
  other: "ផ្សេងៗ",
};

export const REASON_LABEL: Record<MaterialMovement["reason"], string> = {
  purchase: "ទិញចូល",
  lot: "ប្រើក្នុង Lot",
  adjust: "កែស្តុក",
  spoilage: "ខូច/បាត់បង់",
};

export const PRODUCT_REASON_LABEL: Record<ProductMovement["reason"], string> = {
  produce: "ផលិតចូល",
  dispatch: "បញ្ចេញលក់",
  return: "ប្រគល់មកវិញ",
  adjust: "កែស្តុក",
};

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  farm: "កសិដ្ឋាន",
  coop: "សហគមន៍/ក្រុម",
  dealer: "អ្នកចែកចាយ",
  home: "គ្រួសារ/សួន",
  other: "ផ្សេងៗ",
};

export const PAYMENT_LABEL: Record<NonNullable<ProductMovement["paymentMethod"]>, string> = {
  cash: "សាច់ប្រាក់",
  transfer: "ផ្ទេរប្រាក់",
  credit: "សម្ងាត់ (ពេលក្រោយ)",
};

export const GRADE_LABEL: Record<"A" | "B" | "C", string> = {
  A: "ថ្នាក់ A · លក់តម្លៃពេញ",
  B: "ថ្នាក់ B · បញ្ចុះបន្តិច",
  C: "ថ្នាក់ C · សម្រាប់ដី/កម្រិតទាប",
};

export const DEFAULT_SPEC: QcSpec = {
  phMin: 5.5,
  phMax: 8.5,
  moistureMin: 25,
  moistureMax: 45,
  cnMax: 25,
  omMin: 30,
  nMin: 1,
};
