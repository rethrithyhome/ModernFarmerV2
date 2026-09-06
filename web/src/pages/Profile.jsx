import { useState } from 'react';
import { Section, Notice, Field } from '../ui';
import { api } from '../api';
import { useAuth } from '../App';

const roleName = {
  admin: 'អ្នកគ្រប់គ្រង', stock: 'អ្នកគ្រប់គ្រងស្តុក',
  sales: 'បុគ្គលិកលក់', accountant: 'គណនេយ្យករ',
};

export default function Profile() {
  const { user, logout } = useAuth();
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
        current_password: f.current,
        new_password: f.next,
      });
      setMsg({ tone: 'ok', text: 'ប្តូររួចរាល់ — កំពុងចេញពីប្រព័ន្ធ សូមចូលដោយពាក្យសម្ងាត់ថ្មី' });
      setTimeout(logout, 1800);
    } catch (err) {
      setMsg({ tone: 'error', text: err.message });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Section title="គណនីរបស់ខ្ញុំ">
        <div className="row">
          <div className="grow"><span className="sub">ឈ្មោះ</span></div>
          <span>{user.name}</span>
        </div>
        <div className="row">
          <div className="grow"><span className="sub">តួនាទី</span></div>
          <span>{roleName[user.role]}</span>
        </div>
      </Section>

      <Section title="ប្តូរពាក្យសម្ងាត់">
        <form onSubmit={submit}>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Field label="ពាក្យសម្ងាត់បច្ចុប្បន្ន">
            <input type="password" value={f.current} autoComplete="current-password"
                   onChange={(e) => set({ current: e.target.value })} required />
          </Field>
          <Field label="ពាក្យសម្ងាត់ថ្មី (យ៉ាងតិច ៨ តួ)">
            <input type="password" value={f.next} autoComplete="new-password" minLength={8}
                   onChange={(e) => set({ next: e.target.value })} required />
          </Field>
          <Field label="វាយពាក្យសម្ងាត់ថ្មីម្តងទៀត">
            <input type="password" value={f.confirm} autoComplete="new-password" minLength={8}
                   onChange={(e) => set({ confirm: e.target.value })} required />
          </Field>
          <p className="notice info">
            ក្រោយប្តូរ អ្នកនឹងចេញពីប្រព័ន្ធ ហើយត្រូវចូលម្តងទៀត។ ឧបករណ៍ផ្សេងទៀតដែលចូលដោយគណនីនេះក៏ចេញដែរ។
          </p>
          <button className="btn wide" disabled={busy}>
            {busy ? 'កំពុងប្តូរ…' : 'ប្តូរពាក្យសម្ងាត់'}
          </button>
        </form>
      </Section>
    </>
  );
}
