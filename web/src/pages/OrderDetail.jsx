import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData, Section, Loading, Notice, Field, Tag } from '../ui';
import { api, money, date, payLabel, payTone, docLabel, docTone } from '../api';
import { useAuth } from '../App';

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data, error, loading, reload } = useData(`/orders/${id}`);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  if (loading) return <Loading />;
  if (error) return <Notice tone="error">{error}</Notice>;

  const remaining = Number(data.total) - Number(data.paid_amount);

  async function act(fn, okText) {
    setBusy(true); setMsg(null);
    try {
      const r = await fn();
      setMsg({ tone: 'ok', text: typeof okText === 'function' ? okText(r) : okText });
      setAmount(''); setReason(''); setShowCancel(false);
      reload();
    } catch (e) { setMsg({ tone: 'error', text: e.message }); } finally { setBusy(false); }
  }

  return (
    <>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Section
        title={data.order_no}
        meta={date(data.order_date)}
      >
        <div className="row">
          <div className="grow">
            <span className="name">{data.customer_name || 'អតិថិជនទូទៅ'}</span>
            {data.phone_display && <span className="sub">{data.phone_display}</span>}
            {data.address && <span className="sub">{data.address}</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <Tag tone={docTone[data.status]}>{docLabel[data.status]}</Tag>
            {data.status === 'confirmed' && (
              <Tag tone={payTone[data.pay_status]}>{payLabel[data.pay_status]}</Tag>
            )}
          </div>
        </div>

        {data.items.map((it) => (
          <div className="row" key={it.id}>
            <div className="grow">
              <span className="name">{it.name_km}</span>
              <span className="sub">
                {it.qty_units} កញ្ចប់ × {money(it.unit_price)}
              </span>
            </div>
            <span className="num">{money(it.line_total)}</span>
          </div>
        ))}

        <div className="row">
          <div className="grow"><span className="sub">សរុបរង</span></div>
          <span className="num">{money(data.subtotal)}</span>
        </div>
        {Number(data.discount) > 0 && (
          <div className="row">
            <div className="grow"><span className="sub">បញ្ចុះតម្លៃ</span></div>
            <span className="num">−{money(data.discount)}</span>
          </div>
        )}
        <div className="row" style={{ borderTop: '2px solid var(--line-strong)' }}>
          <div className="grow"><strong>សរុប</strong></div>
          <span className="num" style={{ fontWeight: 700 }}>{money(data.total)}</span>
        </div>
        {data.status === 'confirmed' && (
          <div className="row" style={{ borderBottom: 0 }}>
            <div className="grow">
              <span className="sub">បង់រួច {money(data.paid_amount)}</span>
            </div>
            <span className="num" style={{ fontWeight: 600,
                    color: remaining > 0 ? 'var(--brick)' : 'var(--leaf-dark)' }}>
              នៅសល់ {money(remaining)}
            </span>
          </div>
        )}
      </Section>

      {data.status === 'draft' && (
        <div className="actions">
          <button className="btn" disabled={busy}
                  onClick={() => act(() => api.post(`/orders/${id}/confirm`, {}),
                    (r) => r.points_earned > 0
                      ? `បញ្ជាក់រួច — ដកស្តុក និងផ្តល់ ${r.points_earned} ពិន្ទុ`
                      : 'បញ្ជាក់រួច — ដកស្តុករួចរាល់')}>
            បញ្ជាក់ និងដកស្តុក
          </button>
        </div>
      )}

      {data.status === 'confirmed' && remaining > 0 && (
        <Section title="កត់ត្រាការទូទាត់">
          <Field label={`ចំនួនទឹកប្រាក់ (នៅសល់ ${money(remaining)})`}>
            <input type="number" step="any" min="0" max={remaining} value={amount}
                   onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div className="actions">
            <button className="btn" disabled={busy || !amount}
                    onClick={() => act(() => api.post(`/orders/${id}/payments`,
                      { amount: Number(amount) }), 'កត់ត្រាការទូទាត់រួចរាល់')}>
              កត់ត្រា
            </button>
            <button className="btn ghost" disabled={busy}
                    onClick={() => act(() => api.post(`/orders/${id}/payments`,
                      { amount: remaining }), 'បង់ពេញរួចរាល់')}>
              បង់ពេញ {money(remaining)}
            </button>
          </div>
        </Section>
      )}

      {data.payments?.length > 0 && (
        <Section title="ប្រវត្តិទូទាត់">
          {data.payments.map((p, i) => (
            <div className="row" key={i}>
              <div className="grow"><span className="sub">{date(p.paid_at)} · {p.method}</span></div>
              <span className="num">{money(p.amount)}</span>
            </div>
          ))}
        </Section>
      )}

      {user.role === 'admin' && data.status !== 'cancelled' && (
        <Section title="លុបចោលវិក្កយបត្រ">
          {!showCancel ? (
            <button className="btn ghost danger" style={{ color: 'var(--brick)',
                      borderColor: 'var(--brick)', background: 'transparent' }}
                    onClick={() => setShowCancel(true)}>
              លុបចោល
            </button>
          ) : (
            <>
              <p className="notice info">
                ស្តុក និងពិន្ទុភក្ដីភាពនឹងត្រឡប់មកវិញស្វ័យប្រវត្តិ។
                វិក្កយបត្រដែលបង់ប្រាក់រួចមិនអាចលុបចោលបានទេ។
              </p>
              <Field label="មូលហេតុ">
                <input value={reason} onChange={(e) => setReason(e.target.value)}
                       placeholder="ឧ. អតិថិជនប្តូរចិត្ត" />
              </Field>
              <div className="actions">
                <button className="btn danger" disabled={busy || !reason}
                        onClick={() => act(() => api.post(`/orders/${id}/cancel`, { reason }),
                          'លុបចោលរួច — ស្តុកត្រឡប់វិញហើយ')}>
                  បញ្ជាក់ការលុបចោល
                </button>
                <button className="btn ghost" onClick={() => setShowCancel(false)}>ថយក្រោយ</button>
              </div>
            </>
          )}
        </Section>
      )}

      <div className="actions">
        <button className="btn ghost" onClick={() => nav('/orders')}>ត្រឡប់ទៅបញ្ជីលក់</button>
      </div>
    </>
  );
}
