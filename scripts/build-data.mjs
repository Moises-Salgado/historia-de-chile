// Vault de Obsidian (segundo-cerebro/) → site/data/historia.js
// Uso: node scripts/build-data.mjs   (sin dependencias)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cobertura, METAS } from './cobertura.mjs';
import { paginas } from './build-paginas.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = path.join(ROOT, 'segundo-cerebro');
const OUT = path.join(ROOT, 'site', 'data', 'historia.js');
const CARPETAS = ['Periodos', 'Eventos', 'Personajes', 'Lugares', 'Pueblos', 'Territorios'];

export const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- Frontmatter YAML mínimo: escalares y listas en bloque ----------
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  let lista = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && lista) { data[lista].push(valor(item[1])); continue; }
    const kv = line.match(/^([\wñáéíóú]+):\s*(.*)$/i);
    if (!kv) continue;
    if (kv[2] === '') { data[kv[1]] = []; lista = kv[1]; }
    else { data[kv[1]] = valor(kv[2]); lista = null; }
  }
  return { data, body: src.slice(m[0].length) };
}
function valor(v) {
  v = v.trim().replace(/^["']|["']$/g, '');
  if (/^\[.*\]$/.test(v) && !v.startsWith('[[')) return v.slice(1, -1).split(',').map((x) => valor(x));
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}
const linkName = (v) => (typeof v === 'string' ? (v.match(/\[\[([^\]|#]+)/) || [, v])[1].trim() : v);

// ---------- Markdown mínimo → HTML ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let nombres = new Map(); // nombre canónico → id
const rotos = new Map();
function inline(s, origen) {
  return esc(s)
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, n, alias) => {
      const id = nombres.get(n.trim());
      const txt = alias || n;
      if (!id) { rotos.set(n.trim(), origen); return txt; }
      return `<a class="ref" href="#ficha/${id}" data-ref="${id}">${txt}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
function md(src, origen) {
  const out = [];
  let lista = null, parr = [];
  const flush = () => {
    if (parr.length) { out.push(`<p>${inline(parr.join(' '), origen)}</p>`); parr = []; }
    if (lista) { out.push(`<ul>${lista.map((li) => `<li>${inline(li, origen)}</li>`).join('')}</ul>`); lista = null; }
  };
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const callout = l.match(/^>\s*\[!(\w+)\][-+]?\s*(.*)$/);
    if (callout) {
      flush();
      const txt = [];
      while (i + 1 < lines.length && /^>/.test(lines[i + 1])) txt.push(lines[++i].replace(/^>\s?/, ''));
      out.push(`<aside class="callout callout-${callout[1].toLowerCase()}"><p class="callout-title">${inline(callout[2] || '', origen)}</p>${md(txt.join('\n'), origen)}</aside>`);
      continue;
    }
    const li = l.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (parr.length) flush(); (lista ||= []).push(li[1]); continue; }
    if (/^#{1,6}\s/.test(l)) { flush(); continue; }
    if (!l.trim()) { flush(); continue; }
    if (lista) flush();
    // Las líneas "**Etiqueta:** texto" del bloque de maestros van como párrafos propios.
    if (/^\*\*[^*]+:\*\*/.test(l) && parr.length) flush();
    parr.push(l.trim());
  }
  flush();
  return out.join('');
}
// Divide el cuerpo en secciones "## Título".
function secciones(body) {
  const s = { _intro: '' };
  let cur = '_intro';
  for (const l of body.split(/\r?\n/)) {
    const h = l.match(/^##\s+(.+?)\s*$/);
    if (h) { cur = h[1].toLowerCase(); s[cur] = ''; continue; }
    if (/^#\s/.test(l)) continue;
    s[cur] += l + '\n';
  }
  return s;
}
const sec = (s, ...keys) => { const k = Object.keys(s).find((x) => keys.some((y) => x.startsWith(y))); return k ? s[k] : ''; };
// Separa el callout "¿Sabías que?" del texto para niños.
function separarDato(txt) {
  const m = txt.match(/^>\s*\[!tip\][^\n]*\n((?:>.*\n?)+)/m);
  if (!m) return { texto: txt, dato: '' };
  return { texto: txt.replace(m[0], ''), dato: m[1].split('\n').map((l) => l.replace(/^>\s?/, '')).join(' ').trim() };
}
const notaNinos = (txt) => { const m = txt.match(/^>\s*\[!note\]\s*Para niños[^\n]*\n((?:>.*\n?)+)/im); return m ? m[1].replace(/^>\s?/gm, '').trim() : ''; };

// ---------- Lectura del vault ----------
const notas = [];
for (const c of CARPETAS) {
  const dir = path.join(VAULT, c);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const nombre = f.slice(0, -3);
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const { data, body } = parseFrontmatter(src);
    notas.push({ nombre, id: slug(nombre), carpeta: c, data, body, src });
  }
}
nombres = new Map(notas.map((n) => [n.nombre, n.id]));

// Orden canónico de eventos según el índice del proyecto.
const indice = fs.readFileSync(path.join(VAULT, 'Proyecto', 'Índice canónico.md'), 'utf8');
const ordenCanon = new Map();
indice.split('## Eventos')[1]?.split('## Personajes')[0].split('\n').forEach((l) => {
  const m = l.match(/^- ([^|]+?) \|/); if (m) ordenCanon.set(m[1].trim(), ordenCanon.size);
});

const periodos = [], eventos = [], fichas = {}, territorios = [];
const avisos = [];
// Imágenes descargadas por scripts/build-img.mjs (licencias libres verificadas) y videos de site/video/.
const RUTA_IMG = path.join(ROOT, 'scripts', 'imagenes.json');
const IMGS = Object.values(fs.existsSync(RUTA_IMG) ? JSON.parse(fs.readFileSync(RUTA_IMG, 'utf8')) : {});
const attr = (s) => esc(String(s || '')).replace(/"/g, '&quot;');
const webp = (rel) => { const w = String(rel || '').replace(/\.(jpe?g|png)$/i, '.webp'); return w !== rel && fs.existsSync(path.join(ROOT, 'site', w)) ? w : rel; };
function imagen(d, carpeta, o) {
  const a = String(d.imagen || '').replace(/^(File|Archivo):/i, '');
  if (!a) return undefined;
  const ok = IMGS.filter((x) => x.archivo === a);
  const e = ok.find((x) => (carpeta === 'Personajes') === /-r\.\w+$/.test(x.src)) || ok[0];
  if (!e) { avisos.push(`${o}: imagen sin descargar (npm run img)`); return undefined; }
  // WebP si existe (npm run webp); el original queda en «orig» para Open Graph.
  return { src: webp(e.src), mini: webp(e.mini), orig: e.src, w: e.tw, h: e.th, v: e.th > e.tw * 1.05 ? 1 : 0, pie: attr(d.imagen_pie || a.replace(/\.\w+$/, '')),
    autor: attr(autorLegible(e.autor)), lic: attr(/^public domain$/i.test(e.licencia) ? 'Dominio público' : e.licencia),
    licUrl: attr(e.licenciaUrl), url: attr(e.fuente) };
}
// El campo «Artist» de Commons viene en varios idiomas y formatos: se deja legible y en español.
function autorLegible(a) {
  a = String(a || '').trim();
  const casos = [
    [/^No machine-readable author provided\. (\S+) assumed/, '$1'], [/original uploader was (.+?) at /, '$1'],
    [/exact author is disputed/i, 'Autoría en disputa'], [/Diario .?La Naci[oó]n/i, 'Diario La Nación'],
    [/^An[oó]nimo - Universidad de Chile/i, 'Anónimo, Universidad de Chile'], [/Carlos Tornero/, 'Carlos Tornero'],
    [/^Women of all nations/i, 'T. Athol Joyce (ed.), Women of All Nations'], [/vapor Bianca/i, 'Expedición del vapor Bianca, 1895'],
    [/^https?:\/\/catalogo\.bne\.es/, 'Biblioteca Nacional de España'], [/^Wright, Marie Robinson$/, 'Marie Robinson Wright'],
    [/^Engineer (.+?) of the Chilean Hydrographic Office$/, '$1, Oficina Hidrográfica de Chile'],
    [/^Chile and Easter Island \(Rapa Nui\)$/, 'Gobierno de Chile y autoridades rapanui'],
  ];
  for (const [re, txt] of casos) { const m = a.match(re); if (m) return m[0].replace(re, txt); }
  if (!a || /unknown|unidentified|anonymous|^an[oó]nim|desconocido|died on|^oleo anonimo/i.test(a)) return 'Autor desconocido';
  return a.replace(/ from [A-ZÑ].*$/, '').replace(/\s*\(\s*S\d+\s*\)/, '').replace(/ at JLU Giessen\.de$/, '')
    .replace('(attributed)', '(atribuido)').replace(/^Atribuído/, 'Atribuido').replace(/\.$/, '').slice(0, 90);
}
// Relatos narrados (HyperFrames): site/video/relatos/<id>.mp4 (+ .jpg póster, .vtt subtítulos, -vertical.mp4 para móvil).
// La transcripción sale del guion del vault (segundo-cerebro/Relatos/<Nombre>.md, líneas «- quién [img]: texto {sonido}»).
const guiones = new Map();
const dirRel = path.join(VAULT, 'Relatos');
if (fs.existsSync(dirRel)) for (const f of fs.readdirSync(dirRel).filter((x) => x.endsWith('.md'))) {
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dirRel, f), 'utf8'));
  const ev = slug(linkName(data.evento || f.slice(0, -3)));
  const lineas = (body.split(/##\s+Guion/i)[1] || '').split(/\n##\s/)[0].split('\n')
    .map((l) => l.match(/^-\s+(\w+)\s*(?:\[[^\]]*\])?:\s*(.+)$/)).filter(Boolean)
    .map((m) => ({ q: m[1].toLowerCase(), t: esc(m[2].replace(/\{[^}]*\}/g, '').trim()) }));
  guiones.set(ev, lineas);
}
const relatoDe = (id) => {
  const b = path.join(ROOT, 'site', 'video', 'relatos', id);
  if (!fs.existsSync(b + '.mp4')) return undefined;
  const g = guiones.get(id) || [];
  const transcripcion = g.map((l) => l.q === 'narrador' ? l.t : `<span class="cita">«${l.t.replace(/^[«"]|[»"]$/g, '')}»</span> <small>(${l.q === 'prat' ? 'Arturo Prat' : l.q}, según la tradición)</small>`);
  // ?v=<fecha del archivo>: al regenerar un relato con el mismo nombre, el navegador no sirve la copia vieja.
  const ver = (suf) => fs.existsSync(b + suf) ? 'video/relatos/' + id + suf + '?v=' + Math.round(fs.statSync(b + suf).mtimeMs / 1000) : undefined;
  return { src: ver('.mp4'), poster: ver('.jpg'), vtt: ver('.vtt'), vertical: ver('-vertical.mp4'),
    transcripcion,
    aviso: 'Recreación dramatizada: narración con voz sintética (ElevenLabs). Música original. Imágenes de Wikimedia Commons con sus créditos.' };
};
// Protocolo editorial (ítem 1.11): «fuentes» = lista "Institución — Título — URL"; «revisado» = "Nombre · AAAA-MM-DD" o "pendiente".
function fuentesDe(d, o) {
  return (Array.isArray(d.fuentes) ? d.fuentes : []).map((f) => {
    const partes = String(f).split(/\s+[—–]\s+/), url = partes.find((x) => /^https?:\/\//.test(x)) || '';
    if (!url) avisos.push(`${o}: fuente sin URL: ${f}`);
    return { t: attr(partes.filter((x) => x !== url).join(' — ')), url: attr(url) };
  });
}
// Preguntas del bloque de maestros (lista tras «**Preguntas…:**») para la hoja de trabajo imprimible.
function preguntasDe(txt, o) {
  const m = txt.match(/\*\*Preguntas[^*]*\*\*\s*\n((?:\s*-\s+.*\n?)+)/i);
  return m ? m[1].split('\n').map((l) => l.replace(/^\s*-\s+/, '').trim()).filter(Boolean).map((q) => inline(q, o)) : [];
}
const revisadoDe = (d) => (d.revisado && !/pendiente/i.test(String(d.revisado)) ? attr(d.revisado) : '');
// OA oficiales del Currículum Nacional por momento (segundo-cerebro/Proyecto/oa-por-momento.json, investigado y verificado).
const RUTA_OA = path.join(VAULT, 'Proyecto', 'oa-por-momento.json');
const OA = fs.existsSync(RUTA_OA) ? JSON.parse(fs.readFileSync(RUTA_OA, 'utf8')) : {};
const oaDe = (o) => (OA[o] || []).filter((x) => x && x.codigo && x.url).map((x) => ({ nivel: attr(x.nivel), codigo: attr(x.codigo), texto: attr(x.texto), url: attr(x.url) }));
const nPalabras = (html) => String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
// Los resúmenes en video por periodo se retiraron el 2026-11-07 (eran mudos; ver Decisiones). Solo quedan los relatos narrados.
for (const n of notas) {
  const d = n.data, s = secciones(n.body), o = n.nombre;
  if (d.tipo === 'periodo') {
    periodos.push({ id: n.id, titulo: d.titulo || o, orden: d.orden, inicio: d.inicio, fin: d.fin, rango: String(d.rango || ''), gancho: d.gancho ? esc(String(d.gancho)) : '',
      img: imagen(d, 'Periodos', o),
      ninos: md(sec(s, 'para niños'), o), adultos: md(sec(s, 'para adultos'), o), maestros: md(sec(s, 'para maestros'), o) });
  } else if (d.tipo === 'evento') {
    const { texto, dato } = separarDato(sec(s, 'para niños'));
    const per = nombres.get(linkName(d.periodo));
    if (!per) avisos.push(`${o}: periodo "${d.periodo}" no existe`);
    if (typeof d.anio !== 'number') avisos.push(`${o}: falta anio`);
    eventos.push({ id: n.id, titulo: d.titulo || o, fecha: String(d.fecha ?? ''), anio: d.anio, periodo: per,
      lat: typeof d.lat === 'number' ? d.lat : null, lon: typeof d.lon === 'number' ? d.lon : null,
      lugar: nombres.get(linkName(d.lugar)) || null,
      personajes: (Array.isArray(d.personajes) ? d.personajes : []).map((p) => nombres.get(linkName(p))).filter(Boolean),
      nivel: String(d.nivel || ''), ninos: md(texto, o), dato: dato ? inline(dato, o) : '', img: imagen(d, 'Eventos', o), relato: relatoDe(n.id),
      adultos: md(sec(s, 'para adultos'), o), maestros: md(sec(s, 'para maestros'), o),
      fuentes: fuentesDe(d, o), rev: revisadoDe(d), preguntas: preguntasDe(sec(s, 'para maestros'), o), oa: oaDe(o),
      _canon: ordenCanon.get(o) ?? 999 });
    const ev = eventos[eventos.length - 1];
    // Umbral para que Google la indexe (A36): texto adulto suficiente, fuentes y revisión humana.
    ev.indexable = nPalabras(ev.adultos) >= METAS.palabras && ev.fuentes.length > 0 && !!ev.rev;
  } else if (['personaje', 'lugar', 'pueblo'].includes(d.tipo)) {
    // Quita el callout "Para niños" completo (todas sus líneas ">") del texto para adultos.
    const intro = s._intro.replace(/^>\s*\[!note\][^\n]*\n(?:>.*(?:\n|$))*/gm, '');
    fichas[n.id] = { tipo: d.tipo, nombre: d.nombre || o,
      sub: [d.vida, d.rol, d.region, d.zona].filter(Boolean).join(' · '),
      html: md(intro, o), ninos: inline(notaNinos(n.body), o), img: imagen(d, n.carpeta, o), fuentes: fuentesDe(d, o), rev: revisadoDe(d),
      ...(typeof d.lat === 'number' ? { lat: d.lat, lon: d.lon } : {}) };
  } else if (d.tipo === 'territorio') {
    territorios.push({ id: n.id, nombre: o, orden: d.orden, pais: d.pais || '', inset: d.inset || '',
      caja: d.inset ? null : [d.norte, d.sur, d.oeste, d.este],
      texto: md(s._intro.split('> [!info]')[0], o),
      fases: (d.fases || []).map((f) => { const [a, b, e, ...et] = String(f).split('|'); return [Number(a), Number(b), e, et.join('|')]; }) });
  }
}
periodos.sort((a, b) => a.orden - b.orden);
const ordenPer = new Map(periodos.map((p) => [p.id, p.orden]));
eventos.sort((a, b) => (ordenPer.get(a.periodo) - ordenPer.get(b.periodo)) || (a.anio - b.anio) || (a._canon - b._canon));
eventos.forEach((e) => delete e._canon);
periodos.forEach((p) => (p.eventos = eventos.filter((e) => e.periodo === p.id).map((e) => e.id)));
territorios.sort((a, b) => a.orden - b.orden);

// ---------- Grafo del segundo cerebro ----------
const idx = new Map(notas.map((n, i) => [n.nombre, i]));
const enlaces = new Set();
for (const [i, n] of notas.entries()) {
  for (const m of n.src.matchAll(/\[\[([^\]|#]+)/g)) {
    const j = idx.get(m[1].trim());
    if (j !== undefined && j !== i) enlaces.add(i < j ? `${i},${j}` : `${j},${i}`);
  }
}
const grafo = {
  nodos: notas.map((n) => ({ id: n.id, n: n.nombre, t: n.data.tipo || 'nota' })),
  enlaces: [...enlaces].map((e) => e.split(',').map(Number)),
};

// ---------- Rutas guiadas (segundo-cerebro/Rutas): secuencias curadas de momentos existentes ----------
const rutas = [];
const dirRutas = path.join(VAULT, 'Rutas');
const evSet = new Set(eventos.map((e) => e.id));
if (fs.existsSync(dirRutas)) for (const f of fs.readdirSync(dirRutas).filter((x) => x.endsWith('.md'))) {
  const { data: d } = parseFrontmatter(fs.readFileSync(path.join(dirRutas, f), 'utf8'));
  if (d.tipo !== 'ruta') continue;
  const ids = (Array.isArray(d.momentos) ? d.momentos : []).map((m) => nombres.get(linkName(m)));
  (d.momentos || []).forEach((m, i) => { if (!ids[i] || !evSet.has(ids[i])) avisos.push(`Ruta ${f}: momento sin nota: ${m}`); });
  rutas.push({ id: slug(f.slice(0, -3)), titulo: d.titulo || f.slice(0, -3), desc: esc(String(d.descripcion || '')), orden: d.orden || 99, momentos: ids.filter((id) => id && evSet.has(id)) });
}
rutas.sort((a, b) => a.orden - b.orden);

// ---------- Mundos 3D (segundo-cerebro/Mundos): paseos a pie en páginas propias (site/3d/, npm run 3d) ----------
// El peso es lo que descarga el visitante: la escena .glb con el nombre de la página y paseo.js.
const mundos = [];
const dirMundos = path.join(VAULT, 'Mundos');
const enSitio = (p) => String(p || '').replace(/^site\//, '');
if (fs.existsSync(dirMundos)) for (const f of fs.readdirSync(dirMundos).filter((x) => x.endsWith('.md'))) {
  const { data: d } = parseFrontmatter(fs.readFileSync(path.join(dirMundos, f), 'utf8'));
  if (d.tipo !== 'mundo') continue;
  const href = enSitio(d.pagina), abs = path.join(ROOT, 'site', href);
  if (!href || !fs.existsSync(abs)) { avisos.push(`Mundo ${f}: no existe la página ${d.pagina}`); continue; }
  const ev = nombres.get(linkName(d.evento));
  if (d.evento && !evSet.has(ev)) avisos.push(`Mundo ${f}: momento sin nota: ${d.evento}`);
  const portada = enSitio(d.portada);
  if (portada && !fs.existsSync(path.join(ROOT, 'site', portada))) avisos.push(`Mundo ${f}: no existe la portada ${d.portada}`);
  const peso = [abs.replace(/\.html$/, '.glb'), path.join(path.dirname(abs), 'paseo.js')]
    .reduce((t, p) => t + (fs.existsSync(p) ? fs.statSync(p).size : 0), 0);
  mundos.push({
    id: slug(f.slice(0, -3)), titulo: d.titulo || f.slice(0, -3), desc: esc(String(d.descripcion || '')), href,
    portada: portada || undefined, region: d.region || undefined, evento: evSet.has(ev) ? ev : undefined,
    mb: Math.max(1, Math.round(peso / 1048576)),
  });
}

const data = { periodos, eventos, fichas, territorios, grafo, rutas, mundos, generado: new Date().toISOString().slice(0, 10) };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `// Generado por scripts/build-data.mjs desde segundo-cerebro/. No editar a mano.\nwindow.HISTORIA=${JSON.stringify(data)};\n`);

const cuenta = (t) => notas.filter((n) => n.data.tipo === t).length;
console.log(`historia.js ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · ${periodos.length} periodos · ${eventos.length} eventos · ` +
  `${cuenta('personaje')} personajes · ${cuenta('lugar')} lugares · ${cuenta('pueblo')} pueblos · ${territorios.length} territorios · ` +
  `${grafo.enlaces.length} enlaces · ${[...periodos, ...eventos, ...Object.values(fichas)].filter((x) => x.img).length} con imagen · ` +
  `${eventos.filter((e) => e.relato).length} relatos`);
if (rotos.size) console.log(`Enlaces sin nota (${rotos.size}): ${[...rotos.keys()].slice(0, 40).join(', ')}`);
avisos.forEach((a) => console.log('AVISO', a));
console.log(cobertura({ root: ROOT, eventos, notas, periodos }));
// Páginas de lectura por momento: usan la misma versión de caché que index.html.
const version = (fs.readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8').match(/estilos\.css\?v=(\d+)/) || [, '1'])[1];
console.log(paginas({ root: ROOT, eventos, periodos, fichas, generado: data.generado, version }));
