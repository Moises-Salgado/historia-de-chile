// Relato narrado → video HyperFrames: voz del narrador (ElevenLabs), carteles de cita, música original, efectos y subtítulos WebVTT.
// Uso: node relatos/build-relato.mjs ["Combate Naval de Iquique"] [--vertical | --solo-vertical] [--solo-html | --sin-render]
//   (sin flags)      versión 16:9 (1280×720) → site/video/relatos/<id>.mp4 + .jpg + .vtt
//   --vertical       además, la versión 9:16 para móvil (720×1280) → <id>-vertical.mp4 + <id>-vertical.jpg
//   --solo-vertical  solo la versión 9:16
//   --solo-html      arma las composiciones y el .vtt con la caché, sin llamar a ElevenLabs ni renderizar
//   --sin-render     como --solo-html, pero graba lo que falte en ElevenLabs
//   --solo-entrega   vuelve a comprimir los másteres ya renderizados (video/relatos/<id>*/renders/), sin renderizar
// Guion: segundo-cerebro/Relatos/<nombre>.md. Clave: ELEVENLABS_API_KEY en .env (nunca se imprime).
// Voces y efectos quedan en caché en relatos/<id>/ (no se vuelven a pagar).
// D1 (2026-11-07): los personajes históricos no tienen voz sintética; sus palabras salen en un cartel de cita (pie en `carteles:`).
// D5 (2026-11-07): subtítulos WebVTT activables (≤ 42 caracteres por línea, ≤ 2 líneas por cue), no quemados en la imagen.
// Entrega: H.264 + AAC con +faststart, ≤ 15 MB (dos pasadas), volumen medio llevado a −18 dB.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FFMPEG, FFPROBE } from '../scripts/ffmpeg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = path.join(ROOT, 'segundo-cerebro'), SITE = path.join(ROOT, 'site');
const args = process.argv.slice(2), soloEntrega = args.includes('--solo-entrega'), soloHtml = args.includes('--solo-html') || soloEntrega, sinRender = args.includes('--sin-render');
const soloVertical = args.includes('--solo-vertical'), conVertical = soloVertical || args.includes('--vertical');
const NOMBRE = args.find((a) => !a.startsWith('--')) || 'Combate Naval de Iquique';
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ñ/g, 'n').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clave = (() => { try { return (fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m) || [])[1].trim(); } catch (e) { return process.env.ELEVENLABS_API_KEY; } })();

// Plan gratis: solo voces de serie por API. Con un plan pagado (D3), cambiar el narrador por una voz chilena de la biblioteca
// (p. ej. Nico Clemens cTeqXu8N5K85ajcxl3ri) y regenerar. Los personajes no se graban (D1).
const VOCES = {
  narrador: { id: 'JBFqnCBsd6RMkjVDRZzb', nombre: 'George', ajustes: { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 0.95 } },
};
const NOMBRES = { prat: 'Prat' };
const SONIDOS = {
  olas: { texto: 'Gentle ocean waves in a harbour at dawn, wooden ship creaking, distant seagulls', seg: 9, vol: 0.55 },
  campana: { texto: 'Old ship bell ringing an alarm, 19th century warship, urgent', seg: 4, vol: 0.5 },
  canones: { texto: '19th century naval cannon broadside, several heavy cannon shots at sea with echo, epic', seg: 6, vol: 0.7 },
  choque: { texto: 'Iron ship ram crashing into a wooden warship hull, splintering timber, heavy impact', seg: 4, vol: 0.75 },
};

// ---------------------------------------------------------------- Guion desde el vault
const src = fs.readFileSync(path.join(VAULT, 'Relatos', NOMBRE + '.md'), 'utf8');
const fm = (src.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [, ''])[1];
const listaFm = (k) => ((fm.match(new RegExp('^' + k + ':\\s*\\r?\\n((?:\\s+-\\s+.+\\r?\\n?)+)', 'm')) || [, ''])[1]).split(/\r?\n/).map((l) => l.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean);
const evento = (fm.match(/^evento:\s*"?\[\[([^\]|]+)/m) || [, NOMBRE])[1];
const ID = slug(evento);
const archivos = listaFm('imagenes'), pies = listaFm('carteles');
let nCartel = 0;
const lineas = [...src.matchAll(/^- (\w+) \[(\d+)\]: (.+?)(?:\s*\{(\w+)\})?\s*$/gm)].map((m) => {
  const cartel = m[1] !== 'narrador';
  return { quien: m[1], img: +m[2], texto: m[3].trim(), sonido: m[4] || '', cartel, pie: cartel ? pies[nCartel++] || `${NOMBRES[m[1]] || m[1]}, según la tradición` : '' };
});
const IMGS = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'imagenes.json'), 'utf8')));
const imagenes = archivos.map((a) => IMGS.find((x) => x.archivo === a && !/-r\.\w+$/.test(x.src)) || IMGS.find((x) => x.archivo === a));
imagenes.forEach((x, i) => { if (!x) throw new Error('Falta descargar la imagen ' + archivos[i] + ' (npm run img)'); });
const DIR = path.join(ROOT, 'relatos', ID);
['voz', 'sfx'].forEach((d) => fs.mkdirSync(path.join(DIR, d), { recursive: true }));

