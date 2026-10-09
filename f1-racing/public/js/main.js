// Point d'entrée du jeu : rendu, boucle de jeu, réseau, course.
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import {
  computeStats,
  upgradeLevel,
  carRating,
  PAINTS,
} from "../shared/catalog.js";
import { Track, WALL } from "./track.js";
import { CarModel } from "./car.js";
import { CarPhysics } from "./physics.js";
import { Net } from "./net.js";
import { GameAudio } from "./audio.js";
import { Garage } from "./garage.js";
import { Hud, fmtTime, fmtMoney, escapeHtml } from "./hud.js";
import * as TX from "./textures.js";

const $ = (id) => document.getElementById(id);
const STEP = 1 / 120;
const INTERP_DELAY = 120;

// --- Rendu -------------------------------------------------------------------

const canvas = $("game");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#c3d3e2", 350, 2600);
const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 12000);

const sky = new Sky();
sky.scale.setScalar(10000);
const sun = new THREE.Vector3().setFromSphericalCoords(
  1,
  THREE.MathUtils.degToRad(90 - 38),
  THREE.MathUtils.degToRad(150),
);
sky.material.uniforms.turbidity.value = 5;
sky.material.uniforms.rayleigh.value = 1.4;
sky.material.uniforms.mieCoefficient.value = 0.004;
sky.material.uniforms.mieDirectionalG.value = 0.8;
sky.material.uniforms.sunPosition.value.copy(sun);
scene.add(sky);
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(1000);
  envSky.material.uniforms.sunPosition.value.copy(sun);
  envSky.material.uniforms.turbidity.value = 5;
  envSky.material.uniforms.rayleigh.value = 1.4;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene).texture;
  scene.environmentIntensity = 0.8;
}

scene.add(new THREE.HemisphereLight("#d6e6ff", "#4a5a32", 0.7));
const sunLight = new THREE.DirectionalLight("#fff1dc", 3.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -60;
sunLight.shadow.camera.right = 60;
sunLight.shadow.camera.top = 60;
sunLight.shadow.camera.bottom = -60;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 600;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight);
scene.add(sunLight.target);

const track = new Track();
track.build(scene);
const hud = new Hud(track);
const audio = new GameAudio();
const net = new Net();
const garage = new Garage({ renderer, net, audio });

// --- Particules (poussière, fumée de pneus) -------------------------------

const particles = [];
{
  const tex = TX.smokeTexture();
  for (let i = 0; i < 90; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    s.visible = false;
    scene.add(s);
    particles.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
  }
}
let particleIdx = 0;
function spawnParticle(
  x,
  y,
  z,
  color,
  size,
  vx = 0,
  vy = 1,
  vz = 0,
  life = 1.2,
) {
  const p = particles[particleIdx++ % particles.length];
  p.s.position.set(x, y, z);
  p.s.material.color.set(color);
  p.s.scale.setScalar(size);
  p.size = size;
  p.vx = vx;
  p.vy = vy;
  p.vz = vz;
  p.life = life;
  p.max = life;
  p.s.visible = true;
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.s.visible = false;
      continue;
    }
    p.s.position.x += p.vx * dt;
    p.s.position.y += p.vy * dt;
    p.s.position.z += p.vz * dt;
    const k = p.life / p.max;
    p.s.material.opacity = k * 0.5;
    p.s.scale.setScalar(p.size * (1 + (1 - k) * 2.5));
  }
}

// --- État du jeu --------------------------------------------------------------

const state = {
  profile: null,
  myId: null,
  room: null,
  inGame: false,
  car: null,
  carKey: "",
  phys: null,
  remotes: new Map(),
  camMode: 0,
  keys: new Set(),
  drsPressed: false,
  race: null,
  lap: null,
  lastSend: 0,
  simTime: 0,
  flyIdx: 0,
  menuOpen: false,
  quality: localStorage.getItem("f1gr_quality") || "high",
};

function newLapState() {
  return {
    started: false,
    start: 0,
    s1: false,
    s2: false,
    clean: true,
    lastIdx: -1,
    crossings: 0,
    valid: 0,
    best: null,
    last: null,
    wrongTimer: 0,
  };
}

function paintColor(look) {
  const p = PAINTS.find((x) => x.id === look?.paint);
  return !p || p.id === "bois" ? "#a0703f" : p.color;
}

function lookKey(p) {
  return JSON.stringify([p.upgrades, p.look, p.avatar]);
}

