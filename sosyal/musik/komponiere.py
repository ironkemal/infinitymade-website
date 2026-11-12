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

def streicher(f, dauer, vel=0.3, a=0.01, abkl=0.25):
    n = int(dauer * SR); t = zeit(n); y = np.zeros(n)
    for d in (-0.06, 0.05):
        fd = f * 2 ** (d / 12)
        for k in range(1, 14): y += np.sin(2 * np.pi * fd * k * t + rng.uniform(0, 6.28)) / k
    y = fft_filter(y, hi=1800)
    return y * np.minimum(t / a, 1) * np.exp(-t / abkl) * vel / 2

def taiko(vel=0.9):
    n = int(1.2 * SR); t = zeit(n); f = 38 + 70 * np.exp(-t / 0.05)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.42)
    y += fft_filter(rng.standard_normal(n), lo=150, hi=1500) * np.exp(-t / 0.04) * 0.5
    return y * vel

# --- 4. episch: Trailer, Dm, 80 bpm — Taiko, Streicher-Ostinato, Fläche (Legenden-/Kino-Format) ---
def episch():
    bpm = 80; beat = 60 / bpm; takt = 4 * beat
    akkorde = [[38, 45, 50, 53], [34, 41, 46, 50], [31, 38, 43, 46], [33, 40, 45, 49]]  # Dm Bb Gm A
    takte = 8; dauer = takte * takt; n = int(dauer * SR) + 2 * SR
    L, R = np.zeros(n), np.zeros(n)
    ost = [0, 0, 12, 0, 3, 0, 12, 0]
    for tk in range(takte):
        t0 = tk * takt; ak = akkorde[(tk // 2) % 4]
        if tk % 2 == 0:
            a, b = pan(flaeche([mf(m + 12) for m in ak], 2 * takt + 0.8, 0.2), 0); platziere(L, a, t0); platziere(R, b, t0)
            a, b = pan(bass(mf(ak[0] - 12), 2 * takt, 0.45), 0); platziere(L, a, t0); platziere(R, b, t0)
        for j, s in enumerate(ost):  # Achtel-Ostinato der tiefen Streicher
            v = 0.22 + 0.1 * (tk / takte)
            a, b = pan(streicher(mf(ak[0] + s), beat / 2 * 0.9, v), -0.25 + 0.5 * (j % 2))
            platziere(L, a, t0 + j * beat / 2); platziere(R, b, t0 + j * beat / 2)
        schlaege = [0, 2] if tk < 4 else [0, 1.5, 2, 3]
        if tk % 4 == 3: schlaege += [3.5, 3.75]
        for s in schlaege:
            a, b = pan(taiko(0.8 if s in (0, 2) else 0.5), rng.uniform(-0.2, 0.2)); platziere(L, a, t0 + s * beat); platziere(R, b, t0 + s * beat)
        if tk >= 4 and tk % 2 == 0:  # hohe Streicher, lang
            for m in ak[1:]:
                a, b = pan(streicher(mf(m + 24), 2 * takt, 0.09, a=0.6, abkl=4), 0.3); platziere(L, a, t0); platziere(R, b, t0)
    k = int(dauer * SR); fertig('episch', L[:k], R[:k], hall_anteil=0.32, lp=6000)

# --- 5. warteschleife: billige Telefon-Wartemusik, absichtlich cheesy, durch einen Telefon-Bandpass (Komik-Format) ---
def warteschleife():
    bpm = 100; beat = 60 / bpm; takt = 4 * beat
    akkorde = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]] * 2  # C Am F G
    melodie = [(0, 72, 1), (1, 76, .5), (1.5, 79, .5), (2, 77, 1), (3, 76, 1),
               (4, 74, 1.5), (5.5, 72, .5), (6, 74, 1), (7, 71, 1),
               (8, 72, .5), (8.5, 76, .5), (9, 81, 1), (10, 79, 1), (11, 77, .5), (11.5, 76, .5),
               (12, 74, 1), (13, 77, 1), (14, 76, 1.5), (15.5, 74, .5),
               (16, 72, 1), (17, 76, .5), (17.5, 79, .5), (18, 84, 1), (19, 81, 1),
               (20, 79, 1.5), (21.5, 77, .5), (22, 76, 1), (23, 74, 1),
               (24, 72, .5), (24.5, 74, .5), (25, 76, 1), (26, 79, 1), (27, 77, 1),
               (28, 74, 1), (29, 71, 1), (30, 72, 2)]
    dauer = len(akkorde) * takt; n = int(dauer * SR) + SR
    y = np.zeros(n)
    def piep(f, d, vel):  # dünner Rechteck-Synth
        m = int(d * SR); t = zeit(m)
        s = np.sign(np.sin(2 * np.pi * f * t)) * 0.5 + np.sin(2 * np.pi * f * t) * 0.5
        return s * np.minimum(t / 0.005, 1) * np.exp(-t / (d * 0.9)) * vel
    for pos, m, d in melodie: platziere(y, piep(mf(m), d * beat, 0.32), pos * beat)
    for i, ak in enumerate(akkorde):
        t0 = i * takt
        for s in range(4):
            platziere(y, bass(mf(ak[0] - 12), beat * 0.4, 0.3), t0 + s * beat)
            if s % 2:
                for m in ak: platziere(y, piep(mf(m + 12), beat * 0.3, 0.08), t0 + s * beat)
    k = int(dauer * SR); y = y[:k]
    y = fft_filter(y, lo=350, hi=3200, ordnung=3)  # Telefon
    y = y * (1 + 0.04 * np.sin(2 * np.pi * 0.7 * zeit(k)))  # leichtes Leiern
    fertig('warteschleife', y, y.copy(), hall_anteil=0.03, knistern=True)

