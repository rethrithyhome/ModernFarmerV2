import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData, Section, Loading, Notice, Field, SearchSelect } from '../ui';
import { api, money, kg, currencyLabel } from '../api';

const blank = { raw_material_id: '', qty_input: '', unit_code: 'kg', unit_price_kg: '' };

export default function PurchaseNew() {
  const nav = useNavigate();
  const suppliers = useData('/catalog/suppliers?active=true');
  const materials = useData('/catalog/materials');
  const units = useData('/catalog/units');

  const [supplierId, setSupplierId] = useState('');
  const [expected, setExpected] = useState('');
  const [items, setItems] = useState([{ ...blank }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (suppliers.loading || materials.loading || units.loading) return <Loading />;

  // ជម្រុញលេខទូរស័ព្ទចូល "sub" ដើម្បីអាចវាយស្វែងរកបាន — អ្នកផ្គត់ផ្គង់ឈ្មោះស្រដៀងគ្នា
  // ច្រឡំបានងាយ ជាពិសេសបើលេខទូរស័ព្ទស្ទួន
  const supplierItems = suppliers.data.map((s) => ({
    id: s.id,
    label: s.name,
    sub: [s.phone_display, s.on_time_pct != null ? `ទាន់ពេល ${s.on_time_pct}%` : null]
      .filter(Boolean).join(' · '),
  }));

  const unitFactor = (code) =>
    Number(units.data.find((u) => u.unit_code === code)?.factor_to_kg || 1);

  const lineKg = (it) => Number(it.qty_input || 0) * unitFactor(it.unit_code);
  const lineTotal = (it) => lineKg(it) * Number(it.unit_price_kg || 0);
  const total = items.reduce((s, it) => s + lineTotal(it), 0);

  function setItem(i, patch) {
    setItems(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));
  }

  async function submit(e) {
    e.preventDefault();
    if (!supplierId) {
      setError('សូមជ្រើសរើសអ្នកផ្គត់ផ្គង់');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const supplierName = suppliers.data.find((s) => String(s.id) === String(supplierId))?.name || '';
      await api.send('/purchases', {
        supplier_id: Number(supplierId),
        expected_date: expected || null,
        items: items.map((it) => ({
          raw_material_id: Number(it.raw_material_id),
          qty_input: Number(it.qty_input),
          unit_code: it.unit_code,
          unit_price_kg: Number(it.unit_price_kg),
        })),
      }, `បញ្ជាទិញពី ${supplierName}`);
      nav('/purchases', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Section title="បញ្ជាទិញថ្មី">
        <Notice tone="error">{error}</Notice>

        <Field label="អ្នកផ្គត់ផ្គង់">
          <SearchSelect
            items={supplierItems}
            value={supplierId}
            onChange={setSupplierId}
            placeholder="វាយឈ្មោះ ឬលេខទូរស័ព្ទ…"
          />
        </Field>

        <Field label="កាលបរិច្ឆេទរំពឹងទទួល">
          <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
        </Field>
      </Section>

      <Section title="ទំនិញ" meta={`${items.length} ជួរ`}>
        {items.map((it, i) => (
          <div className="item-line" key={i}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label={`ជួរទី ${i + 1}`}>
                <select value={it.raw_material_id} required
                        onChange={(e) => setItem(i, { raw_material_id: e.target.value })}>
                  <option value="">— វត្ថុធាតុដើម —</option>
                  {materials.data.map((m) => (
                    <option key={m.id} value={m.id}>{m.name_km}</option>
                  ))}
                </select>
              </Field>
              <div className="fields">
                <Field label="បរិមាណ">
                  <input type="number" step="any" min="0" value={it.qty_input} required
                         onChange={(e) => setItem(i, { qty_input: e.target.value })} />
                </Field>
                <Field label="ឯកតា">
                  <select value={it.unit_code}
                          onChange={(e) => setItem(i, { unit_code: e.target.value })}>
                    {units.data.map((u) => (
                      <option key={u.unit_code} value={u.unit_code}>{u.name_km}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`តម្លៃ/គីឡូ (${currencyLabel()})`}>
                  <input type="number" step="any" min="0" value={it.unit_price_kg} required
                         onChange={(e) => setItem(i, { unit_price_kg: e.target.value })} />
                </Field>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            fontSize: '0.85rem', color: 'var(--ink-2)' }}>
                <span>= {kg(lineKg(it))} ក្នុងស្តុក</span>
                <span className="num">{money(lineTotal(it))}</span>
              </div>
              {items.length > 1 && (
                <button type="button" className="btn small ghost"
                        style={{ marginTop: '0.4rem' }}
                        onClick={() => setItems(items.filter((_, n) => n !== i))}>
                  លុបជួរនេះ
                </button>
              )}
            </div>
          </div>
        ))}

        <div className="actions">
          <button type="button" className="btn small ghost"
                  onClick={() => setItems([...items, { ...blank }])}>
            បន្ថែមជួរ
          </button>
        </div>
      </Section>

      <div className="row" style={{ borderTop: '2px solid var(--line-strong)', borderBottom: 0 }}>
        <div className="grow"><strong>សរុប</strong></div>
        <span className="num" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{money(total)}</span>
      </div>

      <p className="notice info">
        បរិមាណរក្សាទុកជាគីឡូក្រាមទាំងអស់ ទោះវាយបញ្ចូលជាតោន ឬបាវក៏ដោយ។
      </p>

      <div className="actions">
        <button className="btn" disabled={busy}>{busy ? 'កំពុងរក្សាទុក…' : 'រក្សាទុកជាព្រាង'}</button>
        <button type="button" className="btn ghost" onClick={() => nav(-1)}>បោះបង់</button>
      </div>
    </form>
  );
}
