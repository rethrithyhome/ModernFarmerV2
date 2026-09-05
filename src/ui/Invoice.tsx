import { useState } from "react";
import type { DbShape } from "../lib/types";
import { GRADE_LABEL, PRODUCT_REASON_LABEL } from "../lib/types";
import { customerById, lotById, lotGrade, movementAmount, movementDue, productStockKg } from "../lib/engine";
import { dateKh, int, money, num } from "../lib/format";
import type { Business } from "../lib/prefs";
import { Button, Modal, printZone } from "./kit";
import { Qr, lotUrl } from "./qr";

const invoiceNo = (movementId: string) => `ACH-${movementId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;

/** Printable invoice / delivery note for one outbound movement. */
export function InvoiceModal({
  db,
  movementId,
  business,
  onClose,
}: {
  db: DbShape;
  movementId: string;
  business: Business;
  onClose: () => void;
}) {
  const mv = db.productMovements.find((m) => m.id === movementId);
  const product = db.products.find((p) => p.id === mv?.productId);
  const customer = customerById(db, mv?.customerId);
  const lot = mv?.lotId ? lotById(db, mv.lotId) : undefined;
  const grade = lot ? lotGrade(db, lot.id) : undefined;
  if (!mv) return null;
  const bags = product ? mv.qtyKg / (product.bagSizeKg || 25) : 0;
  const amount = movementAmount(mv);
  const due = movementDue(mv);
  return (
    <Modal open wide title={`វិក្កយបត្រ ${invoiceNo(mv.id)}`} onClose={onClose}>
      <div className="invoice print-zone">
        <header className="invoice-head">
          <div className="invoice-seller">
            <div>
              <h3>{business.name}</h3>
            {business.address && <p className="panel-hint">{business.address}</p>}
              {business.phone && <p className="panel-hint">ទូរស័ព្ទ {business.phone}</p>}
            </div>
          </div>
          <div className="invoice-meta">
            <p>
              <b>វិក្កយបត្រ {invoiceNo(mv.id)}</b>
            </p>
            <p className="panel-hint">{dateKh(mv.date)}</p>
            <p className="panel-hint">{PRODUCT_REASON_LABEL[mv.reason]}</p>
          </div>
        </header>

        <div className="invoice-parties">
          <div>
            <p className="invoice-label">អ្នកទិញ</p>
            <p>
              <b>{customer?.name ?? mv.party ?? "អតិថិជនទូទៅ"}</b>
            </p>
            {customer?.phone && <p className="panel-hint">ទូរស័ព្ទ {customer.phone}</p>}
            {customer?.location && <p className="panel-hint">{customer.location}</p>}
          </div>
          <div>
            <p className="invoice-label">ប្រភពផលិតកម្ម</p>
            {lot ? (
              <>
                <p>
                  <b>{lot.code}</b> {grade ? `· ${GRADE_LABEL[grade]}` : "· គ្មានថ្នាក់"}
                </p>
                <p className="panel-hint">
                  ចាប់ផ្តើម {dateKh(lot.startDate)}
                  {lot.closedDate ? ` · បញ្ចប់ ${dateKh(lot.closedDate)}` : ""}
                </p>
                <div className="invoice-qr">
                  <Qr text={lotUrl(lot)} size={84} />
                  <span className="panel-hint">ស្កេន → ប្រវត្តិ Lot</span>
                </div>
              </>
            ) : (
              <p className="panel-hint">គ្មាន Lot ភ្ជាប់</p>
            )}
          </div>
        </div>

        <table className="table invoice-lines">
          <thead>
            <tr>
              <th>ទំនិញ</th>
              <th className="n">ថង់</th>
              <th className="n">គ.ក</th>
              <th className="n">ថ្លៃ/គ.ក (រៀល)</th>
              <th className="n">ចំនួន (រៀល)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>{product?.name ?? "ជីកំប៉ុស្តិ៍"}</b>
                <br />
                <span className="panel-hint">
                  {product ? `${product.bagSizeKg} គ.ក/ថង់` : "—"}
                  {grade ? ` · ថ្នាក់ ${grade}` : ""}
                </span>
              </td>
              <td className="n">{num(bags, 0)}</td>
              <td className="n">{int(mv.qtyKg)}</td>
              <td className="n">{int(mv.unitPrice)}</td>
              <td className="n">{int(amount)}</td>
            </tr>
          </tbody>
        </table>

        <dl className="invoice-totals">
          <div className="grand">
            <dt>សរុប</dt>
            <dd>{money(amount)}</dd>
          </div>
          <div>
            <dt>បានបង់</dt>
            <dd>{money(Math.round(mv.paid ?? 0))}</dd>
          </div>
          <div className={due ? "due" : ""}>
            <dt>សល់ត្រូវបង់</dt>
            <dd>{money(due)}</dd>
          </div>
        </dl>

        <p className="invoice-note">
          {mv.note ? `${mv.note} · ` : ""}
          {business.paymentNote ?? "សូមបង់ប្រាក់ក្នុង ៣០ ថ្ងៃ។ សូមអរគុណដែលប្រើជីកំប៉ុស្តិ៍។"}
        </p>
        <p className="panel-hint">
          ស្តុកផលិតផលនៅសល់បន្ទាប់ពីការបញ្ចេញនេះ៖{" "}
          {product ? `${int(productStockKg(db, product.id))} គ.ក` : "—"}
        </p>
      </div>

      <div className="save-bar">
        <span className="panel-hint">បោះពុម្ពលើក្រដាស A5 — មានតែវិក្កយបត្រទេដែលចេញ</span>
        <div className="row-actions">
          <Button onClick={printZone} variant="primary">
            បោះពុម្ពវិក្កយបត្រ
          </Button>
          <Button onClick={onClose}>បិទ</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Small button that opens the invoice for a movement. */
export function InvoiceButton({
  db,
  movementId,
  onOpen,
}: {
  db: DbShape;
  movementId: string;
  onOpen: (id: string) => void;
}) {
  const mv = db.productMovements.find((m) => m.id === movementId);
  const [busy] = useState(false);
  void busy;
  if (!mv || mv.dir !== "out") return null;
  return (
    <button className="btn btn--quiet" onClick={() => onOpen(movementId)}>
      វិក្កយបត្រ
    </button>
  );
}