# --- 6. traurig: langsames Moll-Klavier, 62 bpm (Drama-Fake-out, das dann kippt) ---
def traurig():
    bpm = 62; beat = 60 / bpm; takt = 4 * beat
    akkorde = [[45, 52, 57, 60], [41, 48, 53, 57], [48, 52, 55, 60], [43, 50, 55, 59]]  # Am F C G
    melodie = [(0, 76), (1.5, 74), (2, 72), (3, 71), (4, 72), (5.5, 69), (6, 72), (7, 74),
               (8, 76), (9.5, 79), (10, 77), (11, 76), (12, 74), (13.5, 71), (14, 74), (15, 72)]
    dauer = len(akkorde) * takt; n = int(dauer * SR) + 2 * SR
    L, R = np.zeros(n), np.zeros(n)
    for i, ak in enumerate(akkorde):
        t0 = i * takt
        a, b = pan(flaeche([mf(m + 12) for m in ak], takt + 0.8, 0.07), 0); platziere(L, a, t0); platziere(R, b, t0)
        a, b = pan(klavier(mf(ak[0] - 12), takt, 0.5), -0.2); platziere(L, a, t0); platziere(R, b, t0)
        for j, s in enumerate([1, 2, 3, 2]):
            a, b = pan(klavier(mf(ak[s]), 2.4, 0.22), rng.uniform(-0.3, 0.3)); ts = t0 + j * beat + human()
            platziere(L, a, ts); platziere(R, b, ts)
    for pos, m in melodie:
        a, b = pan(klavier(mf(m), 2.6, 0.42), 0.15); platziere(L, a, pos * beat + human()); platziere(R, b, pos * beat + human())
    k = int(dauer * SR); fertig('traurig', L[:k], R[:k], hall_anteil=0.4, lp=6500)

