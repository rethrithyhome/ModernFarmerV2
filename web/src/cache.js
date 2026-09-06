/**
 * ឃ្លាំងសម្ងាត់សាមញ្ញសម្រាប់ការទាញទិន្នន័យ
 *
 * បញ្ហា: មុននេះ រាល់ពេលប្តូរម៉ឺនុយ ទំព័រទាញទិន្នន័យពីដំបូងវិញ ហើយបង្ហាញ
 * «កំពុងផ្ទុក…» គ្រប់ពេល។ ទោះទិន្នន័យដដែលដែលទើបមើលរួច។
 *
 * ដំណោះស្រាយ (stale-while-revalidate): បង្ហាញច្បាប់ចម្លងចាស់ភ្លាមៗ
 * ដើម្បីឱ្យការប្តូរម៉ឺនុយមានអារម្មណ៍រហ័ស រួចទាញទិន្នន័យថ្មីនៅខាងក្រោយ
 * ហើយធ្វើបច្ចុប្បន្នភាពស្ងាត់ៗពេលមកដល់។
 */

const cache = new Map();

/** រយៈពេលដែលចាត់ទុកថាទិន្នន័យនៅថ្មី — មិនចាំបាច់ទាញឡើងវិញទាល់តែសោះ */
const FRESH_MS = 30_000;

export function getCached(path) {
  return cache.get(path);
}

export function setCached(path, data) {
  cache.set(path, { data, ts: Date.now() });
}

export function isFresh(entry) {
  return entry && Date.now() - entry.ts < FRESH_MS;
}

/**
 * លុបឃ្លាំងទាំងអស់ — ហៅក្រោយរាល់ការសរសេរទិន្នន័យ
 * (ការទិញ ការលក់ ការកែតម្រូវ...) ដើម្បីកុំឱ្យបង្ហាញលេខចាស់
 */
export function clearCache() {
  cache.clear();
}
