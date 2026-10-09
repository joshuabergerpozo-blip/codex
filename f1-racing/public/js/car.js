// Modèle 3D de la voiture : son apparence dépend des améliorations achetées.
// Repère local : +Z = avant, +Y = haut, +X = gauche.
import * as THREE from "three";
import { PAINTS, upgradeLevel } from "../shared/catalog.js";
import { buildAvatar } from "./avatar.js";
import * as TX from "./textures.js";

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...opts });
}

function paintMaterial(paintId, chassis) {
  const p = PAINTS.find((x) => x.id === paintId) || PAINTS[0];
  if (p.id === "bois") {
    if (chassis === 0)
      return std("#ffffff", {
        map: TX.woodTexture("#8a5a2e"),
        roughness: 0.95,
      });
    if (chassis === 1)
      return std("#ffffff", {
        map: TX.woodTexture("#b37a3c"),
        roughness: 0.35,
      });
    if (chassis === 2)
      return std("#8d939a", {
        map: TX.metalTexture(),
        metalness: 0.65,
        roughness: 0.45,
      });
    if (chassis === 3)
      return std("#d9dde2", {
        map: TX.metalTexture(),
        metalness: 0.85,
        roughness: 0.3,
      });
    if (chassis === 4)
      return new THREE.MeshPhysicalMaterial({
        color: "#ebe6d6",
        roughness: 0.35,
        clearcoat: 0.6,
      });
    return new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      map: TX.carbonTexture(),
      roughness: 0.3,
      metalness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
  }
  if (chassis <= 1)
    return std(p.color, { map: TX.woodTexture("#d8d8d8"), roughness: 0.6 });
  if (chassis === 2)
    return std(p.color, {
      map: TX.metalTexture(),
      metalness: Math.max(0.4, p.metal),
      roughness: 0.45,
    });
  return new THREE.MeshPhysicalMaterial({
    color: p.color,
    map: p.carbon ? TX.carbonTexture() : null,
    metalness: p.metal,
    roughness: p.rough,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
}

function accentColor(id) {
  const p = PAINTS.find((x) => x.id === id);
  return !p || p.id === "bois" ? "#1b1b1d" : p.color;
}

// Extrusion d'un profil latéral (z, y) sur une largeur donnée, centrée en X.
function extrudeProfile(points, width, bevel = 0.04) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++)
    shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, width - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate((width - bevel * 2) / 2, 0, 0);
  return geo;
}

function taper(geo, fn) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = fn(pos.getZ(i), pos.getY(i));
    pos.setX(i, pos.getX(i) * f);
  }
  geo.computeVertexNormals();
  return geo;
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function cyl(rt, rb, h, material, seg = 16) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    material,
  );
  m.castShadow = true;
  return m;
}

