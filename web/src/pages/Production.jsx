import { useState } from 'react';
import { useData, Section, Loading, Notice, Empty, Field, Tag } from '../ui';
import { api, kg, date, batchLabel } from '../api';

const tone = { planned: 'quiet', in_progress: 'warn', completed: 'ok', cancelled: 'danger' };

function NewBatch({ products, onDone, onCancel }) {
  const [productId, setProductId] = useState('');
  const [planned, setPlanned] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/production/batches', {
        product_id: Number(productId),
        planned_output_kg: Number(planned || 0),
      });
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <Notice tone="error">{error}</Notice>
      <Field label="ផលិតផល">
        <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
          <option value="">— ជ្រើសរើស —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name_km}</option>)}
        </select>
      </Field>
      <Field label="គ្រោងផលិត (គីឡូ)">
        <input type="number" step="any" min="0" value={planned}
               onChange={(e) => setPlanned(e.target.value)} />
      </Field>
      <div className="actions">
        <button className="btn" disabled={busy}>បង្កើត Batch</button>
        <button type="button" className="btn ghost" onClick={onCancel}>បោះបង់</button>
      </div>
    </form>
  );
}

function BatchActions({ batch, materials, variants, onDone }) {
  const [mode, setMode] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ raw_material_id: '', qty_kg: '', output: '',
                                     product_variant_id: '', qty_units: '' });

  const set = (patch) => setForm({ ...form, ...patch });

  async function run(fn) {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      setMode(null);
      if (r?.queued) {
        setMsg({ tone: 'info', text: 'រក្សាទុកក្នុងជួររង់ចាំ — នឹងផ្ញើពេលបណ្តាញត្រឡប់មក' });
      }
      onDone();
    } catch (e) { setMsg({ tone: 'error', text: e.message }); } finally { setBusy(false); }
  }

  const addInput = () => run(() => api.send(
    `/production/batches/${batch.id}/inputs`,
    { inputs: [{ raw_material_id: Number(form.raw_material_id), qty_kg: Number(form.qty_kg) }] },
    `${batch.batch_code}: បញ្ចូល ${form.qty_kg} គីឡូ`
  ));

  const complete = () => run(() => api.send(
    `/production/batches/${batch.id}/complete`,
    { actual_output_kg: Number(form.output) },
    `${batch.batch_code}: បញ្ចប់ ${form.output} គីឡូ`
  ));

  const pack = () => run(() => api.send(
    `/production/batches/${batch.id}/packaging`,
    { product_variant_id: Number(form.product_variant_id), qty_units: Number(form.qty_units) },
    `${batch.batch_code}: វេចខ្ចប់ ${form.qty_units} កញ្ចប់`
  ));

  return (
    <div style={{ paddingBottom: '0.75rem' }}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div className="actions" style={{ marginTop: '0.5rem' }}>
        {batch.status !== 'completed' && batch.status !== 'cancelled' && (
          <>
            <button className="btn small ghost" onClick={() => setMode(mode === 'input' ? null : 'input')}>
              បញ្ចូលវត្ថុធាតុដើម
            </button>
            <button className="btn small ghost" onClick={() => setMode(mode === 'done' ? null : 'done')}>
              បញ្ចប់ Batch
            </button>
          </>
        )}
        {batch.status === 'completed' && (
          <button className="btn small ghost" onClick={() => setMode(mode === 'pack' ? null : 'pack')}>
            វេចខ្ចប់
          </button>
        )}
      </div>

      {mode === 'input' && (
        <div style={{ marginTop: '0.75rem' }}>
          <Field label="វត្ថុធាតុដើម">
            <select value={form.raw_material_id} onChange={(e) => set({ raw_material_id: e.target.value })}>
              <option value="">— ជ្រើសរើស —</option>
              {materials.map((m) => (
                <option key={m.raw_material_id} value={m.raw_material_id}>
                  {m.name_km} (មាន {kg(m.qty_kg)})
                </option>
              ))}
            </select>
          </Field>
          <Field label="បរិមាណប្រើ (គីឡូ)">
            <input type="number" step="any" min="0" value={form.qty_kg}
                   onChange={(e) => set({ qty_kg: e.target.value })} />
          </Field>
          <button className="btn wide" disabled={busy} onClick={addInput}>ដកចេញពីស្តុក</button>
        </div>
      )}

      {mode === 'done' && (
        <div style={{ marginTop: '0.75rem' }}>
          <Field label="ទិន្នផលពិត (គីឡូ)">
            <input type="number" step="any" min="0" value={form.output}
                   onChange={(e) => set({ output: e.target.value })} />
          </Field>
          {batch.total_input_kg > 0 && form.output && (
            <p className="notice info">
              អត្រាទិន្នផល ≈ {((Number(form.output) / Number(batch.total_input_kg)) * 100).toFixed(1)}%
              (ប្រើ {kg(batch.total_input_kg)})
            </p>
          )}
          <button className="btn wide" disabled={busy} onClick={complete}>បញ្ចប់ Batch</button>
        </div>
      )}

      {mode === 'pack' && (
        <div style={{ marginTop: '0.75rem' }}>
          <Field label="SKU">
            <select value={form.product_variant_id}
                    onChange={(e) => set({ product_variant_id: e.target.value })}>
              <option value="">— ជ្រើសរើស —</option>
              {variants.map((v) => <option key={v.id} value={v.id}>{v.name_km}</option>)}
            </select>
          </Field>
          <Field label="ចំនួនកញ្ចប់">
            <input type="number" min="1" value={form.qty_units}
                   onChange={(e) => set({ qty_units: e.target.value })} />
          </Field>
          <button className="btn wide" disabled={busy} onClick={pack}>បញ្ចូលស្តុកសម្រេច</button>
        </div>
      )}
    </div>
  );
}

