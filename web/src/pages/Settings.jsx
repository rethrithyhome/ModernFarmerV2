import { useState } from 'react';
import { useData, Section, Loading, Notice, Empty, Field } from '../ui';
import { api, money, kg, currencyLabel, moneyStep, getCurrency, setCurrency } from '../api';
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

/**
 * កែលេខតាមជួរ — ចុច «កែ» → វាយលេខថ្មី → រក្សាទុក
 * ប្រើសម្រាប់ តម្លៃលក់ · ថ្លៃដើមវេចខ្ចប់ · កម្រិតបញ្ជាទិញ
 */
function NumberEdit({ value, suffix = '', prefix = '', asMoney = false, onSave, canEdit = true }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value ?? ''));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const show = asMoney
    ? money(value)
    : `${prefix}${Number(value).toLocaleString()}${suffix}`;

  if (!canEdit) return <span className="num">{show}</span>;

  if (!editing) {
    return (
      <button className="num-edit" onClick={() => { setV(String(value ?? '')); setEditing(true); }}>
        <span className="num">{show}</span>
        <span className="pencil" aria-hidden="true">កែ</span>
      </button>
    );
  }

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await onSave(Number(v));
      setEditing(false);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="num-editing">
      <input type="number" step={asMoney ? moneyStep() : 'any'} min="0" value={v} autoFocus
             onChange={(e) => setV(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === 'Enter') save();
               if (e.key === 'Escape') setEditing(false);
             }} />
      <button className="btn small" disabled={busy} onClick={save}>រក្សាទុក</button>
      <button className="btn small ghost" onClick={() => setEditing(false)}>បោះបង់</button>
      {err && <span className="num-err">{err}</span>}
    </div>
  );
}

