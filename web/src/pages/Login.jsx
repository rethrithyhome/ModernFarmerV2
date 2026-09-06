import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import { Field, Notice } from '../ui';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.post('/auth/login', { email, password });
      login(r.token, r.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <div className="mark">កសិករទំនើប</div>
        <p className="tagline">ប្រព័ន្ធគ្រប់គ្រងផលិតកម្ម និងការលក់</p>

        <Notice tone="error">{error}</Notice>

        <Field label="អ៊ីមែល">
          <input type="email" value={email} autoComplete="username"
                 onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="ពាក្យសម្ងាត់">
          <input type="password" value={password} autoComplete="current-password"
                 onChange={(e) => setPassword(e.target.value)} required />
        </Field>

        <button className="btn wide" disabled={busy}>
          {busy ? 'កំពុងចូល…' : 'ចូលប្រព័ន្ធ'}
        </button>
      </form>
    </div>
  );
}
