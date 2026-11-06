---
tipo: proyecto
tags:
  - proyecto
---
# Guía de contenido

Reglas para escribir notas de este vault. La web se genera desde estas notas con `node scripts/build-data.mjs`, así que el **formato es estricto**.

## Carpetas

| Carpeta | `tipo` | Qué contiene |
|---|---|---|
| `Periodos/` | periodo | 11 grandes etapas |
| `Eventos/` | evento | Hechos con fecha y lugar en el mapa |
| `Personajes/` | personaje | Personas |
| `Lugares/` | lugar | Ciudades, ríos, territorios |
| `Pueblos/` | pueblo | Pueblos originarios y culturas |
| `Territorios/` | territorio | Capas históricas del mapa (no editar sin revisar `scripts/`) |

El nombre del archivo **es** el nombre canónico. Los enlaces usan ese nombre exacto: `[[Pedro de Valdivia]]` o con alias `[[Pedro de Valdivia|Valdivia]]`.

## Frontmatter

YAML simple: una clave por línea, listas en bloque con `  - "[[...]]"`. Wikilinks en frontmatter siempre entre comillas. Sin listas en línea, sin objetos anidados. Fechas a.C. como `anio` negativo.

**Imagen (opcional, en periodos, eventos, personajes, lugares y pueblos):** dos últimas líneas del frontmatter:
```yaml
imagen: "Nombre exacto del archivo en Wikimedia Commons.jpg"
imagen_pie: "Qué muestra, autor y año (máx. 140 caracteres). Si es una recreación posterior, decirlo."
```
Solo licencias libres (dominio público, CC0, CC BY, CC BY-SA), verificadas con `node scripts/build-img.mjs --check "Archivo.jpg"`. La imagen debe mostrar el tema real (o el pie dice qué muestra en su lugar). Nada generado por IA, sin violencia gráfica, imágenes de pueblos originarios siempre respetuosas. Luego `npm run img` y `npm run build`.

### Evento

```markdown
---
tipo: evento
titulo: Fundación de Santiago
fecha: 12 de febrero de 1541
anio: 1541
periodo: "[[Descubrimiento y Conquista]]"
lat: -33.44
lon: -70.65
lugar: "[[Santiago]]"
personajes:
  - "[[Pedro de Valdivia]]"
  - "[[Inés de Suárez]]"
nivel: 5° básico
tags:
  - evento
---
# Fundación de Santiago

## Para niños
Texto simple...

> [!tip] ¿Sabías que?
> Un dato curioso y verdadero.

## Para adultos
Texto con contexto...

## Para maestros
**Nivel sugerido:** 5° básico
**Objetivo:** Explicar...
**Preguntas para la clase:**
- ¿...?
- ¿...?
**Actividad (20–30 min):** ...
**Fuentes sugeridas:** Memoria Chilena; Museo Histórico Nacional.
```

Si el evento ocurrió fuera del mapa de Chile, omitir `lat` y `lon`. Si no hay personajes, omitir `personajes`.

### Personaje

```markdown
---
tipo: personaje
nombre: Pedro de Valdivia
vida: 1497–1553
rol: Conquistador español, fundador de Santiago
periodo: "[[Descubrimiento y Conquista]]"
tags:
  - personaje
---
# Pedro de Valdivia
Biografía breve para adultos (40–80 palabras).

> [!note] Para niños
> Una o dos frases simples.

## Conexiones
- [[Fundación de Santiago]]
```

### Lugar

```markdown
---
tipo: lugar
nombre: Santiago
lat: -33.44
lon: -70.65
region: Región Metropolitana
tags:
  - lugar
---
# Santiago
Descripción histórica breve (30–70 palabras).

> [!note] Para niños
> Una frase simple.

## Conexiones
- [[Fundación de Santiago]]
```

### Pueblo

Igual que Lugar pero `tipo: pueblo`, sin `lat`/`lon`, con `zona: Texto corto de dónde vivían` y `reconocido: si` o `reconocido: no` (reconocimiento legal en Chile: Ley 19.253 y leyes posteriores para changos y selk'nam).

### Periodo

```markdown
---
tipo: periodo
titulo: Descubrimiento y Conquista
orden: 2
inicio: 1520
fin: 1598
rango: 1520–1598
tags:
  - periodo
---
# Descubrimiento y Conquista

## Para niños
(60–90 palabras)

## Para adultos
(150–220 palabras)

## Para maestros
**Nivel sugerido:** ...
**Ideas clave:**
- ...
**Habilidad a trabajar:** ...

## Eventos
- [[Evento 1]]
- [[Evento 2]]
```

## Estilo por audiencia

- **Niños (8–12 años):** frases cortas, palabras simples, tono cálido. 50–90 palabras. Sin violencia explícita: se dice qué pasó con respeto. Cierra con un callout `> [!tip] ¿Sabías que?` con un dato verdadero.
- **Adultos:** 120–200 palabras. Contexto, causas, consecuencias, fechas y nombres precisos. Neutral. Menciona debates historiográficos cuando existan.
- **Maestros:** formato fijo (ver plantilla). Alineado a las Bases Curriculares de Historia, Geografía y Ciencias Sociales del Mineduc. No inventar códigos de OA. Niveles de referencia: 2° básico pueblos originarios; 4° básico incas; 5° básico descubrimiento, conquista y colonia; 6° básico independencia, república y democracia; 1° medio siglo XIX; 2° medio siglo XX y dictadura.

## Rigor

- Solo hechos con consenso historiográfico. Fechas inciertas con "c." (circa) y se explica en Maestros.
- Cifras solo si son de fuentes oficiales o de consenso (p. ej. Informe Rettig, Informe Valech). Ante duda, sin cifra.
- No inventar citas textuales ni URLs. Fuentes como nombres de instituciones: Memoria Chilena, Biblioteca Nacional Digital, Museo Histórico Nacional, Museo Chileno de Arte Precolombino, Museo de la Memoria y los Derechos Humanos, Biblioteca del Congreso Nacional (BCN).
- Temas sensibles (conquista, Ocupación de la Araucanía, dictadura): se nombran los hechos con claridad y se muestran las distintas miradas. "Ocupación de la Araucanía" es el término actual; el Estado de la época la llamó "Pacificación".
- Español de Chile, ortografía correcta, sin emojis.

## Enlaces

Cada nota enlaza la **primera mención** de personajes, lugares, pueblos, periodos y otros eventos con su nombre canónico. Solo enlazar nombres de la lista canónica de [[Índice canónico]]. Esto crea el grafo del segundo cerebro.
