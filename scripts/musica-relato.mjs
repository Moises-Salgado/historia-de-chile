// Música original para los relatos (sin muestras ni programas externos): sintetizador orquestal propio.
// Uso: node scripts/musica-relato.mjs [carpeta-salida]   (por defecto relatos/combate-naval-de-iquique/musica)
// Genera tension.mp3 (Do menor, ~40 s) y marcha.mp3 (marcha heroica en Mi bemol, ~40 s). Composición propia: libre de derechos.
// Necesita ffmpeg (PATH o HYPERFRAMES_FFMPEG_PATH) solo para convertir a MP3 y normalizar volumen.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'relatos/combate-naval-de-iquique/musica');
const SR = 44100;
import { FFMPEG } from './ffmpeg.mjs';
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1; // ruido determinista

function pista(seg) { return { L: new Float32Array(Math.ceil(seg * SR)), R: new Float32Array(Math.ceil(seg * SR)) }; }
function suma(p, i, v, pan) { if (i < 0 || i >= p.L.length) return; p.L[i] += v * Math.cos((pan + 1) * Math.PI / 4); p.R[i] += v * Math.sin((pan + 1) * Math.PI / 4); }

// Envolvente ADSR (segundos) evaluada en t.
const adsr = (t, dur, a, d, s, r) => t < a ? t / a : t < a + d ? 1 - (1 - s) * (t - a) / d : t < dur ? s : Math.max(0, s * (1 - (t - dur) / r));

// ---------- Instrumentos ----------
function metal(p, t0, nota, dur, vel = 0.8, pan = 0, brillo = 1) {
  const f = hz(nota), n = Math.ceil((dur + 0.25) * SR), i0 = Math.round(t0 * SR);
  const fases = [0, 0.33, 0.66], det = [1, 1.004, 0.9965];
  let y1 = 0, y2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR, vib = 1 + (t > 0.25 ? 0.0035 * Math.sin(2 * Math.PI * 5.2 * t) : 0);
    let x = 0;
    for (let j = 0; j < 3; j++) { fases[j] = (fases[j] + f * det[j] * vib / SR) % 1; x += 2 * fases[j] - 1; }
    const env = adsr(t, dur, 0.035, 0.12, 0.78, 0.18);
    const fc = (700 + 2600 * brillo * Math.min(1, env * 1.25)) * (0.8 + 0.4 * vel);
    const a = 1 - Math.exp(-2 * Math.PI * fc / SR);
    y1 += a * (x / 3 - y1); y2 += a * (y1 - y2);
    suma(p, i0 + k, y2 * env * vel * 0.32, pan);
  }
}
function cuerdas(p, t0, nota, dur, vel = 0.5, pan = 0, ataque = 0.25) {
  const f = hz(nota), n = Math.ceil((dur + 0.6) * SR), i0 = Math.round(t0 * SR);
  const det = [1, 1.006, 0.994, 1.0115, 0.9885], fases = det.map((_, j) => j * 0.2);
  let y = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR, vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.6 * t + nota);
    let x = 0;
    for (let j = 0; j < 5; j++) { fases[j] = (fases[j] + f * det[j] * vib / SR) % 1; x += 2 * fases[j] - 1; }
    const a = 1 - Math.exp(-2 * Math.PI * 2200 / SR);
    y += a * (x / 5 - y);
    suma(p, i0 + k, y * adsr(t, dur, ataque, 0.2, 0.9, 0.5) * vel * 0.22, pan);
  }
}
function timbal(p, t0, nota, vel = 0.8, decae = 1.4) {
  const f = hz(nota), n = Math.ceil(decae * 2 * SR), i0 = Math.round(t0 * SR);
  let fase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR; fase += f * (1 + 0.06 * Math.exp(-t * 30)) / SR;
    const v = (Math.sin(2 * Math.PI * fase) + 0.35 * Math.sin(2 * Math.PI * fase * 1.5)) * Math.exp(-t / decae * 2.2) + rnd() * 0.5 * Math.exp(-t * 60);
    suma(p, i0 + k, v * vel * 0.45, -0.15);
  }
}
function redobleTimbal(p, t0, nota, dur, v0 = 0.15, v1 = 0.7) {
  for (let t = 0; t < dur; t += 0.055) timbal(p, t0 + t, nota, v0 + (v1 - v0) * (t / dur), 0.5);
}
function caja(p, t0, vel = 0.5, pan = 0.2) {
  const n = Math.ceil(0.25 * SR), i0 = Math.round(t0 * SR);
  let b1 = 0, b2 = 0, fase = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR, x = rnd();
    b1 += 0.35 * (x - b1); b2 += 0.6 * (b1 - b2); // pasa banda grueso
    fase += 185 / SR;
    const v = (x - b2) * Math.exp(-t * 22) * 0.9 + Math.sin(2 * Math.PI * fase) * Math.exp(-t * 35) * 0.5;
    suma(p, i0 + k, v * vel * 0.35, pan);
  }
}
function bombo(p, t0, vel = 0.7) {
  const n = Math.ceil(0.6 * SR), i0 = Math.round(t0 * SR);
  let fase = 0;
  for (let k = 0; k < n; k++) { const t = k / SR; fase += (48 + 60 * Math.exp(-t * 25)) / SR; suma(p, i0 + k, Math.sin(2 * Math.PI * fase) * Math.exp(-t * 6) * vel * 0.6, 0); }
}
function platillo(p, t0, vel = 0.5, decae = 2.6) {
  const n = Math.ceil(decae * SR), i0 = Math.round(t0 * SR);
  let prev = 0;
  for (let k = 0; k < n; k++) { const t = k / SR, x = rnd(), hp = x - prev; prev = x; suma(p, i0 + k, hp * Math.exp(-t / decae * 3) * vel * 0.16, k % 2 ? 0.4 : -0.4); }
}

