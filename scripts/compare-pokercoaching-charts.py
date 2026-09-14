# Draws extracted charts next to the original PDF images, so you can check the extraction by eye.
#
# Usage:  .venv/bin/python scripts/compare-pokercoaching-charts.py <pdf> <report_dir>/<game>-extraction.json "<chart name>" ...
#         e.g. "MTT 12bb UTG RFI". Charts whose only action is Call are always included.
# Writes cmp-<name>.png files to the current directory: original on top, extraction below.
import json, os, sys, warnings
import numpy as np, pymupdf
from PIL import Image
warnings.filterwarnings("ignore")
PDF, EXTRACTION = sys.argv[1], sys.argv[2]
WANTED = sys.argv[3:]
COLORS = {"All in": (88, 21, 21), "Raise": (240, 59, 60), "Call": (90, 186, 102), "Fold": (59, 124, 185)}
doc = pymupdf.open(PDF)
charts = json.load(open(EXTRACTION))
targets = [c for c in charts if c["name"] in WANTED or list(c["computed"]) == ["Call"]]

def runs(mask, min_len):
    out, start = [], None
    for i, v in enumerate(list(mask) + [False]):
        if v and start is None: start = i
        if not v and start is not None:
            if i - start >= min_len: out.append((start, i))
            start = None
    return out

for c in targets:
    page = doc[c["page"] - 1]
    titles = [(" ".join(s["text"].strip() for s in l["spans"] if s["text"].strip()), l["bbox"])
              for b in page.get_text("dict")["blocks"] for l in b.get("lines", [])]
    tb = next(t[1] for t in titles if t[0] == c["title"])
    info = min((i for i in page.get_image_info(xrefs=True)
                if i["width"] >= 600 and i["bbox"][1] >= tb[3] - 2 and abs(i["bbox"][0] - tb[0]) < 40),
               key=lambda i: i["bbox"][1])
    pix = pymupdf.Pixmap(doc, info["xref"]); pix = pix if pix.n == 3 else pymupdf.Pixmap(pymupdf.csRGB, pix)
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3)
    a = pymupdf.Pixmap(doc, doc.extract_image(info["xref"])["smask"])
    opaque = np.frombuffer(a.samples, np.uint8).reshape(a.height, a.width) > 128
    if img.shape[:2] != opaque.shape:
        img = np.asarray(Image.fromarray(img).resize((a.width, a.height), Image.NEAREST))
    rows = runs(opaque.mean(1) > 0.02, 20)[1:]
    cols = runs(opaque[rows[0][0]:].mean(0) > 0.02, 20)
    freqs = json.load(open(c["path"]))["frequencies"]
    recon = np.full_like(img, 255)
    for r, (y0, y1) in enumerate(rows):
        for col, (x0, x1) in enumerate(cols):
            f = freqs[r * 13 + col]
            if f is None:
                recon[y0:y1, x0:x1] = 0
                continue
            x = x0
            for action, share in f.items():
                w = round(share * (x1 - x0))
                recon[y0:y1, x:x + w] = COLORS[action]
                x += w
            if x < x1: recon[y0:y1, x:x1] = COLORS[list(f)[-1]]
    both = np.concatenate([img, np.full((12, img.shape[1], 3), 128, np.uint8), recon], axis=0)
    out = "cmp-" + c["name"].replace(" ", "_").replace("+", "p") + ".png"
    Image.fromarray(both).resize((720, both.shape[0] * 720 // img.shape[1])).save(out)
    print(f"wrote {out}  (p{c['page']} {c['title']}, computed={c['computed']}, {c['check']})")
