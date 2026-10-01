import json, sys, os, random
sys.stdout.reconfigure(encoding="utf-8")
import pymupdf
from collections import defaultdict
sys.path.insert(0, r"C:\Users\leon9\Documents\GitHub\IPAS\tools")
import parse_questions as m

ROOT = r"C:\Users\leon9\Documents\GitHub\IPAS\I_PAS\初級"
files = sorted(f for f in os.listdir(ROOT) if f.endswith(".pdf")
               and ("公告試題" in f or "當次試題公告" in f))

raw = {1: defaultdict(list), 2: defaultdict(list)}   # sub -> no -> [(source, q)]
for f in files:
    sub = 1 if ("第一科" in f or "人工智慧基礎概論" in f) else 2
    for q in m.parse(os.path.join(ROOT, f)):
        if len(q["options"]) == 4 and q["answer"]:
            raw[sub][q["no"]].append((f.split("_")[0], q))

print("=== cross-session same-number comparison ===")
conflicts = 0
for sub in (1, 2):
    print("--- subject", sub)
    for no in sorted(raw[sub]):
        entries = raw[sub][no]
        stems = {m.clean("".join(e[1]["stem"]))[:70] for e in entries}
        opts = {tuple(m.clean(o)[:40] for o in e[1]["options"]) for e in entries}
        anss = {e[1]["answer"] for e in entries}
        if len(stems) > 1:
            conflicts += 1
            print("  no=%2d sessions=%d DIFFERENT-STEM" % (no, len(entries)))
            for s in sorted(stems):
                print("       -", s)
        if len(anss) > 1 and len(stems) == 1:
            print("  no=%2d ANSWER MISMATCH %s" % (no, anss))
print("stem conflicts:", conflicts)
