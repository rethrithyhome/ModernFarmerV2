/**
 * តេស្តសមាសភាគក្រាហ្វិក — server-render ដើម្បីប្រាកដថាមិនគាំង
 * លើករណីព្រំដែន (គ្មានទិន្នន័យ · ចំណុចតែមួយ · គ្រប់តម្លៃជា ០)
 * រត់: npm test
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Node មិនអាចអានវាក្យសម្ព័ន្ធ JSX ដោយផ្ទាល់ — ប្រើ esbuild (មានស្រាប់ជាមួយ vite)
// បំប្លែងជា JS សុទ្ធសម្រាប់តេស្តតែប៉ុណ្ណោះ។ សរសេរចូល web/ ខ្លួនឯង (មិនមែន os tmp)
// ដើម្បីឱ្យ `import 'react'` នៅក្នុងឯកសារបំប្លែងរកឃើញ node_modules
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '.tmp-test');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'Charts.mjs');

execFileSync('./node_modules/.bin/esbuild', [
  join(__dirname, '../src/Charts.jsx'), '--bundle', '--format=esm', '--jsx=automatic',
  '--external:react', '--external:react/*', `--outfile=${outFile}`,
], { cwd: join(__dirname, '..') });

const { TrendLine, HorizontalBars } = await import(outFile);

test('TrendLine — ទិន្នន័យធម្មតា បង្កើត SVG path ត្រឹមត្រូវ', () => {
  const points = [
    { label: 0, value: 100 }, { label: 1, value: 300 }, { label: 2, value: 50 },
  ];
  const html = renderToStaticMarkup(
    React.createElement(TrendLine, { points, formatValue: (v) => `${v}៛` })
  );
  assert.match(html, /<path/, 'ត្រូវមាន path (បន្ទាត់ + ជញ្ជាំង)');
  assert.match(html, /<circle/, 'ត្រូវមានចំណុចថ្ងៃចុងក្រោយ');
  assert.match(html, /300៛/, 'ត្រូវបង្ហាញតម្លៃកំពូលឆ្លងកាត់ formatValue');
});

test('TrendLine — គ្មានទិន្នន័យ មិនគាំង ត្រឡប់ null', () => {
  const html = renderToStaticMarkup(React.createElement(TrendLine, { points: [] }));
  assert.equal(html, '');
});

test('TrendLine — ចំណុចតែមួយ មិនបែកគាំង (ចែកនឹងសូន្យ)', () => {
  const html = renderToStaticMarkup(
    React.createElement(TrendLine, { points: [{ label: 'ថ្ងៃនេះ', value: 500 }] })
  );
  assert.match(html, /<svg/);
});

test('TrendLine — គ្រប់តម្លៃជា ០ មិនបែកគាំង (max=0)', () => {
  const points = [{ label: 0, value: 0 }, { label: 1, value: 0 }];
  const html = renderToStaticMarkup(React.createElement(TrendLine, { points }));
  assert.match(html, /<svg/);
  assert.doesNotMatch(html, /NaN/, 'កូអរដោនេមិនត្រូវជា NaN');
});

test('HorizontalBars — បន្ទាត់វែងបំផុតត្រូវប្រវែង 100%', () => {
  const items = [{ label: 'ជីសរីរាង្គ', value: 200 }, { label: 'ជីកំប៉ុស', value: 100 }];
  const html = renderToStaticMarkup(
    React.createElement(HorizontalBars, { items, formatValue: (v) => `${v}៛` })
  );
  assert.match(html, /width:100%/);
  assert.match(html, /width:50%/);
});

test('HorizontalBars — គ្មានទិន្នន័យ ត្រឡប់ null', () => {
  const html = renderToStaticMarkup(React.createElement(HorizontalBars, { items: [] }));
  assert.equal(html, '');
});
