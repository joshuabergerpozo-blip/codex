"""Procedural sound design for the portfolio intro, cued to the GSAP timeline.

Every cue time below mirrors a position in joshua-motion.html. Output: sound.wav (48 kHz stereo).
"""
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
LEN = 50.0
N = int(SR * LEN)
rng = np.random.default_rng(19)

dry = np.zeros((N, 2))
send = np.zeros((N, 2))  # reverb bus
bed = np.zeros((N, 2))   # music bed, ducked by impacts
duck = np.ones(N)


def tt(d):
    return np.arange(int(SR * d)) / SR


def place(buf, t, sig, gain=1.0, pan=0.0):
    if sig.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        sig = np.stack([sig * l, sig * r], axis=1) * np.sqrt(2)
    i = int(t * SR)
    j = min(N, i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def out(t, sig, gain=1.0, pan=0.0, rev=0.25):
    place(dry, t, sig, gain, pan)
    place(send, t, sig, gain * rev, pan)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def svf_sweep(x, fc, q=1.2):
    """State-variable band-pass with a per-sample cutoff curve."""
    y = np.zeros_like(x)
    low = band = 0.0
    damp = 1.0 / q
    for n in range(len(x)):
        f = 2 * np.sin(np.pi * min(fc[n], SR / 6) / SR)
        high = x[n] - low - damp * band
        band += f * high
        low += f * band
        y[n] = band
    return y


def expo_in_out(x):
    x = np.clip(x, 0, 1)
    return np.where(x < .5, 2 ** (20 * x - 10) / 2, (2 - 2 ** (-20 * x + 10)) / 2)


def cubic_in_out(x):
    x = np.clip(x, 0, 1)
    return np.where(x < .5, 4 * x ** 3, 1 - (-2 * x + 2) ** 3 / 2)


# ---------- instruments ----------
def whoosh(d, f0, f1, shape='in', q=1.4):
    t = tt(d)
    x = t / d
    env = {'in': x ** 2.2, 'out': (1 - x) ** 2.2, 'swell': np.sin(np.pi * x) ** 1.5}[shape]
    fc = f0 * (f1 / f0) ** x
    n = rng.standard_normal(len(t))
    sig = svf_sweep(n, fc, q) * env
    return sig / (np.abs(sig).max() + 1e-9)


def stereo_whoosh(t0, d, f0, f1, shape, gain, pan0=-.6, pan1=.6):
    a = whoosh(d, f0, f1, shape)
    b = whoosh(d, f0 * 1.05, f1 * 1.05, shape)
    x = np.linspace(0, 1, len(a))
    p = pan0 + (pan1 - pan0) * x
    l = (a * np.cos((p + 1) * np.pi / 4) + .3 * b)
    r = (b * np.sin((p + 1) * np.pi / 4) + .3 * a)
    sig = np.stack([l, r], axis=1)
    out(t0, sig, gain * 1.5, rev=.35)


def impact(t0, gain=1.0, f0=95, f1=38, tail=1.1):
    t = tt(tail)
    f = f1 + (f0 - f1) * np.exp(-t * 18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 220) * .5
    body = lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 9) * .9
    sig = np.tanh(1.6 * (sub + click + body))
    out(t0, sig, gain * .5, rev=.3)
    i = int(t0 * SR)
    k = np.arange(int(SR * .9))
    duck[i:i + len(k)] = np.minimum(duck[i:i + len(k)], 1 - .75 * np.exp(-k / SR * 4))


def tick(t0, gain=.25, pitch=3200, pan=0.0):
    t = tt(.05)
    sig = np.sin(2 * np.pi * pitch * t) * np.exp(-t * 160) + hp(rng.standard_normal(len(t)), 5000) * np.exp(-t * 400) * .6
    out(t0, sig, gain, pan, rev=.15)


def pop(t0, gain=.5, f0=420, f1=1300, pan=0.0):
    t = tt(.18)
    f = f0 + (f1 - f0) * (1 - np.exp(-t * 60))
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 28) * (1 - np.exp(-t * 2000))
    out(t0, sig, gain, pan, rev=.3)


