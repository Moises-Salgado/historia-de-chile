---
tipo: proyecto
tags:
  - proyecto
---
# Decisiones

Registro de lo ya decidido, para no volver a discutirlo. Todo agente lo lee antes de trabajar y agrega una línea al final cuando decide algo nuevo (fecha · decisión · por qué).

## Dirección
- 2026-11-06 · Estilo **cinematográfico con propósito** (reemplaza «sin animaciones al hacer scroll»). Movimiento fuerte en portada, transiciones, relatos y escenas al hacer scroll; la lectura queda limpia. Siempre se respeta `prefers-reduced-motion` y el teclado no anima. · Lo aprobó el usuario.
- 2026-11-06 · Sin sección «Segundo cerebro» en la página. El vault es la fuente, no un contenido visible. · Pedido del usuario.
- 2026-11-06 · Sitio publicado en GitHub Pages (Moises-Salgado/historia-de-chile) con un flujo que publica `site/` en cada push a `main`.

## Imágenes
- Solo Wikimedia Commons con licencia libre, verificada por `build-img.mjs`. Autor y licencia siempre visibles. Nada generado por IA, menos aún rostros de personas reales.
- Las obras verticales se muestran completas sobre su propia versión difuminada; no se recortan.
- ~~Periodo «Dictadura militar»: foto documental de la Junta (BCN), no el retrato oficial de Pinochet, que podía leerse como homenaje.~~ Reemplazada el 2026-11-07 por decisión del dueño: «¿Dónde están?» (Paulo Slachevsky, enero de 1990, CC BY-SA 4.0), familiares de detenidos desaparecidos en Londres 38. Muestra a las víctimas y no a la Junta.
- 2026-11-07 · **Ítem 2.13 (A14):** las imágenes de periodo muestran escenas o procesos, no retratos individuales. Cambios: Conquista → «Fundación de Santiago» (Lira, 1888); Organización → feria popular (Schmidtmeyer, 1824); Conservadora → la Pampilla (Rugendas, 1837); Liberal → parlamento de Saavedra con lonkos (c. 1869); Parlamentaria → calicheros (1906); Presidencial → mesa de votación de 1938; Recuperación → concentración por el No (BCN, 1988). Dictadura sigue con la Junta. Cada periodo tiene además `gancho:` (ítem 2.17). Todo queda con `revisado: pendiente`. · Por qué: 7 de 11 periodos eran retratos de autoridades y 9 de 11 mostraban solo hombres.

## Audio y relatos
- Relatos narrados con HyperFrames → MP4 con voz, música y subtítulos. El piloto es el Combate Naval de Iquique; si al usuario le gusta, se extiende a cada momento.
- Voz: ElevenLabs con la cuenta del usuario (clave en `.env`, nunca en git). Las voces de personajes históricos se rotulan como *recreación dramatizada con voz sintética*.
- Música: **composición original** («tensión» en Do menor y «marcha» heroica en Mi bemol, al estilo de las marchas militares chilenas del s. XIX), sintetizada por `scripts/musica-relato.mjs` (sintetizador propio, sin muestras ni programas externos). · El Himno de Yungay (Zapiola, 1839) es de dominio público, pero la única partitura libre (Commons, 550 px) no permite una transcripción fiel y las grabaciones están protegidas. Pendiente: usar Yungay si aparece una partitura libre y nítida (la U. de Chile planea digitalizar la primera edición).
- 2026-11-06 · Plan gratis de ElevenLabs: por API solo se pueden usar voces de serie (ni biblioteca ni diseño de voces). Piloto con «George» (narrador, multilingual_v2) y «Harry» (Prat, eleven_v3). Con plan Starter: cambiar a voces chilenas de la biblioteca (Nico Clemens / Murdock Talagante) en `relatos/build-relato.mjs` y regenerar. El plan gratis exige atribuir «ElevenLabs» y uso no comercial: el sitio es educativo sin fines de lucro.
- Guion verificado por el agente historiador antes de grabar (madera contra hierro, arenga «según la tradición», tres espolonazos, rescate de náufragos por Grau, perspectiva peruana).
- Citas históricas (p. ej., la arenga de Prat): versión tradicional, advirtiendo que fue reconstruida a partir de testimonios.
- 2026-11-07 · **D1 y D5 aplicados** al relato de Iquique. D1: Prat ya no tiene voz sintética (se retira la voz «Harry»); su arenga y su grito aparecen en un cartel de cita («…» + pie «según la tradición», definido en `carteles:` del guion), con pausa dramática de la música. Solo el narrador (George) tiene voz. D5: subtítulos WebVTT activables en `site/video/relatos/<id>.vtt` (desde el alignment de ElevenLabs; ≤ 42 caracteres por línea y ≤ 2 líneas por cue; el cartel también tiene cues), ya no quemados en la imagen. Además: versión 9:16 `<id>-vertical.mp4` (720×1280, flag `--vertical`) y entrega en H.264 + AAC con +faststart, ≤ 15 MB, volumen medio −18 dB. · Lo aprobó el dueño (acta del debate general, ítem 2.10).

