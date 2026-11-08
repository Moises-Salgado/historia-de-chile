/* Paseo 3D · Humberstone, c. 1935 (reconstrucción aproximada).
   Fuente: se empaqueta con esbuild (npm run 3d) en site/3d/paseo.js, un IIFE clásico con three.js adentro.
   La escena (site/3d/humberstone.glb) la genera scripts/3d/humberstone.py; trae en sus extras las
   colisiones, los límites, el punto de partida y los textos de los puntos de interés (vienen del vault).
   Movimiento: el estado nunca depende del final de una animación; con html.rm no hay balanceo ni travelling. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { crearVida, uTiempo, vientoEnVertices } from './vida.js';

const $ = (s) => document.querySelector(s);
const raiz = document.documentElement;
const reducido = () => raiz.classList.contains('rm');
const gsap = window.gsap;
if (gsap && window.CustomEase) {
  gsap.registerPlugin(window.CustomEase);
  window.CustomEase.create('salida', '.23,1,.32,1');
  window.CustomEase.create('cajon', '.32,.72,0,1');
  gsap.ticker.lagSmoothing(0);
}
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
const leer = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

// ---------------------------------------------------------------- constantes del paseo
const OJOS = 1.65;          // altura de los ojos (m)
const RADIO = 0.32;         // radio del cuerpo para las colisiones (m)
// Más rápido que una persona real (1,4 m/s): el dueño pidió recorrer la plaza sin que se haga lento.
const VEL = { caminar: 3.0, correr: 7.5, atras: 1.8 };   // m/s
const GIRO = 2.2;           // rad/s
const CERCA = 4;            // distancia para abrir la tarjeta de un punto de interés (m)
const PASO = { caminar: 1.15, correr: 1.7 };             // largo de paso para el sonido y el balanceo
/* global __V_ESCENA__ */
const V = typeof __V_ESCENA__ !== 'undefined' ? __V_ESCENA__ : '0';   // huella del GLB (la pone esbuild)
// Vuelo de llegada (coordenadas de three.js: x = oriente, z = sur): desde unos 30 m de altura, al sureste del mercado,
// se baja sobre sus techos hasta la entrada sur de la plaza, mirando al teatro.
// Cada mundo puede traer su propio vuelo en los datos del GLB (datos.vuelo); estos valores son los de Humberstone.
const AEREA = { pos: new THREE.Vector3(48, 30, 70), mira: new THREE.Vector3(-14, 0, -18) };
let RUTA_VUELO = [new THREE.Vector3(24, 15, 50), new THREE.Vector3(6, 5.5, 31)];
let DURACION_VUELO = 5.6;   // s
// archivo de la escena: lo dice la página (<body data-escena="niebla.glb?v=…">); si no, Humberstone
const ESCENA = (document.body && document.body.dataset.escena) || null;

const ui = {
  portada: $('#portada'), cartel: $('.cartel'), barra: $('.carga'), barraIn: $('.carga span'), estado: $('#estado'),
  entrar: $('#b-entrar'), error: $('#error'), errorT: $('#error-texto'), canvas: $('#escena'),
  hud: document.querySelectorAll('[data-hud]'), ayuda: $('#ayuda'), marcas: $('#marcas'),
  tarjeta: $('#tarjeta'), tNum: $('#t-num'), tTitulo: $('#t-titulo'), tCorto: $('#t-corto'),
  tLargo: $('#t-largo'), tLargoP: $('#t-largo p'), tFuente: $('#t-fuente'), tMas: $('#t-mas'),
  sonido: $('#b-sonido'), liviano: $('#b-liviano'), pantalla: $('#b-pantalla'), info: $('#b-info'),
  dialogo: $('#acerca'), aviso: $('#aviso'), anuncio: $('#anuncio'), joy: $('#joystick'), perilla: $('#joystick .perilla'),
};

function mostrarError(tipo, detalle) {
  const textos = {
    archivo: 'Esta página está abierta como archivo (file://). Por seguridad, el navegador no deja cargar la escena 3D así. Ábrela desde el servidor del sitio: en la carpeta del proyecto, ejecuta «npm start» y entra a http://127.0.0.1:5173/3d/humberstone.html, o usa la versión publicada.',
    webgl: 'Tu navegador o tu equipo no tienen WebGL activado, y el paseo 3D lo necesita. Prueba con otro navegador actualizado o activa la aceleración por hardware en la configuración.',
    carga: 'No se pudo cargar la escena 3D. Revisa tu conexión y vuelve a intentarlo.',
  };
  ui.errorT.textContent = textos[tipo] || textos.carga;
  if (detalle) console.warn('[paseo]', detalle);
  ui.cartel.hidden = true;
  ui.error.hidden = false;
  ui.portada.classList.add('con-error');
  window.__paseo = Object.assign(window.__paseo || {}, { error: tipo });
}

function hayWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (e) { return false; }
}

// ---------------------------------------------------------------- arranque
if (location.protocol === 'file:') mostrarError('archivo');
else if (!hayWebGL()) mostrarError('webgl');
else iniciar().catch((e) => mostrarError('carga', e));

