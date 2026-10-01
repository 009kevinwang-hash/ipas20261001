import sys, os, re, glob
sys.stdout.reconfigure(encoding="utf-8")
d = r"C:\Users\leon9\AppData\Local\Temp\opencode\q"
for f in sorted(glob.glob(os.path.join(d, "*.txt"))):
    t = open(f, encoding="utf-8").read()
    lines = [l.strip() for l in t.splitlines()]
    body = [l for l in lines if l]
    # question starts
    qs = [l for l in body if re.match(r"^\d+\.\s*$", l) or re.match(r"^\d+\.\S", l)]
    opts = [l for l in body if re.match(r"^\([A-E]\)", l)]
    grp = [l for l in body if "情境題" in l or "題組" in l]
    print(os.path.basename(f))
    print("   qmarkers=%d optlines=%d groups=%d" % (len(qs), len(opts), len(grp)))
    for g in grp[:6]:
        print("     G:", g[:110])
    tail = [l for l in body[-14:]]
    print("   tail:", " | ".join(tail)[:400])
