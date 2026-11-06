---
tipo: proyecto
tags:
  - proyecto
---
# Skills y herramientas

Instaladas en `.claude/skills/` del proyecto (registro en `skills-lock.json`).

| Herramienta | Origen | Para qué |
|---|---|---|
| Obsidian + `obsidian-markdown` | kepano/obsidian-skills | Vault como contexto y fuente de contenido; formato de notas |
| `emil-design-eng`, `animate`, `review-animations` | emilkowalski/skills | Curvas, duraciones y revisión de animaciones |
| `design-taste-frontend` | Leonxlnx/taste-skill | Reglas anti-plantilla: un sistema, bordes parejos, sin scroll-reveal |
| `impeccable` (plugin) | pbakaus/impeccable | Auditoría y pulido de diseño, accesibilidad y responsive |
| `caveman`, `caveman-compress` | JuliusBrussee/caveman | Respuestas breves para ahorrar tokens; comprimir memoria |
| `gsap-core`, `gsap-timeline`, `gsap-plugins` | greensock/gsap-skills | API oficial de GSAP: línea de tiempo, lámina, contador |
| `hyperframes`, `hyperframes-cli` | heygen-com/hyperframes | Videos-resumen por periodo (HTML → MP4) |

## Ahorro de tokens
- `CLAUDE.md` corto que apunta a estas notas en vez de repetir el código.
- Claude lee notas de `Proyecto/` antes que archivos fuente; nunca lee `site/data/*.js` (generados y pesados).
- Solo las skills necesarias: se quitaron 20 skills extra de Caveman y 14 de Emil.
- El contenido se escribe una vez en Markdown; la web se genera con un script sin dependencias.
