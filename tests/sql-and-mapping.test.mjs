import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(await readFile(path.join(root, "cloud/schema.json"), "utf8"));

// The mapping + diff logic avoids browser globals, so Node can run the very same files
// the browser uses (npm test enables --experimental-strip-types for .ts).
const { TABLES, toRow, fromRow } = await import("../src/lib/cloud.ts");
const { planOps, stableKey, rowCount, assembleState } = await import("../src/lib/syncPlan.ts");

const emptyState = () => ({
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
});

test("schema.json declares a primary key and unique columns for every table", () => {
  for (const table of schema.tables) {
    const names = table.columns.map((c) => c.column);
    assert.equal(new Set(names).size, names.length, `${table.table} has duplicate columns`);
    assert.ok(
      table.columns.some((c) => c.field === table.pk),
      `${table.table} pk ${table.pk} is missing from columns`,
    );
    for (const c of table.columns.filter((x) => x.field === "id" || x.field === "month")) {
      assert.match(c.column, /^[a-z_]+$/, `${table.table}.${c.column} must be snake_case`);
    }
  }
});

test("committed supabase/schema.sql is generated from schema.json (no drift)", () => {
  execFileSync("node", ["scripts/gen-sql.mjs", "--check"], { cwd: root, stdio: "pipe" });
});

test("each table's columns in SQL match schema.json exactly", async () => {
  const body = await readFile(path.join(root, "supabase/schema.sql"), "utf8");
  for (const table of schema.tables) {
    const block = new RegExp(`create table if not exists ${table.table} \\(([\\s\\S]*?)\\n\\);`).exec(body);
    assert.ok(block, `${table.table} missing from supabase/schema.sql`);
    const declared = [...block[1].matchAll(/^\s{2}([a-z_]+)\s/gm)]
      .map((m) => m[1])
      .filter((name) => name !== "primary");
    const expected = [...table.columns.map((c) => c.column), "workspace_id", "updated_at"];
    assert.deepEqual(declared, expected, `${table.table} SQL columns drifted from schema.json`);
  }
});

test("toRow/fromRow round-trip keeps every field the app uses", () => {
  for (const table of TABLES) {
    const sample = {};
    table.columns.forEach((c) => {
      sample[c.field] =
        c.type === "numeric" ? 12.5 : c.type === "integer" ? 3 : c.type === "boolean" ? true : c.type === "jsonb" ? { a: 1 } : "x";
    });
    const row = toRow(table, sample, "plant-01");
    assert.equal(row.workspace_id, "plant-01");
    const back = fromRow(table, row);
    for (const c of table.columns) assert.deepEqual(back[c.field], sample[c.field], `${table.table}.${c.field}`);
  }
});

test("nested arrays survive as jsonb", () => {
  const lots = TABLES.find((t) => t.table === "lots");
  const row = toRow(lots, { inputs: [{ materialId: "m1", qty: 5 }], extraCosts: [] , date: "2026-09-05", closedDate: null}, "w");
  assert.deepEqual(row.inputs, [{ materialId: "m1", qty: 5 }]);
  assert.equal(row.closed_date, null);
});

test("planOps: insert, update and delete are separated correctly", () => {
  const before = emptyState();
  const after = emptyState();
  after.materials = [
    { id: "m1", name: "ស្លឹកស្រូវ", category: "carbon", unit: "kg", costPerUnit: 120, reorderQty: 100, archived: false, createdAt: "2026-01-01" },
  ];
  let ops = planOps(before, after, "plant-01");
  assert.equal(ops.upserts.length, 1);
  assert.equal(ops.upserts[0].table.table, "materials");
  assert.equal(ops.upserts[0].rows.length, 1);
  assert.equal(ops.deletes.length, 0);
  assert.equal(ops.meta, undefined); // meta untouched => no meta write

  // identical state => no rows at all
  ops = planOps(after, structuredClone(after), "plant-01");
  assert.equal(ops.upserts.length, 0);
  assert.equal(ops.deletes.length, 0);
  assert.equal(ops.meta, undefined);

  // edited row -> one upsert, deleted row -> one delete
  const third = structuredClone(after);
  third.materials[0].costPerUnit = 130;
  ops = planOps(after, third, "plant-01");
  assert.equal(ops.upserts[0].rows.length, 1);
  assert.equal(ops.deletes.length, 0);

  const removed = structuredClone(after);
  removed.materials = [];
  ops = planOps(after, removed, "plant-01");
  assert.deepEqual(ops.deletes[0].ids, ["m1"]);

  // a bumped lot counter is the one thing that rides along as a meta row
  const counter = structuredClone(after);
  counter.meta = { ...counter.meta, lotSeq: 7, operator: "សុខ ដារ៉ា" };
  ops = planOps(after, counter, "plant-01");
  assert.equal(ops.meta.data.lotSeq, 7);
  assert.equal(ops.meta.workspace_id, "plant-01");
});

test("key order and undefined values never create a fake diff", () => {
  const a = { id: "x", name: "n", note: undefined, qty: 1 };
  const b = { qty: 1, id: "x", name: "n" };
  assert.equal(stableKey(a), stableKey(b));
});

test("plans use month as the primary key", () => {
  const plans = TABLES.find((t) => t.collection === "plans");
  assert.equal(plans.pk, "month");
  const before = emptyState();
  const after = emptyState();
  after.plans = [{ month: "2026-09", targetKg: 13500 }];
  const ops = planOps(before, after, "plant-01");
  assert.equal(ops.upserts[0].rows[0].month, "2026-09");
  assert.equal(ops.upserts[0].rows[0].target_kg, 13500);
});

test("assembleState maps rows back and drops unknown columns", () => {
  const raw = {
    materials: [
      { id: "m1", name: "a", category: "carbon", unit: "kg", cost_per_unit: "120", reorder_qty: "10", archived: false, created_at: "2026-01-01", surprise: "?" },
    ],
  };
  const state = assembleState(raw, emptyState());
  assert.equal(state.materials[0].costPerUnit, 120);
  assert.equal(state.materials[0].surprise, undefined);
});

test("rowCount only counts mapped collections", () => {
  const state = emptyState();
  state.lots = [{ id: "l1" }];
  state.materials = [{ id: "m1" }, { id: "m2" }];
  assert.equal(rowCount(state), 3);
});
