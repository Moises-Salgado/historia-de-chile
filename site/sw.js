// Generado por scripts/build-paginas.mjs. No editar a mano.
const V = 'hdc-34';
const NUCLEO = ["./","index.html","como-se-hace.html","css/estilos.css?v=34","css/fuentes.css?v=34","data/historia.js?v=34","data/mapa.js?v=34","js/app.js?v=34","js/cine.js?v=34","js/crono.js?v=34","js/mapa.js?v=34","js/recorrido.js?v=34","css/recorrido.css?v=34","data/recorridos.js?v=34","js/vendor/gsap.min.js","js/vendor/CustomEase.min.js","js/vendor/ScrollTrigger.min.js","js/vendor/SplitText.min.js","js/vendor/DrawSVGPlugin.min.js","fonts/atkinson-hyperlegible-next-var.woff2","fonts/newsreader-var.woff2"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(NUCLEO)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /\.(mp4|vtt)$/.test(u.pathname)) return; // los videos piden rangos: van directo a la red
  if (r.mode === 'navigate') { // páginas: red primero, copia guardada si no hay conexión
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((k) => k.put(r, c)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((k) => k.put(r, c)); } return res; })));
});
