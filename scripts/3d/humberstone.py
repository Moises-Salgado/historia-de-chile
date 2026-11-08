"""
Humberstone hacia 1935 · reconstrucción aproximada (piloto del mundo 3D).

Genera site/3d/humberstone.glb con geometría modelada aquí mismo (metros reales, nada
generado por IA) y texturas CC0 de Poly Haven a 1k. Los textos de los puntos de interés
se leen de segundo-cerebro/Mundos/Humberstone 1935.md y viajan dentro del GLB.

Uso (lo llama `npm run 3d`):
  blender --background --factory-startup --python scripts/3d/humberstone.py -- [--render CARPETA] [--sin-export]

Ejes en Blender: x = oriente, y = norte de la cuadrícula del campamento (girada ~9,5° del
norte verdadero), z = arriba. Origen: centro de la plaza. En three.js: x = x, y = z, z = -y.
Planta y medidas: expediente UNESCO (nominación 1178) y huellas de OpenStreetMap.
"""
import bpy, bmesh, math, json, os, sys, random, re, shutil, urllib.request
import numpy as np
from mathutils import Vector, Matrix, noise

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CACHE = os.path.join(RAIZ, 'scripts', '3d', 'cache')
SITE3D = os.path.join(RAIZ, 'site', '3d')
NOTA = os.path.join(RAIZ, 'segundo-cerebro', 'Mundos', 'Humberstone 1935.md')
UA = {'User-Agent': 'historia-de-chile-humberstone/1.0 (sitio educativo sin fines de lucro)'}

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = ARGS[ARGS.index('--render') + 1] if '--render' in ARGS else None
EXPORTAR = '--sin-export' not in ARGS
random.seed(1935)

# ---------------------------------------------------------------- recursos CC0
TEXTURAS = {  # clave: id en Poly Haven
    'pampa': 'gravelly_sand',
    'tierra': 'dry_ground_01',
    'estuco': 'white_stucco_02',
    'tablas': 'white_planks_clean',
    'calamina': 'worn_corrugated_iron',
    'concreto': 'brushed_concrete',
    'corteza': 'bark_brown_02',
}
# Brillo medio (sRGB) al que se lleva cada textura: así el color lo pone el material.
NIVEL = {'pampa': 0.74, 'tierra': 0.74, 'estuco': 0.88, 'tablas': 0.82, 'calamina': 0.72, 'concreto': 0.78, 'corteza': 0.6,
         'hojas': 1.0, 'tablas_gris': 0.82}
HDRI = 'qwantani_noon_puresky'   # solo para los renders de prueba en Blender (--render); el sitio usa el cielo de three.js