def pluck(t0, freq, gain=.35, pan=0.0, decay=3.5, bright=1.0):
    t = tt(1.6)
    sig = sum((bright ** (k - 1)) / k ** 1.3 * np.sin(2 * np.pi * freq * k * t) * np.exp(-t * decay * (1 + .6 * k))
              for k in range(1, 7))
    sig *= 1 - np.exp(-t * 900)
    out(t0, sig, gain, pan, rev=.45)


def bell(t0, freq, gain=.4, pan=0.0, decay=1.2):
    t = tt(4.0)
    ratios = [(1, 1, 1), (2.76, .5, 1.6), (5.4, .25, 2.4), (8.93, .12, 3.6), (.5, .35, .8)]
    sig = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * decay * dk) for r, a, dk in ratios)
    sig *= 1 - np.exp(-t * 600)
    out(t0, sig, gain, pan, rev=.7)


def clink(t0, gain=.35, pan=0.0):
    t = tt(1.2)
    parts = [(2380, 1, 7), (5930, .6, 11), (9120, .35, 16), (3410, .5, 9)]
    sig = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in parts)
    sig += hp(rng.standard_normal(len(t)), 6000) * np.exp(-t * 300) * .4
    out(t0, sig, gain, pan, rev=.55)


def riser(t0, d, gain=.6):
    t = tt(d)
    x = t / d
    n = whoosh(d, 300, 6000, 'in', q=2.2)
    f = 110 * 2 ** (2.5 * x ** 1.5)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + .4 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    sig = n * .7 + tone * x ** 2 * .45
    out(t0, sig, gain, rev=.4)


# ---------- music bed ----------
def note(f):
    return 440 * 2 ** ((f - 69) / 12)


def pad_chord(t0, t1, midis, gain=.07):
    d = t1 - t0 + 1.5
    t = tt(d)
    env = np.minimum(1, t / 1.2) * np.clip((d - t) / 1.5, 0, 1)
    l = np.zeros(len(t))
    r = np.zeros(len(t))
    for m in midis:
        f = note(m)
        for det, side in ((-.11, 0), (.09, 1), (0, 2)):
            ph = rng.uniform(0, 2 * np.pi)
            w = 2 * ((f * (1 + det / 100) * t + ph / (2 * np.pi)) % 1) - 1  # saw
            if side == 0:
                l += w
            elif side == 1:
                r += w
            else:
                l += .5 * w
                r += .5 * w
    l = lp(l, 900, 2) * env
    r = lp(r, 900, 2) * env
    sig = np.stack([l, r], axis=1) / len(midis)
    place(bed, t0, sig, gain)
    place(send, t0, sig, gain * .5)


def kick(t0, gain=.35):
    t = tt(.35)
    f = 45 + 80 * np.exp(-t * 30)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)
    place(bed, t0, np.stack([sig, sig], 1), gain)


def hat(t0, gain=.05, pan=.2):
    t = tt(.06)
    sig = hp(rng.standard_normal(len(t)), 8000) * np.exp(-t * 90)
    place(bed, t0, sig, gain, pan)


# chords (MIDI): D minor world, resolving to D major on the outro
pad_chord(0.0, 9.05, [38, 45, 50, 57], .06)                 # D drone
pad_chord(9.05, 14.0, [46, 53, 57, 62, 65], .07)            # Bbmaj7
pad_chord(14.0, 22.95, [50, 57, 60, 65, 69], .07)           # Dm7
pad_chord(22.95, 30.5, [43, 50, 53, 58, 62], .07)           # Gm
pad_chord(30.5, 35.95, [45, 52, 55, 61, 64], .075)          # A7 (tension under Heinz × Absolut)
pad_chord(35.95, 42.75, [46, 53, 57, 60, 65], .07)          # Bb6/9
pad_chord(42.75, 49.0, [38, 50, 54, 57, 62, 66], .085)      # D major, resolution

beat = .5  # 120 BPM grid from the sommaire to the last wipe
b = 9.05
i = 0
while b < 42.3:
    if not (29.6 < b < 30.6):  # drop the pulse during the sun riser
        kick(b, .26 if b < 14 else .32)
        if b >= 14.0:
            hat(b + beat / 2, .045, .25 if i % 2 else -.25)
    b += beat
    i += 1

