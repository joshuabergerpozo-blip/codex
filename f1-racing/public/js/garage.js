// Garage : boutique d'améliorations, peinture, personnalisation du pilote,
// avec un aperçu 3D de la voiture dans un atelier.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  UPGRADES,
  PAINTS,
  LIVERIES,
  HATS,
  FACES,
  AVATAR_COLORS,
  computeStats,
  upgradeLevel,
  carRating,
  repairCost,
} from "../shared/catalog.js";
import { CarModel } from "./car.js";
import { buildAvatar, animateIdle } from "./avatar.js";
import { fmtMoney, escapeHtml } from "./hud.js";
import * as TX from "./textures.js";

const $ = (id) => document.getElementById(id);

const STAT_BARS = [
  ["Vitesse max", (s) => s.topKmh, 360, (v) => `${Math.round(v)} km/h`],
  ["Accélération", (s) => s.accel, 21, (v) => v.toFixed(1)],
  [
    "Adhérence",
    (s) => s.grip + (s.downforce * 3086) / 9.81,
    3.2,
    (v) => `${v.toFixed(2)} g`,
  ],
  ["Freinage", (s) => s.brake, 32, (v) => v.toFixed(0)],
  ["Maniabilité", (s) => s.steer, 1.4, (v) => v.toFixed(2)],
  [
    "Solidité",
    (s) => s.maxHp / (1 - s.damageReduce),
    1080,
    (v) => `${Math.round(v)}`,
  ],
  [
    "Nitro",
    (s) => s.nitroCap * s.nitroBoost,
    10.4,
    (v) => (v ? `${v.toFixed(1)}` : "—"),
  ],
  ["Revenus", (s) => s.income, 3, (v) => `×${v.toFixed(2)}`],
];

export class Garage {
  constructor({ renderer, net, audio }) {
    this.renderer = renderer;
    this.net = net;
    this.audio = audio;
    this.isOpen = false;
    this.tab = "perf";
    this.profile = null;
    this.health = { hp: 100, max: 100 };
    this.pendingPaint = null;
    this.angle = 0.6;
    this.dragging = false;
    this.buildScene();
    this.bindUi();
  }

  buildScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#15171c");
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.MeshStandardMaterial({
        color: "#4a4f57",
        roughness: 0.28,
        metalness: 0.15,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    // Lignes peintes au sol
    const lineMat = new THREE.MeshBasicMaterial({ color: "#d4b106" });
    for (const x of [-3.2, 3.2]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 9), lineMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, 0.005, 0);
      scene.add(l);
    }
    const turntable = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 0.08, 64),
      new THREE.MeshStandardMaterial({
        color: "#2a2d33",
        roughness: 0.35,
        metalness: 0.5,
      }),
    );
    turntable.position.y = 0.04;
    turntable.receiveShadow = true;
    scene.add(turntable);

    const wallMat = new THREE.MeshStandardMaterial({
      color: "#262a31",
      roughness: 0.85,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), wallMat);
    back.position.set(0, 5, -9);
    scene.add(back);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), wallMat);
      side.position.set(s * 14, 5, 0);
      side.rotation.y = (-s * Math.PI) / 2;
      scene.add(side);
    }
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 0.5),
      new THREE.MeshBasicMaterial({ color: "#e10600" }),
    );
    stripe.position.set(0, 3, -8.98);
    scene.add(stripe);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.1),
      new THREE.MeshStandardMaterial({ map: TX.adTexture(1) }),
    );
    banner.position.set(0, 5.2, -8.97);
    scene.add(banner);

    // Servantes à outils, pneus, établi
    const red = new THREE.MeshStandardMaterial({
      color: "#b91c1c",
      roughness: 0.35,
      metalness: 0.4,
    });
    for (const x of [-9, -7.4, 7.4, 9]) {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.7), red);
      chest.position.set(x, 0.55, -8.4);
      chest.castShadow = true;
      scene.add(chest);
      for (let d = 0; d < 4; d++) {
        const h = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.03, 0.02),
          new THREE.MeshStandardMaterial({
            color: "#ddd",
            metalness: 1,
            roughness: 0.2,
          }),
        );
        h.position.set(x, 0.25 + d * 0.24, -8.04);
        scene.add(h);
      }
    }
    const rubber = new THREE.MeshStandardMaterial({
      color: "#141414",
      roughness: 0.9,
    });
    for (let k = 0; k < 4; k++) {
      for (let j = 0; j < 4; j++) {
        const t = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.13, 10, 20),
          rubber,
        );
        t.rotation.x = Math.PI / 2;
        t.position.set(-11.5 + k * 0.9, 0.13 + j * 0.26, -6.5);
        t.castShadow = true;
        scene.add(t);
      }
    }
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.1, 1),
      new THREE.MeshStandardMaterial({ color: "#6b4f2a", roughness: 0.8 }),
    );
    bench.position.set(10, 1, -5);
    scene.add(bench);
    const pegboard = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2),
      new THREE.MeshStandardMaterial({ color: "#8d6e4a", roughness: 0.9 }),
    );
    pegboard.position.set(10, 2.4, -8.97);
    scene.add(pegboard);

    // Éclairage
    scene.add(new THREE.HemisphereLight("#ffffff", "#30343a", 0.6));
    const key = new THREE.SpotLight("#ffffff", 220, 30, 0.6, 0.5, 1.5);
    key.position.set(3, 9, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    scene.add(key.target);
    const fill = new THREE.PointLight("#9ecbff", 40, 20);
    fill.position.set(-6, 4, 4);
    scene.add(fill);
    for (const x of [-6, 0, 6]) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.08, 0.3),
        new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      );
      strip.position.set(x, 7, 0);
      scene.add(strip);
    }
    this.carHolder = new THREE.Group();
    scene.add(this.carHolder);
  }

  bindUi() {
    for (const b of document.querySelectorAll(".tab")) {
      b.addEventListener("click", () => {
        this.tab = b.dataset.tab;
        for (const x of document.querySelectorAll(".tab"))
          x.classList.toggle("active", x === b);
        for (const id of ["perf", "paint", "pilot", "repair"])
          $(`tab-${id}`).classList.toggle("hidden", id !== this.tab);
        this.renderUi();
      });
    }
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.isOpen) return;
      this.dragging = true;
      this.lastX = e.clientX;
    });
    window.addEventListener("pointerup", () => (this.dragging = false));
    window.addEventListener("pointermove", (e) => {
      if (!this.isOpen || !this.dragging) return;
      this.angle -= (e.clientX - this.lastX) * 0.008;
      this.lastX = e.clientX;
    });

    $("tab-perf").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-buy]");
      if (btn)
        this.net.send({ t: "buy", kind: "upgrade", id: btn.dataset.buy });
    });
    $("tab-perf").addEventListener("mouseover", (e) => {
      const card = e.target.closest("[data-upg]");
      this.renderStats(card ? card.dataset.upg : null);
    });
    $("tab-paint").addEventListener("click", (e) => this.onPaintClick(e));
    $("tab-paint").addEventListener("change", (e) => {
      if (e.target.id === "numInput")
        this.sendLook({ number: Number(e.target.value) });
    });
    $("tab-pilot").addEventListener("click", (e) => this.onPilotClick(e));
    $("tab-pilot").addEventListener("change", (e) => {
      if (e.target.id === "pilotName")
        this.net.send({
          t: "customize",
          look: this.profile.look,
          avatar: this.profile.avatar,
          name: e.target.value,
        });
    });
    $("tab-repair").addEventListener("click", (e) => {
      if (e.target.closest("#repairBtn")) {
        this.net.send({
          t: "repair",
          missing: Math.ceil(this.health.max - this.health.hp),
        });
      }
    });
  }

  sendLook(lookPatch = {}, avatarPatch = {}) {
    const look = { ...this.profile.look, ...lookPatch };
    const avatar = { ...this.profile.avatar, ...avatarPatch };
    this.net.send({ t: "customize", look, avatar });
  }

  onPaintClick(e) {
    const sw = e.target.closest("[data-paint]");
    if (sw) {
      const id = sw.dataset.paint;
      const slot = sw.dataset.slot;
      if (this.profile.owned.paints.includes(id)) this.sendLook({ [slot]: id });
      else {
        this.pendingPaint = { id, slot };
        this.net.send({ t: "buy", kind: "paint", id });
      }
      return;
    }
    const lv = e.target.closest("[data-livery]");
    if (lv) {
      const id = lv.dataset.livery;
      if (this.profile.owned.liveries.includes(id))
        this.sendLook({ livery: id });
      else {
        this.pendingLivery = id;
        this.net.send({ t: "buy", kind: "livery", id });
      }
    }
  }

  onPilotClick(e) {
    const c = e.target.closest("[data-color]");
    if (c) {
      this.sendLook({}, { [c.dataset.part]: c.dataset.color });
      return;
    }
    const f = e.target.closest("[data-face]");
    if (f) {
      this.sendLook({}, { face: f.dataset.face });
      return;
    }
    const h = e.target.closest("[data-hat]");
    if (h) {
      const id = h.dataset.hat;
      if (this.profile.owned.hats.includes(id)) this.sendLook({}, { hat: id });
      else {
        this.pendingHat = id;
        this.net.send({ t: "buy", kind: "hat", id });
      }
    }
  }

  // Appelé quand le serveur confirme un achat.
  onBought(msg) {
    if (msg.kind === "paint" && this.pendingPaint?.id === msg.id) {
      this.sendLook({ [this.pendingPaint.slot]: msg.id });
      this.pendingPaint = null;
    } else if (msg.kind === "livery" && this.pendingLivery === msg.id) {
      this.sendLook({ livery: msg.id });
      this.pendingLivery = null;
    } else if (msg.kind === "hat" && this.pendingHat === msg.id) {
      this.sendLook({}, { hat: msg.id });
      this.pendingHat = null;
    }
  }

  open(health) {
    this.isOpen = true;
    this.health = health;
    $("garage").classList.remove("hidden");
    this.renderUi();
    this.rebuildPreview();
  }

  close() {
    this.isOpen = false;
    $("garage").classList.add("hidden");
  }

  setProfile(profile) {
    const prevKey = this.previewKey;
    this.profile = profile;
    if (!this.isOpen) return;
    this.renderUi();
    if (prevKey !== this.lookKey()) this.rebuildPreview();
  }

  setHealth(health) {
    this.health = health;
    if (this.isOpen && this.tab === "repair") this.renderUi();
  }

  lookKey() {
    const p = this.profile;
    return JSON.stringify([p.upgrades, p.look, p.avatar]);
  }

  rebuildPreview() {
    if (!this.profile) return;
    this.previewKey = this.lookKey();
    if (this.car) this.car.dispose();
    if (this.avatar) this.avatar.removeFromParent();
    this.car = new CarModel(this.profile);
    this.carHolder.add(this.car.group);
    this.avatar = buildAvatar(this.profile.avatar);
    this.avatar.scale.setScalar(0.33);
    this.avatar.position.set(2.1, 0.08, 0.6);
    this.avatar.rotation.y = 0.5;
    this.avatar.traverse((o) => o.isMesh && (o.castShadow = true));
    this.carHolder.add(this.avatar);
  }

  renderStats(hoverId) {
    const p = this.profile;
    const cur = computeStats(p.upgrades);
    let next = null;
    if (hoverId) {
      const u = UPGRADES.find((x) => x.id === hoverId);
      const lvl = upgradeLevel(p.upgrades, hoverId);
      if (u && lvl < u.levels.length - 1)
        next = computeStats({ ...p.upgrades, [hoverId]: lvl + 1 });
    }
    $("statsBox").innerHTML = STAT_BARS.map(([name, fn, max, fmt]) => {
      const a = fn(cur);
      const b = next ? fn(next) : a;
      const pa = Math.min(100, (a / max) * 100);
      const pb = Math.min(100, (b / max) * 100);
      return `<div class="stat"><span>${name}</span><div class="track"><div class="nxt" style="width:${pb}%"></div><div class="cur" style="width:${pa}%"></div></div><b>${fmt(b)}</b></div>`;
    }).join("");
  }

  renderUi() {
    const p = this.profile;
    if (!p) return;
    $("gMoney").textContent = fmtMoney(p.money);
    $("carRating").textContent = carRating(p.upgrades);
    this.renderStats(null);
    if (this.tab === "perf") this.renderPerf();
    else if (this.tab === "paint") this.renderPaint();
    else if (this.tab === "pilot") this.renderPilot();
    else this.renderRepair();
  }

  renderPerf() {
    const p = this.profile;
    $("tab-perf").innerHTML = UPGRADES.map((u) => {
      const lvl = upgradeLevel(p.upgrades, u.id);
      const max = u.levels.length - 1;
      const pips = u.levels
        .slice(1)
        .map((_, i) => `<div class="pip ${i < lvl ? "on" : ""}"></div>`)
        .join("");
      let buy;
      if (lvl >= max) buy = '<span class="maxed">MAX ✔</span>';
      else {
        const n = u.levels[lvl + 1];
        buy = `<button class="btn ${p.money >= n.price ? "primary" : ""}" data-buy="${u.id}" ${p.money >= n.price ? "" : "disabled"}>${fmtMoney(n.price)} €</button><div class="next">→ ${escapeHtml(n.name)}</div>`;
      }
      return `<div class="upg" data-upg="${u.id}">
        <div class="ic">${u.icon}</div>
        <div><div class="nm">${escapeHtml(u.name)}</div><div class="cur-lv">${escapeHtml(u.levels[lvl].name)}</div><div class="pips">${pips}</div></div>
        <div class="buy">${buy}</div>
        <div class="desc">${escapeHtml(u.desc)}</div>
      </div>`;
    }).join("");
  }

  renderPaint() {
    const p = this.profile;
    const swatches = (slot) =>
      PAINTS.map((c) => {
        const owned = p.owned.paints.includes(c.id);
        const sel = p.look[slot] === c.id;
        const bg =
          c.id === "bois"
            ? "linear-gradient(135deg,#8a5a2e,#c19a6b)"
            : c.carbon
              ? "repeating-linear-gradient(45deg,#222 0 4px,#3a3a3f 4px 8px)"
              : c.metal > 0.8
                ? `linear-gradient(135deg, ${c.color}, #ffffff 50%, ${c.color})`
                : c.color;
        return `<div class="swatch ${sel ? "sel" : ""} ${owned ? "" : "locked"}" data-paint="${c.id}" data-slot="${slot}" title="${escapeHtml(c.name)}">
        <div class="chip" style="background:${bg}"></div>${owned ? escapeHtml(c.name.split(" ")[0]) : `${fmtMoney(c.price)} €`}</div>`;
      }).join("");
    const liveries = LIVERIES.map((l) => {
      const owned = p.owned.liveries.includes(l.id);
      return `<button class="chipbtn ${p.look.livery === l.id ? "sel" : ""}" data-livery="${l.id}">${owned ? "" : "🔒 "}${escapeHtml(l.name)}${owned ? "" : `<span class="price">${fmtMoney(l.price)} €</span>`}</button>`;
    }).join("");
    $("tab-paint").innerHTML = `
      <div class="section-title">Couleur principale (carrosserie)</div><div class="swatches">${swatches("paint")}</div>
      <div class="section-title">Couleur secondaire (ailerons, bandes, motifs)</div><div class="swatches">${swatches("accent")}</div>
      <div class="section-title">Livrée</div><div class="list">${liveries}</div>
      <div class="section-title">Numéro de course</div>
      <div class="inline"><input id="numInput" type="number" min="1" max="99" value="${p.look.number}" /></div>
      <p class="muted">Une couleur achetée peut servir de couleur principale ou secondaire.</p>`;
  }

  renderPilot() {
    const p = this.profile;
    const colors = (part) =>
      `<div class="colors">${AVATAR_COLORS.map((c) => `<div class="c ${p.avatar[part] === c ? "sel" : ""}" data-part="${part}" data-color="${c}" style="background:${c}"></div>`).join("")}</div>`;
    const faces = FACES.map(
      (f) =>
        `<button class="chipbtn ${p.avatar.face === f.id ? "sel" : ""}" data-face="${f.id}">${escapeHtml(f.name)}</button>`,
    ).join("");
    const hats = HATS.map((h) => {
      const owned = p.owned.hats.includes(h.id) || h.price === 0;
      return `<button class="chipbtn ${p.avatar.hat === h.id ? "sel" : ""}" data-hat="${h.id}">${owned ? "" : "🔒 "}${escapeHtml(h.name)}${owned ? "" : `<span class="price">${fmtMoney(h.price)} €</span>`}</button>`;
    }).join("");
    $("tab-pilot").innerHTML = `
      <div class="section-title">Pseudo</div>
      <div class="inline"><input id="pilotName" maxlength="16" value="${escapeHtml(p.name)}" style="width:220px" /></div>
      <div class="section-title">Peau</div>${colors("skin")}
      <div class="section-title">Haut</div>${colors("shirt")}
      <div class="section-title">Pantalon</div>${colors("pants")}
      <div class="section-title">Visage</div><div class="list">${faces}</div>
      <div class="section-title">Couvre-chef</div><div class="list">${hats}</div>
      <p class="muted">Statistiques : ${p.stats.laps} tours · ${p.stats.races} courses · ${p.stats.wins} victoires · ${fmtMoney(p.stats.earned)} € gagnés</p>`;
  }

  renderRepair() {
    const p = this.profile;
    const { hp, max } = this.health;
    const missing = Math.max(0, Math.ceil(max - hp));
    const cost = repairCost(p.upgrades, missing);
    $("tab-repair").innerHTML = `<div class="repair-box">
      <b>État de la voiture : ${Math.round((hp / max) * 100)} %</b>
      <div class="track"><div class="fill" style="width:${(hp / max) * 100}%;background:${hp / max > 0.5 ? "#22c55e" : hp / max > 0.25 ? "#facc15" : "#ef4444"}"></div></div>
      <p class="muted">Les chocs contre les murs et les autres voitures abîment la voiture : elle perd de la vitesse. Le renforcement réduit les dégâts, l'équipe des stands réduit le prix des réparations.</p>
      <button id="repairBtn" class="btn primary wide" ${missing === 0 || p.money < cost ? "disabled" : ""}>${missing === 0 ? "Voiture intacte" : `Réparer (${fmtMoney(cost)} €)`}</button>
    </div>`;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    const panel = Math.min(560, w);
    if (w > 900) this.camera.setViewOffset(w, h, -panel / 2, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  render(dt, time) {
    if (!this.dragging) this.angle += dt * 0.15;
    const r = 8.2;
    this.camera.position.set(
      Math.sin(this.angle) * r,
      2.6,
      Math.cos(this.angle) * r,
    );
    this.camera.lookAt(0, 0.6, 0);
    if (this.car)
      this.car.update(dt, { speed: 0, steer: Math.sin(time * 0.5) * 0.4 });
    if (this.avatar) animateIdle(this.avatar, time);
    this.renderer.render(this.scene, this.camera);
  }
}
