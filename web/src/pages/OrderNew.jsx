import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, Section, Loading, Notice, Field, SearchSelect } from '../ui';
import { api, money, currencyLabel } from '../api';

const NO_CUSTOMER = { id: '', label: 'អតិថិជនទូទៅ (មិនកត់ឈ្មោះ)' };

export default function OrderNew() {
  const nav = useNavigate();
  const stock = useData('/inventory/finished');
  const products = useData('/catalog/products');

  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('');
  const [items, setItems] = useState([{ product_variant_id: '', qty_units: '', unit_price: '' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * ស្វែងរកអតិថិជនតាមឈ្មោះ ឬលេខទូរស័ព្ទ — ពន្យារ ៣០០ ms កុំឱ្យសួរម៉ាស៊ីនមេ
   * រាល់តួអក្សរ។ លេខទូរស័ព្ទស្ទួនគ្នាធ្វើឱ្យជ្រើសខុសបានងាយ ដូច្នេះការស្វែងរក
   * ដោយវាយលេខផ្ទាល់ជួយកាត់បន្ថយកំហុសនេះ ជាងបញ្ជីទម្លាក់ចុះវែងមួយ។
   */
  const [custQuery, setCustQuery] = useState('');
  const [custApplied, setCustApplied] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCustApplied(custQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [custQuery]);
  const customers = useData(
    `/customers${custApplied ? `?search=${encodeURIComponent(custApplied)}` : ''}`
  );
  const customerItems = (customers.data || []).map((c) => ({
    id: c.customer_id, label: c.name, sub: c.phone_display || '',
  }));

  if (stock.loading || products.loading) return <Loading />;

  const allVariants = products.data.flatMap((p) => p.variants.map((v) => ({ ...v, product: p.name_km })));
  const priceOf = (id) => Number(allVariants.find((v) => v.id === Number(id))?.sell_price || 0);
  const availableOf = (id) =>
    Number(stock.data.find((s) => s.product_variant_id === Number(id))?.qty_units || 0);

  const lineTotal = (it) =>
    Number(it.qty_units || 0) * (it.unit_price === '' ? priceOf(it.product_variant_id) : Number(it.unit_price));
  const subtotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const setItem = (i, patch) => setItems(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));

  const over = items.filter(
    (it) => it.product_variant_id && Number(it.qty_units || 0) > availableOf(it.product_variant_id)
  );

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.post('/orders', {
        customer_id: customerId ? Number(customerId) : null,
        discount: Number(discount || 0),
        items: items.map((it) => ({
          product_variant_id: Number(it.product_variant_id),
          qty_units: Number(it.qty_units),
          ...(it.unit_price === '' ? {} : { unit_price: Number(it.unit_price) }),
        })),
      });
      nav(`/orders/${r.id}`, { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <Section title="លក់ថ្មី">
        <Notice tone="error">{error}</Notice>
        <Field label="អតិថិជន">
          <SearchSelect
            items={customerItems}
            value={customerId}
            onChange={setCustomerId}
            onQuery={setCustQuery}
            filterLocally={false}
            emptyOption={NO_CUSTOMER}
            placeholder="វាយឈ្មោះ ឬលេខទូរស័ព្ទ…"
          />
        </Field>
      </Section>

      <Section title="ទំនិញ">
        {items.map((it, i) => (
          <div className="item-line" key={i}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label={`ជួរទី ${i + 1}`}>
                <select value={it.product_variant_id} required
                        onChange={(e) => setItem(i, { product_variant_id: e.target.value })}>
                  <option value="">— ជ្រើសរើសផលិតផល —</option>
                  {allVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name_km} · មាន {availableOf(v.id)} កញ្ចប់
                    </option>
                  ))}
                </select>
              </Field>
              <div className="split">
                <Field label="ចំនួនកញ្ចប់">
                  <input type="number" min="1" value={it.qty_units} required
                         onChange={(e) => setItem(i, { qty_units: e.target.value })} />
                </Field>
                <Field label={`តម្លៃ/កញ្ចប់ (${currencyLabel()})`}>
                  <input type="number" step="any" min="0" value={it.unit_price}
                         placeholder={it.product_variant_id ? money(priceOf(it.product_variant_id)) : ''}
                         onChange={(e) => setItem(i, { unit_price: e.target.value })} />
                </Field>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            fontSize: '0.85rem', color: 'var(--ink-2)' }}>
                <span>
                  {it.product_variant_id && Number(it.qty_units || 0) > availableOf(it.product_variant_id)
                    ? `លើសស្តុក — មានតែ ${availableOf(it.product_variant_id)} កញ្ចប់`
                    : 'ទុកតម្លៃទទេ ដើម្បីប្រើតម្លៃស្តង់ដារ'}
                </span>
                <span className="num">{money(lineTotal(it))}</span>
              </div>
              {items.length > 1 && (
                <button type="button" className="btn small ghost" style={{ marginTop: '0.4rem' }}
                        onClick={() => setItems(items.filter((_, n) => n !== i))}>
                  លុបជួរនេះ
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="actions">
          <button type="button" className="btn small ghost"
                  onClick={() => setItems([...items, { product_variant_id: '', qty_units: '', unit_price: '' }])}>
            បន្ថែមជួរ
          </button>
        </div>
      </Section>

      <Field label={`បញ្ចុះតម្លៃ (${currencyLabel()})`}>
        <input type="number" step="any" min="0" value={discount}
               onChange={(e) => setDiscount(e.target.value)} />
      </Field>

      <div className="row" style={{ borderTop: '2px solid var(--line-strong)', borderBottom: 0 }}>
        <div className="grow"><strong>អតិថិជនត្រូវបង់</strong></div>
        <span className="num" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{money(total)}</span>
      </div>

      {over.length > 0 && (
        <Notice tone="error">មានជួរលើសស្តុក — ប្រព័ន្ធនឹងបដិសេធពេលបញ្ជាក់</Notice>
      )}

      <div className="actions">
        <button className="btn" disabled={busy}>{busy ? 'កំពុងរក្សាទុក…' : 'រក្សាទុកជាព្រាង'}</button>
        <button type="button" className="btn ghost" onClick={() => nav(-1)}>បោះបង់</button>
      </div>
    </form>
  );
}
