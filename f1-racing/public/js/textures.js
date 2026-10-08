// Textures procédurales (canvas) : aucun fichier image à télécharger.
import * as THREE from "three";

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

function toTexture(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function noise(ctx, w, h, amount, alpha, seed = 1) {
  const r = rand(seed);
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
    if (alpha) img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// Asphalte : u = travers de la piste (0..1), v = longueur. Lignes blanches de bord.
export function asphaltTexture() {
  return cached("asphalt", () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = "#3b3d40";
    ctx.fillRect(0, 0, 512, 512);
    noise(ctx, 512, 512, 38, true, 7);
    const r = rand(3);
    // Granulats clairs
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(${150 + r() * 60},${150 + r() * 60},${150 + r() * 60},${0.15 + r() * 0.2})`;
      ctx.fillRect(r() * 512, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    // Trajectoire gommée (plus sombre au centre)
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.35, "rgba(10,10,12,0.18)");
    g.addColorStop(0.5, "rgba(10,10,12,0.28)");
    g.addColorStop(0.65, "rgba(10,10,12,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    // Lignes blanches de bord de piste
    ctx.fillStyle = "#e9e9e4";
    ctx.fillRect(6, 0, 10, 512);
    ctx.fillRect(496, 0, 10, 512);
    return toTexture(c);
  });
}

export function kerbTexture() {
  return cached("kerb", () => {
    const [c, ctx] = canvas(64, 256);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#f1f1f1" : "#d0101a";
      ctx.fillRect(0, i * 64, 64, 64);
    }
    noise(ctx, 64, 256, 18, false, 11);
    return toTexture(c);
  });
}

export function grassTexture() {
  return cached("grass", () => {
    const [c, ctx] = canvas(512, 512);
    ctx.fillStyle = "#3f7a2c";
    ctx.fillRect(0, 0, 512, 512);
    // Bandes de tonte
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(i * 64, 0, 64, 512);
    }
    const r = rand(5);
    for (let i = 0; i < 26000; i++) {
      const v = r();
      ctx.fillStyle = `rgba(${40 + v * 60},${90 + v * 70},${25 + v * 30},0.55)`;
      ctx.fillRect(r() * 512, r() * 512, 1, 2 + r() * 3);
    }
    return toTexture(c);
  });
}

export function gravelTexture() {
  return cached("gravel", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#b9a27a";
    ctx.fillRect(0, 0, 256, 256);
    const r = rand(9);
    for (let i = 0; i < 9000; i++) {
      const v = 120 + r() * 110;
      ctx.fillStyle = `rgb(${v},${v * 0.9},${v * 0.72})`;
      ctx.beginPath();
      ctx.arc(r() * 256, r() * 256, 0.6 + r() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTexture(c);
  });
}

export function concreteTexture() {
  return cached("concrete", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#a9a9a4";
    ctx.fillRect(0, 0, 256, 256);
    noise(ctx, 256, 256, 30, true, 13);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 256, 256);
    return toTexture(c);
  });
}

const BRANDS = [
  ["TURBOFIZZ", "#ffdd00", "#c8102e"],
  ["VELOCIA", "#ffffff", "#0a3d91"],
  ["PNEUS ROCCO", "#111111", "#ffd400"],
  ["ORBITEL", "#ffffff", "#00a37a"],
  ["KRONOS", "#e30613", "#ffffff"],
  ["CARBOTECH", "#00e5ff", "#111111"],
  ["MAXOIL", "#ffffff", "#ff6a00"],
  ["AÉROLINE", "#ffffff", "#6d28d9"],
];

// Bannières publicitaires (marques fictives).
export function adTexture(i) {
  return cached(`ad${i % BRANDS.length}`, () => {
    const [name, fg, bg] = BRANDS[i % BRANDS.length];
    const [c, ctx] = canvas(512, 64);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = fg;
    ctx.font = "italic 900 44px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 256, 34);
    const t = toTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    return t;
  });
}

export function woodTexture(tint = "#9a6a3a") {
  return cached(`wood${tint}`, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 256, 256);
    const r = rand(17);
    // Planches
    for (let y = 0; y < 256; y += 32) {
      const shade = (r() - 0.5) * 40;
      ctx.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 220 : 0},${shade > 0 ? 160 : 0},${Math.abs(shade) / 200})`;
      ctx.fillRect(0, y, 256, 32);
      for (let i = 0; i < 18; i++) {
        ctx.strokeStyle = `rgba(60,30,10,${0.15 + r() * 0.25})`;
        ctx.lineWidth = 0.5 + r();
        ctx.beginPath();
        const yy = y + r() * 32;
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(
          80,
          yy + (r() - 0.5) * 8,
          170,
          yy + (r() - 0.5) * 8,
          256,
          yy + (r() - 0.5) * 6,
        );
        ctx.stroke();
      }
      // Nœuds
      if (r() > 0.4) {
        ctx.fillStyle = "rgba(70,35,10,0.6)";
        ctx.beginPath();
        ctx.ellipse(
          r() * 256,
          y + 16,
          6 + r() * 6,
          3 + r() * 3,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = "rgba(30,15,5,0.8)";
      ctx.fillRect(0, y, 256, 2);
      // Clous
      ctx.fillStyle = "#555";
      for (const x of [12, 244]) {
        ctx.beginPath();
        ctx.arc(x, y + 16, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return toTexture(c);
  });
}

export function carbonTexture() {
  return cached("carbon", () => {
    const [c, ctx] = canvas(64, 64);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const g = ctx.createLinearGradient(x * 8, y * 8, x * 8 + 8, y * 8 + 8);
        const flip = (x + y) % 2;
        g.addColorStop(0, flip ? "#3a3a3f" : "#18181b");
        g.addColorStop(1, flip ? "#1c1c20" : "#2e2e33");
        ctx.fillStyle = g;
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
    return toTexture(c, { repeat: [6, 6] });
  });
}

export function metalTexture() {
  return cached("metal", () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 256, 256);
    noise(ctx, 256, 256, 22, true, 21);
    // Rivets
    ctx.fillStyle = "rgba(80,80,80,0.6)";
    for (let i = 8; i < 256; i += 24) {
      for (const y of [6, 250]) {
        ctx.beginPath();
        ctx.arc(i, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(1, 1, 254, 254);
    return toTexture(c);
  });
}

export function checkerTexture(n = 8) {
  return cached(`checker${n}`, () => {
    const [c, ctx] = canvas(128, 128);
    const s = 128 / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#111" : "#f4f4f4";
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    const t = toTexture(c);
    t.magFilter = THREE.NearestFilter;
    return t;
  });
}

export function fenceTexture() {
  return cached("fence", () => {
    const [c, ctx] = canvas(64, 64);
    ctx.strokeStyle = "rgba(200,200,200,0.9)";
    ctx.lineWidth = 1.5;
    for (let i = -64; i < 128; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 64, 64);
      ctx.moveTo(i + 64, 0);
      ctx.lineTo(i, 64);
      ctx.stroke();
    }
    const t = toTexture(c);
    return t;
  });
}

// Visage style "bloc" pour les avatars.
export function faceTexture(face) {
  return cached(`face${face}`, () => {
    const [c, ctx] = canvas(128, 128);
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = "#111";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    const eye = (x, y) => {
      ctx.beginPath();
      ctx.ellipse(x, y, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    if (face === "cool") {
      ctx.fillRect(22, 38, 36, 20);
      ctx.fillRect(70, 38, 36, 20);
      ctx.fillRect(56, 42, 16, 5);
      ctx.beginPath();
      ctx.arc(64, 74, 22, 0.15 * Math.PI, 0.6 * Math.PI);
      ctx.stroke();
    } else if (face === "determine") {
      eye(44, 52);
      eye(84, 52);
      ctx.beginPath();
      ctx.moveTo(30, 34);
      ctx.lineTo(56, 42);
      ctx.moveTo(98, 34);
      ctx.lineTo(72, 42);
      ctx.moveTo(46, 90);
      ctx.lineTo(82, 90);
      ctx.stroke();
    } else if (face === "surpris") {
      eye(44, 50);
      eye(84, 50);
      ctx.beginPath();
      ctx.ellipse(64, 90, 10, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (face === "clin") {
      eye(44, 52);
      ctx.beginPath();
      ctx.moveTo(74, 54);
      ctx.lineTo(96, 54);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(64, 72, 24, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      eye(44, 52);
      eye(84, 52);
      ctx.beginPath();
      ctx.arc(64, 70, 26, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function numberTexture(num, bg = "#ffffff", fg = "#111111") {
  return cached(`num${num}${bg}${fg}`, () => {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = "italic 900 70px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

// Motifs de livrée appliqués sur des panneaux latéraux (fond transparent).
export function liveryTexture(kind, color) {
  return cached(`liv${kind}${color}`, () => {
    const [c, ctx] = canvas(256, 64);
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = color;
    if (kind === "flammes") {
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const y = 8 + i * 9;
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(90 + i * 12, y - 10, 150 + (i % 3) * 30, y + 2);
        ctx.quadraticCurveTo(100, y + 6, 0, y + 8);
        ctx.fill();
      }
    } else if (kind === "eclair") {
      ctx.beginPath();
      ctx.moveTo(10, 20);
      ctx.lineTo(120, 26);
      ctx.lineTo(110, 36);
      ctx.lineTo(246, 30);
      ctx.lineTo(130, 46);
      ctx.lineTo(140, 36);
      ctx.lineTo(10, 40);
      ctx.fill();
    } else if (kind === "damier") {
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 16; x++)
          if ((x + y) % 2) ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function smokeTexture() {
  return cached("smoke", () => {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  });
}
