# Paint cumulus cloud banks as transparent PNGs: many overlapping puffs, each
# lit from above with a cool underside, edges roughened with noise.
#   python3 landing/tools/make-clouds.py
import numpy as np
from PIL import Image, ImageFilter

W, H, SS = 2600, 820, 1   # canvas

def noise(w, h, seed, base=8, octaves=5):
    rng = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp = 1; tot = 0
    for o in range(octaves):
        gw = base * 2 ** o + 1; gh = max(2, int(gw * h / w) + 1)
        g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * np.asarray(g, np.float32) / 255; tot += amp; amp *= 0.55
    return out / tot

def bank(seed, rows, light=(255, 255, 255), mid=(238, 244, 251), dark=(196, 212, 234)):
    rng = np.random.default_rng(seed)
    col = np.ones((H, W, 3), np.float32) * np.array(mid, np.float32); alpha = np.zeros((H, W), np.float32)
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    puffs = []
    for (base_y, r_lo, r_hi, n) in rows:                # back rows first
        for i in range(n):
            cx = (i + rng.uniform(-0.35, 0.35)) / (n - 1) * W * 1.1 - W * 0.05
            r = rng.uniform(r_lo, r_hi) * rng.choice([0.7, 1.0, 1.0, 1.25]); cy = base_y + rng.uniform(-0.2, 0.2) * r
            puffs.append((cx, cy, r))
    for cx, cy, r in puffs:
        x0, x1 = int(max(0, cx - r - 4)), int(min(W, cx + r + 4)); y0, y1 = int(max(0, cy - r - 4)), int(min(H, cy + r * 1.2))
        if x1 <= x0 or y1 <= y0: continue
        xs, ys = x[y0:y1, x0:x1], y[y0:y1, x0:x1]
        dx, dy = (xs - cx) / r, (ys - cy) / (r * 0.9)
        d = np.sqrt(dx * dx + dy * dy)
        a = np.clip((1 - d) * 3.2, 0, 1)                  # soft but defined edge
        shade = np.clip(0.62 - dy * 0.5 - dx * 0.08, 0, 1)  # lit from above-left
        rim = np.clip((d - 0.78) / 0.22, 0, 1) * np.clip(-dy, 0, 1) * 0.25
        k = np.clip(shade + rim, 0, 1)[..., None]
        c = np.array(dark) + (np.array(mid) - np.array(dark)) * np.clip(k * 1.6, 0, 1) + (np.array(light) - np.array(mid)) * np.clip(k * 2 - 1, 0, 1)
        sl = (slice(y0, y1), slice(x0, x1))
        col[sl] = col[sl] * (1 - a[..., None]) + c * a[..., None]
        alpha[sl] = np.maximum(alpha[sl], a)
    # base fills downward so the bank has no holes at the bottom
    fill = np.clip((y - H * 0.72) / (H * 0.12), 0, 1)
    col = col * (1 - fill[..., None] * (1 - alpha[..., None])) + np.array(mid) * fill[..., None] * (1 - alpha[..., None])
    alpha = np.maximum(alpha, fill)
    # roughen edges and add a painterly grain
    n = noise(W, H, seed + 7, base=22)
    alpha = np.clip(alpha + (n - 0.5) * 0.5 * (alpha * (1 - alpha)) * 4, 0, 1)
    grain = (noise(W, H, seed + 9, base=90, octaves=3) - 0.5) * 10
    col = np.clip(col + grain[..., None], 0, 255)
    img = Image.fromarray(np.dstack([col, alpha * 255]).astype(np.uint8))
    return img.filter(ImageFilter.GaussianBlur(4))

front = bank(5, [(560, 170, 260, 11), (700, 150, 230, 13)], light=(255, 255, 255), mid=(252, 253, 255), dark=(232, 237, 245))
back = bank(9, [(420, 150, 240, 10), (560, 130, 210, 12)], light=(253, 254, 255), mid=(246, 249, 252), dark=(228, 234, 243))
front.save('landing/assets/clouds-front.png', optimize=True); back.save('landing/assets/clouds-back.png', optimize=True)
print('ok')
