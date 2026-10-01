import sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
import pymupdf
from rapidocr_onnxruntime import RapidOCR

p = r"C:\Users\leon9\Documents\GitHub\IPAS\I_PAS\初級\000_115年度AI應用規劃師能力鑑定簡章(初、中級)_0410_20260410115646_20260901165208.pdf"
d = pymupdf.open(p)
txt = "\n".join(pg.get_text() for pg in d)
print("chars:", len(txt))
# render pages that mention 測驗/題數/時間
ocr = RapidOCR()
hits = []
for i, pg in enumerate(d):
    t = pg.get_text()
    if any(k in t for k in ["題", "分鐘", "測驗時間", "及格", "合格"]):
        hits.append(i)
print("pages with text hits:", hits[:20])
targets = hits[:6] if hits else list(range(min(6, len(d))))
lines = []
for i in targets:
    pix = d[i].get_pixmap(dpi=150)
    img = r"C:\Users\leon9\AppData\Local\Temp\opencode\sc_%d.png" % i
    pix.save(img)
    out, _ = ocr(img)
    lines.append("===== PAGE %d =====" % (i + 1))
    for it in (out or []):
        t = it[1]
        if any(k in t for k in ["題", "分", "鐘", "及格", "合格", "測驗", "單選", "複選", "情境"]):
            lines.append("  " + t)
open(r"C:\Users\leon9\AppData\Local\Temp\opencode\scopes_ocr.txt", "w", encoding="utf-8").write("\n".join(lines))
print("wrote", len(lines))
