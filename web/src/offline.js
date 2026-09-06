/**
 * ជួរសំណើរង់ចាំ (offline write queue)
 *
 * នៅរោងចក្រ អ៊ីនធឺណិតដាច់ៗ។ ការកត់ត្រាមិនត្រូវបាត់ទេ។
 * សំណើដែលផ្ញើមិនកើត រក្សាទុកក្នុង IndexedDB (នៅដដែលទោះបិទកម្មវិធី)
 * រួចផ្ញើដោយស្វ័យប្រវត្តិពេលបណ្តាញត្រឡប់មកវិញ។
 *
 * គន្លឹះសំខាន់: សំណើនីមួយៗមានលេខសម្គាល់តែមួយ (Idempotency-Key) បង្កើតតាំងពី
 * ដំបូង។ បើសំណើទៅដល់ម៉ាស៊ីនមេហើយ តែចម្លើយបាត់ពាក់កណ្តាលផ្លូវ ការផ្ញើម្តងទៀត
 * ក៏មិនធ្វើស្ទួនដែរ — ម៉ាស៊ីនមេស្គាល់លេខនោះ ហើយឆ្លើយចម្លើយចាស់វិញ។
 */

const DB_NAME = 'mf-offline';
const STORE = 'queue';
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try { result = fn(store); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  });
}

// ---------- អ្នកស្តាប់ការផ្លាស់ប្តូរ ----------
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
async function notify() {
  const items = await listQueue();
  listeners.forEach((fn) => fn(items));
}

// ---------- ប្រតិបត្តិការមូលដ្ឋាន ----------
function newKey() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function enqueue({ method = 'POST', path, body, label }) {
  const item = {
    key: newKey(),
    method,
    path,
    body,
    label: label || path,
    state: 'pending',
    error: null,
    createdAt: new Date().toISOString(),
  };
  await tx('readwrite', (s) => s.add(item));
  await notify();
  return item;
}

export async function listQueue() {
  return tx('readonly', (s) => s.getAll());
}

export async function removeItem(id) {
  await tx('readwrite', (s) => s.delete(id));
  await notify();
}

async function updateItem(item) {
  await tx('readwrite', (s) => s.put(item));
  await notify();
}

/** លុបសំណើដែលបរាជ័យ បន្ទាប់ពីអ្នកប្រើបានឃើញមូលហេតុ */
export async function dismissFailed() {
  const items = await listQueue();
  const failed = items.filter((i) => i.state === 'failed');
  await Promise.all(failed.map((i) => tx('readwrite', (s) => s.delete(i.id))));
  await notify();
}

/** សាកល្បងផ្ញើសំណើដែលបរាជ័យម្តងទៀត */
export async function retryFailed() {
  const items = await listQueue();
  await Promise.all(
    items.filter((i) => i.state === 'failed')
      .map((i) => tx('readwrite', (s) => s.put({ ...i, state: 'pending', error: null })))
  );
  await notify();
  return sync();
}

// ---------- ការផ្ញើឡើងវិញ ----------
let syncing = false;

/**
 * ផ្ញើសំណើរង់ចាំតាមលំដាប់ដើម។
 * លំដាប់សំខាន់: ការទិញត្រូវចូលស្តុកមុន ទើបផលិតកម្មដកបាន។
 */
export async function sync(getToken) {
  if (syncing || !navigator.onLine) return { sent: 0, failed: 0, stopped: true };
  syncing = true;
  let sent = 0;
  let failed = 0;

  try {
    const items = (await listQueue())
      .filter((i) => i.state === 'pending')
      .sort((a, b) => a.id - b.id);

    for (const item of items) {
      let res;
      try {
        res = await fetch(`/api${item.path}`, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': item.key,
            ...(getToken?.() ? { Authorization: `Bearer ${getToken()}` } : {}),
          },
          body: JSON.stringify(item.body ?? {}),
        });
      } catch {
        break; // បណ្តាញដាច់ម្តងទៀត — ឈប់ ហើយព្យាយាមក្រោយ
      }

      if (res.ok) {
        await removeItem(item.id);
        sent++;
        continue;
      }

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        // ម៉ាស៊ីនមេកំពុងដំណើរការសំណើដដែល — ទុកសិន
        if (/កំពុងដំណើរការ/.test(data.error || '')) break;
        await updateItem({ ...item, state: 'failed', error: data.error || 'សំណើត្រូវបានបដិសេធ' });
        failed++;
        continue;
      }

      if (res.status === 401) break; // ត្រូវចូលប្រព័ន្ធម្តងទៀត

      if (res.status >= 500) break; // បញ្ហាម៉ាស៊ីនមេ — ព្យាយាមក្រោយ

      const data = await res.json().catch(() => ({}));
      await updateItem({ ...item, state: 'failed', error: data.error || 'សំណើមិនជោគជ័យ' });
      failed++;
    }
  } finally {
    syncing = false;
  }

  await notify();
  return { sent, failed };
}

/** ចាប់ផ្តើមផ្ញើស្វ័យប្រវត្តិ ពេលបណ្តាញត្រឡប់មកវិញ */
export function startAutoSync(getToken, onDone) {
  const run = async () => {
    const r = await sync(getToken);
    if (r.sent || r.failed) onDone?.(r);
  };
  window.addEventListener('online', run);
  const timer = setInterval(() => { if (navigator.onLine) run(); }, 30000);
  run();
  return () => {
    window.removeEventListener('online', run);
    clearInterval(timer);
  };
}
