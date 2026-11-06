// Videos-resumen por periodo con HyperFrames (HTML → MP4). Datos: site/data/*.js; imágenes: site/img (libres, con crédito).
// Uso:  node scripts/build-video.mjs [id-periodo ...]        genera video/<id>/ y renderiza site/video/<id>.mp4
//       node scripts/build-video.mjs --solo-html [id ...]      solo escribe los proyectos (para revisar con hyperframes preview)
// Requiere Node 22+, Chrome (lo instala HyperFrames) y FFmpeg: en el PATH o en HYPERFRAMES_FFMPEG_PATH / HYPERFRAMES_FFPROBE_PATH.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const DESTINO = path.join(ROOT, 'video');
const HF = 'hyperframes@0.9.19';
const cargar = (f, k) => { const w = {}; new Function('window', fs.readFileSync(path.join(SITE, 'data', f), 'utf8'))(w); return w[k]; };
const H = cargar('historia.js', 'HISTORIA'), M = cargar('mapa.js', 'MAPA');
const args = process.argv.slice(2), soloHtml = args.includes('--solo-html');
const ids = args.filter((a) => !a.startsWith('--'));
const evById = Object.fromEntries(H.eventos.map((e) => [e.id, e]));
const fmt = (a) => (a < 0 ? Math.abs(a).toLocaleString('es-CL') + ' a.C.' : a < 1000 ? a + ' d.C.' : String(a));
const px = (lon) => (lon - M.lon0) * M.k * M.cos, py = (lat) => (M.latN - lat) * M.k;
const sinInset = (e) => e.lat != null && !(e.lat < -60) && !Object.values(M.insets).some((i) => e.lon >= i.bbox[0] - 0.3 && e.lon <= i.bbox[2] + 0.3 && e.lat >= i.bbox[1] - 0.3 && e.lat <= i.bbox[3] + 0.3);

const P = 4.6, B = 2.6, CIERRE = 4.4; // portada, cada momento, cierre (segundos)