export default function Production() {
  const batches = useData('/production/batches');
  const products = useData('/catalog/products');
  const materials = useData('/inventory/raw');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);

  if (batches.loading || products.loading || materials.loading) return <Loading />;
  const err = batches.error || products.error;
  if (err) return <Notice tone="error">{err}</Notice>;

  const reload = () => { batches.reload(); materials.reload(); setCreating(false); };
  const variantsFor = (productId) =>
    products.data.find((p) => p.id === productId)?.variants || [];

  return (
    <>
      {creating ? (
        <Section title="Batch ថ្មី">
          <NewBatch products={products.data} onDone={reload} onCancel={() => setCreating(false)} />
        </Section>
      ) : (
        <Section
          title="ផលិតកម្ម"
          action={<button className="btn small" onClick={() => setCreating(true)}>Batch ថ្មី</button>}
        >
          {batches.data.length === 0
            ? <Empty>មិនទាន់មាន batch ណាមួយឡើយ។ បង្កើត batch ដំបូងដើម្បីចាប់ផ្តើមផលិត។</Empty>
            : batches.data.map((b) => (
                <div key={b.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <button className="row" style={{ width: '100%', background: 'none',
                            border: 0, borderBottom: 0, font: 'inherit', textAlign: 'left',
                            cursor: 'pointer' }}
                          onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                    <div className="grow">
                      <span className="name">{b.batch_code} · {b.product_name}</span>
                      <span className="sub">
                        {date(b.start_date)}
                        {b.total_input_kg ? ` · ប្រើ ${kg(b.total_input_kg)}` : ''}
                        {b.actual_output_kg ? ` · បាន ${kg(b.actual_output_kg)}` : ''}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Tag tone={tone[b.status]}>{batchLabel[b.status]}</Tag>
                      {b.yield_pct != null && (
                        <div className="num" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                          ទិន្នផល {b.yield_pct}%
                        </div>
                      )}
                    </div>
                  </button>
                  {openId === b.id && (
                    <BatchActions batch={b} materials={materials.data}
                                  variants={variantsFor(b.product_id)} onDone={reload} />
                  )}
                </div>
              ))}
        </Section>
      )}
    </>
  );
}
