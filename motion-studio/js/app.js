/* Lueur — interface : galerie, aperçu du héros, kits sonores, studio et export. */
(function () {
  const MS = window.MS, A = MS.Audio;
  const $ = s => document.querySelector(s);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IMGS = { hero: 'assets/img/hero.webp', sphere: 'assets/img/sphere.webp', magnolia: 'assets/img/magnolia.webp', escalier: 'assets/img/escalier.webp' };
  const OBJ = MS.OBJECTIVES;
  const defaults = tpl => Object.fromEntries(tpl.fields.map(f => [f.k, f.v]));
  const tc = s => `00:${s.toFixed(1).padStart(4, '0')}`;
  const ICON = {
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.2v11.6a.8.8 0 0 0 1.2.7l9.4-5.8a.8.8 0 0 0 0-1.4L5.2 1.5A.8.8 0 0 0 4 2.2Z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" rx="1" fill="currentColor"/><rect x="9.4" y="2" width="3.6" height="12" rx="1" fill="currentColor"/></svg>',
    on: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor"/><path d="M10.5 5.2a4 4 0 0 1 0 5.6M12.4 3.4a6.6 6.6 0 0 1 0 9.2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>',
    off: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h2.5L8 3v10L4.5 10H2z" fill="currentColor"/><path d="M10.5 6l4 4m0-4l-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  };

  let AC = null;
  function audioCtx() {
    if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C({ latencyHint: 'interactive' }); }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }

  const ready = Promise.all([
    Promise.all(MS.FONT_LOADS.map(f => document.fonts.load(f))).catch(() => {}),
    MS.loadImages(IMGS),
  ]);

  // ---------- nav ----------
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ---------- gallery ----------
  const CARD_FORMATS = ['9:16', '4:5', '9:16', '1:1', '9:16', '4:5', '9:16'];
  const grid = $('#grid');
  const cards = MS.TEMPLATES.map((tpl, i) => {
    const fmt = tpl.format !== '9:16' ? tpl.format : CARD_FORMATS[i % CARD_FORMATS.length];
    const [FW, FH] = MS.FORMATS[fmt];
    const cw = 360, ch = Math.round((cw * FH) / FW);
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'card'; el.dataset.id = tpl.id;
    el.setAttribute('aria-label', `${tpl.name}, ${OBJ[tpl.obj].name}. Ouvrir dans le studio`);
    el.innerHTML = `<canvas width="${cw}" height="${ch}"></canvas>
      <span class="card-meta"><span class="card-row"><strong>${tpl.name}</strong><span class="obj-chip" data-obj="${tpl.obj}">${OBJ[tpl.obj].name}</span></span>
      <span class="card-row"><span>${tpl.goal}</span><span class="fmt">${tpl.dur} s · ${A.KITS[tpl.kit].name}</span></span></span>`;
    grid.append(el);
    const card = { tpl, fmt, el, cv: el.querySelector('canvas'), vals: defaults(tpl), drawn: false };
    card.ctx = card.cv.getContext('2d');
    el.addEventListener('click', () => openStudio(tpl.id, fmt));
    el.addEventListener('pointerenter', () => hoverStart(card));
    el.addEventListener('pointerleave', () => hoverEnd(card));
    el.addEventListener('focus', () => hoverStart(card));
    el.addEventListener('blur', () => hoverEnd(card));
    return card;
  });
  const poster = c => { MS.render(c.ctx, c.cv.width, c.cv.height, c.tpl.poster, c.tpl, c.vals, c.tpl.p); c.drawn = true; };
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const c = cards.find(k => k.el === e.target);
    if (c && !c.drawn) ready.then(() => poster(c));
  }), { rootMargin: '400px' });
  cards.forEach(c => io.observe(c.el));

  let hovered = null;
  function hoverStart(c) { if (reduce) return; hovered = { c, t0: performance.now() }; requestAnimationFrame(hoverLoop); }
  function hoverEnd(c) { if (hovered && hovered.c === c) { hovered = null; ready.then(() => poster(c)); } }
  function hoverLoop(now) {
    if (!hovered) return;
    const { c, t0 } = hovered;
    MS.render(c.ctx, c.cv.width, c.cv.height, ((now - t0) / 1000) % c.tpl.dur, c.tpl, c.vals, c.tpl.p);
    requestAnimationFrame(hoverLoop);
  }

  let filter = 'all';
  function applyFilter() {
    const q = $('#search').value.trim().toLowerCase();
    let n = 0;
    cards.forEach(c => {
      const hay = [c.tpl.name, c.tpl.goal, OBJ[c.tpl.obj].name, A.KITS[c.tpl.kit].name, ...c.tpl.fields.map(f => f.v)].join(' ').toLowerCase();
      const show = (filter === 'all' || c.tpl.obj === filter) && (!q || hay.includes(q));
      c.el.hidden = !show; if (show) n++;
    });
    $('#tpl-count').textContent = n;
    $('#empty').hidden = n > 0;
    document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  }
  document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    filter = b.dataset.filter; applyFilter();
    if (!b.classList.contains('chip')) $('#templates').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));
  $('#search').addEventListener('input', applyFilter);
  Object.keys(OBJ).forEach(k => { const el = document.querySelector(`[data-count="${k}"]`); if (el) el.textContent = MS.TEMPLATES.filter(t => t.obj === k).length; });

  // ---------- hero live preview ----------
  const heroCv = $('#hero-canvas'), heroCtx = heroCv.getContext('2d');
  const heroList = ['chiffre-cle', 'magnolia', 'impact'].map(MS.byId);
  let heroI = 0, heroT0 = null, heroVisible = true;
  new IntersectionObserver(e => { heroVisible = e[0].isIntersecting; if (heroVisible) requestAnimationFrame(heroLoop); }).observe(heroCv);
  function heroCaption() { const t = heroList[heroI]; $('#hero-caption').textContent = `${t.name} · ${OBJ[t.obj].name}`; }
  function heroLoop(now) {
    if (!heroVisible || studioOpen) { heroT0 = null; return; }
    if (heroT0 == null) heroT0 = now;
    let tpl = heroList[heroI], t = (now - heroT0) / 1000;
    if (t >= tpl.dur) { heroI = (heroI + 1) % heroList.length; heroT0 = now; t = 0; tpl = heroList[heroI]; heroCaption(); }
    MS.render(heroCtx, heroCv.width, heroCv.height, t, tpl, defaults(tpl), tpl.p);
    requestAnimationFrame(heroLoop);
  }
  ready.then(() => {
    heroCaption();
    if (reduce) { const t = heroList[0]; MS.render(heroCtx, heroCv.width, heroCv.height, t.poster, t, defaults(t), t.p); }
    else requestAnimationFrame(heroLoop);
  });

  // ---------- sound kits ----------
  const kitsEl = $('#kits');
  let demo = null;
  Object.entries(A.KITS).forEach(([id, k]) => {
    const el = document.createElement('article');
    el.className = 'kit glass';
    el.innerHTML = `<div class="kit-top"><h3>${k.name}</h3><button type="button" class="round" aria-label="Écouter l'ambiance ${k.name}">${ICON.play}</button></div>
      <p>${k.mood}</p><div class="kit-top"><div class="tags">${k.tags.map(t => `<span>${t}</span>`).join('')}</div><span class="bpm">${k.bpm} BPM</span></div>
      <div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
    const btn = el.querySelector('button');
    btn.addEventListener('click', () => {
      const was = demo && demo.id === id;
      stopDemo();
      if (was) return;
      const ac = audioCtx(); if (!ac) return;
      const p = A.play(ac, ac.destination, A.demoTemplate(id), {}, { kit: id });
      demo = { id, p, el, btn, timer: setTimeout(stopDemo, 6200) };
      el.classList.add('playing'); btn.innerHTML = ICON.pause; btn.setAttribute('aria-label', `Arrêter l'ambiance ${k.name}`);
    });
    kitsEl.append(el);
  });
  function stopDemo() {
    if (!demo) return;
    demo.p.stop(); clearTimeout(demo.timer);
    demo.el.classList.remove('playing'); demo.btn.innerHTML = ICON.play; demo.btn.setAttribute('aria-label', `Écouter l'ambiance ${A.KITS[demo.id].name}`);
    demo = null;
  }

  // ---------- studio ----------
  const studio = $('#studio'), cv = $('#st-canvas'), ctx = cv.getContext('2d');
  const S = { tpl: null, vals: {}, pal: {}, palKey: null, format: '9:16', kit: 'pop', music: true, sfx: true, musicVol: 0.6, sfxVol: 0.7, sound: true, t: 0, playing: true, player: null, clock: null };
  let studioOpen = false, last = null, lastFocus = null;
  const musicGain = () => S.musicVol * 0.53, sfxGain = () => S.sfxVol * 2;

  function openStudio(id, fmt) {
    const tpl = MS.byId(id); if (!tpl) return;
    stopDemo();
    lastFocus = document.activeElement;
    Object.assign(S, { tpl, vals: defaults(tpl), pal: Object.assign({}, tpl.p), palKey: tpl.pal, format: fmt || tpl.format, kit: tpl.kit, t: 0, playing: !reduce });
    $('#st-name').textContent = tpl.name;
    $('#st-goal').textContent = tpl.goal;
    const chip = $('#st-obj'); chip.textContent = OBJ[tpl.obj].name; chip.dataset.obj = tpl.obj;
    buildFields(); buildFormats(); buildPalettes(); buildKits(); syncColors(); setFormat(S.format);
    studio.hidden = false; document.body.classList.add('lock'); studioOpen = true;
    $('#st-close').focus();
    if (S.sound) audioCtx();
    ready.then(() => { restartAudio(); last = null; requestAnimationFrame(loop); });
  }
  function closeStudio() {
    stopAudio(); studio.hidden = true; document.body.classList.remove('lock'); studioOpen = false;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    requestAnimationFrame(heroLoop);
  }
  $('#st-close').addEventListener('click', closeStudio);
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openStudio(b.dataset.open)));
  document.addEventListener('keydown', e => {
    if (!studioOpen) return;
    if (e.key === 'Escape' && $('#export-modal').hidden) closeStudio();
    if (e.key === ' ' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); togglePlay(); }
  });

  function setFormat(f) {
    S.format = f; const [W, H] = MS.FORMATS[f];
    cv.width = W; cv.height = H;
    document.querySelectorAll('#formats button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.f === f)));
    draw();
  }
  function draw() { if (S.tpl) MS.render(ctx, cv.width, cv.height, S.t, S.tpl, S.vals, S.pal); syncTransport(); }
  function syncTransport() {
    if (!S.tpl) return;
    $('#st-scrub').value = Math.round((S.t / S.tpl.dur) * 1000);
    $('#st-tc').textContent = `${tc(S.t)} / ${tc(S.tpl.dur)}`;
    const p = $('#st-play'); p.innerHTML = S.playing ? ICON.pause : ICON.play; p.setAttribute('aria-label', S.playing ? 'Pause' : 'Lire');
    const s = $('#st-sound'); s.innerHTML = S.sound ? ICON.on : ICON.off; s.setAttribute('aria-pressed', String(S.sound)); s.setAttribute('aria-label', S.sound ? 'Couper le son' : 'Activer le son');
  }
  function loop(now) {
    if (!studioOpen) return;
    if (S.playing) {
      if (S.clock && AC) S.t = S.clock.from + (AC.currentTime - S.clock.when);
      else if (last != null) S.t += (now - last) / 1000;
      if (S.t >= S.tpl.dur) { S.t = 0; restartAudio(); }
    }
    last = now;
    draw();
    requestAnimationFrame(loop);
  }
  function stopAudio() { if (S.player) { S.player.stop(); S.player = null; } S.clock = null; }
  function restartAudio() {
    stopAudio();
    if (!S.playing || !S.sound || !studioOpen) return;
    const ac = audioCtx(); if (!ac) return;
    const when = ac.currentTime + 0.05;
    S.player = A.play(ac, ac.destination, S.tpl, S.vals, { from: S.t, when, kit: S.kit, music: S.music, sfx: S.sfx, musicVol: musicGain(), sfxVol: sfxGain() });
    S.clock = { from: S.t - 0.05, when: when - 0.05 };
  }
  function togglePlay() { S.playing = !S.playing; if (S.playing && S.t >= S.tpl.dur - 0.05) S.t = 0; last = null; restartAudio(); syncTransport(); }
  $('#st-play').addEventListener('click', togglePlay);
  $('#st-sound').addEventListener('click', () => { S.sound = !S.sound; restartAudio(); syncTransport(); });
  $('#st-scrub').addEventListener('input', e => { S.t = (e.target.value / 1000) * S.tpl.dur; S.playing = false; stopAudio(); draw(); });

  let audioDebounce = null;
  const soonRestart = () => { clearTimeout(audioDebounce); audioDebounce = setTimeout(() => { if (S.playing) restartAudio(); }, 250); };

  function buildFields() {
    const box = $('#fields'); box.innerHTML = '';
    S.tpl.fields.forEach(f => {
      const lab = document.createElement('label'); lab.className = 'field';
      const long = f.max > 60;
      lab.innerHTML = `<span>${f.label}</span>`;
      const input = document.createElement(long ? 'textarea' : 'input');
      if (long) input.rows = 2; else input.type = 'text';
      input.id = `f-${f.k}`; input.maxLength = f.max; input.value = S.vals[f.k];
      input.addEventListener('input', () => { S.vals[f.k] = input.value; if (!S.playing) draw(); soonRestart(); });
      lab.append(input); box.append(lab);
    });
  }
  $('#reset-text').addEventListener('click', () => { S.vals = defaults(S.tpl); buildFields(); draw(); soonRestart(); });

  function buildFormats() {
    const box = $('#formats'); box.innerHTML = '';
    Object.entries(MS.FORMATS).forEach(([f, [W, H]]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.f = f; b.setAttribute('role', 'radio');
      const s = 18 / Math.max(W, H);
      b.innerHTML = `<i style="width:${Math.round(W * s)}px;height:${Math.round(H * s)}px"></i>${f}`;
      b.addEventListener('click', () => setFormat(f));
      box.append(b);
    });
  }
  function buildPalettes() {
    const box = $('#palettes'); box.innerHTML = '';
    Object.entries(MS.PALETTES).forEach(([key, p]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pal'; b.dataset.key = key;
      b.innerHTML = `<span class="dots"><i style="background:${p.bg}"></i><i style="background:${p.accent}"></i><i style="background:${p.ink}"></i></span>${p.name}`;
      b.addEventListener('click', () => { S.pal = Object.assign({}, p); S.palKey = key; syncColors(); if (!S.playing) draw(); });
      box.append(b);
    });
  }
  const colorInputs = { bg: $('#c-bg'), ink: $('#c-ink'), accent: $('#c-accent'), soft: $('#c-soft') };
  function syncColors() {
    Object.entries(colorInputs).forEach(([k, el]) => { el.value = S.pal[k]; });
    document.querySelectorAll('.pal').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === S.palKey)));
  }
  Object.entries(colorInputs).forEach(([k, el]) => el.addEventListener('input', () => { S.pal[k] = el.value; S.palKey = null; syncColors(); if (!S.playing) draw(); }));

  function buildKits() {
    const box = $('#kit-list'); box.innerHTML = '';
    Object.entries(A.KITS).forEach(([id, k]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'kit-opt'; b.setAttribute('role', 'radio'); b.dataset.kit = id;
      b.setAttribute('aria-checked', String(id === S.kit));
      b.innerHTML = `<strong>${k.name}</strong><span>${k.mood}</span>`;
      b.addEventListener('click', () => {
        S.kit = id; box.querySelectorAll('.kit-opt').forEach(x => x.setAttribute('aria-checked', String(x.dataset.kit === id)));
        if (!S.sound) { S.sound = true; syncTransport(); }
        if (!S.playing) { S.playing = true; }
        restartAudio();
      });
      box.append(b);
    });
    $('#snd-music').checked = S.music; $('#snd-sfx').checked = S.sfx;
    $('#vol-music').value = Math.round(S.musicVol * 100); $('#vol-sfx').value = Math.round(S.sfxVol * 100);
  }
  $('#snd-music').addEventListener('change', e => { S.music = e.target.checked; restartAudio(); });
  $('#snd-sfx').addEventListener('change', e => { S.sfx = e.target.checked; restartAudio(); });
  $('#vol-music').addEventListener('input', e => { S.musicVol = e.target.value / 100; if (S.player) S.player.bus.music.gain.value = S.music ? musicGain() : 0; });
  $('#vol-sfx').addEventListener('input', e => { S.sfxVol = e.target.value / 100; if (S.player) S.player.bus.sfx.gain.value = S.sfx ? sfxGain() : 0; });

  // tabs
  const tabs = ['text', 'style', 'sound'];
  tabs.forEach(name => $(`#tab-${name}`).addEventListener('click', () => {
    tabs.forEach(n => { $(`#tab-${n}`).setAttribute('aria-selected', String(n === name)); $(`#pane-${n}`).hidden = n !== name; });
  }));

  // ---------- export ----------
  const modal = $('#export-modal');
  let job = null;
  $('#st-export').addEventListener('click', async () => {
    const wasPlaying = S.playing; S.playing = false; stopAudio(); syncTransport();
    modal.hidden = false;
    $('#ex-title').textContent = 'Export en cours';
    $('#ex-status').textContent = 'Préparation…'; $('#ex-bar').style.width = '0%';
    $('#ex-result').hidden = true; $('#ex-save').hidden = true; $('#ex-wav').hidden = true; $('#ex-note').hidden = true;
    $('#ex-cancel').textContent = 'Annuler';
    const me = (job = { cancelled: false, wasPlaying });
    const snapshot = { tpl: S.tpl, vals: Object.assign({}, S.vals), pal: Object.assign({}, S.pal), format: S.format, audio: { kit: S.kit, music: S.music, sfx: S.sfx, musicVol: musicGain(), sfxVol: sfxGain() } };
    if (!S.sound) snapshot.audio = null;
    try {
      const res = await MS.Export.run({
        ...snapshot, fps: 30,
        onProgress: (k, msg) => { if (job === me) { $('#ex-bar').style.width = `${Math.round(k * 100)}%`; $('#ex-status').textContent = msg; } },
        isCancelled: () => me.cancelled,
      });
      if (me.cancelled) return;
      me.result = res;
      me.name = `lueur-${snapshot.tpl.id}-${snapshot.format.replace(':', 'x')}.${res.ext}`;
      const [W, H] = MS.FORMATS[snapshot.format];
      $('#ex-title').textContent = 'Ta vidéo est prête';
      $('#ex-status').textContent = `${snapshot.tpl.dur} secondes, ${W} × ${H} px.`;
      $('#ex-bar').style.width = '100%';
      const v = $('#ex-video'); if (v.src) URL.revokeObjectURL(v.src); v.src = URL.createObjectURL(res.blob);
      $('#ex-meta').textContent = `${res.how} · ${(res.blob.size / 1048576).toFixed(1)} Mo`;
      $('#ex-result').hidden = false; $('#ex-save').hidden = false; $('#ex-wav').hidden = !snapshot.audio;
      $('#ex-note').hidden = !/claude|anthropic/.test(location.hostname);
      $('#ex-cancel').textContent = 'Fermer';
      me.snapshot = snapshot;
    } catch (e) {
      if (me.cancelled) return;
      console.error(e);
      $('#ex-title').textContent = "L'export a échoué";
      $('#ex-status').textContent = `${e.message || e}. Essaie un format plus petit ou un autre navigateur (Chrome, Edge ou Safari récent).`;
      $('#ex-cancel').textContent = 'Fermer';
    }
  });
  $('#ex-save').addEventListener('click', () => { if (job && job.result) MS.Export.save(job.result.blob, job.name); });
  $('#ex-wav').addEventListener('click', async () => {
    if (!job || !job.snapshot) return;
    const s = job.snapshot, buf = await A.renderOffline(s.tpl, s.vals, s.audio);
    MS.Export.save(A.wav(buf), `lueur-${s.tpl.id}.wav`);
  });
  $('#ex-cancel').addEventListener('click', () => {
    if (job) { job.cancelled = true; const v = $('#ex-video'); v.pause(); if (job.wasPlaying) { S.playing = true; last = null; restartAudio(); } }
    modal.hidden = true; job = null; syncTransport();
  });

  window.addEventListener('visibilitychange', () => { if (document.hidden) { stopAudio(); stopDemo(); } else if (studioOpen && S.playing) restartAudio(); });
  window.Lueur = { openStudio, S };
})();
