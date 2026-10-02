/* JC Perfumería — service worker.
   Siempre intenta la red primero (para que los cambios del panel se vean de inmediato)
   y solo usa la copia guardada cuando no hay internet. */
const CACHE = "jc-v2";               // al cambiar el nombre se borra la caché anterior
const CORE = ["./", "index.html", "css/tienda.css", "js/tienda.js", "data/tienda.json", "assets/logo-128.png", "assets/logo-600.jpg", "assets/banner.jpg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo archivos propios; el video, GitHub API y otros sitios van directo a la red
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith(".mp4") || url.pathname.endsWith("admin.html") || url.pathname.includes("/js/admin")) return;
  e.respondWith(
    fetch(req).then(res => {
      // se guarda sin "?v=", para no acumular una copia nueva en cada visita
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.origin + url.pathname, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
