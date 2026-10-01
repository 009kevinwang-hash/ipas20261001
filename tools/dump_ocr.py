import json, sys
sys.stdout.reconfigure(encoding="utf-8")
d = json.load(open(r"C:\Users\leon9\AppData\Local\Temp\opencode\ops_ocr.json", encoding="utf-8"))
pages = sys.argv[1:] or sorted(d)
for p in pages:
    print("===== " + p)
    for it in sorted(d[p], key=lambda i: (i["y"], i["x"])):
        print("  y={:4d} x={:4d} w={:3d} h={:3d}  {}".format(
            it["y"], it["x"], it["w"], it["h"], it["t"]))
