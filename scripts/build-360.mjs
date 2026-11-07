// Recorridos 360° (segundo-cerebro/Recorridos/) → site/img/360/ + scripts/recorridos.json + site/data/recorridos.js
// Uso:  node scripts/build-360.mjs            (incremental: solo baja y convierte lo nuevo)
//       node scripts/build-360.mjs --forzar   (vuelve a convertir todo; no vuelve a bajar)
//
// Cada nota tiene `tipo: recorrido` y `modo: propio|externo`.
//  · externo: url, institucion, descripcion (se enlaza; no se descarga nada).
//  · propio:  escenas: "Archivo.jpg | Título | yawInicial [| pitchInicial [| piso]]"
//             enlaces: "Archivo origen > Archivo destino | yaw | pitch"
//    yaw 0 = centro de la panorámica, + a la derecha; pitch + arriba. `piso` = latitud donde termina la imagen
//    (las panorámicas «extended» de ESO vienen rellenas de negro abajo): el visor no deja mirar más abajo.
//
// Licencias: solo dominio público, CC0, CC BY y CC BY-SA, verificadas con la API de Commons.
// Originales de 35 MB o menos, bajados en serie a video/360-cache/ (carpeta ignorada por git).
// FFmpeg (v360) corta cada panorámica equirrectangular en un sprite de cubemap de 6 caras de 1024 px
// (frente, derecha, atrás, izquierda, arriba, abajo) + una miniatura WebP.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FFMPEG } from './ffmpeg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = path.join(ROOT, 'segundo-cerebro');
const DIR_REC = path.join(VAULT, 'Recorridos');
const DIR_EV = path.join(VAULT, 'Eventos');
const CACHE = path.join(ROOT, 'video', '360-cache');
const IMG = path.join(ROOT, 'site', 'img', '360');
const CREDITOS = path.join(ROOT, 'scripts', 'recorridos.json');
const OUT = path.join(ROOT, 'site', 'data', 'recorridos.js');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'HistoriaDeChileEdu/1.0 (sitio educativo estatico sin fines de lucro)';

