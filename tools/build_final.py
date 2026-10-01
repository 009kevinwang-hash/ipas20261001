import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")
from collections import defaultdict

ROOT = r"C:\Users\leon9\Documents\GitHub\IPAS\data"
bank = json.load(open(os.path.join(ROOT, "questions_raw.json"), encoding="utf-8"))

# build canonical by stem (dedupe again, keep first source with shortest)
for sub in ("1", "2"):
    seen = {}
    for q in bank[sub]:
        k = q["stem"]
        if k not in seen or len(q["source"]) < len(seen[k]["source"]):
            seen[k] = q
    lst = sorted(seen.values(), key=lambda x: (x["no"], x["id"]))
    for i, q in enumerate(lst, 1):
        q["id"] = "S%s-Q%03d" % (sub, i)
    bank[sub] = lst
    print("S%s: %d unique" % (sub, len(lst)))

json.dump(bank, open(os.path.join(ROOT, "questions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved", os.path.join(ROOT, "questions.json"))