function proyecto(p) {
  p.i = H.periodos.indexOf(p);
  const dir = path.join(DESTINO, p.id), assets = path.join(dir, 'assets');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(assets, { recursive: true });
  fs.copyFileSync(path.join(SITE, 'js', 'vendor', 'gsap.min.js'), path.join(assets, 'gsap.min.js'));
  const usar = (img) => { if (!img) return ''; const n = path.basename(img.src); fs.copyFileSync(path.join(SITE, img.src), path.join(assets, n)); return 'assets/' + n; };
  const evs = p.eventos.map((id) => evById[id]);
  const n = evs.length, C = P + n * B, total = +(C + CIERRE).toFixed(2);
  const creditos = [p.img, ...evs.map((e) => e.img)].filter(Boolean)
    .filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i).map((x) => `${x.autor} (${x.lic})`);
  const pins = evs.map((e, i) => sinInset(e)
    ? `<circle id="halo${i}" class="m-halo" cx="${px(e.lon).toFixed(1)}" cy="${py(e.lat).toFixed(1)}" r="80"/><circle id="pin${i}" class="m-pin" cx="${px(e.lon).toFixed(1)}" cy="${py(e.lat).toFixed(1)}" r="30"/>`
    : '').join('');
  const beats = evs.map((e, i) => {
    const t = +(P + i * B).toFixed(2), dur = i === n - 1 ? B : B + 0.5;
    const src = usar(e.img);
    return `<div id="b${i}" class="clip beat" data-start="${t}" data-duration="${dur}" data-track-index="${2 + (i % 2)}" style="z-index:${3 + i}">
        <div class="b-img${e.img && e.img.v ? ' vertical' : ''}">${src ? `<img src="${src}" alt="">` : `<div class="b-vacia"></div>`}${e.img ? `<p class="b-cred">${e.img.autor} · ${e.img.lic}</p>` : ''}</div>
        <div class="b-txt"><p class="b-anio">${fmt(e.anio)}</p><h2 class="b-t">${e.titulo}</h2><p class="b-f">${e.fecha}</p></div>
      </div>`;
  }).join('\n      ');

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1280, height=720" />
    <script src="assets/gsap.min.js"></script>
    <style>
      :root { --fondo: #131715; --tinta: #f5f1e8; --tinta-2: #c9c5bb; --cobre: #e0835a; --tierra: #2c3430; --borde: #59635c; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1280px; height: 720px; overflow: hidden; background: var(--fondo); }
      #root { position: relative; width: 100%; height: 100%; color: var(--tinta); font-family: Inter, sans-serif; }
      .fondo { position: absolute; inset: 0; background: var(--fondo); }
      #portada .p-img, #portada .p-velo { position: absolute; inset: 0; overflow: hidden; }
      #portada .p-img img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%; }
      #portada .p-velo { background: linear-gradient(90deg, rgba(19,23,21,0.94) 0%, rgba(19,23,21,0.78) 48%, rgba(19,23,21,0.25) 100%); }
      #portada .p-txt { position: absolute; left: 96px; bottom: 104px; width: 760px; }
      .p-rango { font: 600 26px/1.2 Inter, sans-serif; color: var(--cobre); }
      .p-titulo { font: 500 80px/1.02 "EB Garamond", serif; margin-top: 14px; letter-spacing: -0.01em; }
      .p-n { font: 400 22px/1.3 Inter, sans-serif; color: var(--tinta-2); margin-top: 18px; }
      #mapa { position: absolute; left: 92px; top: 48px; width: 156px; height: 624px; }
      #mapa svg { width: 100%; height: 100%; }
      .m-tierra { fill: var(--tierra); stroke: var(--borde); stroke-width: 1px; vector-effect: non-scaling-stroke; }
      .m-pin { fill: var(--cobre); }
      .m-halo { fill: none; stroke: var(--cobre); stroke-width: 1.5px; vector-effect: non-scaling-stroke; opacity: 0; }
      .beat { position: absolute; inset: 0; }
      .b-img { position: absolute; left: 312px; top: 48px; width: 880px; height: 396px; overflow: hidden; border-radius: 14px; background: var(--tierra); }
      .b-img img { width: 100%; height: 100%; object-fit: cover; }
      .b-img.vertical img { object-fit: contain; }
      .p-titulo, .b-t, .c-t { text-wrap: balance; }
      .b-vacia { position: absolute; inset: 0; background: repeating-linear-gradient(135deg, #2c3430 0 10px, #262d29 10px 20px); }
      .b-cred { position: absolute; right: 10px; bottom: 10px; max-width: 70%; padding: 3px 8px; border-radius: 4px; background: rgba(19,23,21,0.72); font: 400 13px/1.3 Inter, sans-serif; color: var(--tinta-2); }
      .b-txt { position: absolute; left: 312px; top: 466px; width: 880px; }
      .b-anio { font: 500 54px/1 "EB Garamond", serif; color: var(--cobre); }
      .b-t { font: 500 40px/1.08 "EB Garamond", serif; margin-top: 8px; }
      .b-f { font: 400 20px/1.3 Inter, sans-serif; color: var(--tinta-2); margin-top: 10px; }
      #progreso { position: absolute; left: 312px; width: 880px; bottom: 34px; height: 3px; background: rgba(245,241,232,0.16); }
      #progreso i { display: block; width: 100%; height: 100%; background: var(--cobre); }
      #cierre .c-txt { position: absolute; left: 312px; top: 200px; width: 860px; }
      .c-t { font: 500 60px/1.05 "EB Garamond", serif; }
      .c-d { font: 400 24px/1.4 Inter, sans-serif; color: var(--tinta-2); margin-top: 18px; }
      .c-cred { font: 400 14px/1.5 Inter, sans-serif; color: var(--tinta-2); margin-top: 64px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1280" data-height="720" data-fps="30">
      <div class="fondo"></div>
      <div id="portada" class="clip" data-start="0" data-duration="${P}" data-track-index="0" style="z-index:2">
        <div class="p-img">${p.img ? `<img src="${usar(p.img)}" alt="">` : ''}</div>
        <div class="p-velo"></div>
        <div class="p-txt"><p class="p-rango">${p.rango}</p><h1 class="p-titulo">${p.titulo}</h1><p class="p-n">Periodo ${p.i + 1} de ${H.periodos.length} · ${n} momentos clave</p></div>
      </div>
      <div id="mapa" class="clip" data-start="${(P - 0.3).toFixed(2)}" data-duration="${(n * B + 0.3 + CIERRE).toFixed(2)}" data-track-index="1" style="z-index:1">
        <svg viewBox="0 0 ${M.w} ${M.h}" preserveAspectRatio="xMidYMid meet">${M.regiones.map((r) => `<path class="m-tierra" d="${r.d}"/>`).join('')}${pins}</svg>
      </div>
      ${beats}
      <div id="progreso" class="clip" data-start="${P}" data-duration="${(n * B).toFixed(2)}" data-track-index="4" style="z-index:40"><i></i></div>
      <div id="cierre" class="clip" data-start="${C.toFixed(2)}" data-duration="${CIERRE}" data-track-index="5" style="z-index:41">
        <div class="c-txt"><h2 class="c-t">Sigue explorando ${p.titulo.toLowerCase().startsWith('rep') ? 'la ' + p.titulo : p.titulo.toLowerCase().startsWith('dictadura') || p.titulo.toLowerCase().startsWith('recuperación') ? 'la ' + p.titulo.toLowerCase() : p.titulo.toLowerCase().startsWith('poblamiento') ? 'el poblamiento' : 'este periodo'} en el mapa</h2>
          <p class="c-d">Historia de Chile · periodo ${p.i + 1} de ${H.periodos.length}</p>
          <p class="c-cred">Imágenes de Wikimedia Commons: ${creditos.join(' · ')}</p></div>
      </div>
    </div>
    <script>
      const P = ${P}, B = ${B}, n = ${n}, C = ${C};
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#portada .p-img img", { scale: 1.14 }, { scale: 1, duration: P + 0.4, ease: "none" }, 0);
      tl.from("#portada .p-velo", { opacity: 0, duration: 0.8, ease: "power1.out" }, 0);
      tl.from(["#portada .p-rango", "#portada .p-titulo", "#portada .p-n"], { opacity: 0, y: 26, duration: 0.9, ease: "power3.out", stagger: 0.14 }, 0.3);
      tl.to(["#portada .p-txt", "#portada .p-img"], { opacity: 0, duration: 0.45, ease: "power1.in" }, P - 0.5);
      tl.from("#mapa svg", { opacity: 0, x: -24, duration: 0.8, ease: "power3.out" }, P - 0.3);
      for (let i = 0; i < n; i++) {
        const t = P + i * B, b = "#b" + i;
        tl.fromTo(b + " .b-img", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" }, t);
        if (document.querySelector(b + " .b-img img")) tl.fromTo(b + " .b-img img", { scale: 1.1 }, { scale: 1, duration: B + 0.5, ease: "none" }, t);
        tl.from([b + " .b-anio", b + " .b-t", b + " .b-f"], { opacity: 0, y: 18, duration: 0.6, ease: "power3.out", stagger: 0.08 }, t + 0.1);
        if (i < n - 1) tl.to(b + " .b-txt", { opacity: 0, duration: 0.25, ease: "power1.in" }, t + B - 0.2);
        if (document.getElementById("pin" + i)) {
          tl.fromTo("#pin" + i, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.5, ease: "back.out(3)" }, t + 0.1);
          tl.fromTo("#halo" + i, { scale: 0.3, opacity: 1, transformOrigin: "50% 50%" }, { scale: 1.7, opacity: 0, duration: 1.3, ease: "power2.out", immediateRender: false }, t + 0.15);
          tl.to("#pin" + i, { opacity: 0.45, duration: 0.4, ease: "power1.out" }, t + B);
        }
      }
      tl.fromTo("#progreso i", { scaleX: 0, transformOrigin: "0% 50%" }, { scaleX: 1, duration: n * B, ease: "none" }, P);
      tl.from(["#cierre .c-t", "#cierre .c-d", "#cierre .c-cred"], { opacity: 0, y: 16, duration: 0.7, ease: "power3.out", stagger: 0.12 }, C + 0.2);
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'hyperframes.json'), JSON.stringify({ paths: { blocks: 'compositions', assets: 'assets' }, media: { autoProxy: true } }, null, 2));
  return { dir, total };
}

const lista = H.periodos.filter((p) => !ids.length || ids.includes(p.id));
fs.mkdirSync(path.join(SITE, 'video'), { recursive: true });
const env = { ...process.env, DO_NOT_TRACK: '1', HYPERFRAMES_SKIP_SKILLS: '1' };
for (const p of lista) {
  const { dir, total } = proyecto(p);
  if (soloHtml) { console.log('html', path.relative(ROOT, dir), total + ' s'); continue; }
  const out = path.join(SITE, 'video', p.id + '.mp4');
  // Rutas relativas desde el proyecto: la carpeta del sitio tiene espacios y npx corre en un shell.
  const r = spawnSync('npx', ['--yes', HF, 'render', '.', '-o', path.relative(dir, out), '--crf', '26', '--quiet'], { cwd: dir, env, stdio: 'inherit', shell: true });
  if (r.status !== 0 || !fs.existsSync(out)) { console.log('FALLÓ', p.id); continue; }
  console.log('video', path.relative(ROOT, out), total + ' s', (fs.statSync(out).size / 1048576).toFixed(1) + ' MB');
}
console.log('Ejecuta npm run build para enlazar los videos en el sitio.');
