import { Link } from 'react-router-dom';
import { useAuth, can } from '../App';
import { Section } from '../ui';

const APP_VERSION = '2.7';

export default function More() {
  const { user } = useAuth();
  const links = [
    ['/orders', 'ការលក់', 'វិក្កយបត្រ និងការទូទាត់', 'orders'],
    ['/customers', 'អតិថិជន', 'ព័ត៌មានទំនាក់ទំនង និងពិន្ទុភក្ដីភាព', 'customers'],
    ['/purchases', 'ការទិញវត្ថុធាតុដើម', 'អ្នកផ្គត់ផ្គង់ និងវិក្កយបត្រទិញ', 'purchases'],
    ['/production', 'ផលិតកម្ម', 'Batch រូបមន្ត និងការវេចខ្ចប់', 'production'],
    ['/stock', 'ស្តុក', 'វត្ថុធាតុដើម និងផលិតផលសម្រេច', 'stock'],
    ['/finance', 'ហិរញ្ញវត្ថុ', 'ចំណាយ រំលស់ និងចំណេញ-ខាត', 'finance'],
    ['/settings', 'ការកំណត់', 'ផលិតផល វេចខ្ចប់ វត្ថុធាតុដើម', 'settings'],
    ['/users', 'គណនីបុគ្គលិក', 'បង្កើត បិទ និងកំណត់ពាក្យសម្ងាត់', 'users'],
  ].filter(([, , , area]) => can(user.role, area));

  const roleName = { admin: 'អ្នកគ្រប់គ្រង', stock: 'អ្នកគ្រប់គ្រងស្តុក',
                     sales: 'បុគ្គលិកលក់', accountant: 'គណនេយ្យករ' }[user.role];

  return (
    <>
      <Section title="មុខងារទាំងអស់" meta={roleName}>
        {links.map(([to, name, sub]) => (
          <Link key={to} className="row" to={to}>
            <div className="grow">
              <span className="name">{name}</span>
              <span className="sub">{sub}</span>
            </div>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </Section>

      <Section title="អំពីកម្មវិធី">
        <div className="row">
          <div className="grow">
            <span className="name">កំណែ</span>
            <span className="sub">
              បើលេខនេះមិនប្តូរក្រោយដាក់កំណែថ្មី សូមបិទកម្មវិធីទាំងស្រុងរួចបើកវិញ
            </span>
          </div>
          <span className="num">{APP_VERSION}</span>
        </div>
      </Section>

      <Section title="គណនីរបស់ខ្ញុំ">
        <Link className="row" to="/profile">
          <div className="grow">
            <span className="name">ប្តូរពាក្យសម្ងាត់</span>
            <span className="sub">{user.name}</span>
          </div>
          <span aria-hidden="true">›</span>
        </Link>
      </Section>
    </>
  );
}