# --- 7. museum: 3/4, 60 bpm, spärliches Klavier über Streicherfläche — Audioguide, nachts im Museum ---
def museum():
    bpm = 60; beat = 60 / bpm; takt = 3 * beat
    akkorde = [[43, 59, 62, 66], [38, 57, 61, 64], [43, 59, 62, 66], [40, 55, 59, 62],
               [36, 55, 59, 64], [38, 54, 57, 62], [43, 59, 62, 66], [38, 57, 61, 66]]  # Gmaj7 D Gmaj7 Em … C D
    melodie = [(1, 78), (2, 76), (4, 74), (6.5, 76), (7, 73), (9, 71),
               (13, 78), (14, 76), (16, 79), (18.5, 76), (19, 74), (21, 73), (22, 74)]
    dauer = len(akkorde) * takt; n = int(dauer * SR) + 2 * SR
    L, R = np.zeros(n), np.zeros(n)
    for i, ak in enumerate(akkorde):
        t0 = i * takt
        a, b = pan(flaeche([mf(m) for m in ak[1:]], takt + 0.8, 0.06), 0); platziere(L, a, t0); platziere(R, b, t0)
        a, b = pan(klavier(mf(ak[0]), takt, 0.42), -0.3); platziere(L, a, t0 + human()); platziere(R, b, t0)
        for s in (1, 2):
            for m in ak[1:]:
                a, b = pan(klavier(mf(m), 1.6, 0.13), 0.1); platziere(L, a, t0 + s * beat + human()); platziere(R, b, t0 + s * beat)
    for pos, m in melodie:
        a, b = pan(klavier(mf(m), 3, 0.36), 0.25); platziere(L, a, pos * beat + human()); platziere(R, b, pos * beat + human())
    k = int(dauer * SR); fertig('museum', L[:k], R[:k], hall_anteil=0.55, lp=5500)

# --- 8. doku: Naturfilm, 92 bpm, Pizzicato auf Zehenspitzen + warme Streicher, Glockenspiel-Akzente ---
def doku():
    bpm = 92; beat = 60 / bpm; takt = 4 * beat
    akkorde = [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]] * 2  # Am F G E
    schleich = [0, None, 2, None, 1, 2, None, 0]  # Achtel, Pausen = Zehenspitzen
    dauer = len(akkorde) * takt; n = int(dauer * SR) + 2 * SR
    L, R = np.zeros(n), np.zeros(n)
    for i, ak in enumerate(akkorde):
        t0 = i * takt
        for m in ak:
            a, b = pan(streicher(mf(m + 12), takt + 0.4, 0.07, a=0.5, abkl=3), rng.uniform(-0.3, 0.3)); platziere(L, a, t0); platziere(R, b, t0)
        a, b = pan(pluck(mf(ak[0] - 12), 0.55), -0.2); platziere(L, a, t0); platziere(R, b, t0)
        a, b = pan(pluck(mf(ak[0] - 12), 0.4), -0.2); platziere(L, a, t0 + 2 * beat); platziere(R, b, t0 + 2 * beat)
        for j, s in enumerate(schleich):
            if s is None: continue
            m = ak[s] + 12 + (12 if i >= 4 and j == 6 else 0)
            a, b = pan(pluck(mf(m), rng.uniform(0.3, 0.42)), rng.uniform(-0.5, 0.5))
            platziere(L, a, t0 + j * beat / 2 + human()); platziere(R, b, t0 + j * beat / 2 + human())
        if i % 2 == 1:
            a, b = pan(klavier(mf(ak[2] + 36), 1.5, 0.12), 0.4); platziere(L, a, t0 + 3.5 * beat); platziere(R, b, t0 + 3.5 * beat)
    k = int(dauer * SR); fertig('doku', L[:k], R[:k], hall_anteil=0.3, lp=7000)

