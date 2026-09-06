/**
 * តេស្តកំហុសពិត — «ម៉ឺនុយហិរញ្ញវត្ថុគាំង»
 *
 * មូលហេតុ: ទំព័រណាមួយប្រើ useData(path, { enabled }) ដែល `enabled`
 * ប្តូរពី false → true ពេលអ្នកប្រើប្តូរផ្ទាំង (ឧ. ចុច "ចំណាយ")។
 * React commit ការប្តូរ `tab` state ជាមុន រួចទើប run effect ក្រោយ —
 * មានន័យថាមាន render មួយដងដែល `enabled=true` ខណៈ `loading` នៅតែ `false`
 * (តម្លៃចាស់ពីមុនពេល enabled ប្តូរ) ហើយ `data` នៅតែ `null`។
 *
 * បើទំព័រសរសេរ `x.loading ? <Loading/> : x.data.length` ដោយគ្មានការពារ
 * បន្ថែម វានឹងព្យាយាមអាន `null.length` ក្នុង render pass នោះ ធ្វើឱ្យ
 * React គាំង (unmount ដោយគ្មាន error boundary) — នេះជាអ្វីដែលអ្នកប្រើឃើញ
 * ជា "ម៉ឺនុយហិរញ្ញវត្ថុគាំង ពេលចូល"។
 *
 * តេស្តនេះនាំចូល src/ui.jsx ពិត (មិនមែនច្បាប់ចម្លង) តាមរយៈ loader
 * ដែលបំប្លែង JSX ភ្លាមៗ ដូច្នេះធានាថាកូដដែលតេស្តគឺកូដដែលដាក់ដំណើរការ
 * ជាក់ស្តែង។
 *
 * រត់: npm test  (loader ចុះឈ្មោះស្វ័យប្រវត្តិតាម package.json)
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
// Node 22 មាន navigator ជា getter — ត្រូវកំណត់ឡើងវិញដោយ defineProperty
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { useState } = React;
const { createRoot } = await import('react-dom/client');
const { act } = React;

const { useData } = await import('../src/ui.jsx');
const { setCached, clearCache } = await import('../src/cache.js');

/** ត្រាប់តាម API ដែលចម្លើយយឺត — ដើម្បីចាប់ចង្វាក់ enabled → loading */
function mockFetch(delayMs = 20) {
  global.fetch = (url) => new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true, status: 200,
        json: async () => (url.includes('/expenses') ? [{ id: 1, amount: 100 }] : []),
      });
    }, delayMs);
  });
}

test('ប្តូរផ្ទាំង enabled: false → true មិនធ្វើឱ្យគាំង (null.length)', async () => {
  clearCache();
  mockFetch(20);
  const container = document.getElementById('root');
  const root = createRoot(container);

  let caughtError = null;
  const originalConsoleError = console.error;
  console.error = (msg, ...rest) => {
    if (typeof msg === 'string' && msg.includes('not configured to support act')) return;
    caughtError = msg;
    originalConsoleError(msg, ...rest);
  };

  /** ត្រាប់តាមលំនាំពិតរបស់ Finance.jsx — ការចូលដំណើរការ .data.length
   *  កើតឡើងតែពេល tab === 'expenses' ប៉ុណ្ណោះ (ដូចទំព័រពិត) */
  function TestPage() {
    const [tab, setTab] = useState('pnl');
    const exp = useData('/finance/expenses', { enabled: tab === 'expenses' });
    return React.createElement('div', null,
      React.createElement('button', { id: 'switch', onClick: () => setTab('expenses') }, 'ចំណាយ'),
      tab === 'expenses' && React.createElement('div', { id: 'out' },
        exp.loading ? 'LOADING' : exp.error ? 'ERROR' : String(exp.data.length))
    );
  }

  await act(async () => { root.render(React.createElement(TestPage)); });

  // ចុចប្តូរទៅផ្ទាំង «ចំណាយ» — enabled ប្តូរពី false ទៅ true
  await act(async () => {
    container.querySelector('#switch').dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true })
    );
    await Promise.resolve(); // ចាំសម្រាប់ microtask ជុំទី ១ (effect ចាប់ផ្តើម fetch)
  });

  // ចំណុចនេះហើយដែលកំណែចាស់គាំង — ត្រូវឃើញ "LOADING" មិនមែនកំហុស
  const out = container.querySelector('#out');
  assert.ok(out, 'DOM មិនត្រូវ unmount ដោយសារកំហុស (React គាំង)');
  assert.equal(out.textContent, 'LOADING',
    'ត្រូវបង្ហាញ LOADING ភ្លាមៗពេល enabled ប្តូរ មិនមែនព្យាយាមអាន null.length');
  assert.equal(caughtError, null, `មិនត្រូវមាន React error: ${caughtError}`);

  // រង់ចាំការទាញចប់ — ទិន្នន័យពិតត្រូវបង្ហាញជំនួស
  await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
  assert.equal(container.querySelector('#out').textContent, '1',
    'ក្រោយទាញចប់ ត្រូវបង្ហាញចំនួនទិន្នន័យពិត');

  console.error = originalConsoleError;
  root.unmount();
});

test('ទិន្នន័យក្នុងឃ្លាំង (cache) បង្ហាញភ្លាមៗ គ្មាន LOADING ស្ទួន', async () => {
  clearCache();
  setCached('/finance/expenses', [{ id: 1 }, { id: 2 }]);
  mockFetch(20);

  const container = document.getElementById('root');
  const root = createRoot(container);

  function Page() {
    const [tab, setTab] = useState('pnl');
    const exp = useData('/finance/expenses', { enabled: tab === 'expenses' });
    return React.createElement('div', null,
      React.createElement('button', { id: 'sw', onClick: () => setTab('expenses') }, 'x'),
      tab === 'expenses' && React.createElement('div', { id: 'o' },
        exp.loading ? 'LOADING' : exp.error ? 'ERR' : String(exp.data.length)));
  }

  await act(async () => { root.render(React.createElement(Page)); });
  await act(async () => {
    container.querySelector('#sw').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });

  // មានឃ្លាំងស្រាប់ — គួរឃើញ "2" ភ្លាមៗ មិនចាំបាច់ឆ្លងកាត់ LOADING
  assert.equal(container.querySelector('#o').textContent, '2');

  clearCache();
  root.unmount();
});
