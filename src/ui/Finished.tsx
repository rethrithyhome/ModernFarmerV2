import { useState } from "react";
import type { Customer, DbShape, Product } from "../lib/types";
import { PAYMENT_LABEL, PRODUCT_REASON_LABEL } from "../lib/types";
import {
  customerById,
  finalQcOf,
  lotById,
  lotGrade,
  lotsWithStock,
  movementAmount,
  movementDue,
  pricePerBagFor,
  productRevenue,
  productStockKg,
} from "../lib/engine";
import { productMovement, saveProduct } from "../lib/store";
import { dateKh, int, money, num, todayISO } from "../lib/format";
import { readPrefs } from "../lib/prefs";
import { Button, Choice, Empty, Field, Modal, Num, Panel, Stat, Table, Tag, Text, isNum } from "./kit";
import { InvoiceButton, InvoiceModal } from "./Invoice";
import type { Go } from "../lib/nav";

export function Finished({ db, go }: { db: DbShape; go: Go }) {
  const [invoice, setInvoice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dispatching, setDispatching] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);

  const rows = db.products.map((p) => ({
    product: p,
    stock: productStockKg(db, p.id),
    produced: db.productMovements
      .filter((mv) => mv.productId === p.id && mv.reason === "produce")
      .reduce((s, mv) => s + mv.qtyKg, 0),
    dispatched: db.productMovements
      .filter((mv) => mv.productId === p.id && mv.dir === "out")
      .reduce((s, mv) => s + mv.qtyKg, 0),
    sold: db.productMovements
      .filter((mv) => mv.productId === p.id && mv.dir === "out")
      .reduce((s, mv) => s + mv.qtyKg * mv.unitPrice, 0),
  }));
  const totalRevenue = rows.reduce((s, r) => s + r.sold, 0);
  const stockValue = rows.reduce(
    (s, r) => s + (r.stock / (r.product.bagSizeKg || 25)) * r.product.pricePerBag,
    0,
  );

  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat label="មុខផលិតផល" value={int(db.products.length)} unit="មុខ" note="ភ្ជាប់ជាមួយរូបមន្តផលិតកម្ម" />
        <Stat
          label="ស្តុកក្នុងស្រែ/ឃ្លាំង"
          value={int(rows.reduce((s, r) => s + r.stock, 0))}
          unit="គ.ក"
          note={`≈ ${int(rows.reduce((s, r) => s + r.stock / (r.product.bagSizeKg || 25), 0))} ថង់`}
        />
        <Stat label="តម្លៃស្តុកតាមថ្លៃលក់" value={int(stockValue / 1000)} unit="ពាន់ រៀល" tone="good" />
        <Stat label="ចំណូលពីបញ្ចេញលក់" value={int(totalRevenue / 1000)} unit="ពាន់ រៀល" note="គិតតាមតម្លៃក្នុងចលនាបញ្ចេញ" />
      </div>

      <Panel
        title="ផលិតផលសម្រេច"
        hint="Lot ដែលបញ្ចប់នឹងបញ្ចូលស្តុកទាំងនេះ ហើយការបញ្ចេញនឹងកាត់ចេញភ្លាម"
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            + មុខផលិតផល
          </Button>
        }
      >
        <Table head={[
            "ផលិតផល",
            "ថ្លៃ/ថង់",
            "ស្តុក",
            "ថង់",
            "បានផលិត",
            "បានបញ្ចេញ",
            "ចំណូល",
            "",
          ]}
          soft={[2, 4, 5, 6]}
          dense>
          {rows.length ? (
            rows.map(({ product, stock, produced, dispatched, sold }) => (
              <tr key={product.id}>
                <td>
                  <span className="strong">{product.name}</span>
                  <br />
                  <span className="panel-hint">
                    {product.bagSizeKg} គ.ក/ថង់
                    {product.recipeId ? ` · ${db.recipes.find((r) => r.id === product.recipeId)?.name ?? ""}` : ""}
                  </span>
                </td>
                <td className="n">{int(product.pricePerBag)}</td>
                <td className="n">{int(stock)}</td>
                <td className="n">{int(stock / (product.bagSizeKg || 25))}</td>
                <td className="n">{int(produced)}</td>
                <td className="n">{int(dispatched)}</td>
                <td className="n">{int(sold / 1000)}k</td>
                <td>
                  <div className="row-actions">
                    <Button onClick={() => setDispatching(product)} disabled={stock <= 0}>
                      បញ្ចេញ
                    </Button>
                    <Button variant="quiet" onClick={() => setEditing(product)}>
                      កែ
                    </Button>
                    <Button variant="quiet" onClick={() => go("reports")}>
                      របាយ
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8}>
                <Empty>មិនទាន់មានមុខផលិតផល។ បង្កើតមុខផលិតផល ដើម្បីទទួល Lot ដែលបញ្ចប់។</Empty>
              </td>
            </tr>
          )}
        </Table>
      </Panel>

      <Panel title="ចលនាផលិតផលចុងក្រោយ" hint="បញ្ចូលពី Lot · បញ្ចេញទៅអតិថិជន · ការកែស្តុក">
        <Table head={["ថ្ងៃ", "ផលិតផល", "ប្រភេទ", "គ.ក", "វិក្កយបត្រ", "បានបង់", "សល់", "អ្នកទទួល / Lot"]}
          soft={[5, 6, 8]} dense>
          {[...db.productMovements]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 14)
            .map((mv) => {
              const product = db.products.find((p) => p.id === mv.productId);
              const lot = mv.lotId ? lotById(db, mv.lotId) : undefined;
              const customer = customerById(db, mv.customerId);
              const qc = lot ? finalQcOf(db, lot.id) : undefined;
              return (
                <tr key={mv.id}>
                  <td>{dateKh(mv.date)}</td>
                  <td>{product?.name ?? "—"}</td>
                  <td>
                    <Tag tone={mv.dir === "in" ? "good" : "info"}>{PRODUCT_REASON_LABEL[mv.reason]}</Tag>
                  </td>
                  <td className="n">
                    {mv.dir === "in" ? "+" : "−"}
                    {int(mv.qtyKg)}
                  </td>
                  <td className="n">{mv.unitPrice ? int(mv.unitPrice) : "—"}</td>
                  <td className="panel-hint">
                    {lot ? (
                      <button className="btn btn--quiet" onClick={() => go("lots", { lotId: lot.id })}>
                        {lot.code}
                      </button>
                    ) : (
                      mv.party ?? "—"
                    )}
                    {qc && <Tag tone={qc.result === "pass" ? "good" : qc.result === "fail" ? "bad" : "warn"}> QC {qc.result === "pass" ? "ជាប់" : qc.result === "fail" ? "ចាញ់" : "?"}</Tag>}
                  </td>
                  <td className="panel-hint">
                    {mv.operator || "—"} <InvoiceButton db={db} movementId={mv.id} onOpen={setInvoice} />
                  </td>
                </tr>
              );
            })}
          {!db.productMovements.length && (
            <tr>
              <td colSpan={8}>
                <Empty>គ្មានចលនា។</Empty>
              </td>
            </tr>
          )}
        </Table>
      </Panel>

      {invoice && <InvoiceModal db={db} movementId={invoice} business={readPrefs().business} onClose={() => setInvoice(null)} />}
      {dispatching && (
        <DispatchModal product={dispatching} db={db} onClose={() => setDispatching(null)} />
      )}
      {(adding || editing) && (
        <ProductModal product={editing ?? undefined} db={db} onClose={() => { setAdding(false); setEditing(null); }} />
      )}
    </div>
  );
}

