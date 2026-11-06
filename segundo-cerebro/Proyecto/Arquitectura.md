---
tipo: proyecto
tags:
  - proyecto
---
# Arquitectura

```
segundo-cerebro/  ──npm run build──▶  site/data/historia.js
notas (imagen:)   ──npm run img────▶  site/img/ + scripts/imagenes.json (licencias, autores)
historia + img    ──npm run video──▶  video/<periodo>/ (HyperFrames) ──▶ site/video/<periodo>.mp4
geoBoundaries     ──npm run geo────▶  site/data/mapa.js
                                        site/index.html (sin servidor)
```

- **Sin framework.** `site/index.html` funciona con doble clic. Scripts clásicos (no módulos) para que funcione en `file://`.
- **Única dependencia:** GSAP 3.15 (core + CustomEase) copiado en `site/js/vendor/`, licencia estándar gratuita de GreenSock.
- **Datos generados:** `site/data/*.js` asignan `window.HISTORIA` y `window.MAPA`. No se editan a mano.
- **`build-data.mjs`:** lee el frontmatter, separa `## Para niños / adultos / maestros`, convierte wikilinks en enlaces, une imágenes (`img`) y videos (`video`), construye el grafo y avisa de enlaces rotos.
- **`build-img.mjs`:** lee `imagen:` de las notas, consulta Commons por lotes, rechaza toda licencia no libre y descarga dos tamaños (960/500 px y miniatura 330 px). Guarda autor, licencia y fuente en `scripts/imagenes.json`. `--check "Archivo.jpg"` solo verifica.
- **`build-video.mjs`:** genera un proyecto HyperFrames por periodo (portada, recorrido de momentos con el mapa, cierre con créditos) y lo renderiza a MP4 1280×720 sin audio. Requiere FFmpeg en el PATH o en `HYPERFRAMES_FFMPEG_PATH` y `HYPERFRAMES_FFPROBE_PATH`. Después: `npm run build`.
- **`build-geo.mjs`:** descarga límites de geoBoundaries (CC BY), recorta, proyecta (equirectangular, 100 u = 1° lat) y simplifica. Se corre una sola vez.

## Mapa
- Capas históricas = notas de `Territorios/`: una franja recortada con `clipPath` al contorno de Chile o Argentina, con `fases` `desde|hasta|estilo|etiqueta`.
- Las 16 regiones son clicables: cada momento se asigna a su región actual (punto en polígono; islas → Valparaíso, Antártica → Magallanes). Al hacer clic, el relato muestra los momentos de esa región (`#region/<nombre>`).

## Línea de tiempo
- Eje general con escala variable: logarítmica en «años antes de hoy» hasta 1450 y lineal por tramos después (los siglos recientes más amplios). Cabezal arrastrable (rol `slider`), bandas por periodo y un punto por momento.
- Lente que une la banda activa con el detalle del periodo: hitos con miniatura, repartidos en hasta tres carriles para no chocar.

## Lámina del momento
- `<dialog>` modal. Al abrir, la miniatura de origen (hito, tarjeta o punto del mapa) vuela y se convierte en la imagen principal (GSAP). Con teclado no se anima. Incluye localizador del mapa, personajes con retrato, anterior/siguiente e impresión.

## Archivos web
| Archivo | Rol |
|---|---|
| `site/js/mapa.js` | SVG, cámara, capas, regiones clicables, pines, islas, localizador |
| `site/js/crono.js` | línea de tiempo: eje, cabezal, lente, detalle |
| `site/js/app.js` | estado, relato (periodo/región), lámina, versiones, ficha, créditos, rutas `#evento/…` |
| `site/css/estilos.css` | tokens, claro/oscuro, movimiento, responsive, impresión |