// ---------------------------------------------------------------- ElevenLabs (con caché; solo se llama si falta algo)
const gasto = { voz: 0, sfx: 0 };
let vocesListas = false;
async function api(ruta, cuerpo, metodo = 'POST') {
  const r = await fetch('https://api.elevenlabs.io' + ruta, { method: metodo, headers: { 'xi-api-key': clave, 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status} en ${ruta}: ${(await r.text()).slice(0, 300)}`);
  return r;
}
async function prepararApi() {
  if (vocesListas) return;
  if (!clave) throw new Error('Falta ELEVENLABS_API_KEY en .env');
  const mias = (await (await api('/v1/voices', null, 'GET')).json()).voices.map((v) => v.voice_id);
  for (const v of Object.values(VOCES)) if (!mias.includes(v.id) && v.dueno) await api(`/v1/voices/add/${v.dueno}/${v.id}`, { new_name: v.nombre });
  vocesListas = true;
}
async function voz(i, l) {
  const v = VOCES.narrador, huella = crypto.createHash('md5').update(JSON.stringify([v.id, v.modelo, v.ajustes, l.texto])).digest('hex');
  const base = path.join(DIR, 'voz', String(i).padStart(2, '0')), meta = base + '.json';
  if (fs.existsSync(meta)) { const d = JSON.parse(fs.readFileSync(meta, 'utf8')); if (d.huella === huella) return d; }
  if (soloHtml) return null;
  await prepararApi();
  const r = await api(`/v1/text-to-speech/${v.id}/with-timestamps?output_format=mp3_44100_128`, { text: l.texto, model_id: v.modelo || 'eleven_multilingual_v2', voice_settings: v.ajustes });
  const j = await r.json();
  fs.writeFileSync(base + '.mp3', Buffer.from(j.audio_base64, 'base64'));
  const a = j.alignment, datos = { huella, fin: a.character_end_times_seconds.at(-1), ini: a.character_start_times_seconds, finC: a.character_end_times_seconds };
  fs.writeFileSync(meta, JSON.stringify(datos));
  gasto.voz += l.texto.length;
  process.stdout.write('v');
  return datos;
}
async function sonido(nombre) {
  const s = SONIDOS[nombre], f = path.join(DIR, 'sfx', nombre + '.mp3');
  if (!s || fs.existsSync(f) || soloHtml) return;
  await prepararApi();
  const r = await api('/v1/sound-generation', { text: s.texto, duration_seconds: s.seg, prompt_influence: 0.45 });
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  gasto.sfx++;
  process.stdout.write('s');
}

// ---------------------------------------------------------------- Subtítulos WebVTT (≤ 2 líneas de ≤ 42 caracteres)
const MAXL = 42;
// Palabras con las que no debe terminar una línea (artículos, preposiciones, conjunciones).
const DEBIL = /^(a|al|de|del|el|la|las|lo|los|en|y|e|o|u|que|con|por|para|su|sus|un|una|se|mi|mis)$/i;
function corte(s) {
  if (s.length <= MAXL) return { l: [s], fea: false };
  let mejor = null;
  for (let k = s.indexOf(' '); k > 0; k = s.indexOf(' ', k + 1)) {
    const a = s.slice(0, k), b = s.slice(k + 1);
    if (a.length > MAXL || b.length > MAXL) continue;
    // Equilibrio; mejor tras puntuación; peor si la línea acaba en palabra débil o la segunda empieza con «palabra,».
    const debil = DEBIL.test(a.split(' ').at(-1)), colgada = /^[^\s,]+,/.test(b) && !/[,;:.!?]$/.test(a);
    const coste = Math.abs(a.length - b.length) - (/[,;:.!?]$/.test(a) ? 10 : 0) + (debil ? 14 : 0) + (colgada ? 8 : 0);
    if (!mejor || coste < mejor.c) mejor = { c: coste, l: [a, b], fea: debil || colgada };
  }
  return mejor;
}
const envolver = (s) => corte(s)?.l;
const cabe = (s) => !!corte(s), cabeBien = (s) => corte(s)?.fea === false;
// Agrupa piezas seguidas en el menor número de cues que quepan y, a igual número, con el cue más largo lo más corto posible.
function agrupar(texto, piezas) {
  const m = piezas.length;
  if (m > 14) throw new Error('Frase demasiado larga para subtitular: ' + texto.slice(piezas[0].a, piezas.at(-1).b));
  let mejor = null;
  for (let mask = 0; mask < 1 << (m - 1); mask++) {
    const g = [];
    let a = 0;
    for (let j = 0; j < m; j++) if (j === m - 1 || mask & (1 << j)) { g.push({ a: piezas[a].a, b: piezas[j].b }); a = j + 1; }
    if (!g.every((r) => cabe(texto.slice(r.a, r.b)))) continue;
    // Orden: menos cues con corte feo, menos cues, cue más largo más corto.
    const p = [g.filter((r) => !cabeBien(texto.slice(r.a, r.b))).length, g.length, Math.max(...g.map((r) => r.b - r.a))];
    const k = mejor ? p.findIndex((x, i) => x !== mejor.p[i]) : 0;
    if (!mejor || (k >= 0 && p[k] < mejor.p[k])) mejor = { p, g };
  }
  return mejor.g;
}
// Rangos de caracteres [a, b) de cada cue: por frases; las largas, por comas y luego por palabras; frases cortas seguidas, una por línea.
function trozos(texto) {
  const pal = [...texto.matchAll(/\S+/g)].map((m) => ({ a: m.index, b: m.index + m[0].length }));
  const txt = (r) => texto.slice(r.a, r.b), rango = (ps) => ({ a: ps[0].a, b: ps.at(-1).b });
  const cortar = (ps, re) => { const o = []; let c = []; for (const p of ps) { c.push(p); if (re.test(txt(p))) { o.push(c); c = []; } } if (c.length) o.push(c); return o; };
  const out = [];
  for (const frase of cortar(pal, /[.!?;:…][»"”)]*$/)) {
    if (cabeBien(txt(rango(frase)))) { out.push(rango(frase)); continue; }
    // Frase larga: piezas por comas (las que no caben, por palabras) y luego el mejor agrupamiento.
    const piezas = [];
    for (const trozo of cortar(frase, /,[»"”)]*$/)) {
      const r = rango(trozo);
      if (cabe(txt(r))) { piezas.push(r); continue; }
      const meta = (r.b - r.a) / Math.ceil((r.b - r.a) / (2 * MAXL - 4));
      let g = [];
      for (const p of trozo) {
        if (g.length && (!cabe(texto.slice(g[0].a, p.b)) || p.b - g[0].a > meta * 1.15)) { piezas.push(rango(g)); g = []; }
        g.push(p);
      }
      piezas.push(rango(g));
    }
    out.push(...agrupar(texto, piezas));
  }
  const unidos = [];
  for (const r of out) {
    const u = unidos.at(-1);
    if (u && !u.lineas && u.b - u.a <= MAXL && r.b - r.a <= MAXL && /[.!?;:…][»"”)]*$/.test(txt(u))) unidos[unidos.length - 1] = { a: u.a, b: r.b, lineas: [txt(u), txt(r)] };
    else unidos.push({ ...r });
  }
  return unidos.map((r) => ({ ...r, lineas: r.lineas || envolver(txt(r)) }));
}
const cuesVoz = (texto, d, t0) => trozos(texto).map((r) => ({ lineas: r.lineas, ini: t0 + (d.ini[r.a] ?? 0), fin: t0 + (d.finC[r.b - 1] ?? d.fin) }));
function cuesCartel(texto, ini, fin) {
  const rs = trozos('«' + texto + '»'), total = rs.reduce((n, r) => n + r.b - r.a, 0), t0 = ini + 0.3, span = fin - 0.5 - t0;
  let t = t0;
  return rs.map((r) => { const d = (span * (r.b - r.a)) / total, c = { lineas: r.lineas, ini: t, fin: t + d }; t += d; return c; });
}
const ts = (s) => {
  const ms = Math.max(0, Math.round(s * 1000)), p = (n, k = 2) => String(n).padStart(k, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};
function webvtt(cues) {
  cues.sort((x, y) => x.ini - y.ini);
  cues.forEach((c, k) => {
    const ant = cues[k - 1], sig = cues[k + 1];
    c.ini = Math.max(c.ini - 0.05, ant ? ant.fin + 0.02 : 0);
    c.fin = Math.max(c.fin + 0.45, c.ini + 1);
    if (sig) c.fin = Math.min(c.fin, sig.ini - 0.06);
    if (!c.lineas || c.lineas.length > 2 || c.lineas.some((l) => l.length > MAXL)) throw new Error('Cue fuera de norma: ' + JSON.stringify(c.lineas));
  });
  const e = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return 'WEBVTT\n\n' + cues.map((c, k) => `${k + 1}\n${ts(c.ini)} --> ${ts(c.fin)}\n${c.lineas.map(e).join('\n')}\n`).join('\n');
}

// ---------------------------------------------------------------- FFmpeg
const ff = (a) => spawnSync(FFMPEG, ['-hide_banner', ...a], { encoding: 'utf8', maxBuffer: 64 * 1048576 });
const duracion = (f) => +spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim();
const volumen = (f) => { const s = ff(['-i', f, '-vn', '-af', 'volumedetect', '-f', 'null', '-']).stderr; return { media: +(s.match(/mean_volume: (-?[\d.]+)/) || [])[1], pico: +(s.match(/max_volume: (-?[\d.]+)/) || [])[1] }; };
const LIMITE = 15e6;
// Comprime el máster de HyperFrames: H.264 en dos pasadas con el presupuesto justo para ≤ 15 MB, AAC 128 kb/s, volumen medio a −18 dB.
function entregar(master, out) {
  const dur = duracion(master), v0 = volumen(master), ganancia = Math.max(-6, Math.min(6, -18 - v0.media));
  const log = path.join(path.dirname(master), 'x264-' + path.basename(out, '.mp4'));
  let presupuesto = 14.0e6;
  for (let intento = 0; intento < 3; intento++) {
    const kbps = Math.min(2500, Math.floor((presupuesto * 8) / dur / 1000 - 128 - 8));
    const video = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', kbps + 'k', '-maxrate', 2 * kbps + 'k', '-bufsize', 4 * kbps + 'k', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '150', '-passlogfile', log];
    let r = ff(['-y', '-i', master, '-an', ...video, '-pass', '1', '-f', 'null', '-']);
    if (r.status !== 0) throw new Error('FFmpeg (pasada 1): ' + r.stderr.slice(-400));
    r = ff(['-y', '-i', master, ...video, '-pass', '2', '-af', `volume=${ganancia.toFixed(2)}dB,alimiter=limit=0.891:level=false:latency=true`,
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out]);
    if (r.status !== 0) throw new Error('FFmpeg (pasada 2): ' + r.stderr.slice(-400));
    if (fs.statSync(out).size <= LIMITE) break;
    presupuesto *= 0.9;
  }
  for (const f of fs.readdirSync(path.dirname(log))) if (f.startsWith(path.basename(log))) fs.rmSync(path.join(path.dirname(log), f), { force: true });
  const v1 = volumen(out), mb = fs.statSync(out).size / 1e6;
  console.log(`  ${path.relative(ROOT, out)}: ${duracion(out).toFixed(2)} s · ${mb.toFixed(2)} MB · volumen medio ${v1.media} dB (pico ${v1.pico} dB; ganancia ${ganancia.toFixed(1)} dB)`);
  if (mb * 1e6 > LIMITE) throw new Error('El video supera 15 MB');
}

async function main() {
  const datos = [];
  for (const [i, l] of lineas.entries()) datos.push(l.cartel ? null : await voz(i, l));
  if (lineas.some((l, i) => !l.cartel && !datos[i])) throw new Error('Faltan voces en la caché: ejecuta sin --solo-html');
  for (const n of new Set(lineas.map((l) => l.sonido).filter((s) => SONIDOS[s]))) await sonido(n);

  // Tiempos. Cartel largo (arenga): pausa dramática tras {silencio}; tiempo de lectura ≈ 17 caracteres por segundo.
  const lectura = (s) => Math.max(3.2, 1.8 + s.length / 17);
  let t = 3.4;
  const linea = lineas.map((l, i) => {
    const prev = lineas[i - 1];
    if (i) t += prev.cartel ? (prev.texto.length >= 40 ? 1.0 : 0.4) : l.cartel ? (prev.sonido === 'silencio' ? 1.5 : 0.5) : 0.6;
    const ini = t, fin = t + (l.cartel ? lectura(l.texto) : datos[i].fin);
    t = fin;
    return { ...l, i, ini, fin, cues: l.cartel ? cuesCartel(l.texto, ini, fin) : cuesVoz(l.texto, datos[i], ini) };
  });
  const FIN_VOZ = t, CIERRE = 9, TOTAL = +(FIN_VOZ + 1.5 + CIERRE).toFixed(2);
  const grito = linea.find((l) => l.cartel && l.texto.length < 40), arenga = linea.find((l) => l.cartel && l.texto.length >= 40);

  // Escenas: líneas seguidas con la misma imagen forman una escena.
  const escenas = [];
  for (const l of linea) {
    const e = escenas.at(-1);
    if (e && e.img === l.img) e.fin = l.fin; else escenas.push({ img: l.img, ini: escenas.length ? l.ini - 0.6 : 0, fin: l.fin });
  }
  escenas.forEach((e, k) => { e.fin = k < escenas.length - 1 ? escenas[k + 1].ini + 1.2 : FIN_VOZ + 1.5 + 0.8; });

  // Subtítulos WebVTT (los mismos para las dos versiones: el audio es idéntico).
  const salida = path.join(SITE, 'video', 'relatos'); fs.mkdirSync(salida, { recursive: true });
  const cues = linea.flatMap((l) => l.cues);
  fs.writeFileSync(path.join(salida, ID + '.vtt'), webvtt(cues));

  // Un proyecto HyperFrames por formato (dos composiciones raíz en una carpeta duplicarían el audio).
  const proyecto = (P, html) => {
    const A = path.join(P, 'assets');
    // Windows/OneDrive pueden bloquear la carpeta: si no se puede borrar, se vacía lo que se pueda y se reutiliza.
    try { fs.rmSync(P, { recursive: true, force: true }); } catch (e) {
      for (const f of fs.existsSync(A) ? fs.readdirSync(A) : []) { try { fs.rmSync(path.join(A, f), { force: true }); } catch (e2) { /* en uso */ } }
      for (const f of fs.readdirSync(P).filter((x) => x.endsWith('.html'))) { try { fs.rmSync(path.join(P, f), { force: true }); } catch (e2) { /* en uso */ } }
    }
    fs.mkdirSync(A, { recursive: true }); fs.mkdirSync(path.join(P, 'renders'), { recursive: true });
    fs.copyFileSync(path.join(SITE, 'js', 'vendor', 'gsap.min.js'), path.join(A, 'gsap.min.js'));
    imagenes.forEach((x, k) => fs.copyFileSync(path.join(SITE, x.src), path.join(A, 'img' + k + path.extname(x.src))));
    linea.filter((l) => !l.cartel).forEach((l) => fs.copyFileSync(path.join(DIR, 'voz', String(l.i).padStart(2, '0') + '.mp3'), path.join(A, 'voz' + l.i + '.mp3')));
    for (const f of fs.readdirSync(path.join(DIR, 'sfx'))) fs.copyFileSync(path.join(DIR, 'sfx', f), path.join(A, 'sfx-' + f));
    for (const f of ['tension.mp3', 'marcha.mp3']) fs.copyFileSync(path.join(DIR, 'musica', f), path.join(A, f));
    fs.writeFileSync(path.join(P, 'index.html'), html);
    fs.writeFileSync(path.join(P, 'hyperframes.json'), JSON.stringify({ paths: { blocks: 'compositions', assets: 'assets' }, media: { autoProxy: true } }, null, 2));
  };
  const DUR = { tension: duracion(path.join(DIR, 'musica', 'tension.mp3')), marcha: duracion(path.join(DIR, 'musica', 'marcha.mp3')) };

  // Música. Tensión hasta la arenga; se apaga con la última palabra del narrador (pausa dramática), vuelve suave bajo el cartel
  // y crece en el grito; la marcha estalla con el cartel del abordaje y cubre hasta el final.
  const env = (ini, fin, base, bajo, extra = []) => {
    const p = [{ t: 0, v: base }];
    for (const l of linea) {
      if (l.cartel || l.fin < ini || l.ini > fin) continue;
      const a = Math.max(0, l.ini - ini - 0.25), b = l.fin - ini + 0.2;
      p.push({ t: +a.toFixed(2), v: base }, { t: +(a + 0.3).toFixed(2), v: bajo }, { t: +b.toFixed(2), v: bajo }, { t: +(b + 0.5).toFixed(2), v: base });
    }
    const ex = extra.map((x) => ({ t: +(x.t - ini).toFixed(2), v: x.v })).filter((x) => x.t >= 0 && x.t <= fin - ini);
    return JSON.stringify({ version: 1, lanes: [{ target: 'volume', points: p.concat(ex).sort((x, y) => x.t - y.t).slice(0, 500) }] }).replace(/"/g, '&quot;');
  };
  // La marcha entra con el grito; se retrasa (hasta el fin del cartel) solo si dejaría más de 3 s sin música al final.
  const tMarcha = grito ? Math.max(grito.ini + 0.6, Math.min(grito.fin + 0.15, TOTAL - DUR.marcha - 3)) : FIN_VOZ * 0.6;
  const audio = [];
  let nCama = 0;
  const cama = (desde, hasta, o) => { // cubre [desde, hasta] con tension.mp3 en tomas encadenadas
    for (let a = desde; a < hasta - 0.5;) {
      const b = Math.min(hasta, a + DUR.tension - 0.05), ultimo = b >= hasta;
      audio.push(`<audio id="tension${++nCama}" src="assets/tension.mp3" data-start="${a.toFixed(2)}" data-duration="${(b - a).toFixed(2)}" data-fade-in="${a === desde ? o.entra : 3}" data-fade-out="${ultimo ? o.sale : 3}" data-automation="${env(a, b, o.base, 0.3, o.extra || [])}"></audio>`);
      if (ultimo) break;
      a = b - 3;
    }
  };
  const tensionHasta = tMarcha + 1.2, alzaGrito = grito ? [{ t: grito.ini - 0.1, v: 0.3 }, { t: grito.ini + 0.6, v: 0.68 }] : [];
  if (arenga) {
    const antes = linea[arenga.i - 1];
    cama(0, antes.fin + 0.25, { base: 0.6, entra: 2, sale: 1.2 });
    cama(arenga.ini - 0.3, tensionHasta, { base: 0.5, entra: 2.5, sale: 1.2, extra: alzaGrito });
  } else cama(0, tensionHasta, { base: 0.6, entra: 2, sale: 1.5, extra: alzaGrito });
  audio.push(`<audio id="marcha" src="assets/marcha.mp3" data-start="${tMarcha.toFixed(2)}" data-duration="${Math.min(DUR.marcha, TOTAL - tMarcha).toFixed(2)}" data-fade-out="2.5" data-automation="${env(tMarcha, TOTAL, 0.95, 0.32)}"></audio>`);
  linea.filter((l) => !l.cartel).forEach((l) => audio.push(`<audio id="voz${l.i}" src="assets/voz${l.i}.mp3" data-start="${l.ini.toFixed(2)}" data-volume="1"></audio>`));
  linea.filter((l) => SONIDOS[l.sonido]).forEach((l, k) => {
    const s = SONIDOS[l.sonido], ini = l.sonido === 'olas' ? 0 : l.sonido === 'canones' ? l.fin - 1.5 : l.ini + 0.2;
    audio.push(`<audio id="sfx${k}" src="assets/sfx-${l.sonido}.mp3" data-start="${Math.max(0, ini).toFixed(2)}" data-volume="${s.vol}" data-fade-out="1.2"></audio>`);
  });

  const autor = (t) => /unknown|unidentified|anonymous|^an[oó]nim|^desconocido$/i.test(t) ? 'Autor desconocido' : t.replace(/^Desconocido - /, 'Autor desconocido, ');
  const credito = (x) => `${esc(autor(x.autor)).slice(0, 70)} · ${esc(/^public domain$/i.test(x.licencia) ? 'Dominio público' : x.licencia)}`;
  const esVertical = (x) => x.th > x.tw * 1.05;
  const creditos = [...new Set(imagenes.map(credito))].join(' — ');
  const quienes = [...new Set(linea.filter((l) => l.cartel).map((l) => NOMBRES[l.quien] || l.quien))].join(' y ');
  const carteles = linea.filter((l) => l.cartel);

  // Composición para un formato: 16:9 (barras de cine, paneo) o 9:16 (obra completa sobre su difuminado, Ken Burns centrado).
  const componer = ({ W, H, v }) => {
    const kb = escenas.map((e, k) => {
      const x = imagenes[e.img], par = k % 2;
      if (!v) return [e.ini, e.fin, par ? 1.02 : 1.16, par ? 1.14 : 1.03, par ? 2 : -2, par ? -1.5 : 1.5];
      const [s0, s1] = esVertical(x) ? [1.02, 1.1] : [1.28, 1.4];
      return [e.ini, e.fin, par ? s1 : s0, par ? s0 : s1, 0, 0];
    });
    const htmlEscenas = escenas.map((e, k) => {
      const x = imagenes[e.img], src = 'assets/img' + e.img + path.extname(x.src), difusa = v || esVertical(x);
      return `<div id="e${k}" class="clip escena${difusa ? ' completa' : ''}" data-start="${e.ini.toFixed(2)}" data-duration="${(e.fin - e.ini).toFixed(2)}" style="z-index:${2 + k}">
        <div class="capa">${difusa ? `<img class="difuso" src="${src}" alt="">` : ''}<img class="toma" src="${src}" alt=""></div>
      </div>`;
    }).join('\n      ');
    const htmlCred = escenas.map((e, k) => {
      const a = e.ini + 0.8, b = k < escenas.length - 1 ? escenas[k + 1].ini + 0.7 : e.fin;
      return `<p id="c${k}" class="clip cred" data-start="${a.toFixed(2)}" data-duration="${(b - a).toFixed(2)}"><span>${credito(imagenes[e.img])}</span></p>`;
    }).join('\n      ');
    const htmlCarteles = carteles.map((l, k) => {
      const largo = l.texto.length >= 40, pre = largo ? 1.3 : 0.5;
      return `<div id="k${k}" class="clip cartel${largo ? '' : ' grito'}" data-start="${(l.ini - pre).toFixed(2)}" data-duration="${(l.fin - l.ini + pre + 0.6).toFixed(2)}">
        <div class="velo"></div>
        <figure><blockquote>«${esc(l.texto)}»</blockquote><span class="regla"></span><figcaption>${esc(l.pie)}</figcaption></figure>
      </div>`;
    }).join('\n      ');
    const z = v ? { h1: 72, p: 24, cita: 34, grito: 62, pie: 19, cred: 18, h2: 54, f: 21, c: 17, ancho: 620, pad: 48 }
      : { h1: 76, p: 22, cita: 37, grito: 68, pie: 17, cred: 14, h2: 56, f: 20, c: 15, ancho: 900, pad: 140 };
    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="assets/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
      #root { position: relative; width: 100%; height: 100%; color: #f3eee3; font-family: Inter, sans-serif; }
      .fondo { position: absolute; inset: 0; background: #000; }
      .escena { position: absolute; inset: 0; }
      .capa { position: absolute; inset: 0; overflow: hidden; }
      .toma { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .completa .toma { object-fit: contain; }
      .difuso { position: absolute; inset: -40px; width: calc(100% + 80px); height: calc(100% + 80px); object-fit: cover; filter: blur(26px) brightness(0.45); }
      .vineta { position: absolute; inset: 0; z-index: 60; pointer-events: none; background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.65) 100%), linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 26%)${v ? ', linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 14%)' : ''}; }
      .barra { position: absolute; left: 0; right: 0; height: 56px; background: #000; z-index: 70; }
      .barra.a { top: 0; } .barra.b { bottom: 0; }
      .cred { position: absolute; z-index: 75; font: 400 ${z.cred}px/1.3 Inter, sans-serif; color: rgba(243,238,227,0.72); ${v ? 'top: 34px; left: 32px; right: 32px; text-align: center;' : 'top: 0; right: 24px; height: 56px; display: flex; align-items: center;'} }
      .cartel { position: absolute; inset: 0; z-index: 65; display: grid; place-items: center; padding: 0 ${v ? 50 : 120}px; }
      .velo { position: absolute; inset: 0; background: #050606; opacity: 0; }
      .cartel figure { position: relative; max-width: ${z.ancho}px; text-align: center; }
      .cartel blockquote { font: 400 ${z.cita}px/1.34 "EB Garamond", serif; color: #f6f1e7; text-wrap: pretty; }
      .cartel.grito blockquote { font: 500 ${z.grito}px/1.08 "EB Garamond", serif; text-wrap: balance; text-shadow: 0 3px 24px rgba(0,0,0,0.8); }
      .cartel.grito figcaption { text-shadow: 0 1px 4px rgba(0,0,0,0.95), 0 0 16px rgba(0,0,0,0.8); }
      .regla { display: block; width: 44px; height: 1px; margin: 28px auto 18px; background: #e8915f; transform-origin: 50% 50%; }
      .cartel figcaption { font: 500 ${z.pie}px/1.45 Inter, sans-serif; color: #e8915f; letter-spacing: 0.01em; text-wrap: balance; }
      #titulo { position: absolute; inset: 0; z-index: 90; display: grid; place-content: center; text-align: center; padding: 0 ${v ? 50 : 0}px; }
      #titulo h1 { font: 500 ${z.h1}px/1.02 "EB Garamond", serif; text-shadow: 0 4px 30px rgba(0,0,0,0.8); text-wrap: balance; }
      #titulo p { font: 500 ${z.p}px/1.2 Inter, sans-serif; color: #f0a274; margin-top: 18px; letter-spacing: 0.04em; text-shadow: 0 2px 6px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.7); }
      #titulo h1 span { display: inline-block; }
      #cierre { position: absolute; inset: 0; z-index: 95; background: #050606; display: grid; place-content: center; text-align: center; padding: 0 ${z.pad}px; }
      #cierre h2 { font: 500 ${z.h2}px/1.05 "EB Garamond", serif; }
      #cierre .f { font: 500 ${z.f}px/1.3 Inter, sans-serif; color: #e8915f; margin-top: 14px; }
      #cierre .c { font: 400 ${z.c}px/1.55 Inter, sans-serif; color: rgba(243,238,227,0.72); margin-top: 46px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}" data-fps="30">
      <div class="fondo"></div>
      ${htmlEscenas}
      <div class="vineta"></div>
      ${htmlCarteles}
      ${v ? '' : '<div class="barra a"></div><div class="barra b"></div>'}
      ${htmlCred}
      <div id="titulo" class="clip" data-start="0" data-duration="4.2"><h1>${esc(evento).split(' ').map((w) => `<span>${w}</span>`).join(' ')}</h1><p>21 de mayo de 1879</p></div>
      <div id="cierre" class="clip" data-start="${(FIN_VOZ + 1.5).toFixed(2)}" data-duration="${CIERRE}">
        <div class="bloque"><h2>${esc(evento)}</h2><p class="f">Día de las Glorias Navales en Chile · Grau, héroe del Perú</p>
        <p class="c">${quienes ? `Las palabras de ${esc(quienes)} no se conservan de forma textual: se muestran como las recoge la tradición, reconstruidas a partir de testimonios de sobrevivientes.<br>` : ''}Narración con voz sintética (ElevenLabs, elevenlabs.io). Música original del proyecto.<br>Imágenes de Wikimedia Commons: ${creditos}</p></div>
      </div>
      ${audio.join('\n      ')}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      ${JSON.stringify(kb)}.forEach(([a, b, s0, s1, x0, x1], k) => {
        const sel = "#e" + k;
        tl.fromTo(sel + " .capa", { opacity: 0 }, { opacity: 1, duration: k ? 1.2 : 2, ease: "none" }, a);
        tl.fromTo(sel + " .toma", { scale: s0, xPercent: x0 }, { scale: s1, xPercent: x1, duration: b - a, ease: "none" }, a);
      });
      document.querySelectorAll(".cred span").forEach((s) => {
        const c = s.parentElement, a = parseFloat(c.dataset.start), d = parseFloat(c.dataset.duration);
        tl.fromTo(s, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "none" }, a);
        tl.to(s, { opacity: 0, duration: 0.5, ease: "none" }, a + d - 0.55);
      });
      // Carteles de cita (D1): el fondo se oscurece en la pausa, la cita entra sobria, luego la regla y el pie.
      ${JSON.stringify(carteles.map((l) => [+l.ini.toFixed(2), +l.fin.toFixed(2), l.texto.length >= 40]))}.forEach(([a, b, largo], k) => {
        const s = "#k" + k;
        tl.fromTo(s + " .velo", { opacity: 0 }, { opacity: largo ? 0.8 : 0.72, duration: largo ? 1.1 : 0.45, ease: "power1.out" }, a - (largo ? 1.2 : 0.45));
        tl.fromTo(s + " blockquote", { opacity: 0, y: largo ? 14 : 0, scale: largo ? 1 : 1.04 }, { opacity: 1, y: 0, scale: 1, duration: largo ? 1.4 : 0.55, ease: largo ? "power2.out" : "power3.out" }, a);
        tl.fromTo(s + " .regla", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power2.inOut" }, a + (largo ? 0.9 : 0.35));
        tl.fromTo(s + " figcaption", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power1.out" }, a + (largo ? 1.3 : 0.5));
        tl.to(s + " figure", { opacity: 0, duration: 0.8, ease: "power1.in" }, b - 0.8);
        tl.to(s + " .velo", { opacity: 0, duration: 0.9, ease: "power1.inOut" }, b - 0.4);
      });
      tl.from("#titulo h1 span", { opacity: 0, yPercent: 40, filter: "blur(8px)", duration: 1.1, ease: "power3.out", stagger: 0.12 }, 0.4);
      tl.from("#titulo p", { opacity: 0, y: 10, duration: 0.9, ease: "power2.out" }, 1.1);
      tl.to("#titulo h1, #titulo p", { opacity: 0, duration: 0.6, ease: "power1.in" }, 3.5);
      tl.from("#cierre h2, #cierre .f, #cierre .c", { opacity: 0, y: 14, duration: 0.9, ease: "power3.out", stagger: 0.15 }, ${(FIN_VOZ + 1.7).toFixed(2)});
      tl.fromTo("#cierre .bloque", { scale: 1 }, { scale: 1.03, duration: ${CIERRE}, ease: "none" }, ${(FIN_VOZ + 1.5).toFixed(2)});
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
  };
  const FORMATOS = [
    { nombre: 'horizontal', W: 1280, H: 720, v: false, sufijo: '' },
    { nombre: 'vertical', W: 720, H: 1280, v: true, sufijo: '-vertical' },
  ].map((f) => ({ ...f, P: path.join(ROOT, 'video', 'relatos', ID + f.sufijo) }));
  if (!soloEntrega) for (const f of FORMATOS) proyecto(f.P, componer(f));
  console.log(`\nrelato ${ID}: ${linea.length} líneas (${carteles.length} carteles) · ${escenas.length} escenas · ${cues.length} cues VTT · ${TOTAL} s · marcha en ${tMarcha.toFixed(1)} s`);
  console.log(`ElevenLabs en esta ejecución: ${gasto.voz} caracteres de voz${gasto.sfx ? `, ${gasto.sfx} efectos nuevos` : ''}`);
  if ((soloHtml && !soloEntrega) || sinRender) return;

  for (const f of FORMATOS.filter((x) => (x.v ? conVertical : !soloVertical))) {
    const P = f.P, master = path.join(P, 'renders', f.nombre + '.mp4'), out = path.join(salida, ID + f.sufijo + '.mp4');
    if (soloEntrega) {
      if (!fs.existsSync(master)) throw new Error('No hay máster de ' + f.nombre + ': ejecuta sin --solo-entrega');
      console.log(`entrega ${f.nombre} desde el máster…`);
    } else {
      console.log(`render ${f.nombre} (${f.W}×${f.H})…`);
      const r = spawnSync('npx', ['--yes', 'hyperframes@0.9.19', 'render', '.', '-o', path.relative(P, master), '--crf', '16', '--quiet'],
        { cwd: P, stdio: 'inherit', shell: true, env: { ...process.env, DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' } });
      if (r.status !== 0) throw new Error('Falló el render ' + f.nombre);
    }
    entregar(master, out);
    ff(['-loglevel', 'error', '-y', '-ss', '12', '-i', out, '-frames:v', '1', '-q:v', '3', path.join(salida, ID + f.sufijo + '.jpg')]);
  }
  console.log('listo · subtítulos', path.relative(ROOT, path.join(salida, ID + '.vtt')), '· luego: npm run build');
}
main().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
