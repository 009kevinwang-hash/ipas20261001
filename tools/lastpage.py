import sys, pymupdf
sys.stdout.reconfigure(encoding="utf-8")
p = sys.argv[1]
d = pymupdf.open(p)
pg = d[len(d) - 1]
for b in pg.get_text("blocks"):
    x0, y0, x1, y1, txt = b[0], b[1], b[2], b[3], b[4]
    if txt.strip():
        print("x0=%7.1f y0=%7.1f x1=%7.1f y1=%7.1f | %s" % (x0, y0, x1, y1, txt.strip().replace("\n", " ")[:150]))
