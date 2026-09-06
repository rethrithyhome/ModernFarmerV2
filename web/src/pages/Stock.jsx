import { useState } from 'react';
import { useData, Section, Loading, Notice, Empty, Field, Tag } from '../ui';
import { api, kg, date } from '../api';
import { useAuth, can } from '../App';

function Adjust({ raw, finished, onDone }) {
  const [kind, setKind] = useState('raw');
  const [id, setId] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const name = (kind === 'raw'
        ? raw.find((r) => String(r.raw_material_id) === String(id))?.name_km
        : finished.find((f) => String(f.product_variant_id) === String(id))?.name_km) || '';
      const r = await api.send('/inventory/adjust', {
        item_kind: kind,
        raw_material_id: kind === 'raw' ? Number(id) : null,
        product_variant_id: kind === 'finished' ? Number(id) : null,
        qty_change: Number(qty),
        note,
      }, `កែតម្រូវស្តុក ${name} ${qty}`);
      setMsg(r.queued
        ? { tone: 'info', text: 'រក្សាទុកក្នុងជួររង់ចាំ — នឹងផ្ញើពេលបណ្តាញត្រឡប់មក' }
        : { tone: 'ok', text: 'កែតម្រូវរួចរាល់' });
      setQty(''); setNote('');
      onDone();
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const options = kind === 'raw'
    ? raw.map((r) => [r.raw_material_id, r.name_km])
    : finished.map((f) => [f.product_variant_id, f.name_km]);

  return (
    <form onSubmit={submit}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="split">
        <Field label="ប្រភេទ">
          <select value={kind} onChange={(e) => { setKind(e.target.value); setId(''); }}>
            <option value="raw">វត្ថុធាតុដើម</option>
            <option value="finished">ផលិតផលសម្រេច</option>
          </select>
        </Field>
        <Field label={kind === 'raw' ? 'បរិមាណ (គីឡូ)' : 'បរិមាណ (កញ្ចប់)'}>
          <input type="number" step="any" value={qty} required
                 onChange={(e) => setQty(e.target.value)} placeholder="ឧ. -5" />
        </Field>
      </div>
      <Field label="មុខទំនិញ">
        <select value={id} onChange={(e) => setId(e.target.value)} required>
          <option value="">— ជ្រើសរើស —</option>
          {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </Field>
      <Field label="មូលហេតុ">
        <input value={note} onChange={(e) => setNote(e.target.value)} required
               placeholder="ឧ. រាប់ស្តុកពិត / ខូចខាត / បាត់បង់" />
      </Field>
      <p className="notice info">
        លេខអវិជ្ជមានដកចេញ លេខវិជ្ជមានបន្ថែមចូល។ ការកែតម្រូវរក្សាទុកក្នុងប្រវត្តិ មិនលុបលេខចាស់។
      </p>
      <button className="btn wide" disabled={busy}>រក្សាទុកការកែតម្រូវ</button>
    </form>
  );
}

export default function Stock() {
  const { user } = useAuth();
  const [tab, setTab] = useState('raw');
  const raw = useData('/inventory/raw');
  const fin = useData('/inventory/finished');
  const mov = useData('/inventory/movements?limit=40');

  if (raw.loading || fin.loading) return <Loading />;
  const err = raw.error || fin.error;
  if (err) return <Notice tone="error">{err}</Notice>;

  const reload = () => { raw.reload(); fin.reload(); mov.reload(); };

  return (
    <>
      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        {[['raw', 'វត្ថុធាតុដើម'], ['finished', 'ផលិតផលសម្រេច'],
          ['moves', 'ចលនាស្តុក'],
          ...(can(user.role, 'stock') ? [['adjust', 'កែតម្រូវ']] : [])].map(([k, label]) => (
          <button key={k} type="button"
                  className={`btn small ${tab === k ? '' : 'ghost'}`}
                  onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'raw' && (
        <Section title="វត្ថុធាតុដើម" meta={`${raw.data.length} មុខ`}>
          {raw.data.map((r) => (
            <div className="row" key={r.raw_material_id}>
              <div className="grow">
                <span className="name">{r.name_km}</span>
                <span className="sub">{r.code}</span>
              </div>
              {r.is_low && <Tag tone="danger">ជិតអស់</Tag>}
              <span className="num" style={{ fontWeight: 600, minWidth: '5.5rem' }}>
                {kg(r.qty_kg)}
              </span>
            </div>
          ))}
        </Section>
      )}

      {tab === 'finished' && (
        <Section title="ផលិតផលសម្រេច" meta={`${fin.data.length} SKU`}>
          {fin.data.length === 0
            ? <Empty>មិនទាន់មានផលិតផលវេចខ្ចប់</Empty>
            : fin.data.map((f) => (
                <div className="row" key={f.product_variant_id}>
                  <div className="grow">
                    <span className="name">{f.name_km}</span>
                    <span className="sub">{f.sku}</span>
                  </div>
                  <span className="num" style={{ fontWeight: 600 }}>
                    {Number(f.qty_units).toLocaleString()} កញ្ចប់
                  </span>
                </div>
              ))}
        </Section>
      )}

      {tab === 'moves' && (
        <Section title="ចលនាស្តុកចុងក្រោយ">
          {mov.loading ? <Loading /> : mov.error ? <Notice tone="error">{mov.error}</Notice>
            : mov.data.length === 0 ? <Empty>មិនទាន់មានចលនា</Empty>
            : mov.data.map((m) => {
                const positive = Number(m.qty_change) > 0;
                const reasons = {
                  purchase: 'ទិញចូល', production_consume: 'ប្រើក្នុងផលិតកម្ម',
                  packaging_in: 'វេចខ្ចប់ចូល', sale: 'លក់ចេញ',
                  sale_reversal: 'ត្រឡប់ពីការលុបចោល', adjustment: 'កែតម្រូវ',
                };
                return (
                  <div className="row" key={m.id}>
                    <div className="grow">
                      <span className="name">{m.material_name || m.variant_name}</span>
                      <span className="sub">
                        {reasons[m.reason] || m.reason} · {date(m.created_at)}
                        {m.created_by_name ? ` · ${m.created_by_name}` : ''}
                        {m.note ? ` · ${m.note}` : ''}
                      </span>
                    </div>
                    <span className="num" style={{ color: positive ? 'var(--leaf-dark)' : 'var(--brick)' }}>
                      {positive ? '+' : ''}{Number(m.qty_change).toLocaleString()}
                    </span>
                  </div>
                );
              })}
        </Section>
      )}

      {tab === 'adjust' && can(user.role, 'stock') && (
        <Section title="កែតម្រូវស្តុក">
          <Adjust raw={raw.data} finished={fin.data} onDone={reload} />
        </Section>
      )}
    </>
  );
}
