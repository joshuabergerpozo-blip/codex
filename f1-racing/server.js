// Serveur du jeu : fichiers statiques + WebSocket (groupes de 4 joueurs max).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import {
  MAX_PLAYERS,
  UPGRADE_BY_ID,
  PAINTS,
  LIVERIES,
  HATS,
  FACES,
  AVATAR_COLORS,
  MIN_LAP_SECONDS,
  RACE_FINISH_BONUS,
  defaultProfile,
  upgradeLevel,
  lapReward,
  repairCost,
  carRating,
} from "./shared/catalog.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(ROOT, "data");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

// --- Fichiers statiques ------------------------------------------------------

const MOUNTS = [
  ["/vendor/three/", path.join(ROOT, "node_modules", "three")],
  ["/shared/", path.join(ROOT, "shared")],
  ["/", path.join(ROOT, "public")],
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";
  for (const [prefix, dir] of MOUNTS) {
    if (!urlPath.startsWith(prefix)) continue;
    const file = path.normalize(path.join(dir, urlPath.slice(prefix.length)));
    if (!file.startsWith(dir + path.sep)) break;
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Introuvable");
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(file).pipe(res);
    });
    return;
  }
  res.writeHead(404).end();
}

// --- Profils (sauvegarde des écuries) --------------------------------------

const profiles = new Map();
try {
  const raw = JSON.parse(fs.readFileSync(PROFILES_FILE, "utf8"));
  for (const [token, p] of Object.entries(raw)) profiles.set(token, p);
  console.log(`${profiles.size} écurie(s) chargée(s).`);
} catch {
  // Pas encore de sauvegarde.
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${PROFILES_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(profiles)));
    fs.renameSync(tmp, PROFILES_FILE);
  }, 2000);
}

function cleanName(name) {
  const n = String(name ?? "")
    .replace(/[^\p{L}\p{N} _\-.]/gu, "")
    .trim()
    .slice(0, 16);
  return n || `Pilote${Math.floor(Math.random() * 900 + 100)}`;
}

function normalizeProfile(p, name) {
  const base = defaultProfile(name);
  const out = { ...base, ...p };
  out.upgrades = { ...base.upgrades, ...(p.upgrades || {}) };
  out.owned = { ...base.owned, ...(p.owned || {}) };
  out.look = { ...base.look, ...(p.look || {}) };
  out.avatar = { ...base.avatar, ...(p.avatar || {}) };
  out.stats = { ...base.stats, ...(p.stats || {}) };
  return out;
}

// --- Groupes -----------------------------------------------------------------

const rooms = new Map();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  for (;;) {
    let c = "";
    for (let i = 0; i < 5; i++)
      c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, except = null) {
  const data = JSON.stringify(msg);
  for (const c of room.clients)
    if (c !== except && c.ws.readyState === 1) c.ws.send(data);
}

function publicPlayer(c) {
  return {
    id: c.id,
    name: c.profile.name,
    look: c.profile.look,
    avatar: c.profile.avatar,
    upgrades: c.profile.upgrades,
    rating: carRating(c.profile.upgrades),
    bestLap: c.profile.stats.bestLap,
  };
}

function roomInfo(room) {
  return {
    t: "room",
    code: room.code,
    hostId: room.hostId,
    players: room.clients.map(publicPlayer),
    race: room.race
      ? { laps: room.race.laps, grid: room.race.grid, state: room.race.state }
      : null,
  };
}

function leaveRoom(c) {
  const room = c.room;
  if (!room) return;
  room.clients = room.clients.filter((x) => x !== c);
  c.room = null;
  if (room.clients.length === 0) {
    clearTimeout(room.race?.timer);
    rooms.delete(room.code);
    return;
  }
  if (room.hostId === c.id) room.hostId = room.clients[0].id;
  broadcast(room, { t: "left", id: c.id });
  broadcast(room, { t: "feed", text: `${c.profile.name} a quitté le groupe.` });
  if (room.race) maybeEndRace(room);
  broadcast(room, roomInfo(room));
}

function joinRoom(c, room) {
  if (c.room) leaveRoom(c);
  room.clients.push(c);
  c.room = room;
  send(c.ws, { t: "joined", code: room.code, you: c.id });
  broadcast(room, roomInfo(room));
  broadcast(
    room,
    { t: "feed", text: `${c.profile.name} a rejoint le groupe !` },
    c,
  );
}

// --- Courses -----------------------------------------------------------------

