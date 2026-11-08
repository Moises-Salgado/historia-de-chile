"""Texturas fotográficas del teatro de Humberstone a partir de fotos libres de Wikimedia Commons.

Cada muro del teatro es un plano: con sus cuatro esquinas en la foto (en píxeles) y su tamaño real (en metros)
se calcula una homografía y la foto se «endereza» a una vista frontal. Después se igualan los colores entre fotos.
Lo que no sale en ninguna foto se modela aparte en scripts/3d/humberstone.py y se marca como aproximado.

Uso (Python con Pillow y numpy, fuera de Blender):  python -P scripts/3d/teatro_fotos.py
Salida: scripts/3d/cache/teatro/*.jpg y creditos.json (los lee humberstone.py).
"""
import json, os, re, sys, time, urllib.parse, urllib.request
import numpy as np
from PIL import Image

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CACHE = os.path.join(RAIZ, 'scripts', '3d', 'cache')
FOTOS = os.path.join(CACHE, 'commons')
SALIDA = os.path.join(CACHE, 'teatro')
UA = {'User-Agent': 'historia-de-chile/1.0 (https://github.com/Moises-Salgado/historia-de-chile; sitio educativo)'}
ANCHO = 3840          # las coordenadas de abajo están medidas en fotos de este ancho (o menos, si el original es menor)

FUENTES = {   # clave: (archivo en Commons, autor, licencia) — verificadas con  node scripts/build-img.mjs --check
    'frente': ('Oficinas salitreras de Humberstone y Santa Laura, Chile, 2016-02-11, DD 61.jpg', 'Diego Delso', 'CC BY-SA 4.0'),
    'sala': ('Oficinas salitreras de Humberstone y Santa Laura, Chile, 2016-02-11, DD 63-65 HDR.jpg', 'Diego Delso', 'CC BY-SA 4.0'),
    'sureste': ('Chile Teatro Humberstone 2.jpg', 'Pablo Trincado', 'CC BY 2.0'),
    'noroeste': ('Chile Teatro Humberstone 3.jpg', 'Pablo Trincado', 'CC BY 2.0'),
}


# Frente (foto de Diego Delso, frontal y con la perspectiva corregida): cada plano tiene su escala.
# Muro principal: 110 px/m, suelo en la fila 1830. Vestíbulo (unos 4 m más cerca): 130 px/m, base en 1910.
# El eje óptico cae en x = 0,4 m (coordenadas del modelo: el teatro va de x −15,5 a 15,5).
def frontal(s, v0, xc=0.4, uc=1920.0):
    return lambda x, z: (uc + (x - xc) * s, v0 - z * s)


M = frontal(110.0, 1830.0)
V = frontal(130.0, 1910.0)
A = frontal(125.5, 1890.0)      # cuerpo bajo del oriente: unos 3,4 m delante del muro principal

# nombre: (foto, esquinas [arriba-izq, arriba-der, abajo-der, abajo-izq] en px, ancho m, alto m, px por metro)
FACHADAS = {
    'frente': ('frente', [M(-15.5, 10.8), M(15.5, 10.8), M(15.5, 0), M(-15.5, 0)], 31.0, 10.8, 64),
    'vestibulo': ('frente', [V(-10.6, 6.3), V(17.4, 6.3), V(17.4, 0), V(-10.6, 0)], 28.0, 6.3, 72),
    'anexo': ('frente', [A(10.89, 4.6), A(15.7, 4.6), A(15.7, 0), A(10.89, 0)], 4.81, 4.6, 72),
    # poniente, desde la esquina noroeste: izquierda = norte (y 61), derecha = sur (y 44)
    'oeste': ('noroeste', [(965, 334), (2515, 548), (2515, 1647), (968, 1724)], 17.0, 10.7, 56),
    # fondo, muy oblicuo (poca resolución): izquierda = oriente, derecha = poniente
    'norte': ('noroeste', [(293, 832), (965, 334), (968, 1724), (293, 1675)], 31.0, 10.7, 28),
    # oriente, parte alta, desde la esquina sureste: izquierda = sur (y 44), derecha = norte (y 61)
    'este': ('sureste', [(1645, 335), (2605, 563), (2633, 1103), (1643, 1004)], 17.0, 5.35, 56),
    # oriente, cuerpo bajo (x 15,7; y 40,6 a 61)
    'este_bajo': ('sureste', [(1453, 987), (2752, 1116), (2752, 1605), (1453, 1614)], 20.4, 4.6, 56),
    # boca del escenario, de pilastra a pilastra y desde el piso del escenario hasta la cornisa (foto frontal)
    'escenario': ('sala', [(1473, 400), (2372, 400), (2372, 1065), (1473, 1065)], 8.54, 6.32, 105),
}


