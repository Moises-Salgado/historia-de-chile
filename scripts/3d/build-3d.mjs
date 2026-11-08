// npm run 3d · arma los mundos 3D.
// 1) Blender (por línea de comandos) genera site/3d/<mundo>.glb con scripts/3d/<mundo>.py.
// 2) esbuild empaqueta site/3d/src/paseo.js (three.js incluido) en un IIFE clásico: site/3d/paseo.js (uno para todos).
// 3) Cada página site/3d/<mundo>.html recibe las huellas (?v=) de paseo.js, paseo.css y su escena.
// Uso: npm run 3d                → Humberstone
//      npm run 3d -- niebla      → Castillo de Niebla (antes: python -P scripts/3d/niebla_fuentes.py)
//      npm run 3d -- --todos     → todos
// Opciones: --solo-js (no abre Blender) · --render CARPETA (renders de prueba con Eevee) · --vista=inicio,teatro
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MUNDOS = ['humberstone', 'niebla'];
const args = process.argv.slice(2);
const soloJs = args.includes('--solo-js');
const pedidos = args.filter((a) => MUNDOS.includes(a));
const lista = args.includes('--todos') ? MUNDOS : (pedidos.length ? pedidos : ['humberstone']);

function buscarBlender() {
  if (process.env.BLENDER && fs.existsSync(process.env.BLENDER)) return process.env.BLENDER;
  const base = 'C:\\Program Files\\Blender Foundation';
  if (fs.existsSync(base)) {
    const dirs = fs.readdirSync(base).filter((d) => /^Blender/.test(d)).sort().reverse();
    for (const d of dirs) {
      const exe = path.join(base, d, 'blender.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return 'blender';
}

if (!soloJs) {
  const blender = buscarBlender();
  const extra = args.filter((a) => a !== '--solo-js' && a !== '--todos' && !MUNDOS.includes(a));
  console.log('Blender:', blender);
  for (const m of lista) {
    const py = path.join(RAIZ, 'scripts', '3d', m + '.py');
    console.log('— mundo:', m);
    const r = spawnSync(blender, ['--background', '--factory-startup', '--python-exit-code', '1', '--python', py, '--', ...extra],
      { stdio: 'inherit', cwd: RAIZ });
    if (r.status !== 0) { console.error('Blender terminó con error en', m); process.exit(r.status || 1); }
  }
}

// El service worker del sitio guarda en caché primero: cada archivo del paseo lleva ?v=<hash de su contenido>.
const { createHash } = await import('node:crypto');
const D3 = path.join(RAIZ, 'site', '3d');
const huella = (...fs_) => { const h = createHash('sha1'); for (const f of fs_) if (fs.existsSync(f)) h.update(fs.readFileSync(f)); return h.digest('hex').slice(0, 10); };
const esbuild = await import('esbuild');
const out = path.join(D3, 'paseo.js');
await esbuild.build({
  entryPoints: [path.join(D3, 'src', 'paseo.js')],
  bundle: true, format: 'iife', minify: true, target: ['es2019'], outfile: out,
  legalComments: 'eof', logLevel: 'info', define: { __V_ESCENA__: JSON.stringify(huella(path.join(D3, 'humberstone.glb'))) },
});
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log('paseo.js:', kb(out));
for (const m of MUNDOS) {
  const html = path.join(D3, m + '.html'), glb = path.join(D3, m + '.glb');
  if (!fs.existsSync(html)) continue;
  let h = fs.readFileSync(html, 'utf8');
  h = h.replace(/paseo\.js(\?v=[\w]+)?"/, `paseo.js?v=${huella(out)}"`)
    .replace(/paseo\.css(\?v=[\w]+)?"/, `paseo.css?v=${huella(path.join(D3, 'paseo.css'))}"`)
    .replace(/<body class="paseo"( data-escena="[^"]*")?>/, `<body class="paseo" data-escena="${m}.glb?v=${huella(glb)}">`);
  fs.writeFileSync(html, h);
  if (fs.existsSync(glb)) console.log(m + '.glb:', (fs.statSync(glb).size / 1e6).toFixed(2) + ' MB');
}
