// Interface en course : compteurs, mini-carte, notifications.
const $ = (id) => document.getElementById(id);

export function fmtTime(sec) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "–";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function fmtMoney(n) {
  return Math.round(n).toLocaleString("fr-FR");
}

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export class Hud {
  constructor(track) {
    this.track = track;
    this.map = $("minimap");
    this.mctx = this.map.getContext("2d");
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < track.n; i++) {
      minX = Math.min(minX, track.x[i]);
      maxX = Math.max(maxX, track.x[i]);
      minZ = Math.min(minZ, track.z[i]);
      maxZ = Math.max(maxZ, track.z[i]);
    }
    const size = this.map.width;
    const pad = 16;
    const scale = (size - pad * 2) / Math.max(maxX - minX, maxZ - minZ);
    const offX = pad + (size - pad * 2 - (maxX - minX) * scale) / 2;
    const offZ = pad + (size - pad * 2 - (maxZ - minZ) * scale) / 2;
    // Vue de dessus (X vers la droite, Z vers le bas).
    this.project = (x, z) => [
      offX + (x - minX) * scale,
      offZ + (z - minZ) * scale,
    ];
    this.el = {
      lapNum: $("lapNum"),
      lapTime: $("lapTime"),
      bestLap: $("bestLap"),
      lastLap: $("lastLap"),
      speed: $("speed"),
      gear: $("gear"),
      rpm: $("rpmBar"),
      hp: $("hpBar"),
      nitro: $("nitroBar"),
      nitroRow: $("nitroRow"),
      drs: $("drsTag"),
      money: $("money"),
      pos: $("pos"),
      posTotal: $("posTotal"),
      posBox: $("posBox"),
      center: $("center-msg"),
      wrong: $("wrongWay"),
      feed: $("feed"),
      toasts: $("toasts"),
    };
  }

  drawMap(dots) {
    const ctx = this.mctx;
    const t = this.track;
    const size = this.map.width;
    ctx.clearRect(0, 0, size, size);
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= t.n; i += 4) {
      const [x, y] = this.project(t.x[i % t.n], t.z[i % t.n]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 3;
    ctx.stroke();
    // Ligne de départ
    const [sx, sy] = this.project(t.x[0], t.z[0]);
    ctx.fillStyle = "#e10600";
    ctx.fillRect(sx - 3, sy - 6, 6, 12);
    for (const d of dots) {
      const [x, y] = this.project(d.x, d.z);
      ctx.beginPath();
      ctx.arc(x, y, d.me ? 6 : 5, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = d.me ? "#facc15" : "#000";
      ctx.stroke();
    }
  }

  center(html, ms = 0) {
    this.el.center.innerHTML = html;
    clearTimeout(this.centerTimer);
    if (ms)
      this.centerTimer = setTimeout(() => (this.el.center.innerHTML = ""), ms);
  }

  feed(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    this.el.feed.appendChild(d);
    while (this.el.feed.children.length > 7) this.el.feed.firstChild.remove();
    setTimeout(() => d.remove(), 8000);
  }

  toast(html, cls = "") {
    const d = document.createElement("div");
    d.className = `toast ${cls}`;
    d.innerHTML = html;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 3500);
  }
}
