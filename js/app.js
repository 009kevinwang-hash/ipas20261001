/* iPAS 電子化鑑定考試系統 - 互動邏輯 */
(function () {
  "use strict";

  var EXAM = null;
  var BANK = null;

  var state = {
    screen: "login",
    subject: null,
    mode: "mock",    // mock = 官方模擬測驗 / practice = 完整題庫練習
    qs: [],          // 本次測驗實際使用的題目（已重新編號 1..n）
    duration: 0,     // 本次測驗秒數；0 = 不限時
    idx: 0,
    answers: {},     // no -> ["A"] | ["A","C"]
    marks: {},       // no -> true
    revealed: {},    // no -> true（已即時核對並顯示正解，鎖定不可更改）
    zoom: 1,
    left: 0,
    timer: null,
    candidate: { name: "", id: "" },
    finished: false,
    score: null
  };

  var LETTERS = ["A", "B", "C", "D"];
  var KEY = "ipas_mock_state_v1";

  /* ---------------- DOM ---------------- */
  function $(id) { return document.getElementById(id); }

  var el = {};
  function cacheEls() {
    ["screen", "scr-login", "scr-notice", "scr-pick", "scr-exam", "scr-overview",
     "scr-done", "login-id", "notice-subject-name", "notice-name", "notice-id",
     "notice-list", "pick-list", "mode-wrap", "mode-list",
     "bar-subject", "bar-mode", "bar-id", "bar-timer",
     "q-type", "q-no", "q-stem", "q-feedback", "q-options", "q-figure", "q-area",
     "exam-nav",
     "ov-grid", "ov-stat", "done-score", "modal-wrap", "modal-body",
     "modal-yes", "modal-no", "toast"].forEach(function (k) { el[k] = $(k); });
  }

  /* ---------------- 工具 ---------------- */
  function show(id) {
    ["scr-login", "scr-notice", "scr-pick", "scr-exam", "scr-overview",
     "scr-done"].forEach(function (s) {
      el[s].classList.toggle("hidden", s !== id);
    });
    state.screen = id;
    el.screen.scrollTop = 0;
    // 上一題 / 下一題只在作答畫面顯示於右下角
    if (el["exam-nav"]) {
      el["exam-nav"].style.display = (id === "scr-exam") ? "flex" : "none";
    }
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.toast.classList.add("hidden");
    }, 1600);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function mmss(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ---------------- 存檔 ---------------- */
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        subject: state.subject ? state.subject.code : null,
        mode: state.mode,
        idx: state.idx, answers: state.answers, marks: state.marks,
        revealed: state.revealed,
        left: state.left, candidate: state.candidate
      }));
    } catch (e) { /* 忽略 */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 畫面：登入 ---------------- */
  function renderLogin() {
    el["login-id"].focus();
  }

  function doLogin() {
    var v = (el["login-id"].value || "").trim().toUpperCase();
    if (!v) {
      toast("請輸入身分證字號");
      el["login-id"].focus();
      return;
    }
    state.candidate = { name: "考生", id: v };
    state.subject = null;
    renderPick();
    show("scr-pick");
  }

  function cancelLogin() {
    el["login-id"].value = "";
    toast("已取消登錄");
  }

  /* ---------------- 畫面：注意事項 ---------------- */
  function renderNotice() {
    var saved = load();
    var code = (state.subject && state.subject.code) ||
               (saved && saved.subject) || EXAM.subjects[0].code;
    var sub = findSubject(code) || EXAM.subjects[0];
    state.subject = sub;

    el["notice-subject-name"].textContent = sub.level + " " + sub.name;
    el["notice-name"].textContent = state.candidate.name || "—";
    el["notice-id"].textContent = state.candidate.id || "—";

    var mock = state.mode === "mock";
    var notes = EXAM.notes.slice();
    if (mock) {
      // 與官方操作手冊逐字相同（固定文字）
      notes[0] = "本試卷試題，為學科試卷，含單選題加情境題組題，共40題，共佔100%，" +
        "每題2.5分(答錯不倒扣)，總分共計100分，測驗時間90分鐘。";
    } else {
      var total = state.qs.length;
      var per = EXAM.scorePerQuestion;
      notes[0] = "本試卷試題，為學科試卷，含單選題加情境題組題，共" + total +
        "題，共佔100%，每題" + per + "分(答錯不倒扣)，總分共計100分，測驗時間不限時（練習模式）。";
      notes.splice(1, 0, "本次為完整題庫練習模式，所有題目均可作答且不限時。");
    }

    el["notice-list"].innerHTML = notes.map(function (n) {
      return "<li>" + n + "</li>";
    }).join("");
  }

  function buildSession(sub, mode) {
    var all = sub.questions || [];
    var limit = (mode === "practice") ? all.length : Math.min(EXAM.examCount, all.length);
    state.subject = sub;
    state.mode = mode;
    state.qs = all.slice(0, limit).map(function (q, i) {
      var c = {};
      for (var k in q) if (Object.prototype.hasOwnProperty.call(q, k)) c[k] = q[k];
      c.no = i + 1;
      c.origNo = q.no;
      return c;
    });
    state.duration = (mode === "practice")
      ? (EXAM.practiceDuration || 0)
      : (EXAM.examDuration || sub.duration || 0);
    state.answers = {};
    state.marks = {};
    state.revealed = {};
    state.idx = 0;
    state.left = state.duration;
  }

  function startFromNotice() {
    var saved = load();
    if (saved && saved.subject === state.subject.code &&
        (saved.mode || "mock") === state.mode && Object.keys(state.qs).length) {
      state.answers = saved.answers || {};
      state.marks = saved.marks || {};
      state.revealed = saved.revealed || {};
      state.idx = Math.min(saved.idx || 0, state.qs.length - 1);
      state.left = typeof saved.left === "number" ? saved.left : state.duration;
      if (state.candidate.id === "") state.candidate = saved.candidate || state.candidate;
      toast("已載入上次作答進度");
    } else {
      state.answers = {};
      state.marks = {};
      state.revealed = {};
      state.idx = 0;
      state.left = state.duration;
    }
    renderExam();
    show("scr-exam");
    startTimer();
  }

  /* ---------------- 畫面：科目 / 模式選擇 ---------------- */
  function renderPick() {
    var bankSize = EXAM.subjects[0] ? (EXAM.subjects[0].bankSize || 0) : 0;
    var bankTotal = EXAM.subjects.reduce(function (a, s) {
      return a + (s.bankSize || 0);
    }, 0);
    var minText = EXAM.examDuration ? Math.round(EXAM.examDuration / 60) : 0;

    el["pick-list"].innerHTML = EXAM.subjects.map(function (s) {
      return '<div class="pick-item" data-code="' + s.code + '">' +
        '<span class="code">' + s.code + "</span>" +
        '<span class="nm">' + escapeHtml(s.level + " " + s.name) + "</span>" +
        '<span class="meta">題庫 ' + (s.bankSize || 0) + " 題 / 官方 " +
        (EXAM.examCount || 0) + " 題 " + minText + " 分鐘</span>" +
        "</div>";
    }).join("");

    el["mode-wrap"].classList.add("hidden");

    Array.prototype.forEach.call(el["pick-list"].children, function (node) {
      node.addEventListener("click", function () {
        renderModes(findSubject(node.getAttribute("data-code")));
      });
    });
  }

  function renderModes(sub) {
    if (!sub) return;
    state.subject = sub;
    var minText = EXAM.examDuration ? Math.round(EXAM.examDuration / 60) : 0;
    var modes = [
      { key: "mock", title: "模擬測驗（官方規格）",
        desc: "從官方歷屆題庫隨機抽出 " + (EXAM.examCount || 0) +
              " 題，每題 " + (EXAM.scorePerQuestion || 0) +
              " 分，限時 " + minText + " 分鐘。及格標準 " +
              (EXAM.passScore || 0) + " 分。" },
      { key: "practice", title: "完整題庫練習",
        desc: "作答本題庫全部 " + (sub.bankSize || 0) +
              " 題，不限時、可反覆練習，不計及格判定。" }
    ];
    el["mode-list"].innerHTML = modes.map(function (m) {
      return '<div class="mode-item' + (m.key === "practice" ? " practice" : "") +
        '" data-mode="' + m.key + '">' +
        '<div class="mt">' + m.title + "</div>" +
        '<div class="md">' + escapeHtml(m.desc) + "</div>" +
        "</div>";
    }).join("");
    el["mode-wrap"].classList.remove("hidden");

    Array.prototype.forEach.call(el["mode-list"].children, function (node) {
      node.addEventListener("click", function () {
        buildSession(sub, node.getAttribute("data-mode"));
        renderNotice();
        show("scr-notice");
      });
    });
  }

  function changeSubject() {
    renderPick();
    show("scr-pick");
  }

  function findSubject(code) {
    for (var i = 0; i < EXAM.subjects.length; i++) {
      if (EXAM.subjects[i].code === code) return EXAM.subjects[i];
    }
    return null;
  }

  /* ---------------- 畫面：考試 ---------------- */
  function cur() { return state.qs[state.idx]; }

  function renderExam() {
    var sub = state.subject;
    el["bar-subject"].textContent = "[" + sub.level + "] " + sub.name;
    el["bar-mode"].textContent =
      state.mode === "mock" ? "模擬測驗 " + state.qs.length + " 題" : "題庫練習 " + state.qs.length + " 題";
    el["bar-id"].textContent =
      (state.candidate.name || "") + " /" + (state.candidate.id || "");
    renderTimer();
    renderQuestion();
    updateNavButtons();
  }

  function renderTimer() {
    if (!state.duration) {
      el["bar-timer"].textContent = "練習模式 / 不限時";
      el["bar-timer"].classList.remove("warn");
      return;
    }
    el["bar-timer"].textContent = mmss(state.left) + "/" + mmss(state.duration);
    el["bar-timer"].classList.toggle("warn", state.left <= 300);
  }

  function startTimer() {
    stopTimer();
    if (!state.duration) return;   // 練習模式不限時
    state.timer = setInterval(function () {
      state.left--;
      if (state.left <= 0) {
        state.left = 0;
        renderTimer();
        autoFinish();
        return;
      }
      renderTimer();
    }, 1000);
  }

  function stopTimer() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  function renderQuestion() {
    var q = cur();
    if (!q) return;

    el["q-no"].textContent = q.no;
    el["q-type"].textContent = "題目類型：" +
      (q.type === "multi" ? "複選題" : "單選題");
    el["q-stem"].textContent = q.stem;
    el["q-stem"].style.fontSize = (17 * state.zoom) + "px";

    el["q-area"].classList.toggle("q-marked", !!state.marks[q.no]);

    var picked = state.answers[q.no] || [];
    var isMulti = q.type === "multi";
    var locked = !!state.revealed[q.no];
    var keySet = {};
    (q.answer || []).forEach(function (L) { keySet[L] = true; });

    el["q-options"].innerHTML = q.options.map(function (text, i) {
      var L = LETTERS[i];
      var sel = picked.indexOf(L) >= 0;
      var cls = "opt" + (sel ? " sel" : "");
      if (locked) {
        if (keySet[L]) cls += " opt-correct";
        else if (sel) cls += " opt-wrong";
      }
      return '<div class="' + cls + '" data-l="' + L + '">' +
        '<span class="opt-mark ' + (isMulti ? "square" : "circle") + '"></span>' +
        '<span class="opt-key">' + L + "</span>" +
        '<span class="opt-text">' + escapeHtml(text) + "</span>" +
        "</div>";
    }).join("");

    el["q-area"].classList.toggle("locked", locked);
    renderFeedback(q, picked);

    Array.prototype.forEach.call(el["q-options"].children, function (node) {
      node.addEventListener("click", function () {
        toggleAnswer(node.getAttribute("data-l"));
      });
    });

    var hasFig = !!q.figure;
    el["q-figure"].classList.toggle("hidden", !hasFig);
    if (hasFig) {
      el["q-figure"].innerHTML = '<img src="' + q.figure + '" alt="附圖">';
    }
    document.querySelector('[data-act="figure"]').classList.toggle("hidden", !hasFig);
    document.querySelector('[data-act="mark"]').classList.toggle("on", !!state.marks[q.no]);

    save();
  }

  function answerKey(q) {
    return (q.answer || []).slice().sort().join("");
  }

  function myKey(q) {
    var mine = state.answers[q.no];
    return mine ? mine.slice().sort().join("") : "";
  }

  // 作答區即時核對條：顯示當初選的答案與正確答案
  function renderFeedback(q, picked) {
    var fb = el["q-feedback"];
    if (!state.revealed[q.no]) {
      fb.classList.add("hidden");
      fb.innerHTML = "";
      return;
    }
    var key = answerKey(q);
    var mine = myKey(q);
    var html, cls;
    if (!mine) {
      cls = "no";
      html = "本題尚未作答，正確答案：" + key;
    } else if (mine === key) {
      cls = "ok";
      html = "答對了！你的答案：" + mine + "，正確答案：" + key;
    } else {
      cls = "no";
      html = "答錯了！你的答案：" + mine + "，正確答案：" + key;
    }
    fb.className = "q-feedback " + cls;
    fb.innerHTML = html;
  }

  function toggleAnswer(L) {
    var q = cur();
    if (state.revealed[q.no]) {
      toast("本題已核對答案，不可更改");
      return;
    }
    var picked = (state.answers[q.no] || []).slice();
    var i = picked.indexOf(L);

    if (q.type === "multi") {
      if (i >= 0) picked.splice(i, 1); else picked.push(L);
      picked.sort();
      if (picked.length) state.answers[q.no] = picked;
      else delete state.answers[q.no];
    } else {
      if (i >= 0) delete state.answers[q.no];
      else state.answers[q.no] = [L];
    }
    renderQuestion();
  }

  function clearAnswer() {
    var q = cur();
    if (state.revealed[q.no]) {
      toast("本題已核對答案，不可更改");
      return;
    }
    delete state.answers[q.no];
    delete state.marks[q.no];
    renderQuestion();
    toast("已清除本題作答資料");
  }

  function toggleMark() {
    var q = cur();
    if (state.marks[q.no]) delete state.marks[q.no];
    else state.marks[q.no] = true;
    renderQuestion();
    toast(state.marks[q.no] ? "已標記本題（僅供參考，不影響評分）" : "已取消標記");
  }

  function go(delta) {
    var n = state.idx + delta;
    if (n < 0 || n >= state.qs.length) return;
    state.idx = n;
    renderQuestion();
    updateNavButtons();
  }

  function goto(no) {
    var n = no - 1;
    if (n < 0 || n >= state.qs.length) return;
    state.idx = n;
    show("scr-exam");
    renderQuestion();
    updateNavButtons();
  }

  function updateNavButtons() {
    var total = state.qs.length;
    document.querySelector('[data-act="prev"]').disabled = state.idx === 0;
    var nb = document.querySelector('[data-act="next"]');
    nb.disabled = false;
    nb.textContent = (state.idx === total - 1) ? "查看總覽" : "下一題 ▶";
  }

  // 下一題：先即時核對本題（顯示答對 / 答錯與正確答案），再跳下一題
  function nextQuestion() {
    var q = cur();
    if (!q) return;
    if (state.revealed[q.no]) {
      stepNext();
      return;
    }
    showFeedback(q, stepNext);
  }

  function stepNext() {
    if (state.idx >= state.qs.length - 1) {
      renderOverview();
      show("scr-overview");
    } else {
      go(1);
    }
  }

  function showFeedback(q, cb) {
    var key = answerKey(q);
    var mine = myKey(q);
    state.revealed[q.no] = true;
    save();
    renderQuestion();

    var html;
    if (!mine) {
      html = '<div class="t">第' + q.no + "題：尚未作答</div>" +
        kv("正確答案", key);
    } else if (mine === key) {
      html = '<div class="t" style="color:#1E8449">第' + q.no + "題：答對了！</div>" +
        kv("你的答案", mine) + kv("正確答案", key);
    } else {
      html = '<div class="t" style="color:#C0392B">第' + q.no + "題：答錯了！</div>" +
        kv("你的答案", mine) + kv("正確答案", key);
    }
    el["modal-body"].innerHTML = html;
    el["modal-no"].style.display = "none";
    el["modal-yes"].textContent = "確定";
    el["modal-wrap"].classList.remove("hidden");
    el["modal-yes"].onclick = function () {
      el["modal-wrap"].classList.add("hidden");
      restoreModalButtons();
      cb();
    };
  }

  function restoreModalButtons() {
    el["modal-no"].style.display = "";
    el["modal-yes"].textContent = "是(Y)";
  }

  function setZoom(d) {
    state.zoom = Math.min(1.6, Math.max(0.8, +(state.zoom + d).toFixed(2)));
    el["q-stem"].style.fontSize = (17 * state.zoom) + "px";
    el["q-options"].style.fontSize = (state.zoom) + "em";
  }

  /* ---------------- 畫面：試題總覽 ---------------- */
  function renderOverview() {
    var qs = state.qs;
    var done = 0, mark = 0, right = 0, wrong = 0;
    var html = qs.map(function (q) {
      var cls = "none";
      if (state.answers[q.no]) {
        done++;
        if (state.revealed[q.no]) {
          if (myKey(q) === answerKey(q)) { cls = "done"; right++; }
          else { cls = "bad"; wrong++; }
        } else {
          cls = "done";
        }
      }
      if (state.marks[q.no]) { cls = "mark"; mark++; }
      if (q.no === qs[state.idx].no) cls += " cur";
      return '<div class="ov-cell ' + cls + '" data-no="' + q.no + '">' + q.no + "</div>";
    }).join("");
    el["ov-grid"].innerHTML = html;

    Array.prototype.forEach.call(el["ov-grid"].children, function (n) {
      n.addEventListener("click", function () {
        goto(parseInt(n.getAttribute("data-no"), 10));
      });
    });

    var none = qs.length - done;
    el["ov-stat"].innerHTML =
      "學科總題數：" + qs.length + "<br>" +
      "已作答題數：" + done + "<br>" +
      "未作答題數：" + none + "<br>" +
      "已標記題數：" + mark + "<br>" +
      "已核對答對題數：" + right + "<br>" +
      "已核對答錯題數：" + wrong + "<br>" +
      '<span style="color:#6B7A88">題號顯示綠色為有作答、黃色為有註記、紅色為未作答、橘色為已核對答錯。點選各題圖示可回到該題查看當初選的答案與正確答案。</span>';
  }

  /* ---------------- 交卷 ---------------- */
  function stats() {
    var qs = state.qs;
    var answered = 0, correct = 0, mark = 0;
    qs.forEach(function (q) {
      var mine = state.answers[q.no];
      if (mine) {
        answered++;
        var key = q.answer.slice().sort().join("");
        if (mine.slice().sort().join("") === key) correct++;
      }
      if (state.marks[q.no]) mark++;
    });
    return { total: qs.length, answered: answered, none: qs.length - answered,
             mark: mark, correct: correct };
  }

  function askFinish() {
    restoreModalButtons();
    var s = stats();
    el["modal-body"].innerHTML =
      '<div class="t">以下是您本科測驗作答情況：</div>' +
      kv("學科總題數", s.total) +
      kv("已作答題數", s.answered) +
      kv("未作答題數", s.none) +
      kv("已標記題數", s.mark) +
      '<div style="margin-top:14px;color:#6B7A88">確定無誤，請點選「是」結束學科測驗。</div>';
    el["modal-wrap"].classList.remove("hidden");
    el["modal-yes"].onclick = function () {
      el["modal-wrap"].classList.add("hidden");
      doFinish();
    };
    el["modal-no"].onclick = function () {
      el["modal-wrap"].classList.add("hidden");
    };
  }

  function kv(k, v) {
    return '<div class="kv"><span>' + k + "</span><b>" + v + "</b></div>";
  }

  function autoFinish() {
    stopTimer();
    toast("測驗時間已到，自動交卷");
    doFinish();
  }

  function doFinish() {
    stopTimer();
    var s = stats();
    var mock = state.mode === "mock";
    state.score = s.total ? Math.round((s.correct / s.total) * EXAM.totalScore) : 0;
    state.finished = true;
    clearSave();

    var pass = state.score >= EXAM.passScore;
    var html = kv("測驗模式", mock ? "模擬測驗" : "完整題庫練習") +
      kv("學科總題數", s.total) +
      kv("已作答題數", s.answered) +
      kv("未作答題數", s.none) +
      kv("答對題數", s.correct) +
      kv("本科得分", state.score);

    if (mock) {
      html += '<div style="margin-top:8px;color:#6B7A88">本科及格標準：' +
        EXAM.passScore + " 分</div>" +
        '<div class="' + (pass ? "pass" : "fail") +
        '" style="font-weight:bold;margin-top:4px">' +
        (pass ? "本科及格" : "本科未達及格標準") + "</div>";
      if (EXAM.certRule) {
        html += '<div style="margin-top:8px;color:#6B7A88;font-size:13px">授證資格：' +
          escapeHtml(EXAM.certRule) + "</div>";
      }
    } else {
      html += '<div style="margin-top:8px;color:#6B7A88">練習模式僅供複習，不進行及格判定。</div>';
    }
    el["done-score"].innerHTML = html;
    show("scr-done");
  }

  function backSystem() {
    state.subject = null;
    state.qs = [];
    state.mode = "mock";
    state.duration = 0;
    state.idx = 0;
    state.left = 0;
    state.answers = {};
    state.marks = {};
    state.revealed = {};
    state.finished = false;
    state.score = null;
    el["login-id"].value = "";
    state.candidate = { name: "", id: "" };
    show("scr-login");
    renderLogin();
  }

  /* ---------------- 事件 ---------------- */
  var ACTIONS = {
    "login-submit": doLogin,
    "login-cancel": cancelLogin,
    "start-exam": startFromNotice,
    "prev": function () { go(-1); },
    "next": nextQuestion,
    "clear": clearAnswer,
    "mark": toggleMark,
    "figure": function () {
      var q = cur();
      if (q && q.figure) window.open(q.figure, "_blank");
    },
    "zoom-in": function () { setZoom(0.1); },
    "zoom-out": function () { setZoom(-0.1); },
    "overview": function () { renderOverview(); show("scr-overview"); },
    "close-overview": function () { show("scr-exam"); renderQuestion(); },
    "change-subject": changeSubject,
    "finish": askFinish,
    "back-system": backSystem
  };

  function bind() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act]");
      if (!t) return;
      var fn = ACTIONS[t.getAttribute("data-act")];
      if (fn) fn();
    });

    el["login-id"].addEventListener("keydown", function (e) {
      if (e.key === "Enter") doLogin();
    });

    el["modal-wrap"].addEventListener("click", function (e) {
      if (e.target === el["modal-wrap"]) el["modal-no"].click();
    });

    document.addEventListener("keydown", function (e) {
      if (state.screen !== "scr-exam") return;
      var q = cur();
      if (!q) return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") nextQuestion();
      else if (["1", "2", "3", "4"].indexOf(e.key) >= 0) {
        toggleAnswer(LETTERS[+e.key - 1]);
      } else if (e.key === "m" || e.key === "M") toggleMark();
    });
  }

  /* ---------------- 啟動 ---------------- */
  function init(data) {
    // 支援 data.exam 包裹格式，或直接的題庫物件
    EXAM = (data && data.exam) ? data.exam : data;
    if (!EXAM || !EXAM.subjects || !EXAM.subjects.length) {
      document.body.innerHTML =
        '<p style="padding:40px;font-size:16px">題庫資料格式錯誤。</p>';
      return;
    }
    cacheEls();
    bind();
    show("scr-login");
    renderLogin();

    window.ipasExam = {
      subjectList: function () {
        return EXAM.subjects.map(function (s) {
          return s.level + " " + s.name + "（題庫 " + (s.bankSize || 0) + " 題）";
        });
      },
      start: function (code, mode) {
        var sub = findSubject(code || EXAM.subjects[0].code);
        state.candidate = { name: "考生", id: "A123456789" };
        buildSession(sub, mode || "mock");
        renderNotice();
        startFromNotice();
      },
      question: function () {
        var q = cur();
        return q ? { no: q.no, answer: (q.answer || []).slice() } : null;
      },
      state: function () {
        return { screen: state.screen, idx: state.idx, answers: state.answers,
                 marks: state.marks, revealed: state.revealed,
                 left: state.left, score: state.score,
                 mode: state.mode, duration: state.duration, total: state.qs.length,
                 subject: state.subject ? state.subject.code : null };
      }
    };
  }

  function boot() {
    // 以 file:// 直接開啟時 fetch 會被瀏覽器阻擋，改用 js/data.js 的內嵌資料
    if (window.IPAS_DATA) {
      init(window.IPAS_DATA);
      return;
    }
    var attempts = 0;
    function tryLoad() {
      fetch("data/exam_info.json")
        .then(function (r) { return r.json(); })
        .then(init)
        .catch(function () {
          if (++attempts < 3) setTimeout(tryLoad, 400);
          else document.body.innerHTML =
            '<p style="padding:40px;font-size:16px">無法載入題庫資料，' +
            '請確認 js/data.js 存在，或改以本機伺服器開啟' +
            '（python -m http.server）。</p>';
        });
    }
    tryLoad();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