## Crítica de diseño aplicada (2026-11-06)
- CSS con `translate`/`scale` sueltos y GSAP con `transform`: nunca se pisan.
- Apertura en una sola coreografía (título → texto → tarjetas → mapa que se dibuja → puntos de norte a sur), sin `scale(0)` ni rebotes; el texto espera oculto con respaldo CSS a 2,5 s.
- Portada a sangre bajo la barra (degradado, sin desenfoque), fundido al papel al bajar, botón «Pausar fondo» (WCAG 2.2.2), bucle del fondo sin pasar por negro.
- Sala de cine con velo que «apaga las luces»; los resúmenes de periodo también se ven ahí.
- Años en Newsreader con cifras tabulares; texto chico con token `--ui-xs` que crece en modo Niños; detalle de la línea de tiempo con alto fijo (reemplazado el 2026-11-07 por la mesa de atlas: alto según carriles); vecinos del mapa difuminados en los bordes.
- ~~Pendiente: rehacer el vuelo de la lámina con FLIP + clip-path.~~ Hecho el 2026-11-07.
- 2026-11-07 · Con «reducir movimiento» (Windows con «Efectos de animación» apagado, como en el PC del dueño), el fondo de la portada no hace zoom ni paneo, pero sigue cambiando: fundidos lentos de 9 s entre tomas. · El dueño veía el fondo quieto.

- 2026-11-07 · **Revisión humana:** por ahora la hace solo el dueño. Firma con `revisado: "Nombre · AAAA-MM-DD"` en cada nota; la lista de pendientes está en [[Cobertura]].

## Debates
- 2026-11-07 · Agentes `abogado-del-diablo` (ataca todo) y `visionario` (propone y defiende). Debaten en 4 rondas y el moderador cierra con un acta. La transcripción completa se guarda en `segundo-cerebro/Debates/` (el build no lee esa carpeta). Se repite con `/debate [tema]`. Nada del acta se implementa sin aprobación del dueño.
- 2026-11-07 · El dueño aprobó el acta completa (D1–D9 y todas las fases), **salvo el dominio propio**: por ahora el sitio sigue en `moises-salgado.github.io/historia-de-chile`. Las URL canónicas, el sitemap y «Cómo citar» usan esa dirección. Si después hay dominio, se migra con redirecciones.

## Aplicado del debate (2026-11-07)
- **Historial:** abrir una lámina, ficha o región agrega una entrada (`pushState`). Atrás la cierra y no saca del sitio. Cerrar con la X equivale a Atrás.
- **Movimiento:** la clase `html.rm` (la pone el `<head>`) reemplaza la media query. Menú → Movimiento: Automático / Completo / Reducido, y se recuerda. En reducido quedan fundidos de 120 a 250 ms, sin vuelos.
- **Portada:**
  - el título es visible desde el primer cuadro;
  - una sola llamada («Empieza el viaje») más el relato;
  - la versión pasa a ser un ajuste secundario;
  - sin las tres tarjetas de versión.
