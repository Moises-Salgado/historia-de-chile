# Historia de Chile

Sitio educativo (niños / adultos / maestros): línea de tiempo + mapa histórico. Contenido en un vault de Obsidian.

## Contexto (leer en este orden, solo lo necesario)
1. `segundo-cerebro/Proyecto/Arquitectura.md` · cómo se construye
2. `segundo-cerebro/Proyecto/Guía de contenido.md` · formato de notas (incluye imágenes)
3. `segundo-cerebro/Proyecto/Sistema de diseño.md` · tokens y movimiento
4. `segundo-cerebro/Proyecto/Índice canónico.md` · nombres, fechas, coordenadas

## Reglas
- Contenido solo en `segundo-cerebro/`. Nunca editar ni leer `site/data/*.js` (generados, pesados).
- Tras cambiar notas: `npm run build`. Revisar "Enlaces sin nota" y los AVISO.
- Sin framework. Única dependencia: GSAP copiado en `site/js/vendor/` (sin CDN). Scripts clásicos en `site/js/` (deben funcionar en `file://`).
- Imágenes: solo Wikimedia Commons con licencia libre (dominio público, CC0, CC BY, CC BY-SA), verificadas con `node scripts/build-img.mjs --check "Archivo.jpg"`. Siempre con autor y licencia visibles. Nada de imágenes generadas por IA.
- Diseño: seguir `Sistema de diseño.md`. Movimiento con GSAP según skills `emil-design-eng` y `gsap-*`; reglas de `design-taste-frontend`; auditar con `impeccable`.
- Respuestas breves: usar skill `caveman` (ahorro de tokens).

## Comandos
- `npm run build` · vault → `site/data/historia.js`
- `npm run img` · descarga/verifica imágenes de Commons → `site/img/` + `scripts/imagenes.json` (créditos)
- `npm run video [id]` · videos-resumen por periodo con HyperFrames → `site/video/` (necesita FFmpeg; ver Arquitectura)
- `npm run geo` · regenera `site/data/mapa.js` (rara vez)
- `npm start` · servidor local en http://127.0.0.1:5173
