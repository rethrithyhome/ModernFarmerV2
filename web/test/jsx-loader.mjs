/**
 * Node ESM loader — សម្រាប់តេស្តតែប៉ុណ្ណោះ
 *
 * Vite អនុញ្ញាតការនាំចូល JSX និងផ្លូវគ្មានកន្ទុយ (`./cache`) ដោយផ្ទាល់។
 * Node ធម្មតាទាមទារកន្ទុយ (`.js`) ហើយមិនអានវាក្យសម្ព័ន្ធ JSX ទាល់តែសោះ។
 *
 * loader នេះដោះស្រាយទាំងពីរ ដោយមិនចាំបាច់សរសេរឯកសារបណ្តោះអាសន្នទេ —
 * នាំចូលឯកសារពិតដដែល ដូច្នេះម៉ូឌុលដូចជា cache.js មានតែច្បាប់ចម្លងតែមួយ
 * ចែករំលែកគ្នារវាង test និង ui.jsx (ដោះស្រាយបញ្ហា duplicate module instance)។
 */
import { transformSync } from 'esbuild';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    for (const ext of ['.jsx', '.js']) {
      if (existsSync(base + ext)) {
        return nextResolve(specifier + ext, context);
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.jsx')) {
    const raw = await nextLoad(url, { ...context, format: 'module' });
    const source = typeof raw.source === 'string' ? raw.source : raw.source.toString('utf8');
    const { code } = transformSync(source, {
      loader: 'jsx', format: 'esm', jsx: 'automatic', sourcefile: fileURLToPath(url),
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