async function iniciar() {
  // ---------- renderizador y escena
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { mostrarError('webgl', e); return; }
  let liviano = leer('paseo-liviano') === '1';
  const ratio = () => Math.min(window.devicePixelRatio || 1, liviano ? 1 : 1.5);
  renderer.setPixelRatio(ratio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !liviano;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;      // la escena es estática: la sombra se dibuja una vez
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 26000);
  camara.rotation.order = 'YXZ';
  // en pantallas verticales se abre el campo vertical para conservar unos 60° de ancho
  const ajustarCamara = () => {
    const a = window.innerWidth / window.innerHeight;
    camara.aspect = a;
    camara.fov = a >= 1 ? 62 : Math.min(80, (2 * Math.atan(Math.tan(Math.PI / 6) / a) * 180) / Math.PI);
    camara.updateProjectionMatrix();
  };
  ajustarCamara();

  // ---------- carga con progreso
  const pintarProgreso = (f) => {
    const p = Math.round(f * 100);
    ui.barraIn.style.transform = `scaleX(${p / 100})`;
    ui.barra.setAttribute('aria-valuenow', String(p));
  };
  const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  try {
    gltf = await gltfLoader.loadAsync(ESCENA || `humberstone.glb?v=${V}`, (e) => {
      if (e.lengthComputable) pintarProgreso(e.loaded / e.total);
      else ui.barra.classList.add('indeterminada');
    });
  } catch (e) { mostrarError('carga', e); return; }
  pintarProgreso(1);
  ui.estado.textContent = 'Preparando la luz de la tarde…';

  const datos = JSON.parse(gltf.scene.userData.paseo || gltf.userData.paseo || '{}');
  escena.add(gltf.scene);
  const amb = datos.ambiente || {};
  if (amb.exposicion) renderer.toneMappingExposure = amb.exposicion;
  if (datos.vuelo) {
    AEREA.pos.set(...datos.vuelo.pos); AEREA.mira.set(...datos.vuelo.mira);
    RUTA_VUELO = datos.vuelo.ruta.map((p) => new THREE.Vector3(...p));
    DURACION_VUELO = datos.vuelo.duracion || DURACION_VUELO;
  }
  // altura del suelo bajo el caminante (grilla en los datos; Humberstone es plano)
  const sg = datos.suelo;
  const alturaSuelo = !sg ? () => 0 : (x, z) => {
    const fi = Math.min(sg.nx - 1.001, Math.max(0, (x - sg.x0) / sg.paso));
    const fj = Math.min(sg.nz - 1.001, Math.max(0, (z - sg.z0) / sg.paso));
    const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j, A = sg.alturas;
    const k = j * sg.nx + i;
    return A[k] * (1 - a) * (1 - b) + A[k + 1] * a * (1 - b) + A[k + sg.nx] * (1 - a) * b + A[k + sg.nx + 1] * a * b;
  };

  // ---------- sol y cielo: una tarde de fines de noviembre (la posición del sol la calcula el script de Blender)
  const solAz = datos.sol ? datos.sol.azimut : -2.68, solEl = datos.sol ? datos.sol.elevacion : 0.244;
  const sol = { dir: new THREE.Vector3(Math.cos(solEl) * Math.cos(solAz), Math.sin(solEl), -Math.cos(solEl) * Math.sin(solAz)).normalize() };
  const cielo = crearCielo(sol.dir, true, amb);
  cielo.scale.setScalar(20000);
  escena.add(cielo);
  // luz ambiente: el mismo cielo (sin el disco del sol) más la pampa iluminada abajo, que rebota luz cálida
  const envEscena = new THREE.Scene();
  const cieloEnv = crearCielo(sol.dir, false, amb);
  cieloEnv.scale.setScalar(60);
  envEscena.add(cieloEnv);
  const pampa = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(...(amb.rebote || [0.5, 0.3, 0.16])) }));
  pampa.rotation.x = -Math.PI / 2; pampa.position.y = -1.5;
  envEscena.add(pampa);
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(envEscena, 0.02).texture;
  pmrem.dispose();
  escena.environmentIntensity = 0.5;
  escena.fog = new THREE.Fog(new THREE.Color().setRGB(...(amb.niebla || [0.93, 0.80, 0.68]), THREE.SRGBColorSpace), amb.niebla_cerca || 380, amb.niebla_lejos || 21000);

  const luz = new THREE.DirectionalLight(new THREE.Color().setRGB(...(amb.color_sol || [1.0, 0.76, 0.52]), THREE.SRGBColorSpace), amb.sol || 4.6);
  luz.castShadow = true;
  const maxTex = renderer.capabilities.maxTextureSize;
  const tamSombra = maxTex >= 4096 ? 4096 : 2048;
  luz.shadow.mapSize.set(tamSombra, tamSombra);
  const sc = luz.shadow.camera;
  const rs = datos.sombra ? datos.sombra.radio : 170;
  sc.left = -rs; sc.right = rs; sc.top = rs; sc.bottom = -rs; sc.near = 10; sc.far = 1100;
  luz.shadow.bias = -0.0004;
  luz.shadow.normalBias = 0.06;
  luz.shadow.radius = 2.2;
  const centroSombra = datos.sombra ? new THREE.Vector3(datos.sombra.centro[0], 20, datos.sombra.centro[1]) : new THREE.Vector3(15, 0, 10);
  luz.target.position.copy(centroSombra);
  luz.position.copy(centroSombra).addScaledVector(sol.dir, 500);
  escena.add(luz, luz.target);
  const colorSol = luz.color.clone();

  // ---------- materiales: hojas recortadas y translúcidas; polvo y manchas en la base de los muros
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const solVista = { value: new THREE.Vector3() };
  const sinAO = [cielo];        // lo que no entra al cálculo de oclusión (cielo y tarjetas de hojas)
  const POLVO = { estuco_blanco: 0.62, estuco_crema: 0.6, estuco_ocre: 0.55, madera_teatro: 0.45, madera_blanca: 0.5, madera_oscura: 0.3,
    madera_roja: 0.35, pintura_verde: 0.4, ladrillo: 0.3, concreto: 0.35, madera_cruda: 0.3 };
  const tratados = new Set();
  const INTERIOR = { int_escenario: 0.5, int_crema: 0.26, int_aguamarina: 0.26, int_tablero: 0.24, int_alfombra: 0.2, int_piso: 0.16,
    int_butaca: 0.14, int_galeria: 0.16, int_verde: 0.22, int_blanco: 0.2, int_vestibulo: 0.1 };
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const s = o.userData.sombra;
    o.castShadow = s === 'ambas';
    o.receiveShadow = s !== 'no';
    o.matrixAutoUpdate = false;
    o.updateMatrix();
    const m = o.material;
    for (const k of ['map', 'normalMap']) if (m[k]) m[k].anisotropy = aniso;
    if (o.name === 'vidrio') { m.roughness = 0.06; m.envMapIntensity = 1.5; }
    if (o.name.startsWith('int_') && o.name !== 'int_ventana' && !tratados.has(m)) {
      // el interior del teatro no recibe sol: una luz propia, pareja, como la de las lámparas de la sala en las fotos
      tratados.add(m);
      const k = INTERIOR[o.name] ?? 0.3;
      m.emissive.copy(m.color);                 // color × textura, como el color base
      if (m.map) m.emissiveMap = m.map;
      m.emissiveIntensity = k;
      m.envMapIntensity = 0.35;           // el cielo casi no llega hasta adentro
    }
    if (o.name === 'hojas') {
      sinAO.push(o);
      prepararHojas(m, solVista, colorSol);
    } else if (POLVO[o.name] !== undefined && !tratados.has(m)) {
      tratados.add(m);
      prepararPolvo(m, POLVO[o.name]);
    }
  });
  gltf.scene.updateMatrixWorld(true);

  // ---------- imagen final: oclusión ambiental (GTAO), un resplandor leve, tono fílmico y viñeta.
  // En modo liviano se dibuja directo, sin esta cadena.
  const objetivo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const compositor = new EffectComposer(renderer, objetivo);
  compositor.addPass(new RenderPass(escena, camara));
  const ao = new GTAOPass(escena, camara, 1, 1);
  ao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.6, thickness: 1.4, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
  ao.blendIntensity = 0.95;
  const ocultarBase = ao._overrideVisibility.bind(ao);
  ao._overrideVisibility = function () {
    ocultarBase();
    for (const o of sinAO) if (o.visible) { o.visible = false; this._visibilityCache.push(o); }
  };
  compositor.addPass(ao);
  compositor.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), amb.bloom ?? 0.12, 0.5, amb.umbral_bloom ?? 1.8));
  compositor.addPass(new OutputPass());
  const viñeta = new ShaderPass(VIÑETA);
  compositor.addPass(viñeta);
  const ajustarCompositor = () => {
    compositor.setPixelRatio(ratio());
    compositor.setSize(window.innerWidth, window.innerHeight);
    viñeta.uniforms.res.value.set(window.innerWidth, window.innerHeight);
  };
  ajustarCompositor();
  const dibujar = () => {
    camara.updateMatrixWorld();
    solVista.value.copy(sol.dir).transformDirection(camara.matrixWorldInverse);
    if (liviano) renderer.render(escena, camara);
    else { viñeta.uniforms.semilla.value = Math.random(); compositor.render(); }
  };

  // ---------- datos del paseo
  const cols = (datos.colisiones || []).map((c) => ({ x0: c[0], z0: c[1], x1: c[2], z1: c[3] }));
  const muros = cols.filter((c) => c.x1 - c.x0 > 1.2 && c.z1 - c.z0 > 1.2);    // los que tapan la vista
  // zonas donde se puede caminar (la plaza y, desde la versión 3, el vestíbulo y la sala del teatro)
  const lims = (Array.isArray(datos.limites) && Array.isArray(datos.limites[0]) ? datos.limites : [datos.limites || [-50, -50, 50, 50]])
    .map((l) => ({ x0: l[0], z0: l[1], x1: l[2], z1: l[3] }));
  const interiores = lims.slice(1);          // zonas techadas (el teatro): ahí se ajusta la exposición
  let expoBase = renderer.toneMappingExposure;
  const enPol = (P, x, z) => {
    let d = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, zi] = P[i], [xj, zj] = P[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi) d = !d;
    }
    return d;
  };
  const zonas = datos.zonas || [];
  const enZona = (x, z) => zonas.some((zn) => enPol(zn.dentro, x, z) && !(zn.fuera || []).some((f) => enPol(f, x, z)));
  const dentroDe = (x, z) => lims.some((l) => x > l.x0 + RADIO && x < l.x1 - RADIO && z > l.z0 + RADIO && z < l.z1 - RADIO) ||
    (zonas.length > 0 && [[0, 0], [RADIO, 0], [-RADIO, 0], [0, RADIO], [0, -RADIO]].every(([a, b]) => enZona(x + a, z + b)));
  const pois = (datos.pois || []).map((p, i) => ({ ...p, n: i + 1, s: new THREE.Vector2(p.suelo[0], p.suelo[1]), m: new THREE.Vector3(...p.marca) }));
  const ini = datos.inicio || { x: 0, z: 0, yaw: 0 };

  // ---------- estado del jugador
  const pos = new THREE.Vector2(ini.x, ini.z);
  let yaw = ini.yaw, pitch = -0.02, vel = 0, giro = 0, fase = 0, recorrido = 0;
  // la cámara: 'portada' (vista aérea), 'vuelo' (bajada) o 'ojos' (caminando)
  const vuelo = { modo: 'portada', t: 0, curva: null, mira0: AEREA.mira.clone(), tween: null };
  let dentro = false, sucio = true;

  function colisiona(x, z) {
    for (const c of cols) if (x > c.x0 - RADIO && x < c.x1 + RADIO && z > c.z0 - RADIO && z < c.z1 + RADIO) return c;
    return null;
  }
  let avisoLimite = 0;
  function mover(dx, dz) {
    let nx = pos.x + dx, nz = pos.y, fuera = false;
    let c = colisiona(nx, nz);
    if (c) nx = dx > 0 ? c.x0 - RADIO - 1e-4 : c.x1 + RADIO + 1e-4;
    if (!dentroDe(nx, nz)) { nx = pos.x; fuera = true; }
    nz = pos.y + dz;
    c = colisiona(nx, nz);
    if (c) nz = dz > 0 ? c.z0 - RADIO - 1e-4 : c.z1 + RADIO + 1e-4;
    if (!dentroDe(nx, nz)) { nz = pos.y; fuera = true; }
    if (fuera && performance.now() - avisoLimite > 6000) {
      avisoLimite = performance.now();
      avisar('Hasta aquí llega la reconstrucción.');
    }
    if (colisiona(nx, nz)) return;           // nunca quedar dentro de una pared
    pos.set(nx, nz);
  }

  // ---------- entrada: teclado, arrastre y joystick
  const teclas = new Set();
  const joy = { x: 0, y: 0 };
  const dialogoAbierto = () => ui.dialogo.open;
  const CODIGOS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'];
  window.addEventListener('keydown', (e) => {
    if (dialogoAbierto() || e.altKey || e.ctrlKey || e.metaKey) return;
    if (CODIGOS.includes(e.code)) {
      if (!dentro) return;
      if (vuelo.modo === 'vuelo') terminarVuelo();
      teclas.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    } else if (e.key === 'Enter' && poiActivo && !e.target.closest('button, a, dialog')) {
      e.preventDefault(); expandir(!expandida);
    } else if (e.key === 'Escape' && expandida) {
      expandir(false);
    } else if ((e.key === 'Escape' || e.key === ' ') && vuelo.modo === 'vuelo') {
      e.preventDefault(); terminarVuelo();
    }
  });
  window.addEventListener('keyup', (e) => teclas.delete(e.code));
  // el anillo de foco del lienzo solo se muestra a quien navega con Tab
  window.addEventListener('keydown', (e) => { if (e.key === 'Tab') raiz.classList.add('teclado'); }, true);
  window.addEventListener('pointerdown', () => raiz.classList.remove('teclado'), true);
  window.addEventListener('blur', () => { teclas.clear(); joy.x = joy.y = 0; });

  const arrastre = { id: null, x: 0, y: 0 };
  ui.canvas.addEventListener('pointerdown', (e) => {
    if (vuelo.modo === 'vuelo') terminarVuelo();
    if (!dentro || arrastre.id !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    arrastre.id = e.pointerId; arrastre.x = e.clientX; arrastre.y = e.clientY;
    ui.canvas.setPointerCapture(e.pointerId);
    ui.canvas.classList.add('arrastrando');
  });
  ui.canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== arrastre.id) return;
    const k = e.pointerType === 'touch' ? 0.0048 : 0.0032;
    yaw -= (e.clientX - arrastre.x) * k;
    pitch = Math.max(-1.15, Math.min(1.15, pitch - (e.clientY - arrastre.y) * k));
    arrastre.x = e.clientX; arrastre.y = e.clientY;
    sucio = true;
  });
  const soltar = (e) => { if (e.pointerId === arrastre.id) { arrastre.id = null; ui.canvas.classList.remove('arrastrando'); } };
  ui.canvas.addEventListener('pointerup', soltar);
  ui.canvas.addEventListener('pointercancel', soltar);

  const joyEstado = { id: null, cx: 0, cy: 0, r: 48 };
  ui.joy.addEventListener('pointerdown', (e) => {
    if (vuelo.modo === 'vuelo') terminarVuelo();
    if (joyEstado.id !== null) return;
    const b = ui.joy.getBoundingClientRect();
    joyEstado.id = e.pointerId; joyEstado.cx = b.left + b.width / 2; joyEstado.cy = b.top + b.height / 2; joyEstado.r = b.width * 0.4;
    ui.joy.setPointerCapture(e.pointerId);
    moverJoy(e);
  });
  function moverJoy(e) {
    if (e.pointerId !== joyEstado.id) return;
    let dx = e.clientX - joyEstado.cx, dy = e.clientY - joyEstado.cy;
    const d = Math.hypot(dx, dy), r = joyEstado.r;
    if (d > r) { dx *= r / d; dy *= r / d; }
    ui.perilla.style.transform = `translate(${dx}px, ${dy}px)`;
    const zona = (v) => (Math.abs(v) < 0.14 ? 0 : v);
    joy.x = zona(dx / r); joy.y = zona(-dy / r);
  }
  ui.joy.addEventListener('pointermove', moverJoy);
  const soltarJoy = (e) => {
    if (e.pointerId !== joyEstado.id) return;
    joyEstado.id = null; joy.x = joy.y = 0; ui.perilla.style.transform = '';
  };
  ui.joy.addEventListener('pointerup', soltarJoy);
  ui.joy.addEventListener('pointercancel', soltarJoy);
  window.addEventListener('touchstart', () => raiz.classList.add('tactil'), { once: true, passive: true });

  // ---------- sonido sintetizado (WebAudio): viento de la pampa y pasos sobre tierra
  const audio = crearAudio(datos.sonido || 'pampa');
  let sonidoOn = leer('paseo-sonido') !== '0';
  const pintarSonido = () => {
    ui.sonido.setAttribute('aria-pressed', String(sonidoOn));
    ui.sonido.querySelector('.etq').textContent = sonidoOn ? 'Sonido' : 'Sin sonido';
    ui.sonido.classList.toggle('apagado', !sonidoOn);
  };
  pintarSonido();
  ui.sonido.addEventListener('click', () => {
    sonidoOn = !sonidoOn; guardar('paseo-sonido', sonidoOn ? '1' : '0'); pintarSonido();
    if (sonidoOn) audio.encender(); else audio.apagar();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pausar(); else if (sonidoOn && dentro) audio.reanudar();
  });

  // ---------- modo liviano (sin sombras, pixelRatio 1) y pantalla completa
  const pintarLiviano = () => {
    ui.liviano.setAttribute('aria-pressed', String(liviano));
    raiz.classList.toggle('liviano', liviano);
  };
  function ponerLiviano(v) {
    liviano = v; guardar('paseo-liviano', v ? '1' : '0'); pintarLiviano();
    renderer.setPixelRatio(ratio());
    ajustarCompositor();
    renderer.shadowMap.enabled = !v;
    renderer.shadowMap.needsUpdate = true;
    escena.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    sucio = true;
  }
  pintarLiviano();
  ui.liviano.addEventListener('click', () => ponerLiviano(!liviano));
  if (!document.fullscreenEnabled) ui.pantalla.hidden = true;
  ui.pantalla.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else raiz.requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => {
    const fs = !!document.fullscreenElement;
    ui.pantalla.setAttribute('aria-pressed', String(fs));
    ui.pantalla.querySelector('.etq').textContent = fs ? 'Salir de pantalla completa' : 'Pantalla completa';
  });
  ui.info.addEventListener('click', () => { teclas.clear(); ui.dialogo.showModal(); });
  ui.dialogo.addEventListener('click', (e) => { if (e.target === ui.dialogo) ui.dialogo.close(); });
  ui.dialogo.querySelector('.cerrar').addEventListener('click', () => ui.dialogo.close());

  // ---------- aviso breve
  let tAviso = 0;
  function avisar(texto) {
    ui.aviso.textContent = texto;
    ui.aviso.classList.add('visible');
    clearTimeout(tAviso);
    tAviso = setTimeout(() => ui.aviso.classList.remove('visible'), 3200);
  }

  // ---------- marcadores y tarjeta de los puntos de interés
  const marcas = pois.map((p) => {
    const el = document.createElement('div');
    el.className = 'poi-marca';
    el.innerHTML = `<span class="poi-punto">${p.n}</span><span class="poi-nombre">${p.titulo}</span>`;
    ui.marcas.appendChild(el);
    return el;
  });
  let poiActivo = null, expandida = false;
  function abrirPoi(p) {
    poiActivo = p; expandida = false;
    ui.tNum.textContent = `${p.n} de ${pois.length}`;
    ui.tTitulo.textContent = p.titulo;
    ui.tCorto.textContent = p.corto || '';
    ui.tLargoP.textContent = p.largo || '';
    ui.tFuente.textContent = p.fuente ? `Fuentes: ${p.fuente}.` : '';
    ui.tLargo.hidden = true;
    ui.tMas.setAttribute('aria-expanded', 'false');
    ui.tMas.querySelector('.etq').textContent = 'Leer más';
    ui.tarjeta.hidden = false;
    ui.tarjeta.classList.add('visible');
    ui.anuncio.textContent = `Cerca: ${p.titulo}. Pulsa Enter para leer más.`;
    if (gsap) {
      gsap.killTweensOf(ui.tarjeta);
      if (reducido()) gsap.fromTo(ui.tarjeta, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: 'none' });
      else gsap.fromTo(ui.tarjeta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.26, ease: 'salida' });
    }
  }
  function cerrarPoi() {
    poiActivo = null; expandida = false;
    ui.tarjeta.classList.remove('visible');
    const fin = () => { if (!poiActivo) ui.tarjeta.hidden = true; };
    if (gsap) {
      gsap.killTweensOf(ui.tarjeta);
      gsap.to(ui.tarjeta, { opacity: 0, y: reducido() ? 0 : 8, duration: 0.16, ease: 'salida', onComplete: fin });
      setTimeout(fin, 400);            // respaldo: el estado no depende del final de la animación
    } else fin();
  }
  function expandir(v) {
    if (!poiActivo) return;
    expandida = v;
    ui.tLargo.hidden = !v;
    ui.tMas.setAttribute('aria-expanded', String(v));
    ui.tMas.querySelector('.etq').textContent = v ? 'Leer menos' : 'Leer más';
    if (v && gsap && !reducido()) gsap.fromTo(ui.tLargo, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.24, ease: 'salida' });
  }
  ui.tMas.addEventListener('click', () => expandir(!expandida));

  const tapa = (ax, az, bx, bz) => {      // ¿algún edificio corta la línea de vista en planta?
    for (const c of muros) {
      let t0 = 0, t1 = 1;
      const dx = bx - ax, dz = bz - az;
      const ejes = [[dx, ax, c.x0, c.x1], [dz, az, c.z0, c.z1]];
      let corta = true;
      for (const [d, a, mn, mx] of ejes) {
        if (Math.abs(d) < 1e-9) { if (a < mn || a > mx) { corta = false; break; } continue; }
        let ta = (mn - a) / d, tb = (mx - a) / d;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { corta = false; break; }
      }
      if (corta) return true;
    }
    return false;
  };
  const v3 = new THREE.Vector3();
  function actualizarMarcas() {
    const W = window.innerWidth, H = window.innerHeight;
    pois.forEach((p, i) => {
      const el = marcas[i];
      const d = Math.hypot(p.s.x - pos.x, p.s.y - pos.y);
      v3.copy(p.m).project(camara);
      const delante = v3.z < 1 && Math.abs(v3.x) < 1.2 && Math.abs(v3.y) < 1.2;
      const visible = dentro && vuelo.modo === 'ojos' && delante && d < 70 && d > 2.2 && !tapa(pos.x, pos.y, p.s.x, p.s.y);
      el.classList.toggle('visible', visible);
      el.classList.toggle('cerca', d < 26);
      if (visible) el.style.transform = `translate3d(${((v3.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v3.y * 0.5 + 0.5) * H).toFixed(1)}px, 0)`;
    });
  }
  function revisarPois() {
    let mejor = null, dm = Infinity;
    for (const p of pois) { const d = Math.hypot(p.s.x - pos.x, p.s.y - pos.y); if (d < dm) { dm = d; mejor = p; } }
    if (poiActivo && Math.hypot(poiActivo.s.x - pos.x, poiActivo.s.y - pos.y) > CERCA + 1.2) cerrarPoi();
    if (!poiActivo && mejor && dm < CERCA && dentro) abrirPoi(mejor);
  }

  // ---------- cámara
  let ySuelo = alturaSuelo(ini.x, ini.z);
  const ojos = () => new THREE.Vector3(pos.x, alturaSuelo(pos.x, pos.y) + OJOS, pos.y);
  const miraOjos = () => ojos().add(new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(20));
  const aereaAhora = (t) => {            // en la portada, la vista aérea deriva muy lento (sin movimiento con html.rm)
    const a = reducido() || liviano ? 0 : Math.sin(t * 0.00005) * 0.06;
    const d = AEREA.pos.clone().sub(AEREA.mira);
    return AEREA.mira.clone().add(d.applyAxisAngle(new THREE.Vector3(0, 1, 0), a));
  };
  const curvaMira = new THREE.Vector3();
  // En pantallas verticales el cartel ocupa la mitad de abajo: la vista aérea se corre hacia arriba (desplazamiento
  // del encuadre, no de la cámara) y el vuelo lo devuelve al centro.
  let desplazado = 0;
  function desplazar(f) {
    const v = camara.aspect < 1 ? f : 0;
    if (Math.abs(v - desplazado) < 1e-4) return;
    desplazado = v;
    const W = window.innerWidth, H = window.innerHeight;
    if (v > 0) camara.setViewOffset(W, H, 0, H * v, W, H); else camara.clearViewOffset();
  }
  function colocarCamara(ahora) {
    if (vuelo.modo === 'portada') {
      desplazar(0.24);
      camara.position.copy(aereaAhora(ahora));
      camara.lookAt(AEREA.mira);
      return;
    }
    if (vuelo.modo === 'vuelo') {
      const t = vuelo.t;
      camara.position.copy(vuelo.curva.getPointAt(t));
      const k = t * t * (3 - 2 * t);
      desplazar(0.24 * (1 - Math.min(1, k * 1.6)));
      curvaMira.lerpVectors(vuelo.mira0, miraOjos(), Math.min(1, k * 1.15));
      camara.lookAt(curvaMira);
      return;
    }
    desplazar(0);
    const bob = reducido() ? 0 : Math.sin(fase * 2) * 0.028 * Math.min(1, Math.abs(vel) / VEL.caminar);
    const roll = reducido() ? 0 : Math.sin(fase) * 0.0035 * Math.min(1, Math.abs(vel) / VEL.caminar);
    const hs = alturaSuelo(pos.x, pos.y);                      // sube y baja con el terreno, sin saltos;
    ySuelo = Math.abs(hs - ySuelo) > 2.5 ? hs : ySuelo + (hs - ySuelo) * 0.35;   // tras un teletransporte, directo
    camara.position.set(pos.x, ySuelo + OJOS + bob, pos.y);
    camara.rotation.set(pitch, yaw, roll);
  }
  function terminarVuelo() {
    if (vuelo.tween) vuelo.tween.kill();
    vuelo.tween = null;
    vuelo.t = 1;
    vuelo.modo = 'ojos';
    sucio = true;
  }

  // ---------- ciclo
  let tPrev = performance.now();
  let fpsMedia = 60, ultimoPaso = 0, tEntrada = 0, livianoAuto = false, ayudaVisible = true;
  const vida = crearVida(escena, datos, alturaSuelo);
  let proxGraznido = 4, proxLadrido = 9, proxPajaro = 6;
  const panDe = (x, z) => {                 // -1 izquierda … 1 derecha, según hacia dónde se mira
    const a = Math.atan2(x - pos.x, -(z - pos.y)) + yaw;
    return Math.max(-1, Math.min(1, Math.sin(a)));
  };
  function cuadro() {
    const ahora = performance.now();
    const dt = Math.min(0.05, (ahora - tPrev) / 1000);
    tPrev = ahora;
    const tt = ahora / 1000;
    uTiempo.value = tt;
    if (vida.activa && !document.hidden) { vida.actualizar(tt, dt); if (!ui.portada.hidden || dentro) sucio = true; }
    if (dentro && sonidoOn) {
      const cam = camara.position;
      if (tt > proxGraznido) {
        const g = vida.gaviota(cam);
        if (g) audio.graznido(panDe(g.x, g.z), Math.max(0.15, 1 - g.d / 260));
        proxGraznido = tt + 3 + Math.random() * 7;
      }
      if (tt > proxLadrido) {
        const l = vida.lobo(cam);
        if (l && l.d < 220) audio.ladrido(panDe(l.x, l.z), Math.max(0.1, 1 - l.d / 220));
        proxLadrido = tt + 6 + Math.random() * 12;
      }
      if (datos.sonido !== 'mar' && tt > proxPajaro) { audio.pajaro(Math.random() * 2 - 1); proxPajaro = tt + 9 + Math.random() * 16; }
    }
    if (dentro && vuelo.modo === 'ojos') {
      const f = (teclas.has('ArrowUp') || teclas.has('KeyW') ? 1 : 0) - (teclas.has('ArrowDown') || teclas.has('KeyS') ? 1 : 0) + joy.y;
      const g = (teclas.has('ArrowLeft') || teclas.has('KeyA') ? 1 : 0) - (teclas.has('ArrowRight') || teclas.has('KeyD') ? 1 : 0) - joy.x;
      const corre = teclas.has('ShiftLeft') || teclas.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.92;
      const fc = Math.max(-1, Math.min(1, f)), gc = Math.max(-1, Math.min(1, g));
      const meta = fc > 0 ? fc * (corre ? VEL.correr : VEL.caminar) : fc * VEL.atras;
      const tau = Math.abs(meta) > Math.abs(vel) ? 0.28 : 0.18;          // acelera suave, frena un poco más rápido
      vel += (meta - vel) * (1 - Math.exp(-dt / tau));
      if (Math.abs(vel) < 0.005 && meta === 0) vel = 0;
      giro += (gc * GIRO - giro) * (1 - Math.exp(-dt / 0.12));
      if (Math.abs(giro) < 0.002 && gc === 0) giro = 0;
      yaw += giro * dt;
      if (vel !== 0) {
        const antes = pos.clone();
        mover(-Math.sin(yaw) * vel * dt, -Math.cos(yaw) * vel * dt);
        const d = pos.distanceTo(antes);
        recorrido += d;
        const largo = Math.abs(vel) > VEL.caminar * 1.4 ? PASO.correr : PASO.caminar;
        const faseAntes = fase;
        fase += (d / largo) * Math.PI;
        if (Math.floor(faseAntes / Math.PI) !== Math.floor(fase / Math.PI) && d > 0) {
          if (sonidoOn) audio.paso(Math.min(1, Math.abs(vel) / VEL.correr));
          ultimoPaso = performance.now();
        }
      }
      if (vel !== 0 || giro !== 0) sucio = true;
      // dentro del teatro la vista se acostumbra a la penumbra: la exposición sube de a poco (y baja al salir)
      const enSala = interiores.some((l) => pos.x > l.x0 && pos.x < l.x1 && pos.y > l.z0 && pos.y < l.z1);
      const metaExpo = expoBase * (enSala ? 1.5 : 1);
      if (Math.abs(renderer.toneMappingExposure - metaExpo) > 0.002) {
        renderer.toneMappingExposure += (metaExpo - renderer.toneMappingExposure) * (1 - Math.exp(-dt / 0.6));
        sucio = true;
      }
      if (ayudaVisible && (recorrido > 12 || performance.now() - tEntrada > 14000)) ocultarAyuda();
    }
    if (vuelo.modo === 'vuelo' || (vuelo.modo === 'portada' && !reducido() && !liviano && !ui.portada.hidden)) sucio = true;
    if (sucio) {
      colocarCamara(ahora);
      dibujar();
      actualizarMarcas();
      revisarPois();
      sucio = false;
      fpsMedia += ((1 / Math.max(dt, 1e-3)) - fpsMedia) * 0.05;
      if (dentro && !liviano && !livianoAuto && !navigator.webdriver) {
        const t = performance.now() - tEntrada;
        if (t > 3000 && t < 9000 && fpsMedia < 30) { livianoAuto = true; ponerLiviano(true); avisar('Activé el modo liviano (sin sombras) para que el paseo vaya más fluido.'); }
      }
    }
    requestAnimationFrame(cuadro);
  }

  window.addEventListener('resize', () => {
    desplazado = -1;            // fuerza a recalcular el encuadre con el tamaño nuevo
    ajustarCamara();
    renderer.setSize(window.innerWidth, window.innerHeight);
    ajustarCompositor();
    sucio = true;
  });

  // ---------- interfaz de entrada
  function ocultarAyuda() {
    ayudaVisible = false;
    if (gsap) gsap.to(ui.ayuda, { opacity: 0, duration: reducido() ? 0.2 : 0.6, ease: 'salida', onComplete: () => { ui.ayuda.hidden = true; } });
    setTimeout(() => { ui.ayuda.hidden = true; }, 900);
  }
  function entrar() {
    if (dentro) return;
    dentro = true;
    tEntrada = performance.now();
    if (sonidoOn) audio.encender();
    ui.portada.classList.add('saliendo');
    ui.canvas.focus({ preventScroll: true });
    const hud = [...ui.hud];
    hud.forEach((el) => { el.hidden = false; });
    ui.ayuda.hidden = false;
    if (gsap && !reducido()) {
      // vuelo de llegada: curva suave desde la vista aérea hasta los ojos; cualquier tecla, clic o toque lo salta
      const desde = camara.position.clone();
      vuelo.curva = new THREE.CatmullRomCurve3([desde, ...RUTA_VUELO, ojos()], false, 'centripetal');
      vuelo.mira0.copy(AEREA.mira);
      vuelo.modo = 'vuelo'; vuelo.t = 0;
      vuelo.tween = gsap.to(vuelo, { t: 1, duration: DURACION_VUELO, ease: 'power2.inOut', onComplete: terminarVuelo });
      const tl = gsap.timeline({ defaults: { ease: 'salida' } });
      tl.to(ui.cartel, { opacity: 0, y: -16, duration: 0.45 }, 0)
        .to(ui.portada, { opacity: 0, duration: 0.9 }, 0.15)
        .fromTo(hud, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, stagger: 0.04 }, 1.2)
        .fromTo(ui.ayuda, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28 }, DURACION_VUELO - 0.6);
      tEntrada += DURACION_VUELO * 1000;      // la ayuda cuenta desde que se llega al suelo
    } else {
      vuelo.modo = 'ojos';
      if (gsap) {
        gsap.to(ui.portada, { opacity: 0, duration: 0.2, ease: 'none' });
        gsap.fromTo([...hud, ui.ayuda], { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' });
      }
    }
    sucio = true;
    setTimeout(() => { ui.portada.hidden = true; sucio = true; }, 1400);   // respaldo
    setTimeout(() => { if (vuelo.modo === 'vuelo') terminarVuelo(); }, DURACION_VUELO * 1000 + 1500);
  }

  ui.entrar.addEventListener('click', entrar);
  ui.estado.textContent = 'Listo.';
  ui.barra.classList.remove('indeterminada');
  ui.portada.classList.add('lista');
  ui.entrar.disabled = false;
  ui.entrar.focus({ preventScroll: true });
  renderer.shadowMap.needsUpdate = true;
  colocarCamara(performance.now());
  cuadro();

  // API para pruebas (Playwright): posición de la cámara y teletransporte.
  window.__paseo = {
    listo: true,
    get dentro() { return dentro; },
    get fps() { return Math.round(fpsMedia); },
    estado: () => ({ x: +pos.x.toFixed(3), y: +camara.position.y.toFixed(3), z: +pos.y.toFixed(3), yaw: +yaw.toFixed(4), pitch: +pitch.toFixed(4), velocidad: +vel.toFixed(3), poi: poiActivo ? poiActivo.id : null }),
    colocar(x, z, nuevoYaw) { terminarVuelo(); pos.set(x, z); ySuelo = alturaSuelo(x, z); if (typeof nuevoYaw === 'number') yaw = nuevoYaw; vel = 0; giro = 0; sucio = true; },
    entrar,
    get camara() { return { modo: vuelo.modo, t: +vuelo.t.toFixed(3), x: +camara.position.x.toFixed(2), y: +camara.position.y.toFixed(2), z: +camara.position.z.toFixed(2) }; },
    saltarVuelo: terminarVuelo,
    vueloEn(t) { if (vuelo.curva) { if (vuelo.tween) vuelo.tween.pause(); vuelo.modo = 'vuelo'; vuelo.t = t; sucio = true; } },
    // calibración de la luz (solo para desarrollo): __paseo.ajustar({ sol: 4, amb: 0.4, expo: 1, cielo: 0.6, elev: 10 })
    ajustar(o) {
      if (o.aerea) { AEREA.pos.set(...o.aerea[0]); AEREA.mira.set(...o.aerea[1]); vuelo.modo = 'portada'; }
      if (o.sol !== undefined) luz.intensity = o.sol;
      if (o.colorSol) { luz.color.setRGB(...o.colorSol, THREE.SRGBColorSpace); colorSol.copy(luz.color); }
      if (o.amb !== undefined) escena.environmentIntensity = o.amb;
      if (o.expo !== undefined) { renderer.toneMappingExposure = o.expo; expoBase = o.expo; }
      if (o.cielo !== undefined) cielo.material.uniforms.brillo.value = o.cielo;
      if (o.niebla) { escena.fog.color.setRGB(...o.niebla, THREE.SRGBColorSpace); }
      if (o.nieblaCerca !== undefined) escena.fog.near = o.nieblaCerca;
      if (o.ao !== undefined) ao.blendIntensity = o.ao;
      if (o.cieloU) for (const [k, v] of Object.entries(o.cieloU)) cielo.material.uniforms[k].value = v;
      if (o.elev !== undefined || o.envCielo !== undefined || o.pampa) {
        const el = o.elev !== undefined ? (o.elev * Math.PI) / 180 : Math.asin(sol.dir.y);
        const az = Math.atan2(-sol.dir.z, sol.dir.x);
        sol.dir.set(Math.cos(el) * Math.cos(az), Math.sin(el), -Math.cos(el) * Math.sin(az)).normalize();
        cielo.material.uniforms.sunPosition.value.copy(sol.dir);
        cieloEnv.material.uniforms.sunPosition.value.copy(sol.dir);
        if (o.envCielo !== undefined) cieloEnv.material.uniforms.brillo.value = o.envCielo;
        if (o.pampa) pampa.material.color.setRGB(...o.pampa);
        const pm = new THREE.PMREMGenerator(renderer);
        escena.environment = pm.fromScene(envEscena, 0.02).texture; pm.dispose();
        luz.position.copy(centroSombra).addScaledVector(sol.dir, 500);
        renderer.shadowMap.needsUpdate = true;
      }
      sucio = true;
    },
    colisiones: cols.length,
    limites: lims,
    pois: pois.map((p) => ({ id: p.id, suelo: [p.s.x, p.s.y] })),
    sol: sol.dir.toArray().map((v) => +v.toFixed(3)),
    mirar(nuevoPitch) { pitch = nuevoPitch; sucio = true; },
    // diagnóstico: ¿se puede estar en (x, z)? ¿qué colisión hay? ¿a qué altura está el suelo?
    prueba(x, z) { const c = colisiona(x, z); return { zona: dentroDe(x, z), colision: c ? [c.x0, c.z0, c.x1, c.z1] : null, suelo: +alturaSuelo(x, z).toFixed(2) }; },
  };
}

