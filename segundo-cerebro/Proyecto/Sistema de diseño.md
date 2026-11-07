---
tipo: proyecto
tags:
  - proyecto
---
# Sistema de diseño

**Dirección:** atlas editorial chileno. Papel cálido, tinta verde oscura, **cobre** como único acento (el metal de Chile). Sin violeta.

## Tipografía
- Títulos: **Newsreader** (serif editorial, cifras tabulares para años).
- Texto e interfaz: **Atkinson Hyperlegible Next** (diseñada para máxima legibilidad; ayuda a niños y a lectores con baja visión).
- Versión niños: un paso más grande (`--texto: 1.1875rem`).

## Color (tokens en `:root`)
`--paper #f5f1e8` · `--ink #1d2321` · `--accent #a8471f` · capas: `--z-chile` cobre, `--z-colonial` ocre, `--z-autonomo` verde bosque, `--z-extranjero` trama gris, `--z-inca` trama dorada. Modo oscuro con los mismos nombres.

## Movimiento (Emil Kowalski + GSAP)
- GSAP local con las mismas curvas registradas como `salida` (= `--ease-out cubic-bezier(.23,1,.32,1)`) y `cajon` (= `--ease-drawer cubic-bezier(.32,.72,0,1)`). `gsap.ticker.lagSmoothing(0)`: el tiempo de las animaciones es real.
- UI < 300 ms. Botones `scale(.97)` al presionar. Nunca desde `scale(0)`. Hover con movimiento solo con puntero fino.
- Cámara del mapa 650 ms (movimiento explicativo); con teclado, sin animación.
- Lámina del momento: la miniatura vuela a la imagen principal (~720 ms, salida), el texto entra escalonado (50 ms); cierre más rápido (200 ms). Los cambios de estado nunca dependen del final de una animación (temporizadores de respaldo).
- Cambio de periodo: lente 600 ms; hitos escalonados 35 ms; contador del año 600 ms (solo dentro de la misma era).
- Relato: sale 140 ms, entra 340 ms; tarjetas escalonadas 30 ms.
- `prefers-reduced-motion` o teclado: sin vuelos ni desplazamientos.

## Reglas (Taste + Impeccable)
- Cinematográfico con propósito (ver Decisiones.md): escenas al hacer scroll, fondos en movimiento y relatos sí; carruseles automáticos y efectos sin función, no.
- Un estilo de botón, un estilo de tarjeta, un radio por escala.
- Bordes izquierdo y derecho iguales (`.wrap`). Sin desborde horizontal a 390 px.
