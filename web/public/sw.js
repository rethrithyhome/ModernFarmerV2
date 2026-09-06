// App shell cache — ធ្វើឱ្យកម្មវិធីបើកបានទោះអ៊ីនធឺណិតដាច់នៅរោងចក្រ
const CACHE = 'mf-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // សំណើ API: បណ្តាញមុន បើដាច់ ប្រើច្បាប់ចម្លងចុងក្រោយ
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // ឯកសារកម្មវិធី: cache មុន
  e.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
