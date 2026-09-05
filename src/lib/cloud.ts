/**
 * Types + row mapping for the Supabase backend, driven by cloud/schema.json (the same
 * file scripts/gen-sql.mjs builds the SQL from).  Nothing here is hand-copied, so a
 * column rename in the JSON moves both the SQL and the client.
 */
import { schema as schemaJson } from "./schema.generated.ts";
import type { ColumnDef, TableDef } from "./schemaTypes";
import { validSession } from "./auth.ts";

export type { ColumnDef, TableDef };

export const SCHEMA = schemaJson as unknown as {
  workspaceColumn: string;
  metaTable: string;
  metaId: string;
  tables: TableDef[];
};

export const TABLES = SCHEMA.tables;
export const WORKSPACE_COLUMN = SCHEMA.workspaceColumn;

export type CloudConfig = {
  url: string;
  anonKey: string;
  workspace: string;
};

const CONFIG_KEY = "dijii.cloud.v1";
const SNAPSHOT_KEY = "dijii.cloud.snapshot.v1";

/** Build-time values are optional; runtime (Settings) values win. */
function envConfig(): Partial<CloudConfig> {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    workspace: env.VITE_SUPABASE_WORKSPACE,
  };
}

export function readCloudConfig(): CloudConfig | null {
  const stored = readJson<Partial<CloudConfig>>(CONFIG_KEY, {});
  const env = envConfig();
  const url = stored.url?.trim() || env.url?.trim() || "";
  const anonKey = stored.anonKey?.trim() || env.anonKey?.trim() || "";
  const workspace = (stored.workspace?.trim() || env.workspace?.trim() || "plant-01").trim();
  if (!/^https?:\/\//.test(url)) return null;
  if (url.length < 12 || anonKey.length < 20) return null;
  return { url: url.replace(/\/+$/, ""), anonKey, workspace };
}

export function saveCloudConfig(next: CloudConfig | null) {
  if (next) writeJson(CONFIG_KEY, next);
  else localStorage.removeItem(CONFIG_KEY);
}

export const cloudConfigured = () => readCloudConfig() !== null;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: sync keeps working from memory for this session */
  }
}

/* ------------------------------- row mapping ------------------------------- */

const isJson = (t: string) => t === "jsonb";

/** App object → database row (snake_case columns + workspace scope). */
export function toRow(table: TableDef, obj: Record<string, unknown>, workspace: string) {
  const row: Record<string, unknown> = { [WORKSPACE_COLUMN]: workspace };
  table.columns.forEach((c) => {
    const value = obj[c.field];
    if (value === undefined || value === null) {
      if (!c.nullable) row[c.column] = c.type === "boolean" ? false : c.type === "text" ? "" : null;
      else row[c.column] = null;
      return;
    }
    row[c.column] = isJson(c.type) ? value : value;
  });
  return row;
}

/** Database row → app object; unknown columns are ignored on purpose. */
export function fromRow<T = Record<string, unknown>>(table: TableDef, row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  table.columns.forEach((c) => {
    const value = row[c.column];
    if (value === null || value === undefined) {
      if (c.type === "boolean" && !c.nullable) out[c.field] = false;
      return;
    }
    out[c.field] = value;
  });
  return out as T;
}

export const tableOf = (collection: string) => TABLES.find((t) => t.collection === collection);

export const collectionNames = () => TABLES.map((t) => t.collection);

/* -------------------------------- snapshots ------------------------------- */

export const readSnapshot = <T,>(): T | null => readJson<T | null>(SNAPSHOT_KEY, null);
export const writeSnapshot = (state: unknown) => writeJson(SNAPSHOT_KEY, state);
export const clearSnapshot = () => localStorage.removeItem(SNAPSHOT_KEY);

/* ---------------------------------- REST ---------------------------------- */

const rest = (cfg: CloudConfig, table: string) => `${cfg.url}/rest/v1/${table}`;

async function request<T>(cfg: CloudConfig, path: string, init: RequestInit): Promise<T> {
  const session = await validSession(cfg);
  const response = await fetch(path, {
    ...init,
    headers: {
      apikey: cfg.anonKey,
      Authorization: `Bearer ${session?.access_token ?? cfg.anonKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new CloudError(response.status, safeReason(detail));
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Never leak a server body (it can echo the key) into the UI. */
function safeReason(detail: string) {
  const match = /"message"\s*:\s*"([^"]{0,180})"/.exec(detail);
  return match?.[1] ?? "HTTP error";
}

export class CloudError extends Error {
  code: string;
  status: number;
  constructor(status: number, reason: string) {
    super(reason.slice(0, 180));
    this.status = status;
    this.code = status === 401 || status === 403 ? "denied" : status >= 500 ? "unavailable" : "bad-request";
  }
}

export const orderParam = (table: TableDef) =>
  table.orderBy
    .split(",")
    .map((part) => {
      const [col, dir] = part.trim().split(/\s+/);
      return `order=${col}.${dir === "desc" ? "desc" : "asc"}.nullslast`;
    })
    .join("&");

/** Read a whole table for this workspace. */
export async function pullTable(cfg: CloudConfig, table: TableDef): Promise<Record<string, unknown>[]> {
  const url = `${rest(cfg, table.table)}?select=*&${orderParam(table)}&${WORKSPACE_COLUMN}=eq.${encodeURIComponent(
    cfg.workspace,
  )}`;
  const rows = await request<Record<string, unknown>[]>(cfg, url, { method: "GET", headers: { Accept: "application/json" } });
  return Array.isArray(rows) ? rows : [];
}

export async function pullAll(cfg: CloudConfig) {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES) {
    out[table.collection] = await pullTable(cfg, table);
  }
  out.__meta = await pullTable(
    cfg,
    {
      table: SCHEMA.metaTable,
      collection: "__meta",
      pk: "id",
      orderBy: "id",
      columns: [{ field: "data", column: "data", type: "jsonb" }],
    },
  );
  return out;
}

export type Ops = {
  upserts: { table: TableDef; rows: Record<string, unknown>[] }[];
  deletes: { table: TableDef; ids: string[] }[];
  meta?: Record<string, unknown>;
};

export async function pushOps(cfg: CloudConfig, ops: Ops) {
  for (const { table, rows } of ops.upserts) {
    if (!rows.length) continue;
    const pk = table.columns.find((c) => c.field === table.pk)!.column;
    await request(cfg, `${rest(cfg, table.table)}?on_conflict=${pk}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates, return=minimal" },
      body: JSON.stringify(rows),
    });
  }
  for (const { table, ids } of ops.deletes) {
    if (!ids.length) continue;
    const pk = table.columns.find((c) => c.field === table.pk)!.column;
    await request(cfg, `${rest(cfg, table.table)}?${pk}=in.(${ids.map(quote).join(",")})`, {
      method: "DELETE",
    });
  }
  if (ops.meta) {
    await request(cfg, `${rest(cfg, SCHEMA.metaTable)}?on_conflict=id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates, return=minimal" },
      body: JSON.stringify([ops.meta]),
    });
  }
}

const quote = (id: string) => `%22${String(id).replace(/"/g, "")}%22`;
