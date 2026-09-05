import { useState } from "react";
import type { Customer, DbShape } from "../lib/types";
import { CUSTOMER_TYPE_LABEL, PAYMENT_LABEL, PRODUCT_REASON_LABEL } from "../lib/types";
import {
  customerAging,
  customerById,
  customerStats,
  movementAmount,
  movementDue,
  movementsOfCustomer,
} from "../lib/engine";
import { payCustomer, saveCustomer } from "../lib/store";
import { dateKh, int, money, todayISO } from "../lib/format";
import { Button, Choice, Field, Modal, Panel, Stat, Table, Tag, Text, isNum } from "./kit";
import { InvoiceButton, InvoiceModal } from "./Invoice";
import { readPrefs } from "../lib/prefs";
import type { Go } from "../lib/nav";

const digits = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

export function CustomerForm({ customer, onClose }: { customer?: Customer; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Customer>>(
    customer ?? { type: "farm", name: "", phone: "", location: "", creditLimit: 0, note: "" },
  );
  const set = (patch: Partial<Customer>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Modal open title={customer ? `កែអតិថិជន · ${customer.name}` : "អតិថិជនថ្មី"} onClose={onClose}>
      <div className="form-grid">
        <Field label="ឈ្មោះ / អង្គភាព" wide>
          <Text value={form.name ?? ""} onChange={(v) => set({ name: v })} placeholder="កសិដ្ឋាន …" />
        </Field>
        <Field label="ទូរស័ព្ទ">
          <Text value={form.phone ?? ""} onChange={(v) => set({ phone: v })} placeholder="012 345 678" />
        </Field>
        <Field label="ប្រភេទ">
          <Choice
            value={form.type ?? "farm"}
            onChange={(v) => set({ type: v as Customer["type"] })}
            options={Object.entries(CUSTOMER_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="ទីតាំង" hint="ខេត្ត · ស្រុក">
          <Text value={form.location ?? ""} onChange={(v) => set({ location: v })} />
        </Field>
        <Field label="ដែនកំណត់ជំពាក់ (រៀល)" hint="ប្រព័ន្ធនឹងព្រមានបើលើស">
          <Text value={String(form.creditLimit ?? 0)} onChange={(v) => set({ creditLimit: digits(v) })} />
        </Field>
        <Field label="កំណត់ហេតុ" wide>
          <Text value={form.note ?? ""} onChange={(v) => set({ note: v })} placeholder="អ្វីគាត់ចូលចិត្ត · រដូវទិញ…" />
        </Field>
      </div>
      <div className="save-bar">
        <span className="panel-hint">រក្សាទុកលើឧបករណ៍នេះ — ចុច «ទាញយក JSON» ដើម្បីបម្រុងទុក</span>
        <div className="row-actions">
          <Button onClick={onClose}>បោះបង់</Button>
          <Button
            variant="primary"
            disabled={!(form.name ?? "").trim()}
            onClick={() => {
              saveCustomer(form as Customer & { name: string });
              onClose();
            }}
          >
            រក្សាទុក
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function HistoryModal({
  db,
  customerId,
  onClose,
  go,
}: {
  db: DbShape;
  customerId: string;
  onClose: () => void;
  go: Go;
}) {
  const stats = customerStats(db, customerId);
  const customer = customerById(db, customerId);
  const rows = movementsOfCustomer(db, customerId);
  const aging = customerAging(db, customerId);
  const [amount, setAmount] = useState<number>(stats?.due ?? 0);
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(todayISO());
  const [invoice, setInvoice] = useState<string | null>(null);
  const due = stats?.due ?? 0;

  return (
    <Modal open wide title={customer ? `ប្រវត្តិ · ${customer.name}` : "ប្រវត្តិអតិថិជន"} onClose={onClose}>
      <div className="grid-stats">
        <Stat label="ជីដែលបានទិញ" value={int(stats?.kg ?? 0)} unit="គ.ក" note={`${int(stats?.orders ?? 0)} លើក`} />
        <Stat label="តម្លៃសរុប" value={int((stats?.amount ?? 0) / 1000)} unit="ពាន់ រៀល" />
        <Stat
          label="សល់ជំពាក់"
          value={int(due / 1000)}
          unit="ពាន់ រៀល"
          tone={due > 0 ? "bad" : "good"}
          note={customer?.creditLimit ? `ដែនកំណត់ ${int(customer.creditLimit / 1000)}k` : "គ្មានដែនកំណត់"}
        />
        <Stat
          label="មុខចូលចិត្ត"
          value={stats?.favouriteProduct ?? "—"}
          note={stats?.lastDate ? `ចុងក្រោយ ${dateKh(stats.lastDate)}` : "មិនទាន់ទិញ"}
        />
      </div>

      {due > 0 && (
        <Panel title="អាយុជំពាក់" hint="ការបង់ប្រាក់កាត់តាមវិក្កយបត្រដែលចេញមុនគេ">
          <div className="grid-stats">
            <Stat label="ក្នុង ៣០ ថ្ងៃ" value={int(aging.current / 1000)} unit="k រៀល" />
            <Stat label="៣១–៦០ ថ្ងៃ" value={int(aging.d30 / 1000)} unit="k រៀល" tone="warn" />
            <Stat label="៦១–៩០ ថ្ងៃ" value={int(aging.d60 / 1000)} unit="k រៀល" tone="warn" />
            <Stat label="លើស ៩០ ថ្ងៃ" value={int(aging.older / 1000)} unit="k រៀល" tone="bad" />
          </div>
          <div className="form-grid" style={{ marginTop: "0.9rem", alignItems: "end" }}>
            <Field label="ចំនួនបានបង់ (រៀល)">
              <Text value={String(isNum(amount) ? Math.round(amount) : 0)} onChange={(v) => setAmount(digits(v))} />
            </Field>
            <Field label="វិធីបង់">
              <Choice
                value={method}
                onChange={setMethod}
                options={[
                  { value: "cash", label: PAYMENT_LABEL.cash },
                  { value: "transfer", label: PAYMENT_LABEL.transfer },
                ]}
              />
            </Field>
            <Field label="ថ្ងៃបង់">
              <Text value={date} onChange={setDate} type="date" />
            </Field>
            <div className="field">
              <Button
                variant="primary"
                disabled={!isNum(amount) || amount <= 0}
                onClick={() => {
                  payCustomer(customerId, Math.min(amount, due), method as "cash" | "transfer");
                  onClose();
                }}
              >
                កត់ការបង់ប្រាក់
              </Button>
            </div>
          </div>
          {isNum(amount) && amount > due && (
            <p className="panel-hint" style={{ marginTop: "0.5rem" }}>
              ចំនួននេះសល់ជា «បង់មុន» នៅលើវិក្កយបត្រចុងក្រោយ
            </p>
          )}
        </Panel>
      )}

      <Table head={["ថ្ងៃ", "សកម្មភាព", "ផលិតផល", "គ.ក", "តម្លៃ", "បានបង់", "សល់", "Lot / វិក្កយបត្រ"]} dense>
        {rows.length ? (
          rows.map((mv) => {
            const product = db.products.find((p) => p.id === mv.productId);
            const lot = mv.lotId ? db.lots.find((l) => l.id === mv.lotId) : undefined;
            const rowDue = movementDue(mv);
            return (
              <tr key={mv.id}>
                <td>
                  {dateKh(mv.date)}
                  <br />
                  <span className="panel-hint">{mv.party ?? mv.operator ?? "—"}</span>
                </td>
                <td>
                  <Tag tone={mv.dir === "in" ? "good" : "info"}>{PRODUCT_REASON_LABEL[mv.reason]}</Tag>
                  {mv.paymentMethod && <span className="panel-hint"> {PAYMENT_LABEL[mv.paymentMethod]}</span>}
                </td>
                <td>{product?.name ?? "—"}</td>
                <td className="n">{int(mv.qtyKg)}</td>
                <td className="n">{mv.dir === "out" ? `${int(movementAmount(mv) / 1000)}k` : "—"}</td>
                <td className="n">{int((mv.paid ?? 0) / 1000)}k</td>
                <td className="n" style={{ color: rowDue ? "var(--clay)" : undefined }}>
                  {int(rowDue / 1000)}k
                </td>
                <td>
                  {lot ? (
                    <button className="btn btn--quiet" onClick={() => go("lots", { lotId: lot.id })}>
                      {lot.code}
                    </button>
                  ) : null}{" "}
                  <InvoiceButton db={db} movementId={mv.id} onOpen={setInvoice} />
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={8}>
              <p className="empty">
                {customer
                  ? `${customer.name} មិនទាន់ទិញទេ — កត់ការបញ្ចេញលក់នៅផ្ទាំង «ផលិតផលសម្រេច»`
                  : "គ្មានទិន្នន័យ"}
              </p>
            </td>
          </tr>
        )}
      </Table>

      <div className="save-bar">
        <span className="panel-hint">{customer?.note || `${money(stats?.amount ?? 0)} សរុបពីដើមឆ្នាំ`}</span>
        <Button onClick={onClose}>បិទ</Button>
      </div>
      {invoice && (
        <InvoiceModal db={db} movementId={invoice} business={readPrefs().business} onClose={() => setInvoice(null)} />
      )}
    </Modal>
  );
}
