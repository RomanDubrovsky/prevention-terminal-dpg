/* Educator free bot — website: case consultant + group lesson plan builder */
(function () {
  "use strict";

  var root = document.getElementById("educator-chat-root");
  if (!root) return;

  var script = document.currentScript;
  var locale = (root.getAttribute("data-locale") || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
  var terminalUrl =
    (root.getAttribute("data-terminal-url") || "https://prevention.school/terminal/staging/").trim();
  var rawApi = (
    window.PN_EDUCATOR_API_BASE ||
    (script && script.getAttribute("data-api-base")) ||
    "https://api.prevention.school"
  ).trim();
  if (!rawApi || rawApi === "__API_BASE__") {
    rawApi = "https://api.prevention.school";
  }

  var cfg = {
    apiBase: rawApi.replace(/\/$/, ""),
    appId: "educator_companion",
    source: "educator_web",
    dailyLimit: 18,
  };

  var sessionID = "sess_" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  function getSessionId() { return sessionID; }

  function sendAnalyticsEvent(eventType, extra) {
    try {
      var body = {
        event_type: eventType,
        app_id: cfg.appId,
        user_id: userId(),
        session_id: getSessionId(),
      };
      if (extra) {
        body.extra = extra;
      }
      fetch(cfg.apiBase + "/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).catch(function(){});
    } catch(e) {}
  }

  // Record page open
  setTimeout(function() {
    sendAnalyticsEvent("app_open", { url: window.location.pathname });
  }, 1000);

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
      thinking: "AI is thinking…",
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
      thinking: "ИИ думает…",
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

  // Inject switcher and typing styles inline
  var style = document.createElement("style");
  style.textContent =
    ".educator-mode-switcher{display:flex;gap:8px;margin-bottom:12px;}" +
    ".educator-mode-btn{flex:1;padding:10px 14px;border-radius:12px;border:2px solid var(--border,#cbd5e1);background:var(--surface,#fff);font-weight:650;font-size:13px;cursor:pointer;color:var(--muted,#64748b);transition:all .2s;}" +
    ".educator-mode-btn--active{border-color:#0f766e;background:#f0fdf4;color:#0f766e;}" +
    ".educator-mode-btn:hover:not(.educator-mode-btn--active){border-color:#0f766e;color:#0f766e;}" +
    ".educator-chat-msg{white-space:pre-wrap;}" +
    ".educator-chat-msg--plan{background:var(--surface-soft,#f8fafc);border-left:3px solid #0f766e;padding-left:16px;}" +
    ".edu-plan-note{margin-top:12px;font-size:12px;color:var(--muted,#64748b);border-top:1px solid var(--border,#e2e8f0);padding-top:10px;}" +
    ".educator-chat-msg--typing{display:inline-flex;align-items:center;gap:10px;color:#0f766e;background:rgba(15,118,110,0.08);border:1px solid rgba(15,118,110,0.2);border-radius:12px;padding:10px 14px;font-weight:550;animation:eduPulse 1.8s infinite ease-in-out;}" +
    ".educator-typing-dots{display:inline-flex;gap:4px;align-items:center;}" +
    ".educator-typing-dots span{width:7px;height:7px;border-radius:50%;background-color:#0f766e;display:inline-block;animation:eduDotBlink 1.4s infinite ease-in-out both;}" +
    ".educator-typing-dots span:nth-child(1){animation-delay:0s;}" +
    ".educator-typing-dots span:nth-child(2){animation-delay:0.2s;}" +
    ".educator-typing-dots span:nth-child(3){animation-delay:0.4s;}" +
    "@keyframes eduDotBlink{0%,80%,100%{opacity:0.3;transform:scale(0.8);}40%{opacity:1;transform:scale(1.2);}}" +
    "@keyframes eduPulse{0%,100%{opacity:1;}50%{opacity:0.75;}}" +
    ".pn-feedback-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;}" +
    ".pn-feedback-modal{background:#fff;border-radius:16px;max-width:480px;width:100%;padding:20px;box-shadow:0 20px 40px rgba(0,0,0,0.2);font-family:inherit;color:#0f172a;box-sizing:border-box;}" +
    ".pn-feedback-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;}" +
    ".pn-feedback-header h3{margin:0;font-size:1.05rem;font-weight:700;color:#0f766e;}" +
    ".pn-feedback-close{background:none;border:none;font-size:1.4rem;color:#94a3b8;cursor:pointer;padding:0 4px;}" +
    ".pn-feedback-desc{font-size:0.85rem;color:#475569;line-height:1.4;margin:0 0 14px;}" +
    ".pn-feedback-preview{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;font-size:0.8rem;color:#334155;margin-bottom:14px;max-height:110px;overflow-y:auto;}" +
    ".pn-feedback-preview-item{margin-bottom:6px;line-height:1.35;}" +
    ".pn-feedback-input{width:100%;min-height:80px;padding:10px;border-radius:8px;border:1px solid #cbd5e1;font:inherit;font-size:0.85rem;margin-bottom:12px;resize:vertical;box-sizing:border-box;}" +
    ".pn-feedback-status{font-size:0.8rem;margin-bottom:10px;min-height:18px;}" +
    ".pn-feedback-actions{display:flex;justify-content:flex-end;gap:10px;}" +
    ".pn-feedback-cancel{padding:8px 16px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#475569;font:inherit;font-size:0.85rem;font-weight:600;cursor:pointer;}" +
    ".pn-feedback-submit{padding:8px 18px;border-radius:8px;border:none;background:#0f766e;color:#fff;font:inherit;font-size:0.85rem;font-weight:650;cursor:pointer;}" +
    ".educator-feedback-btn{background:none;border:none;color:#94a3b8;font-size:0.75rem;cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:4px 6px;border-radius:4px;transition:all 0.2s;}" +
    ".educator-feedback-btn:hover{background:rgba(15,118,110,0.08);color:#0f766e;}";
  document.head.appendChild(style);

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function openFeedbackModal(opts) {
    var isRu = (opts.locale || "ru") === "ru";
    var overlay = document.createElement("div");
    overlay.className = "pn-feedback-modal-overlay";

    var modal = document.createElement("div");
    modal.className = "pn-feedback-modal";

    var promptPreview = (opts.prompt || "").slice(0, 300);
    var respPreview = (opts.response || "").slice(0, 300);

    modal.innerHTML =
      '<div class="pn-feedback-header">' +
        '<h3>⚠️ ' + (isRu ? 'Сообщить об ошибке в ответе ИИ' : 'Report an issue with AI response') + '</h3>' +
        '<button type="button" class="pn-feedback-close">&times;</button>' +
      '</div>' +
      '<p class="pn-feedback-desc">' +
        (isRu
          ? 'К вашему обращению автоматически прикрепятся ваш вопрос, ответ бота и системные логи. Вы можете просто нажать «Отправить» или оставить свой комментарий.'
          : 'Your prompt, bot reply, and system logs will be attached automatically. You can click Send directly or add a comment.') +
      '</p>' +
      '<div class="pn-feedback-preview">' +
        '<div class="pn-feedback-preview-item"><strong>' + (isRu ? 'Ваш вопрос:' : 'Your prompt:') + '</strong> ' + escapeHtml(promptPreview) + '</div>' +
        '<div class="pn-feedback-preview-item"><strong>' + (isRu ? 'Ответ бота:' : 'Bot response:') + '</strong> ' + escapeHtml(respPreview) + '…</div>' +
      '</div>' +
      '<textarea class="pn-feedback-input" placeholder="' +
        (isRu ? 'Опишите, что именно показалось некорректным (необязательно)…' : 'Describe what was incorrect (optional)…') +
      '"></textarea>' +
      '<div class="pn-feedback-status"></div>' +
      '<div class="pn-feedback-actions">' +
        '<button type="button" class="pn-feedback-cancel">' + (isRu ? 'Отмена' : 'Cancel') + '</button>' +
        '<button type="button" class="pn-feedback-submit">' + (isRu ? 'Отправить' : 'Send') + '</button>' +
      '</div>';

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var closeBtn = modal.querySelector(".pn-feedback-close");
    var cancelBtn = modal.querySelector(".pn-feedback-cancel");
    var submitBtn = modal.querySelector(".pn-feedback-submit");
    var textarea = modal.querySelector(".pn-feedback-input");
    var statusEl = modal.querySelector(".pn-feedback-status");

    function close() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    submitBtn.addEventListener("click", function () {
      var userComment = (textarea.value || "").trim();
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      statusEl.textContent = isRu ? "Отправка тикета…" : "Submitting ticket…";

      var formattedMsg =
        "[ОБРАТНАЯ СВЯЗЬ ПО ОТВЕТУ ИИ]\n" +
        "Комментарий пользователя: " + (userComment || "(без дополнительного комментария)") + "\n\n" +
        "Вопрос пользователя:\n" + (opts.prompt || "—") + "\n\n" +
        "Ответ ИИ:\n" + (opts.response || "—") + "\n\n" +
        "Метаданные: URL=" + window.location.href + " | UserID=" + opts.userId + " | AppID=" + (opts.appId || "educator_companion");

      fetch((opts.apiBase || "https://api.prevention.school") + "/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: opts.userId,
          app_id: opts.appId || "educator_companion",
          category: "ai_feedback",
          message: formattedMsg,
          client_meta: {
            user_comment: userComment,
            prompt: opts.prompt,
            response: opts.response,
            url: window.location.href,
            timestamp: new Date().toISOString()
          }
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok) {
            modal.innerHTML =
              '<div style="text-align:center;padding:20px;">' +
                '<div style="font-size:2.5rem;margin-bottom:12px;">✅</div>' +
                '<h3 style="margin:0 0 10px;font-size:1.1rem;color:#0f766e;">' + (isRu ? 'Спасибо за содействие!' : 'Thank you for your feedback!') + '</h3>' +
                '<p style="margin:0 0 18px;font-size:0.9rem;color:#64748b;">' + (isRu ? 'Ваше замечание передано команде для улучшения ответов ИИ.' : 'Your feedback was sent to our team.') + '</p>' +
                '<button type="button" class="pn-feedback-submit" style="width:100%;">' + (isRu ? 'Закрыть' : 'Close') + '</button>' +
              '</div>';
            var okBtn = modal.querySelector("button");
            if (okBtn) okBtn.addEventListener("click", close);
          } else {
            statusEl.style.color = "#dc2626";
            statusEl.textContent = (isRu ? "Ошибка: " : "Error: ") + (res.error || "failed to send");
            submitBtn.disabled = false;
            cancelBtn.disabled = false;
          }
        })
        .catch(function () {
          statusEl.style.color = "#dc2626";
          statusEl.textContent = isRu ? "Ошибка соединения. Попробуйте позже." : "Connection error. Try again later.";
          submitBtn.disabled = false;
          cancelBtn.disabled = false;
        });
    });
  }

  // ── DOM references ──────────────────────────────────────────────────────
  var messagesEl = document.getElementById("educator-chat-messages");
  var form = document.getElementById("educator-chat-form");
  var input = document.getElementById("educator-chat-input");
  var quotaEl = document.getElementById("educator-chat-quota");
  var sendBtn = document.getElementById("educator-chat-send");
  var honeypot = document.getElementById("educator-chat-hp");
  var busy = false;
  var typingEl = null;
  var typingTimer = null;
  var origSendBtnText = "";
  var lastUserPrompt = "";

  var THINKING_PHRASES = {
    ru: [
      "ИИ думает…",
      "Анализирую педагогическую ситуацию…",
      "Подбираю методические рекомендации…",
      "Формулирую ответ простым языком…",
      "Секунду, генерирую рекомендации…"
    ],
    en: [
      "AI is thinking…",
      "Analyzing the classroom situation…",
      "Selecting pedagogical guidance…",
      "Formulating recommendation in plain terms…",
      "Just a moment, generating steps…"
    ]
  };

  function showTyping() {
    if (typingEl) return;
    var phrases = THINKING_PHRASES[locale] || THINKING_PHRASES.en;
    var phraseIdx = 0;

    typingEl = document.createElement("div");
    typingEl.className = "educator-chat-msg educator-chat-msg--ai educator-chat-msg--typing";
    typingEl.innerHTML =
      '<span class="educator-typing-text">' + phrases[0] + '</span>' +
      '<span class="educator-typing-dots"><span></span><span></span><span></span></span>';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (sendBtn) {
      origSendBtnText = sendBtn.textContent;
      sendBtn.textContent = locale === "ru" ? "Думает…" : "Thinking…";
      sendBtn.disabled = true;
    }
    if (input) input.disabled = true;

    typingTimer = setInterval(function () {
      if (!typingEl) return;
      phraseIdx = (phraseIdx + 1) % phrases.length;
      var textEl = typingEl.querySelector(".educator-typing-text");
      if (textEl) textEl.textContent = phrases[phraseIdx];
    }, 2200);
  }

  function hideTyping() {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
    if (typingEl && typingEl.parentNode) {
      typingEl.parentNode.removeChild(typingEl);
    }
    typingEl = null;
    if (sendBtn) {
      sendBtn.disabled = false;
      if (origSendBtnText) sendBtn.textContent = origSendBtnText;
    }
    if (input) input.disabled = false;
  }

  function setMode(mode) {
    if (busy) return;
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
    sendAnalyticsEvent("mode_open", { mode: mode });
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

  function formatMarkdown(text) {
    if (!text) return "";
    var html = String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Italic *text*
    html = html.replace(/(^|[^\*])\*([^\*\n]+)\*/g, "$1<em>$2</em>");

    var lines = html.split("\n");
    var out = [];
    var inUl = false;
    var inOl = false;

    for (var i = 0; i < lines.length; i++) {
      var rawLine = lines[i];
      var trimmed = rawLine.trim();

      if (!trimmed) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (inOl) { out.push("</ol>"); inOl = false; }
        out.push("<div style='height:6px;'></div>");
        continue;
      }

      var hMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
      if (hMatch) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (inOl) { out.push("</ol>"); inOl = false; }
        var level = hMatch[1].length;
        var tag = level === 1 ? "h3" : "h4";
        out.push("<" + tag + " style='margin:10px 0 4px;font-weight:700;color:inherit;'>" + hMatch[2] + "</" + tag + ">");
        continue;
      }

      var ulMatch = rawLine.match(/^\s*[\*\-]\s+(.*)/);
      if (ulMatch) {
        if (inOl) { out.push("</ol>"); inOl = false; }
        if (!inUl) { out.push("<ul style='margin:4px 0 8px;padding-left:20px;'>"); inUl = true; }
        out.push("<li style='margin-bottom:3px;'>" + ulMatch[1] + "</li>");
        continue;
      }

      var olMatch = rawLine.match(/^\s*\d+\.\s+(.*)/);
      if (olMatch) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (!inOl) { out.push("<ol style='margin:4px 0 8px;padding-left:20px;'>"); inOl = true; }
        out.push("<li style='margin-bottom:3px;'>" + olMatch[1] + "</li>");
        continue;
      }

      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
      out.push("<div>" + trimmed + "</div>");
    }

    if (inUl) out.push("</ul>");
    if (inOl) out.push("</ol>");

    return out.join("");
  }

  function appendMsg(text, who, isPlan) {
    var el = document.createElement("div");
    el.className = "educator-chat-msg educator-chat-msg--" + (who || "ai");
    if (isPlan) el.classList.add("educator-chat-msg--plan");
    if (who === "ai") {
      var bodyEl = document.createElement("div");
      bodyEl.innerHTML = formatMarkdown(text);
      el.appendChild(bodyEl);

      if (text !== t.welcomeCase && text !== t.welcomePlan) {
        var actions = document.createElement("div");
        actions.style.textAlign = "right";
        var feedbackBtn = document.createElement("button");
        feedbackBtn.type = "button";
        feedbackBtn.className = "educator-feedback-btn";
        feedbackBtn.innerHTML = '<span>⚠️</span> <span>' + (locale === "ru" ? "Сообщить об ошибке" : "Report issue") + '</span>';
        var promptForThis = lastUserPrompt;
        feedbackBtn.addEventListener("click", function () {
          openFeedbackModal({
            prompt: promptForThis,
            response: text,
            appId: cfg.appId,
            locale: locale,
            apiBase: cfg.apiBase,
            userId: userId()
          });
        });
        actions.appendChild(feedbackBtn);
        el.appendChild(actions);
      }
    } else {
      el.textContent = String(text || "");
      lastUserPrompt = String(text || "");
    }
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

    showTyping();

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
        hideTyping();
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
        hideTyping();
        appendMsg(t.offline, "ai");
      })
      .finally(function () {
        hideTyping();
        busy = false;
        if (input) input.focus();
      });
  });
})();
