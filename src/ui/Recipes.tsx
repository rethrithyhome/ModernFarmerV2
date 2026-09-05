import { useState } from "react";
import type { DbShape, QcSpec, Recipe, RecipeLine } from "../lib/types";
import { materialById, lotsByRecipe, recipeCost } from "../lib/engine";
import { saveRecipe, setRecipeStatus } from "../lib/store";
import { int, money, num, uid, unitLabel } from "../lib/format";
import { Button, Empty, Field, Modal, Num, Panel, Table, Tag, Text } from "./kit";
import type { Go } from "../lib/nav";

export function Recipes({ db, go }: { db: DbShape; go: Go }) {
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const active = db.recipes.filter((r) => r.status === "active");
  const archived = db.recipes.filter((r) => r.status === "archived");

  return (
    <div className="stack">
      <Panel
        title="រូបមន្តផលិតកម្ម"
        hint="រូបមន្តកំណត់សមាមាត្រវត្ថុធាតុដើម ទិន្នផលរំពឹង និងដែនកំណត់គុណភាពសម្រាប់ Lot នីមួយៗ"
        action={
          <Button variant="primary" onClick={() => setEditing("new")}>
            + រូបមន្តថ្មី
          </Button>
        }
      >
        <div className="grid-2">
          {active.length ? (
            active.map((r) => {
              const c = recipeCost(db, r);
              const lots = lotsByRecipe(db, r.id);
              const closedLots = lots.filter((l) => l.status === "closed");
              const realYield =
                closedLots.length &&
                closedLots.reduce((s, l) => s + (l.actualKg ?? 0), 0) /
                  closedLots.reduce((s, l) => s + l.plannedKg, 0) *
                  100;
              return (
                <div className="panel" key={r.id} style={{ background: "#fffdf7", boxShadow: "none" }}>
                  <div className="panel-head">
                    <div>
                      <h3>{r.name}</h3>
                      <p className="panel-hint">
                        ផលិតផល៖ {r.productName} · {int(r.targetKg)} គ.ក/Lot · ផ្កាម {r.fermentationDays} ថ្ងៃ
                      </p>
                    </div>
                    <Tag tone="info">C:N {c.cnRatio ? num(c.cnRatio, 0) : "—"}</Tag>
                  </div>
                  <dl className="kv">
                    <dt>ថ្លៃដើម/Lot</dt>
                    <dd>{money(c.cost)}</dd>
                    <dt>ថ្លៃដើម/គ.ក</dt>
                    <dd>{int(c.costPerKg)} រៀល</dd>
                    <dt>ទិន្នផលរំពឹង</dt>
                    <dd>
                      {num(r.yieldPct)}% → {int(c.expectedOutKg)} គ.ក
                    </dd>
                    <dt>ទិន្នផលជាក់ស្តែង</dt>
                    <dd>{realYield ? `${num(realYield)}%` : "មិនទាន់មាន Lot បញ្ចប់"}</dd>
                    <dt>N-P-K រូបមន្ត</dt>
                    <dd>
                      {num(c.nPct)} – {num(c.pPct)} – {num(c.kPct)}
                    </dd>
                    <dt>វត្ថុធាតុដើម</dt>
                    <dd>{int(c.totalInputKg)} គ.ក · {r.lines.length} មុខ</dd>
                  </dl>
                  <ul className="checks" style={{ marginTop: "0.6rem" }}>
                    {r.lines.map((line) => {
                      const m = materialById(db, line.materialId);
                      return (
                        <li key={line.materialId}>
                          <span>{m?.name ?? "—"}</span>
                          <span className="num">
                            {num(line.qty)} {unitLabel(m?.unit ?? "kg")} ·{" "}
                            <span style={{ color: "var(--ink-faint)" }}>
                              {int(line.qty * (m?.costPerUnit ?? 0))}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="panel-hint" style={{ marginTop: "0.7rem" }}>
                    ស្តង់ដារ QC៖ pH {num(r.spec.phMin)}–{num(r.spec.phMax)} · សំណើម {num(r.spec.moistureMin)}–
                    {num(r.spec.moistureMax)}% · C:N ≤ {num(r.spec.cnMax, 0)} · OM ≥ {num(r.spec.omMin)}% · N ≥{" "}
                    {num(r.spec.nMin)}%
                  </p>
                  {r.note && <p className="note-box" style={{ marginTop: "0.6rem" }}>{r.note}</p>}
                  <div className="row-actions" style={{ marginTop: "0.8rem" }}>
                    <Button onClick={() => setEditing(r)}>កែប្រែរូបមន្ត</Button>
                    <Button onClick={() => go("lots")}>បើក Lot ពីរូបមន្តនេះ</Button>
                    <Button variant="quiet" onClick={() => setRecipeStatus(r.id, "archived")}>
                      បិទប្រើ
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty>មិនមានរូបមន្តសកម្ម។ បង្កើតរូបមន្តមួយសិន មុនបើក Lot ផលិតកម្ម។</Empty>
          )}
        </div>
        {archived.length > 0 && (
          <p className="panel-hint" style={{ marginTop: "1rem" }}>
            {archived.map((r) => `${r.name} (${int(r.targetKg)} គ.ក) · `).join("")}
            <button
              className="btn btn--quiet"
              onClick={() => archived.forEach((r) => r.status === "archived" && setRecipeStatus(r.id, "active"))}
            >
              បើករូបមន្តទាំងអស់ម្តងទៀត
            </button>
          </p>
        )}
      </Panel>

      {editing && (
        <RecipeForm recipe={editing === "new" ? undefined : editing} db={db} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function blankRecipe(): Recipe {
  const spec: QcSpec = {
    phMin: 5.5,
    phMax: 8.5,
    moistureMin: 25,
    moistureMax: 45,
    cnMax: 25,
    omMin: 30,
    nMin: 1,
  };
  return {
    id: uid("r"),
    name: "",
    productName: "",
    targetKg: 5000,
    yieldPct: 62,
    fermentationDays: 45,
    spec,
    lines: [],
    status: "active",
    createdAt: "",
  };
}

function RecipeForm({ recipe, db, onClose }: { recipe?: Recipe; db: DbShape; onClose: () => void }) {
  const [form, setForm] = useState<Recipe>(recipe ?? blankRecipe());
  const [pick, setPick] = useState("");
  const [pickQty, setPickQty] = useState<number>(100);
  const set = (patch: Partial<Recipe>) => setForm((f) => ({ ...f, ...patch }));
  const setSpec = (patch: Partial<QcSpec>) => setForm((f) => ({ ...f, spec: { ...f.spec, ...patch } }));
  const costs = recipeCost(db, form);
  const usable = db.materials.filter((m) => !m.archived);

  const addLine = () => {
    if (!pick) return;
    const line: RecipeLine = { materialId: pick, qty: isFinite(pickQty) ? pickQty : 0 };
    set({ lines: [...form.lines, line] });
    setPick("");
  };

  return (
    <Modal open wide title={recipe ? `កែប្រែ · ${recipe.name}` : "រូបមន្តផលិតកម្មថ្មី"} onClose={onClose}>
      <div className="form-grid">
        <Field label="ឈ្មោះរូបមន្ត" wide>
          <Text value={form.name} onChange={(v) => set({ name: v })} placeholder="ឧ. រូបមន្ត A · ស្រូវ-ភួយគោ" />
        </Field>
        <Field label="ផលិតផលដែលទទួលបាន" wide>
          <Text value={form.productName} onChange={(v) => set({ productName: v })} placeholder="ជីកំប៉ុស្តិ៍អង្ករ" />
        </Field>
        <Field label="ទម្ងន់ Lot គោលដៅ (គ.ក)">
          <Num value={form.targetKg} onChange={(v) => set({ targetKg: v })} step={100} />
        </Field>
        <Field label="ទិន្នផលរំពឹង (%)">
          <Num value={form.yieldPct} onChange={(v) => set({ yieldPct: v })} step={1} />
        </Field>
        <Field label="រយៈពេលផ្កាម (ថ្ងៃ)">
          <Num value={form.fermentationDays} onChange={(v) => set({ fermentationDays: Math.round(v) })} />
        </Field>
        <Field label="កំណត់ហេតុរូបមន្ត" wide>
          <Text value={form.note ?? ""} onChange={(v) => set({ note: v })} />
        </Field>
      </div>

      <Panel title="បញ្ជីវត្ថុធាតុដើម (BOM)" hint="បរិមាណសម្រាប់ Lot គោលដៅខាងលើ">
        <Table head={["វត្ថុធាតុ", "បរិមាណ", "% ទម្ងន់", "ថ្លៃដើម", ""]} dense>
          {form.lines.length ? (
            form.lines.map((line, i) => {
              const m = materialById(db, line.materialId);
              const weight = costs.totalInputKg ? (line.qty / costs.totalInputKg) * 100 : 0;
              return (
                <tr key={`${line.materialId}-${i}`}>
                  <td>{m?.name ?? "—"}</td>
                  <td style={{ width: 120 }}>
                    <Num
                      value={line.qty}
                      step={10}
                      onChange={(v) =>
                        set({
                          lines: form.lines.map((l, j) => (i === j ? { ...l, qty: v } : l)),
                        })
                      }
                    />
                  </td>
                  <td className="n">{num(weight)}%</td>
                  <td className="n">{int(line.qty * (m?.costPerUnit ?? 0))}</td>
                  <td>
                    <Button variant="quiet" onClick={() => set({ lines: form.lines.filter((_, j) => j !== i) })}>
                      យកចេញ
                    </Button>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={5}>
                <Empty>មិនទាន់មានវត្ថុធាតុដើមក្នុងរូបមន្ត</Empty>
              </td>
            </tr>
          )}
        </Table>
        <div className="form-grid" style={{ marginTop: "0.8rem", alignItems: "end" }}>
          <Field label="បន្ថែមវត្ថុធាតុ">
            <select
              className="input select"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              <option value="">— ជ្រើសរើស —</option>
              {usable
                .filter((m) => m.category !== "packaging")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
            </select>
          </Field>
          <Field label="បរិមាណ">
            <Num value={pickQty} onChange={setPickQty} step={10} />
          </Field>
          <Field label=" " wide>
            <Button onClick={addLine} disabled={!pick}>
              + បន្ថែមក្នុងរូបមន្ត
            </Button>
          </Field>
        </div>
      </Panel>

      <Panel title="ដែនកំណត់គុណភាពរបស់រូបមន្តនេះ" hint="ប្រើដើម្បីសម្រេចជាលទ្ធផល ជាប់/ចាញ់ ស្វ័យប្រវត្តិ">
        <div className="form-grid">
          <Field label="pH អប្បបរមា">
            <Num value={form.spec.phMin} step={0.1} onChange={(v) => setSpec({ phMin: v })} />
          </Field>
          <Field label="pH អតិបរមា">
            <Num value={form.spec.phMax} step={0.1} onChange={(v) => setSpec({ phMax: v })} />
          </Field>
          <Field label="សំណើមអប្បបរមា (%)">
            <Num value={form.spec.moistureMin} onChange={(v) => setSpec({ moistureMin: v })} />
          </Field>
          <Field label="សំណើមអតិបរមា (%)">
            <Num value={form.spec.moistureMax} onChange={(v) => setSpec({ moistureMax: v })} />
          </Field>
          <Field label="C:N អតិបរមា">
            <Num value={form.spec.cnMax} onChange={(v) => setSpec({ cnMax: v })} />
          </Field>
          <Field label="OM អប្បបរមា (%)">
            <Num value={form.spec.omMin} onChange={(v) => setSpec({ omMin: v })} />
          </Field>
          <Field label="N អប្បបរមា (%)">
            <Num value={form.spec.nMin} step={0.1} onChange={(v) => setSpec({ nMin: v })} />
          </Field>
        </div>
      </Panel>

      <div className="note-box">
        សរុបថ្លៃដើមរូបមន្ត៖ <b>{money(costs.cost)}</b> · {int(costs.costPerKg)} រៀល/គ.ក · រំពឹងទទួល{" "}
        {int(costs.expectedOutKg)} គ.ក · ថ្លៃដើម/គ.ក ផលិតផល{" "}
        <b>{int(costs.cost / (costs.expectedOutKg || 1))}</b> រៀល · NPK ≈ {num(costs.nPct)}–
        {num(costs.pPct)}–{num(costs.kPct)}
      </div>

      <div className="save-bar">
        <span className="panel-hint">
          {form.lines.length ? `${form.lines.length} មុខ · ${num(form.targetKg, 0)} គ.ក` : "ត្រូវមានយ៉ាងតិច ១ មុខ"}
        </span>
        <div className="row-actions">
          <Button onClick={onClose}>បោះបង់</Button>
          <Button
            variant="primary"
            disabled={!form.name.trim() || !form.lines.length}
            onClick={() => {
              saveRecipe(form);
              onClose();
            }}
          >
            រក្សាទុករូបមន្ត
          </Button>
        </div>
      </div>
    </Modal>
  );
}
