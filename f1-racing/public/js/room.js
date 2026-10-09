// Groupe de jeu. Il tourne dans le navigateur de l'hôte (celui qui a créé le
// groupe) et relaie les positions, gère les courses et les primes.
import {
  MAX_PLAYERS,
  RACE_FINISH_BONUS,
  PAINTS,
  LIVERIES,
  HATS,
  FACES,
  AVATAR_COLORS,
  UPGRADES,
  upgradeLevel,
  carRating,
} from "/shared/catalog.js";
import { cleanName } from "./profile.js";

// Les infos viennent d'autres navigateurs : on ne garde que des valeurs connues.
function sanitizeInfo(info) {
  const i = info && typeof info === "object" ? info : {};
  const look = i.look || {};
  const avatar = i.avatar || {};
  const pick = (list, id, def) => (list.some((x) => x.id === id) ? id : def);
  const color = (c, def) => (AVATAR_COLORS.includes(c) ? c : def);
  const upgrades = {};
  for (const u of UPGRADES) upgrades[u.id] = upgradeLevel(i.upgrades, u.id);
  const best = Number(i.bestLap);
  return {
    name: cleanName(i.name),
    look: {
      paint: pick(PAINTS, look.paint, "bois"),
      accent: pick(PAINTS, look.accent, "bois"),
      livery: pick(LIVERIES, look.livery, "aucune"),
      number: Math.min(99, Math.max(1, Math.floor(Number(look.number)) || 7)),
    },
    avatar: {
      skin: color(avatar.skin, "#f5cd30"),
      shirt: color(avatar.shirt, "#1d4fd8"),
      pants: color(avatar.pants, "#1e3a5f"),
      hat: pick(HATS, avatar.hat, "aucun"),
      face: pick(FACES, avatar.face, "sourire"),
    },
    upgrades,
    rating: carRating(upgrades),
    bestLap: best > 0 ? best : null,
  };
}

export class HostRoom {
  constructor(code) {
    this.code = code;
    this.clients = [];
    this.hostId = 1;
    this.race = null;
    this.nextId = 1;
  }

  // `send` envoie un message à ce joueur. Renvoie le client, ou null si complet.
  add(send, info) {
    if (this.clients.length >= MAX_PLAYERS) {
      send({ t: "error", msg: "Le groupe est complet (4 pilotes max)." });
      return null;
    }
    const c = { id: this.nextId++, send, info: sanitizeInfo(info) };
    this.clients.push(c);
    c.send({ t: "joined", code: this.code, you: c.id });
    this.broadcast(this.roomInfo());
    this.broadcast(
      { t: "feed", text: `${c.info.name} a rejoint le groupe !` },
      c,
    );
    return c;
  }

  remove(c) {
    if (!this.clients.includes(c)) return;
    this.clients = this.clients.filter((x) => x !== c);
    if (this.clients.length === 0) {
      clearTimeout(this.race?.timer);
      return;
    }
    if (this.hostId === c.id) this.hostId = this.clients[0].id;
    this.broadcast({ t: "left", id: c.id });
    this.broadcast({ t: "feed", text: `${c.info.name} a quitté le groupe.` });
    if (this.race) this.maybeEndRace();
    this.broadcast(this.roomInfo());
  }

  broadcast(msg, except = null) {
    for (const c of this.clients) if (c !== except) c.send(msg);
  }

  roomInfo() {
    return {
      t: "room",
      code: this.code,
      hostId: this.hostId,
      players: this.clients.map((c) => ({ id: c.id, ...c.info })),
      race: this.race
        ? { laps: this.race.laps, grid: this.race.grid, state: "running" }
        : null,
    };
  }

  startRace(laps) {
    const grid = this.clients.map((c) => c.id);
    for (let i = grid.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [grid[i], grid[j]] = [grid[j], grid[i]];
    }
    this.race = { laps, grid, finishers: [], timer: null };
    const hold = 200 + Math.floor(Math.random() * 1300);
    this.broadcast({ t: "raceStart", laps, grid, delay: 3000, hold });
    this.broadcast(this.roomInfo());
    this.race.timer = setTimeout(
      () => this.endRace(),
      laps * 5 * 60 * 1000 + 15000,
    );
  }

  maybeEndRace() {
    const race = this.race;
    if (!race) return;
    const active = race.grid.filter((id) =>
      this.clients.some((c) => c.id === id),
    );
    const finished = race.finishers.map((f) => f.id);
    if (active.every((id) => finished.includes(id))) this.endRace();
  }

  endRace() {
    const race = this.race;
    if (!race) return;
    clearTimeout(race.timer);
    this.race = null;
    const competitors = race.grid.length;
    const results = race.finishers.map((f, i) => {
      const bonus =
        competitors > 1
          ? Math.round(
              (RACE_FINISH_BONUS[i] ?? 0) * (competitors / MAX_PLAYERS + 0.25),
            )
          : 300;
      const c = this.clients.find((x) => x.id === f.id);
      if (c)
        c.send({ t: "bonus", amount: bonus, won: i === 0 && competitors > 1 });
      return { id: f.id, name: f.name, time: f.time, pos: i + 1, bonus };
    });
    for (const id of race.grid) {
      if (results.some((r) => r.id === id)) continue;
      const c = this.clients.find((x) => x.id === id);
      if (c) {
        results.push({
          id,
          name: c.info.name,
          time: null,
          pos: null,
          bonus: 0,
        });
      }
    }
    this.broadcast({ t: "raceResults", results });
    this.broadcast(this.roomInfo());
  }

  handle(c, msg) {
    if (!msg || typeof msg.t !== "string" || !this.clients.includes(c)) return;
    switch (msg.t) {
      case "state": {
        const s = msg.s;
        if (!Array.isArray(s) || s.length > 16) return;
        if (!s.every((v) => typeof v === "number" && Number.isFinite(v)))
          return;
        this.broadcast({ t: "state", id: c.id, s }, c);
        return;
      }
      case "info":
        c.info = sanitizeInfo(msg.info);
        this.broadcast(this.roomInfo());
        return;
      case "lapDone": {
        const time = Number(msg.time);
        if (!(time > 0)) return;
        this.broadcast(
          { t: "lapDone", id: c.id, time, best: Boolean(msg.best) },
          c,
        );
        return;
      }
      case "finish": {
        const race = this.race;
        if (!race || !race.grid.includes(c.id)) return;
        if (race.finishers.some((f) => f.id === c.id)) return;
        race.finishers.push({
          id: c.id,
          name: c.info.name,
          time: Number(msg.time) || 0,
        });
        this.broadcast({
          t: "feed",
          text: `🏁 ${c.info.name} termine P${race.finishers.length} !`,
        });
        if (race.finishers.length === 1) {
          clearTimeout(race.timer);
          race.timer = setTimeout(() => this.endRace(), 45000);
        }
        this.maybeEndRace();
        return;
      }
      case "startRace":
        if (this.hostId !== c.id || this.race) return;
        this.startRace([1, 3, 5, 10].includes(msg.laps) ? msg.laps : 3);
        return;
      case "cancelRace":
        if (this.hostId !== c.id || !this.race) return;
        this.broadcast({ t: "feed", text: "Course annulée par l'hôte." });
        this.endRace();
        return;
      case "chat": {
        const text = String(msg.text || "")
          .slice(0, 140)
          .trim();
        if (text) this.broadcast({ t: "chat", name: c.info.name, text });
        return;
      }
      default:
    }
  }
}