# ---------- sound effects, cued to the timeline ----------
# 0 · intro
pop(0.2, .55, 300, 900)
stereo_whoosh(0.85, .8, 400, 3500, 'swell', .28, -.7, .7)
impact(1.62, .85)
for k in range(6):
    tick(1.6 + .05 * k + .12, .12, 2400 + 180 * k, -.5 + .2 * k)
stereo_whoosh(2.5, .6, 4000, 600, 'in', .18, .2, .8)
tick(2.7, .18, 1800)

# 1 · Moi c'est Joshua. / 19 ans
for k in range(8):
    tick(3.4 + .03 * k + .1, .07, 3000 + 90 * k, -.4 + .1 * k)
pop(3.8, .6, 500, 1500)
stereo_whoosh(4.95, .55, 700, 5000, 'in', .22, -.3, .3)
# odometer: one tick each time a digit lands, eased like the GSAP tween
grid = np.linspace(0, 1, 4000)
prog = expo_in_out(grid) * 19
for k in range(1, 20):
    x = grid[np.argmax(prog >= k)]
    tick(5.7 + 1.8 * x, .2, 2600 + 40 * k, .15)
tick(6.0 + 1.4 * .5, .25, 1900, -.15)  # tens 0 → 1
impact(7.45, .45, 120, 55, .6)
pluck(6.95, note(62), .25)
for k, m in enumerate([69, 74, 76]):
    pluck(7.05 + .1 * k, note(m), .12, .3)

# wipe → sommaire
stereo_whoosh(8.6, .45, 500, 5000, 'in', .4, -.8, 0)
stereo_whoosh(9.05, .6, 5000, 400, 'out', .32, 0, .8)

# 2 · sommaire
for k, m in enumerate([62, 65, 69]):
    pluck(9.3 + .16 * k, note(m), .3, -.3 + .3 * k)
for k in range(3):
    tick(9.7 + .08 * k, .1, 2200)
stereo_whoosh(13.15, .6, 900, 4500, 'in', .22, .5, -.5)


def chapter(t):
    stereo_whoosh(t - .35, .4, 300, 2500, 'in', .2)
    impact(t + .12, 1.0)
    bell(t + .12, note(50), .12)
    tick(t + .5, .15, 2000)
    stereo_whoosh(t + 1.65, .6, 700, 5000, 'in', .25, -.4, .4)


# 3 · stages
chapter(14.0)
for k in range(6):
    tick(16.3 + .09 * k + .1, .07, 2600 + 120 * k)
stereo_whoosh(16.7, .9, 300, 1800, 'swell', .12)
# sonified curve: pitch follows the dot along the chart
P = np.array([[0, 150], [80, 160], [150, 330], [240, 400], [330, 470], [360, 440], [420, 320],
              [480, 200], [560, 80], [640, 56]], float)
segs = [P[0:4], P[3:7], P[6:10]]
pts = []
for s in segs:
    u = np.linspace(0, 1, 800)[:, None]
    pts.append((1 - u) ** 3 * s[0] + 3 * (1 - u) ** 2 * u * s[1] + 3 * (1 - u) * u ** 2 * s[2] + u ** 3 * s[3])
pts = np.concatenate(pts)
arc = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])
arc /= arc[-1]
d = 2.8
t = tt(d)
p = cubic_in_out(t / d)
y = np.interp(p, arc, pts[:, 1])
f = 330 * 2 ** ((240 - y) / 170)
ph = 2 * np.pi * np.cumsum(f) / SR
tone = (np.sin(ph) + .3 * np.sin(2 * ph) + .1 * np.sin(3 * ph)) * np.minimum(1, t / .15) * np.clip((d - t) / .3, 0, 1)
tone = lp(tone, 2500)
out(17.4, tone, .1, .2, rev=.5)
cross = 17.4 + t[np.argmax((y < 240) & (t > 1.0))]
bell(cross, note(74), .14, .3)
pluck(18.45, note(45), .3, -.3, decay=2.5, bright=.5)  # "Déficit": low and dull
pluck(19.95, note(81), .22, .4)                       # "Redressement": high and bright
pluck(20.05, note(86), .14, .5)
stereo_whoosh(22.5, .45, 400, 4000, 'in', .4, .8, 0)
stereo_whoosh(22.95, .6, 4000, 300, 'out', .3, 0, -.8)

