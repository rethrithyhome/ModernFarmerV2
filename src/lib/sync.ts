/**
 * Cloud sync = offline-first.  Every mutation lands in localStorage immediately (that is
 * what the UI renders from), then the diff against the last pushed snapshot is written to
 * Supabase in the background.  Losing the network, or Supabase, never loses an edit: the
 * queue keeps its pending count and retries on the next change, on focus, or on demand.
 */
import { useCallback, useEffect, useState } from "react";
import type { DbShape } from "./types";
import {
  CloudError,
  TABLES,
  cloudConfigured,
  pullAll,
  pushOps,
  readCloudConfig,
  readSnapshot,
  saveCloudConfig,
  writeSnapshot,
  type CloudConfig,
} from "./cloud";
import { assembleState, asRecords, planOps, rowCount, type Ops } from "./syncPlan";

export type SyncState = {
  mode: "local" | "cloud";
  status: "idle" | "pending" | "syncing" | "error" | "offline";
  pending: number;
  lastSyncedAt?: string;
  /** Something the operator must read: permission denied, missing tables, etc. */
  notice?: string;
  workspace?: string;
};

let state: SyncState = {
  mode: cloudConfigured() ? "cloud" : "local",
  status: "idle",
  pending: 0,
  workspace: readCloudConfig()?.workspace,
};
const listeners = new Set<() => void>();
let previous: DbShape | null = null;
let timer: number | undefined;
let flying = false;
let queued = false;

const emit = () => listeners.forEach((fn) => fn());
const setState = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  emit();
};

export const getSyncState = () => state;

export function subscribeSync(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSyncState(): SyncState {
  const read = useCallback(() => getSyncState(), []);
  const [, force] = useState(0);
  useEffect(() => {
    const off = subscribeSync(() => force((n) => n + 1));
    return () => {
      off();
    };
  }, []);
  void read;
  return getSyncState();
}

/** Called by the store after every committed mutation. */
export function notifyStoreChanged(next: DbShape) {
  if (state.mode !== "cloud") return;
  if (!previous) {
    // first change after boot: only send what the device holds that the cloud lacks
    previous = readSnapshot<DbShape>() ?? emptyShapeOf(next);
  }
  const ops = planOps(previous, next, state.workspace);
  const count =
    ops.upserts.reduce((s, u) => s + u.rows.length, 0) +
    ops.deletes.reduce((s, d) => s + d.ids.length, 0) +
    (ops.meta ? 1 : 0);
  setState({ pending: count, status: count ? "pending" : "idle", notice: undefined });
  schedule(next);
}

function emptyShapeOf(base: DbShape): DbShape {
  const clone = structuredClone(base);
  TABLES.forEach((t) => {
    (clone as unknown as Record<string, unknown>)[t.collection] = [];
  });
  clone.meta = { lotSeq: 0, operator: "", seeded: false };
  return clone;
}

function schedule(next: DbShape) {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => void flush(next), 700);
}

export async function flush(next?: DbShape) {
  const cfg = readCloudConfig();
  if (!cfg) {
    setState({ mode: "local" });
    return;
  }
  if (flying) {
    queued = true;
    return;
  }
  const store = next ?? readLiveState();
  if (!store) return;
  const baseline = previous ?? readSnapshot<DbShape>();
  if (!baseline) return;
  const ops = planOps(baseline, store, cfg.workspace);
  flying = true;
  setState({ status: "syncing", mode: "cloud" });
  try {
    await pushOps(cfg, ops);
    previous = structuredClone(store);
    writeSnapshot(previous);
    setState({
      status: "idle",
      pending: 0,
      lastSyncedAt: new Date().toISOString(),
      notice: undefined,
    });
  } catch (error) {
    setState({
      status: error instanceof CloudError && error.code === "denied" ? "error" : "offline",
      notice:
        error instanceof CloudError && error.code === "denied"
          ? "Supabase បដិសេធ (RLS ឬ key) — ពិនិត្ឃ schema.sql + anon key"
          : "មិនអាចទាក់ទង Supabase បាន — ទិន្នន័យនៅរក្សាទុកក្នុងឧបករណ៍ ហើយប្រព័ន្ធនឹងព្យាយាមម្តងទៀត",
    });
  } finally {
    flying = false;
    if (queued) {
      queued = false;
      schedule(store);
    }
  }
}

/** Read the live app state without importing store.ts (avoids a cycle). */
let liveReader: (() => DbShape) | null = null;
export const bindLiveState = (reader: () => DbShape) => {
  liveReader = reader;
};
const readLiveState = () => (liveReader ? liveReader() : null);

