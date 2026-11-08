"""Fuentes del paseo 3D del Castillo de Niebla (Valdivia), como se ve hoy.

Baja y prepara, fuera de Blender (Python con Pillow y numpy):
  1. La planta: edificios, murallas, costa, senderos y árboles de OpenStreetMap (ODbL) → planta.json en metros locales.
  2. El relieve real de la bahía de Corral: Terrain Tiles (Mapzen/AWS, SRTM de la NASA y otras fuentes abiertas)
     → relieve.npy, una grilla de 10 m que cubre ±6 km alrededor del fuerte.
  3. Texturas tomadas de fotos libres de Wikimedia Commons (verificadas con  node scripts/build-img.mjs --check).
Uso:  python -P scripts/3d/niebla_fuentes.py      Salida: scripts/3d/cache/niebla/ (no se publica; la lee niebla.py)
"""
import glob, json, math, os, re, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image, ImageFilter

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CACHE = os.path.join(RAIZ, 'scripts', '3d', 'cache')
SAL = os.path.join(CACHE, 'niebla')
FOTOS = os.path.join(CACHE, 'commons')
UA = {'User-Agent': 'historia-de-chile/1.0 (https://github.com/Moises-Salgado/historia-de-chile; sitio educativo)'}
LAT0, LON0 = -39.8697, -73.4022          # centro del fuerte (OSM)
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110540
R_RELIEVE, PASO = 6000, 10.0


def local(lat, lon):
    return ((lon - LON0) * KX, (lat - LAT0) * KY)


