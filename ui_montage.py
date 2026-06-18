# -*- coding: utf-8 -*-
"""Build top-crop contact sheets per page to sweep for header/nav/text overlaps."""
import os, glob
from PIL import Image

SRC = os.path.join("ui-audit", "baseline")
OUT = os.path.join("ui-audit", "montage")
os.makedirs(OUT, exist_ok=True)

VORDER = ["iphone-se","iphone-15promax","pixel7","galaxy-s","ipad-mini-p","ipad-pro11-p","ipad-landscape","galaxytab-p","galaxytab-l"]
PAGES = ["index","demo-dash","booking","login","onboarding","seo-physio"]
THUMB_W = 300
CROP_H = 1400  # top portion where headers/hero live

for page in PAGES:
    cols = []
    for v in VORDER:
        f = os.path.join(SRC, f"{page}__{v}.png")
        if not os.path.exists(f): continue
        im = Image.open(f).convert("RGB")
        crop = im.crop((0, 0, im.width, min(CROP_H, im.height)))
        scale = THUMB_W / crop.width
        thumb = crop.resize((THUMB_W, int(crop.height*scale)))
        # label strip
        lab = Image.new("RGB", (THUMB_W, 20), (20,20,20))
        canvas = Image.new("RGB", (THUMB_W, thumb.height+20), (255,255,255))
        canvas.paste(lab,(0,0)); canvas.paste(thumb,(0,20))
        cols.append((v, canvas))
    if not cols: continue
    maxh = max(c[1].height for c in cols)
    sheet = Image.new("RGB", (THUMB_W*len(cols)+8*(len(cols)+1), maxh+8), (235,235,235))
    x=8
    for _, c in cols:
        sheet.paste(c,(x,8)); x += THUMB_W+8
    outp = os.path.join(OUT, f"sheet__{page}.png")
    sheet.save(outp)
    print(f"[OK] {outp}  ({len(cols)} views, {sheet.width}x{sheet.height})")
print("done")
