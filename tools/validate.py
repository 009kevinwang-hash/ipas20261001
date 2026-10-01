import json, sys, re
from collections import defaultdict
sys.stdout.reconfigure(encoding="utf-8")
bank = json.load(open(r"C:\Users\leon9\Documents\GitHub\IPAS\data\questions_raw.json", encoding="utf-8"))

for sub in ("1", "2"):
    qs = bank[sub]
    by = defaultdict(set)
    for q in qs:
        by[q["qid"]].add(q["source"])
    dup = {k: v for k, v in by.items() if len(v) > 1}
    print("S%s total=%d unique=%d repeated-across-sessions=%d" % (
        sub, len(qs), len(by), len(dup)))
    for k, v in list(dup.items())[:5]:
        print("    ", len(v), "sources |", k[:70])

print("\n--- sample S1 Q001 ---")
q = bank["1"][0]
print("id", q["id"], "no", q["no"], "src", q["source"], "ans", q["answer"])
print("stem:", q["stem"])
for i, o in enumerate(q["options"]):
    print("   (%s) %s" % ("ABCD"[i], o))

print("\n--- answer distribution ---")
for sub in ("1", "2"):
    c = defaultdict(int)
    for q in bank[sub]:
        c[q["answer"][0]] += 1
    print("S%s" % sub, dict(sorted(c.items())))

print("\n--- integrity checks ---")
bad = []
for sub in ("1", "2"):
    for q in bank[sub]:
        if len(q["options"]) != 4 or len(q["answer"]) != 1:
            bad.append((q["id"], "opt/ans"))
        if len(q["stem"]) < 10:
            bad.append((q["id"], "short stem"))
        if any(len(o) < 2 for o in q["options"]):
            bad.append((q["id"], "empty opt"))
print("problems:", bad[:20], "total", len(bad))
