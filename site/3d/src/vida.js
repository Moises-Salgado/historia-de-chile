/* Vida del paseo 3D: mar con olas, aves, lobos marinos, botes, siluetas de personas, banderas, ropa tendida y polvo.
   Todo se arma en el navegador con geometría simple (nada descargado ni generado por IA) y lo describe el GLB
   en `datos.vida`, `datos.agua` y `datos.banderas`. El movimiento depende del reloj (t), no del final de una animación. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const uTiempo = { value: 0 };
const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ---------------------------------------------------------------- mar
// Plano enorme con material estándar (refleja el cielo y el sol como el resto de la escena) y normales calculadas
// con la suma de varias olas de distinto largo, que viajan con el viento. Las crestas se blanquean apenas.
export function crearAgua(agua, viento) {
  const r = agua.radio || 20000;
  const geo = new THREE.PlaneGeometry(r * 2, r * 2, 1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: srgb(0.07, 0.24, 0.27), roughness: 0.09, metalness: 0.0, envMapIntensity: 1.1 });
  const dir = new THREE.Vector2(viento[0], viento[1]).normalize();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = uTiempo;
    sh.uniforms.uViento = { value: dir };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPosMundo = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPosMundo; uniform float uTiempo; uniform vec2 uViento; vec3 gOla; float gDist;
        float hashA( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
        float ruidoA( vec2 p ) {
          vec2 i = floor( p ), f = fract( p ); vec2 u = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( hashA( i ), hashA( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hashA( i + vec2( 0.0, 1.0 ) ), hashA( i + 1.0 ), u.x ), u.y );
        }
        void onda( inout vec3 o, vec2 p, vec2 d, float L, float A, float lejos ) {
          float k = 6.2831853 / L, w = sqrt( 9.8 * k ), f = k * dot( d, p ) - w * uTiempo;
          float a = A * ( 1.0 - smoothstep( L * 8.0, L * 60.0, lejos ) );
          o.z += a * sin( f ); o.xy += a * k * cos( f ) * d;
        }
        vec3 olas( vec2 p, float lejos ) {
          vec3 o = vec3( 0.0 );
          vec2 d = uViento, e = vec2( -d.y, d.x );
          // la amplitud cambia de a poco en el espacio: el mar no se ve como una tela repetida
          float m1 = 0.55 + 0.9 * ruidoA( p / 140.0 + uTiempo * 0.01 ), m2 = 0.5 + ruidoA( p / 37.0 - uTiempo * 0.02 );
          onda( o, p, d, 23.0, 0.11 * m1, lejos );
          onda( o, p, normalize( d + e * 0.9 ), 17.0, 0.07 * m2, lejos );
          onda( o, p, normalize( d + e * 0.45 ), 11.0, 0.055 * m1, lejos );
          onda( o, p, normalize( d - e * 0.7 ), 7.3, 0.04 * m2, lejos );
          onda( o, p, normalize( d - e * 1.1 ), 5.1, 0.03 * m1, lejos );
          onda( o, p, normalize( d + e * 1.3 ), 3.3, 0.02 * m2, lejos );
          onda( o, p, normalize( d - e * 0.25 ), 2.1, 0.012, lejos );
          onda( o, p, normalize( d + e * 0.7 ), 1.3, 0.007, lejos );
          onda( o, p, normalize( d - e * 1.5 ), 0.7, 0.004, lejos );
          return o;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        gDist = length( vPosMundo - cameraPosition );
        gOla = olas( vPosMundo.xz, gDist );
        float cresta = smoothstep( 0.17, 0.3, gOla.z ) * ( 1.0 - smoothstep( 60.0, 600.0, gDist ) );
        diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.75, 0.80, 0.80 ), cresta * 0.35 );`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix( roughnessFactor, 0.32, smoothstep( 80.0, 3000.0, gDist ) );`)
      .replace('#include <normal_fragment_maps>', `
        vec3 nMundo = normalize( vec3( -gOla.x, 1.0, -gOla.y ) );
        normal = normalize( ( viewMatrix * vec4( nMundo, 0.0 ) ).xyz );`);
  };
  mat.customProgramCacheKey = () => 'agua-v2';
  const m = new THREE.Mesh(geo, mat);
  m.position.y = agua.nivel || 0;
  m.receiveShadow = true;
  m.name = 'agua';
  return m;
}

// ---------------------------------------------------------------- viento en hojas y telas
// Desplazamiento suave según la posición en el mundo (cada copa se mueve distinto), más fuerte arriba.
export function vientoEnVertices(sh, fuerza, alturaRef) {
  sh.uniforms.uTiempo = uTiempo;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float uTiempo;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 pm = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
      float alto = clamp( ( pm.y - ${alturaRef.toFixed(2)} ) * 0.25, 0.0, 1.0 );
      float s = sin( uTiempo * 1.6 + pm.x * 0.35 + pm.z * 0.21 ) + 0.5 * sin( uTiempo * 3.9 + pm.x * 1.3 );
      transformed.x += s * ${fuerza.toFixed(3)} * ( 0.3 + alto );
      transformed.z += cos( uTiempo * 1.3 + pm.z * 0.4 ) * ${(fuerza * 0.6).toFixed(3)} * ( 0.3 + alto );`);
}

function tela(ancho, alto, textura, color, cuelga) {
  // tela que ondea: anclada en el borde izquierdo (bandera) o en el borde de arriba (ropa)
  const geo = new THREE.PlaneGeometry(ancho, alto, 16, 8);
  geo.translate(cuelga ? 0 : ancho / 2, cuelga ? -alto / 2 : 0, 0);
  const mat = new THREE.MeshStandardMaterial({ map: textura || null, color: color || 0xffffff, side: THREE.DoubleSide, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTiempo = uTiempo;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTiempo;')
      .replace('#include <begin_vertex>', cuelga
        ? `#include <begin_vertex>
           float k = clamp( -position.y / ${alto.toFixed(2)}, 0.0, 1.0 );
           transformed.z += sin( uTiempo * 3.1 + position.x * 2.0 + modelMatrix[3][0] ) * 0.09 * k;
           transformed.x += sin( uTiempo * 2.3 + modelMatrix[3][2] ) * 0.04 * k;`
        : `#include <begin_vertex>
           float k = clamp( position.x / ${ancho.toFixed(2)}, 0.0, 1.0 );
           transformed.z += ( sin( position.x * 3.2 - uTiempo * 7.0 ) * 0.11 + sin( position.x * 1.7 - uTiempo * 4.1 + position.y * 2.0 ) * 0.07 ) * k;
           transformed.y += sin( position.x * 2.1 - uTiempo * 5.0 ) * 0.035 * k;`);
  };
  mat.customProgramCacheKey = () => 'tela-' + (cuelga ? 'r' : 'b');
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function texturaBanderaChile() {
  const c = document.createElement('canvas'); c.width = 384; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 384, 128);
  g.fillStyle = '#d52b1e'; g.fillRect(0, 128, 384, 128);
  g.fillStyle = '#0039a6'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ffffff'; g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 19 : 48;
    g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------------------------------------------------------- aves (gaviotas y jotes)
// medidas por especie: largo del cuerpo, grosor, envergadura de cada ala, cuerdas del ala, color de cuerpo y alas,
// velocidad (m/s), altura de vaivén, umbral de aleteo (más alto = aletea menos) y frecuencia del aleteo
const ESPECIES = {
  gaviota: { L: 0.27, g: 0.078, s: 0.62, c0: 0.17, c1: 0.07, cuerpo: [0.93, 0.93, 0.92], ala: [0.16, 0.16, 0.17], vel: 9, alt: 5, umbral: 0.5, f: 13, amp: 0.55, planeo: 0.1 },
  jote: { L: 0.36, g: 0.105, s: 0.85, c0: 0.26, c1: 0.14, cuerpo: [0.12, 0.1, 0.09], ala: [0.1, 0.09, 0.08], vel: 6, alt: 8, umbral: 0.93, f: 6, amp: 0.35, planeo: 0.18 },
  pelicano: { L: 0.62, g: 0.16, s: 1.15, c0: 0.36, c1: 0.18, cuerpo: [0.42, 0.4, 0.38], ala: [0.24, 0.23, 0.22], vel: 8, alt: 1.2, umbral: 0.75, f: 4.5, amp: 0.3, planeo: 0.04 },
};

function geomAve(tipo) {
  const E = ESPECIES[tipo] || ESPECIES.gaviota;
  const cuerpo = new THREE.SphereGeometry(1, 10, 6).scale(E.L, E.g, E.g * 1.05);
  const cabeza = new THREE.SphereGeometry(E.g * 0.75, 8, 5).translate(E.L, E.g * 0.35, 0);
  const cola = new THREE.ConeGeometry(E.g * 0.8, E.L * 0.6, 4).rotateZ(Math.PI / 2).translate(-E.L * 1.1, 0, 0);
  const partes = [cuerpo.toNonIndexed(), cabeza.toNonIndexed(), cola.toNonIndexed()];
  if (tipo === 'pelicano') partes.push(new THREE.ConeGeometry(E.g * 0.35, E.L * 0.75, 5).rotateZ(-Math.PI / 2).translate(E.L * 1.45, E.g * 0.2, 0).toNonIndexed());
  const g = mergeGeometries(partes);
  const s = E.s, c0 = E.c0, c1 = E.c1;
  const ala = (lado) => {
    const p = new Float32Array([c0 / 2, 0, 0, -c0 / 2, 0, 0, -c1, 0, s * lado, c1 * 0.2, 0, s * 0.96 * lado]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setIndex(lado > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    geo.computeVertexNormals();
    return geo;
  };
  return { cuerpo: g, alaD: ala(1), alaI: ala(-1) };
}

function crearAves(grupos, tipo) {
  const n = grupos.reduce((s, g) => s + g.n, 0);
  if (!n) return null;
  const E = ESPECIES[tipo] || ESPECIES.gaviota;
  const geo = geomAve(tipo);
  const mCuerpo = new THREE.MeshStandardMaterial({ color: srgb(...E.cuerpo), roughness: 0.8 });
  const mAla = new THREE.MeshStandardMaterial({ color: srgb(...E.ala), roughness: 0.85, side: THREE.DoubleSide });
  const cuerpo = new THREE.InstancedMesh(geo.cuerpo, mCuerpo, n);
  const alaD = new THREE.InstancedMesh(geo.alaD, mAla, n), alaI = new THREE.InstancedMesh(geo.alaI, mAla, n);
  for (const m of [cuerpo, alaD, alaI]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = false; }
  const aves = [];
  let rnd = 1;
  const azar = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  for (const g of grupos) for (let i = 0; i < g.n; i++) {
    aves.push({ c: v3(g.centro), R: g.radio * (0.55 + azar() * 0.6), fi: azar() * 6.283, sg: azar() < 0.5 ? -1 : 1,
      vel: E.vel * (0.8 + azar() * 0.4), alt: E.alt * (0.5 + azar()) });
  }
  const M = new THREE.Matrix4(), Ma = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  const p = new THREE.Vector3(), uno = new THREE.Vector3(1, 1, 1);
  return {
    objetos: [cuerpo, alaD, alaI],
    actualizar(t) {
      aves.forEach((a, k) => {
        const w = a.vel / a.R;
        const th = a.fi + a.sg * w * t;
        const r = a.R * (0.78 + 0.22 * Math.sin(0.11 * t + a.fi * 3));
        p.set(a.c.x + r * Math.cos(th), a.c.y + a.alt * Math.sin(0.17 * t + a.fi), a.c.z + r * Math.sin(th));
        const dx = -Math.sin(th) * a.sg, dz = Math.cos(th) * a.sg;
        const inclinacion = -a.sg * Math.atan((a.vel * a.vel) / (r * 9.8)) * 0.9;
        e.set(0, Math.atan2(-dz, dx), 0); q.setFromEuler(e);
        M.compose(p, q, uno).multiply(Ma.makeRotationX(inclinacion));
        cuerpo.setMatrixAt(k, M);
        const aleteo = Math.sin(0.33 * t + a.fi * 5) > E.umbral;
        const ang = aleteo ? E.amp * Math.sin(E.f * t + a.fi) : E.planeo + 0.04 * Math.sin(2 * t + a.fi);
        alaD.setMatrixAt(k, Ma.copy(M).multiply(new THREE.Matrix4().makeRotationX(-ang)));
        alaI.setMatrixAt(k, Ma.copy(M).multiply(new THREE.Matrix4().makeRotationX(ang)));
      });
      cuerpo.instanceMatrix.needsUpdate = alaD.instanceMatrix.needsUpdate = alaI.instanceMatrix.needsUpdate = true;
    },
    // la gaviota más cercana (para que el graznido venga de su lado)
    cercana(cam) {
      let mejor = null, dm = Infinity;
      for (const a of aves) { const d = a.c.distanceTo(cam); if (d < dm) { dm = d; mejor = a; } }
      return mejor ? { d: dm, x: mejor.c.x, z: mejor.c.z } : null;
    },
  };
}

// ---------------------------------------------------------------- lobos marinos
function geomLobo() {
  const cuerpo = new THREE.SphereGeometry(1, 12, 8).scale(1.0, 0.26, 0.3).translate(0, 0, 0);
  const cuello = new THREE.SphereGeometry(1, 10, 6).scale(0.32, 0.22, 0.22).translate(0.75, 0.12, 0);
  const aletaD = new THREE.SphereGeometry(1, 6, 4).scale(0.28, 0.04, 0.14).translate(0.35, -0.12, 0.3);
  const aletaI = aletaD.clone().translate(0, 0, -0.6);
  const cola = new THREE.SphereGeometry(1, 6, 4).scale(0.3, 0.05, 0.22).translate(-1.05, -0.08, 0);
  return { cuerpo: mergeGeometries([cuerpo, cuello, aletaD, aletaI, cola].map((g) => g.toNonIndexed())), cabeza: new THREE.SphereGeometry(1, 10, 7).scale(0.2, 0.16, 0.15) };
}

function crearLobos(lobos, nivel) {
  if (!lobos) return null;
  const g = geomLobo();
  const mat = new THREE.MeshStandardMaterial({ color: srgb(0.24, 0.16, 0.1), roughness: 0.38, metalness: 0.05 });
  const mat2 = new THREE.MeshStandardMaterial({ color: srgb(0.33, 0.23, 0.15), roughness: 0.7 });
  const lista = [], raiz = new THREE.Group();
  let s = 3;
  const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const nuevo = (seco) => {
    const o = new THREE.Group();
    const c = new THREE.Mesh(g.cuerpo, seco ? mat2 : mat);
    const cab = new THREE.Mesh(g.cabeza, seco ? mat2 : mat);
    cab.position.set(1.02, 0.28, 0);
    o.add(c, cab);
    o.scale.setScalar(0.85 + azar() * 0.35);
    c.castShadow = cab.castShadow = seco;
    raiz.add(o);
    return { o, cab };
  };
  for (const z of lobos.agua || []) for (let i = 0; i < z.n; i++) {
    const l = nuevo(false);
    lista.push({ ...l, tipo: 'agua', c: v3(z.centro), R: z.radio * (0.4 + azar() * 0.6), fi: azar() * 6.28, sg: azar() < 0.5 ? -1 : 1, vel: 0.9 + azar() * 0.8 });
  }
  for (const p of lobos.rocas || []) {
    const l = nuevo(true);
    l.o.position.set(p[0], p[1] - 0.35, p[2]);
    l.o.rotation.y = azar() * 6.28;
    lista.push({ ...l, tipo: 'roca', fi: azar() * 6.28 });
  }
  return {
    objetos: [raiz],
    actualizar(t) {
      for (const l of lista) {
        if (l.tipo === 'roca') {                       // descansan: de vez en cuando levantan la cabeza
          const alza = Math.max(0, Math.sin(0.23 * t + l.fi)) ** 3;
          l.cab.position.y = 0.28 + alza * 0.35; l.cab.rotation.z = alza * 0.6;
          continue;
        }
        const th = l.fi + l.sg * (l.vel / l.R) * t;
        const ciclo = (t * 0.06 + l.fi) % 1;           // ~17 s: nadan en la superficie y se sumergen un rato
        const hundido = ciclo > 0.62 ? Math.sin(Math.min(1, (ciclo - 0.62) / 0.38) * Math.PI) : 0;
        l.o.position.set(l.c.x + l.R * Math.cos(th), nivel - 0.14 - hundido * 2.2 + 0.05 * Math.sin(t * 1.3 + l.fi), l.c.z + l.R * Math.sin(th));
        l.o.rotation.y = Math.atan2(-(Math.cos(th) * l.sg), -Math.sin(th) * l.sg);
        const asoma = Math.max(0, Math.sin(0.4 * t + l.fi * 2)) ** 4;
        l.cab.position.y = 0.28 + asoma * 0.25;
      }
    },
    cercano(cam) {
      let dm = Infinity, x = 0, z = 0;
      for (const l of lista) if (l.tipo === 'roca') { const d = l.o.position.distanceTo(cam); if (d < dm) { dm = d; x = l.o.position.x; z = l.o.position.z; } }
      return dm < Infinity ? { d: dm, x, z } : null;
    },
  };
}

// ---------------------------------------------------------------- botes
function bote(tipo) {
  const largo = { lancha: 7, pesquero: 13, bote: 4.2 }[tipo] || 6;
  const ancho = largo * 0.32;
  const forma = new THREE.Shape();
  forma.moveTo(-largo / 2, -ancho / 2); forma.lineTo(largo * 0.25, -ancho / 2);
  forma.quadraticCurveTo(largo / 2, -ancho * 0.25, largo / 2, 0);
  forma.quadraticCurveTo(largo / 2, ancho * 0.25, largo * 0.25, ancho / 2);
  forma.lineTo(-largo / 2, ancho / 2); forma.closePath();
  const alto = tipo === 'bote' ? 0.6 : 1.2;
  const casco = new THREE.ExtrudeGeometry(forma, { depth: alto, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -alto * 0.45, 0);
  const colores = { lancha: [0.92, 0.92, 0.9], pesquero: [0.12, 0.3, 0.55], bote: [0.75, 0.2, 0.12] }[tipo] || [0.9, 0.9, 0.9];
  const o = new THREE.Group();
  const mc = new THREE.Mesh(casco, new THREE.MeshStandardMaterial({ color: srgb(...colores), roughness: 0.55 }));
  mc.castShadow = true;
  o.add(mc);
  if (tipo !== 'bote') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(largo * 0.22, largo * 0.14, ancho * 0.7),
      new THREE.MeshStandardMaterial({ color: srgb(0.95, 0.94, 0.9), roughness: 0.6 }));
    cab.position.set(tipo === 'pesquero' ? largo * 0.12 : -largo * 0.05, alto * 0.55 + largo * 0.07, 0);
    o.add(cab);
    if (tipo === 'pesquero') {
      const mastil = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      mastil.position.set(-largo * 0.15, alto + 2.5, 0); o.add(mastil);
    }
  }
  return o;
}

function crearBotes(lista, nivel) {
  if (!lista || !lista.length) return null;
  const raiz = new THREE.Group();
  const botes = lista.map((b, i) => {
    const curva = new THREE.CatmullRomCurve3(b.ruta.map((p) => new THREE.Vector3(p[0], nivel, p[2])), false, 'centripetal');
    const o = bote(b.tipo); raiz.add(o);
    return { o, curva, L: curva.getLength(), vel: b.vel || 4, fase: i * 0.37 };
  });
  const p = new THREE.Vector3(), d = new THREE.Vector3();
  return {
    objetos: [raiz],
    actualizar(t) {
      for (const b of botes) {
        const u = ((t * b.vel / b.L) + b.fase) % 2;
        const s = u < 1 ? u : 2 - u;                 // va y vuelve
        b.curva.getPointAt(s, p); b.curva.getTangentAt(s, d);
        if (u >= 1) d.negate();
        b.o.position.set(p.x, nivel + 0.06 * Math.sin(t * 1.4 + b.fase * 9), p.z);
        b.o.rotation.set(0.03 * Math.sin(t * 1.1 + b.fase), Math.atan2(-d.z, d.x), 0.025 * Math.sin(t * 0.9 + b.fase * 3), 'YXZ');
      }
    },
  };
}

// ---------------------------------------------------------------- siluetas de personas (sin rostro ni vestimenta)
function persona(color) {
  // figura de maqueta: cápsulas redondeadas, sin rostro ni ropa
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const o = new THREE.Group();
  const pieza = (geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; o.add(m); return m; };
  const pierna = () => new THREE.CapsuleGeometry(0.068, 0.74, 4, 8).translate(0, -0.44, 0);
  const brazo = () => new THREE.CapsuleGeometry(0.045, 0.5, 4, 6).translate(0, -0.3, 0);
  const piernas = [pieza(pierna(), 0, 0.93, -0.085), pieza(pierna(), 0, 0.93, 0.085)];
  pieza(new THREE.CapsuleGeometry(0.16, 0.36, 4, 10).scale(0.72, 1, 1.15), 0, 1.24, 0);
  const brazos = [pieza(brazo(), 0, 1.48, -0.215), pieza(brazo(), 0, 1.48, 0.215)];
  pieza(new THREE.CapsuleGeometry(0.05, 0.06, 3, 6), 0, 1.56, 0);
  const cabeza = pieza(new THREE.SphereGeometry(0.105, 12, 10).scale(0.95, 1.12, 0.9), 0.01, 1.7, 0);
  return { o, piernas, brazos, cabeza };
}

function crearPersonas(cfg, alturaSuelo) {
  if (!cfg || !cfg.rutas || !cfg.rutas.length) return null;
  const tonos = [[0.2, 0.23, 0.32], [0.34, 0.34, 0.35], [0.3, 0.24, 0.2], [0.26, 0.29, 0.22], [0.33, 0.18, 0.17], [0.22, 0.22, 0.24]];
  const raiz = new THREE.Group();
  const rutas = cfg.rutas.map((r) => {
    const pts = r.map((p) => new THREE.Vector2(p[0], p[1]));
    const acum = [0];
    for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, acum, L: acum[acum.length - 1] };
  }).filter((r) => r.L > 4);
  if (!rutas.length) return null;
  const gente = [];
  for (let i = 0; i < cfg.n; i++) {
    const p = persona(srgb(...tonos[i % tonos.length]));
    p.o.scale.setScalar(0.92 + ((i * 37) % 10) / 60);
    raiz.add(p.o);
    gente.push({ ...p, ruta: rutas[i % rutas.length], s0: (i * 0.618) % 1, vel: 1.05 + ((i * 13) % 7) / 20 });
  }
  const a = new THREE.Vector2();
  return {
    objetos: [raiz],
    actualizar(t) {
      for (const g of gente) {
        const r = g.ruta;
        const u = ((t * g.vel / r.L) + g.s0) % 2;
        const s = (u < 1 ? u : 2 - u) * r.L;
        let i = 1; while (i < r.acum.length - 1 && r.acum[i] < s) i++;
        const k = (s - r.acum[i - 1]) / Math.max(1e-6, r.acum[i] - r.acum[i - 1]);
        a.lerpVectors(r.pts[i - 1], r.pts[i], k);
        let dx = r.pts[i].x - r.pts[i - 1].x, dz = r.pts[i].y - r.pts[i - 1].y;
        if (u >= 1) { dx = -dx; dz = -dz; }
        g.o.position.set(a.x, alturaSuelo(a.x, a.y), a.y);
        g.o.rotation.y = Math.atan2(-dz, dx);
        const f = t * g.vel * 4.4 + g.s0 * 10;
        g.piernas[0].rotation.z = 0.42 * Math.sin(f); g.piernas[1].rotation.z = -0.42 * Math.sin(f);
        g.brazos[0].rotation.z = -0.32 * Math.sin(f); g.brazos[1].rotation.z = 0.32 * Math.sin(f);
        g.o.position.y += Math.abs(Math.cos(f)) * 0.035;
      }
    },
  };
}

// ---------------------------------------------------------------- la llama del castillo (vive ahí, según el museo)
function crearLlama(cfg, alturaSuelo) {
  if (!cfg) return null;
  const mat = new THREE.MeshStandardMaterial({ color: srgb(0.9, 0.87, 0.8), roughness: 0.95 });
  const o = new THREE.Group();
  const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; o.add(m); return m; };
  add(new THREE.SphereGeometry(1, 12, 8).scale(0.62, 0.32, 0.3), 0, 1.05, 0);
  const cuello = new THREE.Group(); cuello.position.set(0.48, 1.18, 0); o.add(cuello);
  const cg = new THREE.CylinderGeometry(0.1, 0.13, 0.75, 8).translate(0, 0.37, 0);
  const mc = new THREE.Mesh(cg, mat); mc.castShadow = true; cuello.add(mc);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7).scale(0.2, 0.11, 0.1), mat); cab.position.set(0.1, 0.78, 0); cuello.add(cab);
  for (const z of [-0.05, 0.05]) { const or = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 5), mat); or.position.set(0.0, 0.9, z); cuello.add(or); }
  const patas = [];
  for (const [x, z] of [[0.4, 0.15], [0.4, -0.15], [-0.4, 0.15], [-0.4, -0.15]]) {
    const pg = new THREE.CylinderGeometry(0.045, 0.035, 0.85, 6).translate(0, -0.42, 0);
    const pm = new THREE.Mesh(pg, mat); pm.position.set(x, 0.88, z); pm.castShadow = true; o.add(pm); patas.push(pm);
  }
  add(new THREE.SphereGeometry(0.08, 6, 5), -0.62, 1.12, 0);
  const C = new THREE.Vector2(cfg.centro[0], cfg.centro[1]);
  const st = { p: C.clone(), meta: C.clone(), pausa: 4, fase: 0, rumbo: 0 };
  return {
    objetos: [o],
    actualizar(t, dt) {
      const d = st.meta.clone().sub(st.p);
      if (st.pausa > 0) {
        st.pausa -= dt;
        cuello.rotation.z = -1.25 + 0.08 * Math.sin(t * 2.2);           // pasta, con la cabeza abajo
        if (st.pausa <= 0) {
          const a = Math.random() * 6.283, r = Math.random() * cfg.radio;
          st.meta.set(C.x + Math.cos(a) * r, C.y + Math.sin(a) * r);
        }
      } else if (d.length() < 0.3) {
        st.pausa = 5 + Math.random() * 9;
      } else {
        const v = 0.55;
        d.normalize();
        st.p.addScaledVector(d, v * dt);
        st.rumbo = Math.atan2(-d.y, d.x);
        st.fase += dt * 5.5;
        cuello.rotation.z += (0.05 - cuello.rotation.z) * Math.min(1, dt * 2);
        patas.forEach((pm, i) => { pm.rotation.z = 0.35 * Math.sin(st.fase + (i % 3 === 0 ? 0 : Math.PI)); });
      }
      o.position.set(st.p.x, alturaSuelo(st.p.x, st.p.y), st.p.y);
      o.rotation.y = st.rumbo;
    },
  };
}

// ---------------------------------------------------------------- banderas, ropa tendida y polvo
function crearBanderas(lista) {
  if (!lista || !lista.length) return null;
  const raiz = new THREE.Group();
  const tex = texturaBanderaChile();
  for (const b of lista) {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, b.alto, 8), new THREE.MeshStandardMaterial({ color: srgb(0.75, 0.76, 0.77), metalness: 0.6, roughness: 0.35 }));
    poste.position.set(b.pos[0], b.pos[1] + b.alto / 2, b.pos[2]); poste.castShadow = true;
    const t = tela(1.5, 1.0, tex, null, false);
    t.position.set(b.pos[0] + 0.05, b.pos[1] + b.alto - 0.55, b.pos[2]);
    t.rotation.y = b.giro || 0;
    raiz.add(poste, t);
  }
  return { objetos: [raiz], actualizar() {} };
}

function crearRopa(lista) {
  if (!lista || !lista.length) return null;
  const raiz = new THREE.Group();
  const colores = [[0.92, 0.9, 0.85], [0.75, 0.82, 0.9], [0.85, 0.75, 0.62], [0.7, 0.3, 0.25], [0.9, 0.88, 0.8], [0.45, 0.55, 0.7]];
  let c = 0;
  for (const l of lista) {
    const A = v3(l.a), Bp = v3(l.b);
    const cuerda = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, A.distanceTo(Bp), 4), new THREE.MeshBasicMaterial({ color: 0x3a3a3a }));
    cuerda.position.copy(A).add(Bp).multiplyScalar(0.5);
    cuerda.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bp.clone().sub(A).normalize());
    raiz.add(cuerda);
    for (const P of [A, Bp]) {
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, P.y, 6), new THREE.MeshStandardMaterial({ color: srgb(0.4, 0.32, 0.24), roughness: 0.9 }));
      poste.position.set(P.x, P.y / 2, P.z); poste.castShadow = true; raiz.add(poste);
    }
    for (let i = 0; i < l.n; i++) {
      const f = (i + 0.7) / (l.n + 0.4);
      const w = 0.45 + ((i * 7) % 5) * 0.12, h = 0.5 + ((i * 3) % 4) * 0.14;
      const t = tela(w, h, null, srgb(...colores[c++ % colores.length]), true);
      t.position.copy(A).lerp(Bp, f); t.position.y -= 0.02;
      t.rotation.y = Math.atan2(-(Bp.z - A.z), Bp.x - A.x);
      raiz.add(t);
    }
  }
  return { objetos: [raiz], actualizar() {} };
}

function crearPolvo(cfg, viento) {
  if (!cfg) return null;
  const n = cfg.n || 500, C = v3(cfg.centro), T = v3(cfg.tam);
  const pos = new Float32Array(n * 3), sem = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = C.x + (Math.random() - 0.5) * T.x; pos[i * 3 + 1] = C.y + Math.random() * T.y; pos[i * 3 + 2] = C.z + (Math.random() - 0.5) * T.z;
    sem[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: srgb(0.86, 0.76, 0.62), size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  const vx = viento[0] * 2.2, vz = viento[1] * 2.2;
  return {
    objetos: [pts],
    actualizar(t, dt) {
      for (let i = 0; i < n; i++) {
        const k = i * 3, s = sem[i];
        pos[k] += (vx + Math.sin(t * 0.7 + s) * 0.8) * dt;
        pos[k + 1] += (Math.sin(t * 1.3 + s * 2) * 0.25 - 0.05) * dt;
        pos[k + 2] += (vz + Math.cos(t * 0.6 + s) * 0.8) * dt;
        if (pos[k] > C.x + T.x / 2) pos[k] -= T.x; if (pos[k] < C.x - T.x / 2) pos[k] += T.x;
        if (pos[k + 2] > C.z + T.z / 2) pos[k + 2] -= T.z; if (pos[k + 2] < C.z - T.z / 2) pos[k + 2] += T.z;
        if (pos[k + 1] < C.y) pos[k + 1] = C.y + T.y; if (pos[k + 1] > C.y + T.y) pos[k + 1] = C.y;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- todo junto
export function crearVida(escena, datos, alturaSuelo) {
  const v = datos.vida || {};
  const nivel = datos.agua ? datos.agua.nivel || 0 : 0;
  const viento = v.viento || [1, 0.35];
  const sistemas = [];
  if (datos.agua) { const a = crearAgua(datos.agua, viento); escena.add(a); }
  const gav = v.gaviotas ? crearAves(v.gaviotas, 'gaviota') : null;
  const jotes = v.aves ? crearAves(v.aves, 'jote') : null;
  const pel = v.pelicanos ? crearAves(v.pelicanos, 'pelicano') : null;
  const lobos = crearLobos(v.lobos, nivel);
  for (const s of [gav, jotes, pel, lobos, crearBotes(v.botes, nivel), crearPersonas(v.personas, alturaSuelo), crearLlama(v.llama, alturaSuelo),
    crearBanderas(v.banderas), crearRopa(v.ropa), crearPolvo(v.polvo, viento)]) {
    if (!s) continue;
    s.objetos.forEach((o) => escena.add(o));
    sistemas.push(s);
  }
  return {
    activa: sistemas.length > 0 || !!datos.agua,
    actualizar(t, dt) { for (const s of sistemas) s.actualizar(t, dt); },
    gaviota: (cam) => (gav ? gav.cercana(cam) : null),
    lobo: (cam) => (lobos ? lobos.cercano(cam) : null),
  };
}
