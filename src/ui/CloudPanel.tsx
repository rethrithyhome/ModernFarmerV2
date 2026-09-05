import { useState } from "react";
import { readCloudConfig, type CloudConfig } from "../lib/cloud";
import { flush, pullFromCloud, setupCloud, useSyncState } from "../lib/sync";
import { getDb } from "../lib/store";
import { rowCount as rowsCountOf } from "../lib/syncPlan";
import { Button, Field, Panel, Stat, Tag, Text } from "./kit";
import { dateKh, int, num } from "../lib/format";

const STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  idle: { label: "Sync រួច", tone: "good" },
  pending: { label: "រង់ចាំ Sync", tone: "warn" },
  syncing: { label: "កំពុង Sync", tone: "warn" },
  error: { label: "មានកំហុស", tone: "bad" },
  offline: { label: "គ្មានអ៊ីនធឺណិត", tone: "warn" },
};

const rowsInDevice = () => rowsCountOf(getDb());

/** Optional Supabase sync. Leave it unset and the app stays device-only. */
export function CloudSettings() {
  const stored = readCloudConfig();
  const [url, setUrl] = useState(stored?.url ?? "");
  const [key, setKey] = useState(stored?.anonKey ?? "");
  const [workspace, setWorkspace] = useState(stored?.workspace ?? "plant-01");
  const [message, setMessage] = useState("");
  const sync = useSyncState();
  const rowCountSafe = () => rowsInDevice();

  const connect = async (next: CloudConfig | null) => {
    if (!next) {
      await setupCloud(null);
      setMessage("បានបិទ Sync — ទិន្នន័យនៅរក្សាទុកតែក្នុងឧបករណ៍នេះ។");
      return;
    }
    setMessage("កំពុងភ្ជាប់…");
    const result = await setupCloud(next);
    const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
    setMessage(
      result.message
        ? `មិនអាចភ្ជាប់បានទេ៖ ${result.message} — សូម run supabase/schema.sql ហើយពិនិត្យ URL/key`
        : result.adopted === "device"
          ? `ភ្ជាប់រួច · បានផ្ញើ ${int(rowCountSafe())} ជួរដេកឡើង Supabase (workspace ទទេ)`
          : `ភ្ជាប់រួច · បានទាញយក ${int(total)} ជួរដេកពី Supabase`,
    );
  };

  return (
    <Panel
      title="Sync ជាមួយ Supabase"
      hint="ដាក់ Project URL និង anon key របស់ Supabase ដើម្បីឱ្យគ្រប់ឧបករណ៍ឃើញទិន្នន័យតែមួយ"
      action={
        <Tag tone={sync.mode === "cloud" ? (STATUS[sync.status]?.tone ?? "neutral") : "neutral"}>
          {sync.mode === "cloud" ? STATUS[sync.status]?.label ?? sync.status : "រក្សាក្នុងឧបករណ៍"}
        </Tag>
      }
    >
      <div className="form-grid">
        <Field label="Supabase URL" wide hint="Supabase → Project Settings → API → Project URL">
          <Text value={url} onChange={setUrl} placeholder="https://xxxx.supabase.co" />
        </Field>
        <Field label="Anon public key" wide hint="Project Settings → API → Project API keys (anon)">
          <Text value={key} onChange={setKey} placeholder="eyJhbGci…" />
        </Field>
        <Field label="Workspace id" hint="ត្រូវតែដូចនឹងតម្លៃក្នុង supabase/schema.sql">
          <Text value={workspace} onChange={setWorkspace} placeholder="plant-01" />
        </Field>
      </div>
      <div className="row-actions" style={{ marginTop: "0.8rem" }}>
        <Button
          variant="primary"
          onClick={() => {
            const trimmed = url.trim().replace(/\/+$/, "");
            if (!trimmed || key.trim().length < 20) {
              setMessage("ត្រូវបញ្ចូលទាំង URL និង anon key ជាមុនសិន។");
              return;
            }
            void connect({ url: trimmed, anonKey: key.trim(), workspace: workspace.trim() || "plant-01" });
          }}
        >
          រក្សាទុក ហើយភ្ជាប់
        </Button>
        <Button
          onClick={() =>
            void pullFromCloud().then((r) =>
              setMessage(r.ok ? "បានទាញយកទិន្នន័យពី Supabase" : `ទាញយកមិនបាន៖ ${r.message ?? "កំហុស"}`),
            )
          }
        >
          ទាញយកពី Supabase
        </Button>
        <Button
          onClick={() =>
            void flush(getDb()).then(() => setMessage("បានផ្ញើការដែលកែថ្មីទៅ Supabase"))
          }
        >
          ផ្ញើទៅ Supabase
        </Button>
        {sync.mode === "cloud" && (
          <Button
            variant="danger"
            onClick={() => {
              setUrl("");
              setKey("");
              connect(null);
            }}
          >
            បិទ Sync
          </Button>
        )}
      </div>
      {(sync.notice || message) && (
        <p className="note-box" style={{ marginTop: "0.8rem", color: sync.notice ? "var(--clay)" : undefined }}>
          {sync.notice ?? message}
        </p>
      )}
      {sync.mode === "cloud" && (
        <div className="grid-stats" style={{ marginTop: "0.9rem" }}>
          <Stat
            label="ការផ្លាស់ប្តូររង់ចាំ"
            value={int(sync.pending)}
            unit="ជួរដេក"
            tone={sync.pending ? "warn" : "good"}
          />
          <Stat
            label="Sync ចុងក្រោយ"
            value={sync.lastSyncedAt ? dateKh(sync.lastSyncedAt.slice(0, 10)) : "—"}
            note={sync.workspace ? `workspace · ${sync.workspace}` : ""}
          />
          <Stat label="ទិន្នន័យក្នុងឧបករណ៍" value={num(rowsInDevice(), 0)} unit="ជួរដេក" />
        </div>
      )}
      <p className="panel-hint" style={{ marginTop: "0.7rem" }}>
        ចំណាំសុវត្ថិភាព៖ anon key ធ្វើការជាមួយ Row Level Security ដែលទាមទារ `workspace_id` ដូចគ្នា។
        ប្រសិនបើអ្នកចែករំលែក URL + key ឱ្យអ្នកដទៃ ពួកគេអាចអាន និងសរសេរក្នុង workspace ដូចគ្នា —
        សម្រាប់ការគ្រប់គ្រងច្រើនរោងចក្រ សូមបន្ថែម Supabase Auth រួចកែ policy ពី `to anon` ទៅ
        `to authenticated`។
      </p>
    </Panel>
  );
}

/** Tiny rail indicator: a stalled queue must be visible from any screen. */
export function CloudBadge() {
  const sync = useSyncState();
  if (sync.mode !== "cloud") return null;
  const tone = sync.status === "idle" ? "good" : sync.status === "error" ? "bad" : "warn";
  const text =
    sync.status === "syncing"
      ? "កំពុង Sync…"
      : sync.pending > 0
        ? `រង់ចាំ ${int(sync.pending)}`
        : sync.status === "idle"
          ? "Sync ✓"
          : "Sync កំហុស";
  return <span className={`tag tag--${tone}`}>{text}</span>;
}
