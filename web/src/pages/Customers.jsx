import { useState, useEffect } from 'react';
import { useData, Section, Loading, Notice, Empty, Field, Tag } from '../ui';
import { api, money, date } from '../api';

function NewCustomer({ onDone, onCancel }) {
  const [f, setF] = useState({ name: '', phone: '', ctype: 'retail', province: '', address: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF({ ...f, ...patch });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.post('/customers', f); onDone(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <Notice tone="error">{error}</Notice>
      <Field label="ឈ្មោះ">
        <input value={f.name} onChange={(e) => set({ name: e.target.value })} required />
      </Field>
      <Field label="លេខទូរស័ព្ទ">
        <input type="tel" inputMode="tel" value={f.phone} placeholder="012 345 678"
               onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <div className="split">
        <Field label="ប្រភេទ">
          <select value={f.ctype} onChange={(e) => set({ ctype: e.target.value })}>
            <option value="retail">លក់រាយ</option>
            <option value="wholesale">លក់ដុំ</option>
            <option value="farmer">កសិករ</option>
            <option value="distributor">ភ្នាក់ងារចែកចាយ</option>
          </select>
        </Field>
        <Field label="ខេត្ត/ក្រុង">
          <input value={f.province} onChange={(e) => set({ province: e.target.value })} />
        </Field>
      </div>
      <Field label="អាសយដ្ឋាន">
        <input value={f.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <div className="actions">
        <button className="btn" disabled={busy}>រក្សាទុក</button>
        <button type="button" className="btn ghost" onClick={onCancel}>បោះបង់</button>
      </div>
    </form>
  );
}

const typeLabel = { retail: 'លក់រាយ', wholesale: 'លក់ដុំ', farmer: 'កសិករ', distributor: 'ភ្នាក់ងារ' };

export default function Customers() {
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');
  const [adding, setAdding] = useState(false);

  // រង់ចាំ ៤០០ms ក្រោយឈប់វាយ ទើបស្វែងរក
  useEffect(() => {
    const t = setTimeout(() => setApplied(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading, reload } = useData(
    `/customers${applied ? `?search=${encodeURIComponent(applied)}` : ''}`
  );

  if (adding) {
    return (
      <Section title="អតិថិជនថ្មី">
        <NewCustomer onDone={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} />
      </Section>
    );
  }

  return (
    <>
      <Field label="ស្វែងរក">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ឈ្មោះ ឬលេខទូរស័ព្ទ" />
      </Field>

      <Section
        title="អតិថិជន"
        action={<button className="btn small" onClick={() => setAdding(true)}>អតិថិជនថ្មី</button>}
      >
        {loading ? <Loading />
          : error ? <Notice tone="error">{error}</Notice>
          : data.length === 0 ? <Empty>រកមិនឃើញអតិថិជន</Empty>
          : data.map((c) => (
              <div className="row" key={c.customer_id}>
                <div className="grow">
                  <span className="name">{c.name}</span>
                  <span className="sub">
                    {c.phone_display || 'គ្មានលេខ'} · {typeLabel[c.ctype]}
                    {c.last_order_date ? ` · ទិញចុងក្រោយ ${date(c.last_order_date)}` : ''}
                  </span>
                  {c.loyalty_points > 0 && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <Tag tone="ok">{c.loyalty_points} ពិន្ទុ</Tag>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 600 }}>{money(c.lifetime_value)}</div>
                  <div className="sub num" style={{ fontSize: '0.8rem', color: 'var(--ink-2)' }}>
                    {c.order_count} វិក្កយបត្រ
                  </div>
                </div>
              </div>
            ))}
      </Section>
    </>
  );
}
