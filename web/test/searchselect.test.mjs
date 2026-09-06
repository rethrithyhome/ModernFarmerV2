/**
 * តេស្ត SearchSelect — ការជ្រើសរើសអតិថិជន/អ្នកផ្គត់ផ្គង់ដោយវាយស្វែងរក
 *
 * គោលបំណង: អតិថិជនអាចមានឈ្មោះស្រដៀងគ្នា ឬលេខទូរស័ព្ទស្ទួន — ការវាយស្វែងរក
 * ត្រូវតែច្បាស់លាស់ មិនច្រឡំ។ តេស្តទាំងនេះផ្ទៀងផ្ទាត់ការចុះឈ្មោះ ការវាយ
 * តាមលេខទូរស័ព្ទ ការជ្រើសរើស និងការសម្អាត។
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
const { SearchSelect } = await import('../src/ui.jsx');

const ITEMS = [
  { id: 1, label: 'លី សុខា', sub: '012 345 678' },
  { id: 2, label: 'លី សុភា', sub: '096 777 888' },
  { id: 3, label: 'ចាន់ ដារ៉ា', sub: '012 345 679' },
];

function fireEvent(el, type, opts = {}) {
  const Ctor = type === 'click' ? dom.window.MouseEvent : dom.window.Event;
  el.dispatchEvent(new Ctor(type, { bubbles: true, ...opts }));
}

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  fireEvent(input, 'input');
}

test('វាយឈ្មោះដូចគ្នា ២ នាក់ — ត្រូវឃើញលេខទូរស័ព្ទដើម្បីញែក', async () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  let value = '';

  await act(async () => {
    root.render(React.createElement(SearchSelect, {
      items: ITEMS, value, onChange: (v) => { value = v; },
    }));
  });

  const input = container.querySelector('input');
  await act(async () => { input.focus(); });
  await act(async () => { setInputValue(input, 'លី'); });

  const rows = [...container.querySelectorAll('.search-select-item')];
  assert.equal(rows.length, 2, 'ត្រូវឃើញអ្នកឈ្មោះ "លី" ទាំង ២ នាក់');
  assert.match(rows[0].textContent, /012 345 678/, 'ត្រូវបង្ហាញលេខទូរស័ព្ទដើម្បីញែកអ្នកទី ១');
  assert.match(rows[1].textContent, /096 777 888/, 'ត្រូវបង្ហាញលេខទូរស័ព្ទដើម្បីញែកអ្នកទី ២');

  root.unmount();
});

test('វាយលេខទូរស័ព្ទផ្ទាល់ — ស្វែងរកបានទោះមិនស្គាល់ឈ្មោះ', async () => {
  const container = document.getElementById('root');
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(SearchSelect, { items: ITEMS, value: '', onChange: () => {} }));
  });

  const input = container.querySelector('input');
  await act(async () => { input.focus(); });
  await act(async () => { setInputValue(input, '096777'); });

  const rows = [...container.querySelectorAll('.search-select-item')];
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /លី សុភា/);
});

test('ជ្រើសរើសម្នាក់ — onChange ហៅត្រឹមត្រូវ ហើយឈ្មោះបង្ហាញក្នុងប្រអប់', async () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  let picked = null;

  function Wrapper() {
    const [value, setValue] = React.useState('');
    return React.createElement(SearchSelect, {
      items: ITEMS, value,
      onChange: (v) => { picked = v; setValue(v); },
    });
  }

  await act(async () => { root.render(React.createElement(Wrapper)); });
  const input = container.querySelector('input');
  await act(async () => { input.focus(); });
  await act(async () => { setInputValue(input, 'ដារ៉ា'); });
  await act(async () => { fireEvent(container.querySelector('.search-select-item'), 'click'); });

  assert.equal(picked, 3, 'ត្រូវជ្រើសរើសអ្នកឈ្មោះ ចាន់ ដារ៉ា (id=3)');
  assert.equal(container.querySelector('input').value, 'ចាន់ ដារ៉ា',
    'ប្រអប់ត្រូវបង្ហាញឈ្មោះដែលបានជ្រើស មិនមែនទុកទទេ');
  assert.equal(container.querySelector('.search-select-list'), null,
    'បញ្ជីត្រូវបិទក្រោយជ្រើសរើសរួច');

  root.unmount();
});

test('ចុចប៊ូតុងសម្អាត — ត្រឡប់ទៅដើម ស្វែងរកម្តងទៀតបាន', async () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  let value = '1';

  function Wrapper() {
    const [v, setV] = React.useState('1');
    value = v;
    return React.createElement(SearchSelect, {
      items: ITEMS, value: v, onChange: setV,
    });
  }

  await act(async () => { root.render(React.createElement(Wrapper)); });
  // ជ្រើសរើសម្នាក់ជាមុនសិន ដើម្បីឱ្យប៊ូតុងសម្អាតលេចឡើង
  const input = container.querySelector('input');
  await act(async () => { input.focus(); });
  await act(async () => { fireEvent(container.querySelector('.search-select-item'), 'click'); });

  const clearBtn = container.querySelector('.search-select-clear');
  assert.ok(clearBtn, 'ត្រូវមានប៊ូតុងសម្អាតក្រោយជ្រើសរើសរួច');

  await act(async () => { fireEvent(clearBtn, 'click'); });
  assert.equal(value, '', 'ក្រោយសម្អាត តម្លៃត្រូវត្រឡប់ទៅទទេ');
  assert.equal(container.querySelector('input').value, '');

  root.unmount();
});

test('ចុចខាងក្រៅ — បញ្ជីត្រូវបិទដោយស្វ័យប្រវត្តិ', async () => {
  const container = document.getElementById('root');
  const outside = document.createElement('div');
  document.body.appendChild(outside);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(SearchSelect, { items: ITEMS, value: '', onChange: () => {} }));
  });
  await act(async () => { container.querySelector('input').focus(); });
  assert.ok(container.querySelector('.search-select-list'), 'បញ្ជីត្រូវបើកនៅពេលចុច focus');

  await act(async () => { fireEvent(outside, 'mousedown'); });
  assert.equal(container.querySelector('.search-select-list'), null, 'ត្រូវបិទក្រោយចុចខាងក្រៅ');

  root.unmount();
  outside.remove();
});

test('ជម្រើសទទេ (emptyOption) លេចនៅលើគេ ហើយស្វែងរកចូលបានដែរ', async () => {
  const container = document.getElementById('root');
  const root = createRoot(container);
  const emptyOption = { id: '', label: 'អតិថិជនទូទៅ' };

  await act(async () => {
    root.render(React.createElement(SearchSelect, {
      items: ITEMS, value: '', onChange: () => {}, emptyOption,
    }));
  });
  await act(async () => { container.querySelector('input').focus(); });

  const first = container.querySelector('.search-select-item');
  assert.match(first.textContent, /អតិថិជនទូទៅ/);

  root.unmount();
});
