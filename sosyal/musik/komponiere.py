# Komponiert die Praxura-Hintergrundmusik selbst: drei kurze, loopbare Stücke, deterministisch (fester Seed).
# Eigene Komposition → keine Lizenz, kein Content-ID-Risiko.
# Aufruf: python sosyal/musik/komponiere.py   → sosyal/musik/{ruhig,warm,leicht}.wav (danach normalisiert erzeuge.mjs nichts —
# die Lautheit wird hier per ffmpeg loudnorm auf -16 LUFS gebracht)
import numpy as np, wave, subprocess, os

SR = 44100
HIER = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(302)

def mf(m): return 440.0 * 2 ** ((m - 69) / 12)
def zeit(n): return np.arange(n) / SR

def fft_filter(x, lo=None, hi=None, ordnung=2):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR); g = np.ones_like(f)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** (2 * ordnung))
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * ordnung))
    return np.fft.irfft(X * g, n)

def hall(x, dauer=2.2, tau=0.55, hi=4500):
    n = int(dauer * SR); t = zeit(n)
    ir = rng.standard_normal(n) * np.exp(-t / tau); ir = fft_filter(ir, hi=hi); ir /= np.abs(ir).sum() ** 0.5 * 40
    m = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:len(x)]
    return y

def platziere(spur, ton, start):
    i = max(0, int(start * SR))
    if i >= len(spur): return
    e = min(len(spur), i + len(ton)); spur[i:e] += ton[:e - i]

# --- Klangerzeuger -------------------------------------------------------
def klavier(f, dauer, vel=0.6):
    n = int(dauer * SR); t = zeit(n); y = np.zeros(n)
    for k in range(1, 8):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 12000: break
        y += np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * (1 / k ** 1.6) * np.exp(-t * (0.9 + 0.55 * k))
    y *= np.minimum(t / 0.004, 1) * vel
    y[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return y

def rhodes(f, dauer, vel=0.5):
    n = int(dauer * SR); t = zeit(n)
    index = 1.6 * np.exp(-t / 0.35)
    y = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t)) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.4)
    y *= np.minimum(t / 0.006, 1) * np.exp(-t / 1.6) * vel * (1 + 0.08 * np.sin(2 * np.pi * 4.5 * t))
    y[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
    return y

def pluck(f, vel=0.5):
    n = int(0.6 * SR); t = zeit(n)
    y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.03)
         + 0.15 * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t / 0.18)
    return y * np.minimum(t / 0.002, 1) * vel

def flaeche(freqs, dauer, vel=0.12):
    n = int(dauer * SR); t = zeit(n); y = np.zeros(n)
    for f in freqs:
        for d in (-0.08, 0, 0.07):
            fd = f * 2 ** (d / 12)
            for k in range(1, 7): y += np.sin(2 * np.pi * fd * k * t + rng.uniform(0, 6.28)) / k
    huelle = np.minimum(t / 0.9, 1) * np.minimum((dauer - t) / 0.9, 1)
    return fft_filter(y, hi=1100) * huelle * vel / len(freqs)

def bass(f, dauer, vel=0.35):
    n = int(dauer * SR); t = zeit(n)
    y = np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * 2 * f * t)
    return y * np.minimum(t / 0.01, 1) * np.minimum((dauer - t) / 0.05, 1).clip(0, 1) * vel

def kick(vel=0.8):
    n = int(0.45 * SR); t = zeit(n); f = 46 + 90 * np.exp(-t / 0.035)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22) * vel

def hat(vel=0.12, lang=0.03):
    n = int(0.15 * SR); t = zeit(n)
    return fft_filter(rng.standard_normal(n), lo=7000) * np.exp(-t / lang) * vel

def klatsch(vel=0.3):
    n = int(0.35 * SR); t = zeit(n)
    y = fft_filter(rng.standard_normal(n), lo=1200, hi=5000) * np.exp(-t / 0.09)
    y += 0.3 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    return y * vel

# --- Mastering -----------------------------------------------------------
def fertig(name, links, rechts, hall_anteil=0.25, lp=None, knistern=False):
    for s in (links, rechts):
        pass
    L = links + hall(links) * hall_anteil * 4
    R = rechts + hall(rechts) * hall_anteil * 4
    if lp: L, R = fft_filter(L, hi=lp), fft_filter(R, hi=lp)
    if knistern:
        for s in (L, R):
            idx = rng.integers(0, len(s), size=int(len(s) / SR * 9)); s[idx] += rng.uniform(-0.04, 0.04, len(idx))
    st = np.stack([L, R], 1); st = np.tanh(st / np.abs(st).max() * 1.4) * 0.9
    # sanfter Loop-Übergang: Anfang/Ende 40 ms blenden
    k = int(0.04 * SR); st[:k] *= np.linspace(0, 1, k)[:, None]; st[-k:] *= np.linspace(1, 0, k)[:, None]
    roh = os.path.join(HIER, f'_{name}.wav'); ziel = os.path.join(HIER, f'{name}.wav')
    with wave.open(roh, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', roh, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=9',
                    '-ar', str(SR), ziel], check=True)
    os.remove(roh)
    print('ok', ziel, f'{len(st) / SR:.1f} s')

def pan(ton, p):  # p -1..1
    return ton * np.sqrt((1 - p) / 2), ton * np.sqrt((1 + p) / 2)

def human(): return rng.uniform(-0.008, 0.008)