/* ----------------------------- pull / onboarding ---------------------------- */

export type PullSummary = { ok: boolean; counts: Record<string, number>; message?: string };

export { planOps, rowCount, asRecords };

/** Load the cloud workspace into the app. Local state becomes whatever the server holds. */
export async function pullFromCloud(): Promise<PullSummary> {
  const cfg = readCloudConfig();
  if (!cfg) return { ok: false, counts: {}, message: "មិនទាន់បញ្ចូល Supabase URL និង anon key" };
  setState({ mode: "cloud", status: "syncing", notice: undefined });
  try {
    const raw = await pullAll(cfg);
    const pulled: DbShape = {
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
    const state = assembleState(raw, pulled);
    const metaRow = raw.__meta?.[0] as { data?: DbShape["meta"] } | undefined;
    if (metaRow?.data) state.meta = { ...state.meta, ...metaRow.data };
    replaceEverything(state);
    previous = structuredClone(state);
    writeSnapshot(previous);
    const counts = Object.fromEntries(TABLES.map((t) => [t.table, (raw[t.collection] ?? []).length]));
    setState({
      status: "idle",
      pending: 0,
      lastSyncedAt: new Date().toISOString(),
      workspace: cfg.workspace,
    });
    return { ok: true, counts };
  } catch (error) {
    const message =
      error instanceof CloudError
        ? error.code === "denied"
          ? "Supabase បដិសេធ — ពិនិត្យ anon key / RLS / បាន run schema.sql"
          : `Supabase ផ្តល់កំហុស (${error.status})`
        : "មិនអាចទាក់ទង Supabase បានទេ";
    setState({ status: "error", notice: message });
    return { ok: false, counts: {}, message };
  }
}

/** Set by store.ts so sync can install a pulled dataset without a circular import. */
let replaceEverything: (next: DbShape) => void = () => {
  throw new Error("store.bindCloudReplace was not called");
};
export const bindReplace = (fn: (next: DbShape) => void) => {
  replaceEverything = fn;
};

/** Boot entry point: identical rules to setupCloud, using the saved settings. */
export function bootstrapCloud(local: DbShape) {
  void local;
  return setupCloud(readCloudConfig());
}

/**
 * Keep several devices in step: every while (and when the tab regains focus) we re-read the
 * workspace, but only when this device has nothing waiting to be sent.
 */
export function startCloudPolling(intervalMs = 45_000) {
  const tick = () => {
    if (state.mode !== "cloud" || state.pending > 0 || state.status === "syncing") return;
    void pullFromCloud();
  };
  const timer = window.setInterval(tick, intervalMs);
  window.addEventListener("focus", tick);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", tick);
  };
}

/**
 * Connect, then decide who is the source of truth:
 *  - cloud workspace is empty and this device holds data  -> upload this device;
 *  - cloud has rows                                       -> the cloud wins.
 * Pulling explicitly is still available from Settings, so a device can never silently
 * lose work it has not sent yet.
 */
export async function setupCloud(cfg: CloudConfig | null): Promise<{ adopted: "cloud" | "device"; counts: Record<string, number>; message?: string }> {
  connectCloud(cfg);
  if (!cfg) return { adopted: "device", counts: {} };
  const local = readLiveState();
  if (!local) return { adopted: "device", counts: {} };
  const emptyBefore = emptyShapeOf(local);
  const summary = await pullFromCloud();
  if (!summary.ok) {
    return { adopted: "device", counts: summary.counts, message: summary.message };
  }
  const cloudRows = Object.values(summary.counts).reduce((a, b) => a + b, 0);
  if (cloudRows === 0 && rowCount(local) > 0) {
    previous = emptyBefore;
    writeSnapshot(previous);
    // restore what the (empty) pull just cleared, then push it up
    replaceEverything(local);
    await flush(local);
    return { adopted: "device", counts: summary.counts };
  }
  return { adopted: "cloud", counts: summary.counts };
}

export function connectCloud(cfg: CloudConfig | null) {
  saveCloudConfig(cfg);
  setState({
    mode: cfg ? "cloud" : "local",
    workspace: cfg?.workspace,
    status: "idle",
    pending: 0,
    notice: undefined,
  });
  if (!cfg) {
    previous = null;
    localStorage.removeItem("dijii.cloud.snapshot.v1");
  }
}

export const cloudEnabled = () => state.mode === "cloud";
