---
tipo: recorrido
modo: propio
titulo: "La Silla: observatorio y petroglifos"
region: "Coquimbo"
lat: -29.2575
lon: -70.7375
evento: "[[Astronomía en el norte de Chile]]"
institucion: "Fotos 360° de ESO en Wikimedia Commons"
descripcion: "El observatorio que ESO inauguró en 1969 en la región de Coquimbo y, a sus pies, rocas con petroglifos prehispánicos."
orden: 1
escenas:
  - "Drone captures La Silla Observatory (lasilla-dronepano2019-CC2).jpg | Vista aérea al anochecer | 20 | -15"
  - "Moonlit panorama at La Silla (potw1014a-ext).jpg | Cúpulas a la luz de la luna | 5 | 0 | -68"
  - "360° view of La Silla Observatory (2017 11 16 La Silla FD 12mm MW-eq-CC).jpg | La Vía Láctea sobre las cúpulas | 0 | 2 | -50"
  - "Petroglyphs and the galaxy (uhd-img-8535pv2-cc-eq-extended).jpg | Petroglifos bajo la Vía Láctea | -30 | -6 | -40"
enlaces:
  - "Drone captures La Silla Observatory (lasilla-dronepano2019-CC2).jpg > Moonlit panorama at La Silla (potw1014a-ext).jpg | 45 | -18"
  - "Moonlit panorama at La Silla (potw1014a-ext).jpg > Drone captures La Silla Observatory (lasilla-dronepano2019-CC2).jpg | -20 | 55"
  - "Moonlit panorama at La Silla (potw1014a-ext).jpg > 360° view of La Silla Observatory (2017 11 16 La Silla FD 12mm MW-eq-CC).jpg | 37 | -6"
  - "360° view of La Silla Observatory (2017 11 16 La Silla FD 12mm MW-eq-CC).jpg > Moonlit panorama at La Silla (potw1014a-ext).jpg | -150 | -4"
  - "360° view of La Silla Observatory (2017 11 16 La Silla FD 12mm MW-eq-CC).jpg > Petroglyphs and the galaxy (uhd-img-8535pv2-cc-eq-extended).jpg | 10 | -11"
  - "Petroglyphs and the galaxy (uhd-img-8535pv2-cc-eq-extended).jpg > 360° view of La Silla Observatory (2017 11 16 La Silla FD 12mm MW-eq-CC).jpg | 70 | 6"
tags:
  - recorrido
---
# La Silla: observatorio y petroglifos

Recorrido 360° propio, armado con panorámicas libres (CC BY 4.0) de ESO publicadas en Wikimedia Commons. Se convierte con `npm run 360`.

Empieza en el aire, sobre el cerro, al anochecer; baja a las cúpulas con luz de luna, espera la noche bajo la Vía Láctea y termina junto a las rocas con petroglifos. El observatorio se inauguró el 25 de marzo de 1969 (ver [[Astronomía en el norte de Chile]]). ESO no identifica qué pueblo grabó los petroglifos: por eso solo se dicen prehispánicos.

## Formato
- `escenas`: «Archivo | Título | yaw inicial | pitch inicial | piso». El yaw 0 es el centro de la panorámica y crece hacia la derecha; el pitch crece hacia arriba. `piso` es la latitud donde termina la foto (las panorámicas «extended» de ESO vienen rellenas de negro abajo).
- `enlaces`: «Archivo origen > Archivo destino | yaw | pitch»: dónde aparece la flecha en la escena de origen. Posiciones estimadas a ojo sobre la panorámica.
