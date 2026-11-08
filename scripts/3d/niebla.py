"""
Castillo de Niebla (Valdivia) como se ve hoy · paseo 3D con relieve real y texturas de fotos libres.

Genera site/3d/niebla.glb. Antes hay que correr (fuera de Blender):  python -P scripts/3d/niebla_fuentes.py
Usa las funciones de humberstone.py (geometría, materiales, exportación) como biblioteca.
Ejes: x = oriente, y = norte verdadero, z = arriba; origen en el centro del fuerte (OSM: -39,8697, -73,4022).
En three.js: x = x, y = z, z = -y.

Qué es dato y qué es aproximado (más detalle en segundo-cerebro/Mundos/Castillo de Niebla.md):
- Relieve de la bahía: Terrain Tiles (SRTM, ~30 m); cerca del fuerte se afila el acantilado siguiendo la costa de OSM.
- Planta: OpenStreetMap (casa del castellano, polvorín, murallas, costa, senderos, árboles, casas del pueblo).
- Texturas: fotos de Wikimedia Commons (roca cancagua, mampostería, muros y tejuelas de la casa, piso de la batería).
- Alturas de muros, techo, foso y terraza de la batería: estimadas a partir de las fotos.
"""
import bpy, bmesh, math, json, os, sys, random
import numpy as np
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import humberstone as H
from humberstone import B, caja, cara, colision, cilindro, tubo, techo4, tarjetas, arbol, plano, losa

N = os.path.join(H.CACHE, 'niebla')
NOTA = os.path.join(H.RAIZ, 'segundo-cerebro', 'Mundos', 'Castillo de Niebla.md')
LAT, LON = -39.8697, -73.4022
random.seed(1671)


def leer(nombre):
    with open(os.path.join(N, nombre), encoding='utf-8') as f:
        return json.load(f)


for f in ('planta.json', 'relieve.npy', 'texturas.json'):
    if not os.path.exists(os.path.join(N, f)):
        raise SystemExit('Falta %s: correr primero  python -P scripts/3d/niebla_fuentes.py' % f)
PL = leer('planta.json')
REL = np.load(os.path.join(N, 'relieve.npy'))
RM = leer('relieve.json')
TX = leer('texturas.json')

# ---------------------------------------------------------------- texturas y materiales propios
# brillo medio al que se llevan las fotos: alto, para que el color del material (siempre menor) pueda teñirlas
H.NIVEL.update({'pasto_n': 0.85, 'roca_n': 0.8, 'mamposteria': 0.8, 'casa_muro': 0.8, 'tejuela': 0.8, 'piso_roca': 0.8})
FOTO_TEX = {'roca_n': 'roca', 'mamposteria': 'mamposteria', 'casa_muro': 'casa_muro', 'tejuela': 'tejuela', 'piso_roca': 'piso_roca',
            'pasto_n': 'pasto_gris'}

H.MATS.update({
    'suelo_n': dict(tex='pasto_n', color=(1.0, 1.0, 1.0), rough=0.96),
    'roca_cancagua': dict(tex='roca_n', color=(0.66, 0.56, 0.46), rough=0.95),
    'merlon': dict(tex='roca_n', color=(0.62, 0.53, 0.44), rough=0.95),
    'mamposteria_n': dict(tex='mamposteria', color=(0.52, 0.50, 0.47), rough=0.92),
    'muro_casa': dict(tex='casa_muro', color=(0.50, 0.47, 0.43), rough=0.92),
    'tejuela_n': dict(tex='tejuela', color=(0.40, 0.40, 0.40), rough=0.85, doble=True),
    'piso_bateria': dict(tex='piso_roca', color=(0.64, 0.54, 0.43), rough=0.97),
    'sendero': dict(tex='pampa', color=(0.70, 0.67, 0.62), rough=0.95),
    'hierro_oxidado': dict(tex=None, color=(0.40, 0.21, 0.12), rough=0.75, metal=0.35),
    'cureña': dict(tex=None, color=(0.07, 0.07, 0.07), rough=0.55, metal=0.2),
    'faro_blanco': dict(tex=None, color=(0.93, 0.93, 0.91), rough=0.6),
    'faro_rojo': dict(tex=None, color=(0.70, 0.08, 0.07), rough=0.55),
    'madera_vieja': dict(tex='tablas', color=(0.42, 0.33, 0.25), rough=0.85, rot=True),
    'casa_pueblo': dict(tex='tablas', color=(0.86, 0.84, 0.78), rough=0.85, rot=True),
    'roca_mar': dict(tex='roca_n', color=(0.38, 0.36, 0.34), rough=0.9),
})
H.VCOL.update({'suelo_n', 'casa_pueblo'})
H.SOLO_RECIBE.update({'suelo_n', 'sendero', 'piso_bateria'})


# ---------------------------------------------------------------- relieve
def dem(x, y):
    r, p = RM['r'], RM['paso']
    i, j = (np.asarray(x, float) + r) / p, (np.asarray(y, float) + r) / p
    i0 = np.clip(np.floor(i).astype(int), 0, REL.shape[1] - 2); j0 = np.clip(np.floor(j).astype(int), 0, REL.shape[0] - 2)
    fx, fy = np.clip(i - i0, 0, 1), np.clip(j - j0, 0, 1)
    return (REL[j0, i0] * (1 - fx) * (1 - fy) + REL[j0, i0 + 1] * fx * (1 - fy) + REL[j0 + 1, i0] * (1 - fx) * fy + REL[j0 + 1, i0 + 1] * fx * fy)


SEG = np.array([[a[0], a[1], b[0], b[1]] for c in PL['costa'] for a, b in zip(c, c[1:])], float)


