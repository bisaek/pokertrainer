# Extracts every chart from PokerCoaching's free "Ultimate Cash Game Preflop Guide" and
# "Ultimate Tournament Preflop Guide" PDFs into range files for the trainer.
#
# Each chart cell shows colored bars sized by how often each action is taken. This measures
# those bars, gives every hand its most frequent action ("range"), keeps the measured
# frequencies ("frequencies"), and marks hands that never reach the spot as null.
# For charts where every hand is in range, the totals are checked against the percentages
# printed in the chart header (read with tesseract, if installed).
#
# Setup:  python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
#         (optional) install tesseract for the header check
# Usage:  .venv/bin/python scripts/extract-pokercoaching-charts.py <pdf> <cash|mtt> <report_dir> public/ranges [--dry-run]
#
# <report_dir> receives <game>-extraction.json, a per-chart summary used by
# scripts/compare-pokercoaching-charts.py. --dry-run writes no range files.
import itertools, json, os, re, subprocess, sys, tempfile, warnings
import numpy as np, pymupdf
from PIL import Image
warnings.filterwarnings("ignore")

PDF, GAME, DATA_OUT, RANGES_OUT = sys.argv[1:5]
DRY_RUN = "--dry-run" in sys.argv
LABEL = {"cash": "Cash", "mtt": "MTT"}[GAME]
RANKS = "AKQJT98765432"
CANONICAL = {"All in": (88, 21, 21), "Raise": (240, 59, 60), "Call": (90, 186, 102), "Fold": (59, 124, 185)}
POS = r"(UTG\+1|UTG|LJ|HJ|CO|BTN|SB|BB)"
TITLE_RE = re.compile(rf"^{POS}(?: vs {POS})? · (RFI|All-In|Limp|3-Bet|4-Bet|5-Bet|6-Bet)( All-In)?$")

def hand(r, c):
    if r == c: return RANKS[r] * 2
    return RANKS[min(r, c)] + RANKS[max(r, c)] + ("s" if c > r else "o")
ORDER = [hand(r, c) for r in range(13) for c in range(13)]

def combos(h):
    return 6 if len(h) == 2 else (4 if h[2] == "s" else 12)

def runs(mask, min_len):
    out, start = [], None
    for i, v in enumerate(list(mask) + [False]):
        if v and start is None: start = i
        if not v and start is not None:
            if i - start >= min_len: out.append((start, i))
            start = None
    return out

def is_chart(info):
    w, h = info["width"], info["height"]
    return w >= 600 and 0.6 <= h / w <= 0.7

def ocr_pct_candidates(img, x0, x1, y1, scale):
    inset = max(2, round(8 * scale))
    crop = img[max(1, round(4 * scale)):y1 - max(1, round(4 * scale)), x0 + inset:x1 - inset].astype(np.uint8)
    thresh = np.where(crop.min(axis=2, keepdims=True) > 170, 0, 255).repeat(3, axis=2).astype(np.uint8)
    up = max(4, round(4 / scale))
    cands = set()
    for variant in (crop, thresh):
        im = Image.fromarray(variant)
        im = im.resize((im.width * up, im.height * up), Image.LANCZOS)
        with tempfile.NamedTemporaryFile(suffix=".png") as f:
            im.save(f.name)
            try:
                out = subprocess.run(["tesseract", f.name, "-", "--psm", "6"], capture_output=True, text=True).stdout
            except FileNotFoundError:
                return []  # tesseract not installed: skip the header check
        for m in re.finditer(r"(\d{1,3}\.\d{2})\s*%", out):
            if float(m.group(1)) <= 100: cands.add(float(m.group(1)))
    return sorted(cands)

def situation_and_name(stack, hero, villain, kind, all_in):
    prefix = f"{LABEL} {stack}bb {hero}"
    if kind == "RFI" and not villain: return "RFI", f"{prefix} RFI"
    if kind == "RFI": return f"vs {villain}", f"{prefix} vs {villain} RFI"
    if kind == "All-In": return f"vs {villain} all-in", f"{prefix} vs {villain} all-in"
    if kind == "Limp": return f"vs {villain} limp", f"{prefix} vs {villain} limp"
    situation = f"vs {villain} {kind.lower()}" + (" all-in" if all_in else "")
    return situation, f"{prefix} {situation}"

