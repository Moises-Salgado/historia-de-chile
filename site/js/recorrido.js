/* Recorridos 360°: visor de cubemap en CSS 3D (perspective + preserve-3d; sin WebGL, funciona en file://)
   y sección de tarjetas. Datos: window.RECORRIDOS (scripts/build-360.mjs). GSAP local solo para inercia y transiciones.
   Cámara: yaw (+ derecha) y pitch (+ arriba) en grados; el FOV se mide sobre el lado mayor de la pantalla (40–100).
   Regla: el estado nunca depende del final de una animación (respaldos por tiempo). Movimiento reducido = html.rm. */
(function () {
  'use strict';
  var R = window.RECORRIDOS || { propios: [], externos: [] };
  var G = window.gsap;
  var raiz = document.documentElement;
  var rm = function () { return raiz.classList.contains('rm'); };
  var $ = function (id) { return document.getElementById(id); };
  var leer = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var guardar = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  var propios = R.propios || [], externos = R.externos || [];
  var porId = {}; propios.forEach(function (r) { porId[r.id] = r; });

  function el(tag, cls, attrs, texto) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (texto != null) n.textContent = texto;
    return n;
  }
  var unicos = function (a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); };
  function creditoCorto(r) {
    var es = r.escenas;
    return 'Fotos 360°: ' + unicos(es.map(function (e) { return e.credito.autor; })).join(', ') + ' · ' +
      unicos(es.map(function (e) { return e.credito.licencia; })).join(', ') + ' · Wikimedia Commons';
  }

  // Paseos 3D (segundo-cerebro/Mundos → HISTORIA.mundos): páginas propias en site/3d/, se abren en la misma pestaña.
  var mundos = (window.HISTORIA && window.HISTORIA.mundos) || [];

  // Para la lámina del momento: paseos 3D y recorridos asociados a un evento.
  function deEvento(eventoId) {
    var out = [];
    mundos.forEach(function (m) { if (m.evento === eventoId) out.push({ titulo: m.titulo, modo: '3d', href: m.href, mb: m.mb }); });
    propios.forEach(function (r) { if (r.evento === eventoId) out.push({ titulo: r.titulo, modo: 'propio', id: r.id, institucion: r.institucion }); });
    externos.forEach(function (r) { if (r.evento === eventoId) out.push({ titulo: r.titulo, modo: 'externo', url: r.url, institucion: r.institucion }); });
    return out;
  }

  // ================================================================ Visor
  var dlg = $('r360');
  if (!dlg) { window.Recorrido = { abrir: function () { return false; }, deEvento: deEvento }; seccion(); return; }
  var vista = $('r360-vista'), cubo = $('r360-cubo'), negro = $('r360-negro'), cargandoEl = $('r360-cargando');
  var velo = dlg.querySelector('.r360-velo'), tituloEl = $('r360-t'), recEl = $('r360-rec'), tira = $('r360-tira');
  var creditoEl = $('r360-credito'), pista = $('r360-pista'), anuncio = $('r360-anuncio');
  var ui = [dlg.querySelector('.r360-cab'), dlg.querySelector('.r360-pie'), $('r360-cerrar')];

  // Geometría (debe coincidir con scripts/build-360.mjs): caras de 1024 px con 2 texeles de margen por lado,
  // a 510 px del centro: se solapan y no hay costuras. Las flechas van más cerca (delante de las caras).
  var D = 510, RF = 400;
  var FOV = { min: 40, max: 100, ini: 85 };
  var CARAS = [
    'translateZ(-' + D + 'px)',                        // frente
    'rotateY(-90deg) translateZ(-' + D + 'px)',        // derecha
    'rotateY(180deg) translateZ(-' + D + 'px)',        // atrás
    'rotateY(90deg) translateZ(-' + D + 'px)',         // izquierda
    'rotateX(-90deg) translateZ(-' + D + 'px)',        // arriba
    'rotateX(90deg) translateZ(-' + D + 'px)',         // abajo
  ];
  var caras = CARAS.map(function (t, i) {
    var c = el('div', 'r360-cara');
    c.style.transform = t;
    c.style.backgroundPosition = (i * 20) + '% 0';
    cubo.appendChild(c);
    return c;
  });

  var cam = { yaw: 0, pitch: 0, fov: FOV.ini }, fovUsuario = FOV.ini;
  var W = 1, H = 1, M = 1, piso = -90, raf = 0;
  var recorrido = null, actual = null, seq = 0;
  var tlSalida = null, tlEntrada = null, inercia = null, giro = null, respaldos = [];
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var norm = function (y) { return ((((y + 180) % 360) + 360) % 360) - 180; };
  var delta = function (de, a) { return norm(a - de); };

  // En pantallas verticales el lado mayor es el alto: se abre más para no quedar con un ancho de túnel.
  function fovInicial() { return H > W ? FOV.max : FOV.ini; }
  function dist(fov) { return (M / 2) / Math.tan((fov * Math.PI) / 360); }
  function fovV() { return (2 * Math.atan((H / 2) / dist(cam.fov)) * 180) / Math.PI; }
  function fovH() { return (2 * Math.atan((W / 2) / dist(cam.fov)) * 180) / Math.PI; }
  function medir() {
    W = vista.clientWidth || window.innerWidth; H = vista.clientHeight || window.innerHeight; M = Math.max(W, H, 1);
    // Las flechas se ven a su tamaño CSS con el zoom inicial (y crecen al acercar, como el resto de la escena).
    cubo.style.setProperty('--k', (RF / dist(fovInicial())).toFixed(4));
  }
  function limitar() {
    cam.fov = clamp(cam.fov, FOV.min, FOV.max);
    // Panorámicas recortadas abajo (piso): no se mira más abajo que el borde de la foto.
    var min = piso > -89 ? Math.min(piso + fovV() / 2, 30) : -89.9;
    cam.pitch = clamp(cam.pitch, min, 89.9);
  }
  function pintar() {
    raf = 0;
    var p = dist(cam.fov);
    vista.style.perspective = p.toFixed(2) + 'px';
    cubo.style.transform = 'translateZ(' + p.toFixed(2) + 'px) rotateX(' + cam.pitch.toFixed(3) + 'deg) rotateY(' + cam.yaw.toFixed(3) + 'deg)';
    marcarFrente();
  }
  // ---------------------------------------------------------------- Caminar (estilo Street View)
  // ↑ / W avanza hacia la flecha que queda al frente (±60°), ↓ / S vuelve a la escena anterior, ← → / A D giran.
  var FRENTE = 60, pasos = [];
  function alFrente() {
    if (!actual) return null;
    var mejor = null, dmin = FRENTE;
    (actual.enlaces || []).forEach(function (l) { var d = Math.abs(delta(cam.yaw, l.yaw)); if (d <= dmin && buscar(l.a)) { dmin = d; mejor = l; } });
    return mejor;
  }
  var frenteActual = null;
  function marcarFrente() {
    var l = alFrente(), a = l ? l.a : null;
    if (a === frenteActual) return;
    frenteActual = a;
    [].forEach.call(cubo.querySelectorAll('.r360-enlace'), function (b) { b.classList.toggle('al-frente', !!a && b.dataset.a === a); });
  }
  function caminar() {
    var l = alFrente();
    if (!l) { avisoCamino(); return; }
    if (actual) pasos.push({ id: actual.id, yaw: l.yaw });
    ir(buscar(l.a), l, false);
  }
  function retroceder() {
    var prev = pasos.pop();
    var dest = prev && buscar(prev.id);
    if (!dest) { avisoCamino('Aún no hay una escena anterior.'); return; }
    // Volver es un paso atrás: fundido breve y se reaparece mirando en la misma dirección en que se caminó.
    ir(dest, { a: dest.id, yaw: cam.yaw, pitch: 0, volver: prev.yaw }, true);
  }
  var avisoT = 0;
  function avisoCamino(t) {
    anuncio.textContent = t || 'Por aquí no hay camino. Gira con las flechas izquierda y derecha hasta ver una flecha.';
    var el2 = dlg.querySelector('.r360-camino');
    if (el2) { el2.textContent = t || 'Por aquí no hay camino: gira con ← → hasta ver una flecha'; el2.hidden = false; clearTimeout(avisoT); avisoT = setTimeout(function () { el2.hidden = true; }, 1800); }
  }
  function pedir() { if (!raf) raf = requestAnimationFrame(pintar); }
  function actualizar() { limitar(); pintar(); }

  function matarAnim() {
    [tlSalida, tlEntrada, inercia, giro].forEach(function (t) { if (t) t.kill(); });
    tlSalida = tlEntrada = inercia = giro = null;
    respaldos.forEach(clearTimeout); respaldos = [];
  }
  var luego = function (fn, ms) { respaldos.push(setTimeout(fn, ms)); };
  // La persona toma la cámara: la entrada de escena salta a su final y se cortan inercia y giros.
  // Durante el avance hacia otra escena (salida) la cámara es de la transición: devuelve false.
  function tomarControl() {
    if (tlSalida) return false;
    if (tlEntrada && tlEntrada.progress() < 1) tlEntrada.progress(1);
    if (inercia) { inercia.kill(); inercia = null; }
    if (giro) { giro.kill(); giro = null; }
    return true;
  }

  // ---------------------------------------------------------------- Escenas
  var cargas = {};
  function precargar(esc) {
    if (!cargas[esc.src]) cargas[esc.src] = new Promise(function (ok, mal) {
      var img = new Image();
      // decode() se resuelve con el siguiente cuadro del compositor: se aprovecha, pero nunca se espera más de 250 ms
      // (con pocos cuadros por segundo la escena quedaría en negro).
      img.onload = function () {
        var listo = false, fin = function () { if (!listo) { listo = true; ok(img); } };
        var d = img.decode ? img.decode() : null;
        if (d && d.then) d.then(fin, fin);
        setTimeout(fin, d && d.then ? 250 : 0);
      };
      img.onerror = function () { delete cargas[esc.src]; mal(new Error('sin imagen')); };
      img.src = esc.src;
    });
    return cargas[esc.src];
  }
  function buscar(id) { return recorrido && recorrido.escenas.filter(function (e) { return e.id === id; })[0]; }
  function cargando(on, msg) { cargandoEl.hidden = !on; if (on) cargandoEl.textContent = msg || 'Cargando escena…'; }

  // Estado lógico: se aplica al tiro (título, crédito, tira, anuncio), antes de cualquier animación.
  function estado(esc) {
    actual = esc;
    tituloEl.textContent = esc.titulo;
    var c = esc.credito;
    creditoEl.textContent = 'Foto 360°: ' + c.autor + ' · ';
    var lic = el('a', null, { href: c.licenciaUrl || c.fuente, target: '_blank', rel: 'noopener' }, c.licencia);
    var com = el('a', null, { href: c.fuente, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons');
    creditoEl.appendChild(lic); creditoEl.appendChild(document.createTextNode(' · ')); creditoEl.appendChild(com);
    var i = recorrido.escenas.indexOf(esc);
    [].forEach.call(tira.querySelectorAll('button'), function (b, j) {
      if (j === i) {
        b.setAttribute('aria-current', 'true');
        var li = b.parentNode, izq = li.offsetLeft, der = izq + li.offsetWidth;
        if (izq < tira.scrollLeft) tira.scrollLeft = izq - 8; else if (der > tira.scrollLeft + tira.clientWidth) tira.scrollLeft = der - tira.clientWidth + 8;
      } else b.removeAttribute('aria-current');
    });
    anuncio.textContent = 'Escena ' + (i + 1) + ' de ' + recorrido.escenas.length + ': ' + esc.titulo;
  }
  // Lo visible: texturas, cámara inicial de la escena y flechas.
  function mostrar(esc, ok) {
    caras.forEach(function (c) { c.style.backgroundImage = ok === false ? 'none' : 'url("' + esc.src + '")'; });
    if (ok === false) cargando(true, 'No se pudo cargar esta escena.');
    piso = esc.piso == null ? -90 : esc.piso;
    cam.yaw = esc.yaw || 0; cam.pitch = esc.pitch || 0; cam.fov = fovUsuario;
    limitar(); pintar();
    flechas(esc);
    frenteActual = undefined; marcarFrente();
  }
  function flechas(esc) {
    [].slice.call(cubo.querySelectorAll('.r360-enlace')).forEach(function (b) { b.remove(); });
    (esc.enlaces || []).forEach(function (l) {
      var dest = buscar(l.a);
      if (!dest) return;
      var b = el('button', 'r360-enlace', { type: 'button', 'aria-label': 'Ir a ' + dest.titulo });
      b.dataset.a = l.a;
      b.style.setProperty('--y', (-l.yaw) + 'deg');
      b.style.setProperty('--p', (-l.pitch) + 'deg');
      b.innerHTML = '<span class="r360-flecha" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 14.5l6-6 6 6"/></svg></span><span class="r360-destino" aria-hidden="true"></span>';
      b.lastChild.textContent = dest.titulo;
      // Teclado (detail 0): sin vuelo, solo fundido.
      b.addEventListener('click', function (e) { if (actual) pasos.push({ id: actual.id, yaw: l.yaw }); ir(dest, l, e.detail === 0); });
      b.addEventListener('focus', function () { if (b.matches(':focus-visible')) encuadrar(l); });
      cubo.appendChild(b);
    });
  }
  // Con teclado, la flecha enfocada queda a la vista (salto inmediato, sin animación).
  function encuadrar(l) {
    if (Math.abs(delta(cam.yaw, l.yaw)) < fovH() * 0.38 && Math.abs(cam.pitch - l.pitch) < fovV() * 0.38) return;
    if (inercia) { inercia.kill(); inercia = null; }
    cam.yaw = l.yaw; cam.pitch = l.pitch; actualizar();
  }

  // ---------------------------------------------------------------- Transiciones
  // Avance: la cámara gira y se acerca a la flecha (600 ms, cajón) mientras la escena se funde a negro;
  // la nueva escena llega abriendo el encuadre. Movimiento reducido o teclado: solo fundido de 200 ms.
  function ir(dest, enlace, rapido) {
    if (!dest || !dlg.open) return;
    if (dest === actual && !tlSalida) return;
    var s = ++seq;
    matarAnim();
    ocultarPista();
    rapido = rapido || rm() || !G || !enlace;
    estado(dest);
    var carga = precargar(dest);
    var salida = rapido ? 0.1 : 0.6;
    if (G) {
      tlSalida = G.timeline();
      if (!rapido) tlSalida.to(cam, { yaw: cam.yaw + delta(cam.yaw, enlace.yaw), pitch: enlace.pitch, fov: Math.max(FOV.min, cam.fov - 30), duration: 0.6, ease: 'cajon', onUpdate: pintar }, 0);
      tlSalida.to(negro, { opacity: 1, duration: rapido ? 0.1 : 0.32, ease: 'none' }, rapido ? 0 : 0.28);
    } else negro.style.opacity = '1';
    // El cambio de escena se agenda por tiempo real (no por el final del tween).
    luego(function () {
      if (s !== seq) return;
      if (tlSalida) { tlSalida.progress(1); tlSalida.kill(); tlSalida = null; }
      negro.style.opacity = '1';
      var aviso = setTimeout(function () { if (s === seq) cargando(true); }, 250);
      var fin = function (ok) { clearTimeout(aviso); if (s !== seq) return; cargando(false); mostrar(dest, ok); if (enlace && enlace.volver != null) { cam.yaw = enlace.volver; actualizar(); } entrar(rapido ? 'rapido' : 'avance'); };
      carga.then(function () { fin(true); }, function () { fin(false); });
    }, salida * 1000 + 30);
  }
  function entrar(modo) {
    var s = seq, rapido = modo === 'rapido' || rm() || !G;
    var flechasEl = [].slice.call(cubo.querySelectorAll('.r360-flecha, .r360-destino'));
    if (!G) { negro.style.opacity = '0'; return; }
    var f = cam.fov, dur = rapido ? 0.2 : modo === 'abrir' ? 1.2 : 0.55;
    tlEntrada = G.timeline();
    var desde = modo === 'abrir' ? (f + 14 <= FOV.max ? f + 14 : f - 12) : Math.max(FOV.min, f - 10);
    if (!rapido) tlEntrada.fromTo(cam, { fov: desde }, { fov: f, duration: dur, ease: modo === 'abrir' ? 'cajon' : 'salida', onUpdate: actualizar }, 0);
    tlEntrada.to(negro, { opacity: 0, duration: rapido ? 0.2 : modo === 'abrir' ? 0.9 : 0.35, ease: 'none' }, 0);
    // Las flechas aparecen al final: dicen «por aquí se sigue».
    if (flechasEl.length) tlEntrada.fromTo(flechasEl, rapido ? { opacity: 0 } : { opacity: 0, scale: 0.9 },
      rapido ? { opacity: 1, duration: 0.2, ease: 'none', clearProps: 'opacity' } : { opacity: 1, scale: 1, duration: 0.25, ease: 'salida', stagger: 0.05, clearProps: 'opacity,transform' },
      rapido ? 0 : modo === 'abrir' ? 0.75 : 0.3);
    if (modo === 'abrir') tlEntrada.call(mostrarPista, null, rapido ? 0.2 : 0.9);
    luego(function () {
      if (s !== seq || !tlEntrada) return;
      tlEntrada.progress(1);
      negro.style.opacity = '0'; cam.fov = f; actualizar();
    }, (dur + 0.6) * 1000);
  }

  // ---------------------------------------------------------------- Abrir y cerrar
  // Historial: cada apertura agrega una entrada con un sello propio; Atrás la cierra. Una entrada vieja del visor
  // (p. ej. tras recargar con el visor abierto) se limpia al cargar.
  var abridor = null, conHistoria = false, cerrando = false, sello = '';
  var esMia = function () { return !!(history.state && history.state.capa === 'r360' && history.state.sello === sello); };
  try { if (history.state && history.state.capa === 'r360') history.replaceState(history.state.previo || null, '', location.href); } catch (e) { /* nada */ }
  function armarTira(rec) {
    tira.textContent = '';
    rec.escenas.forEach(function (e, i) {
      var li = el('li');
      var b = el('button', null, { type: 'button', 'aria-label': 'Escena ' + (i + 1) + ': ' + e.titulo, title: e.titulo });
      var img = el('img', null, { src: e.mini, alt: '', loading: 'lazy', decoding: 'async', width: '160', height: '100' });
      b.appendChild(img); b.appendChild(el('span', null, { 'aria-hidden': 'true' }, String(i + 1)));
      b.addEventListener('click', function () { ir(e, null, true); });
      li.appendChild(b); tira.appendChild(li);
    });
  }
  function abrir(id, escenaId) {
    var rec = porId[id];
    if (!rec || !rec.escenas.length) return false;
    var s = ++seq;
    matarAnim();
    cerrando = false;
    if (!dlg.open) abridor = document.activeElement;
    recorrido = rec;
    pasos = [];
    recEl.textContent = rec.titulo;
    armarTira(rec);
    var esc = (escenaId && buscar(escenaId)) || rec.escenas[0];
    caras.forEach(function (c) { c.style.backgroundImage = 'none'; });
    [].slice.call(cubo.querySelectorAll('.r360-enlace')).forEach(function (b) { b.remove(); });
    if (!dlg.open) {
      dlg.showModal();
      // Atrás (o el botón atrás del teléfono) cierra el visor sin salir del sitio.
      sello = String(Date.now());
      try { history.pushState({ capa: 'r360', sello: sello, previo: history.state }, '', location.href); conHistoria = true; } catch (e) { conHistoria = false; }
    }
    medir();
    fovUsuario = fovInicial();
    piso = esc.piso == null ? -90 : esc.piso;
    cam.fov = fovUsuario; cam.yaw = esc.yaw || 0; cam.pitch = esc.pitch || 0;
    actualizar();
    estado(esc);
    negro.style.opacity = '1';
    pista.hidden = true;
    vista.focus({ preventScroll: true });
    if (G) {
      G.killTweensOf([dlg, velo].concat(ui));
      G.set(dlg, { opacity: 1 });
      G.fromTo(velo, { opacity: 0 }, { opacity: 1, duration: rm() ? 0.2 : 0.35, ease: 'none' });
      G.fromTo(ui, { opacity: 0 }, { opacity: 1, duration: rm() ? 0.2 : 0.3, ease: 'none', delay: rm() ? 0 : 0.3 });
      setTimeout(function () { if (dlg.open && !cerrando) G.set([velo].concat(ui), { opacity: 1 }); }, 900);
    }
    var aviso = setTimeout(function () { if (s === seq) cargando(true); }, 300);
    var fin = function (ok) { clearTimeout(aviso); if (s !== seq || !dlg.open) return; cargando(false); mostrar(esc, ok); entrar('abrir'); };
    precargar(esc).then(function () { fin(true); }, function () { fin(false); });
    // Mientras se ve una escena, se precargan sus vecinas.
    (esc.enlaces || []).forEach(function (l) { var d = buscar(l.a); if (d) precargar(d).catch(function () {}); });
    return true;
  }
  function cerrar(desdeHistoria) {
    if (!dlg.open || cerrando) return;
    cerrando = true; seq++;
    matarAnim();
    if (!desdeHistoria && conHistoria) {
      conHistoria = false;
      try { if (esMia()) history.back(); } catch (e) { /* nada */ }
    }
    var fin = function () { if (cerrando && dlg.open) dlg.close(); cerrando = false; };
    if (G) G.to(dlg, { opacity: 0, duration: rm() ? 0.18 : 0.26, ease: 'none', onComplete: fin });
    setTimeout(fin, 420);
  }
  dlg.addEventListener('cancel', function (ev) { ev.preventDefault(); cerrar(); });
  dlg.addEventListener('close', function () {
    seq++; matarAnim(); cerrando = false;
    if (G) G.set([dlg, velo, negro].concat(ui), { clearProps: 'opacity' });
    negro.style.opacity = '1';
    if (conHistoria) { conHistoria = false; try { if (esMia()) history.back(); } catch (e) { /* nada */ } }
    if (abridor && abridor.focus && document.contains(abridor)) abridor.focus({ preventScroll: true });
    abridor = null;
  });
  window.addEventListener('popstate', function () {
    if (dlg.open && conHistoria && !esMia()) { conHistoria = false; cerrar(true); }
  });
  $('r360-cerrar').addEventListener('click', function () { cerrar(); });
  window.addEventListener('resize', function () { if (dlg.open) { medir(); actualizar(); } });

  // ---------------------------------------------------------------- Pista (solo la primera vez)
  function mostrarPista() {
    if (leer('r360-pista') === '1' || !dlg.open) return;
    pista.hidden = false;
    if (G) G.fromTo(pista, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' });
  }
  function ocultarPista() {
    if (leer('r360-pista') !== '1') guardar('r360-pista', '1');
    if (pista.hidden) return;
    if (G) G.to(pista, { opacity: 0, duration: 0.2, ease: 'none', onComplete: function () { pista.hidden = true; } });
    setTimeout(function () { pista.hidden = true; if (G) G.set(pista, { clearProps: 'opacity' }); }, 260);
  }
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) pista.querySelector('small').textContent = 'Pellizca para acercar · toca una flecha para avanzar';

  // ---------------------------------------------------------------- Mirar: arrastre con inercia, rueda y pinza
  var ptrs = {}, nPtr = 0, drag = null, pinza = null;
  var distPinza = function () { var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); };
  vista.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!tomarControl()) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; nPtr = Object.keys(ptrs).length;
    if (nPtr === 1) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch, movido: false, m: [] };
    else if (nPtr === 2) {
      drag = null; pinza = { d: distPinza(), fov: cam.fov };
      Object.keys(ptrs).forEach(function (id) { try { vista.setPointerCapture(+id); } catch (x) { /* nada */ } });
    }
  });
  vista.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId];
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pinza && nPtr >= 2) {
      var d = distPinza();
      if (d > 10) { cam.fov = pinza.fov * pinza.d / d; fovUsuario = clamp(cam.fov, FOV.min, FOV.max); limitar(); pedir(); ocultarPista(); }
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.movido) {
      if (Math.abs(dx) + Math.abs(dy) < 5) return;
      drag.movido = true;
      try { vista.setPointerCapture(e.pointerId); } catch (x) { /* nada */ }
      vista.classList.add('arrastrando');
      ocultarPista();
    }
    var k = 180 / (Math.PI * dist(cam.fov)); // grados por píxel en el centro: el punto tomado sigue al dedo
    cam.yaw = drag.yaw - dx * k; cam.pitch = drag.pitch + dy * k;
    limitar(); pedir();
    var t = performance.now();
    drag.m.push({ t: t, yaw: cam.yaw, pitch: cam.pitch });
    while (drag.m.length > 2 && t - drag.m[0].t > 120) drag.m.shift();
  });
  function soltar(e) {
    if (!ptrs[e.pointerId]) return;
    delete ptrs[e.pointerId]; nPtr = Object.keys(ptrs).length;
    if (pinza) { if (nPtr < 2) pinza = null; drag = null; return; }
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    vista.classList.remove('arrastrando');
    if (d.movido && e.type === 'pointerup') lanzar(d.m);
    cam.yaw = inercia ? cam.yaw : norm(cam.yaw);
  }
  vista.addEventListener('pointerup', soltar);
  vista.addEventListener('pointercancel', soltar);
  // Inercia: la vista sigue un poco en la dirección del gesto y frena (salida). Con movimiento reducido, no.
  function lanzar(m) {
    if (rm() || !G || m.length < 2) return;
    var a = m[0], b = m[m.length - 1], dt = (b.t - a.t) / 1000;
    if (dt <= 0 || performance.now() - b.t > 90) return;
    var vy = (b.yaw - a.yaw) / dt, vp = (b.pitch - a.pitch) / dt;
    if (Math.hypot(vy, vp) < 30) return;
    inercia = G.to(cam, {
      yaw: cam.yaw + clamp(vy * 0.3, -120, 120), pitch: cam.pitch + clamp(vp * 0.3, -60, 60),
      duration: 0.9, ease: 'salida', onUpdate: actualizar,
      onComplete: function () { inercia = null; cam.yaw = norm(cam.yaw); },
    });
  }
  vista.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (!tomarControl()) return;
    var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    cam.fov += clamp(d * 0.04, -8, 8); fovUsuario = clamp(cam.fov, FOV.min, FOV.max);
    limitar(); pedir();
  }, { passive: false });
  vista.addEventListener('dragstart', function (e) { e.preventDefault(); });

  // ---------------------------------------------------------------- Teclado y mandos
  function girar(dy, dp, suave) {
    if (!tomarControl()) return;
    ocultarPista();
    if (suave && G && !rm()) {
      giro = G.to(cam, { yaw: cam.yaw + dy, pitch: cam.pitch + dp, duration: 0.28, ease: 'salida', onUpdate: actualizar, onComplete: function () { giro = null; cam.yaw = norm(cam.yaw); } });
      return;
    }
    cam.yaw = norm(cam.yaw + dy); cam.pitch += dp; actualizar();
  }
  function zoom(d, suave) {
    if (!tomarControl()) return;
    var f = clamp(cam.fov + d, FOV.min, FOV.max);
    fovUsuario = f;
    if (suave && G && !rm()) { giro = G.to(cam, { fov: f, duration: 0.24, ease: 'salida', onUpdate: actualizar, onComplete: function () { giro = null; } }); return; }
    cam.fov = f; actualizar();
  }
  [].forEach.call(dlg.querySelectorAll('[data-giro]'), function (b) {
    b.addEventListener('click', function (e) { girar(+b.getAttribute('data-giro'), 0, e.detail !== 0); });
  });
  [].forEach.call(dlg.querySelectorAll('[data-zoom]'), function (b) {
    b.addEventListener('click', function (e) { zoom(+b.getAttribute('data-zoom'), e.detail !== 0); });
  });
  dlg.addEventListener('keydown', function (ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var k = ev.key, paso = ev.shiftKey ? 15 : 5, hecho = true;
    var kl = k.length === 1 ? k.toLowerCase() : k;
    if (ev.target && /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName)) return;
    // Caminar: ↑/W avanza hacia la flecha del frente, ↓/S vuelve; ←→/A D giran; Shift+↑↓ mira arriba/abajo.
    if (k === 'ArrowLeft' || kl === 'a') girar(ev.shiftKey ? -45 : -15, 0, !ev.repeat);
    else if (k === 'ArrowRight' || kl === 'd') girar(ev.shiftKey ? 45 : 15, 0, !ev.repeat);
    else if ((k === 'ArrowUp' && ev.shiftKey)) girar(0, 10, true);
    else if ((k === 'ArrowDown' && ev.shiftKey)) girar(0, -10, true);
    else if (k === 'ArrowUp' || kl === 'w') { if (!ev.repeat) caminar(); }
    else if (k === 'ArrowDown' || kl === 's') { if (!ev.repeat) retroceder(); }
    else if (k === '+' || k === '=' || k === 'Add') zoom(-10);
    else if (k === '-' || k === '_' || k === 'Subtract') zoom(10);
    else if (k === 'Tab') { atrapar(ev); hecho = false; }
    else hecho = false;
    if (hecho) { ev.preventDefault(); ev.stopPropagation(); }
  });
  // Foco atrapado: Tab da la vuelta dentro del visor.
  function atrapar(ev) {
    var lista = [].filter.call(dlg.querySelectorAll('button, a[href], [tabindex="0"]'), function (x) {
      return !x.disabled && !x.closest('[hidden]') && x.getClientRects().length;
    });
    if (!lista.length) return;
    var i = lista.indexOf(document.activeElement);
    if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); lista[lista.length - 1].focus(); }
    else if (!ev.shiftKey && i === lista.length - 1) { ev.preventDefault(); lista[0].focus(); }
  }

  // ================================================================ Sección «Recorridos 360°»
  function seccion() {
    var ulP = $('rec-propios'), ulE = $('rec-externos');
    if (ulP) mundos.forEach(function (m) {
      var li = el('li');
      var a = el('a', 'rec-card', { href: m.href });
      var fig = el('span', 'rec-img');
      if (m.portada) fig.appendChild(el('img', null, { src: m.portada, alt: '', loading: 'lazy', decoding: 'async', width: '800', height: '500' }));
      fig.appendChild(el('span', 'rec-360', { 'aria-hidden': 'true' }, '3D'));
      a.appendChild(fig);
      a.appendChild(el('span', 'rec-t', null, m.titulo));
      if (m.desc) a.appendChild(el('span', 'rec-d', null, m.desc));
      a.appendChild(el('span', 'rec-n', null, 'Paseo a pie' + (m.region ? ' · ' + m.region : '') + ' · descarga de ' + m.mb + ' MB'));
      li.appendChild(a);
      li.appendChild(el('p', 'rec-cred', null, 'Reconstrucción aproximada hecha para este sitio con Blender y three.js'));
      ulP.appendChild(li);
    });
    if (ulP) propios.forEach(function (r) {
      var li = el('li');
      var b = el('button', 'rec-card', { type: 'button', 'aria-haspopup': 'dialog' });
      var fig = el('span', 'rec-img');
      fig.appendChild(el('img', null, { src: r.escenas[0].mini, alt: '', loading: 'lazy', decoding: 'async', width: '640', height: '400' }));
      fig.appendChild(el('span', 'rec-360', { 'aria-hidden': 'true' }, '360°'));
      b.appendChild(fig);
      b.appendChild(el('span', 'rec-t', null, r.titulo));
      if (r.descripcion) b.appendChild(el('span', 'rec-d', null, r.descripcion));
      b.appendChild(el('span', 'rec-n', null, r.escenas.length + ' escenas · ' + r.region));
      b.addEventListener('click', function () { abrir(r.id); });
      li.appendChild(b);
      li.appendChild(el('p', 'rec-cred', null, creditoCorto(r)));
      ulP.appendChild(li);
    });
    if (ulE) externos.forEach(function (r) {
      var li = el('li');
      var a = el('a', 'rec-ext', { href: r.url, target: '_blank', rel: 'noopener' });
      a.appendChild(el('span', 'rec-ext-inst', null, r.institucion || ''));
      a.appendChild(el('span', 'rec-t', null, r.titulo));
      if (r.descripcion) a.appendChild(el('span', 'rec-d', null, r.descripcion));
      var pie = el('span', 'rec-ext-pie', null, 'Sitio oficial · se abre en otra pestaña');
      pie.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3L6 10M11 9v4H3V5h4"/></svg>');
      a.appendChild(pie);
      li.appendChild(a);
      ulE.appendChild(li);
    });
    escenaScroll();
  }
  // Al llegar a la sección: el título sube por líneas y las tarjetas entran (como el resto de las secciones).
  function escenaScroll() {
    var ST = window.ScrollTrigger;
    if (rm() || !G || !ST) return;
    var h = document.querySelector('#recorridos h2');
    if (h && window.SplitText) {
      var st = window.SplitText.create(h, { type: 'lines', mask: 'lines' });
      G.from(st.lines, { yPercent: 105, duration: 1, ease: 'cajon', stagger: 0.08, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    }
    var cards = G.utils.toArray('#recorridos .rec-propios > li, #recorridos .rec-externos > li');
    if (!cards.length) return;
    G.set(cards, { opacity: 0, y: 40 });
    ST.batch(cards, { start: 'top 92%', once: true, onEnter: function (b) { G.to(b, { opacity: 1, y: 0, duration: 0.8, ease: 'salida', stagger: 0.05, overwrite: true, clearProps: 'transform,opacity' }); } });
    setTimeout(function () { cards.forEach(function (c) { if (+getComputedStyle(c).opacity === 0 && c.getBoundingClientRect().top < innerHeight) G.set(c, { clearProps: 'transform,opacity' }); }); }, 3000);
  }

  window.Recorrido = { abrir: abrir, deEvento: deEvento };
  seccion();
})();