# --- 1. ruhig: Klavier-Arpeggio über Fläche, 72 bpm (Storytelling, Teaser) ---
def ruhig():
    bpm = 72; beat = 60 / bpm; takt = 4 * beat
    akkorde = [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 47, 52, 57]]  # Dmaj7 Bm7 Gmaj7 Asus2
    dauer = len(akkorde) * 2 * takt; n = int(dauer * SR) + SR
    L, R = np.zeros(n), np.zeros(n)
    muster = [0, 2, 3, 1, 2, 3, 1, 2]
    for i, ak in enumerate(akkorde):
        t0 = i * 2 * takt
        a, b = pan(flaeche([mf(m + 12) for m in ak], 2 * takt + 0.6), 0); platziere(L, a, t0); platziere(R, b, t0)
        a, b = pan(klavier(mf(ak[0] - 12), 2 * takt, 0.55), -0.2); platziere(L, a, t0); platziere(R, b, t0)
        for tk in range(2):
            for j, s in enumerate(muster):
                m = ak[s] + 12 + (12 if (tk == 1 and j in (3, 6)) else 0)
                ton = klavier(mf(m), 2.2, rng.uniform(0.28, 0.42))
                a, b = pan(ton, rng.uniform(-0.4, 0.4))
                ts = t0 + tk * takt + j * beat / 2 + human()
                platziere(L, a, ts); platziere(R, b, ts)
    k = int(dauer * SR); fertig('ruhig', L[:k], R[:k], hall_anteil=0.35, lp=7000)

# --- 2. warm: Lo-Fi, Rhodes + weicher Beat, 84 bpm (Wissen, Frage, Vergleich) ---
def warm():
    bpm = 84; beat = 60 / bpm; takt = 4 * beat
    akkorde = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]  # Fmaj7 Em7 Dm7 Cmaj7
    dauer = len(akkorde) * 2 * takt; n = int(dauer * SR) + SR
    L, R = np.zeros(n), np.zeros(n)
    for i, ak in enumerate(akkorde):
        for tk in range(2):
            t0 = (i * 2 + tk) * takt
            for j, m in enumerate(ak):
                ton = rhodes(mf(m), takt * 0.95, 0.32)
                a, b = pan(ton, -0.3 + 0.2 * j); platziere(L, a, t0 + j * 0.012); platziere(R, b, t0 + j * 0.012)
            if tk == 1:  # kleine Antwort im zweiten Takt
                for j, s in enumerate([3, 2]):
                    ton = rhodes(mf(ak[s] + 12), beat * 1.5, 0.18)
                    a, b = pan(ton, 0.35); platziere(L, a, t0 + (2.5 + j) * beat); platziere(R, b, t0 + (2.5 + j) * beat)
            b_ = bass(mf(ak[0] - 12), takt * 0.9); platziere(L, b_ * .7, t0); platziere(R, b_ * .7, t0)
            for s in range(4):
                ts = t0 + s * beat
                if s in (0, 2): platziere(L, kick(0.55), ts); platziere(R, kick(0.55), ts)
                if s in (1, 3): a, b = pan(klatsch(0.16), 0.1); platziere(L, a, ts); platziere(R, b, ts)
                for h in range(2):
                    th = ts + h * beat * 0.58 + human()  # Swing
                    a, b = pan(hat(0.07 if h else 0.09), 0.35); platziere(L, a, th); platziere(R, b, th)
            if tk == 1: platziere(L, kick(0.35), t0 + 2.5 * beat); platziere(R, kick(0.35), t0 + 2.5 * beat)
    k = int(dauer * SR); fertig('warm', L[:k], R[:k], hall_anteil=0.18, lp=5200, knistern=True)

# --- 3. leicht: verspielte Plucks + Klatschen, 112 bpm (POV, Komik, Countdown) ---
def leicht():
    bpm = 112; beat = 60 / bpm; takt = 4 * beat
    akkorde = [[48, 52, 55], [47, 50, 55], [45, 48, 52], [41, 45, 48]]  # C  G/B  Am  F
    motiv = [(0, 76), (0.5, 79), (1, 81), (1.75, 79), (2.5, 76), (3, 74)]
    antwort = [(0, 72), (0.5, 74), (1, 76), (2, 79), (2.5, 76)]
    takte = 12; dauer = takte * takt; n = int(dauer * SR) + SR
    L, R = np.zeros(n), np.zeros(n)
    for tk in range(takte):
        t0 = tk * takt; ak = akkorde[tk % 4]
        b_ = bass(mf(ak[0] - 12), beat * 0.45, 0.4)
        for s in (0, 1.5, 2, 3.5):
            platziere(L, b_, t0 + s * beat); platziere(R, b_, t0 + s * beat)
        for s in (0.5, 1.5, 2.5, 3.5):  # Nachschlag-Akkord
            for m in ak:
                a, b = pan(pluck(mf(m + 12), 0.14), -0.3); platziere(L, a, t0 + s * beat); platziere(R, b, t0 + s * beat)
        if tk >= 2:  # Melodie ab Takt 3
            phrase = motiv if (tk // 2) % 2 == 0 else antwort
            versatz = 0 if tk % 2 == 0 else -2
            for pos, m in phrase:
                a, b = pan(pluck(mf(m + versatz), rng.uniform(0.3, 0.38)), 0.25)
                platziere(L, a, t0 + pos * beat + human()); platziere(R, b, t0 + pos * beat + human())
        for s in range(4):
            ts = t0 + s * beat
            if s in (0, 2): platziere(L, kick(0.5), ts); platziere(R, kick(0.5), ts)
            if s in (1, 3) and tk >= 1: a, b = pan(klatsch(0.22), 0); platziere(L, a, ts); platziere(R, b, ts)
            for h in range(4):
                a, b = pan(hat(0.05, 0.015), 0.5); platziere(L, a, ts + h * beat / 4); platziere(R, b, ts + h * beat / 4)
    k = int(dauer * SR); fertig('leicht', L[:k], R[:k], hall_anteil=0.15, lp=9000)

if __name__ == '__main__':
    ruhig(); warm(); leicht()