def costa(x, y):
    """Distancia con signo a la costa de OSM (positiva en tierra: OSM deja la tierra a la izquierda) y la normal
    hacia tierra del punto más cercano."""
    x, y = np.asarray(x, float).ravel(), np.asarray(y, float).ravel()
    d = np.full(x.shape, 1e9); nx = np.zeros_like(x); ny = np.zeros_like(x); sg = np.ones_like(x)
    for k in range(0, len(SEG)):
        ax, ay, bx, by = SEG[k]
        vx, vy = bx - ax, by - ay
        L2 = vx * vx + vy * vy
        t = np.clip(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1)
        px, py = ax + t * vx - x, ay + t * vy - y
        dd = np.hypot(px, py)
        m = dd < d
        d[m] = dd[m]
        izq = (vx * (y - ay) - vy * (x - ax)) > 0
        sg[m] = np.where(izq[m], 1.0, -1.0)
        L = np.sqrt(L2)
        nx[m], ny[m] = -vy / L, vx / L        # normal izquierda = hacia tierra
    return d * sg, nx, ny


def en_poligono(pts, x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    dentro = np.zeros(x.shape, bool)
    P = np.array(pts, float)
    for (ax, ay), (bx, by) in zip(P, np.roll(P, -1, axis=0)):
        cruza = ((ay > y) != (by > y)) & (x < (bx - ax) * (y - ay) / (by - ay + 1e-12) + ax)
        dentro ^= cruza
    return dentro


CASTILLO = PL['castillo']
FOSO = PL['murallas'][0] + [PL['murallas'][0][0]]    # la muralla de OSM, cerrada: el foso de piso de pasto (foto)
Z_FOSO = 10.0          # la muralla de tierra mide de 12 a 15 m en su punto más alto (Museo de Sitio)
CASA = next(e['pts'] for e in PL['edificios'] if e['nombre'] == 'Casa del Castellano')[:4]
POLVORIN = next(e['pts'] for e in PL['edificios'] if e['nombre'].startswith('Polvor'))[:4]
FARO = next(p['p'] for p in PL['puntos'] if p['tipo'] == 'lighthouse')
# batería: «Zona de Cañones y Horno» de OSM, en el acantilado poniente; el faro y el polvorín quedan detrás
BAT = PL['bateria']
BAT_BORDE = BAT[:4]            # borde de afuera (sobre el mar), de norte a sur
BAT_Y = (BAT[0][1] + 2, BAT[3][1] - 2)
N_CANONES = 14                 # hoy: 7 originales de hierro y 7 réplicas de cemento (Museo de Sitio; SURDOC)


def terraza(y):
    """Nivel aproximado del piso de la batería: baja de norte a sur como el promontorio."""
    k = np.clip((BAT[0][1] - y) / (BAT[0][1] - BAT[3][1]), 0, 1)
    return 29.0 - 10.0 * k


def dist_poligono(P, x, y):
    P = np.array(P, float)
    d = np.full(np.shape(x), 1e9)
    for (ax, ay), (bx, by) in zip(P, np.roll(P, -1, axis=0)):
        vx, vy = bx - ax, by - ay
        t = np.clip(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy + 1e-12), 0, 1)
        d = np.minimum(d, np.hypot(ax + t * vx - x, ay + t * vy - y))
    return d


def altura(x, y):
    x, y = np.asarray(x, float), np.asarray(y, float)
    forma = x.shape
    x, y = x.ravel(), y.ravel()
    h = dem(x, y).astype(float)
    r = np.hypot(x, y)
    cerca = r < 520
    if cerca.any():
        xc, yc = x[cerca], y[cerca]
        d, nx, ny = costa(xc, yc)
        h_in = dem(xc + nx * 14 * np.sign(d), yc + ny * 14 * np.sign(d))     # el SRTM suaviza el borde: se mira tierra adentro
        alto = (h_in > 8) & (r[cerca] < 240)
        tierra = np.where(alto, h_in * np.clip(d / 5.0, 0, 1) ** 0.6, h_in * np.clip(d / 30.0, 0, 1))
        mar = -np.clip(1.5 + 0.35 * (-d), 0, 25)
        hc = np.where(d > 0, tierra, mar)
        # terraza de la batería: unos 4 m bajo el borde, entre 1,5 y 9 m tierra adentro; luego sube
        # batería: piso tallado en la roca, más bajo que el patio; borde de acantilado sobre el mar
        tb = terraza(yc)
        dentro_b = en_poligono(BAT, xc, yc)
        db = dist_poligono(BAT, xc, yc)
        cerca_b = (~dentro_b) & (db < 14) & (d > 0)
        acant = tb * np.clip(d / 1.5, 0, 1) ** 0.5
        hc = np.where(dentro_b & (d > 0), np.where(d < 1.5, acant, tb), hc)
        hc = np.where(cerca_b, tb + (np.maximum(hc, tb) - tb) * np.clip(db / 14, 0, 1) ** 1.3, hc)
        # foso: piso plano de pasto dentro de la muralla
        fo = en_poligono(FOSO, xc, yc)
        hc = np.where(fo, Z_FOSO, hc)
        # mezcla con el SRTM lejos del fuerte (más allá de 380 m) y lejos de la costa
        k = np.clip((r[cerca] - 380) / 140, 0, 1)
        lejos = np.abs(d) > 120
        k = np.where(lejos, np.maximum(k, np.clip((np.abs(d) - 120) / 80, 0, 1)), k)
        base = np.where(h[cerca] < 0.8, -4.0, h[cerca])
        h[cerca] = hc * (1 - k) + base * k
    lejos = ~cerca
    h[lejos] = np.where(h[lejos] < 0.6, -6.0, h[lejos])
    return h.reshape(forma)


def aplanar(pts, margen=1.5):
    """Altura media bajo una planta (para asentar edificios)."""
    P = np.array(pts, float)
    xs = np.linspace(P[:, 0].min() - margen, P[:, 0].max() + margen, 6)
    ys = np.linspace(P[:, 1].min() - margen, P[:, 1].max() + margen, 6)
    X, Y = np.meshgrid(xs, ys)
    return float(np.median(altura(X, Y)))


NIVEL_PASTO = H.lin(0.85)


