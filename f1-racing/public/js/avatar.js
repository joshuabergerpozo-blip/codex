// Personnages en blocs, façon Roblox.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { faceTexture } from "./textures.js";

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts });
}

function buildHat(id) {
  const g = new THREE.Group();
  if (id === "casquette") {
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.66, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mat("#c8102e"),
    );
    crown.position.y = 0.45;
    const brim = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.06, 0.6),
      mat("#c8102e"),
    );
    brim.position.set(0, 0.48, 0.75);
    g.add(crown, brim);
  } else if (id === "casque" || id === "integral" || id === "casque-f1") {
    const colors = {
      "casque": "#f2f2f2",
      "integral": "#1d4fd8",
      "casque-f1": "#ffd400",
    };
    // Le casque classique est ouvert devant pour laisser voir le visage.
    const geo =
      id === "casque"
        ? new THREE.SphereGeometry(
            0.92,
            24,
            18,
            Math.PI / 2 + 0.95,
            Math.PI * 2 - 1.9,
          )
        : new THREE.SphereGeometry(0.92, 24, 18);
    const shell = new THREE.Mesh(
      geo,
      mat(colors[id], {
        roughness: 0.25,
        metalness: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    shell.position.y = 0.05;
    shell.scale.set(1, 1.02, 1.05);
    g.add(shell);
    if (id !== "casque") {
      const visor = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.94,
          24,
          8,
          Math.PI / 2 - 0.8,
          1.6,
          1.2,
          0.55,
        ),
        mat("#111", { roughness: 0.05, metalness: 0.8 }),
      );
      visor.position.y = 0.05;
      visor.scale.set(1, 1.02, 1.06);
      g.add(visor);
    }
    if (id === "casque-f1") {
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.93, 0.07, 6, 30),
        mat("#c8102e"),
      );
      stripe.rotation.y = Math.PI / 2;
      stripe.position.y = 0.1;
      g.add(stripe);
    }
  } else if (id === "paille") {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 0.06, 28),
      mat("#e5c06b", { roughness: 0.9 }),
    );
    brim.position.y = 0.62;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.68, 0.5, 24),
      mat("#e5c06b", { roughness: 0.9 }),
    );
    crown.position.y = 0.88;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.69, 0.69, 0.12, 24),
      mat("#c8102e"),
    );
    band.position.y = 0.7;
    g.add(brim, crown, band);
  } else if (id === "haut-de-forme") {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 0.06, 28),
      mat("#111"),
    );
    brim.position.y = 0.62;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 1.2, 28),
      mat("#111"),
    );
    crown.position.y = 1.2;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.61, 0.61, 0.15, 28),
      mat("#8b0000"),
    );
    band.position.y = 0.75;
    g.add(brim, crown, band);
  } else if (id === "viking") {
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mat("#9e9e9e", { metalness: 0.7, roughness: 0.3 }),
    );
    shell.position.y = 0.4;
    g.add(shell);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.8, 12),
        mat("#f3ead2"),
      );
      horn.position.set(s * 0.8, 0.85, 0);
      horn.rotation.z = -s * 0.7;
      g.add(horn);
    }
  } else if (id === "couronne") {
    const gold = mat("#e3b23c", { metalness: 1, roughness: 0.15 });
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.3, 24, 1, true),
      gold,
    );
    ring.material.side = THREE.DoubleSide;
    ring.position.y = 0.72;
    g.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 6), gold);
      spike.position.set(Math.cos(a) * 0.6, 1.0, Math.sin(a) * 0.6);
      g.add(spike);
      const gem = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        mat(i % 2 ? "#c8102e" : "#1d4fd8", { metalness: 0.3, roughness: 0.1 }),
      );
      gem.position.set(Math.cos(a) * 0.63, 0.72, Math.sin(a) * 0.63);
      g.add(gem);
    }
  }
  return g;
}

// Construit un personnage. `seated` : position assise dans la voiture.
export function buildAvatar(av, { seated = false } = {}) {
  const root = new THREE.Group();
  const skin = mat(av.skin);
  const shirt = mat(av.shirt);
  const pants = mat(av.pants);

  const head = new THREE.Group();
  const headMesh = new THREE.Mesh(
    new RoundedBoxGeometry(1.2, 1.2, 1.2, 4, 0.3),
    skin,
  );
  headMesh.castShadow = true;
  head.add(headMesh);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
    new THREE.MeshStandardMaterial({
      map: faceTexture(av.face),
      transparent: true,
      roughness: 0.6,
    }),
  );
  face.position.z = 0.61;
  head.add(face);
  head.add(buildHat(av.hat));
  head.position.y = 3.6;
  root.add(head);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 1), shirt);
  torso.position.y = 2;
  torso.castShadow = true;
  root.add(torso);

  const limbs = {};
  for (const [name, x, material, y] of [
    ["armL", 1.5, skin, 2],
    ["armR", -1.5, skin, 2],
    ["legL", 0.5, pants, 0],
    ["legR", -0.5, pants, 0],
  ]) {
    const pivot = new THREE.Group();
    const isArm = name.startsWith("arm");
    pivot.position.set(x, y + 1, 0);
    const geo = new THREE.BoxGeometry(1, 2, 1);
    geo.translate(0, -1, 0);
    const mesh = new THREE.Mesh(geo, isArm ? shirt : material);
    mesh.castShadow = true;
    pivot.add(mesh);
    if (isArm) {
      // Mains couleur peau
      const hand = new THREE.Mesh(
        new THREE.BoxGeometry(1.001, 0.6, 1.001),
        skin,
      );
      hand.position.y = -1.7;
      pivot.add(hand);
    }
    root.add(pivot);
    limbs[name] = pivot;
  }

  if (seated) {
    limbs.legL.rotation.x = -Math.PI / 2;
    limbs.legR.rotation.x = -Math.PI / 2;
    limbs.armL.rotation.x = -1.1;
    limbs.armR.rotation.x = -1.1;
    limbs.armL.rotation.z = -0.25;
    limbs.armR.rotation.z = 0.25;
  }

  root.userData = { head, limbs };
  return root;
}

// Petite animation d'attente (respiration + bras).
export function animateIdle(avatar, t) {
  const { head, limbs } = avatar.userData;
  head.rotation.y = Math.sin(t * 0.7) * 0.25;
  limbs.armL.rotation.z = 0.08 + Math.sin(t * 1.3) * 0.05;
  limbs.armR.rotation.z = -0.08 - Math.sin(t * 1.3) * 0.05;
  limbs.armR.rotation.x = Math.sin(t * 0.9) * 0.1;
}
