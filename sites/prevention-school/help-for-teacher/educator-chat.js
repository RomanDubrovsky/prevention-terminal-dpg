/* Бесплатный ИИ-помощник для педагогов — лид-магнит без регистрации */
(function () {
  "use strict";

  var script = document.currentScript;
  var cfg = {
    apiBase: (window.PN_EDUCATOR_API_BASE || (script && script.getAttribute("data-api-base")) || "https://api.prevention.school")
      .trim()
      .replace(/\/$/, ""),
    appId: "educator_companion",
    source: "educator_web",
    dailyLimit: 18,
  };

  var LS_UID = "educator_web_uid";
  var LS_TURNS = "educator_web_turns";

  function userId() {
    try {
      var id = localStorage.getItem(LS_UID);
      if (!id) {
        id = "educator_" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        localStorage.setItem(LS_UID, id);
      }
      return id;
    } catch (_) {
      return "educator_" + String(Date.now());
    }
  }

  function turnCount() {
    try {
      var raw = localStorage.getItem(LS_TURNS);
      var data = raw ? JSON.parse(raw) : {};
      var day = String(Math.floor(Date.now() / 86400000));
      if (data.day !== day) return 0;
      return Number(data.count) || 0;
    } catch (_) {
      return 0;
    }
  }

  function bumpTurnCount() {
    try {
      var day = String(Math.floor(Date.now() / 86400000));
      localStorage.setItem(LS_TURNS, JSON.stringify({ day: day, count: turnCount() + 1 }));
    } catch (_) {}
  }

  function apiUrl(path) {
    return cfg.apiBase + path;
  }

  var root = document.getElementById("educator-chat-root");
  if (!root) return;

  var messagesEl = document.getElementById("educator-chat-messages");
  var form = document.getElementById("educator-chat-form");
  var input = document.getElementById("educator-chat-input");
  var quotaEl = document.getElementById("educator-chat-quota");
  var honeypot = document.getElementById("educator-chat-hp");
  var busy = false;

  function updateQuotaHint(remaining) {
    if (!quotaEl) return;
    var used = turnCount();
    var left = typeof remaining === "number" ? remaining : Math.max(0, cfg.dailyLimit - used);
    quotaEl.textContent =
      "Бесплатно: " +
      left +
      " из " +
      cfg.dailyLimit +
      " сообщений на сегодня. Без лимита — в Prevention Terminal (режим «Педагог»).";
  }

  function appendMsg(text, who) {
    var el = document.createElement("div");
    el.className = "educator-chat-msg educator-chat-msg--" + (who || "ai");
    el.textContent = String(text || "");
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  appendMsg(
    "Здравствуйте! Опишите ситуацию в классе или с обучающимся — разберём по шагам, простым педагогическим языком. " +
      "Не называйте ФИО: достаточно возраста и сути.",
    "ai"
  );
  updateQuotaHint();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    if (honeypot && honeypot.value) return;
    var text = String(input.value || "").trim();
    if (!text) return;
    input.value = "";
    appendMsg(text, "user");
    busy = true;
    bumpTurnCount();
    updateQuotaHint();

    fetch(apiUrl("/api/chat?app_id=" + encodeURIComponent(cfg.appId)), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId(),
        message: text,
        role: "teacher",
        source: cfg.source,
        user_locale: "ru",
      }),
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, status: r.status, data: d };
        });
      })
      .then(function (res) {
        var d = res.data || {};
        if (res.status === 429 && d.error === "educator_daily_limit") {
          appendMsg(d.detail || "Дневной лимит исчерпан. Скачайте Prevention Terminal — там без ограничений.", "ai");
          updateQuotaHint(0);
          return;
        }
        var reply =
          d.reply ||
          d.text ||
          d.detail ||
          (res.ok ? "Пустой ответ." : "Сервис временно недоступен. Попробуйте позже.");
        appendMsg(reply, "ai");
        if (d.extra && typeof d.extra.remaining === "number") {
          updateQuotaHint(d.extra.remaining);
        }
      })
      .catch(function () {
        appendMsg("Нет соединения с сервером. Проверьте интернет или попробуйте позже.", "ai");
      })
      .finally(function () {
        busy = false;
      });
  });
})();
