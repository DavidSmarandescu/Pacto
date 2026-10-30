# Extrae los centros de los puntos del mapa de referencia y genera un SVG recoloreable.
import sys, random
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('L'); W, H = im.size; px = im.load()
seen = [[False]*H for _ in range(W)]; cents = []
for x in range(W):
    for y in range(H):
        if px[x, y] < 128 and not seen[x][y]:
            st = [(x, y)]; seen[x][y] = True; pts = []
            while st:
                a, b = st.pop(); pts.append((a, b))
                for c, d in ((a+1, b), (a-1, b), (a, b+1), (a, b-1)):
                    if 0 <= c < W and 0 <= d < H and not seen[c][d] and px[c, d] < 128:
                        seen[c][d] = True; st.append((c, d))
            if len(pts) >= 4:
                cents.append((sum(p[0] for p in pts)/len(pts), sum(p[1] for p in pts)/len(pts), len(pts)))
print(len(cents), 'puntos', file=sys.stderr)
random.seed(7)
circ = []
for cx, cy, n in cents:
    r = random.random()
    cls = 'g' if r < 0.035 else ('m' if r < 0.25 else 'd')
    circ.append(f'<circle class="{cls}" cx="{cx:.1f}" cy="{cy:.1f}" r="2.6"/>')
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">'
       '<style>.d{fill:#3B6FD8;opacity:.22}.m{fill:#5B8DEF;opacity:.38}.g{fill:#5FE3FF;opacity:.9}</style>'
       + ''.join(circ) + '</svg>')
open(out, 'w').write(svg)
