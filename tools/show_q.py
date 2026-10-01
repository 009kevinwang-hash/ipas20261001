import sys, re
sys.stdout.reconfigure(encoding="utf-8")
f = sys.argv[1]
targets = [int(x) for x in sys.argv[2:]]
lines = open(f, encoding="utf-8").read().splitlines()
for t in targets:
    print("########## around", t)
    idx = [i for i, l in enumerate(lines) if re.match(r"^\s*%d\.\s*$" % t, l) or re.match(r"^\s*%d\.\s*\S" % t, l)]
    if not idx:
        print("  NOT FOUND by regex")
        continue
    i = idx[0]
    for l in lines[i:i + 30]:
        if l.strip():
            print("  |" + l)
