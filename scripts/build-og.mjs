// Tarjetas para compartir (V14 del debate): site/img/og/<id>.jpg, 1200×630, con la imagen del momento y su título.
// Las usan las páginas por momento (og:image) para que el enlace se vea bien en WhatsApp, redes y correos.
// Uso: npm run og [--forzar]   (necesita haber corrido npm run build; usa FFmpeg del proyecto)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FFMPEG } from './ffmpeg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(ROOT, 'site', 'img', 'og'), TMP = path.join(ROOT, 'video', 'og-tmp');
fs.mkdirSync(SALIDA, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const forzar = process.argv.includes('--forzar');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'site', 'data', 'historia.js'), 'utf8'), ctx);
const H = ctx.window.HISTORIA;
const perById = Object.fromEntries(H.periodos.map((p) => [p.id, p]));
const deco = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Corta el título en líneas de ~26 caracteres (máximo 3) sin partir palabras.
function lineas(t, max = 26) {
  const out = [];
  let cur = '';
  for (const w of t.split(/\s+/)) {
    if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out.length > 3 ? [...out.slice(0, 2), out.slice(2).join(' ').slice(0, max - 1) + '…'] : out;
}
function tarjeta(id, imgRel, titulo, sub) {
  const dst = path.join(SALIDA, id + '.jpg'), src = path.join(ROOT, 'site', imgRel);
  if (!fs.existsSync(src)) return false;
  if (!forzar && fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) return 'ya';
  const ls = lineas(titulo), fs1 = ls.length === 1 ? 72 : ls.length === 2 ? 62 : 54, lh = Math.round(fs1 * 1.12);
  const tTit = path.join(TMP, id + '-t.txt'), tSub = path.join(TMP, id + '-s.txt');
  fs.writeFileSync(tTit, ls.join('\n')); fs.writeFileSync(tSub, sub);
  const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/'); // rutas relativas: sin «C:» que FFmpeg confunde con opciones
  const yTit = 630 - 96 - lh * ls.length;
  // Velo con degradado continuo: oscurece arriba (marca) y abajo (título) sin franjas.
  const y0 = yTit - 170;
  const velo = `color=c=0x0c0f0e:s=1200x630,format=rgba,geq=r=12:g=15:b=14:a='clip(max(150*(1-Y/96)\,225*(Y-${y0})/190)\,0\,225)'`;
  const vf = [
    `[0:v]scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630,format=rgba[f]`, `${velo}[v]`, `[f][v]overlay=format=auto,format=rgb24`,
  ].join(';') + ',' + [
    `drawtext=fontfile=scripts/fuentes/atkinson-bold.ttf:text='HISTORIA DE CHILE':fontsize=24:fontcolor=0xf3eee3:x=60:y=22`,
    `drawtext=fontfile=scripts/fuentes/newsreader-semibold.ttf:textfile=${rel(tTit)}:fontsize=${fs1}:line_spacing=${lh - fs1}:fontcolor=0xf3eee3:x=60:y=${yTit + 6}`,
    `drawtext=fontfile=scripts/fuentes/atkinson-bold.ttf:textfile=${rel(tSub)}:fontsize=28:fontcolor=0xe8915f:x=60:y=${630 - 66}`,
  ].join(',');
  const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', rel(src), '-filter_complex', vf, '-frames:v', '1', '-q:v', '4', rel(dst)], { cwd: ROOT });
  if (r.status !== 0) { console.log('ERROR', id, String(r.stderr).slice(0, 300)); return false; }
  return true;
}
let hechas = 0, ya = 0;
for (const e of H.eventos) {
  if (!e.img) continue;
  const p = perById[e.periodo];
  const ok = tarjeta(e.id, e.img.orig || e.img.src, deco(e.titulo), deco(e.fecha + ' · ' + p.titulo));
  if (ok === true) hechas++; else if (ok === 'ya') ya++;
}
// Portada del sitio.
const moai = H.eventos.find((e) => e.id === 'rapa-nui-y-los-moai');
if (moai && moai.img) tarjeta('portada', moai.img.orig || moai.img.src, 'Historia de Chile, de Monte Verde a hoy', `${H.eventos.length} momentos · mapa y línea de tiempo · niños, adultos y maestros`);
fs.rmSync(TMP, { recursive: true, force: true });
const peso = fs.readdirSync(SALIDA).reduce((s, f) => s + fs.statSync(path.join(SALIDA, f)).size, 0);
console.log(`og: ${hechas} nuevas, ${ya} sin cambios · ${(peso / 1048576).toFixed(1)} MB en site/img/og · luego: npm run build`);
