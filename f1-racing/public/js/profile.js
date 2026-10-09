// Écurie du joueur (argent, pièces, peinture, personnage), sauvegardée dans le
// navigateur. Toute l'économie du jeu est calculée ici.
import {
  UPGRADE_BY_ID,
  PAINTS,
  LIVERIES,
  HATS,
  FACES,
  AVATAR_COLORS,
  MIN_LAP_SECONDS,
  defaultProfile,
  upgradeLevel,
  lapReward,
  repairCost,
  carRating,
} from "/shared/catalog.js";

const KEY = "f1gr_profile";

export function cleanName(name) {
  const n = String(name ?? "")
    .replace(/[^\p{L}\p{N} _\-.]/gu, "")
    .trim()
    .slice(0, 16);
  return n || `Pilote${Math.floor(Math.random() * 900 + 100)}`;
}

function normalize(p, name) {
  const base = defaultProfile(name);
  const out = { ...base, ...p };
  out.upgrades = { ...base.upgrades, ...(p.upgrades || {}) };
  out.owned = { ...base.owned, ...(p.owned || {}) };
  out.look = { ...base.look, ...(p.look || {}) };
  out.avatar = { ...base.avatar, ...(p.avatar || {}) };
  out.stats = { ...base.stats, ...(p.stats || {}) };
  return out;
}

function ownedOrFree(list, ownedIds, id) {
  const item = list.find((x) => x.id === id);
  return item && (item.price === 0 || ownedIds.includes(id));
}

// Infos publiques envoyées aux autres joueurs du groupe.
export function publicInfo(p) {
  return {
    name: p.name,
    look: p.look,
    avatar: p.avatar,
    upgrades: p.upgrades,
    rating: carRating(p.upgrades),
    bestLap: p.stats.bestLap,
  };
}

export class ProfileStore {
  constructor() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY));
    } catch {
      saved = null;
    }
    this.p = normalize(saved || {}, cleanName(saved?.name));
    this.lastLapAt = 0;
    this.save();
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.p));
    } catch {
      // Stockage indisponible (navigation privée) : la partie n'est pas sauvegardée.
    }
  }

  setName(name) {
    if (name && name.trim()) this.p.name = cleanName(name);
    this.save();
  }

  // Renvoie { reward, best } ou null si le tour est refusé.
  lap(time, clean, inRace) {
    const now = Date.now();
    if (!(time >= MIN_LAP_SECONDS)) return null;
    if (now - this.lastLapAt < MIN_LAP_SECONDS * 1000) return null;
    this.lastLapAt = now;
    const p = this.p;
    const best = p.stats.bestLap === null || time < p.stats.bestLap;
    const reward = lapReward(p.upgrades, { clean, race: inRace, best });
    p.money += reward;
    p.stats.laps += 1;
    p.stats.earned += reward;
    if (best) p.stats.bestLap = Math.round(time * 1000) / 1000;
    this.save();
    return { reward, best };
  }

  addRaceBonus(amount, won) {
    const p = this.p;
    p.money += amount;
    p.stats.earned += amount;
    p.stats.races += 1;
    if (won) p.stats.wins += 1;
    this.save();
  }

  // Renvoie un message d'erreur, ou null si l'achat a réussi.
  buy(kind, id) {
    const p = this.p;
    if (kind === "upgrade") {
      const u = UPGRADE_BY_ID[id];
      if (!u) return "Pièce inconnue.";
      const next = upgradeLevel(p.upgrades, u.id) + 1;
      if (next >= u.levels.length) return "Déjà au niveau maximum.";
      const price = u.levels[next].price;
      if (p.money < price) return "Pas assez d'argent.";
      p.money -= price;
      p.upgrades[u.id] = next;
    } else {
      const lists = {
        paint: [PAINTS, "paints"],
        livery: [LIVERIES, "liveries"],
        hat: [HATS, "hats"],
      };
      const entry = lists[kind];
      if (!entry) return "Article inconnu.";
      const [list, key] = entry;
      const item = list.find((x) => x.id === id);
      if (!item) return "Article inconnu.";
      if (p.owned[key].includes(item.id)) return "Déjà acheté.";
      if (p.money < item.price) return "Pas assez d'argent.";
      p.money -= item.price;
      p.owned[key].push(item.id);
    }
    this.save();
    return null;
  }

  customize({ look = {}, avatar = {}, name }) {
    const p = this.p;
    if (ownedOrFree(PAINTS, p.owned.paints, look.paint))
      p.look.paint = look.paint;
    if (ownedOrFree(PAINTS, p.owned.paints, look.accent))
      p.look.accent = look.accent;
    if (ownedOrFree(LIVERIES, p.owned.liveries, look.livery))
      p.look.livery = look.livery;
    const num = Math.floor(Number(look.number));
    if (num >= 1 && num <= 99) p.look.number = num;
    for (const k of ["skin", "shirt", "pants"]) {
      if (AVATAR_COLORS.includes(avatar[k])) p.avatar[k] = avatar[k];
    }
    if (ownedOrFree(HATS, p.owned.hats, avatar.hat)) p.avatar.hat = avatar.hat;
    if (FACES.some((f) => f.id === avatar.face)) p.avatar.face = avatar.face;
    if (typeof name === "string" && name.trim()) p.name = cleanName(name);
    this.save();
  }

  // Renvoie le coût payé, ou null si pas assez d'argent.
  repair(missing) {
    const hp = Math.max(0, Math.min(400, Number(missing) || 0));
    const cost = repairCost(this.p.upgrades, hp);
    if (this.p.money < cost) return null;
    this.p.money -= cost;
    this.save();
    return cost;
  }
}