// --- Voiture du joueur ----------------------------------------------------------

function rebuildMyCar() {
  const p = state.profile;
  const key = lookKey(p);
  const stats = computeStats(p.upgrades);
  if (state.phys) state.phys.setStats(stats);
  if (key === state.carKey && state.car) return;
  state.carKey = key;
  if (state.car) state.car.dispose();
  state.car = new CarModel(p);
  scene.add(state.car.group);
}

function placeOnGrid(slot) {
  const g = track.gridSlot(slot);
  state.phys.place(g.x, g.z, g.heading);
  state.lap.lastIdx = -1;
}

function myGridSlot() {
  const players = state.room?.players || [];
  const k = players.findIndex((p) => p.id === state.myId);
  return Math.max(0, k);
}

function startDriving() {
  const stats = computeStats(state.profile.upgrades);
  state.phys = new CarPhysics(stats);
  state.lap = newLapState();
  rebuildMyCar();
  placeOnGrid(myGridSlot());
  state.inGame = true;
}

// --- Joueurs distants -------------------------------------------------------------

function nameTag(name, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(4, 8, 248, 48, 14);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(14, 22, 8, 20);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name, 136, 33);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }),
  );
  s.scale.set(4, 1, 1);
  s.renderOrder = 10;
  return s;
}

function syncRemotes(players) {
  const ids = new Set();
  for (const p of players) {
    if (p.id === state.myId) continue;
    ids.add(p.id);
    let r = state.remotes.get(p.id);
    const key = lookKey(p) + p.name;
    if (!r) {
      r = { id: p.id, buf: [], model: null, key: "", tag: null, info: p };
      state.remotes.set(p.id, r);
    }
    r.info = p;
    if (r.key !== key) {
      r.key = key;
      const pos = r.model ? r.model.group.position.clone() : null;
      const rot = r.model ? r.model.group.rotation.y : 0;
      if (r.model) r.model.dispose();
      if (r.tag) r.tag.removeFromParent();
      r.model = new CarModel(p);
      r.tag = nameTag(p.name, paintColor(p.look));
      r.tag.position.y = 2.4;
      r.model.group.add(r.tag);
      if (pos) {
        r.model.group.position.copy(pos);
        r.model.group.rotation.y = rot;
      } else {
        r.model.group.visible = false;
      }
      scene.add(r.model.group);
    }
  }
  for (const [id, r] of state.remotes) {
    if (!ids.has(id)) {
      r.model?.dispose();
      state.remotes.delete(id);
    }
  }
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function updateRemotes(dt, now) {
  const renderT = now - INTERP_DELAY;
  for (const r of state.remotes.values()) {
    if (!r.model || r.buf.length === 0) continue;
    while (r.buf.length >= 2 && r.buf[1].t <= renderT) r.buf.shift();
    let s;
    const a = r.buf[0];
    const b = r.buf[1];
    if (b && renderT >= a.t) {
      const k = Math.min(1, (renderT - a.t) / Math.max(1, b.t - a.t));
      s = {
        x: a.s[0] + (b.s[0] - a.s[0]) * k,
        z: a.s[1] + (b.s[1] - a.s[1]) * k,
        h: lerpAngle(a.s[2], b.s[2], k),
        v: a.s[3] + (b.s[3] - a.s[3]) * k,
        st: a.s[4],
        flags: a.s[6],
      };
    } else {
      // Extrapolation courte si un paquet manque
      const ex = Math.min(0.25, (renderT - a.t) / 1000);
      s = {
        x: a.s[0] + Math.sin(a.s[2]) * a.s[3] * ex,
        z: a.s[1] + Math.cos(a.s[2]) * a.s[3] * ex,
        h: a.s[2],
        v: a.s[3],
        st: a.s[4],
        flags: a.s[6],
      };
    }
    const g = r.model.group;
    g.visible = true;
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.h;
    r.vx = Math.sin(s.h) * s.v;
    r.vz = Math.cos(s.h) * s.v;
    r.cur = s;
    r.model.update(dt, {
      speed: s.v,
      steer: s.st,
      nitro: Boolean(s.flags & 1),
      braking: Boolean(s.flags & 2),
      drs: Boolean(s.flags & 4),
    });
  }
}

// --- Entrées clavier ------------------------------------------------------------------

const KEYMAP = {
  "z": "up",
  "w": "up",
  "arrowup": "up",
  "s": "down",
  "arrowdown": "down",
  "q": "left",
  "a": "left",
  "arrowleft": "left",
  "d": "right",
  "arrowright": "right",
  " ": "handbrake",
  "shift": "nitro",
};

function typing() {
  const el = document.activeElement;
  return (
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "SELECT" ||
      el.tagName === "TEXTAREA")
  );
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "enter" && state.inGame) {
    const box = $("chatBox");
    const input = $("chatInput");
    if (box.classList.contains("hidden")) {
      box.classList.remove("hidden");
      input.focus();
      state.keys.clear();
    } else {
      if (input.value.trim()) net.send({ t: "chat", text: input.value });
      input.value = "";
      input.blur();
      box.classList.add("hidden");
    }
    e.preventDefault();
    return;
  }
  if (typing()) return;
  audio.start();
  if (KEYMAP[k]) {
    state.keys.add(KEYMAP[k]);
    e.preventDefault();
  }
  if (!state.inGame) return;
  if (k === "tab") {
    e.preventDefault();
    showLeaderboard(true);
  } else if (k === "e") state.drsPressed = true;
  else if (k === "c" && !e.repeat) state.camMode = (state.camMode + 1) % 3;
  else if (k === "g" && !e.repeat) toggleGarage();
  else if (k === "r" && !e.repeat) resetCar();
  else if (k === "m" && !e.repeat) toggleMute();
  else if (k === "escape") toggleMenu();
});
window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (KEYMAP[k]) state.keys.delete(KEYMAP[k]);
  if (k === "shift") state.keys.delete("nitro");
  if (k === "tab") showLeaderboard(false);
});
window.addEventListener("blur", () => state.keys.clear());