function DispatchModal({ product, db, onClose }: { product: Product; db: DbShape; onClose: () => void }) {
  const stock = productStockKg(db, product.id);
  const lotGrades = db.lots
    .filter((l) => l.actualKg)
    .map((l) => ({ lot: l, grade: lotGrade(db, l.id) }))
    .filter((x) => x.grade === "B" || x.grade === "C");
  const [qtyKg, setQtyKg] = useState<number>(Math.min(1000, stock));
  const [price, setPrice] = useState<number>(product.pricePerBag / (product.bagSizeKg || 25));
  const [customerId, setCustomerId] = useState("");
  const [lotId, setLotId] = useState("");
  const lots = lotsWithStock(db, product.id, db.recipes.find((r) => r.productName === product.name)?.id);
  const chosen = lots.find((x) => x.lot.id === lotId);
  const capKg = chosen ? chosen.remaining : stock;
  const [party, setParty] = useState("");
  const [paid, setPaid] = useState<number>(0);
  const [method, setMethod] = useState<"cash" | "transfer" | "credit">("cash");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<"dispatch" | "return" | "adjust">("dispatch");
  const customer = customerById(db, customerId);
  const amount = Math.round((isNum(qtyKg) ? qtyKg : 0) * (isNum(price) ? price : 0));
  const paidNow = reason === "dispatch" ? Math.min(isNum(paid) ? paid : 0, amount) : 0;
  const ok =
    isNum(qtyKg) && qtyKg > 0 && (reason !== "dispatch" || qtyKg <= capKg) && paidNow <= amount;
  const overCredit =
    reason === "dispatch" &&
    customer?.creditLimit !== undefined &&
    amount - paidNow > creditOf(db, customer) + customer.creditLimit;

  return (
    <Modal open title={`បញ្ចេញផលិតផល · ${product.name}`} onClose={onClose}>
      <p className="panel-hint">ស្តុកបច្ចុប្បន្ន {int(stock)} គ.ក ≈ {int(stock / (product.bagSizeKg || 25))} ថង់</p>
      <div className="form-grid">
        <Field label="សកម្មភាព">
          <Choice
            value={reason}
            onChange={(v) => setReason(v as typeof reason)}
            options={[
              { value: "dispatch", label: "បញ្ចេញលក់" },
              { value: "return", label: "អតិថិជនប្រគល់មកវិញ" },
              { value: "adjust", label: "កែស្តុក (រាប់ពិត)" },
            ]}
          />
        </Field>
        <Field label="ទម្ងន់ (គ.ក)" hint={`${int(capKg)} គ.ក មាននៅទីនេះ`}>
          <Num value={qtyKg} step={50} onChange={setQtyKg} />
        </Field>
        <Field label="ថ្លៃលក់ (រៀល/គ.ក)" hint={`${int(product.pricePerBag)} រៀល/ថង់`}>
          <Num value={price} step={50} onChange={setPrice} />
        </Field>
        <Field label="Lot ដើម" hint="Lot ដែលមានជីនៅសល់ · តម្លៃនឹងប្តូរតាមថ្នាក់" wide>
          <Choice
            value={lotId}
            onChange={(v) => {
              setLotId(v);
              const picked = lots.find((x) => x.lot.id === v);
              const perBag = pricePerBagFor(product, picked?.grade);
              setPrice(perBag / (product.bagSizeKg || 25));
              setQtyKg(Math.min(isNum(qtyKg) ? qtyKg : 0, picked ? picked.remaining : stock));
            }}
            options={[
              { value: "", label: "— មិនបញ្ជាក់ Lot —" },
              ...lots.map((x) => ({
                value: x.lot.id,
                label: `${x.lot.code} · នៅសល់ ${int(x.remaining)} គ.ក${x.grade ? ` · ថ្នាក់ ${x.grade}` : ""}`,
              })),
            ]}
          />
        </Field>
        <Field label="អតិថិជន" wide>
          <Choice
            value={customerId}
            onChange={(v) => {
              setCustomerId(v);
              const c = customerById(db, v);
              if (c) setParty(c.name);
            }}
            options={[
              { value: "", label: "— គ្មាន (លក់ទូទៅ) —" },
              ...db.customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` · ${c.phone}` : ""}` })),
            ]}
          />
        </Field>
        <Field label="ឈ្មោះអ្នកទទួល" hint="បើមិនទាន់មានអតិថិជនក្នុងបញ្ជី">
          <Text value={party} onChange={setParty} />
        </Field>
        <Field label="ថ្ងៃបញ្ចេញ">
          <Text value={date} onChange={setDate} type="date" />
        </Field>
        <Field label="កំណត់ហេតុ" wide>
          <Text value={note} onChange={setNote} placeholder="លេខវិក័យបត្រ ឬឡាន" />
        </Field>
      </div>
      <div className="form-grid" style={{ marginTop: "0.2rem" }}>
        <Field label="វិក្កយបត្រសរុប (រៀល)" hint="គ.ក × ថ្លៃលក់">
          <input className="input input--num" value={amount} readOnly />
        </Field>
        <Field label="បានបង់ឥឡូវ (រៀល)">
          <Num value={paid} step={5000} onChange={setPaid} />
        </Field>
        <Field label="វិធីបង់">
          <Choice
            value={method}
            onChange={(v) => setMethod(v as typeof method)}
            options={(["cash", "transfer", "credit"] as const).map((v) => ({
              value: v,
              label: PAYMENT_LABEL[v],
            }))}
          />
        </Field>
      </div>
      <div className="note-box">
        សង្ខេប · បញ្ចេញពីស្តុក <b>{int(isNum(qtyKg) ? qtyKg : 0)}</b> គ.ក · វិក្កយបត្រ <b>{money(amount)}</b> · សល់ជំពាក់{" "}
        <b>{money(amount - paidNow)}</b> · ស្តុកសល់ {int(Math.max(0, stock - qtyKg))} គ.ក
        {isNum(paid) && paid > amount && " · ចំនួនបានបង់ធំជាងវិក្កយបត្រ — នឹងកាត់តាមវិក្កយបត្រដែលចេញមុនគេ"}
      </div>
      {overCredit && (
        <p className="alert alert--danger" style={{ margin: 0 }}>
          <span className="alert-dot" />
          <span>
            <b>លើសដែនកំណត់ជំពាក់របស់ {customer?.name}</b>
            ដែនកំណត់ {money(customer?.creditLimit ?? 0)} · សូមអនុម័តដោយអ្នកគ្រប់គ្រង ឬទទួលប្រាក់សិន
          </span>
        </p>
      )}
      {chosen?.grade && (
        <p className="panel-hint">
          ថ្លៃតាមថ្នាក់ {chosen.grade} ⇒ {int(pricePerBagFor(product, chosen.grade))} រៀល/ថង់ · Lot នេះនៅសល់{" "}
          {int(chosen.remaining)} គ.ក
          {lotGrade(db, chosen.lot.id) === "C" ? " ·  Lot ថ្នាក់ C គួរលក់ជាកែដី" : ""}
        </p>
      )}
      <div className="save-bar">
        <span className="panel-hint">
          {ok ? "នឹងកត់ជាចលនាផលិតផល ភ្ជាប់នឹង Lot ជ្រើស" : "ត្រូវឱ្យតិចជាងស្តុក ឬជ្រើសសកម្មភាពផ្សេង"}
        </span>
        <div className="row-actions">
          <Button onClick={onClose}>បោះបង់</Button>
          <Button
            variant="primary"
            disabled={!ok}
            onClick={() => {
              productMovement({
                productId: product.id,
                dir: reason === "return" ? "in" : "out",
                qtyKg,
                unitPrice: reason === "dispatch" ? price : 0,
                reason,
                customerId: customerId || undefined,
                lotId: lotId || undefined,
                party: party || customer?.name,
                amount: reason === "dispatch" ? amount : undefined,
                paid: reason === "dispatch" ? paidNow : undefined,
                paymentMethod: reason === "dispatch" ? (paidNow >= amount && amount > 0 ? method : "credit") : undefined,
                date,
                note: note || undefined,
              });
              onClose();
            }}
          >
            បញ្ជាក់
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ProductModal({ product, db, onClose }: { product?: Product; db: DbShape; onClose: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [recipeId, setRecipeId] = useState(product?.recipeId ?? db.recipes[0]?.id ?? "");
  const [bag, setBag] = useState<number>(product?.bagSizeKg ?? 25);
  const [price, setPrice] = useState<number>(product?.pricePerBag ?? 12500);
  const [priceB, setPriceB] = useState<number>(product?.pricePerBagB ?? Math.round((product?.pricePerBag ?? 12500) * 0.85));
  const [priceC, setPriceC] = useState<number>(product?.pricePerBagC ?? Math.round((product?.pricePerBag ?? 12500) * 0.6));
  const [note, setNote] = useState(product?.note ?? "");
  return (
    <Modal open title={product ? `កែ · ${product.name}` : "មុខផលិតផលថ្មី"} onClose={onClose}>
      <div className="form-grid">
        <Field label="ឈ្មោះផលិតផល" wide>
          <Text value={name} onChange={setName} placeholder="ជីកំប៉ុស្តិ៍អង្ករ" />
        </Field>
        <Field label="រូបមន្តផ្គត់ផ្គង់" wide>
          <Choice
            value={recipeId}
            onChange={setRecipeId}
            options={[{ value: "", label: "— មិនភ្ជាប់ —" }, ...db.recipes.map((r) => ({ value: r.id, label: r.name }))]}
          />
        </Field>
        <Field label="ទំហំថង់ (គ.ក)">
          <Num value={bag} step={5} onChange={setBag} />
        </Field>
        <Field label="តម្លៃលក់ (រៀល/ថង់)">
          <Num value={price} step={500} onChange={setPrice} />
        </Field>
        <Field label="ថ្លៃថ្នាក់ B (រៀល/ថង់)" hint="Lot ដែល QC ចាញ់បន្តិច">
          <Num value={priceB} step={500} onChange={setPriceB} />
        </Field>
        <Field label="ថ្លៃថ្នាក់ C (រៀល/ថង់)" hint="សម្រាប់កែដី ឬលក់តម្លៃទាប">
          <Num value={priceC} step={500} onChange={setPriceC} />
        </Field>
        <Field label="កំណត់ហេតុ" wide>
          <Text value={note} onChange={setNote} />
        </Field>
      </div>
      <p className="note-box">
        ថ្លៃក្នុងមួយគីឡូ៖ A <b>{int(isNum(price) && bag ? price / bag : 0)}</b> · B{" "}
        <b>{int(isNum(priceB) && bag ? priceB / bag : 0)}</b> · C{" "}
        <b>{int(isNum(priceC) && bag ? priceC / bag : 0)}</b> រៀល · បើរូបមន្តនេះមានថ្លៃដើម <b>{int(costPerKgOf(db, recipeId))}</b> រៀល/គ.ក
      </p>
      <div className="save-bar">
        <span className="panel-hint">ការកែតម្លៃនឹងមានផលតែលើចលនាថ្មី</span>
        <div className="row-actions">
          <Button onClick={onClose}>បោះបង់</Button>
          <Button
            variant="primary"
            disabled={!name.trim() || !isNum(bag) || !isNum(price)}
            onClick={() => {
              saveProduct({
                id: product?.id,
                name,
                recipeId: recipeId || undefined,
                bagSizeKg: bag,
                pricePerBag: price,
                pricePerBagB: priceB,
                pricePerBagC: priceC,
                note: note || undefined,
              });
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

/** What a customer already owes across every dispatch. */
function creditOf(db: DbShape, customer?: Customer) {
  if (!customer) return 0;
  return db.productMovements
    .filter((mv) => mv.dir === "out" && mv.customerId === customer.id)
    .reduce((sum, mv) => sum + movementDue(mv), 0);
}

function costPerKgOf(db: DbShape, recipeId: string) {
  const recipe = db.recipes.find((r) => r.id === recipeId);
  if (!recipe) return 0;
  const inputs = recipe.lines.reduce((s, l) => {
    const m = db.materials.find((x) => x.id === l.materialId);
    return s + l.qty * (m?.costPerUnit ?? 0);
  }, 0);
  const perLot = db.lots.filter((l) => l.recipeId === recipeId);
  const extras = perLot.reduce((s, l) => s + l.extraCosts.reduce((a, c) => a + c.amount, 0), 0);
  const perLotCount = perLot.length || 1;
  return (inputs + extras / perLotCount) / ((recipe.targetKg * recipe.yieldPct) / 100 || 1);
}
