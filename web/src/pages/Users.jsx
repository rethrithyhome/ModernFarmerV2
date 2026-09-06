import { useState } from 'react';
import { useData, Section, Loading, Notice, Empty, Field, Tag } from '../ui';
import { api, date } from '../api';
import { useAuth } from '../App';

const ROLES = [
  ['admin', 'អ្នកគ្រប់គ្រង', 'ឃើញគ្រប់យ៉ាង រួមទាំងហិរញ្ញវត្ថុ និងការលុបចោលវិក្កយបត្រ'],
  ['stock', 'អ្នកគ្រប់គ្រងស្តុក', 'ស្តុក · ផលិតកម្ម · ការទិញវត្ថុធាតុដើម'],
  ['sales', 'បុគ្គលិកលក់', 'ការលក់ · អតិថិជន · មើលស្តុក'],
  ['accountant', 'គណនេយ្យករ', 'ចំណាយ · រំលស់ · ចំណេញ-ខាត · លុយជំពាក់'],
];
const roleName = Object.fromEntries(ROLES.map(([k, n]) => [k, n]));

function NewUser({ onDone, onCancel }) {
  const [f, setF] = useState({ full_name: '', email: '', password: '', role: 'sales', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (p) => setF({ ...f, ...p });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.post('/auth/users', f); onDone(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <Notice tone="error">{error}</Notice>
      <Field label="ឈ្មោះពេញ">
        <input value={f.full_name} onChange={(e) => set({ full_name: e.target.value })} required />
      </Field>
      <Field label="អ៊ីមែល (ប្រើសម្រាប់ចូលប្រព័ន្ធ)">
        <input type="email" value={f.email} autoComplete="off"
               onChange={(e) => set({ email: e.target.value })} required />
      </Field>
      <Field label="លេខទូរស័ព្ទ">
        <input type="tel" value={f.phone} placeholder="012 345 678"
               onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label="ពាក្យសម្ងាត់ដំបូង (យ៉ាងតិច ៨ តួ)">
        <input value={f.password} autoComplete="new-password" minLength={8}
               onChange={(e) => set({ password: e.target.value })} required />
      </Field>
      <Field label="តួនាទី">
        <select value={f.role} onChange={(e) => set({ role: e.target.value })}>
          {ROLES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </Field>
      <p className="notice info">
        {ROLES.find(([k]) => k === f.role)?.[2]}
      </p>
      <p className="notice info">
        ប្រាប់ពាក្យសម្ងាត់នេះទៅបុគ្គលិកដោយផ្ទាល់ ហើយប្រាប់គាត់ឱ្យប្តូរវាភ្លាមៗក្រោយចូលលើកដំបូង។
      </p>
      <div className="actions">
        <button className="btn" disabled={busy}>បង្កើតគណនី</button>
        <button type="button" className="btn ghost" onClick={onCancel}>បោះបង់</button>
      </div>
    </form>
  );
}

function UserRow({ u, me, onChanged }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const isMe = u.id === me.id;

  async function run(fn, ok) {
    setBusy(true); setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'ok', text: ok });
      setPw('');
      onChanged();
    } catch (e) { setMsg({ tone: 'error', text: e.message }); } finally { setBusy(false); }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <button className="row" style={{ width: '100%', background: 'none', border: 0,
                borderBottom: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => setOpen(!open)}>
        <div className="grow">
          <span className="name">{u.full_name}{isMe ? ' (អ្នក)' : ''}</span>
          <span className="sub">{u.email}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Tag tone={u.is_active ? 'ok' : 'danger'}>
            {u.is_active ? roleName[u.role] : 'បិទ'}
          </Tag>
        </div>
      </button>

      {open && (
        <div style={{ paddingBottom: '0.9rem' }}>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

          <Field label="តួនាទី">
            <select value={u.role} disabled={isMe || busy}
                    onChange={(e) => run(
                      () => api.patch(`/auth/users/${u.id}`, { role: e.target.value }),
                      'ប្តូរតួនាទីរួចរាល់'
                    )}>
              {ROLES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Field>
          {isMe && (
            <p className="notice info">
              មិនអាចប្តូរតួនាទី ឬបិទគណនីខ្លួនឯងបានទេ — ការពារកុំឱ្យចាក់សោខ្លួនឯងចេញ។
            </p>
          )}

          <Field label="កំណត់ពាក្យសម្ងាត់ថ្មី (ពេលបុគ្គលិកភ្លេច)">
            <input value={pw} onChange={(e) => setPw(e.target.value)}
                   autoComplete="new-password" placeholder="យ៉ាងតិច ៨ តួ" />
          </Field>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn small" disabled={busy || pw.length < 8}
                    onClick={() => run(
                      () => api.patch(`/auth/users/${u.id}/password`, { new_password: pw }),
                      'ប្តូររួច — គាត់ត្រូវចូលម្តងទៀតដោយពាក្យសម្ងាត់ថ្មី'
                    )}>
              កំណត់ពាក្យសម្ងាត់
            </button>

            {!isMe && (
              <button className={`btn small ${u.is_active ? '' : 'ghost'}`} disabled={busy}
                      style={u.is_active
                        ? { background: 'var(--brick)', borderColor: 'var(--brick)' } : undefined}
                      onClick={() => run(
                        () => api.patch(`/auth/users/${u.id}`, { is_active: !u.is_active }),
                        u.is_active ? 'បិទគណនីរួច — គាត់ចេញពីប្រព័ន្ធភ្លាម' : 'បើកគណនីវិញរួច'
                      )}>
                {u.is_active ? 'បិទគណនី' : 'បើកគណនីវិញ'}
              </button>
            )}
          </div>

          <p className="sub" style={{ color: 'var(--ink-2)', fontSize: '0.8rem', marginTop: '0.6rem' }}>
            បង្កើត {date(u.created_at)} · ប្តូរពាក្យសម្ងាត់ចុងក្រោយ {date(u.password_changed_at)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useData('/auth/users');
  const [adding, setAdding] = useState(false);

  if (loading) return <Loading />;
  if (error) return <Notice tone="error">{error}</Notice>;

  if (adding) {
    return (
      <Section title="បង្កើតគណនីបុគ្គលិក">
        <NewUser onDone={() => { setAdding(false); reload(); }} onCancel={() => setAdding(false)} />
      </Section>
    );
  }

  const active = data.filter((u) => u.is_active);

  return (
    <Section
      title="គណនីបុគ្គលិក"
      action={<button className="btn small" onClick={() => setAdding(true)}>គណនីថ្មី</button>}
    >
      {data.length === 0 ? <Empty>មិនទាន់មានគណនី</Empty> : (
        <>
          {data.map((u) => (
            <UserRow key={u.id} u={u} me={user} onChanged={reload} />
          ))}
          <p className="sub" style={{ color: 'var(--ink-2)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
            {active.length} គណនីដំណើរការ · ចុចលើឈ្មោះដើម្បីកែ
          </p>
        </>
      )}
    </Section>
  );
}
