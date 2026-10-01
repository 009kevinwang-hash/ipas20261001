import json, sys, os
sys.stdout.reconfigure(encoding="utf-8")

ROOT = r"C:\Users\leon9\Documents\GitHub\IPAS"
exam = json.load(open(os.path.join(ROOT, "data", "exam_info.json"), encoding="utf-8"))

js = "/* 題庫資料（由 tools/build_jsdata.py 自動產生，請勿手動修改） */\n"
js += "window.IPAS_DATA = " + json.dumps(exam, ensure_ascii=False, indent=1) + ";\n"

out = os.path.join(ROOT, "js", "data.js")
open(out, "w", encoding="utf-8").write(js)
print("saved", out, os.path.getsize(out), "bytes")
