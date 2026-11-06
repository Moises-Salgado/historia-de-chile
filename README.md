# Historia de Chile

La historia completa de Chile en una línea de tiempo y un mapa que cambia con los años. Tiene tres versiones: **niños**, **adultos** y **maestros**.

## Ver la página
Abre `site/index.html` con doble clic. No necesita instalación ni servidor.

Para un servidor local: `npm start` y luego abre http://127.0.0.1:5173

## Editar el contenido (segundo cerebro)
1. Abre la carpeta `segundo-cerebro/` como vault en Obsidian.
2. Edita o crea notas siguiendo `Proyecto/Guía de contenido.md`. Las plantillas están en `Plantillas/`.
3. Ejecuta `npm run build`. La página toma los cambios.

En Obsidian, `Ctrl + G` abre el grafo. Los colores indican el tipo de nota: periodos en cobre, eventos en azul, personajes en verde, lugares en ocre, pueblos en terracota y capas del mapa en gris.

## Imágenes
Cada nota puede tener `imagen:` (archivo de Wikimedia Commons) e `imagen_pie:`. Solo se aceptan licencias libres.
1. Verifica: `node scripts/build-img.mjs --check "Archivo.jpg"` (debe decir OK).
2. Descarga: `npm run img` (guarda autor, licencia y fuente en `scripts/imagenes.json`).
3. `npm run build`.

## Videos
`npm run video` genera un video-resumen por periodo con [HyperFrames](https://github.com/heygen-com/hyperframes) en `site/video/`. Necesita FFmpeg en el PATH (o en `HYPERFRAMES_FFMPEG_PATH` y `HYPERFRAMES_FFPROBE_PATH`). Luego `npm run build`. Para uno solo: `npm run video -- independencia`.

## Créditos
- Límites geográficos: [geoBoundaries](https://www.geoboundaries.org) (BCN, OCHA ROLAC), CC BY 3.0 IGO. Las capas históricas del mapa son aproximadas.
- Imágenes: Wikimedia Commons, dominio público, CC0, CC BY o CC BY-SA. El autor y la licencia de cada una aparecen junto a la imagen y en «Créditos de imágenes», al pie del sitio.
- Animación: [GSAP](https://gsap.com) (licencia estándar gratuita de GreenSock), incluido en `site/js/vendor/`.
