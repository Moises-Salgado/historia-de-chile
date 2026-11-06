// Vault de Obsidian (segundo-cerebro/) → site/data/historia.js
// Uso: node scripts/build-data.mjs   (sin dependencias)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
function imagen(d, carpeta, o) {
  const a = String(d.imagen || '').replace(/^(File|Archivo):/i, '');
  if (!a) return undefined;
  const ok = IMGS.filter((x) => x.archivo === a);
  const e = ok.find((x) => (carpeta === 'Personajes') === /-r\.\w+$/.test(x.src)) || ok[0];
  if (!e) { avisos.push(`${o}: imagen sin descargar (npm run img)`); return undefined; }
  return { src: e.src, mini: e.mini, w: e.tw, h: e.th, v: e.th > e.tw * 1.05 ? 1 : 0, pie: attr(d.imagen_pie || a.replace(/\.\w+$/, '')),
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
const videoDe = (id) => (fs.existsSync(path.join(ROOT, 'site', 'video', id + '.mp4')) ? 'video/' + id + '.mp4' : undefined);
for (const n of notas) {
  const d = n.data, s = secciones(n.body), o = n.nombre;
  if (d.tipo === 'periodo') {
    periodos.push({ id: n.id, titulo: d.titulo || o, orden: d.orden, inicio: d.inicio, fin: d.fin, rango: String(d.rango || ''),
      img: imagen(d, 'Periodos', o), video: videoDe(n.id),
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
      nivel: String(d.nivel || ''), ninos: md(texto, o), dato: dato ? inline(dato, o) : '', img: imagen(d, 'Eventos', o),
      adultos: md(sec(s, 'para adultos'), o), maestros: md(sec(s, 'para maestros'), o),
      _canon: ordenCanon.get(o) ?? 999 });
  } else if (['personaje', 'lugar', 'pueblo'].includes(d.tipo)) {
    // Quita el callout "Para niños" completo (todas sus líneas ">") del texto para adultos.
    const intro = s._intro.replace(/^>\s*\[!note\][^\n]*\n(?:>.*(?:\n|$))*/gm, '');
    fichas[n.id] = { tipo: d.tipo, nombre: d.nombre || o,
      sub: [d.vida, d.rol, d.region, d.zona].filter(Boolean).join(' · '),
      html: md(intro, o), ninos: inline(notaNinos(n.body), o), img: imagen(d, n.carpeta, o),
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

const data = { periodos, eventos, fichas, territorios, grafo, generado: new Date().toISOString().slice(0, 10) };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `// Generado por scripts/build-data.mjs desde segundo-cerebro/. No editar a mano.\nwindow.HISTORIA=${JSON.stringify(data)};\n`);

const cuenta = (t) => notas.filter((n) => n.data.tipo === t).length;
console.log(`historia.js ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · ${periodos.length} periodos · ${eventos.length} eventos · ` +
  `${cuenta('personaje')} personajes · ${cuenta('lugar')} lugares · ${cuenta('pueblo')} pueblos · ${territorios.length} territorios · ` +
  `${grafo.enlaces.length} enlaces · ${[...periodos, ...eventos, ...Object.values(fichas)].filter((x) => x.img).length} con imagen · ` +
  `${periodos.filter((p) => p.video).length} videos`);
if (rotos.size) console.log(`Enlaces sin nota (${rotos.size}): ${[...rotos.keys()].slice(0, 40).join(', ')}`);
avisos.forEach((a) => console.log('AVISO', a));