function readInput() {
  const k = state.keys;
  const input = {
    throttle: k.has("up") ? 1 : 0,
    brake: k.has("down") ? 1 : 0,
    steer: (k.has("right") ? 1 : 0) - (k.has("left") ? 1 : 0),
    handbrake: k.has("handbrake"),
    nitro: k.has("nitro"),
    drs: state.drsPressed,
  };
  state.drsPressed = false;
  return input;
}

const NO_INPUT = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  nitro: false,
  drs: false,
};

// --- Actions -----------------------------------------------------------------------

function resetCar() {
  if (state.race?.phase === "grid") return;
  const ph = state.phys;
  const near = track.nearest(ph.x, ph.z, -1);
  const i = near.i;
  ph.place(track.x[i], track.z[i], track.heading(i));
  state.lap.clean = false;
  hud.toast("Voiture replacée sur la piste");
}

function toggleGarage() {
  if (garage.isOpen) {
    garage.close();
    $("hud").classList.remove("hidden");
    // Sortie des stands : retour sur la grille, devant la ligne.
    if (!state.race) {
      placeOnGrid(myGridSlot());
      state.lap = {
        ...newLapState(),
        best: state.lap.best,
        last: state.lap.last,
      };
    }
    return;
  }
  if (state.race) {
    hud.toast("🔒 Garage fermé pendant la course !", "err");
    return;
  }
  state.keys.clear();
  garage.setProfile(state.profile);
  garage.open({ hp: state.phys.hp, max: state.phys.stats.maxHp });
  $("hud").classList.add("hidden");
}

function toggleMute() {
  audio.setMuted(!audio.muted);
  $("muteBtn").textContent = audio.muted ? "🔇 Son : coupé" : "🔊 Son : activé";
  hud.toast(audio.muted ? "🔇 Son coupé" : "🔊 Son activé");
}

function toggleMenu(force) {
  state.menuOpen = force ?? !state.menuOpen;
  $("menu").classList.toggle("hidden", !state.menuOpen);
}

function applyQuality() {
  const high = state.quality === "high";
  renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 1.5) : 0.75);
  renderer.shadowMap.enabled = high;
  sunLight.castShadow = high;
  scene.traverse((o) => {
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m.needsUpdate = true;
    }
  });
  $("qualityBtn").textContent =
    `Qualité : ${high ? "haute" : "basse (plus fluide)"}`;
  onResize();
}

