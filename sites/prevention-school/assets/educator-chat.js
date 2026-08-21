/* Educator free bot — website: case consultant + group lesson plan builder */
(function () {
  "use strict";

  var root = document.getElementById("educator-chat-root");
  if (!root) return;

  var script = document.currentScript;
  var locale = (root.getAttribute("data-locale") || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
  var terminalUrl =
    (root.getAttribute("data-terminal-url") || "https://prevention.school/terminal/staging/").trim();
  var cfg = {
    apiBase: (
      window.PN_EDUCATOR_API_BASE ||
      (script && script.getAttribute("data-api-base")) ||
      "https://api.prevention.school"
    )
      .trim()
      .replace(/\/$/, ""),
    appId: "educator_companion",
    source: "educator_web",
    dailyLimit: 18,
  };

  var I18N = {
    en: {
      modeCase: "Discuss a situation",
      modePlan: "Create a lesson plan",
      welcomeCase:
        "Hello! Describe a classroom situation — behavior, conflict, motivation, parents. " +
        "I'll give you concrete steps in plain teacher language.",
      welcomePlan:
        "Hello! I'll help you design a group lesson on healthy lifestyles or prevention. " +
        "Please provide: topic (e.g. stress, bullying, internet safety, healthy habits), " +
        "age group or grade, and lesson duration (in minutes).",
      placeholderCase: "e.g. A 7th-grader keeps disrupting lessons…",
      placeholderPlan: "e.g. Topic: screen addiction, grade 8, 45 minutes",
      send: "Send",
      quota: function (left, limit) {
        return "Free: " + left + " of " + limit + " messages today.";
      },
      dailyLimit: "Daily limit reached. Please try again tomorrow.",
      offline: "Connection error. Please try again later.",
      empty: "Empty response.",
      unavailable: "Service temporarily unavailable.",
      hpLabel: "Do not fill",
    },
    ru: {
      modeCase: "Обсудить ситуацию",
      modePlan: "Создать план занятия",
      welcomeCase:
        "Здравствуйте! Опишите ситуацию в классе — поведение, конфликт, мотивация, родители. " +
        "Получите конкретные шаги педагогическим языком, без воды.",
      welcomePlan:
        "Здравствуйте! Помогу составить сценарий группового занятия по ЗОЖ и профилактике. " +
        "Укажите: тему (например: стресс, буллинг, безопасность в интернете, вредные привычки), " +
        "возраст или класс и длительность занятия в минутах.",
      placeholderCase: "Например: ученик 7 класса постоянно срывает урок…",
      placeholderPlan: "Например: тема — зависимость от экранов, 8 класс, 45 минут",
      send: "Отправить",
      quota: function (left, limit) {
        return "Бесплатно: " + left + " из " + limit + " сообщений на сегодня.";
      },
      dailyLimit:
        "Дневной лимит исчерпан. Попробуйте снова завтра.",
      offline: "Нет соединения. Попробуйте позже.",
      empty: "Пустой ответ.",
      unavailable: "Сервис временно недоступен.",
      hpLabel: "Не заполняйте",
    },
  };

  var t = I18N[locale] || I18N.en;
  var currentMode = "case"; // "case" | "lesson_plan"

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

  // ── Build mode switch UI ────────────────────────────────────────────────
  var chatRoot = document.getElementById("educator-chat-root");
  var modeSwitcher = document.createElement("div");
  modeSwitcher.className = "educator-mode-switcher";
  modeSwitcher.innerHTML =
    '<button class="educator-mode-btn educator-mode-btn--active" data-mode="case">' +
    (locale === "ru" ? "💬 " + t.modeCase : "💬 " + t.modeCase) +
    "</button>" +
    '<button class="educator-mode-btn" data-mode="lesson_plan">' +
    (locale === "ru" ? "📋 " + t.modePlan : "📋 " + t.modePlan) +
    "</button>";
  chatRoot.insertBefore(modeSwitcher, chatRoot.firstChild);

  // Inject switcher styles inline
  var style = document.createElement("style");
  style.textContent =
    ".educator-mode-switcher{display:flex;gap:8px;margin-bottom:12px;}" +
    ".educator-mode-btn{flex:1;padding:10px 14px;border-radius:12px;border:2px solid var(--border,#cbd5e1);background:var(--surface,#fff);font-weight:650;font-size:13px;cursor:pointer;color:var(--muted,#64748b);transition:all .2s;}" +
    ".educator-mode-btn--active{border-color:#0f766e;background:#f0fdf4;color:#0f766e;}" +
    ".educator-mode-btn:hover:not(.educator-mode-btn--active){border-color:#0f766e;color:#0f766e;}" +
    ".educator-chat-msg{white-space:pre-wrap;}" +
    ".educator-chat-msg--plan{background:var(--surface-soft,#f8fafc);border-left:3px solid #0f766e;padding-left:16px;}" +
    ".edu-plan-note{margin-top:12px;font-size:12px;color:var(--muted,#64748b);border-top:1px solid var(--border,#e2e8f0);padding-top:10px;}";
  document.head.appendChild(style);

  // ── DOM references ──────────────────────────────────────────────────────
  var messagesEl = document.getElementById("educator-chat-messages");
  var form = document.getElementById("educator-chat-form");
  var input = document.getElementById("educator-chat-input");
  var quotaEl = document.getElementById("educator-chat-quota");
  var sendBtn = document.getElementById("educator-chat-send");
  var honeypot = document.getElementById("educator-chat-hp");
  var busy = false;

  function setMode(mode) {
    currentMode = mode;
    var btns = modeSwitcher.querySelectorAll(".educator-mode-btn");
    btns.forEach(function (btn) {
      if (btn.getAttribute("data-mode") === mode) {
        btn.classList.add("educator-mode-btn--active");
      } else {
        btn.classList.remove("educator-mode-btn--active");
      }
    });
    if (input) {
      input.placeholder = mode === "lesson_plan" ? t.placeholderPlan : t.placeholderCase;
    }
    // Show mode welcome in chat
    var welcomeText = mode === "lesson_plan" ? t.welcomePlan : t.welcomeCase;
    appendMsg(welcomeText, "ai");
  }

  modeSwitcher.addEventListener("click", function (e) {
    var btn = e.target.closest(".educator-mode-btn");
    if (!btn) return;
    var mode = btn.getAttribute("data-mode");
    if (mode && mode !== currentMode) setMode(mode);
  });



  function updateQuotaHint(remaining) {
    if (!quotaEl) return;
    var left = typeof remaining === "number" ? remaining : Math.max(0, cfg.dailyLimit - turnCount());
    quotaEl.textContent = t.quota(left, cfg.dailyLimit);
  }

  function appendMsg(text, who, isPlan) {
    var el = document.createElement("div");
    el.className = "educator-chat-msg educator-chat-msg--" + (who || "ai");
    if (isPlan) el.classList.add("educator-chat-msg--plan");
    el.textContent = String(text || "");
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  appendMsg(t.welcomeCase, "ai");
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
        mode: currentMode,
        source: cfg.source,
        user_locale: locale,
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
          appendMsg(d.detail || t.dailyLimit, "ai");
          updateQuotaHint(0);
          return;
        }
        var reply =
          d.reply || d.text || d.detail || (res.ok ? t.empty : t.unavailable);
        appendMsg(reply, "ai", currentMode === "lesson_plan");
        if (d.extra && typeof d.extra.remaining === "number") {
          updateQuotaHint(d.extra.remaining);
        }
      })
      .catch(function () {
        appendMsg(t.offline, "ai");
      })
      .finally(function () {
        busy = false;
      });
  });
})();
