// Circuit : données géométriques (pour la physique) et décor 3D.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TRACK_POINTS, TRACK_WIDTH } from "./trackdata.js";
import * as TX from "./textures.js";

export const HALF = TRACK_WIDTH / 2;
export const KERB = 1.4;
export const WALL = 17.5;
const START_X = 40; // position X de la ligne de départ sur la ligne droite

export class Track {
  constructor() {
    const curve = new THREE.CatmullRomCurve3(
      TRACK_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      "centripetal",
    );
    const n = Math.round(curve.getLength());
    const pts = curve.getSpacedPoints(n);
    pts.pop();
    // Décale pour que l'index 0 soit la ligne de départ.
    let start = 0;
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - START_X) + Math.abs(pts[i].z) * 4;
      if (d < best) {
        best = d;
        start = i;
      }
    }
    const ordered = pts.slice(start).concat(pts.slice(0, start));
    this.n = ordered.length;
    this.length = this.n;
    this.x = new Float32Array(this.n);
    this.z = new Float32Array(this.n);
    this.tx = new Float32Array(this.n);
    this.tz = new Float32Array(this.n);
    this.curv = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      this.x[i] = ordered[i].x;
      this.z[i] = ordered[i].z;
    }
    for (let i = 0; i < this.n; i++) {
      const a = (i - 1 + this.n) % this.n;
      const b = (i + 1) % this.n;
      let dx = this.x[b] - this.x[a];
      let dz = this.z[b] - this.z[a];
      const l = Math.hypot(dx, dz) || 1;
      this.tx[i] = dx / l;
      this.tz[i] = dz / l;
    }
    // Courbure signée (positive = virage à droite), lissée.
    const raw = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const a = (i - 4 + this.n) % this.n;
      const b = (i + 4) % this.n;
      const ha = Math.atan2(this.tx[a], this.tz[a]);
      const hb = Math.atan2(this.tx[b], this.tz[b]);
      let dh = hb - ha;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      raw[i] = -dh / 8;
    }
    for (let i = 0; i < this.n; i++) {
      let s = 0;
      for (let k = -6; k <= 6; k++) s += raw[(i + k + this.n) % this.n];
      this.curv[i] = s / 13;
    }
    // Vibreurs et bacs à graviers.
    this.kerbL = new Uint8Array(this.n);
    this.kerbR = new Uint8Array(this.n);
    this.gravelL = new Uint8Array(this.n);
    this.gravelR = new Uint8Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const c = this.curv[i];
      if (Math.abs(c) > 1 / 260) {
        for (let k = -10; k <= 10; k++) {
          const j = (i + k + this.n) % this.n;
          this.kerbL[j] = 1;
          this.kerbR[j] = 1;
        }
      }
      if (Math.abs(c) > 1 / 110) {
        // Graviers à l'extérieur du virage (à gauche si virage à droite).
        for (let k = -15; k <= 40; k++) {
          const j = (i + k + this.n) % this.n;
          if (c > 0) this.gravelL[j] = 1;
          else this.gravelR[j] = 1;
        }
      }
    }
    // Pas de graviers ni vibreurs sur la ligne droite des stands.
    for (let i = this.n - 60; i < this.n + 120; i++) {
      const j = i % this.n;
      this.gravelL[j] = this.gravelR[j] = 0;
    }
    this.sectors = [Math.floor(this.n / 3), Math.floor((2 * this.n) / 3)];
  }

  heading(i) {
    return Math.atan2(this.tx[i], this.tz[i]);
  }

  // Point le plus proche sur la ligne médiane. `hint` accélère la recherche.
  nearest(x, z, hint = -1) {
    let bi = 0;
    let bd = Infinity;
    if (hint >= 0) {
      for (let k = -50; k <= 50; k++) {
        const i = (hint + k + this.n) % this.n;
        const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
    }
    if (hint < 0 || bd > 30 * 30) {
      bd = Infinity;
      for (let i = 0; i < this.n; i += 3) {
        const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      for (let k = -3; k <= 3; k++) {
        const i = (bi + k + this.n) % this.n;
        const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
    }
    const dx = x - this.x[bi];
    const dz = z - this.z[bi];
    // Droite = (-tz, tx)
    const lateral = dx * -this.tz[bi] + dz * this.tx[bi];
    const along = dx * this.tx[bi] + dz * this.tz[bi];
    return { i: bi, lateral, along };
  }

  surface(i, lateral) {
    const a = Math.abs(lateral);
    if (a <= HALF) return "asphalt";
    const right = lateral > 0;
    if (a <= HALF + KERB && (right ? this.kerbR[i] : this.kerbL[i]))
      return "kerb";
    if (a > HALF + KERB && (right ? this.gravelR[i] : this.gravelL[i]))
      return "gravel";
    if (a <= HALF + 3.2) return "runoff";
    return "grass";
  }

  // Emplacement sur la grille de départ (k = 0 pour la pole).
  gridSlot(k) {
    const back = 10 + k * 9;
    const i = (this.n - back) % this.n;
    const side = k % 2 === 0 ? -3 : 3;
    return {
      x: this.x[i] + -this.tz[i] * side,
      z: this.z[i] + this.tx[i] * side,
      heading: this.heading(i),
      index: i,
    };
  }

  offsetPoint(i, lateral) {
    i = ((i % this.n) + this.n) % this.n;
    return new THREE.Vector3(
      this.x[i] - this.tz[i] * lateral,
      0,
      this.z[i] + this.tx[i] * lateral,
    );
  }

  // --- Décor -----------------------------------------------------------------

  build(scene) {
    this.scene = scene;
    this.buildGround();
    this.buildRoad();
    this.buildKerbsAndGravel();
    this.buildWalls();
    this.buildStartLine();
    this.lights = this.buildGantry();
    this.buildPits();
    this.buildGrandstands();
    this.buildBridge();
    this.buildBrakeBoards();
    this.buildTrees();
    this.buildHills();
    this.buildClouds();
  }

  ribbon(fromLat, toLat, mask, opts) {
    const { y0 = 0.02, y1 = y0, vScale = 14, step = 1 } = opts;
    const pos = [];
    const uv = [];
    const idx = [];
    let run = -1;
    for (let k = 0; k <= this.n; k += step) {
      const i = k % this.n;
      const on = !mask || mask[i];
      if (!on) {
        run = -1;
        continue;
      }
      const a = this.offsetPoint(i, fromLat);
      const b = this.offsetPoint(i, toLat);
      const base = pos.length / 3;
      pos.push(a.x, y0, a.z, b.x, y1, b.z);
      uv.push(0, k / vScale, 1, k / vScale);
      if (run >= 0) {
        // Triangles orientés vers le haut quel que soit le côté.
        if (fromLat < toLat)
          idx.push(run, run + 1, base, run + 1, base + 1, base);
        else idx.push(run, base, run + 1, run + 1, base, base + 1);
      }
      run = base;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  buildGround() {
    const tex = TX.grassTexture();
    tex.repeat.set(220, 220);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000, 80, 80),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 1,
        color: "#9fbf8a",
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildRoad() {
    const g = this.ribbon(-HALF, HALF, null, { y0: 0.06, vScale: TRACK_WIDTH });
    const mat = new THREE.MeshStandardMaterial({
      map: TX.asphaltTexture(),
      roughness: 0.92,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const road = new THREE.Mesh(g, mat);
    road.receiveShadow = true;
    this.scene.add(road);
    // Bas-côtés en asphalte (zone de dégagement) sur l'herbe, plus clairs.
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: "#56585a",
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    for (const s of [-1, 1]) {
      const sg = this.ribbon(s * HALF, s * (HALF + 3.2), null, {
        y0: 0.04,
        vScale: 10,
        step: 2,
      });
      const m = new THREE.Mesh(sg, shoulderMat);
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  buildKerbsAndGravel() {
    const kerbMat = new THREE.MeshStandardMaterial({
      map: TX.kerbTexture(),
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    for (const [s, mask] of [
      [-1, this.kerbL],
      [1, this.kerbR],
    ]) {
      const g = this.ribbon(s * HALF, s * (HALF + KERB), mask, {
        y0: 0.08,
        y1: 0.15,
        vScale: 6,
      });
      const m = new THREE.Mesh(g, kerbMat);
      m.receiveShadow = true;
      this.scene.add(m);
    }
    const gravelTex = TX.gravelTexture();
    const gravelMat = new THREE.MeshStandardMaterial({
      map: gravelTex,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (const [s, mask] of [
      [-1, this.gravelL],
      [1, this.gravelR],
    ]) {
      const g = this.ribbon(s * (HALF + KERB), s * (WALL - 0.3), mask, {
        y0: 0.05,
        vScale: 4,
      });
      const m = new THREE.Mesh(g, gravelMat);
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  buildWalls() {
    const geos = [];
    const topGeos = [];
    const step = 2;
    for (const s of [-1, 1]) {
      const pos = [];
      const uv = [];
      const idx = [];
      const top = [];
      const tidx = [];
      for (let k = 0; k <= this.n; k += step) {
        const i = k % this.n;
        const a = this.offsetPoint(i, s * WALL);
        const b = this.offsetPoint(i, s * (WALL + 0.5));
        const base = pos.length / 3;
        pos.push(a.x, 0, a.z, a.x, 1.1, a.z);
        uv.push(k / 4, 0, k / 4, 0.4);
        const tb = top.length / 3;
        top.push(a.x, 1.1, a.z, b.x, 1.1, b.z);
        if (k > 0) {
          if (s > 0)
            idx.push(base - 2, base - 1, base, base - 1, base + 1, base);
          else idx.push(base - 2, base, base - 1, base - 1, base, base + 1);
          tidx.push(tb - 2, tb - 1, tb, tb - 1, tb + 1, tb);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      geos.push(g);
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.Float32BufferAttribute(top, 3));
      tg.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          new Array((top.length / 3) * 2).fill(0),
          2,
        ),
      );
      tg.setIndex(tidx);
      tg.computeVertexNormals();
      topGeos.push(tg);
    }
    const wallMat = new THREE.MeshStandardMaterial({
      map: TX.concreteTexture(),
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const wall = new THREE.Mesh(mergeGeometries(geos), wallMat);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    const top = new THREE.Mesh(
      mergeGeometries(topGeos),
      new THREE.MeshStandardMaterial({
        color: "#c62828",
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    this.scene.add(top);

    // Grillage de protection au-dessus du mur.
    const fenceGeos = [];
    for (const s of [-1, 1]) {
      const pos = [];
      const uv = [];
      const idx = [];
      for (let k = 0; k <= this.n; k += 4) {
        const i = k % this.n;
        const a = this.offsetPoint(i, s * (WALL + 0.25));
        const base = pos.length / 3;
        pos.push(a.x, 1.1, a.z, a.x, 4.2, a.z);
        uv.push(k / 1.5, 0, k / 1.5, 3.1 / 1.5);
        if (k > 0) idx.push(base - 2, base - 1, base, base - 1, base + 1, base);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      fenceGeos.push(g);
    }
    const fenceTex = TX.fenceTexture();
    fenceTex.repeat.set(1, 1);
    const fence = new THREE.Mesh(
      mergeGeometries(fenceGeos),
      new THREE.MeshStandardMaterial({
        map: fenceTex,
        alphaTest: 0.5,
        transparent: false,
        side: THREE.DoubleSide,
        metalness: 0.6,
        roughness: 0.5,
      }),
    );
    this.scene.add(fence);

    // Poteaux du grillage
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6);
    postGeo.translate(0, 2.1, 0);
    const posts = [];
    for (const s of [-1, 1])
      for (let k = 0; k < this.n; k += 8)
        posts.push(this.offsetPoint(k, s * (WALL + 0.3)));
    const postMesh = new THREE.InstancedMesh(
      postGeo,
      new THREE.MeshStandardMaterial({
        color: "#777",
        metalness: 0.7,
        roughness: 0.4,
      }),
      posts.length,
    );
    const m4 = new THREE.Matrix4();
    posts.forEach((p, i) =>
      postMesh.setMatrixAt(i, m4.makeTranslation(p.x, 0, p.z)),
    );
    this.scene.add(postMesh);

    // Panneaux publicitaires sur les murs (dans les lignes droites).
    const adGeos = new Map();
    let brand = 0;
    for (const s of [-1, 1]) {
      for (let k = 0; k < this.n - 14; k += 16) {
        let straight = true;
        for (let j = k; j < k + 14; j++)
          if (Math.abs(this.curv[j]) > 1 / 300) straight = false;
        if (!straight) continue;
        const a = this.offsetPoint(k, s * (WALL - 0.02));
        const b = this.offsetPoint(k + 14, s * (WALL - 0.02));
        const g = new THREE.PlaneGeometry(14, 0.9);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const ang = Math.atan2(b.x - a.x, b.z - a.z);
        g.rotateY(ang + (s > 0 ? Math.PI / 2 : -Math.PI / 2));
        g.translate(mid.x, 0.55, mid.z);
        const id = brand++ % 8;
        if (!adGeos.has(id)) adGeos.set(id, []);
        adGeos.get(id).push(g);
      }
    }
    for (const [id, list] of adGeos) {
      const m = new THREE.Mesh(
        mergeGeometries(list),
        new THREE.MeshStandardMaterial({
          map: TX.adTexture(id),
          roughness: 0.6,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
      this.scene.add(m);
    }

    // Murs de pneus devant les bacs à graviers.
    const tirePos = [];
    for (const [s, mask] of [
      [-1, this.gravelL],
      [1, this.gravelR],
    ]) {
      for (let k = 0; k < this.n; k += 1) {
        if (!mask[k]) continue;
        tirePos.push(this.offsetPoint(k, s * (WALL - 0.45)));
      }
    }
    const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.0, 10);
    tireGeo.translate(0, 0.5, 0);
    const tires = new THREE.InstancedMesh(
      tireGeo,
      new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.9 }),
      tirePos.length,
    );
    tirePos.forEach((p, i) =>
      tires.setMatrixAt(i, m4.makeTranslation(p.x, 0, p.z)),
    );
    const tc = new THREE.Color();
    tirePos.forEach((p, i) =>
      tires.setColorAt(
        i,
        tc.set(i % 6 < 3 ? "#1a1a1a" : i % 12 < 6 ? "#b71c1c" : "#eeeeee"),
      ),
    );
    tires.castShadow = true;
    this.scene.add(tires);

    // Postes de commissaires
    const postBox = new THREE.BoxGeometry(2, 2.6, 2);
    postBox.translate(0, 1.3, 0);
    const marshalPos = [];
    for (let k = 100; k < this.n; k += 220)
      marshalPos.push(this.offsetPoint(k, -(WALL + 2.5)));
    const marshal = new THREE.InstancedMesh(
      postBox,
      new THREE.MeshStandardMaterial({ color: "#ff8f00", roughness: 0.6 }),
      marshalPos.length,
    );
    marshalPos.forEach((p, i) =>
      marshal.setMatrixAt(i, m4.makeTranslation(p.x, 0, p.z)),
    );
    marshal.castShadow = true;
    this.scene.add(marshal);
  }

  buildStartLine() {
    const tex = TX.checkerTexture(8);
    tex.repeat.set(8, 1);
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_WIDTH, 1.6),
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.8,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      }),
    );
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = this.heading(0);
    line.position.set(this.x[0], 0.08, this.z[0]);
    line.receiveShadow = true;
    this.scene.add(line);
    // Cases de la grille
    const boxMat = new THREE.MeshBasicMaterial({
      color: "#f0f0f0",
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    for (let k = 0; k < 8; k++) {
      const s = this.gridSlot(k);
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.35), boxMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(0, 0.08, 2.6);
      g.add(bar);
      for (const sx of [-1.6, 1.6]) {
        const side = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.4), boxMat);
        side.rotation.x = -Math.PI / 2;
        side.position.set(sx, 0.08, 2.0);
        g.add(side);
      }
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.heading;
      this.scene.add(g);
    }
  }

  buildGantry() {
    const i = 6;
    const h = this.heading(i);
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({
      color: "#2b2f36",
      metalness: 0.7,
      roughness: 0.4,
    });
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), steel);
      pillar.position.set(s * (HALF + 2.2), 4, 0);
      pillar.castShadow = true;
      g.add(pillar);
    }
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH + 5, 1.2, 0.8),
      steel,
    );
    beam.position.set(0, 7.6, 0);
    beam.castShadow = true;
    g.add(beam);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_WIDTH + 4, 1.0),
      new THREE.MeshStandardMaterial({ map: TX.adTexture(4) }),
    );
    banner.position.set(0, 7.6, -0.42);
    banner.rotation.y = Math.PI;
    g.add(banner);
    const lamps = [];
    const housingMat = new THREE.MeshStandardMaterial({
      color: "#0d0d0d",
      roughness: 0.5,
    });
    for (let k = 0; k < 5; k++) {
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 2.1, 0.5),
        housingMat,
      );
      const x = (k - 2) * 1.3;
      housing.position.set(x, 6.3, -0.2);
      g.add(housing);
      const col = [];
      for (let r = 0; r < 2; r++) {
        const lamp = new THREE.Mesh(
          new THREE.CircleGeometry(0.28, 16),
          new THREE.MeshStandardMaterial({
            color: "#300",
            emissive: "#ff0000",
            emissiveIntensity: 0,
          }),
        );
        lamp.position.set(x, 6.75 - r * 0.85, -0.46);
        lamp.rotation.y = Math.PI;
        g.add(lamp);
        col.push(lamp);
      }
      lamps.push(col);
    }
    g.position.set(this.x[i], 0, this.z[i]);
    g.rotation.y = h;
    this.scene.add(g);
    return {
      set(n, green = false) {
        lamps.forEach((col, k) =>
          col.forEach((l) => {
            const on = green || k < n;
            l.material.emissive.set(green ? "#00ff44" : "#ff0000");
            l.material.emissiveIntensity = on ? 4 : 0;
            l.material.color.set(on ? (green ? "#0f4" : "#f00") : "#300");
          }),
        );
      },
    };
  }

  // Bâtiment des stands + tour de contrôle (côté intérieur, à droite).
  buildPits() {
    const from = this.n - 140;
    const len = 300;
    const a = this.offsetPoint(from, WALL + 13);
    const b = this.offsetPoint(from + len, WALL + 13);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    const g = new THREE.Group();
    g.position.copy(mid);
    g.rotation.y = ang + Math.PI; // X local = vers l'extérieur de la piste
    const L = a.distanceTo(b);
    // Voie des stands
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(12, L),
      new THREE.MeshStandardMaterial({
        map: TX.asphaltTexture(),
        roughness: 0.9,
      }),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(-6.5, 0.05, 0);
    lane.receiveShadow = true;
    g.add(lane);
    const white = new THREE.MeshStandardMaterial({
      color: "#eceff1",
      roughness: 0.6,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 9, L), white);
    body.position.set(7, 4.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // Garages colorés
    const teamColors = [
      "#c8102e",
      "#00a3e0",
      "#ff8000",
      "#00d2be",
      "#1e41ff",
      "#006f62",
      "#f5c814",
      "#b6babd",
      "#6d28d9",
      "#2b2b2b",
    ];
    const doors = Math.floor(L / 13);
    for (let k = 0; k < doors; k++) {
      const z = -L / 2 + 6.5 + k * 13;
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 4.4),
        new THREE.MeshStandardMaterial({
          color: "#1a1c20",
          roughness: 0.4,
          metalness: 0.3,
        }),
      );
      door.position.set(-0.02, 2.2, z);
      door.rotation.y = -Math.PI / 2;
      g.add(door);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 1.2),
        new THREE.MeshStandardMaterial({
          color: teamColors[k % teamColors.length],
          roughness: 0.5,
        }),
      );
      sign.position.set(-0.03, 5.1, z);
      sign.rotation.y = -Math.PI / 2;
      g.add(sign);
    }
    // Étage vitré (loges)
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(12, 3, L - 4),
      new THREE.MeshStandardMaterial({
        color: "#7fb3d5",
        metalness: 0.9,
        roughness: 0.08,
        envMapIntensity: 1.5,
      }),
    );
    glass.position.set(6, 10.5, 0);
    g.add(glass);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, L + 2), white);
    roof.position.set(5, 12.3, 0);
    roof.castShadow = true;
    g.add(roof);
    // Tour de contrôle
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 5, 26, 16),
      white,
    );
    tower.position.set(10, 13, L / 2 - 40);
    tower.castShadow = true;
    g.add(tower);
    const cab = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 6, 5, 16),
      new THREE.MeshStandardMaterial({
        color: "#4a6f8a",
        metalness: 0.9,
        roughness: 0.1,
      }),
    );
    cab.position.set(10, 28, L / 2 - 40);
    cab.castShadow = true;
    g.add(cab);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(7.6, 7.6, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: "#c8102e" }),
    );
    cap.position.set(10, 31, L / 2 - 40);
    g.add(cap);
    this.scene.add(g);
  }

  grandstand(i0, len, side, rows = 14) {
    const a = this.offsetPoint(i0, side * (WALL + 6));
    const b = this.offsetPoint(i0 + len, side * (WALL + 6));
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const L = a.distanceTo(b);
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    const g = new THREE.Group();
    g.position.copy(mid);
    g.rotation.y = ang;
    const out = -side; // direction en X local qui s'éloigne de la piste
    const concrete = new THREE.MeshStandardMaterial({
      color: "#9ea4a8",
      roughness: 0.9,
    });
    const seatsGeo = [];
    for (let r = 0; r < rows; r++) {
      const step = new THREE.BoxGeometry(1.2, 0.6 * (r + 1), L);
      step.translate(out * (r * 1.2 + 0.6), 0.3 * (r + 1), 0);
      seatsGeo.push(step);
    }
    const stand = new THREE.Mesh(mergeGeometries(seatsGeo), concrete);
    stand.castShadow = true;
    stand.receiveShadow = true;
    g.add(stand);
    // Spectateurs
    const per = Math.floor(L / 0.7);
    const count = rows * per;
    const fan = new THREE.BoxGeometry(0.45, 0.8, 0.4);
    fan.translate(0, 0.4, 0);
    const fans = new THREE.InstancedMesh(
      fan,
      new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      count,
    );
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const palette = [
      "#c8102e",
      "#f5c814",
      "#1d4fd8",
      "#ffffff",
      "#ff7a00",
      "#1e9e3a",
      "#111111",
      "#e91e63",
      "#00bcd4",
    ];
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < per; k++) {
        if (Math.random() < 0.18) continue;
        m4.makeTranslation(
          out * (r * 1.2 + 0.6) + (Math.random() - 0.5) * 0.2,
          0.6 * (r + 1),
          -L / 2 + 0.35 + k * 0.7,
        );
        fans.setMatrixAt(n, m4);
        fans.setColorAt(
          n,
          col.set(palette[Math.floor(Math.random() * palette.length)]),
        );
        n++;
      }
    }
    fans.count = n;
    g.add(fans);
    // Toit
    const roofH = 0.6 * rows + 5;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(rows * 1.2 + 3, 0.4, L + 2),
      new THREE.MeshStandardMaterial({
        color: "#e0e0e0",
        metalness: 0.4,
        roughness: 0.5,
      }),
    );
    roof.position.set(out * (rows * 0.6), roofH, 0);
    roof.rotation.z = out * 0.08;
    roof.castShadow = true;
    g.add(roof);
    const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, roofH, 8);
    for (let z = -L / 2 + 2; z <= L / 2; z += 18) {
      const p = new THREE.Mesh(pillarGeo, concrete);
      p.position.set(out * (rows * 1.2 + 0.8), roofH / 2, z);
      p.castShadow = true;
      g.add(p);
    }
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(L, 1.6),
      new THREE.MeshStandardMaterial({
        map: TX.adTexture(Math.floor(Math.random() * 8)),
        side: THREE.DoubleSide,
      }),
    );
    back.rotation.y = Math.PI / 2;
    back.position.set(out * (rows * 1.2 + 1), roofH - 1, 0);
    g.add(back);
    this.scene.add(g);
  }

  buildGrandstands() {
    // Tribune principale face aux stands (extérieur, à gauche).
    this.grandstand(this.n - 150, 140, -1, 16);
    this.grandstand(10, 120, -1, 16);
    // Tribunes aux points clés : virage 1, épingle, chicane.
    const turns = this.findCorners(4);
    turns.forEach((i) => {
      const side = this.curv[i] > 0 ? -1 : 1;
      this.grandstand(i - 30, 70, side, 10);
    });
  }

  // Index des virages les plus serrés (séparés d'au moins 150 m).
  findCorners(count) {
    const order = [...this.curv.keys()].sort(
      (a, b) => Math.abs(this.curv[b]) - Math.abs(this.curv[a]),
    );
    const picked = [];
    for (const i of order) {
      if (picked.length >= count) break;
      if (i < 200 || i > this.n - 200) continue;
      if (
        picked.every(
          (p) => Math.min(Math.abs(p - i), this.n - Math.abs(p - i)) > 150,
        )
      )
        picked.push(i);
    }
    return picked;
  }

  buildBridge() {
    // Passerelle publicitaire au-dessus de la piste, au milieu du tour.
    let i = Math.floor(this.n * 0.55);
    for (let k = 0; k < 200; k++) {
      if (Math.abs(this.curv[(i + k) % this.n]) < 1 / 500) {
        i = (i + k) % this.n;
        break;
      }
    }
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({
      color: "#455a64",
      metalness: 0.6,
      roughness: 0.5,
    });
    for (const s of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9, 3), steel);
      tower.position.set(s * (HALF + 5), 4.5, 0);
      tower.castShadow = true;
      g.add(tower);
    }
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH + 13, 2.2, 3),
      steel,
    );
    deck.position.set(0, 8, 0);
    deck.castShadow = true;
    g.add(deck);
    for (const z of [-1.55, 1.55]) {
      const ad = new THREE.Mesh(
        new THREE.PlaneGeometry(TRACK_WIDTH + 12, 1.8),
        new THREE.MeshStandardMaterial({ map: TX.adTexture(z > 0 ? 1 : 5) }),
      );
      ad.position.set(0, 8, z);
      if (z < 0) ad.rotation.y = Math.PI;
      g.add(ad);
    }
    g.position.set(this.x[i], 0, this.z[i]);
    g.rotation.y = this.heading(i);
    this.scene.add(g);
  }

  buildBrakeBoards() {
    const corners = this.findCorners(6);
    const boardMat = (txt) => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 96;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 64, 96);
      ctx.fillStyle = "#111";
      ctx.font = "bold 34px Arial";
      ctx.textAlign = "center";
      ctx.fillText(txt, 32, 60);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t });
    };
    const mats = {
      100: boardMat("100"),
      200: boardMat("200"),
      300: boardMat("300"),
    };
    for (const ci of corners) {
      // Début du virage : remonte jusqu'à une courbure faible.
      let entry = ci;
      for (let k = 0; k < 120; k++) {
        entry = (ci - k + this.n) % this.n;
        if (Math.abs(this.curv[entry]) < 1 / 400) break;
      }
      const side = this.curv[ci] > 0 ? -1 : 1;
      for (const d of [100, 200, 300]) {
        const i = (entry - Math.round(d * 0.6) + this.n) % this.n;
        if (Math.abs(this.curv[i]) > 1 / 200) continue;
        const p = this.offsetPoint(i, side * (HALF + 4));
        const board = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.5), mats[d]);
        board.position.set(p.x, 1.2, p.z);
        board.rotation.y = this.heading(i) + Math.PI;
        this.scene.add(board);
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.5),
          new THREE.MeshStandardMaterial({ color: "#888" }),
        );
        pole.position.set(p.x, 0.25, p.z);
        this.scene.add(pole);
      }
    }
  }

  distanceToTrack(x, z) {
    let bd = Infinity;
    for (let i = 0; i < this.n; i += 6) {
      const d = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
      if (d < bd) bd = d;
    }
    return Math.sqrt(bd);
  }

  buildTrees() {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < this.n; i++) {
      minX = Math.min(minX, this.x[i]);
      maxX = Math.max(maxX, this.x[i]);
      minZ = Math.min(minZ, this.z[i]);
      maxZ = Math.max(maxZ, this.z[i]);
    }
    const pad = 260;
    const conifers = [];
    const leafy = [];
    for (let t = 0; t < 4200 && conifers.length + leafy.length < 1800; t++) {
      const x = minX - pad + Math.random() * (maxX - minX + pad * 2);
      const z = minZ - pad + Math.random() * (maxZ - minZ + pad * 2);
      const d = this.distanceToTrack(x, z);
      if (d < 55) continue;
      // Garde la zone des stands et des tribunes principales dégagée.
      if (z > -80 && z < 70 && x > -260 && x < 280) continue;
      const s = 0.8 + Math.random() * 0.7;
      (Math.random() < 0.55 ? conifers : leafy).push([
        x,
        z,
        s,
        Math.random() * Math.PI * 2,
      ]);
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const place = (mesh, list, col) => {
      const c = new THREE.Color();
      list.forEach(([x, z, s, r], i) => {
        q.setFromAxisAngle(up, r);
        m4.compose(v.set(x, 0, z), q, sc.set(s, s, s));
        mesh.setMatrixAt(i, m4);
        if (col)
          mesh.setColorAt(
            i,
            c
              .set(col)
              .offsetHSL(
                (Math.random() - 0.5) * 0.04,
                0,
                (Math.random() - 0.5) * 0.08,
              ),
          );
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
    trunkGeo.translate(0, 1.5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: "#5b3f2a",
      roughness: 1,
    });
    const all = conifers.concat(leafy);
    place(new THREE.InstancedMesh(trunkGeo, trunkMat, all.length), all);
    const coneGeo = mergeGeometries([
      new THREE.ConeGeometry(3.2, 6, 8).translate(0, 5, 0),
      new THREE.ConeGeometry(2.5, 5, 8).translate(0, 8, 0),
      new THREE.ConeGeometry(1.7, 4, 8).translate(0, 10.5, 0),
    ]);
    place(
      new THREE.InstancedMesh(
        coneGeo,
        new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
        conifers.length,
      ),
      conifers,
      "#2d5a27",
    );
    const ballGeo = mergeGeometries([
      new THREE.IcosahedronGeometry(3.2, 1).translate(0, 5.5, 0),
      new THREE.IcosahedronGeometry(2.4, 1).translate(1.6, 6.8, 0.6),
      new THREE.IcosahedronGeometry(2.2, 1).translate(-1.4, 6.5, -0.8),
    ]);
    place(
      new THREE.InstancedMesh(
        ballGeo,
        new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
        leafy.length,
      ),
      leafy,
      "#4f7d2e",
    );
  }

  buildHills() {
    const geo = new THREE.CylinderGeometry(1500, 1700, 1, 96, 1, true);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const a = Math.atan2(v.z, v.x);
      const top = v.y > 0;
      const h =
        60 +
        70 * Math.sin(a * 3 + 1) ** 2 +
        45 * Math.sin(a * 7.3) +
        25 * Math.sin(a * 17.1 + 2);
      pos.setY(i, top ? Math.max(20, h) : -2);
    }
    geo.computeVertexNormals();
    const hills = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: "#56704a",
        roughness: 1,
        flatShading: true,
        side: THREE.DoubleSide,
      }),
    );
    hills.position.set(60, 0, 180);
    this.scene.add(hills);
  }

  buildClouds() {
    const tex = TX.smokeTexture();
    for (let i = 0; i < 40; i++) {
      const group = new THREE.Group();
      const n = 4 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: tex,
            color: "#ffffff",
            opacity: 0.75,
            transparent: true,
            depthWrite: false,
            fog: false,
          }),
        );
        const size = 80 + Math.random() * 90;
        s.scale.set(size, size * 0.6, 1);
        s.position.set(
          (Math.random() - 0.5) * 220,
          Math.random() * 25,
          (Math.random() - 0.5) * 80,
        );
        group.add(s);
      }
      const a = Math.random() * Math.PI * 2;
      const r = 700 + Math.random() * 900;
      group.position.set(
        Math.cos(a) * r,
        250 + Math.random() * 200,
        Math.sin(a) * r,
      );
      this.scene.add(group);
    }
  }
}
