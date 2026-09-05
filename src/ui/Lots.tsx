import { useState } from "react";
import type { DbShape, Lot } from "../lib/types";
import { STAGE_LABEL, STAGE_ORDER, STATUS_LABEL } from "../lib/types";
import {
  activeLots,
  isOverdue,
  lotCost,
  lotCostPerKg,
  lotHealth,
  lotYieldPct,
  planForLot,
  recipeById,
  turningAdvice,
} from "../lib/engine";
import { openLot } from "../lib/store";
import { addDays, dateKh, diffDays, int, money, num, todayISO } from "../lib/format";
import { Button, Empty, Field, Modal, Num, Panel, StageTrack, Tag, Text } from "./kit";
import type { Go } from "../lib/nav";
import { LotDetail } from "./LotDetail";
import { YardMap } from "./YardMap";

export function Lots({ db, go, lotId }: { db: DbShape; go: Go; lotId?: string }) {
  const selected = lotId ? db.lots.find((l) => l.id === lotId) : undefined;
  if (selected) return <LotDetail db={db} lot={selected} go={go} />;
  return <LotList db={db} go={go} />;
}

type FilterKey = "active" | "closed" | "hold" | "all";

function LotList({ db, go }: { db: DbShape; go: Go }) {
  const [filter, setFilter] = useState<FilterKey>("active");
  const [view, setView] = useState<"yard" | "list">("yard");
  const [opening, setOpening] = useState(false);

  const rows = db.lots
    .filter((l) =>
      filter === "all"
        ? true
        : filter === "active"
          ? l.status === "active"
          : filter === "hold"
            ? l.status === "hold" || l.status === "rejected"
            : l.status === "closed",
    )
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  const tabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "active", label: "កំពុងផលិត", count: db.lots.filter((l) => l.status === "active").length },
    { key: "closed", label: "បានបញ្ចប់", count: db.lots.filter((l) => l.status === "closed").length },
    {
      key: "hold",
      label: "ផ្អាក/បដិសេធ",
      count: db.lots.filter((l) => l.status === "hold" || l.status === "rejected").length,
    },
    { key: "all", label: "ទាំងអស់", count: db.lots.length },
  ];

  return (
    <div className="stack">
      <div className="switch-row">
        <span className="row-actions">
          <button
            type="button"
            className={`btn ${view === "yard" ? "btn--primary" : "btn--quiet"}`}
            onClick={() => setView("yard")}
          >
            ផែជារបៀង
          </button>
          <button
            type="button"
            className={`btn ${view === "list" ? "btn--primary" : "btn--quiet"}`}
            onClick={() => setView("list")}
          >
            បញ្ជី Lot
          </button>
        </span>
        <Button variant="primary" onClick={() => setOpening(true)} disabled={!db.recipes.some((r) => r.status === "active")}>
          + បើក Lot ថ្មី
        </Button>
      </div>

      {view === "yard" ? (
        <>
          <YardMap db={db} go={go} />
          <Panel title="Lot កំពុងរង់ចាំសកម្មភាព" hint="រៀបតាមថ្ងៃដែលមិនបានកូរ ឬសីតុណ្ហភាពក្រៅ zone">
            {rowsWithAttention(db).length ? (
              <ul className="checks">
                {rowsWithAttention(db).map(({ lot, advice }) => (
                  <li key={lot.id}>
                    <button className="btn btn--quiet" onClick={() => go("lots", { lotId: lot.id })}>
                      {lot.code} · របៀង {lot.windrow || "—"}
                    </button>
                    <span>{advice}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">គ្រប់ជារបៀងស្ថិតក្នុងស្ថានភាពល្អ — គ្មានអ្វីត្រូវធ្វើពេលនេះទេ។</p>
            )}
          </Panel>
        </>
      ) : (
        <Panel title="បញ្ជី Lot" hint="ចុចជួរមួយដើម្បីពន្លាត់ · ចុច «បើក» ដើម្បីកត់ការវាស់ ឬបញ្ចប់">
          <div className="row-actions" style={{ marginBottom: "1rem" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`btn ${filter === t.key ? "btn--primary" : "btn--quiet"}`}
                onClick={() => setFilter(t.key)}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
          {rows.length ? (
            <div style={{ display: "grid", gap: "0.45rem" }}>
              {rows.map((lot) => (
                <LotRow key={lot.id} db={db} lot={lot} onOpen={() => go("lots", { lotId: lot.id })} />
              ))}
            </div>
          ) : (
            <Empty>
              {filter === "active"
                ? "គ្មាន Lot កំពុងផលិត។ ចុច «បើក Lot ថ្មី» ដើម្បីចាប់ផ្តើមរូបមន្តមួយ។"
                : "គ្មាន Lot ក្នុងចម្រុះនេះទេ។"}
            </Empty>
          )}
        </Panel>
      )}
      {opening && <OpenLotModal db={db} onClose={() => setOpening(false)} go={go} />}
    </div>
  );
}

/** Open lots that need a person today, worst first. */
function rowsWithAttention(db: DbShape) {
  return activeLots(db)
    .map((lot) => ({ lot, advice: lotHealth(db, lot).advice[0] ?? "ត្រូវពិនិត្យ" }))
    .filter((r) => r.advice)
    .slice(0, 8);
}

function LotRow({ db, lot, onOpen }: { db: DbShape; lot: Lot; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const recipe = recipeById(db, lot.recipeId);
  const late = isOverdue(db, lot);
  const health = lotHealth(db, lot);
  const turn = turningAdvice(db, lot.id);
  const days = diffDays(lot.startDate, lot.closedDate ?? todayISO());
  const perKg = lotCostPerKg(lot);
  const tone =
    lot.status === "closed" ? "neutral" : lot.status === "hold" ? "warn" : lot.status === "rejected" ? "bad" : "good";
  return (
    <article className={`lot-row ${late ? "lot-row--late" : ""} ${open ? "lot-row--open" : ""}`}>
      <div className="lot-row-top">
        <button className="lot-row-name" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span className={`dot dot--${lot.status === "closed" ? "closed" : lot.stage}`} />
          <b>{lot.code}</b>
          <span className="panel-hint">
            {recipe?.productName ?? "—"} · របៀង {lot.windrow || "—"}
          </span>
        </button>
        <span className="lot-row-facts">
          <span className="num">{health.lastLog?.tempC !== undefined ? `${num(health.lastLog.tempC, 0)}°` : "—"}</span>
          <span className="num">{int(days)}d</span>
          <span className="num">{perKg ? `${int(perKg)}/គ.ក` : `${int(lotCost(lot) / 1000)}k`}</span>
          <Tag tone={tone}>{STAGE_LABEL[lot.stage]}</Tag>
          <button className="btn btn--quiet" type="button" onClick={onOpen}>
            បើក
          </button>
        </span>
      </div>
      {open && (
        <div className="lot-row-more">
          <StageTrack
            stages={STAGE_ORDER.filter((s) => s !== "finished").map((s) => STAGE_LABEL[s])}
            current={STAGE_ORDER.indexOf(lot.stage)}
          />
          <div className="grid-stats">
            <div className="stat">
              <span className="stat-label">ថ្លៃដើមសរុប</span>
              <span className="stat-value">
                {int(lotCost(lot) / 1000)}
                <em>ពាន់ រៀល</em>
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">គម្រោង / ជាក់ស្តែង</span>
              <span className="stat-value">
                {int(lot.plannedKg)}
                <em>{lot.actualKg !== undefined ? `→ ${int(lot.actualKg)} គ.ក` : "គ.ក"}</em>
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">កំដៅ / សំណើមចុងក្រោយ</span>
              <span className="stat-value">
                {health.lastLog?.tempC !== undefined ? num(health.lastLog.tempC, 0) : "—"}
                <em>{health.lastLog?.moisturePct !== undefined ? `${num(health.lastLog.moisturePct)}% សំណើម` : "°C"}</em>
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">កូរចុងក្រោយ</span>
              <span className="stat-value">
                {turn.daysSince > 400 ? "—" : int(turn.daysSince)}
                <em>ថ្ងៃមុន</em>
              </span>
            </div>
          </div>
          {health.advice.length > 0 && (
            <p className="note-box" style={{ borderColor: "#e5cf9c", background: "#fbf1dc" }}>
              <b>អនុសាសន៍ឥឡូវនេះ៖</b> {health.advice.join(" · ")}
            </p>
          )}
          <p className="panel-hint">
            ចាប់ផ្តើម {dateKh(lot.startDate)} → គោលដៅ {dateKh(lot.targetDate)} · អ្នកទទួលខុសត្រូវ {lot.operator}
            {lot.note ? ` · ${lot.note}` : ""}
          </p>
        </div>
      )}
    </article>
  );
}

function OpenLotModal({ db, onClose, go }: { db: DbShape; onClose: () => void; go: Go }) {
  const active = db.recipes.filter((r) => r.status === "active");
  const [recipeId, setRecipeId] = useState(active[0]?.id ?? "");
  const [plannedKg, setPlannedKg] = useState<number>(active[0]?.targetKg ?? 5000);
  const [windrow, setWindrow] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [operator, setOperator] = useState(db.meta.operator);
  const [note, setNote] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const recipe = recipeById(db, recipeId);
  const plan = recipe ? planForLot(db, recipe, isFinite(plannedKg) ? plannedKg : 0) : [];
  const total = plan.reduce((s, p) => s + p.cost, 0);
  const shortCount = plan.filter((p) => p.short > 0.05).length;

  return (
    <Modal open wide title="បើក Lot ផលិតកម្មថ្មី" onClose={onClose}>
      {!active.length ? (
        <p>
          ត្រូវមានរូបមន្តសកម្មមុនសិន។ <span className="panel-hint">ទៅផ្ទាំង «រូបមន្តផលិតកម្ម» ដើម្បីបង្កើត។</span>
        </p>
      ) : (
        <>
          <div className="form-grid">
            <Field label="រូបមន្តផលិតកម្ម" wide>
              <select
                className="input select"
                value={recipeId}
                onChange={(e) => {
                  setRecipeId(e.target.value);
                  const r = recipeById(db, e.target.value);
                  if (r) setPlannedKg(r.targetKg);
                }}
              >
                {active.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {int(r.targetKg)} គ.ក · {r.productName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ទម្ងន់ចូលផលិត (គ.ក)">
              <Num value={plannedKg} onChange={setPlannedKg} step={250} />
            </Field>
            <Field label="លេខជារបៀង" hint="ឧ. W1, ជារបៀងទន្លេ">
              <Text value={windrow} onChange={setWindrow} placeholder="W1" />
            </Field>
            <Field label="ថ្ងៃចាប់ផ្តើម">
              <Text value={startDate} onChange={setStartDate} type="date" />
            </Field>
            <Field label="អ្នកទទួលខុសត្រូវ">
              <Text value={operator} onChange={setOperator} />
            </Field>
            <Field label="កំណត់ហេតុ Lot" wide>
              <Text value={note} onChange={setNote} placeholder="អាកាសធាតុ · ប្រភពវត្ថុធាតុចូល..." />
            </Field>
          </div>

          <Panel title="តារាងប្រើវត្ថុធាតុដើម (គណនាស្វ័យប្រវត្តិ)" hint="Lot នឹងកាត់ស្តុកភ្លាមៗ នៅពេលបញ្ជាក់">
            <ul className="checks">
              {plan.map((p) => (
                <li key={p.materialId}>
                  <span>
                    {p.name} {p.short > 0.05 && <Tag tone="bad">ខ្វះ {num(p.short)} {p.unit}</Tag>}
                  </span>
                  <span className="num">
                    {num(p.qty)} {p.unit} · ស្តុក {num(p.available)} · {int(p.cost)} រៀល
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="note-box">
            ថ្លៃដើមវត្ថុធាតុដើមរំពឹង៖ <b>{total ? money(total) : "—"}</b> · ទិន្នផលរំពឹង{" "}
            {recipe ? `${int((plannedKg * recipe.yieldPct) / 100)} គ.ក` : "—"} · ថ្ងៃបញ្ចប់គោលដៅ{" "}
            {dateKh(addDays(startDate, recipe?.fermentationDays ?? 45))}
          </div>

          {problems.length > 0 && (
            <ul className="alerts">
              {problems.map((p) => (
                <li key={p} className="alert alert--danger">
                  <span className="alert-dot" />
                  <span>
                    <b>ខ្វះស្តុក</b>
                    {p}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="save-bar">
            <span className="panel-hint">
              {shortCount ? `${shortCount} មុខខ្វះស្តុក — ទិញចូល ឬបន្ថយទម្ងន់` : "ស្តុកគ្រប់គ្រាន់សម្រាប់ Lot នេះ"}
            </span>
            <div className="row-actions">
              <Button onClick={onClose}>បោះបង់</Button>
              <Button
                variant="primary"
                disabled={!recipe || !isFinite(plannedKg) || plannedKg <= 0}
                onClick={() => {
                  const res = openLot({ recipeId, plannedKg, windrow, startDate, operator, note: note || undefined });
                  if (res.ok && res.lotId) {
                    onClose();
                    go("lots", { lotId: res.lotId });
                  } else if (!res.ok) {
                    setProblems(res.problems);
                  }
                }}
              >
                បើក Lot និងកាត់ស្តុក
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