function startRace(room, laps) {
  const grid = room.clients.map((c) => c.id);
  // Grille aléatoire pour que l'hôte ne parte pas toujours en pole.
  for (let i = grid.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  room.race = { laps, grid, state: "running", finishers: [], timer: null };
  broadcast(room, {
    t: "raceStart",
    laps,
    grid,
    delay: 3000,
    hold: 200 + crypto.randomInt(1300),
  });
  broadcast(room, roomInfo(room));
  room.race.timer = setTimeout(
    () => endRace(room),
    laps * 5 * 60 * 1000 + 15000,
  );
}

function maybeEndRace(room) {
  const race = room.race;
  if (!race) return;
  const active = race.grid.filter((id) =>
    room.clients.some((c) => c.id === id),
  );
  const finished = race.finishers.map((f) => f.id);
  if (active.length === 0 || active.every((id) => finished.includes(id))) {
    endRace(room);
  }
}

function endRace(room) {
  const race = room.race;
  if (!race) return;
  clearTimeout(race.timer);
  room.race = null;
  const results = [];
  const competitors = race.grid.length;
  race.finishers.forEach((f, i) => {
    const c = room.clients.find((x) => x.id === f.id);
    const bonus =
      competitors > 1
        ? Math.round(
            (RACE_FINISH_BONUS[i] ?? 0) * (competitors / MAX_PLAYERS + 0.25),
          )
        : 300;
    if (c) {
      c.profile.money += bonus;
      c.profile.stats.races += 1;
      c.profile.stats.earned += bonus;
      if (i === 0 && competitors > 1) c.profile.stats.wins += 1;
      send(c.ws, { t: "profile", profile: c.profile });
    }
    results.push({ id: f.id, name: f.name, time: f.time, pos: i + 1, bonus });
  });
  for (const id of race.grid) {
    if (results.some((r) => r.id === id)) continue;
    const c = room.clients.find((x) => x.id === id);
    if (c)
      results.push({
        id,
        name: c.profile.name,
        time: null,
        pos: null,
        bonus: 0,
      });
  }
  scheduleSave();
  broadcast(room, { t: "raceResults", results });
  broadcast(room, roomInfo(room));
}

// --- Messages ------------------------------------------------------------------

function ownedOrFree(list, ownedIds, id) {
  const item = list.find((x) => x.id === id);
  return item && (item.price === 0 || ownedIds.includes(id));
}

function handle(c, msg) {
  const p = c.profile;
  switch (msg.t) {
    case "hello": {
      let token = typeof msg.token === "string" ? msg.token : "";
      if (!profiles.has(token)) {
        token = crypto.randomBytes(18).toString("hex");
        profiles.set(token, defaultProfile(cleanName(msg.name)));
      }
      const prof = normalizeProfile(profiles.get(token), cleanName(msg.name));
      if (msg.name) prof.name = cleanName(msg.name);
      profiles.set(token, prof);
      c.token = token;
      c.profile = prof;
      scheduleSave();
      send(c.ws, { t: "welcome", token, profile: prof });
      return;
    }
    case "create": {
      if (!p) return;
      const room = { code: newCode(), clients: [], hostId: c.id, race: null };
      rooms.set(room.code, room);
      joinRoom(c, room);
      return;
    }
    case "join": {
      if (!p) return;
      const code = String(msg.code || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const room = rooms.get(code);
      if (!room)
        return send(c.ws, { t: "error", msg: "Aucun groupe avec ce code." });
      if (room.clients.length >= MAX_PLAYERS)
        return send(c.ws, {
          t: "error",
          msg: "Le groupe est complet (4 pilotes max).",
        });
      joinRoom(c, room);
      return;
    }
    case "leave":
      leaveRoom(c);
      return;
    case "state": {
      if (!c.room) return;
      const s = msg.s;
      if (!Array.isArray(s) || s.length > 16) return;
      broadcast(c.room, { t: "state", id: c.id, s }, c);
      return;
    }
    case "lap": {
      if (!p) return;
      const now = Date.now();
      const time = Number(msg.time);
      if (
        !(time >= MIN_LAP_SECONDS) ||
        now - (c.lastLapAt || 0) < MIN_LAP_SECONDS * 1000
      )
        return;
      c.lastLapAt = now;
      const inRace = Boolean(c.room?.race && c.room.race.grid.includes(c.id));
      const best = p.stats.bestLap === null || time < p.stats.bestLap;
      const reward = lapReward(p.upgrades, {
        clean: Boolean(msg.clean),
        race: inRace,
        best,
      });
      p.money += reward;
      p.stats.laps += 1;
      p.stats.earned += reward;
      if (best) p.stats.bestLap = Math.round(time * 1000) / 1000;
      scheduleSave();
      send(c.ws, { t: "profile", profile: p });
      send(c.ws, {
        t: "reward",
        amount: reward,
        best,
        clean: Boolean(msg.clean),
      });
      if (c.room) {
        broadcast(c.room, { t: "lapDone", id: c.id, time, best });
        if (best) broadcast(c.room, roomInfo(c.room));
      }
      return;
    }
    case "finish": {
      const room = c.room;
      if (!room?.race || !room.race.grid.includes(c.id)) return;
      if (room.race.finishers.some((f) => f.id === c.id)) return;
      room.race.finishers.push({
        id: c.id,
        name: p.name,
        time: Number(msg.time) || 0,
      });
      broadcast(room, {
        t: "feed",
        text: `🏁 ${p.name} termine P${room.race.finishers.length} !`,
      });
      if (room.race.finishers.length === 1) {
        clearTimeout(room.race.timer);
        room.race.timer = setTimeout(() => endRace(room), 45000);
      }
      maybeEndRace(room);
      return;
    }
    case "startRace": {
      const room = c.room;
      if (!room || room.hostId !== c.id || room.race) return;
      const laps = [1, 3, 5, 10].includes(msg.laps) ? msg.laps : 3;
      startRace(room, laps);
      return;
    }
    case "cancelRace": {
      const room = c.room;
      if (!room || room.hostId !== c.id || !room.race) return;
      broadcast(room, { t: "feed", text: "Course annulée par l'hôte." });
      endRace(room);
      return;
    }
    case "buy": {
      if (!p) return;
      let price = null;
      if (msg.kind === "upgrade") {
        const u = UPGRADE_BY_ID[msg.id];
        if (!u) return;
        const next = upgradeLevel(p.upgrades, u.id) + 1;
        if (next >= u.levels.length)
          return send(c.ws, { t: "error", msg: "Déjà au niveau maximum." });
        price = u.levels[next].price;
        if (p.money < price)
          return send(c.ws, { t: "error", msg: "Pas assez d'argent." });
        p.money -= price;
        p.upgrades[u.id] = next;
      } else {
        const lists = {
          paint: [PAINTS, "paints"],
          livery: [LIVERIES, "liveries"],
          hat: [HATS, "hats"],
        };
        const entry = lists[msg.kind];
        if (!entry) return;
        const [list, key] = entry;
        const item = list.find((x) => x.id === msg.id);
        if (!item) return;
        if (p.owned[key].includes(item.id)) return;
        if (p.money < item.price)
          return send(c.ws, { t: "error", msg: "Pas assez d'argent." });
        p.money -= item.price;
        p.owned[key].push(item.id);
        price = item.price;
      }
      scheduleSave();
      send(c.ws, { t: "profile", profile: p });
      send(c.ws, { t: "bought", kind: msg.kind, id: msg.id, price });
      if (c.room) broadcast(c.room, roomInfo(c.room));
      return;
    }
    case "customize": {
      if (!p) return;
      const look = msg.look || {};
      const av = msg.avatar || {};
      if (ownedOrFree(PAINTS, p.owned.paints, look.paint))
        p.look.paint = look.paint;
      if (ownedOrFree(PAINTS, p.owned.paints, look.accent))
        p.look.accent = look.accent;
      if (ownedOrFree(LIVERIES, p.owned.liveries, look.livery))
        p.look.livery = look.livery;
      const num = Math.floor(Number(look.number));
      if (num >= 1 && num <= 99) p.look.number = num;
      for (const k of ["skin", "shirt", "pants"])
        if (AVATAR_COLORS.includes(av[k])) p.avatar[k] = av[k];
      if (ownedOrFree(HATS, p.owned.hats, av.hat)) p.avatar.hat = av.hat;
      if (FACES.some((f) => f.id === av.face)) p.avatar.face = av.face;
      if (typeof msg.name === "string" && msg.name.trim())
        p.name = cleanName(msg.name);
      scheduleSave();
      send(c.ws, { t: "profile", profile: p });
      if (c.room) broadcast(c.room, roomInfo(c.room));
      return;
    }
    case "repair": {
      if (!p) return;
      const missing = Math.max(0, Math.min(400, Number(msg.missing) || 0));
      const cost = repairCost(p.upgrades, missing);
      if (p.money < cost)
        return send(c.ws, {
          t: "error",
          msg: "Pas assez d'argent pour réparer.",
        });
      p.money -= cost;
      scheduleSave();
      send(c.ws, { t: "profile", profile: p });
      send(c.ws, { t: "repaired", cost });
      return;
    }
    case "chat": {
      if (!c.room || !p) return;
      const text = String(msg.text || "")
        .slice(0, 140)
        .trim();
      if (text) broadcast(c.room, { t: "chat", name: p.name, text });
      return;
    }
    default:
  }
}

// --- Démarrage -----------------------------------------------------------------

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 16 * 1024 });
let nextId = 1;

wss.on("connection", (ws) => {
  const c = {
    id: nextId++,
    ws,
    profile: null,
    room: null,
    token: null,
    lastLapAt: 0,
  };
  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg && typeof msg.t === "string") handle(c, msg);
  });
  ws.on("close", () => leaveRoom(c));
});

server.listen(PORT, () => {
  console.log(`🏎️  F1 Garage Racing en ligne sur http://localhost:${PORT}`);
});
