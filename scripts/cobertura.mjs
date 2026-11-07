// Métrica de cobertura (ítem 1.10 del debate): ¿qué regiones, siglos, personas y temas faltan?
// La llama build-data.mjs y escribe segundo-cerebro/Proyecto/Cobertura.md (informe generado: no editar a mano).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Metas acordadas en el acta del debate del 2026-11-07.
export const METAS = { porRegion: 3, porSiglo: 4, mujeres: 0.3, palabras: 300 };

// Proyección idéntica a scripts/build-geo.mjs (100 unidades = 1° de latitud).
const K = 100, LON0 = -77.5, LATN = -17.0, COS = Math.cos((36.5 * Math.PI) / 180);
const px = (lon) => (lon - LON0) * K * COS, py = (lat) => (LATN - lat) * K;

// «M x y l dx dy … z» (varios anillos) → lista de anillos con coordenadas absolutas.
function anillos(d) {
  const out = []; let cur = null, x = 0, y = 0;
  for (const m of d.matchAll(/([Mlz])([^Mlz]*)/g)) {
    const n = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    if (m[1] === 'M') { x = n[0]; y = n[1]; cur = [[x, y]]; out.push(cur); }
    else if (m[1] === 'l') for (let i = 0; i < n.length; i += 2) { x += n[i]; y += n[i + 1]; cur.push([x, y]); }
  }
  return out;
}
function dentro(pt, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function cargarRegiones(root) {
  const f = path.join(root, 'site', 'data', 'mapa.js');
  if (!fs.existsSync(f)) return [];
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx);
  return (ctx.window.MAPA?.regiones || []).map((r) => ({ nombre: r.nombre, rings: anillos(r.d || '') }));
}
function regionDe(ev, regiones) {
  if (typeof ev.lat !== 'number') return null;
  // Islas oceánicas (Juan Fernández, Rapa Nui, Desventuradas) pertenecen a la Región de Valparaíso.
  if (ev.lon < -78.2) return regiones.find((r) => /Valpara/.test(r.nombre))?.nombre || 'Valparaíso';
  if (ev.lat < -56.2) return regiones.find((r) => /Magallanes/.test(r.nombre))?.nombre || 'Magallanes';
  const p = [px(ev.lon), py(ev.lat)];
  const r = regiones.find((x) => x.rings.some((g) => dentro(p, g)));
  if (r) return r.nombre;
  // En la costa el punto puede caer al mar por la simplificación: región más cercana.
  let mejor = null, dmin = Infinity;
  for (const x of regiones) for (const g of x.rings) for (const q of g) { const dd = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (dd < dmin) { dmin = dd; mejor = x.nombre; } }
  return dmin < 60 ** 2 ? mejor : null;
}
const siglo = (a) => (a < 1500 ? 'Antes de 1500' : 'Siglo ' + ['XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'][Math.floor((a - 1500) / 100)]);
const palabras = (html) => String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