def bajar(url, destino, datos=None):
    if os.path.exists(destino):
        return destino
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    req = urllib.request.Request(url, data=datos, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, open(destino, 'wb') as f:
        f.write(r.read())
    time.sleep(1.0)
    return destino


# ---------------------------------------------------------------- 1. planta (OpenStreetMap)
def planta():
    q = '[out:json][timeout:60];(way(around:420,%f,%f);node(around:420,%f,%f)[~"."~"."];);out geom tags;' % (LAT0, LON0, LAT0, LON0)
    ruta = bajar('https://overpass-api.de/api/interpreter', os.path.join(SAL, 'osm.json'),
                 ('data=' + urllib.parse.quote(q)).encode())
    d = json.load(open(ruta, encoding='utf-8'))
    out = dict(costa=[], castillo=None, bateria=None, murallas=[], acantilado=[], edificios=[], senderos=[], arboles=[], puntos=[], estacionamiento=None)
    for e in d['elements']:
        t = e.get('tags', {})
        if e['type'] == 'way' and 'geometry' in e:
            pts = [[round(v, 2) for v in local(p['lat'], p['lon'])] for p in e['geometry']]
            if t.get('natural') == 'coastline':
                out['costa'].append(pts)
            elif t.get('historic') == 'castle' and t.get('barrier') == 'retaining_wall':
                out['murallas'].append(pts)
            elif t.get('historic') == 'castle':
                out['castillo'] = pts
            elif t.get('historic') == 'ruins' and 'Cañones' in t.get('name', ''):
                out['bateria'] = pts                      # «Zona de Cañones y Horno»
            elif t.get('natural') == 'cliff':
                out['acantilado'].append(pts)
            elif 'building' in t:
                out['edificios'].append(dict(nombre=t.get('name', ''), tipo=t.get('building'), pisos=t.get('building:levels'), pts=pts))
            elif t.get('highway') in ('footway', 'path', 'steps', 'pedestrian'):
                out['senderos'].append(pts)
            elif t.get('amenity') == 'parking':
                out['estacionamiento'] = pts
        elif e['type'] == 'node' and t:
            p = [round(v, 2) for v in local(e['lat'], e['lon'])]
            if t.get('natural') == 'tree':
                out['arboles'].append(p)
            elif t.get('man_made') == 'lighthouse' or t.get('historic') or t.get('tourism') in ('viewpoint', 'information'):
                out['puntos'].append(dict(nombre=t.get('name', t.get('man_made', t.get('tourism', ''))), tipo=t.get('historic') or t.get('man_made') or t.get('tourism'), p=p))
    json.dump(out, open(os.path.join(SAL, 'planta.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('planta:', {k: (len(v) if isinstance(v, list) else bool(v)) for k, v in out.items()})


# ---------------------------------------------------------------- 2. relieve (Terrain Tiles, zoom 13 ≈ 15 m)
def relieve(z=13):
    n = 2 ** z
    def tile(lat, lon):
        la = math.radians(lat)
        return (int((lon + 180) / 360 * n), int((1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n))
    lat_min, lat_max = LAT0 - R_RELIEVE / KY * 1.05, LAT0 + R_RELIEVE / KY * 1.05
    lon_min, lon_max = LON0 - R_RELIEVE / KX * 1.05, LON0 + R_RELIEVE / KX * 1.05
    (x0, y0), (x1, y1) = tile(lat_max, lon_min), tile(lat_min, lon_max)
    A = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            f = bajar('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/%d/%d/%d.png' % (z, x, y),
                      os.path.join(SAL, 'dem', '%d_%d_%d.png' % (z, x, y)))
            a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
            A[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    t = np.arange(-R_RELIEVE, R_RELIEVE + PASO / 2, PASO)
    X, Y = np.meshgrid(t, t)                       # fila j = y creciente (norte), columna i = x (oriente)
    lat, lon = LAT0 + Y / KY, LON0 + X / KX
    px = ((lon + 180) / 360 * n - x0) * 256 - 0.5
    la = np.radians(lat)
    py = ((1 - np.log(np.tan(la) + 1 / np.cos(la)) / np.pi) / 2 * n - y0) * 256 - 0.5
    i0 = np.clip(np.floor(px).astype(int), 0, A.shape[1] - 2); j0 = np.clip(np.floor(py).astype(int), 0, A.shape[0] - 2)
    fx, fy = np.clip(px - i0, 0, 1), np.clip(py - j0, 0, 1)
    H = (A[j0, i0] * (1 - fx) * (1 - fy) + A[j0, i0 + 1] * fx * (1 - fy) + A[j0 + 1, i0] * (1 - fx) * fy + A[j0 + 1, i0 + 1] * fx * fy)
    np.save(os.path.join(SAL, 'relieve.npy'), H.astype(np.float32))
    json.dump(dict(r=R_RELIEVE, paso=PASO, n=len(t)), open(os.path.join(SAL, 'relieve.json'), 'w'))
    print('relieve:', H.shape, 'min %.1f max %.1f' % (H.min(), H.max()))


# ---------------------------------------------------------------- 3. texturas desde fotos de Commons
FUENTES = {   # clave: (archivo, autor, licencia)
    'bateria': ('Fuerte de Niebla.JPG', 'CristianDiaz', 'CC BY-SA 3.0'),
    'casa': ('Fuerte niebla valdivia 2024 20.jpg', 'Charlie danvers', 'CC BY-SA 4.0'),
    'muro': ('Castillo de Niebla, muro de mampostería.JPG', 'AlBustos', 'CC BY-SA 3.0'),
    'roca': ('Fuerte niebla valdivia 2024 31.jpg', 'Charlie danvers', 'CC BY-SA 4.0'),
    'pasto': ('Fuerte niebla valdivia 2024 22.jpg', 'Charlie danvers', 'CC BY-SA 4.0'),
}


def foto(clave, ancho=2400):
    titulo = FUENTES[clave][0]
    ruta = os.path.join(FOTOS, re.sub(r'[^\w.-]+', '_', titulo))
    if not os.path.exists(ruta):
        u = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(dict(
            action='query', format='json', prop='imageinfo', iiprop='url', iiurlwidth=ancho, titles='File:' + titulo))
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
            info = next(iter(json.load(r)['query']['pages'].values()))['imageinfo'][0]
        bajar((info.get('thumburl') or info['url']).split('?')[0], ruta)
    return Image.open(ruta).convert('RGB')


def homografia(src, dst):
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return tuple(np.linalg.solve(np.array(A, float), np.array(b, float)))


def cuadrilatero(im, esq, w, h):
    """esq en fracciones del ancho y alto de la foto: arriba-izq, arriba-der, abajo-der, abajo-izq."""
    W, H = im.size
    src = [(x * W, y * H) for x, y in esq]
    return im.transform((w, h), Image.PERSPECTIVE, homografia(src, [(0, 0), (w, 0), (w, h), (0, h)]), resample=Image.BICUBIC)


def repetible(im, borde=0.18):
    """Hace que la imagen se repita sin costura: mezcla cada borde con el opuesto (fundido en una franja)."""
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    for eje, n in ((1, w), (0, h)):
        k = int(n * borde)
        r = np.linspace(0, 1, k)[None, :, None] if eje == 1 else np.linspace(0, 1, k)[:, None, None]
        if eje == 1:
            a[:, :k] = a[:, :k] * r + a[:, n - k:] * (1 - r)
            a = a[:, :n - k]
        else:
            a[:k] = a[:k] * r + a[n - k:] * (1 - r)
            a = a[:n - k]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def nivelar(im, brillo=None):
    """Quita el degradé de luz de la foto (divide por una versión muy desenfocada) y deja el brillo medio pedido."""
    a = np.asarray(im).astype(np.float32)
    bajo = np.asarray(im.filter(ImageFilter.GaussianBlur(max(im.size) / 6))).astype(np.float32)
    m = a.reshape(-1, 3).mean(0)
    a = a / np.maximum(bajo, 1) * m
    if brillo is not None:
        a = a * (brillo / max(a.mean(), 1))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def texturas():
    t = {}
    b = foto('bateria')
    # piso de roca de la batería (de una zona de la foto con poco escorzo)
    t['piso_roca'] = (repetible(nivelar(cuadrilatero(b, [(0.56, 0.72), (0.98, 0.72), (0.99, 0.99), (0.55, 0.99)], 1024, 1024))), (3.0, 3.0))
    c = foto('casa')
    t['casa_muro'] = (repetible(nivelar(cuadrilatero(c, [(0.690, 0.360), (0.990, 0.395), (0.990, 0.690), (0.690, 0.700)], 1024, 512))), (5.0, 2.5))
    # tejuelas del techo: un trozo del faldón largo, enderezado siguiendo las hiladas
    t['tejuela'] = (repetible(nivelar(cuadrilatero(c, [(0.3900, 0.2740), (0.5249, 0.1754), (0.5249, 0.3860), (0.3900, 0.4047)], 1024, 720))), (5.0, 3.5))
    m = foto('muro')
    t['mamposteria'] = (repetible(nivelar(cuadrilatero(m, [(0.47, 0.135), (0.995, 0.205), (0.995, 0.975), (0.47, 0.84)], 1280, 900))), (5.0, 3.5))
    r = foto('roca')
    # roca cancagua tallada (paredes del acantilado y bloques de la batería), sin la pasarela de la foto
    t['roca'] = (repetible(nivelar(cuadrilatero(r, [(0.08, 0.33), (0.72, 0.33), (0.72, 0.50), (0.08, 0.50)], 1600, 420))), (12.0, 2.5))
    # pasto del foso (foto casi a ras de suelo): se usa en gris, como detalle; el color lo dan los colores del relieve
    pa = foto('pasto')
    g = repetible(nivelar(cuadrilatero(pa, [(0.25, 0.78), (0.75, 0.78), (0.80, 0.97), (0.20, 0.97)], 1024, 512)))
    a = np.asarray(g).astype(np.float32).mean(-1)
    a = (a - a.mean()) / max(a.std(), 1) * 22 + 0.85 * 255
    t['pasto_gris'] = (Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert('RGB'), (2.4, 1.2))
    meta = {}
    for k, (im, tam) in t.items():
        im.save(os.path.join(SAL, k + '.jpg'), quality=86, optimize=True)
        meta[k] = dict(tam=tam, px=im.size)
        print('textura', k, im.size, tam)
    creditos = [dict(tipo='foto', nombre=v[0], autores=[v[1]], licencia=v[2],
                     url='https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(v[0].replace(' ', '_'))) for v in FUENTES.values()]
    json.dump(dict(texturas=meta, creditos=creditos), open(os.path.join(SAL, 'texturas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    import sys
    os.makedirs(SAL, exist_ok=True)
    pasos = sys.argv[1:] or ['planta', 'relieve', 'texturas']
    for p in pasos:
        globals()[p]()
