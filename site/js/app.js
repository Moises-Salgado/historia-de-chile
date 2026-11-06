/* Historia de Chile · lógica de la página. Scripts clásicos: funciona abriendo index.html. Movimiento con GSAP (local). */
(function () {
  'use strict';
  var H = window.HISTORIA, $ = function (s) { return document.querySelector(s); };
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var G = window.gsap || null;
  if (G && window.CustomEase) {
    G.registerPlugin(window.CustomEase);
    window.CustomEase.create('salida', '0.23,1,0.32,1'); // = --ease-out
    window.CustomEase.create('cajon', '0.32,0.72,0,1'); // = --ease-drawer
  }
  // Las animaciones siguen el reloj real: si la página se traba, terminan a tiempo en vez de alargarse.
  if (G) G.ticker.lagSmoothing(0);
  var periodos = H.periodos, eventos = H.eventos;
  var evById = {}, perById = {}, terById = {}, vecinos = {}, nodoNombre = {};
  eventos.forEach(function (e, i) { e.i = i; evById[e.id] = e; });
  periodos.forEach(function (p, i) { p.i = i; perById[p.id] = p; });
  H.territorios.forEach(function (t) { terById[t.id] = t; });
  H.grafo.nodos.forEach(function (n) { vecinos[n.id] = []; nodoNombre[n.id] = n; });
  H.grafo.enlaces.forEach(function (e) {
    var a = H.grafo.nodos[e[0]].id, b = H.grafo.nodos[e[1]].id;
    vecinos[a].push(b); vecinos[b].push(a);
  });
  var fmt = window.Mapa.fmtAnio;
  var estado = { modo: 'adultos', periodo: null, evento: null, region: -1 };
  var instantaneo = false; // true en acciones de teclado y al cargar: no se anima nada.
  var mueve = function () { return !!G && !reduce.matches && !instantaneo; };
  var desliza = function () { return reduce.matches ? 'auto' : 'smooth'; };
  var flechaIzq = '<svg class="flecha" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 5l-5 5 5 5"/></svg>';
  var flechaDer = '<svg class="flecha" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5l5 5-5 5"/></svg>';

  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function slug(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function corto(t) {
    return t.replace('Poblamiento y pueblos originarios', 'Pueblos originarios').replace('Descubrimiento y Conquista', 'Conquista')
      .replace('Organización de la República', 'Organización').replace('Recuperación de la democracia', 'Democracia')
      .replace('Dictadura militar', 'Dictadura').replace(/^República /, 'Rep. ');
  }
  // Cambio de contenido: sale rápido, entra con subida corta; las tarjetas entran escalonadas.
  function cruzar(nodo, cambio) {
    if (!mueve() || !nodo) { cambio(); return; }
    G.killTweensOf(nodo);
    clearTimeout(nodo._cruce);
    G.to(nodo, { opacity: 0, y: -6, duration: 0.14, ease: 'power1.in' });
    nodo._cruce = setTimeout(function () {
      G.killTweensOf(nodo);
      cambio();
      G.fromTo(nodo, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.34, ease: 'salida', clearProps: 'opacity,transform' });
      var cards = nodo.querySelectorAll('.ev-card');
      if (cards.length) G.from(cards, { opacity: 0, y: 12, duration: 0.42, ease: 'salida', stagger: 0.03, delay: 0.05, clearProps: 'opacity,transform' });
    }, 140);
  }

  // ---------------------------------------------------------------- Imágenes con crédito
  var limpiar = function (s) { return String(s).replace(/\.\s*$/, ''); };
  function credito(img) { return '<a href="' + img.url + '" target="_blank" rel="noopener">' + img.autor + ' · ' + img.lic + '</a>'; }
  // Marco de la imagen: en obras verticales, detrás va la misma obra difuminada (no se recorta el original).
  function marco(img, extra) { return '<span class="marco"' + (img.v ? ' style="--fondo:url(' + new URL(img.src, document.baseURI).href + ')"' : '') + '>' + (extra || ''); }
  function figura(img, clase, extra) {
    return '<figure class="' + clase + (img.v ? ' vertical' : '') + '">' + marco(img, extra) +
      '<img src="' + img.src + '" alt="' + img.pie + '" width="' + img.w + '" height="' + img.h + '" decoding="async"></span>' +
      '<figcaption>' + limpiar(img.pie) + '. <span class="credito">' + credito(img) + '</span></figcaption></figure>';
  }

  // ---------------------------------------------------------------- Versión (niños / adultos / maestros)
  var modoBtns = [].slice.call(document.querySelectorAll('.modo button'));
  var pista = $('.modo-pista');
  function moverPista(m) {
    var b = modoBtns.filter(function (x) { return x.dataset.modo === (m || estado.modo); })[0];
    if (!b) return;
    pista.style.width = b.offsetWidth + 'px';
    pista.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  }
  function setModo(m, animar) {
    if (['ninos', 'adultos', 'maestros'].indexOf(m) < 0) m = 'adultos';
    var aplicar = function () {
      estado.modo = m; root.dataset.modo = m;
      modoBtns.forEach(function (b) { var on = b.dataset.modo === m; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
      document.querySelectorAll('.modo-card').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.elegir === m)); });
      moverPista(); guardar('modo', m);
    };
    if (animar) { moverPista(m); cruzar($('#relato'), aplicar); } else aplicar();
  }
  modoBtns.forEach(function (b) {
    b.addEventListener('click', function () { setModo(b.dataset.modo, true); });
    b.addEventListener('keydown', function (ev) {
      var i = modoBtns.indexOf(b), d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      ev.preventDefault(); ev.stopPropagation();
      var n = modoBtns[(i + d + modoBtns.length) % modoBtns.length]; n.focus(); setModo(n.dataset.modo, false);
    });
  });
  document.querySelectorAll('.modo-card').forEach(function (c) {
    c.addEventListener('click', function () { setModo(c.dataset.elegir, false); $('#explorar').scrollIntoView({ behavior: desliza() }); });
  });
  window.addEventListener('resize', function () { moverPista(); });
  if (document.fonts) document.fonts.ready.then(function () { moverPista(); });

  // ---------------------------------------------------------------- Relato: periodo o región
  var relato = $('#relato');
  function tarjeta(e, conPeriodo) {
    var mini = e.img ? '<img src="' + e.img.mini + '" alt="" loading="lazy" decoding="async"' + (e.img.v ? ' class="v"' : '') + '>' : '';
    return '<li><button class="ev-card" type="button" data-ev="' + e.id + '"' + (estado.evento === e.id ? ' aria-current="true"' : '') + '>' +
      '<span class="ev-mini' + (e.img ? '' : ' vacia') + '">' + mini + '</span>' +
      '<span class="ev-txt"><span class="ev-t">' + e.titulo + '</span>' +
      '<span class="ev-f">' + (conPeriodo ? corto(perById[e.periodo].titulo) + ' · ' : '') + e.fecha + '</span></span>' + flechaDer + '</button></li>';
  }
  function renderPeriodo(p) {
    var media = '';
    if (p.img) {
      var play = p.video ? '<button class="ver-video" type="button" data-video="' + p.video + '"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5l9 5.5-9 5.5z"/></svg><span>Ver el resumen en video</span></button>' : '';
      media = figura(p.img, 'per-fig', play);
    }
    relato.innerHTML =
      '<header class="periodo-cab">' + media +
        '<h2>' + p.titulo + '</h2>' +
        '<p class="periodo-rango">' + p.rango + ' <span class="muted">· periodo ' + (p.i + 1) + ' de ' + periodos.length + '</span></p>' +
        '<div class="periodo-resumen"><div class="v-ninos">' + p.ninos + '</div><div class="v-adultos">' + p.adultos + '</div>' +
        '<div class="v-maestros">' + p.adultos + (p.maestros ? '<div class="maestro">' + p.maestros + '</div>' : '') + '</div></div>' +
      '</header>' +
      '<h3 class="lista-t">' + p.eventos.length + ' momentos clave</h3>' +
      '<ol class="ev-lista">' + p.eventos.map(function (id) { return tarjeta(evById[id]); }).join('') + '</ol>';
  }
  function renderRegion(r) {
    var evs = r.eventos.map(function (id) { return evById[id]; }).sort(function (a, b) { return a.i - b.i; });
    var p = perById[estado.periodo], n = evs.length;
    relato.innerHTML =
      '<header class="periodo-cab region-cab">' +
        '<button class="volver" type="button" data-volver>' + flechaIzq + '<span>Volver a ' + corto(p.titulo) + '</span></button>' +
        '<h2>' + r.nombre + '</h2>' +
        '<p class="periodo-rango">' + (n ? n + (n === 1 ? ' momento' : ' momentos') : 'Sin momentos aún') + ' <span class="muted">· capital: ' + r.capital + '</span></p>' +
        '<p class="region-lead">' + (n ? 'Lo que pasó en el territorio que hoy forma esta región, de lo más antiguo a lo más reciente.' : 'Aún no hay momentos ubicados aquí. Prueba con otra región del mapa.') + '</p>' +
      '</header>' +
      '<ol class="ev-lista">' + evs.map(function (e) { return tarjeta(e, true); }).join('') + '</ol>';
  }
  function marcarTarjetas() {
    relato.querySelectorAll('.ev-card').forEach(function (c) {
      if (c.dataset.ev === estado.evento) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
  }
  function verVideo(b) {
    var fig = b.closest('figure'), img = fig.querySelector('img');
    var v = document.createElement('video');
    v.src = b.dataset.video; v.controls = true; v.playsInline = true; v.poster = img.src; v.className = 'per-video';
    v.setAttribute('aria-label', 'Resumen en video: ' + perById[estado.periodo].titulo);
    img.replaceWith(v); b.remove();
    var pr = v.play(); if (pr && pr.catch) pr.catch(function () { /* el usuario puede darle play */ });
  }
  relato.addEventListener('click', function (ev) {
    var c = ev.target.closest('.ev-card');
    if (c) { seleccionar(evById[c.dataset.ev], { abrir: true, origen: c.querySelector('img') || c.querySelector('.ev-mini'), camara: estado.region < 0 }); return; }
    if (ev.target.closest('[data-volver]')) { salirRegion(); return; }
    var v = ev.target.closest('.ver-video'); if (v) verVideo(v);
  });

  // ---------------------------------------------------------------- Selección y navegación
  function setAnioMapa(a, p) {
    window.Mapa.setAnio(a);
    $('#mapa-anio').textContent = fmt(a);
    $('#mapa-era').textContent = corto(p.titulo);
  }
  function periodoDe(a) { for (var i = periodos.length - 1; i >= 0; i--) if (a >= periodos[i].inicio) return periodos[i]; return periodos[0]; }
  function grupoActual(p) { return estado.region >= 0 ? window.Mapa.region(estado.region).eventos : p.eventos; }

  function seleccionar(e, o) {
    o = o || {};
    var p = perById[e.periodo], cambiaPer = estado.periodo !== p.id;
    estado.evento = e.id;
    estado.periodo = p.id;
    window.Crono.setPeriodo(p, true);
    window.Crono.setEvento(e, true);
    if (cambiaPer && estado.region < 0) cruzar(relato, function () { renderPeriodo(p); });
    else marcarTarjetas();
    setAnioMapa(e.anio, p);
    window.Mapa.marcar(e, grupoActual(p));
    if (o.camara !== false && estado.region < 0) window.Mapa.enfocar(e, instantaneo ? 0 : 650, p.eventos.map(function (id) { return evById[id]; }));
    history.replaceState(null, '', '#evento/' + e.id);
    if (o.abrir || lam.open) abrirLamina(e, o.origen, o.dir);
  }
  function irPeriodo(p, o) {
    o = o || {};
    var redibujar = estado.periodo !== p.id || estado.region >= 0 || !relato.childElementCount;
    if (estado.region >= 0) { estado.region = -1; window.Mapa.resaltarRegion(-1); }
    estado.periodo = p.id;
    window.Crono.setPeriodo(p, true);
    var primero = evById[p.eventos[0]];
    if (primero) estado.evento = primero.id;
    if (redibujar) cruzar(relato, function () { renderPeriodo(p); });
    if (primero) { window.Crono.setEvento(primero, true); setAnioMapa(primero.anio, p); window.Mapa.marcar(primero, p.eventos); }
    else setAnioMapa(p.inicio, p);
    window.Mapa.encuadrarEventos(p.eventos.map(function (id) { return evById[id]; }), instantaneo ? 0 : 700);
    if (!o.sinRuta) history.replaceState(null, '', '#periodo/' + p.id);
  }
  function irRegion(i) {
    var r = window.Mapa.region(i); if (!r) return;
    estado.region = i;
    cruzar(relato, function () { renderRegion(r); });
    window.Mapa.resaltarRegion(i);
    window.Mapa.encuadrarRegion(i, instantaneo ? 0 : 700);
    var e = evById[estado.evento];
    window.Mapa.marcar(e && r.eventos.indexOf(e.id) >= 0 ? e : null, r.eventos);
    history.replaceState(null, '', '#region/' + slug(r.corto));
    // En pantallas angostas la lista queda bajo el mapa fijo: se lleva a la vista.
    if (window.matchMedia('(max-width: 900px)').matches) setTimeout(function () { relato.scrollIntoView({ behavior: desliza(), block: 'start' }); }, 180);
  }
  function salirRegion() {
    var p = perById[estado.periodo], e = evById[estado.evento];
    estado.region = -1;
    window.Mapa.resaltarRegion(-1);
    if (e && e.periodo !== p.id) e = null;
    cruzar(relato, function () { renderPeriodo(p); });
    window.Mapa.marcar(e, p.eventos);
    window.Mapa.encuadrarEventos(p.eventos.map(function (id) { return evById[id]; }), instantaneo ? 0 : 700);
    history.replaceState(null, '', '#periodo/' + p.id);
  }
  function secuencia() {
    if (estado.region < 0) return eventos;
    return window.Mapa.region(estado.region).eventos.map(function (id) { return evById[id]; }).sort(function (a, b) { return a.i - b.i; });
  }
  function vecinoDe(e, d) { var s = secuencia(), k = s.indexOf(e); return k < 0 ? null : s[k + d] || null; }
  function paso(d, teclado) {
    var e = evById[estado.evento]; if (!e) return;
    var n = vecinoDe(e, d); if (!n) return;
    instantaneo = !!teclado; seleccionar(n, { dir: d }); instantaneo = false;
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey || $('#ficha').open) return;
    if (/input|textarea|select|video/i.test(ev.target.tagName)) return;
    var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    if (!lam.open) { var r = $('#explorar').getBoundingClientRect(); if (r.bottom < 120 || r.top > window.innerHeight - 120) return; }
    ev.preventDefault(); paso(d, true);
  });

  // ---------------------------------------------------------------- Lámina del momento (se abre desde su miniatura)
  var lam = $('#lamina'), lamPanel = $('#lam-panel'), lamVelo = lam.querySelector('.lam-velo'), ubicar = window.Mapa.localizador($('#lam-mapa')), cierres = 0;
  function pasoBtn(b, e, izq) {
    b.hidden = !e;
    if (!e) return;
    b.innerHTML = (izq ? flechaIzq : '') + '<span><small>' + (izq ? 'Anterior' : 'Siguiente') + ' · ' + fmt(e.anio) + '</small>' + e.titulo + '</span>' + (izq ? '' : flechaDer);
  }
  function llenarLamina(e) {
    var p = perById[e.periodo], fig = $('#lam-fig');
    fig.innerHTML = e.img ? marco(e.img) + '<img id="lam-img" src="' + e.img.src + '" alt="' + e.img.pie + '" width="' + e.img.w + '" height="' + e.img.h + '"></span>' +
      '<figcaption>' + limpiar(e.img.pie) + '. <span class="credito">' + credito(e.img) + '</span></figcaption>' : '';
    fig.hidden = !e.img;
    fig.classList.toggle('vertical', !!(e.img && e.img.v));
    lamPanel.classList.toggle('sin-img', !e.img);
    $('#lam-t').textContent = e.titulo;
    $('#lam-meta').innerHTML = '<span>' + e.fecha + '</span><a href="#periodo/' + p.id + '" data-ref="' + p.id + '">' + p.titulo + '</a>' +
      (e.nivel ? '<span class="chip chip-nivel v-maestros">' + e.nivel + '</span>' : '');
    $('#lam-texto').innerHTML =
      '<div class="v-ninos">' + e.ninos + (e.dato ? '<div class="dato"><b>¿Sabías que?</b>' + e.dato + '</div>' : '') + '</div>' +
      '<div class="v-adultos">' + e.adultos + '</div>' +
      '<div class="v-maestros">' + e.adultos + (e.maestros ? '<div class="maestro">' + e.maestros + '</div>' : '') +
        '<p class="lam-acc"><button class="btn btn-sec imprimir" type="button">Imprimir lámina</button></p></div>';
    ubicar(e);
    var lugar = e.lugar && H.fichas[e.lugar], r = window.Mapa.region(window.Mapa.regionDeEvento(e.id));
    $('#lam-donde').innerHTML = (lugar ? '<a class="ref" href="#ficha/' + e.lugar + '" data-ref="' + e.lugar + '">' + lugar.nombre + '</a>' : '') +
      (r ? '<span>' + r.nombre + '</span>' : '<span>Sin un lugar único</span>');
    $('#lam-gente').innerHTML = e.personajes.map(function (id) {
      var f = H.fichas[id]; if (!f) return '';
      return '<li><a class="persona" href="#ficha/' + id + '" data-ref="' + id + '">' +
        (f.img ? '<img src="' + f.img.mini + '" alt="" loading="lazy" decoding="async">' : '<span class="persona-sin" aria-hidden="true"></span>') +
        '<span>' + f.nombre + '</span></a></li>';
    }).join('');
    pasoBtn($('#lam-ant'), vecinoDe(e, -1), true);
    pasoBtn($('#lam-sig'), vecinoDe(e, 1), false);
  }
  function abrirLamina(e, origen, dir) {
    if (lam.open) {
      // Paso dentro de la lámina: fundido direccional breve; con teclado, directo.
      var partes = [$('#lam-fig'), lamPanel.querySelector('.lam-cuerpo')];
      if (!mueve()) { G && G.killTweensOf(partes); llenarLamina(e); lamPanel.scrollTop = 0; return; }
      G.killTweensOf(partes);
      clearTimeout(lam._paso);
      G.to(partes, { opacity: 0, x: -14 * (dir || 1), duration: 0.13, ease: 'power1.in' });
      lam._paso = setTimeout(function () {
        G.killTweensOf(partes);
        llenarLamina(e); lamPanel.scrollTop = 0;
        G.fromTo(partes, { opacity: 0, x: 14 * (dir || 1) }, { opacity: 1, x: 0, duration: 0.32, ease: 'salida', clearProps: 'opacity,transform' });
      }, 130);
      return;
    }
    cierres++; // anula un cierre pendiente
    llenarLamina(e);
    lam.showModal();
    lamPanel.scrollTop = 0;
    if (!mueve()) return;
    var img = $('#lam-img'), r0 = origen && origen.getBoundingClientRect ? origen.getBoundingClientRect() : null;
    var r1 = img && img.getBoundingClientRect(); // se mide antes de mover el panel
    var tl = G.timeline({ defaults: { ease: 'salida' } });
    tl.fromTo(lamVelo, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'none' }, 0)
      .from(lamPanel, { opacity: 0, y: 36, scale: 0.975, duration: 0.6, clearProps: 'opacity,transform' }, 0.02);
    if (img && r0 && r0.width && r1.width) {
      // La miniatura (o el punto del mapa) vuela y se convierte en la imagen principal.
      var f = document.createElement('img');
      f.className = 'lam-fantasma'; f.alt = ''; f.src = (origen.tagName === 'IMG' && origen.currentSrc) || e.img.mini;
      lam.appendChild(f);
      var circular = origen.tagName.toLowerCase() === 'circle' || !!origen.closest('.hito, .persona');
      G.set(f, { left: r0.left, top: r0.top, width: r0.width, height: r0.height, borderRadius: circular ? r0.width / 2 : 8 });
      G.set(img, { opacity: 0 });
      tl.to(f, { left: r1.left, top: r1.top, width: r1.width, height: r1.height, borderRadius: 14, duration: 0.72 }, 0)
        .to(img, { opacity: 1, duration: 0.2, ease: 'none', clearProps: 'opacity' }, 0.58)
        .add(function () { f.remove(); }, 0.8);
      setTimeout(function () { f.remove(); G.set(img, { clearProps: 'opacity' }); }, 1000);
    }
    tl.from(lamPanel.querySelectorAll('.lam-cab > *, .lam-grid > *, .lam-pasos'), { opacity: 0, y: 16, duration: 0.5, stagger: 0.05, clearProps: 'opacity,transform' }, 0.24);
  }
  function cerrarLamina(sinAnim) {
    if (!lam.open) return;
    lam.querySelectorAll('.lam-fantasma').forEach(function (f) { f.remove(); });
    var cerrar = function () {
      if (G) { G.killTweensOf([lamPanel, lamVelo]); G.set([lamPanel, lamVelo], { clearProps: 'opacity,transform' }); }
      if (lam.open) lam.close();
    };
    if (sinAnim || !mueve()) { cerrar(); return; }
    G.timeline({ defaults: { ease: 'power2.in' }, onComplete: cerrar })
      .to(lamPanel, { opacity: 0, y: 18, scale: 0.985, duration: 0.2 }, 0)
      .to(lamVelo, { opacity: 0, duration: 0.24, ease: 'none' }, 0);
    var n = ++cierres;
    setTimeout(function () { if (n === cierres) cerrar(); }, 320); // respaldo: cerrar nunca depende de un cuadro de animación
  }
  $('#lam-cerrar').addEventListener('click', function () { cerrarLamina(); });
  lam.addEventListener('cancel', function (ev) { ev.preventDefault(); cerrarLamina(); });
  lam.addEventListener('click', function (ev) {
    if (ev.target === lam || ev.target === lamVelo) { cerrarLamina(); return; }
    if (ev.target.closest('.imprimir')) window.print();
  });
  $('#lam-ant').addEventListener('click', function () { paso(-1); });
  $('#lam-sig').addEventListener('click', function () { paso(1); });

  // ---------------------------------------------------------------- Ficha lateral (personajes, lugares, pueblos, capas)
  var dlg = $('#ficha');
  var TIPO = { personaje: 'Personaje', lugar: 'Lugar', pueblo: 'Pueblo originario', territorio: 'Capa del mapa', evento: 'Evento', periodo: 'Periodo' };
  function abrirRef(id) {
    if (evById[id]) { if (dlg.open) dlg.close(); seleccionar(evById[id], { abrir: true }); return; }
    if (perById[id]) {
      if (dlg.open) dlg.close(); cerrarLamina(true);
      irPeriodo(perById[id]); $('#explorar').scrollIntoView({ behavior: desliza() }); return;
    }
    var f = H.fichas[id], t = terById[id];
    if (!f && !t) return;
    $('#ficha-fig').innerHTML = f && f.img ? figura(f.img, 'ficha-fig' + (f.tipo === 'personaje' ? ' retrato' : '')) : '';
    $('#ficha-t').textContent = f ? f.nombre : t.nombre;
    $('#ficha-sub').textContent = TIPO[f ? f.tipo : 'territorio'] + ' · ' + (f ? f.sub : t.fases.map(function (x) { return x[3] + ' (' + fmt(x[0]) + '–' + (x[1] >= 9999 ? 'hoy' : fmt(x[1])) + ')'; }).join(' · '));
    $('#ficha-cuerpo').innerHTML = f ? (estado.modo === 'ninos' && f.ninos ? '<p>' + f.ninos + '</p>' : f.html + (f.ninos && estado.modo === 'maestros' ? '<aside class="callout"><p class="callout-title">Para niños</p><p>' + f.ninos + '</p></aside>' : '')) : t.texto;
    var con = (vecinos[id] || []).slice().sort(function (a, b) {
      var ea = evById[a], eb = evById[b];
      return (ea ? 0 : 1) - (eb ? 0 : 1) || (ea && eb ? ea.i - eb.i : 0);
    });
    $('#ficha-con').innerHTML = con.map(function (v) {
      var n = nodoNombre[v], e = evById[v];
      return '<li><a class="chip" href="#ficha/' + v + '" data-ref="' + v + '">' + (e ? fmt(e.anio) + ' · ' : '') + n.n + '</a></li>';
    }).join('') || '<li class="muted">Sin conexiones aún.</li>';
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    if (!lam.open) history.replaceState(null, '', '#ficha/' + id);
  }
  $('#ficha-cerrar').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function () { if (estado.evento && !lam.open) history.replaceState(null, '', '#evento/' + estado.evento); });
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('[data-ref]'); if (!a) return;
    ev.preventDefault(); abrirRef(a.dataset.ref);
  });

  // ---------------------------------------------------------------- Periodos, maestros y créditos
  function renderPeriodosGrid() {
    $('#periodos-grid').innerHTML = periodos.map(function (p) {
      return '<li><button class="per-card" type="button" data-per="' + p.id + '">' +
        (p.img ? '<span class="per-img"><img src="' + p.img.src + '" alt="" loading="lazy" decoding="async"' + (p.img.v ? ' class="v"' : '') + '></span>' : '') +
        '<span class="per-n">' + p.rango + '</span>' +
        '<span class="per-t">' + p.titulo + '</span>' +
        '<span class="per-d"><span class="v-ninos">' + p.ninos + '</span><span class="v-adultos">' + p.adultos + '</span><span class="v-maestros">' + p.adultos + '</span></span>' +
        '</button></li>';
    }).join('');
    $('#periodos-grid').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-per]'); if (!b) return;
      irPeriodo(perById[b.dataset.per]);
      $('#explorar').scrollIntoView({ behavior: desliza() });
    });
  }
  function renderNiveles() {
    var orden = ['2° básico', '4° básico', '5° básico', '6° básico', '1° medio', '2° medio'], grupos = {};
    eventos.forEach(function (e) { (grupos[e.nivel] = grupos[e.nivel] || []).push(e); });
    var claves = Object.keys(grupos).sort(function (a, b) { return (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99); });
    $('#niveles').innerHTML = claves.map(function (k) {
      return '<div class="nivel"><h4>' + (k || 'Sin nivel') + ' · ' + grupos[k].length + ' momentos</h4><ul>' +
        grupos[k].map(function (e) { return '<li><a href="#ficha/' + e.id + '" data-ref="' + e.id + '">' + fmt(e.anio) + ' · ' + e.titulo + '</a></li>'; }).join('') +
        '</ul></div>';
    }).join('');
  }
  function renderCreditos() {
    var vistos = {}, items = [];
    var add = function (img) {
      if (!img || vistos[img.url]) return; vistos[img.url] = 1;
      items.push('<li><a href="' + img.url + '" target="_blank" rel="noopener">' + limpiar(img.pie) + '</a>. ' + img.autor + ' · ' +
        (img.licUrl ? '<a href="' + img.licUrl + '" target="_blank" rel="noopener">' + img.lic + '</a>' : img.lic) + '</li>');
    };
    periodos.forEach(function (p) { add(p.img); });
    eventos.forEach(function (e) { add(e.img); });
    Object.keys(H.fichas).forEach(function (k) { add(H.fichas[k].img); });
    $('#creditos-lista').innerHTML = items.join('');
    $('#creditos summary').textContent = 'Créditos de imágenes (' + items.length + ')';
    $('#creditos').hidden = !items.length;
  }

  // ---------------------------------------------------------------- Arranque
  document.querySelectorAll('[data-n]').forEach(function (n) { n.textContent = n.dataset.n === 'eventos' ? eventos.length : periodos.length; });
  $('#generado').textContent = H.generado;
  var q = new URLSearchParams(location.search).get('modo');
  setModo(q || leer('modo') || 'adultos', false);

  window.Mapa.init({ svg: $('#mapa'), tip: $('#tip'), leyenda: $('#leyenda'), onRegion: irRegion });
  window.Mapa.initIslas($('#islas'), function (k) {
    var p = perById[estado.periodo];
    var aqui = function (id) { return window.Mapa.enInset(evById[id]) === k; };
    var id = (p ? p.eventos.filter(aqui)[0] : null) || eventos.map(function (e) { return e.id; }).filter(aqui)[0];
    if (id) seleccionar(evById[id], { abrir: true, origen: document.querySelector('.isla.sel') });
  });
  window.Mapa.setEventos(eventos, function (id, el) { seleccionar(evById[id], { abrir: true, origen: el }); });
  window.Mapa.hero($('#hero-svg'), eventos);
  $('#zoom-mas').addEventListener('click', function () { window.Mapa.zoom(0.6); });
  $('#zoom-menos').addEventListener('click', function () { window.Mapa.zoom(1 / 0.6); });
  $('#zoom-todo').addEventListener('click', function () { window.Mapa.verTodo(); });
  $('#ver-regiones').addEventListener('click', function (ev) { ev.currentTarget.setAttribute('aria-pressed', String(window.Mapa.toggleRegiones())); });

  if (!eventos.length) {
    relato.innerHTML = '<h2>Aún no hay eventos</h2><p class="muted">Escribe notas en <code>segundo-cerebro/Eventos</code> y ejecuta <code>npm run build</code>.</p>';
  } else {
    window.Crono.init({
      cont: $('#crono'), periodos: periodos, eventos: eventos, evById: evById, fmt: fmt, corto: corto,
      instantaneo: function () { return instantaneo; },
      onPeriodo: function (p) { irPeriodo(p); },
      onEvento: function (e, origen, abrir) { seleccionar(e, { abrir: abrir, origen: origen, camara: estado.region < 0 }); },
      onPaso: function (d) { paso(d, true); },
      onScrub: function (a) { setAnioMapa(a, periodoDe(a)); }
    });
    renderPeriodosGrid(); renderNiveles(); renderCreditos();
    instantaneo = true;
    var h = location.hash.match(/^#(evento|periodo|ficha|region)\/(.+)$/);
    var id = h && decodeURIComponent(h[2]);
    if (h && h[1] === 'evento' && evById[id]) seleccionar(evById[id], { abrir: true });
    else if (h && h[1] === 'periodo' && perById[id]) irPeriodo(perById[id]);
    else {
      // Sin ruta propia (o con un ancla de sección como #maestros) no se toca la URL.
      irPeriodo(periodos[0], { sinRuta: true });
      if (h && h[1] === 'ficha') abrirRef(id);
      if (h && h[1] === 'region') {
        for (var i = 0; i < window.Mapa.nRegiones; i++) if (slug(window.Mapa.region(i).corto) === id) irRegion(i);
      }
    }
    instantaneo = false;
    // Rutas escritas a mano o con atrás/adelante (las anclas de sección como #maestros se ignoran).
    window.addEventListener('hashchange', function () {
      var m = location.hash.match(/^#(evento|periodo|ficha|region)\/(.+)$/);
      if (!m) return;
      var k = decodeURIComponent(m[2]);
      if (m[1] === 'evento' && evById[k] && estado.evento !== k) seleccionar(evById[k], { abrir: true });
      else if (m[1] === 'periodo' && perById[k] && (estado.periodo !== k || estado.region >= 0)) { cerrarLamina(true); irPeriodo(perById[k]); }
      else if (m[1] === 'ficha') abrirRef(k);
      else if (m[1] === 'region') {
        for (var j = 0; j < window.Mapa.nRegiones; j++) if (slug(window.Mapa.region(j).corto) === k && estado.region !== j) { cerrarLamina(true); irRegion(j); }
      }
    });
  }

})();
