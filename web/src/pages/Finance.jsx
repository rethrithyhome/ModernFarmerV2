import { useState } from 'react';
import { useData, Section, Loading, Notice, Empty, Field } from '../ui';
import { api, money, date } from '../api';

function ExpenseForm({ categories, onDone }) {
  const [f, setF] = useState({ category_id: '', description: '', amount: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF({ ...f, ...patch });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await api.post('/finance/expenses', {
        category_id: Number(f.category_id),
        description: f.description,
        amount: Number(f.amount),
      });
      setMsg({ tone: 'ok', text: 'កត់ត្រាចំណាយរួចរាល់' });
      setF({ category_id: '', description: '', amount: '' });
      onDone();
    } catch (err) { setMsg({ tone: 'error', text: err.message }); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="split">
        <Field label="ប្រភេទ">
          <select value={f.category_id} onChange={(e) => set({ category_id: e.target.value })} required>
            <option value="">— ជ្រើសរើស —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name_km}</option>)}
          </select>
        </Field>
        <Field label="ចំនួន ($)">
          <input type="number" step="any" min="0" value={f.amount} required
                 onChange={(e) => set({ amount: e.target.value })} />
        </Field>
      </div>
      <Field label="បរិយាយ">
        <input value={f.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <button className="btn wide" disabled={busy}>កត់ត្រាចំណាយ</button>
    </form>
  );
}

export default function Finance() {
  const [tab, setTab] = useState('pnl');
  const pnl = useData('/finance/pnl');
  const cats = useData('/finance/categories');
  const exp = useData('/finance/expenses');
  const ar = useData('/finance/receivables');
  const assets = useData('/finance/assets');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  if (pnl.loading || cats.loading) return <Loading />;
  if (pnl.error) return <Notice tone="error">{pnl.error}</Notice>;

  async function postDepreciation() {
    setBusy(true); setMsg(null);
    try {
      const r = await api.post('/finance/depreciation/post', {});
      setMsg({
        tone: 'ok',
        text: r.posted.length
          ? `ប្រកាសរំលស់ ${r.posted.length} ទ្រព្យ សរុប $${money(r.total)}`
          : 'ខែនេះបានប្រកាសរំលស់រួចហើយ',
      });
      exp.reload(); pnl.reload(); assets.reload();
    } catch (e) { setMsg({ tone: 'error', text: e.message }); } finally { setBusy(false); }
  }

  const monthName = (m) => {
    const names = ['មករា','កុម្ភៈ','មីនា','មេសា','ឧសភា','មិថុនា','កក្កដា','សីហា','កញ្ញា','តុលា','វិច្ឆិកា','ធ្នូ'];
    const d = new Date(m);
    return `${names[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div className="actions" style={{ marginTop: 0, marginBottom: '1rem' }}>
        {[['pnl','ចំណេញ-ខាត'],['expenses','ចំណាយ'],['ar','លុយជំពាក់'],['assets','ទ្រព្យ']].map(([k, label]) => (
          <button key={k} className={`btn small ${tab === k ? '' : 'ghost'}`}
                  onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'pnl' && (
        <Section title="ចំណេញ-ខាតតាមខែ">
          {pnl.data.length === 0 ? <Empty>មិនទាន់មានទិន្នន័យ</Empty>
            : pnl.data.map((m) => (
                <div className="row" key={m.month}>
                  <div className="grow">
                    <span className="name">{monthName(m.month)}</span>
                    <span className="sub">
                      ចំណូល ${money(m.revenue)} · ថ្លៃដើម ${money(m.cogs)} · ចំណាយ ${money(m.opex)}
                    </span>
                  </div>
                  <span className="num" style={{ fontWeight: 700,
                          color: Number(m.net_profit) >= 0 ? 'var(--leaf-dark)' : 'var(--brick)' }}>
                    {Number(m.net_profit) < 0 ? '−' : ''}${money(Math.abs(m.net_profit))}
                  </span>
                </div>
              ))}
        </Section>
      )}

      {tab === 'expenses' && (
        <>
          <Section title="កត់ត្រាចំណាយថ្មី">
            <ExpenseForm categories={cats.data} onDone={() => { exp.reload(); pnl.reload(); }} />
          </Section>
          <Section title="ចំណាយចុងក្រោយ">
            {exp.loading ? <Loading /> : exp.error ? <Notice tone="error">{exp.error}</Notice>
              : exp.data.length === 0 ? <Empty>មិនទាន់មានចំណាយ</Empty>
              : exp.data.slice(0, 30).map((e) => (
                  <div className="row" key={e.id}>
                    <div className="grow">
                      <span className="name">{e.description || e.category}</span>
                      <span className="sub">{e.category} · {date(e.expense_date)}</span>
                    </div>
                    <span className="num">${money(e.amount)}</span>
                  </div>
                ))}
          </Section>
        </>
      )}

      {tab === 'ar' && (
        <>
          <Section title="អតិថិជនជំពាក់យើង"
                   meta={ar.data ? `$${money(ar.data.receivable_total)}` : ''}>
            {ar.loading ? <Loading /> : ar.error ? <Notice tone="error">{ar.error}</Notice>
              : ar.data.receivable.length === 0 ? <Empty>គ្មានអតិថិជនជំពាក់</Empty>
              : ar.data.receivable.map((r) => (
                  <div className="row" key={r.id}>
                    <div className="grow">
                      <span className="name">{r.customer_name || 'អតិថិជនទូទៅ'}</span>
                      <span className="sub">{r.order_no} · {date(r.order_date)}</span>
                    </div>
                    <span className="num" style={{ color: 'var(--brick)', fontWeight: 600 }}>
                      ${money(r.outstanding)}
                    </span>
                  </div>
                ))}
          </Section>
          <Section title="យើងជំពាក់អ្នកផ្គត់ផ្គង់"
                   meta={ar.data ? `$${money(ar.data.payable_total)}` : ''}>
            {ar.data && (ar.data.payable.length === 0 ? <Empty>គ្មានបំណុល</Empty>
              : ar.data.payable.map((r) => (
                  <div className="row" key={r.id}>
                    <div className="grow">
                      <span className="name">{r.supplier_name}</span>
                      <span className="sub">{r.purchase_no} · {date(r.purchase_date)}</span>
                    </div>
                    <span className="num" style={{ fontWeight: 600 }}>${money(r.outstanding)}</span>
                  </div>
                )))}
          </Section>
        </>
      )}

      {tab === 'assets' && (
        <Section title="ទ្រព្យ និងរំលស់"
                 action={<button className="btn small" disabled={busy}
                                 onClick={postDepreciation}>ប្រកាសរំលស់ខែនេះ</button>}>
          {assets.loading ? <Loading /> : assets.error ? <Notice tone="error">{assets.error}</Notice>
            : assets.data.length === 0 ? <Empty>មិនទាន់មានទ្រព្យកត់ត្រា</Empty>
            : assets.data.map((a) => (
                <div className="row" key={a.asset_id}>
                  <div className="grow">
                    <span className="name">{a.name_km}</span>
                    <span className="sub">
                      ទិញ ${money(a.purchase_cost)} · {a.useful_life_months} ខែ ·
                      តម្លៃសៀវភៅ ${money(a.book_value)}
                    </span>
                  </div>
                  <span className="num">${money(a.monthly_depreciation)}/ខែ</span>
                </div>
              ))}
        </Section>
      )}
    </>
  );
}
