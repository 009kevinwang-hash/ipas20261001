import json, sys, re
from collections import defaultdict
sys.stdout.reconfigure(encoding="utf-8")
bank = json.load(open(r"C:\Users\leon9\Documents\GitHub\IPAS\data\questions_raw.json", encoding="utf-8"))
for sub in (1, 2):
    per = defaultdict(list)
    for q in bank[str(sub)]:
        per[q["source"]].append(q["no"])
    for src, nos in per.items():
        missing = sorted(set(range(1, 51)) - set(nos))
        print("S%d %-40s n=%2d missing=%s" % (sub, src[:40], len(nos), missing))
