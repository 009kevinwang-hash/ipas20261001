import json, sys
sys.stdout.reconfigure(encoding="utf-8")
bank = json.load(open(r"C:\Users\leon9\Documents\GitHub\IPAS\data\questions_raw.json", encoding="utf-8"))
out = []
for sub in ("1", "2"):
    qs = bank[sub]
    out.append("=" * 70)
    out.append("SUBJECT %s  (unique=%d)" % (sub, len(qs)))
    out.append("=" * 70)
    for q in qs:
        out.append("%s | ans=%s | %s" % (q["id"], q["answer"][0], q["no"]))
        out.append("  " + q["stem"])
        for i, o in enumerate(q["options"]):
            out.append("    (%s) %s" % ("ABCD"[i], o))
        out.append("")
open(r"C:\Users\leon9\AppData\Local\Temp\opencode\bank_preview.txt", "w", encoding="utf-8").write("\n".join(out))
print("wrote", len(out), "lines")
