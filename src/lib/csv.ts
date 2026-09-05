import type { DbShape } from "./types";
import { STAGE_LABEL, STATUS_LABEL } from "./types";
import {
  customerStats,
  movementAmount,
  movementDue,
  overheadsIn,
  purchasePlan,
  recipeById,
  stockOf,
} from "./engine";
import { OVERHEAD_LABEL } from "./types";

const esc = (v: string | number | undefined) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type Cell = string | number | undefined;

const row = (cells: Cell[]) => cells.map(esc).join(",");

/** A leading BOM keeps Khmer readable when the file is opened in Excel. */
export const csv = (header: Cell[], rows: Cell[][]) =>
  `${[row(header), ...rows.map(row)].join("\n")}`;

export const lotsCsv = (db: DbShape) =>
  csv(
    ["Lot", "រូបមន្ត", "ផលិតផល", "ជារបៀង", "ដំណាក់កាល", "ស្ថានភាព", "ថ្ងៃចាប់ផ្តើម", "ថ្ងៃបញ្ចប់", "គ.ក ចូល", "គ.ក ចេញ", "ថ្លៃដើម (រៀល)", "ថ្លៃដើម/គ.ក", "អ្នកទទួលខុសត្រូវ"],
    db.lots.map((l) => {
      const r = recipeById(db, l.recipeId);
      const material = l.inputs.reduce((s, i) => s + i.cost, 0);
      const extras = l.extraCosts.reduce((s, c) => s + c.amount, 0);
      const cost = material + extras;
      return [
        l.code,
        r?.name,
        r?.productName,
        l.windrow,
        STAGE_LABEL[l.stage],
        STATUS_LABEL[l.status],
        l.startDate,
        l.closedDate,
        l.plannedKg,
        l.actualKg,
        cost,
        l.actualKg ? Math.round(cost / l.actualKg) : "",
        l.operator,
      ];
    }),
  );

export const customersCsv = (db: DbShape) =>
  csv(
    ["អតិថិជន", "ប្រភេទ", "ទូរស័ព្ទ", "ទីតាំង", "លើក", "គ.ក", "វិក្កយបត្រ (រៀល)", "បានបង់ (រៀល)", "សល់ជំពាក់ (រៀល)", "ទិញចុងក្រោយ"],
    db.customers.map((c) => {
      const s = customerStats(db, c.id);
      return [c.name, c.type, c.phone, c.location, s?.orders, s?.kg, s?.amount, s?.paid, s?.due, s?.lastDate];
    }),
  );

export const stockCsv = (db: DbShape) =>
  csv(
    ["វត្ថុធាតុដើម", "ប្រភេទ", "ឯកតា", "ស្តុក", "កម្រិតទិញ", "ថ្លៃ/ឯកតា (រៀល)", "តម្លៃស្តុក (រៀល)", "អ្នកផ្គត់ផ្គង់"],
    db.materials
      .filter((m) => !m.archived)
      .map((m) => {
        const qty = stockOf(db, m.id);
        return [m.name, m.category, m.unit, qty, m.reorderQty, m.costPerUnit, Math.round(qty * m.costPerUnit), m.supplier];
      }),
  );

export const dispatchCsv = (db: DbShape) =>
  csv(
    ["ថ្ងៃ", "ផលិតផល", "គ.ក", "តម្លៃ/គ.ក", "វិក្កយបត្រ (រៀល)", "បានបង់ (រៀល)", "សល់ (រៀល)", "អតិថិជន", "Lot", "អ្នកកត់"],
    db.productMovements
      .filter((mv) => mv.dir === "out")
      .map((mv) => [
        mv.date,
        db.products.find((p) => p.id === mv.productId)?.name,
        mv.qtyKg,
        mv.unitPrice,
        movementAmount(mv),
        mv.paid ?? 0,
        movementDue(mv),
        mv.party ?? db.customers.find((c) => c.id === mv.customerId)?.name,
        db.lots.find((l) => l.id === mv.lotId)?.code,
        mv.operator,
      ]),
  );

export const purchasePlanCsv = (db: DbShape, month: string, recipeId?: string) => {
  const plan = purchasePlan(db, month, recipeId);
  return csv(
    ["ខែ", "រូបមន្ត", "គោលដៅ (គ.ក)", "រំពឹង (គ.ក)", "នៅខ្វះ (គ.ក)", "វត្ថុធាតុដើម", "ត្រូវការ", "មានក្នុងស្តុក", "ត្រូវទិញ", "ឯកតា", "ថវិកា (រៀល)", "អ្នកផ្គត់ផ្គង់"],
    plan.rows.map((r) => [
      month,
      plan.recipe?.name,
      plan.target,
      plan.projected,
      plan.missingKg,
      r.name,
      r.need,
      r.stock,
      r.short,
      r.unit,
      r.cost,
      r.supplier,
    ]),
  );
};

export const overheadsCsv = (db: DbShape) =>
  csv(
    ["ខែ", "ប្រភេទ", "ចំនួន (រៀល)", "កំណត់ហេតុ"],
    [...db.overheads]
      .sort((a, b) => (a.month < b.month ? 1 : -1))
      .map((o) => [o.month, OVERHEAD_LABEL[o.category], o.amount, o.note]),
  );
