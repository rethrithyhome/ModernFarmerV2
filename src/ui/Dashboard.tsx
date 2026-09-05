import type { DbShape } from "../lib/types";
import { STAGE_LABEL } from "../lib/types";
import {
  activeLots,
  alertsFor,
  lotHealth,
  closedLots,
  lotCostPerKg,
  lotFullCostPerKg,
  overheadTotalIn,
  monthlySeries,
  outstandingTotal,
  planOf,
  planRows,
  producedIn,
  productStockKg,
  qcPassRate,
  stageCounts,
  stockValuation,
} from "../lib/engine";
import { dateKh, diffDays, int, monthLabel, num, pct, todayISO } from "../lib/format";
import { Bars, Columns, Panel, Stat, Tag } from "./kit";
import { YardMap } from "./YardMap";
import type { Go, Section } from "../lib/nav";

const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export function Dashboard({ db, go }: { db: DbShape; go: Go }) {
  const series = monthlySeries(db, 6);
  const month = todayISO().slice(0, 7);
  const thisMonth = series.find((r) => r.key === month);
  const lots = activeLots(db);
  const alerts = alertsFor(db);
  const qc = qcPassRate(db, 6);
  const closed = closedLots(db);
  // real cost per kg: direct lot cost plus this month's share of shared plant cost
  const costPerKg = closed
    .map((l) => lotFullCostPerKg(db, l) ?? lotCostPerKg(l))
    .filter((v): v is number => v !== undefined);
  const valuation = stockValuation(db);
  const plan = planOf(db, month);
  const planMonth = planRows(db, 6).find((r) => r.month === month);
  const stockTotal = valuation.reduce((sum, r) => sum + r.value, 0);
  const finishedTotal = db.products.reduce((sum, p) => sum + productStockKg(db, p.id), 0);
  const yieldRate = avg(
    closed.map((l) => ((l.actualKg ?? 0) / (l.plannedKg || 1)) * 100),
  );

  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat
          label="Lot កំពុងផលិត"
          value={int(lots.length)}
          unit="lot"
          note={`${num(lots.reduce((s, l) => s + l.plannedKg, 0), 0)} គ.ក ក្នុងដំណាក់កាល`}
        />
        <Stat
          label="បញ្ចប់ខែនេះ"
          value={int(thisMonth?.producedKg ?? 0)}
          unit="គ.ក"
          note={`${int(thisMonth?.lots ?? 0)} lot · បញ្ចេញ ${int(thisMonth?.dispatchKg ?? 0)} គ.ក`}
          tone="good"
        />
        <Stat
          label="ថ្លៃដើមពិតជាមធ្យម"
          value={int(avg(costPerKg))}
          unit="រៀល/គ.ក"
          note={`រាប់បញ្ចូលចំណាយរួមខែនេះ ${int(overheadTotalIn(db, month) / 1000)} ពាន់ រៀល`}
        />
        <Stat
          label="អត្រាជាប់គុណភាព"
          value={qc.rate === undefined ? "—" : `${num(qc.rate)}%`}
          tone={qc.rate !== undefined && qc.rate < 85 ? "bad" : "good"}
          note={`${int(qc.tested)} ការសាកល្បងចុងក្រោយ · ${int(qc.failed)} ខុសស្តង់ដារ`}
        />
        <Stat
          label="តម្លៃស្តុកវត្ថុធាតុដើម"
          value={int(stockTotal / 1000)}
          unit="ពាន់រៀល"
          note={`${int(valuation.length)} មុខទំនិញនៅសល់`}
        />
        <Stat
          label="ស្តុកផលិតផលសម្រេច"
          value={int(finishedTotal)}
          unit="គ.ក"
          note={`≈ ${int(finishedTotal / 25)} ថង់ · ការបាត់បង់ក្នុងដំណាក់ផ្កាម ≈ ${pct(100 - yieldRate)}${
            db.overheads.length ? "" : " · មិនទាន់មានចំណាយរួម"
          }`}
        />
      </div>

      <div className="grid-2">
        <Panel
          title="បញ្ជីការងារបន្ទាន់"
          hint="ស្តុកធ្លាក់ក្រោមកម្រិត · Lot លើសកាលកំណត់ · លទ្ធផល QC ខុសស្តង់ដារ"
          action={
            <button className="btn btn--quiet" onClick={() => go("materials" as Section)}>
              គ្រប់គ្រងស្តុក
            </button>
          }
        >
          {alerts.length ? (
            <div className="alerts">
              {alerts.slice(0, 7).map((a) => (
                <button
                  key={`${a.title}|${a.detail}`}
                  type="button"
                  className={`alert alert--${a.level}`}
                  style={{ textAlign: "start", width: "100%", cursor: a.to ? "pointer" : "default" }}
                  onClick={() => a.to && go(a.to as Section)}
                >
                  <span className="alert-dot" />
                  <span>
                    <b>{a.title}</b>
                    {a.detail}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="empty">គ្មានការព្រមាន។ ស្តុកគ្រប់គ្រាន់ និង Lot ទាំងអស់ត្រូវបានតាមដានទាន់ពេល។</p>
          )}
        </Panel>

        <Panel title="Lot តាមដំណាក់កាល" hint="Lot សកម្មបែងចែកតាមជំហានផលិតកម្ម">
          <Bars
            rows={stageCounts(db).map((st) => ({ label: STAGE_LABEL[st.stage], value: st.count }))}
            format={(v) => `${int(v)} lot`}
          />
          <p className="panel-hint" style={{ marginTop: "0.9rem" }}>
            Lot ដែលត្រូវការសកម្មភាពថ្ងៃនេះ៖{" "}
            <b>{int(lots.filter((l) => lotHealth(db, l).advice.length > 0).length)}</b> ជារបៀង — មើលនៅផែនទីរបៀងខាងក្រោម។
          </p>
        </Panel>
      </div>

      <YardMap db={db} go={go} />

      <Panel
        title="ដំណើរការគម្រោងខែនេះ"
        hint="ផលិតរួច + Lot កំពុងដំណើរការ ធៀបនឹងគោលដៅខែ"
        action={
          <button className="btn btn--quiet" onClick={() => go("plan")}>
            កែគម្រោង
          </button>
        }
      >
        {plan ? (
          <>
            <div className="meter">
              <span>
                គោលដៅ <b>{int(plan.targetKg)}</b> គ.ក · ផលិតរួច <b>{int(planMonth?.done ?? 0)}</b> គ.ក · Lot
                សកម្មនឹងបន្ថែម <b>{int(planMonth?.inbound ?? 0)}</b> គ.ក · នៅខ្វះ{" "}
                <b style={{ color: (planMonth?.gap ?? 0) > 0 ? "var(--clay)" : "var(--moss)" }}>
                  {int(Math.max(0, planMonth?.gap ?? 0))}
                </b>{" "}
                គ.ក
              </span>
              <span className="meter-bar">
                <i style={{ width: `${Math.min(100, planMonth?.progress ?? 0)}%` }} />
              </span>
            </div>
            <div className="legend" style={{ marginTop: "0.7rem" }}>
              <span>
                <i style={{ background: "var(--moss)" }} />
                បានបញ្ចប់ {pct(((planMonth?.done ?? 0) / (plan.targetKg || 1)) * 100)} នៃគោលដៅ
              </span>
              <span>
                <i style={{ background: "var(--amber)" }} />
                បញ្ចេញខែនេះ {int(thisMonth?.dispatchKg ?? 0)} គ.ក · ចំណូល{" "}
                {int((thisMonth?.revenue ?? 0) / 1000)} ពាន់ រៀល
              </span>
              <span>
                <i style={{ background: "var(--clay)" }} />
                សល់ជំពាក់អតិថិជនទាំងអស់ {int(outstandingTotal(db) / 1000)} ពាន់ រៀល
              </span>
            </div>
            {plan.note && <p className="note-box" style={{ marginTop: "0.7rem" }}>{plan.note}</p>}
          </>
        ) : (
          <p className="empty">
            មិនទាន់កំណត់គោលដៅខែនេះទេ។ ចុច «កែគម្រោង» ដើម្បីដាក់គោលដៅ គ.ក សម្រាប់ខែនេះ។
          </p>
        )}
      </Panel>

      <Panel
        title="ទិន្នផល និងថ្លៃដើម ៦ ខែចុងក្រោយ"
        hint="របារ = ជីបញ្ចប់ (គ.ក) · បន្ទាត់ផ្ដេក = គោលដៅខែ · ខ្សែចុច = ថ្លៃដើមជាមធ្យម (រៀល/គ.ក)"
      >
        {series.some((r) => r.producedKg > 0) ? (
          <Columns
            rows={series.map((r) => ({
              key: r.key,
              value: r.producedKg,
              line: r.costPerKg ?? 0,
              target: planTarget(db, r.key),
            }))}
            formatTop={(v) => (v ? `${Math.round(v / 1000)}k` : "")}
            labelOf={monthLabel}
          />
        ) : (
          <p className="empty">នៅមិនទាន់មាន Lot ត្រូវបញ្ចប់ក្នុង ៦ ខែចុងក្រោយទេ។</p>
        )}
        <div className="legend" style={{ marginTop: "0.8rem" }}>
          <span>
            <i style={{ background: "var(--moss)" }} />
            សរុប {int(series.reduce((s, r) => s + r.producedKg, 0))} គ.ក
          </span>
          <span>
            <i style={{ background: "var(--clay)" }} />
            បញ្ចេញលក់ {int(series.reduce((s, r) => s + r.dispatchKg, 0))} គ.ក
          </span>
          <span>
            <i style={{ background: "var(--amber)" }} />
            ចំណូល {int(series.reduce((s, r) => s + r.revenue, 0) / 1000)} ពាន់រៀល
          </span>
        </div>
      </Panel>
    </div>
  );
}

const planTarget = (db: DbShape, month: string) => planOf(db, month)?.targetKg ?? 0;

/** Cost/kg against the planned size while a lot is still open. */
function lotCostPerKgByPlanned(lot: DbShape["lots"][number]) {
  const perKg = lotCostPerKg(lot);
  if (perKg) return perKg;
  const total = lot.inputs.reduce((s, i) => s + i.cost, 0) + lot.extraCosts.reduce((s, c) => s + c.amount, 0);
  return total / (lot.plannedKg || 1);
}
