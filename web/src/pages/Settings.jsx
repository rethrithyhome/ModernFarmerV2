import { useState } from 'react';
import { useData, Section, Loading, Notice, Empty, Field } from '../ui';
import { api, money, kg } from '../api';
import { useAuth } from '../App';

function Form({ fields, onSubmit, submitLabel }) {
  const init = Object.fromEntries(fields.map((f) => [f.name, f.value ?? '']));
  const [v, setV] = useState(init);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await onSubmit(v);
      setMsg({ tone: 'ok', text: 'រក្សាទុករួចរាល់' });
      setV(init);
    } catch (err) { setMsg({ tone: 'error', text: err.message }); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {fields.map((f) => (
        <Field key={f.name} label={f.label}>
          {f.options ? (
            <select value={v[f.name]} required={f.required}
                    onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
              <option value="">— ជ្រើសរើស —</option>
              {f.options.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          ) : (
            <input type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined}
                   value={v[f.name]} required={f.required} placeholder={f.placeholder}
                   onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
          )}
        </Field>
      ))}
      <button className="btn wide" disabled={busy}>{submitLabel}</button>
    </form>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('suppliers');
  const suppliers = useData('/catalog/suppliers');
  const materials = useData('/catalog/materials');
  const products = useData('/catalog/products');
  const packaging = useData('/catalog/packaging');
  const units = useData('/catalog/units');

  if (suppliers.loading || materials.loading || products.loading) return <Loading />;

  const isAdmin = user.role === 'admin';
  const tabs = [
    ['suppliers', 'អ្នកផ្គត់ផ្គង់'],
    ['materials', 'វត្ថុធាតុដើម'],
    ...(isAdmin ? [['products', 'ផលិតផល'], ['sku', 'SKU និងវេចខ្ចប់']] : []),
  ];

  return (
    <>
      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        {tabs.map(([k, label]) => (
          <button key={k} className={`btn small ${tab === k ? '' : 'ghost'}`}
                  onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'suppliers' && (
        <>
          <Section title="បន្ថែមអ្នកផ្គត់ផ្គង់">
            <Form
              submitLabel="រក្សាទុក"
              fields={[
                { name: 'name', label: 'ឈ្មោះ', required: true },
                { name: 'phone', label: 'លេខទូរស័ព្ទ', type: 'tel', placeholder: '012 345 678' },
                { name: 'address', label: 'អាសយដ្ឋាន' },
              ]}
              onSubmit={async (v) => { await api.post('/catalog/suppliers', v); suppliers.reload(); }}
            />
          </Section>
          <Section title="បញ្ជីអ្នកផ្គត់ផ្គង់" meta={`${suppliers.data.length} នាក់`}>
            {suppliers.data.length === 0 ? <Empty>មិនទាន់មាន</Empty>
              : suppliers.data.map((s) => (
                  <div className="row" key={s.id}>
                    <div className="grow">
                      <span className="name">{s.name}</span>
                      <span className="sub">
                        {s.phone_display || 'គ្មានលេខ'}
                        {s.total_orders > 0 ? ` · ${s.total_orders} ការទិញ` : ''}
                        {s.on_time_pct != null ? ` · ទាន់ពេល ${s.on_time_pct}%` : ''}
                      </span>
                    </div>
                    <span className="num">${money(s.total_spent)}</span>
                  </div>
                ))}
          </Section>
        </>
      )}

      {tab === 'materials' && (
        <>
          <Section title="បន្ថែមវត្ថុធាតុដើម">
            <Form
              submitLabel="រក្សាទុក"
              fields={[
                { name: 'code', label: 'លេខកូដ', required: true, placeholder: 'RM-COW' },
                { name: 'name_km', label: 'ឈ្មោះ', required: true },
                { name: 'default_unit', label: 'ឯកតាធម្មតា',
                  options: (units.data || []).map((u) => [u.unit_code, u.name_km]) },
                { name: 'reorder_level_kg', label: 'កម្រិតត្រូវបញ្ជាទិញ (គីឡូ)', type: 'number' },
              ]}
              onSubmit={async (v) => { await api.post('/catalog/materials', v); materials.reload(); }}
            />
          </Section>
          <Section title="បញ្ជីវត្ថុធាតុដើម">
            {materials.data.map((m) => (
              <div className="row" key={m.id}>
                <div className="grow">
                  <span className="name">{m.name_km}</span>
                  <span className="sub">{m.code} · បញ្ជាទិញនៅ {kg(m.reorder_level_kg)}</span>
                </div>
                <span className="num">{kg(m.stock_kg)}</span>
              </div>
            ))}
          </Section>
        </>
      )}

      {tab === 'products' && isAdmin && (
        <>
          <Section title="បន្ថែមផលិតផល">
            <Form
              submitLabel="រក្សាទុក"
              fields={[
                { name: 'code', label: 'លេខកូដ', required: true },
                { name: 'name_km', label: 'ឈ្មោះ', required: true },
                { name: 'category', label: 'ប្រភេទ', required: true, options: [
                  ['fertilizer', 'ជីសរីរាង្គ'], ['compost', 'ជីកំប៉ុស'],
                  ['growing_soil', 'ដីបណ្តុះ'], ['plant', 'ដើមឈើ/រុក្ខជាតិ'], ['other', 'ផ្សេងៗ'],
                ] },
              ]}
              onSubmit={async (v) => { await api.post('/catalog/products', v); products.reload(); }}
            />
          </Section>
          <Section title="បញ្ជីផលិតផល">
            {products.data.map((p) => (
              <div className="row" key={p.id}>
                <div className="grow">
                  <span className="name">{p.name_km}</span>
                  <span className="sub">{p.code} · {p.variants.length} SKU</span>
                </div>
              </div>
            ))}
          </Section>
        </>
      )}

      {tab === 'sku' && isAdmin && (
        <>
          <Section title="បន្ថែមទំហំវេចខ្ចប់">
            <Form
              submitLabel="រក្សាទុក"
              fields={[
                { name: 'name_km', label: 'ឈ្មោះ', required: true, placeholder: 'បាវ ៥០គីឡូ' },
                { name: 'size_kg', label: 'ទំហំ (គីឡូ)', type: 'number', required: true },
                { name: 'unit_cost', label: 'ថ្លៃដើមកញ្ចប់ ($)', type: 'number' },
              ]}
              onSubmit={async (v) => { await api.post('/catalog/packaging', v); packaging.reload(); }}
            />
          </Section>

          <Section title="បន្ថែម SKU ថ្មី">
            <p className="notice info">
              SKU គឺជាផលិតផលមួយក្នុងទំហំវេចខ្ចប់មួយ — នេះជាអ្វីដែលអ្នកលក់ជាក់ស្តែង។
              ពេលចេញវេចខ្ចប់ថ្មី គ្រាន់តែបន្ថែម SKU ថ្មីនៅទីនេះ។
            </p>
            <Form
              submitLabel="បង្កើត SKU"
              fields={[
                { name: 'sku', label: 'លេខ SKU', required: true, placeholder: 'FERT-ORG-50' },
                { name: 'product_id', label: 'ផលិតផល', required: true,
                  options: products.data.map((p) => [p.id, p.name_km]) },
                { name: 'packaging_id', label: 'វេចខ្ចប់',
                  options: (packaging.data || []).map((p) => [p.id, p.name_km]) },
                { name: 'name_km', label: 'ឈ្មោះបង្ហាញ', required: true },
                { name: 'sell_price', label: 'តម្លៃលក់ ($)', type: 'number', required: true },
              ]}
              onSubmit={async (v) => { await api.post('/catalog/variants', v); products.reload(); }}
            />
          </Section>

          <Section title="SKU ទាំងអស់">
            {products.data.flatMap((p) => p.variants).length === 0 ? <Empty>មិនទាន់មាន SKU</Empty>
              : products.data.flatMap((p) =>
                  p.variants.map((v) => (
                    <div className="row" key={v.id}>
                      <div className="grow">
                        <span className="name">{v.name_km}</span>
                        <span className="sub">{v.sku} · {p.name_km}</span>
                      </div>
                      <span className="num">${money(v.sell_price)}</span>
                    </div>
                  ))
                )}
          </Section>
        </>
      )}
    </>
  );
}
