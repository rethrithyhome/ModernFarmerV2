/**
 * Pure diffing between two app snapshots and Supabase rows.  No browser globals here, so
 * tests/mapping.test.mjs can run it in Node and compare against cloud/schema.json.
 */
import { SCHEMA, TABLES, WORKSPACE_COLUMN, toRow, type TableDef } from "./cloud.ts";
import type { DbShape } from "./types.ts";

export const asRecords = (state: object, collection: string) =>
  ((state as Record<string, unknown>)[collection] as Record<string, unknown>[] | undefined) ?? [];

export const rowCount = (state: DbShape) =>
  TABLES.reduce((sum, t) => sum + asRecords(state, t.collection).length, 0);

/** Key for change detection: sorted keys + no undefined, so re-ordering never fakes a diff. */
export function stableKey(value: unknown): string {
  return JSON.stringify(norm(value));
}

function norm(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(norm);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, norm(v)]),
    );
  }
  return value;
}

export type Ops = {
  upserts: { table: TableDef; rows: Record<string, unknown>[] }[];
  deletes: { table: TableDef; ids: string[] }[];
  meta?: { id: string; [column: string]: unknown };
};

export function planOps(before: DbShape, after: DbShape, workspace = "plant-01"): Ops {
  const ops: Ops = { upserts: [], deletes: [] };
  TABLES.forEach((table) => {
    const pk = table.pk;
    const beforeRows = asRecords(before, table.collection);
    const afterRows = asRecords(after, table.collection);
    const beforeById = new Map(beforeRows.map((r) => [String(r[pk] ?? ""), r]));
    const afterIds = new Set<string>();
    const changed: Record<string, unknown>[] = [];
    afterRows.forEach((row) => {
      const id = String(row[pk] ?? "");
      afterIds.add(id);
      const old = beforeById.get(id);
      if (!old || stableKey(old) !== stableKey(row)) changed.push(toRow(table, row, workspace));
    });
    const gone = [...beforeById.keys()].filter((id) => !afterIds.has(id));
    if (changed.length) ops.upserts.push({ table, rows: changed });
    if (gone.length) ops.deletes.push({ table, ids: gone });
  });
  if (stableKey(before.meta) !== stableKey(after.meta)) {
    ops.meta = {
      id: SCHEMA.metaId,
      [WORKSPACE_COLUMN]: workspace,
      data: after.meta,
    };
  }
  return ops;
}

/** Turn a pulled Supabase payload into app state; anything unknown in the row is dropped. */
export function assembleState(
  raw: Record<string, Record<string, unknown>[]>,
  empty: DbShape,
): DbShape {
  const next: DbShape = { ...empty };
  TABLES.forEach((table) => {
    (next as unknown as Record<string, unknown>)[table.collection] = (raw[table.collection] ?? []).map(
      (row) => fromRowSafe(table, row),
    );
  });
  return next;
}

const fromRowSafe = (table: TableDef, row: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  table.columns.forEach((c) => {
    const value = row[c.column];
    if (value === null || value === undefined) {
      if (c.type === "boolean" && !c.nullable) out[c.field] = false;
      return;
    }
    // PostgREST hands numeric back as strings sometimes; keep numbers as numbers.
    out[c.field] =
      (c.type === "numeric" || c.type === "integer") && typeof value === "string" && value !== ""
        ? Number(value)
        : value;
  });
  return out;
};