// Cylindre reliant deux points (bras de suspension, supports...).
function rod(a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = cyl(r, r, dir.length(), material, 6);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

const RIM_STYLES = [
  { color: "#7a4f28", metal: 0, rough: 0.9, spokes: 6, wood: true },
  { color: "#4a4d52", metal: 0.6, rough: 0.5, spokes: 0 },
  { color: "#c3c7cc", metal: 0.9, rough: 0.25, spokes: 5 },
  { color: "#33363b", metal: 0.9, rough: 0.3, spokes: 10 },
  { color: "#c9a54a", metal: 0.9, rough: 0.25, spokes: 7 },
  { color: "#1d1d20", metal: 0.4, rough: 0.3, spokes: 6, carbon: true },
];

function buildWheel(tireLvl, rimLvl, rear, side) {
  const g = new THREE.Group();
  const rs = RIM_STYLES[rimLvl];
  const rimMat = std(rs.color, {
    metalness: rs.metal,
    roughness: rs.rough,
    map: rs.wood
      ? TX.woodTexture("#9a6a3a")
      : rs.carbon
        ? TX.carbonTexture()
        : null,
  });
  const rubber = std("#161616", { roughness: 0.92 });
  let radius;
  let width;
  if (tireLvl === 0) {
    // Roue de charrette en bois.
    radius = 0.36;
    width = 0.1;
    const wood = std("#ffffff", {
      map: TX.woodTexture("#7a4f28"),
      roughness: 0.95,
    });
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius - 0.04, 0.045, 8, 20),
      wood,
    );
    ring.rotation.y = Math.PI / 2;
    ring.castShadow = true;
    g.add(ring);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius - 0.005, 0.012, 4, 20),
      std("#555", { metalness: 0.6 }),
    );
    band.rotation.y = Math.PI / 2;
    g.add(band);
  } else if (tireLvl === 1) {
    // Pneus de vélo : ridiculement fins.
    radius = 0.36;
    width = 0.06;
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(radius - 0.03, 0.03, 8, 28),
      rubber,
    );
    t.rotation.y = Math.PI / 2;
    t.castShadow = true;
    g.add(t);
  } else {
    radius = tireLvl >= 5 ? 0.36 : 0.33;
    width =
      [0, 0, 0.2, 0.24, 0.28, 0.32, 0.33, 0.34][tireLvl] *
      (rear && tireLvl >= 5 ? 1.25 : 1);
    const tire = cyl(radius, radius, width, rubber, 32);
    tire.rotation.z = Math.PI / 2;
    g.add(tire);
    // Flanc avec marquage de gomme (slicks)
    if (tireLvl >= 5) {
      const colors = ["#f2f2f2", "#f5c814", "#d01818"];
      const stripe = new THREE.Mesh(
        new THREE.RingGeometry(radius * 0.8, radius * 0.84, 32),
        std(colors[tireLvl - 5]),
      );
      stripe.position.x = side * (width / 2 + 0.002);
      stripe.rotation.y = (side * Math.PI) / 2;
      g.add(stripe);
    }
  }
  const inner = tireLvl <= 1 ? radius - 0.06 : radius * 0.66;
  // Jante : disque + rayons + moyeu côté extérieur.
  if (rs.spokes === 0 || tireLvl > 1) {
    const disc = cyl(inner, inner, width * 0.9 + 0.01, rimMat, 24);
    disc.rotation.z = Math.PI / 2;
    disc.scale.set(1, 1, 1);
    g.add(disc);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(inner * 0.92, 24),
      std("#0c0c0c", { roughness: 0.8 }),
    );
    face.position.x = side * (width * 0.46 + 0.008);
    face.rotation.y = (side * Math.PI) / 2;
    if (rs.spokes > 0) g.add(face);
  }
  const spokeN = rs.spokes || 0;
  for (let i = 0; i < spokeN; i++) {
    const a = (i / spokeN) * Math.PI * 2;
    const len = inner * 0.95;
    const s = box(0.03, len, rs.wood ? 0.05 : 0.04, rimMat);
    s.position.set(
      side * (width * 0.46 + 0.012),
      Math.cos(a) * len * 0.5,
      Math.sin(a) * len * 0.5,
    );
    s.rotation.x = -a;
    g.add(s);
  }
  const hub = cyl(
    0.06,
    0.06,
    width + 0.04,
    std(rimLvl >= 4 ? "#d01818" : "#888", { metalness: 0.8, roughness: 0.3 }),
    10,
  );
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  return { group: g, radius, width };
}

function buildFrontWing(level, accent, carbon, wood) {
  const g = new THREE.Group();
  if (level === 0) return g;
  if (level === 1) {
    g.add(box(1.6, 0.04, 0.35, wood, 0, 0.28, 0));
    return g;
  }
  const metal = std("#9aa0a6", { metalness: 0.7, roughness: 0.4 });
  if (level === 2) {
    g.add(box(1.8, 0.03, 0.4, metal, 0, 0.18, 0));
    for (const s of [-1, 1])
      g.add(box(0.03, 0.16, 0.45, metal, s * 0.9, 0.24, 0));
    return g;
  }
  const planes = level - 2; // 1 à 3 éléments
  for (let i = 0; i < planes; i++) {
    const p = box(
      1.85,
      0.025,
      0.42 - i * 0.08,
      i === 0 ? carbon : accent,
      0,
      0.14 + i * 0.07,
      -i * 0.12,
    );
    p.rotation.x = -0.08 - i * 0.12;
    g.add(p);
  }
  for (const s of [-1, 1]) {
    const ep = box(
      0.025,
      0.24 + planes * 0.04,
      0.6,
      accent,
      s * 0.93,
      0.22,
      -0.05,
    );
    g.add(ep);
  }
  return g;
}

