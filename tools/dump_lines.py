import sys, os, re, json
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, r"C:\Users\leon9\Documents\GitHub\IPAS\tools")
import parse_questions as m
import pymupdf

p = r"C:\Users\leon9\Documents\GitHub\IPAS\I_PAS\初級\114年第四梯次初級AI應用規劃師第一科人工智慧基礎概論(當次試題公告114_20251226000442.pdf"
doc = pymupdf.open(p)
rep = []
for pi in range(len(doc)):
    for s in m.page_lines(doc[pi]):
        rep.append("p%d | %s" % (pi + 1, s))
with open(r"C:\Users\leon9\AppData\Local\Temp\opencode\lines_dump.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(rep))
print("wrote", len(rep), "lines")
