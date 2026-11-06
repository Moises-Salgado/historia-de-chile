// Imágenes de Wikimedia Commons → site/img/ + scripts/imagenes.json (créditos y licencias).
// Uso:  node scripts/build-img.mjs                  descarga las imágenes nuevas del vault
//       node scripts/build-img.mjs --check "Archivo.jpg" ["Otro.jpg" ...]   solo verifica licencia y datos
// Solo se aceptan licencias libres: dominio público, CC0, CC BY y CC BY-SA. Todo lo demás se rechaza.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = path.join(ROOT, 'segundo-cerebro');
const IMG = path.join(ROOT, 'site', 'img');
const CACHE = path.join(ROOT, 'scripts', 'imagenes.json');
const CARPETAS = ['Periodos', 'Eventos', 'Personajes', 'Lugares', 'Pueblos'];
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'HistoriaDeChileEdu/1.0 (sitio educativo estatico sin fines de lucro)';
const ANCHO = { Personajes: 500 }; // el resto usa 960
const MINI = 330;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ñ/g, 'n')
  .replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
const sinHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function licenciaLibre(m) {
  const lic = m.LicenseShortName?.value || '';
  if (m.NonFree?.value === 'true' || /\b(nc|nd)\b|non-?free|fair use|all rights/i.test(lic)) return null;
  if (/^(public domain|pd\b|pd-|cc0|cc[ -]by(-sa)?([ -]\d|$))/i.test(lic.trim())) return lic.trim();
  return null;
}

// Pide con paciencia: si Commons limita (429/503), espera lo que indique Retry-After o con retroceso exponencial.
async function pedir(url) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (r && r.ok) return r;
    const ra = Number(r && r.headers.get('retry-after'));
    console.error(`  espera: ${r ? r.status : 'sin red'} ${ra ? '(retry-after ' + ra + ' s) ' : ''}${url.slice(0, 90)}`);
    if (ra > 120) return null; // bloqueo largo: se deja pendiente para la próxima ejecución
    await espera(ra > 0 ? ra * 1000 + 500 : Math.min(60000, 2000 * 2 ** i));
  }
  return null;
}
async function api(params) {
  const r = await pedir(API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params }));
  if (!r) throw new Error('Commons no responde');
  return r.json();
}
const clave = (n) => { n = n.replace(/_/g, ' ').trim(); return 'File:' + n.charAt(0).toUpperCase() + n.slice(1); };
// Datos de hasta 50 archivos por consulta (resuelve normalizaciones y redirecciones).
async function infoLote(archivos, ancho) {
  const res = {};
  for (let i = 0; i < archivos.length; i += 50) {
    const lote = archivos.slice(i, i + 50);
    const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: String(ancho), redirects: '1', titles: lote.map(clave).join('|') });
    const mapa = {};
    (j.query?.normalized || []).concat(j.query?.redirects || []).forEach((n) => { mapa[n.from] = n.to; });
    const pags = {}; (j.query?.pages || []).forEach((p) => { pags[p.title] = p; });
    lote.forEach((a) => {
      let t = clave(a); for (let k = 0; k < 3 && mapa[t]; k++) t = mapa[t];
      const p = pags[t]; res[a] = p && !p.missing && p.imageinfo ? p.imageinfo[0] : null;
    });
    await espera(400);
  }
  return res;
}
async function info(archivo, ancho) { return (await infoLote([archivo], ancho))[archivo]; }
async function bajar(url, destino) {
  const r = await pedir(url);
  if (!r) return false;
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  return true;
}

function datos(ii, archivo) {
  const m = ii.extmetadata || {};
  return {
    archivo,
    licencia: licenciaLibre(m),
    licenciaUrl: m.LicenseUrl?.value || '',
    autor: sinHtml(m.Artist?.value).slice(0, 140) || 'Autor desconocido',
    fecha: sinHtml(m.DateTimeOriginal?.value).slice(0, 40),
    descripcion: sinHtml(m.ImageDescription?.value).slice(0, 300),
    fuente: ii.descriptionurl,
    w: ii.width, h: ii.height,
  };
}

// ---------- Modo verificación ----------
if (process.argv[2] === '--check') {
  for (const a of process.argv.slice(3)) {
    const nombre = a.replace(/^(File|Archivo):/i, '');
    const ii = await info(nombre, 960);
    if (!ii) { console.log(`NO EXISTE  ${nombre}`); continue; }
    const d = datos(ii, nombre);
    console.log(`${d.licencia ? 'OK       ' : 'RECHAZADA'}  ${nombre}\n  licencia: ${ii.extmetadata?.LicenseShortName?.value || '?'} · autor: ${d.autor} · fecha: ${d.fecha} · ${d.w}x${d.h}\n  ${d.descripcion}\n  ${d.fuente}`);
    await espera(150);
  }
  process.exit(0);
}

