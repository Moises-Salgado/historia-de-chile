/* Historia de Chile · lógica de la página. Scripts clásicos: funciona abriendo index.html. Movimiento con GSAP (local). */
(function () {
  'use strict';
  var H = window.HISTORIA, $ = function (s) { return document.querySelector(s); };
  var root = document.documentElement;
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var G = window.gsap || null;
  // Movimiento: «auto» sigue al equipo; «completo» o «reducido» lo elige la persona (Menú → Movimiento).
  // Reducido no es «nada»: se quitan vuelos, zoom y desplazamientos, y quedan fundidos breves.
  function prefMov() { var p = leer('movimiento'); return p === 'completo' || p === 'reducido' ? p : 'auto'; }
  function aplicarMov() {
    var p = prefMov(), r = p === 'reducido' || (p === 'auto' && mqReduce.matches);
    var antes = root.classList.contains('rm');
    root.classList.toggle('rm', r);
    if (antes !== r) document.dispatchEvent(new CustomEvent('movimiento', { detail: { reducido: r } }));
  }
  var reducido = function () { return root.classList.contains('rm'); };
  if (mqReduce.addEventListener) mqReduce.addEventListener('change', function () { aplicarMov(); notaMov(); });
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
  var estado = { modo: 'adultos', periodo: null, evento: null, region: -1, ruta: null };
  var instantaneo = false; // true en acciones de teclado y al cargar: no se anima nada.
  var mueve = function () { return !!G && !reducido() && !instantaneo; };   // movimiento completo
  var funde = function () { return !!G && reducido() && !instantaneo; };    // solo fundidos
  var desliza = function () { return reducido() ? 'auto' : 'smooth'; };
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
    if (!nodo || !(mueve() || funde())) { cambio(); return; }
    var suave = funde();
    G.killTweensOf(nodo);
    clearTimeout(nodo._cruce);
    G.to(nodo, suave ? { opacity: 0, duration: 0.12, ease: 'none' } : { opacity: 0, y: -6, duration: 0.14, ease: 'power1.in' });
    nodo._cruce = setTimeout(function () {
      G.killTweensOf(nodo);
      cambio();
      if (suave) { G.fromTo(nodo, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none', clearProps: 'opacity' }); return; }
      G.fromTo(nodo, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.34, ease: 'salida', clearProps: 'opacity,transform' });
      var cards = nodo.querySelectorAll('.ev-card');
      if (cards.length) G.from(cards, { opacity: 0, y: 12, duration: 0.42, ease: 'salida', stagger: 0.03, delay: 0.05, clearProps: 'opacity,transform' });
    }, suave ? 120 : 140);
  }

  // ---------------------------------------------------------------- Historial: Atrás cierra lámina, ficha o región (no saca del sitio)
  // Cada capa abierta por la persona agrega una entrada (pushState); los cambios dentro de una capa la reemplazan.
  // history.state.capa: 'lamina' | 'ficha' | 'region' | 'sel' (evento elegido sin lámina) | 'periodo'.
  var RUTA = /^#(evento|periodo|ficha|region)\/(.+)$/, enRuta = false, ultimaRuta = '';
  var TITULO = document.title;
  function claveRuta() { return location.href + '|' + JSON.stringify(history.state); }
  function escribir(hash, capa, nueva) {
    if (enRuta) return;
    if (nueva) history.pushState({ capa: capa }, '', hash); else history.replaceState({ capa: capa }, '', hash);
    ultimaRuta = claveRuta();
  }
  var capaActual = function () { return history.state && history.state.capa; };
  // Dirección pública para compartir y citar (en file:// se usa la del sitio publicado).
  var PUBLICO = 'https://moises-salgado.github.io/historia-de-chile/';
  function urlDe(hash) { return (/^https?:/.test(location.protocol) ? location.origin + location.pathname : PUBLICO) + hash; }
  function fechaLarga(iso) { var d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function plano(html) { return String(html).replace(/<[^>]+>/g, ''); }

  // Aviso flotante breve. Dentro de un diálogo modal se monta en él (la capa superior tapa todo lo demás).
  var avisoEl = $('#aviso');
  function aviso(msg) {
    if (!avisoEl) return;
    var abierto = document.querySelector('dialog[open]:last-of-type');
    (abierto || document.body).appendChild(avisoEl);
    avisoEl.textContent = msg; avisoEl.classList.add('visible');
    clearTimeout(avisoEl._t); avisoEl._t = setTimeout(function () { avisoEl.classList.remove('visible'); }, 2200);
  }
  function copiar(texto, msg) {
    var hecho = function () { aviso(msg); };
    var manual = function () {
      var t = document.createElement('textarea'); t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      (document.querySelector('dialog[open]') || document.body).appendChild(t); t.select();
      try { document.execCommand('copy'); hecho(); } catch (e) { aviso('No se pudo copiar'); }
      t.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(hecho, manual); else manual();
  }

  // ---------------------------------------------------------------- Imágenes con crédito
  var limpiar = function (s) { return String(s).replace(/\.\s*$/, ''); };
  function credito(img) { return '<a href="' + img.url + '" target="_blank" rel="noopener">' + img.autor + ' · ' + img.lic + '</a>'; }
  // Marco de la imagen: en obras verticales, detrás va la misma obra difuminada (no se recorta el original).
  function marco(img, extra) { return '<span class="marco"' + (img.v ? ' style="--fondo:url(' + new URL(img.src, document.baseURI).href + ')"' : '') + '>' + (extra || ''); }
  function figura(img, clase, extra) {
    return '<figure class="' + clase + (img.v ? ' vertical' : '') + '">' + marco(img, extra) +
      '<img src="' + img.src + '" alt="" width="' + img.w + '" height="' + img.h + '" decoding="async"></span>' +
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
      var hm = $('#hero-modo'); if (hm) hm.textContent = { ninos: 'Niños', adultos: 'Adultos', maestros: 'Maestros' }[m];
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
  // «Cambiar» en la portada lleva al selector de la barra y lo hace notar.
  var cambiar = $('#hero-cambiar');
  if (cambiar) cambiar.addEventListener('click', function () {
    var sel = $('.modo'), b = $('.modo button[aria-checked="true"]');
    if (b) b.focus();
    sel.classList.remove('llama'); void sel.offsetWidth; sel.classList.add('llama');
    setTimeout(function () { sel.classList.remove('llama'); }, 1900);
  });
  window.addEventListener('resize', function () { moverPista(); });

  // ---------------------------------------------------------------- Menú: secciones y ajuste de movimiento
  var menu = $('#menu');
  function notaMov() {
    var n = $('#mov-nota'); if (!n) return;
    n.textContent = mqReduce.matches ? 'tu equipo pide menos movimiento: hoy se ve reducido' : 'sigue el ajuste de tu equipo';
  }
  if (menu) {
    var radios = [].slice.call(menu.querySelectorAll('input[name="movimiento"]'));
    radios.forEach(function (r) {
      r.checked = r.value === prefMov();
      r.addEventListener('change', function () { guardar('movimiento', r.value); aplicarMov(); aviso(r.value === 'completo' ? 'Movimiento completo' : r.value === 'reducido' ? 'Movimiento reducido' : 'Movimiento automático'); });
    });
    notaMov();
    // Modo proyector: con ?clase en la URL o desde el menú; se recuerda en el equipo de la sala.
    var clase = $('#modo-clase');
    var setClase = function (on) { root.classList.toggle('clase', on); clase.checked = on; guardar('clase', on ? '1' : '0'); };
    var qc = new URLSearchParams(location.search).get('clase');
    setClase(qc !== null ? qc !== '0' : leer('clase') === '1');
    clase.addEventListener('change', function () { setClase(clase.checked); aviso(clase.checked ? 'Modo proyector activado' : 'Modo proyector desactivado'); });
    menu.addEventListener('click', function (ev) { if (ev.target.closest('.menu-nav a')) menu.open = false; });
    document.addEventListener('click', function (ev) { if (menu.open && !menu.contains(ev.target)) menu.open = false; });
    menu.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
  }
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
    // Los resúmenes en video de periodo se retiraron (eran mudos y repetían la línea de tiempo; Decisiones 2026-11-07).
    var media = p.img ? figura(p.img, 'per-fig') : '';
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
  relato.addEventListener('click', function (ev) {
    var c = ev.target.closest('.ev-card');
    if (c) { seleccionar(evById[c.dataset.ev], { abrir: true, origen: c.querySelector('img') || c.querySelector('.ev-mini'), camara: estado.region < 0 }); return; }
    if (ev.target.closest('[data-volver]')) salirRegionUI();
  });

  // ---------------------------------------------------------------- Selección y navegación
  // Anuncio breve para lectores de pantalla (antes se leía todo el relato en cada cambio).
  var anuncioEl = $('#anuncio');
  function anunciar(t) { if (anuncioEl) { anuncioEl.textContent = ''; setTimeout(function () { anuncioEl.textContent = t; }, 60); } }
  function setAnioMapa(a, p) {
    window.Mapa.setAnio(a);
    $('#mapa-anio').textContent = fmt(a);
    $('#mapa-era').textContent = corto(p.titulo);
  }
  function periodoDe(a) { for (var i = periodos.length - 1; i >= 0; i--) if (a >= periodos[i].inicio) return periodos[i]; return periodos[0]; }
  function grupoActual(p) { return estado.region >= 0 ? window.Mapa.region(estado.region).eventos : p.eventos; }

  function seleccionar(e, o) {
    o = o || {};
    var p = perById[e.periodo], cambiaPer = estado.periodo !== p.id, abreLam = !!o.abrir && !lam.open;
    estado.evento = e.id;
    estado.periodo = p.id;
    window.Crono.setPeriodo(p, true);
    window.Crono.setEvento(e, true);
    if (cambiaPer && estado.region < 0) cruzar(relato, function () { renderPeriodo(p); });
    else marcarTarjetas();
    setAnioMapa(e.anio, p);
    window.Mapa.marcar(e, grupoActual(p));
    if (o.camara !== false && estado.region < 0) window.Mapa.enfocar(e, instantaneo ? 0 : 650, p.eventos.map(function (id) { return evById[id]; }));
    if (abreLam) escribir('#evento/' + e.id, 'lamina', !o.sustituir);
    else if (lam.open) escribir('#evento/' + e.id, 'lamina', false);
    else if (estado.region < 0) escribir('#evento/' + e.id, 'sel', false);
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
    if (redibujar) { cruzar(relato, function () { renderPeriodo(p); }); anunciar(p.titulo + ', ' + p.rango + '. ' + p.eventos.length + ' momentos.'); }
    if (primero) { window.Crono.setEvento(primero, true); setAnioMapa(primero.anio, p); window.Mapa.marcar(primero, p.eventos); }
    else setAnioMapa(p.inicio, p);
    window.Mapa.encuadrarEventos(p.eventos.map(function (id) { return evById[id]; }), instantaneo ? 0 : 700);
    if (!o.sinRuta) escribir('#periodo/' + p.id, 'periodo', false);
  }
  function irRegion(i) {
    var r = window.Mapa.region(i); if (!r) return;
    var nueva = estado.region < 0;
    estado.region = i;
    cruzar(relato, function () { renderRegion(r); });
    anunciar(r.nombre + '. ' + r.eventos.length + (r.eventos.length === 1 ? ' momento.' : ' momentos.'));
    if ($('#region-sel')) $('#region-sel').value = String(i);
    window.Mapa.resaltarRegion(i);
    window.Mapa.encuadrarRegion(i, instantaneo ? 0 : 700);
    var e = evById[estado.evento];
    window.Mapa.marcar(e && r.eventos.indexOf(e.id) >= 0 ? e : null, r.eventos);
    escribir('#region/' + slug(r.corto), 'region', nueva);
    // En pantallas angostas la lista queda bajo el mapa fijo: se lleva a la vista.
    if (window.matchMedia('(max-width: 900px)').matches) setTimeout(function () { relato.scrollIntoView({ behavior: desliza(), block: 'start' }); }, 180);
  }
  function salirRegion() {
    var p = perById[estado.periodo], e = evById[estado.evento];
    estado.region = -1;
    if ($('#region-sel')) $('#region-sel').value = '';
    window.Mapa.resaltarRegion(-1);
    if (e && e.periodo !== p.id) e = null;
    cruzar(relato, function () { renderPeriodo(p); });
    window.Mapa.marcar(e, p.eventos);
    window.Mapa.encuadrarEventos(p.eventos.map(function (id) { return evById[id]; }), instantaneo ? 0 : 700);
    escribir('#periodo/' + p.id, 'periodo', false);
  }
  // «Volver» de la región: si la región agregó una entrada al historial, se vuelve con Atrás (mismo resultado que el gesto).
  function salirRegionUI() { if (capaActual() === 'region') history.back(); else salirRegion(); }
  function secuencia() {
    if (estado.ruta) return estado.ruta.momentos.map(function (id) { return evById[id]; });
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
  // Fuentes enlazadas y estado de la revisión humana (protocolo editorial): a la vista del lector.
  function fuentesHTML(x) {
    var f = x.fuentes || [];
    return (f.length ? '<section class="lam-fuentes"><h3>Fuentes</h3><ul>' + f.map(function (s) {
      return '<li>' + (s.url ? '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.t + '</a>' : s.t) + '</li>';
    }).join('') + '</ul></section>' : '') +
      '<p class="lam-rev">' + (x.rev ? 'Revisado por ' + x.rev + '.' : 'Revisión humana pendiente.') + ' <a href="como-se-hace.html#revision">Cómo se revisa</a></p>';
  }
  // Lectura en voz alta (versión Niños): solo voces instaladas en el equipo (localService), así el texto no sale del navegador.
  function vozLocal() {
    if (!window.speechSynthesis) return null;
    var vs = speechSynthesis.getVoices().filter(function (v) { return v.localService && /^es/i.test(v.lang); });
    return vs.filter(function (v) { return /CL|419|MX|US/i.test(v.lang); })[0] || vs[0] || null;
  }
  if (window.speechSynthesis) speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', function () { /* las voces llegan tarde en algunos navegadores */ });
  function callar() { if (window.speechSynthesis) speechSynthesis.cancel(); var b = lam.querySelector('.escuchar'); if (b) { b.setAttribute('aria-pressed', 'false'); b.textContent = 'Escuchar'; } }
  function escuchar(b) {
    if (b.getAttribute('aria-pressed') === 'true') { callar(); return; }
    var v = vozLocal(); if (!v) return;
    var txt = plano(lam.querySelector('.v-ninos').innerHTML.replace(/<button[\s\S]*?<\/button>/, '')).replace(/¿Sabías que\?/, '. ¿Sabías que? ');
    var u = new SpeechSynthesisUtterance(txt); u.voice = v; u.lang = v.lang; u.rate = 0.92;
    u.onend = u.onerror = function () { b.setAttribute('aria-pressed', 'false'); b.textContent = 'Escuchar'; };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    b.setAttribute('aria-pressed', 'true'); b.textContent = 'Detener';
  }
  // Recorridos 360° del momento: propios (visor en la página) u oficiales externos (otra pestaña).
  function recorridosHTML(e) {
    var rs = window.Recorrido && window.Recorrido.deEvento ? window.Recorrido.deEvento(e.id) || [] : [];
    if (!rs.length) return '';
    return '<p class="lam-rec">' + rs.map(function (r) {
      return r.modo === 'propio'
        ? '<button class="btn ver-360" type="button" data-rec="' + r.id + '">Recorrido 360°: ' + r.titulo + '</button>'
        : '<a class="btn btn-sec" href="' + r.url + '" target="_blank" rel="noopener">' + r.titulo + ' <small>· ' + (r.institucion || 'sitio oficial') + ' ↗</small></a>';
    }).join('') + '</p>';
  }
  // Objetivos de Aprendizaje oficiales (curriculumnacional.cl) asociados al momento.
  function oaHTML(e) {
    if (!e.oa || !e.oa.length) return '';
    return '<div class="oa"><p class="oa-t">Objetivos de Aprendizaje (Currículum Nacional)</p><ul>' + e.oa.map(function (x) {
      return '<li><a href="' + x.url + '" target="_blank" rel="noopener"><b>' + x.nivel + ' · ' + x.codigo + '</b></a> ' + x.texto + '</li>';
    }).join('') + '</ul></div>';
  }
  function llenarLamina(e) {
    callar();
    var p = perById[e.periodo], fig = $('#lam-fig');
    fig.innerHTML = e.img ? marco(e.img) + '<img id="lam-img" src="' + e.img.src + '" alt="" width="' + e.img.w + '" height="' + e.img.h + '"></span>' +
      '<figcaption>' + limpiar(e.img.pie) + '. <span class="credito">' + credito(e.img) + '</span></figcaption>' : '';
    fig.hidden = !e.img;
    if (e.relato && e.img) fig.querySelector('.marco').insertAdjacentHTML('afterbegin', '<button class="ver-video ver-relato" type="button"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5l9 5.5-9 5.5z"/></svg><span>Ver relato narrado</span></button>');
    fig.classList.toggle('vertical', !!(e.img && e.img.v));
    lamPanel.classList.toggle('sin-img', !e.img);
    $('#lam-t').textContent = e.titulo;
    $('#lam-meta').innerHTML = '<span>' + e.fecha + '</span><a href="#periodo/' + p.id + '" data-ref="' + p.id + '">' + p.titulo + '</a>' +
      (e.nivel ? '<span class="chip chip-nivel v-maestros">' + e.nivel + '</span>' : '');
    var url = urlDe('#evento/' + e.id);
    $('#lam-texto').innerHTML =
      '<div class="v-ninos">' + (vozLocal() ? '<button class="btn btn-sec escuchar" type="button" aria-pressed="false">Escuchar</button>' : '') + e.ninos + (e.dato ? '<div class="dato"><b>¿Sabías que?</b>' + e.dato + '</div>' : '') + '</div>' +
      '<div class="v-adultos">' + e.adultos + '</div>' +
      '<div class="v-maestros">' + e.adultos + (e.maestros ? '<div class="maestro">' + e.maestros + oaHTML(e) + '</div>' : '') + '</div>' +
      recorridosHTML(e) +
      fuentesHTML(e) +
      '<p class="lam-acc">' +
        '<button class="btn btn-sec compartir" type="button">Compartir</button>' +
        '<button class="btn btn-sec imprimir" type="button">Imprimir hoja</button>' +
        '<a class="btn btn-sec" target="_blank" rel="noopener" href="https://github.com/Moises-Salgado/historia-de-chile/issues/new?title=' +
          encodeURIComponent('Error en: ' + e.titulo) + '&body=' + encodeURIComponent('Momento: ' + url + '\n\nQué está mal:\n\nFuente que respalda la corrección:\n') + '">Reportar un error</a></p>' +
      '<details class="lam-cita"><summary>Cómo citar este momento</summary><p>Historia de Chile. (' + H.generado.slice(0, 4) + '). <i>' + e.titulo + '</i>. En <i>Historia de Chile: atlas y línea de tiempo</i>. ' + url + '</p></details>' +
      (e.preguntas && e.preguntas.length ? '<section class="solo-impresion hoja-preguntas"><h3>Preguntas</h3><ol>' + e.preguntas.map(function (q) {
        return '<li>' + q + '<span class="linea"></span><span class="linea"></span><span class="linea"></span></li>';
      }).join('') + '</ol></section>' : '') +
      '<div class="solo-impresion hoja-pie">' +
        '<p>' + e.titulo + ' · ' + e.fecha + ' · ' + url + '</p></div>';
    document.title = e.titulo + ' · Historia de Chile';
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
    // Ruta guiada: barra con el avance; si el momento no es de la ruta, la ruta termina.
    var rb = $('#lam-ruta');
    if (estado.ruta && estado.ruta.momentos.indexOf(e.id) < 0) estado.ruta = null;
    if (estado.ruta) {
      var k = estado.ruta.momentos.indexOf(e.id) + 1, n = estado.ruta.momentos.length;
      rb.innerHTML = '<span>Ruta: <b>' + estado.ruta.titulo + '</b> · ' + k + ' de ' + n + '</span><button type="button" class="lam-ruta-salir">Salir de la ruta</button>' +
        '<span class="lam-ruta-barra" aria-hidden="true"><i style="width:' + (100 * k / n) + '%"></i></span>';
    }
    rb.hidden = !estado.ruta;
    pasoBtn($('#lam-ant'), vecinoDe(e, -1), true);
    pasoBtn($('#lam-sig'), vecinoDe(e, 1), false);
  }
  function abrirLamina(e, origen, dir) {
    if (lam.open) {
      // Paso dentro de la lámina: fundido direccional breve; con teclado, directo.
      var partes = [$('#lam-fig'), lamPanel.querySelector('.lam-cuerpo')];
      if (!mueve() && !funde()) { G && G.killTweensOf(partes); llenarLamina(e); lamPanel.scrollTop = 0; return; }
      var suave = funde();
      G.killTweensOf(partes);
      clearTimeout(lam._paso);
      G.to(partes, suave ? { opacity: 0, duration: 0.12, ease: 'none' } : { opacity: 0, x: -14 * (dir || 1), duration: 0.13, ease: 'power1.in' });
      lam._paso = setTimeout(function () {
        G.killTweensOf(partes);
        llenarLamina(e); lamPanel.scrollTop = 0;
        if (suave) G.fromTo(partes, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none', clearProps: 'opacity' });
        else G.fromTo(partes, { opacity: 0, x: 14 * (dir || 1) }, { opacity: 1, x: 0, duration: 0.32, ease: 'salida', clearProps: 'opacity,transform' });
      }, suave ? 120 : 130);
      return;
    }
    cierres++; // anula un cierre pendiente
    lam._volviendo = false;
    llenarLamina(e);
    lam.showModal();
    lamPanel.scrollTop = 0;
    if (funde()) {
      // Reducido: la lámina aparece con un fundido breve, sin vuelo ni desplazamiento.
      G.fromTo([lamVelo, lamPanel], { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'none', clearProps: 'opacity' });
      return;
    }
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
      // FLIP con transform + clip-path (sin animar left/top/width/height): el fantasma ya tiene el tamaño final;
      // se escala de modo uniforme para cubrir la miniatura y se recorta a su forma; luego vuelve a la identidad.
      var s0 = Math.max(r0.width / r1.width, r0.height / r1.height);
      var ix = (r1.width - r0.width / s0) / 2, iy = (r1.height - r0.height / s0) / 2;
      var ra = ((circular ? Math.min(r0.width, r0.height) / 2 : 8) / s0).toFixed(2) + 'px', rb = window.matchMedia('(max-width: 600px)').matches ? '0px' : '18px';
      var dx = (r0.left + r0.width / 2) - (r1.left + r1.width / 2), dy = (r0.top + r0.height / 2) - (r1.top + r1.height / 2);
      // Inicio y fin con la misma estructura (4 recortes + 4 radios) y el inicio explícito: GSAP interpola número a número.
      var clip0 = 'inset(' + iy.toFixed(2) + 'px ' + ix.toFixed(2) + 'px ' + iy.toFixed(2) + 'px ' + ix.toFixed(2) + 'px round ' + [ra, ra, ra, ra].join(' ') + ')';
      var clip1 = 'inset(0px 0px 0px 0px round ' + [rb, rb, '0px', '0px'].join(' ') + ')';
      G.set(f, { left: r1.left, top: r1.top, width: r1.width, height: r1.height, transformOrigin: '50% 50%' });
      G.set(img, { opacity: 0 });
      tl.fromTo(f, { x: dx, y: dy, scale: s0, clipPath: clip0 }, { x: 0, y: 0, scale: 1, clipPath: clip1, duration: 0.72, immediateRender: true }, 0)
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
      document.title = TITULO;
      estado.ruta = null; // la ruta vive dentro de la lámina
      callar();
      // El foco vuelve a algo útil (no al body) si el origen desapareció.
      if (document.activeElement === document.body) { var f = relato.querySelector('.ev-card[aria-current="true"]') || document.querySelector('.hito.sel'); if (f) f.focus({ preventScroll: true }); }
    };
    if (sinAnim || !(mueve() || funde())) { cerrar(); return; }
    if (funde()) G.to([lamPanel, lamVelo], { opacity: 0, duration: 0.16, ease: 'none', onComplete: cerrar });
    else G.timeline({ defaults: { ease: 'power2.in' }, onComplete: cerrar })
      .to(lamPanel, { opacity: 0, y: 18, scale: 0.985, duration: 0.2 }, 0)
      .to(lamVelo, { opacity: 0, duration: 0.24, ease: 'none' }, 0);
    var n = ++cierres;
    setTimeout(function () { if (n === cierres) cerrar(); }, 320); // respaldo: cerrar nunca depende de un cuadro de animación
  }
  // Cerrar desde la lámina (botón, Escape, fondo): si abrirla agregó una entrada al historial, se cierra con Atrás.
  function cerrarLaminaUI() {
    if (!lam.open || lam._volviendo) return;
    if (capaActual() === 'lamina') {
      lam._volviendo = true; history.back();
      setTimeout(function () { if (lam._volviendo && lam.open) { lam._volviendo = false; cerrarLamina(); } }, 600);
      return;
    }
    cerrarLamina();
    if (estado.region < 0 && estado.evento) escribir('#evento/' + estado.evento, 'sel', false);
  }
  function compartir(e) {
    var url = urlDe('#evento/' + e.id);
    if (navigator.share) navigator.share({ title: e.titulo + ' · Historia de Chile', text: e.titulo + ' (' + e.fecha + ')', url: url }).catch(function () { /* cancelado */ });
    else copiar(url, 'Enlace copiado');
  }
  $('#lam-cerrar').addEventListener('click', cerrarLaminaUI);
  lam.addEventListener('cancel', function (ev) { ev.preventDefault(); cerrarLaminaUI(); });
  lam.addEventListener('click', function (ev) {
    if (ev.target === lam || ev.target === lamVelo) { cerrarLaminaUI(); return; }
    if (ev.target.closest('.imprimir')) window.print();
    if (ev.target.closest('.compartir')) compartir(evById[estado.evento]);
    var esc = ev.target.closest('.escuchar'); if (esc) escuchar(esc);
    var r3 = ev.target.closest('.ver-360'); if (r3 && window.Recorrido) window.Recorrido.abrir(r3.dataset.rec);
    if (ev.target.closest('.lam-ruta-salir')) { estado.ruta = null; llenarLamina(evById[estado.evento]); }
    if (ev.target.closest('.ver-relato') && window.Cine) window.Cine.abrirRelato(evById[estado.evento]);
  });
  $('#lam-ant').addEventListener('click', function () { paso(-1); });
  $('#lam-sig').addEventListener('click', function () { paso(1); });

  // ---------------------------------------------------------------- Ficha lateral (personajes, lugares, pueblos, capas)
  var dlg = $('#ficha');
  var TIPO = { personaje: 'Personaje', lugar: 'Lugar', pueblo: 'Pueblo originario', territorio: 'Capa del mapa', evento: 'Evento', periodo: 'Periodo' };
  var fichaSinVolver = false;
  // Cierra la ficha sin pasar por Atrás; devuelve true si su entrada del historial se puede reutilizar.
  function soltarFicha() {
    if (!dlg.open) return false;
    var propia = capaActual() === 'ficha';
    fichaSinVolver = true; dlg.close(); fichaSinVolver = false;
    return propia;
  }
  function abrirRef(id) {
    if (evById[id]) { var sust = soltarFicha(); seleccionar(evById[id], { abrir: true, sustituir: sust }); return; }
    if (perById[id]) {
      soltarFicha(); cerrarLamina(true);
      irPeriodo(perById[id]); $('#explorar').scrollIntoView({ behavior: desliza() }); return;
    }
    var f = H.fichas[id], t = terById[id];
    if (!f && !t) return;
    $('#ficha-fig').innerHTML = f && f.img ? figura(f.img, 'ficha-fig' + (f.tipo === 'personaje' ? ' retrato' : '')) : '';
    $('#ficha-t').textContent = f ? f.nombre : t.nombre;
    $('#ficha-sub').textContent = TIPO[f ? f.tipo : 'territorio'] + ' · ' + (f ? f.sub : t.fases.map(function (x) { return x[3] + ' (' + fmt(x[0]) + '–' + (x[1] >= 9999 ? 'hoy' : fmt(x[1])) + ')'; }).join(' · '));
    $('#ficha-cuerpo').innerHTML = f ? (estado.modo === 'ninos' && f.ninos ? '<p>' + f.ninos + '</p>' : f.html + (f.ninos && estado.modo === 'maestros' ? '<aside class="callout"><p class="callout-title">Para niños</p><p>' + f.ninos + '</p></aside>' : '')) + fuentesHTML(f) : t.texto;
    var con = (vecinos[id] || []).slice().sort(function (a, b) {
      var ea = evById[a], eb = evById[b];
      return (ea ? 0 : 1) - (eb ? 0 : 1) || (ea && eb ? ea.i - eb.i : 0);
    });
    $('#ficha-con').innerHTML = con.map(function (v) {
      var n = nodoNombre[v], e = evById[v];
      return '<li><a class="chip" href="#ficha/' + v + '" data-ref="' + v + '">' + (e ? fmt(e.anio) + ' · ' : '') + n.n + '</a></li>';
    }).join('') || '<li class="muted">Sin conexiones aún.</li>';
    var nueva = !dlg.open;
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    dlg.dataset.id = id;
    escribir('#ficha/' + id, 'ficha', nueva);
    document.title = (f ? f.nombre : t.nombre) + ' · Historia de Chile';
  }
  $('#ficha-cerrar').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
  dlg.addEventListener('close', function () {
    document.title = lam.open ? $('#lam-t').textContent + ' · Historia de Chile' : TITULO;
    if (enRuta || fichaSinVolver) return;
    if (capaActual() === 'ficha') { history.back(); return; }
    if (lam.open) escribir('#evento/' + estado.evento, 'lamina', false);
    else if (estado.evento && estado.region < 0) escribir('#evento/' + estado.evento, 'sel', false);
  });
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('[data-ref]'); if (!a) return;
    ev.preventDefault(); abrirRef(a.dataset.ref);
  });

  // ---------------------------------------------------------------- Búsqueda (momentos, personas, lugares, pueblos, periodos)
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var indiceBusqueda = null;
  function armarIndice() {
    indiceBusqueda = [];
    eventos.forEach(function (e) { indiceBusqueda.push({ id: e.id, t: e.titulo, sub: e.fecha + ' · ' + corto(perById[e.periodo].titulo), k: norm(e.titulo), x: norm(plano(e.adultos) + ' ' + e.fecha), tipo: 'Momento', img: e.img && e.img.mini }); });
    periodos.forEach(function (p) { indiceBusqueda.push({ id: p.id, t: p.titulo, sub: 'Periodo · ' + p.rango, k: norm(p.titulo), x: norm(plano(p.adultos)), tipo: 'Periodo', img: p.img && p.img.mini }); });
    Object.keys(H.fichas).forEach(function (id) { var f = H.fichas[id]; indiceBusqueda.push({ id: id, t: f.nombre, sub: (TIPO[f.tipo] || '') + (f.sub ? ' · ' + f.sub : ''), k: norm(f.nombre), x: norm(plano(f.html)), tipo: TIPO[f.tipo], img: f.img && f.img.mini }); });
  }
  function buscar(q) {
    if (!indiceBusqueda) armarIndice();
    var palabras = norm(q).split(/\s+/).filter(function (w) { return w.length > 1; });
    if (!palabras.length) return [];
    return indiceBusqueda.map(function (it) {
      var p = 0;
      for (var i = 0; i < palabras.length; i++) {
        var w = palabras[i];
        if (it.k.indexOf(w) === 0) p += 12; else if (it.k.indexOf(' ' + w) >= 0) p += 9; else if (it.k.indexOf(w) >= 0) p += 6;
        else if (it.x.indexOf(w) >= 0) p += 2; else return null;
      }
      return { it: it, p: p + (it.tipo === 'Momento' ? 1 : 0) };
    }).filter(Boolean).sort(function (a, b) { return b.p - a.p; }).slice(0, 8).map(function (r) { return r.it; });
  }
  (function () {
    var caja = $('#buscar'), q = $('#buscar-q'), res = $('#buscar-res'), abrir = $('#buscar-abrir');
    if (!q) return;
    var items = [], activo = -1;
    var cerrarRes = function () { res.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); activo = -1; };
    var marcar = function (i) {
      activo = i;
      [].forEach.call(res.children, function (li, k) { li.setAttribute('aria-selected', String(k === i)); });
      if (i >= 0 && res.children[i]) { q.setAttribute('aria-activedescendant', res.children[i].id); res.children[i].scrollIntoView({ block: 'nearest' }); }
    };
    var pintar = function () {
      items = buscar(q.value);
      if (!q.value.trim()) { cerrarRes(); return; }
      res.innerHTML = items.length ? items.map(function (it, i) {
        return '<li role="option" id="bres-' + i + '" data-id="' + it.id + '" aria-selected="false">' +
          (it.img ? '<img src="' + it.img + '" alt="" loading="lazy">' : '<span class="bres-sin" aria-hidden="true"></span>') +
          '<span><b>' + it.t + '</b><small>' + it.sub + '</small></span></li>';
      }).join('') : '<li class="bres-vacio" role="option" aria-disabled="true">Sin resultados. Prueba con otra palabra.</li>';
      res.hidden = false; q.setAttribute('aria-expanded', 'true'); marcar(items.length ? 0 : -1);
    };
    var elegir = function (i) {
      var it = items[i]; if (!it) return;
      cerrarRes(); q.value = ''; caja.classList.remove('abierto'); abrir.setAttribute('aria-expanded', 'false'); q.blur();
      abrirRef(it.id);
      if (perById[it.id]) return;
      if (evById[it.id]) $('#explorar').scrollIntoView({ behavior: desliza() });
    };
    q.addEventListener('input', pintar);
    q.addEventListener('focus', function () { if (q.value.trim()) pintar(); });
    q.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); if (items.length) marcar((activo + 1) % items.length); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (items.length) marcar((activo - 1 + items.length) % items.length); }
      else if (ev.key === 'Enter') { ev.preventDefault(); elegir(activo); }
      else if (ev.key === 'Escape') { if (!res.hidden) { ev.stopPropagation(); cerrarRes(); } else { caja.classList.remove('abierto'); abrir.setAttribute('aria-expanded', 'false'); abrir.focus(); } }
    });
    res.addEventListener('mousedown', function (ev) { ev.preventDefault(); }); // no perder el foco antes del clic
    res.addEventListener('click', function (ev) { var li = ev.target.closest('li[data-id]'); if (li) elegir([].indexOf.call(res.children, li)); });
    q.addEventListener('blur', function () { setTimeout(cerrarRes, 120); });
    // Pantallas angostas: la lupa abre el campo bajo la barra.
    abrir.addEventListener('click', function () { var on = !caja.classList.contains('abierto'); caja.classList.toggle('abierto', on); abrir.setAttribute('aria-expanded', String(on)); if (on) q.focus(); });
    // Atajo: «/» enfoca la búsqueda.
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== '/' || /input|textarea|select/i.test(ev.target.tagName) || document.querySelector('dialog[open]')) return;
      ev.preventDefault(); if (getComputedStyle(abrir).display !== 'none') abrir.click(); else q.focus();
    });
  })();

  // ---------------------------------------------------------------- Periodos, maestros y créditos
  function renderPeriodosGrid() {
    $('#periodos-grid').innerHTML = periodos.map(function (p) {
      return '<li><button class="per-card" type="button" data-per="' + p.id + '">' +
        (p.img ? '<span class="per-img"><img src="' + p.img.src + '" alt="" loading="lazy" decoding="async"' + (p.img.v ? ' class="v"' : '') + '></span>' : '') +
        '<span class="per-n">' + p.rango + '</span>' +
        '<span class="per-t">' + p.titulo + '</span>' +
        // Texto plano: un enlace dentro de un botón dispara dos acciones a la vez (A26).
        // Índice editorial (2.17): el gancho del periodo, completo; si no hay, el resumen en texto plano.
        (p.gancho ? '<span class="per-d per-gancho">' + p.gancho + '</span>' :
        '<span class="per-d"><span class="v-ninos">' + plano(p.ninos) + '</span><span class="v-adultos">' + plano(p.adultos) + '</span><span class="v-maestros">' + plano(p.adultos) + '</span></span>') +
        '<span class="per-cuantos">' + p.eventos.length + ' momentos</span>' +
        '</button></li>';
    }).join('');
    $('#periodos-grid').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-per]'); if (!b) return;
      irPeriodo(perById[b.dataset.per]);
      $('#explorar').scrollIntoView({ behavior: desliza() });
    });
  }
  function renderRutas() {
    var g = $('#rutas-grid'); if (!g) return;
    var rutas = H.rutas || [];
    $('#rutas').hidden = !rutas.length;
    g.innerHTML = rutas.map(function (r) {
      var fotos = r.momentos.map(function (id) { return evById[id]; }).filter(function (e) { return e.img; }).slice(0, 3);
      var e0 = evById[r.momentos[0]], e1 = evById[r.momentos[r.momentos.length - 1]];
      return '<li><button class="ruta-card" type="button" data-ruta="' + r.id + '">' +
        '<span class="ruta-fotos" aria-hidden="true">' + fotos.map(function (e) { return '<img src="' + e.img.mini + '" alt="" loading="lazy" decoding="async">'; }).join('') + '</span>' +
        '<span class="ruta-t">' + r.titulo + '</span><span class="ruta-d">' + r.desc + '</span>' +
        '<span class="ruta-n">' + r.momentos.length + ' momentos · ' + fmt(e0.anio) + ' – ' + fmt(e1.anio) + '</span></button></li>';
    }).join('');
    g.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ruta]'); if (!b) return;
      var r = rutas.filter(function (x) { return x.id === b.dataset.ruta; })[0]; if (!r || !r.momentos.length) return;
      if (estado.region >= 0) salirRegion();
      estado.ruta = r;
      seleccionar(evById[r.momentos[0]], { abrir: true, origen: b.querySelector('img') });
    });
  }
  // Efemérides: momentos con día y mes, agrupados por mes (para el diario mural).
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function renderEfemerides() {
    var sel = $('#efem-mes'), lista = $('#efem-lista'); if (!sel) return;
    var porMes = MESES.map(function () { return []; });
    eventos.forEach(function (e) {
      var m = String(e.fecha).toLowerCase().match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
      if (m) porMes[MESES.indexOf(m[2])].push({ d: +m[1], e: e });
    });
    sel.innerHTML = MESES.map(function (m, i) { return '<option value="' + i + '">' + m.charAt(0).toUpperCase() + m.slice(1) + ' (' + porMes[i].length + ')</option>'; }).join('');
    var pintar = function () {
      var i = +sel.value, items = porMes[i].sort(function (a, b) { return a.d - b.d; });
      lista.innerHTML = items.length ? items.map(function (x) {
        return '<li><span class="efem-dia">' + x.d + '</span><a href="momento/' + x.e.id + '.html" data-ref="' + x.e.id + '">' + x.e.titulo + '</a><span class="efem-anio">' + fmt(x.e.anio) + (x.e.anio < 1582 ? ' · juliano' : '') + '</span></li>';
      }).join('') : '<li class="muted">Este mes aún no tiene efemérides con día exacto.</li>';
    };
    sel.value = String(new Date().getMonth());
    sel.addEventListener('change', pintar); pintar();
  }
  // «Mi curso»: los momentos que se trabajan en cada nivel según los OA oficiales (un momento puede servir en varios cursos).
  function renderNiveles() {
    var cont = $('#niveles'); if (!cont) return;
    var orden = ['1° básico', '2° básico', '3° básico', '4° básico', '5° básico', '6° básico', '7° básico', '8° básico', '1° medio', '2° medio', '3° medio', '4° medio', '3° y 4° medio'];
    var grupos = {};
    eventos.forEach(function (e) {
      var nv = {}; (e.oa || []).forEach(function (x) { nv[plano(x.nivel)] = 1; });
      if (!Object.keys(nv).length && e.nivel) nv[e.nivel] = 1;
      Object.keys(nv).forEach(function (k) { (grupos[k] = grupos[k] || []).push(e); });
    });
    var claves = Object.keys(grupos).sort(function (a, b) { return (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99); });
    cont.innerHTML = '<label class="curso-sel">Mi curso <select id="mi-curso">' + claves.map(function (k) { return '<option value="' + k + '">' + k + ' (' + grupos[k].length + ')</option>'; }).join('') + '</select></label><ol class="curso-lista" id="curso-lista"></ol>';
    var sel = $('#mi-curso'), lista = $('#curso-lista');
    var pintar = function () {
      var k = sel.value; guardar('curso', k);
      lista.innerHTML = grupos[k].map(function (e) {
        var oa = (e.oa || []).filter(function (x) { return plano(x.nivel) === k; }).map(function (x) { return x.codigo; }).join(', ');
        return '<li><a href="momento/' + e.id + '.html" data-ref="' + e.id + '"><span class="curso-anio">' + fmt(e.anio) + '</span>' + e.titulo + '</a>' + (oa ? '<small>' + oa + '</small>' : '') + '</li>';
      }).join('');
    };
    var previo = leer('curso'); if (previo && grupos[previo]) sel.value = previo;
    sel.addEventListener('change', pintar); pintar();
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
  $('#generado').textContent = fechaLarga(H.generado);
  var q = new URLSearchParams(location.search).get('modo');
  setModo(q || leer('modo') || 'adultos', false);

  // Sin conexión: el service worker guarda lo visitado (solo en el sitio publicado; en local no, para no servir copias viejas).
  if ('serviceWorker' in navigator && /^https:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () { /* opcional */ });
  window.Mapa.init({ svg: $('#mapa'), tip: $('#tip'), leyenda: $('#leyenda'), onRegion: irRegion });
  // Mesa de atlas: el mapa fijo se ubica justo bajo la línea de tiempo fija, que cambia de alto según el periodo.
  var cronoWrap = $('#crono') && $('#crono').parentElement, explorarEl = $('#explorar');
  if (cronoWrap && window.ResizeObserver) new ResizeObserver(function () { explorarEl.style.setProperty('--crono-h', cronoWrap.offsetHeight + 'px'); }).observe(cronoWrap);
  // Móvil: el mapa fijo se puede plegar a una franja para leer sin que tape el texto (A28).
  var plegar = $('#mapa-plegar'), panel = $('#mapa-panel');
  if (plegar) {
    var setPlegado = function (on) { panel.classList.toggle('plegado', on); plegar.setAttribute('aria-expanded', String(!on)); plegar.textContent = on ? 'Mostrar mapa' : 'Ocultar mapa'; guardar('mapa-plegado', on ? '1' : '0'); };
    setPlegado(leer('mapa-plegado') === '1');
    plegar.addEventListener('click', function () { setPlegado(!panel.classList.contains('plegado')); });
  }
  // Leyenda: plegada donde el mapa es angosto (móvil y mesa de atlas) para no tapar el territorio; se recuerda la elección.
  var caja = $('#leyenda-caja');
  if (caja) {
    var pref = leer('leyenda');
    caja.open = pref ? pref === '1' : !window.matchMedia('(max-width: 900px), (min-width: 1101px) and (min-height: 760px)').matches;
    caja.addEventListener('toggle', function () { guardar('leyenda', caja.open ? '1' : '0'); });
  }
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
  // Selector de regiones (norte → sur): vía de teclado y de pantallas táctiles (los polígonos chicos son difíciles de tocar).
  var rsel = $('#region-sel');
  if (rsel) {
    var opts = '';
    for (var ri = 0; ri < window.Mapa.nRegiones; ri++) opts += '<option value="' + ri + '">' + window.Mapa.region(ri).nombre.replace(/^Región (de |del )?/, '') + '</option>';
    rsel.insertAdjacentHTML('beforeend', opts);
    rsel.addEventListener('change', function () { if (rsel.value === '') salirRegionUI(); else irRegion(+rsel.value); });
  }

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
    renderPeriodosGrid(); renderRutas(); renderEfemerides(); renderNiveles(); renderCreditos();
    // Mesa de atlas (escritorio ancho y alto): la franja fija de arriba lleva solo años y periodos;
    // el detalle del periodo (hitos con imagen) pasa a la columna del relato. En el resto, vuelve a la línea de tiempo.
    var mqMesa = window.matchMedia('(min-width: 1101px) and (min-height: 760px)');
    var det = $('.crono-det'), slot = $('#det-slot'), lenteEl = $('.crono-lente');
    var ubicarDet = function () { if (!det || !slot) return; if (mqMesa.matches) slot.appendChild(det); else if (lenteEl) lenteEl.after(det); };
    ubicarDet();
    if (mqMesa.addEventListener) mqMesa.addEventListener('change', ubicarDet);
    // Al cargar, la ruta se aplica sin escribir en el historial (enRuta): cerrar una lámina abierta por enlace no saca del sitio.
    instantaneo = true; enRuta = true;
    var h = location.hash.match(RUTA);
    var id = h && decodeURIComponent(h[2]);
    if (h && h[1] === 'evento' && evById[id]) seleccionar(evById[id], { abrir: capaActual() !== 'sel' });
    else if (h && h[1] === 'periodo' && perById[id]) irPeriodo(perById[id]);
    else {
      // Sin ruta propia (o con un ancla de sección como #maestros) no se toca la URL.
      irPeriodo(periodos[0], { sinRuta: true });
      if (h && h[1] === 'ficha') abrirRef(id);
      if (h && h[1] === 'region') { var ri = regionPorSlug(id); if (ri >= 0) irRegion(ri); }
    }
    instantaneo = false; enRuta = false;
    ultimaRuta = claveRuta();
    // Atrás/adelante y rutas escritas a mano: la URL manda y la página se ajusta (sin volver a escribir).
    var alNavegar = function () { var k = claveRuta(); if (k === ultimaRuta) return; ultimaRuta = k; aplicarRuta(); };
    window.addEventListener('popstate', alNavegar);
    window.addEventListener('hashchange', alNavegar);
  }

  function regionPorSlug(k) { for (var i = 0; i < window.Mapa.nRegiones; i++) if (slug(window.Mapa.region(i).corto) === k) return i; return -1; }
  function aplicarRuta() {
    var m = location.hash.match(RUTA), capa = capaActual();
    var tipo = m ? m[1] : '', k = m ? decodeURIComponent(m[2]) : '';
    var quiereLam = tipo === 'evento' && !!evById[k] && capa !== 'sel';
    enRuta = true; lam._volviendo = false;
    try {
      if (dlg.open && tipo !== 'ficha') dlg.close();
      if (lam.open && !quiereLam && tipo !== 'ficha') cerrarLamina();
      if (tipo === 'region') { var j = regionPorSlug(k); if (j >= 0 && estado.region !== j) irRegion(j); }
      else if (estado.region >= 0 && !quiereLam && tipo !== 'ficha') salirRegion();
      if (tipo === 'evento' && evById[k]) { if (estado.evento !== k || (quiereLam && !lam.open)) seleccionar(evById[k], { abrir: quiereLam }); }
      else if (tipo === 'periodo' && perById[k]) { if (estado.periodo !== k) irPeriodo(perById[k]); }
      else if (tipo === 'ficha' && (!dlg.open || dlg.dataset.id !== k)) abrirRef(k);
    } finally { enRuta = false; }
  }

})();
