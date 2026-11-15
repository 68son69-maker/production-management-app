const CACHE = 'pm-v6';
const ASSETS = [
  './','./index.html','./manifest.webmanifest',
  './css/style.css',
  './js/store.js','./js/core.js','./js/auth.js','./js/orders.js',
  './js/harness.js','./js/accounts.js','./js/login.js','./js/auth-patch.js','./js/app.js',
  './js/fix/fix.js','./js/fix/series.js',
  './xe/cut.webp','./xe/top.webp','./xe/left.webp','./xe/right.webp'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    });
    if (!cached) return net;
    return Promise.race([net, new Promise(res => setTimeout(() => res(cached), 3000))]).catch(() => cached);
  })());
});