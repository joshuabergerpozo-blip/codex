// Catalogue partagé entre le serveur (validation des achats / gains) et le
// client (affichage du garage, calcul des performances de la voiture).

export const MAX_PLAYERS = 4;
export const START_MONEY = 500;
export const LAP_REWARD = 400;
export const CLEAN_LAP_BONUS = 0.2;
export const BEST_LAP_BONUS = 200;
export const RACE_LAP_MULT = 1.5;
export const RACE_FINISH_BONUS = [3000, 1800, 1000, 500];
export const MIN_LAP_SECONDS = 18;
export const REPAIR_COST_PER_HP = 4;

// Chaque catégorie de performance est une suite de niveaux à acheter dans
// l'ordre. Le niveau 0 est la pièce d'origine (gratuite, et nulle).
export const UPGRADES = [
  {
    id: "chassis",
    name: "Châssis",
    icon: "🪵",
    desc: "La structure de la voiture : poids, solidité et aérodynamisme.",
    levels: [
      { name: "Caisse en bois pourri", price: 0, mass: 950, hp: 0, drag: 0.9 },
      { name: "Contreplaqué verni", price: 600, mass: 900, hp: 10, drag: 0.92 },
      {
        name: "Tôle d'acier rivetée",
        price: 2500,
        mass: 880,
        hp: 30,
        drag: 0.94,
      },
      { name: "Aluminium embouti", price: 7500, mass: 800, hp: 40, drag: 0.96 },
      { name: "Fibre de verre", price: 18000, mass: 720, hp: 50, drag: 0.99 },
      {
        name: "Composite carbone",
        price: 40000,
        mass: 640,
        hp: 70,
        drag: 1.02,
      },
      {
        name: "Monocoque F1 carbone",
        price: 85000,
        mass: 560,
        hp: 90,
        drag: 1.05,
      },
    ],
  },
  {
    id: "engine",
    name: "Moteur",
    icon: "⚙️",
    desc: "Puissance et vitesse de pointe.",
    levels: [
      { name: "Moteur de tondeuse", price: 0, top: 85, power: 1.6 },
      { name: "Mobylette 50cc", price: 300, top: 92, power: 2.0 },
      { name: "4 cylindres 1.2L", price: 1200, top: 120, power: 2.6 },
      { name: "4 cylindres turbo", price: 3500, top: 150, power: 3.2 },
      { name: "V6 3.0L", price: 8000, top: 180, power: 3.9 },
      { name: "V8 4.0L", price: 16000, top: 210, power: 4.6 },
      { name: "V10 3.0L", price: 32000, top: 245, power: 5.4 },
      { name: "V12 6.0L", price: 55000, top: 272, power: 6.1 },
      { name: "V6 Turbo Hybride F1", price: 100000, top: 300, power: 7.0 },
    ],
  },
  {
    id: "gearbox",
    name: "Boîte de vitesses",
    icon: "🕹️",
    desc: "Multiplie l'accélération.",
    levels: [
      { name: "Boîte 3 vitesses rouillée", price: 0, mult: 1.0, gears: 3 },
      { name: "Boîte 4 vitesses", price: 500, mult: 1.07, gears: 4 },
      { name: "Boîte 5 vitesses", price: 2000, mult: 1.14, gears: 5 },
      { name: "Boîte 6 vitesses sport", price: 6000, mult: 1.22, gears: 6 },
      { name: "Séquentielle 7 rapports", price: 15000, mult: 1.32, gears: 7 },
      { name: "Palettes F1 8 rapports", price: 35000, mult: 1.45, gears: 8 },
    ],
  },
  {
    id: "tires",
    name: "Pneus",
    icon: "🛞",
    desc: "Adhérence en virage et motricité.",
    levels: [
      { name: "Roues de charrette en bois", price: 0, grip: 0.75 },
      { name: "Pneus de vélo", price: 250, grip: 0.85 },
      { name: "Pneus de citadine", price: 900, grip: 0.95 },
      { name: "Pneus sport", price: 3000, grip: 1.08 },
      { name: "Semi-slicks", price: 8000, grip: 1.2 },
      { name: "Slicks durs", price: 18000, grip: 1.32 },
      { name: "Slicks médiums", price: 30000, grip: 1.42 },
      { name: "Slicks tendres F1", price: 50000, grip: 1.55 },
    ],
  },
  {
    id: "rims",
    name: "Jantes",
    icon: "⭕",
    desc: "Plus légères = plus vives.",
    levels: [
      { name: "Disques en bois", price: 0, mass: 0 },
      { name: "Jantes acier", price: 400, mass: 8 },
      { name: "Jantes alliage", price: 1500, mass: 15 },
      { name: "Alliage forgé", price: 5000, mass: 22 },
      { name: "Magnésium", price: 12000, mass: 28 },
      { name: "Carbone", price: 25000, mass: 35 },
    ],
  },
  {
    id: "brakes",
    name: "Freins",
    icon: "🛑",
    desc: "Puissance de freinage.",
    levels: [
      { name: "Patin en bois", price: 0, decel: 5 },
      { name: "Freins à tambour", price: 350, decel: 8 },
      { name: "Disques pleins", price: 1500, decel: 11 },
      { name: "Disques ventilés", price: 5000, decel: 15 },
      { name: "Étriers 6 pistons", price: 12000, decel: 20 },
      { name: "Carbone-céramique", price: 25000, decel: 26 },
      { name: "Carbone F1", price: 45000, decel: 32 },
    ],
  },
  {
    id: "suspension",
    name: "Suspension",
    icon: "🔩",
    desc: "Tenue de route et précision de direction.",
    levels: [
      { name: "Planches clouées", price: 0, grip: 0.85, steer: 0.85 },
      { name: "Ressorts de matelas", price: 300, grip: 0.9, steer: 0.9 },
      { name: "Amortisseurs basiques", price: 1200, grip: 0.96, steer: 0.96 },
      { name: "Suspension sport", price: 4000, grip: 1.02, steer: 1.03 },
      { name: "Combinés filetés", price: 10000, grip: 1.08, steer: 1.08 },
      { name: "Push-rod de course", price: 22000, grip: 1.14, steer: 1.12 },
      { name: "Pull-rod F1 active", price: 45000, grip: 1.2, steer: 1.16 },
    ],
  },
  {
    id: "frontWing",
    name: "Aileron avant",
    icon: "🔺",
    desc: "Appui aérodynamique : plus de grip à haute vitesse.",
    levels: [
      { name: "Aucun", price: 0, df: 0 },
      { name: "Planche vissée", price: 400, df: 0.0002 },
      { name: "Lame en tôle", price: 1800, df: 0.0005 },
      { name: "Aileron simple", price: 6000, df: 0.0009 },
      { name: "Double plan", price: 15000, df: 0.0013 },
      { name: "Multi-éléments F1", price: 35000, df: 0.0018 },
    ],
  },
  {
    id: "rearWing",
    name: "Aileron arrière",
    icon: "🔻",
    desc: "Appui arrière. Le dernier niveau débloque le DRS (touche E).",
    levels: [
      { name: "Aucun", price: 0, df: 0 },
      { name: "Planche sur bâtons", price: 500, df: 0.0002 },
      { name: "Becquet en tôle", price: 2000, df: 0.0005 },
      { name: "Aileron GT", price: 7000, df: 0.0009 },
      { name: "Aileron double plan", price: 17000, df: 0.0013 },
      { name: "Aileron F1 + DRS", price: 40000, df: 0.0018, drs: true },
    ],
  },
  {
    id: "armor",
    name: "Renforcement",
    icon: "🛡️",
    desc: "Réduit les dégâts lors des chocs.",
    levels: [
      { name: "Aucun", price: 0, reduce: 0, hp: 0 },
      { name: "Planches clouées", price: 300, reduce: 0.15, hp: 10 },
      { name: "Plaques d'acier", price: 1500, reduce: 0.3, hp: 25 },
      { name: "Arceau de sécurité", price: 5000, reduce: 0.45, hp: 40 },
      { name: "Cellule de survie", price: 14000, reduce: 0.6, hp: 60 },
      { name: "Halo + cellule F1", price: 32000, reduce: 0.75, hp: 80 },
    ],
  },
  {
    id: "lightening",
    name: "Allègement",
    icon: "🪶",
    desc: "Retire du poids : meilleure accélération.",
    levels: [
      { name: "Aucun", price: 0, mass: 0 },
      { name: "Retirer la banquette", price: 200, mass: 20 },
      { name: "Vitres en plexiglas", price: 1000, mass: 40 },
      { name: "Panneaux allégés", price: 4000, mass: 60 },
      { name: "Câblage optimisé", price: 10000, mass: 80 },
      { name: "Allègement extrême", price: 24000, mass: 110 },
    ],
  },
  {
    id: "nitro",
    name: "Nitro (Speed)",
    icon: "🔥",
    desc: "Boost de vitesse (touche Maj). Se recharge à chaque tour.",
    levels: [
      { name: "Aucun", price: 0, cap: 0, boost: 1 },
      { name: "Bouteille de camping-gaz", price: 800, cap: 2, boost: 1.12 },
      { name: "Kit nitro de rue", price: 3500, cap: 3, boost: 1.16 },
      { name: "Double bouteille", price: 9000, cap: 4.5, boost: 1.2 },
      { name: "Nitro de compétition", price: 20000, cap: 6, boost: 1.25 },
      { name: "Injection NOS Pro", price: 42000, cap: 8, boost: 1.3 },
    ],
  },
  {
    id: "ers",
    name: "Système hybride (ERS)",
    icon: "⚡",
    desc: "Recharge la nitro en roulant et au freinage.",
    levels: [
      { name: "Aucun", price: 0, regen: 0 },
      { name: "Dynamo de vélo", price: 1500, regen: 0.04 },
      { name: "KERS basique", price: 6000, regen: 0.08 },
      { name: "ERS-K", price: 15000, regen: 0.13 },
      { name: "ERS-K + ERS-H F1", price: 35000, regen: 0.2 },
    ],
  },
  {
    id: "exhaust",
    name: "Échappement",
    icon: "💨",
    desc: "Un peu plus de vitesse de pointe (et de bruit).",
    levels: [
      { name: "Pot de tondeuse", price: 0, top: 0 },
      { name: "Pot sport", price: 400, top: 0.02 },
      { name: "Ligne inox", price: 2500, top: 0.035 },
      { name: "Échappement titane", price: 9000, top: 0.05 },
      { name: "Échappement F1", price: 20000, top: 0.065 },
    ],
  },
  {
    id: "steering",
    name: "Volant",
    icon: "🎯",
    desc: "Direction plus réactive.",
    levels: [
      { name: "Barre de bateau", price: 0, steer: 0.9 },
      { name: "Volant de citadine", price: 200, steer: 1.0 },
      { name: "Volant sport", price: 1500, steer: 1.06 },
      { name: "Volant de rallye", price: 5000, steer: 1.12 },
      { name: "Volant F1 à palettes", price: 15000, steer: 1.2 },
    ],
  },
  {
    id: "sponsors",
    name: "Sponsors",
    icon: "💼",
    desc: "Multiplie l'argent gagné à chaque tour.",
    levels: [
      { name: "Aucun sponsor", price: 0, income: 1 },
      { name: "Boulangerie du village", price: 500, income: 1.2 },
      { name: "Garage du coin", price: 2500, income: 1.45 },
      { name: "Marque de soda", price: 8000, income: 1.75 },
      { name: "Opérateur télécom", price: 20000, income: 2.1 },
      { name: "Constructeur automobile", price: 45000, income: 2.5 },
      { name: "Géant de la tech", price: 90000, income: 3.0 },
    ],
  },
  {
    id: "pitCrew",
    name: "Équipe des stands",
    icon: "🧰",
    desc: "Réparations moins chères et auto-réparation en roulant.",
    levels: [
      { name: "Toi tout seul", price: 0, discount: 0, autoRepair: 0 },
      { name: "Ton cousin", price: 300, discount: 0.15, autoRepair: 0.1 },
      {
        name: "Mécano du village",
        price: 1500,
        discount: 0.3,
        autoRepair: 0.25,
      },
      { name: "Équipe de 4", price: 6000, discount: 0.5, autoRepair: 0.5 },
      { name: "Équipe pro", price: 16000, discount: 0.7, autoRepair: 1 },
      { name: "Crew F1", price: 38000, discount: 0.85, autoRepair: 2 },
    ],
  },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

// --- Cosmétiques -----------------------------------------------------------

export const PAINTS = [
  {
    id: "bois",
    name: "Brut (matériau d'origine)",
    color: "#ffffff",
    price: 0,
    metal: 0,
    rough: 0.9,
  },
  {
    id: "rouge",
    name: "Rouge",
    color: "#d01818",
    price: 150,
    metal: 0.1,
    rough: 0.5,
  },
  {
    id: "bleu",
    name: "Bleu",
    color: "#1d4fd8",
    price: 150,
    metal: 0.1,
    rough: 0.5,
  },
  {
    id: "vert",
    name: "Vert",
    color: "#1e9e3a",
    price: 150,
    metal: 0.1,
    rough: 0.5,
  },
  {
    id: "jaune",
    name: "Jaune",
    color: "#f5c814",
    price: 150,
    metal: 0.1,
    rough: 0.5,
  },
  {
    id: "noir",
    name: "Noir",
    color: "#141414",
    price: 200,
    metal: 0.1,
    rough: 0.45,
  },
  {
    id: "blanc",
    name: "Blanc",
    color: "#f2f2f2",
    price: 200,
    metal: 0.1,
    rough: 0.45,
  },
  {
    id: "orange",
    name: "Orange papaye",
    color: "#ff7a00",
    price: 250,
    metal: 0.1,
    rough: 0.45,
  },
  {
    id: "violet",
    name: "Violet",
    color: "#6d28d9",
    price: 250,
    metal: 0.1,
    rough: 0.45,
  },
  {
    id: "rose",
    name: "Rose",
    color: "#ec4899",
    price: 250,
    metal: 0.1,
    rough: 0.45,
  },
  {
    id: "cyan",
    name: "Cyan",
    color: "#06b6d4",
    price: 250,
    metal: 0.1,
    rough: 0.45,
  },
  {
    id: "rouge-course",
    name: "Rouge course métallisé",
    color: "#b0000f",
    price: 1500,
    metal: 0.6,
    rough: 0.25,
  },
  {
    id: "bleu-nuit",
    name: "Bleu nuit métallisé",
    color: "#0b1f4d",
    price: 1500,
    metal: 0.6,
    rough: 0.25,
  },
  {
    id: "vert-anglais",
    name: "Vert anglais",
    color: "#0f3d2a",
    price: 1500,
    metal: 0.5,
    rough: 0.3,
  },
  {
    id: "argent",
    name: "Argent flèche",
    color: "#c8ccd2",
    price: 2500,
    metal: 0.85,
    rough: 0.2,
  },
  {
    id: "noir-mat",
    name: "Noir mat",
    color: "#1b1b1d",
    price: 3000,
    metal: 0.2,
    rough: 0.85,
  },
  {
    id: "carbone",
    name: "Carbone nu",
    color: "#2a2a2e",
    price: 8000,
    metal: 0.3,
    rough: 0.35,
    carbon: true,
  },
  {
    id: "chrome",
    name: "Chrome miroir",
    color: "#e8e8e8",
    price: 15000,
    metal: 1,
    rough: 0.05,
  },
  {
    id: "or",
    name: "Or 24 carats",
    color: "#e3b23c",
    price: 40000,
    metal: 1,
    rough: 0.15,
  },
];

export const LIVERIES = [
  { id: "aucune", name: "Aucune", price: 0 },
  { id: "bande", name: "Bande centrale", price: 500 },
  { id: "double", name: "Double bande", price: 900 },
  { id: "flancs", name: "Flancs bicolores", price: 1500 },
  { id: "damier", name: "Damier", price: 4000 },
  { id: "flammes", name: "Flammes", price: 6000 },
  { id: "eclair", name: "Éclair", price: 8000 },
];

export const HATS = [
  { id: "aucun", name: "Rien", price: 0 },
  { id: "casquette", name: "Casquette", price: 0 },
  { id: "casque", name: "Casque classique", price: 300 },
  { id: "paille", name: "Chapeau de paille", price: 500 },
  { id: "integral", name: "Casque intégral", price: 1200 },
  { id: "haut-de-forme", name: "Haut-de-forme", price: 2500 },
  { id: "viking", name: "Casque viking", price: 4000 },
  { id: "casque-f1", name: "Casque F1", price: 6000 },
  { id: "couronne", name: "Couronne royale", price: 50000 },
];

export const FACES = [
  { id: "sourire", name: "Sourire" },
  { id: "cool", name: "Lunettes cool" },
  { id: "determine", name: "Déterminé" },
  { id: "surpris", name: "Surpris" },
  { id: "clin", name: "Clin d'œil" },
];

export const AVATAR_COLORS = [
  "#f5cd30",
  "#ffcc99",
  "#e0a875",
  "#c68642",
  "#8d5524",
  "#5a3a22",
  "#d01818",
  "#1d4fd8",
  "#1e9e3a",
  "#141414",
  "#f2f2f2",
  "#ff7a00",
  "#6d28d9",
  "#ec4899",
  "#06b6d4",
  "#7a7a7a",
];

export function defaultProfile(name) {
  const upgrades = {};
  for (const u of UPGRADES) upgrades[u.id] = 0;
  return {
    name,
    money: START_MONEY,
    upgrades,
    owned: {
      paints: ["bois"],
      liveries: ["aucune"],
      hats: ["aucun", "casquette"],
    },
    look: { paint: "bois", accent: "bois", livery: "aucune", number: 7 },
    avatar: {
      skin: "#f5cd30",
      shirt: "#1d4fd8",
      pants: "#1e3a5f",
      hat: "casquette",
      face: "sourire",
    },
    stats: { laps: 0, bestLap: null, races: 0, wins: 0, earned: 0 },
  };
}

export function upgradeLevel(upgrades, id) {
  const max = UPGRADE_BY_ID[id].levels.length - 1;
  const lvl = Number(upgrades?.[id] ?? 0);
  return Math.max(0, Math.min(max, Number.isFinite(lvl) ? Math.floor(lvl) : 0));
}

function lv(upgrades, id) {
  return UPGRADE_BY_ID[id].levels[upgradeLevel(upgrades, id)];
}

// Calcule les performances physiques à partir des niveaux achetés.
export function computeStats(upgrades) {
  const chassis = lv(upgrades, "chassis");
  const engine = lv(upgrades, "engine");
  const gearbox = lv(upgrades, "gearbox");
  const tires = lv(upgrades, "tires");
  const rims = lv(upgrades, "rims");
  const brakes = lv(upgrades, "brakes");
  const susp = lv(upgrades, "suspension");
  const fw = lv(upgrades, "frontWing");
  const rw = lv(upgrades, "rearWing");
  const armor = lv(upgrades, "armor");
  const light = lv(upgrades, "lightening");
  const nitro = lv(upgrades, "nitro");
  const ers = lv(upgrades, "ers");
  const exhaust = lv(upgrades, "exhaust");
  const steering = lv(upgrades, "steering");
  const sponsors = lv(upgrades, "sponsors");
  const crew = lv(upgrades, "pitCrew");

  const mass = chassis.mass - rims.mass - light.mass;
  const massFactor = Math.sqrt(800 / mass);
  const topKmh = engine.top * chassis.drag * (1 + exhaust.top);
  const grip = tires.grip * susp.grip;
  return {
    mass,
    topSpeed: topKmh / 3.6,
    topKmh,
    accel: engine.power * gearbox.mult * 1.4 * massFactor,
    gears: gearbox.gears,
    grip, // en g
    downforce: fw.df + rw.df,
    brake: brakes.decel,
    steer: susp.steer * steering.steer,
    maxHp: 100 + chassis.hp + armor.hp,
    damageReduce: armor.reduce,
    nitroCap: nitro.cap,
    nitroBoost: nitro.boost,
    nitroRegen: ers.regen,
    drs: Boolean(rw.drs),
    income: sponsors.income,
    repairDiscount: crew.discount,
    autoRepair: crew.autoRepair,
  };
}

// Score global (0-100) pour afficher le "niveau" de la voiture.
export function carRating(upgrades) {
  let total = 0;
  let max = 0;
  for (const u of UPGRADES) {
    if (u.id === "sponsors" || u.id === "pitCrew") continue;
    total += upgradeLevel(upgrades, u.id);
    max += u.levels.length - 1;
  }
  return Math.round((total / max) * 100);
}

export function lapReward(
  upgrades,
  { clean = false, race = false, best = false } = {},
) {
  const s = computeStats(upgrades);
  let r = LAP_REWARD * s.income;
  if (clean) r *= 1 + CLEAN_LAP_BONUS;
  if (race) r *= RACE_LAP_MULT;
  if (best) r += BEST_LAP_BONUS;
  return Math.round(r);
}

export function repairCost(upgrades, missingHp) {
  const s = computeStats(upgrades);
  return Math.ceil(
    Math.max(0, missingHp) * REPAIR_COST_PER_HP * (1 - s.repairDiscount),
  );
}

export function totalCatalogValue() {
  let total = 0;
  for (const u of UPGRADES) for (const l of u.levels) total += l.price;
  for (const list of [PAINTS, LIVERIES, HATS])
    for (const i of list) total += i.price;
  return total;
}
