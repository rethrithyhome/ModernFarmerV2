import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, Section, Loading, Notice, Empty, Tag } from '../ui';
import { api, money, date, payLabel, payTone, docLabel, docTone } from '../api';

export default function Purchases() {
  const { data, error, loading, reload } = useData('/purchases');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);

  async function confirm(id, label) {
    setBusy(id);
    setMsg(null);
    try {
      const r = await api.send(`/purchases/${id}/confirm`, {}, `បញ្ជាក់ចូលស្តុក ${label}`);
      setMsg(r.queued
        ? { tone: 'info', text: 'រក្សាទុកក្នុងជួររង់ចាំ — នឹងផ្ញើពេលបណ្តាញត្រឡប់មក' }
        : { tone: 'ok', text: 'បញ្ជាក់រួចរាល់ — វត្ថុធាតុដើមចូលស្តុកហើយ' });
      reload();
    } catch (e) {
      setMsg({ tone: 'error', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <Notice tone="error">{error}</Notice>;

  return (
    <>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <Section
        title="ការទិញវត្ថុធាតុដើម"
        action={<Link className="btn small" to="/purchases/new">បញ្ជាទិញថ្មី</Link>}
      >
        {data.length === 0
          ? <Empty>មិនទាន់មានការទិញ។ ចាប់ផ្តើមដោយបញ្ជាទិញថ្មី។</Empty>
          : data.map((p) => (
              <div className="row" key={p.id}>
                <div className="grow">
                  <span className="name">{p.supplier_name}</span>
                  <span className="sub">
                    {p.purchase_no} · {date(p.purchase_date)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                    <Tag tone={docTone[p.status]}>{docLabel[p.status]}</Tag>
                    {p.status === 'confirmed' && (
                      <Tag tone={payTone[p.pay_status]}>{payLabel[p.pay_status]}</Tag>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 600 }}>{money(p.total_amount)}</div>
                  {p.status === 'draft' && (
                    <button className="btn small" disabled={busy === p.id}
                            style={{ marginTop: '0.35rem' }}
                            onClick={() => confirm(p.id, p.purchase_no)}>
                      {busy === p.id ? '…' : 'បញ្ជាក់ចូលស្តុក'}
                    </button>
                  )}
                </div>
              </div>
            ))}
      </Section>
    </>
  );
}