def _get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def json_cache(nombre, url):
    p = os.path.join(CACHE, nombre)
    if not os.path.exists(p):
        os.makedirs(CACHE, exist_ok=True)
        with open(p, 'wb') as f:
            f.write(_get(url))
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def descargar(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return destino
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    datos = _get(url)
    with open(destino + '.part', 'wb') as f:
        f.write(datos)
    os.replace(destino + '.part', destino)
    return destino


def neutralizar(src, dst, nivel):
    """Quita el tinte de la foto y la deja con brillo medio `nivel`; el color lo da el material."""
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return
    img = bpy.data.images.load(src, check_existing=False)
    n = img.size[0] * img.size[1]
    px = np.empty(n * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    media = px[:, :3].mean(axis=0)
    px[:, :3] *= nivel / np.maximum(media, 1e-4)
    np.clip(px, 0.0, 1.0, out=px)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = dst
    img.file_format = 'JPEG'
    img.save(filepath=dst, quality=92)
    bpy.data.images.remove(img)


def recomprimir(src, dst, calidad=80):
    """Los mapas de relieve de Poly Haven vienen en JPEG casi sin pérdida (1 MB cada uno): se guardan a calidad 80."""
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return
    img = bpy.data.images.load(src, check_existing=False)
    img.colorspace_settings.name = 'Non-Color'
    _ = img.pixels[0]          # fuerza la lectura de los píxeles (Blender carga las imágenes con pereza)
    img.filepath_raw = dst
    img.file_format = 'JPEG'
    img.save(filepath=dst, quality=calidad)
    bpy.data.images.remove(img)


def textura_hojas(dst, S=512):
    """Ramillete de hojas compuestas, como las del tamarugo y el algarrobo (Prosopis): ramitas con pinnas y
    folíolos pequeños. Se dibuja aquí con numpy (nada descargado ni generado por IA). RGBA, el alfa recorta la silueta."""
    if os.path.exists(dst):
        return
    rnd = random.Random(7)
    rgba = np.zeros((S, S, 4), np.float32)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    cx0 = cy0 = S / 2

    def elipse(cx, cy, a, b, ang, col):
        r = int(max(a, b)) + 2
        x0, x1 = max(0, int(cx - r)), min(S, int(cx + r) + 1)
        y0, y1 = max(0, int(cy - r)), min(S, int(cy + r) + 1)
        if x0 >= x1 or y0 >= y1:
            return
        X = xx[y0:y1, x0:x1] - cx; Y = yy[y0:y1, x0:x1] - cy
        c, s = math.cos(ang), math.sin(ang)
        u = (X * c + Y * s) / a; v = (-X * s + Y * c) / b
        m = np.clip((1.0 - (u * u + v * v)) * b * 0.9, 0.0, 1.0)
        sub = rgba[y0:y1, x0:x1]
        sub[..., :3] = sub[..., :3] * (1 - m[..., None]) + np.array(col, np.float32) * m[..., None]
        sub[..., 3] = np.maximum(sub[..., 3], m)

    def tallo(p, q, w, col):
        n = max(2, int(math.dist(p, q) / 2.5))
        ang = math.atan2(q[1] - p[1], q[0] - p[0])
        for i in range(n + 1):
            t = i / n
            elipse(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, max(w * 1.8, 2.4), w, ang, col)

    base = (0.46, 0.52, 0.31)
    nramas = 11
    for k in range(nramas):
        th = 2 * math.pi * k / nramas + rnd.uniform(-0.25, 0.25)
        largo = rnd.uniform(150, 232)
        curva = rnd.uniform(-0.5, 0.5)
        pts = []
        for i in range(13):
            t = i / 12
            a = th + curva * t * t
            pts.append((cx0 + math.cos(a) * largo * t, cy0 + math.sin(a) * largo * t))
        for p, q in zip(pts[2:], pts[3:]):      # sin el tramo central: si no, cada racimo deja una estrella de tallos
            tallo(p, q, 1.0, (0.36, 0.36, 0.24))
        lado = 1
        for i in range(3, 12):
            p, q = pts[i], pts[i + 1]
            ang = math.atan2(q[1] - p[1], q[0] - p[0])
            lado = -lado
            pa = ang + lado * rnd.uniform(0.8, 1.15)
            lp = rnd.uniform(40, 68) * (1.0 - 0.35 * i / 12)
            for j in range(1, 12):
                t = j / 11
                px_ = p[0] + math.cos(pa) * lp * t; py_ = p[1] + math.sin(pa) * lp * t
                dist = math.hypot(px_ - cx0, py_ - cy0) / (S / 2)
                for sgn in (-1, 1):
                    la = pa + sgn * rnd.uniform(0.95, 1.25)
                    L = rnd.uniform(5.0, 7.5) * (1.0 - 0.3 * t)
                    lum = rnd.uniform(0.82, 1.12) * (0.66 + 0.4 * min(1.0, dist))
                    seco = rnd.random() < 0.05
                    col = (0.62 * lum, 0.56 * lum, 0.32 * lum) if seco else \
                          (base[0] * lum * rnd.uniform(0.94, 1.06), base[1] * lum, base[2] * lum * rnd.uniform(0.9, 1.1))
                    elipse(px_ + math.cos(la) * L * 0.9, py_ + math.sin(la) * L * 0.9, L, L * 0.36, la,
                           tuple(min(1.0, c) for c in col))
    # bajo el alfa, el color promedio de las hojas: así los mipmaps no dejan un borde oscuro
    a = rgba[..., 3:4]
    media = (rgba[..., :3] * a).sum(axis=(0, 1)) / max(1e-4, float(a.sum()))
    rgba[..., :3] = rgba[..., :3] * a + media * (1 - a)
    img = bpy.data.images.new('hojas', S, S, alpha=True)
    img.pixels.foreach_set(np.flipud(rgba).ravel())
    img.filepath_raw = dst
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def recursos():
    tex, creditos = {}, []
    for clave, pid in TEXTURAS.items():
        meta = json_cache(pid + '.info.json', 'https://api.polyhaven.com/info/' + pid)
        files = json_cache(pid + '.files.json', 'https://api.polyhaven.com/files/' + pid)
        diff = descargar(files['Diffuse']['1k']['jpg']['url'], os.path.join(CACHE, pid + '_diff_1k.jpg'))
        nor = descargar(files['nor_gl']['1k']['jpg']['url'], os.path.join(CACHE, pid + '_nor_gl_1k.jpg'))
        nor_q = os.path.join(CACHE, pid + '_nor_q80.jpg')
        recomprimir(nor, nor_q)
        neutro = os.path.join(CACHE, pid + '_diff_neutro.jpg')
        neutralizar(diff, neutro, NIVEL[clave])
        dims = [d for d in (meta.get('dimensions') or [2000, 2000]) if d > 1]
        tex[clave] = dict(diff=neutro, nor=nor_q, tam=(max(dims) / 1000.0) if dims else 2.0)
        creditos.append(dict(tipo='textura', id=pid, nombre=meta['name'], autores=list(meta['authors'].keys()),
                             licencia='CC0 1.0', url='https://polyhaven.com/a/' + pid))
    fotos = os.path.join(CACHE, 'teatro', 'creditos.json')      # fotos de Commons del teatro (teatro_fotos.py)
    if os.path.exists(fotos):
        with open(fotos, encoding='utf-8') as f:
            creditos.extend(json.load(f)['creditos'])
    hojas = os.path.join(CACHE, 'hojas_prosopis.png')
    textura_hojas(hojas)
    tex['hojas'] = dict(diff=hojas, nor=None, tam=1.0)
    gris = os.path.join(CACHE, 'teatro', 'tablas_gris.jpg')    # tablas reales del teatro (teatro_fotos.py)
    tex['tablas_gris'] = dict(diff=gris if os.path.exists(gris) else tex['tablas']['diff'], nor=None, tam=12.0)
    hdr = None
    if RENDER:   # el cielo HDRI solo ilumina los renders de prueba; ya no se publica
        files = json_cache(HDRI + '.files.json', 'https://api.polyhaven.com/files/' + HDRI)
        hdr = descargar(files['hdri']['1k']['hdr']['url'], os.path.join(CACHE, HDRI + '_1k.hdr'))
    viejo = os.path.join(SITE3D, 'cielo.hdr')
    if os.path.exists(viejo):
        os.remove(viejo)
    return tex, hdr, creditos


# ---------------------------------------------------------------- materiales
def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


MATS = {  # color en sRGB (el que se quiere ver); rot = tablas horizontales; doble = se ve por ambos lados
    'suelo': dict(tex='pampa', color=(0.74, 0.64, 0.52), rough=0.97),
    'ripios': dict(tex='pampa', color=(0.56, 0.52, 0.49), rough=0.97),
    'plaza': dict(tex='tierra', color=(0.76, 0.69, 0.60), rough=0.95),
    'concreto': dict(tex='concreto', color=(0.80, 0.78, 0.74), rough=0.9),
    'estuco_blanco': dict(tex='estuco', color=(0.93, 0.91, 0.86), rough=0.92),
    'estuco_crema': dict(tex='estuco', color=(0.93, 0.86, 0.71), rough=0.92),
    'estuco_ocre': dict(tex='estuco', color=(0.90, 0.79, 0.57), rough=0.92),
    'madera_teatro': dict(tex='tablas', color=(0.80, 0.72, 0.48), rough=0.85, rot=True),
    'madera_blanca': dict(tex='tablas', color=(0.91, 0.89, 0.82), rough=0.85),
    'madera_oscura': dict(tex='tablas', color=(0.40, 0.30, 0.21), rough=0.8),
    'madera_roja': dict(tex='tablas', color=(0.55, 0.26, 0.17), rough=0.75),
    'pintura_verde': dict(tex='tablas', color=(0.42, 0.60, 0.52), rough=0.7),
    'cana': dict(tex='tablas', color=(0.74, 0.64, 0.46), rough=0.9, rot=True),
    'calamina': dict(tex='calamina', color=(0.80, 0.77, 0.73), rough=0.68, metal=0.08, doble=True),
    'vidrio': dict(tex=None, color=(0.13, 0.15, 0.17), rough=0.12),
    'metal': dict(tex=None, color=(0.12, 0.12, 0.12), rough=0.5, metal=0.6),
    'reloj': dict(tex=None, color=(0.94, 0.92, 0.87), rough=0.55),
    'hojas': dict(tex='hojas', color=(1.0, 1.0, 1.0), rough=0.82, doble=True, alfa=True),
    'tronco': dict(tex='corteza', color=(0.40, 0.34, 0.29), rough=0.95),
    'madera_cruda': dict(tex='tablas', color=(0.76, 0.64, 0.46), rough=0.88, rot=True),
    'arpillera': dict(tex=None, color=(0.70, 0.62, 0.47), rough=1.0),
    'cable': dict(tex=None, color=(0.07, 0.07, 0.07), rough=0.6),
    'ladrillo': dict(tex=None, color=(0.58, 0.40, 0.30), rough=0.95),
    'cerros': dict(tex=None, color=(0.78, 0.64, 0.52), rough=1.0),
    # teatro: fotos de Commons enderezadas (scripts/3d/teatro_fotos.py); el color lo trae la foto
    'teatro_frente': dict(tex=None, foto='frente', rough=0.88),
    'teatro_vestibulo': dict(tex=None, foto='vestibulo', rough=0.88),
    'teatro_oeste': dict(tex=None, foto='oeste', rough=0.88),
    'teatro_norte': dict(tex=None, foto='norte', rough=0.88),
    'teatro_este': dict(tex=None, foto='este', rough=0.88),
    'teatro_este_bajo': dict(tex=None, foto='este_bajo', rough=0.88),
    'teatro_anexo': dict(tex=None, foto='anexo', rough=0.88),
    'teatro_tablas': dict(tex=None, foto='tablas', tam2=(12.0, 3.0), rough=0.88),
    'int_escenario': dict(tex=None, foto='escenario', rough=0.9),
    # interior del teatro: colores medidos en las fotos de la sala
    'int_aguamarina': dict(tex='tablas_gris', color=(0.52, 0.88, 0.79), rough=0.8, tam2=(12.0, 3.0)),
    'int_tablero': dict(tex='tablas_gris', color=(0.50, 0.85, 0.77), rough=0.8, rot=True, tam2=(3.0, 12.0)),
    'int_vestibulo': dict(tex='estuco', color=(0.80, 0.72, 0.58), rough=0.92),
    'int_verde': dict(tex=None, color=(0.20, 0.50, 0.45), rough=0.55),
    'int_crema': dict(tex=None, color=(0.88, 0.85, 0.74), rough=0.9),
    'int_blanco': dict(tex='estuco', color=(0.90, 0.92, 0.88), rough=0.9),
    'int_piso': dict(tex='tablas', color=(0.42, 0.20, 0.12), rough=0.75, rot=True),
    'int_butaca': dict(tex='tablas', color=(0.38, 0.15, 0.08), rough=0.45),
    'int_galeria': dict(tex='tablas', color=(0.50, 0.38, 0.27), rough=0.8, rot=True),
    'int_alfombra': dict(tex=None, color=(0.60, 0.12, 0.22), rough=1.0),
    'int_ventana': dict(tex=None, color=(0.90, 0.94, 1.0), rough=0.3, emision=2.2),
}
VCOL = {'suelo', 'cerros', 'hojas', 'ripios'}
SIN_SOMBRA = {'cerros', 'cable'}       # no proyectan sombra
SOLO_RECIBE = {'suelo', 'plaza', 'concreto', 'ripios'}
UV_PROPIAS = {'hojas', 'tronco'}       # traen sus UV desde la construcción (tarjetas de hojas, corteza cilíndrica)


def crear_materiales(tex):
    imgs, out = {}, {}
    for clave, t in tex.items():
        a = bpy.data.images.load(t['diff'], check_existing=True)
        b = None
        if t['nor']:
            b = bpy.data.images.load(t['nor'], check_existing=True)
            b.colorspace_settings.name = 'Non-Color'
        imgs[clave] = (a, b)
    for nombre, s in MATS.items():
        m = bpy.data.materials.new(nombre)
        m.use_nodes = True
        nt = m.node_tree
        P = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
        P.inputs['Roughness'].default_value = s.get('rough', 0.9)
        P.inputs['Metallic'].default_value = s.get('metal', 0.0)
        if s.get('doble'):
            m.use_backface_culling = False
        else:
            m.use_backface_culling = True
        if s.get('emision'):
            P.inputs['Emission Color'].default_value = (*[lin(c) for c in s['color']], 1.0)
            P.inputs['Emission Strength'].default_value = s['emision']
        if s.get('foto'):
            ruta = os.path.join(CACHE, 'teatro', s['foto'] + '.jpg')
            if os.path.exists(ruta):
                T = nt.nodes.new('ShaderNodeTexImage')
                T.image = bpy.data.images.load(ruta, check_existing=True)
                T.extension = 'REPEAT' if s.get('tam2') else 'EXTEND'
                nt.links.new(T.outputs['Color'], P.inputs['Base Color'])
            else:
                print('AVISO: falta la textura', ruta, '(correr: python -P scripts/3d/teatro_fotos.py)')
                P.inputs['Base Color'].default_value = (*[lin(c) for c in (0.72, 0.62, 0.45)], 1.0)
        elif s['tex']:
            nivel = lin(NIVEL[s['tex']])
            tinte = tuple(min(1.0, lin(c) / nivel) for c in s['color'])
            diff, nor = imgs[s['tex']]
            T = nt.nodes.new('ShaderNodeTexImage'); T.image = diff
            M = nt.nodes.new('ShaderNodeMix'); M.data_type = 'RGBA'; M.blend_type = 'MULTIPLY'
            M.inputs['Factor'].default_value = 1.0
            ent = {s_.identifier: s_ for s_ in M.inputs}
            sal = {s_.identifier: s_ for s_ in M.outputs}
            nt.links.new(T.outputs['Color'], ent['A_Color'])
            ent['B_Color'].default_value = (*tinte, 1.0)
            nt.links.new(sal['Result_Color'], P.inputs['Base Color'])
            if s.get('alfa'):
                nt.links.new(T.outputs['Alpha'], P.inputs['Alpha'])
            if nor is not None:
                N = nt.nodes.new('ShaderNodeTexImage'); N.image = nor
                NM = nt.nodes.new('ShaderNodeNormalMap')
                nt.links.new(N.outputs['Color'], NM.inputs['Color'])
                nt.links.new(NM.outputs['Normal'], P.inputs['Normal'])
        else:
            P.inputs['Base Color'].default_value = (*[lin(c) for c in s['color']], 1.0)
        if nombre in VCOL and not s['tex']:
            C = nt.nodes.new('ShaderNodeVertexColor'); C.layer_name = 'Color'
            M = nt.nodes.new('ShaderNodeMix'); M.data_type = 'RGBA'; M.blend_type = 'MULTIPLY'
            M.inputs['Factor'].default_value = 1.0
            ent = {s_.identifier: s_ for s_ in M.inputs}
            sal = {s_.identifier: s_ for s_ in M.outputs}
            nt.links.new(C.outputs['Color'], ent['A_Color'])
            ent['B_Color'].default_value = P.inputs['Base Color'].default_value[:]
            nt.links.new(sal['Result_Color'], P.inputs['Base Color'])
        out[nombre] = m
    return out


# ---------------------------------------------------------------- geometría (una malla por material)
TEX_INFO = {}          # lo llena principal() (o el script del otro mundo) con recursos()
MALLAS = {}
COLISIONES = []   # (x0, y0, x1, y1) en coordenadas de Blender


def B(mat):
    if mat not in MALLAS:
        MALLAS[mat] = bmesh.new()
    return MALLAS[mat]


def colision(x0, y0, x1, y1):
    COLISIONES.append((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)))


def cara(mat, pts, n=None, suave=False):
    b = B(mat)
    f = b.faces.new([b.verts.new(p) for p in pts])
    f.smooth = suave
    if n is not None:
        f.normal_update()
        if f.normal.dot(Vector(n)) < 0:
            f.normal_flip()
    return f


_CARAS = {'-z': (0, 2, 3, 1), '+z': (4, 5, 7, 6), '-y': (0, 1, 5, 4), '+y': (2, 6, 7, 3), '-x': (0, 4, 6, 2), '+x': (1, 3, 7, 5)}


def caja(mat, x0, y0, z0, x1, y1, z1, sin=('-z',), col=False):
    x0, x1 = min(x0, x1), max(x0, x1)
    y0, y1 = min(y0, y1), max(y0, y1)
    z0, z1 = min(z0, z1), max(z0, z1)
    b = B(mat)
    v = [b.verts.new((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
    for k, idx in _CARAS.items():
        if k not in sin:
            b.faces.new([v[i] for i in idx])
    if col:
        colision(x0, y0, x1, y1)


def caja_rot(mat, cx, cy, cz, sx, sy, sz, ang):
    M = Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Diagonal((sx, sy, sz, 1.0))
    bmesh.ops.create_cube(B(mat), size=1.0, matrix=M)


def _suavizar(res, solo_lados=True):
    caras = set()
    for v in res['verts']:
        caras.update(v.link_faces)
    for f in caras:
        f.normal_update()
        f.smooth = (abs(f.normal.z) < 0.9) if solo_lados else True


def cilindro(mat, x, y, z0, z1, r0, r1=None, seg=8, tapas=True):
    r1 = r0 if r1 is None else r1
    h = z1 - z0
    res = bmesh.ops.create_cone(B(mat), cap_ends=tapas, cap_tris=False, segments=seg, radius1=r0, radius2=r1,
                                depth=h, matrix=Matrix.Translation((x, y, z0 + h / 2)))
    _suavizar(res)


def tubo(mat, p0, p1, r0, r1=None, seg=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    r1 = r0 if r1 is None else r1
    rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    res = bmesh.ops.create_cone(B(mat), cap_ends=False, segments=seg, radius1=r0, radius2=r1, depth=d.length,
                                matrix=Matrix.Translation((p0 + p1) / 2) @ rot)
    _suavizar(res, solo_lados=False)


def techo4(mat, x0, y0, x1, y1, z, h, o=0.35, fascia=True):
    """Techo a cuatro aguas sobre el rectángulo de muros; `z` es la altura del muro y `h` la del caballete."""
    s = h / (min(x1 - x0, y1 - y0) / 2)
    X0, Y0, X1, Y1 = x0 - o, y0 - o, x1 + o, y1 + o
    ze, zr = z - o * s, z + h
    w, d = X1 - X0, Y1 - Y0
    c0, c1, c2, c3 = (X0, Y0, ze), (X1, Y0, ze), (X1, Y1, ze), (X0, Y1, ze)
    if w >= d:
        r = d / 2; ym = (Y0 + Y1) / 2
        a, bb = (X0 + r, ym, zr), (X1 - r, ym, zr)
        cara(mat, [c0, c1, bb, a], (0, -1, 1)); cara(mat, [c1, c2, bb], (1, 0, 1))
        cara(mat, [c2, c3, a, bb], (0, 1, 1)); cara(mat, [c3, c0, a], (-1, 0, 1))
    else:
        r = w / 2; xm = (X0 + X1) / 2
        a, bb = (xm, Y0 + r, zr), (xm, Y1 - r, zr)
        cara(mat, [c3, c0, a, bb], (-1, 0, 1)); cara(mat, [c0, c1, a], (0, -1, 1))
        cara(mat, [c1, c2, bb, a], (1, 0, 1)); cara(mat, [c2, c3, bb], (0, 1, 1))
    if fascia:
        t = 0.05
        caja('madera_oscura', X0, Y0 - t, ze - 0.18, X1, Y0, ze + 0.02, sin=())
        caja('madera_oscura', X0, Y1, ze - 0.18, X1, Y1 + t, ze + 0.02, sin=())
        caja('madera_oscura', X0 - t, Y0, ze - 0.18, X0, Y1, ze + 0.02, sin=())
        caja('madera_oscura', X1, Y0, ze - 0.18, X1 + t, Y1, ze + 0.02, sin=())


def techo1(mat, x0, y0, x1, y1, z_alto, z_bajo, baja='-y'):
    """Techo a un agua: baja hacia el lado `baja`."""
    if baja == '-y':
        pts = [(x0, y0, z_bajo), (x1, y0, z_bajo), (x1, y1, z_alto), (x0, y1, z_alto)]
    elif baja == '+y':
        pts = [(x0, y0, z_alto), (x1, y0, z_alto), (x1, y1, z_bajo), (x0, y1, z_bajo)]
    elif baja == '-x':
        pts = [(x0, y0, z_bajo), (x1, y0, z_alto), (x1, y1, z_alto), (x0, y1, z_bajo)]
    else:
        pts = [(x0, y0, z_alto), (x1, y0, z_bajo), (x1, y1, z_bajo), (x0, y1, z_alto)]
    cara(mat, pts, (0, 0, 1))


def techo2(mat, x0, y0, x1, y1, z, h, eje='x', o=0.3, muro=None):
    """Techo a dos aguas con caballete paralelo a `eje`; `muro` cierra los tímpanos."""
    if eje == 'x':
        ym = (y0 + y1) / 2; s = h / ((y1 - y0) / 2); ze = z - o * s
        X0, X1, Y0, Y1 = x0 - o, x1 + o, y0 - o, y1 + o
        cara(mat, [(X0, Y0, ze), (X1, Y0, ze), (X1, ym, z + h), (X0, ym, z + h)], (0, -1, 1))
        cara(mat, [(X0, ym, z + h), (X1, ym, z + h), (X1, Y1, ze), (X0, Y1, ze)], (0, 1, 1))
        if muro:
            cara(muro, [(x0, y0, z), (x0, y1, z), (x0, ym, z + h)], (-1, 0, 0))
            cara(muro, [(x1, y0, z), (x1, y1, z), (x1, ym, z + h)], (1, 0, 0))
    else:
        xm = (x0 + x1) / 2; s = h / ((x1 - x0) / 2); ze = z - o * s
        X0, X1, Y0, Y1 = x0 - o, x1 + o, y0 - o, y1 + o
        cara(mat, [(X0, Y0, ze), (xm, Y0, z + h), (xm, Y1, z + h), (X0, Y1, ze)], (-1, 0, 1))
        cara(mat, [(xm, Y0, z + h), (X1, Y0, ze), (X1, Y1, ze), (xm, Y1, z + h)], (1, 0, 1))
        if muro:
            cara(muro, [(x0, y0, z), (x1, y0, z), (xm, y0, z + h)], (0, -1, 0))
            cara(muro, [(x0, y1, z), (x1, y1, z), (xm, y1, z + h)], (0, 1, 0))


def en_muro(mat, lado, plano, t0, t1, z0, z1, d0, d1, sin_extra=()):
    """Caja pegada a un muro. lado: normal exterior ('+x', '-x', '+y', '-y'); plano: coordenada del muro;
    t0..t1 a lo largo del muro; d0..d1 hacia afuera del muro."""
    s = 1 if lado[0] == '+' else -1
    interior = ('-' if s > 0 else '+') + lado[1]
    sin = ('-z', interior) + tuple(sin_extra)
    if lado[1] == 'x':
        caja(mat, plano + s * d0, t0, z0, plano + s * d1, t1, z1, sin=sin)
    else:
        caja(mat, t0, plano + s * d0, z0, t1, plano + s * d1, z1, sin=sin)


def ventana(lado, plano, tc, z0, w, h, marco='madera_oscura', cruz=True, alfeizar=True):
    en_muro('vidrio', lado, plano, tc - w / 2, tc + w / 2, z0, z0 + h, 0.0, 0.025)
    m = 0.07
    en_muro(marco, lado, plano, tc - w / 2 - m, tc - w / 2, z0 - m, z0 + h + m, 0.0, 0.07)
    en_muro(marco, lado, plano, tc + w / 2, tc + w / 2 + m, z0 - m, z0 + h + m, 0.0, 0.07)
    en_muro(marco, lado, plano, tc - w / 2, tc + w / 2, z0 + h, z0 + h + m, 0.0, 0.07)
    en_muro(marco, lado, plano, tc - w / 2, tc + w / 2, z0 - m, z0, 0.0, 0.07)
    if cruz:
        en_muro(marco, lado, plano, tc - 0.02, tc + 0.02, z0, z0 + h, 0.0, 0.045)
        en_muro(marco, lado, plano, tc - w / 2, tc + w / 2, z0 + h * 0.62, z0 + h * 0.62 + 0.04, 0.0, 0.045)
    if alfeizar:
        en_muro(marco, lado, plano, tc - w / 2 - 0.1, tc + w / 2 + 0.1, z0 - m - 0.05, z0 - m, 0.0, 0.12)


def puerta(lado, plano, tc, w, h, hoja='madera_oscura', marco='madera_oscura', z0=0.0, montante=False):
    en_muro(hoja, lado, plano, tc - w / 2, tc + w / 2, z0, z0 + h, 0.0, 0.03)
    m = 0.09
    if montante:            # ventanita sobre la puerta (montante), común en la pampa para ventilar
        en_muro('vidrio', lado, plano, tc - w / 2, tc + w / 2, z0 + h + m, z0 + h + m + 0.42, 0.0, 0.025)
        en_muro(marco, lado, plano, tc - w / 2, tc + w / 2, z0 + h + m + 0.42, z0 + h + 2 * m + 0.42, 0.0, 0.08)
        en_muro(marco, lado, plano, tc - 0.02, tc + 0.02, z0 + h + m, z0 + h + m + 0.42, 0.0, 0.05)
    hm = h + (m + 0.42 + m if montante else m)
    en_muro(marco, lado, plano, tc - w / 2 - m, tc - w / 2, z0, z0 + hm, 0.0, 0.08)
    en_muro(marco, lado, plano, tc + w / 2, tc + w / 2 + m, z0, z0 + hm, 0.0, 0.08)
    en_muro(marco, lado, plano, tc - w / 2, tc + w / 2, z0 + h, z0 + h + m, 0.0, 0.08)
    if hoja == 'vidrio':
        return
    # hojas de tableros: dos hojas si la puerta es ancha, cada una con un tablero bajo y uno alto en relieve
    hojas = [(tc - w / 2, tc), (tc, tc + w / 2)] if w > 1.15 else [(tc - w / 2, tc + w / 2)]
    if len(hojas) == 2:
        en_muro(hoja, lado, plano, tc - 0.018, tc + 0.018, z0, z0 + h, 0.0, 0.05)
    for (a, b) in hojas:
        mg = min(0.12, (b - a) * 0.16)
        for (z_a, z_b) in ((0.14, 0.4), (0.48, 0.88)):
            en_muro(hoja, lado, plano, a + mg, b - mg, z0 + h * z_a, z0 + h * z_b, 0.0, 0.048)


def cornisa(mat, x0, y0, x1, y1, z, alto=0.2, vuelo=0.1):
    caja(mat, x0 - vuelo, y0 - vuelo, z - alto, x1 + vuelo, y1 + vuelo, z, sin=())


# ---------------------------------------------------------------- suelo, cerros y fondo
def ruido(x, y, escala, octavas=3):
    v, a, f, t = 0.0, 1.0, 1.0, 0.0
    for _ in range(octavas):
        v += a * noise.noise(Vector((x * f / escala, y * f / escala, 0.37 * f)))
        t += a; a *= 0.5; f *= 2.03
    return v / t


def altura_suelo(x, y):
    r = math.hypot(x, y)
    if r < 320:
        return 0.0
    k = min(1.0, (r - 320) / 1800.0)
    return k * k * (5.0 * ruido(x, y, 900) + 1.5 * ruido(x, y, 240))


def suelo():
    N, L = 150, 9500.0
    f = lambda t: L * (0.032 * t + 0.968 * t ** 5)
    cs = [f(-1 + 2 * i / N) for i in range(N + 1)]
    b = B('suelo')
    vs = [[b.verts.new((x, y, altura_suelo(x, y))) for x in cs] for y in cs]
    for j in range(N):
        for i in range(N):
            b.faces.new([vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]])


def color_suelo(p):
    v = 0.84 + 0.13 * ruido(p.x, p.y, 140) + 0.06 * ruido(p.x + 50, p.y, 31)
    c = max(0.62, min(1.0, v))
    calido = 0.5 + 0.5 * ruido(p.x, p.y + 300, 420)
    return (c, c * (0.97 + 0.02 * calido), c * (0.92 + 0.05 * calido), 1.0)


def cerros():
    """Cordillera de la Costa al poniente, lomas bajas al norte y al sur, y los Andes lejanos al oriente."""
    b = B('cerros')
    NA = 260
    oeste = math.radians(189.5); este = math.radians(9.5)

    def anillo(r0, r1, nr, alto, centro, ancho, base, semilla):
        rs = [r0 + (r1 - r0) * (j / (nr - 1)) ** 0.8 for j in range(nr)]
        grid = []
        for j, r in enumerate(rs):
            fila = []
            perfil = math.sin(math.pi * j / (nr - 1)) ** 0.7
            for i in range(NA):
                a = 2 * math.pi * i / NA
                dd = math.atan2(math.sin(a - centro), math.cos(a - centro))
                env = base + (1 - base) * math.exp(-(dd / ancho) ** 2)
                n = 0.55 + 0.45 * ruido(math.cos(a) * 9 + semilla, math.sin(a) * 9 + j * 0.31, 2.2, 4)
                fila.append(b.verts.new((math.cos(a) * r, math.sin(a) * r, max(0.0, alto * env * perfil * n) - 2.0)))
            grid.append(fila)
        for j in range(nr - 1):
            for i in range(NA):
                i2 = (i + 1) % NA
                b.faces.new([grid[j][i], grid[j][i2], grid[j + 1][i2], grid[j + 1][i]])

    anillo(3200, 10500, 12, 330, oeste, 0.9, 0.18, 3.1)
    anillo(15000, 21000, 9, 1150, este, 0.75, 0.05, 7.7)


def color_cerro(p):
    v = 0.78 + 0.22 * ruido(p.x, p.y, 700, 3)
    k = min(1.0, max(0.0, p.z / 300.0))
    return (v * (0.92 + 0.08 * k), v * (0.86 + 0.06 * k), v * (0.80 + 0.1 * k), 1.0)


def torta_ripios():
    """La torta de ripios al norte del campamento (residuos del proceso)."""
    b = B('ripios')
    x0, x1, y0, y1, h = -300.0, 140.0, 340.0, 640.0, 22.0
    nx, ny = 34, 24
    vs = []
    for j in range(ny + 1):
        fila = []
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx; y = y0 + (y1 - y0) * j / ny
            dx = min(x - x0, x1 - x) / 60.0; dy = min(y - y0, y1 - y) / 60.0
            k = max(0.0, min(1.0, min(dx, dy)))
            z = h * (k * k * (3 - 2 * k)) * (0.9 + 0.1 * ruido(x, y, 40)) - 0.5
            fila.append(b.verts.new((x, y, z)))
        vs.append(fila)
    for j in range(ny):
        for i in range(nx):
            b.faces.new([vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]])


def color_ripio(p):
    v = 0.8 + 0.2 * ruido(p.x, p.y, 35)
    return (v, v * 0.97, v * 0.95, 1.0)


COLOR_FN = {'suelo': color_suelo, 'cerros': color_cerro, 'ripios': color_ripio}   # 'hojas' se agrega abajo


def sector_industrial():
    # Chimenea de unos 40 m (expediente UNESCO) y galpones de pino oregón y calamina.
    cx, cy = -430.0, 450.0
    caja('ladrillo', cx - 3.2, cy - 3.2, 0, cx + 3.2, cy + 3.2, 3.5)
    cilindro('ladrillo', cx, cy, 3.5, 40.0, 1.7, 1.05, seg=14)
    cilindro('metal', cx, cy, 39.6, 40.4, 1.2, 1.2, seg=14)
    for (gx, gy, w, d, h) in [(-480, 420, 70, 26, 11), (-390, 505, 55, 22, 9), (-505, 480, 40, 30, 13), (-360, 430, 30, 18, 7)]:
        caja('madera_oscura', gx - w / 2, gy - d / 2, 0, gx + w / 2, gy + d / 2, h)
        techo2('calamina', gx - w / 2, gy - d / 2, gx + w / 2, gy + d / 2, h, d * 0.18, eje='x', muro='madera_oscura')


# ---------------------------------------------------------------- vegetación y mobiliario
def tubo_curvo(mat, pts, radios, seg=7):
    """Tubo continuo por una polilínea (marcos de transporte paralelo), con UV cilíndricas para la corteza."""
    b = B(mat)
    uv = b.loops.layers.uv.get('UVMap') or b.loops.layers.uv.new('UVMap')
    pts = [Vector(p) for p in pts]
    n = len(pts)
    tans = [(pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized() for i in range(n)]
    ref = Vector((1, 0, 0)) if abs(tans[0].x) < 0.9 else Vector((0, 1, 0))
    nrm = tans[0].cross(ref).normalized()
    largos = [0.0]
    for i in range(1, n):
        largos.append(largos[-1] + (pts[i] - pts[i - 1]).length)
    anillos = []
    for i in range(n):
        if i > 0:
            eje = tans[i - 1].cross(tans[i])
            if eje.length > 1e-6:
                nrm = Matrix.Rotation(tans[i - 1].angle(tans[i]), 3, eje.normalized()) @ nrm
        bi = tans[i].cross(nrm).normalized()
        anillos.append([b.verts.new(pts[i] + (nrm * math.cos(2 * math.pi * k / seg) + bi * math.sin(2 * math.pi * k / seg)) * radios[i])
                        for k in range(seg)])
    tam = TEX_INFO['corteza']['tam'] if mat == 'tronco' else 1.0
    for i in range(n - 1):
        circ = max(0.12, 2 * math.pi * (radios[i] + radios[i + 1]) / 2)
        for k in range(seg):
            k2 = (k + 1) % seg
            f = b.faces.new([anillos[i][k], anillos[i][k2], anillos[i + 1][k2], anillos[i + 1][k]])
            f.smooth = True
            for l, u, v in zip(f.loops, (k / seg, (k + 1) / seg, (k + 1) / seg, k / seg),
                               (largos[i], largos[i], largos[i + 1], largos[i + 1])):
                l[uv].uv = (u * circ / tam, v / tam)


NORMALES_HOJAS = []     # una normal por vértice de 'hojas', en el orden de creación (normales «de copa»)


def tarjetas(rnd, c, rc, n, tam, copa_c, copa_r, aplast, tinte, z_min=0.25):
    """Racimo de tarjetas de hojas alrededor de `c`. Sus normales salen del centro de la copa: la copa se sombrea
    como un volumen y no como un montón de planos."""
    b = B('hojas')
    uv = b.loops.layers.uv.get('UVMap') or b.loops.layers.uv.new('UVMap')
    ao = b.verts.layers.float.get('ao') or b.verts.layers.float.new('ao')
    ti = [b.verts.layers.float.get(k) or b.verts.layers.float.new(k) for k in ('tr', 'tg', 'tb')]
    for _ in range(n):
        p = c + Vector((rnd.gauss(0, 0.45), rnd.gauss(0, 0.45), rnd.gauss(0, 0.32))) * rc
        p.z = max(z_min, p.z)
        nn = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.4, 1.0))).normalized()
        a = nn.cross(Vector((0, 0, 1)) if abs(nn.z) < 0.95 else Vector((1, 0, 0))).normalized()
        bb = nn.cross(a)
        giro = rnd.uniform(0, 2 * math.pi)
        u = a * math.cos(giro) + bb * math.sin(giro)
        v = nn.cross(u)
        s = tam * rnd.uniform(0.75, 1.25) / 2
        esquinas = [p - u * s - v * s, p + u * s - v * s, p + u * s + v * s, p - u * s + v * s]
        vs = [b.verts.new(q) for q in esquinas]
        f = b.faces.new(vs)
        f.smooth = True
        voltear = rnd.random() < 0.5
        for l, (uu, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            l[uv].uv = (1 - uu if voltear else uu, vv)
        for q, vert in zip(esquinas, vs):
            d = q - copa_c
            d.z /= aplast
            r = d.length / copa_r
            nrm = (d.normalized() * 0.75 + Vector((0, 0, 0.45))).normalized()
            NORMALES_HOJAS.append(tuple(nrm))
            alto = max(0.0, min(1.0, 0.5 + d.z / (2 * copa_r * aplast)))
            vert[ao] = max(0.35, min(1.0, 0.42 + 0.38 * alto + 0.3 * min(1.0, r)))
            vert[ti[0]], vert[ti[1]], vert[ti[2]] = tinte


def rama(rnd, p0, d, largo, r0, r1, caida, nseg=None):
    """Rama curva: se tuerce un poco al azar y se dobla hacia abajo con el peso. Devuelve la punta y su dirección."""
    nseg = nseg or max(3, int(largo / 0.45))
    pts, rads = [Vector(p0)], [r0]
    p, dd = Vector(p0), Vector(d).normalized()
    for i in range(1, nseg + 1):
        t = i / nseg
        dd = (dd + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.6, 0.6))) * 0.16
              - Vector((0, 0, caida * t * 0.35))).normalized()
        p = p + dd * (largo / nseg)
        pts.append(p.copy()); rads.append(r0 + (r1 - r0) * t)
    tubo_curvo('tronco', pts, rads, seg=max(4, min(9, int(5 + r0 * 30))))
    return p, dd, pts