/** ផ្ទាំងតម្លៃកំណត់ប្រព័ន្ធ */
/** ប្តូរពាក្យសម្ងាត់ខ្លួនឯង — ដាក់ក្នុងម៉ឺនុយកំណត់ដែរ ដើម្បីរកបានងាយ */
function PasswordTab() {
  const { logout } = useAuth();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (p) => setF({ ...f, ...p });

  async function submit(e) {
    e.preventDefault();
    if (f.next !== f.confirm) {
      setMsg({ tone: 'error', text: 'ពាក្យសម្ងាត់ថ្មីទាំងពីរមិនដូចគ្នា' });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      await api.post('/auth/me/password', {
        current_password: f.current, new_password: f.next,
      });
      setMsg({ tone: 'ok', text: 'ប្តូររួចរាល់ — កំពុងចេញពីប្រព័ន្ធ សូមចូលដោយពាក្យសម្ងាត់ថ្មី' });
      setTimeout(logout, 1800);
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally { setBusy(false); }
  }

  return (
    <Section title="ប្តូរលេខកូដសម្ងាត់">
      <form onSubmit={submit}>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Field label="លេខកូដសម្ងាត់បច្ចុប្បន្ន">
          <input type="password" value={f.current} autoComplete="current-password"
                 onChange={(e) => set({ current: e.target.value })} required />
        </Field>
        <Field label="លេខកូដសម្ងាត់ថ្មី (យ៉ាងតិច ៨ តួ)">
          <input type="password" value={f.next} autoComplete="new-password" minLength={8}
                 onChange={(e) => set({ next: e.target.value })} required />
        </Field>
        <Field label="វាយម្តងទៀត">
          <input type="password" value={f.confirm} autoComplete="new-password" minLength={8}
                 onChange={(e) => set({ confirm: e.target.value })} required />
        </Field>
        <p className="notice info">
          ក្រោយប្តូរ អ្នកនឹងចេញពីប្រព័ន្ធ ហើយត្រូវចូលម្តងទៀត។
          ឧបករណ៍ផ្សេងទៀតដែលចូលដោយគណនីនេះក៏ចេញដែរ។
        </p>
        <button className="btn wide" disabled={busy}>
          {busy ? 'កំពុងប្តូរ…' : 'ប្តូរលេខកូដសម្ងាត់'}
        </button>
      </form>
    </Section>
  );
}

function SystemNumbers() {
  const { data, error, loading, reload } = useData('/catalog/settings');
  const [msg, setMsg] = useState(null);

  if (loading) return <Loading />;
  if (error) return <Notice tone="error">{error}</Notice>;

  const get = (k) => data.find((s) => s.key === k);

  const save = async (key, value) => {
    await api.patch('/catalog/settings', { [key]: value });
    setMsg({ tone: 'ok', text: 'រក្សាទុករួចរាល់' });
    reload();
  };

  const perPoint = get('loyalty_amount_per_point');
  const pointValue = get('loyalty_point_value');
  const alertHour = get('low_stock_alert_hour');

  return (
    <>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Section title="ពិន្ទុភក្ដីភាព">
        <div className="row">
          <div className="grow">
            <span className="name">ចំណាយប៉ុន្មាន ដើម្បីបាន ១ ពិន្ទុ</span>
            <span className="sub">ឧ. ដាក់ 40000 → អតិថិជនទិញ 400,000៛ ទទួល ១០ ពិន្ទុ</span>
          </div>
          <NumberEdit value={perPoint?.value} asMoney
                      onSave={(v) => save('loyalty_amount_per_point', v)} />
        </div>
        <div className="row">
          <div className="grow">
            <span className="name">តម្លៃ ១ ពិន្ទុ</span>
            <span className="sub">ពេលអតិថិជនដូរពិន្ទុជាការបញ្ចុះតម្លៃ</span>
          </div>
          <NumberEdit value={pointValue?.value} asMoney
                      onSave={(v) => save('loyalty_point_value', v)} />
        </div>
        <p className="notice info">
          ការប្តូរមានប្រសិទ្ធភាពលើការលក់ថ្មីភ្លាមៗ។ ពិន្ទុដែលអតិថិជនមានរួចហើយមិនប្រែប្រួលទេ។
        </p>
      </Section>

      <Section title="រូបិយប័ណ្ណ">
        <Field label="រូបិយប័ណ្ណប្រើក្នុងប្រព័ន្ធ">
          <select value={get('currency')?.value || 'KHR'}
                  onChange={async (e) => {
                    await save('currency', e.target.value);
                    setCurrency(e.target.value);
                  }}>
            <option value="KHR">រៀល (៛)</option>
            <option value="USD">ដុល្លារ ($)</option>
          </select>
        </Field>
        <p className="notice info">
          ការប្តូររូបិយប័ណ្ណប្តូរតែ<strong>របៀបបង្ហាញ</strong>ប៉ុណ្ណោះ — លេខដែលបញ្ចូលរួច
          មិនត្រូវបានបម្លែងទេ។ ឧ. តម្លៃ 25 នឹងក្លាយជា 25៛ មិនមែន 102,500៛។
          ត្រូវកែតម្លៃឡើងវិញដោយដៃក្រោយប្តូរ។
        </p>
      </Section>

      <Section title="ការជូនដំណឹង">
        <div className="row">
          <div className="grow">
            <span className="name">ម៉ោងផ្ញើសារស្តុកទាប</span>
            <span className="sub">ម៉ោង ០ ដល់ ២៣</span>
          </div>
          <NumberEdit value={alertHour?.value} suffix=" ម៉ោង"
                      onSave={(v) => save('low_stock_alert_hour', v)} />
        </div>
      </Section>
    </>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('suppliers');
  // ទាញតែទិន្នន័យរបស់ផ្ទាំងដែលកំពុងបើក — មុននេះទាញទាំង ៥ ព្រមគ្នា
  const suppliers = useData('/catalog/suppliers', { enabled: tab === 'suppliers' });
  const materials = useData('/catalog/materials', { enabled: tab === 'materials' });
  const units = useData('/catalog/units', { enabled: tab === 'materials' });
  const products = useData('/catalog/products', { enabled: tab === 'products' || tab === 'sku' });
  const packaging = useData('/catalog/packaging', { enabled: tab === 'sku' });

  const busy = suppliers.loading || materials.loading || products.loading || packaging.loading;

  const isAdmin = user.role === 'admin';
  const tabs = [
    ['suppliers', 'អ្នកផ្គត់ផ្គង់'],
    ['materials', 'វត្ថុធាតុដើម'],
    ...(isAdmin ? [['products', 'ផលិតផល'], ['sku', 'SKU និងវេចខ្ចប់'],
                   ['numbers', 'តម្លៃកំណត់']] : []),
    ['password', 'លេខកូដសម្ងាត់'],
  ];

  return (
    <>
      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        {tabs.map(([k, label]) => (
          <button key={k} className={`btn small ${tab === k ? '' : 'ghost'}`}
                  onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {busy && tab !== 'password' && tab !== 'numbers' && <Loading />}

      {tab === 'suppliers' && suppliers.data && (
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
                    <span className="num">{money(s.total_spent)}</span>
                  </div>
                ))}
          </Section>
        </>
      )}

      {tab === 'materials' && materials.data && (
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
          <Section title="បញ្ជីវត្ថុធាតុដើម" meta="ចុចលេខដើម្បីកែ">
            {materials.data.map((m) => (
              <div className="row" key={m.id}>
                <div className="grow">
                  <span className="name">{m.name_km}</span>
                  <span className="sub">{m.code} · ក្នុងស្តុក {kg(m.stock_kg)}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="sub" style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
                    បញ្ជាទិញនៅ
                  </div>
                  <NumberEdit value={m.reorder_level_kg} suffix=" គ.ក"
                              onSave={async (v) => {
                                await api.patch(`/catalog/materials/${m.id}`,
                                                { reorder_level_kg: v });
                                materials.reload();
                              }} />
                </div>
              </div>
            ))}
          </Section>
        </>
      )}

      {tab === 'products' && isAdmin && products.data && (
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

      {tab === 'numbers' && isAdmin && <SystemNumbers />}

      {tab === 'password' && <PasswordTab />}

      {tab === 'sku' && isAdmin && products.data && (
        <>
          <Section title="បន្ថែមទំហំវេចខ្ចប់">
            <Form
              submitLabel="រក្សាទុក"
              fields={[
                { name: 'name_km', label: 'ឈ្មោះ', required: true, placeholder: 'បាវ ៥០គីឡូ' },
                { name: 'size_kg', label: 'ទំហំ (គីឡូ)', type: 'number', required: true },
                { name: 'unit_cost', label: `ថ្លៃដើមកញ្ចប់ (${currencyLabel()})`, type: 'number' },
              ]}
              onSubmit={async (v) => { await api.post('/catalog/packaging', v); packaging.reload(); }}
            />
          </Section>

          <Section title="ទំហំវេចខ្ចប់" meta="ចុចថ្លៃដើមដើម្បីកែ">
            {!packaging.data || packaging.data.length === 0 ? <Empty>មិនទាន់មាន</Empty>
              : packaging.data.map((pk) => (
                  <div className="row" key={pk.id}>
                    <div className="grow">
                      <span className="name">{pk.name_km}</span>
                      <span className="sub">{kg(pk.size_kg)} ក្នុងមួយកញ្ចប់</span>
                    </div>
                    <NumberEdit value={pk.unit_cost} asMoney
                                onSave={async (v) => {
                                  await api.patch(`/catalog/packaging/${pk.id}`, { unit_cost: v });
                                  packaging.reload();
                                }} />
                  </div>
                ))}
            <p className="notice info">
              ថ្លៃដើមកញ្ចប់ចូលក្នុងការគណនាតម្លៃដើមក្នុងមួយ batch — ដាក់ឱ្យត្រឹមត្រូវ
              ដើម្បីឱ្យរបាយការណ៍ចំណេញ-ខាតជិតការពិត។
            </p>
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
                { name: 'sell_price', label: `តម្លៃលក់ (${currencyLabel()})`, type: 'number', required: true },
              ]}
              onSubmit={async (v) => { await api.post('/catalog/variants', v); products.reload(); }}
            />
          </Section>

          <Section title="SKU ទាំងអស់" meta="ចុចតម្លៃដើម្បីកែ">
            {products.data.flatMap((p) => p.variants).length === 0 ? <Empty>មិនទាន់មាន SKU</Empty>
              : products.data.flatMap((p) =>
                  p.variants.map((v) => (
                    <div className="row" key={v.id}>
                      <div className="grow">
                        <span className="name">{v.name_km}</span>
                        <span className="sub">{v.sku} · {p.name_km}</span>
                      </div>
                      <NumberEdit value={v.sell_price} asMoney
                                  onSave={async (val) => {
                                    await api.patch(`/catalog/variants/${v.id}`,
                                                    { sell_price: val });
                                    products.reload();
                                  }} />
                    </div>
                  ))
                )}
          </Section>
        </>
      )}
    </>
  );
}