function showLeaderboard(show) {
  $("leaderboard").classList.toggle("hidden", !show);
  if (!show || !state.room) return;
  const rows = [...state.room.players].sort(
    (a, b) => (a.bestLap ?? 1e9) - (b.bestLap ?? 1e9),
  );
  $("lbBody").innerHTML = rows
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(p.name)}${p.id === state.myId ? " (toi)" : ""}</td><td>${p.rating}/100</td><td>${fmtTime(p.bestLap)}</td></tr>`,
    )
    .join("");
}

// --- Tours et course ------------------------------------------------------------------

function raceDistance() {
  return (state.lap.crossings - 1) * track.n + state.phys.idx;
}

function updateLap(now) {
  const lap = state.lap;
  const idx = state.phys.idx;
  const n = track.n;
  if (lap.lastIdx >= 0 && idx >= 0) {
    const [s1, s2] = track.sectors;
    if (!lap.s1 && lap.lastIdx < s1 && idx >= s1 && idx < s1 + 150)
      lap.s1 = true;
    if (lap.s1 && !lap.s2 && lap.lastIdx < s2 && idx >= s2 && idx < s2 + 150)
      lap.s2 = true;
    if (lap.lastIdx > n - 150 && idx < 150) {
      // Ligne franchie dans le bon sens
      lap.crossings++;
      if (lap.started && lap.s1 && lap.s2) completeLap(now - lap.start);
      lap.started = true;
      lap.start = now;
      lap.s1 = lap.s2 = false;
      lap.clean = true;
    } else if (lap.lastIdx < 150 && idx > n - 150) {
      // Marche arrière sur la ligne : le tour est annulé
      lap.crossings--;
      lap.started = false;
      lap.s1 = lap.s2 = false;
    }
  }
  lap.lastIdx = idx;
  const surf = state.phys.surface;
  if (surf === "grass" || surf === "gravel") lap.clean = false;
}

function completeLap(time) {
  const lap = state.lap;
  lap.last = time;
  const best = lap.best === null || time < lap.best;
  if (best) lap.best = time;
  net.send({ t: "lap", time, clean: lap.clean });
  // Nitro rechargée à chaque tour
  state.phys.nitro = state.phys.stats.nitroCap;
  if (state.race?.phase === "racing" && !state.race.finished) {
    lap.valid++;
    if (lap.valid >= state.race.laps) {
      state.race.finished = true;
      const total = state.simTime - state.race.goSim;
      net.send({ t: "finish", time: total });
      hud.center(`🏁 ARRIVÉE !<small>${fmtTime(total)}</small>`, 4000);
    } else if (lap.valid === state.race.laps - 1) {
      hud.center("DERNIER TOUR", 2000);
    }
  }
}

function onRaceStart(msg) {
  if (garage.isOpen) toggleGarage();
  toggleMenu(false);
  $("results").classList.add("hidden");
  const now = performance.now();
  const slot = Math.max(0, msg.grid.indexOf(state.myId));
  state.race = {
    laps: msg.laps,
    grid: msg.grid,
    phase: "grid",
    t0: now + msg.delay,
    go: now + msg.delay + 5000 + (msg.hold || 800),
    lights: 0,
    finished: false,
  };
  state.lap = { ...newLapState(), best: state.lap.best, last: state.lap.last };
  placeOnGrid(slot);
  hud.center(
    `COURSE — ${msg.laps} TOUR${msg.laps > 1 ? "S" : ""}<small>Place sur la grille : P${slot + 1}</small>`,
    2800,
  );
  $("posBox").classList.remove("hidden");
}

function updateRaceStart(now) {
  const r = state.race;
  if (!r || r.phase !== "grid") return;
  if (now >= r.go) {
    r.phase = "racing";
    r.goSim = state.simTime;
    track.lights.set(0);
    hud.center('<span style="color:#22c55e">GO GO GO !</span>', 1500);
    audio.beep(880, 0.6);
    return;
  }
  if (now >= r.t0) {
    const lights = Math.min(5, Math.floor((now - r.t0) / 1000) + 1);
    if (lights !== r.lights) {
      r.lights = lights;
      track.lights.set(lights);
      audio.beep(440, 0.25);
      hud.center(
        `<span style="color:#ef4444;letter-spacing:12px">${"●".repeat(lights)}${"○".repeat(5 - lights)}</span>`,
      );
    }
  }
}

function racePositions() {
  if (!state.race) return null;
  const list = [
    { id: state.myId, d: state.race.finished ? 1e9 - 0 : raceDistance() },
  ];
  for (const r of state.remotes.values()) {
    if (!state.race.grid.includes(r.id) || !r.buf.length) continue;
    list.push({ id: r.id, d: r.buf[r.buf.length - 1].s[5] });
  }
  list.sort((a, b) => b.d - a.d);
  return {
    pos: list.findIndex((x) => x.id === state.myId) + 1,
    total: list.length,
  };
}

// --- Caméra --------------------------------------------------------------------------

const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
let camInit = false;

function updateCamera(dt) {
  const ph = state.phys;
  const fx = Math.sin(ph.heading);
  const fz = Math.cos(ph.heading);
  const v = ph.speed;
  let desired;
  let look;
  if (state.camMode === 2) {
    // Caméra embarquée (T-cam au-dessus du pilote)
    const h = state.car.chassis <= 2 ? 1.75 : 1.25;
    desired = new THREE.Vector3(ph.x - fx * 0.6, h, ph.z - fz * 0.6);
    look = new THREE.Vector3(ph.x + fx * 20, 0.9, ph.z + fz * 20);
    camPos.copy(desired);
    camLook.copy(look);
  } else {
    const dist = (state.camMode === 0 ? 6.2 : 10) + v * 0.02;
    const height = state.camMode === 0 ? 2.2 : 3.6;
    desired = new THREE.Vector3(ph.x - fx * dist, height, ph.z - fz * dist);
    look = new THREE.Vector3(ph.x + fx * 4, 1.0, ph.z + fz * 4);
    const k = camInit ? 1 - Math.exp(-dt * 7) : 1;
    camPos.lerp(desired, k);
    camLook.lerp(look, camInit ? 1 - Math.exp(-dt * 12) : 1);
    camInit = true;
  }
  camera.position.copy(camPos);
  if (
    ph.surface === "gravel" ||
    ph.surface === "grass" ||
    ph.surface === "kerb"
  ) {
    const shake = Math.min(0.06, v * 0.002) * (ph.surface === "kerb" ? 0.5 : 1);
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  camera.lookAt(camLook);
  const targetFov = 62 + Math.min(18, v * 0.18) + (ph.nitroActive ? 6 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
  sunLight.position.set(ph.x + sun.x * 250, sun.y * 250, ph.z + sun.z * 250);
  sunLight.target.position.set(ph.x + fx * 25, 0, ph.z + fz * 25);
}

function updateFlyover(dt) {
  state.flyIdx = (state.flyIdx + dt * 22) % track.n;
  const i = Math.floor(state.flyIdx);
  const p = track.offsetPoint(i, -WALL - 10);
  const t = track.offsetPoint(i + 50, 0);
  camera.position.lerp(new THREE.Vector3(p.x, 14, p.z), camInit ? 0.05 : 1);
  camInit = true;
  camera.lookAt(t.x, 1, t.z);
  camera.fov = 60;
  camera.updateProjectionMatrix();
  sunLight.position.set(p.x + sun.x * 250, sun.y * 250, p.z + sun.z * 250);
  sunLight.target.position.set(t.x, 0, t.z);
}

// --- HUD -------------------------------------------------------------------------------

let hudTimer = 0;
function updateHud(dt, now) {
  hudTimer += dt;
  const ph = state.phys;
  const el = hud.el;
  const kmh = Math.abs(ph.forwardSpeed) * 3.6;
  el.speed.textContent = Math.round(kmh);
  const g = ph.gear();
  el.gear.textContent = g.gear;
  el.rpm.style.width = `${g.rpm * 100}%`;
  const hpPct = (ph.hp / ph.stats.maxHp) * 100;
  el.hp.style.width = `${hpPct}%`;
  el.hp.style.background =
    hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#facc15" : "#ef4444";
  el.nitroRow.classList.toggle("hidden", ph.stats.nitroCap <= 0);
  if (ph.stats.nitroCap > 0)
    el.nitro.style.width = `${(ph.nitro / ph.stats.nitroCap) * 100}%`;
  el.drs.classList.toggle("hidden", !ph.drs);
  const lap = state.lap;
  el.lapTime.textContent = lap.started
    ? fmtTime(state.simTime - lap.start)
    : "0:00.000";
  if (hudTimer < 0.1) return;
  hudTimer = 0;
  el.bestLap.textContent = fmtTime(lap.best);
  el.lastLap.textContent = fmtTime(lap.last);
  if (state.race) {
    el.lapNum.textContent = `${Math.min(state.race.laps, lap.valid + 1)} / ${state.race.laps}`;
    const pos = racePositions();
    if (pos) {
      el.pos.textContent = pos.pos;
      el.posTotal.textContent = pos.total;
    }
  } else {
    el.lapNum.textContent = lap.started ? "Essais libres" : "Passe la ligne";
  }
  // Mauvais sens
  const i = ph.idx;
  const dot =
    Math.sin(ph.heading) * track.tx[i] + Math.cos(ph.heading) * track.tz[i];
  el.wrong.classList.toggle("hidden", !(dot < -0.4 && ph.speed > 4));
  // Mini-carte
  const dots = [
    { x: ph.x, z: ph.z, color: paintColor(state.profile.look), me: true },
  ];
  for (const r of state.remotes.values())
    if (r.cur)
      dots.push({ x: r.cur.x, z: r.cur.z, color: paintColor(r.info.look) });
  hud.drawMap(dots);
}

function renderPlayers() {
  const room = state.room;
  if (!room) return;
  $("roomCode").textContent = room.code;
  $("players").innerHTML = room.players
    .map(
      (p) =>
        `<li><span class="dot" style="background:${paintColor(p.look)}"></span>${escapeHtml(p.name)}${p.id === state.myId ? ' <span class="host">(toi)</span>' : ""}${p.id === room.hostId ? ' <span class="host">★ hôte</span>' : ""}<span class="rating">Voiture ${p.rating}/100</span></li>`,
    )
    .join("");
  const isHost = room.hostId === state.myId;
  $("hostControls").classList.toggle("hidden", !isHost);
  $("startRaceBtn").classList.toggle("hidden", Boolean(room.race));
  $("lapsSelect").classList.toggle("hidden", Boolean(room.race));
  $("cancelRaceBtn").classList.toggle("hidden", !room.race);
}

// --- Réseau ---------------------------------------------------------------------------------

net.on("welcome", (m) => {
  setProfile(m.profile);
  const p = m.profile;
  $("homeProfile").innerHTML =
    `Ton écurie : <b>${fmtMoney(p.money)} €</b> · voiture niveau <b>${carRating(p.upgrades)}/100</b> · ${p.stats.laps} tours bouclés`;
  if (!$("nameInput").value) $("nameInput").value = p.name;
});

net.on("profile", (m) => setProfile(m.profile));

function setProfile(p) {
  state.profile = p;
  $("money").textContent = fmtMoney(p.money);
  if (state.inGame) rebuildMyCar();
  garage.setProfile(p);
  if (state.lap && p.stats.bestLap && state.lap.best === null)
    state.lap.best = p.stats.bestLap;
}

net.on("joined", (m) => {
  state.myId = m.you;
  $("home").classList.add("hidden");
  $("hud").classList.remove("hidden");
  if (!state.inGame) startDriving();
  if (state.profile.stats.bestLap) state.lap.best = state.profile.stats.bestLap;
  hud.toast(`Groupe <b>${m.code}</b> — donne ce code à tes amis !`);
  history.replaceState(null, "", `#${m.code}`);
});