// ---------------------------------------------------------------- cielo, hojas, polvo y viñeta
// Cielo analítico (modelo de Preetham, Sky de three.js) con el sol de la escena. Aire seco y limpio del desierto:
// turbidez baja; unas pocas nubes altas para que la tarde tenga dónde encenderse.
function crearCielo(dirSol, conSol, amb = {}) {
  const cielo = new Sky();
  const u = cielo.material.uniforms;
  // para la luz ambiente, un cielo algo más blanco: así las sombras no quedan tan azules
  u.turbidity.value = (conSol ? 2.6 : 3.4) * ((amb.turbidez || 2.6) / 2.6);
  u.rayleigh.value = (conSol ? 1.9 : 1.2) * ((amb.rayleigh || 1.9) / 1.9);
  u.mieCoefficient.value = amb.mie || 0.0032;
  u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(dirSol);
  u.showSunDisc.value = conSol ? 1 : 0;
  u.cloudCoverage.value = (conSol ? 0.16 : 0.1) * ((amb.nubes || 0.16) / 0.16);
  u.cloudDensity.value = 0.32;
  u.cloudElevation.value = 0.72;
  u.cloudScale.value = 0.00016;
  u.time.value = 0;
  u.brillo = { value: conSol ? 0.55 : 0.38 };
  cielo.material.fragmentShader = 'uniform float brillo;\n' +
    cielo.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * brillo, 1.0 );');
  return cielo;
}

