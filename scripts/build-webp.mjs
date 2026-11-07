// Versión WebP de cada imagen de site/img/ (ítem 2.11 del debate): misma medida, ~30-60 % menos peso.
// El sitio usa el .webp si existe (build-data.mjs); el original queda para Open Graph y navegadores antiguos.
// Uso: node scripts/build-webp.mjs [--forzar]     (incremental: solo convierte lo nuevo)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FFMPEG } from './ffmpeg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'site', 'img');
const forzar = process.argv.includes('--forzar');
let antes = 0, despues = 0, n = 0, grandes = [];
for (const f of fs.readdirSync(DIR).filter((x) => /\.(jpe?g|png)$/i.test(x))) {
  const src = path.join(DIR, f), dst = src.replace(/\.(jpe?g|png)$/i, '.webp');
  if (!forzar && fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs) continue;
  const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', src, '-c:v', 'libwebp', '-quality', '78', '-compression_level', '6', '-pix_fmt', 'yuva420p', '-frames:v', '1', dst]);
  if (r.status !== 0 || !fs.existsSync(dst)) { console.log('ERROR', f, String(r.stderr).slice(0, 200)); continue; }
  const a = fs.statSync(src).size, b = fs.statSync(dst).size;
  // Si el WebP no ahorra al menos un 5 %, no vale la pena: se borra y se usa el original.
  if (b > a * 0.95) { fs.rmSync(dst); continue; }
  antes += a; despues += b; n++;
  if (b > 200 * 1024) grandes.push(`${f} ${(b / 1024).toFixed(0)} KB`);
}
console.log(`webp: ${n} convertidas · ${(antes / 1048576).toFixed(1)} MB → ${(despues / 1048576).toFixed(1)} MB`);
if (grandes.length) console.log(`AVISO sobre 200 KB (${grandes.length}): ${grandes.slice(0, 12).join(', ')}`);
