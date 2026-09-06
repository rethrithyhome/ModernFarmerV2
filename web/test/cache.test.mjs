/**
 * តេស្តឃ្លាំងសម្ងាត់ — ធានាថាការប្តូរម៉ឺនុយលឿន តែទិន្នន័យមិនចាស់ក្រោយសរសេរ
 * រត់: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const { getCached, setCached, isFresh, clearCache } = await import('../src/cache.js');

test('ទិន្នន័យដែលរក្សាទុក អាចយកមកវិញភ្លាម (ការប្តូរម៉ឺនុយមិនបាច់រង់ចាំ)', () => {
  clearCache();
  assert.equal(getCached('/inventory/raw'), undefined);

  setCached('/inventory/raw', [{ name_km: 'លាមកគោ', qty_kg: 500 }]);
  const hit = getCached('/inventory/raw');

  assert.ok(hit, 'គួរមានច្បាប់ចម្លង');
  assert.equal(hit.data[0].qty_kg, 500);
  assert.ok(isFresh(hit), 'ទើបរក្សាទុក គួរចាត់ទុកថាថ្មី');
});

test('ទិន្នន័យចាស់ជាង ៣០ វិនាទី ត្រូវទាញឡើងវិញ', () => {
  clearCache();
  setCached('/orders', []);

  const stale = { data: [], ts: Date.now() - 31_000 };
  assert.equal(isFresh(stale), false, 'លើស ៣០ វិនាទី គួរចាត់ទុកថាចាស់');

  const recent = { data: [], ts: Date.now() - 5_000 };
  assert.equal(isFresh(recent), true);
});

test('ក្រោយសរសេរទិន្នន័យ ឃ្លាំងត្រូវលុប ដើម្បីកុំបង្ហាញលេខចាស់', () => {
  clearCache();
  setCached('/inventory/finished', [{ sku: 'FERT-ORG-50', qty_units: 30 }]);
  setCached('/reports/dashboard', { today: { revenue: 0 } });

  // ត្រាប់តាមការលក់ — api.post ហៅ clearCache()
  clearCache();

  assert.equal(getCached('/inventory/finished'), undefined,
    'ស្តុកមិនត្រូវនៅក្នុងឃ្លាំងក្រោយការលក់');
  assert.equal(getCached('/reports/dashboard'), undefined,
    'ផ្ទាំងគ្រប់គ្រងក៏ត្រូវទាញថ្មីដែរ');
});

test('ផ្លូវខុសគ្នា រក្សាទុកដាច់ដោយឡែក', () => {
  clearCache();
  setCached('/customers', [{ name: 'លី សុខា' }]);
  setCached('/customers?search=សុខ', [{ name: 'លី សុខា' }]);

  assert.ok(getCached('/customers'));
  assert.ok(getCached('/customers?search=សុខ'));
  assert.notEqual(getCached('/customers'), getCached('/customers?search=សុខ'));
});