function buildRearWing(level, accent, carbon, wood) {
  const g = new THREE.Group();
  let flap = null;
  if (level === 0) return { group: g, flap };
  if (level === 1) {
    for (const s of [-1, 1]) g.add(box(0.05, 0.5, 0.05, wood, s * 0.4, 0.8, 0));
    g.add(box(1.1, 0.04, 0.3, wood, 0, 1.06, 0));
    return { group: g, flap };
  }
  const metal = std("#9aa0a6", { metalness: 0.7, roughness: 0.4 });
  if (level === 2) {
    const p = box(1.3, 0.03, 0.35, metal, 0, 0.92, 0);
    p.rotation.x = 0.25;
    g.add(p);
    for (const s of [-1, 1])
      g.add(box(0.03, 0.25, 0.4, metal, s * 0.65, 0.88, 0));
    return { group: g, flap };
  }
  const width = level >= 5 ? 1.0 : 1.4;
  const main = box(
    width,
    0.03,
    0.34,
    level >= 5 ? carbon : accent,
    0,
    level >= 5 ? 0.98 : 1.05,
    0,
  );
  main.rotation.x = 0.12;
  g.add(main);
  if (level >= 4) {
    const pivot = new THREE.Group();
    pivot.position.set(0, (level >= 5 ? 0.98 : 1.05) + 0.07, -0.16);
    const f = box(width, 0.025, 0.22, accent, 0, 0, 0.1);
    pivot.add(f);
    pivot.rotation.x = 0.45;
    g.add(pivot);
    flap = pivot;
  }
  const epH = level >= 5 ? 0.5 : 0.3;
  for (const s of [-1, 1])
    g.add(
      box(
        0.025,
        epH,
        0.55,
        level >= 5 ? accent : carbon,
        s * (width / 2 + 0.01),
        level >= 5 ? 0.86 : 1.02,
        0.02,
      ),
    );
  if (level === 3) {
    for (const s of [-1, 1])
      g.add(box(0.03, 0.4, 0.06, carbon, s * 0.35, 0.82, 0.05));
  } else {
    g.add(box(0.04, 0.5, 0.12, carbon, 0, 0.72, 0.08));
  }
  return { group: g, flap };
}

export class CarModel {
  constructor({ look, upgrades, avatar }) {
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.wheels = [];
    this.spin = 0;
    this.build(look, upgrades, avatar);
  }

