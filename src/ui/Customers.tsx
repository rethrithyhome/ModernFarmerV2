import { useState } from "react";
import type { Customer, DbShape } from "../lib/types";
import { CUSTOMER_TYPE_LABEL } from "../lib/types";
import { allCustomerStats, outstandingTotal } from "../lib/engine";
import { dateKh, diffDays, int, num, todayISO } from "../lib/format";
import { Button, Empty, Panel, Stat, Table, Tag } from "./kit";
import type { Go } from "../lib/nav";
import { CustomerForm, HistoryModal } from "./CustomerPanels";

export function Customers({ db, go }: { db: DbShape; go: Go }) {
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const stats = allCustomerStats(db);
  const due = outstandingTotal(db);
  const recent = stats.filter((c) => c.lastDate && diffDays(c.lastDate, todayISO()) <= 90);

  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat label="អតិថិជន" value={int(db.customers.length)} unit="នាក់" note="កសិដ្ឋាន សហគមន៍ អ្នកចែកចាយ" />
        <Stat
          label="ជីដែលបានលក់"
          value={int(stats.reduce((s, c) => s + c.kg, 0))}
          unit="គ.ក"
          note={`${int(stats.reduce((s, c) => s + c.orders, 0))} ការបញ្ជាទិញ`}
        />
        <Stat
          label="តម្លៃលក់សរុប"
          value={int(stats.reduce((s, c) => s + c.amount, 0) / 1000)}
          unit="ពាន់ រៀល"
          tone="good"
        />
        <Stat
          label="សល់ជំពាក់"
          value={int(due / 1000)}
          unit="ពាន់ រៀល"
          tone={due > 0 ? "bad" : "good"}
          note={`${int(stats.filter((c) => c.due > 0).length)} នាក់កំពុងជំពាក់`}
        />
      </div>

      <Panel
        title="បញ្ជីអតិថិជន"
        hint="រៀងតាមតម្លៃលក់ · ចុច «ប្រវត្តិ» ដើម្បីមើលការទិញ ការបង់ប្រាក់ និងអាយុជំពាក់"
        action={
          <div className="row-actions">
            <Button onClick={() => go("finished")}>ទៅបញ្ចេញលក់</Button>
            <Button variant="primary" onClick={() => setEditing("new")}>
              + អតិថិជនថ្មី
            </Button>
          </div>
        }
      >
        <Table head={["អតិថិជន", "ប្រភេទ", "ទូរស័ព្ទ", "គ.ក", "តម្លៃលក់", "សល់ជំពាក់", "ទិញចុងក្រោយ", ""]}
          soft={[2, 3, 4, 5, 7]}
          dense>
          {stats.length ? (
            stats.map((c) => {
              const row = db.customers.find((x) => x.id === c.id)!;
              const over = !!row.creditLimit && c.due > row.creditLimit;
              return (
                <tr key={c.id}>
                  <td>
                    <button className="btn btn--quiet strong" onClick={() => setOpen(c.id)}>
                      {c.name}
                    </button>
                    <br />
                    <span className="panel-hint">{row.location ?? "—"}</span>
                  </td>
                  <td>
                    <Tag tone="info">{CUSTOMER_TYPE_LABEL[row.type]}</Tag>
                  </td>
                  <td className="num">{row.phone ?? "—"}</td>
                  <td className="n">{int(c.kg)}</td>
                  <td className="n">{int(c.amount / 1000)}k</td>
                  <td className="n">
                    <span style={{ color: over ? "var(--clay)" : c.due ? "var(--amber)" : undefined }}>
                      {int(c.due / 1000)}k
                    </span>
                    {over && <Tag tone="bad">លើសដែនកំណត់</Tag>}
                  </td>
                  <td>
                    {c.lastDate
                      ? `${dateKh(c.lastDate)} · ${int(diffDays(c.lastDate, todayISO()))} ថ្ងៃមុន`
                      : "មិនទាន់ទិញ"}
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button onClick={() => setOpen(c.id)}>ប្រវត្តិ</Button>
                      <Button variant="quiet" onClick={() => setEditing(row)}>
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
                <Empty>មិនទាន់មានអតិថិជន។ បន្ថែមមុនពេលកត់ការបញ្ចេញលក់ ដើម្បីតាមដានបាន។</Empty>
              </td>
            </tr>
          )}
        </Table>
      </Panel>

      <Panel title="អ្នកទិញញឹកញាប់ក្នុង ៩០ ថ្ងៃចុងក្រោយ" hint="ទាក់ទងមុនរដូវបន្ទាប់ ដើម្បីរក្សាបន្ទាត់លក់">
        <Table head={["អតិថិជន", "លើក", "គ.ក", "មុខច្រើន", "ស្ថានភាព"]} dense>
          {recent.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td className="n">{int(c.orders)}</td>
              <td className="n">{num(c.kg, 0)}</td>
              <td>{c.favouriteProduct ?? "—"}</td>
              <td>
                <Tag tone={c.due > 0 ? "warn" : "good"}>
                  {c.due > 0 ? `ជំពាក់ ${int(c.due / 1000)}k រៀល` : "បង់អស់ហើយ"}
                </Tag>
              </td>
            </tr>
          ))}
          {!recent.length && (
            <tr>
              <td colSpan={5}>
                <Empty>គ្មានការលក់ក្នុង ៩០ ថ្ងៃចុងក្រោយទេ។</Empty>
              </td>
            </tr>
          )}
        </Table>
      </Panel>

      {editing && (
        <CustomerForm
          customer={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {open && <HistoryModal db={db} customerId={open} onClose={() => setOpen(null)} go={go} />}
    </div>
  );
}