def color_suelo_n(p):
    """Color del relieve (sRGB deseado), pasado a lineal y compensado por el brillo de la textura de pasto."""
    x, y, z = p.x, p.y, p.z
    v = 0.88 + 0.14 * H.ruido(x, y, 60) + 0.06 * H.ruido(x + 30, y, 9)
    pend = PEND.get((round(x, 1), round(y, 1)), 0.0)
    if z < -0.2:
        c = (0.30, 0.29, 0.25)
    elif z < 2.2 and pend < 0.5:
        c = (0.78, 0.71, 0.56)                                     # arena
    elif pend > 1.0:
        c = (0.55, 0.47, 0.39)                                     # roca cancagua del acantilado
    elif math.hypot(x, y) < 330:
        c = (0.45, 0.56, 0.27) if not en_poligono(FOSO, [x], [y])[0] else (0.42, 0.58, 0.25)   # pasto del fuerte (fotos)
    else:
        bosque = H.ruido(x * 0.7, y * 0.7, 300)
        c = (0.20, 0.30, 0.14) if bosque > -0.15 else (0.48, 0.55, 0.30)   # bosque y algunos potreros
        if z > 160:
            c = (0.18, 0.27, 0.13)
    return tuple(min(1.0, H.lin(min(1.0, k * v)) / NIVEL_PASTO) for k in c) + (1.0,)


PEND = {}


def terreno():
    """Grilla de 6 km con más detalle cerca del fuerte (2 m) y menos lejos."""
    n, L = 230, 6000.0
    a = 0.075
    f = lambda t: L * (a * t + (1 - a) * t ** 5)
    cs = np.array([f(-1 + 2 * i / n) for i in range(n + 1)])
    X, Y = np.meshgrid(cs, cs)
    Z = altura(X, Y)
    gy, gx = np.gradient(Z, cs, cs)
    pend = np.hypot(gx, gy)
    b = B('suelo_n')
    vs = []
    for j in range(n + 1):
        fila = []
        for i in range(n + 1):
            fila.append(b.verts.new((cs[i], cs[j], float(Z[j, i]))))
            PEND[(round(cs[i], 1), round(cs[j], 1))] = float(pend[j, i])
        vs.append(fila)
    for j in range(n):
        for i in range(n):
            if Z[j, i] < -5 and Z[j, i + 1] < -5 and Z[j + 1, i] < -5 and Z[j + 1, i + 1] < -5:
                continue                                          # fondo del mar profundo: no hace falta
            b.faces.new([vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]]).smooth = True
    print('terreno:', len(b.faces), 'caras')


# ---------------------------------------------------------------- fuerte
def muro_talud(mat, a, b, z0, z1a, z1b, hacia, talud=0.12, adentro=2.4, corona=3.8):
    """Muro de mampostería en talud entre los puntos a y b, del piso z0 a la corona (z1a en a, z1b en b). `hacia`:
    lado (+1/-1) al que mira la cara respecto de a→b (hacia el foso). La cara se adelanta `adentro` metros dentro del
    foso para tapar el borde del terreno, y la corona cubre ese tramo hasta tierra."""
    a, b = Vector((a[0], a[1], 0)), Vector((b[0], b[1], 0))
    d = (b - a).normalized()
    n = Vector((-d.y, d.x, 0)) * hacia
    ca, cb = a + n * adentro, b + n * adentro                   # corona de la cara
    pa, pb = ca + n * ((z1a - z0) * talud), cb + n * ((z1b - z0) * talud)   # pie
    cara(mat, [(pa.x, pa.y, z0), (pb.x, pb.y, z0), (cb.x, cb.y, z1b), (ca.x, ca.y, z1a)], (n.x, n.y, 0.3))
    ta, tb = ca - n * corona, cb - n * corona
    cara(mat, [(ca.x, ca.y, z1a + 0.04), (cb.x, cb.y, z1b + 0.04), (tb.x, tb.y, z1b + 0.04), (ta.x, ta.y, z1a + 0.04)], (0, 0, 1))
    return ca, cb


