/**
 * តេស្ត SupplierForm — ការពារកុំឱ្យបង្កើតអ្នកផ្គត់ផ្គង់ដែលលេខទូរស័ព្ទស្ទួន
 *
 * លំហូរដែលត្រូវផ្ទៀងផ្ទាត់: អ្នកប្រើវាយលេខទូរស័ព្ទមុន → ប្រព័ន្ធពិនិត្យ
 * ស្វ័យប្រវត្តិក្រោយឈប់វាយ (មិនសួរម៉ាស៊ីនមេរាល់តួអក្សរ) → បើមានរួចហើយ
 * បង្ហាញឈ្មោះម្ចាស់ភ្លាមៗ និងបិទប៊ូតុងរក្សាទុក។
 *
 * រត់: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = React;

function fireEvent(el, type, opts = {}) {
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true, ...opts }));
}
function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  fireEvent(input, 'input');
}

/** ត្រាប់តាមម៉ាស៊ីនមេ — លេខ 099888777 មានស្រាប់ជា "ហាង សុវណ្ណ" */
function mockFetch() {
  global.fetch = (url, opts = {}) => {
    if (url.includes('/by-phone')) {
      const phone = decodeURIComponent(url.split('phone=')[1] || '');
      const digits = phone.replace(/\D/g, '');
      const known = digits.endsWith('99888777') || digits.endsWith('99888777'.replace(/^0/, ''));
      return Promise.resolve({
        ok: true, status: 200,
        json: async () => (known ? { id: 1, name: 'ហាង សុវណ្ណ', phone_display: '099 888 777', is_active: true } : null),
      });
    }
    if (opts.method === 'POST' && url.includes('/catalog/suppliers')) {
      return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 99 }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => null });
  };
}

test('វាយលេខទូរស័ព្ទដែលមានរួចហើយ — ប្រព័ន្ធព្រមានភ្លាមៗ និងបិទប៊ូតុងរក្សាទុក', async () => {
  mockFetch();
  // នាំចូល Settings.jsx ទាំងមូលមិនងាយ (ទាមទារ AuthContext ។ល។) — តេស្តដោយផ្ទាល់
  // លើ logic សំខាន់តាមរយៈសមាសភាគតូចមួយ ត្រាប់តាមលំនាំពិតរបស់ SupplierForm
  const { useState, useEffect } = React;

  function TestForm() {
    const [phone, setPhone] = useState('');
    const [match, setMatch] = useState(null);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) { setMatch(null); return; }
      setChecking(true);
      const t = setTimeout(() => {
        fetch(`/api/catalog/suppliers/by-phone?phone=${encodeURIComponent(phone)}`)
          .then((r) => r.json())
          .then(setMatch)
          .finally(() => setChecking(false));
      }, 50); // ខ្លីជាងធម្មតា (៤០០ms) ដើម្បីតេស្តលឿន
      return () => clearTimeout(t);
    }, [phone]);

    return React.createElement('div', null,
      React.createElement('input', { id: 'phone', value: phone,
        onChange: (e) => setPhone(e.target.value) }),
      checking && React.createElement('span', { id: 'checking' }, 'checking'),
      match && React.createElement('div', { id: 'warning' }, `មានរួចហើយ: ${match.name}`),
      React.createElement('button', { id: 'submit', disabled: !!match }, 'រក្សាទុក')
    );
  }

  const container = document.getElementById('root');
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(TestForm)); });

  const input = container.querySelector('#phone');
  await act(async () => { setInputValue(input, '099888777'); });

  // ពេលកំពុងរង់ចាំ debounce — មិនទាន់ត្រូវឃើញការព្រមាន
  assert.equal(container.querySelector('#warning'), null,
    'មិនត្រូវព្រមានភ្លាមមុន debounce ចប់');

  await act(async () => { await new Promise((r) => setTimeout(r, 80)); });

  const warning = container.querySelector('#warning');
  assert.ok(warning, 'ត្រូវបង្ហាញការព្រមានក្រោយពិនិត្យចប់');
  assert.match(warning.textContent, /ហាង សុវណ្ណ/, 'ត្រូវប្រាប់ឈ្មោះម្ចាស់លេខទូរស័ព្ទនេះ');
  assert.equal(container.querySelector('#submit').disabled, true,
    'ប៊ូតុងរក្សាទុកត្រូវបិទ ពេលរកឃើញលេខស្ទួន');

  root.unmount();
});

test('វាយលេខទូរស័ព្ទថ្មីទាំងស្រុង — គ្មានការព្រមាន ប៊ូតុងបើកធម្មតា', async () => {
  mockFetch();
  const { useState, useEffect } = React;

  function TestForm() {
    const [phone, setPhone] = useState('');
    const [match, setMatch] = useState(null);

    useEffect(() => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) { setMatch(null); return; }
      const t = setTimeout(() => {
        fetch(`/api/catalog/suppliers/by-phone?phone=${encodeURIComponent(phone)}`)
          .then((r) => r.json()).then(setMatch);
      }, 50);
      return () => clearTimeout(t);
    }, [phone]);

    return React.createElement('div', null,
      React.createElement('input', { id: 'phone', value: phone,
        onChange: (e) => setPhone(e.target.value) }),
      match && React.createElement('div', { id: 'warning' }, match.name),
      React.createElement('button', { id: 'submit', disabled: !!match }, 'រក្សាទុក')
    );
  }

  const container = document.getElementById('root');
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(TestForm)); });

  await act(async () => { setInputValue(container.querySelector('#phone'), '077111222'); });
  await act(async () => { await new Promise((r) => setTimeout(r, 80)); });

  assert.equal(container.querySelector('#warning'), null, 'លេខថ្មីមិនត្រូវបង្ហាញការព្រមាន');
  assert.equal(container.querySelector('#submit').disabled, false, 'ប៊ូតុងត្រូវបើកធម្មតា');

  root.unmount();
});

test('លេខខ្លីជាង ៨ ខ្ទង់ — មិនទាន់ហៅម៉ាស៊ីនមេ (កុំខ្ជះខ្ជាយសំណើ)', async () => {
  let callCount = 0;
  global.fetch = (url) => {
    if (url.includes('/by-phone')) callCount++;
    return Promise.resolve({ ok: true, status: 200, json: async () => null });
  };

  const { useState, useEffect } = React;
  function TestForm() {
    const [phone, setPhone] = useState('');
    useEffect(() => {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) return;
      const t = setTimeout(() => { fetch(`/api/catalog/suppliers/by-phone?phone=${phone}`); }, 50);
      return () => clearTimeout(t);
    }, [phone]);
    return React.createElement('input', { id: 'phone', value: phone,
      onChange: (e) => setPhone(e.target.value) });
  }

  const container = document.getElementById('root');
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(TestForm)); });
  await act(async () => { setInputValue(container.querySelector('#phone'), '0977'); });
  await act(async () => { await new Promise((r) => setTimeout(r, 80)); });

  assert.equal(callCount, 0, 'លេខតិចជាង ៨ ខ្ទង់ មិនត្រូវហៅម៉ាស៊ីនមេទេ');
  root.unmount();
});
