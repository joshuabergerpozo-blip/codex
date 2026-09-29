"""Bande-son du film « Lueur » : sound design + musique d'ambiance, 100 % synthétisés.

Tout est généré par le code (aucun échantillon externe) : la bande-son est donc
libre de droits et calée à l'image près sur tools/motion/lueur-motion.html.

    pip install numpy imageio-ffmpeg
    python3 tools/motion/lueur-sound.py        # après render.cjs

Le script écrit la piste audio puis la mixe dans assets/lueur-motion.mp4 (AAC).
"""

import os
import shutil
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
DUR = 24.0
N = int(SR * DUR)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
VIDEO = os.path.join(ROOT, "assets", "lueur-motion.mp4")
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- outils
def tl(dur):
    return np.arange(int(dur * SR)) / SR


def env(dur, a=0.01, r=None, curve=4.0):
    """Attaque linéaire puis décroissance exponentielle."""
    t = tl(dur)
    e = np.minimum(1.0, t / max(a, 1e-4))
    rel = dur - a if r is None else r
    e *= np.exp(-curve * np.maximum(0.0, t - a) / max(rel, 1e-4))
    return e


def fade(sig, fin=0.005, fout=0.02):
    n_in, n_out = int(fin * SR), int(fout * SR)
    sig[:n_in] *= np.linspace(0, 1, n_in)
    if n_out:
        sig[-n_out:] *= np.linspace(1, 0, n_out)
    return sig


