import { useState } from "react";
import type { DbShape } from "../lib/types";
import { EXTRA_LABEL } from "../lib/types";
import {
  allCustomerStats,
  closedLots,
  costBreakdown,
  lotFullCost,
  lotCost,
  lotFullCostPerKg,
  lotCostPerKg,
  overheadTotalIn,
  monthlySeries,
  outstandingTotal,
  planRows,
  productRevenue,
  purchaseValueOf,
  recipeById,
  stockValuation,
  topMaterials,
} from "../lib/engine";
import { dateKh, int, money, monthLabel, num, pct, todayISO } from "../lib/format";
import { Bars, Choice, Empty, Panel, Stat, Table, Tag } from "./kit";

export function Reports({ db }: { db: DbShape }) {
  const series = monthlySeries(db, 12);
  const spent = series.reduce((s, r) => s + r.cost, 0);
  const shared = db.overheads
    .filter((o) => o.month >= `${lastMonthOf(series)}`)
    .reduce((sum, o) => sum + o.amount, 0);
  const realCost = spent + shared;
  const revenue = db.products.reduce((s, p) => s + productRevenue(db, p.id), 0);
  const produced = series.reduce((s, r) => s + r.producedKg, 0);
  const closed = closedLots(db).sort((a, b) => (lotCostPerKg(a) ?? 0) - (lotCostPerKg(b) ?? 0));
  const [focus, setFocus] = useState<string>(closed[closed.length - 1]?.id ?? "");
  const focusLot = closed.find((l) => l.id === focus) ?? closed[0];
  const valuation = stockValuation(db);

  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat label="ជីបញ្ចប់ ១២ ខែ" value={int(produced)} unit="គ.ក" note={`≈ ${int(produced / 25)} ថង់ 25 គ.ក`} tone="good" />
        <Stat label="ថ្លៃដើមផ្ទាល់ Lot" value={int(spent / 1000)} unit="ពាន់ រៀល" note={`ទិញវត្ថុធាតុ ${int(purchaseValueOf(db) / 1000)}k`} />
        <Stat
          label="ថ្លៃដើមពិតជាមធ្យម"
          value={int(produced ? realCost / produced : 0)}
          unit="រៀល/គ.ក"
          note={`រួមចំណាយរួម ${int(shared / 1000)} ពាន់ រៀល នៃ Lot ដែលបញ្ចប់`}
        />
        <Stat label="ចំណូលបញ្ចេញលក់" value={int(revenue / 1000)} unit="ពាន់ រៀល" tone="good" note="តាមចលនាបញ្ចេញ" />
        <Stat
          label="ប្រាក់ចំណេញសរុប"
          value={int((revenue - spent) / 1000)}
          unit="ពាន់ រៀល"
          tone={revenue - spent >= 0 ? "good" : "bad"}
          note={`≈ ${num(revenue ? (revenue - spent) / revenue : 0, 1)}% នៃចំណូល`}
        />
        <Stat label="Lot ដែលត្រួតពិនិត្យ" value={int(closed.length)} unit="lot" note="រៀបតាមថ្លៃដើម/គ.ក ទាប→ខ្ពស់" />
      </div>

      <div className="grid-2">
        <Panel title="គម្រោងប្រចាំខែ និងការផលិត" hint="«រំពឹង» រួមទាំង Lot ដែលកំពុងផ្កាម និងនឹងបញ្ចប់ក្នុងខែនោះ">
          <Table head={["ខែ", "គោលដៅ", "បញ្ចប់", "រំពឹង", "% គោលដៅ", "Lot"]}
            soft={[4]} dense>
            {[...planRows(db, 6)].reverse().map((r) => (
              <tr key={r.month}>
                <td className="strong">{monthLabel(r.month)}</td>
                <td className="n">{r.target ? int(r.target) : "—"}</td>
                <td className="n">{int(r.done)}</td>
                <td className="n">{int(r.inbound)}</td>
                <td className="n">
                  {r.progress === undefined ? (
                    "គ្មានគោលដៅ"
                  ) : (
                    <Tag tone={r.progress >= 100 ? "good" : r.progress >= 80 ? "warn" : "bad"}>
                      {pct(r.progress)}
                    </Tag>
                  )}
                </td>
                <td className="n">{int(r.lots)}</td>
              </tr>
            ))}
          </Table>
          <p className="panel-hint" style={{ marginTop: "0.7rem" }}>
            កំណត់ ឬកែគម្រោងនៅផ្ទាំង «គម្រោងប្រចាំខែ» · Lot នីមួយៗត្រូវបានរាប់តាមខែដែលវាបញ្ចប់
          </p>
        </Panel>
        <Panel title="អតិថិជន និងបំណុល" hint="វិក្កយបត្រ = តម្លៃលក់ដែលកត់ · សល់ = ដែលមិនទាន់បានបង់">
          <div className="grid-stats">
            <Stat
              label="ចំណូលសរុប"
              value={int(revenue / 1000)}
              unit="ពាន់ រៀល"
              tone="good"
              note={`${int(allCustomerStats(db).reduce((s, c) => s + c.orders, 0))} ការបញ្ជាទិញ`}
            />
            <Stat
              label="សល់ជំពាក់"
              value={int(outstandingTotal(db) / 1000)}
              unit="ពាន់ រៀល"
              tone={outstandingTotal(db) > 0 ? "bad" : "good"}
              note={`${int(allCustomerStats(db).filter((c) => c.due > 0).length)} នាក់`}
            />
            <Stat
              label="មធ្យម / អតិថិជន"
              value={int(allCustomerStats(db).length ? revenue / allCustomerStats(db).length : 0)}
              unit="ពាន់ រៀល"
            />
          </div>
          <Table head={["អតិថិជន", "គ.ក", "វិក្កយបត្រ", "បានបង់", "សល់"]} dense>
            {allCustomerStats(db)
              .slice(0, 6)
              .map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="n">{int(c.kg)}</td>
                  <td className="n">{int(c.amount / 1000)}k</td>
                  <td className="n">{int(c.paid / 1000)}k</td>
                  <td className="n" style={{ color: c.due ? "var(--clay)" : undefined }}>
                    {int(c.due / 1000)}k
                  </td>
                </tr>
              ))}
            {!allCustomerStats(db).length && (
              <tr>
                <td colSpan={5}>
                  <Empty>មិនទាន់មានអតិថិជនទេ — បន្ថែមនៅផ្ទាំង «អតិថិជន»។</Empty>
                </td>
              </tr>
            )}
          </Table>
        </Panel>
      </div>


      <div className="grid-2">
        <Panel title="គម្រោងប្រចាំខែ និងការផលិត" hint="«រំពឹង» = Lot ដែលកំពុងផ្កាម និងនឹងបញ្ចប់ក្នុងខែនោះ">
          <Table head={["ខែ", "គោលដៅ", "បញ្ចប់", "រំពឹង", "% គោលដៅ", "Lot"]}
            soft={[4]} dense>
            {[...planRows(db, 6)].reverse().map((r) => (
              <tr key={r.month}>
                <td className="strong">{monthLabel(r.month)}</td>
                <td className="n">{r.target ? int(r.target) : "—"}</td>
                <td className="n">{int(r.done)}</td>
                <td className="n">{int(r.inbound)}</td>
                <td className="n">
                  {r.progress === undefined ? (
                    "គ្មានគោលដៅ"
                  ) : (
                    <Tag tone={r.progress >= 100 ? "good" : r.progress >= 80 ? "warn" : "bad"}>
                      {pct(r.progress)}
                    </Tag>
                  )}
                </td>
                <td className="n">{int(r.lots)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="អតិថិជន និងបំណុល" hint="វិក្កយបត្រ = តម្លៃលក់ដែលកត់ · សល់ = ដែលមិនទាន់បានបង់">
          <div className="grid-stats">
            <Stat
              label="ចំណូលសរុប"
              value={int(revenue / 1000)}
              unit="ពាន់ រៀល"
              tone="good"
              note={`${int(allCustomerStats(db).reduce((acc, c) => acc + c.orders, 0))} ការបញ្ជាទិញ`}
            />
            <Stat
              label="សល់ជំពាក់"
              value={int(outstandingTotal(db) / 1000)}
              unit="ពាន់ រៀល"
              tone={outstandingTotal(db) > 0 ? "bad" : "good"}
              note={`${int(allCustomerStats(db).filter((c) => c.due > 0).length)} នាក់ជំពាក់`}
            />
            <Stat
              label="មធ្យម / អតិថិជន"
              value={int(allCustomerStats(db).length ? revenue / allCustomerStats(db).length : 0)}
              unit="ពាន់ រៀល"
            />
          </div>
          <Table head={["អតិថិជន", "គ.ក", "វិក្កយបត្រ", "បានបង់", "សល់"]} dense>
            {allCustomerStats(db)
              .slice(0, 6)
              .map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="n">{int(c.kg)}</td>
                  <td className="n">{int(c.amount / 1000)}k</td>
                  <td className="n">{int(c.paid / 1000)}k</td>
                  <td className="n" style={{ color: c.due ? "var(--clay)" : undefined }}>
                    {int(c.due / 1000)}k
                  </td>
                </tr>
              ))}
            {!allCustomerStats(db).length && (
              <tr>
                <td colSpan={5}>
                  <Empty>មិនទាន់មានអតិថិជនទេ — បន្ថែមនៅផ្ទាំង «អតិថិជន»។</Empty>
                </td>
              </tr>
            )}
          </Table>
        </Panel>
      </div>

      <Panel
        title="របាយការណ៍ប្រចាំខែ"
        hint="ផលិតកម្ម ថ្លៃដើម ការបញ្ចេញ និងចំណូល ក្នុងមួយខែ"
        action={
          <button className="btn btn--quiet" onClick={() => window.print()}>
            បោះពុម្ព / PDF
          </button>
        }
      >
        <Table head={["ខែ", "Lot", "បញ្ចប់ (គ.ក)", "ថ្លៃដើម", "ថ្លៃដើម/គ.ក", "បញ្ចេញ (គ.ក)", "ចំណូល"]} dense>
          {[...series].reverse().map((r) => (
            <tr key={r.key}>
              <td className="strong">{monthLabel(r.key)}</td>
              <td className="n">{int(r.lots)}</td>
              <td className="n">{int(r.producedKg)}</td>
              <td className="n">{int(r.cost / 1000)}k</td>
              <td className="n">{r.costPerKg ? int(r.costPerKg) : "—"}</td>
              <td className="n">{int(r.dispatchKg)}</td>
              <td className="n">{r.revenue ? int(r.revenue / 1000) + "k" : "—"}</td>
            </tr>
          ))}
        </Table>
      </Panel>

      <div className="grid-2">
        <Panel
          title="តារាងថ្លៃដើមក្នុងមួយ Lot"
          hint="ជ្រើស Lot មួយដើម្បីមើលសង្ខេបថ្លៃដើម"
          action={
            closed.length ? (
              <Choice
                value={focusLot?.id ?? ""}
                onChange={setFocus}
                options={closed.map((l) => ({ value: l.id, label: `${l.code} · ${int(lotCostPerKg(l) ?? 0)} រៀល/គ.ក` }))}
              />
            ) : undefined
          }
        >
          <Table
            head={["Lot", "រូបមន្ត", "គ.ក ចូល", "គ.ក ចេញ", "ទិន្នផល", "ថ្លៃដើមផ្ទាល់", "ចំណាយរួម", "ថ្លៃដើមពិត/គ.ក"]}
            soft={[2, 3]}
            dense
          >
            {closed.length ? (
              closed.map((l) => {
                const full = lotFullCost(db, l);
                return (
                  <tr key={l.id} style={l.id === focusLot?.id ? { background: "#fbf1dc" } : undefined}>
                    <td className="strong">{l.code}</td>
                    <td>{recipeById(db, l.recipeId)?.name ?? "—"}</td>
                    <td className="n">{int(l.plannedKg)}</td>
                    <td className="n">{int(l.actualKg ?? 0)}</td>
                    <td className="n">{pct(((l.actualKg ?? 0) / (l.plannedKg || 1)) * 100)}</td>
                    <td className="n">{int(full.direct / 1000)}k</td>
                    <td className="n">{full.share ? `${int(full.share / 1000)}k` : "—"}</td>
                    <td className="n">{int(lotFullCostPerKg(db, l) ?? lotCostPerKg(l) ?? 0)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8}>
                  <Empty>គ្មាន Lot បញ្ចប់ក្នុងកាលៈទេសៈនេះទេ។</Empty>
                </td>
              </tr>
            )}
          </Table>
        </Panel>

        <Panel
          title={focusLot ? `សង្ខេបថ្លៃដើម ${focusLot.code}` : "សង្ខេបថ្លៃដើម"}
          hint={
            focusLot
              ? `បើក ${dateKh(focusLot.startDate)} · រូបមន្ត ${recipeById(db, focusLot.recipeId)?.name ?? "—"}`
              : "បើក Lot រួចបញ្ចប់ ដើម្បីឃើញការបែងចែក"
          }
        >
          {focusLot ? (
            <>
              <Bars
                rows={costBreakdown(db, focusLot).byMaterial.slice(0, 7).map((row) => ({ label: row.label, value: row.amount }))}
                format={(v) => `${int(v / 1000)}k`}
              />
              {costBreakdown(db, focusLot).extras.length > 0 && (
                <div style={{ marginTop: "0.9rem" }}>
                  <p className="panel-hint">ចំណាយបន្ថែម</p>
                  <Bars
                    rows={costBreakdown(db, focusLot).extras.map((row) => ({
                      label: EXTRA_LABEL[row.category as keyof typeof EXTRA_LABEL] ?? row.category,
                      value: row.amount,
                    }))}
                    format={(v) => `${int(v / 1000)}k`}
                    tone="amber"
                  />
                </div>
              )}
              <p className="note-box" style={{ marginTop: "0.9rem" }}>
                សរុប <b>{money(lotCost(focusLot))}</b> លើផលិតផល {int(focusLot.actualKg ?? 0)} គ.ក ⇒{" "}
                <b>{int(lotCostPerKg(focusLot) ?? 0)} រៀល/គ.ក</b>។ បើបញ្ចេញលក់ 16,000 រៀល/ថង់ (25 គ.ក) សុទ្ធ
                ≈ {money(25 * 16000 / 25 - (lotCostPerKg(focusLot) ?? 0) * 25)} /ថង់។
              </p>
            </>
          ) : (
            <Empty>គ្មានទិន្នន័យសម្រាប់វិភាគទេ។</Empty>
          )}
        </Panel>
      </div>

      <div className="grid-2">
        <Panel title="វត្ថុធាតុដើមប្រើច្រើនជាងគេ" hint="គិតជាថ្លៃដើមសរុបលើគ្រប់ Lot">
          <Bars
            rows={topMaterials(db, 7).map((row) => ({
              label: row.material?.name ?? "—",
              value: row.cost,
              hint: `${num(row.qty, 0)} ${row.material?.unit ?? ""}`,
            }))}
            format={(v) => `${int(v / 1000)}k`}
            tone="clay"
          />
        </Panel>
        <Panel title="មូលធនស្តុក" hint="តម្លៃស្តុកតាមថ្លៃទិញចុងក្រោយ">
          <Bars
            rows={valuation.slice(0, 8).map((row) => ({ label: row.material.name, value: row.value }))}
            format={(v) => `${int(v / 1000)}k`}
          />
        </Panel>
      </div>
    </div>
  );
}

/** Oldest month present in a monthly series, as YYYY-MM. */
const lastMonthOf = (series: { month?: string; key?: string }[]) =>
  (series[0]?.month ?? series[0]?.key ?? "0000-01").slice(0, 7);