// ---------- Reverberación (Freeverb simplificado) ----------
function reverb(p, mojado = 0.28, sala = 0.84, amort = 0.25) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], alls = [556, 441, 341, 225];
  for (const [canal, extra] of [['L', 0], ['R', 23]]) {
    const x = p[canal], y = new Float32Array(x.length);
    const cb = combs.map((l) => ({ b: new Float32Array(l + extra), i: 0, f: 0 }));
    const ab = alls.map((l) => ({ b: new Float32Array(l + extra), i: 0 }));
    for (let k = 0; k < x.length; k++) {
      const inp = x[k] * 0.015; let o = 0;
      for (const c of cb) { const v = c.b[c.i]; c.f = v * (1 - amort) + c.f * amort; c.b[c.i] = inp + c.f * sala; c.i = (c.i + 1) % c.b.length; o += v; }
      for (const a of ab) { const v = a.b[a.i]; a.b[a.i] = o + v * 0.5; o = v - o; a.i = (a.i + 1) % a.b.length; }
      y[k] = o;
    }
    for (let k = 0; k < x.length; k++) x[k] = x[k] * (1 - mojado * 0.5) + y[k] * mojado * 3;
  }
}

function guardar(p, nombre) {
  let pico = 0; for (const c of [p.L, p.R]) for (const v of c) pico = Math.max(pico, Math.abs(v));
  const g = 0.89 / (pico || 1), n = p.L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let k = 0; k < n; k++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, p.L[k] * g)) * 32767), 44 + k * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, p.R[k] * g)) * 32767), 46 + k * 4); }
  const wav = path.join(OUT, nombre + '.wav'), mp3 = path.join(OUT, nombre + '.mp3');
  fs.writeFileSync(wav, buf);
  const r = spawnSync(FFMPEG, ['-loglevel', 'error', '-y', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-b:a', '192k', mp3]);
  if (r.status === 0) fs.rmSync(wav); else console.log('ffmpeg no disponible: queda', wav);
  console.log(nombre, (n / SR).toFixed(1) + ' s');
}

// ---------- 1. Tensión: Do menor, 72 negras/min, 12 compases de 4/4 ----------
function tension() {
  const B = 60 / 72, C = 4 * B, p = pista(12 * C + 3);
  cuerdas(p, 0, 36, 12 * C, 0.55, -0.3, 3); cuerdas(p, 0, 48, 12 * C, 0.35, 0.3, 4);            // do grave sostenido
  cuerdas(p, 4 * C, 43, 8 * C, 0.4, -0.1, 3);                                                     // entra el sol
  cuerdas(p, 2 * C, 75, 10 * C, 0.10, 0.5, 6); cuerdas(p, 2 * C, 79, 10 * C, 0.08, -0.5, 6);      // violines agudos, lejanos
  for (let c = 0; c < 12; c++) { timbal(p, c * C, 36, 0.35 + 0.03 * c, 1.8); if (c % 2) timbal(p, c * C + 2.5 * B, 43, 0.25, 1.2); }
  for (let c = 4; c < 12; c++) for (const b of [0, 0.75, 1, 2, 2.75, 3]) caja(p, c * C + b * B, 0.06 + 0.012 * (c - 4), 0.5); // marcha lejana
  for (const [c, n] of [[6, [55, 60, 63]], [8, [55, 60, 63, 67]], [10, [56, 60, 63, 68]]]) // motivo de trompas
    n.forEach((m, j) => metal(p, c * C + j * 0.75 * B, m, 2 * B, 0.35, -0.2, 0.5));
  redobleTimbal(p, 10 * C, 36, 2 * C, 0.1, 0.7);
  platillo(p, 12 * C - 0.05, 0.25, 2.5);
  reverb(p, 0.38, 0.88, 0.3);
  guardar(p, 'tension');
}

// ---------- 2. Marcha heroica: Mi bemol mayor, 108 negras/min, 2/4 ----------
const N = { Eb3: 51, F3: 53, G3: 55, Ab3: 56, Bb3: 58, C4: 60, D4: 62, Eb4: 63, F4: 65, G4: 67, Ab4: 68, Bb4: 70, C5: 72, D5: 74, Eb5: 75, F5: 77, G5: 79, Ab5: 80, Bb5: 82, C6: 84 };
const A = [ // [nota, negras]
  [['Bb4', .75], ['Bb4', .25], ['Eb5', .5], ['Eb5', .5]], [['G5', 1], ['F5', .5], ['Eb5', .5]], [['D5', .75], ['Eb5', .25], ['F5', .5], ['D5', .5]], [['Bb4', 1.5], ['Bb4', .5]],
  [['C5', .75], ['D5', .25], ['Eb5', .5], ['C5', .5]], [['G5', 1], ['F5', .5], ['Eb5', .5]], [['D5', .5], ['F5', .5], ['Eb5', .5], ['D5', .5]], [['Eb5', 1.5], [null, .5]],
];
const Bm = [
  [['G5', .75], ['G5', .25], ['Ab5', .5], ['Bb5', .5]], [['C6', 1], ['Bb5', 1]], [['Ab5', .75], ['G5', .25], ['F5', .5], ['Ab5', .5]], [['G5', 1.5], ['Eb5', .5]],
  [['F5', .75], ['F5', .25], ['G5', .5], ['Ab5', .5]], [['Bb5', 1], ['G5', .5], ['F5', .5]], [['Eb5', .5], ['G5', .5], ['F5', .5], ['D5', .5]], [['Eb5', 2]],
];
const ACORDES = { A: ['Eb', 'Eb', 'Bb', 'Bb', 'Cm', 'Ab', 'Bb7', 'Eb'], B: ['Eb', 'Ab', 'Fm', 'Eb', 'Bb', 'Cm', 'Bb7', 'Eb'] };
const TRIADA = { Eb: [51, 55, 58], Bb: [46, 50, 53], Cm: [48, 51, 55], Ab: [44, 48, 51], Bb7: [46, 50, 56], Fm: [41, 44, 48] };
function marcha() {
  const B = 60 / 108, C = 2 * B, secc = ['A', 'B', 'A', 'B', 'A', 'B'], total = 2 + secc.length * 8 + 3, p = pista(total * C + 4);
  // Floreo de metales (2 compases) + redoble
  [[58, 0], [63, .5], [67, 1], [70, 1.5], [75, 2], [70, 2.75], [75, 3]].forEach(([m, b]) => metal(p, b * B, m, b === 3 ? 1 : 0.45, 0.9, 0.1, 1.2));
  redobleTimbal(p, 0, 39, 2 * C, 0.2, 0.8); platillo(p, 0, 0.35);
  secc.forEach((s, si) => {
    const tutti = si >= 2 && si !== 4;
    (s === 'A' ? A : Bm).forEach((comp, ci) => {
      const t = (2 + si * 8 + ci) * C;
      let b = 0;
      for (const [nom, dur] of comp) {
        if (nom) {
          const m = N[nom];
          metal(p, t + b * B, m, dur * B * 0.92, 0.85, 0.15, 1.1);                 // trompetas
          metal(p, t + b * B, m - 12, dur * B * 0.92, 0.6, -0.25, 0.8);            // trombones a la octava
          if (tutti) cuerdas(p, t + b * B, m, dur * B, 0.35, -0.4, 0.04);          // violines doblan en el tutti
        }
        b += dur;
      }
      const ac = TRIADA[ACORDES[s][ci]];
      timbal(p, t, ac[0] - 12, 0.7, 0.9); metal(p, t, ac[0] - 12, B * 0.8, 0.55, -0.1, 0.5); metal(p, t + B, ac[2] - 12, B * 0.8, 0.5, -0.1, 0.5); // tuba: oom
      for (const off of [0.5, 1.5]) ac.forEach((m) => metal(p, t + off * B, m + 12, B * 0.35, 0.3, -0.5, 0.6)); // trompas: pah
      cuerdas(p, t, ac[1] + 12, C, tutti ? 0.3 : 0.18, 0.45, 0.06);
      for (const sn of [0, 0.75, 1, 1.5, 1.75]) caja(p, t + sn * B, sn === 0 ? 0.6 : 0.4);
      bombo(p, t, 0.7);
      if (ci === 0) platillo(p, t, tutti ? 0.5 : 0.35);
    });
  });
  // Final: acorde largo con redoble y platillo
  const tf = (2 + secc.length * 8) * C;
  [51, 58, 63, 67, 70, 75].forEach((m) => metal(p, tf, m, 3 * C, 0.8, 0, 1)); cuerdas(p, tf, 75, 3 * C, 0.4, 0, 0.05); cuerdas(p, tf, 39, 3 * C, 0.5, 0, 0.05);
  redobleTimbal(p, tf, 39, 2.6 * C, 0.4, 0.9); timbal(p, tf + 3 * C, 39, 1, 2); platillo(p, tf + 3 * C, 0.7, 3.5); bombo(p, tf + 3 * C, 1);
  reverb(p, 0.24, 0.82, 0.25);
  guardar(p, 'marcha');
}

fs.mkdirSync(OUT, { recursive: true });
tension();
marcha();