def lowpass(x, cutoff):
    """Passe-bas un pôle ; cutoff peut être un tableau (filtre qui s'ouvre)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def convolve(x, ir):
    n = len(x) + len(ir) - 1
    size = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:n]


def reverb_ir(seconds=3.2, seed=1):
    r = np.random.default_rng(seed)
    t = tl(seconds)
    ir = r.standard_normal(len(t)) * np.exp(-3.2 * t / seconds)
    ir = lowpass(ir, 5200)
    ir[: int(0.012 * SR)] = 0  # pré-délai
    return ir / np.sqrt(np.sum(ir**2))


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


class Bus:
    def __init__(self):
        self.l = np.zeros(N + SR * 4)
        self.r = np.zeros(N + SR * 4)

    def add(self, sig, at, gain=1.0, pan=0.0):
        i = int(at * SR)
        sig = sig * gain
        gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        end = min(len(self.l), i + len(sig))
        self.l[i:end] += sig[: end - i] * gl * np.sqrt(2)
        self.r[i:end] += sig[: end - i] * gr * np.sqrt(2)


# ---------------------------------------------------------------- timbres
def soft_piano(note, dur=2.6, vel=1.0):
    f = midi(note)
    t = tl(dur)
    s = sum(a * np.sin(2 * np.pi * f * h * t) * np.exp(-t * (1.6 + h * 0.9)) for h, a in [(1, 1.0), (2, 0.35), (3, 0.12), (4, 0.05)])
    return fade(s * np.minimum(1, t / 0.006) * vel, 0.002, 0.3)


def pad(notes, dur, bright=0.5):
    t = tl(dur)
    s = np.zeros_like(t)
    for n in notes:
        f = midi(n)
        for det in (-0.12, 0.0, 0.11):  # léger désaccord : chaleur
            ff = f * 2 ** (det / 12)
            s += np.sin(2 * np.pi * ff * t) + bright * 0.3 * np.sin(2 * np.pi * 2 * ff * t) + bright * 0.12 * np.sin(2 * np.pi * 3 * ff * t)
    s *= 1 + 0.05 * np.sin(2 * np.pi * 0.23 * t)  # respiration lente
    a = min(1.6, dur / 3)
    e = np.minimum(1, t / a) * np.minimum(1, (dur - t) / a)
    return s * e / (3 * len(notes))


def bell(note, dur=3.5, vel=1.0):
    f = midi(note)
    t = tl(dur)
    parts = [(1.0, 1.0, 1.2), (2.0, 0.5, 1.8), (2.76, 0.35, 2.6), (5.4, 0.15, 4.0), (8.93, 0.06, 6.0)]
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-d * t) for m, a, d in parts)
    return fade(s * np.minimum(1, t / 0.002) * vel, 0.001, 0.2)


def alarm_beep(dur=0.11):
    t = tl(dur)
    f = 2100.0
    s = sum(np.sin(2 * np.pi * f * k * t) / k for k in (1, 3, 5, 7))  # onde carrée arrondie
    return fade(s * 0.55, 0.002, 0.008)


def whoosh(dur, f0, f1, peak=0.6):
    t = tl(dur)
    noise = rng.standard_normal(len(t))
    cutoff = f0 * (f1 / f0) ** (t / dur)
    s = lowpass(noise, cutoff) - lowpass(noise, cutoff * 0.25)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    e = np.where(t / dur < peak, np.sin(np.pi / 2 * t / (dur * peak)) ** 2, np.cos(np.pi / 2 * (t / dur - peak) / (1 - peak)) ** 2)
    return s * e


def pop(f0=900, f1=420, dur=0.12):
    t = tl(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 60)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fade(np.sin(ph) * np.exp(-t * 38), 0.001, 0.01)


def chirp(f0, f1, dur):
    t = tl(dur)
    f = f0 + (f1 - f0) * (t / dur) ** 0.6
    ph = 2 * np.pi * np.cumsum(f) / SR
    e = np.sin(np.pi * t / dur) ** 1.5
    return np.sin(ph) * e


def bird_phrase(seed):
    r = np.random.default_rng(seed)
    base = r.uniform(2600, 3800)
    out = []
    for _ in range(r.integers(3, 7)):
        d = r.uniform(0.04, 0.09)
        out.append(chirp(base * r.uniform(0.9, 1.05), base * r.uniform(1.15, 1.45), d))
        out.append(np.zeros(int(r.uniform(0.03, 0.08) * SR)))
    return np.concatenate(out)


def cricket(dur=0.35):
    t = tl(dur)
    carrier = np.sin(2 * np.pi * 4700 * t)
    am = (np.sin(2 * np.pi * 32 * t) > 0.2).astype(float)
    return fade(carrier * am * np.sin(np.pi * t / dur), 0.005, 0.02)


def tape_stop(dur=0.45):
    t = tl(dur)
    f = 900 * (1 - t / dur) ** 2 + 60
    ph = 2 * np.pi * np.cumsum(f) / SR
    return fade(np.sin(ph) * (1 - t / dur) * 0.6, 0.002, 0.05)


# ---------------------------------------------------------------- mix
music, sfx, dry = Bus(), Bus(), Bus()

# 1. Nuit (0–5,2 s) : drone grave + grillons, très bas
dry.add(pad([36, 43], 5.6, bright=0.1), 0.0, 0.35)
for k, at in enumerate(np.arange(0.2, 5.0, 0.62)):
    dry.add(cricket(), at + rng.uniform(-0.05, 0.05), 0.035, pan=-0.6 if k % 2 else 0.55)
sfx.add(bell(84, 2.5, 0.5), 0.25, 0.10)  # « 06:30 » apparaît
sfx.add(soft_piano(72, 1.6, 0.6), 0.75, 0.10)  # « Votre corps dort encore »

# 2. L'alarme (1,6–3,3 s) : bips agressifs puis coupure « bande qui s'arrête »
for i, at in enumerate(np.arange(1.6, 3.2, 0.3)):
    for j in range(2):
        dry.add(alarm_beep(), at + j * 0.14, 0.16, pan=0.15 * (-1) ** i)
dry.add(tape_stop(), 3.25, 0.25)

# 3. La question (3,6 s) : un accord doux, le calme revient
for n, d in zip([60, 64, 67, 71], [0, 0.07, 0.14, 0.21]):
    sfx.add(soft_piano(n, 3.0, 0.7), 3.6 + d, 0.10)

# 4. Musique : 70 BPM, Fmaj7 → C/E → Am7 → Gsus, du lever de soleil jusqu'à la fin
beat = 60 / 70
chords = [
    ([41, 53, 57, 60, 64], [65, 69, 72, 76]),  # Fmaj7
    ([40, 52, 55, 60, 67], [64, 67, 72, 74]),  # C/E (add9)
    ([45, 52, 55, 60, 64], [69, 72, 76, 79]),  # Am7
    ([43, 50, 55, 60, 62], [67, 72, 74, 79]),  # Gsus
]
start = 5.2
bar = 4 * beat
k = 0
t = start
while t < DUR - 0.5:
    low, arp = chords[k % 4]
    progress = min(1.0, (t - start) / 7.2)  # le jour se lève → le son s'éclaire
    music.add(pad(low, bar + 1.2, bright=0.2 + 0.6 * progress), t, 0.55)
    for step in range(8):  # arpège en croches, léger et aéré
        if step % 2 == 1 and progress < 0.35:
            continue
        note = arp[[0, 1, 2, 3, 2, 1, 3, 2][step]]
        vel = 0.45 + 0.25 * progress + 0.1 * rng.uniform()
        music.add(soft_piano(note, 2.2, vel), t + step * beat / 2 + rng.uniform(0, 0.012), 0.16, pan=rng.uniform(-0.35, 0.35))
    k += 1
    t += bar

# 5. Lever de soleil : souffle qui monte + oiseaux de plus en plus présents
sfx.add(whoosh(7.0, 180, 2400, peak=0.85), 5.3, 0.05)
sfx.add(bell(79, 3.0, 0.5), 5.6, 0.07)  # « 30 minutes avant l'heure »
sfx.add(bell(84, 3.0, 0.5), 8.9, 0.07)  # « Lueur fait lever le soleil »
bird_times = [7.8, 8.9, 9.7, 10.4, 11.0, 11.6, 12.1, 12.6, 14.2, 15.8, 16.9, 18.6, 20.2, 21.7]
for i, at in enumerate(bird_times):
    level = 0.035 + 0.05 * min(1.0, (at - 7.8) / 4.5)
    sfx.add(bird_phrase(100 + i), at, level, pan=[-0.7, 0.6, -0.3, 0.8, -0.8, 0.3][i % 6])

# 6. Transition + trois cartes bénéfices
sfx.add(whoosh(1.1, 300, 5000, peak=0.6), 12.8, 0.11)
for at, (f0, f1), note in zip([13.9, 14.5, 15.1], [(820, 400), (980, 480), (1150, 560)], [72, 76, 79]):
    sfx.add(pop(f0, f1), at + 0.05, 0.22)
    sfx.add(bell(note + 12, 1.8, 0.6), at + 0.06, 0.06)

# 7. Signature : révélation, lampe qui s'allume, logo
sfx.add(whoosh(1.0, 250, 4200, peak=0.55), 18.0, 0.10)
for n in (60, 64, 67, 72):
    sfx.add(bell(n, 4.5, 0.8), 18.7, 0.07)  # la lampe s'allume
sfx.add(bell(88, 3.5, 0.7), 19.45, 0.09)  # « Lueur »
sfx.add(pop(1300, 700, 0.1), 20.85, 0.14)  # pastille

# réverbération commune (musique + sfx), le « dry » reste sec (plus de contraste)
ir_l, ir_r = reverb_ir(3.4, 1), reverb_ir(3.4, 2)
wet_src_l = music.l + sfx.l
wet_src_r = music.r + sfx.r
L = wet_src_l + 0.55 * convolve(wet_src_l, ir_l)[: len(wet_src_l)] + dry.l
R = wet_src_r + 0.55 * convolve(wet_src_r, ir_r)[: len(wet_src_r)] + dry.r
L, R = L[:N], R[:N]

# fondu de fin (l'image repasse à la nuit) et de début, pour une boucle douce
tt = np.arange(N) / SR
master = np.clip((DUR - tt) / 0.8, 0, 1) * np.clip(tt / 0.05, 0, 1)
L *= master
R *= master

peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = L / peak * 0.89, R / peak * 0.89  # -1 dBFS

pcm = (np.stack([L, R], axis=1) * 32767).astype("<i2")
tmp = tempfile.mkdtemp()
wav_path = os.path.join(tmp, "lueur-audio.wav")
with wave.open(wav_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())


def ffmpeg():
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"


out = os.path.join(tmp, "out.mp4")
subprocess.run(
    [ffmpeg(), "-loglevel", "error", "-y", "-i", VIDEO, "-i", wav_path, "-map", "0:v:0", "-map", "1:a:0",
     "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out],
    check=True,
)
shutil.move(out, VIDEO)
if os.environ.get("KEEP_WAV"):
    shutil.copy(wav_path, os.environ["KEEP_WAV"])
shutil.rmtree(tmp)
print(f"OK → {os.path.relpath(VIDEO, ROOT)} (vidéo + bande-son)")
