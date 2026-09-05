#!/usr/bin/env node
/**
 * A 200-line stand-in for Supabase's PostgREST, for `npm run db:local`.
 * It answers the handful of shapes this app uses (GET select/order/eq, POST upsert with
 * on_conflict, DELETE id=in.(...)) and keeps rows in ./.data/fake-db.json, so you can
 * develop and test the cloud path without a Supabase project.
 *
 *   node scripts/fake-postgrest.mjs            # http://127.0.0.1:54321
 *   Then in the app Settings → Cloud, use:
 *     URL  http://127.0.0.1:54321     key  fake-anon-key-for-local-testing-0123456789
 */
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".data");
const dbFile = path.join(dataDir, "fake-db.json");
const PORT = Number(process.env.FAKE_DB_PORT || 54321);

const schema = JSON.parse(await readFile(path.join(root, "cloud/schema.json"), "utf8"));
const tables = new Set([...schema.tables.map((t) => t.table), schema.metaTable]);

let db = { tables: {} };
try {
  db = JSON.parse(await readFile(dbFile, "utf8"));
} catch {
  for (const t of tables) db.tables[t] = db.tables[t] ?? [];
}
const ensure = (t) => (db.tables[t] ??= []);
const save = async () => {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbFile, JSON.stringify(db, null, 2));
};

const pkOf = (table) => {
  if (table === schema.metaTable) return "id";
  const def = schema.tables.find((t) => t.table === table);
  return def ? def.columns.find((c) => c.field === def.pk).column : "id";
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : []);
      } catch {
        resolve([]);
      }
    });
  });
}

const send = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (url.pathname === "/") return send(res, 200, { ok: true, fake: "postgrest", tables: [...tables] });

  // Fake auth: local-only testing, so any email/password combo signs in — this mock never
  // talks to a real Supabase project, there is nothing here worth actually protecting.
  if (url.pathname === "/auth/v1/token" && req.method === "POST") {
    const body = await readBody(req);
    const email = (Array.isArray(body) ? body[0]?.email : body.email) ?? "local@test.dev";
    return send(res, 200, {
      access_token: "fake-access-token." + Date.now(),
      refresh_token: "fake-refresh-token." + Date.now(),
      expires_in: 3600,
      user: { id: "fake-user-local", email },
    });
  }

  // Fake profiles: local-only testing has no real multi-user concept, so any lookup
  // resolves as admin (full access) rather than blocking on the "no role assigned" screen.
  if (url.pathname === "/rest/v1/profiles" && (req.method === "GET" || req.method === "HEAD")) {
    return send(res, 200, [{ role: "admin" }]);
  }

  const match = /^\/rest\/v1\/([A-Za-z0-9_]+)$/.exec(url.pathname);
  if (!match) return send(res, 404, { message: "not found" });
  const table = match[1];
  if (!tables.has(table)) return send(res, 404, { message: `relation "${table}" does not exist` });
  const rows = ensure(table);
  const pk = pkOf(table);
  const params = url.searchParams;
  const wsFilter = params.get("workspace_id");

  if (req.method === "GET" || req.method === "HEAD") {
    let out = rows;
    for (const [key, value] of params) {
      if (!key.endsWith(".eq") || key === "select" || key === "limit" || key === "offset") continue;
      const col = key.slice(0, -3);
      out = out.filter((r) => String(r[col] ?? "") === decodeURIComponent(value));
    }
    if (wsFilter) out = out.filter((r) => String(r.workspace_id ?? "") === decodeURIComponent(wsFilter.replace(/^eq\./, "")));
    const limit = Number(params.get("limit"));
    if (Number.isFinite(limit) && limit > 0) out = out.slice(0, limit);
    return send(res, 200, out);
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const incoming = Array.isArray(body) ? body : [body];
    for (const row of incoming) {
      const at = rows.findIndex((r) => String(r[pk]) === String(row[pk]));
      if (at >= 0) rows[at] = { ...rows[at], ...row };
      else rows.push(row);
    }
    await save();
    const prefer = req.headers.prefer ?? "";
    const wantBody = /return=representation/.test(prefer);
    return send(res, wantBody ? 201 : 201, wantBody ? incoming : "");
  }

  if (req.method === "PATCH") {
    const patch = await readBody(req);
    let count = 0;
    rows.forEach((row, i) => {
      let hit = true;
      for (const [key, value] of params) {
        if (!key.endsWith(".eq")) continue;
        if (String(row[key.slice(0, -3)] ?? "") !== decodeURIComponent(value)) hit = false;
      }
      if (!hit) return;
      rows[i] = { ...row, ...patch };
      count += 1;
    });
    await save();
    return send(res, 200, { updated: count });
  }

  if (req.method === "DELETE") {
    const inList = params.get(`${pk}=in`) ?? params.get(`${pk}.in`);
    const ids = inList
      ? inList
          .replace(/^\(/, "")
          .replace(/\)$/, "")
          .split(",")
          .map((v) => decodeURIComponent(v).replace(/^"|"$/g, ""))
      : null;
    const kept = rows.filter((row) => {
      if (ids && !ids.includes(String(row[pk]))) return true;
      for (const [key, value] of params) {
        if (!key.endsWith(".eq")) continue;
        if (String(row[key.slice(0, -3)] ?? "") !== decodeURIComponent(value)) return true;
      }
      return false;
    });
    const removed = rows.length - kept.length;
    db.tables[table] = kept;
    await save();
    return send(res, 200, { deleted: removed });
  }

  return send(res, 405, { message: "method not allowed" });
});

await mkdir(dataDir, { recursive: true });
server.listen(PORT, "127.0.0.1", () => {
  console.log(`fake PostgREST on http://127.0.0.1:${PORT} (${tables.size} tables)`);
  console.log("reset it: rm -rf .data");
});
