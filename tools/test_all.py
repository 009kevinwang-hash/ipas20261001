import json, sys, os, re, subprocess
sys.stdout.reconfigure(encoding="utf-8")

ROOT = r"C:\Users\leon9\Documents\GitHub\IPAS"
DATA = os.path.join(ROOT, "data")
bank = json.load(open(os.path.join(DATA, "questions.json"), encoding="utf-8"))
exam = json.load(open(os.path.join(DATA, "exam_info.json"), encoding="utf-8"))

FAIL = []
def chk(cond, msg):
    print(("  OK   " if cond else "  FAIL ") + msg)
    if not cond:
        FAIL.append(msg)

print("=== 考試基本資料（對照官方簡章）===")
chk(exam["org"] == "經濟部產業人才能力鑑定", "主辦單位")
chk(exam["title"].startswith("115年度第四次"), "考試梯次: " + exam["title"])
chk(exam["passScore"] == 70, "及格標準 70 分")
chk(exam["examCount"] == 50, "每科 50 題（官方公告）")
chk(exam["examDuration"] == 4500, "官方測驗時間 75 分鐘")
chk(exam["practiceDuration"] == 0, "題庫練習不限時")
chk(abs(exam["scorePerQuestion"] - 2.0) < 1e-9, "每題 2 分（50題=100分）")
chk(exam["duration" if False else "totalScore"] == 100, "滿分 100 分")
chk(len(exam["subjects"]) == 2, "兩科")

names = [s["name"] for s in exam["subjects"]]
chk("人工智慧基礎概論" in names, "科目1 人工智慧基礎概論")
chk("生成式AI應用與規劃" in names, "科目2 生成式AI應用與規劃")

for s in exam["subjects"]:
    print("\n--- %s %s" % (s["code"], s["name"]))
    chk(s["duration"] == 4500, "測驗時間 75 分鐘")
    chk(s["bankSize"] == 200, "題庫 200 題（4 梯次合併）")
    chk(len(s["questions"]) == s["bankSize"], "題目數 == 題庫數")

    nos = [q["no"] for q in s["questions"]]
    chk(nos == list(range(1, s["bankSize"] + 1)), "題號連續 1..%d" % s["bankSize"])

    bad = 0
    for q in s["questions"]:
        if len(q["options"]) != 4 or any(not o.strip() for o in q["options"]):
            bad += 1
        if len(q["answer"]) != 1 or q["answer"][0] not in "ABCD":
            bad += 1
        if not q["stem"].strip():
            bad += 1
        if q["type"] != "single":
            bad += 1
    chk(bad == 0, "每題皆有題幹/4選項/單選答案")

    stems = [re.sub(r"\s+", "", q["stem"]) for q in s["questions"]]
    chk(len(set(stems)) == len(stems), "題目無重複")

    dist = {}
    for q in s["questions"]:
        dist[q["answer"][0]] = dist.get(q["answer"][0], 0) + 1
    chk(all(dist.get(L, 0) >= 30 for L in "ABCD"), "答案分布 " + str(dist))

    mock = s["questions"][:exam["examCount"]]
    md = {}
    for q in mock:
        md[q["answer"][0]] = md.get(q["answer"][0], 0) + 1
    chk(all(md.get(L, 0) >= 5 for L in "ABCD"),
        "模擬卷 50 題答案分布 " + str(md))

print("\n=== 題庫來源比對 ===")
for i, s in enumerate(exam["subjects"], 1):
    src_keys = {re.sub(r"\s+", "", q["stem"])[:60] for q in bank[str(i)]}
    used = {re.sub(r"\s+", "", q["stem"])[:60] for q in s["questions"]}
    chk(used == src_keys, "S%d 全部題目對應官方試題 PDF（%d 題）" % (i, len(src_keys)))

print("\n=== 檔案完整性 ===")
for f in ["index.html", "css/style.css", "js/app.js", "js/data.js",
          "data/exam_info.json", "data/questions.json"]:
    p = os.path.join(*f.split("/"))
    ok = os.path.exists(p) and os.path.getsize(p) > 0
    chk(ok, "%s (%d bytes)" % (f, os.path.getsize(p) if os.path.exists(p) else 0))

print("\n=== 靜態語法檢查 ===")
r = subprocess.run(["node", "--check", os.path.join(ROOT, "js", "app.js")],
                   capture_output=True, text=True)
chk(r.returncode == 0, "node --check js/app.js")
if r.returncode:
    print(r.stderr[:600])

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
for need in ['id="scr-login"', 'id="scr-notice"', 'id="scr-exam"',
             'id="scr-overview"', 'id="scr-done"', 'id="modal-wrap"',
             'data-act="finish"', 'data-act="overview"', 'id="bar-timer"',
             'id="exam-nav"', 'id="q-feedback"', 'exam-nav-fixed', 'lg-orange']:
    chk(need in html, "index.html 含 %s" % need)

js = open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
chk("$.total" not in js and "s.total +" not in js, "已無 subject.total 舊欄位引用")
for fn in ["function doLogin", "function startTimer", "function renderOverview",
           "function doFinish", "function buildSession", "function renderModes",
           "function changeSubject", "function nextQuestion", "function showFeedback",
           "function renderFeedback", "function answerKey", "data/exam_info.json"]:
    chk(fn in js, "app.js 含 %s" % fn)

print("\n" + ("ALL PASSED" if not FAIL else "FAILURES: %d" % len(FAIL)))
for f in FAIL:
    print("  - " + f)
sys.exit(1 if FAIL else 0)
