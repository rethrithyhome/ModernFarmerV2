import { useMemo, useState } from "react";
import type { DbShape, QcTest } from "../lib/types";
import {
  finalQcOf,
  lotById,
  qcChecks,
  qcPassRate,
  qcTestsForLot,
  recipeById,
} from "../lib/engine";
import { setQcResult } from "../lib/store";
import { dateKh, int, num } from "../lib/format";
import { Button, Empty, Panel, Stat, Table, Tag } from "./kit";
import type { Go, Section } from "../lib/nav";

export function Qc({ db, go }: { db: DbShape; go: Go }) {
  const [only, setOnly] = useState<"all" | "fail" | "pending" | "final">("all");
  const rows = useMemo(
    () =>
      [...db.qcTests]
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .filter((t) =>
          only === "all"
            ? true
            : only === "final"
              ? t.sampleType === "final"
              : only === "fail"
                ? t.result === "fail"
                : t.result === "pending",
        ),
    [db, only],
  );
  const rate = qcPassRate(db, 12);
  const lotsWithoutFinal = db.lots.filter(
    (l) => (l.status === "closed" || l.stage === "bagging" || l.stage === "sieving") && !finalQcOf(db, l.id),
  );
  const failingCheckCounts = new Map<string, number>();
  db.qcTests.forEach((t) =>
    qcChecks(db, t).forEach((c) => {
      if (c.ok === false) failingCheckCounts.set(c.label, (failingCheckCounts.get(c.label) ?? 0) + 1);
    }),
  );

  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat
          label="អត្រាជាប់ (តេស្តចុងក្រោយ ១២ ខែ)"
          value={rate.rate === undefined ? "—" : `${num(rate.rate)}%`}
          tone={rate.rate !== undefined && rate.rate < 85 ? "bad" : "good"}
          note={`${int(rate.tested)} លើក · ${int(rate.failed)} ខុសស្តង់ដារ`}
        />
        <Stat label="ចំនួនធ្វើតេស្តសរុប" value={int(db.qcTests.length)} unit="លើក" note="គំរូក្នុងដំណាក់ផ្កាម · និងចុងក្រោយ" />
        <Stat
          label="Lot ខ្វះតេស្តចុងក្រោយ"
          value={int(lotsWithoutFinal.length)}
          unit="lot"
          tone={lotsWithoutFinal.length ? "warn" : "good"}
          note="មុនបញ្ចូលស្តុកផលិតផល គួរតែមានតេស្តចុងក្រោយ"
        />
        <Stat
          label="ចំណុចចាញ់ញឹកញាប់"
          value={
            [...failingCheckCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "គ្មាន"
          }
          note={`${int([...failingCheckCounts.values()].reduce((s, v) => s + v, 0))} លើកសរុប`}
        />
      </div>

      <Panel
        title="លទ្ធផលវិភាគ"
        hint="ដែនកំណត់មកពីរូបមន្តរបស់ Lot នីមួយៗ · លទ្ធផលខុស ⇒ សញ្ញា «ចាញ់» ដោយស្វ័យប្រវត្តិ"
        action={
          <div className="row-actions">
            {(["all", "final", "fail", "pending"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`btn ${only === k ? "btn--primary" : "btn--quiet"}`}
                onClick={() => setOnly(k)}
              >
                {k === "all" ? "ទាំងអស់" : k === "final" ? "ចុងក្រោយ" : k === "fail" ? "ខុសស្តង់ដារ" : "រង់ចាំ"}
              </button>
            ))}
          </div>
        }
      >
        <Table head={["Lot", "ថ្ងៃ", "ប្រភេទ", "OM %", "N %", "P %", "K %", "C:N", "pH", "សំណើម", "លទ្ធផល", ""]}
            soft={[6, 7, 10]}
            dense>
          {rows.length ? (
            rows.map((t) => {
              const lot = lotById(db, t.lotId);
              return (
                <tr key={t.id}>
                  <td>
                    <button className="btn btn--quiet" onClick={() => lot && go("lots", { lotId: lot.id })}>
                      {lot?.code ?? "—"}
                    </button>
                    <br />
                    <span className="panel-hint">{lot ? recipeById(db, lot.recipeId)?.name : ""}</span>
                  </td>
                  <td>{dateKh(t.date)}</td>
                  <td>{t.sampleType === "final" ? "ចុងក្រោយ" : "ក្នុងដំណាក់"}</td>
                  <td className="n">{fnum(t.omPct)}</td>
                  <td className="n">{fnum(t.nPct)}</td>
                  <td className="n">{fnum(t.pPct)}</td>
                  <td className="n">{fnum(t.kPct)}</td>
                  <td className="n">{fnum(t.cnRatio)}</td>
                  <td className="n">{fnum(t.ph)}</td>
                  <td className="n">{fnum(t.moisturePct)}</td>
                  <td>
                    <Tag tone={t.result === "pass" ? "good" : t.result === "fail" ? "bad" : "warn"}>
                      {t.result === "pass" ? "ជាប់" : t.result === "fail" ? "ចាញ់" : "រង់ចាំ"}
                    </Tag>
                  </td>
                  <td>
                    <div className="row-actions">
                      {failHint(db, t) && <span className="panel-hint">{failHint(db, t)}</span>}
                      <Button variant="quiet" onClick={() => setQcResult(t.id, t.result === "pass" ? "fail" : "pass")}>
                        ប្តូរ
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={12}>
                <Empty>គ្មានលទ្ធផលវិភាគក្នុងចម្រុះនេះ។</Empty>
              </td>
            </tr>
          )}
        </Table>
      </Panel>

      <Panel title="Lot គ្មានតេស្តចុងក្រោយ" hint="ចុចដើម្បីបន្ថែមលទ្ធផលវិភាគនៅក្នុង Lot">
        {lotsWithoutFinal.length ? (
          <div className="alerts">
            {lotsWithoutFinal.map((lot) => (
              <button
                key={lot.id}
                type="button"
                className="alert alert--info"
                style={{ width: "100%", textAlign: "start", cursor: "pointer" }}
                onClick={() => go("lots" as Section, { lotId: lot.id })}
              >
                <span className="alert-dot" />
                <span>
                  <b>{lot.code}</b>
                  {`ដំណាក់ ${lot.stage} · បើក ${dateKh(qcTestsForLot(db, lot.id)[0]?.date ?? lot.startDate)}`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">រាល់ Lot ដែលបញ្ចប់ មានតេស្តគុណភាពចុងក្រោយគ្រប់គ្រាន់។</p>
        )}
      </Panel>
    </div>
  );
}

const fnum = (v: number | undefined) => (v === undefined ? "—" : num(v, 2));

function failHint(db: DbShape, t: QcTest) {
  const bad = qcChecks(db, t).filter((c) => c.ok === false);
  return bad.length ? `${bad.map((c) => c.label).slice(0, 2).join(", ")} ខុស` : undefined;
}