def foso():
    P = FOSO
    cx, cy = np.mean([p[0] for p in P[:-1]]), np.mean([p[1] for p in P[:-1]])
    # tramos de 3 m, con la altura de la corona en cada punto (la del terreno de afuera): sin escalones
    pts = []
    for a, b in zip(P, P[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, int(L / 3))
        for k in range(n):
            pts.append(((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n), (a[0], a[1], b[0], b[1])))
    pts.append(((P[-1][0], P[-1][1]), (P[-2][0], P[-2][1], P[-1][0], P[-1][1])))
    def corona(q, seg):
        ax, ay, bx, by = seg
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1
        izq = (-dy / L, dx / L)
        hacia = 1 if (cx - q[0]) * izq[0] + (cy - q[1]) * izq[1] > 0 else -1
        afuera = (q[0] - izq[0] * hacia * 3.0, q[1] - izq[1] * hacia * 3.0)
        return max(Z_FOSO + 6.0, float(altura([afuera[0]], [afuera[1]])[0])), hacia
    alturas = [corona(q, seg) for q, seg in pts]
    for k in range(len(pts) - 1):
        (qa, seg), (qb, _) = pts[k], pts[k + 1]
        (za, hacia), (zb, _) = alturas[k], alturas[k + 1]
        ca, cb = muro_talud('mamposteria_n', qa, qb, Z_FOSO, za, zb, hacia)
        for t in (0.25, 0.75):                                   # colisión: no caer al foso desde la corona
            x, y = ca.x + (cb.x - ca.x) * t, ca.y + (cb.y - ca.y) * t
            colision(x - 0.9, y - 0.9, x + 0.9, y + 0.9)


def borde_bateria():
    """Merlones y troneras a lo largo del borde de afuera de la batería (OSM), 2,2 m tierra adentro: 14 troneras
    con su cañón, cada 4,2 m (en las fotos los merlones miden unos 2,8 m y las troneras algo más de 1 m), centradas
    en el borde. Devuelve (x, y, nx, ny, es_canon) con la normal hacia el mar."""
    P = [np.array(p, float) for p in BAT_BORDE]
    largos = [np.linalg.norm(b - a) for a, b in zip(P, P[1:])]
    total = sum(largos)
    paso = 4.2
    s0 = (total - paso * N_CANONES) / 2
    pts = []
    for k in range(2 * N_CANONES + 1):
        s = s0 + k * paso / 2
        i = 0
        while i < len(largos) - 1 and s > largos[i]:
            s -= largos[i]; i += 1
        a, b = P[i], P[i + 1]
        d = (b - a) / largos[i]
        tierra = np.array([d[1], -d[0]])        # el borde va de norte a sur con el mar al oeste: tierra a la izquierda (este)
        if tierra[0] < 0:
            tierra = -tierra
        q = a + d * s + tierra * 2.2
        pts.append((q[0], q[1], -tierra[0], -tierra[1], k % 2 == 1))
    return pts


def piso_bateria():
    P = np.array(BAT, float)
    paso = 1.5
    xs = np.arange(P[:, 0].min(), P[:, 0].max() + paso, paso); ys = np.arange(P[:, 1].min(), P[:, 1].max() + paso, paso)
    X, Y = np.meshgrid(xs, ys)
    Z = altura(X, Y) + 0.04
    C = en_poligono(BAT, X[:-1, :-1] + paso / 2, Y[:-1, :-1] + paso / 2)
    d, _, _ = costa((X[:-1, :-1] + paso / 2).ravel(), (Y[:-1, :-1] + paso / 2).ravel())
    C &= (d.reshape(C.shape) > 1.6)
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            if C[j, i]:
                cara('piso_bateria', [(xs[i], ys[j], Z[j, i]), (xs[i + 1], ys[j], Z[j, i + 1]), (xs[i + 1], ys[j + 1], Z[j + 1, i + 1]), (xs[i], ys[j + 1], Z[j + 1, i])], (0, 0, 1))


def canon(x, y, z, dx, dy):
    """Cañón de hierro sobre cureña negra con ruedas (como las réplicas que hoy están en la batería)."""
    ang = math.atan2(dy, dx)
    M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(ang, 4, 'Z')
    # cureña: dos gualderas y ejes
    for s in (-0.26, 0.26):
        bmesh.ops.create_cube(B('cureña'), size=1.0, matrix=M @ Matrix.Translation((-0.35, s, 0.34)) @ Matrix.Diagonal((1.5, 0.09, 0.38, 1)))
    bmesh.ops.create_cube(B('cureña'), size=1.0, matrix=M @ Matrix.Translation((-0.35, 0, 0.2)) @ Matrix.Diagonal((1.4, 0.5, 0.08, 1)))
    for (ex, r) in ((0.18, 0.27), (-0.95, 0.22)):
        for s in (-0.34, 0.34):
            res = bmesh.ops.create_cone(B('cureña'), cap_ends=True, segments=10, radius1=r, radius2=r, depth=0.07,
                                        matrix=M @ Matrix.Translation((ex, s, r)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    # cañón: tubo cónico con brocal y cascabel
    res = bmesh.ops.create_cone(B('hierro_oxidado'), cap_ends=True, segments=12, radius1=0.2, radius2=0.13, depth=2.3,
                                matrix=M @ Matrix.Translation((0.25, 0, 0.62)) @ Matrix.Rotation(math.pi / 2, 4, 'Y') @ Matrix.Rotation(math.radians(-3), 4, 'X'))
    H._suavizar(res, solo_lados=False)
    res = bmesh.ops.create_cone(B('hierro_oxidado'), cap_ends=True, segments=12, radius1=0.16, radius2=0.16, depth=0.12,
                                matrix=M @ Matrix.Translation((1.38, 0, 0.6)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
    res = bmesh.ops.create_uvsphere(B('hierro_oxidado'), u_segments=8, v_segments=5, radius=0.09,
                                    matrix=M @ Matrix.Translation((-0.97, 0, 0.66)))


def bateria():
    pts = borde_bateria()
    for k, (x, y, nx, ny, es_canon) in enumerate(pts):
        z = float(altura([x - nx * 1.0], [y - ny * 1.0])[0])
        ang = math.atan2(ny, nx)
        if not es_canon:
            # merlón de cancagua: bloque macizo de 2,6 × 1,3 × 1,1 m con la base un poco más ancha
            M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(ang, 4, 'Z')
            bmesh.ops.create_cube(B('merlon'), size=1.0, matrix=M @ Matrix.Translation((0, 0, 0.5)) @ Matrix.Diagonal((1.35, 2.9, 1.15, 1)))
            bmesh.ops.create_cube(B('merlon'), size=1.0, matrix=M @ Matrix.Translation((0.08, 0, 0.0)) @ Matrix.Diagonal((1.5, 3.0, 0.5, 1)))
            colision(x - 1.4, y - 1.4, x + 1.4, y + 1.4)
        else:
            canon(x - nx * 2.2, y - ny * 2.2, z, nx, ny)
            cx, cy = x - nx * 2.5, y - ny * 2.5
            colision(cx - 0.8, cy - 0.8, cx + 0.8, cy + 0.8)
    print('batería:', sum(1 for p in pts if p[4]), 'cañones')


def casa_castellano():
    """Casa del castellano (hoy museo): muros de bloques de cancagua, techo a cuatro aguas de tejuelas y corredor de
    pilares de madera en el costado oriente (fotos). Planta de OSM; alturas estimadas en las fotos."""
    P = [Vector((p[0], p[1], 0)) for p in CASA]
    z0 = aplanar(CASA) - 0.2
    # ejes: largo (de norte a sur) y ancho
    largo = (P[1] - P[0]); ancho = (P[2] - P[1])
    u, v = largo.normalized(), ancho.normalized()
    Lw, Aw = largo.length, ancho.length
    o = P[0]
    corredor = 2.6          # el corredor ocupa este ancho en el lado oriente
    hm, hr = 3.2, 4.2       # alto de muro y subida del techo
    def q(s, t, z):
        p = o + u * s + v * t
        return (p.x, p.y, z0 + z)
    # muros (caja sin techo), en el ancho sin corredor
    a0, a1 = 0.0, Aw - corredor
    for (s0, t0, s1, t1, n) in ((0, a0, Lw, a0, -v), (0, a1, Lw, a1, v), (0, a0, 0, a1, -u), (Lw, a0, Lw, a1, u)):
        cara('muro_casa', [q(s0, t0, -1.2), q(s1, t1, -1.2), q(s1, t1, hm), q(s0, t0, hm)], tuple(n))
    # techo a cuatro aguas que cubre muros y corredor, con alero de 0,5 m
    e = 0.5
    c0, c1, c2, c3 = q(-e, -e, hm - 0.3), q(Lw + e, -e, hm - 0.3), q(Lw + e, Aw + e, hm - 0.3), q(-e, Aw + e, hm - 0.3)
    r = (Aw + 2 * e) / 2
    ra, rb = q(-e + r, Aw / 2, hm + hr), q(Lw + e - r, Aw / 2, hm + hr)
    cara('tejuela_n', [c0, c1, rb, ra], tuple(-v + Vector((0, 0, 1))))
    cara('tejuela_n', [c2, c3, ra, rb], tuple(v + Vector((0, 0, 1))))
    cara('tejuela_n', [c3, c0, ra], tuple(-u + Vector((0, 0, 1))))
    cara('tejuela_n', [c1, c2, rb], tuple(u + Vector((0, 0, 1))))
    # pilares del corredor y su viga
    s = 1.2
    while s < Lw - 0.5:
        x, y, _ = q(s, Aw - 0.25, 0)
        caja('madera_vieja', x - 0.11, y - 0.11, z0 - 1.0, x + 0.11, y + 0.11, z0 + hm - 0.3)
        colision(x - 0.25, y - 0.25, x + 0.25, y + 0.25)
        s += 2.9
    # colisión de los muros, en tramos (la casa está girada)
    for k in range(int(Lw)):
        for t in (a0, a1):
            x, y, _ = q(k + 0.5, t, 0)
            colision(x - 0.6, y - 0.6, x + 0.6, y + 0.6)
    for t in np.arange(a0, a1, 1.0):
        for ss in (0, Lw):
            x, y, _ = q(ss, t + 0.5, 0)
            colision(x - 0.6, y - 0.6, x + 0.6, y + 0.6)
    # relleno interior de colisión (no se entra al museo en esta versión)
    for k in range(1, int(Lw) - 1, 2):
        for t in np.arange(a0 + 1, a1 - 0.5, 2.0):
            x, y, _ = q(k + 0.5, t + 0.5, 0)
            colision(x - 1.2, y - 1.2, x + 1.2, y + 1.2)
    return z0


def ruina(cx, cy, w, d, ang, alto, puerta=None, mat='mamposteria_n'):
    """Rectángulo de muros bajos de mampostería, sin techo (ruinas del almacén y la capilla; polvorín)."""
    z0 = float(altura([cx], [cy])[0]) - 0.15
    u = Vector((math.cos(ang), math.sin(ang), 0)); v = Vector((-u.y, u.x, 0))
    g = 0.55
    for (s0, t0, s1, t1) in ((-w / 2, -d / 2, w / 2, -d / 2 + g), (-w / 2, d / 2 - g, w / 2, d / 2), (-w / 2, -d / 2, -w / 2 + g, d / 2), (w / 2 - g, -d / 2, w / 2, d / 2)):
        tramos = [(s0, s1)]
        if puerta and abs(t0 + d / 2) < 1e-6 and s1 - s0 > w / 2:
            tramos = [(s0, -puerta / 2), (puerta / 2, s1)]
        for (a, b) in tramos:
            M = Matrix.Translation((cx, cy, z0)) @ Matrix.Rotation(ang, 4, 'Z')
            bmesh.ops.create_cube(B(mat), size=1.0, matrix=M @ Matrix.Translation(((a + b) / 2, (t0 + t1) / 2, alto / 2)) @ Matrix.Diagonal((b - a, t1 - t0, alto, 1)))
            for k in np.arange(a, b, 1.0):
                p = Vector((cx, cy, 0)) + u * (k + 0.5) + v * ((t0 + t1) / 2)
                colision(p.x - 0.55, p.y - 0.55, p.x + 0.55, p.y + 0.55)


def faro():
    x, y = FARO
    z0 = float(altura([x], [y])[0]) - 0.1
    caja('concreto', x - 1.3, y - 1.3, z0 - 0.3, x + 1.3, y + 1.3, z0 + 0.3)
    alto = 6.6
    for k in range(6):
        za, zb = z0 + 0.3 + alto * k / 6, z0 + 0.3 + alto * (k + 1) / 6
        mat = 'faro_rojo' if k in (1, 3) else 'faro_blanco'
        cilindro(mat, x, y, za, zb, 0.78 - 0.04 * k, 0.78 - 0.04 * (k + 1), seg=16, tapas=False)
    zt = z0 + 0.3 + alto
    cilindro('faro_blanco', x, y, zt, zt + 0.12, 1.05, seg=16)
    cilindro('vidrio', x, y, zt + 0.12, zt + 1.1, 0.48, seg=12)
    cilindro('faro_rojo', x, y, zt + 1.1, zt + 1.5, 0.6, 0.12, seg=12)
    colision(x - 1.4, y - 1.4, x + 1.4, y + 1.4)


def senderos():
    for s in PL['senderos']:
        P = [p for p in s if en_poligono(CASTILLO, [p[0]], [p[1]])[0]]
        for a, b in zip(P, P[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1])
            if L < 0.5:
                continue
            d = ((b[0] - a[0]) / L, (b[1] - a[1]) / L); n = (-d[1] * 0.9, d[0] * 0.9)
            k = max(1, int(L / 2.0))
            for i in range(k):
                p0 = (a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k)
                p1 = (a[0] + (b[0] - a[0]) * (i + 1) / k, a[1] + (b[1] - a[1]) * (i + 1) / k)
                z = altura([p0[0] - n[0], p0[0] + n[0], p1[0] + n[0], p1[0] - n[0]], [p0[1] - n[1], p0[1] + n[1], p1[1] + n[1], p1[1] - n[1]]) + 0.04
                cara('sendero', [(p0[0] - n[0], p0[1] - n[1], z[0]), (p0[0] + n[0], p0[1] + n[1], z[1]), (p1[0] + n[0], p1[1] + n[1], z[2]), (p1[0] - n[0], p1[1] - n[1], z[3])], (0, 0, 1))


def pueblo():
    """Casas de Niebla (huellas de OSM fuera del fuerte): volúmenes de 1 o 2 pisos con techo a dos aguas de calamina."""
    rnd = random.Random(7)
    colores = [(0.92, 0.90, 0.84), (0.86, 0.76, 0.58), (0.72, 0.80, 0.82), (0.88, 0.70, 0.62), (0.80, 0.84, 0.72), (0.95, 0.93, 0.88)]
    n = 0
    bm = B('casa_pueblo')
    capas = [bm.verts.layers.float.get(k) or bm.verts.layers.float.new(k) for k in ('tr', 'tg', 'tb')]
    def teñir(verts, col):
        for vv in verts:
            for k in range(3):
                vv[capas[k]] = col[k]
    for e in PL['edificios']:
        P = np.array(e['pts'][:-1] if e['pts'][0] == e['pts'][-1] else e['pts'], float)
        c = P.mean(0)
        if en_poligono(CASTILLO, [c[0]], [c[1]])[0] or len(P) < 3:
            continue
        # rectángulo orientado por la arista más larga
        aris = [(P[(i + 1) % len(P)] - P[i]) for i in range(len(P))]
        lmax = max(aris, key=lambda a: np.hypot(*a))
        ang = math.atan2(lmax[1], lmax[0])
        R = np.array([[math.cos(ang), math.sin(ang)], [-math.sin(ang), math.cos(ang)]])
        Q = (P - c) @ R.T
        s0, t0 = Q.min(0); s1, t1 = Q.max(0)
        w, d = s1 - s0, t1 - t0
        if w * d < 6 or w * d > 900:
            continue
        cc = c + np.array([(s0 + s1) / 2, (t0 + t1) / 2]) @ R
        pisos = int(e['pisos']) if e['pisos'] and str(e['pisos']).isdigit() else (2 if rnd.random() < 0.18 else 1)
        hm = 2.7 * pisos
        z0 = float(np.min(altura(P[:, 0], P[:, 1]))) - 0.3
        M = Matrix.Translation((cc[0], cc[1], z0)) @ Matrix.Rotation(ang, 4, 'Z')
        col = rnd.choice(colores)
        res = bmesh.ops.create_cube(bm, size=1.0, matrix=M @ Matrix.Translation((0, 0, hm / 2 + 0.15)) @ Matrix.Diagonal((w, d, hm + 0.3, 1)))
        teñir(res['verts'], col)
        # techo a dos aguas sobre el lado largo
        sube = d / 2 * math.tan(math.radians(22))
        o = 0.35
        def q(s, t, z):
            p = Matrix.Rotation(ang, 4, 'Z') @ Vector((s, t, 0))
            return (cc[0] + p.x, cc[1] + p.y, z0 + z)
        zt = hm + 0.3
        cara('calamina', [q(-w / 2 - o, -d / 2 - o, zt - o * 0.4), q(w / 2 + o, -d / 2 - o, zt - o * 0.4), q(w / 2 + o, 0, zt + sube), q(-w / 2 - o, 0, zt + sube)], (0, 0, 1))
        cara('calamina', [q(-w / 2 - o, d / 2 + o, zt - o * 0.4), q(-w / 2 - o, 0, zt + sube), q(w / 2 + o, 0, zt + sube), q(w / 2 + o, d / 2 + o, zt - o * 0.4)], (0, 0, 1))
        f1 = cara('casa_pueblo', [q(-w / 2, -d / 2, zt), q(-w / 2, d / 2, zt), q(-w / 2, 0, zt + sube)], None)
        f2 = cara('casa_pueblo', [q(w / 2, -d / 2, zt), q(w / 2, 0, zt + sube), q(w / 2, d / 2, zt)], None)
        teñir(list(f1.verts) + list(f2.verts), col)
        n += 1
    print('pueblo:', n, 'casas')


def color_casa_pueblo(p):
    return (1.0, 1.0, 1.0, 1.0)


def vegetacion():
    """Árboles de OSM y matorrales (aromo y espino, frecuentes en los bordes del fuerte en las fotos)."""
    rnd = random.Random(39)
    arboles = list(PL['arboles'])
    for (x, y) in arboles:
        z = float(altura([x], [y])[0])
        _mover_z(lambda: arbol(x, y, rnd.uniform(6, 10), rnd.uniform(3.5, 5), rnd.randint(0, 9999), tipo='algarrobo', col=False), z,
                 tinte=(0.78, 1.0, 0.72))
        colision(x - 0.5, y - 0.5, x + 0.5, y + 0.5)
    # matorrales al borde del acantilado y en las laderas, fuera de los caminos
    pts = []
    for _ in range(2600):
        x, y = rnd.uniform(-110, 140), rnd.uniform(-190, 130)
        pts.append((x, y))
    X = np.array([p[0] for p in pts]); Y = np.array([p[1] for p in pts])
    d, _, _ = costa(X, Y)
    Z = altura(X, Y)
    dentro = en_poligono(CASTILLO, X, Y)
    for x, y, dd, z, den in zip(X, Y, d, Z, dentro):
        if dd < 0.8 or z < 1.5:
            continue
        borde = dd < 7 and not (BAT_Y[1] < y < BAT_Y[0] and dd < 9)
        ladera = (not den) and rnd.random() < 0.25
        if not (borde or ladera):
            continue
        c = Vector((x, y, z + 0.5))
        tarjetas(rnd, c, 0.9, rnd.randint(7, 11), 1.1, c, 1.2, 0.7, (0.74, 0.98, 0.66), z_min=z + 0.1)


def _mover_z(fn, z, tinte=None):
    """Arma un árbol de humberstone.py en el suelo plano y lo sube a la altura z (tronco y hojas)."""
    bt, bh = B('tronco'), B('hojas')
    nt, nh = len(bt.verts), len(bh.verts)
    nn = len(H.NORMALES_HOJAS)
    fn()
    bt.verts.ensure_lookup_table(); bh.verts.ensure_lookup_table()
    for i in range(nt, len(bt.verts)):
        bt.verts[i].co.z += z
    ti = [bh.verts.layers.float.get(k) for k in ('tr', 'tg', 'tb')]
    for i in range(nh, len(bh.verts)):
        bh.verts[i].co.z += z
        if tinte and ti[0] is not None:
            for k in range(3):
                bh.verts[i][ti[k]] *= tinte[k]


def rocas_al_pie():
    """Rocas al pie del acantilado (ahí descansan los lobos marinos)."""
    rnd = random.Random(5)
    pts = []
    for c in PL['costa']:
        for a, b in zip(c, c[1:]):
            if min(a[1], b[1]) < 40 and max(a[1], b[1]) > -165 and min(a[0], b[0]) < 0 and math.hypot(a[0], a[1]) < 230:
                L = math.hypot(b[0] - a[0], b[1] - a[1]); dx, dy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
                for t in np.arange(0, L, 4.5):
                    off = rnd.uniform(-1.5, 5.0)
                    pts.append((a[0] + dx * t + dy * off, a[1] + dy * t - dx * off, rnd.uniform(0.8, 2.4)))
    for (x, y, r) in pts:
        res = bmesh.ops.create_icosphere(B('roca_mar'), subdivisions=1, radius=r,
                                         matrix=Matrix.Translation((x, y, -0.3 + r * 0.25)) @ Matrix.Diagonal((1.0, rnd.uniform(0.7, 1.3), rnd.uniform(0.45, 0.8), 1)))
        for v in res['verts']:
            v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.5, 0.5))) * r * 0.18
    return pts


# ---------------------------------------------------------------- datos del paseo
def a3(c):
    return [round(c[0], 2), round(-c[3], 2), round(c[2], 2), round(-c[1], 2)]


def encoger(P, k=1.2):
    """Corre hacia adentro los vértices de un polígono que están sobre la costa (para no caminar al borde del acantilado)."""
    Q = []
    for (x, y) in P:
        d, nx, ny = costa([x], [y])
        if abs(d[0]) < 6:
            x, y = x + nx[0] * (3.5 - d[0]) * k, y + ny[0] * (3.5 - d[0]) * k
        Q.append([round(x, 2), round(-y, 2)])
    return Q


def grilla_suelo():
    P = np.array(CASTILLO)
    x0, x1 = P[:, 0].min() - 2, P[:, 0].max() + 2
    y0, y1 = P[:, 1].min() - 2, P[:, 1].max() + 2
    paso = 1.5
    xs = np.arange(x0, x1 + paso, paso); ys = np.arange(y1, y0 - paso, -paso)     # en three.js z crece hacia el sur
    X, Y = np.meshgrid(xs, ys)
    Z = altura(X, Y)
    return dict(x0=round(float(x0), 2), z0=round(float(-y1), 2), paso=paso, nx=len(xs), nz=len(ys),
                alturas=[round(float(v), 2) for v in Z.ravel()])


ANCLAS = {}       # se completan en construir() con las posiciones reales


def datos_paseo(creditos):
    sol_az, sol_el, hora, brujula = H.sol_de_la_tarde(dia_del_anio=35, elevacion=55.0, latitud=LAT, norte=90.0)
    print('Sol: azimut %.1f° (brújula), elevación %.1f°, hora solar %.2f' % (brujula, math.degrees(sol_el), hora))
    ini = INICIO
    zi = float(altura([ini['x']], [ini['y']])[0])
    gav = []
    for (cx, cy, cz, r, n) in ((-120, -50, 26, 70, 7), (-80, -125, 20, 40, 4), (-40, 10, 48, 55, 3), (-260, -260, 18, 90, 4)):
        gav.append(dict(centro=[cx, cz, -cy], radio=r, n=n))
    return dict(
        version=3,
        mundo='niebla',
        inicio=dict(x=ini['x'], z=-ini['y'], yaw=ini['yaw']),
        limites=[],
        zonas=[dict(dentro=encoger(CASTILLO), fuera=[[[p[0], -p[1]] for p in FOSO]])],
        suelo=grilla_suelo(),
        colisiones=[a3(c) for c in H.COLISIONES],
        pois=H.leer_pois(NOTA, ANCLAS),
        sol=dict(azimut=round(sol_az, 4), elevacion=round(sol_el, 4), hora_solar=round(hora, 2)),
        norte=math.radians(90.0),
        agua=dict(nivel=0.0, radio=24000),
        ambiente=dict(niebla=[0.62, 0.72, 0.82], niebla_cerca=1500, niebla_lejos=16000, rebote=[0.25, 0.32, 0.22],
                      turbidez=1.6, rayleigh=1.4, mie=0.002, nubes=0.25, exposicion=0.9,
                      color_sol=[1.0, 0.95, 0.88], sol=3.8, bloom=0.03, umbral_bloom=3.5),
        sombra=dict(centro=[-10, 60], radio=200),
        vuelo=dict(pos=[-330, 95, 170], mira=[-20, 20, 60], ruta=[[-200, 60, 110], [-95, 34, 50]], duracion=6.5),
        vida=dict(
            gaviotas=gav,
            # lobo marino común: hay registros en la bahía y una colonia en el río, pero no una lobera en Niebla
            lobos=dict(agua=[dict(centro=[-140, 0, 120], radio=45, n=1), dict(centro=[-60, 0, 260], radio=40, n=1)], rocas=[]),
            pelicanos=[dict(centro=[-200, 3.5, 80], radio=160, n=3), dict(centro=[-120, 5, 420], radio=120, n=2)],
            llama=dict(centro=[18.0, 22.0], radio=12.0),
            botes=[dict(ruta=[[-900, 0, 700], [-300, 0, 520], [300, 0, 640], [900, 0, 900]], vel=4.5, tipo='lancha'),
                   dict(ruta=[[-1500, 0, -200], [-700, 0, 250], [-100, 0, 1600]], vel=6.0, tipo='pesquero'),
                   dict(ruta=[[400, 0, 300], [-600, 0, 1900]], vel=3.0, tipo='bote')],
            personas=dict(rutas=RUTAS_PERSONAS, n=8),
        ),
        sonido='mar',
        creditos=creditos,
    )


# ---------------------------------------------------------------- armado
INICIO = dict(x=-60.0, y=-22.0, yaw=math.pi - 0.35)      # extremo norte de la batería, mirando al sur por los cañones
RUTAS_PERSONAS = []
LOBOS_ROCA = []
BANDERA = (0, 0, 0)


def construir():
    global LOBOS_ROCA, BANDERA
    terreno()
    foso()
    piso_bateria()
    bateria()
    zc = casa_castellano()
    ang = math.atan2(CASA[1][1] - CASA[0][1], CASA[1][0] - CASA[0][0]) + math.pi / 2
    ruina(-30.2, -82.6, 11.0, 6.5, ang, 1.0)                                   # almacén (OSM: ruinas)
    ruina(-12.7, -95.7, 13.0, 7.0, ang, 0.9, puerta=1.6)                       # casa del capellán y capilla
    P = np.array(POLVORIN, float); c = P.mean(0)
    ap = math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0])
    ruina(c[0], c[1], math.hypot(*(P[1] - P[0])), math.hypot(*(P[2] - P[1])), ap, 2.2, puerta=1.0)   # polvorín
    faro()
    senderos()
    pueblo()
    vegetacion()
    rp = rocas_al_pie()
    # algunas rocas planas y bajas bajo la batería sirven de descanso a los lobos marinos
    LOBOS_ROCA = [(x, y, -0.3 + r * 0.25 + r * 0.3) for (x, y, r) in rp if -95 < y < -20 and r > 1.6][:5]
    # bandera chilena en la entrada (frente a las oficinas del museo)
    bx, by = 92.0, -46.0
    BANDERA = (bx, by, float(altura([bx], [by])[0]))
    # rutas de visitantes: senderos del fuerte (en coordenadas de three.js)
    for s in PL['senderos']:
        densos = []
        for a, b in zip(s, s[1:]):
            n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 2))
            densos += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n)]
        densos.append(tuple(s[-1]))
        X = np.array([p[0] for p in densos]); Y = np.array([p[1] for p in densos])
        ok = en_poligono(CASTILLO, X, Y) & ~en_poligono(FOSO, X, Y) & (dist_poligono(FOSO, X, Y) > 4) & ~en_poligono(BAT, X, Y)
        tramo = []
        for p, bueno in zip(densos, ok):
            if bueno:
                tramo.append([round(p[0], 1), round(-p[1], 1)])
            else:
                if len(tramo) >= 6:
                    RUTAS_PERSONAS.append(tramo)
                tramo = []
        if len(tramo) >= 6:
            RUTAS_PERSONAS.append(tramo)
    # anclas de los puntos de interés (suelo donde pararse y punto del edificio donde va el marcador)
    def ancla(x, y, mx, my, mz):
        return dict(suelo=(x, y), marca=(mx, my, float(altura([mx], [my])[0]) + mz))
    ANCLAS.update({
        'bateria': ancla(-56.0, -20.0, -63.0, -24.0, 2.2),
        'casa': ancla(-8.0, -112.0, -21.0, -117.0, 8.5),
        'foso': ancla(29.0, -56.0, 58.0, -85.0, 3.0),        # en la orilla oeste del foso (el foso no se recorre)
        'bahia': ancla(-18.0, -150.0, -28.0, -160.0, 3.0),
        'toma': ancla(-24.0, -4.0, FARO[0], FARO[1], 9.5),
    })


