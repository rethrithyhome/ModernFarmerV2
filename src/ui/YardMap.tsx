import type { DbShape } from "../lib/types";
import { STAGE_LABEL, STAGE_ORDER } from "../lib/types";
import { tempFlag, yardMap } from "../lib/engine";
import { dateKh, diffDays, int, num, todayISO } from "../lib/format";
import { Panel } from "./kit";
import type { Go } from "../lib/nav";

/**
 * The yard view: one tile per windrow, showing the lot that occupies it, its core
 * temperature and the action it needs. Built for a supervisor walking the rows.
 */
export function YardMap({
  db,
  go,
  compact,
}: {
  db: DbShape;
  go: Go;
  compact?: boolean;
}) {
  const cells = yardMap(db);
  const busy = cells.filter((c) => c.lot && c.lot.status !== "closed").length;

  return (
    <Panel
      title="ផែជារបៀងក្នុងទីតាំង"
      hint={`${int(cells.length)} ជារបៀង · ${int(busy)} ជារបៀងកំពុងផ្កាម · ចុចជារបៀង ដើម្បីបន្ថែមការវាស់`}
      action={
        <button className="btn btn--quiet" onClick={() => go("lots")}>
          បញ្ជី Lot
        </button>
      }
    >
      {cells.length ? (
        <div className={`yard ${compact ? "yard--compact" : ""}`}>
          {cells.map((cell) => {
            const lot = cell.lot;
            const state = !lot
              ? "empty"
              : lot.status === "closed"
                ? "closed"
                : lot.status === "hold"
                  ? "hold"
                  : lot.stage;
            const flag = tempFlag(cell.tempC);
            return (
              <button
                key={cell.windrow}
                type="button"
                className={`yard-cell yard-cell--${state}`}
                disabled={!lot}
                onClick={() => lot && go("lots", { lotId: lot.id })}
              >
                <span className="yard-head">
                  <span className="yard-key">{cell.windrow}</span>
                  {cell.task && <span className="yard-turn">{cell.task}</span>}
                </span>
                <span className={`yard-temp temp--${flag}`}>
                  {cell.tempC === undefined ? "—" : `${num(cell.tempC, 0)}°`}
                </span>
                <span className="yard-code">{lot ? lot.code : "ទទេ"}</span>
                <span className="yard-meta">
                  {lot ? `${lot.status === "closed" ? "បានបញ្ចប់" : STAGE_LABEL[lot.stage]}` : "មិនទាន់ប្រើ"}
                </span>
                <span className="yard-meta">
                  {lot
                    ? lot.status === "closed"
                      ? dateKh(lot.closedDate ?? lot.startDate)
                      : `${int(diffDays(lot.startDate, todayISO()))} ថ្ងៃ · ${int(lot.plannedKg)} គ.ក ចូល`
                    : ""}
                </span>
                {!compact && lot && cell.flags.length > 0 && (
                  <span className="yard-foot">{cell.task ?? cell.flags[0]}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty">
          គ្មានជារបៀង។ បើក Lot ដំបូង ហើយបញ្ចូលលេខជារបៀង (ឧ. W1) ដើម្បីឱ្យផែនេះបង្ហាញ។
        </p>
      )}
      {!compact && (
        <div className="legend" style={{ marginTop: "0.75rem" }}>
          {STAGE_ORDER.filter((s) => s !== "finished").map((stage) => (
            <span key={stage}>
              <i style={{ background: `var(--stage-${stage})` }} />
              {STAGE_LABEL[stage]}
            </span>
          ))}
          <span>
            <i style={{ background: "var(--clay)" }} />
            ត្រូវការកូរ / ក្រៅ zone
          </span>
        </div>
      )}
    </Panel>
  );
}
