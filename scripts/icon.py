"""Pomodio app icon: pixel tomato setting over a tiny park at dusk.
Drawn on a 32x32 grid, upscaled nearest-neighbour, masked to a rounded square.
Pure stdlib PNG writer (no PIL). Not part of the build: the favicon (64) and apple-touch-icon (192 --square) are
inlined as base64 data URIs in index.html, so re-encode them there after changes.
Usage: python3 scripts/icon.py out.png [size] [--square]
  --square: opaque, unmasked (apple-touch-icon; iOS applies its own mask)."""
import math, struct, sys, zlib

N = 32
def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i+2], 16) for i in (0, 2, 4))
P = {k: hx(v) for k, v in dict(
    sky0='#1a1430', sky1='#2a1d48', sky2='#4a2a5e', sky3='#83405f', sky4='#c8635a', sky5='#f0955f',
    star='#f6efe3', starD='#8a7fb0',
    out='#4a1022', tomD='#b32a2e', tom='#e5473a', tomL='#ff7a58', tomH='#ffd0b0',
    leafD='#1f5a33', leaf='#3f9a4a', leafL='#7fd06a',
    gr0='#1c3a2c', gr1='#2c5a3a', gr2='#478a46', gr3='#7cc45e',
    trD='#173d2a', tr='#2d6e3c', trL='#56a04c', trunk='#4a2e22',
    path='#c9a27a', pathD='#8e6a50',
    lamp='#2a2238', glow='#ffd58a', glowS='#ffb46b',
    hand='#f6efe3',
).items()}

g = [[None] * N for _ in range(N)]
def px(x, y, c):
    if 0 <= x < N and 0 <= y < N: g[y][x] = P[c]

# Sky: banded dusk gradient with 2px checker dither between bands.
bands = [(0, 'sky0'), (6, 'sky1'), (11, 'sky2'), (15, 'sky3'), (18, 'sky4'), (21, 'sky5')]
for y in range(N):
    for x in range(N):
        c = bands[0][1]
        for i, (start, name) in enumerate(bands):
            if y >= start: c = name
        px(x, y, c)
for x, y, c in [(4, 3, 'star'), (9, 6, 'starD'), (25, 4, 'star'), (28, 9, 'starD'), (6, 10, 'starD'), (22, 2, 'starD')]:
    px(x, y, c)

# Tomato sun: oblate disc with outline, concentric shading from upper-left light.
cx, cy, rx, ry = 16.0, 15.0, 10.0, 9.0
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
for y in range(N):
    for x in range(N):
        d = math.hypot((x + .5 - cx) / rx, (y + .5 - cy) / ry)
        if 1 < d < 1.13: g[y][x] = mix(g[y][x], P['tomL'], .45)
for y in range(N):
    for x in range(N):
        dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry
        d = math.hypot(dx, dy)
        if d > 1: continue
        if d > 1 - 1.1 / ry: px(x, y, 'out'); continue
        lx, ly = dx + .38, dy + .42
        l = math.hypot(lx, ly)
        px(x, y, 'tomL' if l < .38 else 'tom' if l < .95 else 'tomD')
for x, y in [(10, 10), (11, 10), (10, 11), (12, 9), (13, 9)]:
    px(x, y, 'tomH')
# Calyx: stem + five drooping sepals.
for x, y, c in [(16, 2, 'leafL'), (16, 3, 'leaf'), (16, 4, 'leafD'), (17, 2, 'leafD'), (17, 3, 'leafD')]:
    px(x, y, c)
CALYX = ["....dlLld....",
         "..ddllLlldd..",
         ".d...dld...d."]
for j, row in enumerate(CALYX):
    for i, ch in enumerate(row):
        if ch != '.': px(10 + i, 5 + j, {'d': 'leafD', 'l': 'leaf', 'L': 'leafL'}[ch])

# Rolling grass hill.
for x in range(N):
    top = round(22.6 + 1.6 * math.sin((x + 3) / 5.2) + .9 * math.cos(x / 2.7))
    for y in range(top, N):
        depth = y - top
        px(x, y, 'gr3' if depth == 0 else 'gr2' if depth < 3 else 'gr1' if depth < 6 else 'gr0')
# Winding path.
for y in range(25, N):
    t = (y - 25) / 6
    xc = 16 + 3 * math.sin(t * 2.4)
    w = .8 + t * 2.2
    for x in range(N):
        if abs(x + .5 - xc) <= w: px(x, y, 'pathD' if x + .5 - xc > w - 1 else 'path')
# Round trees.
def tree(tx, ty, rr):
    for y in range(ty - rr - 1, ty + rr + 1):
        for x in range(tx - rr - 1, tx + rr + 1):
            dx, dy = x + .5 - tx, y + .5 - ty
            d = math.hypot(dx, dy)
            if d <= rr: px(x, y, 'trL' if dx + dy < -rr * .6 else 'trD' if dx + dy > rr * .5 or d > rr - .8 else 'tr')
    for y in range(ty + rr - 1, ty + rr + 2):
        px(tx, y, 'trunk')
tree(5, 19, 4)
tree(9, 22, 2)
tree(29, 22, 3)

# Lamp post with warm lantern.
lx, ly = 25, 20
for y in range(ly + 3, 28): px(lx, y, 'lamp')
for x in (lx - 1, lx, lx + 1): px(x, ly, 'lamp'); px(x, ly + 3, 'lamp')
for y in (ly + 1, ly + 2): px(lx - 1, y, 'glowS'); px(lx, y, 'glow'); px(lx + 1, y, 'glowS')
px(lx, ly - 1, 'lamp')
for y in range(ly - 3, ly + 7):
    for x in range(lx - 4, lx + 5):
        d = math.hypot(x - lx, (y - ly - 1.5) * 1.1)
        if 1.6 < d < 3.8 and g[y][x] not in (P['lamp'], P['out']):
            g[y][x] = mix(g[y][x], P['glow'], .3 * (3.8 - d) / 2.2)

# --- upscale + rounded-square mask + PNG ---
args = [a for a in sys.argv[1:] if a != '--square']
square = '--square' in sys.argv
S = int(args[1]) if len(args) > 1 else 1024
cell = S / N
rad, n = S * 0.225, 5.0  # superellipse corner (iOS-ish)
rows = bytearray()
for Y in range(S):
    rows.append(0)
    gy = min(N - 1, int(Y / cell))
    for X in range(S):
        # superellipse mask with 1px AA
        ax = max(0.0, abs(X + .5 - S / 2) - (S / 2 - rad)) / rad
        ay = max(0.0, abs(Y + .5 - S / 2) - (S / 2 - rad)) / rad
        e = (ax ** n + ay ** n) ** (1 / n)
        a = 1.0 if square else max(0.0, min(1.0, (1 - e) * rad + .5))
        r_, g_, b_ = g[gy][min(N - 1, int(X / cell))]
        rows += bytes((r_, g_, b_, int(a * 255)))
def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 6, 0, 0, 0)) \
    + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b'')
open(args[0], 'wb').write(png)