# --- Klangeffekte (sosyal/musik/klang/*.wav), im Video per Szene: "klang": [{"art": "boom", "bei": 0}] ---
def klaenge():
    ordner = os.path.join(HIER, 'klang'); os.makedirs(ordner, exist_ok=True)
    def schreib(name, y, hall_anteil=0.3):
        y = y + hall(y, dauer=3, tau=0.8) * hall_anteil * 4
        y = np.tanh(y / np.abs(y).max() * 1.2); y = y / np.abs(y).max() * 0.89
        st = np.stack([y, y], 1)
        with wave.open(os.path.join(ordner, f'{name}.wav'), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
        print('ok klang', name, f'{len(y) / SR:.1f} s')
    # boom: Trailer-Einschlag
    n = int(3.5 * SR); t = zeit(n); f = 28 + 60 * np.exp(-t / 0.12)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.1)
    y += fft_filter(rng.standard_normal(n), hi=500) * np.exp(-t / 0.15) * 0.8
    schreib('boom', y, 0.35)
    # braam: tiefer, verzerrter Blechakkord
    n = int(3.2 * SR); t = zeit(n); y = np.zeros(n)
    for m in (26, 33, 38, 45):
        for k in range(1, 30): y += np.sin(2 * np.pi * mf(m) * k * t * (1 + rng.uniform(-.002, .002))) / k
    y = np.tanh(fft_filter(y, hi=900) * 0.5) * np.minimum(t / 0.05, 1) * np.exp(-t / 1.4)
    schreib('braam', y, 0.3)
    # riser: Rauschen + Gleitton, schwillt 3 s an, endet hart
    n = int(3 * SR); t = zeit(n); p = t / 3
    teile = [fft_filter(rng.standard_normal(n), lo=200 + 4000 * q, hi=800 + 9000 * q) for q in np.linspace(0, 1, 6)]
    rausch = sum(tl * np.clip(1 - np.abs(p * 5 - i), 0, 1) for i, tl in enumerate(teile))
    ton = np.sin(2 * np.pi * np.cumsum(180 * 2 ** (p * 2.6)) / SR) * 0.4
    y = (rausch + ton) * p ** 2.2; y[-int(.01 * SR):] *= np.linspace(1, 0, int(.01 * SR))
    schreib('riser', y, 0.15)
    # whoosh
    n = int(0.9 * SR); t = zeit(n); p = t / 0.9
    y = fft_filter(rng.standard_normal(n), lo=300, hi=3000) * np.sin(np.pi * p) ** 2
    schreib('whoosh', y, 0.2)
    # bip: zweifacher App-Ton
    n = int(0.5 * SR); t = zeit(n); y = np.zeros(n)
    for s, f in ((0, 1568), (0.12, 2093)):
        i = int(s * SR); tt = t[: n - i]; y[i:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.06) * np.minimum(tt / 0.003, 1)
    schreib('bip', y, 0.05)
    # ding: helle Glocke
    n = int(2 * SR); t = zeit(n); y = np.zeros(n)
    for k, (r, a) in enumerate(((1, 1), (2.76, .4), (5.4, .2), (8.9, .1))):
        y += np.sin(2 * np.pi * 1320 * r * t) * a * np.exp(-t * (1.6 + k))
    schreib('ding', y * np.minimum(t / .002, 1), 0.2)
    # klick: Hörer wird abgenommen
    n = int(0.25 * SR); t = zeit(n)
    y = fft_filter(rng.standard_normal(n), lo=800, hi=6000) * np.exp(-t / 0.012) + np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.03) * 0.4
    schreib('klick', y, 0.05)
    # schock: Platten-Kratzer (Musik bricht ab)
    n = int(0.6 * SR); t = zeit(n); f = 900 * np.exp(-t / 0.15) + 80
    y = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t / 0.25) * 0.6 + fft_filter(rng.standard_normal(n), lo=1500) * np.exp(-t / 0.2) * 0.4
    schreib('kratzer', y, 0.05)
    # fax: Modem-Handshake (CNG-Pieps, 2100-Hz-Antwort, Zwitschern, Rauschen)
    teile = []
    def ton(f, d, v=.5): t = zeit(int(d * SR)); return np.sin(2 * np.pi * f * t) * v
    teile += [ton(1100, .5), np.zeros(int(.25 * SR)), ton(2100, .9, .4)]
    for _ in range(14): teile.append(ton(rng.choice([980, 1180, 1650, 1850, 2400]), rng.uniform(.04, .1), .45))
    t = zeit(int(1.1 * SR)); teile.append(fft_filter(rng.standard_normal(len(t)), lo=600, hi=3400) * .35 * (1 + .5 * np.sign(np.sin(2 * np.pi * 9 * t))))
    y = np.concatenate(teile); y = fft_filter(y, lo=300, hi=3400)
    schreib('fax', y, 0.02)

if __name__ == '__main__':
    import sys
    wahl = sys.argv[1:] or ['ruhig', 'warm', 'leicht', 'episch', 'klaenge']
    for w in wahl: globals()[w]()
