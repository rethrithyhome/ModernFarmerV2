/**
 * Service worker — ធ្វើឱ្យកម្មវិធីបើកបានទោះអ៊ីនធឺណិតដាច់នៅរោងចក្រ
 *
 * ⚠️ មេរៀនពីកំណែមុន: កំណែចាស់ប្រើ «cache មុន» សម្រាប់គ្រប់ឯកសាររួមទាំង
 * index.html។ លទ្ធផល — ក្រោយដាក់កំណែថ្មី ទូរស័ព្ទនៅតែបង្ហាញកំណែចាស់រហូត
 * ព្រោះវាមិនដែលសួរម៉ាស៊ីនមេឡើងវិញ។ ការប្តូរឡូហ្គោ ឬកែកំហុសក៏មិនឃើញដែរ។
 *
 * កំណែនេះប្រើយុទ្ធសាស្ត្រតាមប្រភេទឯកសារ:
 *   index.html      → បណ្តាញមុន  (ដើម្បីឱ្យទទួលកំណែថ្មីជានិច្ច)
 *   /assets/*       → cache មុន   (ឈ្មោះមាន hash — ប្តូរឈ្មោះពេលប្តូរខ្លឹមសារ)
 *   រូបភាព · manifest → បង្ហាញចាស់ រួចទាញថ្មីខាងក្រោយ
 *   /api/*          → បណ្តាញមុន  (បើដាច់ ប្រើច្បាប់ចម្លងចុងក្រោយ)
 */

const VERSION = 'v3';
const SHELL_CACHE = `mf-shell-${VERSION}`;
const ASSET_CACHE = `mf-assets-${VERSION}`;
const DATA_CACHE = `mf-data-${VERSION}`;
const ALL = [SHELL_CACHE, ASSET_CACHE, DATA_CACHE];

const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !ALL.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/** បណ្តាញមុន — បើដាច់ ទើបប្រើ cache */
async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(request, copy));
    }
    return res;
  } catch {
    const hit = await caches.match(request);
    if (hit) return hit;
    throw new Error('offline');
  }
}

/** cache មុន — សម្រាប់ឯកសារដែលឈ្មោះមាន hash (មិនប្តូរខ្លឹមសារ) */
async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(request, copy));
  }
  return res;
}

/** បង្ហាញច្បាប់ចម្លងភ្លាម រួចទាញថ្មីនៅខាងក្រោយ */
async function staleWhileRevalidate(request, cacheName) {
  const hit = await caches.match(request);
  const fetching = fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(request, copy));
      }
      return res;
    })
    .catch(() => null);
  return hit || fetching;
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // ទិន្នន័យ API
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // ការបើកទំព័រ — ត្រូវយកកំណែថ្មីជានិច្ច
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  // ឯកសារ build ដែលមាន hash ក្នុងឈ្មោះ
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // រូបភាព · manifest · ផ្សេងៗ
  e.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
});
