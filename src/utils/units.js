import { query } from '../config/db.js';

/**
 * ឯកតារង្វាស់ — ដោះស្រាយបញ្ហា តោន vs គីឡូ ដែលធ្លាប់កើតក្នុងប្រព័ន្ធ Google Sheets។
 * គោលការណ៍: អ្នកប្រើវាយបញ្ចូលឯកតាណាក៏បាន ប៉ុន្តែ database រក្សាទុកតែ kg។
 */

let cache = null;
let cacheTime = 0;
const CACHE_MS = 5 * 60 * 1000;

export async function getUnits() {
  if (cache && Date.now() - cacheTime < CACHE_MS) return cache;
  const { rows } = await query('SELECT unit_code, name_km, factor_to_kg FROM unit_conversions');
  cache = Object.fromEntries(rows.map((r) => [r.unit_code, r]));
  cacheTime = Date.now();
  return cache;
}

export function clearUnitCache() {
  cache = null;
}

/** បម្លែងបរិមាណទៅ kg ។ បោះកំហុសបើឯកតាមិនស្គាល់ (មិនទុកឱ្យទិន្នន័យខុសចូល DB) */
export async function toKg(qty, unitCode) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(`បរិមាណមិនត្រឹមត្រូវ: ${qty}`, 400);
  }
  const units = await getUnits();
  const u = units[unitCode];
  if (!u) {
    throw new AppError(`ឯកតាមិនស្គាល់: "${unitCode}" (ត្រូវជា ${Object.keys(units).join(', ')})`, 400);
  }
  return Number((n * u.factor_to_kg).toFixed(3));
}

/** បង្ហាញ kg ត្រឡប់ជាឯកតាដែលអានស្រួល */
export function formatKg(kg) {
  const n = Number(kg);
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(2)} តោន`;
  return `${n.toFixed(2)} គីឡូ`;
}

// កំហុសអាជីវកម្មដែលបញ្ជូនទៅអ្នកប្រើដោយផ្ទាល់
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
