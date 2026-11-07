// Páginas de lectura estáticas por momento (ítem 2.4 del debate): site/momento/<id>.html + sitemap.xml + robots.txt.
// Livianas: no cargan el atlas (ni mapa ni GSAP); el botón «Abrir en el atlas» lleva a index.html#evento/<id>.
// SEO: título y descripción propios, canonical, Open Graph, JSON-LD (Article + LearningResource) y noindex bajo el umbral.
import fs from 'node:fs';
import path from 'node:path';

export const PUBLICO = 'https://moises-salgado.github.io/historia-de-chile/';
const attr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const plano = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
const resumen = (html, n = 158) => { const t = plano(html); return t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n - 1)) + '…'; };

export function paginas({ root, eventos, periodos, fichas, generado, version }) {
  const SITE = path.join(root, 'site'), DIR = path.join(SITE, 'momento');
  fs.mkdirSync(DIR, { recursive: true });
  const evIds = new Set(eventos.map((e) => e.id));
  const perById = Object.fromEntries(periodos.map((p) => [p.id, p]));
  // Enlaces internos del texto: a otro momento → su página; a una ficha → la ficha en el atlas.
  const enlaces = (html) => String(html || '').replace(/href="#ficha\/([^"]+)" data-ref="[^"]*"/g,
    (_, id) => (evIds.has(id) ? `href="${id}.html"` : `href="../index.html#ficha/${id}"`));
  const v = `?v=${version}`;
  const vivas = new Set(fs.readdirSync(DIR).filter((f) => f.endsWith('.html')));

  eventos.forEach((e, i) => {
    const p = perById[e.periodo], url = PUBLICO + 'momento/' + e.id + '.html';
    const desc = resumen(e.adultos);
    // Tarjeta para compartir (npm run og) si existe; si no, la imagen original del momento.
    const og = fs.existsSync(path.join(SITE, 'img', 'og', e.id + '.jpg'));
    const img = og ? PUBLICO + 'img/og/' + e.id + '.jpg' : e.img ? PUBLICO + (e.img.orig || e.img.src) : null;
    const ant = eventos[i - 1], sig = eventos[i + 1];
    const gente = e.personajes.map((id) => fichas[id]).filter(Boolean);
    const lugar = e.lugar && fichas[e.lugar];
    const ld = {
      '@context': 'https://schema.org', '@type': ['Article', 'LearningResource'],
      headline: e.titulo, description: desc, inLanguage: 'es-CL', url,
      ...(img ? { image: img } : {}),
      datePublished: '2026-11-06', dateModified: generado,
      author: { '@type': 'Organization', name: 'Historia de Chile', url: PUBLICO },
      publisher: { '@type': 'Organization', name: 'Historia de Chile', url: PUBLICO },
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
      isAccessibleForFree: true, learningResourceType: 'Lectura',
      ...(e.nivel ? { educationalLevel: e.nivel } : {}),
      about: [e.titulo, p?.titulo].filter(Boolean),
      ...(e.fuentes.length ? { citation: e.fuentes.filter((f) => f.url).map((f) => f.url.replace(/&amp;/g, '&')) } : {}),
    };
    const fig = e.img ? `<figure class="mom-fig${e.img.v ? ' vertical' : ''}"><img src="../${e.img.src}" alt="${e.img.pie}" width="${e.img.w}" height="${e.img.h}" decoding="async">` +
      `<figcaption>${e.img.pie.replace(/\.\s*$/, '')}. <a href="${e.img.url}" target="_blank" rel="noopener">${e.img.autor} · ${e.img.lic}</a></figcaption></figure>` : '';
    const fuentes = e.fuentes.length ? `<section class="lam-fuentes"><h2>Fuentes</h2><ul>${e.fuentes.map((f) => `<li>${f.url ? `<a href="${f.url}" target="_blank" rel="noopener">${f.t}</a>` : f.t}</li>`).join('')}</ul></section>` : '';
    const html = `<!doctype html>
<html lang="es-CL">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${attr(e.titulo)} (${attr(e.fecha)}) · Historia de Chile</title>
  <meta name="description" content="${attr(desc)}">
  ${e.indexable ? '' : '<meta name="robots" content="noindex, follow">\n  '}<link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Historia de Chile">
  <meta property="og:locale" content="es_CL">
  <meta property="og:title" content="${attr(e.titulo)}">
  <meta property="og:description" content="${attr(desc)}">
  <meta property="og:url" content="${url}">
  ${img ? `<meta property="og:image" content="${img}">${og ? '\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">' : ''}\n  <meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23A8471F'/%3E%3Cpath d='M17 4c-1 6 1 9-1 14s0 7-2 10' stroke='%23F5F1E8' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3C/svg%3E">
  <link rel="stylesheet" href="../css/fuentes.css${v}">
  <link rel="stylesheet" href="../css/estilos.css${v}">
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body class="pagina pagina-momento">
  <header class="barra">
    <div class="wrap barra-in">
      <a class="marca" href="../index.html" aria-label="Historia de Chile, volver al atlas">
        <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7"/><path d="M17 4c-1 6 1 9-1 14s0 7-2 10"/></svg>
        <span>Historia de Chile</span>
      </a>
      <a class="btn pagina-volver" href="../index.html#evento/${e.id}">Abrir en el atlas</a>
    </div>
  </header>
  <main class="wrap pagina-in">
    <nav class="migas" aria-label="Ruta"><a href="../index.html">Atlas</a> › <a href="../index.html#periodo/${p.id}">${p.titulo}</a></nav>
    <h1>${e.titulo}</h1>
    <p class="mom-meta"><span>${e.fecha}</span>${lugar ? `<span>${lugar.nombre}</span>` : ''}${e.nivel ? `<span>${e.nivel}</span>` : ''}</p>
    ${fig}
    <div class="mom-texto">${enlaces(e.adultos)}</div>
    ${e.relato ? `<p><a class="btn btn-sec" href="../index.html#evento/${e.id}">Ver el relato narrado en el atlas</a></p>` : ''}
    ${e.ninos ? `<details class="mom-version"><summary>Versión para niños</summary>${enlaces(e.ninos)}${e.dato ? `<div class="dato"><b>¿Sabías que?</b>${enlaces(e.dato)}</div>` : ''}</details>` : ''}
    ${e.maestros ? `<details class="mom-version"><summary>Para maestros</summary><div class="maestro">${enlaces(e.maestros)}${e.oa && e.oa.length ? `<div class="oa"><p class="oa-t">Objetivos de Aprendizaje (Currículum Nacional)</p><ul>${e.oa.map((x) => `<li><a href="${x.url}" target="_blank" rel="noopener"><b>${x.nivel} · ${x.codigo}</b></a> ${x.texto}</li>`).join('')}</ul></div>` : ''}</div></details>` : ''}
    ${gente.length ? `<section class="mom-gente"><h2>Personajes</h2><ul>${gente.map((f) => `<li><a href="../index.html#ficha/${Object.keys(fichas).find((k) => fichas[k] === f)}">${f.nombre}</a></li>`).join('')}</ul></section>` : ''}
    ${fuentes}
    <p class="lam-rev">${e.rev ? `Revisado por ${e.rev}.` : 'Revisión humana pendiente.'} <a href="../como-se-hace.html#revision">Cómo se revisa</a> · <a href="https://github.com/Moises-Salgado/historia-de-chile/issues/new?title=${encodeURIComponent('Error en: ' + plano(e.titulo))}" target="_blank" rel="noopener">Reportar un error</a></p>
    <p class="mom-cita">Cómo citar: Historia de Chile. (${generado.slice(0, 4)}). <i>${e.titulo}</i>. En <i>Historia de Chile: atlas y línea de tiempo</i>. ${url}</p>
    <nav class="lam-pasos mom-pasos" aria-label="Otros momentos">
      ${ant ? `<a class="lam-paso" href="${ant.id}.html"><span><small>Anterior</small>${ant.titulo}</span></a>` : '<span></span>'}
      ${sig ? `<a class="lam-paso sig" href="${sig.id}.html"><span><small>Siguiente</small>${sig.titulo}</span></a>` : ''}
    </nav>
  </main>
  <footer class="pie">
    <div class="wrap pie-in">
      <p><strong>Historia de Chile</strong> · Proyecto educativo sin fines de lucro. Texto bajo <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noopener">CC BY-SA 4.0</a>. <a href="../como-se-hace.html">Cómo se hace</a>.</p>
    </div>
  </footer>
</body>
</html>
`;
    fs.writeFileSync(path.join(DIR, e.id + '.html'), html);
    vivas.delete(e.id + '.html');
  });
  // Páginas de momentos que ya no existen en el vault.
  vivas.forEach((f) => fs.rmSync(path.join(DIR, f)));

  // Sitemap: solo lo que se puede indexar (umbral A36). La portada y «Cómo se hace» siempre.
  const urls = [[PUBLICO, generado], [PUBLICO + 'como-se-hace.html', generado],
    ...eventos.filter((e) => e.indexable).map((e) => [PUBLICO + 'momento/' + e.id + '.html', generado])];
  fs.writeFileSync(path.join(SITE, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join('\n') + '\n</urlset>\n');
  fs.writeFileSync(path.join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${PUBLICO}sitemap.xml\n`);
  // Service worker (solo en http/https): guarda lo visitado para volver a verlo sin conexión. La versión sigue a index.html.
  const nucleo = ['./', 'index.html', 'como-se-hace.html', `css/estilos.css${v}`, `css/fuentes.css${v}`, `data/historia.js${v}`, `data/mapa.js${v}`,
    `js/app.js${v}`, `js/cine.js${v}`, `js/crono.js${v}`, `js/mapa.js${v}`, `js/recorrido.js${v}`, `css/recorrido.css${v}`, `data/recorridos.js${v}`, 'js/vendor/gsap.min.js', 'js/vendor/CustomEase.min.js',
    'js/vendor/ScrollTrigger.min.js', 'js/vendor/SplitText.min.js', 'js/vendor/DrawSVGPlugin.min.js',
    'fonts/atkinson-hyperlegible-next-var.woff2', 'fonts/newsreader-var.woff2'];
  fs.writeFileSync(path.join(SITE, 'sw.js'), `// Generado por scripts/build-paginas.mjs. No editar a mano.
const V = 'hdc-${version}';
const NUCLEO = ${JSON.stringify(nucleo)};
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(NUCLEO)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /\\.(mp4|vtt)$/.test(u.pathname)) return; // los videos piden rangos: van directo a la red
  if (r.mode === 'navigate') { // páginas: red primero, copia guardada si no hay conexión
    e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(V).then((k) => k.put(r, c)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((k) => k.put(r, c)); } return res; })));
});
`);
  return `páginas: ${eventos.length} momentos (${eventos.filter((e) => e.indexable).length} indexables) · sitemap con ${urls.length} URL`;
}
