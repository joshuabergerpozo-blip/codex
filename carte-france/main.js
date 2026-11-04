import * as THREE from 'three';
import { OrbitControls } from './lib/OrbitControls.js';

/* La France en relief.
   Unités : 1 = 1 km. x vers l'est, z vers le sud, y vers le haut.
   Les données (Lambert-93) sont dans data/ : couleur (Sentinel-2), relief (Copernicus DEM, en mètres sur R et G), masque, contours, lieux. */

const MOBILE = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const BASE = 32;            // épaisseur du socle sous le niveau de la mer
const $ = s => document.querySelector(s);
const loaderBar = $('#loader .bar i'), loaderText = $('#loader p');
let progress = 0;
const step = (p, t) => { progress = Math.max(progress, p); loaderBar.style.width = `${progress}%`; if (t) loaderText.textContent = t; };

const fetchJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
async function bitmap(u) {
  const b = await (await fetch(u)).blob();
  return createImageBitmap(b, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
}
function pixels(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  return x.getImageData(0, 0, img.width, img.height).data;
}

/* ---------- Rendu ---------- */
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8fa8c4, 0.00016);
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 1, 30000);
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.07, maxPolarAngle: 1.42, minDistance: 6, maxDistance: 5200, zoomToCursor: true, screenSpacePanning: false, autoRotateSpeed: 0.35 });
controls.listenToKeyEvents(window);

