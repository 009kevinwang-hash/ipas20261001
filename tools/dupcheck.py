import sys, os, re
sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, r"C:\Users\leon9\Documents\GitHub\IPAS\tools")
import parse_questions as m

ROOT = r"C:\Users\leon9\Documents\GitHub\IPAS\I_PAS\初級"
files = sorted(f for f in os.listdir(ROOT) if f.endswith(".pdf") and "公告試題" in f)
sub1 = [f for f in files if ("第一科" in f or "人工智慧基礎概論" in f)]
sets = {}
for f in sub1:
    qs = m.parse(os.path.join(ROOT, f))
    sets[f.split("_")[0]] = {m.clean("".join(q["stem"]))[:60] for q in qs if len(q["options"]) == 4}
    print(f.split("_")[0][:40], len(sets[f.split("_")[0]]))

keys = list(sets)
print("\npairwise overlap:")
for i in range(len(keys)):
    for j in range(i + 1, len(keys)):
        ov = sets[keys[i]] & sets[keys[j]]
        print("  %-28s x %-28s = %2d" % (keys[i][:28], keys[j][:28], len(ov)))
union = set().union(*sets.values())
print("\nunion unique in subject1:", len(union))
