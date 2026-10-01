const { chromium } = require("playwright-core");
const path = require("path");

const EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");

const fails = [];
function chk(cond, msg) {
  console.log((cond ? "  OK   " : "  FAIL ") + msg);
  if (!cond) fails.push(msg);
}

async function login(p, id) {
  await p.fill("#login-id", id);
  await p.click('[data-act="login-submit"]');
  await p.waitForTimeout(250);
}

async function pickMode(p, code, mode) {
  await p.click('.pick-item[data-code="' + code + '"]');
  await p.waitForTimeout(150);
  await p.click('.mode-item[data-mode="' + mode + '"]');
  await p.waitForTimeout(200);
}

async function startExam(p) {
  await p.click('[data-act="start-exam"]');
  await p.waitForTimeout(350);
}

// 正確作答：true=選正確答案，false=故意選錯
async function answerCurrent(p, correct) {
  const info = await p.evaluate(() => window.ipasExam.question());
  const ans = info.answer[0];
  const idx = correct ? ("ABCD".indexOf(ans) + 1) : (ans === "A" ? 2 : 1);
  await p.click("#q-options .opt:nth-child(" + idx + ")");
  await p.waitForTimeout(90);
  return ans;
}

async function pressNext(p) {
  await p.click('#exam-nav [data-act="next"]');
  await p.waitForTimeout(280);
}

async function pressPrev(p) {
  await p.click('#exam-nav [data-act="prev"]');
  await p.waitForTimeout(220);
}