net.on("room", (m) => {
  const first = !state.room;
  state.room = m;
  syncRemotes(m.players);
  renderPlayers();
  if (first && state.phys) placeOnGrid(myGridSlot());
  if (!m.race && state.race && state.race.phase === "grid") state.race = null;
});

net.on("state", (m) => {
  const r = state.remotes.get(m.id);
  if (!r) return;
  r.buf.push({ t: performance.now(), s: m.s });
  if (r.buf.length > 30) r.buf.shift();
});

net.on("left", (m) => {
  const r = state.remotes.get(m.id);
  if (r) {
    r.model?.dispose();
    state.remotes.delete(m.id);
  }
});

net.on("feed", (m) => hud.feed(escapeHtml(m.text)));
net.on("chat", (m) =>
  hud.feed(`<b>${escapeHtml(m.name)}</b> : ${escapeHtml(m.text)}`),
);
net.on("error", (m) => {
  if (!state.inGame) $("homeError").textContent = m.msg;
  else hud.toast(`❌ ${escapeHtml(m.msg)}`);
});

net.on("reward", (m) => {
  const lap = state.lap;
  const extras = [
    m.clean ? "tour propre +20 %" : "",
    m.best ? "record perso !" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  hud.toast(
    `<div class="gain">+${fmtMoney(m.amount)} €</div>Tour en ${fmtTime(lap.last)}${extras ? ` — ${extras}` : ""}`,
  );
  audio.cash();
});

net.on("lapDone", (m) => {
  if (m.id === state.myId) return;
  const p = state.room?.players.find((x) => x.id === m.id);
  if (p)
    hud.feed(
      `<b>${escapeHtml(p.name)}</b> boucle un tour en ${fmtTime(m.time)}${m.best ? " (record perso)" : ""}`,
    );
});

net.on("bought", (m) => {
  garage.onBought(m);
  hud.toast("✅ Achat effectué !");
  audio.cash();
});

net.on("repaired", (m) => {
  state.phys.hp = state.phys.stats.maxHp;
  garage.setHealth({ hp: state.phys.hp, max: state.phys.stats.maxHp });
  hud.toast(`🔧 Voiture réparée (${fmtMoney(m.cost)} €)`);
});

net.on("raceStart", onRaceStart);

net.on("raceResults", (m) => {
  state.race = null;
  track.lights.set(0);
  $("posBox").classList.add("hidden");
  $("resultsBody").innerHTML = m.results
    .map(
      (r) =>
        `<tr><td>${r.pos ? `P${r.pos}` : "Abandon"}</td><td>${escapeHtml(r.name)}${r.id === state.myId ? " (toi)" : ""}</td><td>${r.time ? fmtTime(r.time) : "–"}</td><td>${r.bonus ? `+${fmtMoney(r.bonus)} €` : "–"}</td></tr>`,
    )
    .join("");
  $("results").classList.remove("hidden");
});

net.on("close", (m) => {
  if (!state.inGame) return;
  // On repart d'une page propre en affichant la raison sur l'accueil.
  sessionStorage.setItem("f1gr_msg", m.reason || "Connexion au groupe perdue.");
  location.hash = "";
  location.reload();
});

// --- Boutons -------------------------------------------------------------------------------

function sendHello() {
  const name = $("nameInput").value.trim();
  if (name) localStorage.setItem("f1gr_name", name);
  net.send({ t: "hello", name });
}

$("createBtn").addEventListener("click", () => {
  audio.start();
  $("homeError").textContent = "";
  sendHello();
  net.send({ t: "create" });
});
$("joinBtn").addEventListener("click", () => {
  audio.start();
  const code = $("codeInput").value.trim().toUpperCase();
  if (code.length < 5) {
    $("homeError").textContent = "Entre le code à 5 caractères de ton ami.";
    return;
  }
  $("homeError").textContent = "";
  sendHello();
  net.send({ t: "join", code });
});
$("codeInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("joinBtn").click();
});
$("copyCode").addEventListener("click", () => {
  const code = state.room?.code || "";
  navigator.clipboard?.writeText(code).then(
    () => hud.toast("Code copié !"),
    () => {},
  );
});
$("startRaceBtn").addEventListener("click", () =>
  net.send({ t: "startRace", laps: Number($("lapsSelect").value) }),
);
$("cancelRaceBtn").addEventListener("click", () =>
  net.send({ t: "cancelRace" }),
);
$("garageBtn").addEventListener("click", () => toggleGarage());
$("closeGarage").addEventListener("click", () => toggleGarage());
$("menuBtn").addEventListener("click", () => toggleMenu(true));
$("resumeBtn").addEventListener("click", () => toggleMenu(false));
$("muteBtn").addEventListener("click", () => toggleMute());
$("qualityBtn").addEventListener("click", () => {
  state.quality = state.quality === "high" ? "low" : "high";
  localStorage.setItem("f1gr_quality", state.quality);
  applyQuality();
});
$("leaveBtn").addEventListener("click", () => {
  net.send({ t: "leave" });
  location.hash = "";
  location.reload();
});
$("closeResults").addEventListener("click", () =>
  $("results").classList.add("hidden"),
);

