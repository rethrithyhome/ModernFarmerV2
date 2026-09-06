import { Link } from 'react-router-dom';
import { useData, Section, Loading, Notice, Empty, Tag } from '../ui';
import { money, kg } from '../api';
import { useAuth, can } from '../App';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading } = useData('/reports/dashboard');

  if (loading) return <Loading />;
  if (error) return <Notice tone="error">{error}</Notice>;

  return (
    <>
      <section className="section">
        <div className="big-label">ចំណូលថ្ងៃនេះ</div>
        <div className="big num" style={{ textAlign: 'left' }}>${money(data.today.revenue)}</div>
        <div className="meta" style={{ color: 'var(--ink-2)', fontSize: '0.85rem' }}>
          {data.today.orders} វិក្កយបត្រ · ខែនេះ ${money(data.this_month.revenue)} ពី {data.this_month.orders} វិក្កយបត្រ
        </div>
      </section>

      {data.low_stock.length > 0 && (
        <Section title="ស្តុកវត្ថុធាតុដើមជិតអស់" meta={`${data.low_stock.length} មុខ`}>
          {data.low_stock.map((s) => (
            <div className="row" key={s.name_km}>
              <div className="grow">
                <span className="name">{s.name_km}</span>
                <span className="sub">កម្រិតត្រូវបញ្ជាទិញ {kg(s.reorder_level_kg)}</span>
              </div>
              <span className="num" style={{ color: 'var(--brick)', fontWeight: 600 }}>
                {kg(s.qty_kg)}
              </span>
            </div>
          ))}
          {can(user.role, 'purchases') && (
            <div className="actions">
              <Link className="btn small" to="/purchases/new">បញ្ជាទិញថ្មី</Link>
            </div>
          )}
        </Section>
      )}

      <Section
        title="ស្តុកផលិតផលសម្រេច"
        action={can(user.role, 'orders')
          ? <Link className="btn small ghost" to="/orders/new">លក់ថ្មី</Link> : null}
      >
        {data.finished_stock.length === 0
          ? <Empty>មិនទាន់មានផលិតផលវេចខ្ចប់នៅឡើយ</Empty>
          : data.finished_stock.map((s) => (
              <div className="row" key={s.sku}>
                <div className="grow">
                  <span className="name">{s.name_km}</span>
                  <span className="sub">{s.sku}</span>
                </div>
                <span className="num">{Number(s.qty_units).toLocaleString()} កញ្ចប់</span>
              </div>
            ))}
      </Section>

      {data.active_batches.length > 0 && (
        <Section title="Batch កំពុងផលិត">
          {data.active_batches.map((b) => (
            <div className="row" key={b.batch_code}>
              <div className="grow">
                <span className="name">{b.batch_code}</span>
                <span className="sub">គ្រោងបាន {kg(b.planned_output_kg)}</span>
              </div>
              <Tag tone="warn">កំពុងផលិត</Tag>
            </div>
          ))}
        </Section>
      )}

      {data.receivable_total > 0 && can(user.role, 'receivables') && (
        <Section title="អតិថិជនជំពាក់">
          <div className="row">
            <div className="grow"><span className="name">សរុបនៅជំពាក់</span></div>
            <span className="num" style={{ fontWeight: 600 }}>${money(data.receivable_total)}</span>
          </div>
        </Section>
      )}
    </>
  );
}
