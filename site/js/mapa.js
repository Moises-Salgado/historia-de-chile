/* Mapa histórico de Chile en SVG. Datos: window.MAPA (geo) y window.HISTORIA.territorios (capas). */
(function () {
  'use strict';
  var M = window.MAPA, NS = 'http://www.w3.org/2000/svg';
  var px = function (lon) { return (lon - M.lon0) * M.k * M.cos; };
  var py = function (lat) { return (M.latN - lat) * M.k; };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function fmtAnio(a) {
    if (a < 0) return Math.abs(a).toLocaleString('es-CL') + ' a.C.';
    if (a < 1000) return a + ' d.C.';
    return String(a);
  }

  var ESTILO = {
    chile: { fill: 'var(--z-chile)', op: 0.42, nombre: 'Chile' },
    colonial: { fill: 'var(--z-colonial)', op: 0.45 },
    autonomo: { fill: 'var(--z-autonomo)', op: 0.42 },
    extranjero: { fill: 'url(#p-extranjero)', op: 1, css: 'repeating-linear-gradient(45deg,var(--z-extranjero) 0 2px,transparent 2px 5px)' },
    disputa: { fill: 'url(#p-disputa)', op: 1, css: 'repeating-linear-gradient(45deg,var(--z-disputa) 0 2px,transparent 2px 5px)' },
    inca: { fill: 'url(#p-inca)', op: 1, css: 'repeating-linear-gradient(-45deg,var(--z-inca) 0 2px,transparent 2px 5px)' },
    reclamado: { fill: 'var(--z-reclamado)', op: 0.35 },
    originario: { op: 0.5 }
  };
  function faseActiva(t, anio) {
    for (var i = 0; i < t.fases.length; i++) {
      var f = t.fases[i];
      if (anio >= f[0] && anio <= f[1]) return f;
    }
    return null;
  }

  // ---------------------------------------------------------------- Mapa principal
  var svg, vista, gZonas, gPins, gRot, patrones = [], pins = {}, zonas = [], rotulos = [];
  var cam = { cx: M.w / 2, cy: M.h / 2, s: 4 }, anim = null, W = 1, H = 1;
  var opts = {}, tip, terr = [], origIdx = {}, extIdx = {}, regEls = [], regEv = [], evReg = {};
  function nombreRegion(r) { return r.nombre === 'Metropolitana' ? 'Región Metropolitana' : 'Región de ' + r.nombre; }
  // Capas históricas activas que cubren un punto (unidades del mapa).
  function capasEn(u) {
    return zonas.filter(function (z) {
      if (!z.fase || (z.t.pais && z.t.pais !== 'CHL')) return false;
      var c = z.t.caja;
      return u.x >= px(c[2]) && u.x <= px(c[3]) && u.y >= py(c[0]) && u.y <= py(c[1]);
    }).map(function (z) { var f = z.fase; return f[3] + ' (' + fmtAnio(f[0]) + '–' + (f[1] >= 9999 ? 'hoy' : fmtAnio(f[1])) + ')'; }).slice(0, 2);
  }

  function init(o) {
    opts = o; svg = o.svg; tip = o.tip;
    terr = (window.HISTORIA.territorios || []).slice();
    // Capas incas al final: se superponen como trama.
    terr.sort(function (a, b) {
      var ia = a.fases.some(function (f) { return f[2] === 'inca'; }), ib = b.fases.some(function (f) { return f[2] === 'inca'; });
      return (ia - ib) || (a.orden - b.orden);
    });
    var oi = 0, xi = 0;
    terr.forEach(function (t) { if (t.fases.some(function (f) { return f[2] === 'originario'; })) origIdx[t.id] = oi++; });
    // Países extranjeros alternan trama (diagonal / horizontal): Perú y Bolivia ya no se confunden en la leyenda (A4).
    terr.forEach(function (t) { if (t.fases.some(function (f) { return f[2] === 'extranjero'; })) extIdx[t.id] = xi++; });

    var defs = el('defs', {}, svg);
    var clipC = el('clipPath', { id: 'clip-CHL' }, defs);
    M.regiones.forEach(function (r) { el('path', { d: r.d }, clipC); });
    var arg = M.vecinos.filter(function (v) { return v.nombre === 'Argentina'; })[0];
    if (arg) el('path', { d: arg.d }, el('clipPath', { id: 'clip-ARG' }, defs));
    [['p-extranjero', 'var(--z-extranjero)', 45], ['p-extranjero-2', 'var(--z-extranjero)', 0], ['p-disputa', 'var(--z-disputa)', 45], ['p-inca', 'var(--z-inca)', -45]].forEach(function (p) {
      var pat = el('pattern', { id: p[0], patternUnits: 'userSpaceOnUse', width: 6, height: 6, 'data-rot': p[2] }, defs);
      el('rect', { width: 6, height: 6, fill: 'var(--land)', 'fill-opacity': p[0] === 'p-inca' ? 0 : 0.5 }, pat);
      el('rect', { width: 2.2, height: 6, style: 'fill:' + p[1] }, pat);
      patrones.push(pat);
    });

    // Los países vecinos se desvanecen hacia los bordes recortados (no terminan en un corte recto).
    var gx = el('linearGradient', { id: 'g-der', gradientUnits: 'userSpaceOnUse', x1: M.w - 140, y1: 0, x2: M.w, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff' }, gx); el('stop', { offset: 1, 'stop-color': '#000' }, gx);
    var gy = el('linearGradient', { id: 'g-arr', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 120 }, defs);
    el('stop', { offset: 0, 'stop-color': '#000' }, gy); el('stop', { offset: 1, 'stop-color': '#fff' }, gy);
    el('rect', { x: -2000, y: -2000, width: M.w + 4000, height: M.h + 4000, fill: 'url(#g-der)' }, el('mask', { id: 'm-der', maskUnits: 'userSpaceOnUse', x: -2000, y: -2000, width: M.w + 4000, height: M.h + 4000 }, defs));
    el('rect', { x: -2000, y: -2000, width: M.w + 4000, height: M.h + 4000, fill: 'url(#g-arr)' }, el('mask', { id: 'm-arr', maskUnits: 'userSpaceOnUse', x: -2000, y: -2000, width: M.w + 4000, height: M.h + 4000 }, defs));

    vista = el('g', {}, svg);
    var gV = el('g', { mask: 'url(#m-der)' }, el('g', { mask: 'url(#m-arr)' }, vista));
    M.vecinos.forEach(function (v) { el('path', { d: v.d, class: 'vecino' }, gV); });
    var gT = el('g', {}, vista);
    M.regiones.forEach(function (r) { el('path', { d: r.d, class: 'tierra' }, gT); });

    gZonas = el('g', {}, vista);
    terr.forEach(function (t) {
      if (!t.caja) return;
      var n = t.caja[0], s = t.caja[1], o = t.caja[2], e = t.caja[3];
      var r = el('rect', { x: px(o), y: py(n), width: px(e) - px(o), height: py(s) - py(n), class: 'zona',
        'clip-path': 'url(#clip-' + (t.pais || 'CHL') + ')', 'data-id': t.id }, gZonas);
      zonas.push({ t: t, n: r });
    });

    // Regiones: siempre clicables; el tooltip suma los momentos ocurridos ahí y la capa histórica bajo el cursor.
    var gR = el('g', {}, vista);
    M.regiones.forEach(function (r, i) {
      var p = el('path', { d: r.d, class: 'region', 'data-i': i }, gR);
      p.addEventListener('pointermove', function (ev) {
        var n = (regEv[i] || []).length, capas = capasEn(aUnidades(ev));
        mostrarTip(ev, '<b>' + nombreRegion(r) + '</b><br>' + (n ? n + (n === 1 ? ' momento' : ' momentos') + ' · clic para verlos' : 'Sin momentos aún') +
          (capas.length ? '<br><span class="tip-capa">' + capas.join('<br>') + '</span>' : ''));
      });
      p.addEventListener('pointerleave', ocultarTip);
      p.addEventListener('click', function () { ocultarTip(); if (opts.onRegion) opts.onRegion(i); });
      regEls.push(p);
    });

    gRot = el('g', {}, vista);
    rotulo('PERÚ', px(-70.6), py(-17.25), 13, 'rot');
    rotulo('BOLIVIA', px(-67.0), py(-21.3), 13, 'rot');
    rotulo('ARGENTINA', px(-67.2), py(-41.0), 13, 'rot');
    rotulo('Océano Pacífico', px(-76.4), py(-31), 16, 'rot-mar', -90);
    M.regiones.forEach(function (r) { rotulo(r.nombre, r.cx, r.cy, 11, 'rot-reg'); });

    gPins = el('g', {}, vista);

    interaccion();
    medir();
    new ResizeObserver(function () { medir(); aplicar(); }).observe(svg);
    verTodo(0);
  }

  function rotulo(txt, x, y, size, cls, rot) {
    var t = el('text', { x: x, y: y, class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, gRot);
    t.textContent = txt;
    rotulos.push({ n: t, size: size, rot: rot || 0, x: x, y: y });
  }

  // ---------------------------------------------------------------- Cámara
  function medir() { var b = svg.getBoundingClientRect(); W = Math.max(1, b.width); H = Math.max(1, b.height); }
  function limites(s) { var max = Math.max(M.w / W, M.h / H) * 1.15; return Math.min(max, Math.max(0.06, s)); }
  function aplicar() {
    var s = cam.s;
    svg.setAttribute('viewBox', [cam.cx - (W / 2) * s, cam.cy - (H / 2) * s, W * s, H * s].join(' '));
    // Tamaños constantes en pantalla: rótulos, pines y tramas.
    rotulos.forEach(function (r) {
      r.n.setAttribute('font-size', r.size * s);
      if (r.rot) r.n.setAttribute('transform', 'rotate(' + r.rot + ' ' + r.x + ' ' + r.y + ')');
    });
    for (var id in pins) {
      var p = pins[id], sel = p.g.classList.contains('sel');
      p.c.setAttribute('r', (sel ? 7 : 4.5) * s);
      p.a.setAttribute('r', 13 * s);
    }
    patrones.forEach(function (p) { p.setAttribute('patternTransform', 'rotate(' + p.getAttribute('data-rot') + ') scale(' + Math.max(0.25, s * 0.9) + ')'); });
  }
  function ease(t) { return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; }
  function volar(dest, dur) {
    if (anim) cancelAnimationFrame(anim);
    dest.s = limites(dest.s);
    if (reduce.matches || !dur) { cam = dest; aplicar(); return; }
    var a = { cx: cam.cx, cy: cam.cy, s: cam.s }, t0 = performance.now();
    var la = Math.log(a.s), lb = Math.log(dest.s);
    (function paso(now) {
      var t = Math.min(1, (now - t0) / dur), k = ease(t);
      cam = { cx: a.cx + (dest.cx - a.cx) * k, cy: a.cy + (dest.cy - a.cy) * k, s: Math.exp(la + (lb - la) * k) };
      aplicar();
      anim = t < 1 ? requestAnimationFrame(paso) : null;
    })(t0);
  }
  function verTodo(dur) { volar({ cx: M.w / 2, cy: M.h / 2, s: Math.max(M.w / W, M.h / H) * 1.04 }, dur === undefined ? 650 : dur); }
  function zoom(f, cx, cy) {
    var s = limites(cam.s * f);
    if (cx === undefined) { volar({ cx: cam.cx, cy: cam.cy, s: s }, 220); return; }
    // Zoom anclado al punto bajo el cursor.
    var k = s / cam.s;
    cam = { cx: cx + (cam.cx - cx) * k, cy: cy + (cam.cy - cy) * k, s: s }; aplicar();
  }
  // Encuadra una caja en unidades del mapa con margen.
  function encuadrar(x0, y0, x1, y1, dur, minSpan) {
    var span = Math.max(minSpan || 400, y1 - y0, (x1 - x0) * (H / W));
    volar({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: (span * 1.35) / H }, dur);
  }
  function aUnidades(ev) {
    var b = svg.getBoundingClientRect();
    return { x: cam.cx + (ev.clientX - b.left - W / 2) * cam.s, y: cam.cy + (ev.clientY - b.top - H / 2) * cam.s };
  }

  function interaccion() {
    var ptrs = {}, ultimo = null, distIni = 0, sIni = 0, movido = false;
    svg.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      if (anim) { cancelAnimationFrame(anim); anim = null; }
      var u = aUnidades(ev);
      zoom(Math.exp(ev.deltaY * 0.0015), u.x, u.y);
    }, { passive: false });
    svg.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      // Sin captura inmediata: así el clic llega a la región o al pin; se captura al empezar a arrastrar.
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      movido = false; ultimo = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(ptrs);
      if (ids.length === 2) {
        var a = ptrs[ids[0]], b = ptrs[ids[1]]; distIni = Math.hypot(a.x - b.x, a.y - b.y); sIni = cam.s;
        ids.forEach(function (id) { try { svg.setPointerCapture(+id); } catch (e) { /* puntero ya liberado */ } });
      }
      if (anim) { cancelAnimationFrame(anim); anim = null; }
    });
    svg.addEventListener('pointermove', function (ev) {
      if (!ptrs[ev.pointerId]) return;
      ptrs[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      var ids = Object.keys(ptrs);
      if (ids.length === 2) {
        var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distIni) { cam.s = limites(sIni * (distIni / d)); aplicar(); }
        movido = true; return;
      }
      var dx = ev.clientX - ultimo.x, dy = ev.clientY - ultimo.y;
      if (!movido && Math.hypot(dx, dy) < 4) return;
      if (!movido) { try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* sin captura */ } }
      movido = true; svg.classList.add('arrastrando'); ocultarTip();
      cam.cx -= dx * cam.s; cam.cy -= dy * cam.s; ultimo = { x: ev.clientX, y: ev.clientY }; aplicar();
    });
    function fin(ev) {
      delete ptrs[ev.pointerId];
      svg.classList.remove('arrastrando');
      if (Object.keys(ptrs).length < 2) distIni = 0;
      var ids = Object.keys(ptrs); if (ids.length === 1) ultimo = ptrs[ids[0]];
    }
    svg.addEventListener('pointerup', fin);
    svg.addEventListener('pointercancel', fin);
    svg.addEventListener('lostpointercapture', fin);
    window.addEventListener('pointerup', fin); // si se suelta fuera del mapa antes de capturar
    // Un arrastre no debe contar como clic en un pin.
    svg.addEventListener('click', function (ev) { if (movido) { ev.stopPropagation(); ev.preventDefault(); } }, true);
    svg.addEventListener('dblclick', function (ev) { var u = aUnidades(ev); volar({ cx: u.x, cy: u.y, s: cam.s / 2 }, 260); });
  }

  function mostrarTip(ev, html) {
    if (svg.classList.contains('arrastrando')) return;
    var b = svg.getBoundingClientRect();
    tip.innerHTML = html; tip.hidden = false;
    var x = ev.clientX - b.left + 14, y = ev.clientY - b.top + 14;
    if (x + tip.offsetWidth > b.width - 8) x = ev.clientX - b.left - tip.offsetWidth - 14;
    if (y + tip.offsetHeight > b.height - 8) y = ev.clientY - b.top - tip.offsetHeight - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function ocultarTip() { tip.hidden = true; }

  // ---------------------------------------------------------------- Capas por año
  var islas = {};
  function setAnio(anio) {
    var activas = [];
    zonas.forEach(function (z) {
      var f = faseActiva(z.t, anio); z.fase = f;
      z.n.classList.toggle('on', !!f);
      if (!f) return;
      var e = ESTILO[f[2]] || ESTILO.chile;
      var alt = f[2] === 'extranjero' && extIdx[z.t.id] % 2 === 1;
      var fill = f[2] === 'originario' ? 'var(--o' + ((origIdx[z.t.id] % 6) + 1) + ')' : alt ? 'url(#p-extranjero-2)' : e.fill;
      z.n.style.fill = fill; z.n.style.fillOpacity = e.op;
      activas.push({ f: f, fill: fill, e: alt ? { op: 1, css: 'repeating-linear-gradient(90deg,var(--z-extranjero) 0 2px,transparent 2px 5px)' } : e });
    });
    terr.forEach(function (t) {
      if (!t.inset || !islas[t.inset]) return;
      var f = faseActiva(t, anio), n = islas[t.inset].tierra;
      if (f) {
        var e = ESTILO[f[2]] || ESTILO.chile;
        n.style.fill = f[2] === 'originario' ? 'var(--o4)' : (e.css ? 'var(--z-' + f[2] + ')' : e.fill);
        n.style.fillOpacity = e.op < 1 ? Math.min(1, e.op + 0.25) : 0.6;
        activas.push({ f: f, fill: n.style.fill, e: e });
      } else { n.style.fill = ''; n.style.fillOpacity = ''; }
    });
    leyenda(activas);
  }
  function leyenda(activas) {
    var vistos = {}, items = [];
    activas.forEach(function (a) {
      var etq = a.f[2] === 'chile' ? 'Chile' : a.f[3];
      if (vistos[etq]) return; vistos[etq] = 1;
      var bg = a.e.css || a.fill;
      items.push('<li><i style="background:' + bg + ';opacity:' + (a.e.css ? 1 : Math.min(1, a.e.op + 0.2)) + '"></i><span>' + etq + '</span></li>');
    });
    opts.leyenda.innerHTML = items.length ? '<p class="leyenda-t">Territorios en esta fecha</p><ul>' + items.join('') + '</ul>' : '';
  }

  // ---------------------------------------------------------------- Islas y Antártica
  function initIslas(cont, onClick) {
    var defs = [['rapanui', 'Rapa Nui'], ['juanfernandez', 'Juan Fernández'], ['antartica', 'Antártica chilena']];
    defs.forEach(function (d) {
      var b = document.createElement('button');
      b.className = 'isla'; b.type = 'button';
      b.innerHTML = '<span class="isla-t">' + d[1] + '</span>';
      var s = el('svg', { 'aria-hidden': 'true' }, b);
      var tierra, info = M.insets[d[0]];
      if (info) {
        s.setAttribute('viewBox', [-8, -8, info.w + 16, info.h + 16].join(' '));
        tierra = el('path', { d: info.d, class: 'i-tierra' }, s);
      } else {
        // Antártica: esquema polar del sector 53°–90° O.
        s.setAttribute('viewBox', '0 0 120 60');
        el('path', { d: 'M8 58 Q60 34 112 58 Z', class: 'i-tierra', style: 'fill:var(--land)' }, s);
        tierra = el('path', { d: 'M60 58 L30 4 A60 60 0 0 1 84 2 Z', class: 'i-tierra' }, s);
      }
      var pin = el('circle', { r: 0, class: 'i-pin' }, s);
      b.addEventListener('click', function () { onClick(d[0]); });
      cont.appendChild(b);
      islas[d[0]] = { b: b, tierra: tierra, pin: pin, info: info };
    });
  }
  function enInset(ev) {
    if (ev.lat == null) return null;
    for (var k in M.insets) {
      var bb = M.insets[k].bbox;
      if (ev.lon >= bb[0] - 0.3 && ev.lon <= bb[2] + 0.3 && ev.lat >= bb[1] - 0.3 && ev.lat <= bb[3] + 0.3) return k;
    }
    if (ev.lat < -60) return 'antartica';
    return null;
  }

  // ---------------------------------------------------------------- Pines de eventos
  // Región actual de cada momento: punto dentro del polígono; islas → Valparaíso; Antártica → Magallanes.
  function regionDe(ev) {
    if (ev.lat == null) return -1;
    var ins = enInset(ev), buscar = function (n) { for (var i = 0; i < M.regiones.length; i++) if (M.regiones[i].nombre === n) return i; return -1; };
    if (ins === 'antartica') return buscar('Magallanes');
    if (ins) return buscar('Valparaíso');
    var x = px(ev.lon), y = py(ev.lat), anillo = [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8], [18, 0], [-18, 0], [0, 18], [0, -18]];
    for (var k = 0; k < anillo.length; k++) {
      for (var i = 0; i < regEls.length; i++) {
        try { if (regEls[i].isPointInFill(new DOMPoint(x + anillo[k][0], y + anillo[k][1]))) return i; } catch (e) { return -1; }
      }
    }
    var mejor = -1, dm = Infinity;
    M.regiones.forEach(function (r, i) { var d = Math.hypot(r.cx - x, r.cy - y); if (d < dm) { dm = d; mejor = i; } });
    return mejor;
  }
  function setEventos(eventos, onPin) {
    regEv = M.regiones.map(function () { return []; });
    eventos.forEach(function (ev) { var i = regionDe(ev); evReg[ev.id] = i; if (i >= 0) regEv[i].push(ev.id); });
    eventos.forEach(function (ev) {
      if (ev.lat == null || enInset(ev)) return;
      var g = el('g', { class: 'pin', tabindex: '-1', role: 'button', 'aria-label': fmtAnio(ev.anio) + ', ' + ev.titulo, 'data-id': ev.id }, gPins);
      var x = px(ev.lon), y = py(ev.lat);
      var a = el('circle', { cx: x, cy: y, r: 1, class: 'anillo' }, g);
      var c = el('circle', { cx: x, cy: y, r: 1, class: 'punto' }, g);
      g.addEventListener('click', function () { ocultarTip(); onPin(ev.id, c); });
      g.addEventListener('pointermove', function (e) { mostrarTip(e, '<b>' + fmtAnio(ev.anio) + '</b> · ' + ev.titulo); });
      g.addEventListener('pointerleave', ocultarTip);
      pins[ev.id] = { g: g, c: c, a: a, x: x, y: y };
    });
    aplicar();
  }
  function marcar(evSel, periodoIds) {
    var set = {}; periodoIds.forEach(function (id) { set[id] = 1; });
    for (var id in pins) {
      var p = pins[id], sel = evSel && id === evSel.id;
      p.g.classList.toggle('periodo', !!set[id]);
      p.g.classList.toggle('fuera', !set[id]);
      if (sel !== p.g.classList.contains('sel')) {
        p.g.classList.toggle('sel', sel);
        if (sel) gPins.appendChild(p.g); // al frente
      }
    }
    for (var k in islas) {
      var i = islas[k], dentro = evSel && enInset(evSel) === k;
      i.b.classList.toggle('sel', !!dentro);
      if (dentro && i.info) {
        var ii = i.info, cos = ii.cos;
        i.pin.setAttribute('cx', (evSel.lon - ii.bbox[0]) * cos * ii.k);
        i.pin.setAttribute('cy', (ii.bbox[3] - evSel.lat) * ii.k);
        i.pin.setAttribute('r', 6);
      } else i.pin.setAttribute('r', 0);
    }
    aplicar();
  }
  function enfocar(ev, dur, eventosPeriodo) {
    if (ev && ev.lat != null && !enInset(ev)) {
      var x = px(ev.lon), y = py(ev.lat);
      // Encuadre de ~6° de latitud; si ya estaba más cerca, se respeta su zoom.
      volar({ cx: x, cy: y, s: Math.min(cam.s, 620 / H) }, dur);
      return;
    }
    encuadrarEventos(eventosPeriodo || [], dur);
  }
  function encuadrarEventos(lista, dur) {
    var pts = lista.filter(function (e) { return e.lat != null && !enInset(e); });
    if (!pts.length) { verTodo(dur); return; }
    var xs = pts.map(function (e) { return px(e.lon); }), ys = pts.map(function (e) { return py(e.lat); });
    encuadrar(Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys), dur, 500);
  }
  function toggleRegiones() { return svg.classList.toggle('con-regiones'); }
  function region(i) { var r = M.regiones[i]; return r && { i: i, nombre: nombreRegion(r), corto: r.nombre, capital: r.capital, numero: r.numero, eventos: regEv[i] || [] }; }
  function regionDeEvento(id) { return evReg[id] == null ? -1 : evReg[id]; }
  function resaltarRegion(i) {
    regEls.forEach(function (p, k) { p.classList.toggle('activa', k === i); });
    if (regEls[i]) regEls[i].parentNode.appendChild(regEls[i]); // el borde resaltado queda encima de sus vecinas
    svg.classList.toggle('con-foco', i >= 0);
  }
  function encuadrarRegion(i, dur) {
    var b = regEls[i] && regEls[i].getBBox();
    if (b) encuadrar(b.x, b.y, b.x + b.width, b.y + b.height, dur, 220);
  }
  // Elemento en pantalla desde donde "nace" la lámina de un momento.
  function origen(id) {
    var p = pins[id];
    if (p && !p.g.classList.contains('fuera')) return p.c;
    for (var k in islas) if (islas[k].b.classList.contains('sel')) return islas[k].b;
    return p ? p.c : null;
  }

  // ---------------------------------------------------------------- Localizador (silueta + punto)
  function localizador(s) {
    s.setAttribute('viewBox', [-30, -30, M.w + 60, M.h + 60].join(' '));
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    M.regiones.forEach(function (r) { el('path', { d: r.d, class: 'l-tierra' }, s); });
    var marcaReg = el('path', { d: '', class: 'l-region' }, s);
    var halo = el('circle', { r: 0, class: 'l-halo' }, s), punto = el('circle', { r: 0, class: 'l-punto' }, s);
    return function (ev) {
      var i = ev ? regionDeEvento(ev.id) : -1;
      marcaReg.setAttribute('d', i >= 0 ? M.regiones[i].d : '');
      var ok = ev && ev.lat != null && !enInset(ev);
      [halo, punto].forEach(function (c, k) {
        c.setAttribute('cx', ok ? px(ev.lon) : 0); c.setAttribute('cy', ok ? py(ev.lat) : 0);
        c.setAttribute('r', ok ? (k ? 34 : 110) : 0);
      });
    };
  }

  // ---------------------------------------------------------------- Mapa de portada
  function hero(s, eventos) {
    s.setAttribute('viewBox', [-40, -30, M.w + 80, M.h + 60].join(' '));
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    [-20, -30, -40, -50].forEach(function (lat) {
      el('line', { x1: 0, x2: M.w, y1: py(lat), y2: py(lat), class: 'h-lat' }, s);
      var t = el('text', { x: 0, y: py(lat) - 18, class: 'h-lat-t', 'font-size': 58 }, s);
      t.textContent = Math.abs(lat) + '° S';
    });
    M.regiones.forEach(function (r) { el('path', { d: r.d, class: 'h-tierra' }, s); });
    eventos.forEach(function (ev) {
      if (ev.lat == null || enInset(ev)) return;
      el('circle', { cx: px(ev.lon), cy: py(ev.lat), r: 16, class: 'h-punto', 'fill-opacity': 0.75 }, s);
    });
  }

  window.Mapa = { init: init, setAnio: setAnio, setEventos: setEventos, marcar: marcar, enfocar: enfocar,
    encuadrarEventos: encuadrarEventos, verTodo: verTodo, zoom: zoom, toggleRegiones: toggleRegiones,
    initIslas: initIslas, enInset: enInset, hero: hero, fmtAnio: fmtAnio, region: region, regionDeEvento: regionDeEvento,
    resaltarRegion: resaltarRegion, encuadrarRegion: encuadrarRegion, origen: origen, localizador: localizador,
    nRegiones: M.regiones.length };
})();