  build(look, upgrades, avatar) {
    const L = (id) => upgradeLevel(upgrades, id);
    const chassis = L("chassis");
    this.chassis = chassis;
    const paint = paintMaterial(look.paint, chassis);
    const accentHex = accentColor(look.accent);
    const accent = new THREE.MeshPhysicalMaterial({
      color: accentHex,
      roughness: 0.35,
      metalness: 0.2,
      clearcoat: 0.8,
    });
    const carbon = std("#ffffff", {
      map: TX.carbonTexture(),
      roughness: 0.35,
      metalness: 0.3,
    });
    const dark = std("#151517", { roughness: 0.6 });
    const wood = std("#ffffff", {
      map: TX.woodTexture("#8a5a2e"),
      roughness: 0.95,
    });
    const metal = std("#9aa0a6", { metalness: 0.7, roughness: 0.4 });
    const B = this.body;

    // --- Roues -------------------------------------------------------------
    const tireLvl = L("tires");
    const rimLvl = L("rims");
    const frontZ = 1.55;
    const rearZ = -1.45;
    const wheelInfo = buildWheel(tireLvl, rimLvl, false, 1);
    const radius = wheelInfo.radius;
    this.wheelRadius = radius;
    for (const [z, rear] of [
      [frontZ, false],
      [rearZ, true],
    ]) {
      for (const side of [1, -1]) {
        const w = buildWheel(tireLvl, rimLvl, rear, side);
        const steer = new THREE.Group();
        const x = side * (0.8 + w.width / 2);
        steer.position.set(x, radius, z);
        const spin = new THREE.Group();
        spin.add(w.group);
        steer.add(spin);
        this.group.add(steer);
        this.wheels.push({ steer, spin, front: !rear, side });
      }
    }

    // --- Carrosserie -------------------------------------------------------
    let sideX = 0.66;
    let sideY = 0.55;
    let topY = 0.78;
    let driverY;
    let driverZ = -0.05;
    let stripeGeo = null;
    if (chassis <= 2) {
      // Caisse à savon : bois ou tôle.
      if (chassis === 0) {
        B.add(box(1.3, 0.45, 3.3, paint, 0, 0.55, 0));
        const nose = box(1.1, 0.12, 0.8, paint, 0, 0.42, 1.9);
        nose.rotation.x = 0.12;
        B.add(nose);
        // Planches de travers
        for (const s of [-1, 1]) {
          const p = box(0.05, 0.22, 3.0, paint, s * 0.68, 0.52, -0.1);
          p.rotation.z = s * 0.06;
          p.rotation.y = s * 0.015;
          B.add(p);
        }
        B.add(box(0.75, 0.4, 0.5, paint, 0, 0.98, -0.62));
        stripeGeo = { type: "box", y: 0.78, len: 3.2, z: 0 };
      } else {
        const prof =
          chassis === 1
            ? [
                [-1.7, 0.32],
                [-1.7, 0.8],
                [0.4, 0.82],
                [2.3, 0.4],
                [2.3, 0.32],
              ]
            : [
                [-1.8, 0.3],
                [-1.8, 0.82],
                [-0.7, 0.88],
                [0.5, 0.82],
                [2.3, 0.38],
                [2.3, 0.3],
              ];
        const geo = extrudeProfile(prof, 1.3, 0.05);
        const m = new THREE.Mesh(geo, paint);
        m.castShadow = true;
        B.add(m);
        B.add(box(0.72, 0.38, 0.45, paint, 0, 1.05, -0.62));
        stripeGeo = { type: "profile", prof, width: 1.3 };
        if (chassis === 2) {
          const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(0.7, 0.3),
            new THREE.MeshPhysicalMaterial({
              color: "#aaccee",
              transparent: true,
              opacity: 0.35,
              roughness: 0.05,
            }),
          );
          screen.position.set(0, 1.0, 0.45);
          screen.rotation.x = -0.5;
          B.add(screen);
        }
      }
      sideX = 0.66;
      sideY = 0.55;
      topY = 0.82;
      driverY = 0.5;
      driverZ = -0.15;
      // Essieux / suspension rudimentaire
      const axleMat = chassis === 0 ? wood : metal;
      for (const z of [frontZ, rearZ]) {
        const axle = cyl(0.04, 0.04, 1.75, axleMat, 8);
        axle.rotation.z = Math.PI / 2;
        axle.position.set(0, radius, z);
        B.add(axle);
      }
    } else {
      const s = (chassis - 3) / 3; // 0 = aluminium, 1 = F1
      const tubW = lerp(0.8, 0.66, s);
      const airbox = 0.9 + 0.2 * s;
      const prof = [
        [-1.95, 0.2],
        [-1.95, 0.52],
        [-1.0, 0.72],
        [-0.45, chassis >= 5 ? airbox : 0.8],
        [-0.2, 0.8],
        [0.05, 0.62],
        [0.65, 0.66],
        [1.4, 0.5],
        [2.3, 0.32 - 0.06 * s],
        [2.3, 0.2],
      ];
      const tub = extrudeProfile(prof, tubW, 0.06);
      taper(tub, (z) =>
        z > 0.7
          ? lerp(1, 0.42, clamp01((z - 0.7) / 1.6))
          : z < -1.1
            ? lerp(1, 0.6, clamp01((-1.1 - z) / 0.85))
            : 1,
      );
      const tubMesh = new THREE.Mesh(tub, paint);
      tubMesh.castShadow = true;
      B.add(tubMesh);
      stripeGeo = { type: "profile", prof, width: tubW, taper: true };
      // Ouverture du cockpit
      const cockpit = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.2, 0.45, 4, 10),
        dark,
      );
      cockpit.rotation.x = Math.PI / 2;
      cockpit.scale.set(1, 1, 0.3);
      cockpit.position.set(0, 0.7, 0.2);
      B.add(cockpit);
      // Pontons
      const podW = lerp(0.42, 0.36, s);
      const podProf = [
        [-1.25, 0.16],
        [-1.25, 0.32],
        [-0.5, 0.5 + 0.06 * (1 - s)],
        [0.45, 0.58 + 0.04 * (1 - s)],
        [0.55, 0.5],
        [0.55, 0.16],
      ];
      const podMat = look.livery === "flancs" ? accent : paint;
      for (const sd of [-1, 1]) {
        const pod = extrudeProfile(podProf, podW, 0.05);
        const pm = new THREE.Mesh(pod, podMat);
        pm.position.x = sd * (tubW / 2 + podW / 2 - 0.06);
        pm.castShadow = true;
        B.add(pm);
        // Entrée d'air
        const inlet = new THREE.Mesh(
          new THREE.PlaneGeometry(podW * 0.7, 0.22),
          dark,
        );
        inlet.position.set(pm.position.x, 0.42, 0.56);
        B.add(inlet);
      }
      sideX = tubW / 2 + podW - 0.06;
      sideY = 0.38;
      topY = 0.8;
      driverY = 0.18;
      driverZ = 0.0;
      // Fond plat
      if (chassis >= 4) B.add(box(1.45, 0.04, 3.3, carbon, 0, 0.12, -0.1));
      // Aileron de requin
      if (chassis >= 6) {
        const fin = extrudeProfile(
          [
            [-1.85, 0.5],
            [-0.6, 0.92],
            [-0.5, 0.92],
            [-1.0, 0.74],
            [-1.85, 0.62],
          ],
          0.02,
          0,
        );
        B.add(new THREE.Mesh(fin, paint));
      }
      if (chassis >= 5) {
        const scoop = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), dark);
        scoop.position.set(0, airbox - 0.08, -0.38);
        B.add(scoop);
      }
      // Rétroviseurs
      if (chassis >= 4) {
        for (const sd of [-1, 1]) {
          B.add(box(0.14, 0.06, 0.04, paint, sd * 0.42, 0.78, 0.45));
          B.add(
            rod(
              new THREE.Vector3(sd * 0.25, 0.66, 0.42),
              new THREE.Vector3(sd * 0.4, 0.77, 0.45),
              0.012,
              carbon,
            ),
          );
        }
      }
      // Bras de suspension
      for (const [z] of [[frontZ], [rearZ]]) {
        for (const sd of [-1, 1]) {
          const hubPt = new THREE.Vector3(sd * 0.8, radius, z);
          B.add(
            rod(
              new THREE.Vector3(sd * 0.3, 0.42, z + 0.25),
              hubPt,
              0.018,
              carbon,
            ),
          );
          B.add(
            rod(
              new THREE.Vector3(sd * 0.3, 0.42, z - 0.25),
              hubPt,
              0.018,
              carbon,
            ),
          );
          B.add(
            rod(
              new THREE.Vector3(sd * 0.3, 0.22, z),
              hubPt.clone().setY(radius - 0.1),
              0.018,
              carbon,
            ),
          );
        }
      }
    }

    // --- Livrée ----------------------------------------------------------------
    if (look.livery === "bande" || look.livery === "double") {
      const offsets =
        look.livery === "bande"
          ? [[0, 0.2]]
          : [
              [-0.13, 0.08],
              [0.13, 0.08],
            ];
      for (const [ox, w] of offsets) {
        let geo;
        if (stripeGeo.type === "box") {
          geo = new THREE.BoxGeometry(w, 0.01, stripeGeo.len);
          geo.translate(0, stripeGeo.y, stripeGeo.z);
        } else {
          const base = stripeGeo.prof[0][1];
          const prof = stripeGeo.prof.map(([z, y]) => [
            z,
            base + (y - base) * 1.012 + 0.004,
          ]);
          geo = extrudeProfile(prof, w, 0);
          if (stripeGeo.taper)
            taper(geo, (z) =>
              z > 0.7 ? lerp(1, 0.5, clamp01((z - 0.7) / 1.6)) : 1,
            );
        }
        geo.translate(ox, 0, 0);
        B.add(new THREE.Mesh(geo, accent));
      }
    } else if (look.livery === "flancs" && chassis <= 2) {
      for (const sd of [-1, 1])
        B.add(box(0.02, 0.2, 2.6, accent, sd * (sideX + 0.02), sideY, 0));
    } else if (["damier", "flammes", "eclair"].includes(look.livery)) {
      const tex = TX.liveryTexture(look.livery, accentHex);
      for (const sd of [-1, 1]) {
        const decal = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 0.4),
          new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            roughness: 0.4,
            polygonOffset: true,
            polygonOffsetFactor: -2,
          }),
        );
        decal.position.set(
          sd * (sideX + 0.015),
          sideY,
          chassis >= 3 ? -0.35 : 0.2,
        );
        decal.rotation.y = (sd * Math.PI) / 2;
        if (sd < 0) decal.scale.x = 1;
        B.add(decal);
      }
    }

    // Numéro de course
    const numTex = TX.numberTexture(look.number || 7);
    for (const sd of [-1, 1]) {
      const n = new THREE.Mesh(
        new THREE.CircleGeometry(0.17, 24),
        new THREE.MeshStandardMaterial({
          map: numTex,
          roughness: 0.4,
          polygonOffset: true,
          polygonOffsetFactor: -3,
        }),
      );
      n.position.set(
        sd * (sideX + 0.02),
        sideY + 0.04,
        chassis >= 3 ? 0.1 : -0.9,
      );
      n.rotation.y = (sd * Math.PI) / 2;
      B.add(n);
    }

    // --- Ailerons -----------------------------------------------------------
    const fw = buildFrontWing(L("frontWing"), accent, carbon, wood);
    fw.position.z = 2.25;
    B.add(fw);
    const rw = buildRearWing(L("rearWing"), accent, carbon, wood);
    rw.group.position.z = -1.9;
    B.add(rw.group);
    this.drsFlap = rw.flap;

    // --- Renforcement -------------------------------------------------------
    const armor = L("armor");
    if (armor >= 1 && chassis <= 2) {
      const plate =
        armor === 1
          ? wood
          : std("#6b7178", {
              map: TX.metalTexture(),
              metalness: 0.7,
              roughness: 0.45,
            });
      for (const sd of [-1, 1]) {
        const p = box(
          0.04,
          0.3,
          armor === 1 ? 1.4 : 2.4,
          plate,
          sd * (sideX + 0.04),
          0.58,
          armor === 1 ? -0.3 : 0,
        );
        if (armor === 1) p.rotation.x = sd * 0.05;
        B.add(p);
      }
    }
    if (armor >= 3) {
      const hoop = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.035, 8, 16, Math.PI),
        std("#c0c4c8", { metalness: 0.9, roughness: 0.3 }),
      );
      hoop.position.set(
        0,
        chassis <= 2 ? 1.0 : 0.82,
        chassis <= 2 ? -0.5 : -0.32,
      );
      B.add(hoop);
    }
    if (armor >= 5) {
      const haloY = chassis <= 2 ? 1.35 : 1.0;
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.03, 8, 24, Math.PI),
        carbon,
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(0, haloY, -0.05);
      B.add(halo);
      B.add(
        rod(
          new THREE.Vector3(0, haloY, 0.29),
          new THREE.Vector3(0, haloY - 0.3, 0.55),
          0.03,
          carbon,
        ),
      );
    }

    // --- Nitro --------------------------------------------------------------
    const nitro = L("nitro");
    if (nitro >= 1) {
      const bottleMat = std(nitro <= 1 ? "#1d4fd8" : "#0ea5e9", {
        metalness: 0.5,
        roughness: 0.25,
      });
      const n = nitro >= 3 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const b = cyl(0.07, 0.07, 0.5, bottleMat, 12);
        b.rotation.x = Math.PI / 2;
        b.position.set((k === 0 ? 1 : -1) * 0.22, topY + 0.03, -1.1);
        B.add(b);
      }
    }

    // --- Échappement + flamme de nitro ---------------------------------------
    const exhaust = L("exhaust");
    const exMat = [
      std("#6d6d6d", { metalness: 0.5, roughness: 0.7 }),
      std("#d6d6d6", { metalness: 1, roughness: 0.15 }),
      std("#e0e0e0", { metalness: 1, roughness: 0.1 }),
      std("#7d6aa8", { metalness: 1, roughness: 0.2 }),
      std("#999", { metalness: 1, roughness: 0.2 }),
    ][exhaust];
    const exY = chassis <= 2 ? 0.5 : 0.42;
    const exZ = chassis <= 2 ? -1.75 : -2.0;
    const pipes =
      exhaust === 0
        ? [[0.35, 0.12]]
        : exhaust === 4
          ? [[0, 0.06]]
          : exhaust === 1
            ? [[0.3, 0.05]]
            : [
                [0.25, 0.05],
                [-0.25, 0.05],
              ];
    this.exhausts = [];
    for (const [x, r] of pipes) {
      const p = cyl(r, r * 0.9, exhaust === 0 ? 0.3 : 0.4, exMat, 12);
      p.rotation.x = Math.PI / 2;
      p.position.set(x, exY, exZ);
      B.add(p);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(r * 1.4, 0.8, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: "#66ccff",
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(x, exY, exZ - 0.6);
      flame.visible = false;
      B.add(flame);
      this.exhausts.push(flame);
    }

    // Feu arrière (pluie / freinage)
    this.brakeLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, 0.03),
      new THREE.MeshStandardMaterial({
        color: "#400",
        emissive: "#ff0000",
        emissiveIntensity: 0.2,
      }),
    );
    this.brakeLight.position.set(
      0,
      chassis <= 2 ? 0.62 : 0.4,
      chassis <= 2 ? -1.68 : -1.97,
    );
    B.add(this.brakeLight);

    // --- Pilote ---------------------------------------------------------------
    const driver = buildAvatar(avatar, { seated: true });
    driver.scale.setScalar(0.2);
    driver.position.set(0, driverY, driverZ);
    driver.rotation.x = chassis >= 3 ? -0.3 : -0.1;
    B.add(driver);
    this.driver = driver;

    // Volant
    const steeringLvl = L("steering");
    const sw = new THREE.Group();
    if (steeringLvl === 0) {
      // Barre de bateau en bois
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.17, 0.02, 6, 16),
        wood,
      );
      sw.add(ring);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sp = box(0.025, 0.42, 0.025, wood);
        sp.rotation.z = a;
        sw.add(sp);
      }
    } else if (steeringLvl >= 4) {
      sw.add(box(0.26, 0.13, 0.04, carbon));
      sw.add(
        box(
          0.2,
          0.06,
          0.042,
          std("#0a1a2a", { emissive: "#1e88e5", emissiveIntensity: 0.6 }),
        ),
      );
    } else {
      sw.add(
        new THREE.Mesh(
          new THREE.TorusGeometry(steeringLvl >= 2 ? 0.12 : 0.15, 0.018, 6, 20),
          dark,
        ),
      );
      sw.add(box(0.2, 0.03, 0.02, dark));
    }
    const swY = driverY + (chassis >= 3 ? 0.5 : 0.48);
    sw.position.set(0, swY, driverZ + (chassis >= 3 ? 0.4 : 0.42));
    sw.rotation.x = chassis >= 3 ? -0.3 : -0.6;
    B.add(sw);
    this.steeringWheel = sw;

    this.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    for (const f of this.exhausts) f.castShadow = false;
  }

  // Animation visuelle : roues, roulis, tangage, nitro, DRS.
  update(
    dt,
    {
      speed = 0,
      steer = 0,
      longAcc = 0,
      latAcc = 0,
      nitro = false,
      braking = false,
      drs = false,
    },
  ) {
    this.spin += (speed * dt) / this.wheelRadius;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.spin;
      if (this.chassis === 0)
        w.spin.rotation.z = Math.sin(this.spin * 1.0 + w.side) * 0.06; // roues voilées
      if (w.front) w.steer.rotation.y = steer * 0.45;
    }
    const softness = this.chassis <= 2 ? 0.012 : 0.004;
    this.body.rotation.z = THREE.MathUtils.lerp(
      this.body.rotation.z,
      -latAcc * softness,
      0.15,
    );
    this.body.rotation.x = THREE.MathUtils.lerp(
      this.body.rotation.x,
      -longAcc * softness * 0.8,
      0.15,
    );
    if (this.chassis === 0 && speed > 1)
      this.body.position.y = Math.sin(this.spin * 3.1) * 0.012;
    this.steeringWheel.rotation.z = -steer * 1.6;
    for (const f of this.exhausts) {
      f.visible = nitro;
      if (nitro) f.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    }
    this.brakeLight.material.emissiveIntensity = braking ? 4 : 0.2;
    if (this.drsFlap)
      this.drsFlap.rotation.x = THREE.MathUtils.lerp(
        this.drsFlap.rotation.x,
        drs ? 1.2 : 0.45,
        0.2,
      );
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    this.group.removeFromParent();
  }
}