def principal():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tex, hdr, creditos = H.recursos()
    for clave, archivo in FOTO_TEX.items():
        src = os.path.join(N, archivo + '.jpg')
        dst = os.path.join(N, archivo + '_neutro.jpg')
        H.neutralizar(src, dst, H.NIVEL[clave])
        tex[clave] = dict(diff=dst, nor=None, tam=TX['texturas'][archivo]['tam'][0])
    H.TEX_INFO = tex
    # las texturas de fotos no son cuadradas: el alto real va en tam2
    for nombre, s in H.MATS.items():
        if s.get('tex') in FOTO_TEX and 'tam2' not in s:
            s['tam2'] = tuple(TX['texturas'][FOTO_TEX[s['tex']]]['tam'])
    creditos = creditos + TX['creditos'] + [dict(tipo='relieve', nombre='Terrain Tiles (SRTM y otras fuentes abiertas)', autores=['Mapzen / Amazon Web Services'],
                                                licencia='Datos abiertos con atribución', url='https://registry.opendata.aws/terrain-tiles/')]
    H.COLOR_FN.update({'suelo_n': color_suelo_n, 'casa_pueblo': color_casa_pueblo})
    materiales = H.crear_materiales(tex)
    construir()
    datos = datos_paseo(creditos)
    objs = H.finalizar(materiales)
    print('Triángulos:', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs),
          '· colisiones:', len(H.COLISIONES), '· puntos de interés:', len(datos['pois']))
    if H.EXPORTAR:
        H.exportar(datos, 'niebla', escena='Castillo de Niebla, como se ve hoy · reconstrucción aproximada',
                   referencias=['Planta: OpenStreetMap (ODbL), © colaboradores de OpenStreetMap',
                                'Relieve: Terrain Tiles (Mapzen/AWS; SRTM de la NASA y otras fuentes abiertas)',
                                'Texturas de fotos de Wikimedia Commons (ver recursos); geometría por script en Blender (scripts/3d/niebla.py), sin IA'])


if __name__ == '__main__':
    principal()
