/* Lueur — moteur de motion design.
   Tout est dessiné sur un <canvas> 2D à partir d'une fonction pure du temps :
   render(ctx, W, H, t, template, valeurs, palette). Aucune dépendance, aucune clé API. */
(function () {
  const MS = (window.MS = window.MS || {});

  MS.FONTS = {
    unbounded: '"Unbounded", "Arial Black", sans-serif',
    bricolage: '"Bricolage Grotesque", "Arial Narrow", Arial, sans-serif',
    serif: '"Instrument Serif", Georgia, serif',
    fraunces: '"Fraunces", Georgia, serif',
    hanken: '"Hanken Grotesk", Arial, sans-serif',
    mono: '"Space Mono", ui-monospace, Menlo, monospace',
  };
  MS.FONT_LOADS = [
    '800 40px "Unbounded"', '800 40px "Bricolage Grotesque"', '500 40px "Bricolage Grotesque"',
    '400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"',
    '600 40px "Fraunces"', 'italic 400 40px "Fraunces"',
    '300 40px "Hanken Grotesk"', '500 40px "Hanken Grotesk"', '700 40px "Hanken Grotesk"',
    '700 40px "Space Mono"',
  ];
  MS.FORMATS = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080], '16:9': [1920, 1080] };

  // ---------- math ----------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    lin: k => k,
    outCubic: k => 1 - Math.pow(1 - k, 3),
    inCubic: k => k * k * k,
    inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    outExpo: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)),
    inOutExpo: k => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2),
    outBack: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
    outElastic: k => (k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    outBounce: k => {
      const n = 7.5625, d = 2.75;
      if (k < 1 / d) return n * k * k;
      if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
      if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
      return n * (k -= 2.625 / d) * k + 0.984375;
    },
  };
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex2rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = [...h].map(x => x + x).join('');
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = (h, a) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };
  function mix(h1, h2, k) {
    const a = hex2rgb(h1), b = hex2rgb(h2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, '0')).join('');
  }
  Object.assign(MS, { clamp, prog, lerp, E, rng, rgba, mix, hex2rgb });

  // ---------- context ----------
  function col(c, key, a = 1) {
    const h = (c.p && c.p[key]) || key || '#000000';
    return a >= 1 ? h : rgba(h, a);
  }
  function makeCtx(ctx, W, H, t, tpl, vals, pal) {
    const u = Math.min(W, H) / 1080;
    const c = { ctx, W, H, t, u, tpl, p: pal || tpl.p, ty: MS.TYPES[tpl.type] || MS.TYPES.bold, v: vals || {}, portrait: H > W * 1.05 };
    c.fill = s => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (_, k) => (c.v[k] != null ? c.v[k] : ''));
    return c;
  }

  // ---------- text ----------
  function runs(text) {
    const out = []; let it = false, cur = '';
    for (const ch of String(text)) {
      if (ch === '*') { if (cur) out.push({ s: cur, it }); cur = ''; it = !it; } else cur += ch;
    }
    if (cur) out.push({ s: cur, it });
    return out;
  }
  const strip = s => String(s).replace(/\*/g, '');

  // head style: display face for plain runs, italic serif for *runs*
  function headSpec(c, s) {
    const ty = c.ty;
    return {
      fam: MS.FONTS[(s && s.font) || ty.head], w: (s && s.weight) || ty.w,
      itFam: MS.FONTS[ty.italic || 'serif'], itW: ty.itW || 400,
      upper: s && s.upper != null ? s.upper : ty.upper, track: ty.track || 0, itScale: ty.itScale || 1.12,
    };
  }
  function bodySpec(c, s, weight) {
    return {
      fam: MS.FONTS[(s && s.font) || c.ty.body], w: weight || (s && s.weight) || c.ty.bw || 500,
      itFam: MS.FONTS.serif, itW: 400, upper: !!(s && s.upper), track: (s && s.track) || 0, itScale: 1.15,
    };
  }
  function layout(c, text, F, sp) {
    const { ctx } = c; const parts = []; let x = 0;
    for (const r of runs(text)) {
      const str = !r.it && sp.upper ? r.s.toUpperCase() : r.s;
      const font = r.it ? `italic ${sp.itW} ${F * sp.itScale}px ${sp.itFam}` : `${sp.w} ${F}px ${sp.fam}`;
      const track = r.it ? 0 : sp.track * F;
      ctx.font = font; ctx.letterSpacing = `${track}px`;
      const w = ctx.measureText(str).width;
      parts.push({ s: str, font, track, x, w });
      x += w;
    }
    ctx.letterSpacing = '0px';
    return { parts, w: x };
  }
  function drawLay(c, lay, x, y) {
    const { ctx } = c;
    for (const p of lay.parts) { ctx.font = p.font; ctx.letterSpacing = `${p.track}px`; ctx.fillText(p.s, x + p.x, y); }
    ctx.letterSpacing = '0px';
  }
  function chars(c, lay) {
    const { ctx } = c; const out = [];
    for (const p of lay.parts) {
      ctx.font = p.font; ctx.letterSpacing = `${p.track}px`;
      let x = p.x;
      for (const ch of p.s) { const w = ctx.measureText(ch).width; out.push({ ch, font: p.font, track: p.track, x, w }); x += w; }
    }
    ctx.letterSpacing = '0px';
    return out;
  }
  function fitSize(c, lines, sp, maxW, maxF) {
    let w = 1;
    for (const l of lines) w = Math.max(w, layout(c, l, 100, sp).w);
    return Math.max(8, Math.min(maxF, (maxW / w) * 100));
  }
  // word wrap that keeps *italic* runs balanced across lines
  function wrapRich(c, text, F, sp, maxW, balance = true) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const measure = s => layout(c, s, F, sp).w;
    const go = limit => {
      const lines = []; let cur = '';
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (cur && measure(fixStars(next)) > limit) { lines.push(cur); cur = w; } else cur = next;
      }
      if (cur) lines.push(cur);
      return lines;
    };
    let lines = go(maxW);
    if (balance && lines.length > 1) {
      const total = measure(strip(text));
      const alt = go(Math.min(maxW, (total / lines.length) * 1.15));
      if (alt.length === lines.length) lines = alt;
    }
    // carry an open *italic* across the break
    let open = false;
    return lines.map(l => {
      let s = (open ? '*' : '') + l;
      const n = (s.match(/\*/g) || []).length;
      if (n % 2) { s += '*'; open = true; } else open = false;
      return s;
    });
  }
  const fixStars = s => ((s.match(/\*/g) || []).length % 2 ? s + '*' : s);

  // numbers that count up: keeps prefix, suffix and French formatting
  function countText(raw, k) {
    const m = String(raw).match(/\d[\d\s  .,]*\d|\d/);
    if (!m) return raw;
    const src = m[0];
    const grouped = /[\s  ]/.test(src) || /\.\d{3}(?!\d)/.test(src);
    let num = src.replace(/[\s  ]/g, '');
    let dec = 0;
    if (/,\d+$/.test(num)) { dec = num.split(',')[1].length; num = num.replace(/\./g, '').replace(',', '.'); }
    else if (/\.\d{1,2}$/.test(num) && !grouped) { dec = num.split('.')[1].length; }
    else num = num.replace(/[.,]/g, '');
    const v = parseFloat(num) * k;
    const out = v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grouped });
    return raw.replace(src, out.replace(/ /g, ' '));
  }
  const numOf = raw => { const m = String(raw).replace(/[\s  ]/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };

  // ---------- shapes ----------
  function circle(ctx, x, y, r, fill) { if (r <= 0) return; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), Math.max(0, Math.min(r, h / 2, w / 2))); }
  function star(ctx, cx, cy, ro, ri, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, r = i % 2 ? ri : ro; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    ctx.closePath();
  }
  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.05, x - s * 0.5, y + s * 0.28);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.58, x, y + s * 0.75, x, y + s * 0.95);
    ctx.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.58, x + s * 0.5, y + s * 0.28);
    ctx.bezierCurveTo(x + s * 0.5, y - s * 0.05, x, y, x, y + s * 0.3);
    ctx.closePath();
  }
  function arrow(ctx, x, y, len, head, lw, color) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x + len - head, y - head); ctx.lineTo(x + len, y); ctx.lineTo(x + len - head, y + head); ctx.stroke();
  }
  function cursor(ctx, x, y, s, fill, stroke) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 34); ctx.lineTo(8, 26); ctx.lineTo(14, 40); ctx.lineTo(20, 37); ctx.lineTo(14, 24); ctx.lineTo(25, 24); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = stroke; ctx.stroke(); ctx.restore();
  }
  function alpha(ctx, a, fn) { if (a <= 0.001) return; ctx.save(); ctx.globalAlpha *= clamp(a); fn(); ctx.restore(); }

  // ---------- images ----------
  MS.IMG = MS.IMG || {};
  MS.loadImages = function (map) {
    return Promise.all(Object.entries(map).map(([k, src]) => new Promise(res => {
      const im = new Image();
      im.onload = () => { MS.IMG[k] = im; res(); };
      im.onerror = () => res();
      im.src = src;
    })));
  };
  function cover(ctx, im, W, H, zoom, px, py) {
    const s = Math.max(W / im.width, H / im.height) * zoom;
    const w = im.width * s, h = im.height * s;
    ctx.drawImage(im, (W - w) * px, (H - h) * py, w, h);
  }

  let grainCanvas = null;
  function grain(c, amount) {
    if (!grainCanvas) {
      grainCanvas = document.createElement('canvas'); grainCanvas.width = grainCanvas.height = 256;
      const g = grainCanvas.getContext('2d'), d = g.createImageData(256, 256), r = rng(9);
      for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0);
    }
    const { ctx, W, H, t } = c; const f = Math.floor(t * 24), r = rng(f + 1);
    ctx.save(); ctx.globalAlpha = amount; ctx.globalCompositeOperation = 'overlay';
    const s = Math.max(1, c.u * 1.5);
    ctx.translate(-r() * 256 * s, -r() * 256 * s); ctx.scale(s, s);
    ctx.fillStyle = ctx.createPattern(grainCanvas, 'repeat'); ctx.fillRect(0, 0, W / s + 512, H / s + 512);
    ctx.restore();
  }
  function vignette(c, a) {
    const { ctx, W, H } = c;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- backgrounds ----------
  const BG = {
    solid(c) { c.ctx.fillStyle = col(c, 'bg'); c.ctx.fillRect(0, 0, c.W, c.H); },
    mesh(c) {
      const { ctx, W, H, t } = c; BG.solid(c);
      const R = Math.max(W, H) * 0.75;
      [['accent', 0.55, 0.3, 0.2, 0.9], ['soft', 0.7, 0.8, 0.75, 0.6], ['accent', 0.35, 0.15, 0.9, 1.3]].forEach(([k, a, x, y, sp], i) => {
        const cx = W * (x + 0.18 * Math.sin(t * 0.35 * sp + i)), cy = H * (y + 0.12 * Math.cos(t * 0.3 * sp + i * 2));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, col(c, k, a)); g.addColorStop(1, col(c, k, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });
    },
    grid(c) {
      const { ctx, W, H, t, u } = c; BG.solid(c);
      const s = 90 * u, o = (t * 18 * u) % s;
      ctx.strokeStyle = col(c, 'ink', 0.08); ctx.lineWidth = 2 * u; ctx.beginPath();
      for (let x = -s + o; x < W + s; x += s) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = -s + o; y < H + s; y += s) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    },
    dots(c) {
      const { ctx, W, H, t, u } = c; BG.solid(c);
      const s = 56 * u, o = (t * 10 * u) % s; ctx.fillStyle = col(c, 'ink', 0.13);
      for (let x = -s + o; x < W + s; x += s) for (let y = -s + o; y < H + s; y += s) { ctx.beginPath(); ctx.arc(x, y, 3.2 * u, 0, 7); ctx.fill(); }
    },
    stripes(c) {
      const { ctx, W, H, t, u } = c; BG.solid(c);
      const s = 90 * u, o = (t * 40 * u) % (s * 2);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 4); ctx.fillStyle = col(c, 'soft', 0.35);
      const L = Math.hypot(W, H);
      for (let x = -L + o; x < L; x += s * 2) ctx.fillRect(x, -L, s, L * 2);
      ctx.restore();
    },
    rays(c) {
      const { ctx, W, H, t } = c; BG.solid(c);
      const n = 24, L = Math.hypot(W, H);
      ctx.save(); ctx.translate(W / 2, H * (c.tpl.bg.y || 0.5)); ctx.rotate(t * 0.08); ctx.fillStyle = col(c, 'soft', 0.4);
      for (let i = 0; i < n; i += 2) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * L, Math.sin(a) * L); ctx.lineTo(Math.cos(b) * L, Math.sin(b) * L); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    },
    sky(c) {
      const { ctx, W, H, t, u } = c;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, mix(col(c, 'soft'), '#ffffff', 0.15)); g.addColorStop(0.55, col(c, 'bg')); g.addColorStop(1, mix(col(c, 'accent'), '#ffffff', 0.35));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const sun = ctx.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, Math.min(W, H) * 0.5);
      sun.addColorStop(0, 'rgba(255,245,240,0.75)'); sun.addColorStop(1, 'rgba(255,245,240,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
      const r = rng(4);
      for (let i = 0; i < 9; i++) {
        const y = H * (0.12 + r() * 0.8), w = (380 + r() * 520) * u, h = w * (0.22 + r() * 0.12);
        const x = ((r() * (W + w) + t * (12 + r() * 20) * u) % (W + w * 2)) - w;
        const cg = ctx.createRadialGradient(x, y, 0, x, y, w / 2);
        cg.addColorStop(0, 'rgba(255,255,255,0.5)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save(); ctx.translate(x, y); ctx.scale(1, h / w); ctx.translate(-x, -y); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, w / 2, 0, 7); ctx.fill(); ctx.restore();
      }
    },
    aurora(c) {
      const { ctx, W, H, t, u } = c; BG.solid(c);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ['accent', 'soft', 'accent'].forEach((k, i) => {
        ctx.beginPath();
        for (let x = -50; x <= W + 50; x += 20 * u) {
          const y = H * (0.3 + i * 0.18) + Math.sin(x / (W * 0.25) + t * (0.5 + i * 0.2) + i) * H * 0.08 + Math.sin(x / (W * 0.1) - t * 0.7) * H * 0.02;
          x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineWidth = H * (0.12 - i * 0.02); ctx.strokeStyle = col(c, k, 0.18); ctx.stroke();
        ctx.lineWidth = H * 0.03; ctx.strokeStyle = col(c, k, 0.22); ctx.stroke();
      });
      ctx.restore();
    },
    image(c) {
      const { ctx, W, H, t, tpl } = c; const b = tpl.bg; const im = MS.IMG[b.src];
      if (!im) { BG.sky(c); return; }
      const k = t / (tpl.dur || 8);
      cover(ctx, im, W, H, lerp(1.04, b.zoom || 1.14, k), lerp(0.5, b.px != null ? b.px : 0.46, k), lerp(0.5, b.py != null ? b.py : 0.5, k));
      if (b.tint) { ctx.fillStyle = col(c, b.tintColor || 'ink', b.tint); ctx.fillRect(0, 0, W, H); }
      if (b.fade) { const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, col(c, 'ink', 0)); g.addColorStop(1, col(c, 'ink', b.fade)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    },
    paper(c) {
      const { ctx, W, H, u } = c; BG.solid(c);
      ctx.strokeStyle = col(c, 'ink', 0.06); ctx.lineWidth = 2 * u; ctx.beginPath();
      for (let y = 60 * u; y < H; y += 56 * u) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.strokeStyle = col(c, 'accent', 0.35); ctx.beginPath(); ctx.moveTo(W * 0.06, 0); ctx.lineTo(W * 0.06, H); ctx.stroke();
    },
  };
  MS.BG = BG;

  // ---------- scenes ----------
  // every scene receives c (with c.lt = local time, c.d = scene length) and its props s
  const SC = {};
  const outK = (c, s, d = 0.4) => (s.out === 'none' ? 0 : prog(c.lt, c.d - d, c.d));

  SC.title = (c, s) => {
    const { ctx, W, H, u } = c;
    const lines = (s.lines || []).map(c.fill).filter(x => strip(x).trim());
    if (!lines.length) return;
    const sp = headSpec(c, s);
    const F = fitSize(c, lines, sp, W * (s.w || 0.84), (s.size || 1) * Math.min(190 * u, H * 0.14));
    const LH = F * (s.lh || 1.08);
    const top = H * (s.y != null ? s.y : 0.5) - (LH * lines.length) / 2;
    const style = s.style || 'rise', st = s.stagger != null ? s.stagger : 0.12, inD = s.inDur || 0.9;
    const ko = outK(c, s);
    const counts = lines.map(l => [...strip(l)].length);
    lines.forEach((ln, i) => {
      const lay = layout(c, ln, F, sp);
      const align = s.align || 'center';
      const x0 = align === 'left' ? W * 0.08 : align === 'right' ? W * 0.92 - lay.w : (W - lay.w) / 2;
      const base = top + i * LH + F * 0.8;
      const colors = s.colors || [s.color || 'ink'];
      ctx.fillStyle = col(c, colors[i % colors.length]);
      const kin = prog(c.lt, (s.delay || 0) + i * st, (s.delay || 0) + i * st + inD);
      if (style === 'rise') {
        ctx.save(); ctx.beginPath(); ctx.rect(0, top + i * LH - F * 0.22, W, LH + F * 0.3); ctx.clip();
        drawLay(c, lay, x0, base + (1 - E.outExpo(kin)) * LH * 1.15 - E.inCubic(ko) * LH * 1.25);
        ctx.restore();
      } else if (style === 'fade' || style === 'blur') {
        const k = E.outCubic(kin);
        alpha(ctx, k * (1 - ko), () => {
          const b = style === 'blur' ? ((1 - k) * 22 + ko * 14) * u : 0;
          if (b > 0.4) ctx.filter = `blur(${b.toFixed(1)}px)`;
          drawLay(c, lay, x0, base + (1 - k) * 40 * u - ko * 30 * u);
          ctx.filter = 'none';
        });
      } else if (style === 'scale') {
        const k = E.outExpo(kin), sc = lerp(1.8, 1, k) * (1 + ko * 0.25);
        alpha(ctx, clamp(k * 2) * (1 - ko), () => {
          ctx.translate(x0 + lay.w / 2, base - F * 0.35); ctx.scale(sc, sc); drawLay(c, lay, -lay.w / 2, F * 0.35);
        });
      } else if (style === 'split') {
        const b1 = E.inOutCubic(prog(kin, 0, 0.5)), b2 = E.inOutCubic(prog(kin, 0.5, 1));
        if (kin >= 0.5) alpha(ctx, 1 - ko, () => drawLay(c, lay, x0, base));
        if (b1 > b2) { const bx = x0 - 12 * u, bw = lay.w + 24 * u; ctx.fillStyle = col(c, s.block || 'accent'); ctx.fillRect(bx + bw * b2, base - F * 0.86, bw * (b1 - b2), F * 1.08); }
      } else {
        // per-character styles: wave, track, type
        const ch = chars(c, lay), n = ch.length;
        const before = counts.slice(0, i).reduce((a, b) => a + b, 0);
        const rate = s.rate || 0.045;
        let lastX = x0;
        ch.forEach((q, j) => {
          let a = 1, dx = 0, dy = 0;
          if (style === 'wave') {
            const t0 = (s.delay || 0) + i * st + j * 0.03;
            dy = (1 - E.outBack(prog(c.lt, t0, t0 + 0.55))) * F * 0.7; a = prog(c.lt, t0, t0 + 0.2);
          } else if (style === 'track') {
            const k = E.outExpo(kin); dx = (j - (n - 1) / 2) * (1 - k) * F * 0.28; a = k;
          } else if (style === 'type') {
            a = c.lt >= (s.delay || 0) + (before + j) * rate ? 1 : 0;
          }
          a *= 1 - ko; dy -= E.inCubic(ko) * 30 * u;
          if (a > 0) { ctx.globalAlpha = a; ctx.font = q.font; ctx.letterSpacing = `${q.track}px`; ctx.fillText(q.ch, x0 + q.x + dx, base + dy); if (a >= 1) lastX = x0 + q.x + q.w; }
        });
        ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
        if (style === 'type') {
          const start = (s.delay || 0) + before * rate, end = start + n * rate, isLast = i === lines.length - 1;
          const active = c.lt >= start && (c.lt < end || isLast);
          if (active && Math.floor(c.lt * 2.4) % 2 === 0 && ko < 1) { ctx.fillStyle = col(c, s.caret || 'accent'); ctx.fillRect(lastX + 6 * u, base - F * 0.78, Math.max(4 * u, F * 0.08), F * 0.92); }
        }
      }
    });
  };

  SC.tag = (c, s) => {
    const { ctx, W, H, u } = c;
    const text = strip(c.fill(s.text)).toUpperCase(); if (!text.trim()) return;
    const size = 28 * u * (s.size || 1), h = size * 2.3;
    ctx.font = `700 ${size}px ${MS.FONTS[c.ty.body]}`; ctx.letterSpacing = `${size * 0.16}px`;
    const w = ctx.measureText(text).width + size * 1.9;
    const align = s.align || 'center';
    const x = align === 'left' ? W * 0.08 : (W - w) / 2, y = H * (s.y != null ? s.y : 0.2) - h / 2;
    const kin = E.outExpo(prog(c.lt, 0, 0.6)), ko = E.inOutCubic(outK(c, s, 0.35));
    if (kin <= ko) { ctx.letterSpacing = '0px'; return; }
    ctx.save();
    rrect(ctx, x + w * ko, y, w * (kin - ko), h, h / 2);
    if (s.outline) { ctx.strokeStyle = col(c, s.color || 'ink'); ctx.lineWidth = 3 * u; ctx.stroke(); }
    else { ctx.fillStyle = col(c, s.color || 'ink'); ctx.fill(); }
    ctx.clip();
    ctx.fillStyle = col(c, s.outline ? s.color || 'ink' : s.text2 || 'bg'); ctx.textBaseline = 'middle'; ctx.globalAlpha = prog(c.lt, 0.25, 0.55);
    ctx.fillText(text, x + size * 0.95 + size * 0.08, y + h / 2 + size * 0.05);
    ctx.restore(); ctx.letterSpacing = '0px';
  };

  SC.words = (c, s) => {
    const { ctx, W, H, u } = c;
    const words = c.fill(s.text).split(s.sep || /\s+/).map(x => x.trim()).filter(Boolean);
    if (!words.length) return;
    const slot = c.d / words.length, i = Math.min(words.length - 1, Math.floor(c.lt / slot)), lt = c.lt - i * slot;
    if (s.flash) {
      const bgs = s.bgs || ['accent', 'ink', 'bg'];
      ctx.fillStyle = col(c, bgs[i % bgs.length]); ctx.fillRect(0, 0, W, H);
    }
    const colors = s.colors || ['ink', 'accent'];
    const w = words[i], sp = headSpec(c, s);
    const F = fitSize(c, [w], sp, W * 0.84, (s.size || 1) * Math.min(300 * u, H * 0.2));
    const lay = layout(c, w, F, sp);
    const k = E.outBack(prog(lt, 0, 0.3)), sc = lerp(0.45, 1, k) * (1 + 0.05 * prog(lt, 0.3, slot));
    const ko = i === words.length - 1 ? outK(c, s, 0.3) : 0;
    ctx.fillStyle = col(c, colors[i % colors.length]);
    alpha(ctx, prog(lt, 0, 0.08) * (1 - ko), () => {
      ctx.translate(W / 2, H * (s.y != null ? s.y : 0.5)); ctx.rotate((s.tilt || 0) * (i % 2 ? 1 : -1)); ctx.scale(sc, sc);
      drawLay(c, lay, -lay.w / 2, F * 0.36);
    });
  };

  SC.caption = (c, s) => {
    const { ctx, W, H, u } = c;
    const txt = c.fill(s.text); if (!strip(txt).trim()) return;
    const size = (s.size || 44) * u;
    const sp = s.head ? headSpec(c, s) : bodySpec(c, s, s.weight);
    if (s.serif) { sp.fam = MS.FONTS.serif; sp.w = 400; }
    const maxW = W * (s.w || 0.78);
    const lines = wrapRich(c, txt, size, sp, maxW).slice(0, s.max || 4);
    const LH = size * (s.lh || 1.28);
    const top = H * (s.y != null ? s.y : 0.7) - (LH * lines.length) / 2;
    const ko = outK(c, s, 0.35);
    lines.forEach((ln, i) => {
      const lay = layout(c, ln, size, sp);
      const align = s.align || 'center';
      const x = align === 'left' ? W * 0.08 : (W - lay.w) / 2;
      const d = (s.delay || 0) + i * (s.stagger != null ? s.stagger : 0.1);
      const k = E.outExpo(prog(c.lt, d, d + 0.8));
      ctx.fillStyle = col(c, s.color || 'ink', s.alpha || 1);
      alpha(ctx, k * (1 - ko), () => drawLay(c, lay, x, top + i * LH + size * 0.95 + (1 - k) * 36 * u - ko * 20 * u));
    });
  };

  SC.counter = (c, s) => {
    const { ctx, W, H, u } = c;
    const raw = c.fill(s.value) || '0', label = c.fill(s.label || '');
    const cy = H * (s.y != null ? s.y : 0.44), cd = s.countDur || 1.5;
    const sp = headSpec(c, s); sp.upper = false;
    const F = fitSize(c, [raw], sp, W * (s.ring ? 0.56 : 0.8), (s.size || 1) * Math.min(280 * u, H * 0.2));
    const k = E.outExpo(prog(c.lt, 0.15, cd)), ko = outK(c, s);
    const txt = countText(raw, s.down ? lerp(s.down, 1, k) : k);
    const punch = 1 + 0.09 * Math.sin(Math.PI * prog(c.lt, cd - 0.1, cd + 0.25));
    const lay = layout(c, txt, F, sp), full = layout(c, raw, F, sp);
    let R = 0;
    alpha(ctx, prog(c.lt, 0, 0.2) * (1 - ko), () => {
      if (s.ring) {
        R = Math.max(full.w * 0.62, F * 0.95);
        const pct = clamp(numOf(raw) / 100);
        ctx.lineWidth = 18 * u; ctx.lineCap = 'round';
        ctx.strokeStyle = col(c, 'ink', 0.1); ctx.beginPath(); ctx.arc(W / 2, cy, R, 0, 7); ctx.stroke();
        ctx.strokeStyle = col(c, s.ringColor || 'accent'); ctx.beginPath(); ctx.arc(W / 2, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * k); ctx.stroke();
      }
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(punch, punch);
      ctx.fillStyle = col(c, s.color || 'accent'); drawLay(c, lay, -lay.w / 2, F * 0.36); ctx.restore();
    });
    if (label) {
      const ly = cy + (s.ring ? R + 90 * u : F * 0.5 + 70 * u);
      SC.caption(Object.assign({}, c, { lt: c.lt - 0.5, d: c.d - 0.5 }), { text: label, y: ly / H, size: s.lsize || 46, color: s.lcolor || 'ink', weight: 600, out: s.out });
    }
  };

  SC.bars = (c, s) => {
    const { ctx, W, H, u } = c;
    const items = c.fill(s.items).split('|').map(x => x.split(':')).filter(x => x[0] && x[0].trim());
    if (!items.length) return;
    const vals = items.map(x => numOf(x[1] || '0')), max = Math.max(...vals, 1);
    const n = items.length, rowH = Math.min(150 * u, (H * (c.portrait ? 0.5 : 0.62)) / n);
    const top = H * (s.y != null ? s.y : 0.55) - (rowH * n) / 2;
    const x0 = W * 0.08, maxBar = W * 0.84 - 150 * u, bh = rowH * 0.34, ko = outK(c, s);
    const body = MS.FONTS[c.ty.body];
    items.forEach(([lab, val], i) => {
      const d = 0.15 + i * 0.16, k = E.outExpo(prog(c.lt, d, d + 1.1));
      const y = top + i * rowH;
      alpha(ctx, prog(c.lt, d, d + 0.2) * (1 - ko), () => {
        ctx.font = `600 ${Math.min(38 * u, rowH * 0.28)}px ${body}`; ctx.fillStyle = col(c, 'ink', 0.85);
        ctx.fillText(lab.trim(), x0, y + rowH * 0.3);
        const hi = s.hi != null ? s.hi : vals.indexOf(max);
        const bw = Math.max(bh, (vals[i] / max) * maxBar * k);
        rrect(ctx, x0, y + rowH * 0.42, bw, bh, bh / 2); ctx.fillStyle = col(c, i === hi ? 'accent' : 'ink', i === hi ? 1 : 0.8); ctx.fill();
        ctx.font = `800 ${Math.min(44 * u, rowH * 0.32)}px ${MS.FONTS[c.ty.head]}`; ctx.fillStyle = col(c, 'ink');
        ctx.fillText(countText((val || '').trim(), k), x0 + bw + 20 * u, y + rowH * 0.42 + bh * 0.82);
      });
    });
  };

  SC.donut = (c, s) => {
    const { ctx, W, H, u } = c;
    const raw = c.fill(s.value) || '0', pct = clamp(numOf(raw) / 100);
    const R = Math.min(W, H) * 0.26, cy = H * (s.y != null ? s.y : 0.42), lw = R * 0.26;
    const k = E.outExpo(prog(c.lt, 0.2, 1.8)), pop = E.outBack(prog(c.lt, 0, 0.6)), ko = outK(c, s);
    alpha(ctx, 1 - ko, () => {
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(pop, pop);
      ctx.lineWidth = lw; ctx.strokeStyle = col(c, 'soft', 0.9); ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
      ctx.strokeStyle = col(c, 'accent'); ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * k); ctx.stroke();
      const sp = headSpec(c, s); sp.upper = false;
      const F = fitSize(c, [raw], sp, R * 1.2, R * 0.55);
      const lay = layout(c, countText(raw, k), F, sp);
      ctx.fillStyle = col(c, 'ink'); drawLay(c, lay, -lay.w / 2, F * 0.36);
      ctx.restore();
    });
    if (s.label) SC.caption(Object.assign({}, c, { lt: c.lt - 0.6, d: c.d - 0.6 }), { text: s.label, y: (cy + R + lw / 2 + 110 * u) / H, size: 46, weight: 600, out: s.out });
  };

  function listRows(c, s, drawMark) {
    const { ctx, W, H, u } = c;
    const items = c.fill(s.items).split('|').map(x => x.trim()).filter(Boolean);
    if (!items.length) return;
    const n = items.length, rowH = Math.min(150 * u, (H * (c.portrait ? 0.5 : 0.66)) / n);
    const top = H * (s.y != null ? s.y : 0.55) - (rowH * n) / 2, ko = outK(c, s);
    const x0 = W * (c.portrait ? 0.1 : 0.2), r = Math.min(40 * u, rowH * 0.3);
    const sp = bodySpec(c, s, 600);
    const size = Math.min(48 * u, rowH * 0.34);
    const maxTW = W - x0 - r * 2 - 40 * u - W * 0.08;
    const F = Math.min(size, fitSize(c, items, sp, maxTW, size));
    items.forEach((txt, i) => {
      const d = (s.delay || 0) + 0.15 + i * (s.stagger || 0.35), k = E.outExpo(prog(c.lt, d, d + 0.7));
      const y = top + i * rowH + rowH / 2;
      alpha(ctx, k * (1 - ko), () => {
        ctx.translate((1 - k) * -60 * u, 0);
        drawMark(i, x0 + r, y, r, prog(c.lt, d + 0.2, d + 0.6));
        ctx.fillStyle = col(c, 'ink'); drawLay(c, layout(c, txt, F, sp), x0 + r * 2 + 34 * u, y + F * 0.35);
      });
    });
  }
  SC.steps = (c, s) => {
    const { ctx, u } = c;
    listRows(c, s, (i, x, y, r) => {
      circle(ctx, x, y, r, col(c, 'accent'));
      ctx.font = `800 ${r * 0.95}px ${MS.FONTS[c.ty.head]}`; ctx.fillStyle = col(c, 'bg'); ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, y + r * 0.34); ctx.textAlign = 'left';
    });
  };
  SC.checklist = (c, s) => {
    const { ctx, u } = c;
    listRows(c, s, (i, x, y, r, k) => {
      rrect(ctx, x - r, y - r, r * 2, r * 2, r * 0.35); ctx.fillStyle = col(c, 'accent'); ctx.fill();
      const len = r * 2.2;
      ctx.save(); ctx.strokeStyle = col(c, 'bg'); ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash([len, len]); ctx.lineDashOffset = len * (1 - E.outCubic(k));
      ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x - r * 0.12, y + r * 0.4); ctx.lineTo(x + r * 0.55, y - r * 0.42); ctx.stroke(); ctx.restore();
    });
  };

  SC.compare = (c, s) => {
    const { ctx, W, H, u } = c; const P = c.portrait;
    const ka = E.outExpo(prog(c.lt, 0, 0.8)), kb = E.outExpo(prog(c.lt, 0.3, 1.1)), ko = outK(c, s);
    const body = MS.FONTS[c.ty.body], sp = headSpec(c, s);
    const panels = [[c.fill(s.la || 'Avant'), c.fill(s.a), s.ca || 'soft', s.ta || 'ink', ka, -1], [c.fill(s.lb || 'Après'), c.fill(s.b), s.cb || 'accent', s.tb || 'bg', kb, 1]];
    alpha(ctx, 1 - ko, () => {
      panels.forEach(([lab, val, bgk, fg, k, dir], i) => {
        const pw = P ? W : W / 2, ph = P ? H / 2 : H;
        const px = P ? 0 : i * pw, py = P ? i * ph : 0;
        ctx.save();
        ctx.translate(P ? dir * (1 - k) * W : 0, P ? 0 : dir * (1 - k) * H);
        ctx.fillStyle = col(c, bgk); ctx.fillRect(px, py, pw, ph);
        const size = 30 * u;
        ctx.font = `700 ${size}px ${body}`; ctx.letterSpacing = `${size * 0.18}px`; ctx.fillStyle = col(c, fg, 0.75); ctx.textAlign = 'center';
        ctx.fillText(strip(lab).toUpperCase(), px + pw / 2, py + ph / 2 - 90 * u); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
        const lines = String(val).split('|');
        const F = fitSize(c, lines, sp, pw * 0.8, Math.min(130 * u, ph * 0.14));
        ctx.fillStyle = col(c, fg);
        lines.forEach((l, j) => { const lay = layout(c, l, F, sp); drawLay(c, lay, px + (pw - lay.w) / 2, py + ph / 2 + F * 0.3 + j * F * 1.05); });
        ctx.restore();
      });
      const pop = E.outBack(prog(c.lt, 1.0, 1.4)), r = 54 * u * pop;
      if (r > 0) {
        circle(ctx, W / 2, H / 2, r, col(c, 'ink'));
        ctx.save(); ctx.translate(W / 2, H / 2); if (P) ctx.rotate(Math.PI / 2); ctx.scale(pop, pop);
        arrow(ctx, -22 * u, 0, 44 * u, 14 * u, 7 * u, col(c, 'bg')); ctx.restore();
      }
    });
  };

  SC.quote = (c, s) => {
    const { ctx, W, H, u } = c;
    const txt = c.fill(s.text), who = strip(c.fill(s.author || '')).toUpperCase();
    const sp = { fam: MS.FONTS.serif, w: 400, itFam: MS.FONTS.serif, itW: 400, upper: false, track: 0, itScale: 1 };
    const size = (s.size || 72) * u;
    const lines = wrapRich(c, txt, size, sp, W * 0.8).slice(0, 5);
    const LH = size * 1.12, blockH = 150 * u + LH * lines.length + 110 * u;
    const top = H * (s.y != null ? s.y : 0.5) - blockH / 2, ko = outK(c, s);
    alpha(ctx, 1 - ko, () => {
      const qk = E.outBack(prog(c.lt, 0, 0.6));
      ctx.save(); ctx.translate(W / 2, top + 120 * u); ctx.scale(qk, qk);
      ctx.font = `400 ${300 * u}px ${MS.FONTS.serif}`; ctx.fillStyle = col(c, 'accent'); ctx.textAlign = 'center'; ctx.fillText('“', 0, 150 * u); ctx.restore();
      const stars = s.stars || 0;
      for (let i = 0; i < stars; i++) {
        const k = E.outBack(prog(c.lt, 0.5 + i * 0.1, 0.8 + i * 0.1)); if (k <= 0) continue;
        const sx = W / 2 + (i - (stars - 1) / 2) * 58 * u;
        star(ctx, sx, top + 150 * u, 24 * u * k, 10 * u * k, 5, -Math.PI / 2); ctx.fillStyle = col(c, s.starColor || 'accent'); ctx.fill();
      }
      lines.forEach((l, i) => {
        const k = E.outExpo(prog(c.lt, 0.35 + i * 0.12, 1.2 + i * 0.12));
        const lay = layout(c, l, size, sp);
        ctx.fillStyle = col(c, 'ink');
        alpha(ctx, k, () => drawLay(c, lay, (W - lay.w) / 2, top + 200 * u + i * LH + size * 0.8 + (1 - k) * 30 * u));
      });
      if (who) {
        const k = prog(c.lt, 1.1, 1.6);
        ctx.font = `700 ${28 * u}px ${MS.FONTS[c.ty.body]}`; ctx.letterSpacing = `${5 * u}px`; ctx.textAlign = 'center'; ctx.fillStyle = col(c, 'ink', 0.65 * k);
        ctx.fillText(`— ${who}`, W / 2, top + 200 * u + lines.length * LH + 80 * u); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
      }
    });
  };

  SC.burst = (c, s) => {
    const { ctx, W, H, u } = c;
    const raw = (c.fill(s.text) || '').trim() || '0';
    const cx = W * (s.x || 0.5), cy = H * (s.y != null ? s.y : 0.45), R = Math.min(W * 0.42, H * 0.3) * (s.size || 1);
    const sk = E.outBack(prog(c.lt, 0, 0.55)), ko = outK(c, s);
    alpha(ctx, 1 - ko, () => {
      star(ctx, cx, cy, R * sk, R * 0.86 * sk, 16, c.t * 0.35); ctx.fillStyle = col(c, s.color || 'accent'); ctx.fill();
      alpha(ctx, prog(c.lt, 0.2, 0.6), () => { star(ctx, cx, cy, R * 1.1 * sk, R * 0.95 * sk, 16, -c.t * 0.25); ctx.lineWidth = 4 * u; ctx.lineJoin = 'round'; ctx.strokeStyle = col(c, 'ink'); ctx.stroke(); });
      const sp = headSpec(c, s); sp.upper = false;
      const F = fitSize(c, [raw], sp, R * 1.45, 360 * u);
      const txt = countText(raw, E.outExpo(prog(c.lt, 0.05, 0.95)));
      const punch = sk * (1 + 0.1 * Math.sin(Math.PI * prog(c.lt, 0.9, 1.2)));
      const lay = layout(c, txt, F, sp);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.07); ctx.scale(punch, punch); ctx.fillStyle = col(c, s.textColor || 'bg'); drawLay(c, lay, -lay.w / 2, F * 0.36); ctx.restore();
    });
    if (s.sub) SC.caption(Object.assign({}, c, { lt: c.lt - 0.6, d: c.d - 0.6 }), { text: s.sub, y: (cy + R * 1.12 + 80 * u) / H, size: 44, weight: 600, out: s.out });
  };

  SC.cta = (c, s) => {
    const { ctx, W, H, u } = c;
    const sc = (s.size || 1) * (c.portrait ? 1.25 : 1);
    const q = u * sc, label = strip(c.fill(s.text) || 'Découvrir'), url = strip(c.fill(s.url || ''));
    const cx = W * (s.x || 0.5), cy = H * (s.y != null ? s.y : 0.6), bh = 112 * q;
    ctx.font = `700 ${46 * q}px ${MS.FONTS[c.ty.body]}`;
    const tw = ctx.measureText(label).width, aw = 40 * q, bw = tw + aw + 132 * q;
    const pop = E.outBack(prog(c.lt, 0.1, 0.6)), squish = 1 - 0.07 * Math.sin(Math.PI * prog(c.lt, 1.15, 1.4));
    const ko = outK(c, s);
    alpha(ctx, 1 - ko, () => {
      if (pop > 0) {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(pop * squish, pop * squish);
        rrect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fillStyle = col(c, s.btn || 'accent'); ctx.fill();
        if (s.glass) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2 * u; ctx.stroke(); }
        ctx.fillStyle = col(c, s.btnText || 'bg'); ctx.textBaseline = 'middle';
        const tx = -bw / 2 + 54 * q; ctx.fillText(label, tx, 2 * q);
        const nudge = 8 * q * Math.sin((c.lt - 0.6) * 6) * prog(c.lt, 0.6, 0.8);
        arrow(ctx, tx + tw + 24 * q + nudge, 0, aw, 14 * q, 6 * q, col(c, s.btnText || 'bg'));
        ctx.restore();
      }
      const rk = prog(c.lt, 1.25, 1.95);
      if (rk > 0 && rk < 1) alpha(ctx, 1 - rk, () => {
        const e = E.outExpo(rk) * 70 * u; rrect(ctx, cx - bw / 2 - e, cy - bh / 2 - e, bw + e * 2, bh + e * 2, bh / 2 + e);
        ctx.lineWidth = 4 * u; ctx.strokeStyle = col(c, s.btn || 'accent'); ctx.stroke();
      });
      if (url) {
        ctx.font = `600 ${34 * q}px ${MS.FONTS[c.ty.body]}`; ctx.letterSpacing = `${2 * u}px`; ctx.textAlign = 'center';
        ctx.fillStyle = col(c, s.urlColor || 'ink', 0.75 * E.outExpo(prog(c.lt, 0.5, 1.0)));
        ctx.fillText(url, cx, cy + bh / 2 + 80 * q); ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
      }
      if (s.cursor !== false) {
        const ck = E.inOutCubic(prog(c.lt, 0.55, 1.1));
        if (ck > 0) {
          const ex = cx + bw * 0.22, ey = cy + bh * 0.12;
          const press = 1 - 0.15 * Math.sin(Math.PI * prog(c.lt, 1.15, 1.4));
          cursor(ctx, lerp(W * 0.92, ex, ck), lerp(H * 0.98, ey, ck), 1.6 * q * press, col(c, s.cursorFill || 'ink'), col(c, s.cursorStroke || 'bg'));
        }
      }
    });
  };

  SC.countdown = (c, s) => {
    const { ctx, W, H, u } = c;
    const parts = String(c.fill(s.from) || '00:59:59').split(':').map(x => parseInt(x, 10) || 0);
    while (parts.length < 3) parts.unshift(0);
    const total = parts[0] * 3600 + parts[1] * 60 + parts[2];
    const rate = s.rate || 1, f = c.lt * rate, now = Math.max(0, total - Math.floor(f)), prev = Math.max(0, now + 1);
    const slide = E.outExpo(prog(f % 1, 0, 0.35));
    const fmt = v => [Math.floor(v / 3600), Math.floor((v % 3600) / 60), v % 60].map(x => String(x).padStart(2, '0'));
    const cur = fmt(now), old = fmt(Math.min(total, prev));
    const bw = Math.min(W * 0.26, 270 * u), bh = bw * 1.08, gap = 26 * u, cy = H * (s.y != null ? s.y : 0.5);
    const x0 = W / 2 - (bw * 3 + gap * 2) / 2, ko = outK(c, s);
    const labels = (s.labels || 'Heures|Minutes|Secondes').split('|');
    const sp = headSpec(c, s); sp.upper = false;
    const F = fitSize(c, ['00'], sp, bw * 0.78, bh * 0.62);
    for (let i = 0; i < 3; i++) {
      const pk = E.outBack(prog(c.lt, i * 0.1, i * 0.1 + 0.5));
      const bx = x0 + i * (bw + gap);
      alpha(ctx, (1 - ko) * clamp(pk * 2), () => {
        ctx.save(); ctx.translate(bx + bw / 2, cy); ctx.scale(pk, pk);
        rrect(ctx, -bw / 2, -bh / 2, bw, bh, 24 * u); ctx.fillStyle = col(c, s.box || 'ink'); ctx.fill(); ctx.clip();
        ctx.fillStyle = col(c, s.digit || 'bg');
        const changed = cur[i] !== old[i] && f >= 1;
        const draw = (txt, dy) => { const lay = layout(c, txt, F, sp); drawLay(c, lay, -lay.w / 2, F * 0.36 + dy); };
        if (changed && slide < 1) { draw(old[i], -slide * bh); draw(cur[i], (1 - slide) * bh); } else draw(cur[i], 0);
        ctx.fillStyle = col(c, 'bg', 0.14); ctx.fillRect(-bw / 2, -1.5 * u, bw, 3 * u);
        ctx.restore();
        ctx.font = `700 ${24 * u}px ${MS.FONTS[c.ty.body]}`; ctx.letterSpacing = `${4 * u}px`; ctx.textAlign = 'center'; ctx.fillStyle = col(c, 'ink', 0.7);
        ctx.fillText((labels[i] || '').toUpperCase(), bx + bw / 2, cy + bh / 2 + 52 * u); ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
      });
    }
  };

  SC.price = (c, s) => {
    const { ctx, W, H, u } = c;
    const old = c.fill(s.old), now = c.fill(s.now), cy = H * (s.y != null ? s.y : 0.48), ko = outK(c, s);
    const sp = headSpec(c, s); sp.upper = false;
    alpha(ctx, 1 - ko, () => {
      const k0 = E.outExpo(prog(c.lt, 0, 0.5));
      const F1 = fitSize(c, [old], sp, W * 0.5, 100 * u);
      const l1 = layout(c, old, F1, sp), oy = cy - 150 * u;
      alpha(ctx, k0 * lerp(1, 0.55, prog(c.lt, 0.8, 1.1)), () => {
        ctx.fillStyle = col(c, 'ink'); drawLay(c, l1, (W - l1.w) / 2, oy + F1 * 0.36 + (1 - k0) * 40 * u);
        const sk = E.inOutCubic(prog(c.lt, 0.5, 0.8));
        ctx.save(); ctx.translate(W / 2, oy); ctx.rotate(-0.12); ctx.strokeStyle = col(c, s.strike || 'accent'); ctx.lineWidth = 12 * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-l1.w / 2 - 20 * u, 0); ctx.lineTo(-l1.w / 2 - 20 * u + (l1.w + 40 * u) * sk, 0); ctx.stroke(); ctx.restore();
      });
      const pk = E.outBack(prog(c.lt, 0.85, 1.35));
      if (pk > 0) {
        const F2 = fitSize(c, [now], sp, W * 0.8, 250 * u), l2 = layout(c, now, F2, sp), ny = cy + 80 * u;
        ctx.save(); ctx.translate(W / 2, ny); ctx.scale(pk, pk); ctx.fillStyle = col(c, s.color || 'accent'); drawLay(c, l2, -l2.w / 2, F2 * 0.36); ctx.restore();
        const rk = prog(c.lt, 0.95, 1.5);
        if (rk > 0 && rk < 1) {
          ctx.strokeStyle = col(c, 'ink', 1 - rk); ctx.lineWidth = 7 * u; ctx.lineCap = 'round';
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2, r1 = l2.w * 0.55 + E.outExpo(rk) * 60 * u, r2 = r1 + 40 * u * (1 - rk);
            ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r1, ny + Math.sin(a) * r1 * 0.6); ctx.lineTo(W / 2 + Math.cos(a) * r2, ny + Math.sin(a) * r2 * 0.6); ctx.stroke();
          }
        }
        const tag = strip(c.fill(s.tag || ''));
        if (tag) {
          const tk = E.outBack(prog(c.lt, 1.3, 1.7));
          ctx.save(); ctx.translate(W / 2 + l2.w * 0.42, ny - F2 * 0.62); ctx.rotate(0.14); ctx.scale(tk, tk);
          ctx.font = `800 ${38 * u}px ${MS.FONTS[c.ty.head]}`; const tw = ctx.measureText(tag).width + 44 * u;
          rrect(ctx, -tw / 2, -34 * u, tw, 68 * u, 34 * u); ctx.fillStyle = col(c, 'ink'); ctx.fill();
          ctx.fillStyle = col(c, 'bg'); ctx.textAlign = 'center'; ctx.fillText(tag, 0, 14 * u); ctx.restore();
        }
      }
    });
  };

  SC.logo = (c, s) => {
    const { ctx, W, H, u } = c;
    const brand = c.fill(s.text) || 'Marque', cy = H * (s.y != null ? s.y : 0.47), ko = outK(c, s);
    const sp = headSpec(c, s);
    const F = fitSize(c, [brand], sp, W * 0.72, (s.size || 1) * 200 * u);
    const lay = layout(c, brand, F, sp), ch = chars(c, lay), n = ch.length;
    const grow = E.outBack(prog(c.lt, 0, 0.5)), shrink = E.inOutCubic(prog(c.lt, 0.45, 0.95));
    const R = Math.min(W, H) * 0.2;
    alpha(ctx, 1 - ko, () => {
      const endX = W / 2 + lay.w / 2 + 26 * u, endY = cy + F * 0.3;
      const r = lerp(R * grow, 16 * u, shrink);
      circle(ctx, lerp(W / 2, endX, shrink), lerp(cy, endY, shrink), r, col(c, s.dot || 'accent'));
      const tk = E.outExpo(prog(c.lt, 0.6, 1.5));
      ch.forEach((q, j) => {
        const dx = (j - (n - 1) / 2) * (1 - tk) * F * 0.5;
        ctx.globalAlpha = prog(c.lt, 0.6 + j * 0.03, 0.9 + j * 0.03) * (1 - ko);
        ctx.font = q.font; ctx.letterSpacing = `${q.track}px`; ctx.fillStyle = col(c, s.color || 'ink');
        ctx.fillText(q.ch, W / 2 - lay.w / 2 + q.x + dx, cy + F * 0.36);
      });
      ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
      const lk = E.inOutCubic(prog(c.lt, 1.1, 1.7));
      ctx.fillStyle = col(c, s.color || 'ink', 0.8); ctx.fillRect(W / 2 - (lay.w / 2) * lk, cy + F * 0.62, lay.w * lk, 4 * u);
    });
    if (s.sub) SC.caption(Object.assign({}, c, { lt: c.lt - 1.3, d: c.d - 1.3 }), { text: s.sub, y: (cy + F * 0.62 + 90 * u) / H, size: 40, weight: 500, upper: true, track: 0.12, alpha: 0.8, out: s.out, color: s.color || 'ink' });
  };

  SC.phone = (c, s) => {
    const { ctx, W, H, u } = c;
    const pw = Math.min(W * 0.5, 470 * u, H * 0.38), ph = pw * 2.05;
    const cx = W * (s.x || 0.5), cy = H * (s.y != null ? s.y : 0.52), ko = outK(c, s);
    const k = E.outExpo(prog(c.lt, 0, 0.9));
    alpha(ctx, 1 - ko, () => {
      ctx.save(); ctx.translate(cx, cy + (1 - k) * H * 0.6); ctx.rotate((1 - k) * 0.25 + Math.sin(c.t * 1.2) * 0.012);
      rrect(ctx, -pw / 2, -ph / 2, pw, ph, pw * 0.16); ctx.fillStyle = col(c, 'ink'); ctx.fill();
      const i = 14 * u, sw = pw - i * 2, sh = ph - i * 2;
      rrect(ctx, -sw / 2, -sh / 2, sw, sh, pw * 0.13);
      const g = ctx.createLinearGradient(0, -sh / 2, 0, sh / 2); g.addColorStop(0, col(c, 'soft')); g.addColorStop(1, col(c, 'accent'));
      ctx.fillStyle = g; ctx.fill(); ctx.save(); ctx.clip();
      const gs = sw / 4;
      for (let r = 0; r < 5; r++) for (let q = 0; q < 4; q++) {
        rrect(ctx, -sw / 2 + q * gs + gs * 0.18, -sh / 2 + sh * 0.2 + r * gs * 1.15, gs * 0.64, gs * 0.64, gs * 0.18);
        ctx.fillStyle = col(c, 'bg', 0.3); ctx.fill();
      }
      const nk = E.outExpo(prog(c.lt, 1.0, 1.5));
      if (nk > 0) {
        const nw = sw * 0.92, nh = sw * 0.36, ny = -sh / 2 + 70 * u - (1 - nk) * 200 * u;
        rrect(ctx, -nw / 2, ny, nw, nh, 26 * u); ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.fill();
        rrect(ctx, -nw / 2 + 22 * u, ny + 22 * u, nh * 0.42, nh * 0.42, 14 * u); ctx.fillStyle = col(c, 'accent'); ctx.fill();
        const app = strip(c.fill(s.app || 'App'));
        ctx.fillStyle = col(c, 'bg'); ctx.font = `800 ${nh * 0.22}px ${MS.FONTS[c.ty.head]}`; ctx.textAlign = 'center';
        ctx.fillText(app.slice(0, 1).toUpperCase(), -nw / 2 + 22 * u + nh * 0.21, ny + 22 * u + nh * 0.29); ctx.textAlign = 'left';
        ctx.fillStyle = '#1a1a1a'; ctx.font = `700 ${nh * 0.15}px ${MS.FONTS.hanken}`; ctx.fillText(app, -nw / 2 + 40 * u + nh * 0.42, ny + 22 * u + nh * 0.16);
        ctx.font = `500 ${nh * 0.14}px ${MS.FONTS.hanken}`; ctx.fillStyle = '#444';
        const msg = strip(c.fill(s.notif || ''));
        const lines = [];
        { let cur = ''; for (const w of msg.split(/\s+/)) { const nx = cur ? cur + ' ' + w : w; if (ctx.measureText(nx).width > nw - 80 * u - nh * 0.42 && cur) { lines.push(cur); cur = w; } else cur = nx; } if (cur) lines.push(cur); }
        lines.slice(0, 2).forEach((l, j) => ctx.fillText(l, -nw / 2 + 40 * u + nh * 0.42, ny + 22 * u + nh * 0.38 + j * nh * 0.18));
      }
      ctx.restore();
      rrect(ctx, -pw * 0.16, -ph / 2 + i + 12 * u, pw * 0.32, 30 * u, 15 * u); ctx.fillStyle = col(c, 'ink'); ctx.fill();
      ctx.restore();
    });
  };

  SC.hearts = (c, s) => {
    const { ctx, W, H, u } = c; const n = s.count || 18, r = rng(s.seed || 3), ko = outK(c, s, 0.6);
    for (let i = 0; i < n; i++) {
      const st = r() * c.d * 0.7, x0 = W * (0.08 + r() * 0.84), sz = (26 + r() * 50) * u, sp = (180 + r() * 260) * u, ph = r() * 6;
      const lt = c.lt - st; if (lt < 0) continue;
      const y = H + 60 * u - lt * sp, x = x0 + Math.sin(lt * 2 + ph) * 30 * u;
      if (y < -100 * u) continue;
      alpha(ctx, prog(lt, 0, 0.3) * (1 - ko) * clamp(y / (H * 0.3)), () => {
        heart(ctx, x, y, sz * E.outBack(prog(lt, 0, 0.4))); ctx.fillStyle = col(c, i % 3 ? s.color || 'accent' : 'soft'); ctx.fill();
      });
    }
  };

  SC.confetti = (c, s) => {
    const { ctx, W, H, u } = c; const n = s.count || 110, r = rng(s.seed || 7);
    const ox = W * (s.x || 0.5), oy = H * (s.y != null ? s.y : 0.55);
    const cols = ['accent', 'soft', 'ink', 'bg'].map(k => col(c, k));
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.3, v = (900 + r() * 1500) * u, rot0 = r() * 6, vr = (r() - 0.5) * 14;
      const w = (14 + r() * 14) * u, h = w * (1.4 + r()), t = c.lt, g = 1800 * u, drag = 0.9;
      const x = ox + Math.cos(a) * v * t * drag, y = oy + Math.sin(a) * v * t * drag + 0.5 * g * t * t;
      if (y > H + 50 * u) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot0 + vr * t); ctx.scale(Math.cos(t * 6 + i), 1);
      ctx.globalAlpha = 1 - prog(t, c.d - 0.5, c.d); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
    }
  };

  SC.timeline = (c, s) => {
    const { ctx, W, H, u } = c;
    const items = c.fill(s.items).split('|').map(x => { const i = x.indexOf(':'); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }).filter(x => x[0]);
    if (!items.length) return;
    const n = items.length, ko = outK(c, s), P = c.portrait;
    const lk = E.inOutCubic(prog(c.lt, 0, 0.9));
    const sp = headSpec(c, s); sp.upper = false;
    alpha(ctx, 1 - ko, () => {
      ctx.strokeStyle = col(c, 'ink', 0.35); ctx.lineWidth = 4 * u; ctx.beginPath();
      if (P) { const x = W * 0.16, y0 = H * 0.24, y1 = H * 0.84; ctx.moveTo(x, y0); ctx.lineTo(x, lerp(y0, y1, lk)); }
      else { const y = H * (s.y || 0.52), x0 = W * 0.08, x1 = W * 0.92; ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, lk), y); }
      ctx.stroke();
      items.forEach(([yr, txt], i) => {
        const d = 0.3 + i * 0.45, k = E.outBack(prog(c.lt, d, d + 0.5)), a = prog(c.lt, d, d + 0.3);
        let px, py;
        if (P) { px = W * 0.16; py = lerp(H * 0.28, H * 0.8, n > 1 ? i / (n - 1) : 0.5); }
        else { px = lerp(W * 0.16, W * 0.84, n > 1 ? i / (n - 1) : 0.5); py = H * (s.y || 0.52); }
        circle(ctx, px, py, 20 * u * k, col(c, 'accent'));
        circle(ctx, px, py, 8 * u * k, col(c, 'bg'));
        alpha(ctx, a, () => {
          const F = 64 * u, lay = layout(c, yr, F, sp);
          ctx.fillStyle = col(c, 'ink');
          const body = bodySpec(c, s, 500), bs = 32 * u;
          if (P) {
            drawLay(c, lay, px + 50 * u, py + F * 0.34);
            const ls = wrapRich(c, txt, bs, body, W * 0.66, false).slice(0, 2);
            ls.forEach((l, j) => drawLay(c, layout(c, l, bs, body), px + 52 * u, py + F * 0.34 + 50 * u + j * bs * 1.25));
          } else {
            drawLay(c, lay, px - lay.w / 2, py - 50 * u);
            const ls = wrapRich(c, txt, bs, body, (W * 0.76) / n, false).slice(0, 3);
            ls.forEach((l, j) => { const ll = layout(c, l, bs, body); drawLay(c, ll, px - ll.w / 2, py + 80 * u + j * bs * 1.25); });
          }
        });
      });
    });
  };

  SC.fill = (c, s) => {
    const { ctx, W, H, u } = c;
    const k = E.inOutCubic(prog(c.lt, 0, s.dur || 0.7)), color = col(c, s.color || 'ink');
    ctx.fillStyle = color;
    if (k >= 1 || s.how === 'cut') { ctx.fillRect(0, 0, W, H); return; }
    if (k <= 0) return;
    switch (s.how) {
      case 'iris': circle(ctx, W * (s.cx || 0.5), H * (s.cy || 0.5), Math.hypot(W, H) * k, color); break;
      case 'slide': ctx.fillRect(0, H * (1 - k), W, H * k); break;
      case 'slideX': ctx.fillRect(0, 0, W * k, H); break;
      case 'blinds': { const n = 8, bh = H / n; for (let i = 0; i < n; i++) { const kk = E.inOutCubic(prog(c.lt, i * 0.04, (s.dur || 0.7) * 0.7 + i * 0.04)); ctx.fillRect(0, i * bh, W, bh * kk + 1); } break; }
      case 'split': ctx.fillRect(0, 0, W, (H / 2) * k); ctx.fillRect(0, H - (H / 2) * k, W, (H / 2) * k + 1); break;
      case 'fade': ctx.globalAlpha = k; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; break;
      default: {
        const sk = H * 0.45, span = W + sk, e = k * span;
        if (s.lead) { ctx.fillStyle = col(c, s.lead); poly(ctx, e + 70 * u, sk, H); ctx.fill(); ctx.fillStyle = color; }
        poly(ctx, e, sk, H); ctx.fill();
      }
    }
  };
  function poly(ctx, e, sk, H) { ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(e, 0); ctx.lineTo(e - sk, H); ctx.lineTo(-10, H); ctx.closePath(); }

  SC.shapes = (c, s) => {
    const { ctx, W, H, u, t } = c;
    const k = E.outBack(prog(c.lt, 0, 0.7)), ko = outK(c, s), x = W * (s.x != null ? s.x : 0.85), y = H * (s.y != null ? s.y : 0.12);
    const color = col(c, s.color || 'ink');
    alpha(ctx, (1 - ko) * (s.alpha || 1), () => {
      switch (s.kind) {
        case 'ring': {
          const r = 100 * u * (s.size || 1), d = E.inOutCubic(prog(c.lt, 0, 0.9)), rot = -Math.PI / 2 + t * 0.6;
          ctx.lineWidth = 9 * u; ctx.lineCap = 'round'; ctx.strokeStyle = color;
          ctx.beginPath(); ctx.arc(x, y, r, rot, rot + Math.PI * 2 * d); ctx.stroke();
          ctx.lineWidth = 4 * u; ctx.setLineDash([3 * u, 16 * u]); ctx.beginPath(); ctx.arc(x, y, r + 30 * u, -t * 0.8, -t * 0.8 + Math.PI * 2 * d); ctx.stroke(); ctx.setLineDash([]);
          circle(ctx, x + Math.cos(t * 1.6) * r, y + Math.sin(t * 1.6) * r, 16 * u * E.outBack(prog(c.lt, 0.7, 1.1)), col(c, 'accent'));
          break;
        }
        case 'dots': {
          const n = 4, g = 46 * u;
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            const dd = (i + j) * 0.05, kk = E.outBack(prog(c.lt, dd, dd + 0.4)), wv = 1 + 0.22 * Math.sin(t * 3.4 - (i + j) * 0.7);
            circle(ctx, x - (g * (n - 1)) / 2 + i * g, y - (g * (n - 1)) / 2 + j * g, 8 * u * kk * wv, color);
          }
          break;
        }
        case 'orbit': {
          const R = Math.min(W, H) * 0.34 * (s.size || 1);
          ctx.strokeStyle = col(c, s.color || 'ink', 0.25); ctx.lineWidth = 3 * u;
          [1, 0.72, 0.44].forEach((m, i) => {
            ctx.beginPath(); ctx.ellipse(x, y, R * m * k, R * m * 0.36 * k, 0.4, 0, 7); ctx.stroke();
            const a = t * (0.8 + i * 0.5) + i * 2;
            const px = x + Math.cos(a) * R * m * Math.cos(0.4) - Math.sin(a) * R * m * 0.36 * Math.sin(0.4);
            const py = y + Math.cos(a) * R * m * Math.sin(0.4) + Math.sin(a) * R * m * 0.36 * Math.cos(0.4);
            circle(ctx, px, py, (14 - i * 3) * u * k, col(c, i === 1 ? 'accent' : s.color || 'ink'));
          });
          break;
        }
        case 'blob': {
          const R = Math.min(W, H) * 0.45 * (s.size || 1) * k;
          const bx = x + Math.sin(t * 0.7) * 40 * u, by = y + Math.cos(t * 0.5) * 40 * u;
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, Math.max(1, R));
          g.addColorStop(0, col(c, s.color || 'accent', 0.7)); g.addColorStop(1, col(c, s.color || 'accent', 0));
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          break;
        }
        case 'lines': {
          for (let i = 0; i < 6; i++) {
            const kk = E.inOutCubic(prog(c.lt, i * 0.06, i * 0.06 + 0.8));
            ctx.fillStyle = col(c, s.color || 'ink', 0.8); ctx.fillRect(x - W * 0.3, y + i * 22 * u, W * 0.3 * kk * (1 - i * 0.1), 5 * u);
          }
          break;
        }
        case 'plus': {
          [[0.12, 0.1], [0.88, 0.16], [0.1, 0.88], [0.9, 0.9]].forEach(([px, py], i) => {
            const kk = E.outBack(prog(c.lt, i * 0.08, i * 0.08 + 0.4)); if (kk <= 0) return;
            ctx.save(); ctx.translate(W * px, H * py); ctx.rotate(t * (i % 2 ? -0.9 : 0.9)); ctx.scale(kk, kk); ctx.fillStyle = color;
            ctx.fillRect(-22 * u, -4 * u, 44 * u, 8 * u); ctx.fillRect(-4 * u, -22 * u, 8 * u, 44 * u); ctx.restore();
          });
          break;
        }
        case 'arcs': {
          ctx.strokeStyle = color; ctx.lineWidth = 6 * u;
          for (let i = 0; i < 4; i++) {
            const r = (80 + i * 50) * u * (s.size || 1), a0 = t * (0.5 + i * 0.2) * (i % 2 ? -1 : 1) + i;
            ctx.beginPath(); ctx.arc(x, y, r * k, a0, a0 + Math.PI * 0.8); ctx.stroke();
          }
          break;
        }
        case 'squiggle': {
          const w = W * 0.5 * (s.size || 1), d = E.inOutCubic(prog(c.lt, 0, 1));
          ctx.strokeStyle = color; ctx.lineWidth = 9 * u; ctx.lineCap = 'round'; ctx.beginPath();
          for (let i = 0; i <= 60 * d; i++) { const px = x - w / 2 + (w * i) / 60, py = y + Math.sin(i / 4 + t * 3) * 18 * u; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.stroke();
          break;
        }
      }
    });
  };

  SC.marquee = (c, s) => {
    const { ctx, W, H, u } = c;
    const text = strip(c.fill(s.text)).toUpperCase(); if (!text.trim()) return;
    const rows = s.rows || 3, sp = headSpec(c, s), F = Math.min(170 * u, H * 0.12) * (s.size || 1);
    const unit = `${text} ${s.sep || '•'} `, lay = layout(c, unit, F, sp);
    const ko = outK(c, s), kin = E.outExpo(prog(c.lt, 0, 0.8));
    alpha(ctx, 1 - ko, () => {
      ctx.translate(W / 2, H * (s.y != null ? s.y : 0.5)); ctx.rotate(s.angle != null ? s.angle : -0.12);
      for (let r = 0; r < rows; r++) {
        const y = (r - (rows - 1) / 2) * F * 1.12, dir = r % 2 ? 1 : -1;
        const off = ((c.t * (s.speed || 260) * u * dir) % lay.w + lay.w) % lay.w;
        const slideIn = (1 - kin) * W * dir;
        for (let x = -W - lay.w + off; x < W + lay.w; x += lay.w) {
          for (const p of lay.parts) {
            ctx.font = p.font; ctx.letterSpacing = `${p.track}px`;
            if (r % 2) { ctx.lineWidth = 3 * u; ctx.strokeStyle = col(c, s.stroke || 'ink'); ctx.strokeText(p.s, x + p.x + slideIn, y + F * 0.36); }
            else { ctx.fillStyle = col(c, s.color || 'accent'); ctx.fillText(p.s, x + p.x + slideIn, y + F * 0.36); }
          }
        }
      }
      ctx.letterSpacing = '0px';
    });
  };

  SC.code = (c, s) => {
    const { ctx, W, H, u } = c;
    const code = strip(c.fill(s.code) || 'CODE').toUpperCase(), label = strip(c.fill(s.label || 'Code promo')).toUpperCase();
    const cy = H * (s.y != null ? s.y : 0.5), bw = Math.min(W * 0.8, 820 * u), bh = 190 * u, ko = outK(c, s);
    const k = E.outBack(prog(c.lt, 0, 0.5));
    alpha(ctx, 1 - ko, () => {
      ctx.font = `700 ${28 * u}px ${MS.FONTS[c.ty.body]}`; ctx.letterSpacing = `${6 * u}px`; ctx.textAlign = 'center'; ctx.fillStyle = col(c, 'ink', 0.7);
      ctx.fillText(label, W / 2, cy - bh / 2 - 36 * u); ctx.letterSpacing = '0px'; ctx.textAlign = 'left';
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(k, k);
      rrect(ctx, -bw / 2, -bh / 2, bw, bh, 28 * u); ctx.fillStyle = col(c, s.box || 'soft'); ctx.fill();
      ctx.setLineDash([18 * u, 12 * u]); ctx.lineDashOffset = -c.t * 30 * u; ctx.lineWidth = 5 * u; ctx.strokeStyle = col(c, 'ink'); ctx.stroke(); ctx.setLineDash([]);
      const sp = { fam: MS.FONTS.mono, w: 700, upper: true, track: 0.08, itFam: MS.FONTS.serif, itW: 400, itScale: 1 };
      const F = fitSize(c, [code], sp, bw * 0.82, 110 * u);
      const lay = layout(c, code, F, sp), ch = chars(c, lay);
      ch.forEach((q, j) => { if (c.lt < 0.4 + j * 0.07) return; ctx.font = q.font; ctx.letterSpacing = `${q.track}px`; ctx.fillStyle = col(c, 'ink'); ctx.fillText(q.ch, -lay.w / 2 + q.x, F * 0.36); });
      ctx.letterSpacing = '0px'; ctx.restore();
      const done = 0.4 + ch.length * 0.07 + 0.3, pk = E.outBack(prog(c.lt, done, done + 0.4));
      if (pk > 0) {
        ctx.save(); ctx.translate(W / 2 + bw / 2 - 40 * u, cy + bh / 2); ctx.scale(pk, pk);
        const txt = strip(c.fill(s.copied || 'Copié ✓'));
        ctx.font = `700 ${30 * u}px ${MS.FONTS[c.ty.body]}`; const tw = ctx.measureText(txt).width + 44 * u;
        rrect(ctx, -tw / 2, -30 * u, tw, 60 * u, 30 * u); ctx.fillStyle = col(c, 'accent'); ctx.fill();
        ctx.fillStyle = col(c, 'bg'); ctx.textAlign = 'center'; ctx.fillText(txt, 0, 11 * u); ctx.restore();
      }
    });
  };

  SC.glass = (c, s) => {
    const { ctx, W, H, u } = c;
    const sp = { fam: MS.FONTS[s.font || 'hanken'], w: s.weight || 300, itFam: MS.FONTS.serif, itW: 400, upper: false, track: -0.03, itScale: 1.12 };
    const cw = Math.min(W * 0.86, 940 * u), pad = 56 * u;
    const title = c.fill(s.title), sub = c.fill(s.sub || ''), eyebrow = strip(c.fill(s.eyebrow || '')).toUpperCase();
    const F = Math.min((s.size || 1) * 104 * u, fitSize(c, [title.split(' ').reduce((a, b) => (strip(a).length > strip(b).length ? a : b), '')], sp, cw - pad * 2, 200 * u));
    const tl = wrapRich(c, title, F, sp, cw - pad * 2).slice(0, 4);
    const bs = 34 * u, bsp = bodySpec(c, { font: 'hanken' }, 400);
    const sl = sub ? wrapRich(c, sub, bs, bsp, cw - pad * 2).slice(0, 3) : [];
    const ch = pad * 2 + (eyebrow ? 60 * u : 0) + tl.length * F * 1.02 + (sl.length ? 30 * u + sl.length * bs * 1.35 : 0) + (s.btn ? 130 * u : 0);
    const cy = H * (s.y != null ? s.y : 0.5) + Math.sin(c.t * 1.1) * 8 * u, x = (W - cw) / 2, y = cy - ch / 2;
    const k = E.outExpo(prog(c.lt, 0, 1.0)), ko = outK(c, s);
    alpha(ctx, k * (1 - ko), () => {
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(lerp(0.94, 1, k), lerp(0.94, 1, k)); ctx.translate(-W / 2, -cy);
      if (!s.bare) {
        ctx.save(); rrect(ctx, x, y, cw, ch, 44 * u); ctx.clip();
        ctx.filter = `blur(${26 * u}px)`; ctx.drawImage(ctx.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height, 0, 0, W, H); ctx.filter = 'none';
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, cw, ch);
        const hl = ctx.createLinearGradient(x, y, x, y + ch); hl.addColorStop(0, 'rgba(255,255,255,0.28)'); hl.addColorStop(0.4, 'rgba(255,255,255,0.04)'); hl.addColorStop(1, 'rgba(255,255,255,0.1)');
        ctx.fillStyle = hl; ctx.fillRect(x, y, cw, ch); ctx.restore();
        rrect(ctx, x, y, cw, ch, 44 * u); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2 * u; ctx.stroke();
      }
      let yy = y + pad;
      const tc = col(c, s.color || 'bg');
      ctx.textAlign = 'left';
      if (eyebrow) {
        alpha(ctx, prog(c.lt, 0.3, 0.8), () => {
          ctx.font = `700 ${22 * u}px ${MS.FONTS.hanken}`; ctx.letterSpacing = `${6 * u}px`; ctx.fillStyle = tc;
          const w = ctx.measureText(eyebrow).width; ctx.fillText(eyebrow, W / 2 - w / 2, yy + 22 * u); ctx.letterSpacing = '0px';
        });
        yy += 60 * u;
      }
      tl.forEach((l, i) => {
        const kk = E.outExpo(prog(c.lt, 0.4 + i * 0.12, 1.3 + i * 0.12)), lay = layout(c, l, F, sp);
        ctx.fillStyle = tc;
        alpha(ctx, kk, () => { const b = (1 - kk) * 14 * u; if (b > 0.4) ctx.filter = `blur(${b.toFixed(1)}px)`; drawLay(c, lay, W / 2 - lay.w / 2, yy + F * 0.82 + (1 - kk) * 20 * u); ctx.filter = 'none'; });
        yy += F * 1.02;
      });
      if (sl.length) {
        yy += 30 * u;
        sl.forEach((l, i) => {
          const kk = E.outExpo(prog(c.lt, 0.9 + i * 0.1, 1.6 + i * 0.1)), lay = layout(c, l, bs, bsp);
          ctx.fillStyle = tc; alpha(ctx, kk * 0.88, () => drawLay(c, lay, W / 2 - lay.w / 2, yy + bs));
          yy += bs * 1.35;
        });
      }
      if (s.btn) {
        const label = strip(c.fill(s.btn)); const bk = E.outBack(prog(c.lt, 1.4, 1.9));
        ctx.font = `700 ${28 * u}px ${MS.FONTS.hanken}`; ctx.letterSpacing = `${3 * u}px`;
        const tw = ctx.measureText(label.toUpperCase()).width, bw = tw + 110 * u, bh = 72 * u, by = yy + 40 * u + bh / 2;
        ctx.save(); ctx.translate(W / 2, by); ctx.scale(bk, bk);
        rrect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
        ctx.fillStyle = col(c, 'ink'); ctx.fillText(label.toUpperCase(), -bw / 2 + 36 * u, 10 * u);
        arrow(ctx, bw / 2 - 58 * u, 0, 22 * u, 8 * u, 4 * u, col(c, 'ink'));
        ctx.restore(); ctx.letterSpacing = '0px';
      }
      ctx.restore();
    });
  };

  SC.bubbles = (c, s) => {
    const { ctx, W, H, u, t } = c; const n = s.count || 12, r = rng(s.seed || 5), ko = outK(c, s, 0.6);
    for (let i = 0; i < n; i++) {
      const x0 = W * r(), rad = (14 + r() * r() * 90) * u, sp = (30 + r() * 60) * u, ph = r() * 10, y0 = H * (0.2 + r() * 0.9);
      const y = ((y0 - (t + ph) * sp) % (H + rad * 4) + H + rad * 4) % (H + rad * 4) - rad * 2;
      const x = x0 + Math.sin(t * 0.8 + ph) * 26 * u;
      const k = E.outBack(prog(c.lt, i * 0.06, i * 0.06 + 0.6));
      if (k <= 0) continue;
      const R = rad * k;
      alpha(ctx, 1 - ko, () => {
        const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
        g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.75, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0.55)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
        if (ctx.createConicGradient) {
          const cg = ctx.createConicGradient(t * 0.5 + i, x, y);
          ['rgba(255,170,220,0.7)', 'rgba(170,220,255,0.7)', 'rgba(255,240,170,0.6)', 'rgba(200,170,255,0.7)', 'rgba(255,170,220,0.7)'].forEach((cc, j) => cg.addColorStop(j / 4, cc));
          ctx.strokeStyle = cg;
        } else ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = Math.max(1, R * 0.06); ctx.stroke();
        circle(ctx, x - R * 0.38, y - R * 0.4, R * 0.16, 'rgba(255,255,255,0.8)');
      });
    }
  };

  MS.SCENES = SC;

  MS.render = function (ctx, W, H, t, tpl, vals, pal) {
    const c = makeCtx(ctx, W, H, t, tpl, vals, pal);
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    (BG[tpl.bg.type] || BG.solid)(c);
    for (const s of tpl.scenes) {
      const end = s.t1 >= tpl.dur ? Infinity : s.t1;
      if (t < s.t0 || t >= end) continue;
      c.lt = t - s.t0; c.d = s.t1 - s.t0;
      const sp = s.L && W > H * 1.2 ? Object.assign({}, s, s.L) : s;
      if (sp.hide) continue;
      ctx.save();
      try { SC[s.type](c, sp); } catch (e) { console.warn(tpl.id, s.type, e); }
      ctx.restore();
    }
    if (tpl.vignette) vignette(c, tpl.vignette);
    if (tpl.grain) grain(c, tpl.grain);
    ctx.restore();
  };

  MS.util = { strip, countText, numOf, runs };
})();
