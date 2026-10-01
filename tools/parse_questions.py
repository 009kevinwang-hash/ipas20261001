import sys, os, re, json
sys.stdout.reconfigure(encoding="utf-8")
import pymupdf

ROOT = r"C:\Users\leon9\Documents\GitHub\IPAS\I_PAS\初級"
OUT = r"C:\Users\leon9\Documents\GitHub\IPAS\data"
os.makedirs(OUT, exist_ok=True)

CJK = r"\u4e00-\u9fff\u3000-\u303f\uff00-\uffef"
RE_HDR = re.compile(r"^\s*(第[一二三四五六七八九十]+科[：:]|考試日期|第\s*\d+\s*頁)")
RE_OPT = re.compile(r"^\(([A-EＡ-Ｅ])\)\s*(.*)$")
RE_ANS_Q = re.compile(r"^([A-EＡ-Ｅ])\s+(\d{1,3})\.\s*(.*)$")
RE_Q = re.compile(r"^(\d{1,3})\.\s*(.*)$")


def half(ch):
    """全形英文字母轉半形"""
    return chr(ord(ch) - 0xFEE0) if "\uff21" <= ch <= "\uff45" else ch


def clean(s):
    s = s.replace("\u3000", " ").strip()
    s = re.sub(r"[ \t]+", " ", s)
    for _ in range(4):
        n = re.sub(r"([%s]) +([%s])" % (CJK, CJK), r"\1\2", s)
        n = re.sub(r"([%s]) +(\w)" % CJK, r"\1\2", n)
        n = re.sub(r"(\w) +([%s])" % CJK, r"\1\2", n)
        if n == s:
            break
        s = n
    return re.sub(r"\s+", " ", s).strip()


def page_lines(pg):
    out = []
    h = pg.rect.height
    for blk in pg.get_text("blocks"):
        if blk[6] != 0:
            continue
        x0, y0 = blk[0], blk[1]
        if y0 < 92 or y0 > h - 55:
            continue
        txt = blk[4].replace("\n", " ").strip()
        txt = re.sub(r"[ \t]+", " ", txt)
        if txt:
            out.append((round(y0, 1), round(x0, 1), txt))
    out.sort(key=lambda t: (t[0], t[1]))
    return [t for _, _, t in out]


def parse(pdf):
    doc = pymupdf.open(pdf)
    qs, cur, last = [], None, 0
    for pg in doc:
        for s in page_lines(pg):
            if s.startswith("《以下空白》") or s in ("答案", "題目", "題    目"):
                continue
            if RE_HDR.match(s):
                continue
            m = RE_ANS_Q.match(s)
            if m:
                if cur and len(cur["options"]) == 4:
                    qs.append(cur)
                cur = {"no": int(m.group(2)), "stem": [m.group(3).strip()],
                       "options": [], "answer": half(m.group(1))}
                last = int(m.group(2))
                continue
            m = RE_OPT.match(s)
            if m and cur is not None:
                cur["options"].append(m.group(2))
                continue
            m = RE_Q.match(s)
            if m and int(m.group(1)) > last:
                if cur and len(cur["options"]) == 4:
                    qs.append(cur)
                cur = {"no": int(m.group(1)), "stem": [m.group(2).strip()],
                       "options": [], "answer": None}
                last = int(m.group(1))
                continue
            if cur is None:
                continue
            if cur["options"] and len(cur["options"][-1]) > 0:
                cur["options"][-1] += s
            else:
                cur["stem"].append(s)
    if cur and len(cur["options"]) == 4:
        qs.append(cur)
    return qs


bank = {1: [], 2: []}
files = sorted(f for f in os.listdir(ROOT) if f.endswith(".pdf")
               and ("公告試題" in f or "當次試題公告" in f))
for f in files:
    sub = 1 if ("第一科" in f or "人工智慧基礎概論" in f) else 2
    qs = parse(os.path.join(ROOT, f))
    kept = []
    for q in qs:
        stem = clean("".join(q["stem"]))
        opts = [clean(o) for o in q["options"]]
        if not stem or len(opts) != 4 or not q["answer"] or any(not o for o in opts):
            continue
        kept.append({"no": q["no"], "stem": stem, "options": opts,
                     "answer": [q["answer"]], "type": "single",
                     "source": f.split("_")[0],
                     "qid": re.sub(r"\s+", "", stem)[:60]})
    nos = {k["no"] for k in kept}
    print("S%d %-44s n=%2d missing=%s" % (
        sub, f.split("_")[0][:44], len(kept), sorted(set(range(1, 51)) - nos)))
    bank[sub].extend(kept)

for sub in (1, 2):
    seen = {}
    for q in bank[sub]:
        seen.setdefault(q["qid"], q)
    lst = sorted(seen.values(), key=lambda q: (q["no"], q["qid"]))
    for i, q in enumerate(lst, 1):
        q["id"] = "S%d-Q%03d" % (sub, i)
    bank[sub] = lst
    print("subject %d -> %d unique" % (sub, len(lst)))

json.dump(bank, open(os.path.join(OUT, "questions_raw.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print("saved questions_raw.json")