// Ruido de valor 2D (GLSL), compartido por las hojas y el polvo.
const RUIDO_GLSL = /* glsl */`
float hashP(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ruidoP(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hashP(i), hashP(i + vec2(1.0, 0.0)), u.x), mix(hashP(i + vec2(0.0, 1.0)), hashP(i + 1.0), u.x), u.y);
}`;

// Hojas: recorte con alfa (con MSAA, borde suave), las dos caras con la normal «de copa» que trae el GLB
// (sin invertirla en la cara de atrás) y un poco de luz que atraviesa las hojas a contraluz.
function prepararHojas(m, solVista, colorSol) {
  m.transparent = false;
  m.depthWrite = true;
  m.alphaTest = 0.45;
  m.side = THREE.DoubleSide;
  m.shadowSide = THREE.DoubleSide;
  m.onBeforeCompile = (sh) => {
    vientoEnVertices(sh, 0.05, 0.0);
    sh.uniforms.uSolVista = solVista;
    sh.uniforms.uColorSol = { value: colorSol };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSolVista;\nuniform vec3 uColorSol;\n')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifndef FLAT_SHADED\nnormal = normalize( vNormal );\n#endif')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float trasluz = pow( max( dot( normalize( -vViewPosition ), uSolVista ), 0.0 ), 5.0 );
        totalEmissiveRadiance += diffuseColor.rgb * uColorSol * trasluz * 0.5;`);
  };
  m.customProgramCacheKey = () => 'hojas-v2';
  m.needsUpdate = true;
}

// Muros: polvo de la pampa en la base (más alto donde el ruido sube) y manchas suaves que rompen el color plano.
function prepararPolvo(m, cantidad) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPolvo = { value: cantidad };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;\n')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPosMundo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;\nuniform float uPolvo;\n' + RUIDO_GLSL + '\n')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float nP = ruidoP( vPosMundo.xz * 0.7 + vPosMundo.y * 0.2 );
        float polvo = ( 1.0 - smoothstep( 0.0, 0.45 + 0.7 * nP, vPosMundo.y ) ) * uPolvo;
        diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.84, 0.72, 0.58 ), polvo );
        float mX = ruidoP( vec2( vPosMundo.x + vPosMundo.z, vPosMundo.y * 0.35 ) * 1.3 );
        float mancha = ruidoP( vec2( vPosMundo.x - vPosMundo.z, vPosMundo.y ) * 0.45 ) * 0.6 + mX * 0.4;
        diffuseColor.rgb *= 1.0 - 0.14 * uPolvo * smoothstep( 0.45, 0.95, mancha );`);
  };
  m.customProgramCacheKey = () => 'polvo-v1-' + cantidad;
  m.needsUpdate = true;
}