const sun = new THREE.DirectionalLight(0xffffff, 2.8);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 2048 : 4096, MOBILE ? 2048 : 4096);
Object.assign(sun.shadow.camera, { left: -720, right: 720, top: 720, bottom: -720, near: 50, far: 5000 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xc4d6f0, 0x4a3b2a, 1.35);
scene.add(hemi);

/* ---------- Données ---------- */
let KW, KH, RW, RH, heights, maskW, maskH, maskData, lieux, rings;
let exag = 10;
const X = u => (u - 0.5) * KW, Z = w => (w - 0.5) * KH;
function hAt(u, w) {  // altitude en km, interpolation bilinéaire
  const fx = Math.min(Math.max(u, 0), 1) * (RW - 1), fy = Math.min(Math.max(w, 0), 1) * (RH - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(x0 + 1, RW - 1), y1 = Math.min(y0 + 1, RH - 1), tx = fx - x0, ty = fy - y0;
  const a = heights[y0 * RW + x0], b = heights[y0 * RW + x1], c = heights[y1 * RW + x0], d = heights[y1 * RW + x1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
const maskAt = (u, w) => maskData[Math.min(maskH - 1, Math.max(0, Math.round(w * (maskH - 1)))) * maskW + Math.min(maskW - 1, Math.max(0, Math.round(u * (maskW - 1))))];

/* ---------- Le terrain ---------- */
let terrain, walls, wallMat, heightTex;
const terrainUniforms = { uExag: { value: 10 }, uHeight: { value: null }, uTexel: { value: new THREE.Vector2() }, uKm: { value: new THREE.Vector2() } };
// Le relief monte dans le shader (exagération réglable en direct), les normales sont calculées au pixel depuis la texture d'altitude
function displace(shader) {
  Object.assign(shader.uniforms, terrainUniforms);
  shader.vertexShader = 'attribute float hk;\nuniform float uExag;\n' + shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, hk * uExag, position.z);');
}
function buildTerrain(colorTex, maskTex) {
  const NX = MOBILE ? 900 : 1600, NZ = Math.round(NX * KH / KW);
  const id = new Int32Array(NX * NZ).fill(-1);
  const near = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) if (maskAt(i / (NX - 1), j / (NZ - 1)) > 0) near[j * NX + i] = 1;
  // On garde les cellules qui touchent la France (avec une marge d'une cellule)
  const keep = new Uint8Array((NX - 1) * (NZ - 1));
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
    let k = 0;
    for (let dj = -1; dj <= 2 && !k; dj++) for (let di = -1; di <= 2 && !k; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < NX && b < NZ && near[b * NX + a]) k = 1;
    }
    keep[j * (NX - 1) + i] = k;
  }
  let n = 0;
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) if (keep[j * (NX - 1) + i]) for (const v of [j * NX + i, j * NX + i + 1, (j + 1) * NX + i, (j + 1) * NX + i + 1]) if (id[v] < 0) id[v] = n++;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), nor = new Float32Array(n * 3), hk = new Float32Array(n);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = id[j * NX + i];
    if (k < 0) continue;
    const u = i / (NX - 1), w = j / (NZ - 1);
    hk[k] = hAt(u, w);
    pos[k * 3] = X(u); pos[k * 3 + 1] = hk[k] * 10; pos[k * 3 + 2] = Z(w);
    uv[k * 2] = u; uv[k * 2 + 1] = 1 - w;
    nor[k * 3 + 1] = 1;
  }
  const idx = new Uint32Array(keep.reduce((s, v) => s + v, 0) * 6);
  let q = 0;
  for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) if (keep[j * (NX - 1) + i]) {
    const a = id[j * NX + i], b = id[j * NX + i + 1], c = id[(j + 1) * NX + i], d = id[(j + 1) * NX + i + 1];
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('hk', new THREE.BufferAttribute(hk, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 60, 0), Math.hypot(KW, KH) / 2 + 300);
  // Altitudes en demi-flottants (filtrage linéaire garanti en WebGL 2)
  const half = new Uint16Array(RW * RH);
  for (let r = 0; r < RH; r++) { const src = (RH - 1 - r) * RW, dst = r * RW; for (let c = 0; c < RW; c++) half[dst + c] = THREE.DataUtils.toHalfFloat(heights[src + c]); }
  heightTex = new THREE.DataTexture(half, RW, RH, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;
  terrainUniforms.uHeight.value = heightTex;
  terrainUniforms.uTexel.value.set(1 / RW, 1 / RH);
  terrainUniforms.uKm.value.set(KW / (RW - 1), KH / (RH - 1));
  const mat = new THREE.MeshStandardMaterial({ map: colorTex, alphaMap: maskTex, alphaTest: 0.38, roughness: 0.92, metalness: 0 });
  mat.onBeforeCompile = sh => {
    displace(sh);
    sh.fragmentShader = 'uniform sampler2D uHeight;\nuniform vec2 uTexel, uKm;\nuniform float uExag;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `
      {
        vec2 e = uTexel * 1.0;
        float hl = texture2D(uHeight, vMapUv - vec2(e.x, 0.)).r, hr = texture2D(uHeight, vMapUv + vec2(e.x, 0.)).r;
        float hd = texture2D(uHeight, vMapUv - vec2(0., e.y)).r, hu = texture2D(uHeight, vMapUv + vec2(0., e.y)).r;
        float gx = (hr - hl) / (2. * uKm.x) * uExag;
        float gz = (hd - hu) / (2. * uKm.y) * uExag;   // v vers le nord, z vers le sud
        normal = normalize((viewMatrix * vec4(normalize(vec3(-gx, 1., -gz)), 0.)).xyz);  // le terrain n’a pas de transformation propre
      }`);
  };
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: maskTex, alphaTest: 0.38 });
  depth.onBeforeCompile = displace;
  terrain = new THREE.Mesh(g, mat);
  terrain.customDepthMaterial = depth;
  terrain.castShadow = terrain.receiveShadow = true;
  scene.add(terrain);
}
function applyExag() {
  terrainUniforms.uExag.value = exag;
  wallMat.uniforms.uExag.value = exag;
  $('#exv').textContent = $('#exr').textContent = `×${(Math.round(exag * 2) / 2).toLocaleString('fr-FR')}`;
}

/* ---------- Le socle : falaises de roche le long des côtes et des frontières ---------- */
function buildWalls() {
  const P = [], N = [], T = [], H = [], A = [];
  for (const ring of rings) {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    const sgn = area > 0 ? 1 : -1;  // sens du contour, pour orienter les normales vers l'extérieur
    let along = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [u0, w0] = ring[i], [u1, w1] = ring[i + 1];
      const x0 = X(u0), z0 = Z(w0), x1 = X(u1), z1 = Z(w1), len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1e-4) continue;
      const nx = -(z1 - z0) / len * sgn, nz = (x1 - x0) / len * sgn;
      const h0 = hAt(u0, w0), h1 = hAt(u1, w1), a1 = along + len;
      // deux triangles : haut0, bas0, haut1 / haut1, bas0, bas1
      for (const [x, z, t, h, a] of [[x0, z0, 1, h0, along], [x0, z0, 0, h0, along], [x1, z1, 1, h1, a1], [x1, z1, 1, h1, a1], [x0, z0, 0, h0, along], [x1, z1, 0, h1, a1]]) {
        P.push(x, 0, z); N.push(nx, 0, nz); T.push(t); H.push(h); A.push(a);
      }
      along = a1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('top', new THREE.Float32BufferAttribute(T, 1));
  g.setAttribute('hk', new THREE.Float32BufferAttribute(H, 1));
  g.setAttribute('al', new THREE.Float32BufferAttribute(A, 1));
  wallMat = new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uExag: { value: exag }, uBase: { value: BASE }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uAmb: { value: new THREE.Color(.4, .42, .46) } }]),
    vertexShader: `
      attribute float top; attribute float hk; attribute float al;
      uniform float uExag, uBase;
      varying vec3 vW; varying vec3 vN; varying float vD; varying float vA;
      #include <common>
      #include <fog_pars_vertex>
      #include <logdepthbuf_pars_vertex>
      void main() {
        float ytop = hk * uExag + 0.04;
        vec3 p = vec3(position.x, top > .5 ? ytop : -uBase, position.z);
        vW = p; vN = normal; vD = ytop - p.y; vA = al;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <logdepthbuf_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uBase; uniform vec3 uSun, uSunCol, uAmb;
      varying vec3 vW; varying vec3 vN; varying float vD; varying float vA;
      #include <common>
      #include <fog_pars_fragment>
      #include <logdepthbuf_pars_fragment>
      float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.07; a *= .5; } return s; }
      void main() {
        #include <logdepthbuf_fragment>
        float y = vW.y;
        float warp = fbm(vec2(vA * .05, y * .15)) * 2.6;
        float L = y * .85 + warp;
        float b1 = smoothstep(.35, .65, sin(L * 1.1) * .5 + .5);
        float b2 = smoothstep(.55, .9, sin(L * 3.3 + 1.7) * .5 + .5);
        vec3 lime = vec3(.70, .63, .52), ochre = vec3(.56, .42, .29), marl = vec3(.44, .42, .40), dark = vec3(.30, .27, .25);
        vec3 c = mix(lime, ochre, b1);
        c = mix(c, marl, b2 * .45);
        c = mix(c, dark, smoothstep(-uBase * .45, -uBase, y) * .7);
        float grain = fbm(vec2(vA * 1.7, y * 2.3));
        c *= .82 + grain * .36;
        // Terre puis herbe juste sous la surface
        float soil = .32 + fbm(vec2(vA * .3, 3.)) * .35;
        c = mix(c, vec3(.26, .18, .11) * (.8 + grain * .4), 1. - smoothstep(soil * .7, soil, vD));
        c = mix(c, vec3(.24, .31, .15), 1. - smoothstep(.03, .08, vD));
        // Ombre de pied et lumière
        c *= mix(.45, 1., smoothstep(-uBase, -uBase * .55, y));
        vec3 n = normalize(vN);
        float dif = max(dot(n, uSun), 0.);
        vec3 col = c * (uAmb + uSunCol * dif * .95);
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  walls = new THREE.Mesh(g, wallMat);
  walls.frustumCulled = false;
  scene.add(walls);
  // Dessous du socle
  const shapes = rings.map(r => new THREE.Shape(r.map(([u, w]) => new THREE.Vector2(X(u), -Z(w)))));
  const bottom = new THREE.Mesh(new THREE.ShapeGeometry(shapes), new THREE.MeshBasicMaterial({ color: 0x15110d, side: THREE.DoubleSide }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = -BASE;
  scene.add(bottom);
}

/* ---------- Soleil et ciel ---------- */
const SKY = {
  day: ['#0d1a2e', '#2c4a72', '#9ab6d2'], gold: ['#141a33', '#5b4a6b', '#e8a56b'], dusk: ['#0a0f1f', '#2a2648', '#b4646a'],
};
const mixHex = (a, b, t) => { const A = new THREE.Color(a), B = new THREE.Color(b); return '#' + A.lerp(B, t).getHexString(); };
let hour = 14;
function applySun() {
  const t = (hour - 6) / 14.5;                       // 0 = lever, 1 = coucher
  const el = THREE.MathUtils.degToRad(4 + 54 * Math.sin(Math.PI * t));
  const az = THREE.MathUtils.degToRad(90 + 180 * t); // est → sud → ouest
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  const target = controls.target;
  sun.position.copy(target).addScaledVector(dir, 2200);
  sun.target.position.copy(target);
  const low = 1 - THREE.MathUtils.smoothstep(Math.sin(el), 0.08, 0.55);
  sun.color.setRGB(1, 0.95 - 0.32 * low, 0.9 - 0.5 * low);
  sun.intensity = 2.0 + 1.2 * Math.sin(el) - 0.4 * low;
  hemi.intensity = 1.1 + 0.35 * Math.sin(el);
  hemi.color.set(low > .5 ? 0xb7b2d6 : 0xc4d6f0);
  wallMat.uniforms.uSun.value.copy(dir);
  wallMat.uniforms.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity / 3);
  wallMat.uniforms.uAmb.value.setRGB(.36, .38, .44).multiplyScalar(hemi.intensity / 1.3);
  const s = low < .5 ? SKY.day.map((c, i) => mixHex(c, SKY.gold[i], low * 2)) : SKY.gold.map((c, i) => mixHex(c, SKY.dusk[i], (low - .5) * 2));
  const root = document.documentElement.style;
  root.setProperty('--sky-top', s[0]); root.setProperty('--sky-mid', s[1]); root.setProperty('--sky-low', s[2]);
  scene.fog.color.set(s[2]).lerp(new THREE.Color(s[1]), .35);
  $('#hrv').textContent = `${Math.floor(hour)} h ${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`.replace(' h 00', ' h');
}

/* ---------- Noms des lieux ---------- */
const labelEls = [];
function buildLabels() {
  const box = $('#labels');
  for (const l of lieux) {
    const el = document.createElement('div');
    el.className = 'lb ' + (l.t === 'sommet' ? 'pk' : l.v === 1 ? 's1' : 's2');
    el.innerHTML = l.t === 'sommet' ? `<span>${l.n}</span><small>${l.v.toLocaleString('fr-FR')} m</small><i></i>` : `<i></i><span>${l.n}</span>`;
    box.append(el);
    labelEls.push({ el, l, p: new THREE.Vector3(), shown: true });
  }
}
const tmp = new THREE.Vector3();
function updateLabels() {
  if (document.body.classList.contains('nolabels')) return;
  const dist = camera.position.distanceTo(controls.target);
  for (const o of labelEls) {
    const { l } = o;
    o.p.set(X(l.u), hAt(l.u, l.w) * exag + (l.t === 'sommet' ? 0.6 : 0.15), Z(l.w));
    tmp.copy(o.p).project(camera);
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 &&
      (l.t === 'sommet' ? dist < 1700 : l.v === 1 ? true : dist < 1250) && camera.position.distanceTo(o.p) > 4;
    if (vis !== o.shown) { o.el.classList.toggle('off', !vis); o.shown = vis; }
    if (vis) o.el.style.transform = `translate(${((tmp.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - tmp.y) / 2 * innerHeight).toFixed(1)}px) ${l.t === 'sommet' ? 'translate(-50%, -100%)' : 'translate(-5px, -50%)'}`;
  }
}

/* ---------- Altitude sous le curseur ---------- */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let mouseDirty = false;
canvas.addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouseDirty = true; });
function pickGround() {
  ray.setFromCamera(mouse, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  if (d.y >= 0) return null;
  // Marche le long du rayon jusqu'à passer sous le relief
  const tTop = Math.max(0, (5 * exag - o.y) / d.y), tSea = (-o.y) / d.y;
  let prev = tTop;
  const n = 160;
  for (let i = 1; i <= n; i++) {
    const t = tTop + (tSea - tTop) * i / n;
    const x = o.x + d.x * t, z = o.z + d.z * t, u = x / KW + .5, w = z / KH + .5;
    if (u < 0 || u > 1 || w < 0 || w > 1) { prev = t; continue; }
    const y = o.y + d.y * t, h = hAt(u, w) * exag;
    if (y <= h) {
      let a = prev, b = t;
      for (let k = 0; k < 12; k++) { const m = (a + b) / 2, xm = o.x + d.x * m, zm = o.z + d.z * m; if (o.y + d.y * m <= hAt(xm / KW + .5, zm / KH + .5) * exag) b = m; else a = m; }
      const xm = o.x + d.x * b, zm = o.z + d.z * b, um = xm / KW + .5, wm = zm / KH + .5;
      return maskAt(um, wm) > 90 ? hAt(um, wm) * 1000 : null;
    }
    prev = t;
  }
  return null;
}

/* ---------- Vues ---------- */
const VIEWS = [
  { n: 'France', u: .5, w: .53, d: 1750, pol: 47, az: -12, ex: 10 },
  { n: 'Alpes', at: 'Barre des Écrins', du: .0, dw: -.04, d: 260, pol: 66, az: -105, ex: 2.5 },
  { n: 'Pyrénées', at: 'Vignemale', du: .09, dw: -.01, d: 300, pol: 68, az: 172, ex: 3 },
  { n: 'Massif central', at: 'Puy de Sancy', du: .01, dw: .03, d: 300, pol: 60, az: -20, ex: 5 },
  { n: 'Corse', at: 'Monte Cinto', du: .01, dw: .06, d: 290, pol: 56, az: -25, ex: 3 },
  { n: 'Bretagne', at: 'Brest', du: .1, dw: .02, d: 360, pol: 55, az: 20, ex: 8 },
  { n: 'Paris', at: 'Paris', du: 0, dw: .01, d: 140, pol: 52, az: 0, ex: 6 },
];
let fly = null;
function viewTarget(v) {
  let u = v.u, w = v.w;
  if (v.at) { const l = lieux.find(x => x.n === v.at); u = l.u + v.du; w = l.w + v.dw; }
  const t = new THREE.Vector3(X(u), hAt(u, w) * (v.ex ?? exag) * .6, Z(w));
  const pol = THREE.MathUtils.degToRad(v.pol), az = THREE.MathUtils.degToRad(v.az);
  // Écran en portrait : on recule pour que la vue tienne en largeur
  const a = innerWidth / innerHeight, k = a >= 1.2 ? 1 : v.n === 'France' ? 1.32 / a : Math.pow(1.2 / a, .6);
  const p = t.clone().add(new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)).multiplyScalar(Math.min(v.d * k, 5000)));
  return { t, p };
}
function flyTo(v, dur = 2600, from) {
  const { t, p } = viewTarget(v);
  fly = { t0: performance.now(), dur, ft: (from?.t || controls.target).clone(), fp: (from?.p || camera.position).clone(), t, p, e0: exag, e1: v.ex ?? exag };
  $$('#places button').forEach(b => b.classList.toggle('on', b.dataset.v === v.n));
}
const $$ = s => [...document.querySelectorAll(s)];
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function stepFly(now) {
  if (!fly) return;
  const k = Math.min(1, (now - fly.t0) / fly.dur), e = ease(k);
  controls.target.lerpVectors(fly.ft, fly.t, e);
  // Trajectoire en arc : on prend de la hauteur au milieu du vol
  camera.position.lerpVectors(fly.fp, fly.p, e);
  camera.position.y += Math.sin(Math.PI * e) * Math.min(900, fly.fp.distanceTo(fly.p) * .35);
  if (fly.e0 !== fly.e1) { exag = fly.e0 + (fly.e1 - fly.e0) * e; $('#ex').value = exag; applyExag(); }
  if (k >= 1) fly = null;
}
['start', 'wheel'].forEach(ev => canvas.addEventListener(ev === 'start' ? 'pointerdown' : ev, () => { fly = null; $$('#places button').forEach(b => b.classList.remove('on')); }, { passive: true }));

