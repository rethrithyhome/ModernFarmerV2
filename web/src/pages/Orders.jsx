import { Link } from 'react-router-dom';
import { useData, Section, Loading, Notice, Empty, Tag } from '../ui';
import { money, date, payLabel, payTone, docLabel, docTone } from '../api';

export default function Orders() {
  const { data, error, loading } = useData('/orders');

  if (loading) return <Loading />;
  if (error) return <Notice tone="error">{error}</Notice>;

  return (
    <Section
      title="ការលក់"
      action={<Link className="btn small" to="/orders/new">លក់ថ្មី</Link>}
    >
      {data.length === 0
        ? <Empty>មិនទាន់មានវិក្កយបត្រ។ ចុច «លក់ថ្មី» ដើម្បីចាប់ផ្តើម។</Empty>
        : data.map((o) => (
            <Link className="row" key={o.id} to={`/orders/${o.id}`}>
              <div className="grow">
                <span className="name">{o.customer_name || 'អតិថិជនទូទៅ'}</span>
                <span className="sub">{o.order_no} · {date(o.order_date)}</span>
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                  <Tag tone={docTone[o.status]}>{docLabel[o.status]}</Tag>
                  {o.status === 'confirmed' && (
                    <Tag tone={payTone[o.pay_status]}>{payLabel[o.pay_status]}</Tag>
                  )}
                </div>
              </div>
              <span className="num" style={{ fontWeight: 600 }}>{money(o.total)}</span>
            </Link>
          ))}
    </Section>
  );
}