// Viñeta y grano muy leves, después del tono fílmico (espacio sRGB). El grano también disimula el escalonado del cielo.
const VIÑETA = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, semilla: { value: 0 } },
  vertexShader: 'varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float semilla; varying vec2 vUv;
    float h(vec2 p) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) + semilla * 91.7 ) * 43758.5453 ); }
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      vec2 d = vUv - 0.5; d.x *= res.x / res.y;
      c.rgb *= mix( 0.8, 1.0, smoothstep( 1.0, 0.3, length( d ) ) );
      c.rgb += ( h( vUv * res ) - 0.5 ) * 0.018;
      gl_FragColor = c;
    }`,
};

// ---------------------------------------------------------------- audio (todo sintetizado: sin grabaciones)
function crearAudio(perfil) {
  let ctx = null, maestro = null, viento = null, rafagas = 0, mar = null, olas = 0;
  let ruidoBlanco = null;
  function crearRuido(segundos, marron) {
    const n = Math.floor(ctx.sampleRate * segundos);
    const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 2 - 1;
      if (marron) { ult = (ult + 0.02 * x) / 1.02; d[i] = ult * 3.5; } else d[i] = x;
    }
    return b;
  }
  function montar() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    maestro = ctx.createGain(); maestro.gain.value = 0; maestro.connect(ctx.destination);
    ruidoBlanco = crearRuido(0.4, false);
    // viento: ruido marrón por un pasabanda que se mueve, más un silbido suave
    const fuente = ctx.createBufferSource(); fuente.buffer = crearRuido(4, true); fuente.loop = true;
    const banda = ctx.createBiquadFilter(); banda.type = 'bandpass'; banda.frequency.value = 380; banda.Q.value = 0.7;
    const gv = ctx.createGain(); gv.gain.value = 0.55;
    fuente.connect(banda).connect(gv).connect(maestro);
    const fuente2 = ctx.createBufferSource(); fuente2.buffer = crearRuido(3, false); fuente2.loop = true;
    const silbo = ctx.createBiquadFilter(); silbo.type = 'bandpass'; silbo.frequency.value = 1500; silbo.Q.value = 9;
    const gs = ctx.createGain(); gs.gain.value = 0.018;
    fuente2.connect(silbo).connect(gs).connect(maestro);
    fuente.start(); fuente2.start();
    viento = { banda, gv, silbo, gs };
    rafaga();
    if (perfil === 'mar') {
      // oleaje: ruido marrón por un paso bajo que respira con cada ola, más la espuma (agudos suaves)
      const f = ctx.createBufferSource(); f.buffer = crearRuido(6, true); f.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0.3;
      f.connect(lp).connect(g).connect(maestro);
      const f2 = ctx.createBufferSource(); f2.buffer = crearRuido(5, false); f2.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2400; hp.Q.value = 0.5;
      const g2 = ctx.createGain(); g2.gain.value = 0.0;
      f2.connect(hp).connect(g2).connect(maestro);
      f.start(); f2.start();
      mar = { lp, g, g2 };
      ola();
    }
    return true;
  }
  function ola() {
    if (!ctx || !mar) return;
    const t = ctx.currentTime, per = 5.5 + Math.random() * 4;
    mar.g.gain.setTargetAtTime(0.55 + Math.random() * 0.3, t, per * 0.18);
    mar.g.gain.setTargetAtTime(0.18, t + per * 0.45, per * 0.25);
    mar.lp.frequency.setTargetAtTime(700, t, per * 0.15);
    mar.lp.frequency.setTargetAtTime(320, t + per * 0.4, per * 0.3);
    mar.g2.gain.setTargetAtTime(0.05 + Math.random() * 0.04, t + per * 0.25, per * 0.1);
    mar.g2.gain.setTargetAtTime(0.0, t + per * 0.55, per * 0.2);
    olas = setTimeout(ola, per * 1000);
  }
  function panear(pan) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; return p; }
    return ctx.createGain();
  }
  function rafaga() {
    if (!ctx) return;
    const t = ctx.currentTime, dur = 2 + Math.random() * 4;
    viento.banda.frequency.setTargetAtTime(260 + Math.random() * 420, t, dur / 3);
    viento.gv.gain.setTargetAtTime(0.32 + Math.random() * 0.5, t, dur / 3);
    viento.silbo.frequency.setTargetAtTime(1100 + Math.random() * 900, t, dur / 2);
    viento.gs.gain.setTargetAtTime(0.006 + Math.random() * 0.03, t, dur / 2);
    rafagas = setTimeout(rafaga, dur * 1000);
  }
  return {
    encender() {
      if (!ctx && !montar()) return;
      ctx.resume();
      maestro.gain.cancelScheduledValues(ctx.currentTime);
      maestro.gain.setTargetAtTime(0.42, ctx.currentTime, 0.8);
    },
    apagar() { if (ctx) maestro.gain.setTargetAtTime(0, ctx.currentTime, 0.12); },
    pausar() { if (ctx) ctx.suspend(); },
    reanudar() { if (ctx) ctx.resume(); },
    // gaviota: dos a cuatro «kiau» que bajan de tono, con algo de aspereza
    graznido(pan, vol) {
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime, n = 2 + Math.floor(Math.random() * 3), base = 1150 + Math.random() * 450;
      const salida = panear(pan); salida.connect(maestro);
      for (let i = 0; i < n; i++) {
        const t = t0 + i * (0.24 + Math.random() * 0.08);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * 1.25, t); o.frequency.exponentialRampToValueAtTime(base * 0.72, t + 0.2);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 1.4; bp.Q.value = 3;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09 * vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(bp).connect(g).connect(salida);
        o.start(t); o.stop(t + 0.25);
      }
    },
    // lobo marino: bramidos roncos y graves, cortos
    ladrido(pan, vol) {
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime, n = 2 + Math.floor(Math.random() * 3);
      const salida = panear(pan); salida.connect(maestro);
      for (let i = 0; i < n; i++) {
        const t = t0 + i * (0.38 + Math.random() * 0.15);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        const f = 150 + Math.random() * 60;
        o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.8, t + 0.26);
        const ruido = ctx.createBufferSource(); ruido.buffer = ruidoBlanco;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.6;
        const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 900; bp2.Q.value = 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(bp).connect(g); ruido.connect(bp2).connect(g); g.connect(salida);
        o.start(t); o.stop(t + 0.32); ruido.start(t); ruido.stop(t + 0.32);
      }
    },
    // pájaro lejano de la pampa: un par de silbidos agudos y cortos
    pajaro(pan) {
      if (!ctx || ctx.state !== 'running') return;
      const t0 = ctx.currentTime, salida = panear(pan); salida.connect(maestro);
      for (let i = 0; i < 2; i++) {
        const t = t0 + i * 0.16;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(3400 + Math.random() * 600, t); o.frequency.exponentialRampToValueAtTime(2600, t + 0.11);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g).connect(salida); o.start(t); o.stop(t + 0.14);
      }
    },
    paso(fuerza) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      // golpe sordo del talón + crujido de grava fina
      const s1 = ctx.createBufferSource(); s1.buffer = ruidoBlanco; s1.playbackRate.value = 0.75 + Math.random() * 0.4;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520 + Math.random() * 380;
      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(0, t); g1.gain.linearRampToValueAtTime(0.5 + 0.35 * fuerza, t + 0.008); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      s1.connect(lp).connect(g1).connect(maestro);
      const s2 = ctx.createBufferSource(); s2.buffer = ruidoBlanco; s2.playbackRate.value = 0.9 + Math.random() * 0.3;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600 + Math.random() * 1600; bp.Q.value = 1.4;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, t + 0.01); g2.gain.linearRampToValueAtTime(0.1 + 0.08 * fuerza, t + 0.03); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      s2.connect(bp).connect(g2).connect(maestro);
      s1.start(t); s1.stop(t + 0.2); s2.start(t); s2.stop(t + 0.26);
    },
  };
}
