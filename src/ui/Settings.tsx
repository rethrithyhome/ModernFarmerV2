import { useRef, useState } from "react";
import type { DbShape } from "../lib/types";
import { clearData, exportJson, importJson, resetSeed, setOperator } from "../lib/store";
import { activeLots, closedLots, stockOf } from "../lib/engine";
import { customersCsv, dispatchCsv, lotsCsv, stockCsv } from "../lib/csv";
import { download, readPrefs, writePrefs } from "../lib/prefs";
import { dateKh, int, todayISO } from "../lib/format";
import { Button, Choice, Field, Panel, Table, Tag, Text } from "./kit";
import { DatasetChoice } from "./FirstRun";
import { CloudSettings } from "./CloudPanel";

export function Settings({ db }: { db: DbShape }) {
  const [json, setJson] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<"reset" | "clear" | null>(null);
  const [exportedAt, setExportedAt] = useState<string | undefined>(() => readPrefs().lastExportAt);
  const fileRef = useRef<HTMLInputElement>(null);
  const [business, setBusiness] = useState(() => readPrefs().business);

  const save = (name: string, text: string, mime: string) => {
    download(name, text, mime);
    const prefs = readPrefs();
    prefs.lastExportAt = new Date().toISOString();
    writePrefs(prefs);
    setExportedAt(prefs.lastExportAt);
  };

  const exportAll = () => save(`dijii-compost-${todayISO()}.json`, exportJson(), "application/json");

  return (
    <div className="stack">
      <Panel
        title="អត្តសញ្ញាណរបស់អ្នកលក់ (សម្រាប់វិក្កយបត្រ)"
        hint="ឈ្មោះ លេខទូរស័ព្ទ និងអាសយដ្ឋានរបស់អ្នកនឹងចេញលើវិក្កយបត្របោះពុម្ព"
      >
        <div className="form-grid">
          <Field label="ឈ្មោះសហគមន៍/រោងចក្រ" wide>
            <Text
              value={business.name}
              onChange={(v) => {
                const next = { ...business, name: v };
                setBusiness(next);
                writePrefs({ ...readPrefs(), business: next });
              }}
            />
          </Field>
          <Field label="ទូរស័ព្ទ">
            <Text
              value={business.phone ?? ""}
              onChange={(v) => {
                const next = { ...business, phone: v };
                setBusiness(next);
                writePrefs({ ...readPrefs(), business: next });
              }}
            />
          </Field>
          <Field label="អាសយដ្ឋាន">
            <Text
              value={business.address ?? ""}
              onChange={(v) => {
                const next = { ...business, address: v };
                setBusiness(next);
                writePrefs({ ...readPrefs(), business: next });
              }}
            />
          </Field>
          <Field label="បន្ទាត់បង់ប្រាក់" hint="ឧ. លេខគណនី ABA / ABAACLEK" wide>
            <Text
              value={business.paymentNote ?? ""}
              onChange={(v) => {
                const next = { ...business, paymentNote: v };
                setBusiness(next);
                writePrefs({ ...readPrefs(), business: next });
              }}
            />
          </Field>
        </div>
      </Panel>

      <CloudSettings />

      <Panel title="អ្នកប្រើប្រាស់ និងឧបករណ៍" hint="ឈ្មោះនេះនឹងត្រូវកត់ជា «អ្នកទទួលខុសត្រូវ» ពេលកត់ស្តុក ឬបើក Lot">
        <div className="form-grid">
          <Field label="ឈ្មោះអ្នកកត់ត្រា" wide>
            <Text value={db.meta.operator} onChange={setOperator} placeholder="ឧ. សុខ ដារ៉ា" />
          </Field>
        </div>
        <p className="panel-hint" style={{ marginTop: "0.8rem" }}>
          បច្ចុប្បន្នទិន្នន័យរស់នៅក្នុងកម្មវិធីគេហទំព័រនេះ (localStorage) លើឧបករណ៍នេះ។ ដើម្បីប្តូរទៅទូរស័ព្ទ
          ឬកុំព្យូទ័រមួយទៀត៖ ចុច «ទាញយក JSON» នៅខាងក្រោម រួច «បញ្ចូល JSON» លើឧបករណ៍ថ្មី។
        </p>
      </Panel>

      <Panel title="ទាញយកទិន្នន័យ" hint="ឯកសារតែមួយមានគ្រប់តារាង — សម្រាប់រក្សាទុកមុនផ្លាស់ប្តូរឧបករណ៍">
        <div className="row-actions">
          <Button variant="primary" onClick={exportAll}>
            ទាញយក JSON
          </Button>
          <Button
            onClick={() => {
              const text = exportJson();
              setJson(text);
              navigator.clipboard?.writeText(text).catch(() => undefined);
            }}
            title="ចម្លងជួយផ្ញើរតាមចត ប៉ុន្តែមិនរាប់ជាបម្រុងទុកទេ"
          >
            ចម្លងទាំងអស់
          </Button>
          <span className="tag" style={{ alignSelf: "center" }}>
            {exportedAt
              ? `បម្រុងទុកចុងក្រោយ ${dateKh(exportedAt.slice(0, 10))}`
              : "⚠ មិនទាន់បម្រុងទុក — ទិន្នន័យមានតែលើឧបករណ៍នេះ"}
          </span>
        </div>
        {json && (
          <>
            <textarea
              className="input"
              rows={7}
              readOnly
              value={json}
              style={{ marginTop: "0.8rem", fontFamily: "ui-monospace, monospace", fontSize: "0.74rem" }}
              onFocus={(e) => e.currentTarget.select()}
            />
            <p className="panel-hint">{int(json.length)} តួអក្សរ — ប្រើ «តម្កល់» ដើម្បីបិទបង្ហាញ។</p>
          </>
        )}
      </Panel>

      <Panel title="បញ្ចូលទិន្នន័យ" hint="ការបញ្ចូលនឹងលុបទិន្នន័យបច្ចុប្បន្ន ហើយជំនួសដោយឯកសារ JSON">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const result = importJson(await file.text());
            setMessage(result);
            e.target.value = "";
          }}
        />
        <div className="row-actions">
          <Button onClick={() => fileRef.current?.click()}>ជ្រើសឯកសារ JSON</Button>
        </div>
        <Field label="ឬទម្លាក់ JSON ជាអក្សរនៅទីនេះ" wide>
          <textarea
            className="input"
            rows={5}
            value={json}
            placeholder='{"version":1,"materials":[ … ]}'
            onChange={(e) => setJson(e.target.value)}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.74rem" }}
          />
        </Field>
        <div className="row-actions">
          <Button
            variant="primary"
            disabled={!json.trim()}
            onClick={() => setMessage(importJson(json))}
          >
            បញ្ចូលពីប្រអប់អក្សរ
          </Button>
        </div>
        {message && (
          <p className="note-box" style={{ marginTop: "0.8rem", color: message.ok ? "var(--moss)" : "var(--clay)" }}>
            {message.text}
          </p>
        )}
      </Panel>

      <Panel title="ទិន្នន័យគំរូ និងការសម្អាត" hint="ប្រើ «ទិន្នន័យគំរូ» សម្រាប់សាកល្បង ឬបង្ហាញរបៀបធ្វើការ">
        <Table head={["ចំនួនកត់ត្រា", "សារពើ"]} dense>
          <tr>
            <td>វត្ថុធាតុដើម</td>
            <td className="n">{int(db.materials.length)}</td>
          </tr>
          <tr>
            <td>ចលនាស្តុក</td>
            <td className="n">{int(db.materialMovements.length)}</td>
          </tr>
          <tr>
            <td>រូបមន្ត</td>
            <td className="n">{int(db.recipes.length)}</td>
          </tr>
          <tr>
            <td>Lot (កំពុង/បញ្ចប់)</td>
            <td className="n">
              {int(activeLots(db).length)} / {int(closedLots(db).length)}
            </td>
          </tr>
          <tr>
            <td>ការវាស់សង្កេត + តេស្តគុណភាព</td>
            <td className="n">{int(db.processLogs.length + db.qcTests.length)}</td>
          </tr>
          <tr>
            <td>មុខផលិតផល + ចលនាផលិតផល</td>
            <td className="n">{int(db.products.length + db.productMovements.length)}</td>
          </tr>
          <tr>
            <td>អតិថិជន</td>
            <td className="n">{int(db.customers.length)}</td>
          </tr>
          <tr>
            <td>គម្រោងផលិតកម្មប្រចាំខែ</td>
            <td className="n">{int(db.plans.length)}</td>
          </tr>
        </Table>
        <div className="row-actions" style={{ marginTop: "0.9rem" }}>
          {confirm === null ? (
            <>
              <Button onClick={() => setConfirm("reset")}>ផ្ទុកទិន្នន័យគំរូ</Button>
              <Button variant="danger" onClick={() => setConfirm("clear")}>
                សម្អាតទិន្នន័យទាំងអស់
              </Button>
            </>
          ) : (
            <>
              <p className="panel-hint">
                {confirm === "reset"
                  ? "បន្ទាប់មន្តទៅនឹងទិន្នន័យគំរូ 7 ខែ — ទិន្នន័យបច្ចុប្បន្ននឹងបាត់។"
                  : "បន្ទាប់មន្តទទេ — គ្រប់ Lot ស្តុក និងរបាយការណ៍ត្រូវលុច។"}
              </p>
              <Button
                variant={confirm === "clear" ? "danger" : "primary"}
                onClick={() => {
                  if (confirm === "reset") resetSeed();
                  else clearData();
                  setConfirm(null);
                  setMessage({
                    ok: true,
                    text: confirm === "reset" ? "បានផ្ទុកទិន្នន័យគំរូម្តងទៀត" : "បានសម្អាតទិន្នន័យទាំងអស់",
                  });
                }}
              >
                បញ្ជាក់
              </Button>
              <Button onClick={() => setConfirm(null)}>បោះបង់</Button>
            </>
          )}
        </div>
      </Panel>

      <Panel title="របៀបប្រើឱ្យមានប្រសិទ្ធភាព" hint="លំដាប់ការងារប្រចាំថ្ងៃនៅទីតាំងផលិត">
        <ol className="checks" style={{ paddingInlineStart: "1.1rem" }}>
          <li>
            <span>ពេលទិញវត្ថុធាតុចូល</span>
            <span>ស្តុកវត្ថុធាតុ → ទិញចូល (បញ្ចូលថ្លៃពិត ដើម្បីឱ្យតម្លៃដើមត្រូវ)</span>
          </li>
          <li>
            <span>មុនចាក់ផ្សំ</span>
            <span>រូបមន្ត → រក្សាទុកសមាមាត្រ និងដែនកំណត់ QC របស់រូបមន្តនោះ</span>
          </li>
          <li>
            <span>ថ្ងៃបើក Lot</span>
            <span>Lot → បើក Lot ថ្មី (ប្រព័ន្ធកាត់ស្តុកស្វ័យប្រវត្តិ ប្រសិនបើគ្រប់)</span>
          </li>
          <li>
            <span>រៀងរាល់ ២–៣ ថ្ងៃ</span>
            <span>បើក Lot → កត់សង្កេត (កំដៅ សំណើម pH ការកូរ)</span>
          </li>
          <li>
            <span>មុនច្រោះ និងខ្ចប់</span>
            <span>បញ្ចូលលទ្ធផលវិភាគ — ប្រព័ន្ធសម្រេច «ជាប់/ចាញ់» តាមស្តង់ដារ</span>
          </li>
          <li>
            <span>ពេលបញ្ចប់</span>
            <span>បញ្ជាក់ទម្ងន់ជាក់ស្តែង → ស្តុកផលិតផលច្បាស់ ហើយថ្លៃដើម/គ.ក ចេញភ្លាម</span>
          </li>
          <li>
            <span>ចុងសប្តាហ៍</span>
            <span>របាយការណ៍ → មើល lot ដែលថ្លៃជាងគេ ហើយទាញយក JSON ទុក</span>
          </li>
        </ol>
        <p className="panel-hint" style={{ marginTop: "0.8rem" }}>
          សរុបស្តុកវត្ថុធាតុដើមបច្ចុប្បន្ន៖{" "}
          {db.materials
            .filter((m) => !m.archived)
            .slice(0, 4)
            .map((m) => `${m.name} ${int(stockOf(db, m.id))} ${m.unit}`)
            .join(" · ")}
          {" … "}
        </p>
      </Panel>
    </div>
  );
}
