/* Capa cinematográfica: portada con fondo en movimiento, escenas al hacer scroll y sala de cine para relatos.
   GSAP + ScrollTrigger + SplitText + DrawSVG (locales). Con «reducir movimiento» todo queda quieto y legible.
   Regla: el contenido nunca depende de que una animación termine (respaldos por tiempo y por CSS). */
(function () {
  'use strict';
  var G = window.gsap, H = window.HISTORIA;
  if (!G || !H) return;
  G.registerPlugin(window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin);
  // Movimiento reducido = clase .rm en <html> (la pone el <head> y la cambia el menú). Se consulta en cada uso.
  var rm = function () { return document.documentElement.classList.contains('rm'); };
  var $ = function (s) { return document.querySelector(s); };
  var guardar = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };
  var leer = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var evById = {}; H.eventos.forEach(function (e) { evById[e.id] = e; });
  var conImagen = function (id) {
    var e = evById[id], f = H.fichas[id];
    if (e && e.img) return { titulo: e.titulo, img: e.img };
    if (f && f.img) return { titulo: f.nombre, img: f.img };
    return null;
  };

  // ---------------------------------------------------------------- Portada: fondo en movimiento (bucle continuo)
  var bucle = null, hero = $('#inicio');
  function portada() {
    var fondo = $('.hero-fondo'), cred = $('#hero-credito');
    if (!fondo) return;
    var tomas = ['rapa-nui-y-los-moai', 'proclamacion-de-la-independencia', 'combate-naval-de-iquique', 'centenario-de-la-independencia', 'desierto-de-atacama']
      .map(conImagen).filter(Boolean);
    if (!tomas.length) return;
    // La primera toma se repite al final (mismo encuadre): el bucle nunca pasa por negro ni corta.
    var lista = tomas.concat([tomas[0]]).map(function (t) {
      var d = document.createElement('div');
      d.className = 'hero-toma';
      d.innerHTML = '<img src="' + t.img.src + '" alt="" decoding="async">';
      fondo.appendChild(d);
      return { titulo: t.titulo, img: t.img, el: d };
    });
    var credito = function (t) { cred.textContent = t.titulo + ' · ' + t.img.autor.replace(/&amp;/g, '&') + ' · ' + t.img.lic; };
    credito(lista[0]);
    var tl = null;
    // Con movimiento reducido (p. ej. Windows con «Efectos de animación» apagado) el fondo no hace zoom
    // ni paneo, pero sigue vivo: fundidos lentos entre tomas, que no provocan mareo.
    function armar() {
      if (bucle) bucle.kill();
      if (tl) tl.kill();
      var quieto = rm(), D = quieto ? 9 : 7, X = quieto ? 2.6 : 1.8, n = lista.length - 1;
      lista.forEach(function (t, i) { G.set(t.el, { opacity: i ? 0 : 1 }); G.set(t.el.firstChild, { clearProps: 'transform' }); });
      credito(lista[0]);
      tl = G.timeline({ paused: true });
      lista.forEach(function (t, i) {
        var p = i * D, k = i === n ? 0 : i; // la copia final repite el movimiento de la primera
        if (i) tl.fromTo(t.el, { opacity: 0 }, { opacity: 1, duration: X, ease: 'none', immediateRender: false }, p);
        if (!quieto) tl.fromTo(t.el.firstChild, { scale: 1.16, xPercent: k % 2 ? -2.5 : 2.5 }, { scale: 1.02, xPercent: 0, duration: D + X, ease: 'none', immediateRender: i === 0 }, p);
        if (i) {
          tl.call(credito, [t], p + X / 2);                          // el crédito cambia a mitad del fundido
          tl.set(lista[i - 1].el, { opacity: 0 }, p + X);            // la toma anterior se retira ya cubierta
        }
      });
      // Recorre de «toma 0 ya visible» a «su copia ya visible»: inicio y fin son el mismo cuadro.
      bucle = tl.tweenFromTo(X, n * D + X, { repeat: -1, ease: 'none', paused: true });
    }
    armar();
    var pausado = leer('fondo-pausado') === '1';
    var boton = $('#hero-pausa');
    var aplicar = function (visible) {
      var corre = visible && !pausado;
      if (corre) bucle.play(); else bucle.pause();
      hero.classList.toggle('quieta', !corre);
    };
    var visible = true;
    if (boton) {
      boton.setAttribute('aria-pressed', String(pausado));
      boton.textContent = pausado ? 'Reanudar fondo' : 'Pausar fondo';
      boton.addEventListener('click', function () {
        pausado = !pausado; guardar('fondo-pausado', pausado ? '1' : '0');
        boton.setAttribute('aria-pressed', String(pausado));
        boton.textContent = pausado ? 'Reanudar fondo' : 'Pausar fondo';
        aplicar(visible);
      });
    }
    ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: function (s) { visible = s.isActive; aplicar(visible); } });
    aplicar(true);
    // Al bajar: el fundido al papel siempre (es solo opacidad); el paralaje solo con movimiento completo.
    G.to('.hero-fundido', { opacity: 1, ease: 'none', scrollTrigger: { trigger: hero, start: 'center top', end: 'bottom top+=64', scrub: true } });
    var paralaje = [];
    function setParalaje(on) {
      paralaje.forEach(function (t) { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); });
      paralaje = [];
      G.set(['.hero-in', '.hero-fondo'], { clearProps: 'transform,opacity' });
      if (!on) return;
      // Salida: el texto sube y se desvanece (antes de quedar bajo la barra) y el fondo se aleja más lento.
      paralaje.push(G.to('.hero-in', { yPercent: -14, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 } }));
      paralaje.push(G.to('.hero-in', { opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '45% top', scrub: 0.4 } }));
      paralaje.push(G.to('.hero-fondo', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } }));
    }
    setParalaje(!rm());
    // Cambio de ajuste en el menú: el fondo se rearma al tiro, sin recargar.
    document.addEventListener('movimiento', function () { armar(); aplicar(visible); setParalaje(!rm()); });
  }

  // ---------------------------------------------------------------- Portada: una sola coreografía de apertura
  function entrada() {
    // El título y el texto se ven desde el primer cuadro (el resto del texto entra con CSS). GSAP solo dibuja el mapa.
    if (rm()) return;
    var tierra = document.querySelectorAll('#hero-svg .h-tierra');
    if (!tierra.length) return;
    // Puntos de norte a sur: se lee como un travelling por el país.
    var puntos = [].slice.call(document.querySelectorAll('#hero-svg .h-punto')).sort(function (a, b) { return a.getAttribute('cy') - b.getAttribute('cy'); });
    var tl = G.timeline({ defaults: { ease: 'salida' } });
    tl.fromTo(tierra, { drawSVG: '0%', fillOpacity: 0 }, { drawSVG: '100%', duration: 1.6, ease: 'power2.inOut', stagger: 0.04 }, 0.15)
      .to(tierra, { fillOpacity: 1, duration: 1, ease: 'none' }, 1.3)
      .fromTo(puntos, { opacity: 0, scale: 0.5, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.5, stagger: 0.02 }, 1.5)
      .from('.hero-pie', { opacity: 0, duration: 0.8 }, 1.6);
    // Respaldo: si el navegador no anima (pestaña oculta), todo queda en su estado final.
    setTimeout(function () { if (tl.progress() < 1) tl.progress(1); }, 3500);
  }

  // ---------------------------------------------------------------- Escenas al hacer scroll
  function escenas() {
    if (rm()) return;
    G.utils.toArray('.periodos h2, .maestros h2, .niveles-t').forEach(function (h) {
      var st = SplitText.create(h, { type: 'lines', mask: 'lines' });
      G.from(st.lines, { yPercent: 105, duration: 1, ease: 'cajon', stagger: 0.08, scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
    });
    [['.per-card', 0.08], ['.maestros .nota, .nivel', 0.06]].forEach(function (l) {
      var els = G.utils.toArray(l[0]);
      if (!els.length) return;
      G.set(els, { opacity: 0, y: 46 });
      ScrollTrigger.batch(els, {
        start: 'top 92%', once: true,
        onEnter: function (b) { G.to(b, { opacity: 1, y: 0, duration: 0.9, ease: 'salida', stagger: l[1], overwrite: true, clearProps: 'transform,opacity' }); }
      });
      setTimeout(function () { els.forEach(function (el) { if (+getComputedStyle(el).opacity === 0 && el.getBoundingClientRect().top < innerHeight) G.set(el, { clearProps: 'transform,opacity' }); }); }, 3000);
    });
    G.utils.toArray('.per-img img').forEach(function (img) {
      G.fromTo(img, { scale: 1.12 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    var crono = $('#crono');
    if (crono) {
      var tl = G.timeline({ paused: true, defaults: { ease: 'salida' } });
      tl.from('.banda', { scaleX: 0, transformOrigin: '0 50%', duration: 0.9, stagger: 0.05 }, 0)
        .from('.eje-puntos i', { opacity: 0, scale: 0.5, duration: 0.4, stagger: 0.008, clearProps: 'transform,opacity' }, 0.3)
        .from('.eje-siglos span', { opacity: 0, y: 6, duration: 0.5, stagger: 0.03 }, 0.2)
        .from('.crono-lente, .crono-det', { opacity: 0, y: 14, duration: 0.8 }, 0.6);
      ScrollTrigger.create({ trigger: crono, start: 'top 85%', once: true, onEnter: function () { tl.play(); } });
      setTimeout(function () { if (!tl.isActive() && tl.progress() < 1 && crono.getBoundingClientRect().top < innerHeight) tl.progress(1); }, 3500);
    }
  }

  // ---------------------------------------------------------------- Sala de cine: se apagan las luces, las barras enmarcan
  var cine = $('#cine'), video = $('#cine-video'), titulo = $('#cine-t');
  function abrirRelato(e) {
    if (!e || !e.relato) return;
    titulo.textContent = e.titulo;
    $('#cine-aviso').textContent = e.relato.aviso || '';
    // En pantallas verticales se usa la versión 9:16 si existe.
    var vertical = !!e.relato.vertical && window.matchMedia('(max-aspect-ratio: 4/5)').matches;
    cine.classList.toggle('vertical', vertical);
    video.src = vertical ? e.relato.vertical : e.relato.src;
    video.poster = e.relato.poster || '';
    // Subtítulos activables (WebVTT), no quemados en la imagen.
    [].slice.call(video.querySelectorAll('track')).forEach(function (t) { t.remove(); });
    if (e.relato.vtt) {
      var tr = document.createElement('track');
      tr.kind = 'subtitles'; tr.srclang = 'es'; tr.label = 'Español'; tr.src = e.relato.vtt; tr.default = true;
      video.appendChild(tr);
    }
    // Transcripción completa del guion (accesible e indexable).
    var trans = $('#cine-trans'), lineas = e.relato.transcripcion || [];
    if (trans) { trans.hidden = !lineas.length; trans.open = false; $('#cine-trans-t').innerHTML = lineas.map(function (l) { return '<p>' + l + '</p>'; }).join(''); }
    // La sala se abre sobre la lámina (si está abierta): al cerrar el relato se vuelve a ella, con el foco en su botón.
    cine.showModal();
    G.set(titulo, { opacity: 1 });
    var arranca = function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); };
    if (rm()) { G.fromTo('.cine-velo', { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'none' }); arranca(); return; }
    G.timeline({ defaults: { ease: 'cajon' } })
      .fromTo('.cine-velo', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none' }, 0)
      .fromTo('.cine-barra', { scaleY: 0 }, { scaleY: 1, duration: 0.7 }, 0.1)
      .fromTo('.cine-escena', { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'salida' }, 0.45)
      .fromTo([titulo, '#cine-aviso'], { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'none' }, 0.6);
    setTimeout(arranca, 750);
  }
  function cerrarRelato() {
    video.pause();
    if (rm()) {
      G.to('.cine-velo', { opacity: 0, duration: 0.18, ease: 'none', onComplete: function () { if (cine.open) cine.close(); } });
      setTimeout(function () { if (cine.open) cine.close(); }, 300);
      return;
    }
    G.timeline({ onComplete: function () { if (cine.open) cine.close(); } })
      .to(['.cine-escena', titulo, '#cine-aviso'], { opacity: 0, duration: 0.22, ease: 'power2.in' }, 0)
      .to('.cine-barra', { scaleY: 0, duration: 0.28, ease: 'power2.in' }, 0.04)
      .to('.cine-velo', { opacity: 0, duration: 0.3, ease: 'none' }, 0.1);
    setTimeout(function () { if (cine.open) cine.close(); }, 500);
  }
  if (cine) {
    $('#cine-cerrar').addEventListener('click', cerrarRelato);
    cine.addEventListener('cancel', function (ev) { ev.preventDefault(); cerrarRelato(); });
    cine.addEventListener('close', function () { video.pause(); G.set(['.cine-escena', '.cine-barra', '.cine-velo', titulo, '#cine-aviso'], { clearProps: 'all' }); });
    // El título se retira al empezar la proyección (sigue siendo la etiqueta accesible del diálogo).
    video.addEventListener('play', function () { if (!rm()) G.to(titulo, { opacity: 0, duration: 0.8, delay: 1.2, ease: 'none' }); });
    video.addEventListener('pause', function () { G.to(titulo, { opacity: 1, duration: 0.3, ease: 'none' }); });
  }
  var destacado = evById['combate-naval-de-iquique'] && evById['combate-naval-de-iquique'].relato ? evById['combate-naval-de-iquique'] : H.eventos.filter(function (e) { return e.relato; })[0];
  if (destacado && $('#hero-relato')) {
    $('#hero-relato-t').textContent = destacado.titulo;
    $('#hero-relato').hidden = false;
    $('#hero-relato').addEventListener('click', function () { abrirRelato(destacado); });
  }

  // Encabezado oscuro (degradado) mientras la portada está detrás.
  var barra = $('.barra');
  if (barra && hero) ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top+=72', onToggle: function (s) { barra.classList.toggle('sobre-portada', s.isActive); } });

  window.Cine = { abrirRelato: abrirRelato };
  portada();
  entrada();
  escenas();
})();
