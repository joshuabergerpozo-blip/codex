/* Lueur — design sonore.
   Musique et bruitages sont synthétisés en direct avec la Web Audio API :
   aucun fichier son, aucune clé API. Le même code sert à l'écoute et au rendu
   hors ligne (OfflineAudioContext) pour l'export vidéo. */
(function () {
  const MS = window.MS;
  const A = (MS.Audio = {});

  A.KITS = {
    ethere: { name: 'Éthéré', mood: 'Nappes aériennes, cloches de verre, souffle', bpm: 68, tags: ['Doux', 'Luxe', 'Bien-être'] },
    punch: { name: 'Punch', mood: 'Kick 4/4, clap, basse qui claque', bpm: 124, tags: ['Promo', 'Énergie'] },
    pop: { name: 'Pop bulle', mood: 'Marimba rebondi, petits pops, bonne humeur', bpm: 112, tags: ['Joyeux', 'Social'] },
    corporate: { name: 'Clair', mood: 'Piano électrique, shaker, élan positif', bpm: 100, tags: ['Pédagogie', 'B2B'] },
    urgence: { name: 'Urgence', mood: 'Tic-tac, pulsation de basse, montée de tension', bpm: 128, tags: ['Compte à rebours', 'Soldes'] },
    chill: { name: 'Lo-fi', mood: 'Accords feutrés, beat qui balance, vinyle', bpm: 82, tags: ['Récit', 'Artisanat'] },
    cinema: { name: 'Cinéma', mood: 'Drones, impacts graves, braams', bpm: 60, tags: ['Lancement', 'Manifeste'] },
    tech: { name: 'Tech', mood: 'Arpèges numériques, clics précis', bpm: 120, tags: ['Produit', 'Data'] },
  };

  // how each kit colours the generic sound cues
  const SFX_MAP = {
    ethere: { hit: 'chime', whoosh: 'air', trans: 'shimmer', pop: 'softpop', click: 'softclick', tick: 'softclick' },
    punch: { hit: 'impact', trans: 'whoosh' },
    pop: { hit: 'bigpop', trans: 'whoosh' },
    corporate: { hit: 'chime', trans: 'whoosh' },
    urgence: { hit: 'impact', trans: 'riser' },
    chill: { hit: 'softimpact', whoosh: 'air', trans: 'air', pop: 'softpop' },
    cinema: { hit: 'boom', whoosh: 'air', trans: 'boomwhoosh', pop: 'softpop' },
    tech: { hit: 'impact', pop: 'blip', click: 'blip', trans: 'whoosh' },
  };

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- voices ----------
  function makeVoices(ac, bus) {
    const track = n => { bus.srcs.push(n); return n; };
    if (!ac.__noise) {
      const len = ac.sampleRate * 2, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0), r = MS.rng(1234);
      for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
      ac.__noise = b;
      const cb = ac.createBuffer(1, len, ac.sampleRate), cd = cb.getChannelData(0), r2 = MS.rng(77);
      for (let i = 0; i < len; i++) cd[i] = r2() < 0.0009 ? (r2() * 2 - 1) * 0.9 : (r2() * 2 - 1) * 0.012;
      ac.__crackle = cb;
    }
    const osc = (type, f, t, end) => { const o = track(ac.createOscillator()); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(end); return o; };
    const noise = (t, end, loop) => { const s = track(ac.createBufferSource()); s.buffer = ac.__noise; s.loop = !!loop; s.start(t, (t * 7.3) % 1.5); s.stop(end); return s; };
    const gain = (v = 1) => { const g = ac.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const env = (g, t, peak, a, d, sus = 0.0001) => {
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d);
    };
    const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
    const send = (node, amt) => { if (amt > 0) { const g = gain(amt); node.connect(g); g.connect(bus.verb); } };
    const M = bus.music, S = bus.sfx;

    const V = {
      // ----- drums -----
      kick(t, v = 1) {
        const o = osc('sine', 150, t, t + 0.5), g = gain(0);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        env(g, t, v, 0.004, 0.42); chain(o, g, M);
      },
      taiko(t, v = 1) {
        const o = osc('sine', 90, t, t + 1.2), g = gain(0);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.3); env(g, t, v, 0.005, 1.0);
        chain(o, g, M); send(g, 0.35);
        const n = noise(t, t + 0.3), f = filt('lowpass', 600), g2 = gain(0); env(g2, t, v * 0.5, 0.002, 0.25); chain(n, f, g2, M);
      },
      snare(t, v = 1) {
        const n = noise(t, t + 0.3), f = filt('bandpass', 1800, 0.8), g = gain(0); env(g, t, v * 0.7, 0.002, 0.18); chain(n, f, g, M); send(g, 0.15);
        const o = osc('triangle', 190, t, t + 0.2), g2 = gain(0); env(g2, t, v * 0.4, 0.002, 0.1); chain(o, g2, M);
      },
      clap(t, v = 1) {
        const n = noise(t, t + 0.35), f = filt('bandpass', 1250, 1.1), g = gain(0);
        g.gain.setValueAtTime(0.0001, t);
        [0, 0.011, 0.022].forEach(dt => { g.gain.setValueAtTime(v * 0.8, t + dt); g.gain.exponentialRampToValueAtTime(v * 0.15, t + dt + 0.009); });
        g.gain.setValueAtTime(v * 0.7, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        chain(n, f, g, M); send(g, 0.25);
      },
      hat(t, v = 1, open = false) {
        const n = noise(t, t + 0.4), f = filt('highpass', 7500), g = gain(0); env(g, t, v * 0.3, 0.001, open ? 0.22 : 0.045); chain(n, f, g, M);
      },
      shaker(t, v = 1) {
        const n = noise(t, t + 0.2), f = filt('bandpass', 6500, 1.4), g = gain(0); env(g, t, v * 0.22, 0.012, 0.06); chain(n, f, g, M);
      },
      crackle(t, len) {
        const s = track(ac.createBufferSource()); s.buffer = ac.__crackle; s.loop = true; s.start(t); s.stop(t + len);
        const f = filt('highpass', 1200), g = gain(0.5); chain(s, f, g, M);
      },
      // ----- tonal -----
      bass(t, m, len, v = 1) {
        const f = mtof(m), end = t + len + 0.1;
        const o = osc('sine', f, t, end), o2 = osc('triangle', f, t, end), lp = filt('lowpass', 520), g = gain(0);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.5, t + 0.01); g.gain.setValueAtTime(v * 0.45, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, end);
        o.connect(lp); o2.connect(lp); chain(lp, g, M);
      },
      pulse(t, m, len, v = 1, cut = 800) {
        const o = osc('sawtooth', mtof(m), t, t + len + 0.05), lp = filt('lowpass', cut, 4), g = gain(0);
        env(g, t, v * 0.45, 0.004, len); chain(o, lp, g, M);
      },
      pluck(t, m, len = 0.4, v = 1, type = 'triangle') {
        const o = osc(type, mtof(m), t, t + len + 0.3), lp = filt('lowpass', 3200, 1), g = gain(0);
        lp.frequency.setValueAtTime(3600, t); lp.frequency.exponentialRampToValueAtTime(500, t + len);
        env(g, t, v * 0.22, 0.003, len + 0.2); chain(o, lp, g, M); send(g, 0.2);
      },
      marimba(t, m, v = 1) {
        const f = mtof(m), o = osc('sine', f, t, t + 0.6), o2 = osc('sine', f * 3.99, t, t + 0.2), g = gain(0), g2 = gain(0);
        env(g, t, v * 0.3, 0.002, 0.45); env(g2, t, v * 0.08, 0.001, 0.06); o.connect(g); o2.connect(g2); g.connect(M); g2.connect(M); send(g, 0.15);
      },
      keys(t, m, len = 1.2, v = 1) {
        const f = mtof(m), car = osc('sine', f, t, t + len + 0.6), mod = osc('sine', f, t, t + len + 0.6), mg = gain(0), g = gain(0);
        mg.gain.setValueAtTime(f * 1.8, t); mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6);
        chain(mod, mg); mg.connect(car.frequency);
        env(g, t, v * 0.16, 0.004, len + 0.4); chain(car, g, M); send(g, 0.25);
      },
      pad(t, notes, len, v = 1, cut = 1100) {
        const end = t + len + 1.4, lp = filt('lowpass', cut, 0.5), g = gain(0);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05, t + Math.min(0.9, len * 0.4));
        g.gain.setValueAtTime(v * 0.05, t + len); g.gain.exponentialRampToValueAtTime(0.0001, end);
        notes.forEach(m => [-8, 8].forEach(ct => { const o = osc('sawtooth', mtof(m), t, end); o.detune.value = ct; o.connect(lp); }));
        chain(lp, g, M); send(g, 0.6);
      },
      bell(t, m, v = 1, bus2) {
        const f = mtof(m), car = osc('sine', f, t, t + 2.6), mod = osc('sine', f * 3.5, t, t + 2.6), mg = gain(0), g = gain(0);
        mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + 1.4);
        chain(mod, mg); mg.connect(car.frequency);
        env(g, t, v * 0.12, 0.002, 2.2); chain(car, g, bus2 || M); send(g, 0.55);
      },
      arp(t, m, len, v = 1) {
        const o = osc('square', mtof(m), t, t + len + 0.1), lp = filt('lowpass', 2000, 2), g = gain(0);
        env(g, t, v * 0.08, 0.002, len); chain(o, lp, g, M); send(g, 0.2);
      },
      drone(t, m, len, v = 1) {
        const end = t + len + 1, g = gain(0), lp = filt('lowpass', 260);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.25, t + 1.2); g.gain.setValueAtTime(v * 0.25, t + len); g.gain.exponentialRampToValueAtTime(0.0001, end);
        [0, 12].forEach(k => { const o = osc(k ? 'sawtooth' : 'sine', mtof(m + k), t, end); o.connect(lp); });
        chain(lp, g, M); send(g, 0.3);
      },
      braam(t, m, len = 2, v = 1, out) {
        const end = t + len + 0.8, lp = filt('lowpass', 200, 3), g = gain(0);
        lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.25); lp.frequency.exponentialRampToValueAtTime(300, t + len);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.28, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, end);
        [0, 12, 7, -12].forEach((k, i) => { const o = osc('sawtooth', mtof(m + k), t, end); o.detune.value = (i - 1.5) * 9; o.connect(lp); });
        chain(lp, g, out || M); send(g, 0.4);
      },
      // ----- sound effects -----
      whoosh(t, d = 0.55, v = 1, up = true) {
        const n = noise(t, t + d + 0.1), f = filt('bandpass', up ? 400 : 3200, 1.3), g = gain(0), p = ac.createStereoPanner ? ac.createStereoPanner() : null;
        f.frequency.setValueAtTime(up ? 380 : 3400, t); f.frequency.exponentialRampToValueAtTime(up ? 3600 : 400, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.55, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        if (p) { p.pan.setValueAtTime(-0.6, t); p.pan.linearRampToValueAtTime(0.6, t + d); chain(n, f, g, p, S); } else chain(n, f, g, S);
        send(g, 0.25);
      },
      air(t, d = 0.9, v = 1) { V.whoosh(t, d, v * 0.55); },
      riser(t, d = 1, v = 1) {
        const n = noise(t, t + d + 0.05), f = filt('highpass', 300, 1), g = gain(0);
        f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.35, t + d); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.04);
        chain(n, f, g, S);
        const o = osc('sawtooth', 220, t, t + d + 0.05), lp = filt('lowpass', 1500), g2 = gain(0);
        o.frequency.exponentialRampToValueAtTime(880, t + d);
        g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(v * 0.08, t + d); g2.gain.linearRampToValueAtTime(0.0001, t + d + 0.04);
        chain(o, lp, g2, S);
      },
      impact(t, v = 1) {
        const o = osc('sine', 120, t, t + 1), g = gain(0); o.frequency.exponentialRampToValueAtTime(36, t + 0.5); env(g, t, v * 0.95, 0.003, 0.85); chain(o, g, S); send(g, 0.3);
        const n = noise(t, t + 0.35), f = filt('lowpass', 1400), g2 = gain(0); env(g2, t, v * 0.5, 0.002, 0.25); chain(n, f, g2, S);
      },
      softimpact(t, v = 1) { V.impact(t, v * 0.5); },
      boom(t, v = 1) { V.impact(t, v); V.braam(t, 38, 1.4, v * 0.8, S); },
      boomwhoosh(t, v = 1) { V.whoosh(t, 0.9, v * 0.7); V.impact(t + 0.8, v * 0.6); },
      pop(t, p = 1, v = 1) {
        const o = osc('sine', 320 * p, t, t + 0.2), g = gain(0);
        o.frequency.exponentialRampToValueAtTime(980 * p, t + 0.05); env(g, t, v * 0.42, 0.002, 0.12); chain(o, g, S);
      },
      softpop(t, p = 1, v = 1) { V.pop(t, p * 0.7, v * 0.5); },
      bigpop(t, v = 1) { V.pop(t, 0.6, v); V.pop(t + 0.04, 1.1, v * 0.7); V.impact(t, v * 0.35); },
      blip(t, p = 1, v = 1) { const o = osc('square', 1400 * p, t, t + 0.06), lp = filt('lowpass', 4000), g = gain(0); env(g, t, v * 0.12, 0.001, 0.04); chain(o, lp, g, S); },
      click(t, v = 1) {
        const o = osc('square', 2300, t, t + 0.04), g = gain(0); env(g, t, v * 0.16, 0.001, 0.02); chain(o, g, S);
        const n = noise(t, t + 0.03), f = filt('highpass', 4000), g2 = gain(0); env(g2, t, v * 0.25, 0.001, 0.012); chain(n, f, g2, S);
      },
      softclick(t, v = 1) { V.click(t, v * 0.4); },
      tick(t, v = 1) {
        const o = osc('sine', 2100, t, t + 0.06), g = gain(0); env(g, t, v * 0.3, 0.001, 0.035); chain(o, g, S);
        const n = noise(t, t + 0.04), f = filt('bandpass', 3200, 3), g2 = gain(0); env(g2, t, v * 0.3, 0.001, 0.02); chain(n, f, g2, S);
      },
      type(t, v = 1) {
        const n = noise(t, t + 0.05), f = filt('bandpass', 2200 + ((t * 9973) % 1) * 1800, 2), g = gain(0); env(g, t, v * 0.35, 0.001, 0.025); chain(n, f, g, S);
      },
      chime(t, v = 1) { V.bell(t, 84, v * 1.4, S); V.bell(t + 0.07, 91, v, S); },
      sparkle(t, v = 1) { const r = MS.rng(Math.floor(t * 100)); for (let i = 0; i < 6; i++) V.bell(t + i * 0.06, [88, 91, 93, 95, 98, 100][Math.floor(r() * 6)], v * 0.6, S); },
      shimmer(t, v = 1) {
        [84, 88, 91, 96].forEach((m, i) => V.bell(t + i * 0.05, m, v * 0.5, S));
        const n = noise(t, t + 1.2), f = filt('highpass', 5000), g = gain(0);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.12, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); chain(n, f, g, S); send(g, 0.5);
      },
      notif(t, v = 1) { V.bell(t, 88, v * 1.6, S); V.bell(t + 0.13, 95, v * 1.6, S); },
    };
    return V;
  }

  // ---------- music: one generator per kit, deterministic ----------
  function music(kit, dur) {
    const K = A.KITS[kit] || A.KITS.pop;
    const step = 60 / K.bpm / 4, bar = step * 16;
    const ev = [];
    const add = (t, v, a, len = 0) => { if (t < dur) ev.push({ t, v, a, len }); };
    const r = MS.rng(kit.length * 97 + 3);
    const bars = Math.ceil(dur / bar) + 1;
    for (let b = 0; b < bars; b++) {
      const T0 = b * bar;
      const at = s => T0 + s * step;
      if (kit === 'ethere') {
        const ch = [[48, 55, 60, 64, 71], [45, 52, 57, 60, 67], [41, 48, 55, 57, 64], [43, 50, 55, 59, 62]][b % 4];
        add(T0, 'pad', [ch, bar + 0.2, 1, 1400], bar);
        add(T0, 'bass', [ch[0] - 12, bar * 0.95, 0.45], bar);
        [0, 6, 10, 13].forEach(s => add(at(s), 'bell', [[72, 74, 76, 79, 81, 84][Math.floor(r() * 6)], 0.55]));
      } else if (kit === 'punch') {
        const ch = [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]][b % 4], root = [41, 37, 44, 39][b % 4];
        for (let s = 0; s < 16; s++) {
          if (s % 4 === 0) add(at(s), 'kick', [1]);
          if (s === 4 || s === 12) add(at(s), 'clap', [0.8]);
          if (s % 4 === 2) { add(at(s), 'hat', [1, true]); add(at(s), 'bass', [root, step * 1.6, 0.9]); }
          else if (s % 2) add(at(s), 'hat', [0.5]);
        }
        [0, 7, 10].forEach(s => ch.forEach(m => add(at(s), 'pluck', [m + 12, 0.18, 0.7, 'sawtooth'])));
      } else if (kit === 'pop') {
        const ch = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]][b % 4], root = [48, 43, 45, 41][b % 4];
        for (let s = 0; s < 16; s++) {
          if (s === 0 || s === 8 || s === 10) add(at(s), 'kick', [0.85]);
          if (s === 4 || s === 12) add(at(s), 'clap', [0.7]);
          if (s % 2 === 0) add(at(s), 'hat', [0.6]);
          if (s % 2 === 0) add(at(s), 'marimba', [ch[(s / 2) % 3] + 12 + ((s / 2) % 6 > 2 ? 12 : 0), 0.8]);
          if (s === 0 || s === 6 || s === 8) add(at(s), 'bass', [root, step * 2, 0.8]);
        }
      } else if (kit === 'corporate') {
        const ch = [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]][b % 4], root = [50, 45, 47, 43][b % 4];
        ch.forEach(m => add(T0, 'keys', [m, bar * 0.9, 0.8], bar));
        for (let s = 0; s < 16; s++) {
          if (s === 0 || s === 8) add(at(s), 'kick', [0.6]);
          if (s === 4 || s === 12) add(at(s), 'clap', [0.35]);
          add(at(s), 'shaker', [s % 2 ? 0.5 : 0.9]);
          if (s % 2 === 0) add(at(s), 'pluck', [[ch[0] + 12, ch[2], ch[1] + 12, ch[2]][(s / 2) % 4], 0.25, 0.7]);
        }
        add(T0, 'bass', [root, bar / 2, 0.7]); add(T0 + bar / 2, 'bass', [root, bar / 2, 0.7]);
      } else if (kit === 'urgence') {
        const root = [45, 45, 41, 43][b % 4], ch = [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62]][b % 4];
        add(T0, 'pad', [ch.map(m => m - 12), bar, 0.7, 700], bar);
        for (let s = 0; s < 16; s++) {
          const cut = 500 + 2600 * Math.min(1, (T0 + s * step) / dur);
          add(at(s), 'pulse', [root - 12, step * 0.8, 1, cut]);
          if (s % 4 === 0) add(at(s), 'tick', [0.7]);
          if (s === 0 || s === 8) add(at(s), 'kick', [0.8]);
          if (s % 2) add(at(s), 'hat', [0.35]);
        }
      } else if (kit === 'chill') {
        const ch = [[62, 65, 69, 72], [59, 64, 65, 69], [60, 64, 67, 71], [57, 60, 64, 67]][b % 4], root = [38, 43, 36, 45][b % 4];
        const sw = s => at(s) + (s % 2 ? step * 0.33 : 0);
        ch.forEach(m => { add(at(0), 'keys', [m, bar * 0.55, 0.9]); add(sw(10), 'keys', [m, bar * 0.35, 0.6]); });
        [0, 7, 10].forEach(s => add(sw(s), 'kick', [0.75]));
        [4, 12].forEach(s => add(at(s), 'snare', [0.55]));
        for (let s = 0; s < 16; s += 2) add(sw(s + 1), 'hat', [0.45]);
        add(at(0), 'bass', [root, step * 6, 0.75]); add(sw(10), 'bass', [root, step * 5, 0.7]);
        if (b === 0) add(0, 'crackle', [dur + 1], dur);
      } else if (kit === 'cinema') {
        const root = [38, 38, 34, 36][b % 4];
        add(T0, 'drone', [root - 12, bar, 0.9], bar);
        add(T0, 'pad', [[root + 12, root + 15, root + 19, root + 24], bar, 0.8, 800], bar);
        if (b % 2 === 0) add(T0, 'braam', [root, 2.2, 0.9]);
        [0, 6, 8, 14].forEach(s => add(at(s), 'taiko', [s === 0 ? 1 : 0.55]));
        if (r() > 0.4) add(at(10), 'bell', [root + 36, 0.4]);
      } else if (kit === 'tech') {
        const ch = [[64, 67, 71], [60, 64, 67], [55, 59, 62], [62, 66, 69]][b % 4], root = [40, 36, 43, 38][b % 4];
        const seq = [0, 1, 2, 1, 0, 2, 1, 2];
        for (let s = 0; s < 16; s++) {
          if (s % 4 === 0) add(at(s), 'kick', [0.85]);
          add(at(s), 'hat', [s % 4 === 2 ? 0.7 : 0.3, s % 4 === 2]);
          add(at(s), 'arp', [ch[seq[s % 8]] + 12 + (s >= 8 ? 12 : 0), step * 0.9, 1]);
          if (s % 2 === 0) add(at(s), 'bass', [root, step * 1.5, 0.8]);
          if (r() > 0.86) add(at(s) + step / 2, 'blip', [1 + r(), 0.6]);
        }
        [4, 12].forEach(s => add(at(s), 'clap', [0.45]));
      }
    }
    return ev;
  }

  // ---------- cues: which sound for which motion ----------
  A.cues = function (tpl, vals) {
    const out = [], v = vals || {};
    const fill = s => String(s || '').replace(/\{(\w+)\}/g, (_, k) => v[k] || '');
    const add = (t, k, a = []) => { if (t >= 0 && t < tpl.dur) out.push({ t, k, a }); };
    for (const s of tpl.scenes) {
      const t0 = s.t0, d = s.t1 - s.t0;
      switch (s.type) {
        case 'title': {
          const st = s.style || 'rise', dl = s.delay || 0;
          if (st === 'type') {
            const n = (s.lines || []).map(fill).join('').replace(/\*/g, '').length;
            for (let i = 0; i < Math.min(n, 60); i++) add(t0 + dl + i * (s.rate || 0.045), 'type');
          } else if (st === 'blur' || st === 'fade' || st === 'track') add(t0, 'shimmer');
          else add(t0, 'whoosh', [0.5]);
          if (st === 'wave' || st === 'scale') add(t0 + 0.35, 'pop', [1.2]);
          break;
        }
        case 'tag': add(t0 + 0.05, 'click'); break;
        case 'words': {
          const n = fill(s.text).split(s.sep || /\s+/).filter(x => x.trim()).length;
          for (let i = 0; i < n; i++) add(t0 + (i * d) / n, s.flash ? 'hit' : 'pop', s.flash ? [] : [1 + i * 0.07]);
          break;
        }
        case 'counter': case 'burst': {
          const cd = s.type === 'burst' ? 0.95 : s.countDur || 1.5;
          if (s.type === 'burst') add(t0, 'hit');
          for (let x = 0.15; x < cd * 0.85; x += 0.05 + x * 0.12) add(t0 + x, 'tick', [0.5]);
          add(t0 + cd, s.type === 'burst' ? 'pop' : 'hit', s.type === 'burst' ? [1.4] : []);
          break;
        }
        case 'bars': fill(s.items).split('|').forEach((_, i) => add(t0 + 0.15 + i * 0.16, 'pop', [1 + i * 0.15])); add(t0, 'whoosh', [0.5]); break;
        case 'donut': add(t0, 'whoosh', [0.6]); add(t0 + 1.8, 'chime'); break;
        case 'steps': case 'checklist':
          fill(s.items).split('|').filter(x => x.trim()).forEach((_, i) => {
            const tt = t0 + (s.delay || 0) + 0.15 + i * (s.stagger || 0.35);
            add(tt, 'pop', [1 + i * 0.12]); if (s.type === 'checklist') add(tt + 0.3, 'click');
          });
          break;
        case 'compare': add(t0, 'whoosh', [0.5]); add(t0 + 0.3, 'whoosh', [0.5]); add(t0 + 1.05, 'pop', [1.2]); break;
        case 'quote': add(t0, 'shimmer'); for (let i = 0; i < (s.stars || 0); i++) add(t0 + 0.5 + i * 0.1, 'pop', [1.3 + i * 0.1]); break;
        case 'cta': add(t0 + 0.1, 'pop'); if (s.cursor !== false) add(t0 + 1.15, 'click'); add(t0 + 1.25, 'chime'); break;
        case 'countdown': { add(t0, 'pop'); const rate = s.rate || 1; for (let k = 1; k / rate < d; k++) add(t0 + k / rate, 'tick'); break; }
        case 'price': add(t0 + 0.5, 'whoosh', [0.3]); add(t0 + 0.85, 'hit'); add(t0 + 0.95, 'sparkle'); break;
        case 'logo': add(t0, 'hit'); add(t0 + 0.6, 'shimmer'); break;
        case 'phone': add(t0, 'whoosh', [0.6]); add(t0 + 1.0, 'notif'); break;
        case 'hearts': add(t0 + 0.3, 'sparkle'); break;
        case 'confetti': add(t0, 'pop', [1.5]); add(t0 + 0.05, 'sparkle'); break;
        case 'timeline': add(t0, 'whoosh', [0.8]); fill(s.items).split('|').forEach((_, i) => add(t0 + 0.3 + i * 0.45, 'pop', [1 + i * 0.1])); break;
        case 'fill': if (s.how !== 'cut') add(Math.max(0, t0 - 0.1), 'trans'); break;
        case 'marquee': add(t0, 'whoosh', [0.8]); break;
        case 'code': {
          const n = fill(s.code).replace(/\*/g, '').length;
          for (let j = 0; j < n; j++) add(t0 + 0.4 + j * 0.07, 'type');
          add(t0 + 0.4 + n * 0.07 + 0.3, 'click'); add(t0 + 0.4 + n * 0.07 + 0.35, 'chime');
          break;
        }
        case 'glass': add(t0, 'shimmer'); if (s.btn) add(t0 + 1.4, 'pop'); break;
      }
    }
    return out.sort((a, b) => a.t - b.t);
  };

  function makeBus(ac, dest, o) {
    const out = ac.createGain(); out.gain.value = o.master != null ? o.master : 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(out); out.connect(dest);
    const music = ac.createGain(); music.gain.value = o.music === false ? 0 : o.musicVol != null ? o.musicVol : 0.32;
    const sfx = ac.createGain(); sfx.gain.value = o.sfx === false ? 0 : o.sfxVol != null ? o.sfxVol : 1.4;
    music.connect(comp); sfx.connect(comp);
    const verb = ac.createConvolver();
    const len = Math.floor(ac.sampleRate * 2.6), ir = ac.createBuffer(2, len, ac.sampleRate), r = MS.rng(42);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir;
    const vg = ac.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(comp);
    return { out, music, sfx, verb, srcs: [] };
  }

  // schedule a template's sound from `from` seconds, starting at ac time `when`
  A.play = function (ac, dest, tpl, vals, o = {}) {
    const from = o.from || 0, when = o.when != null ? o.when : ac.currentTime + 0.04;
    const kit = o.kit || tpl.kit;
    const bus = makeBus(ac, dest, o), V = makeVoices(ac, bus);
    const T = t => when + t - from;
    if (o.music !== false) {
      for (const e of music(kit, tpl.dur)) {
        if (e.t >= from - 0.005) V[e.v](T(e.t), ...e.a);
        else if (e.len && e.t + e.len > from + 0.2 && (e.v === 'pad' || e.v === 'drone' || e.v === 'crackle')) {
          const a = e.a.slice(); const left = e.t + e.len - from;
          if (e.v === 'crackle') a[0] = left; else a[1] = left;
          V[e.v](T(from), ...a);
        }
      }
      // gentle fade out on the last second
      const g = bus.music.gain, base = g.value, fadeAt = Math.max(when, T(tpl.dur - 0.9));
      g.setValueAtTime(base, fadeAt); g.linearRampToValueAtTime(0.0001, Math.max(fadeAt + 0.05, T(tpl.dur)));
    }
    if (o.sfx !== false) {
      const map = SFX_MAP[kit] || {};
      for (const c of A.cues(tpl, o.vals || vals)) {
        if (c.t < from - 0.005) continue;
        let k = c.k;
        if (k === 'trans') k = map.trans || 'whoosh';
        else if (map[k]) k = map[k];
        const fn = V[k] || V.pop;
        if (k === 'whoosh') fn(T(c.t), c.a[0] || 0.55);
        else if (k === 'pop' || k === 'softpop' || k === 'blip') fn(T(c.t), c.a[0] || 1, 1);
        else if (k === 'tick') fn(T(c.t), c.a[0] || 1);
        else fn(T(c.t));
      }
    }
    return {
      bus,
      stop() {
        const now = ac.currentTime;
        try { bus.out.gain.cancelScheduledValues(now); bus.out.gain.setTargetAtTime(0, now, 0.02); } catch (e) {}
        setTimeout(() => { bus.srcs.forEach(n => { try { n.stop(); } catch (e) {} }); try { bus.out.disconnect(); } catch (e) {} }, 150);
      },
    };
  };

  A.renderOffline = async function (tpl, vals, o = {}) {
    const sr = 48000, OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const oac = new OAC(2, Math.ceil(sr * tpl.dur), sr);
    A.play(oac, oac.destination, tpl, vals, Object.assign({}, o, { from: 0, when: 0 }));
    return oac.startRendering();
  };

  // 6-second showcase of a kit: music plus one of each effect
  A.demoTemplate = function (kit) {
    return {
      id: 'demo-' + kit, dur: 6, kit, scenes: [
        { type: 'title', t0: 0.2, t1: 2, lines: ['x'], style: 'rise' },
        { type: 'words', t0: 1.0, t1: 2.2, text: 'a b c' },
        { type: 'counter', t0: 2.2, t1: 4, countDur: 1 },
        { type: 'fill', t0: 4.1, t1: 6, how: 'diag' },
        { type: 'cta', t0: 4.4, t1: 6 },
      ],
    };
  };

  A.wav = function (buf) {
    const nch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate, bytes = 44 + len * nch * 2;
    const dv = new DataView(new ArrayBuffer(bytes)); let p = 0;
    const w = s => { for (const ch of s) dv.setUint8(p++, ch.charCodeAt(0)); };
    const u32 = x => { dv.setUint32(p, x, true); p += 4; }, u16 = x => { dv.setUint16(p, x, true); p += 2; };
    w('RIFF'); u32(bytes - 8); w('WAVE'); w('fmt '); u32(16); u16(1); u16(nch); u32(sr); u32(sr * nch * 2); u16(nch * 2); u16(16); w('data'); u32(len * nch * 2);
    const chans = [...Array(nch)].map((_, i) => buf.getChannelData(i));
    for (let i = 0; i < len; i++) for (let c = 0; c < nch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); dv.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true); p += 2; }
    return new Blob([dv], { type: 'audio/wav' });
  };
})();