// Geometría del cubemap. Cada cara se renderiza con un margen de 2 texeles por lado (FOV algo mayor que 90°):
// en el visor las caras se solapan 2 px y no se ven costuras. El visor usa la misma distancia (CARA/2 - MARGEN).
export const CARA = 1024;
export const MARGEN = 2;
export const FOV_CARA = (2 * Math.atan((CARA / 2) / (CARA / 2 - MARGEN)) * 180) / Math.PI;
// Orden del sprite (izquierda a derecha) y dirección de cada cara.
export const CARAS = [
  { n: 'frente', yaw: 0, pitch: 0 },
  { n: 'derecha', yaw: 90, pitch: 0 },
  { n: 'atras', yaw: 180, pitch: 0 },
  { n: 'izquierda', yaw: -90, pitch: 0 },
  { n: 'arriba', yaw: 0, pitch: 90 },
  { n: 'abajo', yaw: 0, pitch: -90 },
];
const MAX_ORIGINAL = 35 * 1024 * 1024;
const MAX_SPRITE = 1.5 * 1024 * 1024;
const MINI = { w: 640, h: 400, hfov: 100 };
const VERSION = `cubo-${CARA}-m${MARGEN}-v1`; // cambia si cambia la conversión: obliga a rehacer los sprites

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
// Igual que slug() de build-data.mjs (ids de eventos).
export const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ñ/g, 'n')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const idEscena = (archivo) => slug(archivo.replace(/\.[a-z0-9]+$/i, '')).slice(0, 72).replace(/-$/, '');
const sinHtml = (s = '') => s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- Frontmatter YAML mínimo (mismo criterio que build-data.mjs: escalares y listas de escalares) ----------
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
    if (kv[2] === '') { data[kv[1]] = []; lista = kv[1]; } else { data[kv[1]] = valor(kv[2]); lista = null; }
  }
  return { data, body: src.slice(m[0].length) };
}
function valor(v) {
  v = v.trim().replace(/^["']|["']$/g, '');
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}
const linkName = (v) => (typeof v === 'string' ? (v.match(/\[\[([^\]|#]+)/) || [, v])[1].trim() : v);
const num = (v, d) => { const n = Number(String(v ?? '').trim()); return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : d; };

// ---------- Commons ----------
export function licenciaLibre(m) {
  const lic = m.LicenseShortName?.value || '';
  if (m.NonFree?.value === 'true' || /\b(nc|nd)\b|non-?free|fair use|all rights/i.test(lic)) return null;
  if (/^(public domain|pd\b|pd-|cc0|cc[ -]by(-sa)?([ -]\d|$))/i.test(lic.trim())) return lic.trim();
  return null;
}
// Pide con paciencia: ante 429/503 espera lo que indique Retry-After o con retroceso exponencial.
async function pedir(url) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (r && r.ok) return r;
    const ra = Number(r && r.headers.get('retry-after'));
    console.error(`  espera: ${r ? r.status : 'sin red'} ${ra ? '(retry-after ' + ra + ' s) ' : ''}${url.slice(0, 90)}`);
    if (r && r.status === 404) return null;
    if (ra > 180) return null; // bloqueo largo: queda pendiente para la próxima ejecución
    await espera(ra > 0 ? ra * 1000 + 500 : Math.min(60000, 2000 * 2 ** i));
  }
  return null;
}
const clave = (n) => { n = n.replace(/_/g, ' ').trim(); return 'File:' + n.charAt(0).toUpperCase() + n.slice(1); };
async function infoLote(archivos) {
  const res = {};
  for (let i = 0; i < archivos.length; i += 50) {
    const lote = archivos.slice(i, i + 50);
    const r = await pedir(API + '?' + new URLSearchParams({
      format: 'json', formatversion: '2', action: 'query', prop: 'imageinfo', iiprop: 'url|size|extmetadata', redirects: '1',
      titles: lote.map(clave).join('|'),
    }));
    if (!r) throw new Error('Commons no responde');
    const j = await r.json();
    const mapa = {};
    (j.query?.normalized || []).concat(j.query?.redirects || []).forEach((n) => { mapa[n.from] = n.to; });
    const pags = {}; (j.query?.pages || []).forEach((p) => { pags[p.title] = p; });
    lote.forEach((a) => {
      let t = clave(a); for (let k = 0; k < 3 && mapa[t]; k++) t = mapa[t];
      const p = pags[t]; res[a] = p && !p.missing && p.imageinfo ? p.imageinfo[0] : null;
    });
    await espera(500);
  }
  return res;
}
async function bajar(url, destino, bytes) {
  const r = await pedir(url);
  if (!r) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  if (bytes && buf.length !== bytes) { console.error(`  descarga incompleta: ${buf.length} de ${bytes} bytes`); return false; }
  fs.writeFileSync(destino + '.parcial', buf);
  fs.renameSync(destino + '.parcial', destino);
  return true;
}

// ---------- FFmpeg ----------
function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(String(r.stderr || r.error).slice(0, 400));
}
// Equirrectangular → sprite 6144×1024 (orden de CARAS). Primero se reduce a 5120 px con lanczos
// (densidad suficiente para el borde de cada cara) y luego v360 proyecta cada cara en rectilínea.
export function cubemap(src, dst, { q } = {}) {
  const ramas = CARAS.map((c, i) => `[c${i}]v360=input=e:output=flat:yaw=${c.yaw}:pitch=${c.pitch}:h_fov=${FOV_CARA.toFixed(5)}:v_fov=${FOV_CARA.toFixed(5)}:w=${CARA}:h=${CARA}:interp=lanc[f${i}]`);
  const filtro = `[0:v]scale=5120:2560:flags=lanczos,format=yuv444p,split=6${CARAS.map((_, i) => `[c${i}]`).join('')};` +
    ramas.join(';') + ';' + CARAS.map((_, i) => `[f${i}]`).join('') + `hstack=inputs=6,format=yuvj420p[s]`;
  // Calidad cercana a 80; si el sprite pasa de 1,5 MB se baja de a poco.
  const calidades = q ? [q] : [4, 5, 6, 7, 8, 10, 12];
  for (const cq of calidades) {
    ffmpeg(['-i', src, '-filter_complex', filtro, '-map', '[s]', '-frames:v', '1', '-q:v', String(cq), dst]);
    const b = fs.statSync(dst).size;
    if (b <= MAX_SPRITE || cq === calidades[calidades.length - 1]) return { q: cq, bytes: b };
  }
}
export function miniatura(src, dst, yaw, pitch) {
  const vfov = (2 * Math.atan(Math.tan((MINI.hfov * Math.PI) / 360) * (MINI.h / MINI.w)) * 180) / Math.PI;
  const y = ((((yaw + 180) % 360) + 360) % 360) - 180;
  ffmpeg(['-i', src, '-vf', `scale=4096:2048:flags=lanczos,v360=input=e:output=flat:yaw=${y}:pitch=${pitch}:h_fov=${MINI.hfov}:v_fov=${vfov.toFixed(4)}:w=${MINI.w}:h=${MINI.h}:interp=lanc`,
    '-frames:v', '1', '-c:v', 'libwebp', '-quality', '74', '-compression_level', '6', dst]);
}

// ---------- Programa ----------
async function main() {
  const forzar = process.argv.includes('--forzar');
  const avisos = [], rechazos = [];
  if (!fs.existsSync(DIR_REC)) { console.log('No hay segundo-cerebro/Recorridos/'); return; }
  const eventosExisten = new Set(fs.readdirSync(DIR_EV).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));

  const notas = fs.readdirSync(DIR_REC).filter((f) => f.endsWith('.md')).map((f) => {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(DIR_REC, f), 'utf8'));
    return { f, nombre: f.slice(0, -3), d: data };
  }).filter((n) => n.d.tipo === 'recorrido');

  const eventoDe = (n) => {
    if (!n.d.evento) return undefined;
    const e = linkName(n.d.evento);
    if (!eventosExisten.has(e)) { avisos.push(`${n.f}: el evento «${e}» no tiene nota en Eventos/`); return undefined; }
    return slug(e);
  };
  const base = (n) => ({
    id: slug(n.nombre), titulo: String(n.d.titulo || n.nombre), region: String(n.d.region || ''),
    lat: num(n.d.lat), lon: num(n.d.lon), evento: eventoDe(n),
    institucion: n.d.institucion ? String(n.d.institucion) : undefined,
    descripcion: n.d.descripcion ? String(n.d.descripcion) : undefined, orden: num(n.d.orden, 99),
  });

  // Externos: solo se enlazan.
  const externos = notas.filter((n) => n.d.modo === 'externo').map((n) => {
    if (!/^https:\/\//.test(n.d.url || '')) avisos.push(`${n.f}: falta url https`);
    return { ...base(n), url: String(n.d.url || '') };
  }).filter((e) => e.url);

  // Propios: escenas y enlaces.
  const propiosNotas = notas.filter((n) => n.d.modo === 'propio').map((n) => {
    const escenas = (Array.isArray(n.d.escenas) ? n.d.escenas : []).map((l) => {
      const [archivo, titulo, yaw, pitch, piso] = String(l).split('|').map((s) => s.trim());
      return { archivo: archivo.replace(/^(File|Archivo):/i, ''), titulo: titulo || archivo, yaw: num(yaw, 0), pitch: num(pitch, 0), piso: num(piso, -90) };
    }).filter((e) => e.archivo);
    const enlaces = (Array.isArray(n.d.enlaces) ? n.d.enlaces : []).map((l) => {
      const [par, yaw, pitch] = String(l).split('|').map((s) => s.trim());
      const [de, a] = par.split(/\s+>\s+/).map((s) => (s || '').trim().replace(/^(File|Archivo):/i, ''));
      return { de, a, yaw: num(yaw, 0), pitch: num(pitch, 0) };
    });
    return { n, escenas, enlaces };
  });

  const archivos = [...new Set(propiosNotas.flatMap((p) => p.escenas.map((e) => e.archivo)))];
  const meta = archivos.length ? await infoLote(archivos) : {};
  const cred = fs.existsSync(CREDITOS) ? JSON.parse(fs.readFileSync(CREDITOS, 'utf8')) : {};
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(IMG, { recursive: true });

  const validos = new Map(); // archivo → crédito
  for (const archivo of archivos) {
    const ii = meta[archivo];
    if (!ii) { rechazos.push(`no existe en Commons: ${archivo}`); continue; }
    const m = ii.extmetadata || {};
    const licencia = licenciaLibre(m);
    if (!licencia) { rechazos.push(`licencia no libre (${m.LicenseShortName?.value || '?'}): ${archivo}`); continue; }
    if (ii.size > MAX_ORIGINAL) { rechazos.push(`original de ${(ii.size / 1048576).toFixed(1)} MB (máximo 35): ${archivo}`); continue; }
    if (Math.abs(ii.width / ii.height - 2) > 0.02) { rechazos.push(`no es equirrectangular 2:1 (${ii.width}×${ii.height}): ${archivo}`); continue; }
    const id = idEscena(archivo);
    const local = path.join(CACHE, id + path.extname(archivo).toLowerCase().replace('.jpeg', '.jpg'));
    if (!(fs.existsSync(local) && fs.statSync(local).size === ii.size)) {
      process.stdout.write(`bajando ${(ii.size / 1048576).toFixed(1)} MB · ${archivo}\n`);
      if (!(await bajar(ii.url, local, ii.size))) { rechazos.push(`descarga pendiente (vuelve a ejecutar npm run 360): ${archivo}`); continue; }
      await espera(1500); // en serie y sin apuro
    }
    validos.set(archivo, {
      archivo, id, licencia, licenciaUrl: m.LicenseUrl?.value || '',
      autor: sinHtml(m.Artist?.value).replace(/^Credit:\s*/i, '').replace(/\s*\/\s*/g, '/').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
        .slice(0, 140) || 'Autor desconocido',
      fecha: sinHtml(m.DateTimeOriginal?.value).slice(0, 40), fuente: ii.descriptionurl,
      w: ii.width, h: ii.height, bytes: ii.size, local,
    });
  }

  // Conversión (incremental).
  const usados = new Set();
  let convertidas = 0;
  for (const p of propiosNotas) for (const e of p.escenas) {
    const c = validos.get(e.archivo);
    if (!c) continue;
    const sprite = path.join(IMG, c.id + '.jpg'), mini = path.join(IMG, c.id + '.webp');
    usados.add(c.id);
    const prev = cred[e.archivo] || {};
    const fresco = (f) => fs.existsSync(f) && fs.statSync(f).mtimeMs >= fs.statSync(c.local).mtimeMs;
    if (forzar || prev.version !== VERSION || !fresco(sprite)) {
      process.stdout.write(`cubemap · ${c.id}\n`);
      const r = cubemap(c.local, sprite);
      Object.assign(c, { q: r.q, spriteBytes: r.bytes });
      if (r.bytes > MAX_SPRITE) avisos.push(`${c.id}: sprite de ${(r.bytes / 1048576).toFixed(2)} MB (más de 1,5)`);
      convertidas++;
    } else Object.assign(c, { q: prev.q, spriteBytes: fs.statSync(sprite).size });
    if (forzar || prev.version !== VERSION || prev.miniYaw !== e.yaw || prev.miniPitch !== e.pitch || !fresco(mini)) miniatura(c.local, mini, e.yaw, Math.max(e.pitch, -30));
    Object.assign(c, { version: VERSION, miniYaw: e.yaw, miniPitch: e.pitch, sprite: `img/360/${c.id}.jpg`, mini: `img/360/${c.id}.webp` });
  }
  // Limpia sprites que ya no se usan.
  for (const f of fs.readdirSync(IMG)) if (!usados.has(f.replace(/\.(jpg|webp)$/, ''))) fs.rmSync(path.join(IMG, f), { force: true });
  const credOut = {};
  for (const [a, c] of validos) { const { local, ...resto } = c; credOut[a] = resto; }
  fs.writeFileSync(CREDITOS, JSON.stringify(credOut, null, 1));

  const propios = propiosNotas.map(({ n, escenas, enlaces }) => {
    const ok = escenas.filter((e) => validos.has(e.archivo));
    const idDe = new Map(ok.map((e) => [e.archivo, validos.get(e.archivo).id]));
    enlaces.forEach((l) => {
      if (!idDe.has(l.de) || !idDe.has(l.a)) avisos.push(`${n.f}: enlace con escena que falta o fue rechazada: ${l.de} > ${l.a}`);
    });
    return {
      ...base(n),
      escenas: ok.map((e) => {
        const c = validos.get(e.archivo);
        return {
          id: c.id, titulo: e.titulo, src: c.sprite, mini: c.mini, yaw: e.yaw, pitch: e.pitch, piso: e.piso,
          credito: { autor: c.autor, licencia: c.licencia, licenciaUrl: c.licenciaUrl, fuente: c.fuente },
          enlaces: enlaces.filter((l) => l.de === e.archivo && idDe.has(l.a)).map((l) => ({ a: idDe.get(l.a), yaw: l.yaw, pitch: l.pitch })),
        };
      }),
    };
  }).filter((r) => r.escenas.length);

  const orden = (a, b) => a.orden - b.orden || (b.lat ?? 0) - (a.lat ?? 0) || a.titulo.localeCompare(b.titulo, 'es');
  propios.sort(orden); externos.sort(orden);
  const limpio = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'orden' ? undefined : v)));
  const data = { propios: limpio(propios), externos: limpio(externos), generado: new Date().toISOString().slice(0, 10) };
  fs.writeFileSync(OUT, `// Generado por scripts/build-360.mjs desde segundo-cerebro/Recorridos/. No editar a mano.\nwindow.RECORRIDOS=${JSON.stringify(data)};\n`);

  const peso = fs.readdirSync(IMG).reduce((t, f) => t + fs.statSync(path.join(IMG, f)).size, 0);
  const nEsc = propios.reduce((t, r) => t + r.escenas.length, 0);
  console.log(`recorridos: ${propios.length} propios (${nEsc} escenas, ${convertidas} convertidas) · ${externos.length} externos · img/360 ${(peso / 1048576).toFixed(1)} MB`);
  rechazos.forEach((r) => console.log('RECHAZO', r));
  avisos.forEach((a) => console.log('AVISO', a));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
