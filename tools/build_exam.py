import json, sys, os, random
sys.stdout.reconfigure(encoding="utf-8")

ROOT = r"C:\Users\leon9\Documents\GitHub\IPAS"
DATA = os.path.join(ROOT, "data")
bank = json.load(open(os.path.join(DATA, "questions.json"), encoding="utf-8"))

SEED = 20261107

EXAM = {
    "title": "115年度第四次AI應用規劃師-初級能力鑑定",
    "system": "電子化鑑定考試系統",
    "org": "經濟部產業人才能力鑑定",
    "orgEn": "Industry Professional Assessment System",
    "version": "Ver:20.7.1",
    "session": "115年第四次",
    "examDate": "115/11/07(六)",
    "examTime": "13:30~14:45（75 分鐘）",
    "passScore": 70,
    "totalScore": 100,
    "examCount": 50,
    "examDuration": 75 * 60,
    "practiceDuration": 0,
    "scorePerQuestion": 2,
    "certRule": "同時報考同一級等之所有科目，平均達70分，且每科成績不得低於60分。",
    "certValidity": "單科成績70分以上，保留及格單科成績自應考日起三年度有效。",
    "notes": [
        "",
        "本試題0為阿拉伯數字，O為英文字母，作答時請先確認。",
        "學科試卷中滑鼠左右鍵位之選項，請以右手操作作答。",
        "有問題請舉手發問，切勿私下交談。",
    ],
}

SUBJECTS = [
    {"code": "S1", "name": "人工智慧基礎概論", "level": "初級"},
    {"code": "S2", "name": "生成式AI應用與規劃", "level": "初級"},
]

for i, s in enumerate(SUBJECTS, 1):
    src = list(bank[str(i)])
    rng = random.Random(SEED + i)
    rng.shuffle(src)
    for idx, q in enumerate(src, 1):
        q["no"] = idx
    s["duration"] = EXAM["examDuration"]
    s["bankSize"] = len(src)
    s["questions"] = src

EXAM["subjects"] = SUBJECTS
json.dump(EXAM, open(os.path.join(DATA, "exam_info.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

print("saved exam_info.json")
for s in SUBJECTS:
    dist = {}
    for q in s["questions"]:
        dist[q["answer"][0]] = dist.get(q["answer"][0], 0) + 1
    mock = s["questions"][:EXAM["examCount"]]
    md = {}
    for q in mock:
        md[q["answer"][0]] = md.get(q["answer"][0], 0) + 1
    print("  %s %s: bank=%d, mock=%d, bankAns=%s, mockAns=%s" % (
        s["code"], s["name"], s["bankSize"], len(mock), dist, md))