// --- Boucle principale ----------------------------------------------------------------------

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  garage.resize(w, h);
}
window.addEventListener("resize", onResize);

let last = performance.now();
let acc = 0;
let elapsed = 0;

function frame() {
  requestAnimationFrame(frame);
  if (state.freeze) return;
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  elapsed += dt;

  if (garage.isOpen) {
    garage.render(dt, elapsed);
    return;
  }

  if (!state.inGame) {
    updateFlyover(dt);
    renderer.render(scene, camera);
    return;
  }

  updateRaceStart(now);
  const frozen = state.race?.phase === "grid" || state.menuOpen;
  const input = frozen ? NO_INPUT : readInput();
  const ph = state.phys;
  acc += dt;
  let impact = 0;
  while (acc >= STEP) {
    acc -= STEP;
    if (state.race?.phase === "grid") continue;
    const res = ph.step(STEP, input, track);
    state.simTime += STEP;
    updateLap(state.simTime);
    impact = Math.max(impact, res.impact);
    for (const r of state.remotes.values()) {
      if (!r.cur || !r.model?.group.visible) continue;
      const hit = ph.collide(r.cur.x, r.cur.z, r.cur.h, r.vx || 0, r.vz || 0);
      impact = Math.max(impact, hit);
    }
  }
  if (impact > 3) {
    audio.thump(impact);
    state.lap.clean = false;
  }

  // Modèle 3D
  const car = state.car;
  car.group.position.set(ph.x, 0, ph.z);
  car.group.rotation.y = ph.heading;
  car.update(dt, {
    speed: ph.forwardSpeed,
    steer: ph.steer,
    longAcc: ph.longAcc,
    latAcc: ph.latAcc,
    nitro: ph.nitroActive,
    braking: ph.braking,
    drs: ph.drs,
  });

  // Effets : poussière hors-piste, fumée en glisse, fumée moteur si abîmé
  const v = ph.speed;
  const rx = -Math.cos(ph.heading);
  const rz = Math.sin(ph.heading);
  const bx = ph.x - Math.sin(ph.heading) * 1.5;
  const bz = ph.z - Math.cos(ph.heading) * 1.5;
  if (
    (ph.surface === "grass" || ph.surface === "gravel") &&
    v > 3 &&
    Math.random() < 0.6
  ) {
    const side = Math.random() < 0.5 ? -0.8 : 0.8;
    spawnParticle(
      bx + rx * side,
      0.3,
      bz + rz * side,
      ph.surface === "gravel" ? "#c9b38a" : "#8a7a55",
      0.8,
      0,
      1.2,
      0,
      1,
    );
  }
  if (ph.slip > 2.5 && v > 6 && Math.random() < 0.5) {
    const side = Math.random() < 0.5 ? -0.8 : 0.8;
    spawnParticle(
      bx + rx * side,
      0.25,
      bz + rz * side,
      "#e8e8e8",
      0.7,
      0,
      0.8,
      0,
      1.4,
    );
  }
  if (ph.hp < ph.stats.maxHp * 0.3 && Math.random() < 0.3) {
    spawnParticle(ph.x, 0.9, ph.z, "#333333", 0.6, 0, 1.5, 0, 1.6);
  }
  updateParticles(dt);

  updateRemotes(dt, now);
  updateCamera(dt);
  updateHud(dt, now);

  const g = ph.gear();
  audio.update({
    rpm: g.rpm,
    throttle: input.throttle,
    tier: upgradeLevel(state.profile.upgrades, "engine"),
    slip: ph.slip,
    offroad: ph.surface === "grass" || ph.surface === "gravel",
  });

  // Envoi de notre état (20 Hz)
  if (now - state.lastSend > 50) {
    state.lastSend = now;
    const flags =
      (ph.nitroActive ? 1 : 0) | (ph.braking ? 2 : 0) | (ph.drs ? 4 : 0);
    const r2 = (x) => Math.round(x * 100) / 100;
    net.send({
      t: "state",
      s: [
        r2(ph.x),
        r2(ph.z),
        Math.round(ph.heading * 1000) / 1000,
        r2(ph.forwardSpeed),
        r2(ph.steer),
        state.race?.finished ? 1e9 : raceDistance(),
        flags,
        Math.round((ph.hp / ph.stats.maxHp) * 100),
      ],
    });
  }

  renderer.render(scene, camera);
}

// --- Démarrage ------------------------------------------------------------------------------

async function boot() {
  $("loading").classList.add("hidden");
  $("nameInput").value = localStorage.getItem("f1gr_name") || "";
  const hashCode = location.hash.replace("#", "").toUpperCase();
  if (hashCode.length === 5) $("codeInput").value = hashCode;
  onResize();
  if (state.quality !== "high") applyQuality();
  frame();
  try {
    await net.connect();
    net.send({ t: "hello", name: $("nameInput").value.trim() });
  } catch {
    $("homeError").textContent =
      "Le module multijoueur n'a pas pu se charger. Recharge la page.";
  }
  const msg = sessionStorage.getItem("f1gr_msg");
  if (msg) {
    sessionStorage.removeItem("f1gr_msg");
    $("homeError").textContent = msg;
  }
}

boot();

// Accès de débogage depuis la console du navigateur.
window.__f1 = { scene, camera, renderer, state, track, garage };
