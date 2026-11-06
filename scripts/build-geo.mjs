// Genera site/data/mapa.js desde geoBoundaries (CC BY). Se corre una sola vez.
// Uso: node scripts/build-geo.mjs [carpeta-cache]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.resolve(process.argv[2] || path.join(ROOT, '.cache', 'geo'));
const OUT = path.join(ROOT, 'site', 'data', 'mapa.js');

// Proyección equirectangular centrada en Chile continental. 100 unidades = 1° de latitud.
const K = 100, LON0 = -77.5, LON1 = -65.5, LATN = -17.0, LATS = -56.2;
const COS = Math.cos((36.5 * Math.PI) / 180);
const W = Math.round((LON1 - LON0) * K * COS), H = Math.round((LATN - LATS) * K);
const px = (lon) => (lon - LON0) * K * COS;
const py = (lat) => (LATN - lat) * K;

const SOURCES = ['CHL-ADM1', 'ARG-ADM0', 'BOL-ADM0', 'PER-ADM0'];

async function load(id) {
  const file = path.join(CACHE, `${id}.geojson`);
  if (!fs.existsSync(file)) {
    const [iso, adm] = id.split('-');
    const meta = await (await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${iso}/${adm}/`)).json();
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, await (await fetch(meta.simplifiedGeometryGeoJSON)).text());
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const polygons = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates);

// Recorte Sutherland–Hodgman de un anillo contra un rectángulo (en lon/lat).
function clipRing(ring, [x0, y0, x1, y1]) {
  const edges = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ];
  const cut = [
    (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1],
  ];
  let out = ring;
  for (let e = 0; e < 4 && out.length; e++) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[(i + inp.length - 1) % inp.length], b = inp[i];
      const ia = edges[e](a), ib = edges[e](b);
      if (ib) { if (!ia) out.push(cut[e](a, b)); out.push(b); }
      else if (ia) out.push(cut[e](a, b));
    }
  }
  return out;
}

// Douglas–Peucker iterativo en coordenadas proyectadas.
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]], t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len));
      const ex = ax + t * dx - pts[i][0], ey = ay + t * dy - pts[i][1], d = ex * ex + ey * ey;
      if (d > max) { max = d; idx = i; }
    }
    if (max > t2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const area = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
function centroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i], q = r[(i + 1) % r.length], f = p[0] * q[1] - q[0] * p[1];
    a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : r[0];
}

// Anillo proyectado → comandos SVG relativos con 1 decimal.
function ringToD(r) {
  let d = '', lx = 0, ly = 0;
  r.forEach((p, i) => {
    const x = Math.round(p[0] * 10), y = Math.round(p[1] * 10);
    if (i === 0) d += `M${x / 10} ${y / 10}`;
    else { const dx = (x - lx) / 10, dy = (y - ly) / 10; if (dx || dy) d += `l${dx} ${dy}`; }
    lx = x; ly = y;
  });
  return d + 'z';
}

function project(geom, { bbox, proj, tol, minArea }) {
  let d = '', best = null, bestA = 0;
  for (const poly of polygons(geom)) {
    poly.forEach((ring, ri) => {
      const c = bbox ? clipRing(ring, bbox) : ring;
      if (c.length < 3) return;
      const s = simplify(c.map(proj), tol);
      const a = Math.abs(area(s));
      if (s.length < 3 || a < minArea) return;
      d += ringToD(s);
      if (ri === 0 && a > bestA) { bestA = a; best = s; }
    });
  }
  const c = best ? centroid(best) : [0, 0];
  return { d, cx: Math.round(c[0]), cy: Math.round(c[1]) };
}

// Nombres limpios (los del origen vienen con doble codificación UTF-8).
const REGIONES = [
  ['Arica', 'Arica y Parinacota', 'XV', 'Arica'], ['Tarapac', 'Tarapacá', 'I', 'Iquique'],
  ['Antofagasta', 'Antofagasta', 'II', 'Antofagasta'], ['Atacama', 'Atacama', 'III', 'Copiapó'],
  ['Coquimbo', 'Coquimbo', 'IV', 'La Serena'], ['Valpara', 'Valparaíso', 'V', 'Valparaíso'],
  ['Metropolitana', 'Metropolitana', 'RM', 'Santiago'], ['Higgins', "O'Higgins", 'VI', 'Rancagua'],
  ['Maule', 'Maule', 'VII', 'Talca'], ['uble', 'Ñuble', 'XVI', 'Chillán'],
  ['Bío', 'Biobío', 'VIII', 'Concepción'], ['Araucan', 'La Araucanía', 'IX', 'Temuco'],
  ['Los R', 'Los Ríos', 'XIV', 'Valdivia'], ['Los Lagos', 'Los Lagos', 'X', 'Puerto Montt'],
  ['Ays', 'Aysén', 'XI', 'Coyhaique'], ['Magallanes', 'Magallanes', 'XII', 'Punta Arenas'],
];
const fixName = (s) => { try { return Buffer.from(s, 'latin1').toString('utf8'); } catch { return s; } };

const main = { bbox: [LON0, LATS, LON1, LATN], proj: ([lon, lat]) => [px(lon), py(lat)], tol: 0.55, minArea: 2.5 };

const [chl, ...vec] = await Promise.all(SOURCES.map(load));
const regiones = chl.features.map((f) => {
  const raw = fixName(f.properties.shapeName);
  const def = REGIONES.find(([k]) => raw.includes(k)) || [raw, raw, '', ''];
  return { nombre: def[1], numero: def[2], capital: def[3], ...project(f.geometry, main) };
});
// Orden norte → sur, para la lista accesible.
regiones.sort((a, b) => a.cy - b.cy);

const vecinos = vec.map((g, i) => {
  const nombre = ['Argentina', 'Bolivia', 'Perú'][i];
  return { nombre, ...project(g.features[0].geometry, { ...main, tol: 1.2, minArea: 40 }) };
});

// Insets: islas oceánicas con su propia proyección local.
function inset(name, bbox, size) {
  const [x0, y0, x1, y1] = bbox, cos = Math.cos(((y0 + y1) / 2) * (Math.PI / 180));
  const s = size / Math.max((x1 - x0) * cos, y1 - y0);
  const proj = ([lon, lat]) => [(lon - x0) * cos * s, (y1 - lat) * s];
  const geom = chl.features.find((f) => fixName(f.properties.shapeName).includes('Valpara')).geometry;
  const out = project(geom, { bbox, proj, tol: 0.25, minArea: 0.5 });
  return { nombre: name, w: Math.round((x1 - x0) * cos * s), h: Math.round((y1 - y0) * s), d: out.d, bbox, k: s, cos };
}
const insets = {
  rapanui: inset('Rapa Nui', [-109.48, -27.22, -109.2, -27.04], 120),
  juanfernandez: inset('Juan Fernández', [-79.0, -33.74, -78.74, -33.58], 120),
};

const data = { w: W, h: H, k: K, lon0: LON0, latN: LATN, cos: COS, regiones, vecinos, insets,
  credito: 'Límites: geoBoundaries (BCN, OCHA ROLAC), CC BY 3.0 IGO.' };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `// Generado por scripts/build-geo.mjs. No editar a mano.\nwindow.MAPA=${JSON.stringify(data)};\n`);
console.log(`mapa.js ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB · ${regiones.length} regiones · viewBox ${W}x${H}`);