- **Menú:** secciones, Movimiento y Modo proyector (`?clase`). Las secciones también aparecen en móvil.
- **Videos mudos de periodo:** retirados y borrados (D6). `npm run video` queda para hacerlos narrados si el piloto lo pide.
- **Fuentes tipográficas:** alojadas en `site/fonts/` (OFL). Ya no hay peticiones a Google.
- **FFmpeg:** portátil en el proyecto (devDependencies `ffmpeg-static` y `ffprobe-static`, resueltos por `scripts/ffmpeg.mjs`).
- **Lámina:**
  - Compartir, «Cómo citar», «Reportar un error» (issue de GitHub prellenado) y título propio;
  - fuentes enlazadas y estado de revisión;
  - la sala de cine se abre sobre la lámina y vuelve a ella;
  - vuelo FLIP con `transform` + `clip-path` (resuelve el pendiente del 06-11).
- **Hoja de trabajo imprimible:** imprime solo la versión elegida, con mapa, lugar y personajes, las preguntas del bloque de maestros con líneas para responder, y nombre, curso y fecha. Sale siempre en claro y sin el bloque del docente.
- **Protocolo editorial:**
  - campos `revisado:`, `fuentes:` y `genero:` (ver Guía de contenido);
  - `npm run build` escribe [[Cobertura]];
  - página `site/como-se-hace.html` con metodología, uso de IA, licencia CC BY-SA 4.0, privacidad y fe de erratas.
- **Páginas por momento** (`site/momento/<id>.html`, generadas por `scripts/build-paginas.mjs`):
  - livianas (unos 66 KB, sin el atlas);
  - Open Graph y JSON-LD (Article + LearningResource);
  - `noindex` mientras no cumplan el umbral (300 palabras, fuentes y revisión);
  - sitemap solo con lo indexable.
