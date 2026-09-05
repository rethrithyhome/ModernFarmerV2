import { useState } from "react";
import type { DbShape, Lot } from "../lib/types";
import { EXTRA_LABEL, GRADE_LABEL, STAGE_LABEL, STAGE_ORDER, STATUS_LABEL } from "../lib/types";
import {
  TEMP_HINT,
  deriveGrade,
  deriveQcResult,
  finalQcOf,
  lotCost,
  lotCostPerKg,
  lotGrade,
  lotHealth,
  logsForLot,
  materialById,
  qcChecks,
  qcTestsForLot,
  recipeById,
  tempFlag,
  turningAdvice,
  stockOf,
  lotTrace,
} from "../lib/engine";
import {
  addLotCost,
  addLotMaterial,
  addProcessLog,
  addQcTest,
  closeLot,
  removeLotCost,
  setLotStage,
  setLotStatus,
  setQcResult,
} from "../lib/store";
import { dateKh, diffDays, int, money, num, todayISO, unitLabel } from "../lib/format";
import { Button, Choice, Empty, Field, Num, Panel, printZone, Spark, StageTrack, Stat, Tag, Text, isNum } from "./kit";
import type { Go } from "../lib/nav";

export function LotDetail({ db, lot, go }: { db: DbShape; lot: Lot; go: Go }) {
  const recipe = recipeById(db, lot.recipeId);
  const health = lotHealth(db, lot);
  const turn = turningAdvice(db, lot.id);
  const logs = logsForLot(db, lot.id);
  const tests = qcTestsForLot(db, lot.id);
  const finalTest = finalQcOf(db, lot.id);
  const perKg = lotCostPerKg(lot);
  const materialCost = lot.inputs.reduce((s, i) => s + i.cost, 0);
  const extraCost = lot.extraCosts.reduce((s, c) => s + c.amount, 0);
  const stageIndex = STAGE_ORDER.indexOf(lot.stage);
  const days = diffDays(lot.startDate, lot.closedDate ?? todayISO());

  return (
    <div className="stack">
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn--quiet" onClick={() => go("lots")}>
          ← បញ្ជី Lot
        </button>
        <h2 style={{ marginInlineStart: "auto" }} className="lot-code">
          {lot.code}
        </h2>
        <Tag tone={lot.status === "closed" ? "neutral" : lot.status === "hold" ? "warn" : lot.status === "rejected" ? "bad" : "good"}>
          {STATUS_LABEL[lot.status]}
        </Tag>
        <Tag tone="info">{STAGE_LABEL[lot.stage]}</Tag>
        {(() => {
          const grade = lotGrade(db, lot.id);
          return grade ? <Tag tone={grade === "A" ? "good" : grade === "B" ? "warn" : "bad"}>ថ្នាក់ {grade}</Tag> : null;
        })()}
        <Button onClick={() => go("labels", { lotId: lot.id })}>▥ ស្លាក QR</Button>
      </div>

      <article className="lot-card">
        <div className="lot-top">
          <div>
            <p className="panel-hint">
              {recipe?.name ?? "—"} · ផលិតផល {recipe?.productName ?? "—"} · របៀង {lot.windrow || "—"}
            </p>
            <p className="panel-hint">
              ចាប់ផ្តើម {dateKh(lot.startDate)} · គោលដៅ {dateKh(lot.targetDate)} · អ្នកទទួលខុសត្រូវ {lot.operator}
            </p>
          </div>
          <span className="tag">
            {int(days)} ថ្ងៃក្នុងដំណាក់កាល / {int(recipe?.fermentationDays ?? 45)} ថ្ងៃរំពឹង
          </span>
        </div>
        <StageTrack
          stages={STAGE_ORDER.filter((s) => s !== "finished").map((s) => STAGE_LABEL[s])}
          current={stageIndex}
        />
        {lot.status !== "closed" && lot.status !== "rejected" && (
          <div className="row-actions">
            {STAGE_ORDER.filter((s) => s !== "finished").map((s) => (
              <button
                key={s}
                type="button"
                className={`btn ${s === lot.stage ? "btn--primary" : "btn--quiet"}`}
                onClick={() => setLotStage(lot.id, s)}
              >
                {STAGE_LABEL[s]}
              </button>
            ))}
          </div>
        )}
      </article>

      <div className="grid-stats">
        <Stat label="ថ្លៃដើមសរុប" value={int(lotCost(lot) / 1000)} unit="ពាន់ រៀល" note={`វត្ថុធាតុ ${int(materialCost / 1000)}k + ចំណាយផ្សេង ${int(extraCost / 1000)}k`} />
        <Stat
          label="ថ្លៃដើម/គ.ក"
          value={perKg ? int(perKg) : int(lotCost(lot) / (lot.plannedKg || 1))}
          unit="រៀល"
          note={perKg ? "គិតពីទិន្នផលជាក់ស្តែង" : "គិតលើទម្ងន់ចូល (មិនទាន់បញ្ចប់)"}
        />
        <Stat
          label="ទិន្នផល"
          value={lot.actualKg !== undefined ? int(lot.actualKg) : "—"}
          unit="គ.ក"
          note={`គម្រោង ${int(lot.plannedKg)} គ.ក · រំពឹង ${int(((lot.plannedKg * (recipe?.yieldPct ?? 60)) / 100))} គ.ក`}
          tone={lot.actualKg !== undefined && lot.actualKg < (lot.plannedKg * (recipe?.yieldPct ?? 60)) / 100 ? "warn" : "plain"}
        />
        <Stat
          label="តេស្តចុងក្រោយ"
          value={finalTest ? (finalTest.result === "pass" ? "ជាប់" : finalTest.result === "fail" ? "ចាញ់" : "រង់ចាំ") : "—"}
          tone={finalTest?.result === "pass" ? "good" : finalTest?.result === "fail" ? "bad" : "plain"}
          note={finalTest ? `${dateKh(finalTest.date)} · ${finalTest.tester}` : "មិនទាន់ធ្វើតេស្តចុងក្រោយ"}
        />
      </div>

      <div className="grid-2">
        <Panel title="សមាសភាពវត្ថុធាតុដើម" hint="គណនាពីរូបមន្តពេលបើក Lot · មិនអាចកែបានបន្ទាប់ពីបើកទេ">
          <ul className="checks">
            {lot.inputs.map((input) => {
              const m = materialById(db, input.materialId);
              return (
                <li key={input.materialId}>
                  <span>
                    {m?.name ?? "—"} <span className="panel-hint">({unitLabel(m?.unit ?? "kg")})</span>
                  </span>
                  <span className="num">
                    {num(input.qty)} {unitLabel(m?.unit ?? "kg")} · {int(input.cost)} រៀល
                  </span>
                </li>
              );
            })}
          </ul>
          {lot.status !== "closed" && lot.status !== "rejected" && (
            <div style={{ marginTop: "1rem" }}>
              <TopUpForm db={db} lot={lot} />
            </div>
          )}
          <div style={{ marginTop: "1rem" }}>
            <ExtraCostForm lot={lot} />
          </div>
          {lot.extraCosts.length > 0 && (
            <ul className="checks" style={{ marginTop: "0.6rem" }}>
              {lot.extraCosts.map((c) => (
                <li key={c.id}>
                  <span>
                    {EXTRA_LABEL[c.category]} <span className="panel-hint">{dateKh(c.date)}</span>
                  </span>
                  <span className="num row-actions" style={{ alignItems: "center" }}>
                    {int(c.amount)} រៀល
                    <button className="icon-btn" onClick={() => removeLotCost(lot.id, c.id)} aria-label="លុបចំណាយ">
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="ការតាមដានកំប៉ុស្តិ៍"
          hint={health.lastLog ? `${TEMP_HINT[health.flag]} · កូរចុងក្រោយ ${turn.daysSince} ថ្ងៃមុន` : "កត់សង្កេតដើម្បីឃើញខ្សែកំដៅ"}
        >
          <Spark
            points={logs.map((l) => ({ x: l.date, y: l.tempC }))}
            suffix="°C"
            bands={[
              { from: 55, to: 70, tone: "var(--moss)" },
              { from: 40, to: 55, tone: "var(--leaf)" },
            ]}
          />
          <ProcessLogForm lot={lot} />
          <div style={{ marginTop: "0.8rem" }}>
            {logs.length ? (
              <ul className="checks">
                {[...logs].reverse().slice(0, 8).map((l) => (
                  <li key={l.id}>
                    <span>
                      {dateKh(l.date)} {l.turned && <Tag tone="good">បានកូរ</Tag>}
                      {l.note ? <span className="panel-hint"> · {l.note}</span> : null}
                    </span>
                    <span className="num">
                      {l.tempC !== undefined ? (
                        <span style={{ color: tempFlag(l.tempC) === "overheated" ? "var(--clay)" : undefined }}>
                          {num(l.tempC)}°C
                        </span>
                      ) : (
                        "—"
                      )}{" "}
                      · {l.moisturePct !== undefined ? `${num(l.moisturePct)}%` : "—"} ·{" "}
                      {l.ph !== undefined ? `pH ${num(l.ph)}` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>មិនទាន់មានការវាស់។ កត់សីតុណ្ហភាពកណ្តាលជារបៀងយ៉ាងតិចរៀងរាល់ ២–៣ ថ្ងៃ។</Empty>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="ការធ្វើតេស្តគុណភាព" hint="លទ្ធផល ជាប់/ចាញ់ គណនាស្វ័យប្រវត្តិពីដែនកំណត់របស់រូបមន្ត">
        <QcForm db={db} lot={lot} />
        <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.7rem" }}>
          {tests.length ? (
            tests.map((t) => (
              <div className="panel" key={t.id} style={{ boxShadow: "none", background: "#fffdf7" }}>
                <div className="panel-head">
                  <div>
                    <h4>
                      {t.sampleType === "final" ? "តេស្តចុងក្រោយ (មុនចេញលក់)" : "តេស្តក្នុងដំណាក់កាល"} ·{" "}
                      {dateKh(t.date)}
                    </h4>
                    <p className="panel-hint">
                      អ្នកធ្វើតេស្ត {t.tester || "—"} {t.note ? `· ${t.note}` : ""}
                    </p>
                  </div>
                  <div className="row-actions">
                    <Tag tone={t.result === "pass" ? "good" : t.result === "fail" ? "bad" : "warn"}>
                      {t.result === "pass" ? "ជាប់ស្តង់ដារ" : t.result === "fail" ? "ខុសស្តង់ដារ" : "មិនទាន់បញ្ជាក់"}
                    </Tag>
                    <button className="btn btn--quiet" onClick={() => setQcResult(t.id, t.result === "pass" ? "fail" : "pass")}>
                      ប្តូរដោយដៃ
                    </button>
                  </div>
                </div>
                <ul className="checks">
                  {qcChecks(db, t).map((c) => (
                    <li key={c.label}>
                      <span>
                        {c.label} <span className="panel-hint">({c.rule})</span>
                      </span>
                      <span className="num" style={{ color: c.ok === false ? "var(--clay)" : c.ok ? "var(--moss)" : undefined }}>
                        {c.value === undefined ? "មិនទាន់វាស់" : num(c.value, 2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <Empty>មិនទាន់មានលទ្ធផលវិភាគសម្រាប់ Lot នេះទេ។</Empty>
          )}
        </div>
      </Panel>

      <TracePanel db={db} lot={lot} go={go} />

      <Panel title="បញ្ចប់ Lot" hint="កត់ទម្ងន់ជាក់ស្តែង ដើម្បីបញ្ចូលស្តុកផលិតផលសម្រេច">
        {lot.status === "closed" ? (
          <p className="note-box">
            បានបញ្ចប់នៅ {dateKh(lot.closedDate ?? lot.startDate)} · ទទួលបាន {int(lot.actualKg ?? 0)} គ.ក · ស្មើ{" "}
            {num(((lot.actualKg ?? 0) / (lot.plannedKg || 1)) * 100)}% នៃទម្ងន់ចូល · ថ្លៃដើម {int(perKg ?? lotCost(lot) / (lot.actualKg || 1))} រៀល/គ.ក។
          </p>
        ) : lot.status === "rejected" ? (
          <p className="note-box">Lot នេះត្រូវបដិសេធ — វត្ថុធាតុដើមដែលនៅសល់ត្រូវបានដកត្រឡប់ចូលស្តុក។</p>
        ) : (
          <CloseForm db={db} lot={lot} />
        )}
        {lot.status !== "closed" && lot.status !== "rejected" && (
          <div className="row-actions" style={{ marginTop: "0.9rem" }}>
            <Button variant={lot.status === "hold" ? "primary" : "ghost"} onClick={() => setLotStatus(lot.id, lot.status === "hold" ? "active" : "hold")}>
              {lot.status === "hold" ? "បន្តផលិត" : "ផ្អាក Lot"}
            </Button>
            <Button variant="danger" onClick={() => setLotStatus(lot.id, "rejected")}>
              បដិសេធ Lot នេះ
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Add feedstock to a lot that is already composting, and see what it does to the cost. */
function TopUpForm({ db, lot }: { db: DbShape; lot: Lot }) {
  const feed = db.materials.filter((m) => !m.archived && m.category !== "packaging");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState<number>(0);
  const [note, setNote] = useState("");
  const [short, setShort] = useState(0);
  const material = feed.find((m) => m.id === materialId);
  const cost = material ? Math.round((isNum(qty) ? qty : 0) * material.costPerUnit) : 0;
  return (
    <div className="panel" style={{ boxShadow: "none", background: "#fbf7ec" }}>
      <h4>បន្ថែមវត្ថុធាតុចូលកណ្តាលផ្កាម</h4>
      <p className="panel-hint">
        បើចាក់ស្រូវ ឬភួយគោបន្ថែមក្រោយពេលបើក Lot កត់នៅទីនេះ — ស្តុក និងថ្លៃដើម Lot នឹងកែតាមស្វ័យប្រវត្តិ
      </p>
      <div className="form-grid" style={{ marginTop: "0.6rem", alignItems: "end" }}>
        <Field label="វត្ថុធាតុដើម" wide>
          <Choice
            value={materialId}
            onChange={(v) => {
              setMaterialId(v);
              setShort(0);
            }}
            options={[
              { value: "", label: "— ជ្រើសរើស —" },
              ...feed.map((m) => ({
                value: m.id,
                label: `${m.name} · ស្តុក ${num(stockOf(db, m.id))} ${m.unit}`,
              })),
            ]}
          />
        </Field>
        <Field label={`បរិមាណ${material ? ` (${material.unit})` : ""}`}>
          <Num value={qty} step={10} onChange={setQty} />
        </Field>
        <Field label="កំណត់ហេតុ">
          <Text value={note} onChange={setNote} placeholder="ឧ. សម្រួល C:N" />
        </Field>
        <div className="field">
          <Button
            variant="primary"
            disabled={!materialId || !isNum(qty) || qty <= 0}
            onClick={() => {
              const res = addLotMaterial({
                lotId: lot.id,
                materialId,
                qty,
                date: todayISO(),
                note: note || undefined,
              });
              if (res.ok) {
                setQty(0);
                setNote("");
                setShort(0);
              } else {
                setShort(res.short);
              }
            }}
          >
            បញ្ចូលបន្ថែម
          </Button>
        </div>
      </div>
      {short > 0 && (
        <p className="panel-hint" style={{ color: "var(--clay)", marginTop: "0.5rem" }}>
          ស្តុកមិនគ្រប់ — ខ្វះ {num(short)} {material?.unit ?? ""} ។ ទិញចូលនៅផ្ទាំង «ស្តុកវត្ថុធាតុ» ជាមុនសិន។
        </p>
      )}
      {material && isNum(qty) && qty > 0 && (
        <p className="panel-hint" style={{ marginTop: "0.5rem" }}>
          នឹងកាត់ស្តុក {num(qty)} {material.unit} · បន្ថែមថ្លៃដើម {money(cost)} · ទម្ងន់ចូល Lot កើនទៅ{" "}
          {int(lot.plannedKg + qty)} គ.ក
        </p>
      )}
    </div>
  );
}

function ExtraCostForm({ lot }: { lot: Lot }) {
  const [category, setCategory] = useState("labour");
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  return (
    <div className="form-grid" style={{ alignItems: "end" }}>
      <Field label="ប្រភេទ" wide>
        <Choice value={category} onChange={setCategory} options={Object.entries(EXTRA_LABEL).map(([value, label]) => ({ value, label }))} />
      </Field>
      <Field label="ចំនួន (រៀល)">
        <Num value={amount} step={5000} onChange={setAmount} />
      </Field>
      <Field label="កំណត់ហេតុ">
        <Text value={note} onChange={setNote} placeholder="ឧ. ប្រេងត្រាក់ទ័រ" />
      </Field>
      <div className="field">
        <Button
          onClick={() => {
            if (!isNum(amount) || amount <= 0) return;
            addLotCost(lot.id, {
              category: category as "labour",
              amount,
              date: todayISO(),
              note: note || undefined,
            });
            setAmount(0);
            setNote("");
          }}
        >
          + បន្ថែម
        </Button>
      </div>
    </div>
  );
}

const clean = (v: number) => (Number.isFinite(v) ? v : undefined);

function ProcessLogForm({ lot }: { lot: Lot }) {
  const [temp, setTemp] = useState<number | undefined>(undefined);
  const [moisture, setMoisture] = useState<number | undefined>(undefined);
  const [ph, setPh] = useState<number | undefined>(undefined);
  const [date, setDate] = useState(todayISO());
  const [turned, setTurned] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="form-grid" style={{ marginTop: "0.9rem", alignItems: "end" }}>
      <Field label="សីតុណ្ហភាព (°C)">
        <Num value={temp} step={0.5} onChange={(v) => setTemp(clean(v))} />
      </Field>
      <Field label="សំណើម (%)">
        <Num value={moisture} step={0.5} onChange={(v) => setMoisture(clean(v))} />
      </Field>
      <Field label="pH">
        <Num value={ph} step={0.1} onChange={(v) => setPh(clean(v))} />
      </Field>
      <Field label="ថ្ងៃវាស់">
        <Text value={date} onChange={setDate} type="date" />
      </Field>
      <Field label="កំណត់ហេតុ">
        <Text value={note} onChange={setNote} placeholder="ឧ. មានក្លិនអាម៉ូញ៉ាក់" />
      </Field>
      <Field label="សកម្មភាព">
        <label className="tag" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={turned} onChange={(e) => setTurned(e.target.checked)} /> បានកូររបៀង
        </label>
      </Field>
      <div className="field">
        <Button
          variant="primary"
          onClick={() => {
            addProcessLog({
              lotId: lot.id,
              date,
              tempC: temp,
              moisturePct: moisture,
              ph: ph,
              turned,
              operator: lot.operator,
              note: note || undefined,
            });
            setTemp(undefined);
            setMoisture(undefined);
            setPh(undefined);
            setNote("");
            setTurned(false);
          }}
        >
          កត់សង្កេត
        </Button>
      </div>
    </div>
  );
}

function QcForm({ db, lot }: { db: DbShape; lot: Lot }) {
  const [sampleType, setSampleType] = useState("final");
  const [gradePick, setGradePick] = useState("");
  const [fields, setFields] = useState<Record<string, number>>({});
  const [tester, setTester] = useState("បណ្ឌិត គីមី");
  const draft = {
    lotId: lot.id,
    date: todayISO(),
    sampleType: sampleType as "final",
    omPct: fields.om,
    nPct: fields.n,
    pPct: fields.p,
    kPct: fields.k,
    cnRatio: fields.cn,
    ph: fields.ph,
    moisturePct: fields.moisture,
    ecMs: fields.ec,
    impurityPct: fields.impurity,
    tester,
  };
  const derived = deriveQcResult(db, draft);
  const derivedGrade = sampleType === "final" ? deriveGrade(db, draft) : undefined;
  const grade = (gradePick || derivedGrade) as "A" | "B" | "C" | undefined;
  const set = (key: string) => (v: number) => setFields((f) => ({ ...f, [key]: v }));

  return (
    <div className="form-grid" style={{ alignItems: "end" }}>
      <Field label="ប្រភេទគំរូ">
        <Choice
          value={sampleType}
          onChange={setSampleType}
          options={[
            { value: "final", label: "តេស្តចុងក្រោយ" },
            { value: "in_process", label: "តេស្តក្នុងដំណាក់កាល" },
          ]}
        />
      </Field>
      {(
        [
          ["om", "សារធាតុសរីរាង្គ %"],
          ["n", "N %"],
          ["p", "P₂O₅ %"],
          ["k", "K₂O %"],
          ["cn", "C:N"],
          ["ph", "pH"],
          ["moisture", "សំណើម %"],
          ["ec", "EC mS/cm"],
          ["impurity", "កាកសំណល់ %"],
        ] as [string, string][]
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <Num step={0.1} value={fields[key]} onChange={set(key)} />
        </Field>
      ))}
      {sampleType === "final" && (
        <Field label="ថ្នាក់លក់" hint="A តម្លៃពេញ · B បញ្ចុះ · C កែដី">
          <Choice
            value={gradePick}
            onChange={setGradePick}
            options={[
              { value: "", label: `ស្វ័យប្រវត្តិ (${derivedGrade ?? "A"})` },
              { value: "A", label: GRADE_LABEL.A },
              { value: "B", label: GRADE_LABEL.B },
              { value: "C", label: GRADE_LABEL.C },
            ]}
          />
        </Field>
      )}
      <Field label="អ្នកធ្វើតេស្ត">
        <Text value={tester} onChange={setTester} />
      </Field>
      <div className="field">
        <Button
          variant="primary"
          onClick={() => {
            addQcTest({ ...draft, result: derived, grade, note: undefined });
            setFields({});
            setGradePick("");
          }}
        >
          កត់លទ្ធផល ({derived === "pass" ? "ជាប់" : derived === "fail" ? "ចាញ់" : "រង់ចាំ"}
          {sampleType === "final" && grade ? ` · ថ្នាក់ ${grade}` : ""})
        </Button>
      </div>
    </div>
  );
}

function CloseForm({ db, lot }: { db: DbShape; lot: Lot }) {
  const recipe = recipeById(db, lot.recipeId);
  const [actualKg, setActualKg] = useState<number>(
    Math.round((lot.plannedKg * (recipe?.yieldPct ?? 60)) / 100 / 5) * 5,
  );
  const [date, setDate] = useState(todayISO());
  const products = db.products;
  const [productId, setProductId] = useState(
    products.find((p) => p.recipeId === lot.recipeId)?.id ?? products[0]?.id ?? "",
  );
  const expectedKg = (lot.plannedKg * (recipe?.yieldPct ?? 60)) / 100;
  const bagSize = products.find((p) => p.id === productId)?.bagSizeKg || 25;
  const newCostPerKg = isNum(actualKg) && actualKg > 0 ? lotCost(lot) / actualKg : undefined;
  const revenue = (() => {
    const p = products.find((x) => x.id === productId);
    if (!p || !isNum(actualKg)) return 0;
    return (actualKg / (p.bagSizeKg || 25)) * p.pricePerBag;
  })();

  return (
    <div>
      <div className="form-grid" style={{ alignItems: "end" }}>
        <Field label="ទម្ងន់ជីសម្រេច (គ.ក)">
          <Num value={actualKg} step={25} onChange={setActualKg} />
        </Field>
        <Field label="ថ្ងៃបញ្ចប់">
          <Text value={date} onChange={setDate} type="date" />
        </Field>
        <Field label="ផលិតផលដែលបញ្ចូលស្តុក" wide>
          <Choice
            value={productId}
            onChange={setProductId}
            options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.bagSizeKg} គ.ក/ថង់)` }))}
          />
        </Field>
      </div>
      <p className="note-box" style={{ marginTop: "0.8rem" }}>
        រំពឹងទុក {int(expectedKg)} គ.ក · ភាពខុសគ្នា{" "}
        <b>{isNum(actualKg) ? int(actualKg - expectedKg) : "—"} គ.ក</b> · ថ្លៃដើម/គ.កថ្មី{" "}
        <b>{newCostPerKg ? `${int(newCostPerKg)} រៀល` : "—"}</b> · តម្លៃលក់សក្តានុពល ≈{" "}
        <b>{money(revenue)}</b> · បញ្ចូល {isNum(actualKg) ? int(actualKg / bagSize) : 0} ថង់ ({int(bagSize)} គ.ក)
      </p>
      <div className="save-bar">
        <span className="panel-hint">
          Lot នឹងប្តូរទៅ «បញ្ចប់» ហើយបង្កើតចលនាបញ្ចូលស្តុកផលិតផល។ ការកត់នេះអាចមើលឃើញក្នុងរបាយការណ៍ភ្លាម។
        </span>
        <Button
          variant="primary"
          disabled={!isNum(actualKg) || actualKg <= 0 || !productId}
          onClick={() => closeLot({ lotId: lot.id, actualKg, date, productId })}
        >
          បញ្ចប់ Lot និងបញ្ចូលស្តុក
        </Button>
      </div>
    </div>
  );
}

/** In → monitoring → QC → out, on one printable page: the lot's paper trail. */
function TracePanel({ db, lot, go }: { db: DbShape; lot: Lot; go: Go }) {
  const trace = lotTrace(db, lot.id);
  if (!trace) return null;
  const { monitoring, totals } = trace;
  return (
    <Panel
      className="print-zone"
      title={`ប្រវត្តិដានតាម Lot · ${lot.code}`}
      hint="រឿងទាំងអស់ដែល Lot នេះពាក់ព័ន្ធ — បញ្ចូល តាមដាន ពិនិត្យ និងលទ្ធផលលក់ ក្នុងទំព័រតែមួយ"
      action={
        <Button onClick={printZone}>បោះពុម្ពប្រវត្តិ</Button>
      }
    >
      <div className="trace-grid">
        <div className="trace-block">
          <h5>វត្ថុធាតុបញ្ចូល</h5>
          {trace.inputs.map((row) => (
            <p className="trace-line" key={row.name}>
              <span>
                {row.name}
                <br />
                <span className="panel-hint">
                  {row.supplier ?? "គ្មានអ្នកផ្គត់ផ្គង់"}
                  {row.lastPurchase ? ` · ទិញចូល ${dateKh(row.lastPurchase)}` : ""}
                </span>
              </span>
              <b>
                {num(row.qty)} {row.unit} · {int(row.cost / 1000)}k
              </b>
            </p>
          ))}
        </div>

        <div className="trace-block">
          <h5>ការតាមដានការផ្កាម</h5>
          <p className="trace-line">
            <span>ចំនួនការវាស់</span>
            <b>{int(monitoring.readings)}</b>
          </p>
          <p className="trace-line">
            <span>កំដៅកណ្តាលទាប/ខ្ពស់</span>
            <b>
              {monitoring.tempMin !== undefined ? num(monitoring.tempMin, 0) : "—"}–
              {monitoring.tempMax !== undefined ? num(monitoring.tempMax, 0) : "—"} °C
            </b>
          </p>
          <p className="trace-line">
            <span>ចំនួនដងកូរ</span>
            <b>{int(monitoring.turns)}</b>
          </p>
          <p className="trace-line">
            <span>រយៈពេលក្នុង Lot</span>
            <b>{int(monitoring.days)} ថ្ងៃ</b>
          </p>
          <p className="trace-line">
            <span>ការវាស់ចុងក្រោយ</span>
            <b>{monitoring.lastReading ? dateKh(monitoring.lastReading) : "—"}</b>
          </p>
        </div>

        <div className="trace-block">
          <h5>ការពិនិត្យគុណភាព</h5>
          {trace.qc.length ? (
            trace.qc.map((t) => (
              <p className="trace-line" key={t.id}>
                <span>
                  {dateKh(t.date)} · {t.sampleType === "final" ? "ចុងក្រោយ" : "កណ្តាល"}
                  <br />
                  <span className="panel-hint">
                    pH {t.ph !== undefined ? num(t.ph) : "—"} · សំណើម{" "}
                    {t.moisturePct !== undefined ? num(t.moisturePct) : "—"}% · C:N{" "}
                    {t.cnRatio !== undefined ? num(t.cnRatio, 0) : "—"}
                  </span>
                </span>
                <b>
                  <span className={`grade-tag grade--${t.grade ?? (t.result === "pass" ? "A" : "B")}`}>
                    {t.grade ?? "—"}
                  </span>{" "}
                  {t.result === "pass" ? "ជាប់" : t.result === "fail" ? "ចាញ់" : "រង់ចាំ"}
                </b>
              </p>
            ))
          ) : (
            <p className="panel-hint">មិនទាន់ធ្វើតេស្ត។</p>
          )}
        </div>

        <div className="trace-block">
          <h5>ការលក់ចេញ</h5>
          {trace.outbound.length ? (
            trace.outbound.map((o) => (
              <p className="trace-line" key={o.movementId}>
                <span>
                  {o.customer ?? "អ្នកទិញទូទៅ"}
                  <br />
                  <span className="panel-hint">
                    {dateKh(o.date)} · {o.product ?? "—"}
                  </span>
                </span>
                <b>
                  {int(o.qtyKg)} គ.ក
                  {o.due ? (
                    <>
                      {" "}
                      <span style={{ color: "var(--clay)" }}>· សល់ {int(o.due / 1000)}k</span>
                    </>
                  ) : null}
                </b>
              </p>
            ))
          ) : (
            <p className="panel-hint">មិនទាន់បញ្ចេញលក់ពី Lot នេះទេ។</p>
          )}
        </div>
      </div>

      <div className="note-box" style={{ marginTop: "0.8rem" }}>
        ថ្លៃដើមផ្ទាល់ <b>{money(totals.directCost)}</b> · បែងចែកចំណាយរួម{" "}
        <b>{totals.sharedCost ? money(totals.sharedCost) : "—"}</b> · ថ្លៃដើមពិត/គ.ក{" "}
        <b>{int(totals.perKg)} រៀល</b> · បញ្ចេញលក់ {int(totals.soldKg)} គ.ក · ចំណូល{" "}
        <b>{money(totals.revenue)}</b> · សល់ជំពាក់ <b>{money(totals.due)}</b>
        {trace.grade ? ` · ថ្នាក់ ${trace.grade}` : ""}
      </div>
    </Panel>
  );
}
