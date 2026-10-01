import sys, os
from collections import Counter
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image

src = r"C:\Users\leon9\AppData\Local\Temp\opencode\ops"
for name in ["p04.png", "p05.png", "p06.png", "p11.png", "p12.png"]:
    im = Image.open(os.path.join(src, name)).convert("RGB")
    w, h = im.size
    print("=====", name, w, "x", h)
    rows = [8, 20, 40, 70, 100, 130, 145, 150, 160, 175, 190, 200, 210, 220,
            240, 260, 300, 340, 370, 400, 430, 460, 490, 520, 550, 580, 600]
    for y in rows:
        if y >= h:
            continue
        c = Counter(im.getpixel((x, y)) for x in range(0, w, 2))
        top = c.most_common(3)
        print("  y={:4d} ".format(y) + "  ".join(
            "#{:02X}{:02X}{:02X}:{}".format(r, g, b, n) for (r, g, b), n in top))
