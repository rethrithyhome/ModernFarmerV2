import { Link } from 'react-router-dom';
import { useAuth, can } from '../App';
import { Section } from '../ui';

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
    </>
  );
}