# 4 · ateliers
chapter(23.0)
for k in range(5):
    tick(25.3 + .1 * k + .1, .07, 2500 + 100 * k)
for k, m in enumerate([67, 71, 74]):  # flags rise
    pluck(25.65 + .1 * k, note(m), .22, .2 + .1 * k)
bell(26.05, note(62), .3, .5, decay=.9)  # the rising sun, pentatonic koto-like
for k, m in enumerate([74, 76, 79, 81]):
    pluck(26.3 + .14 * k, note(m), .1, .6, decay=4, bright=.6)
stereo_whoosh(26.35, .5, 1200, 5000, 'swell', .12)
stereo_whoosh(29.35, .5, 800, 4000, 'in', .15)
riser(29.7, .8, .55)
impact(30.5, 1.1, 110, 34, 1.4)
stereo_whoosh(30.5, .8, 5000, 500, 'swell', .35, .9, 0)
for k in range(5):
    tick(30.85 + .05 * k + .12, .1, 2000 + 100 * k, -.6)
for k in range(7):
    tick(31.05 + .04 * k + .12, .1, 2600 + 100 * k, .6)
pop(31.35, .45, 350, 1100)
clink(31.6, .35, .2)  # glass, for the ketchup × vodka toast
for k in range(4):
    tick(31.9 + .04 * k + .1, .05, 3000)
stereo_whoosh(35.0, .5, 2000, 600, 'swell', .15)
a = whoosh(.8, 300, 3000, 'swell')
out(35.1, a, .3, -.7)
out(35.1, whoosh(.8, 3000, 300, 'swell'), .3, .7)

# 5 · projets perso
chapter(35.95)
for k in range(4):
    tick(38.2 + .12 * k + .1, .08, 2600 + 100 * k)
for k, tw in enumerate([39.3, 39.85, 40.4, 40.95]):  # split-flap word changes
    stereo_whoosh(tw, .45, 900, 3500, 'swell', .12, .3, -.3)
    tick(tw + .3, .3, 1500 + 150 * k)
    tick(tw + .33, .18, 4200)
pluck(41.0 + .45, note(74), .22)
stereo_whoosh(42.3, .45, 500, 5000, 'in', .4, -.8, 0)
stereo_whoosh(42.75, .6, 5000, 400, 'out', .3, 0, .8)

# 6 · outro
tick(42.95, .15, 1800)
impact(43.12, .9)
for k in range(6):
    tick(43.0 + .05 * k + .12, .1, 2400 + 180 * k, -.5 + .2 * k)
pop(44.15, .65, 500, 1500)
for k, m in enumerate([62, 66, 69, 74]):
    pluck(44.35 + .12 * k, note(m), .2, -.3 + .2 * k)
bell(44.75, note(74), .18, 0, decay=.6)

# ---------- mix ----------
mix = dry + bed * duck[:, None]
ir_t = tt(2.2)
ir = np.stack([rng.standard_normal(len(ir_t)), rng.standard_normal(len(ir_t))], 1) * np.exp(-ir_t * 3.0)[:, None]
ir[:, 0] = lp(ir[:, 0], 6000)
ir[:, 1] = lp(ir[:, 1], 6000)
ir /= np.sqrt((ir ** 2).sum(0))
wet = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], 1)
mix = mix + wet * .9
mix = np.stack([hp(mix[:, c], 28) for c in range(2)], 1)
fade = np.clip((LEN - np.arange(N) / SR) / 1.0, 0, 1)
mix *= fade[:, None]
mix /= np.abs(mix).max()
mix = np.tanh(mix * 1.6) / np.tanh(1.6) * .84
wavfile.write('sound.wav', SR, (mix * 32767).astype(np.int16))
print('ok', mix.shape, 'zero crossing chime at', round(float(cross), 2))
