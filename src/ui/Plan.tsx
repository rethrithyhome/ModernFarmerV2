import { useState } from "react";
import type { DbShape, MonthlyPlan } from "../lib/types";
import { OVERHEAD_LABEL, STAGE_LABEL } from "../lib/types";
import {
  lotCostPerKg,
  lotsStartingIn,
  overheadTotalIn,
  planOf,
  planRows,
  purchasePlan,
  recipeById,
} from "../lib/engine";
import { removeOverhead, removePlan, saveOverhead, savePlan } from "../lib/store";
import { addDays, dateKh, int, money, monthLabel, num, pct, todayISO, unitLabel } from "../lib/format";
import { Button, Choice, Empty, Field, Panel, printZone, Stat, Table, Tag, Text } from "./kit";
import { purchasePlanCsv, overheadsCsv } from "../lib/csv";
import { download } from "../lib/prefs";
import type { Go } from "../lib/nav";

export function Plan({ db, go }: { db: DbShape; go: Go }) {
  const [focus, setFocus] = useState(todayISO().slice(0, 7));
  // six months back, plus any future month that already has a target or lots booked
  const past = planRows(db, 6);
  const lastShown = past[past.length - 1].month;
  const horizon = [...db.plans.map((pl) => pl.month), ...db.lots.map((l) => l.targetDate.slice(0, 7))]
    .filter((m) => m > lastShown)
    .sort()
    .pop();
  const future = horizon ? planRows(db, 12, horizon).filter((r) => r.month > lastShown) : [];
  const rows = [...past, ...future];
  const current = rows.find((r) => r.month === focus) ?? rows[rows.length - 1];
  const lotsOfPlan = lotsStartingIn(db, focus);
  const nextMonth = addDays(`${focus}-01`, 32).slice(0, 7);

  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat
          label={`គោលដៅខែ ${monthLabel(focus)} (គ.ក)`}
          value={int(current?.target ?? 0)}
          unit="គ.ក"
          note={current?.note ?? "គ្មានកំណត់ហេតុ"}
        />
        <Stat
          label="បានផលិតបញ្ចប់"
          value={int(current?.done ?? 0)}
          unit="គ.ក"
          tone="good"
          note={`${pct(current?.progress ?? 0)} នៃគោលដៅ`}
        />
        <Stat
          label="Lot កំពុងផ្កាម (រំពឹង)"
          value={int(current?.inbound ?? 0)}
          unit="គ.ក រំពឹង"
          note={`${int(current?.lots ?? 0)} Lot បើកក្នុងខែនេះ`}
        />
        <Stat
          label="នៅខ្វះពីគោលដៅ"
          value={int(Math.max(0, current?.gap ?? 0))}
          unit="គ.ក"
          tone={(current?.gap ?? 0) > 0 ? "bad" : "good"}
          note={(current?.gap ?? 0) > 0 ? "ត្រូវបើក Lot បន្ថែម ឬកាត់គោលដៅ" : "គ្រប់គោលដៅហើយ"}
        />
      </div>

      <Panel
        title="កំណត់គោលដៅប្រចាំខែ"
        hint="គោលដៅ = ទម្ងន់ជីសម្រេច (គ.ក) ដែលចង់ផលិតក្នុងខែនោះ"
        action={
          <div className="row-actions">
            {rows.map((r) => (
              <button
                key={r.month}
                type="button"
                className={`btn ${r.month === current?.month ? "btn--primary" : "btn--quiet"}`}
                onClick={() => setFocus(r.month)}
              >
                {monthLabel(r.month)}
              </button>
            ))}
          </div>
        }
      >
        {current && <PlanEditor db={db} month={current.month} row={current} />}
      </Panel>

      <Panel
        title="តារាងគម្រោង vs ការផលិតជាក់ស្តែង"
        hint="«បញ្ចប់» = Lot ដែលបានបិញ · «រំពឹង» = Lot ដែលកំពុងផ្កាមនឹងបញ្ចប់ក្នុងខែនោះ"
      >
        <Table head={["ខែ", "គោលដៅ", "បញ្ចប់", "រំពឹង", "សរុបរំពឹង", "% គោលដៅ", "Lot", ""]} dense>
          {rows.map((r) => {
            const ratio = r.target ? (r.projected / r.target) * 100 : 0;
            return (
              <tr key={r.month} style={r.month === current?.month ? { background: "#fbf1dc" } : undefined}>
                <td className="strong">{monthLabel(r.month)}</td>
                <td className="n">{r.target ? int(r.target) : "—"}</td>
                <td className="n">{int(r.done)}</td>
                <td className="n">{int(r.inbound)}</td>
                <td className="n">{int(r.projected)}</td>
                <td className="n">
                  {r.target ? (
                    <Tag tone={ratio >= 100 ? "good" : ratio >= 80 ? "warn" : "bad"}>{pct(ratio)}</Tag>
                  ) : (
                    "គ្មានគោលដៅ"
                  )}
                </td>
                <td className="n">{int(r.lots)}</td>
                <td>
                  <div className="row-actions">
                    <Button variant="quiet" onClick={() => setFocus(r.month)}>
                      មើល
                    </Button>
                    {r.target > 0 && (
                      <Button variant="quiet" onClick={() => removePlan(r.month)}>
                        លុបគោលដៅ
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </Panel>

      {current && <PurchasePanel db={db} month={current.month} />}
      {current && <OverheadPanel db={db} month={current.month} />}

      <Panel
        title={`Lot ដែលពាក់ព័ន្ធនឹង${monthLabel(current?.month ?? "")}`}
        hint="Lot បើកក្នុងខែនេះ · ចុចដើម្បីបន្ថែមការវាស់ ឬបញ្ចប់"
        action={
          <div className="row-actions">
            <Button onClick={() => go("lots")}>ទៅ Lot ទាំងអស់</Button>
            <Button variant="primary" onClick={() => go("lots")} >
              + បើក Lot សម្រាប់ {monthLabel(nextMonth)}
            </Button>
          </div>
        }
      >
        {lotsOfPlan.length ? (
          <Table head={["Lot", "រូបមន្ត", "ដំណាក់កាល", "គម្រោង", "រំពឹងបញ្ចប់", "ថ្លៃដើម/គ.ក", "បើក"]}
            soft={[2, 7]} dense>
            {lotsOfPlan.map((lot) => {
              const recipe = recipeById(db, lot.recipeId);
              const expect = Math.round((lot.plannedKg * (recipe?.yieldPct ?? 60)) / 100);
              return (
                <tr key={lot.id}>
                  <td>
                    <button className="btn btn--quiet strong" onClick={() => go("lots", { lotId: lot.id })}>
                      {lot.code}
                    </button>
                    <br />
                    <span className="panel-hint">របៀង {lot.windrow || "—"}</span>
                  </td>
                  <td>{recipe?.name ?? "—"}</td>
                  <td>
                    <Tag tone={lot.status === "closed" ? "neutral" : lot.status === "hold" ? "warn" : "info"}>
                      {STAGE_LABEL[lot.stage]}
                    </Tag>
                  </td>
                  <td className="n">{int(lot.plannedKg)}</td>
                  <td className="n">{int(lot.actualKg ?? expect)}</td>
                  <td className="n">{int(lotCostPerKg(lot) ?? 0)}</td>
                  <td>{dateKh(lot.startDate)}</td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty>
            គ្មាន Lot ត្រូវបានបើកក្នុងខែនេះទេ។ បើគោលដៅ &gt; 0 សូមបើក Lot ថ្មី ឬបន្ថយគោលដៅ។
          </Empty>
        )}
      </Panel>
    </div>
  );
}

function PlanEditor({ db, month, row }: { db: DbShape; month: string; row: ReturnType<typeof planRows>[number] }) {
  const plan = planOf(db, month);
  const [target, setTarget] = useState<number>(plan?.targetKg ?? Math.round(row.done || 0));
  const [note, setNote] = useState(plan?.note ?? "");
  const disabled = !Number.isFinite(target) || target < 0;

  return (
    <div>
      <div className="form-grid" style={{ alignItems: "end" }}>
        <Field label={`គោលដៅខែ ${monthLabel(month)} (គ.ក)`}>
          <Text
            value={String(Number.isFinite(target) ? Math.round(target) : 0)}
            onChange={(v) => setTarget(Number(v.replace(/[^\d]/g, "")) || 0)}
          />
        </Field>
        <Field label="កំណត់ហេតុផែនការ" wide>
          <Text value={note} onChange={setNote} placeholder="ឧ. បំពេញការបញ្ជាទិញរបស់អ្នកចែកចាយ" />
        </Field>
        <div className="field">
          <Button
            variant="primary"
            disabled={disabled}
            onClick={() => {
              const next: MonthlyPlan = { month, targetKg: target, note };
              savePlan(next);
            }}
          >
            {plan ? "ធ្វើបច្ចុប្បន្នភាពគម្រោង" : "កំណត់គម្រោង"}
          </Button>
        </div>
      </div>
      <p className="note-box" style={{ marginTop: "0.8rem" }}>
        {row.target ? (
          <>
            បច្ចុប្បន្ន៖ គោលដៅ <b>{int(row.target)}</b> គ.ក · ផលិតរួច <b>{int(row.done)}</b> · Lot សកម្មនឹងបន្ថែម{" "}
            <b>{int(row.inbound)}</b> · ខ្វះ <b>{int(Math.max(0, row.gap))}</b> គ.ក
            {row.gap > 0 && (
              <>
                {" "}
                ⇒ គួរបើក Lot បន្ថែមប្រហែល{" "}
                <b>{int(Math.ceil((row.gap / 0.62) / 500) * 500)}</b> គ.ក នៃវត្ថុធាតុចូល
              </>
            )}
            {row.progress !== undefined && (
              <>
                {" "}
                · ដល់ឥឡូវ <b>{pct(row.progress)}</b> នៃគោលដៅ
              </>
            )}
          </>
        ) : (
          <>
            ខែនេះមិនទាន់មានគោលដៅទេ។ ខែមុនៗផលិតជាមធ្យម{" "}
            <b>{int(monthAverage(db))}</b> គ.ក ⇒ ដាក់ <b>{int(suggestTarget(db))}</b> គ.ក ជាចំណុចចាប់ផ្តើម។
          </>
        )}
      </p>
    </div>
  );
}

/** Recent finished output, used only to propose a starting target. */
function monthAverage(db: DbShape) {
  const done = planRows(db, 6).map((r) => r.done);
  return done.reduce((a, b) => a + b, 0) / Math.max(1, done.length);
}

function suggestTarget(db: DbShape) {
  return Math.max(1000, Math.round((monthAverage(db) || 5000) / 500) * 500);
}


/** Target → missing compost → feedstock to buy, with the money attached. */
function PurchasePanel({ db, month }: { db: DbShape; month: string }) {
  const [recipeId, setRecipeId] = useState("");
  const plan = purchasePlan(db, month, recipeId || undefined);
  const rows = plan.rows.filter((r) => r.need > 0);
  const buy = rows.filter((r) => r.short > 0);
  if (!plan.target) {
    return (
      <Panel title="បញ្ជីទិញវត្ថុធាតុដើមសម្រាប់ខែនេះ" hint="ដាក់គោលដៅខែជាមុនសិន ដើម្បីឱ្យប្រព័ន្ធគណនា">
        <p className="empty">មិនទាន់មានគោលដៅសម្រាប់ខែនេះទេ។</p>
      </Panel>
    );
  }
  return (
    <Panel
      className="print-zone"
      title={`បញ្ជីទិញវត្ថុធាតុដើម · ${monthLabel(month)}`}
      hint={`គោលដៅ ${int(plan.target)} · នឹងបាន ${int(plan.projected)} គ.ក ⇒ ខ្វះ ${int(plan.missingKg)} គ.ក`}
      action={
        <div className="row-actions">
          <Choice
            value={recipeId || plan.recipe?.id || ""}
            onChange={setRecipeId}
            options={db.recipes.filter((r) => r.status === "active").map((r) => ({ value: r.id, label: `គណនាតាម ${r.name}` }))}
          />
          <Button
            onClick={() =>
              download(`dijii-purchase-${month}.csv`, purchasePlanCsv(db, month, recipeId || undefined), "text/csv")
            }
          >
            ទាញយក CSV
          </Button>
          <Button onClick={printZone}>បោះពុម្ពបញ្ជីទិញ</Button>
        </div>
      }
    >
      {rows.length ? (
        <>
          {buy.length === 0 && (
            <p className="note-box" style={{ marginBottom: "0.7rem", color: "var(--moss)" }}>
              ស្តុកបច្ចុប្បន្នគ្រប់សម្រាប់ {int(plan.missingKg)} គ.ក ដែលនៅខ្វះ — គ្រាន់តែបើក Lot ថ្មី{" "}
              {int(Math.ceil(plan.feedNeeded / 500) * 500)} គ.ក នៃវត្ថុធាតុចូល។
            </p>
          )}
          <Table head={["វត្ថុធាតុដើម", "ត្រូវការ", "មានក្នុងស្តុក", "ត្រូវទិញ", "ថវិកា", "អ្នកផ្គត់ផ្គង់"]} dense>
            {rows.map((r) => (
              <tr key={r.materialId}>
                <td className="strong">{r.name}</td>
                <td className="n">
                  {kgText(r.need)} {unitLabel(r.unit)}
                </td>
                <td className="n">
                  {kgText(r.stock)} {unitLabel(r.unit)}
                </td>
                <td className="n" style={{ color: r.short > 0 ? "var(--clay)" : "var(--moss)" }}>
                  {r.short > 0 ? `${kgText(r.short)} ${r.unit}` : "គ្រប់គ្រាន់"}
                </td>
                <td className="n">{r.cost ? int(r.cost / 1000) + "k" : "—"}</td>
                <td className="panel-hint">{r.supplier ?? "—"}</td>
              </tr>
            ))}
            <tr>
              <td className="strong">សរុបត្រូវទិញ</td>
              <td className="n" />
              <td className="n" />
              <td className="n strong">{int(buy.length)} មុខ</td>
              <td className="n strong">{money(plan.total)}</td>
              <td className="panel-hint">តម្លៃទិញចុងក្រោយ</td>
            </tr>
          </Table>
          {purchasePlan(db, month, recipeId || undefined).recipe && (
            <p className="panel-hint" style={{ marginTop: "0.6rem" }}>
              គណនាតាម«{plan.recipe?.name}» · ទិន្នផលរំពឹង {pct(plan.recipe?.yieldPct ?? 0)} · Lot សកម្មក្នុងខែនេះ{" "}
              {int(plan.openLots)}
            </p>
          )}
        </>
      ) : (
        <p className="empty">ស្តុកបច្ចុប្បន្នគ្រប់គ្រាន់សម្រាប់គោលដៅខែនេះ — មិនត្រូវទិញបន្ថែមទេ។</p>
      )}
    </Panel>
  );
}

/** Shared plant cost for the month; spread over that month's finished output. */
function OverheadPanel({ db, month }: { db: DbShape; month: string }) {
  const rows = db.overheads.filter((o) => o.month === month);
  const total = overheadTotalIn(db, month);
  const [category, setCategory] = useState("labour");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const value = Number(amount.replace(/[^\d]/g, "")) || 0;
  return (
    <Panel
      title={`ចំណាយរួមនៃរោងចក្រ · ${monthLabel(month)}`}
      hint="ចំណាយទាំងនេះមិនទាក់ទង Lot តែមួយទេ គេបែងចែកលើទិន្នផលបញ្ចប់ក្នុងខែ ដើម្បីឱ្យ ថ្លៃដើម/គ.ក ពិត"
    >
      <Table head={["ប្រភេទ", "ចំនួន (រៀល)", "កំណត់ហេតុ", ""]} dense>
        {rows.length ? (
          rows.map((o) => (
            <tr key={o.id}>
              <td>{OVERHEAD_LABEL[o.category]}</td>
              <td className="n">{int(o.amount)}</td>
              <td className="panel-hint">{o.note ?? "—"}</td>
              <td>
                <button className="btn btn--quiet" onClick={() => removeOverhead(o.id)}>
                  ដកចេញ
                </button>
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={4}>
              <p className="empty">មិនទាន់មានចំណាយរួមក្នុងខែនេះ — បន្ថែមប្រាក់បុគ្គលិក ប្រេង ឬជួលនៅខាងក្រោម។</p>
            </td>
          </tr>
        )}
      </Table>
      <div className="form-grid" style={{ marginTop: "0.8rem", alignItems: "end" }}>
        <Field label="ប្រភេទចំណាយ">
          <Choice
            value={category}
            onChange={setCategory}
            options={Object.entries(OVERHEAD_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="ចំនួន (រៀល)">
          <Text value={amount} onChange={setAmount} placeholder="ឧ. 820000" />
        </Field>
        <Field label="កំណត់ហេតុ">
          <Text value={note} onChange={setNote} placeholder="ឧ. បុគ្គលិក ៤ នាក់" />
        </Field>
        <div className="field">
          <Button
            variant="primary"
            disabled={value <= 0}
            onClick={() => {
              saveOverhead({
                month,
                category: category as "labour",
                amount: value,
                note: note || undefined,
              });
              setAmount("");
              setNote("");
            }}
          >
            បន្ថែមចំណាយ
          </Button>
        </div>
      </div>
      <p className="note-box" style={{ marginTop: "0.7rem" }}>
        សរុបចំណាយរួមខែនេះ <b>{money(total)}</b> · បើផលិតបានតិច ថ្លៃដើម/គ.ក នឹងកើន —{" "}
        <button className="btn btn--quiet" onClick={() => download(`dijii-overheads-${month}.csv`, overheadsCsv(db), "text/csv")}>
          ទាញយក CSV ទាំងអស់ខែ
        </button>
      </p>
    </Panel>
  );
}

/** Whole numbers above 100 kg — a purchase list does not need decimals. */
const kgText = (v: number) => (Math.abs(v) >= 100 ? int(v) : num(v));
