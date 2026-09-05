import { useState } from "react";
import type { DbShape, Material, MaterialCategory } from "../lib/types";
import { CATEGORY_LABEL, CATEGORY_RANK, REASON_LABEL } from "../lib/types";
import {
  lastPurchaseOf,
  purchaseValueOf,
  stockOf,
  stockValueOf,
  usageOf,
} from "../lib/engine";
import { countStock, newMaterial, stockIn, updateMaterial } from "../lib/store";
import { dateKh, int, money, num, todayISO, unitLabel } from "../lib/format";
import { Button, Choice, Empty, Field, Modal, Num, Panel, Table, Tag, Text, isNum } from "./kit";
import type { Go } from "../lib/nav";

const catTone: Record<MaterialCategory, "good" | "info" | "warn" | "neutral"> = {
  nitrogen: "good",
  carbon: "warn",
  amendment: "info",
  inoculant: "neutral",
  packaging: "neutral",
};

export function Materials({ db, go }: { db: DbShape; go: Go }) {
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Material | "new" | null>(null);
  const [buying, setBuying] = useState<Material | null>(null);
  const [counting, setCounting] = useState<Material | null>(null);
  const [history, setHistory] = useState<Material | null>(null);

  const list = db.materials
    .filter((m) => !m.archived)
    .filter((m) => (filter === "all" ? true : m.category === filter))
    .filter((m) =>
      query.trim()
        ? `${m.name}${m.supplier ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
        : true,
    )
    .sort((a, b) => stockOf(db, a.id) - a.reorderQty - (stockOf(db, b.id) - b.reorderQty));

  const totalValue = db.materials
    .filter((m) => !m.archived)
    .reduce((sum, m) => sum + stockValueOf(db, m.id), 0);

  return (
    <div className="stack">
      <Panel>
        <div className="grid-stats">
          <div className="stat">
            <span className="stat-label">មុខទំនិញសកម្ម</span>
            <span className="stat-value">
              {int(list.length)}
              <em>មុខ</em>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">មូលធនស្តុកបច្ចុប្បន្ន</span>
            <span className="stat-value">
              {int(totalValue / 1000)}
              <em>ពាន់ រៀល</em>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">ទិញចូលសរុប (គ្រប់រដូវ)</span>
            <span className="stat-value">
              {int(purchaseValueOf(db) / 1000)}
              <em>ពាន់ រៀល</em>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">កំពុងត្រូវបញ្ជាទិញ</span>
            <span className="stat-value" style={{ color: "var(--clay)" }}>
              {int(db.materials.filter((m) => !m.archived && stockOf(db, m.id) < m.reorderQty).length)}
              <em>មុខ</em>
            </span>
          </div>
        </div>
      </Panel>

      <Panel
        title="បញ្ជីវត្ថុធាតុដើម"
        hint="រៀងតាមមុខដែលត្រូវបញ្ជាទិញជាមុន · ចុច «ចលនាស្តុក» ដើម្បីមើលប្រវត្តិ"
        action={
          <div className="row-actions">
            <input
              className="input"
              style={{ maxWidth: 180 }}
              placeholder="រកឈ្មោះ ឬអ្នកផ្គត់ផ្គង់"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Choice
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "គ្រប់ប្រភេទ" },
                ...CATEGORY_RANK.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
              ]}
            />
            <Button variant="primary" onClick={() => setEditing("new")}>
              + វត្ថុធាតុដើម
            </Button>
          </div>
        }
      >
        <Table
          head={["វត្ថុធាតុដើម", "ប្រភេទ", "ឯកតា", "ថ្លៃ/ឯកតា", "ស្តុក", "កម្រិតទិញ", "តម្លៃស្តុក", ""]}
          soft={[3, 6, 7]}
        >
          {list.length ? (
            list.map((m) => {
              const qty = stockOf(db, m.id);
              const low = qty < m.reorderQty;
              const last = lastPurchaseOf(db, m.id);
              return (
                <tr key={m.id}>
                  <td>
                    <span className="strong">{m.name}</span>
                    <br />
                    <span className="panel-hint">
                      {m.supplier || "—"} · {dateKh(last?.date ?? m.createdAt)}
                    </span>
                  </td>
                  <td>
                    <Tag tone={catTone[m.category]}>{CATEGORY_LABEL[m.category]}</Tag>
                  </td>
                  <td>{unitLabel(m.unit)}</td>
                  <td className="n">{int(m.costPerUnit)}</td>
                  <td className="n">
                    <span style={{ color: low ? "var(--clay)" : undefined }} className="strong">
                      {num(qty, qty < 100 ? 1 : 0)}
                    </span>
                    {low && <Tag tone="bad">ទាប</Tag>}
                  </td>
                  <td className="n">{int(m.reorderQty)}</td>
                  <td className="n">{int(stockValueOf(db, m.id) / 1000)}k</td>
                  <td>
                    <div className="row-actions">
                      <Button onClick={() => setBuying(m)}>ទិញចូល</Button>
                      <Button variant="quiet" onClick={() => setCounting(m)}>
                        រាប់ស្តុក
                      </Button>
                      <Button variant="quiet" onClick={() => setHistory(m)}>
                        ចលនា
                      </Button>
                      <Button variant="quiet" onClick={() => setEditing(m)}>
                        កែ
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8}>
                <Empty>
                  ចាប់ផ្តើមដោយបន្ថែមវត្ថុធាតុដើម ៣–៥ មុខ (ឧ. ភួយគោ ប្រភេទ N, ស្លឹកស្រូវ ប្រភេទ C)
                  ជាមួយថ្លៃទិញ និងស្តុកដំបូង រួចទើបបង្កើតរូបមន្ត។
                </Empty>
              </td>
            </tr>
          )}
        </Table>
        <p className="panel-hint" style={{ marginTop: "0.8rem" }}>
          ចំណាំ៖ ស្តុកត្រូវបានគណនាពីចលនា (ទិញចូល − ប្រើក្នុង Lot − ខូច/កែស្តុក) ជានិច្ច ដូច្នេះមិនមាន
          «ការកែស្តុក» ដោយផ្ទាល់ទេ។ ចំនួនសរុបដែលបានប្រើ៖{" "}
          {int(db.materials.reduce((s, m) => s + usageOf(db, m.id), 0))} {""}
          ឯកតា ·{" "}
          <button className="btn btn--quiet" onClick={() => go("lots")}>
            មើល Lot ដែលប្រើ
          </button>
        </p>
      </Panel>

      {editing && (
        <MaterialForm
          material={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {buying && <BuyForm material={buying} db={db} onClose={() => setBuying(null)} />}
      {counting && <CountForm material={counting} db={db} onClose={() => setCounting(null)} />}
      {history && <HistoryForm material={history} db={db} onClose={() => setHistory(null)} />}
    </div>
  );
}

function MaterialForm({ material, onClose }: { material?: Material; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Material> & { openingStock?: number }>(
    material ?? {
      category: "carbon",
      unit: "kg",
      costPerUnit: 0,
      reorderQty: 0,
      nPct: 0,
      pPct: 0,
      kPct: 0,
      cnRatio: 0,
      moisturePct: 0,
      openingStock: 0,
    },
  );
  const set = (patch: Partial<Material> & { openingStock?: number }) =>
    setForm((f) => ({ ...f, ...patch }));
  const valid = (form.name ?? "").trim().length > 0;

  return (
    <Modal open title={material ? `កែប្រែ · ${material.name}` : "វត្ថុធាតុដើមថ្មី"} onClose={onClose}>
      <div className="form-grid">
        <Field label="ឈ្មោះវត្ថុធាតុ" wide>
          <Text value={form.name ?? ""} onChange={(v) => set({ name: v })} placeholder="ឧ. ស្លឹកស្រូវ" />
        </Field>
        <Field label="ប្រភេទ">
          <Choice
            value={form.category ?? "carbon"}
            onChange={(v) => set({ category: v as MaterialCategory })}
            options={CATEGORY_RANK.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          />
        </Field>
        <Field label="ឯកតា" hint="kg · តោន · លីត្រ · ថង់">
          <Text value={form.unit ?? "kg"} onChange={(v) => set({ unit: v })} />
        </Field>
        <Field label="ថ្លៃទិញដើម (រៀល/ឯកតា)">
          <Num value={form.costPerUnit} onChange={(v) => set({ costPerUnit: v })} step={50} />
        </Field>
        <Field label="កម្រិតត្រូវបញ្ជាទិញ">
          <Num value={form.reorderQty} onChange={(v) => set({ reorderQty: v })} step={50} />
        </Field>
        <Field label="អាសូត N (%)">
          <Num value={form.nPct} step={0.1} onChange={(v) => set({ nPct: v })} />
        </Field>
        <Field label="P₂O₅ (%)">
          <Num value={form.pPct} step={0.1} onChange={(v) => set({ pPct: v })} />
        </Field>
        <Field label="K₂O (%)">
          <Num value={form.kPct} step={0.1} onChange={(v) => set({ kPct: v })} />
        </Field>
        <Field label="សមាមាត្រ C:N">
          <Num value={form.cnRatio} step={1} onChange={(v) => set({ cnRatio: v })} />
        </Field>
        <Field label="សំណើម (%)">
          <Num value={form.moisturePct} step={1} onChange={(v) => set({ moisturePct: v })} />
        </Field>
        <Field label="អ្នកផ្គត់ផ្គង់">
          <Text value={form.supplier ?? ""} onChange={(v) => set({ supplier: v })} />
        </Field>
        {!material && (
          <Field label="ស្តុកដំបូង (បើមាន)" hint="បង្កើតជាការចលនាបញ្ចូលស្តុក">
            <Num value={form.openingStock} onChange={(v) => set({ openingStock: v })} step={10} />
          </Field>
        )}
        <Field label="កំណត់ហេតុ" wide>
          <Text value={form.note ?? ""} onChange={(v) => set({ note: v })} />
        </Field>
      </div>
      <div className="save-bar">
        <span className="panel-hint">
          {material
            ? "ការប្តូរនេះមិនប៉ះចលនាស្តុកពីមុនទេ"
            : `នឹងបង្កើត ${int(form.openingStock ?? 0)} ${form.unit ?? "kg"} ចូលស្តុក`}
        </span>
        <div className="row-actions">
          <Button onClick={onClose}>បោះបង់</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              if (material) updateMaterial(material.id, form);
              else newMaterial(form);
              onClose();
            }}
          >
            រក្សាទុក
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BuyForm({ material, db, onClose }: { material: Material; db: DbShape; onClose: () => void }) {
  const [qty, setQty] = useState<number>(0);
  const [price, setPrice] = useState<number>(material.costPerUnit);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const ok = isNum(qty) && qty > 0 && isNum(price) && price >= 0;
  return (
    <Modal open title={`ទិញចូល · ${material.name}`} onClose={onClose}>
      <p className="panel-hint">
        ស្តុកបច្ចុប្បន្ន {num(stockOf(db, material.id))} {material.unit}
      </p>
      <div className="form-grid">
        <Field label={`បរិមាណ (${material.unit})`} wide>
          <Num value={qty} onChange={setQty} step={10} />
        </Field>
        <Field label="ថ្លៃជាទិញ (រៀល/ឯកតា)">
          <Num value={price} onChange={setPrice} step={50} />
        </Field>
        <Field label="ថ្ងៃទទួល">
          <Text value={date} onChange={setDate} type="date" />
        </Field>
        <Field label="កំណត់ហេតុ" wide>
          <Text value={note} onChange={setNote} placeholder="លេខវិក្កយបត្រ ឬឈ្មោះឡាន" />
        </Field>
      </div>
      <div className="note-box">
        សរុបជាថវិកា៖ <b>{money((isNum(qty) ? qty : 0) * (isNum(price) ? price : 0))}</b>{" "}
        · ស្តុកបន្ទាប់ពីបញ្ចូល៖ {num((isNum(qty) ? stockOf(db, material.id) + qty : 0))} {material.unit}
      </div>
      <div className="save-bar">
        <span className="panel-hint">បង្កើតជាការចលនា «ទិញចូល»</span>
        <div className="row-actions">
          <Button onClick={onClose}>បោះបង់</Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={() => {
              stockIn(material.id, qty, price, "purchase", date, note || undefined);
              onClose();
            }}
          >
            បញ្ចូលស្តុក
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CountForm({ material, db, onClose }: { material: Material; db: DbShape; onClose: () => void }) {
  const system = stockOf(db, material.id);
  const [counted, setCounted] = useState<number>(system);
  const delta = (isNum(counted) ? counted : 0) - system;
  return (
    <Modal open title={`រាប់ស្តុកពិត · ${material.name}`} onClose={onClose}>
      <div className="form-grid">
        <Field label="តាមប្រព័ន្ធ">
          <input className="input" disabled value={`${num(system)} ${material.unit}`} />
        </Field>
        <Field label={`រាប់ឃើញ (${material.unit})`}>
          <Num value={counted} onChange={setCounted} step={10} />
        </Field>
        <Field label="ថ្ងៃរាប់">
          <Text value={todayISO()} onChange={() => undefined} type="date" />
        </Field>
      </div>
      <p className="note-box">
        ផលសង៖ <b style={{ color: Math.abs(delta) > 0.01 ? "var(--clay)" : "var(--moss)" }}>
          {delta > 0 ? "+" : ""}
          {num(delta)} {material.unit}
        </b>{" "}
        · នឹងកត់ជាការចលនាកែស្តុក (adjust) ដើម្បីរក្សាប្រវត្តិ។
      </p>
      <div className="save-bar">
        <span className="panel-hint">អ្នកកត់ត្រា៖ {db.meta.operator || "បុគ្គលិក"}</span>
        <div className="row-actions">
          <Button onClick={onClose}>បោះបង់</Button>
          <Button
            variant="primary"
            disabled={!isNum(counted) || Math.abs(delta) < 0.01}
            onClick={() => {
              countStock(material.id, counted, todayISO());
              onClose();
            }}
          >
            បញ្ជាក់ការរាប់
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function HistoryForm({ material, db, onClose }: { material: Material; db: DbShape; onClose: () => void }) {
  const rows = db.materialMovements
    .filter((mv) => mv.materialId === material.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12);
  return (
    <Modal open title={`ចលនាស្តុក · ${material.name}`} onClose={onClose} wide>
      <Table head={["ថ្ងៃ", "ប្រភេទ", "បរិមាណ", "ថ្លៃ/ឯកតា", "ព័ត៌មានទាក់ទង", "អ្នកកត់", "កំណត់ហេតុ"]} dense>
        {rows.length ? (
          rows.map((mv) => (
            <tr key={mv.id}>
              <td>{dateKh(mv.date)}</td>
              <td>
                <Tag tone={mv.reason === "purchase" ? "good" : mv.reason === "lot" ? "info" : "warn"}>
                  {REASON_LABEL[mv.reason]}
                </Tag>
              </td>
              <td className="n">
                {mv.dir === "in" ? "+" : "−"}
                {num(mv.qty)}
              </td>
              <td className="n">{int(mv.unitCost)}</td>
              <td className="panel-hint">{mv.note ?? "—"}</td>
              <td className="panel-hint">{mv.operator || "—"}</td>
              <td className="panel-hint">{mv.note ?? ""}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={7}>
              <Empty>មិនទាន់មានចលនាស្តុកទេ</Empty>
            </td>
          </tr>
        )}
      </Table>
      <div className="save-bar">
        <span className="panel-hint">
          ស្តុកបច្ចុប្បន្ន {num(stockOf(db, material.id))} {material.unit}
        </span>
        <Button onClick={onClose}>បិទ</Button>
      </div>
    </Modal>
  );
}