def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({**params, 'format': 'json'})
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def foto(clave):
    titulo = FUENTES[clave][0]
    ruta = os.path.join(FOTOS, re.sub(r'[^\w.-]+', '_', titulo))
    if not os.path.exists(ruta):
        os.makedirs(FOTOS, exist_ok=True)
        d = api(dict(action='query', titles='File:' + titulo, prop='imageinfo', iiprop='url|size', iiurlwidth=ANCHO))
        info = next(iter(d['query']['pages'].values()))['imageinfo'][0]
        url = (info.get('thumburl') or info['url']).split('?')[0]
        print('descargando', titulo)
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(ruta, 'wb') as f:
            f.write(r.read())
        time.sleep(2)
    im = Image.open(ruta).convert('RGB')
    return im


def homografia(src, dst):
    """Coeficientes que llevan un punto de la salida (dst) a la foto (src), como pide Image.transform."""
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return tuple(np.linalg.solve(np.array(A, float), np.array(b, float)))


def enderezar(im, esq, W, H, ppm):
    k = im.size[0] / min(ANCHO, im.size[0]) if im.size[0] > ANCHO else 1.0
    esq = [(x * k, y * k) for x, y in esq]
    w, h = int(round(W * ppm)), int(round(H * ppm))
    out = im.transform((w * 2, h * 2), Image.PERSPECTIVE, homografia(esq, [(0, 0), (w * 2, 0), (w * 2, h * 2), (0, h * 2)]),
                       resample=Image.BICUBIC)          # el doble y luego reducir: tablas sin dientes de sierra
    return out.resize((w, h), Image.LANCZOS)


def mascara_madera(a):
    """Píxeles de tablas: ni cielo azul, ni vanos negros, ni puertas verdes."""
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = a.mean(-1)
    return (lum > 50) & (lum < 230) & (b < r + 5) & (g < r + 25)


def igualar(img, ref_m, ref_s, fuerza=0.85):
    a = np.asarray(img).astype(np.float32)
    p = a[mascara_madera(a)]
    b = (a - p.mean(0)) / np.maximum(p.std(0), 1) * ref_s + ref_m
    return Image.fromarray(np.clip(a * (1 - fuerza) + b * fuerza, 0, 255).astype(np.uint8))


def main():
    os.makedirs(SALIDA, exist_ok=True)
    fotos = {k: foto(k) for k in FUENTES}
    out = {n: enderezar(fotos[f[0]], *f[1:]) for n, f in FACHADAS.items()}
    # colores: todas las fotos de afuera se llevan al tono de la foto del frente (muro alto, sin cielo ni vestíbulo)
    ref = np.asarray(out['frente']).astype(np.float32)
    H, W = ref.shape[:2]
    zona = np.zeros((H, W), bool); zona[int(H * 0.12):int(H * 0.55), :int(W * 0.85)] = True
    p = ref[zona & mascara_madera(ref)]
    for n in ('oeste', 'norte', 'este', 'este_bajo'):
        out[n] = igualar(out[n], p.mean(0), p.std(0))
    # escenario: el atril moderno del museo se tapa con el telón de al lado (mismo pliegue, 1,15 m a la derecha)
    esc = out['escenario']; ppm = FACHADAS['escenario'][4]
    caja = lambda x0, z0, x1, z1: (int(x0 * ppm), int((6.32 - z1) * ppm), int(x1 * ppm), int((6.32 - z0) * ppm))
    parche = esc.crop(caja(2.9, 0.0, 4.25, 1.45))
    borde = 10
    mascara = Image.new('L', parche.size, 0)
    mascara.paste(255, (borde, borde, parche.size[0] - borde, parche.size[1]))
    from PIL import ImageFilter
    esc.paste(parche, caja(1.75, 0.0, 3.1, 1.45)[:2], mascara.filter(ImageFilter.GaussianBlur(borde / 2)))
    for n, img in out.items():
        img.save(os.path.join(SALIDA, n + '.jpg'), quality=86, optimize=True)
        print(n, img.size)
    # tablas sueltas para las caras sin foto: muro alto del frente (x −15 a −9, z 7,7 a 9,2), en espejo para repetir
    fr = out['frente']; ppm = FACHADAS['frente'][4]
    t = fr.crop((int(0.5 * ppm), int(1.6 * ppm), int(6.5 * ppm), int(3.1 * ppm)))
    a = np.asarray(t)
    a = np.concatenate([a, a[::-1]], 0); a = np.concatenate([a, a[:, ::-1]], 1)
    Image.fromarray(a).save(os.path.join(SALIDA, 'tablas.jpg'), quality=86, optimize=True)
    # las mismas tablas en gris claro y con menos contraste: sirven de base para los muros pintados de la sala
    g = a.astype(np.float32).mean(-1)
    g = (g - g.mean()) / max(g.std(), 1) * 11 + 0.82 * 255
    Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).convert('RGB').save(os.path.join(SALIDA, 'tablas_gris.jpg'), quality=86, optimize=True)
    creditos = [dict(tipo='foto', nombre=FUENTES[k][0], autores=[FUENTES[k][1]], licencia=FUENTES[k][2],
                     url='https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(FUENTES[k][0].replace(' ', '_')))
                for k in FUENTES]
    json.dump(dict(tablas_m=[12.0, 3.0], creditos=creditos), open(os.path.join(SALIDA, 'creditos.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('listo:', SALIDA)


if __name__ == '__main__':
    main()