/* ---------- Interface ---------- */
function bindUI() {
  const nav = $('#places');
  nav.innerHTML = VIEWS.map(v => `<button type="button" data-v="${v.n}">${v.n}</button>`).join('');
  nav.addEventListener('click', e => { const b = e.target.closest('button'); if (b) flyTo(VIEWS.find(v => v.n === b.dataset.v)); });
  const ex = $('#ex');
  ex.addEventListener('input', () => {
    exag = +ex.value;
    applyExag();
  });
  $('#hr').addEventListener('input', e => { hour = +e.target.value; applySun(); });
  const tog = (id, fn) => $(id).addEventListener('click', e => { const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); fn(on); });
  tog('#tLabels', on => document.body.classList.toggle('nolabels', !on));
  tog('#tSpin', on => { controls.autoRotate = on; });
  $('#ctrlToggle').addEventListener('click', e => { const o = $('#ctrl').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', o); });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

/* ---------- Démarrage ---------- */
async function main() {
  step(4, 'Chargement des données satellite…');
  const texLoader = new THREE.TextureLoader();
  const loadTex = u => new Promise((res, rej) => texLoader.load(u, res, undefined, rej));
  const [meta, rg, reliefImg, maskImg, colorTex] = await Promise.all([
    fetchJSON('data/lieux.json'), fetchJSON('data/contours.json'),
    bitmap('data/relief.webp').then(b => (step(40, 'Relief chargé…'), b)),
    bitmap('data/masque.png'),
    loadTex('data/couleur-4k.webp').then(t => (step(70, 'Imagerie chargée…'), t)),
  ]);
  KW = meta.grid.km[0]; KH = meta.grid.km[1]; lieux = meta.lieux; rings = rg;
  RW = reliefImg.width; RH = reliefImg.height;
  const rp = pixels(reliefImg);
  heights = new Float32Array(RW * RH);
  for (let i = 0; i < RW * RH; i++) heights[i] = (rp[i * 4] * 256 + rp[i * 4 + 1]) / 1000;
  maskW = maskImg.width; maskH = maskImg.height;
  const mp = pixels(maskImg);
  maskData = new Uint8Array(maskW * maskH);
  for (let i = 0; i < maskData.length; i++) maskData[i] = mp[i * 4];
  step(80, 'Construction du relief…');
  await new Promise(r => setTimeout(r, 20));
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mc = document.createElement('canvas'); mc.width = maskW; mc.height = maskH; mc.getContext('2d').drawImage(maskImg, 0, 0);
  const maskTex = new THREE.CanvasTexture(mc);
  maskTex.colorSpace = THREE.NoColorSpace;
  buildTerrain(colorTex, maskTex);
  buildWalls();
  applyExag();
  buildLabels();
  bindUI();
  step(100, 'Prêt');
  // Arrivée : vue du ciel, puis plongée vers la vue d'ensemble
  const first = VIEWS[0];
  const start = viewTarget({ ...first, d: 4200, pol: 6, az: 0 });
  camera.position.copy(start.p); controls.target.copy(start.t);
  applySun();
  flyTo(first, 4200, start);
  renderer.compile(scene, camera);
  requestAnimationFrame(() => $('#loader').classList.add('done'));
  // Imagerie 8K si la carte graphique le permet
  if (!MOBILE && renderer.capabilities.maxTextureSize >= 8192) {
    loadTex('data/couleur-8k.webp').then(t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const old = terrain.material.map; terrain.material.map = t; terrain.material.needsUpdate = true; old.dispose();
    }).catch(() => {});
  }
  renderer.setAnimationLoop(frame);
}
let lastSunTarget = new THREE.Vector3(), shadowSpan = 720;
function frame(now) {
  stepFly(now);
  controls.update();
  if (lastSunTarget.distanceToSquared(controls.target) > 400) { lastSunTarget.copy(controls.target); applySun(); }
  // Brume atmosphérique : légère de loin, plus présente au ras du sol
  scene.fog.density = 0.00016 * Math.min(1, 1750 / camera.position.distanceTo(controls.target));
  // L'ombre portée couvre la zone regardée : plus on zoome, plus elle est fine
  const span = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 0.85, 50, 720);
  if (Math.abs(span - shadowSpan) / shadowSpan > 0.12) {
    shadowSpan = span;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = span / 1200;
  }
  renderer.render(scene, camera);
  updateLabels();
  if (mouseDirty) {
    mouseDirty = false;
    const h = pickGround();
    $('#alt').textContent = h == null ? '—' : `${Math.round(h).toLocaleString('fr-FR')} m`;
  }
}
main().catch(e => { console.error(e); loaderText.textContent = 'Impossible de charger la carte. Ouvrez-la depuis un serveur web (voir le README).'; });
