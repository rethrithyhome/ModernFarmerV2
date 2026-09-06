import { enqueue } from './offline';
import { clearCache } from './cache';

const TOKEN_KEY = 'mf_token';
const USER_KEY = 'mf_user';

export const store = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  },
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(method, path, body, idempotencyKey) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('ភ្ជាប់ម៉ាស៊ីនមេមិនបាន — ពិនិត្យអ៊ីនធឺណិត', 0);
  }

  if (res.status === 401) {
    store.clear();
    window.location.hash = '#/login';
    throw new ApiError('សម័យប្រើប្រាស់ផុតកំណត់ សូមចូលម្តងទៀត', 401);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'សំណើមិនជោគជ័យ', res.status);
  return data;
}

export const api = {
  get: (p) => request('GET', p),

  // ក្រោយសរសេរទិន្នន័យ លុបឃ្លាំង ដើម្បីកុំឱ្យទំព័របង្ហាញលេខចាស់
  post: async (p, b) => { const r = await request('POST', p, b); clearCache(); return r; },
  patch: async (p, b) => { const r = await request('PATCH', p, b); clearCache(); return r; },

  /**
   * សំណើដែលអាចរង់ចាំបាន — ប្រើសម្រាប់ការកត់ត្រានៅរោងចក្រ។
   * បើបណ្តាញដាច់ សំណើចូលជួររង់ចាំ ហើយផ្ញើឡើងវិញពេលបណ្តាញត្រឡប់មក។
   * ត្រឡប់ { queued: true } ពេលចូលជួរ ដូច្នេះផ្ទាំងត្រូវពិនិត្យតម្លៃនេះ។
   */
  async send(path, body, label) {
    if (navigator.onLine) {
      try {
        const r = await request('POST', path, body);
        clearCache();
        return r;
      } catch (e) {
        // តែកំហុសបណ្តាញទេដែលចូលជួរ — ការបដិសេធតាមវិធានអាជីវកម្មបោះចេញ
        if (e.status !== 0) throw e;
      }
    }
    await enqueue({ method: 'POST', path, body, label });
    clearCache();
    return { queued: true };
  },
};

// រូបិយប័ណ្ណនៅក្នុង currency.js — នាំចេញបន្តដើម្បីភាពងាយស្រួល
export { money, setCurrency, getCurrency, currencyLabel, moneyStep } from './currency';

/** ទម្រង់បរិមាណ — បង្ហាញតោនពេលលេខធំ ដើម្បីអានស្រួល */
export function kg(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 2 })} តោន`;
  return `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} គ.ក`;
}

export function date(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const payLabel = { paid: 'បង់រួច', partial: 'បង់ខ្លះ', unpaid: 'មិនទាន់បង់' };
export const payTone = { paid: 'ok', partial: 'warn', unpaid: 'danger' };
export const docLabel = { draft: 'ព្រាង', confirmed: 'បញ្ជាក់រួច', cancelled: 'លុបចោល' };
export const docTone = { draft: 'quiet', confirmed: 'ok', cancelled: 'danger' };
export const batchLabel = {
  planned: 'គ្រោងទុក', in_progress: 'កំពុងផលិត', completed: 'បញ្ចប់', cancelled: 'លុបចោល',
};
