/**
 * តេស្តជួរសំណើរង់ចាំ ដោយប្រើ IndexedDB ក្លែងក្លាយ និង fetch ក្លែងក្លាយ។
 * រត់: npm test
 */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22 មាន navigator ជា getter — ត្រូវកំណត់ឡើងវិញដោយ defineProperty
let onLine = false;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  get: () => ({ get onLine() { return onLine; } }),
});
const setOnline = (v) => { onLine = v; };
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { enqueue, listQueue, sync, dismissFailed } = await import('../src/offline.js');

/** fetch ក្លែងក្លាយ — កត់ត្រាសំណើ រួចឆ្លើយតាមស្គ្រីប */
function mockFetch(script) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, key: opts.headers['Idempotency-Key'], body: JSON.parse(opts.body) });
    const next = script.shift();
    if (next?.throw) throw new Error('network down');
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body || {},
    };
  };
  return calls;
}

test('សំណើចូលជួរពេលអ៊ីនធឺណិតដាច់ ហើយផ្ញើតាមលំដាប់ដើម', async () => {
  setOnline(false);
  await enqueue({ path: '/purchases/1/confirm', body: {}, label: 'ទិញ' });
  await enqueue({ path: '/production/batches/1/inputs', body: { qty: 5 }, label: 'ផលិត' });

  let q = await listQueue();
  assert.equal(q.length, 2);

  setOnline(true);
  const calls = mockFetch([{ status: 200 }, { status: 201 }]);
  const r = await sync(() => 'token');

  assert.equal(r.sent, 2);
  assert.equal(calls[0].url, '/api/purchases/1/confirm', 'ការទិញត្រូវផ្ញើមុនផលិតកម្ម');
  assert.equal(calls[1].url, '/api/production/batches/1/inputs');
  assert.equal((await listQueue()).length, 0, 'ជួរត្រូវទទេក្រោយផ្ញើជោគជ័យ');
});

test('បណ្តាញដាច់ពាក់កណ្តាល — សំណើនៅដដែល ហើយប្រើលេខសម្គាល់ដដែល', async () => {
  setOnline(true);
  await enqueue({ path: '/inventory/adjust', body: { qty_change: -50 }, label: 'កែតម្រូវ' });
  const keyBefore = (await listQueue())[0].key;

  mockFetch([{ throw: true }]);
  await sync(() => 'token');

  const q = await listQueue();
  assert.equal(q.length, 1, 'សំណើមិនត្រូវបាត់ ពេលបណ្តាញដាច់');
  assert.equal(q[0].state, 'pending');

  const calls = mockFetch([{ status: 201 }]);
  await sync(() => 'token');

  assert.equal(calls[0].key, keyBefore,
    'ការផ្ញើឡើងវិញត្រូវប្រើលេខសម្គាល់ដដែល ដើម្បីកុំឱ្យស្តុកដកពីរដង');
  assert.equal((await listQueue()).length, 0);
});

test('ការបដិសេធតាមវិធានអាជីវកម្ម ត្រូវបង្ហាញមូលហេតុ មិនស្ងាត់ស្ងៀម', async () => {
  setOnline(true);
  await enqueue({ path: '/production/batches/1/inputs', body: {}, label: 'ផលិត' });

  mockFetch([{ status: 409, body: { error: 'ស្តុក លាមកគោ មិនគ្រប់គ្រាន់' } }]);
  const r = await sync(() => 'token');

  assert.equal(r.failed, 1);
  const q = await listQueue();
  assert.equal(q[0].state, 'failed');
  assert.match(q[0].error, /មិនគ្រប់គ្រាន់/);

  await dismissFailed();
  assert.equal((await listQueue()).length, 0);
});

test('កំហុសម៉ាស៊ីនមេ (5xx) — ឈប់ផ្ញើ ហើយរក្សាសំណើទុកព្យាយាមក្រោយ', async () => {
  setOnline(true);
  await enqueue({ path: '/inventory/adjust', body: {}, label: 'ទី១' });
  await enqueue({ path: '/inventory/adjust', body: {}, label: 'ទី២' });

  const calls = mockFetch([{ status: 500 }, { status: 200 }]);
  await sync(() => 'token');

  assert.equal(calls.length, 1, 'ត្រូវឈប់ភ្លាម មិនផ្ញើសំណើបន្ទាប់ ដើម្បីរក្សាលំដាប់');
  const q = await listQueue();
  assert.equal(q.length, 2);
  assert.ok(q.every((i) => i.state === 'pending'));
});
