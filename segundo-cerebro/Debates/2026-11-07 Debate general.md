---
tipo: debate
fecha: 2026-11-07
tema: La app completa — qué le falta para ser de nivel mundial
participantes: [abogado-del-diablo, visionario]
estado: cerrado
---
# Debate general · 2026-11-07

**Contexto.** El dueño pidió una crítica sin piedad de *todo* el sitio: animaciones, fotos, funciones que faltan, secciones nuevas, etc. La meta es saber qué le falta para ser algo extraordinario, de nivel Silicon Valley o mejor.

Participan dos agentes:
- `abogado-del-diablo`: ataca.
- `visionario`: propone y defiende.

Debaten en cuatro rondas y el moderador (Claude) cierra con un acta. **Nada se implementa sin aprobación del dueño.**

**Estado del sitio al empezar** (v3, cinematográfica):
- Portada con fondo en movimiento: zoom y paneo; fundidos si «reducir movimiento» está activo.
- Apertura animada con SplitText y DrawSVG.
- Línea de tiempo `crono`.
- Mapa histórico con regiones clicables.
- Láminas de evento.
- 11 videos-resumen por periodo.
- Un relato piloto narrado: *Combate Naval de Iquique*.

Hay tres versiones (niños, adultos y maestros). Las imágenes vienen de Wikimedia Commons. El sitio se publica en GitHub Pages.

**Ojo:** el PC del dueño tiene «Efectos de animación» apagado en Windows. Con eso, el navegador pide reducir el movimiento.

---

## Ronda 1 · Abogado del diablo — Un atlas bonito que nadie va a encontrar y que un profesor no puede usar mañana
**Veredicto:** Hay buen oficio en lo pequeño: tipografía cuidada, contraste correcto, cero errores de consola y un teclado que se tomó en serio. Pero como producto es un folleto con fondo animado: Google no lo ve, el móvil está a medio hacer, el botón Atrás te echa del sitio, el texto es delgado y al profesor le pide materiales que no le entrega. **4/10** frente a lo mejor de su categoría (NYT/The Pudding en interactivos, Memoria Chilena en fuentes, Khan Academy y Chile para Niños en pedagogía).

*Método:* recorrí el sitio con Playwright a 1440×900, 768×1024, 390×844 y 844×390, con reduce-motion encendido y apagado, en modo claro y oscuro. Hice un perfil de CPU, medí con la Performance API y simulé un móvil medio (CPU 4×, 1,6 Mb/s, 150 ms de latencia). El servidor local es Python SimpleHTTP, que no comprime ni acepta peticiones por rangos, así que los bytes de red están inflados; los tiempos de CPU no. En el sitio publicado comprobé que GitHub Pages sí comprime. Capturas (temporales, en el scratchpad de la sesión):
- C:\Users\misb_\AppData\Local\Temp\claude\a83701bc55c6b84b\d5b2e192-a339-4fa5-8d38-0073403b259e\scratchpad\03-explorar-1440.png
- C:\Users\misb_\AppData\Local\Temp\claude\a83701bc55c6b84b\d5b2e192-a339-4fa5-8d38-0073403b259e\scratchpad\06-regiones-hover.png
- C:\Users\misb_\AppData\Local\Temp\claude\a83701bc55c6b84b\d5b2e192-a339-4fa5-8d38-0073403b259e\scratchpad\14-hero-retina-recorte.png
- C:\Users\misb_\AppData\Local\Temp\claude\a83701bc55c6b84b\d5b2e192-a339-4fa5-8d38-0073403b259e\scratchpad\18-print.png
- C:\Users\misb_\AppData\Local\Temp\claude\a83701bc55c6b84b\d5b2e192-a339-4fa5-8d38-0073403b259e\scratchpad\22-m-1500.png
- C:\Users\misb_\AppData\Local\Temp\claude\a83701bc55c6b84b\d5b2e192-a339-4fa5-8d38-0073403b259e\scratchpad\25-m-relato.png
- C:\Users\misb_\AppData\Local\Temp\claude\a83701bc55c6b84b\d5b2e192-a339-4fa5-8d38-0073403b259e\scratchpad\26-video-periodo.png

### Primeros 5 segundos y producto
- **A1 · [producto] [alto]** La primera decisión que pide la portada es elegir una «versión». Las tres tarjetas Niños/Adultos/Maestros hacen de llamada principal y repiten el selector de la barra (`index.html:30-35` y `50-63`). Lo único realmente atractivo, el relato narrado, queda como un botón secundario. Tampoco hay un adelanto del explorador: el mapa de la portada es decorativo y sus puntos no responden al clic. *Evidencia:* captura 01-portada-1440 y portada en 390 px. *Por qué importa:* en los primeros 5 segundos se entiende qué es, pero no por qué quedarse; un niño o un profe no debería empezar configurando. *Exijo:* una sola llamada clara («Empieza el viaje» o «Mira el relato») y el selector de versión como ajuste secundario. La portada debería mostrar un momento real, vivo y clicable.
- **A2 · [producto] [medio]** El sitio no tiene nombre propio. «Historia de Chile» compite en Google con Wikipedia, Memoria Chilena e Icarito; el logo es una línea dentro de un cuadrado. La meta descripción promete «la historia **completa** de Chile» con 70 momentos (`index.html:7`), lo que exagera. *Exijo:* un nombre que se pueda recordar y buscar, y una promesa honesta.

