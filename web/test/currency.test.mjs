/**
 * តេស្តទម្រង់រូបិយប័ណ្ណ — រៀល និងដុល្លារ
 * រត់: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// currency.js ប្រើ localStorage — ក្លែងធ្វើសម្រាប់ Node
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { money, setCurrency, getCurrency, currencyLabel, moneyStep } =
  await import('../src/currency.js');

test('រៀល — គ្មានទសភាគ ហើយនិមិត្តសញ្ញានៅខាងក្រោយ', () => {
  setCurrency('KHR');
  assert.equal(getCurrency(), 'KHR');
  assert.equal(money(100000), '100,000៛');
  assert.equal(money(4100), '4,100៛');
  assert.equal(money(0), '0៛');
  assert.equal(currencyLabel(), '៛');
});

test('រៀល — លេខទសភាគត្រូវបង្គត់ ព្រោះរៀលមិនប្រើសេន', () => {
  setCurrency('KHR');
  assert.equal(money(27500.4), '27,500៛');
  assert.equal(money(27500.6), '27,501៛');
});

test('ដុល្លារ — មានទសភាគ ២ ខ្ទង់ និងនិមិត្តសញ្ញាខាងមុខ', () => {
  setCurrency('USD');
  assert.equal(money(25), '$25.00');
  assert.equal(money(1234.5), '$1,234.50');
  assert.equal(currencyLabel(), '$');
});

test('ជំហានប្រអប់បញ្ចូល សមនឹងរូបិយប័ណ្ណ', () => {
  setCurrency('KHR');
  assert.equal(moneyStep(), '100', 'រៀល — មិនគួរឱ្យវាយសេន');
  setCurrency('USD');
  assert.equal(moneyStep(), 'any');
});

test('រូបិយប័ណ្ណមិនត្រឹមត្រូវ ត្រូវមិនអើពើ (កុំឱ្យខូចការបង្ហាញ)', () => {
  setCurrency('KHR');
  setCurrency('EUR');
  assert.equal(getCurrency(), 'KHR', 'នៅតែរៀលដដែល');
});

test('រូបិយប័ណ្ណរក្សាទុកក្នុងឧបករណ៍ ដូច្នេះបើកលើកក្រោយឃើញភ្លាម', () => {
  setCurrency('USD');
  assert.equal(mem.get('mf_currency'), 'USD');
  setCurrency('KHR');
  assert.equal(mem.get('mf_currency'), 'KHR');
});