doc = pymupdf.open(PDF)
charts, written = [], set()
for pno in range(len(doc)):
    page = doc[pno]
    infos = [i for i in page.get_image_info(xrefs=True) if is_chart(i)]
    if not infos: continue
    stack = int(re.search(r"\b(\d+)BB\b", page.get_text()).group(1))
    titles = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            t = " ".join(s["text"].strip() for s in l["spans"] if s["text"].strip())
            if "·" in t: titles.append((t, l["bbox"]))
    for info in infos:
        ib = info["bbox"]
        above = [t for t in titles if t[1][3] <= ib[1] + 2 and abs(t[1][0] - ib[0]) < 40]
        title = max(above, key=lambda t: t[1][3])[0]
        m = TITLE_RE.match(title)
        assert m, f"p{pno+1}: unparsed title {title!r}"
        hero, villain, kind, all_in = m.groups()

        xref = info["xref"]
        pix = pymupdf.Pixmap(doc, xref)
        if pix.n != 3: pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3).astype(int)
        a = pymupdf.Pixmap(doc, doc.extract_image(xref)["smask"])
        opaque = np.frombuffer(a.samples, np.uint8).reshape(a.height, a.width) > 128
        if img.shape[:2] != opaque.shape:
            # The tournament guide stores images smaller than their mask; scale up to match.
            img = np.asarray(Image.fromarray(img.astype(np.uint8)).resize((a.width, a.height), Image.NEAREST)).astype(int)
        scale = a.width / 1080

        row_runs = runs(opaque.mean(1) > 0.02, max(8, round(20 * scale)))
        header, cell_rows = row_runs[0], row_runs[1:]
        col_runs = runs(opaque[cell_rows[0][0]:].mean(0) > 0.02, max(8, round(20 * scale)))
        assert len(cell_rows) == 13 and len(col_runs) == 13, (pno + 1, title, len(cell_rows), len(col_runs))

        yb = header[0] + round(0.1 * (header[1] - header[0]))
        legend = []
        for x0, x1 in runs(opaque[yb], max(25, round(40 * scale))):
            inset = max(4, round(10 * scale))
            color = np.median(img[yb, x0 + inset:x1 - inset], axis=0)
            action, dist = min(((k, float(np.linalg.norm(color - np.array(v)))) for k, v in CANONICAL.items()),
                               key=lambda t: t[1])
            assert dist < 40, (pno + 1, title, color.tolist())
            legend.append({"action": action, "color": color, "box": (x0, x1)})
        assert len({l["action"] for l in legend}) == len(legend), (pno + 1, title, [l["action"] for l in legend])
        colors = np.array([l["color"] for l in legend])

        freqs = {}
        for r, (y0, y1) in enumerate(cell_rows):
            for c, (x0, x1) in enumerate(col_runs):
                h_px, w_px = y1 - y0, x1 - x0
                band_a, band_b = max(1, round(0.08 * h_px)), max(2, round(0.22 * h_px))
                ys = list(range(y0 + band_a, y0 + band_b)) + list(range(y1 - band_b, y1 - band_a))
                xi = max(2, round(0.04 * w_px))
                px = img[ys, x0 + xi:x1 - xi].reshape(-1, 3)
                black = int((px.max(1) < 45).sum())
                d = np.linalg.norm(px[:, None, :] - colors[None, :, :], axis=2)
                ok = d.min(1) < 60
                counts = np.bincount(d.argmin(1)[ok], minlength=len(colors)).astype(float)
                h = hand(r, c)
                if counts.sum() < black or counts.sum() < 0.2 * len(px):
                    freqs[h] = None
                else:
                    freqs[h] = {legend[i]["action"]: round(float(counts[i] / counts.sum()), 4) for i in range(len(legend))}

        in_range = {h: f for h, f in freqs.items() if f}
        total = sum(combos(h) for h in in_range)
        computed = {l["action"]: round(sum(combos(h) * f[l["action"]] for h, f in in_range.items()) / total * 100, 2)
                    for l in legend} if total else {}

        header_pct, check = None, "reach-weighted header (not comparable)"
        if len(in_range) == 169:
            cands = [ocr_pct_candidates(img, *l["box"], header[1], scale) or [None] for l in legend]
            best = None
            for combo in itertools.product(*cands):
                if None in combo or abs(sum(combo) - 100) > 0.06: continue
                err = max(abs(v - computed[l["action"]]) for v, l in zip(combo, legend))
                if best is None or err < best[0]: best = (err, combo)
            if best:
                header_pct = {l["action"]: v for v, l in zip(best[1], legend)}
                check = f"max diff vs header {best[0]:.2f}"
            else:
                check = "header unreadable"

        top2 = [sorted(f.values(), reverse=True) + [0] for f in in_range.values()]
        mixed = sum(1 for t in top2 if t[0] < 0.9)
        close = sum(1 for t in top2 if t[0] - t[1] < 0.1)
        situation, name = situation_and_name(stack, hero, villain, kind, all_in)

        path = os.path.join(RANGES_OUT, GAME, str(stack), situation, f"{hero}.json")
        assert path not in written, f"duplicate {path} (p{pno+1} {title})"
        written.add(path)
        if not DRY_RUN:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            json.dump({
                "range": [max(freqs[h], key=freqs[h].get) if freqs[h] else None for h in ORDER],
                "name": name,
                "frequencies": [freqs[h] for h in ORDER],
            }, open(path, "w"))

        charts.append({"page": pno + 1, "title": title, "name": name, "stack": stack, "situation": situation,
                       "hero": hero, "path": os.path.abspath(path), "in_range": len(in_range), "mixed": mixed, "close": close,
                       "computed": computed, "header": header_pct, "check": check})
        print(f"p{pno+1:02d} {name:42s} in_range={len(in_range):3d} mixed={mixed:3d} close={close:2d} "
              f"computed={computed} | {check}", flush=True)

os.makedirs(DATA_OUT, exist_ok=True)
json.dump(charts, open(os.path.join(DATA_OUT, f"{GAME}-extraction.json"), "w"), indent=1)
checked = [c for c in charts if c["check"].startswith("max diff")]
diffs = sorted(float(c["check"].split()[-1]) for c in checked)
print(f"\nTOTAL charts={len(charts)} files={len(written)} dry_run={DRY_RUN} header-checked={len(checked)} "
      f"worst_diff={diffs[-1] if diffs else None} over_0.5={sum(d > 0.5 for d in diffs)}")
print("UNREADABLE headers:", [c["name"] for c in charts if c["check"] == "header unreadable"])
print("EMPTY (no in-range hands):", [c["name"] for c in charts if c["in_range"] == 0])
