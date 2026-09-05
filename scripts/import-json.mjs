#!/usr/bin/env node
/**
 * Turn a JSON backup exported by the app (ទិន្នន័យ/ការកំណត់ → ទាញយក JSON) into
 * Supabase-ready SQL, so you can move an existing dataset into your own project.
 *
 *   node scripts/import-json.mjs path/to/dijii-compost-2026-09-05.json
 *   → supabase/import.sql  (run it in the Supabase SQL editor)
 *
 * Rows are inserted with ON CONFLICT DO UPDATE, so re-running refreshes the same rows
 * instead of duplicating them.  Every table carries the workspace id (default plant-01,
 * override with WORKSPACE=my-id).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [input] = process.argv.slice(2);
if (!input) {
  console.error("usage: node scripts/import-json.mjs <exported.json>");
  process.exit(1);
}

const WORKSPACE = process.env.WORKSPACE || "plant-01";
const schema = JSON.parse(await readFile(path.join(root, "cloud/schema.json"), "utf8"));
const data = JSON.parse(await readFile(path.resolve(input), "utf8"));

if (!data || data.version !== 1 || !Array.isArray(data.materials)) {
  console.error("this file is not a v1 app export (missing materials/)");
  process.exit(1);
}

const lit = (value, type) => {
  if (value === undefined || value === null) return "null";
  if (type === "jsonb") return `${JSON.stringify(JSON.stringify(value))}::jsonb`;
  if (type === "boolean") return value ? "true" : "false";
  if (type === "numeric" || type === "integer") {
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : "null";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
};

const chunks = [
  `-- កសិករទំនើប · imported from ${path.basename(input)} on ${new Date().toISOString().slice(0, 10)}`,
  `-- workspace: ${WORKSPACE}  (change with WORKSPACE=my-id and re-run)`,
  `-- Run in Supabase SQL editor after supabase/schema.sql.`,
  "",
  "begin;",
  "",
];

let total = 0;
for (const table of schema.tables) {
  const rows = Array.isArray(data[table.collection]) ? data[table.collection] : [];
  const cols = table.columns.map((c) => c.column);
  if (!rows.length) {
    chunks.push(`-- ${table.table}: 0 rows`);
    continue;
  }
  const pk = table.columns.find((c) => c.field === table.pk).column;
  const values = rows.map((row) => {
    const cells = table.columns.map((c) => lit(row[c.field], c.type));
    cells.push(lit(WORKSPACE, "text"));
    return `  (${cells.join(", ")})`;
  });
  const updates = table.columns
    .map((c) => c.column)
    .filter((c) => c !== pk)
    .map((c) => `${c} = excluded.${c}`)
    .concat("updated_at = now()");
  chunks.push(
    `-- ${table.table}: ${rows.length} rows`,
    `insert into ${table.table} (${[...cols, "workspace_id"].join(", ")})`,
    `values\n${values.join(",\n")}`,
    `on conflict (${pk}) do update set`,
    `  ${updates.join(",\n")};`,
    "",
  );
  total += rows.length;
}

// device counters live in app_meta
chunks.push(
  `-- app_meta: 1 row`,
  `insert into ${schema.metaTable} (id, data, workspace_id)`,
  `values (${lit("app", "text")}, ${lit(data.meta ?? {}, "jsonb")}::jsonb, ${lit(WORKSPACE, "text")})`,
  `on conflict (id) do update set data = excluded.data, updated_at = now();`,
  "",
  `-- sanity: expect the same row counts as the app screens show`,
  schema.tables
    .map((t) => `--   select count(*) from ${t.table};`)
    .join("\n"),
  "commit;",
  "",
);

const out = path.join(root, "supabase/import.sql");
await writeFile(out, chunks.join("\n"));
console.log(`wrote supabase/import.sql (${total} rows across ${schema.tables.length} tables)`);
