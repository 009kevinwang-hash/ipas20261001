import sys, pymupdf
sys.stdout.reconfigure(encoding="utf-8")
p = sys.argv[1]
d = pymupdf.open(p)
i = int(sys.argv[2]) - 1
pg = d[i]
for b in pg.get_text("blocks"):
    if b[4].strip():
        print("x0=%7.1f y0=%7.1f | %s" % (b[0], b[1], b[4].strip().replace("\n", " ")[:130]))
