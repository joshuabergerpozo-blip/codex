/* Lueur — export vidéo dans le navigateur.
   1) WebCodecs (H.264 + AAC/Opus) muxé en MP4 avec mp4-muxer : rapide, image par image.
   2) Repli : MediaRecorder en temps réel (MP4 sur Safari, WebM ailleurs). */
(function () {
  const MS = window.MS;
  const X = (MS.Export = {});

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function pickVideo(W, H, fps) {
    if (!window.VideoEncoder) return null;
    const bitrate = Math.round(W * H * fps * 0.14);
    const tries = [['avc1.640028', 'avc'], ['avc1.4d0028', 'avc'], ['avc1.42e028', 'avc'], ['vp09.00.40.08', 'vp9'], ['av01.0.08M.08', 'av1']];
    for (const [codec, kind] of tries) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps };
      if (kind === 'avc') cfg.avc = { format: 'avc' };
      try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) return { cfg, kind }; } catch (e) { /* try next */ }
    }
    return null;
  }
  async function pickAudio() {
    if (!window.AudioEncoder) return null;
    for (const [codec, kind] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const cfg = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 };
      try { const s = await AudioEncoder.isConfigSupported(cfg); if (s.supported) return { cfg, kind }; } catch (e) { /* try next */ }
    }
    return null;
  }

  X.canFast = async function (format) {
    const [W, H] = MS.FORMATS[format || '9:16'];
    return !!(window.Mp4Muxer && (await pickVideo(W, H, 30)));
  };

  async function viaWebCodecs({ tpl, vals, pal, W, H, fps, abuf, onProgress, isCancelled }) {
    const v = await pickVideo(W, H, fps);
    if (!v || !window.Mp4Muxer) throw new Error('webcodecs-unavailable');
    const a = abuf ? await pickAudio() : null;
    if (abuf && !a) throw new Error('no-audio-encoder');
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: v.kind, width: W, height: H, frameRate: fps },
      audio: a ? { codec: a.kind, numberOfChannels: 2, sampleRate: 48000 } : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    let failure = null;
    const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => (failure = e) });
    ve.configure(v.cfg);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { alpha: false });
    const frames = Math.round(tpl.dur * fps);
    for (let i = 0; i < frames; i++) {
      if (failure) throw failure;
      if (isCancelled()) throw new Error('cancelled');
      MS.render(ctx, W, H, i / fps, tpl, vals, pal);
      const f = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      ve.encode(f, { keyFrame: i % (fps * 2) === 0 });
      f.close();
      while (ve.encodeQueueSize > 6) await sleep(1);
      if (i % 3 === 0) { onProgress(0.08 + (i / frames) * 0.84, `Image ${i + 1} sur ${frames}`); await sleep(0); }
    }
    await ve.flush(); ve.close();
    if (a && abuf) {
      onProgress(0.94, 'Encodage du son');
      const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => (failure = e) });
      ae.configure(a.cfg);
      const L = abuf.getChannelData(0), R = abuf.numberOfChannels > 1 ? abuf.getChannelData(1) : L, n = 4800;
      for (let off = 0; off < abuf.length; off += n) {
        const len = Math.min(n, abuf.length - off), data = new Float32Array(len * 2);
        data.set(L.subarray(off, off + len), 0); data.set(R.subarray(off, off + len), len);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((off / 48000) * 1e6), data });
        ae.encode(ad); ad.close();
      }
      await ae.flush(); ae.close();
      if (failure) throw failure;
    }
    muxer.finalize();
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4', how: `MP4 · ${v.kind.toUpperCase()}${a ? ' + ' + a.kind.toUpperCase() : ''}` };
  }

  async function viaRecorder({ tpl, vals, pal, W, H, fps, abuf, onProgress, isCancelled }) {
    if (!window.MediaRecorder) throw new Error("Ce navigateur ne sait pas enregistrer de vidéo. Essaie Chrome, Edge ou Safari récent.");
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { alpha: false });
    MS.render(ctx, W, H, 0, tpl, vals, pal);
    const stream = cv.captureStream(fps);
    let actx = null, src = null;
    if (abuf) {
      actx = new AudioContext({ sampleRate: 48000 });
      const dest = actx.createMediaStreamDestination();
      src = actx.createBufferSource(); src.buffer = abuf; src.connect(dest);
      stream.addTrack(dest.stream.getAudioTracks()[0]);
    }
    const types = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 9e6 } : undefined);
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => (rec.onstop = r));
    rec.start(200);
    const start = performance.now() + 60;
    if (src) src.start(actx.currentTime + 0.06);
    await new Promise((resolve, reject) => {
      const tick = () => {
        if (isCancelled()) { reject(new Error('cancelled')); return; }
        const t = (performance.now() - start) / 1000;
        MS.render(ctx, W, H, Math.max(0, Math.min(t, tpl.dur - 1 / fps)), tpl, vals, pal);
        onProgress(0.1 + Math.min(1, t / tpl.dur) * 0.85, 'Enregistrement en temps réel');
        if (t >= tpl.dur + 0.1) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }).finally(() => { if (rec.state !== 'inactive') rec.stop(); });
    await done;
    if (actx) actx.close();
    const type = rec.mimeType || mimeType || 'video/webm';
    return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm', how: type.includes('mp4') ? 'MP4 (temps réel)' : 'WebM (temps réel)' };
  }

  X.run = async function ({ tpl, vals, pal, format, fps = 30, audio, onProgress = () => {}, isCancelled = () => false }) {
    const [W, H] = MS.FORMATS[format];
    let abuf = null;
    if (audio && (audio.music !== false || audio.sfx !== false)) {
      onProgress(0.03, 'Synthèse du son');
      abuf = await MS.Audio.renderOffline(tpl, vals, audio);
    }
    const args = { tpl, vals, pal, W, H, fps, abuf, onProgress, isCancelled };
    try { return await viaWebCodecs(args); }
    catch (e) { if (e.message === 'cancelled') throw e; console.warn('WebCodecs indisponible, repli MediaRecorder', e); }
    return viaRecorder(args);
  };

  X.save = function (blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  };
})();