- **Mesa de atlas** (escritorio de 1101 px o más de ancho y 760 px o más de alto): la franja fija arriba lleva años y periodos; el mapa queda fijo a la izquierda (36 %); el detalle del periodo y el relato van a la derecha, que se desplaza con la página, sin scroll anidado ni carrusel. La lente mide solo los carriles que usa. Un solo año protagonista. La leyenda es plegable, también en móvil.
- **Búsqueda** en la barra (en móvil, lupa): momentos, personas, lugares, pueblos y periodos, sin importar tildes. Atajo «/».
- **Rutas guiadas** (`segundo-cerebro/Rutas/`): secuencias curadas de momentos existentes. Dentro de una ruta, Anterior y Siguiente la siguen.
- **Efemérides del mes** (sección maestros), con las fechas julianas marcadas.
- **Escuchar** en la versión Niños: solo voces instaladas en el equipo (`localService`), para que el texto no salga del navegador. Hoy hay voces es-MX y es-ES, no chilenas; se queda solo si pasa la prueba con niños.
- **Mapa accesible:** grupo con nombre (no `img`), pines con nombre y selector nativo de regiones. Un anuncio corto reemplaza al `aria-live` sobre todo el relato. Las imágenes con pie llevan `alt=""` para no leer el texto dos veces.
- **Imágenes WebP** (`npm run webp`): 36,9 MB → 18,4 MB. El original queda para Open Graph.
- **OA oficiales:** `segundo-cerebro/Proyecto/oa-por-momento.json` (76 de 77 momentos, verificados en curriculumnacional.cl con código completo, p. ej. `HI06 OA 02`). El build los muestra en el bloque de maestros y en las páginas por momento. «Momentos por nivel» pasó a ser **Mi curso**: un momento aparece en cada curso donde lo piden sus OA. La Priorización 2023-2025 venció en marzo de 2026, así que no se usa.
- **Tarjetas para compartir** (`npm run og`): 1200×630 por momento y para la portada, con FFmpeg y tipografías TTF en `scripts/fuentes/` (OFL), con velo en degradado continuo. Las páginas por momento las usan como `og:image`.
- **Índice editorial de periodos:** cada periodo tiene `gancho:` (una frase) y su tarjeta lo muestra completo con la cantidad de momentos, en vez de un resumen cortado.
- **Caminar en el 360°** (pedido del dueño), estilo Street View: ↑/W avanza hacia la flecha que queda al frente (±60°, se destaca en cobre), ↓/S vuelve a la escena anterior (memoria de pasos), ←→/A D giran 15° y Shift+↑↓ mira arriba o abajo. Es una excepción a «el teclado no anima»: dentro del visor el avance es la interacción principal, así que se anima salvo con `html.rm`.
- **Versión de caché `?v=31`:** al cambiar los datos hay que subirla en `index.html` y `como-se-hace.html` (las páginas por momento y `sw.js` la copian solas). Con la versión anterior, el navegador seguía usando el `historia.js` viejo.
- **Pendiente:** lente de Niños con periodos de igual ancho y barra de clase para Maestros (2.15); `<symbol>`/`<use>` para el contorno repetido y datos por periodo (2.12); documentos primarios (2.2), que esperan las subidas a Commons del dueño (D4); piloto con cursos y revisor humano (D7, D8).
- 2026-11-07 · **Recorridos 360°** (`segundo-cerebro/Recorridos/`, `npm run 360`, sección `#recorridos`). En Commons no hay panorámicas 360° libres de los sitios históricos, así que el sitio tiene dos recorridos propios con panorámicas CC BY 4.0 de ESO: La Silla con sus petroglifos (4 escenas) y Paranal (6 escenas). Los 14 oficiales externos se enlazan en otra pestaña: los 9 de Patrimonio Virtual, el Huáscar en Matterport, Orongo en CyArk y 3 tours de ESO. No se incluyen ni el anuncio del blog de Google ni el tour de las oficinas de ESO en Santiago, porque no es un lugar histórico. El visor es un cubo en CSS 3D, sin WebGL, para que funcione en `file://`. Cada cara mide 1024 px y lleva 2 texeles de margen (FOV de 90,2°), así que las caras se solapan y no se ven costuras; cada sprite pesa 1,5 MB o menos. Al avanzar, la cámara va hacia la flecha y se funde a negro en 600 ms; con `html.rm` o con teclado solo hay un fundido de 200 ms. `img.decode()` se espera 250 ms como máximo, porque se resuelve con el siguiente cuadro del compositor y a pocos fps dejaba la escena en negro. Atrás cierra el visor gracias a una entrada de historial con sello propio. · Por qué: el dueño pidió «Street View por lugares históricos». Es lo más cercano que se puede hacer con licencia libre, y queda abierto a sumar panorámicas que la gente suba a Commons.

## Contenido
- 2026-11-07 · Lote 1 (ítem 1.9 y vacíos de A16): el genocidio selk'nam sale del momento fechado en el 8.000 a.C. y pasa a «Ocupación de Tierra del Fuego y genocidio selk'nam» (c. 1880–1910; año ancla 1883, primera concesión ganadera en la isla). «Pueblos canoeros y cazadores del extremo sur» queda solo con la época antigua y remite al nuevo momento. Nuevos: Movimiento mapuche del siglo XX (1910), Rebelión de María Angata (1914) y su ficha, Colonización de Aysén (1903), La Nueva Canción Chilena (1965) y la ficha de Violeta Parra, Astronomía en el norte de Chile (1969) y Migración del siglo XXI (2021). Rapa Nui 1888 y Ley Indígena 1993 ya existían. · Por qué: la línea de tiempo dejaba a los pueblos originarios en la prehistoria, Aysén tenía 0 momentos y había 5 mujeres entre 39 personajes. Todo queda con `revisado: pendiente` hasta que lo firme una persona; la corrección selk'nam falta en la fe de erratas (`site/como-se-hace.html#erratas`).

## Técnica
- GSAP local en `site/js/vendor/` (core, CustomEase, ScrollTrigger, SplitText, DrawSVG). Sin CDN.
- El estado nunca depende del final de una animación (los navegadores de prueba van a ~1 fps).
