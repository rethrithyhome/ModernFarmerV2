import { useMemo, useState } from "react";
import type { DbShape, Lot } from "../lib/types";
import { STAGE_LABEL, STATUS_LABEL } from "../lib/types";
import { dateKh, int } from "../lib/format";
import { Button, Empty, Panel, Tag } from "./kit";
import { Qr, labelFacts, lotUrl, printLabels } from "./qr";
import type { Go } from "../lib/nav";

export function Labels({ db, go, lotId }: { db: DbShape; go: Go; lotId?: string }) {
  const [scope, setScope] = useState<"open" | "closed" | "all">("open");
  const [query, setQuery] = useState("");
  const lots = useMemo(() => {
    const list = db.lots.filter((l) =>
      scope === "all" ? true : scope === "closed" ? l.status === "closed" : l.status !== "closed",
    );
    const q = query.trim().toLowerCase();
    return list
      .filter((l) => (q ? `${l.code} ${l.windrow} ${l.recipeId}`.toLowerCase().includes(q) : true))
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }, [db, scope, query]);

  const [picked, setPicked] = useState<string[]>(lotId ? [lotId] : []);
  const selected = lots.filter((l) => picked.includes(l.id));
  const shown = selected.length ? selected : lots.slice(0, 4);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="stack">
      <Panel
        title="ស្លាក QR តាម Lot"
        hint="ជ្រើស Lot រួចបោះពុម្ព — QR មានលេខសម្គាល់ Lot ដែលបើកទៅទំព័រផលិតកម្មរបស់វា"
        action={
          <div className="row-actions">
            {(["open", "closed", "all"] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`btn ${scope === k ? "btn--primary" : "btn--quiet"}`}
                onClick={() => setScope(k)}
              >
                {k === "open" ? "កំពុងផលិត" : k === "closed" ? "បានបញ្ចប់" : "ទាំងអស់"}
              </button>
            ))}
            <input
              className="input"
              style={{ maxWidth: 160 }}
              placeholder="រក LOT ឬរបៀង"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button variant="primary" onClick={printLabels} disabled={!shown.length}>
              បោះពុម្ព {int(shown.length)} ស្លាក
            </Button>
          </div>
        }
      >
        {lots.length ? (
          <div className="pick-grid">
            {lots.map((lot) => (
              <label key={lot.id} className={`pick ${picked.includes(lot.id) ? "pick--on" : ""}`}>
                <input
                  type="checkbox"
                  checked={picked.includes(lot.id)}
                  onChange={() => toggle(lot.id)}
                />
                <span className="pick-code">{lot.code}</span>
                <span className="panel-hint">
                  {STAGE_LABEL[lot.stage]} · {int(lot.plannedKg)} គ.ក · របៀង {lot.windrow || "—"}
                </span>
                <button className="btn btn--quiet" onClick={(e) => { e.preventDefault(); go("lots", { lotId: lot.id }); }}>
                  បើក Lot
                </button>
              </label>
            ))}
          </div>
        ) : (
          <Empty>គ្មាន Lot ក្នុងចម្រុះនេះ — ប្តូរទៅ «ទាំងអស់» ឬស្វែងរកលេខផ្សេង។</Empty>
        )}
        {picked.length > 0 && (
          <p className="panel-hint" style={{ marginTop: "0.7rem" }}>
            បានជ្រើស {int(picked.length)} ·{" "}
            <button className="btn btn--quiet" onClick={() => setPicked([])}>
              ដកការជ្រើសរើស
            </button>
          </p>
        )}
      </Panel>

      <div className="label-sheet">
        {shown.map((lot) => (
          <LabelCard key={lot.id} db={db} lot={lot} />
        ))}
      </div>
      <p className="print-only">
        ចំណាំពេលបោះពុម្ព៖ ក្រដាសស្ទីគឺ A4 — កាត់តាមខ្សែ។ រក្សាស្លាកនៅជិតជារបៀង ហើយស្កេនមុនកត់ការវាស់។
      </p>
    </div>
  );
}

function LabelCard({ db, lot }: { db: DbShape; lot: Lot }) {
  const facts = labelFacts(db, lot);
  return (
    <article className="label-card">
      <Qr text={lotUrl(lot)} size={112} />
      <div className="label-info">
        <h3 className="label-code">{facts.code}</h3>
        <p className="label-line">
          <b>{facts.product}</b>
        </p>
        <p className="label-line">
          {facts.recipe} · របៀង {facts.windrow}
        </p>
        <p className="label-line">
          ចាប់ផ្តើម {dateKh(facts.start)} · គោលដៅ {dateKh(facts.target)}
        </p>
        <p className="label-line">
          គម្រោង {int(facts.plannedKg)} គ.ក
          {facts.actualKg !== undefined ? ` · ជាក់ស្តែង ${int(facts.actualKg)} គ.ក` : ""} ·{" "}
          <Tag tone={lot.status === "closed" ? "neutral" : "info"}>{STATUS_LABEL[lot.status]}</Tag>
        </p>
        <p className="label-url">{facts.url}</p>
      </div>
    </article>
  );
}
