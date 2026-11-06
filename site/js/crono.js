/* Línea de tiempo: eje general con escala variable (cabezal arrastrable) + detalle del periodo activo.
   Escala: logarítmica en "años antes de hoy" hasta 1450; lineal por tramos después, con los siglos recientes más amplios. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var HOY = new Date().getFullYear();
  var L0 = Math.log(14530), L1 = Math.log(580), CORTE = 0.13;
  var TRAMOS = [[1450, CORTE], [1600, 0.21], [1800, 0.36], [2030, 1]];
  function x(a) {
    if (a <= 1450) return CORTE * (1 - (Math.log(2030 - Math.max(a, -12500)) - L1) / (L0 - L1));
    for (var i = 1; i < TRAMOS.length; i++) {
      var p = TRAMOS[i - 1], q = TRAMOS[i];
      if (a <= q[0]) return p[1] + ((a - p[0]) / (q[0] - p[0])) * (q[1] - p[1]);
    }
    return 1;
  }
  function anioDe(v) {
    v = Math.max(0, Math.min(1, v));
    if (v <= CORTE) {
      var a = 2030 - Math.exp(L1 + (1 - v / CORTE) * (L0 - L1));
      return a < 0 ? Math.round(a / 100) * 100 : Math.round(a / 10) * 10;
    }
    for (var i = 1; i < TRAMOS.length; i++) {
      var p = TRAMOS[i - 1], q = TRAMOS[i];
      if (v <= q[1]) return Math.min(HOY, Math.round(p[0] + ((v - p[1]) / (q[1] - p[1])) * (q[0] - p[0])));
    }
    return HOY;
  }

  var o, G, fmt, cont, eje, bandasEl, puntosEl, siglosEl, cabezal, lente, det, marcasEl, ticksEl;
  var bandas = [], puntos = {}, actual = { p: null, e: null, anio: null }, lenteV = { a: 0, b: 0 }, contador = { v: 0 };
  var flecha = function (izq) { return '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="' + (izq ? 'M12 5l-5 5 5 5' : 'M8 5l5 5-5 5') + '"/></svg>'; };
  var animar = function () { return !!G && !reduce.matches && !o.instantaneo(); };

  function init(opts) {
    o = opts; G = window.gsap; fmt = opts.fmt; cont = opts.cont;
    cont.innerHTML =
      '<div class="crono-cab">' +
        '<p class="crono-anio" id="anio-num"></p>' +
        '<div class="crono-ahora"><p class="crono-ev" id="crono-ev"></p><p class="crono-per" id="crono-per"></p></div>' +
        '<div class="crono-nav"><button class="crono-btn" id="per-ant" type="button"></button><button class="crono-btn" id="per-sig" type="button"></button></div>' +
      '</div>' +
      '<div class="crono-eje" id="crono-eje">' +
        '<div class="eje-siglos" aria-hidden="true"></div><div class="eje-puntos" aria-hidden="true"></div><div class="eje-bandas"></div><div class="eje-rotulos" aria-hidden="true"></div>' +
        '<div class="eje-cabezal" role="slider" tabindex="0" aria-label="Año en la línea de tiempo" aria-valuemin="-12500" aria-valuemax="' + HOY + '"><span></span></div>' +
      '</div>' +
      '<svg class="crono-lente" aria-hidden="true" preserveAspectRatio="none"><path/></svg>' +
      '<div class="crono-det"><div class="det-marcas"></div><div class="det-eje" aria-hidden="true"></div></div>' +
      '<p class="crono-nota">Escala variable: los milenios antiguos se comprimen y los siglos recientes se amplían.</p>';
    eje = cont.querySelector('.crono-eje'); bandasEl = cont.querySelector('.eje-bandas'); puntosEl = cont.querySelector('.eje-puntos');
    siglosEl = cont.querySelector('.eje-siglos'); cabezal = cont.querySelector('.eje-cabezal'); lente = cont.querySelector('.crono-lente');
    det = cont.querySelector('.crono-det'); marcasEl = cont.querySelector('.det-marcas'); ticksEl = cont.querySelector('.det-eje');

    o.periodos.forEach(function (p) {
      var a = x(p.inicio), b = x(Math.min(p.fin, HOY));
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'banda'; btn.dataset.id = p.id;
      btn.style.left = a * 100 + '%'; btn.style.width = (b - a) * 100 + '%';
      btn.setAttribute('aria-label', p.titulo + ', ' + p.rango);
      btn.title = p.titulo + ' · ' + p.rango; // nombre visible al pasar el cursor por bandas angostas
      // El rótulo vive en su propia capa (sobre el papel, no dentro de la banda de color).
      var t = document.createElement('span');
      t.className = 'banda-t'; t.textContent = o.corto(p.titulo);
      cont.querySelector('.eje-rotulos').appendChild(t);
      bandasEl.appendChild(btn);
      bandas.push({ p: p, n: btn, t: t, a: a, b: b });
    });
    o.eventos.forEach(function (e) {
      var s = document.createElement('i');
      s.style.left = x(e.anio) * 100 + '%';
      puntosEl.appendChild(s); puntos[e.id] = s;
    });
    [-12500, 1, 1500, 1600, 1700, 1800, 1850, 1900, 1950, 2000].forEach(function (a) {
      var t = document.createElement('span');
      t.style.left = x(a) * 100 + '%'; t.dataset.a = a;
      t.textContent = a === 1 ? '1 d.C.' : fmt(a);
      siglosEl.appendChild(t);
    });

    cont.querySelector('#per-ant').addEventListener('click', function () { var p = o.periodos[actual.p.i - 1]; if (p) o.onPeriodo(p); });
    cont.querySelector('#per-sig').addEventListener('click', function () { var p = o.periodos[actual.p.i + 1]; if (p) o.onPeriodo(p); });
    marcasEl.addEventListener('click', function (ev) {
      var m = ev.target.closest('.hito'); if (!m) return;
      o.onEvento(o.evById[m.dataset.ev], m.querySelector('img') || m, true);
    });
    arrastre();
    cabezal.addEventListener('keydown', function (ev) {
      var k = ev.key, d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[k];
      if (d) { ev.preventDefault(); ev.stopPropagation(); o.onPaso(d); return; }
      if (k === 'PageDown' || k === 'PageUp') { ev.preventDefault(); var p = o.periodos[actual.p.i + (k === 'PageDown' ? 1 : -1)]; if (p) o.onPeriodo(p); }
      if (k === 'Home') { ev.preventDefault(); o.onEvento(o.eventos[0], null, false); }
      if (k === 'End') { ev.preventDefault(); o.onEvento(o.eventos[o.eventos.length - 1], null, false); }
    });
    new ResizeObserver(function () { if (actual.p) { rotularBandas(); rotularSiglos(); renderDet(actual.p, false); moverCabezal(actual.anio, false); dibujarLente(); } }).observe(cont);
  }

  // ---------------------------------------------------------------- Eje general
  function rotularBandas() {
    // Rótulos solo donde caben, sin chocar; el periodo activo siempre se rotula.
    var W = eje.clientWidth, puestos = [];
    var orden = bandas.slice().sort(function (m, n) { return (n.p === actual.p) - (m.p === actual.p) || (n.b - n.a) - (m.b - m.a); });
    orden.forEach(function (b) {
      var t = b.t, w = t.offsetWidth, c = ((b.a + b.b) / 2) * W, l = Math.max(0, Math.min(W - w, c - w / 2)), r = l + w;
      var cabe = b.p === actual.p || (w + 8 <= (b.b - b.a) * W && puestos.every(function (q) { return r + 10 < q[0] || l > q[1] + 10; }));
      t.classList.toggle('oculto', !cabe);
      t.style.left = l + 'px';
      if (cabe) puestos.push([l, r]);
    });
  }
  function rotularSiglos() {
    var W = eje.clientWidth, fin = -Infinity;
    [].forEach.call(siglosEl.children, function (t, i, todos) {
      var w = t.offsetWidth, c = parseFloat(t.style.left) / 100 * W;
      var l = i === 0 ? c : Math.min(W - w, c - w / 2);
      var ok = l > fin + 10 && (i === todos.length - 1 || l + w <= W);
      t.style.visibility = ok ? '' : 'hidden';
      t.classList.toggle('borde', i === 0);
      if (ok) fin = l + w;
    });
  }
  function moverCabezal(anio, anim) {
    var px = x(anio) * eje.clientWidth;
    if (anim && animar()) G.to(cabezal, { x: px, duration: 0.55, ease: 'salida', overwrite: true });
    else if (G) G.set(cabezal, { x: px }); else cabezal.style.transform = 'translateX(' + px + 'px)';
  }
  function arrastre() {
    var activo = false, movido = false, x0 = 0, raf = 0, anio = null, banda0 = null;
    function valor(ev) { var r = eje.getBoundingClientRect(); return (ev.clientX - r.left) / r.width; }
    eje.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      activo = true; movido = false; x0 = ev.clientX;
      // Con captura de puntero, pointerup llega al eje: la banda se recuerda aquí.
      banda0 = ev.target.closest('.banda');
      eje.setPointerCapture(ev.pointerId);
    });
    eje.addEventListener('pointermove', function (ev) {
      if (!activo) return;
      if (!movido && Math.abs(ev.clientX - x0) < 4) return;
      if (!movido) { movido = true; eje.classList.add('arrastrando'); }
      anio = anioDe(valor(ev));
      if (G) G.killTweensOf(cabezal);
      if (G) G.set(cabezal, { x: x(anio) * eje.clientWidth });
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; vistaAnio(anio); o.onScrub(anio); });
    });
    function fin(ev) {
      if (!activo) return;
      activo = false; eje.classList.remove('arrastrando');
      if (!movido) {
        // Clic: en una banda abre el periodo; en el resto, el momento más cercano.
        if (ev.type !== 'pointerup') return;
        var b = banda0;
        if (b) { o.onPeriodo(o.periodos.filter(function (p) { return p.id === b.dataset.id; })[0]); return; }
        anio = anioDe(valor(ev));
      }
      if (anio === null) return;
      var v = x(anio), mejor = null, dm = 9;
      o.eventos.forEach(function (e) { var d = Math.abs(x(e.anio) - v); if (d < dm) { dm = d; mejor = e; } });
      anio = null;
      if (mejor) o.onEvento(mejor, null, false);
    }
    eje.addEventListener('pointerup', fin);
    eje.addEventListener('pointercancel', fin);
    // Los clics de teclado sobre bandas (Enter/Espacio) llegan como click sin pointerdown.
    bandasEl.addEventListener('click', function (ev) {
      if (ev.detail !== 0) return;
      var b = ev.target.closest('.banda'); if (b) o.onPeriodo(o.periodos.filter(function (p) { return p.id === b.dataset.id; })[0]);
    });
  }
  function periodoDe(anio) {
    for (var i = o.periodos.length - 1; i >= 0; i--) if (anio >= o.periodos[i].inicio) return o.periodos[i];
    return o.periodos[0];
  }
  function vistaAnio(anio) {
    // Durante el arrastre: año, periodo y bandas siguen al cabezal.
    actual.anio = anio;
    pintarAnio(anio, false);
    var p = periodoDe(anio);
    cont.querySelector('#crono-ev').textContent = p.titulo;
    cont.querySelector('#crono-per').textContent = p.rango;
    bandas.forEach(function (b) { b.n.classList.toggle('activa', b.p === p); b.t.classList.toggle('activa', b.p === p); });
  }

  // ---------------------------------------------------------------- Año (contador animado)
  function pintarAnio(anio, anim) {
    var n = cont.querySelector('#anio-num');
    cabezal.setAttribute('aria-valuenow', anio);
    var pinta = function (a) { var t = fmt(Math.round(a)), m = t.match(/^(.+) (a\.C\.|d\.C\.)$/); n.innerHTML = m ? m[1] + '<small>' + m[2] + '</small>' : t; };
    // El contador solo corre entre años de la misma era; un salto a.C. → d.C. cambia directo.
    if (anim && animar() && (contador.v > 0) === (anio > 0) && contador.v !== anio) {
      G.to(contador, { v: anio, duration: 0.6, ease: 'salida', overwrite: true, onUpdate: function () { pinta(contador.v); } });
    } else { if (G) G.killTweensOf(contador); contador.v = anio; pinta(anio); }
  }

  // ---------------------------------------------------------------- Detalle del periodo
  function renderDet(p, anim) {
    var W = det.clientWidth, M = W < 640 ? 38 : 46, GAP = 6, a0 = x(p.inicio), a1 = x(Math.min(p.fin, HOY)) || 1;
    var pos = function (anio) { return M / 2 + Math.max(0, Math.min(1, (x(anio) - a0) / (a1 - a0))) * (W - M); };
    var carriles = [], maxC = 0, tallos = '';
    var hitos = p.eventos.map(function (id) {
      var e = o.evById[id], px = pos(e.anio), c = 0;
      while (c < carriles.length && carriles[c] > px - M - GAP) c++;
      if (c > 2) { c = 0; for (var k = 1; k < 3; k++) if (carriles[k] < carriles[c]) c = k; }
      carriles[c] = px; maxC = Math.max(maxC, c);
      // Los tallos van en su propia capa, detrás de todos los hitos: no tapan ni roban clics.
      tallos += '<i class="tallo" style="left:' + px + 'px;--c:' + c + '"></i>';
      var mini = e.img ? '<img src="' + e.img.mini + '" alt="" loading="lazy" decoding="async"' + (e.img.v ? ' class="v"' : '') + '>' : '<span class="hito-sin"></span>';
      var lado = px < 130 ? ' izq' : px > W - 130 ? ' der' : '';
      return '<button class="hito' + lado + (actual.e && actual.e.id === id ? ' sel' : '') + '" type="button" data-ev="' + id + '" style="left:' + px + 'px;--c:' + c + '" ' +
        'aria-label="' + fmt(e.anio) + ', ' + e.titulo.replace(/"/g, '&quot;') + '">' + mini +
        '<span class="hito-t" aria-hidden="true"><b>' + fmt(e.anio) + '</b>' + e.titulo + '</span></button>';
    }).join('');
    marcasEl.innerHTML = '<div class="tallos" aria-hidden="true">' + tallos + '</div>' + hitos;
    det.style.setProperty('--m', M + 'px');
    var alto = M + 14 + maxC * (M + GAP) + 34;
    if (anim && animar()) G.to(det, { height: alto, duration: 0.4, ease: 'salida' }); else det.style.height = alto + 'px';
    // Marcas de años del periodo: paso "redondo" y sin choques.
    var span = Math.min(p.fin, HOY) - p.inicio, pasos = [1, 2, 5, 10, 20, 25, 50, 100, 250, 500, 1000, 2500], paso = pasos[pasos.length - 1];
    for (var i = 0; i < pasos.length; i++) if (span / pasos[i] <= Math.max(3, W / 90)) { paso = pasos[i]; break; }
    var cands = [p.inicio];
    if (p.inicio < 0) {
      // Prehistoria (escala logarítmica): marcas fijas; no existe el año 0.
      [-10000, -5000, -2000, 1, 1000].forEach(function (a) { if (a > p.inicio && a < p.fin) cands.push(a); });
    } else {
      for (var a = Math.ceil(p.inicio / paso) * paso; a < Math.min(p.fin, HOY); a += paso) if (a !== p.inicio) cands.push(a);
    }
    cands.push(Math.min(p.fin, HOY));
    var fin = -99, ult = cands.length - 1;
    ticksEl.innerHTML = cands.map(function (a, i) {
      var px = pos(a), txt = (i === ult && p.fin >= HOY) ? 'hoy' : fmt(a), w = txt.length * 7.2 + 4;
      var l = i === 0 ? px - M / 2 : i === ult ? px + M / 2 - w : px - w / 2;
      if (i !== 0 && i !== ult && (l < fin + 12 || l + w > pos(cands[ult]) + M / 2 - 70)) return '';
      if (i === ult && l < fin + 8) return '';
      fin = l + w;
      return '<span class="' + (i === 0 ? 'ini' : i === ult ? 'fin' : '') + '" style="left:' + px + 'px">' + txt + '</span>';
    }).join('');
    if (anim && animar()) {
      G.from(marcasEl.querySelector('.tallos'), { opacity: 0, duration: 0.4, ease: 'none', clearProps: 'opacity' });
      G.from(marcasEl.querySelectorAll('.hito'), { opacity: 0, y: 14, scale: 0.86, duration: 0.45, ease: 'salida', stagger: 0.035, clearProps: 'opacity,transform' });
      G.from(ticksEl.children, { opacity: 0, duration: 0.3, ease: 'none', stagger: 0.02, clearProps: 'opacity' });
    }
  }
  function dibujarLente() {
    var W = eje.clientWidth, h = lente.clientHeight || 22, a = lenteV.a * W, b = lenteV.b * W;
    lente.setAttribute('viewBox', '0 0 ' + W + ' ' + h);
    lente.firstChild.setAttribute('d', 'M' + a + ' 0 L' + b + ' 0 L' + W + ' ' + h + ' L0 ' + h + ' Z');
  }

  // ---------------------------------------------------------------- API
  function setPeriodo(p, anim) {
    var cambio = actual.p !== p;
    actual.p = p;
    bandas.forEach(function (b) { b.n.classList.toggle('activa', b.p === p); b.t.classList.toggle('activa', b.p === p); b.n.setAttribute('aria-current', String(b.p === p)); });
    for (var id in puntos) puntos[id].classList.toggle('on', o.evById[id].periodo === p.id);
    var ant = o.periodos[p.i - 1], sig = o.periodos[p.i + 1];
    var bA = cont.querySelector('#per-ant'), bS = cont.querySelector('#per-sig');
    bA.innerHTML = flecha(true) + '<span>' + (ant ? o.corto(ant.titulo) : '') + '</span>'; bA.disabled = !ant;
    bS.innerHTML = '<span>' + (sig ? o.corto(sig.titulo) : '') + '</span>' + flecha(false); bS.disabled = !sig;
    bA.setAttribute('aria-label', ant ? 'Periodo anterior: ' + ant.titulo : 'Sin periodo anterior');
    bS.setAttribute('aria-label', sig ? 'Periodo siguiente: ' + sig.titulo : 'Sin periodo siguiente');
    rotularBandas(); rotularSiglos();
    if (!cambio) return;
    renderDet(p, anim);
    var b = bandas[p.i];
    if (anim && animar()) G.to(lenteV, { a: b.a, b: b.b, duration: 0.6, ease: 'salida', onUpdate: dibujarLente, overwrite: true });
    else { lenteV.a = b.a; lenteV.b = b.b; dibujarLente(); }
  }
  function setEvento(e, anim) {
    actual.e = e; actual.anio = e.anio;
    [].forEach.call(marcasEl.querySelectorAll('.hito'), function (m) { var on = m.dataset.ev === e.id; m.classList.toggle('sel', on); if (on) m.setAttribute('aria-current', 'true'); else m.removeAttribute('aria-current'); });
    for (var id in puntos) puntos[id].classList.toggle('sel', id === e.id);
    pintarAnio(e.anio, anim);
    cont.querySelector('#crono-ev').textContent = e.titulo;
    cont.querySelector('#crono-per').textContent = e.fecha;
    cabezal.setAttribute('aria-valuetext', fmt(e.anio) + ', ' + e.titulo);
    moverCabezal(e.anio, anim);
  }
  function marca(id) { var m = marcasEl.querySelector('[data-ev="' + id + '"]'); return m && (m.querySelector('img') || m); }

  window.Crono = { init: init, setPeriodo: setPeriodo, setEvento: setEvento, marca: marca, x: x };
})();
