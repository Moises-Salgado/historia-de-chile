---
description: Debate entre abogado-del-diablo y visionario sobre el sitio; guarda toda la conversación en segundo-cerebro/Debates/
argument-hint: "[tema opcional, p. ej. «el mapa» o «para maestros»]"
---
Organiza un debate sobre el sitio Historia de Chile. Tema: $ARGUMENTS. Si no se indica tema, es la app completa.

1. Crea `segundo-cerebro/Debates/<AAAA-MM-DD> <Tema>.md` con:
   - Frontmatter: `tipo: debate`, `fecha`, `tema`, `participantes: [abogado-del-diablo, visionario]`, `estado: en curso`.
   - Un párrafo de contexto.
   - Un enlace al debate anterior, si existe.
2. Confirma que el sitio responde en http://127.0.0.1:5173. Si no, levántalo con `npm start`.
3. Las rondas van **una tras otra, nunca en paralelo**, porque Playwright es compartido:
   - Ronda 1: `abogado-del-diablo`, ataque completo.
   - Ronda 2: `visionario`, respuesta a cada hallazgo más ideas nuevas.
   - Ronda 3: `abogado-del-diablo`, réplica (continúa el mismo agente con SendMessage).
   - Ronda 4: `visionario`, contrarréplica y plan final (continúa con SendMessage).
4. Cuando termine la ronda 4, actúa como moderador y añade al final del archivo un **Acta** con:
   - Los acuerdos.
   - Los desacuerdos que decide el dueño.
   - Una tabla de hoja de ruta: prioridad · mejora · esfuerzo · impacto · quién la ejecuta (`director-animacion`, `historiador`, `productor-audiovisual` o Claude).
   - Las decisiones que se reabren.
5. Cambia `estado: cerrado`. Resume el acta al usuario en pocas líneas. No implementes nada sin que el usuario lo apruebe.