export function cobertura({ root, eventos, notas, periodos }) {
  const regiones = cargarRegiones(root);
  const porReg = new Map(regiones.map((r) => [r.nombre, []]));
  const sinReg = [];
  for (const e of eventos) { const r = regionDe(e, regiones); if (r && porReg.has(r)) porReg.get(r).push(e.titulo); else sinReg.push(e.titulo); }
  const porSiglo = new Map();
  for (const e of eventos) { const s = siglo(e.anio); porSiglo.set(s, (porSiglo.get(s) || 0) + 1); }
  const pers = notas.filter((n) => n.data.tipo === 'personaje');
  const genero = { mujer: 0, hombre: 0, otro: 0, 'sin dato': 0 };
  for (const p of pers) { const g = String(p.data.genero || '').toLowerCase(); genero[g in genero ? g : 'sin dato']++; }
  const conDato = genero.mujer + genero.hombre + genero.otro;
  const delgados = eventos.map((e) => [e.titulo, palabras(e.adultos)]).filter(([, w]) => w < METAS.palabras);
  const conFuentes = eventos.filter((e) => e.fuentes?.length).length;
  const revisados = eventos.filter((e) => e.rev).length;
  const indexables = eventos.filter((e) => e.indexable).length;

  const lineas = [];
  const ok = (b) => (b ? '✅' : '⚠️');
  lineas.push('---', 'tipo: informe', 'generado: ' + new Date().toISOString().slice(0, 10), '---',
    '# Cobertura del contenido', '',
    '> [!info] Informe generado por `npm run build` (scripts/cobertura.mjs). No editar a mano.',
    `> Metas del acta del debate (2026-11-07): ≥${METAS.porRegion} momentos por región, ≥${METAS.porSiglo} por siglo desde el XVI, ≥${METAS.mujeres * 100}% de mujeres entre los personajes, ≥${METAS.palabras} palabras en el texto adulto, fuentes enlazadas y revisión humana firmada.`, '',
    '## Resumen', '',
    `- Momentos: **${eventos.length}** · con fuentes: **${conFuentes}** · revisados por una persona: **${revisados}** · listos para indexar: **${indexables}**`,
    `- Texto adulto bajo ${METAS.palabras} palabras: **${delgados.length}** de ${eventos.length}`,
    `- Personajes: **${pers.length}** · mujeres: **${genero.mujer}** · hombres: **${genero.hombre}**` + (genero['sin dato'] ? ` · sin dato de género: ${genero['sin dato']}` : '') +
      (conDato ? ` ${ok(genero.mujer / conDato >= METAS.mujeres)} (${Math.round((100 * genero.mujer) / conDato)}% mujeres)` : ''), '',
    '## Por región', '', '| Región | Momentos | Meta |', '|---|---|---|');
  for (const [r, l] of porReg) lineas.push(`| ${r} | ${l.length} | ${ok(l.length >= METAS.porRegion)} |`);
  if (sinReg.length) lineas.push('', `Sin región (sin coordenadas o fuera del mapa): ${sinReg.join(', ')}.`);
  lineas.push('', '## Por siglo', '', '| Época | Momentos | Meta |', '|---|---|---|');
  for (const s of ['Antes de 1500', 'Siglo XVI', 'Siglo XVII', 'Siglo XVIII', 'Siglo XIX', 'Siglo XX', 'Siglo XXI'])
    lineas.push(`| ${s} | ${porSiglo.get(s) || 0} | ${s === 'Antes de 1500' ? '—' : ok((porSiglo.get(s) || 0) >= METAS.porSiglo)} |`);
  lineas.push('', '## Por periodo', '', '| Periodo | Momentos |', '|---|---|');
  for (const p of periodos) lineas.push(`| ${p.titulo} | ${p.eventos.length} |`);
  lineas.push('', `## Momentos con texto adulto bajo ${METAS.palabras} palabras`, '');
  delgados.sort((a, b) => a[1] - b[1]).forEach(([t, w]) => lineas.push(`- ${t} (${w})`));
  // Lista de trabajo para el revisor humano: primero lo marcado «pendiente» (lo nuevo o corregido), después lo que no tiene el campo.
  const sinFirma = notas.filter((n) => ['evento', 'periodo', 'personaje', 'lugar', 'pueblo'].includes(n.data.tipo) && !(n.data.revisado && !/pendiente/i.test(String(n.data.revisado))));
  const marcadas = sinFirma.filter((n) => /pendiente/i.test(String(n.data.revisado || '')));
  lineas.push('', '## Pendientes de revisión humana', '',
    'Para firmar una nota: cambia `revisado: pendiente` por `revisado: "Tu nombre · AAAA-MM-DD"` (ver [[Guía de contenido]], «Protocolo editorial»).', '',
    `### Nuevas o corregidas (${marcadas.length})`, '', ...marcadas.map((n) => `- [ ] [[${n.nombre}]]`),
    '', `### Sin revisar desde antes del protocolo (${sinFirma.length - marcadas.length})`, '',
    sinFirma.filter((n) => !marcadas.includes(n)).map((n) => `[[${n.nombre}]]`).join(' · '));
  fs.writeFileSync(path.join(root, 'segundo-cerebro', 'Proyecto', 'Cobertura.md'), lineas.join('\n') + '\n');

  const flojas = [...porReg].filter(([, l]) => l.length < METAS.porRegion).map(([r, l]) => r.replace(/^Región (de |del )?/, '') + ' ' + l.length);
  return `Cobertura: ${conFuentes}/${eventos.length} con fuentes · ${revisados} revisados · ${delgados.length} bajo ${METAS.palabras} palabras · ` +
    `mujeres ${genero.mujer}/${pers.length} · regiones bajo la meta: ${flojas.length ? flojas.join(', ') : 'ninguna'} → segundo-cerebro/Proyecto/Cobertura.md`;
}