def girar(d, az, elev):
    """Dirección con azimut `az` y elevación `elev` (radianes) sobre la horizontal."""
    return Vector((math.cos(az) * math.cos(elev), math.sin(az) * math.cos(elev), math.sin(elev)))


def arbol(x, y, alto, copa, semilla, tipo='algarrobo', col=True):
    """Tamarugo o algarrobo (Prosopis): tronco corto que se divide, ramas que se abren casi en horizontal y
    follaje fino y colgante. El tamarugo se parte desde abajo en varios fustes y es más gris; el algarrobo
    tiene un tronco único y copa de paraguas, de un verde más oliva."""
    rnd = random.Random(semilla)
    base = Vector((x, y, -0.15))
    tam = alto / 6.0
    copa_c = Vector((x, y, alto * (0.62 if tipo == 'algarrobo' else 0.58)))
    aplast = 0.5 if tipo == 'algarrobo' else 0.62
    tinte = (1.05, 1.0, 0.84) if tipo == 'algarrobo' else (0.93, 0.99, 1.02)
    v = rnd.uniform(0.9, 1.08)
    tinte = tuple(c * v for c in tinte)
    puntas = []
    if tipo == 'tamarugo':
        fustes = []
        horca = Vector((x + rnd.uniform(-0.2, 0.2), y + rnd.uniform(-0.2, 0.2), alto * rnd.uniform(0.13, 0.2)))
        rama(rnd, base, horca - base, (horca - base).length, 0.24 * tam, 0.2 * tam, 0.0, nseg=3)
        n1 = rnd.randint(2, 3)
        for i in range(n1):
            az = 2 * math.pi * i / n1 + rnd.uniform(-0.5, 0.5)
            fustes.append((horca, girar(None, az, math.radians(rnd.uniform(48, 62))), alto * 0.36, 0.16 * tam, 0.09 * tam, az))
    else:
        horca = Vector((x + rnd.uniform(-0.3, 0.3), y + rnd.uniform(-0.3, 0.3), alto * rnd.uniform(0.28, 0.34)))
        rama(rnd, base, horca - base + Vector((0, 0, 0.2)), (horca - base).length, 0.22 * tam, 0.17 * tam, 0.0, nseg=4)
        n1 = rnd.randint(4, 5)
        fustes = []
        for i in range(n1):
            az = 2 * math.pi * i / n1 + rnd.uniform(-0.4, 0.4)
            fustes.append((horca, girar(None, az, math.radians(rnd.uniform(32, 46))), copa * 0.48, 0.12 * tam, 0.065 * tam, az))
    for (p0, d, L, r0, r1, az) in fustes:
        p1, d1, _ = rama(rnd, p0, d, L, r0, r1, 0.2)
        for j in range(rnd.randint(2, 3)):
            az2 = az + rnd.uniform(-0.75, 0.75)
            el2 = math.radians(rnd.uniform(8, 38) if tipo == 'algarrobo' else rnd.uniform(15, 45))
            p2, d2, pts2 = rama(rnd, p1, girar(None, az2, el2), copa * rnd.uniform(0.36, 0.5), r1 * 0.75, r1 * 0.35, 0.5)
            for k in range(2):
                az3 = az2 + rnd.uniform(-0.9, 0.9)
                p3, d3, pts3 = rama(rnd, p2, girar(None, az3, math.radians(rnd.uniform(-5, 30))), copa * rnd.uniform(0.22, 0.32),
                                    r1 * 0.32, 0.012, 0.9, nseg=3)
                puntas.append(p3)
                puntas.append(pts3[1])
            puntas.append(pts2[len(pts2) // 2])
    # follaje: racimos en las puntas y a media rama; el borde cuelga un poco (follaje llorón de los Prosopis)
    for p in puntas:
        afuera = math.hypot(p.x - x, p.y - y) / copa
        c = p + Vector((0, 0, -0.25 * tam * afuera))
        tarjetas(rnd, c, 0.95 * tam, rnd.randint(9, 12), 1.35 * tam, copa_c, copa, aplast, tinte, z_min=alto * 0.3)
    for i in range(6):                        # relleno del centro de la copa
        az = rnd.uniform(0, 2 * math.pi); rr = rnd.uniform(0.2, 0.6) * copa
        c = copa_c + Vector((math.cos(az) * rr, math.sin(az) * rr, rnd.uniform(0.0, 0.35) * copa * aplast))
        tarjetas(rnd, c, 1.1 * tam, 8, 1.5 * tam, copa_c, copa, aplast, tinte, z_min=alto * 0.35)
    if col:
        colision(x - 0.35, y - 0.35, x + 0.35, y + 0.35)


def color_hojas(p):
    return (1.0, 1.0, 1.0, 1.0)


COLOR_FN['hojas'] = color_hojas


def banca(x, y, ang):
    c, s = math.cos(ang), math.sin(ang)
    def P(dx, dy):
        return x + dx * c - dy * s, y + dx * s + dy * c
    cx, cy = P(0, 0)
    caja_rot('madera_oscura', cx, cy, 0.45, 1.9, 0.42, 0.06, ang)
    bx, by = P(0, 0.2)
    caja_rot('madera_oscura', bx, by, 0.72, 1.9, 0.05, 0.36, ang)
    for dx in (-0.8, 0.8):
        px_, py_ = P(dx, 0)
        caja_rot('metal', px_, py_, 0.22, 0.06, 0.4, 0.44, ang)
    hx, hy = (1.0, 0.32) if abs(c) > 0.5 else (0.32, 1.0)
    colision(cx - hx, cy - hy, cx + hx, cy + hy)


def farol_plaza(x, y):
    """Farol de tres luces, como los que se ven en la plaza."""
    cilindro('metal', x, y, 0.0, 0.5, 0.17, 0.13, seg=10)
    cilindro('metal', x, y, 0.5, 4.3, 0.075, 0.06, seg=8)
    caja('metal', x - 0.62, y - 0.03, 4.18, x + 0.62, y + 0.03, 4.24, sin=())
    for dx in (-0.6, 0.0, 0.6):
        z = 4.36 if dx == 0 else 4.0
        if dx != 0:
            caja('metal', x + dx - 0.015, y - 0.015, z + 0.3, x + dx + 0.015, y + 0.015, 4.2, sin=())
        cilindro('vidrio', x + dx, y, z, z + 0.34, 0.11, 0.15, seg=6)
        cilindro('metal', x + dx, y, z + 0.34, z + 0.44, 0.17, 0.03, seg=6)
    colision(x - 0.25, y - 0.25, x + 0.25, y + 0.25)


def barril(x, y, z0=0.0, h=0.9, r=0.3, col=False):
    """Barril de duelas, abombado, con cuatro zunchos de fierro."""
    seg, n = 12, 6
    b = B('madera_oscura')
    perfil = lambda t: r * (0.86 + 0.14 * math.sin(math.pi * t))
    anillos = [[b.verts.new((x + perfil(i / n) * math.cos(2 * math.pi * k / seg), y + perfil(i / n) * math.sin(2 * math.pi * k / seg),
                             z0 + h * i / n)) for k in range(seg)] for i in range(n + 1)]
    for i in range(n):
        for k in range(seg):
            k2 = (k + 1) % seg
            b.faces.new([anillos[i][k], anillos[i][k2], anillos[i + 1][k2], anillos[i + 1][k]]).smooth = True
    b.faces.new(anillos[n])
    for t in (0.1, 0.32, 0.68, 0.9):
        cilindro('metal', x, y, z0 + h * t - 0.022, z0 + h * t + 0.022, perfil(t) + 0.006, seg=seg, tapas=False)
    if col:
        colision(x - r, y - r, x + r, y + r)


def cajon(x, y, z0, w, d, h, ang=0.0):
    """Cajón de tablas de pino con listones en las esquinas."""
    caja_rot('madera_cruda', x, y, z0 + h / 2, w, d, h, ang)
    c, s = math.cos(ang), math.sin(ang)
    for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        px_ = x + (sx * (w / 2 - 0.02)) * c - (sy * (d / 2 - 0.02)) * s
        py_ = y + (sx * (w / 2 - 0.02)) * s + (sy * (d / 2 - 0.02)) * c
        caja_rot('madera_oscura', px_, py_, z0 + h / 2, 0.06, 0.06, h + 0.01, ang)
    caja_rot('madera_oscura', x, y, z0 + h * 0.5, w + 0.012, d + 0.012, 0.06, ang)


def saco(cx, cy, cz, ang, semilla):
    rnd = random.Random(semilla)
    M = Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Diagonal((0.36, 0.24, 0.14, 1.0))
    res = bmesh.ops.create_icosphere(B('arpillera'), subdivisions=2, radius=1.0, matrix=M)
    for v in res['verts']:
        v.co += noise.noise_vector(v.co * 3.0 + Vector((semilla, 0, 0))) * 0.035
        v.co.z = max(v.co.z, cz - 0.11)
    _suavizar(res, solo_lados=False)


def pila_sacos(x, y, z0, ang):
    """Sacos de arpillera apilados en pirámide (harina, azúcar, porotos de la pulpería)."""
    c, s = math.cos(ang), math.sin(ang)
    n = 0
    for fila, (cuantos, dz) in enumerate(((3, 0.12), (2, 0.36), (1, 0.6))):
        for i in range(cuantos):
            off = (i - (cuantos - 1) / 2) * 0.5
            n += 1
            saco(x - off * s, y + off * c, z0 + dz, ang + math.pi / 2 + random.uniform(-0.12, 0.12), 40 + n)


def rueda(c, eje, R=0.72, ancho=0.08):
    """Rueda de rayos con llanta de fierro; `eje` es la dirección del eje (horizontal)."""
    eje = Vector(eje).normalized()
    a = eje.cross(Vector((0, 0, 1))).normalized()
    z = Vector((0, 0, 1))
    pts = [c + (a * math.cos(2 * math.pi * k / 20) + z * math.sin(2 * math.pi * k / 20)) * R for k in range(21)]
    for p, q in zip(pts, pts[1:]):
        tubo('madera_oscura', p, q, 0.05, seg=5)
        tubo('metal', p * 1.0 + (p - c).normalized() * 0.045, q + (q - c).normalized() * 0.045, 0.022, seg=4)
    tubo('madera_oscura', c - eje * ancho * 1.6, c + eje * ancho * 1.6, 0.1, 0.08, seg=8)
    for k in range(12):
        ang = 2 * math.pi * k / 12
        tubo('madera_oscura', c + (a * math.cos(ang) + z * math.sin(ang)) * 0.09,
             c + (a * math.cos(ang) + z * math.sin(ang)) * (R - 0.03), 0.022, 0.016, seg=4)


def carreta(x, y, ang):
    """Carreta de dos ruedas, de las que repartían agua y mercadería en los campamentos; las varas en el suelo."""
    L = Vector((math.cos(ang), math.sin(ang), 0)); W = Vector((-math.sin(ang), math.cos(ang), 0))
    C = Vector((x, y, 0))
    R = 0.72
    caja_rot('madera_oscura', x, y, R + 0.32, 2.5, 1.36, 0.07, ang)
    for sgn in (-1, 1):
        p = C + W * sgn * 0.66
        caja_rot('madera_cruda', p.x, p.y, R + 0.52, 2.5, 0.05, 0.36, ang)
        rueda(C + W * sgn * 0.84 + Vector((0, 0, R)), W)
        a = C + W * sgn * 0.5 + L * 1.2 + Vector((0, 0, R + 0.28))
        b = C + W * sgn * 0.55 + L * 3.4 + Vector((0, 0, 0.06))
        tubo('madera_oscura', a, b, 0.045, 0.035, seg=6)
    for sgn in (-1, 1):
        p = C + L * sgn * 1.23
        caja_rot('madera_cruda', p.x, p.y, R + 0.52, 0.05, 1.36, 0.36, ang)
    tubo('metal', C - W * 0.92 + Vector((0, 0, R)), C + W * 0.92 + Vector((0, 0, R)), 0.035, seg=6)
    xs = [(C + L * a + W * b) for a in (-1.4, 3.4) for b in (-1.0, 1.0)]
    colision(min(p.x for p in xs), min(p.y for p in xs), max(p.x for p in xs), max(p.y for p in xs))


def mesa_sillas(x, y, z0):
    """Mesa redonda y dos sillas de madera en la terraza del hotel."""
    cilindro('madera_blanca', x, y, z0 + 0.7, z0 + 0.74, 0.42, seg=16)
    cilindro('madera_oscura', x, y, z0, z0 + 0.7, 0.04, seg=6)
    cilindro('madera_oscura', x, y, z0, z0 + 0.03, 0.22, seg=10)
    for sgn in (-1, 1):
        sx, sy = x, y + sgn * 0.66
        caja('madera_blanca', sx - 0.21, sy - 0.2, z0 + 0.43, sx + 0.21, sy + 0.2, z0 + 0.47, sin=())
        yb = sy + sgn * 0.19
        caja('madera_blanca', sx - 0.21, yb - 0.02, z0 + 0.47, sx + 0.21, yb + 0.02, z0 + 0.92, sin=())
        for (dx, dy) in ((-0.18, -0.17), (0.18, -0.17), (-0.18, 0.17), (0.18, 0.17)):
            caja('madera_oscura', sx + dx - 0.018, sy + dy - 0.018, z0, sx + dx + 0.018, sy + dy + 0.018, z0 + 0.43, sin=('-z',))


POSTES = []


def poste(x, y, perp=(1.0, 0.0), farol=None):
    """Poste de madera con dos crucetas perpendiculares a la línea y aisladores; `farol` = dirección del brazo."""
    cilindro('madera_oscura', x, y, 0.0, 8.6, 0.13, 0.10, seg=7)
    ang = math.atan2(perp[1], perp[0])
    caja_rot('madera_oscura', x, y, 7.91, 2.2, 0.12, 0.12, ang)
    caja_rot('madera_oscura', x, y, 7.2, 1.4, 0.12, 0.10, ang)
    for k in (-1.0, 0.0, 1.0):
        cilindro('vidrio', x + perp[0] * k, y + perp[1] * k, 7.97, 8.12, 0.035, 0.03, seg=5)
    if farol:
        lx, ly = x + farol[0] * 1.3, y + farol[1] * 1.3
        tubo('metal', (x, y, 5.64), (lx, ly, 5.64), 0.025, seg=4)
        cilindro('metal', lx, ly, 5.42, 5.64, 0.22, 0.05, seg=8)
        cilindro('vidrio', lx, ly, 5.28, 5.42, 0.09, 0.12, seg=6)
    colision(x - 0.2, y - 0.2, x + 0.2, y + 0.2)
    POSTES.append((x, y))


def linea_postes(puntos, farol=None):
    def perp_de(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        return (-dy / L, dx / L)
    for i, p in enumerate(puntos):
        a, b = puntos[max(0, i - 1)], puntos[min(len(puntos) - 1, i + 1)]
        poste(p[0], p[1], perp_de(a, b), farol)
    for (a, b) in zip(puntos, puntos[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        px_, py_ = perp_de(a, b)
        for k in (-1.0, 0.0, 1.0):
            pts = [Vector((a[0] + dx * t + px_ * k, a[1] + dy * t + py_ * k, 8.12 - 0.45 * 4 * t * (1 - t)))
                   for t in (i / 8 for i in range(9))]
            for p, q in zip(pts, pts[1:]):
                tubo('cable', p, q, 0.012, seg=3)


# ---------------------------------------------------------------- la plaza
def plaza():
    X, Y = 24.0, 26.0
    caja('plaza', -X, -Y, 0.0, X, Y, 0.11, sin=('-z',))
    for (x0, y0, x1, y1) in [(-X - 0.3, -Y - 0.3, X + 0.3, -Y), (-X - 0.3, Y, X + 0.3, Y + 0.3),
                             (-X - 0.3, -Y, -X, Y), (X, -Y, X + 0.3, Y)]:
        caja('concreto', x0, y0, 0.0, x1, y1, 0.18)
    # senderos en cruz y diagonales, con un círculo central
    caja('concreto', -1.3, -Y, 0.11, 1.3, Y, 0.135)
    caja('concreto', -X, -1.3, 0.11, X, 1.3, 0.135)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ang = math.atan2(sy * Y, sx * X)
            L = math.hypot(X, Y)
            caja_rot('concreto', sx * X / 2, sy * Y / 2, 0.123, L, 2.2, 0.025, ang)
    cilindro('concreto', 0, 0, 0.11, 0.155, 5.6, seg=32)
    # pérgola con techo de cañas en el costado poniente (da sombra a rayas)
    px0, px1, py0, py1 = -23.0, -19.6, -16.0, 16.0
    for y in [py0 + i * 3.2 for i in range(11)]:
        for x in (px0, px1):
            caja('madera_oscura', x - 0.08, y - 0.08, 0.11, x + 0.08, y + 0.08, 2.75, sin=('-z',))
            colision(x - 0.15, y - 0.15, x + 0.15, y + 0.15)
    for x in (px0, px1):
        caja('madera_oscura', x - 0.09, py0 - 0.4, 2.75, x + 0.09, py1 + 0.4, 2.95, sin=())
    y = py0 - 0.3
    while y < py1 + 0.3:
        caja('cana', px0 - 0.5, y, 2.95, px1 + 0.5, y + 0.07, 3.0, sin=())
        y += 0.24
    for y in (-11.2, -4.8, 4.8, 11.2):
        banca(-21.3, y, -math.pi / 2)
    # bancas junto a los senderos
    for (x, y, a) in [(6.5, 3.2, 0), (-6.5, 3.2, 0), (6.5, -3.2, math.pi), (-6.5, -3.2, math.pi),
                      (3.2, 9.5, math.pi / 2), (-3.2, -9.5, -math.pi / 2), (3.2, -9.5, math.pi / 2), (-3.2, 9.5, -math.pi / 2)]:
        banca(x, y, a)
    # árboles: algarrobos y tamarugos (expediente UNESCO), en hileras junto al borde y en los cuadrantes
    n = 0
    for x in (-15.0, -7.5, 7.5, 15.0):
        for y in (-22.5, 22.5):
            n += 1
            arbol(x + random.uniform(-0.6, 0.6), y + random.uniform(-0.5, 0.5), random.uniform(5.4, 6.8),
                  random.uniform(2.6, 3.3), 100 + n, 'algarrobo' if n % 3 else 'tamarugo')
    for y in (-15.0, -7.5, 7.5, 15.0):
        n += 1
        arbol(20.5 + random.uniform(-0.4, 0.4), y, random.uniform(5.2, 6.6), random.uniform(2.5, 3.1), 100 + n,
              'tamarugo' if n % 2 else 'algarrobo')
    for (x, y) in [(-12, -13), (12, -13), (-12, 13), (12, 13), (-15.5, 0.0), (15.5, 0.0)]:
        n += 1
        arbol(x + random.uniform(-1, 1), y + random.uniform(-1, 1), random.uniform(6.0, 7.4), random.uniform(3.0, 3.8),
              100 + n, 'algarrobo' if n % 2 else 'tamarugo')
    for (x, y) in [(-9.0, 8.5), (9.0, -8.5), (9.0, 8.5), (-9.0, -8.5)]:
        farol_plaza(x, y)
    # cercos de madera en el perímetro, con aberturas en los senderos (centro de cada lado y esquinas)
    def cerco(eje, fijo, a, b):
        L = X if eje == 'x' else Y
        cortes = sorted([(-1.6, 1.6), (L - 1.5, L + 1.5), (-L - 1.5, -L + 1.5)])
        segs, ini = [], a
        for (c0, c1) in cortes:
            if c1 < a or c0 > b:
                continue
            if c0 > ini:
                segs.append((ini, c0))
            ini = max(ini, c1)
        if ini < b:
            segs.append((ini, b))
        for (s0, s1) in segs:
            if s1 - s0 < 0.6:
                continue
            npost = max(2, int((s1 - s0) / 2.0) + 1)
            for i in range(npost):
                t = s0 + (s1 - s0) * i / (npost - 1)
                if eje == 'x':
                    caja('madera_oscura', t - 0.05, fijo - 0.05, 0.18, t + 0.05, fijo + 0.05, 0.85, sin=('-z',))
                else:
                    caja('madera_oscura', fijo - 0.05, t - 0.05, 0.18, fijo + 0.05, t + 0.05, 0.85, sin=('-z',))
            for z in (0.42, 0.72):
                if eje == 'x':
                    caja('madera_oscura', s0, fijo - 0.03, z, s1, fijo + 0.03, z + 0.08, sin=())
                else:
                    caja('madera_oscura', fijo - 0.03, s0, z, fijo + 0.03, s1, z + 0.08, sin=())
            if eje == 'x':
                colision(s0, fijo - 0.25, s1, fijo + 0.25)
            else:
                colision(fijo - 0.25, s0, fijo + 0.25, s1)
    cerco('x', -Y + 0.15, -X + 0.15, X - 0.15)
    cerco('x', Y - 0.15, -X + 0.15, X - 0.15)
    cerco('y', -X + 0.15, -Y + 0.15, Y - 0.15)
    cerco('y', X - 0.15, -Y + 0.15, Y - 0.15)


# ---------------------------------------------------------------- edificios
LADO_N = {'+x': (1, 0, 0), '-x': (-1, 0, 0), '+y': (0, 1, 0), '-y': (0, -1, 0)}


def plano(mat, lado, p, t0, t1, z0, z1):
    """Rectángulo vertical en el plano x = p (lado ±x) o y = p (lado ±y), mirando hacia `lado`."""
    if t1 - t0 < 1e-4 or z1 - z0 < 1e-4:
        return
    if lado[1] == 'x':
        pts = [(p, t0, z0), (p, t1, z0), (p, t1, z1), (p, t0, z1)]
    else:
        pts = [(t0, p, z0), (t1, p, z0), (t1, p, z1), (t0, p, z1)]
    cara(mat, pts, LADO_N[lado])


def plano_vanos(mat, lado, p, t0, t1, z0, z1, vanos=()):
    """Rectángulo vertical con vanos (t0, t1, z0, z1) recortados: se parte en franjas."""
    vanos = [(max(a, t0), min(b, t1), max(c, z0), min(d, z1)) for (a, b, c, d) in vanos if b > t0 and a < t1]
    ts = sorted({t0, t1, *[v[0] for v in vanos], *[v[1] for v in vanos]})
    for a, b in zip(ts, ts[1:]):
        m = (a + b) / 2
        zz = z0
        for (c, d) in sorted((v[2], v[3]) for v in vanos if v[0] < m < v[1]):
            plano(mat, lado, p, a, b, zz, max(zz, c))
            zz = max(zz, d)
        plano(mat, lado, p, a, b, zz, z1)


def losa(mat, x0, y0, x1, y1, z, arriba=True):
    cara(mat, [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], (0, 0, 1 if arriba else -1))


def jambas(mat, eje, p0, p1, t0, t1, z0, z1, umbral=False):
    """Caras interiores de un vano que atraviesa un muro entre los planos p0 y p1 (eje 'x' o 'y' del muro)."""
    if eje == 'y':      # muro paralelo a x: el vano va en x (t), el grosor en y
        cara(mat, [(t0, p0, z0), (t0, p1, z0), (t0, p1, z1), (t0, p0, z1)], (1, 0, 0))
        cara(mat, [(t1, p0, z0), (t1, p1, z0), (t1, p1, z1), (t1, p0, z1)], (-1, 0, 0))
        cara(mat, [(t0, p0, z1), (t1, p0, z1), (t1, p1, z1), (t0, p1, z1)], (0, 0, -1))
        if umbral:
            cara(mat, [(t0, p0, z0), (t1, p0, z0), (t1, p1, z0), (t0, p1, z0)], (0, 0, 1))
    else:               # muro paralelo a y
        cara(mat, [(p0, t0, z0), (p1, t0, z0), (p1, t0, z1), (p0, t0, z1)], (0, 1, 0))
        cara(mat, [(p0, t1, z0), (p1, t1, z0), (p1, t1, z1), (p0, t1, z1)], (0, -1, 0))
        cara(mat, [(p0, t0, z1), (p1, t0, z1), (p1, t1, z1), (p0, t1, z1)], (0, 0, -1))
        if umbral:
            cara(mat, [(p0, t0, z0), (p1, t0, z0), (p1, t1, z0), (p0, t1, z0)], (0, 0, 1))


# Teatro (1935-1936). Volumen: 31 × 17 m (expediente UNESCO). Las fachadas son fotos actuales de Wikimedia Commons
# enderezadas (scripts/3d/teatro_fotos.py); por eso se ve como hoy, gastado, y no recién pintado.
# Medidas tomadas de esas fotos con la escala de los 31 m: muro alto 10,7 m (el expediente dice 11); el tramo
# oriente baja a 9,65 m. Vestíbulo de tres volúmenes con tres vanos; cuerpo bajo al oriente; boletería al poniente.
TE = dict(x0=-15.5, x1=15.5, y0=44.0, y1=61.0, H=10.7, H2=9.65, xs=11.2, e=0.3)
VEST = [(-9.63, -4.85, 39.6, 5.25), (-4.85, 5.84, 40.0, 5.86), (5.84, 10.89, 39.6, 5.25)]   # x0, x1, y del frente, alto
ANEXO = (10.89, 15.55, 40.6, 4.6)      # cuerpo bajo: frente en y 40,6 y sigue por el costado oriente hasta y 61
VANOS_VEST = [(-4.18, -1.47), (-0.56, 1.80), (2.61, 5.30)]
Z_VANO = (0.23, 2.88)
PUERTA_SALA = (-0.4, 1.7, 2.6)        # de vestíbulo a sala, en el muro sur, a la altura del pasillo transversal
# Sala: medida en las fotos interiores (ancho completo, cielo plano a ~8 m, galería al oriente sobre seis pilares)
SA = dict(x0=-8.0, x1=15.2, y0=44.3, y1=60.7, H=8.2, yc=52.5)
BOCA = dict(y0=48.23, y1=56.77, z0=1.0, z1=7.32, v0=48.90, v1=56.11, vz=6.70, fondo=0.35)   # panel de la foto y vano
GALERIA = dict(x0=9.8, z0=3.6, z1=4.3)
FOTO_UV = {   # material: (eje horizontal, coordenada en u=0, en u=1, z en v=0, en v=1)
    'teatro_frente': ('x', -15.5, 15.5, 0.0, 10.8),
    'teatro_vestibulo': ('x', -10.6, 17.4, 0.0, 6.3),
    'teatro_oeste': ('y', 61.0, 44.0, 0.0, 10.7),
    'teatro_norte': ('x', 15.5, -15.5, 0.0, 10.7),
    'teatro_este': ('y', 44.0, 61.0, 4.3, 9.65),
    'teatro_este_bajo': ('y', 40.6, 61.0, 0.0, 4.6),
    'teatro_anexo': ('x', 10.89, 15.7, 0.0, 4.6),   # la foto llega hasta x 15,7
    'int_escenario': ('y', BOCA['y0'], BOCA['y1'], BOCA['z0'], BOCA['z1']),
}


def teatro():
    """Calle Eleuterio Ramírez, frente a la plaza (norte). Fachadas con fotos; sala recorrible por dentro."""
    x0, x1, y0, y1, H, H2, xs, e = (TE[k] for k in ('x0', 'x1', 'y0', 'y1', 'H', 'H2', 'xs', 'e'))
    T = 'teatro_tablas'
    # ---- muro sur (frente): solo las partes que no tapan el vestíbulo y el cuerpo bajo
    F = 'teatro_frente'
    (a0, a1, _, ha), (b0, b1, yb, hb), (c0, c1, _, hc) = VEST
    plano(F, '-y', y0, x0, a0, 0, H)
    plano(F, '-y', y0, a0, a1, ha, H)
    plano(F, '-y', y0, b0, b1, hb, H)
    plano(F, '-y', y0, c0, c1, hc, H)
    plano(F, '-y', y0, c1, xs, ANEXO[3], H)
    plano(F, '-y', y0, xs, x1, ANEXO[3], H2)
    # ---- poniente, fondo y oriente
    plano('teatro_oeste', '-x', x0, y0, y1, 0, H)
    plano('teatro_norte', '+y', y1, x0, xs, 0, H)
    plano('teatro_norte', '+y', y1, xs, x1, 0, H2)
    plano('teatro_este', '+x', x1, y0, y1, ANEXO[3], H2)
    plano(T, '+x', xs, y0, y1, H2, H)                      # escalón del techo
    losa('concreto', x0, y0, xs, y1, H)
    losa('concreto', xs, y0, x1, y1, H2)
    # ---- cuerpo bajo oriente (frente en y 40,6 y costado hasta el fondo)
    ax0, ax1, ay, ah = ANEXO
    plano('teatro_anexo', '-y', ay, ax0, ax1, 0, ah)
    plano('teatro_este_bajo', '+x', ax1, ay, y1, 0, ah)
    plano(T, '+y', y1, x1, ax1, 0, ah)
    losa('concreto', ax0, ay, ax1, y0, ah)
    losa('concreto', x1, y0, ax1, y1, ah)
    colision(ax0, ay, ax1, y0); colision(x1, y0, ax1, y1)
    # ---- vestíbulo: tres volúmenes; el del centro, más alto y con los tres vanos
    V = 'teatro_vestibulo'
    plano(V, '-y', VEST[0][2], a0, a1, 0, ha)
    plano(V, '-y', VEST[2][2], c0, c1, 0, hc)
    plano_vanos(V, '-y', yb, b0, b1, 0, hb, [(p, q, *Z_VANO) for (p, q) in VANOS_VEST])
    yf = VEST[0][2]
    plano(T, '-x', a0, yf, y0, 0, ha)
    plano(T, '+x', a1, yf, yb, 0, ha)
    plano(T, '-x', c0, yf, yb, 0, hc)
    plano(T, '+x', c1, yf, ay, 0, hc)
    plano(T, '+x', c1, ay, y0, ah, hc)
    plano(T, '-x', b0, yb, y0, ha, hb)
    plano(T, '+x', b1, yb, y0, hc, hb)
    losa('concreto', a0, yf, a1, y0, ha); losa('concreto', c0, yf, c1, y0, hc); losa('concreto', b0, yb, b1, y0, hb)
    colision(a0, yf, a1, y0); colision(c0, yf, c1, y0)
    # pilares entre los vanos (colisión) y gradas de entrada
    bordes = [b0] + [v for par in VANOS_VEST for v in par] + [b1]
    for p, q in zip(bordes[0::2], bordes[1::2]):
        colision(p, yb, q, yb + e)
    caja('concreto', -9.8, 38.9, 0, 11.0, yf, 0.18, sin=('-z',))
    caja('concreto', -5.0, 38.45, 0, 6.0, 38.9, 0.09, sin=('-z',))
    # interior del vestíbulo (interpretación: no se encontraron fotos libres de este espacio)
    ix0, ix1, iy0, iy1, ih = b0 + e, b1 - e, yb + e, y0, 4.6
    C = 'int_vestibulo'
    plano_vanos(C, '+y', iy0, ix0, ix1, 0, ih, [(p, q, *Z_VANO) for (p, q) in VANOS_VEST])
    plano_vanos(C, '-y', iy1, ix0, ix1, 0, ih, [(PUERTA_SALA[0], PUERTA_SALA[1], 0, PUERTA_SALA[2])])
    plano(C, '+x', ix0, iy0, iy1, 0, ih)
    plano(C, '-x', ix1, iy0, iy1, 0, ih)
    losa(C, ix0, iy0, ix1, iy1, ih, arriba=False)
    losa('int_piso', ix0, iy0, ix1, iy1, 0.02)
    for (p, q) in VANOS_VEST:
        jambas('madera_roja', 'y', yb, iy0, p, q, Z_VANO[0], Z_VANO[1], umbral=True)
    colision(b0, yb, ix0, y0); colision(ix1, yb, b1, y0)
    caja('metal', 0.55, 41.9, 3.9, 0.75, 42.1, 4.6, sin=())          # lámpara colgante sencilla
    caja('int_ventana', 0.4, 41.75, 3.7, 0.9, 42.25, 3.9, sin=())
    # ---- boletería al poniente (volumen bajo; detalles aproximados)
    caja(T, -18.6, 41.6, 0, x0, 47.0, 2.9, sin=('-z',))
    caja('concreto', -18.8, 41.4, 2.9, x0, 47.2, 3.02, sin=())
    puerta('-y', 41.6, -17.2, 0.9, 2.1)
    ventana('-x', -18.6, 44.3, 1.0, 1.4, 0.9, cruz=False)
    colision(-18.6, 41.6, x0, 47.0)
    # ---- muros del volumen principal (colisiones), con la puerta a la sala
    p0, p1, _ = PUERTA_SALA
    colision(x0, y0, p0, y0 + e); colision(p1, y0, x1, y0 + e)
    colision(x0, y1 - e, x1, y1); colision(x0, y0, x0 + e, y1); colision(x1 - e, y0, x1, y1)
    jambas('madera_oscura', 'y', y0, y0 + e, p0, p1, 0, PUERTA_SALA[2])
    sala()


def butaca(x, y):
    """Butaca plegable de madera con costados de fierro fundido, mirando al escenario (−x)."""
    caja('int_butaca', x - 0.22, y - 0.245, 0.42, x + 0.17, y + 0.245, 0.47, sin=())
    caja('int_butaca', x + 0.17, y - 0.245, 0.5, x + 0.22, y + 0.245, 0.95, sin=())
    caja('metal', x - 0.2, y - 0.287, 0.0, x + 0.24, y - 0.263, 0.68, sin=('-z',))


def sala():
    X0, X1, Y0, Y1, H, yc = (SA[k] for k in ('x0', 'x1', 'y0', 'y1', 'H', 'yc'))
    A, C, Vd = 'int_aguamarina', 'int_crema', 'int_verde'
    zc = 7.8                                    # banda crema bajo el cielo
    vent_s = [(-3.45, 5.0, 6.25, 7.35)]         # la franja de ventanas del frente (vista en la foto de afuera)
    vent_n = [(-0.8, 2.2, 6.3, 7.3), (5.3, 8.7, 6.3, 7.3)]
    p0, p1, ph = PUERTA_SALA
    salidas = [(13.4, 14.6, 0, 2.4)]
    # ---- muros
    plano_vanos(A, '+y', Y0, X0, X1, 0, zc, [(p0, p1, 0, ph)])
    plano(C, '+y', Y0, X0, X1, zc, H)
    plano(A, '-y', Y1, X0, X1, 0, zc)
    plano(C, '-y', Y1, X0, X1, zc, H)
    plano(A, '-x', X1, Y0, Y1, 0, zc)
    plano(C, '-x', X1, Y0, Y1, zc, H)
    for (a, b, c, d) in vent_s:
        plano('int_ventana', '+y', Y0 + 0.01, a, b, c, d)
    for (a, b, c, d) in vent_n:
        plano('int_ventana', '-y', Y1 - 0.01, a, b, c, d)
    for (a, b, c, d) in vent_s + vent_n:       # montantes de las ventanas
        yy, ld = (Y0 + 0.02, '+y') if (a, b, c, d) in vent_s else (Y1 - 0.02, '-y')
        for t in np.arange(a, b + 0.01, (b - a) / max(1, round((b - a) / 0.7))):
            en_muro(Vd, ld, yy, t - 0.03, t + 0.03, c, d, 0, 0.04)
        en_muro(Vd, ld, yy, a, b, (c + d) / 2 - 0.03, (c + d) / 2 + 0.03, 0, 0.04)
    for (a, b, c, d) in salidas:                # salidas laterales bajo la galería (como en la foto desde atrás)
        plano('madera_oscura', '+y', Y0 + 0.01, a, b, c, d)
        plano('madera_oscura', '-y', Y1 - 0.01, a, b, c, d)
    # zócalo verde y filete a 1,2 m; filete bajo la banda crema
    for (lado, pl, t0, t1) in (('+y', Y0, X0, X1), ('-y', Y1, X0, X1), ('-x', X1, Y0, Y1)):
        en_muro(Vd, lado, pl, t0, t1, 0, 0.2, 0, 0.03)
        en_muro(Vd, lado, pl, t0, t1, 1.18, 1.24, 0, 0.03)
        en_muro(Vd, lado, pl, t0, t1, zc - 0.08, zc, 0, 0.05)
    # ---- pilastras con ménsulas de acero (verde) bajo el cielo
    for x in (-4.6, 3.0, GALERIA['x0']):
        for (lado, pl, s) in (('+y', Y0, 1), ('-y', Y1, -1)):
            en_muro(Vd, lado, pl, x - 0.22, x + 0.22, 0, zc, 0, 0.22)
            colision(x - 0.22, min(pl, pl + s * 0.22), x + 0.22, max(pl, pl + s * 0.22))
            if x == GALERIA['x0']:
                continue
            caja(Vd, x - 0.07, min(pl, pl + s * 1.9), 7.55, x + 0.07, max(pl, pl + s * 1.9), 7.72, sin=())
            tubo(Vd, (x, pl + s * 0.2, 5.6), (x, pl + s * 1.85, 7.58), 0.05, seg=4)
    # ---- cielo con el adorno escalonado art déco del centro (foto desde el escenario)
    losa(C, X0, Y0, X1, Y1, H, arriba=False)
    cx = 1.0
    for k, (w, d, z) in enumerate(((7.0, 4.8, H), (5.4, 3.6, H - 0.12), (3.8, 2.4, H - 0.24))):
        g = 0.16
        for (xa, ya, xb, yb_) in ((cx - w / 2, yc - d / 2, cx + w / 2, yc - d / 2 + g), (cx - w / 2, yc + d / 2 - g, cx + w / 2, yc + d / 2),
                                  (cx - w / 2, yc - d / 2, cx - w / 2 + g, yc + d / 2), (cx + w / 2 - g, yc - d / 2, cx + w / 2, yc + d / 2)):
            caja(Vd, xa, ya, z - 0.14, xb, yb_, z, sin=('+z',))
        if k == 2:
            losa(C, cx - w / 2 + g, yc - d / 2 + g, cx + w / 2 - g, yc + d / 2 - g, z - 0.14, arriba=False)
        else:
            caja(C, cx - w / 2 + g, yc - d / 2 + g, z - 0.14, cx + w / 2 - g, yc + d / 2 - g, z - 0.12, sin=('+z',))
    # ---- muro de la boca del escenario: panel de la foto (pilastras, cenefa, telón) y el resto aguamarina
    b = BOCA
    E = 'int_escenario'
    plano(A, '+x', X0, Y0, b['y0'], 0, b['z1']); plano(A, '+x', X0, b['y1'], Y1, 0, b['z1'])
    plano(C, '+x', X0, Y0, b['y0'], b['z1'], zc); plano(C, '+x', X0, b['y1'], Y1, b['z1'], zc)
    plano(C, '+x', X0, Y0, Y1, zc, H)
    plano(C, '+x', X0, b['y0'], b['y1'], b['z1'], zc)
    en_muro(Vd, '+x', X0, Y0, Y1, 7.5, 7.56, 0, 0.03)
    plano(E, '+x', X0, b['y0'], b['v0'], b['z0'], b['z1'])
    plano(E, '+x', X0, b['v1'], b['y1'], b['z0'], b['z1'])
    plano(E, '+x', X0, b['v0'], b['v1'], b['vz'], b['z1'])
    jambas(Vd, 'x', X0 - b['fondo'], X0, b['v0'], b['v1'], b['z0'], b['vz'])
    plano(E, '+x', X0 - b['fondo'], b['v0'], b['v1'], b['z0'], b['vz'])            # el telón, un poco atrás
    losa('int_piso', X0 - b['fondo'], b['v0'], X0, b['v1'], b['z0'])
    en_muro(Vd, '+x', X0, Y0, Y1, 0, 0.2, 0, 0.03)
    # proscenio (frente del escenario) y gradas centrales verdes
    xa = X0 + 1.2
    caja(Vd, X0, b['y0'] - 0.3, 0, xa, b['y1'] + 0.3, b['z0'], sin=('-z', '-x', '+z'))
    losa('int_piso', X0, b['y0'] - 0.3, xa, b['y1'] + 0.3, b['z0'])
    for k in range(3):
        caja(Vd, xa, yc - 0.8, 0, xa + 0.6 - k * 0.2, yc + 0.8, (k + 1) / 3 * b['z0'], sin=('-z',))
    colision(-15.2, Y0, X0, Y1)
    colision(X0, b['y0'] - 0.3, xa + 0.6, b['y1'] + 0.3)
    # ---- piso de tablas, alfombra del pasillo central y del transversal
    losa('int_piso', X0, Y0, X1, Y1, 0.02)
    losa('int_alfombra', xa + 0.6, yc - 0.75, 13.4, yc + 0.75, 0.03)
    losa('int_alfombra', p0 - 0.2, Y0, p1 + 0.2, yc - 0.75, 0.03)
    losa('int_alfombra', p0 - 0.2, yc + 0.75, p1 + 0.2, Y1, 0.03)
    # ---- butacas: 11 por lado del pasillo central (como en la foto desde atrás), 6 filas antes del pasillo transversal
    # y 10 después, hasta la galería: 352 butacas, cerca de las «unas 360 personas» que da el Museo del Salitre
    filas = [-5.4 + 0.85 * k for k in range(6)] + [1.9 + 0.85 * k for k in range(10)]
    bloques = [(45.45, 51.5), (53.5, 59.55)]
    for x in filas:
        for (ya, yb_) in bloques:
            for j in range(11):
                butaca(x, ya + 0.275 + 0.55 * j)
            caja('metal', x - 0.2, yb_ - 0.012, 0.0, x + 0.24, yb_ + 0.012, 0.68, sin=('-z',))
    for (ya, yb_) in bloques:
        colision(filas[0] - 0.25, ya, filas[5] + 0.26, yb_)
        colision(filas[6] - 0.25, ya, filas[-1] + 0.26, yb_)
    # ---- galería al fondo: losa sobre seis pilares, baranda, gradas de bancas y caseta de proyección
    g = GALERIA
    gx = g['x0']
    caja('int_tablero', gx, Y0, g['z0'], gx + 0.12, Y1, g['z1'] + 0.3, sin=())
    losa(C, gx, Y0, X1, Y1, g['z0'], arriba=False)
    caja(Vd, gx - 0.02, Y0, g['z1'] + 0.62, gx + 0.1, Y1, g['z1'] + 0.68, sin=())
    for t in np.arange(Y0 + 0.5, Y1, 1.0):
        caja('metal', gx + 0.02, t - 0.015, g['z1'] + 0.3, gx + 0.05, t + 0.015, g['z1'] + 0.62, sin=())
    for y in (45.8, 48.4, 51.0, 54.0, 56.6, 59.2):
        caja(Vd, gx + 0.1, y - 0.1, 0, gx + 0.3, y + 0.1, g['z0'], sin=('-z', '+z'))
        colision(gx + 0.05, y - 0.15, gx + 0.35, y + 0.15)
    for k in range(5):
        xa_ = gx + 0.12 + 0.85 * k
        za = g['z1'] + 0.35 * k
        caja('int_galeria', xa_, Y0, g['z0'] if k == 0 else za - 0.35, X1, Y1, za, sin=('-z',))
        for (ya, yb_) in ((Y0 + 0.3, yc - 1.4), (yc + 1.4, Y1 - 0.3)):
            caja('int_galeria', xa_ + 0.3, ya, za + 0.4, xa_ + 0.62, yb_, za + 0.45, sin=())
            caja('int_galeria', xa_ + 0.7, ya, za + 0.55, xa_ + 0.74, yb_, za + 0.95, sin=())
            for t in np.arange(ya + 0.4, yb_, 2.0):
                caja('metal', xa_ + 0.4, t - 0.02, za, xa_ + 0.5, t + 0.02, za + 0.4, sin=())
    caja('int_blanco', 13.4, yc - 1.1, g['z1'] + 1.4, X1, yc + 1.1, g['z1'] + 3.0, sin=())
    plano('vidrio', '-x', 13.39, yc - 0.5, yc + 0.5, g['z1'] + 2.2, g['z1'] + 2.6)
    # bajo la galería: zócalo blanco y dos puertas en el muro del fondo (foto desde el escenario)
    plano('int_blanco', '-x', X1 - 0.01, Y0, Y1, 0.2, 1.4)
    for (a, bb) in ((49.1, 50.0), (46.0, 46.8)):
        plano('madera_oscura', '-x', X1 - 0.02, a, bb, 0, 2.1)


def mercado():
    """Plaza de abastos frente a la plaza: cuerpo de 43 × 6 m, nueve locales, torre con reloj y patio con pila."""
    E = 'estuco_blanco'
    zH = 3.9
    yf, yb = -40.0, -46.0
    # cuerpo principal partido por el portón bajo la torre
    caja(E, -27.5, yb, 0, -5.7, yf, zH, col=True)
    caja(E, -3.3, yb, 0, 25.5, yf, zH, col=True)
    cornisa(E, -27.5, yb, -5.7, yf, zH + 0.15, alto=0.25, vuelo=0.08)
    cornisa(E, -3.3, yb, 25.5, yf, zH + 0.15, alto=0.25, vuelo=0.08)
    for (a, b) in ((-27.3, -5.9), (-3.1, 25.3)):     # losa de hormigón del techo, dentro del pretil
        caja('concreto', a, yb + 0.2, zH + 0.15, b, yf - 0.2, zH + 0.19, sin=('-z',))
    caja(E, -5.7, yb, 3.0, -3.3, yf, zH)                     # dintel del portón
    for t in [-23.5, -19.5, -15.5, -11.5, -8.0, -0.5, 3.5, 7.5, 11.5]:   # los nueve locales
        puerta('+y', yf, t, 1.6, 2.5, hoja='madera_oscura')
    # torre del reloj (madera), con el reloj a las cinco y media de la tarde (la hora de la luz de la escena)
    T = 'madera_oscura'
    caja(T, -6.3, -43.8, zH, -2.7, -40.2, 10.0)
    cornisa(T, -6.3, -43.8, -2.7, -40.2, 10.3, alto=0.3, vuelo=0.15)
    for lado, plano in (('+y', -40.2), ('-y', -43.8)):
        en_muro('vidrio', lado, plano, -5.2, -3.8, 9.0, 9.6, 0, 0.02)
    for lado, plano in (('-x', -6.3), ('+x', -2.7)):
        en_muro('vidrio', lado, plano, -42.7, -41.3, 9.0, 9.6, 0, 0.02)
    cx, cz, yc = -4.5, 7.9, -40.2
    res = bmesh.ops.create_cone(B('reloj'), cap_ends=True, segments=24, radius1=0.62, radius2=0.62, depth=0.06,
                                matrix=Matrix.Translation((cx, yc + 0.03, cz)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    res = bmesh.ops.create_cone(B('metal'), cap_ends=False, segments=24, radius1=0.68, radius2=0.68, depth=0.1,
                                matrix=Matrix.Translation((cx, yc + 0.04, cz)) @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    for k in range(12):
        a = 2 * math.pi * k / 12
        tx, tz = cx + math.sin(a) * 0.52, cz + math.cos(a) * 0.52
        caja('metal', tx - 0.02, yc + 0.06, tz - 0.05, tx + 0.02, yc + 0.08, tz + 0.05, sin=())
    for (theta, largo, ancho) in ((180.0, 0.5, 0.035), (165.0, 0.33, 0.055)):   # las 17:30
        th = math.radians(theta)
        dx, dz = -math.sin(th), math.cos(th)    # visto desde el norte, la derecha es −x
        Mh = Matrix.Translation((cx + dx * largo / 2, yc + 0.1, cz + dz * largo / 2)) @ Matrix.Rotation(-th, 4, 'Y') \
            @ Matrix.Diagonal((ancho, 0.02, largo, 1.0))
        bmesh.ops.create_cube(B('metal'), size=1.0, matrix=Mh)
    # corredor de sombra con pilares de pino oregón
    caja('madera_oscura', -27.8, -40.0, 2.95, 25.8, -37.0, 3.07, sin=())
    for x in np.arange(-25.8, 25.6, 3.0):
        if abs(x + 4.5) < 1.6:          # el portón queda libre
            continue
        caja('madera_oscura', x - 0.08, -37.25, 0, x + 0.08, -37.09, 2.95, sin=('-z',))
        colision(x - 0.18, -37.35, x + 0.18, -36.99)
    caja('concreto', -27.8, -40.0, 0, 25.8, -37.0, 0.12)
    # bajo el corredor, mercadería de los locales
    cajon(-21.9, -39.55, 0.12, 0.62, 0.48, 0.42, 0.0); cajon(-21.2, -39.6, 0.12, 0.6, 0.46, 0.42, 0.06)
    cajon(-21.55, -39.55, 0.54, 0.6, 0.46, 0.4, -0.1)
    colision(-22.3, -39.9, -20.8, -39.2)
    barril(5.1, -39.55, z0=0.12, col=True); barril(5.85, -39.6, z0=0.12, h=0.75, r=0.26, col=True)
    cajon(13.4, -39.55, 0.12, 0.62, 0.48, 0.42, 0.04); cajon(14.1, -39.5, 0.12, 0.62, 0.48, 0.42, -0.05)
    colision(13.0, -39.9, 14.5, -39.2)
    carreta(29.0, -32.0, 0.5)
    # patio interior: locales al fondo y a los lados, pila al centro y dos mesones techados
    caja(E, -27.5, -66.0, 0, 25.5, -61.0, 3.6, col=True)
    caja(E, 20.5, -61.0, 0, 25.5, yb, 3.6, col=True)
    caja(E, -27.5, -61.0, 0, -21.0, yb, 3.6, col=True)
    for t in np.arange(-18.0, 18.0, 4.0):
        puerta('+y', -61.0, t, 1.5, 2.4)
    for t in np.arange(-58.0, -47.0, 4.0):
        puerta('+x', -21.0, t, 1.5, 2.4)
        puerta('-x', 20.5, t, 1.5, 2.4)
    cilindro('concreto', -3.0, -53.4, 0, 0.55, 1.7, seg=28)
    cilindro('concreto', -3.0, -53.4, 0.55, 1.35, 0.22, seg=10)
    cilindro('concreto', -3.0, -53.4, 1.35, 1.45, 0.55, 0.45, seg=16)
    colision(-4.8, -55.2, -1.2, -51.6)
    for (x0, x1) in ((1.0, 15.8), (-19.3, -7.3)):
        caja('concreto', x0, -52.4, 0, x1, -50.4, 0.9, col=True)
        for x in np.linspace(x0 + 0.2, x1 - 0.2, 4):
            for y in (-53.2, -49.6):
                caja('madera_oscura', x - 0.07, y - 0.07, 0, x + 0.07, y + 0.07, 3.0, sin=('-z',))
        techo2('calamina', x0 - 0.2, -53.6, x1 + 0.2, -49.2, 3.0, 0.5, eje='x', o=0.25)


def capilla():
    """Costado poniente del mercado, frente a la plaza: pino oregón, techo metálico de alero amplio (UNESCO)."""
    W = 'madera_blanca'
    x0, x1, y0, y1 = -43.3, -27.55, -66.0, -37.0
    xn0, xn1 = -38.6, -32.3
    caja(W, xn0, y0, 0, xn1, y1, 8.6)
    caja(W, x0, y0, 0, xn0, y1, 5.0)
    caja(W, xn1, y0, 0, x1, y1, 5.0)
    colision(x0, y0, x1, y1 + 1.6)
    techo4('calamina', xn0, y0, xn1, y1, 8.6, 1.1, o=1.0)        # «techo metálico de alero amplio»
    techo4('calamina', x0, y0, xn0 + 0.01, y1, 5.0, 0.6, o=0.9)
    techo4('calamina', xn1 - 0.01, y0, x1, y1, 5.0, 0.6, o=0.9)
    # banda de celosía bajo los aleros y gran ventanal de celosía en el frente
    for (a, b) in ((x0, xn0), (xn1, x1)):
        en_muro('vidrio', '+y', y1, a + 0.3, b - 0.3, 4.25, 4.95, 0, 0.02)
    en_muro('vidrio', '+y', y1, -36.7, -34.2, 3.2, 7.7, 0, 0.02)
    for t in np.linspace(-36.7, -34.2, 6):
        en_muro('madera_oscura', '+y', y1, t - 0.035, t + 0.035, 3.2, 7.7, 0, 0.06)
    for z in np.linspace(3.2, 7.7, 9):
        en_muro('madera_oscura', '+y', y1, -36.7, -34.2, z - 0.03, z + 0.03, 0, 0.06)
    en_muro('madera_oscura', '+y', y1, -35.5, -35.4, 3.2, 7.7, 0, 0.09)
    en_muro('madera_oscura', '+y', y1, -36.7, -34.2, 6.0, 6.1, 0, 0.09)
    puerta('+y', y1, -35.45, 1.7, 2.8, hoja='madera_roja', z0=0.45)
    puerta('+y', y1, -40.9, 1.1, 2.2, hoja='madera_oscura', z0=0.45)
    puerta('+y', y1, -30.0, 1.1, 2.2, hoja='madera_oscura', z0=0.45)
    for t in np.arange(y0 + 3, y1 - 2, 4.0):
        ventana('-x', x0, t, 1.6, 0.9, 1.9)
        ventana('+x', x1, t, 1.6, 0.9, 1.9)
    # cruz de madera sobre el frente
    caja('madera_oscura', -35.52, y1 - 0.4, 9.9, -35.38, y1 - 0.26, 11.2, sin=())
    caja('madera_oscura', -36.0, y1 - 0.4, 10.6, -34.9, y1 - 0.26, 10.72, sin=())
    # zócalo de piedra y escalinata
    caja('concreto', x0 - 0.2, y1, 0, x1 + 0.2, y1 + 0.6, 0.45)
    caja('concreto', -37.5, y1 + 0.6, 0, -33.4, y1 + 1.0, 0.3)
    caja('concreto', -37.5, y1 + 1.0, 0, -33.4, y1 + 1.4, 0.15)


def arcada(mat, xo, grosor, ya, yb, n, pilar, z_arr, alto, segs=10):
    """Muro de arcos mirando al oriente (+x), como el frente de la pulpería."""
    xi = xo - grosor
    W = (yb - ya) / n
    r = (W - pilar) / 2
    for i in range(n):
        yc = ya + W * (i + 0.5)
        arco = [(yc + r * math.cos(math.pi - math.pi * k / segs), z_arr + r * math.sin(math.pi - math.pi * k / segs)) for k in range(segs + 1)]
        for x, nx in ((xo, 1), (xi, -1)):
            cara(mat, [(x, yc - W / 2, 0), (x, yc - r, 0), (x, yc - r, alto), (x, yc - W / 2, alto)], (nx, 0, 0))
            cara(mat, [(x, yc + r, 0), (x, yc + W / 2, 0), (x, yc + W / 2, alto), (x, yc + r, alto)], (nx, 0, 0))
            for k in range(segs):
                (ya_, za_), (yb_, zb_) = arco[k], arco[k + 1]
                cara(mat, [(x, ya_, za_), (x, yb_, zb_), (x, yb_, alto), (x, ya_, alto)], (nx, 0, 0))
        for k in range(segs):
            (ya_, za_), (yb_, zb_) = arco[k], arco[k + 1]
            ym, zm = (ya_ + yb_) / 2, (za_ + zb_) / 2
            cara(mat, [(xo, ya_, za_), (xo, yb_, zb_), (xi, yb_, zb_), (xi, ya_, za_)], (0, yc - ym, z_arr - zm))
        cara(mat, [(xo, yc - r, 0), (xo, yc - r, z_arr), (xi, yc - r, z_arr), (xi, yc - r, 0)], (0, 1, 0))
        cara(mat, [(xo, yc + r, 0), (xo, yc + r, z_arr), (xi, yc + r, z_arr), (xi, yc + r, 0)], (0, -1, 0))
    cara(mat, [(xi, ya, alto), (xo, ya, alto), (xo, yb, alto), (xi, yb, alto)], (0, 0, 1))
    cara(mat, [(xi, ya, 0), (xo, ya, 0), (xo, ya, alto), (xi, ya, alto)], (0, -1, 0))
    cara(mat, [(xi, yb, 0), (xo, yb, 0), (xo, yb, alto), (xi, yb, alto)], (0, 1, 0))


def pulperia():
    """Costado poniente de la plaza: frente de arcos con corredor, esquina de dos pisos con balcón (UNESCO)."""
    E = 'estuco_blanco'
    H = 5.3
    # zócalo: corredor elevado y terraza delantera
    caja('concreto', -38.6, -20.5, 0, -34.0, 27.0, 0.5)
    caja('concreto', -34.0, -20.5, 0, -33.6, 27.0, 0.25)
    colision(-73.0, -27.0, -33.6, 27.0)
    # bodega y almacén detrás del corredor
    caja(E, -48.0, -20.5, 0, -38.6, 27.0, H)
    cornisa(E, -48.0, -20.5, -38.6, 27.0, H + 0.15, alto=0.25, vuelo=0.08)
    for t in np.arange(-17.5, 26.0, 3.39):
        puerta('+x', -38.6, t, 1.4, 2.6, z0=0.5, montante=True)
    # mercadería en el corredor: barriles, cajones y sacos junto a las puertas de la bodega
    for (y, cosa) in ((-19.4, 'barriles'), (-12.6, 'cajones'), (-2.3, 'barriles'), (8.0, 'sacos'), (18.2, 'cajones'), (25.6, 'barriles')):
        if cosa == 'barriles':
            barril(-37.9, y, z0=0.5); barril(-37.95, y + 0.68, z0=0.5); barril(-37.3, y + 0.32, z0=0.5, h=0.75, r=0.26)
        elif cosa == 'cajones':
            cajon(-37.95, y, 0.5, 0.62, 0.48, 0.42, 0.05); cajon(-37.9, y + 0.66, 0.5, 0.62, 0.48, 0.42, -0.08)
            cajon(-37.95, y + 0.3, 0.92, 0.6, 0.46, 0.4, 0.12)
        else:
            pila_sacos(-37.8, y, 0.5, 0.0)
    # arcada
    arcada(E, -35.0, 0.55, -20.5, 27.0, 14, 0.85, 2.35, H)
    caja(E, -35.6, -20.5, H - 0.25, -34.92, 27.0, H + 0.15, sin=())
    caja('madera_oscura', -38.6, -20.5, 4.0, -35.55, 27.0, 4.08, sin=())     # cielo del corredor
    W = (27.0 + 20.5) / 14
    for i in range(14):
        yc = -20.5 + W * (i + 0.5)
        en_muro('vidrio', '+x', -35.0, yc - 0.32, yc + 0.32, 4.25, 4.6, 0, 0.02)
    # esquina de dos pisos con balcón de madera
    caja(E, -44.0, -27.0, 0, -35.0, -20.5, 8.3)
    cornisa(E, -44.0, -27.0, -35.0, -20.5, 8.45, alto=0.25, vuelo=0.1)
    puerta('+x', -35.0, -23.75, 1.8, 2.8, z0=0.0)
    puerta('+x', -35.0, -23.75, 1.3, 2.3, z0=4.4)
    ventana('-y', -27.0, -39.5, 5.0, 1.1, 1.5)
    ventana('-y', -27.0, -39.5, 1.2, 1.2, 1.6)
    caja('madera_oscura', -35.0, -26.6, 4.25, -33.9, -20.9, 4.4, sin=())
    for y in np.linspace(-26.55, -20.95, 15):
        caja('madera_oscura', -34.0, y - 0.03, 4.4, -33.94, y + 0.03, 5.3, sin=())
    caja('madera_oscura', -34.06, -26.6, 5.3, -33.9, -20.9, 5.38, sin=())
    caja('madera_oscura', -35.0, -26.6, 5.3, -33.9, -26.52, 5.38, sin=())
    caja('madera_oscura', -35.0, -20.98, 5.3, -33.9, -20.9, 5.38, sin=())
    for y in (-26.5, -21.0):
        caja('madera_oscura', -34.1, y - 0.05, 4.0, -34.0, y + 0.05, 4.25, sin=())
    # ala sur (panadería) hacia calle del Mercado
    caja(E, -73.0, -27.0, 0, -44.0, -19.0, 4.8)
    cornisa(E, -73.0, -27.0, -44.0, -19.0, 4.95, alto=0.22, vuelo=0.08)
    for t in np.arange(-70.0, -46.0, 4.0):
        ventana('-y', -27.0, t, 1.1, 1.0, 1.4)
    puerta('-y', -27.0, -47.0, 1.6, 2.6, montante=True)
    pila_sacos(-45.4, -27.75, 0.0, math.pi / 2)        # harina para la panadería
    barril(-48.9, -27.5); barril(-49.6, -27.45, h=0.75, r=0.26)


def hotel():
    """Hotel y club social: frente a calle Blanco Encalada, 29 m de frente y 39 de fondo; madera y estuco (UNESCO)."""
    E = 'estuco_crema'
    x0, x1, y0, y1, H = 38.0, 76.0, -31.0, -2.0, 4.4
    caja(E, x0, y0, 0, x1, y1, H, col=True)
    cornisa('madera_oscura', x0, y0, x1, y1, H + 0.25, alto=0.3, vuelo=0.35)
    techo4('calamina', x0 + 0.4, y0 + 0.4, x1 - 0.4, y1 - 0.4, H + 0.25, 1.1, o=0.0, fascia=False)   # techo bajo de calamina (interpretación)
    for t in np.arange(-29.0, -3.0, 2.9):
        if abs(t - (-16.5)) < 1.6:
            continue
        ventana('-x', x0, t, 1.0, 1.0, 2.0)
    puerta('-x', x0, -16.5, 2.0, 2.7, hoja='madera_roja', z0=0.4)
    for t in np.arange(41.0, 75.0, 3.4):
        ventana('+y', y1, t, 1.0, 1.0, 1.9)
        ventana('-y', y0, t, 1.0, 1.0, 1.9)
    # terraza techada hacia la plaza
    caja('concreto', 33.5, -26.5, 0, x0, -6.5, 0.4, col=True)
    caja('concreto', 33.0, -18.0, 0, 33.5, -15.0, 0.2)
    for y in np.linspace(-26.3, -6.7, 8):
        caja('madera_blanca', 33.72, y - 0.08, 0.4, 33.88, y + 0.08, 3.3, sin=('-z',))
    techo1('calamina', 33.2, -26.8, x0, -6.2, 3.65, 3.3, baja='-x')
    mesa_sillas(35.5, -23.2, 0.4); mesa_sillas(35.5, -10.4, 0.4)
    caja('madera_blanca', 33.65, -26.3, 3.25, 33.95, -6.7, 3.4, sin=())
    for (a, b) in ((-26.3, -18.1), (-14.9, -6.7)):
        caja('madera_blanca', 33.74, a, 0.95, 33.86, b, 1.03, sin=())
        for y in np.arange(a + 0.15, b, 0.32):
            caja('madera_blanca', 33.77, y - 0.025, 0.4, 33.83, y + 0.025, 0.95, sin=('-z',))
    # muro de la piscina y su jardín hacia calle Esmeralda (la piscina no está en este piloto)
    caja('estuco_blanco', x1, -31.0, 0, 116.0, -1.6, 2.3, col=True)
    cornisa('estuco_blanco', x1, -31.0, 116.0, -1.6, 2.38, alto=0.1, vuelo=0.05)
    puerta('+y', -1.6, 96.0, 1.4, 2.0)


def casas_obreros():
    """Casas pareadas para obreros casados: piezas a cuatro aguas y pórtico más bajo a un agua (UNESCO)."""
    muros = ['estuco_crema', 'estuco_ocre', 'estuco_blanco', 'estuco_crema', 'estuco_ocre', 'estuco_crema', 'estuco_blanco', 'estuco_ocre']
    yf, yb = 11.0, 19.5
    for par in range(4):
        a = 38.0 + 16.0 * par
        for lado in (0, 1):
            casa = par * 2 + lado
            E = muros[casa]
            if lado == 0:
                rx0, rx1, px0, px1 = a, a + 4.6, a + 4.6, a + 8.0
            else:
                rx0, rx1, px0, px1 = a + 11.4, a + 16.0, a + 8.0, a + 11.4
            caja(E, rx0, yf, 0, rx1, yb, 3.0)
            techo4('calamina', rx0, yf, rx1, yb, 3.0, 1.55, o=0.35)
            # cañón de la cocina (fogón a carbón o leña)
            xc = (rx0 + rx1) / 2 + (0.9 if lado == 0 else -0.9)
            cilindro('metal', xc, yb - 1.8, 3.0, 5.6, 0.085, seg=8)
            cilindro('metal', xc, yb - 1.8, 5.6, 5.76, 0.17, 0.05, seg=8)
            ventana('-y', yf, (rx0 + rx1) / 2, 0.95, 1.0, 1.25, marco='pintura_verde')
            caja(E, px0, yf + 1.4, 0, px1, yb, 2.6)
            techo1('calamina', px0, yf + 0.1, px1, yb, 3.0, 2.62, baja='-y')
            caja('madera_oscura', px0, yf + 0.1, 2.48, px1, yf + 0.24, 2.62, sin=())
            tp = px0 + 1.0 if lado == 0 else px1 - 1.0
            puerta('-y', yf + 1.4, tp, 0.9, 2.1, hoja='pintura_verde', marco='madera_oscura')
            ventana('-y', yf + 1.4, (px1 - 0.8) if lado == 0 else (px0 + 0.8), 1.0, 0.7, 0.9, marco='pintura_verde', cruz=False)
            # baranda baja del pórtico
            xa, xb = (px0 + 1.8, px1) if lado == 0 else (px0, px1 - 1.8)
            caja('madera_oscura', xa, yf + 0.15, 0.85, xb, yf + 0.25, 0.92, sin=())
            for x in np.arange(xa + 0.1, xb, 0.3):
                caja('madera_oscura', x - 0.025, yf + 0.18, 0.0, x + 0.025, yf + 0.22, 0.85, sin=('-z',))
    colision(38.0, yf, 102.0, yb)
    # vereda de tierra apisonada con solera, y cerco de los patios traseros
    caja('plaza', 38.0, 9.8, 0, 102.0, 11.0, 0.1)
    caja('concreto', 38.0, 9.65, 0, 102.0, 9.8, 0.16)
    caja('madera_oscura', 38.0, 26.4, 0, 102.0, 26.5, 1.6, sin=('-z',))
    fila_generica(102.0, 119.5, yf, '-y', 8.5, 'estuco_blanco')


def fila_generica(x0, x1, yfrente, mira, fondo, muro, alto=3.0, modulo=8.0, col=False):
    """Fila de casas sin detalle, para que las calles no terminen en el vacío."""
    n = max(1, round((x1 - x0) / modulo))
    w = (x1 - x0) / n
    if mira == '-y':
        y0, y1 = yfrente, yfrente + fondo
    else:
        y0, y1 = yfrente - fondo, yfrente
    for i in range(n):
        a, b = x0 + i * w, x0 + (i + 1) * w
        caja(muro if i % 3 else 'estuco_crema', a, y0, 0, b, y1, alto)
        techo4('calamina', a, y0, b, y1, alto, 1.3, o=0.3, fascia=False)
        en_muro('vidrio', mira, yfrente, (a + b) / 2 - 0.5, (a + b) / 2 + 0.5, 0.9, 2.1, 0, 0.03)
        en_muro('madera_oscura', mira, yfrente, a + 0.8, a + 1.7, 0.0, 2.1, 0, 0.03)
    if col:
        colision(x0, y0, x1, y1)


def columna_generica(xfrente, y0, y1, mira, fondo, muro, alto=3.0, modulo=8.0, col=False):
    n = max(1, round((y1 - y0) / modulo))
    w = (y1 - y0) / n
    if mira == '-x':
        x0, x1 = xfrente, xfrente + fondo
    else:
        x0, x1 = xfrente - fondo, xfrente
    for i in range(n):
        a, b = y0 + i * w, y0 + (i + 1) * w
        caja(muro if i % 3 else 'estuco_crema', x0, a, 0, x1, b, alto)
        techo4('calamina', x0, a, x1, b, alto, 1.3, o=0.3, fascia=False)
        en_muro('vidrio', mira, xfrente, (a + b) / 2 - 0.5, (a + b) / 2 + 0.5, 0.9, 2.1, 0, 0.03)
    if col:
        colision(x0, y0, x1, y1)


def pabellon(x0, x1, y0, y1, muro='estuco_blanco', alto=3.2, col=False):
    caja(muro, x0, y0, 0, x1, y1, alto)
    techo2('calamina', x0, y0, x1, y1, alto, min(1.4, (y1 - y0) * 0.22), eje='x', o=0.3, muro=muro)
    for t in np.arange(x0 + 2.0, x1 - 1.0, 3.5):
        en_muro('madera_oscura', '-y', y0, t - 0.45, t + 0.45, 0, 2.1, 0, 0.03)
        en_muro('madera_oscura', '+y', y1, t - 0.45, t + 0.45, 0, 2.1, 0, 0.03)
    if col:
        colision(x0, y0, x1, y1)


def escuela():
    """Escuela: calle Arturo Prat; pino oregón (UNESCO). Solo volumen, como fondo."""
    W = 'madera_blanca'
    caja(W, -59.0, 44.0, 0, -34.5, 62.0, 4.2)
    techo4('calamina', -59.0, 44.0, -34.5, 62.0, 4.2, 1.8, o=0.5)
    caja('concreto', -59.0, 41.0, 0, -34.5, 44.0, 0.2)
    for x in np.linspace(-58.7, -34.8, 9):
        caja('madera_oscura', x - 0.08, 41.3, 0.2, x + 0.08, 41.46, 3.6, sin=('-z',))
    techo1('calamina', -59.3, 40.9, -34.2, 44.0, 4.0, 3.55, baja='-y')
    for t in np.arange(-56.0, -36.0, 3.0):
        ventana('-y', 44.0, t, 1.0, 1.1, 1.8)


def fondo_urbano():
    # al norte de la plaza, al oriente del teatro y al norte del teatro
    fila_generica(34.0, 119.0, 37.0, '-y', 10.0, 'estuco_ocre', col=True)
    fila_generica(34.0, 119.0, 62.0, '+y', 10.0, 'estuco_crema')
    fila_generica(34.0, 119.0, 73.0, '-y', 10.0, 'estuco_blanco')
    fila_generica(-57.0, 26.0, 73.0, '-y', 10.0, 'estuco_ocre')
    fila_generica(-57.0, 26.0, 95.0, '+y', 10.0, 'estuco_crema')
    fila_generica(-27.0, 26.0, 102.0, '-y', 9.0, 'estuco_blanco')
    fila_generica(-25.0, 28.0, 127.0, '-y', 9.0, 'estuco_crema')
    escuela()
    columna_generica(-26.5, 64.0, 70.0, '-x', 6.0, 'estuco_blanco')
    # pabellones de solteros («buques») al suroriente
    for (yc, w) in ((-39.5, 10.7), (-57.6, 11.4), (-75.6, 11.0), (-94.1, 9.8), (-109.8, 6.3)):
        pabellon(37.5, 119.5, yc - w / 2, yc + w / 2, col=(yc > -66))
    # poniente y surponiente
    columna_generica(-87.0, -27.0, -6.0, '+x', 12.0, 'estuco_crema')
    fila_generica(-121.0, -59.0, -40.5, '+y', 14.0, 'estuco_blanco')
    fila_generica(-121.0, -59.0, -62.0, '-y', 14.0, 'estuco_crema')
    pabellon(-122.0, -79.0, 37.0, 61.0, 'estuco_blanco')
    # cancha y casas al sur del mercado
    fila_generica(-26.0, 25.5, -100.0, '+y', 9.0, 'estuco_crema')
    fila_generica(30.0, 76.0, -150.0, '+y', 9.0, 'estuco_ocre')


def tendido():
    """Postes de madera con crucetas y cables, como en las fotos del campamento."""
    linea_postes([(30.0, 9.4), (59.0, 9.4), (88.0, 9.4), (117.0, 9.4)], farol=(0.0, -1.0))
    linea_postes([(-27.6, -29.0), (0.0, -29.0), (27.6, -29.0)], farol=(0.0, -1.0))
    linea_postes([(-27.6, 29.0), (0.0, 29.0), (27.6, 29.0)], farol=(0.0, 1.0))
    linea_postes([(27.6, -13.0), (27.6, 13.0)])
    linea_postes([(-29.6, -13.0), (-29.6, 13.0)])
    # línea larga hacia el sector industrial (perspectiva)
    linea_postes([(-128.0, -120.0 + 42.0 * i) for i in range(11)])


# ---------------------------------------------------------------- puntos de interés y datos del paseo
ANCLAS = {   # suelo: donde hay que pararse; marca: punto del edificio donde se dibuja el marcador
    'teatro': dict(suelo=(0.65, 37.4), marca=(0.65, 40.0, 6.6)),
    'pulperia': dict(suelo=(-31.4, 2.0), marca=(-35.0, 2.0, 6.0)),
    'mercado': dict(suelo=(-4.5, -34.4), marca=(-4.5, -40.2, 11.0)),
    'casas': dict(suelo=(54.0, 8.0), marca=(54.0, 11.0, 5.0)),
}
LIMITES = [(-33.4, -63.0, 104.0, 41.0),     # x0, y0, x1, y1 donde se puede caminar: la plaza y sus calles
           (-15.2, 39.0, 15.2, 60.7)]      # el vestíbulo y la sala del teatro (los muros los cierran las colisiones)
INICIO = dict(x=0.0, y=-21.0, dx=0.0, dy=1.0)   # entrada sur de la plaza, mirando al teatro
LAT_HUMBERSTONE = -20.2086
NORTE_GRILLA = 99.5     # ángulo (grados, antihorario desde +x) del norte verdadero en la cuadrícula del campamento


def sol_de_la_tarde(dia_del_anio=325, elevacion=10.0, latitud=None, norte=None):
    """Posición del sol en Humberstone una tarde de fines de noviembre (el 21 de noviembre de 1934 se inauguró el
    nombre Santiago Humberstone), cuando está a `elevacion` grados sobre el horizonte. Devuelve el azimut en la
    cuadrícula (radianes), la elevación y la hora solar aproximada."""
    lat = math.radians(LAT_HUMBERSTONE if latitud is None else latitud)
    norte = NORTE_GRILLA if norte is None else norte
    dec = math.radians(-23.44 * math.cos(math.radians(360 / 365 * (dia_del_anio + 10))))
    e = math.radians(elevacion)
    cos_a = (math.sin(dec) - math.sin(e) * math.sin(lat)) / (math.cos(e) * math.cos(lat))
    acimut = 360 - math.degrees(math.acos(max(-1.0, min(1.0, cos_a))))        # brújula, desde el norte, horario
    cos_h = (math.sin(e) - math.sin(lat) * math.sin(dec)) / (math.cos(lat) * math.cos(dec))
    hora = 12 + math.degrees(math.acos(max(-1.0, min(1.0, cos_h)))) / 15
    return math.radians(norte - acimut), e, hora, acimut


def leer_pois(nota=None, anclas=None):
    anclas = ANCLAS if anclas is None else anclas
    with open(nota or NOTA, encoding='utf-8') as f:
        txt = f.read()
    m = re.search(r'^## Puntos de interés\s*$(.*?)(?=^## |\Z)', txt, re.S | re.M)
    pois = []
    for bloque in re.split(r'^### ', m.group(1), flags=re.M)[1:]:
        lineas = bloque.strip().split('\n')
        d = {'titulo': lineas[0].strip()}
        for l in lineas[1:]:
            mm = re.match(r'^- (\w+):\s*(.+)$', l.strip())
            if mm:
                d[mm.group(1)] = mm.group(2).strip()
        if d.get('id') in anclas:
            a = anclas[d['id']]
            d['suelo'] = [a['suelo'][0], -a['suelo'][1]]
            d['marca'] = [a['marca'][0], a['marca'][2], -a['marca'][1]]
            pois.append(d)
        else:
            print('AVISO: punto de interés sin ancla:', d.get('id'))
    return pois


# Vida del paseo (la arma site/3d/src/vida.js; coordenadas de three.js: x, y = alto, z = -y de Blender).
# Siluetas sin rostro ni vestimenta por la plaza y las calles; jotes que planean alto (comunes en el norte);
# polvo que levanta el viento de la tarde; ropa tendida junto a las casas de obreros. Todo es interpretación.
VIDA = dict(
    viento=[1.0, -0.4],
    aves=[dict(centro=[10, 60, -10], radio=70, n=2), dict(centro=[-70, 85, 60], radio=95, n=2)],
    personas=dict(n=9, rutas=[[[0, 25], [0, -25]], [[-23, 0], [23, 0]], [[-22, 24], [22, -24]], [[-30, -34], [30, -34]],
                              [[40, -10.4], [100, -10.4]], [[-26, 8], [-26, -12]]]),
    polvo=dict(centro=[20, 0, 0], tam=[150, 2.5, 110], n=700),
    ropa=[dict(a=[36.4, 1.9, -12.5], b=[36.4, 1.9, -19.0], n=5), dict(a=[44, 1.9, -22], b=[52, 1.9, -22], n=6),
          dict(a=[74, 1.9, -23], b=[83, 1.9, -23], n=7)],
)


def datos_paseo(creditos):
    a3 = lambda c: [round(c[0], 2), round(-c[3], 2), round(c[2], 2), round(-c[1], 2)]
    sol_az, sol_el, hora, brujula = sol_de_la_tarde()
    print('Sol: azimut %.1f° (brújula), elevación %.1f°, hora solar %.2f' % (brujula, math.degrees(sol_el), hora))
    return dict(
        version=3,
        inicio=dict(x=INICIO['x'], z=-INICIO['y'], yaw=math.atan2(-INICIO['dx'], INICIO['dy'])),
        limites=[a3(l) for l in LIMITES],
        colisiones=[a3(c) for c in COLISIONES],
        pois=leer_pois(),
        sol=dict(azimut=round(sol_az, 4), elevacion=round(sol_el, 4), hora_solar=round(hora, 2)),
        norte=math.radians(NORTE_GRILLA),
        vida=VIDA,
        creditos=creditos,
    )


# ---------------------------------------------------------------- armado
def finalizar(materiales):
    objs = []
    for nombre, b in MALLAS.items():
        s = MATS[nombre]
        tam = TEX_INFO[s['tex']]['tam'] if s.get('tex') else 1.0
        tu, tv = s.get('tam2', (tam, tam))
        if nombre in FOTO_UV:
            eje, s0, s1, z0, z1 = FOTO_UV[nombre]
            uv = b.loops.layers.uv.get('UVMap') or b.loops.layers.uv.new('UVMap')
            for f in b.faces:
                for l in f.loops:
                    p = l.vert.co
                    l[uv].uv = (((p.x if eje == 'x' else p.y) - s0) / (s1 - s0), (p.z - z0) / (z1 - z0))
        elif nombre not in UV_PROPIAS:
            uv = b.loops.layers.uv.get('UVMap') or b.loops.layers.uv.new('UVMap')
            Z = Vector((0, 0, 1))
            for f in b.faces:
                f.normal_update()
                n = f.normal
                if abs(n.z) > 0.95:
                    U, V = Vector((1, 0, 0)), Vector((0, 1, 0))
                    if nombre in ('suelo', 'ripios'):   # girada: que las repeticiones no sigan las calles
                        U, V = Vector((0.956, 0.292, 0)), Vector((-0.292, 0.956, 0))
                else:
                    V = (Z - n * Z.dot(n)).normalized()
                    U = n.cross(V)
                if s.get('rot'):
                    U, V = V, -U
                for l in f.loops:
                    p = l.vert.co
                    l[uv].uv = (p.dot(U) / tu, p.dot(V) / tv)
        if nombre in VCOL:
            fn = COLOR_FN[nombre]
            col = b.loops.layers.float_color.new('Color')
            ao = b.verts.layers.float.get('ao')
            ti = [b.verts.layers.float.get(k) for k in ('tr', 'tg', 'tb')]
            for f in b.faces:
                for l in f.loops:
                    c = fn(l.vert.co)
                    if ti[0] is not None:
                        c = (c[0] * l.vert[ti[0]], c[1] * l.vert[ti[1]], c[2] * l.vert[ti[2]], 1.0)
                    if ao is not None:
                        k = l.vert[ao]
                        c = (c[0] * k, c[1] * k, c[2] * k, 1.0)
                    l[col] = c
        me = bpy.data.meshes.new(nombre)
        b.to_mesh(me)
        b.free()
        if nombre == 'hojas' and len(NORMALES_HOJAS) == len(me.vertices):
            me.normals_split_custom_set_from_vertices(NORMALES_HOJAS)
        elif nombre == 'hojas':
            print('AVISO: normales de hojas descuadradas', len(NORMALES_HOJAS), len(me.vertices))
        me.materials.append(materiales[nombre])
        ob = bpy.data.objects.new(nombre, me)
        bpy.context.scene.collection.objects.link(ob)
        ob['sombra'] = 'no' if nombre in SIN_SOMBRA else ('recibe' if nombre in SOLO_RECIBE else 'ambas')
        objs.append(ob)
    return objs


def construir():
    suelo(); cerros(); torta_ripios(); sector_industrial()
    plaza(); teatro(); mercado(); capilla(); pulperia(); hotel(); casas_obreros()
    fondo_urbano(); tendido()


def exportar(datos, nombre='humberstone', escena='Humberstone, c. 1935 · reconstrucción aproximada', referencias=None):
    sc = bpy.context.scene
    sc['paseo'] = json.dumps(datos, ensure_ascii=False)
    ruta = os.path.join(SITE3D, nombre + '.glb')
    kw = dict(filepath=ruta, export_format='GLB', export_image_format='AUTO', export_jpeg_quality=80,
              export_extras=True, export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
              export_vertex_color='NAME', export_vertex_color_name='Color', export_all_vertex_colors=False, export_animations=False, export_texcoords=True, export_normals=True,
              export_tangents=False, use_selection=False)
    try:
        bpy.ops.export_scene.gltf(**kw, export_meshopt_compression_enable=True)
    except Exception as e:
        print('AVISO: sin compresión meshopt:', e)
        bpy.ops.export_scene.gltf(**kw)
    with open(os.path.join(SITE3D, 'creditos.json' if nombre == 'humberstone' else 'creditos-' + nombre + '.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(escena=escena, recursos=datos['creditos'],
                       referencias=referencias or ['Planta: expediente UNESCO 1178 y huellas de edificios de OpenStreetMap (ODbL), © colaboradores de OpenStreetMap',
                                    'Teatro: fachadas y boca del escenario con fotos de Wikimedia Commons enderezadas (scripts/3d/teatro_fotos.py); muestran el estado actual. Lo que no sale en las fotos es aproximado.',
                                    'Geometría modelada por script en Blender (scripts/3d/humberstone.py); sin modelos ni texturas generados por IA']),
                  f, ensure_ascii=False, indent=2)
    print('GLB:', ruta, round(os.path.getsize(ruta) / 1e6, 2), 'MB')


def sol_del_hdri(ruta):
    img = bpy.data.images.load(ruta, check_existing=True)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    lum = px.reshape(h, w, 4)[:, :, :3].sum(axis=2)
    j, i = np.unravel_index(np.argmax(lum), lum.shape)
    u, v = (i + 0.5) / w, (j + 0.5) / h
    return (0.5 - u) * 2 * math.pi, (v - 0.5) * math.pi, img


def render(carpeta, hdr, datos):
    os.makedirs(carpeta, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    try:
        sc.eevee.taa_render_samples = 24
    except Exception:
        pass
    try:
        sc.view_settings.view_transform = 'AgX'
    except Exception:
        pass
    az_hdri, el_hdri, img = sol_del_hdri(hdr)
    az, el = datos['sol']['azimut'], datos['sol']['elevacion']   # el cielo de prueba es de mediodía: solo orienta
    w = bpy.data.worlds.new('cielo'); sc.world = w; w.use_nodes = True
    nt = w.node_tree
    bg = next(n for n in nt.nodes if n.type == 'BACKGROUND')
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = img
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Rotation'].default_value[2] = az_hdri - az
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], env.inputs['Vector'])
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    ld = bpy.data.lights.new('sol', 'SUN'); ld.energy = 5.0; ld.angle = math.radians(0.6)
    ld.color = (1.0, 0.96, 0.9)
    lo = bpy.data.objects.new('sol', ld); sc.collection.objects.link(lo)
    d = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
    lo.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    cd = bpy.data.cameras.new('cam'); cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(60); cd.clip_end = 30000
    co = bpy.data.objects.new('cam', cd); sc.collection.objects.link(co); sc.camera = co
    ini = INICIO
    vistas = {
        'inicio': ((ini['x'], ini['y'], 1.65), (ini['x'] + ini['dx'] * 10, ini['y'] + ini['dy'] * 10, 2.2)),
        'pulperia': ((-21.0, -8.0, 1.65), (-36.0, 4.0, 3.0)),
        'mercado': ((-10.0, -27.0, 1.65), (-20.0, -42.0, 4.5)),
        'teatro': ((5.0, 30.0, 1.65), (0.0, 46.0, 6.0)),
        'casas': ((36.0, 4.0, 1.65), (80.0, 13.0, 2.0)),
        'aerea': ((95.0, -110.0, 75.0), (0.0, 0.0, 0.0)),
    }
    solo = [a for a in ARGS if a.startswith('--vista=')]
    if solo:
        nombres = solo[0].split('=')[1].split(',')
        vistas = {k: v for k, v in vistas.items() if k in nombres}
    for nombre, (pos, mira) in vistas.items():
        co.location = pos
        co.rotation_euler = (Vector(mira) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(carpeta, 'h_' + nombre + '.png')
        bpy.ops.render.render(write_still=True)
        print('render:', sc.render.filepath)


# ---------------------------------------------------------------- principal
# Este archivo también sirve de biblioteca para otros mundos (p. ej. niebla.py hace `import humberstone`):
# el armado solo corre cuando Blender lo ejecuta directamente.
def principal():
    global TEX_INFO
    bpy.ops.wm.read_factory_settings(use_empty=True)
    TEX_INFO, hdr, creditos = recursos()
    materiales = crear_materiales(TEX_INFO)
    construir()
    datos = datos_paseo(creditos)
    objs = finalizar(materiales)
    print('Triángulos:', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs),
          '· colisiones:', len(COLISIONES), '· puntos de interés:', len(datos['pois']))
    if EXPORTAR:
        exportar(datos)
    if RENDER:
        render(RENDER, hdr, datos)


if __name__ == '__main__':
    principal()