// ---------- Modo descarga ----------
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
fs.mkdirSync(IMG, { recursive: true });
const pedidos = [];
for (const c of CARPETAS) {
  const dir = path.join(VAULT, c);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const fm = (fs.readFileSync(path.join(dir, f), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/) || [, ''])[1];
    const v = (k) => (fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [, ''])[1].trim().replace(/^["']|["']$/g, '');
    const archivo = v('imagen').replace(/^(File|Archivo):/i, '');
    if (archivo) pedidos.push({ nota: f.slice(0, -3), carpeta: c, archivo, pie: v('imagen_pie') });
  }
}

const usados = new Set(), rechazos = [];
let nuevas = 0;
const claveDe = (p) => slug(p.archivo) + ((ANCHO[p.carpeta] || 960) !== 960 ? '-r' : '');
const faltan = pedidos.filter((p) => {
  const k = claveDe(p), prev = cache[k];
  usados.add(k);
  return !(prev && prev.archivo === p.archivo && fs.existsSync(path.join(IMG, prev.src.slice(4))) && fs.existsSync(path.join(IMG, prev.mini.slice(4))));
});
// Metadatos por lotes (pocas consultas): un lote por ancho de imagen + uno para miniaturas.
const porAncho = {};
faltan.forEach((p) => { const a = ANCHO[p.carpeta] || 960; (porAncho[a] = porAncho[a] || new Set()).add(p.archivo); });
const meta = {}, metaMini = await infoLote([...new Set(faltan.map((p) => p.archivo))], MINI);
for (const a in porAncho) meta[a] = await infoLote([...porAncho[a]], Number(a));
const ext = (u) => (u.match(/\.(jpe?g|png|webp|gif)(?:$|\?)/i) || [, 'jpg'])[1].toLowerCase().replace('jpeg', 'jpg');
// Siempre una miniatura de ancho estándar (servidor de miniaturas), nunca el original: si el original
// es más chico que lo pedido, se usa el ancho estándar inmediatamente menor.
const ESTANDAR = [960, 500, 330, 250, 120];
const esMini = (x) => x && x.thumburl && x.thumburl !== x.url && !/upload\.wikimedia\.org/.test(x.thumburl);
async function miniatura(archivo, ii, quiero) {
  if (esMini(ii)) return ii;
  const a = ESTANDAR.find((w) => w <= quiero && w < ii.width);
  if (!a) return ii;
  const otro = await info(archivo, a); await espera(300);
  return esMini(otro) ? otro : ii;
}
for (const p of faltan) {
  const k = claveDe(p);
  let ii = meta[ANCHO[p.carpeta] || 960][p.archivo];
  if (!ii) { rechazos.push(`${p.nota}: no existe "${p.archivo}"`); continue; }
  const d = datos(ii, p.archivo);
  if (!d.licencia) { rechazos.push(`${p.nota}: licencia no libre (${ii.extmetadata?.LicenseShortName?.value || '?'})`); continue; }
  ii = await miniatura(p.archivo, ii, ANCHO[p.carpeta] || 960);
  const iiMini = await miniatura(p.archivo, metaMini[p.archivo] || ii, MINI);
  const grande = ii.thumburl || ii.url, mini = iiMini.thumburl || grande;
  const src = `img/${k}.${ext(grande)}`, srcMini = `img/${k}-m.${ext(mini)}`;
  const ok = (await bajar(grande, path.join(IMG, src.slice(4)))) && (await espera(300), await bajar(mini, path.join(IMG, srcMini.slice(4))));
  await espera(300);
  if (!ok) { rechazos.push(`${p.nota}: descarga pendiente (Commons limitó; vuelve a ejecutar npm run img)`); continue; }
  cache[k] = { ...d, src, mini: srcMini, tw: ii.thumbwidth || ii.width, th: ii.thumbheight || ii.height };
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1)); // progreso guardado
  nuevas++;
  process.stdout.write('.');
}
// Limpia imágenes que ya no se usan.
for (const k of Object.keys(cache)) {
  if (usados.has(k)) continue;
  for (const s of [cache[k].src, cache[k].mini]) fs.rmSync(path.join(IMG, s.slice(4)), { force: true });
  delete cache[k];
}
fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
const peso = fs.readdirSync(IMG).reduce((t, f) => t + fs.statSync(path.join(IMG, f)).size, 0);
console.log(`\nimágenes: ${pedidos.length} pedidas · ${nuevas} nuevas · ${Object.keys(cache).length} en caché · ${(peso / 1048576).toFixed(1)} MB`);
rechazos.forEach((r) => console.log('RECHAZO', r));
