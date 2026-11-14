const CACHE = 'pm-v5';
const ASSETS = [
  './','./index.html','./manifest.webmanifest',
  './css/style.css',
  './js/store.js','./js/core.js','./js/auth.js','./js/orders.js',
  './js/harness.js','./js/accounts.js','./js/login.js','./js/auth-patch.js','./js/app.js',
  './xe/cut.webp','./xe/top.webp','./xe/left.webp','./xe/right.webp'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});