### Diseño visual
- **A3 · [diseño] [alto]** El explorador no logra mostrar tiempo y espacio juntos. A 1440×900, la línea de tiempo ocupa de y=88 a y=485 y el mapa empieza en y=509, así que lo central queda bajo el pliegue. La lente de detalle es una caja beige de 1200×200 px con ocho círculos de 46 px pegados abajo (en Poblamiento, más del 70 % vacío), porque `crono.js:215` le fija la altura de tres carriles. El año «12.500 a.C.» aparece **cinco veces** en la misma pantalla: contador, subtítulo, eje, regla de detalle y etiqueta del mapa. *Evidencia:* captura 03-explorar-1440. *Exijo:* una composición donde línea de tiempo y mapa se vean a la vez sin bajar, una lente compacta o de alto adaptable, y un solo año protagonista.
- **A4 · [diseño] [alto]** El mapa desperdicia cerca del 70 % de su panel: Chile es una tira de unos 150 px dentro de 530×812, rodeada de océano y de una Argentina vacía. Leyenda, recuadros de islas, controles y etiqueta del año flotan encima y tapan territorio (la leyenda cubre Magallanes). Los rótulos de región, de unos 9 px, chocan entre sí y con los pines («Arica»/«Parinacota», «Metropolitana»/«O'Higgins»; «La Araucanía» queda bajo el pin). En la leyenda, Perú y Bolivia usan la misma trama, y «Wallmapu» y «Pueblos chonos y kawésqar» son dos verdes casi iguales. *Evidencia:* capturas 05-rep-liberal-mapa y 06-regiones-hover. *Exijo:* aprovechar el eje largo de Chile (por ejemplo, horizontal bajo la línea de tiempo en escritorio), sacar la leyenda del mapa, usar tramas y colores distinguibles y evitar choques de rótulos.
- **A5 · [diseño] [medio]** Cara de plantilla. El hero es oscuro, con texto a la izquierda y gráfico a la derecha, más tres tarjetas. Siguen cuadrículas de tarjetas redondeadas con huecos: 11 periodos en 4 columnas dejan una fila de 3, y «Momentos por nivel» pone 6 tarjetas en 4 columnas, todas de 471 px de alto aunque «4° básico» tenga un solo ítem. Los textos de las tarjetas se cortan con «…» a mitad de frase. El cobre sirve para todo (enlaces, estado activo, chips, pines, CTA, años), así que la jerarquía queda plana. El cero tachado de Atkinson en texto corrido («14.5ØØ», «7Ø momentos», «2Ø26-11-Ø7») parece código, y la fecha del pie está en formato ISO (`app.js:421`). *Evidencia:* capturas 02-scroll-3600, 02-scroll-5400 y 02-scroll-6300. *Exijo:* una retícula editorial en vez de cuadrícula de tarjetas, un tratamiento visual por rol, ceros normales en el texto y la fecha escrita «7 de noviembre de 2026».

### Movimiento
- **A6 · [movimiento] [alto]** La apertura esconde el contenido. `estilos.css:627` aplica `.js .hero-texto { visibility: hidden }` hasta que GSAP termina de esperar `document.fonts.ready` (con fuentes de Google) o hasta 2,5 s. Las tarjetas llegan hacia los 1,9 s y el pie a los 3,8 s (`cine.js:95-104`). **LCP medido en el mismo equipo: 2.660 ms con movimiento y 1.056 ms con reduce.** La coreografía cuesta 1,6 s de LCP, y en el móvil simulado el LCP sube a 4,9 s. *Por qué importa:* Core Web Vitals y abandono. *Exijo:* texto visible desde el primer cuadro, con la animación como mejora y no como requisito; el CTA debe poder usarse antes de 800 ms.
- **A7 · [movimiento] [alto]** Con reduce-motion el sitio no se mueve menos: no se mueve nada. `mueve()` devuelve false (`app.js:28`) y eso apaga también los fundidos del relato, de la lámina y de los pasos. Contradice el propio comentario de `estilos.css:585` («se mantienen fundidos») y el Sistema de diseño, que solo prohíbe vuelos y desplazamientos. Además `cine.js:9` lee la preferencia una sola vez y no escucha cambios. *Por qué importa:* el dueño tiene «Efectos de animación» apagado, así que en su PC ve cortes secos en todo el sitio «cinematográfico»: nunca ha visto el producto que aprobó. *Exijo:* un perfil reduce con fundidos de opacidad de 150 a 250 ms y fundido cruzado en lámina y relato, probado en el PC del dueño.
- **A8 · [movimiento] [medio]** El vuelo de la lámina sigue animando `left/top/width/height` de un fantasma (`app.js:308-310`), lo que fuerza un recálculo de layout en cada cuadro en móvil; figura como pendiente en Decisiones desde el 06-11. Además, «Ver relato» cierra la lámina (`cine.js:150`) y al cerrar el cine no se vuelve a ella: comprobé que la lámina queda cerrada y el foco termina en `BODY`. *Exijo:* FLIP con transform y clip-path, y que el cine devuelva a la lámina de origen con el foco en su lugar.
- **A9 · [movimiento] [medio]** El Ken Burns de la portada amplía imágenes de 960 px a 1425×1044 y les suma scale 1,16: cerca de 1,9× en pantalla normal y 3,8× en retina. El fondo se ve lavado y con artefactos JPEG (la textura de los moai se empasta). *Evidencia:* naturalWidth 960 frente a clientWidth 1425; captura 14-hero-retina-recorte a 2×. *Exijo:* fuentes de 2400 px o más (Commons tiene los originales), AVIF/WebP y srcset.

### Fotos y medios
- **A10 · [medios] [alto]** Hay 328 imágenes y 38 MB, sin un solo WebP/AVIF, sin srcset y con tope de 960 px. Diecinueve pesan más de 300 KB; el retrato de Aylwin es un JPG de 1,16 MB a 960 px; las 20 imágenes en PNG suman 7,4 MB, entre ellas la del Centenario en la portada (566 KB). Dos imágenes de periodo miden solo 500 px (Pedro Montt 500×649, Alessandri 500×695) y se muestran a unos 637 px, ampliadas. *Exijo:* AVIF/WebP en 3 anchos con `srcset/sizes` y un máximo de 200 KB por imagen salvo la portada.
- **A11 · [medios] [alto]** Los 11 videos por periodo duran entre 17 y 30 s y suman 33 MB. **Son mudos** (`webkitAudioDecodedByteCount = 0`) y solo pasan título, fecha, imagen y un punto en el mapa, lo mismo que ya muestra la línea de tiempo. A la Dictadura le dedican 25 segundos sin una frase explicativa. Encima, el aviso de la sala de cine se monta sobre la barra de progreso. *Evidencia:* capturas 26-video-periodo y 27-video-periodo-b; duraciones medidas. *Exijo:* quitarlos, o rehacerlos con narración y argumento (causa, hecho y consecuencia) en 60 a 120 s.
- **A12 · [medios] [alto] [reabre decisión]** El relato de Iquique existe en un solo archivo de 1280×720 y 15,4 MB, sin versiones adaptativas. Los subtítulos están quemados en la imagen (no hay `<track>`; textTracks = 0). En móvil vertical el video mide 390×219 y el subtítulo queda en unos 7 px. La fecha «21 de mayo de 1879» en cobre sobre sepia casi no se lee, ni el crédito en gris claro. El aviso de voz sintética tapa los controles nativos (aviso en y=774-837, video en y=63-837). Es además el único relato para 70 momentos. *Evidencia:* capturas 09-relato-abre y 25-m-relato. *Exijo:* subtítulos WebVTT (activables, escalables, traducibles e indexables), transcripción publicada en la página y una versión 9:16 para móvil.
- **A13 · [medios] [medio] [reabre decisión]** Según Decisiones, a Prat lo dobla la voz de serie «Harry» y el narrador es «George» (plan gratis de ElevenLabs). Un héroe nacional chileno con una voz genérica que no es chilena será lo primero que note un profe o un niño. No pude escuchar el audio en el navegador de prueba: el riesgo sale de la decisión registrada. *Exijo:* pagar el plan Starter o grabar voces humanas chilenas (profes, teatro escolar). Son las voces las que hacen creíble un relato.
- **A14 · [medios] [medio]** Iconografía de «grandes hombres»: **9 de las 11 imágenes de periodo muestran solo hombres**. Siete son retratos individuales (Magallanes, Freire, Portales, J. J. Pérez, Montt, Alessandri y Aylwin), una es la Junta y otra el Abrazo de Maipú. No aparece ninguna mujer, ni multitudes, obreros, estudiantes o pueblos en el siglo XX. *Evidencia:* `HISTORIA.periodos[].img.pie`; captura 02-scroll-3600. *Exijo:* que la imagen de cada periodo muestre una escena o un proceso (salitreras, Unidad Popular, plebiscito, marchas), no al presidente de turno.

### Contenido e historia
- **A15 · [contenido] [crítico]** Profundidad de folleto. El texto adulto promedia **186 palabras por momento** (un minuto de lectura) para algo que promete «contexto, causas, consecuencias y debates». Las fichas de personajes, lugares y pueblos promedian **71 palabras**; en Niños, un pueblo originario recibe unas 21 (la del pueblo aymara es una sola frase). En total, 70 momentos para 14.500 años. *Evidencia:* medición sobre `window.HISTORIA`; captura 19-ficha-pueblo. *Exijo:* capas de profundidad (resumen, desarrollo, documentos, debates historiográficos) y fichas adultas de 250 palabras o más.
- **A16 · [contenido] [alto]** Vacíos de cobertura:
  - **Tiempo:** el siglo XVIII tiene 2 momentos (Selkirk en 1704, Osorno en 1796) y toda la Colonia, 6.
  - **Territorio:** Aysén tiene **0 momentos**, la Región Metropolitana 24 de 70 (34 %) y nueve regiones tienen 3 o menos.
  - **Personas:** hay 5 mujeres entre 39 personajes (13 %). Los 5 personajes indígenas son guerreros (Caupolicán, Lautaro, Pelantaro, Michimalonco, Kilapán) y no hay ninguna mujer indígena.
  - **Cultura:** Neruda aparece en una sola nota, sin ficha y sin el Nobel de 1971; Violeta Parra y Víctor Jara no aparecen nunca.
  - **Otros temas:** no hay ciencia (astronomía) y la migración del siglo XXI no tiene momento propio.

  *Evidencia:* grep en el vault y `Mapa.region(i).eventos`. *Exijo:* un plan de cobertura con metas por región, siglo, género y tema antes de seguir puliendo animaciones.
- **A17 · [contenido] [alto]** El genocidio selk'nam (fines del siglo XIX) está metido en un momento fechado «c. 8.000 a.C.»: `Eventos/Pueblos canoeros y cazadores del extremo sur.md`, con anio: -8000; el texto está en la línea 29. Así, la línea de tiempo deja a los pueblos originarios en la prehistoria y borra su historia republicana, justo lo contrario de «muchos siguen presentes hoy». *Exijo:* momentos propios y bien fechados para la ocupación de Tierra del Fuego y la Patagonia (1880-1910), las reducciones, el siglo XX mapuche, etc.
- **A18 · [contenido] [alto]** La versión «Maestros» no existe como tal: es el texto adulto más un recuadro (`app.js:121, 261`), y en las tarjetas de periodo es idéntica a Adultos (`app.js:385`). La versión Niños solo cambia el párrafo y agranda un paso la letra. La interfaz sigue siendo la misma para un niño de 2° básico: escala logarítmica, leyenda que dice «Wallmapu (territorio mapuche autónomo)», rótulos de 13 px. *Exijo:* versiones que cambien la experiencia completa, no solo el texto.

### Pedagogía
- **A19 · [pedagogía] [crítico]** Las actividades para maestros dependen de materiales que el sitio no entrega:
  - Iquique: «leen la carta de Miguel Grau a Carmela Carvajal y la respuesta de ella», pero la carta no está (`Eventos/Combate Naval de Iquique.md:40`).
  - Elecciones de 2025: «con los resultados oficiales del Servel… elaboran gráficos», pero el momento no da ni un porcentaje.
  - Las «Fuentes sugeridas» («Memoria Chilena; Museo Marítimo Nacional…») son nombres sin enlace.

  *Por qué importa:* el profe tiene que salir a buscar el material la noche antes, y entonces el sitio no le ahorra nada. *Exijo:* cada actividad con su fuente primaria incluida o enlazada (transcripción e imagen), lista para proyectar.
- **A20 · [pedagogía] [alto]** No hay currículo real detrás. No se cita ningún OA (grep «OA» = 0). Cada momento tiene un solo nivel, aunque el mismo hecho se trabaja en varios cursos. Aparece «4° básico · **1 momentos**» (con error gramatical, `app.js:399`) y faltan 8° básico y Educación Ciudadana. Tampoco hay evaluación: ni quiz, ni ticket de salida, ni rúbrica. El portal Currículum Nacional publica programas y OA por curso, además de la priorización 2023-2025. *Exijo:* etiquetar los OA oficiales por curso, un filtro «mi curso / mi unidad» y una evaluación formativa breve por momento.
- **A21 · [pedagogía] [alto]** «Imprimir lámina» está roto:
  - La hoja de impresión fuerza las tres versiones (`estilos.css:603`) y, como Maestros repite el texto adulto, **el texto adulto sale dos veces**.
  - Se imprime el botón «Ver relato narrado» encima de la imagen.
  - Se ocultan el mapa, el lugar y los personajes (`.lam-lado`), y no salen ni URL, ni QR, ni fecha.
  - El botón solo existe en modo Maestros.

  *Evidencia:* captura 18-print. *Exijo:* una hoja de trabajo diseñada como tal: la versión elegida, un mapa, una minilínea de tiempo, preguntas con líneas para responder y un QR al momento.
- **A22 · [pedagogía] [medio]** El modo Niños no ayuda a leer: no hay lectura en voz alta (en 2° básico tienen 7 años), ni glosario de palabras difíciles, ni ilustraciones, ni retos. Como referencia, *Chile para Niños* (Biblioteca Nacional, para 6 a 10 años) usa personajes guía (Memoriosa, Mariposa y el búho Medina), juegos y actividades descargables. *Exijo:* audio por párrafo (la infraestructura de ElevenLabs ya está montada), un glosario emergente y un minirreto por momento.

### Funciones y secciones que faltan (frente a referentes)
- **A23 · [funciones] [alto]** Faltan las funciones básicas de un archivo histórico:
  - **Búsqueda:** no hay un solo `<input>` en el DOM.
  - **Filtros** por tema, región o persona: Histography pone cada evento como un punto y deja filtrar por categoría con un deslizador de rango.
  - **Rutas guiadas** y **comparación de dos épocas** en el mapa.
  - **Glosario.**
  - **Documentos primarios:** cada sitio temático de Memoria Chilena trae documentos digitalizados, bibliografía y cronología.
  - **«Seguir donde quedaste»:** solo se guarda el modo.
  - **Modo proyector** para la sala.

  *Exijo:* empezar por búsqueda, rutas y documentos primarios.
- **A24 · [funciones] [medio]** No se puede compartir ni citar: no hay botón de copiar enlace, ni `navigator.share`, ni «cómo citar». El `document.title` no cambia al abrir un momento y se queda en «Historia de Chile · Atlas y línea de tiempo». *Exijo:* compartir nativo, cita APA por momento y un título propio para cada momento.

### Interacción y UX
- **A25 · [UX] [crítico]** **El botón Atrás saca al usuario del sitio.** Toda la navegación usa `history.replaceState` (`app.js:182, 197, 207, 219, 368`). Abrí una lámina, pulsé Atrás y Playwright terminó en `about:blank`. En Android, el gesto de volver cierra la página en lugar del modal. *Exijo:* `pushState` al abrir lámina, ficha o región, y un `popstate` que cierre el modal.
- **A26 · [UX] [alto]** Las tarjetas de periodo hacen dos cosas a la vez: tienen **276 enlaces dentro de `<button>`**. Al tocar «aymaras» se abre la ficha y, al mismo tiempo, la página salta al explorador y cambia de periodo (scrollY pasa a 836 y el hash a `#ficha/pueblo-aymara`). *Exijo:* tarjetas con texto plano, o una tarjeta enlace con botones separados.
- **A27 · [UX] [alto]** Las regiones solo funcionan con ratón: los `path` no tienen tabindex ni role. Los objetivos son minúsculos (Arica y Parinacota mide 21×31 px con el zoom inicial) y los pines se quedan con el clic: al pulsar en el centro de Arica se abrió la lámina del Morro, no la región. El paso 3 de la guía para maestros dice justamente «haz clic en una región». *Evidencia:* captura 07-region-clic. *Exijo:* una lista de regiones accesible, foco en los paths y que la región tenga prioridad cuando el modo «Regiones» está activo.
- **A28 · [UX/móvil] [crítico]** A 390 px se ocultan cosas esenciales: la navegación (`.nav` con display:none y sin menú), la leyenda, «Regiones» y «Todo Chile». Sin leyenda, **los colores del mapa histórico no se pueden interpretar**, y las regiones no se pueden mostrar. El mapa fijo ocupa unos 370 de 844 px (44 %) y tapa los títulos mientras se lee («Poblamiento y» queda bajo el mapa); «Juan Fernánd…» aparece cortado; las bandas del eje miden 10 px de alto. *Evidencia:* capturas 22-m-1500 y 22-m-3000. *Exijo:* un diseño móvil propio (mapa plegable u hoja inferior, leyenda accesible, navegación).

### Accesibilidad
- **A29 · [a11y] [alto]**
  - El mapa tiene `role="img"` (`index.html:81`) pero contiene **66 pines enfocables**: para el lector de pantalla es una sola imagen, y los hijos enfocables no tienen nombre ni rol en el árbol de accesibilidad.
  - `aria-live="polite"` sobre todo `#relato` (`index.html:94`) hace leer cientos de palabras en cada cambio de periodo.
  - Los 276 enlaces dentro de botones son HTML inválido, y el nombre accesible del botón termina siendo el párrafo entero.
  - Las bandas de 10 px no cumplen el tamaño mínimo de objetivo (WCAG 2.5.8).
  - El `alt` de la lámina repite el pie de foto, así que se lee dos veces.
  - «Pausar fondo» aparece antes que el h1 en el orden de tabulación.

  *Exijo:* pines como botones con nombre dentro de un grupo, una región viva que anuncie solo un resumen corto y una auditoría con NVDA.

### Rendimiento
- **A30 · [rendimiento] [alto]**
  - **Peso:** la primera carga hace 27 peticiones y transfiere 2,7 MB en local sin comprimir. En producción el JS baja a unos 290 KB comprimidos; verifiqué historia.js en el sitio publicado: 127 KB con gzip.
  - **SVG:** el DOM guarda **1,2 MB de trazados**: 733 KB en el mapa y el mismo contorno duplicado en la portada (241 KB, animado con DrawSVG) y en el localizador de la lámina (241 KB).
  - **Escritorio sin limitar:** hay una tarea larga de 1,4 s y el perfil marca 2,5 s en «(program)» (estilos y pintura).
  - **Móvil simulado:** LCP de 4,9 s, una tarea larga de 8,7 s y TBT aproximado de 12,9 s. El DOMContentLoaded de 19 s está inflado por el servidor local sin gzip; la CPU no.
  - `historia.js` carga las tres versiones de los 70 textos y las 81 fichas antes de pintar nada.

  *Exijo:* un solo contorno simplificado reutilizado con `<use>`, niveles de detalle según el zoom, datos por periodo cargados bajo demanda y un presupuesto de LCP menor a 2,5 s en un móvil medio.

### SEO y compartir
- **A31 · [SEO] [crítico]** **El sitio es invisible para los buscadores.** Hay una sola URL, y el HTML estático tiene **347 palabras**. Los 70 momentos, las 81 fichas y los 11 periodos se generan con JS y viven en rutas `#evento/…`, que Google no indexa como páginas distintas. Nadie que busque «Combate Naval de Iquique para niños» llegará jamás a esta lámina. *Exijo:* que `build-data.mjs` genere páginas estáticas por momento, periodo y personaje, con rutas reales. No hace falta framework y siguen funcionando en `file://`.
- **A32 · [SEO] [alto]** No hay metadatos para compartir: ni `og:title/description/image`, ni `twitter:card`, ni canonical, ni JSON-LD (`LearningResource`, `Article`, `Event`, `Person`). Tampoco hay manifest, theme-color ni apple-touch-icon (el favicon es solo un data-URI), y robots.txt y sitemap.xml dan 404 en el sitio publicado. En Chile los colegios comparten por WhatsApp, y el enlace sale sin tarjeta ni imagen. Además el sitio vive en `moises-salgado.github.io/historia-de-chile`, sin dominio propio. *Exijo:* Open Graph por página con imagen 1200×630 generada, JSON-LD, sitemap y un dominio `.cl`.

### Confianza y legalidad
- **A33 · [confianza] [alto]** El sitio no dice quién lo escribe ni cómo se revisa. No hay «Acerca de», autor, contacto ni forma de reportar un error. Las fuentes del pie son nombres sin enlace y ningún momento muestra sus fuentes al lector. El guion del relato sí tiene fuentes con enlace (`Relatos/Combate Naval de Iquique.md:39-42`), pero no se publican. No se declara la licencia del texto. Si el texto se redacta con ayuda de IA (el propio `CLAUDE.md` define un agente «historiador» que verifica), hay que decirlo y explicar la revisión humana. *Exijo:* una página de metodología, fuentes enlazadas en cada momento y una licencia declarada (CC BY-SA, por ejemplo).
- **A34 · [privacidad] [medio]** Las fuentes tipográficas se cargan desde Google (`index.html:11-13`). Cada visita de un niño manda su IP a Google, y además se rompe la promesa de «sin CDN y funciona en `file://`»: sin red, el sitio cae a las fuentes del sistema. La nueva ley chilena de datos personales (Ley 21.719) entra en vigor a fines de 2026. *Exijo:* alojar las fuentes en el propio sitio (woff2 con subconjunto).

### Decisiones tomadas
- **A35 · [imágenes] [medio] [reabre decisión]** La regla «solo Wikimedia Commons» deja fuera material de dominio público de Biblioteca Nacional Digital y Surdoc: cartas, periódicos, afiches y actas, que son justo los documentos que piden las actividades (A19). La carta de Grau es un ejemplo. *Exijo:* aceptar fuentes institucionales de dominio público con la misma verificación de licencia y crédito visible. Las imágenes generadas por IA siguen prohibidas.

### Referentes consultados
- Histography (Matan Stauber): línea de tiempo interactiva donde cada punto es un evento de Wikipedia, con filtros por categoría y deslizador de rango. https://histography.io · reseña: https://hyperallergic.com/an-interactive-timeline-of-human-history-according-to-wikipedia
- Memoria Chilena (Biblioteca Nacional): sitios temáticos con presentación, documentos digitalizados, bibliografía y cronología. https://www.memoriachilena.gob.cl
- Chile para Niños (Biblioteca Nacional, 6 a 10 años): personajes guía, juegos y actividades descargables. https://www.chileparaninos.gob.cl · https://www.chilevision.cl/noticias/te-ayuda/chile-para-ninos-el-sitio-web-que-acerca-el-patrimonio-nacional-con-juegos-y-actividades-online/
- Currículum Nacional (MINEDUC): programas y OA por curso, y priorización 2023-2025. https://www.curriculumnacional.cl

### Lo que tendría que pasar para que esto sea de nivel mundial
1. Que se pueda encontrar y compartir: una página estática por momento, con Open Graph, JSON-LD, fuentes enlazadas, `pushState` y dominio propio.
2. Que tenga profundidad y cobertura: más de 200 momentos con metas por región, siglo y género; documentos primarios y debates; la historia indígena y la del siglo XX en su fecha real.
3. Que sirva en el aula de verdad: OA oficiales, hojas de trabajo imprimibles bien hechas, evaluación, rutas guiadas y modo proyector; para niños, audio, glosario y retos.
4. Que los medios estén a la altura y el móvil sea lo primero: imágenes de 2400 px o más en AVIF, relatos con voces chilenas y WebVTT, fuera los videos mudos, LCP bajo 2,5 s en móvil y fundidos también con reduce-motion.

---

## Ronda 2 · Visionario — De folleto a atlas vivo: encontrable, enseñable, inolvidable
**Postura.** El abogado tiene razón en lo grave: hoy el sitio es invisible para Google, el botón Atrás te saca, el dueño ve cortes secos y el profe no recibe los materiales que se le piden. Concedo casi todo. Discrepo en tres puntos: no hay que girar el mapa de Chile, no hay que usar `Event` en JSON-LD y las versiones no deben ser tres apps. La buena noticia es que el sitio ya tiene la base de algo extraordinario: un vault con grafo de enlaces, un mapa con capas por fecha y una tubería de relatos con tiempos por carácter. Casi todo lo que falta sale de `build-data.mjs`, sin framework.

*Método:* recorrí el sitio con Playwright a 1440×900 y 390×844, con y sin reduce-motion (portada, explorador, periodos, maestros, lámina de Iquique). Capturas: C:\Users\misb_\AppData\Local\Temp\claude\a83701bc55c6b84b\d5b2e192-a339-4fa5-8d38-0073403b259e\scratchpad\v-01-portada-1440.png … v-09-m-relato.png. Datos del vault: 43 de 70 momentos tienen fecha con día y mes; el guion de Iquique tiene 1.772 caracteres.

### Respuesta a la crítica
- **A1** ✅ — La portada pide configurar antes de enamorar. **Solución:** una sola llamada, «Empieza el viaje», que lleva al explorador ya abierto en un momento, y una segunda, «Mira el relato». Las tres tarjetas de versión salen de `index.html:50-63`; el selector queda solo en la barra y se recuerda. El mapa de la derecha cobra vida: el momento de **«Un día como hoy»** (V2) late en su lugar y es un enlace real (`<a href>` a su página, V19). *Esfuerzo:* S · *Impacto:* 4
- **A2** ⚠️ — Sí al nombre propio, pero sin perder la palabra clave. **Solución:** propongo **«Larga»**, con el lema «Un país largo, una historia larga». En el `<title>` iría «Larga · Historia de Chile en mapa y línea de tiempo», porque la búsqueda exacta «historia de Chile» vale oro. Alternativa: «Atlas del tiempo». Promesa honesta: «70 momentos clave de Monte Verde a hoy, y creciendo». Decide el dueño y hay que verificar que el nombre esté libre. *Esfuerzo:* S · *Impacto:* 3
- **A3** ✅ — Tiempo y espacio tienen que verse juntos. **Solución:** una **«mesa de atlas»** que cabe en 100svh en escritorio:
  - arriba, una franja de 110 px con el eje y las bandas;
  - a la izquierda, el mapa en una columna angosta y alta (~34 % del ancho, fija);
  - a la derecha, el relato, con la lente convertida en una **tira de fotogramas** de una fila (`scroll-snap`) en lugar de la caja de 200 px.

  El único año protagonista es el contador grande; se quita de la etiqueta del mapa y del subtítulo. El alto de la lente se calcula según los carriles que realmente se usan (`crono.js:215`) y la retícula usa `grid-template-areas` en `estilos.css`. *Esfuerzo:* M · *Impacto:* 5
- **A4** ⚠️ — De acuerdo con el desperdicio, la leyenda encima y los choques de rótulos. **No** al Chile horizontal: con el norte a la izquierda se rompe el mapa mental que se aprende en el colegio, y la geografía (norte→sur) se confunde con el eje del tiempo (izquierda→derecha). **Solución:**
  - un panel angosto y alto que Chile llene;
  - una cámara que se ajusta sola a la zona de cada periodo;
  - Argentina recortada con un fundido;
  - la leyenda fuera del mapa, como fichas bajo él, con tramas distintas (Perú con rayas a 45°, Bolivia con puntos) y verdes separados por luminosidad;
  - rótulos de región solo en el modo «Regiones», con prioridad por área y líneas guía en las regiones chicas (`mapa.js`).

  *Esfuerzo:* M · *Impacto:* 4
- **A5** ✅ (con un matiz sobre el cero) — **Solución:**
  - Los periodos pasan a ser un **índice editorial** como el de un libro: rango de años grande en Newsreader, título, un gancho de una línea y una imagen chica. El gancho sale del campo `gancho:` (≤140 caracteres) de la nota, así que se acaban los «…».
  - «Momentos por nivel» se muestra como lista por curso, no como tarjetas de alto fijo.
  - Cada rol tiene su tratamiento: el cobre queda solo para acciones (enlaces y CTA), los años van en tinta y Newsreader y las fichas son neutras.
  - El cero tachado es una virtud de legibilidad de Atkinson (distingue 0 de O) y se queda en la interfaz. En el texto corrido, el build envuelve las cifras en `<span class="cifra">` con Newsreader `oldstyle-nums`, que les da un aire editorial y no de código.
  - Fecha del pie: `toLocaleDateString('es-CL', {dateStyle:'long'})` (`app.js:421`).

  *Esfuerzo:* M · *Impacto:* 3
- **A6** ✅ — El texto tiene que estar visible desde el primer cuadro. **Solución:**
  - quitar `.js .hero-texto { visibility: hidden }` (`estilos.css:627`): el h1 se pinta quieto;
  - el movimiento vive en el fondo, el dibujo del mapa y un barrido de luz sobre el título que no lo oculta;
  - el CTA se puede usar de inmediato;
  - `fetchpriority="high"` en la primera imagen del fondo y precarga de las dos woff2 propias (A34).

  Meta: LCP < 1,2 s en escritorio y < 2,5 s en móvil medio. *Esfuerzo:* S · *Impacto:* 5
- **A7** ✅ — Concedo: reducir no es apagar, y el dueño nunca ha visto el producto. **Solución:** `perfil()` en `app.js` devuelve `completo`, `suave` o `quieto`.
  - **Suave** (reduce): solo opacidad y color, de 150 a 250 ms. Lámina y relato con fundido cruzado, velo del cine con fundido y cámara del mapa con «fundido de paso» (sale en 120 ms y entra en 180 ms) en vez de viaje.
  - `addEventListener('change')` en `app.js`, `cine.js` y `crono.js`.
  - Un ajuste propio del sitio, **«Movimiento: automático / completo / suave»**, guardado en localStorage. Así el dueño puede elegir ver la versión completa sin tocar Windows: es una elección explícita del usuario.

  Se prueba en su PC. *Esfuerzo:* S · *Impacto:* 5
- **A8** ✅ — **Solución:** un FLIP de verdad con `transform` y `clip-path: inset(… round 18px)`, con el plugin Flip de GSAP (gratis desde 3.13, se copia a `vendor/`) o con View Transitions del mismo documento donde existan y GSAP como respaldo. Al pulsar «Ver relato» se guarda `origen = {evento, foco}`; al cerrar el cine, la lámina se reabre sin animación y el foco vuelve al botón. *Esfuerzo:* M · *Impacto:* 3
- **A9** ✅ — **Solución:** para la portada, `build-img.mjs` pide a Commons miniaturas de 2560 px (`iiurlwidth`) y las codifica en AVIF/WebP con **FFmpeg, que ya es requisito del proyecto** (cero dependencias nuevas). Se sirven en `<picture>` con 1280/1920/2560 y el Ken Burns baja de 1,16 a 1,08. *Esfuerzo:* S · *Impacto:* 4
- **A10** ✅ — **Solución:** la misma tubería para todas las imágenes:
  - tres anchos (480/960/1600) en AVIF, WebP y JPG, con `sizes` según el layout;
  - el build da AVISO si una imagen pasa de 200 KB;
  - los PNG sin transparencia pasan a AVIF;
  - las de 500 px (Montt, Alessandri) se van con A14.

  *Esfuerzo:* M · *Impacto:* 4
- **A11** ✅ — Fuera los videos mudos. **Solución:**
  1. Hoy se quita «Ver el resumen en video» y se sacan 33 MB del repo.
  2. Después, cada periodo tendrá **«El periodo en 90 segundos»**, un relato con scroll hecho en DOM (texto real, mapa e imágenes, ScrollTrigger) en lugar de MP4: se indexa, se traduce, es accesible y pesa diez veces menos. La narración es opcional: unos 1.300 caracteres por periodo caben en el plan gratis en dos meses.

  *Esfuerzo:* S para quitar, M para rehacer · *Impacto:* 3
- **A12** ✅ **[reabre decisión]** — Subtítulos como pista WebVTT, no quemados. **Solución:**
  - `build-relato.mjs` ya calcula `subs` con `ini/fin` exactos (líneas 109-171): basta con escribir `combate-naval-de-iquique.vtt`, renderizar una versión limpia y añadir `<track kind="captions" srclang="es" default>` con estilo en `::cue`;
  - la transcripción se publica en la página del momento (SEO y accesibilidad);
  - versión 9:16 con una segunda composición HyperFrames de 1080×1920, servida con `<source media="(orientation: portrait)">` (soportado de nuevo desde Chrome 120 y Firefox 120);
  - el aviso de voz sintética pasa a la cabecera del cine, la fecha va en blanco sobre una banda oscura y el crédito sube de contraste.

  *Esfuerzo:* M · *Impacto:* 4
- **A13** ⚠️ **[reabre decisión]** — El riesgo es real, aunque nadie lo ha escuchado todavía. **Solución en tres pasos:**
  1. **Ya:** Prat deja de tener voz. Sus palabras reconstruidas aparecen como texto en pantalla, con silencio y sonido, y el narrador las introduce «según la tradición». Es más honesto, porque son una reconstrucción, y elimina el problema de «Harry».
  2. Cuando haya cinco o más guiones verificados, pagar **un solo mes** de Starter (entre 5 y 6 USD según la fuente, unos 30.000 créditos; hay que confirmarlo), generar todo con voces chilenas de la biblioteca y cancelar. La caché los guarda para siempre. Eso choca con el presupuesto cero: decide el dueño.
  3. A largo plazo, voces humanas (V13).

  *Esfuerzo:* S/M · *Impacto:* 4
- **A14** ✅ — **Solución:** una regla nueva en la Guía de contenido: la imagen de un periodo muestra una escena o un proceso, con personas en plural. Candidatas en Commons, muchas subidas por la BCN con CC BY 3.0 CL: salitreras, campaña del plebiscito de 1988, movimiento sufragista, Unidad Popular, poblaciones; el historiador las verifica. El build da AVISO si la imagen de un periodo es el retrato de una sola persona. Meta: al menos 4 de 11 con mujeres o multitudes visibles. *Esfuerzo:* S · *Impacto:* 3
- **A15** ✅ — Profundidad por **capas**, no un texto inicial más largo. **Solución:** cada momento tendrá
  - «En 30 segundos» (50 palabras; es la respuesta que Google y los asistentes citan);
  - «La historia» (400–700 palabras);
  - «Cómo lo sabemos» (fuentes y documento, V7);
  - «Lo que se discute» (V8);
  - «Para profundizar».

  Son secciones nuevas en `Plantillas/Evento.md`, que el build pinta como `<details>` nativos (indexables y sin JS). Fichas: 250 palabras o más para adultos y 80 o más para niños. *Esfuerzo:* L · *Impacto:* 5
- **A16** ✅ — **Solución:** la cobertura se vuelve una métrica del build. `npm run build` imprime una tabla región × siglo × género × tema contra metas, con AVISO por cada meta no cumplida. Para eso se añaden `temas: []` en los eventos y `genero:` en los personajes. Metas de la fase 1 (→120 momentos):
  - 3 o más por región, empezando por Aysén;
  - 6 o más en el siglo XVIII;
  - 30 % de mujeres entre los personajes nuevos;
  - 6 o más momentos indígenas en época republicana;
  - 8 o más de cultura (el Nobel de Neruda de 1971, Violeta Parra, Víctor Jara);
  - ciencia (astronomía);
  - migración del siglo XXI.

  *Esfuerzo:* M · *Impacto:* 5
- **A17** ✅ — Es un error de fondo y se corrige primero. **Solución:**
  - un momento propio, «Ocupación de Tierra del Fuego y genocidio selk'nam» (c. 1880–1910), sacado de la nota fechada en el 8.000 a.C.;
  - después, las reducciones y los títulos de merced, el movimiento mapuche del siglo XX y Rapa Nui bajo la Compañía Explotadora, con fechas que verifica el historiador;
  - cada ficha de pueblo cierra con un «Hoy» (lengua, territorio, población según el último censo, con fuente).

  *Esfuerzo:* S/M · *Impacto:* 5
- **A18** ⚠️ — Maestros es delgado, de acuerdo. Pero tres apps distintas triplican el mantenimiento. **Solución:** tres **lentes** sobre el mismo atlas:
  - **Niños:** escala lineal por siglos (sin logaritmo, con una segunda función de escala en `crono.js`), leyenda en palabras simples (`etiqueta_ninos:` en cada fase de `Territorios/`), objetivos de 48 px, lectura en voz alta (V4) y retos (V5).
  - **Adultos:** capas de profundidad (A15) y debates (V8).
  - **Maestros:** barra de clase (V6).

  Todo se controla con `body[data-modo]`. *Esfuerzo:* M · *Impacto:* 4
- **A19** ✅ — Es lo que más valora un profe. **Solución:**
  - Un tipo de nota nuevo, `Documentos/`, con transcripción, imagen de Commons, autor, fecha, fuente con enlace, licencia y preguntas. El build da AVISO si una actividad menciona un documento sin enlazarlo.
  - La carta de Grau y la respuesta de Carmela Carvajal están en dominio público (ambos murieron hace más de 70 años); el facsímil se sube a Commons (A35).
  - Elecciones 2025: una tabla y un gráfico SVG generados en el build desde `datos:`, con enlace al Servel y cifras verificadas por el historiador.
  - Las «Fuentes sugeridas» pasan a ser enlaces reales.

  *Esfuerzo:* M · *Impacto:* 5
- **A20** ✅ — **Solución:**
  - Etiquetas `oa: ["HI06 OA 17"]` (formato oficial de curriculumnacional.cl) y `niveles: [...]` múltiples.
  - El build genera una página **«Mi curso»** por nivel con sus OA y momentos, e incluye 8° básico y Formación Ciudadana.
  - Plural correcto en `app.js:399`.
  - Evaluación: una sección `## Preguntas` (dos de alternativas y una abierta) que se responde en pantalla con retroalimentación inmediata y se imprime como ticket de salida.
  - Los OA van también al JSON-LD como `teaches` (V19).

  *Esfuerzo:* M · *Impacto:* 5
- **A21** ✅ — **Solución:** una **hoja de trabajo** con plantilla propia de impresión:
  - la versión elegida;
  - el localizador del mapa (`<use>`) y una minilínea con el momento anterior, este y el siguiente;
  - tres preguntas con líneas para responder;
  - un extracto de la fuente primaria;
  - QR en SVG generado en el build con la librería MIT de Nayuki (solo en el build, sin dependencia en el sitio), más URL, fecha y créditos.

  `.no-print` oculta los botones y «Imprimir hoja» aparece en todos los modos. Se prueba en A4 y en Carta. *Esfuerzo:* S/M · *Impacto:* 5
- **A22** ✅ — Ver V4 y V5. **Solución:**
  - **Lectura en voz alta** con Web Speech API (gratis y sin cuota), frase por frase y resaltada. El evento `boundary` no es Baseline, así que el resaltado por frase se controla con `end`.
  - Si el equipo tiene una voz `es-CL`, se usa (Azure tiene Catalina y Lorenzo; hay que ver qué expone Edge en el PC del dueño).
  - **Glosario:** notas en `Glosario/`; el build marca la primera aparición en el texto de niños con `<button popovertarget>` (Popover API nativa).
  - **Minirreto:** una pregunta por momento.

  *Esfuerzo:* M · *Impacto:* 5
- **A23** ✅ — De acuerdo con el orden. **Solución:**
  1. **Búsqueda** con ⌘/Ctrl+K y botón visible. El índice `site/data/buscar.js` se genera en el build (títulos, años, alias, lugares, personajes), sin tildes, con prefijo y tolerancia a errores, y resultados agrupados. Funciona en `file://`.
  2. **Rutas:** notas en `Rutas/` con enlaces ordenados («La Guerra del Pacífico en 6 paradas», «Mujeres que cambiaron Chile», «Wallmapu en el tiempo»), con barra de progreso.
  3. **Documentos** (A19).

  Después vienen los filtros por tema, la comparación (V16), «seguir donde quedaste» (localStorage) y el proyector (V6). *Esfuerzo:* M · *Impacto:* 5
- **A24** ✅ — **Solución:**
  - un botón «Compartir» con `navigator.share` o, si no existe, copiar el enlace con un aviso; también un enlace de WhatsApp con texto listo;
  - «Cómo citar» en APA 7 generado automáticamente;
  - `document.title = "Combate Naval de Iquique (1879) · Larga"` en cada estado.

  *Esfuerzo:* S · *Impacto:* 4
- **A25** ✅ — Crítico; concedo sin matices. **Solución:** `pushState` al abrir lámina, ficha o región, y `popstate` para cerrar el modal o restaurar el estado. `replaceState` queda solo para arrastrar el cabezal, para no llenar el historial. En http(s) la URL es real (`/momento/combate-naval-de-iquique/`, V19); en `file://` se usa el hash. El gesto Atrás de Android cierra la lámina. *Esfuerzo:* S · *Impacto:* 5
- **A26** ✅ — **Solución:** el patrón de tarjetas de *Inclusive Components* (Heydon Pickering). La tarjeta es un `<article>` y el título tiene el único enlace, con `::after` que cubre toda la tarjeta; los enlaces internos se elevan con `z-index`, o bien se dejan como texto plano. Desaparecen los 276 enlaces anidados. *Esfuerzo:* S · *Impacto:* 4
- **A27** ✅ — **Solución:**
  - en modo «Regiones», los pines quedan con `pointer-events: none` y atenuados;
  - los paths ganan un trazo transparente ancho que agranda el objetivo;
  - al lado del mapa, una **lista de las 16 regiones** de norte a sur como botones (sirve también en móvil);
  - foco itinerante en los paths con `role="button"` y nombre accesible;
  - las regiones chicas llevan rótulo con línea guía.

  *Esfuerzo:* M · *Impacto:* 4
- **A28** ✅ — **Solución:** un diseño móvil propio.
  - El mapa ocupa toda la pantalla al fondo y el contenido va en una **hoja inferior** con tres posiciones (25 %, mitad y completa), hecha con CSS `scroll-snap`, sin JS: el patrón de Apple Maps y Google Maps.
  - La leyenda va como fichas horizontales en la cabecera de la hoja.
  - La navegación pasa a un botón «Índice» que abre una hoja con búsqueda, periodos, rutas y versión.
  - El cabezal de la línea de tiempo tiene bandas de 44 px.

  *Esfuerzo:* M/L · *Impacto:* 5
- **A29** ✅ — **Solución:**
  - `role="group" aria-label="Mapa de Chile en 1879"` en lugar de `role="img"`;
  - pines como `<a href>` reales con nombre («Combate Naval de Iquique, 1879»);
  - una región viva aparte, `#anuncio`, que dice solo «Colonia, 1598–1810, 6 momentos»; `#relato` deja de ser `aria-live`;
  - `alt` que describe la imagen y `figcaption` con el crédito;
  - un enlace «Saltar al contenido» al principio, y «Pausar fondo» después del h1 en el DOM;
  - auditoría con NVDA y axe (V20).

  *Esfuerzo:* M · *Impacto:* 4
- **A30** ✅ — **Solución:**
  1. El contorno se define una vez en `<symbol id="chile">` y se reutiliza con `<use>`: unos 480 KB menos de DOM.
  2. `build-geo.mjs` genera tres niveles de detalle y `mapa.js` cambia de nivel según el zoom.
  3. `historia.js` queda como índice (títulos, años, coordenadas) y el texto de cada periodo se carga al pedirlo, inyectando `<script src="data/p/colonia.js">` (funciona en `file://`).
  4. `content-visibility: auto` bajo el pliegue.
  5. Presupuesto: LCP < 2,5 s, INP < 200 ms y TBT < 300 ms en móvil medio, controlado en CI (V20).

  *Esfuerzo:* M/L · *Impacto:* 5
- **A31** ✅ — La base de todo. **Solución:** V19. `build-data.mjs` escribe páginas `site/momento/<id>/index.html` (70), `periodo/` (11), `personaje|lugar|pueblo/` (81) y `region/` (16). Cada una lleva el mismo esqueleto con el contenido prerenderizado (h1, «En 30 segundos», las tres versiones, fuentes, anterior/siguiente y conexiones) y la app lo hidrata con el mismo JS. Las rutas son relativas según la profundidad, así que siguen funcionando en `file://`. Hoy serían unas 180 URL indexables; con las metas de A16, más de 400. *Esfuerzo:* M · *Impacto:* 5
- **A32** ⚠️ — Sí a Open Graph, canonical, JSON-LD, sitemap, robots, manifest e íconos. Dos matices:
  1. **No a `Event`.** Los resultados de eventos de Google son para eventos reales a los que se puede asistir (en junio de 2025 aclaró que deben ser presenciales y con entrada pública). Un combate de 1879 no califica y marcarlo así es un mal uso. Lo correcto: `Article` + `LearningResource` con `about` (con `sameAs` a Wikidata), `educationalLevel`, `teaches` (OA como `DefinedTerm`), `BreadcrumbList` y `Person` en los personajes. Tampoco FAQPage: esos resultados ya no aparecen en Google (2026).
  2. **Dominio `.cl`:** cuesta dinero, así que es una decisión del dueño **[reabre decisión]**. Empezar en github.io no hace perder nada si el canonical es coherente: al poner un dominio propio, GitHub Pages redirige solo.

  Además: imágenes OG (V14) y `max-image-preview:large` (Discover pide ≥1200 px). *Esfuerzo:* S/M · *Impacto:* 5
- **A33** ✅ — **Solución:**
  - una página **«Cómo se hace»** (`/metodologia/`): quién escribe, borradores con ayuda de IA, verificación por el agente historiador más revisión humana, política de correcciones y licencia **CC BY-SA 4.0** para el texto (las imágenes conservan la suya);
  - en cada momento, «Fuentes» con enlaces, «Revisado: fecha» (sacada del historial del archivo) y **«Reportar un error»**, un enlace a un issue de GitHub con título y cuerpo ya rellenados.

  Referente: Our World in Data, donde todo es CC BY y cada gráfico cita su fuente. *Esfuerzo:* S/M · *Impacto:* 4
- **A34** ✅ — **Solución:** alojar Newsreader y Atkinson Hyperlegible Next (ambas OFL) en woff2 con subconjunto latino, generado una sola vez, con `font-display: swap` y dos precargas. Se acaban las llamadas a Google y vuelve el `file://` sin red. La Ley 21.719 rige desde el 1 de diciembre de 2026; hay un proyecto para postergarla a 2027, todavía en trámite. *Esfuerzo:* S · *Impacto:* 4
- **A35** ⚠️ — Los documentos son necesarios, pero prefiero **mantener una sola tubería**. **Solución:** subir a Commons los documentos de dominio público de BND o Memoria Chilena con su plantilla de dominio público (muchos ya están; por ejemplo, el *Atlas* de Claudio Gay). Así pasan por `build-img --check` como cualquier imagen, se le devuelve algo a los bienes comunes y hay un solo verificador. Si el dueño prefiere usar BND o Surdoc directamente, **[reabre decisión]**, con un campo manual `licencia_verificada_por:`. *Esfuerzo:* S/M · *Impacto:* 4

### Ideas nuevas
- **V1 · «Catorce mil quinientos píxeles»** (imposible de olvidar) — Una página con scroll vertical donde **1 año = 1 píxel**. Arriba está Monte Verde y empiezas a bajar. Durante pantallas y pantallas no hay casi nada; hacia la mitad aparecen las momias Chinchorro (c. 5.000 a.C.), unos 2.000 años anteriores a las egipcias. Los incas llegan cuando quedan unos 556 px; los europeos, a 506 px; **la República entera cabe en los últimos 216 px**, menos de un cuarto de pantalla. Un contador fijo dice «hace 9.312 años». Hay un botón «Saltar al presente», y el scroll lo maneja el usuario, así que no hace falta perfil reduce. Referente: *If the Moon Were Only 1 Pixel* de Josh Worth (https://joshworth.com/jpw/?p=2700). Encaja con Chile porque le da la vuelta a la idea de que la historia empieza en 1541. Construcción: `escala/index.html` con alto calculado, marcas que salen del vault e IntersectionObserver. También gana en SEO («línea de tiempo a escala de Chile»). *Esfuerzo:* M · *Impacto:* 5
- **V2 · «Un día como hoy»** (portada viva, motivo para volver y SEO) — 43 de los 70 momentos tienen día y mes. La portada muestra el de hoy o, si no hay, «este mes en la historia». Doce páginas `/efemerides/<mes>/` (no 366, para no crear páginas pobres) con una **efeméride imprimible para el diario mural**, la tradición escolar chilena que más busca un profe. Referente: «Selected anniversaries» de Wikipedia. *Esfuerzo:* S · *Impacto:* 4
- **V3 · «Mira de cerca»** (niños y adultos) — Pinturas de Commons a 4.000 px con **zonas numeradas**: el Huáscar en el Somerscales, quién es quién en el *Abrazo de Maipú*. Al tocar una zona, la cámara hace zoom (transform de GSAP) y aparece una tarjeta. Con reduce, fundido al recorte; con teclado, una lista de zonas. Enseña a leer una pintura como fuente: una recreación hecha décadas después no es una foto. Referente: la *Ronda de noche* de 717 gigapíxeles del Rijksmuseum (https://www.rijksmuseum.nl/en/press/press-releases/rijksmuseum-publishes-717-gigapixel-photograph-of-the-night-watch). Construcción: `zonas:` (x %, y %, texto para niños y adultos) en el frontmatter y un AVIF de 4096 px que se carga al pedirlo. *Esfuerzo:* M · *Impacto:* 5
- **V4 · «Leer conmigo»** (niños) — Un botón «Escuchar» en cada párrafo, con resaltado por frase, velocidad regulable y glosario emergente (A22). Un niño de 7 años puede «leer» solo. Referente: Immersive Reader de Microsoft (lee en voz alta con resaltado, gratis en Edge). Construcción: `speechSynthesis` y Popover API en `app.js`, sin cuota de ElevenLabs. *Esfuerzo:* M · *Impacto:* 5
- **V5 · «Pasaporte del explorador»** (niños) — Un sello por periodo cuando el niño lee un momento y supera su reto. Los sellos son láminas de **Claudio Gay (1854, dominio público, en Commons)**: escenas, paisajes y naturaleza, nada generado por IA. Con 11 sellos se imprime un «diploma de explorador» con su nombre, escrito solo en su equipo. Sin cuentas ni datos personales, solo localStorage: privacidad para niños. Referentes: Duolingo (constancia) y Chile para Niños (actividades). *Esfuerzo:* M · *Impacto:* 4
- **V6 · «Modo clase» y planificador** (maestros) — **Proyector** con `?clase`: letra al doble, alto contraste, sin hover, cursor que se esconde, flechas que avanzan por la ruta, panel «Pregunta» que se revela y temporizador. **Planificador:** curso → OA → ruta sugerida de 5 momentos, que genera tres cosas: un enlace para los estudiantes (la ruta va en la URL), la hoja de trabajo (A21) y el ticket de salida. Sin servidor. Referente: las lecciones de Digital Inquiry Group (ex Stanford History Education Group), con una pregunta central y documentos (https://www.inquirygroup.org/history-lessons). *Esfuerzo:* M/L · *Impacto:* 5
- **V7 · «Fuente en la mano»** (maestros y adultos) — Un visor de documentos: facsímil con zoom a un lado y transcripción al otro (con opción de ortografía modernizada), más cuatro preguntas de pensamiento histórico: ¿quién lo escribió y cuándo?, ¿qué pasaba entonces?, ¿qué dicen otras fuentes?, ¿qué palabras delatan su punto de vista? Es el método *Reading Like a Historian* (fuente, contexto, contraste y lectura atenta). Primeros documentos: Grau a Carmela Carvajal y su respuesta, el Acta de Independencia y una carta de Valdivia a Carlos V; todos los verifica el historiador. *Esfuerzo:* M · *Impacto:* 5
- **V8 · «Lo que se discute»** (adultos curiosos) — Un recuadro por momento con «Lo que sabemos / Lo que se discute / Lo que no sabemos», con dos o tres posturas de historiadores con nombre y referencia; por ejemplo, el debate sobre el «orden portaliano» o las causas de la crisis de 1891. Es lo que separa un atlas de un folleto, y la neutralidad en temas sensibles se gana mostrando el debate, no escondiéndolo. Construcción: una sección `## Debate` en la nota, que el build pinta como `<details>`. *Esfuerzo:* M · *Impacto:* 4
- **V9 · «Lo que vivió tu familia»** (adultos, familias y compartir) — Escribes tu año de nacimiento, y si quieres el de una abuela o un abuelo (nada se guarda ni se envía). La línea de tiempo pinta sus vidas y aparecen preguntas para conversar en la mesa: «Tu abuela tenía 20 años en 1973: pregúntale qué recuerda». Para el profe es una tarea de historia oral lista. Referente: *How Much Hotter Is Your Hometown Than When You Were Born?* (NYT, 2018), muy compartida porque personaliza los datos. *Esfuerzo:* S/M · *Impacto:* 4
- **V10 · «Viaje de norte a sur»** (movimiento y cine) — Al bajar desde la portada, la cámara del mapa recorre los más de 4.000 km de Chile desde Arica hasta el Cabo de Hornos y la Antártica. Los momentos se encienden al pasar y el viaje termina en «Elige por dónde empezar». Construcción: ScrollTrigger con `scrub` sobre la cámara que ya existe en `mapa.js`. Con reduce, cuatro cuadros fijos (norte, centro, sur, austral) con fundido. Referente: *Snow Fall* (NYT, 2012), el relato que inventó el scrollytelling de prensa. *Esfuerzo:* M · *Impacto:* 4
- **V11 · «Páginas que se transforman»** (movimiento y SEO) — Con las páginas estáticas de V19, `@view-transition { navigation: auto; }` y `view-transition-name` hacen que la miniatura vuele hasta la imagen principal **entre páginas reales**, con CSS y sin JS. Funciona en Chrome 126+ y Safari 18.2+; en Firefox, navegación normal. Con reduce, solo fundido de 200 ms. Se ve como una app y Google lo lee como un sitio. Referente: documentación de Chrome (https://developer.chrome.com/docs/web-platform/view-transitions). No rompe la regla de GSAP: es una función del navegador, no una dependencia. *Esfuerzo:* S/M · *Impacto:* 4
- **V12 · «Un relato, cinco formatos»** (audio y relatos) — `build-relato.mjs` saca del mismo guion cinco cosas: MP4 16:9, MP4 9:16 (para que profes y estudiantes lo compartan, con la URL al cierre), MP3 con un **feed RSS de podcast** (`site/relatos/feed.xml`, que Spotify y Apple Podcasts aceptan), VTT y una página de transcripción. Iquique tiene 1.772 caracteres, así que el plan gratis da para unos 5 relatos al mes. *Esfuerzo:* M · *Impacto:* 4
- **V13 · «Voces de Chile»** (audio y comunidad) — Voces humanas chilenas: elencos de teatro escolar o universitario que graban diálogos y leen documentos de dominio público (la carta de Grau), con consentimiento firmado (y del apoderado si son menores), licencia CC BY-SA y crédito visible. `build-relato` aceptaría `voz: archivo.wav` en lugar de ElevenLabs. Referente: LibriVox (voluntarios que leen textos de dominio público). *Esfuerzo:* L · *Impacto:* 4
- **V14 · «Tarjetas para compartir»** (compartir) — `npm run og` usa FFmpeg (drawtext con Newsreader) para recortar la imagen a 1200×630 con degradado, título, año y nombre del sitio: una tarjeta por página para WhatsApp. También una tarjeta vertical de 1080×1920 con el «dato curioso» para estados e historias. Referente: Spotify Wrapped, que crece porque cada usuario comparte una tarjeta propia. *Esfuerzo:* S/M · *Impacto:* 4
- **V15 · «Abierto y corregible»** (comunidad) — Texto CC BY-SA, «Reportar un error» con issue prellenado, «Actualizado el…» sacado del historial del archivo, un registro público de cambios y créditos a quienes colaboran. Un profe que encuentra un error y lo ve corregido se convierte en embajador. Referentes: Wikipedia y Our World in Data. *Esfuerzo:* S · *Impacto:* 3
- **V16 · «La cortina del tiempo»** (mapa) — Dos estados del mapa con un divisor arrastrable: 1810 a la izquierda y 1910 a la derecha. Con rótulos de lo que cambió: Norte Grande, Araucanía, Magallanes. Las capas ya tienen `fases desde|hasta`, así que son dos renders con `clip-path: inset()` y un `<input type="range">` accesible con teclado; en móvil, el divisor es horizontal. Referente: JuxtaposeJS de Knight Lab (https://github.com/NUKnightLab/juxtapose); se toma la técnica, no la librería. *Esfuerzo:* M · *Impacto:* 5
- **V17 · «Chile sobre el mundo»** (mapa y algo inolvidable) — La silueta de Chile reflejada al hemisferio norte se arrastra sobre Europa, Norteamérica o Asia. Al moverla, cada punto se reproyecta, como en The True Size Of, así que la comparación es honesta. «¿Cuánto mide Chile?» se entiende en un segundo. El contorno mundial sale de Natural Earth, de dominio público, con un `build-geo` extendido. *Esfuerzo:* M · *Impacto:* 4
- **V18 · «Datos que cuentan»** (datos) — Archivos `Datos/*.csv` en el vault, con `fuente:` y `licencia:`. El build los convierte en gráficos SVG accesibles, con tabla de respaldo y botón para descargar el CSV. Primeros tres: «¿Quién podía votar?» (electores sobre población, elección por elección), «Chile crece» (censos) y «Del salitre al cobre» (exportaciones); cada serie la verifica el historiador. Referente: Our World in Data (https://ourworldindata.org/faqs). *Esfuerzo:* M · *Impacto:* 4
- **V19 · «Una URL para cada cosa»** (SEO de primer nivel) — Además de A31 y A32:
  - títulos con intención de búsqueda: «Combate Naval de Iquique (1879): resumen para niños y adultos»;
  - el primer párrafo responde en 50 palabras (fragmento destacado y asistentes de IA);
  - una malla de enlaces internos que sale del grafo de wikilinks (ya existe);
  - páginas por región («Historia de la Región de Aysén»), por curso («Historia 6° básico») y por ruta;
  - `sitemap.xml` con `lastmod` sacado del historial y entradas de imagen;
  - verificación en Search Console.

  Referente: la guía de SEO con JavaScript de Google: History API, nada de fragmentos y prerender (https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). *Esfuerzo:* M · *Impacto:* 5
- **V20 · «Presupuesto de calidad en CI»** (rendimiento y confianza) — El flujo de GitHub Actions que ya publica `site/` suma Lighthouse CI (treosh/lighthouse-ci-action) con presupuestos de LCP, CLS, TBT y peso, más axe para accesibilidad. Además, ciertos AVISOS del build pasan a bloquear: imagen de más de 200 KB, momento sin fuentes o actividad sin documento. Lo «extraordinario» se mantiene solo si una regresión no puede publicarse. Todo corre con `npx` en CI, sin dependencias en el sitio. *Esfuerzo:* S · *Impacto:* 4

### Mi top 5
(ordenado por impacto/esfuerzo)
1. **Que el dueño vea su sitio y que cargue al instante:** A7 + A6 (perfil suave con fundidos, ajuste propio de movimiento y texto visible desde el primer cuadro). *S · 5*
2. **Que Atrás funcione y se pueda compartir:** A25 + A24 (`pushState` y `popstate`, título por momento, compartir y citar). *S · 5*
3. **Una URL para cada cosa:** A31 + A32 + V19 (páginas prerenderizadas, JSON-LD educativo con OA, sitemap y Open Graph), y encima V11 como extra casi gratis. *M · 5*
4. **Móvil primero y accesible:** A28 + A27 + A29 (hoja inferior, lista de regiones, pines como enlaces y región viva corta). *M · 5*
5. **El profe lo usa mañana:** A19 + A21 + V7 (documentos primarios en el vault, hoja de trabajo con QR y visor «Fuente en la mano»). *M · 5*

*Comodín:* **V1 «Catorce mil quinientos píxeles»**. Es lo que la gente va a mandar por WhatsApp diciendo «mira esto», y no depende de nada de lo anterior.

### Referentes consultados (Ronda 2)
- Google Search Central, SEO con JavaScript (History API en vez de fragmentos; prerender): https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google, cambios en resultados FAQ/HowTo (2023): https://developers.google.com/search/blog/2023/08/howto-faq-changes
- Google, datos estructurados de eventos (eventos reales a los que se puede asistir): https://developers.google.com/search/docs/appearance/structured-data/event · actualización de junio de 2025: https://www.seroundtable.com/google-event-recipe-structured-data-update-39544.html
- Schema.org / LRMI, `LearningResource`, `teaches`, `AlignmentObject`: https://www.dublincore.org/specifications/lrmi/example_encodings
- Chrome, View Transitions entre documentos (Chrome 126+, Safari 18.2+): https://developer.chrome.com/docs/web-platform/view-transitions
- Scott Jehl, `<source media>` en video de vuelta en Chrome 120 y Firefox 120: https://scottjehl.com/posts/using-responsive-video/
- GSAP 3.13, todos los plugins gratis: https://gsap.com/blog/3-13/
- Josh Worth, *If the Moon Were Only 1 Pixel*: https://joshworth.com/jpw/?p=2700
- Rijksmuseum, *Ronda de noche* a 717 gigapíxeles: https://www.rijksmuseum.nl/en/press/press-releases/rijksmuseum-publishes-717-gigapixel-photograph-of-the-night-watch
- Digital Inquiry Group, *Reading Like a Historian*: https://www.inquirygroup.org/history-lessons
- Heydon Pickering, *Inclusive Components: Cards*: https://inclusive-components.design/cards/
- Knight Lab, JuxtaposeJS: https://github.com/NUKnightLab/juxtapose
- Our World in Data, licencias y fuentes: https://ourworldindata.org/faqs
- Natural Earth, datos de dominio público: https://purl.stanford.edu/rk496tn2885
- Nayuki, generador de QR (MIT): https://www.nayuki.io/page/qr-code-generator-library
- MDN, evento `boundary` de SpeechSynthesis (no Baseline): https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event
- Microsoft, Immersive Reader: https://www.microsoft.com/en-us/education/blog/2023/06/how-to-enhance-reading-instruction-a-guide-to-immersive-reader-for-educators/
- NYT 2018, *How Much Hotter Is Your Hometown…* (descripción): https://www.journalism.co.uk/nyt-uses-data-visualisation-to-bring-climate-change-home-literally/
- Momias Chinchorro, Patrimonio Mundial 2021: https://www.latercera.com/que-pasa/noticia/unesco-incluye-asentamientos-y-momificacion-artificial-de-la-cultura-chinchorro-en-la-lista-de-patrimonio-mundial/JU2ATFIND5BGJNMWOBX2QRIHJU/
- Ley 21.719, vigencia el 1 de diciembre de 2026: https://www.diarioconstitucional.cl/2026/06/12/la-ley-21-719-entra-en-vigor-el-1-de-diciembre-y-expone-vacios-en-regulacion-de-pequenas-empresas/
- Lighthouse CI en GitHub Actions: https://github.com/treosh/lighthouse-ci-action
- Precios de ElevenLabs 2026 (Starter entre 5 y 6 USD, hay que confirmarlo en la web oficial): https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/

---

## Ronda 3 · Abogado del diablo — Réplica: sí a arreglar, no al parque de diversiones
**Veredicto:** El visionario acierta en el diagnóstico y en casi todas las soluciones de base (A6, A7, A19, A21, A25, A31). Pero su top 5 no tiene **ni un solo punto de contenido**, y la mitad de sus V son atracciones nuevas sobre un sitio de 70 momentos delgados. Si se indexa y se adorna antes de corregir y profundizar, lo único que se logra es publicar más rápido un folleto. **Nota del plan: 6,5/10.**

*Verificaciones de esta ronda:*
- 43 de los 70 momentos tienen día y mes, pero noviembre tiene solo 2 y hay 2 fechas anteriores a 1582.
- Originales en Commons: el Somerscales de Iquique mide 3307×2226 y el Ahu Tongariki 3008×2000.
- En mi sesión, `ffmpeg` no estaba en el PATH y `HYPERFRAMES_FFMPEG_PATH` venía vacía.

### Respuesta a sus respuestas (A1–A35)
- **A1** ⚠️ Sí a quitar las tarjetas y a «Empieza el viaje». Pongo dos condiciones:
  1. «Un día como hoy» no puede ser el centro de la portada. Solo 43 momentos tienen fecha exacta, así que cerca del 88 % de los días mostrará el «este mes» de reemplazo, y noviembre tiene 2 momentos en total.
  2. Junto al CTA tiene que verse un aviso «Leyendo en: Adultos ▾». Si el selector queda solo en la barra, un niño no lo descubre.
- **A2** ⚠️ La estrategia sí: nombre propio y «Historia de Chile» dentro del `<title>`. ❌ a «Larga»: es un adjetivo común, imposible de posicionar, y para un niño «larga» suena a «aburrida». Criterios para el dueño: único en Google, de tres sílabas o menos, con el `.cl` libre, y que se entienda dicho en voz alta en una sala de clases.
- **A3** ⚠️ Sí a la mesa de atlas en una pantalla, con dos condiciones:
  1. La «tira de fotogramas» con `scroll-snap` horizontal es un carrusel. Borra la información temporal (hoy la posición de cada hito codifica su fecha) y esconde momentos fuera de la vista. Hay que compactar la lente, no convertirla en carrusel.
  2. Nada de scroll anidado dentro de una mesa de 100svh: la rueda, el trackpad y el lector de pantalla lo sufren. La página debe desplazarse con el mapa fijo.
- **A4** ✅ Acepto que rechace el Chile horizontal: el argumento del mapa mental aprendido en el colegio y del choque con el eje del tiempo es correcto. Su alternativa resuelve lo que pedí.
- **A5** ⚠️ Sí al índice editorial y al campo `gancho:`. ❌ a envolver cada cifra del texto en Newsreader: mete una serif en medio de cada párrafo de Atkinson, contradice la razón por la que se eligió una tipografía hiperlegible y agrega marcado a todo el build. Que el dueño elija una sola solución para el texto corrido, ya sea un cero alternativo de la propia Atkinson si existe (no pude confirmarlo) o aceptar el cero tachado; un parche por cifra no.
- **A6** ⚠️ Sí a todo menos al «barrido de luz sobre el título», que es un brillo decorativo (slop) puesto sobre el elemento que mide el LCP. El h1 queda quieto y punto.
- **A7** ✅ Una condición: el ajuste «Movimiento» va dentro de un menú de ajustes y no como control destacado, y por defecto está en «automático».
- **A8** ⚠️ Sí al Flip de GSAP: está permitido, porque GSAP es la única dependencia. ❌ a mantener View Transitions como camino paralelo: dos implementaciones de la misma animación dan el doble de errores. Hay que elegir una.
- **A9** ⚠️ Pido dos verificaciones:
  1. Confirmar dónde está FFmpeg en el PC del dueño y que su compilación traiga libaom o libsvtav1 y libwebp.
  2. No todos los originales llegan a 2560 px. El build debe pedir `min(original, 2560)` y dar AVISO cuando el original sea menor que el uso.
- **A10** ✅
- **A11** ⚠️ Quitar los videos hoy: ✅. «El periodo en 90 segundos» con scroll: ❌ por ahora. Son 11 piezas nuevas de scrollytelling mientras el texto de cada periodo sigue delgado (A15). Primero la profundidad; después, si el piloto lo pide (A40).
- **A12** ✅ Ver «Decisiones reabiertas».
- **A13** ✅ al paso 1: Prat sin voz y su cita en pantalla «según la tradición». Es mejor que lo que yo pedí, porque es más honesto. ⚠️ al paso 2: ver «Decisiones reabiertas».
- **A14** ✅ La meta de «4 de 11» se queda corta. Pido que ningún periodo republicano tenga como imagen el retrato de una sola persona.
- **A15** ⚠️ Capas sí, con una condición: un piloto en 5 momentos con revisión humana antes de multiplicar. Llevar 70 momentos a 400–700 palabras son entre 28.000 y 49.000 palabras nuevas, escritas con IA y verificadas por otro agente de IA; el error sistemático crece igual de rápido (ver A39).
- **A16** ✅ La métrica de cobertura en el build es exactamente lo que pedí.
- **A17** ✅ Es la prioridad 1 de contenido.
- **A18** ⚠️ Lentes sobre un mismo atlas, sí. ❌ a la «escala lineal por siglos» para Niños:
  - Si es lineal desde el 12.500 a.C., la República ocupa el 1,5 % del ancho (216 de 14.526 años).
  - Si se recorta desde 1500, los pueblos originarios desaparecen de lo que ve el niño, que es el mismo sesgo de A17.

  Para niños: periodos en fila y de igual ancho (escala ordinal), y la escala real como lección aparte (V1).
- **A19** ✅ La condición va en V7 y A38: los documentos tienen que ser diversos.
- **A20** ✅ Condición: las preguntas las escribe o revisa un profe de verdad, y no hay puntajes públicos.
- **A21** ✅ Condición menor: la librería de QR se copia en `scripts/vendor/` con su licencia y se anota en Decisiones, por la regla de dependencias.
- **A22** Ver V4.
- **A23** ✅ La búsqueda tiene que ser un campo visible. Ctrl+K es una convención de programadores, no de niños ni de profes; él lo menciona y yo lo pongo como condición para aceptarlo.
- **A24** ✅
- **A25** ⚠️ Importa el orden. Primero `pushState` con hash; las rutas reales `/momento/…` solo cuando existan las páginas estáticas (V19). Si no, recargar o compartir un enlace da 404 en GitHub Pages.
- **A26** ✅ Prefiero texto plano en las tarjetas: el `::after` con enlaces elevados es frágil.
- **A27** ⚠️ Una sola vía de teclado: la lista de 16 regiones. Si además los 16 paths son `role=button` enfocables, las paradas de tabulación se duplican. Los paths quedan solo para ratón y táctil.
- **A28** ⚠️ Una hoja inferior de tres posiciones hecha solo con CSS `scroll-snap`, encima de un mapa que también se arrastra y se pellizca, es frágil en iOS Safari: los gestos chocan y el scroll se encadena. Condición: un prototipo probado en un iPhone y un Android reales; si falla, un mapa plegable simple, que es lo que pedí en A28.
- **A29** ⚠️ 66 `<a>` dentro del mapa son 66 pulsaciones de Tab antes de llegar al relato. Condición: tabindex itinerante (una sola parada para el mapa y flechas dentro de él), o sacar los pines del orden de tabulación y dejar la lista como vía principal.
- **A30** ✅
- **A31** ⚠️ Sí, pero sujeto a A36 y A37: páginas de lectura livianas y nada delgado indexado.
- **A32** ✅ Acepto la corrección: los hechos históricos no se marcan como `Event`; lo correcto es `Article` + `LearningResource`. Sobre el dominio, ver «Decisiones reabiertas».
- **A33** ⚠️ Dos problemas:
  - Una fecha de «Revisado» sacada del historial de git es engañosa: cualquier corrección de una coma la actualiza. Tiene que ser un campo `revisado:` que llena una persona.
  - «Reportar un error» no puede exigir una cuenta de GitHub, que casi ningún profe tiene. Hay que sumar un `mailto:` con el asunto ya escrito.
- **A34** ✅
- **A35** ⚠️ Ver «Decisiones reabiertas».

### Respuesta a sus ideas (V1–V20)
- **V1** ⚠️ Es la idea más compartible de las veinte, pero tiene un problema de fondo. Catorce mil píxeles casi vacíos le dicen al lector que antes de 1541 «no pasó nada», que es justo el sesgo de A17; con los datos actuales hay 8 momentos antes de 1500 repartidos en 14.000 px. Condición: llenar el tiempo profundo con hitos arqueológicos y ambientales verificados (fin de la glaciación, Chinchorro, Tulor, El Molle, Llolleo, Aconcagua, inca…) y explicar en el texto que lo vacío son los documentos, no la gente. Va después del top 5.
- **V2** ⚠️ Efemérides para el diario mural, sí: es un uso escolar real. Pero no como corazón de la portada (43 fechas, 2 en noviembre), y hay que marcar las 2 fechas anteriores a 1582, que están en calendario juliano.
- **V3** ⚠️ Pedagógicamente es buena, porque enseña a leer una pintura como fuente. Condiciones:
  - «4.000 px» no siempre existe: el Somerscales mide 3307 px. Se usa el original.
  - Como máximo 5 obras clave, con las zonas verificadas por el historiador.
  - Cada zona trae una pregunta, no solo un dato.
- **V4** ⚠️ Sí como función de accesibilidad, con condiciones:
  - En Chrome, las voces «Google español», y en Edge, las «Online (Natural)», no son locales (`localService: false`): el texto que lee el niño viaja a servidores de Google o Microsoft, la misma objeción de A34. Hay que preferir voces locales y avisar.
  - Chrome no trae voz es-CL. Hay que probar en el PC del dueño cómo suena.
  - Por coherencia: no se puede rechazar a «Harry» por su acento y aceptar sin escucharla una voz es-ES robótica para niños de 7 años.
- **V5** ⚠️ Solo después de que existan los retos (A20 y A22), y solo si el reto mide comprensión y no clics. ❌ a usar como «sellos coleccionables» las láminas etnográficas de Gay que retratan a mapuche u otros pueblos: convertir en estampitas a personas retratadas con mirada colonial es un error. Paisajes, flora y fauna, sí.
- **V6** ⚠️ El modo proyector (`?clase`) es ✅ y debería llegar pronto: poco esfuerzo y mucho valor. El planificador curso → OA → ruta va después de A20 y de las rutas: hoy no hay ni OA ni rutas que planificar.
- **V7** ✅ Es el corazón de A19. Condición: la primera tanda no puede ser solo de hombres de la élite (Grau, el Acta, Valdivia); ver A38.
- **V8** ⚠️ Esto es lo que separa un atlas de un folleto, y también la zona con más riesgo de alucinación: frases como «el historiador X sostiene Y» redactadas por una IA. Condición no negociable: cada postura con una referencia bibliográfica real y enlazable, comprobada por una persona. Sin cita no hay postura.
- **V9** ⚠️ Es potente y también peligrosa. «Tu abuela tenía 20 años en 1973: pregúntale qué recuerda» puede caer en una familia de exiliados, de detenidos desaparecidos o de uniformados. Condiciones: preguntas abiertas y neutrales («¿qué cambió en tu barrio?»), una guía docente para memorias sensibles y la opción de no participar. Va después del top 5.
- **V10** ❌ Es cosmética. Mete pantallas de scroll entre la portada y el contenido justo cuando A1 y A3 piden llegar antes. Es movimiento por el movimiento, y el dueño, con reduce, verá cuatro cuadros fijos. *Snow Fall* es de 2012; hoy el estándar es llegar rápido al contenido.
- **V11** ⚠️ Barata solo para los saltos entre páginas de lectura. Dentro del explorador, una transición entre documentos obliga a recargar el mapa y los datos en cada clic; medí una tarea larga de 1,4 s en escritorio y de 8,7 s con CPU 4×. Ahí se navega sin recargar (`pushState`) y la animación es la de A8.
- **V12** ⚠️ VTT y 9:16: ✅ (ya están en A12). Podcast con RSS: ❌ por ahora, porque un feed con un episodio es relleno; se revisa con 10 relatos o más y después de leer qué permite el plan gratis sobre redistribución. Además, «5 relatos al mes con el plan gratis» no cuenta los créditos de los efectos de sonido ni las tomas repetidas: hay que medir cuánto gastó de verdad Iquique.
- **V13** ⚠️ Voces humanas, sí a largo plazo. Pero la voz es un dato personal (Ley 21.719) y el consentimiento se puede retirar, mientras que CC BY-SA es irrevocable: no se puede publicar la voz de un menor con una licencia que no permite retirarla. Condición: solo voces adultas, con licencia irrevocable informada, o una licencia propia con cláusula de retiro.
- **V14** ✅ Dos condiciones:
  - Si la imagen es CC BY o CC BY-SA, la tarjeta es una obra derivada: tiene que llevar autor y licencia visibles en la propia tarjeta, y BY-SA obliga a licenciar la tarjeta igual.
  - El `drawtext` de FFmpeg necesita TTF u OTF, no woff2. Los TTF originales se guardan en `scripts/`.
- **V15** ✅ Con el `mailto:` de A33.
- **V16** ⚠️ Muy buena para enseñar cambio territorial, pero dos renders del mapa duplican los 733 KB de trazados actuales. Solo después del `<symbol>` de A30.
- **V17** ❌ Es tangencial a la historia, cuesta M y suma geometría mundial a un sitio que ya pesa demasiado. Una figura estática de «Chile sobre Europa» en la ficha de geografía logra el 90 % del efecto.
- **V18** ✅ Que empiece por «¿Quién podía votar?»: esa serie cuenta la historia política mejor que diez párrafos. Con tabla de respaldo y fuente.
- **V19** ⚠️ Sí, sujeto a A36 (no indexar lo delgado) y A37 (páginas de lectura livianas). Las páginas por región solo se publican si la región pasa un mínimo de contenido: hoy «Historia de la Región de Aysén» tendría cero momentos.
- **V20** ✅ Condición: los avisos que bloquean entran por escalones. Si «momento sin fuentes» bloqueara desde el primer día, no se publicaría nada, porque hoy ningún momento le muestra sus fuentes al lector.

### Decisiones reabiertas: mi postura
- **WebVTT:** ✅ Sí, ya. Es barato, porque `build-relato.mjs` ya calcula los tiempos, y resuelve de una vez accesibilidad, móvil, traducción e indexación. Hay que anotar en Decisiones que los subtítulos dejan de quemarse en la imagen.
- **Un mes de ElevenLabs Starter:** ⚠️ Sí, con cuatro condiciones:
  1. Precio y créditos confirmados en la web oficial.
  2. Al menos 5 guiones verificados antes de pagar.
  3. Escuchar una muestra de las voces chilenas de la biblioteca antes de generar en lote.
  4. Prat sigue sin voz (paso 1 de A13).

  Unos 5 USD contra lo que cuesta en credibilidad una voz que no suena chilena: se pagan solos. Ese mes no se usa para el audio de Niños: 70 textos de unas 75 palabras suman cerca de 31.000 caracteres, más o menos lo que trae el mes entero.
- **Dominio .cl:** ✅ Sí, y **antes** de indexar. Si Google y los WhatsApp de los colegios aprenden la dirección de github.io, migrar después cuesta enlaces y confianza. La redirección de GitHub Pages ayuda, pero no arregla los enlaces que ya quedaron en PDF e impresos, y el QR de A21 quedaría apuntando a la dirección vieja. Orden: nombre (A2) → dominio → páginas (V19) → Search Console. En NIC Chile cuesta del orden de diez mil pesos al año (por confirmar).
- **Documentos de la BND:** ⚠️ Commons primero, como propone el visionario: un solo verificador, y se devuelve algo a los bienes comunes. Dos condiciones:
  1. Las subidas a Commons las hace una persona con su propia cuenta; los agentes no suben en nombre del dueño.
  2. Si un documento clave no se puede subir, se usa la BND directamente como excepción documentada, con `licencia_verificada_por:` y enlace al registro.

  Las imágenes generadas por IA siguen prohibidas.

### Lo que ninguno de los dos vio
- **A36 · [SEO/contenido] [alto]** Indexar 180 páginas delgadas puede jugar en contra. Hoy un momento tiene 186 palabras y una ficha 71. Publicarlos como páginas sueltas son cientos de URL con poco contenido en temas donde compiten Wikipedia, Memoria Chilena e Icarito. *Exijo:* que el build marque con `noindex` y saque del sitemap toda página bajo un umbral (por ejemplo, menos de 300 palabras o sin fuentes) hasta que lo cumpla, y empezar indexando los 30 momentos que ya tengan sus capas completas.
- **A37 · [rendimiento/SEO] [crítico]** Las páginas de aterrizaje no pueden cargar el explorador. Si cada `/momento/…` «se hidrata con el mismo JS», cada visita que llega desde Google carga 1,2 MB de trazados SVG, el `historia.js` completo y la coreografía. En móvil medí un LCP de 4,9 s y una tarea larga de 8,7 s con CPU 4×. Las Core Web Vitals se miden por página, así que eso hunde justo las páginas que se quiere posicionar. *Exijo:* páginas de lectura primero (texto, imagen, localizador SVG pequeño, fuentes) y el atlas bajo demanda, con un botón «Abrir en el atlas».
- **A38 · [contenido] [medio]** La primera tanda de documentos que propone V7 (Grau, el Acta de Independencia y la carta de Valdivia a Carlos V) son tres voces masculinas de élite, y una de ellas es la del conquistador. Repite el sesgo de A14 y A16. *Exijo:* que desde la primera tanda haya al menos una voz indígena (por ejemplo, actas de parlamentos o escritos de dirigentes mapuche del siglo XX como Manuel Aburto Panguilef, por verificar), una de mujer (Carmela Carvajal ya está; también Elena Caffarena) y una obrera (la prensa obrera de Recabarren).
- **A39 · [confianza/proceso] [alto]** La capacidad editorial no alcanza para el plan. Sumando capas (A15), debates (V8), preguntas (A20), documentos (A19), zonas (V3) y las tres versiones, cada momento pasa de unas 450 palabras a 1.500 o 2.000; llevar 120 momentos a ese nivel supera las 200.000 palabras. Si las escribe una IA y las verifica otra IA, el error sistemático crece al mismo ritmo. *Exijo:* un protocolo de revisión humana (muestreo por lote y un historiador externo o un profe de historia que firme), un tope de capas por fase y una lista explícita de «no por ahora».
- **A40 · [producto] [alto]** Nadie propuso probar con usuarios reales. Hay veinte ideas y ninguna prueba con un curso o con profes: ni cinco entrevistas, ni una clase observada, ni una prueba de tarea del tipo «encuentra qué pasó en tu región en 1891». El nivel Silicon Valley no sale de la animación, sale de iterar con quien usa el producto. *Exijo:* un piloto con dos cursos (uno de básica y uno de media) y cinco profes antes de construir V1, V3, V5, V9 o V16.
- **A41 · [producto] [medio]** No hay forma de saber qué se usa. GitHub Pages no entrega registros y el sitio no mide nada, así que toda priorización es opinión. *Exijo:* Search Console, que es gratis y no toca al usuario, y, si se mide algo en el sitio, un contador agregado sin cookies ni datos personales, declarado en la página de metodología (coherente con A34 y la Ley 21.719).
- **A42 · [aula] [medio]** Falta una versión sin internet para los colegios. Muchos proyectan con mala conexión, y el sitio ya funciona en `file://`: es una ventaja que ninguno de los dos aprovechó. Hoy `site/` pesa unos 87 MB (38 de imágenes y 48 de video); sin los videos mudos y con AVIF cabría sin problema en un pendrive. *Exijo:* un botón «Descargar para clase sin conexión» (un ZIP generado en CI) y, en http, un service worker que guarde los momentos ya visitados.

### Mi top 5
1. **Arreglar lo que hoy hace daño** (poco esfuerzo, una semana): Atrás con historial (A25, con hash mientras no existan las páginas), imprimir sin duplicar (A21), tarjetas sin doble acción (A26), texto de portada visible (A6), fundidos en reduce y ajuste de movimiento (A7), y quitar los videos mudos (A11).
2. **Corregir y profundizar el contenido antes de mostrárselo a Google:** el genocidio selk'nam en su fecha real (A17), la métrica de cobertura (A16) y capas completas en los 30 momentos con más demanda curricular, con revisión humana (A15 y A39). Sin esto, el SEO solo difunde más rápido un folleto.
3. **Una URL para cada cosa, liviana y con dominio definitivo:** nombre → dominio .cl → páginas de lectura estáticas (A31, V19) sin cargar el explorador (A37), `noindex` bajo el umbral (A36), Open Graph con créditos (V14), JSON-LD educativo (A32) y Search Console.
4. **Que el profe lo use mañana:** documentos primarios con voces diversas (A19, V7, A38), hoja de trabajo con QR (A21), OA oficiales (A20) y modo proyector (V6, todavía sin planificador).
5. **Móvil y accesibilidad de verdad, probados con gente:** mapa móvil probado en iPhone y Android (A28), regiones por lista con tabindex itinerante (A27, A29), imágenes AVIF con srcset (A9, A10) y el piloto con dos cursos y cinco profes (A40) como requisito antes de cualquier atracción nueva.

**No por ahora:** V10 y V17 quedan rechazadas; V1, V3, V5, V9, el podcast de V12 y V16 esperan hasta después del piloto.

---

## Ronda 4 · Visionario — Contrarréplica: primero lo verdadero, después lo vistoso
**Postura.** El 6,5 es justo. Concedo la crítica central: mi top 5 era de plataforma y no de contenido, y varias ideas eran atracciones antes de tiempo. En esta ronda retiro V10 y V17 (la versión interactiva), las cifras en Newsreader, el barrido de luz, la escala lineal para niños, «Larga» y la tira de fotogramas. Defiendo lo que sigue en pie, y cada cosa entra con una condición que la hace verificable.

*Verificaciones de esta ronda:*
- **FFmpeg:** no está en el PATH ni en `HYPERFRAMES_FFMPEG_PATH`, y tampoco aparece en winget, Chocolatey, Program Files ni en la caché de npx. Que «ya es requisito» era cierto en el papel, no en el PC.
- **Atkinson Hyperlegible Next** (archivo completo de google/fonts): su GSUB solo tiene `aalt case ccmp frac locl ordn pnum sups tnum` y los únicos glifos de cero son `zero` y `zero.tf`. **No existe un cero sin tachar.**
- **Voces en el PC del dueño** (Chromium 157): Microsoft Sabina y Raúl (es-MX), Helena, Laura y Pablo (es-ES). Todas son locales y ninguna es es-CL.
- **Fechas julianas:** Fundación de Santiago (12-02-1541) y Tucapel (25-12-1553).
- **Relato de Iquique:** 1.772 caracteres de voz y 4 efectos (23 s en total), guardados en caché y reutilizables en otros relatos.
- **Derechos de autor:** Elena Caffarena murió en 2003, así que sus textos están protegidos hasta 2073 (vida + 70 años). Recabarren murió en 1924: su obra es de dominio público.

### Respuesta a los ❌ y ⚠️
- **A1** ⚠️ → **concedo las dos condiciones.**
  - «Un día como hoy» pasa a ser un módulo secundario.
  - En el centro quedan «Empieza el viaje» y «Leyendo en: Adultos ▾».
  - **Mejora:** el momento destacado de la portada sigue el **calendario escolar** (mayo, Glorias Navales; septiembre, Independencia). El dueño lo elige con un campo `destacado:` en `00 Inicio.md`, así que no depende de las 43 fechas exactas.
- **A2** ❌ → **concedo.** Para un niño, «Larga» suena a «aburrida». Acepto sus criterios y propongo un método:
  - el dueño arma una lista corta de 5 nombres;
  - se prueban en voz alta en el piloto (A40) y se elige el que los niños repiten bien;
  - recién entonces se compra el `.cl`.
- **A3** ⚠️ → **concedo las dos condiciones.**
  - **Sin carrusel:** la lente conserva la posición temporal de cada hito y solo se compacta (alto según los carriles que se usan y miniaturas de 36 px).
  - **Sin scroll anidado:** la página se desplaza y el mapa queda fijo con `position: sticky`.
- **A5** ❌ (cifras en Newsreader) → **concedo, y lo verifiqué:** la fuente no trae un cero alternativo, y un parche por cifra no se justifica. El cero tachado se queda en todo el sitio, porque es la seña de legibilidad de Atkinson. El resto (índice editorial, `gancho:`, fecha escrita) sigue en pie.
- **A6** ⚠️ → **concedo:** fuera el barrido de luz. El h1 queda quieto.
- **A8** ⚠️ → **concedo:** en el explorador habrá una sola implementación, Flip de GSAP. View Transitions queda solo para los saltos entre páginas de lectura (V11). Ese es otro caso; no son dos versiones de la misma animación.
- **A9** ⚠️ → **concedo y agrego un paso 0.** Sin FFmpeg instalado se bloquean también los relatos y el VTT.
  - Instalar una compilación completa y comprobar con `ffmpeg -hide_banner -encoders` que trae `libaom-av1` o `libsvtav1`, más `libwebp`.
  - El build pide `min(original, 2560)` y da AVISO si el original es menor que el tamaño de uso.
  - Plan B sin FFmpeg: `npx sharp-cli`, sin tocar `package.json`.
- **A11** ⚠️ → **concedo:** «El periodo en 90 segundos» espera a que haya profundidad (A15) y a lo que diga el piloto.
- **A13** ⚠️ (paso 2) → **acepto sus cuatro condiciones** y agrego una: el build lee el saldo de caracteres de la API antes y después de cada corrida, para saber cuánto cuesta de verdad un relato en lugar de suponerlo.
- **A15** ⚠️ → **concedo:** piloto en 5 momentos con revisión humana. No se multiplica hasta que el protocolo de A39 muestre pocos errores.
- **A18** ❌ (escala lineal para niños) → **concedo:** su aritmética es correcta. Para niños: periodos en fila y de igual ancho (escala ordinal), con la duración escrita («duró 212 años»). La escala real queda como lección aparte (V1).
- **A25** ⚠️ → **concedo el orden:** primero `pushState` con hash; las rutas reales solo cuando existan las páginas estáticas.
- **A26** → **acepto texto plano** en las tarjetas.
- **A27** ⚠️ → **concedo:** la lista de regiones es la única vía de teclado. Los paths quedan solo para ratón y táctil, fuera del orden de tabulación.
- **A28** ⚠️ → **concedo y le doy la vuelta:** se empieza por el **mapa plegable**, que es barato y robusto. La hoja inferior solo se prueba si el piloto muestra que hace falta, y solo se adopta si funciona en un iPhone y un Android reales.
- **A29** ⚠️ → **concedo:** el mapa es **una sola parada de tabulación** (tabindex itinerante). Dentro, las flechas recorren los pines de norte a sur y Enter abre el momento. La vía principal sigue siendo la lista de A27.
- **A31** ⚠️ → **acepto que dependa de A36 y A37** (ver más abajo).
- **A33** ⚠️ → **concedo las dos:**
  - la fecha de `revisado:` la escribe una persona, nunca git;
  - «Reportar un error» ofrece un `mailto:` con el asunto ya escrito, además de GitHub.
- **A35** ⚠️ → **acepto sus dos condiciones:** las subidas a Commons las hace una persona con su propia cuenta, y la BND directa queda como excepción documentada.
- **V1** ⚠️ → **acepto la condición y la vuelvo el concepto.** Lo vacío deja de estar vacío:
  - un **hilo continuo de presencia humana** recorre las 14.500 líneas sin cortarse, con los nombres de las culturas a su altura;
  - los hitos arqueológicos y ambientales verificados marcan el camino;
  - la primera frase lo dice: «Lo que falta son documentos, no personas».

  Va después del piloto.
- **V2** ⚠️ → **acepto:** sirve para el diario mural, no como centro de la portada. Santiago (1541) y Tucapel (1553) llevan la marca «calendario juliano».
- **V3** ⚠️ → **acepto las tres condiciones:** resolución del original, 5 obras como máximo y una pregunta por zona.
- **V4** ⚠️ → **concedo la coherencia:** si rechazamos a «Harry» sin escucharlo, tampoco podemos aceptar a Sabina sin escucharla.
  - Solo voces locales (`localService`). En el PC del dueño hay cinco y ninguna es chilena.
  - Una voz en línea solo se usa con aviso explícito.
  - Es una ayuda de accesibilidad opcional, y se queda solo si los niños del piloto la prefieren a no tener nada.
- **V5** ❌ (láminas etnográficas como sellos) → **concedo sin matices:** tiene razón, era un error. Solo paisajes, flora y fauna, y solo cuando existan retos que midan comprensión.
- **V6** ⚠️ → **acepto:** el proyector, ya. El planificador, después de A20 y de las rutas.
- **V8** ⚠️ → **acepto su condición no negociable y el build la hace cumplir:** cada postura de `## Debate` lleva una referencia (URL, ISBN o DOI) y un `revisado:` humano. Si falta algo, no se publica.
- **V9** ⚠️ → **concedo:** el ejemplo de 1973 era malo.
  - Preguntas abiertas y neutrales («¿Qué cambió en tu barrio?»).
  - Guía docente para memorias sensibles.
  - Opción de no participar.

  Va después del piloto.
- **V10** ❌ → **concedo y la retiro.** A1 y A3 piden llegar antes al contenido, y con reduce el dueño vería cuatro cuadros fijos. El recorrido de norte a sur ya está en la apertura (los puntos aparecen de norte a sur), sin pantallas de más.
- **V11** ⚠️ → **acepto:** solo entre páginas de lectura. En el explorador, `pushState` y la animación de A8.
- **V12** ⚠️ → **acepto:** el podcast espera a tener 10 relatos y a que se revise la licencia. El VTT y la versión 9:16 ya están en A12.
- **V13** ⚠️ → **concedo el punto legal:** la voz es un dato personal y CC BY-SA no se puede revocar.
  - Solo voces adultas, con la licencia explicada antes de grabar.
  - A quien quiera poder retirarse, una licencia propia con cláusula de retiro, solo para el sitio.
- **V16** ⚠️ → **acepto:** va después del `<symbol>` de A30.
- **V17** ❌ → **concedo:** queda como una figura estática opcional en la ficha de geografía.
- **V19** ⚠️ → **acepto:** una página de región solo se publica cuando la región pasa el umbral de A36.

*Sus ✅ con condición los acepto todos:*
- A7: el ajuste va en un menú y por defecto está en «automático».
- A14: ningún periodo republicano tiene como imagen un retrato individual.
- A20: las preguntas las escribe o revisa un profe y no hay puntajes públicos.
- A21: el QR va en `scripts/vendor/` con su licencia y se anota en Decisiones.
- A23: la búsqueda es un campo visible.
- V14: crédito y licencia en la propia tarjeta, y los TTF en `scripts/`.
- V15: con el `mailto:`.
- V20: los bloqueos entran por escalones.

### Hallazgos nuevos (A36–A42)
- **A36** ✅ — Tiene razón. **Solución:** un umbral que mida sustancia y no relleno:
  - texto adulto de 300 palabras o más, sin sumar las tres versiones (eso inflaría la cifra con texto repetido);
  - 2 fuentes enlazadas o más;
  - `revisado:` firmado por una persona.

  Lo que no pasa lleva `noindex` y queda fuera del sitemap. El build imprime cuántas páginas están listas. Se empieza por los 30 momentos del punto 2.1 del plan. *S · 5*
- **A37** ✅ crítico — **Concedo:** «se hidrata con el mismo JS» fue un error mío. **Solución:** la página de lectura usa otra plantilla.
  - **Contenido:** HTML con el texto, imagen AVIF con `fetchpriority`, un localizador SVG simplificado en línea (15 KB como máximo), las fuentes y un JS de 10 KB como máximo (compartir, citar, leer en voz alta).
  - **Presupuesto:** 150 KB como máximo sin contar la imagen, y LCP menor a 1,8 s en móvil medio.
  - **El atlas** solo se carga con el botón «Abrir en el atlas» (`index.html#evento/<id>`).

  *M · 5*
- **A38** ✅ — **Concedo:** mi primera tanda era masculina y de élite, y una de esas voces era la del conquistador. **Nueva primera tanda** (todo pasa por el historiador):
  1. Carta de Grau a Carmela Carvajal y respuesta de ella: voz de mujer y perspectiva peruana.
  2. Prólogo de Martina Barros a *La esclavitud de la mujer* (1872), si se confirma que es de dominio público.
  3. Prensa obrera de Recabarren (dominio público: murió en 1924).
  4. Un escrito de un dirigente mapuche del siglo XX (Manquilef o Aburto Panguilef; fechas y licencia por verificar).
  5. El Acta de Independencia.

  Valdivia sale de la primera tanda. **Ojo:** los textos de Elena Caffarena están protegidos hasta 2073, así que se enlazan o se cita un fragmento breve con atribución (derecho de cita, por confirmar). *M · 5*
- **A39** ✅ — **Concedo:** es el riesgo más serio del plan. **Solución:**
  1. `revisado: {por, fecha}` lo firma una persona, y es requisito para indexar (A36).
  2. Se trabaja en **lotes de 10**. Un revisor externo (profe de historia o historiador) revisa completos los dos primeros lotes; después, una muestra del 30 %.
  3. Una **fe de erratas** pública.
  4. **Tope de la fase 1:** 30 momentos con solo tres capas: «En 30 segundos», «La historia» (500 palabras como máximo) y «Fuentes». Sin debates (V8) ni zonas (V3).
  5. Se publica la lista **«no por ahora»**.

  La ayuda de IA se declara en «Cómo se hace». *S · 5*
- **A40** ✅ — **Concedo:** es lo que más acerca al nivel Silicon Valley. **Solución:** un piloto con dos cursos (5°–6° básico y 2° medio) y cinco profes, apenas termine el nivel Imprescindible.
  - **Cinco tareas:**
    1. Encontrar qué pasó en tu región en 1891.
    2. Imprimir la hoja para la clase de mañana.
    3. Compartir un momento con el curso.
    4. Leer o escuchar Iquique y responder el reto.
    5. Buscar a Gabriela Mistral.
  - **Qué se mide:** si la logran, cuánto tardan y dónde se traban.
  - **Observación:** una clase por curso, con permiso del colegio y sin grabar caras de menores.
  - Lo que salga va a Decisiones y decide qué entra del nivel Ambicioso. Costo cero.

  *M · 5*
- **A41** ✅ — **Solución:** primero solo Search Console, que no toca al usuario. Un contador en el sitio, como GoatCounter (sin cookies, código abierto, gratis para uso no comercial), sigue siendo una petición a un tercero. **[reabre decisión]**: se decide después del piloto y, si se usa, se declara en la página de metodología. *S · 3*
- **A42** ✅ — Una muy buena idea que se me pasó. **Solución:**
  - El CI genera `historia-de-chile-sin-conexion.zip` y lo adjunta a un *release* de GitHub, no dentro de `site/`, para no duplicar el peso en Pages.
  - En la portada y en la guía para maestros, un botón «Descargar para clase sin conexión».
  - En http, un service worker guarda los momentos visitados, y el botón «Guardar esta ruta para clase» la deja lista de antemano.
  - Sin los videos mudos y con AVIF, el ZIP pesaría unas pocas decenas de MB (hay que medirlo).

  *S/M · 4*

### Sobre mi top 5
**Concedo.** Mi top 5 era de plataforma, no de contenido. Indexar y adornar 70 momentos delgados solo hace circular más rápido un folleto.

Un matiz, que no es una defensa: código y contenido avanzan en paralelo. Los arreglos S no tienen por qué esperar a la profundidad, y el umbral de A36 permite construir las páginas ahora e indexar solo lo que esté listo. Por eso el plan final pone el contenido en Imprescindible (A17, A16 y A39) y la profundidad como el primer punto de Alto impacto.

### Decisiones reabiertas
- **WebVTT:** de acuerdo. Hay que anotar en Decisiones que los subtítulos dejan de quemarse en la imagen.
- **ElevenLabs Starter, un mes:** acepto sus cuatro condiciones, más la medición del saldo (A13).
- **Dominio `.cl` antes de indexar:** concedo. Lo de los QR y los PDF ya impresos es decisivo. Orden: nombre → dominio → páginas → Search Console. El QR de la hoja de trabajo se activa cuando exista el dominio definitivo.
- **Documentos de la BND:** acepto sus condiciones.
- **Contador sin cookies:** nueva decisión reabierta (A41). La decide el dueño después del piloto.

### Plan final

**1. Imprescindible** (lo que hoy hace daño, la verdad del contenido y las condiciones para crecer)

| # | Qué | Esfuerzo | Impacto | Origen |
|---|---|---|---|---|
| 1.1 | Atrás con historial: `pushState` con hash y `popstate` que cierra lámina, ficha y región | S | 5 | A25 |
| 1.2 | Portada: h1 quieto y visible desde el primer cuadro, sin las tarjetas de versión; «Empieza el viaje» y «Leyendo en: Adultos ▾» | S | 5 | A6, A1 |
| 1.3 | Perfil suave con reduce (fundidos de 150 a 250 ms, escucha `change`) y ajuste «Movimiento» en el menú, en automático por defecto | S | 5 | A7 |
| 1.4 | Quitar los videos mudos | S | 3 | A11 |
| 1.5 | Tarjetas de periodo con texto plano | S | 4 | A26 |
| 1.6 | Hoja de trabajo imprimible: una versión, mapa, minilínea y preguntas; QR cuando haya dominio | S/M | 5 | A21 |
| 1.7 | Compartir, «Cómo citar» y título propio para cada momento | S | 4 | A24 |
| 1.8 | Fuentes tipográficas alojadas en el sitio; se acepta el cero tachado | S | 4 | A34, A5 |
| 1.9 | Genocidio selk'nam y pueblos originarios en su fecha real | S/M | 5 | A17 |
| 1.10 | Métrica de cobertura en el build, con metas por región, siglo, género y tema | M | 5 | A16 |
| 1.11 | Protocolo editorial: `revisado:` firmado, lotes de 10, revisor externo, fe de erratas y lista «no por ahora» | S | 5 | A39, A33 |
| 1.12 | Página «Cómo se hace», licencia CC BY-SA y «Reportar un error» por `mailto:` y GitHub | S | 4 | A33, V15 |
| 1.13 | Nombre (con los criterios del abogado, probado en voz alta) y luego dominio `.cl` · *decide el dueño* | S | 4 | A2, A32 |
| 1.14 | Instalar FFmpeg completo y verificar sus codificadores (bloquea relatos, VTT e imágenes) | S | 4 | A9 |
| 1.15 | Piloto con 2 cursos y 5 profes: 5 tareas y 1 clase observada por curso | M | 5 | A40 |

**2. Alto impacto** (profundidad, SEO liviano, aula, móvil y accesibilidad)

| # | Qué | Esfuerzo | Impacto | Origen |
|---|---|---|---|---|
| 2.1 | Capas de profundidad: piloto en 5 momentos y luego los 30 con más demanda curricular, con revisión humana | L | 5 | A15, A39 |
| 2.2 | Documentos primarios con voces diversas (primero a Commons, subidos por una persona) y visor «Fuente en la mano» | M | 5 | A19, V7, A38, A35 |
| 2.3 | OA oficiales, varios niveles por momento, preguntas revisadas por un profe y ticket de salida sin puntajes públicos | M | 5 | A20 |
| 2.4 | Páginas de lectura estáticas y livianas, sin cargar el explorador y con «Abrir en el atlas»; `noindex` bajo el umbral; JSON-LD `Article` + `LearningResource`; sitemap; Open Graph con créditos; Search Console | M | 5 | A31, A36, A37, A32, V19, V14, A41 |
| 2.5 | Mesa de atlas en escritorio: lente compacta sin carrusel, un solo año protagonista, mapa fijo; leyenda fuera del mapa y tramas distinguibles | M | 5 | A3, A4 |
| 2.6 | Móvil: mapa plegable, más un índice con búsqueda; la hoja inferior solo si pasa en un iPhone y un Android reales | M | 5 | A28 |
| 2.7 | Accesibilidad del mapa: lista de regiones como vía de teclado, pines con tabindex itinerante, región viva corta y `alt`/`figcaption` | M | 4 | A27, A29 |
| 2.8 | Búsqueda como campo visible y rutas guiadas | M | 5 | A23 |
| 2.9 | Modo proyector `?clase` | S | 4 | V6 |
| 2.10 | Relato: Prat sin voz, WebVTT, transcripción y versión 9:16 | M | 4 | A12, A13 |
| 2.11 | Imágenes AVIF/WebP con srcset, `min(original, 2560)` y AVISO sobre 200 KB | M | 4 | A9, A10 |
| 2.12 | Rendimiento: `<symbol>` + `<use>`, niveles de detalle y datos por periodo; presupuesto en CI con bloqueos escalonados | M/L | 5 | A30, V20 |
| 2.13 | Imágenes de periodo que muestran escenas: ningún periodo republicano con retrato individual | S | 3 | A14 |
| 2.14 | Versión sin conexión: ZIP en un release de GitHub y service worker en http | S/M | 4 | A42 |
| 2.15 | Lentes por versión: Niños con periodos de igual ancho y Maestros con barra de clase | M | 4 | A18 |
| 2.16 | Lectura en voz alta opcional con voces locales, más glosario; se queda solo si pasa la prueba con niños | M | 3 | A22, V4 |
| 2.17 | Índice editorial de periodos con `gancho:` y jerarquía visual por rol | M | 3 | A5 |
| 2.18 | Lámina con Flip de GSAP y regreso del cine a la lámina | M | 3 | A8 |
| 2.19 | Efemérides mensuales para el diario mural, como módulo secundario y con las fechas julianas marcadas | S | 3 | V2 |

**3. Ambicioso** (solo después del piloto y si el piloto lo pide)

| # | Qué | Esfuerzo | Impacto | Origen |
|---|---|---|---|---|
| 3.1 | «¿Quién podía votar?» y otras series con tabla y fuente | M | 4 | V18 |
| 3.2 | «La cortina del tiempo», después del `<symbol>` | M | 5 | V16 |
| 3.3 | «Catorce mil quinientos píxeles», con el hilo continuo de presencia humana e hitos verificados | M | 5 | V1 |
| 3.4 | «Lo que se discute», con referencia bibliográfica verificada por una persona | M | 4 | V8 |
| 3.5 | «Mira de cerca» en 5 obras, con una pregunta por zona | M | 4 | V3 |
| 3.6 | Planificador curso → OA → ruta | M | 4 | V6 |
| 3.7 | Un mes de ElevenLabs Starter con voces chilenas y más relatos; podcast al llegar a 10 | M | 4 | A13, V12 |
| 3.8 | «Lo que vivió tu familia», con preguntas neutrales, guía docente y opción de no participar | S/M | 4 | V9 |
| 3.9 | Pasaporte del explorador: solo paisajes, flora y fauna, y retos de comprensión | M | 3 | V5 |
| 3.10 | Transiciones entre páginas de lectura | S | 3 | V11 |
| 3.11 | Voces de Chile: solo voces adultas, con licencia explicada | L | 4 | V13 |
| 3.12 | «El periodo en 90 segundos», si el piloto lo pide | M | 3 | A11 |
| 3.13 | Contador agregado sin cookies · *[reabre decisión]* | S | 2 | A41 |

**Retirado:** V10; V17 como interactivo (queda una figura estática opcional); cifras en Newsreader; barrido de luz; escala lineal para niños; «Larga»; tira de fotogramas; podcast por ahora; Valdivia en la primera tanda de documentos.

---

## Acta · Moderador (Claude)

**Resultado.** El abogado del diablo le puso **4/10** al sitio actual frente a lo mejor de su categoría, y **6,5/10** al primer plan del visionario, porque ese plan no traía contenido. En la ronda 4 el visionario lo reconoció y reordenó el plan: primero lo verdadero, después lo vistoso.

**Verificado por el moderador:**
- El genocidio selk'nam aparece dentro del momento fechado `anio: -8000`.
- `app.js` usa `replaceState` 6 veces y `pushState` ninguna, así que Atrás saca del sitio.
- El fondo con reduce-motion ya se corrigió hoy (fundidos de 9 s). Lo demás de A7 sigue pendiente: fundidos en lámina y relato, y un ajuste de «Movimiento».
- Ítem 1.14: FFmpeg sí está, pero como copia portátil en una carpeta temporal de la sesión. Hay que dejarlo fijo en el proyecto (por ejemplo, `ffmpeg-static` como devDependency), no instalarlo en el sistema.

### Acuerdos
Los dos firman lo siguiente:
1. Antes de pulir, arreglar lo que hoy hace daño: Atrás, el texto de portada visible, los fundidos con reduce, las tarjetas con doble acción, la impresión rota y los videos mudos.
2. Contenido antes que SEO:
   - corregir fechas (selk'nam y pueblos originarios en su siglo real);
   - medir la cobertura por región, siglo, género y tema (hoy Aysén tiene 0 momentos y hay 5 mujeres entre 39 personajes);
   - dar más profundidad a cada momento (hoy son 186 palabras de media);
   - que una persona revise lo que escriba la IA.
3. Para que Google lo encuentre:
   - una página estática y liviana por momento, sin cargar el explorador;
   - Open Graph, JSON-LD, sitemap;
   - `noindex` para lo que no llegue al umbral (300 palabras o más, con fuentes y con revisión).
4. Para el aula:
   - documentos primarios incluidos, con voces diversas desde la primera tanda;
   - OA oficiales;
   - una hoja de trabajo imprimible de verdad;
   - modo proyector.
5. Móvil y accesibilidad reales: mapa plegable, regiones navegables con teclado, imágenes AVIF/WebP y pruebas en teléfonos reales.
6. Ninguna atracción nueva hasta probar con usuarios: 1 año = 1 píxel, la cortina del tiempo, el pasaporte y «Mira de cerca» esperan al piloto con cursos.
7. Se retiran el viaje norte-sur (V10), el barrido de luz, las cifras en Newsreader y el podcast por ahora.

### Lo que decides tú (el dueño)
| # | Decisión | Qué recomiendan | Costo |
|---|---|---|---|
| D1 | **Prat sin voz sintética**: su frase sale en pantalla, «según la tradición» | Los dos a favor, por honestidad. ⚠️ Contradice lo que pediste al principio («que Prat diga su frase y sea épico»). Alternativa: mantener la voz hasta tener una voz chilena | 0 |
| D2 | **Nombre propio y dominio `.cl`**, antes de que Google indexe | Los dos a favor. Orden: nombre → dominio → páginas → Search Console | unos 10 000 CLP al año (por confirmar en NIC Chile) |
| D3 | **Un mes de ElevenLabs Starter** con voces chilenas | Sí, pero solo con 5 guiones verificados antes, una muestra de voces escuchada y el saldo medido | unos 5 USD (por confirmar) |
| D4 | **Documentos de Biblioteca Nacional / Surdoc** | Primero subirlos a Commons, y lo haces tú con tu cuenta, no un agente. Si no se puede, la BND como excepción documentada. Imágenes de IA siguen prohibidas | 0, pero toma tiempo |
| D5 | **Subtítulos WebVTT** (activables) en vez de quemados en la imagen | Los dos a favor | 0 |
| D6 | **Quitar los 11 videos de periodo** (son mudos y repiten la línea de tiempo) | Los dos a favor. Rehacerlos narrados solo si el piloto lo pide | 0 |
| D7 | **Piloto con 2 cursos y 5 profes** (5 tareas y 1 clase observada) | Los dos lo consideran imprescindible; necesita tus contactos | tu tiempo |
| D8 | **Revisor humano externo** (historiador o profe de historia que firme) | Imprescindible para escalar el contenido | tu red |
| D9 | **Contador de visitas sin cookies** | Decidir después del piloto. Search Console no toca al usuario | 0 |

### Hoja de ruta propuesta
El detalle de cada ítem está en «Plan final» (ronda 4). Aquí va el orden de trabajo y quién lo ejecuta.

| Fase | Mejoras (n.º del plan final) | Esfuerzo | Quién |
|---|---|---|---|
| **1 · Arreglos** (una semana) | 1.1 Atrás · 1.2 portada · 1.3 reduce y ajuste de movimiento · 1.4 videos · 1.5 tarjetas · 1.7 compartir y citar · 1.8 fuentes locales · 1.14 FFmpeg fijo | S | Claude + `director-animacion` |
| **2 · Verdad del contenido** | 1.9 selk'nam y pueblos en su fecha · 1.10 métrica de cobertura · 1.11 protocolo editorial · 1.12 página «Cómo se hace» y reportar error | S/M | `historiador` + Claude, firma de una persona |
| **3 · Aula** | 1.6 hoja de trabajo · 2.2 documentos primarios · 2.3 OA y ticket de salida · 2.9 modo proyector | M | Claude + `historiador` |
| **4 · Encontrable** (tras D2) | 1.13 nombre y dominio · 2.4 páginas de lectura, JSON-LD, sitemap, Open Graph | M | Dueño (nombre y dominio) + Claude |
| **5 · Profundidad** | 2.1 capas en 5 momentos piloto y luego 30 · 2.13 imágenes de escenas | L | `historiador` + revisor humano |
| **6 · Móvil y a11y** | 2.5 mesa de atlas · 2.6 móvil · 2.7 mapa accesible · 2.8 búsqueda y rutas · 2.11 AVIF · 2.12 rendimiento | M/L | Claude + `director-animacion`; `critico-diseno` audita |
| **7 · Relatos** | 2.10 WebVTT, transcripción y 9:16 · 3.7 voces chilenas (tras D3) | M | `productor-audiovisual` |
| **8 · Piloto** | 1.15 piloto con cursos → recién entonces el nivel «Ambicioso» (3.x) | M | Dueño + profes |

**Por dónde empezar, según el moderador:** la fase 1 completa. Es poco esfuerzo, no requiere ninguna decisión tuya y arregla lo que hoy rompe la experiencia. Justo después, el ítem 1.9 (selk'nam), que es un error histórico visible.