async function confirmModal(p) {
  await p.click("#modal-yes");
  await p.waitForTimeout(220);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(500);

  console.log("=== 1. 登入與科目/模式選擇 ===");
  chk(await page.isVisible("#scr-login"), "登入畫面顯示");
  await page.click('[data-act="login-submit"]');
  await page.waitForTimeout(200);
  chk((await page.textContent("#toast")).includes("請輸入身分證字號"), "空白身分證擋下");
  await login(page, "A123456789");
  chk(await page.isVisible("#scr-pick"), "登入後進入科目選擇");
  await pickMode(page, "S1", "mock");
  chk(await page.isVisible("#scr-notice"), "注意事項畫面顯示");
  const notes = await page.$$eval("#notice-list li", (n) => n.map((x) => x.textContent));
  chk(notes[0] === "本試卷試題，為學科試卷，含單選題加情境題組題，共40題，共佔100%，" +
      "每題2.5分(答錯不倒扣)，總分共計100分，測驗時間90分鐘。",
      "第1條官網逐字");
  await startExam(page);

  console.log("\n=== 2. 右下角翻題按鍵 ===");
  chk(await page.isVisible("#scr-exam"), "考試畫面顯示");
  chk(await page.isVisible("#exam-nav"), "右下角翻題區顯示");
  const navBox = await page.$eval("#exam-nav", (n) => {
    const r = n.getBoundingClientRect();
    return { right: r.right, bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
  });
  chk(navBox.vw - navBox.right < 60 && navBox.vh - navBox.bottom < 60,
      `右下角位置 (距右${Math.round(navBox.vw - navBox.right)}px, 距下${Math.round(navBox.vh - navBox.bottom)}px)`);
  chk(await page.$(".exam-toolbar [data-act='next']") === null, "工具列已無下一題");
  chk(await page.$(".exam-toolbar [data-act='prev']") === null, "工具列已無上一題");
  chk((await page.textContent("#bar-timer")).trim() === "75:00/75:00", "倒數 75:00/75:00");
  chk(await page.isDisabled("#exam-nav [data-act='prev']"), "第1題上一題 disabled");

  console.log("\n=== 3. 下一題即時核對（答錯）===");
  const ans1 = await answerCurrent(page, false);
  await pressNext(page);
  chk(await page.isVisible("#modal-wrap"), "核對視窗彈出");
  const fb1 = await page.textContent("#modal-body");
  chk(fb1.includes("答錯了"), "顯示答錯了");
  chk(fb1.includes("正確答案") && fb1.includes(ans1), `指出正確答案 ${ans1}: ` + fb1.replace(/\s+/g, ""));
  chk((await page.textContent("#modal-yes")).trim() === "確定", "單一確定按鈕");
  chk(await page.isVisible("#modal-no") === false, "無否按鈕");
  await confirmModal(page);
  chk((await page.textContent("#q-no")).trim() === "2", "確定後跳下一題");

  console.log("\n=== 4. 返回已核對題目：鎖定＋顯示正解 ===");
  await pressPrev(page);
  chk((await page.textContent("#q-no")).trim() === "1", "回到第1題");
  const banner = await page.textContent("#q-feedback");
  chk(banner.includes("答錯了") && banner.includes(ans1), "題面顯示答錯與正解: " + banner);
  chk((await page.$$("#q-options .opt-correct")).length === 1, "正確選項綠色標示");
  chk((await page.$$("#q-options .opt-wrong")).length === 1, "選錯選項紅色標示");
  const selBefore = await page.$$eval("#q-options .opt.sel", (n) => n.map((x) => x.getAttribute("data-l")));
  await page.click("#q-options .opt:nth-child(4)");
  await page.waitForTimeout(150);
  const selAfter = await page.$$eval("#q-options .opt.sel", (n) => n.map((x) => x.getAttribute("data-l")));
  chk(JSON.stringify(selBefore) === JSON.stringify(selAfter), "已核對題目不可更改");
  chk((await page.textContent("#toast")).includes("不可更改"), "提示不可更改");
  await page.click('.exam-toolbar [data-act="clear"]');
  await page.waitForTimeout(150);
  const selAfterClear = await page.$$eval("#q-options .opt.sel", (n) => n.length);
  chk(selAfterClear === selBefore.length, "已核對題目不可清除");

  console.log("\n=== 5. 已核對題目按下一題直接跳過 ===");
  await pressNext(page);
  chk((await page.textContent("#q-no")).trim() === "2", "不再彈窗，直接到第2題");
  chk(await page.isVisible("#modal-wrap") === false, "無核對視窗");

  console.log("\n=== 6. 下一題即時核對（答對）===");
  const ans2 = await answerCurrent(page, true);
  await pressNext(page);
  const fb2 = await page.textContent("#modal-body");
  chk(fb2.includes("答對了"), "顯示答對了: " + fb2.replace(/\s+/g, ""));
  await confirmModal(page);
  chk((await page.textContent("#q-no")).trim() === "3", "到第3題");

  console.log("\n=== 7. 未作答按下一題 ===");
  await pressNext(page);
  const fb3 = await page.textContent("#modal-body");
  chk(fb3.includes("尚未作答") && fb3.includes("正確答案"), "顯示尚未作答＋正解: " + fb3.replace(/\s+/g, ""));
  await confirmModal(page);
  chk((await page.textContent("#q-no")).trim() === "4", "到第4題");

  console.log("\n=== 8. 總覽：橘色答錯＋點入看答案 ===");
  await page.click('[data-act="overview"]');
  await page.waitForTimeout(280);
  chk((await page.$$("#ov-grid .ov-cell")).length === 50, "題號格 50 個");
  chk((await page.$$("#ov-grid .ov-cell.bad")).length === 1, "橘色答錯 1 題");
  chk((await page.$$("#ov-grid .ov-cell.done")).length >= 1, "綠色已作答");
  chk((await page.textContent("#ov-stat")).includes("已核對答錯題數：1"), "統計答錯數");
  chk((await page.textContent(".ov-legend")).includes("橘：答錯"), "圖例含橘色");
  await page.click("#ov-grid .ov-cell.bad");
  await page.waitForTimeout(280);
  chk(await page.isVisible("#scr-exam"), "點入回到作答");
  const banner2 = await page.textContent("#q-feedback");
  chk(banner2.includes("你的答案") && banner2.includes("正確答案"), "題面顯示當初答案與正解: " + banner2);
  chk((await page.$$("#q-options .opt-correct")).length === 1, "正解綠色標示");
  chk((await page.$$("#q-options .opt-wrong")).length === 1, "錯選紅色標示");

  console.log("\n=== 9. 交卷確認按鈕恢復 ===");
  await page.click('[data-act="finish"]');
  await page.waitForTimeout(250);
  chk(await page.isVisible("#modal-yes") && await page.isVisible("#modal-no"), "是/否按鈕恢復");
  chk((await page.textContent("#modal-yes")).includes("是"), "是按鈕文字恢復");
  await page.click("#modal-no");
  await page.waitForTimeout(200);
  chk(await page.isVisible("#scr-exam"), "選否返回考試");

  console.log("\n=== 10. 最後一題下一題變查看總覽 ===");
  // 回到 Q4（已核對未作答），再往後逐題答對核對 Q5..Q49
  await page.click('[data-act="overview"]');
  await page.waitForTimeout(280);
  await page.click('#ov-grid .ov-cell[data-no="4"]');
  await page.waitForTimeout(280);
  await pressNext(page);   // Q4 尚未核對 → 先彈未作答核對
  chk((await page.textContent("#modal-body")).includes("尚未作答"), "Q4 未作答核對");
  await confirmModal(page);
  chk((await page.textContent("#q-no")).trim() === "5", "從 Q4 續答到 Q5");
  for (let i = 0; i < 45; i++) {
    await answerCurrent(page, true);
    await pressNext(page);
    await confirmModal(page);
  }
  chk((await page.textContent("#q-no")).trim() === "50", "到達第50題");
  chk((await page.textContent("#exam-nav [data-act='next']")).includes("查看總覽"), "按鈕變為查看總覽");
  await answerCurrent(page, true);
  await pressNext(page);
  await confirmModal(page);
  chk(await page.isVisible("#scr-overview"), "最後一題核對後進入總覽");
  chk((await page.$$("#ov-grid .ov-cell.bad")).length === 1, "總覽仍顯示 1 題答錯");
  await page.click('[data-act="close-overview"]');
  await page.waitForTimeout(250);
  chk(await page.isVisible("#scr-exam"), "由總覽返回作答");
  await page.click('[data-act="finish"]');
  await page.waitForTimeout(250);
  await page.click("#modal-yes");
  await page.waitForTimeout(400);
  const ds = await page.textContent("#done-score");
  chk(ds.includes("答對題數47"), "答對 47 題: " + ds.replace(/\s+/g, "").slice(0, 80));
  chk(ds.includes("94"), "得分 94 分");
  chk(/本科未達及格標準|本科及格/.test(ds), "含及格判定");

  console.log("\n=== 11. 練習模式也即時核對 ===");
  await page.click('[data-act="back-system"]');
  await page.waitForTimeout(250);
  await login(page, "B987654321");
  await pickMode(page, "S2", "practice");
  await startExam(page);
  chk((await page.textContent("#bar-timer")).includes("不限時"), "練習不限時");
  await answerCurrent(page, false);
  await pressNext(page);
  chk((await page.textContent("#modal-body")).includes("答錯了"), "練習模式亦即時核對");
  await confirmModal(page);
  chk(await page.isVisible("#exam-nav"), "練習模式右下角按鍵顯示");

  console.log("\n=== 12. 進度保存含核對狀態 ===");
  const st1 = await page.evaluate(() => window.ipasExam.state());
  chk(st1.revealed && Object.keys(st1.revealed).length === 1, "核對狀態已保存");
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(500);
  await login(page, "B987654321");
  await page.click('.pick-item[data-code="S2"]');
  await page.waitForTimeout(150);
  await page.click('.mode-item[data-mode="practice"]');
  await page.waitForTimeout(200);
  await startExam(page);
  chk((await page.textContent("#q-no")).trim() === "2", "恢復後停在第2題");
  await pressPrev(page);
  chk((await page.textContent("#q-no")).trim() === "1", "返回第1題");
  const nw = await page.$$eval("#q-options .opt-wrong", (n) => n.length);
  const nc = await page.$$eval("#q-options .opt-correct", (n) => n.length);
  const hl = nw + nc;
  chk(hl >= 1, "重新載入後恢復核對顯示");

  console.log("\n=== 13. 主控台錯誤 ===");
  chk(errors.length === 0, "無 JS 錯誤" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));

  await browser.close();
  console.log("\n" + (fails.length ? "FAILURES: " + fails.length : "ALL PASSED"));
  fails.forEach((f) => console.log("  - " + f));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("CRASH:", e); process.exit(2); });