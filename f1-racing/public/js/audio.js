// Sons synthétisés (WebAudio) : moteur, crissement de pneus, chocs.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    // Moteur : deux oscillateurs filtrés
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 900;
    this.filter.Q.value = 4;
    this.osc1 = ctx.createOscillator();
    this.osc1.type = "sawtooth";
    this.osc2 = ctx.createOscillator();
    this.osc2.type = "square";
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.osc1.connect(this.filter);
    this.osc2.connect(g2).connect(this.filter);
    this.filter.connect(this.engineGain).connect(this.master);
    this.osc1.start();
    this.osc2.start();

    // Bruit (crissement)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 3;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    src.connect(bp).connect(this.skidGain).connect(this.master);
    src.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // rpm 0..1, throttle 0..1, tier = niveau moteur (son plus aigu et plus riche)
  update({ rpm, throttle, tier, slip, offroad }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = 28 + tier * 9;
    const f = base + rpm * (90 + tier * 55);
    this.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.osc2.frequency.setTargetAtTime(
      f * 0.5 + (tier === 0 ? Math.random() * 6 : 0),
      t,
      0.05,
    );
    this.filter.frequency.setTargetAtTime(
      500 + rpm * 1800 + throttle * 600 + tier * 150,
      t,
      0.08,
    );
    this.engineGain.gain.setTargetAtTime(
      0.07 + throttle * 0.1 + rpm * 0.05,
      t,
      0.1,
    );
    const skid = Math.min(1, Math.max(0, (slip - 1.2) / 5)) * (offroad ? 0 : 1);
    this.skidGain.gain.setTargetAtTime(skid * 0.12, t, 0.05);
  }

  thump(strength) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = Math.min(0.9, strength * 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 0.4);
  }

  beep(freq = 440, dur = 0.25) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  cash() {
    this.beep(880, 0.12);
    setTimeout(() => this.beep(1320, 0.18), 90);
  }
}
