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
      shareChat: "Share dialogue",
      shareMsg: "Share",
      copyMsg: "Copy",
      copied: "Copied!",
      selectMode: "Select messages",
      cancelSelect: "Cancel",
      copySelected: function(n) { return "Copy selected (" + n + ")"; },
      dialogueTitle: "Dialogue with Educator AI Assistant:",
      userRole: "Teacher",
      aiRole: "AI Assistant",
      reportIssue: "Report issue"
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
        return "Лимит: " + left + " из " + limit + " сообщений на сегодня.";
      },
      dailyLimit:
        "Дневной лимит исчерпан. Попробуйте снова завтра.",
      offline: "Нет соединения. Попробуйте позже.",
      empty: "Пустой ответ.",
      unavailable: "Сервис временно недоступен.",
      hpLabel: "Не заполняйте",
      shareChat: "Поделиться диалогом",
      shareMsg: "Поделиться",
      copyMsg: "Копировать",
      copied: "Скопировано!",
      selectMode: "Выбрать",
      cancelSelect: "Отмена",
      copySelected: function(n) { return "Скопировать (" + n + ")"; },
      dialogueTitle: "Диалог с ИИ-помощником педагога:",
      userRole: "Педагог",
      aiRole: "ИИ-помощник",
      reportIssue: "Сообщить об ошибке"
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

  // ── Clipboard & Share Helpers ───────────────────────────────────────────
  function showToast(msg) {
    var toast = document.createElement("div");
    toast.className = "educator-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2200);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast(t.copied);
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast(t.copied);
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function shareData(title, text) {
    var shareUrl = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: title || document.title,
        text: text,
      }).catch(function(e) {
        if (e && e.name !== "AbortError") {
          copyToClipboard(text);
        }
      });
    } else {
      copyToClipboard(text);
    }
  }

  function createCaseLink(prompt, answer, btn) {
    var origText = btn ? btn.innerHTML : "";
    if (btn) btn.innerHTML = "<span>⏳</span>";
    return fetch(apiUrl("/api/share/case/create"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userId(),
        app_id: cfg.appId,
        question_text: prompt || (locale === "ru" ? "Ситуация в классе" : "Classroom situation"),
        answer_text: answer,
        consent: true,
        locale: locale
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (btn) btn.innerHTML = origText;
      if (d.ok && d.share_link) {
         var p = d.preview || {};
         var ctx = p.context || p.question || prompt;
         var ans = p.answer || answer;
         var txt = (locale === "ru" 
             ? "Здравствуйте! Пример ситуации в школе (обезличено):\n\n" + ctx + "\n\nОтвет ИИ-помощника педагога:\n" + ans + "\n\nПо ссылке можно посмотреть полностью и задать свои вопросы:"
             : "Hello! Anonymized classroom situation example:\n\n" + ctx + "\n\nAI Assistant response:\n" + ans + "\n\nFollow the link to continue the discussion:") + "\n" + d.share_link;
         return { link: d.share_link, text: txt };
      }
      throw new Error(d.error || "Failed to create link");
    }).catch(function(e) {
      if (btn) btn.innerHTML = origText;
      throw e;
    });
  }


  // ── Build mode switch UI & toolbar ──────────────────────────────────────
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

  // Action topbar (Share Dialogue & Select Mode)
  var topbar = document.createElement("div");
  topbar.className = "educator-chat-topbar";
  topbar.innerHTML =
    '<div style="font-size:12px;font-weight:650;color:var(--muted,#64748b);display:flex;align-items:center;gap:6px;">' +
      '<span>🤖</span><span>Prevention-AI</span>' +
    '</div>' +
    '<div class="educator-topbar-tools">' +
      '<button type="button" class="educator-tool-btn educator-reset-chat-btn" title="' + (locale === "ru" ? "Сбросить диалог" : "Reset context") + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>' +
        '<span>' + (locale === "ru" ? "Новая тема" : "New topic") + '</span>' +
      '</button>' +
      '<button type="button" class="educator-tool-btn educator-share-chat-btn" title="' + t.shareChat + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
        '<span>' + t.shareChat + '</span>' +
      '</button>' +
      '<button type="button" class="educator-tool-btn educator-select-toggle-btn" title="' + t.selectMode + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
        '<span>' + t.selectMode + '</span>' +
      '</button>' +
    '</div>';
  chatRoot.insertBefore(topbar, modeSwitcher.nextSibling);

  var form = document.getElementById("educator-chat-form");
  var input = document.getElementById("educator-chat-input");

  // Bottom selection bar
  var selectBar = document.createElement("div");
  selectBar.className = "educator-select-bar";
  selectBar.innerHTML =
    '<span class="educator-select-count" style="font-size:13px;font-weight:600;color:#0f766e;"></span>' +
    '<div style="display:flex;gap:8px;">' +
      '<button type="button" class="educator-tool-btn educator-select-cancel" style="border-radius:6px;">' + t.cancelSelect + '</button>' +
      '<button type="button" class="educator-tool-btn educator-tool-btn--active educator-select-copy" style="border-radius:6px;" disabled>' + t.copySelected(0) + '</button>' +
    '</div>';
  chatRoot.insertBefore(selectBar, form);

  // Inject styles inline
  var style = document.createElement("style");
  style.textContent =
    ".educator-mode-switcher{display:flex;gap:8px;margin-bottom:8px;}" +
    ".educator-mode-btn{flex:1;padding:9px 12px;border-radius:12px;border:2px solid var(--border,#cbd5e1);background:var(--surface,#fff);font-weight:650;font-size:13px;cursor:pointer;color:var(--muted,#64748b);transition:all .2s;}" +
    ".educator-mode-btn--active{border-color:#0f766e;background:#f0fdf4;color:#0f766e;}" +
    ".educator-mode-btn:hover:not(.educator-mode-btn--active){border-color:#0f766e;color:#0f766e;}" +
    ".educator-chat-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border,#e2e8f0);flex-wrap:wrap;gap:8px;}" +
    ".educator-topbar-tools{display:flex;gap:8px;align-items:center;}" +
    ".educator-tool-btn{background:var(--surface,#fff);border:1px solid var(--border,#cbd5e1);border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;color:var(--text,#334155);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s;}" +
    ".educator-tool-btn:hover{background:rgba(15,118,110,0.08);border-color:#0f766e;color:#0f766e;}" +
    ".educator-tool-btn--active{background:#0f766e;color:#fff;border-color:#0f766e;}" +
    ".educator-tool-btn--active:hover{background:#0d655e;color:#fff;}" +
    ".educator-tool-btn:disabled{opacity:0.5;cursor:not-allowed;}" +
    ".educator-chat-form textarea{flex:1 1 220px;min-height:56px;max-height:180px;padding:10px 14px;border-radius:12px;border:1px solid var(--border,#cbd5e1);font:inherit;font-size:15px;line-height:1.4;resize:vertical;box-sizing:border-box;background:var(--surface,#fff);color:var(--text,#0f172a);}" +
    ".educator-chat-form textarea:focus{border-color:#0f766e;outline:none;box-shadow:0 0 0 2px rgba(15,118,110,0.15);}" +
    ".educator-chat-msg-row{display:flex;align-items:flex-start;gap:8px;width:100%;transition:all .15s;}" +
    ".educator-chat-msg-row--user{justify-content:flex-end;}" +
    ".educator-chat-msg-row--ai{justify-content:flex-start;}" +
    ".educator-msg-checkbox{width:18px;height:18px;margin-top:10px;cursor:pointer;accent-color:#0f766e;display:none;flex-shrink:0;}" +
    ".educator-chat--select-mode .educator-msg-checkbox{display:block;}" +
    ".educator-chat--select-mode .educator-chat-msg{cursor:pointer;}" +
    ".educator-chat-msg-row--selected .educator-chat-msg{outline:2px solid #0f766e;box-shadow:0 0 8px rgba(15,118,110,0.2);}" +
    ".educator-chat-msg{white-space:pre-wrap;position:relative;}" +
    ".educator-chat-msg--plan{background:var(--surface-soft,#f8fafc);border-left:3px solid #0f766e;padding-left:16px;}" +
    ".educator-msg-actions{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:6px;border-top:1px solid rgba(0,0,0,0.06);flex-wrap:wrap;justify-content:flex-end;}" +
    ".educator-msg-btn{background:none;border:none;color:#94a3b8;font-size:0.75rem;cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:3px 6px;border-radius:4px;transition:all 0.2s;font-family:inherit;font-weight:550;}" +
    ".educator-msg-btn:hover{background:rgba(15,118,110,0.1);color:#0f766e;}" +
    ".educator-chat-msg--user .educator-msg-actions{border-top-color:rgba(255,255,255,0.2);}" +
    ".educator-chat-msg--user .educator-msg-btn{color:rgba(236,253,245,0.85);}" +
    ".educator-chat-msg--user .educator-msg-btn:hover{background:rgba(255,255,255,0.2);color:#fff;}" +
    ".educator-select-bar{display:none;align-items:center;justify-content:space-between;background:rgba(15,118,110,0.08);border:1px solid rgba(15,118,110,0.2);padding:8px 12px;border-radius:10px;margin-bottom:8px;}" +
    ".educator-chat--select-mode .educator-select-bar{display:flex;}" +
    ".educator-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;font-weight:600;z-index:999999;box-shadow:0 6px 20px rgba(0,0,0,0.25);animation:eduToastFade 0.25s ease;pointer-events:none;}" +
    "@keyframes eduToastFade{from{opacity:0;transform:translate(-50%,12px);}to{opacity:1;transform:translate(-50%,0);}}" +
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
    ".pn-feedback-submit{padding:8px 18px;border-radius:8px;border:none;background:#0f766e;color:#fff;font:inherit;font-size:0.85rem;font-weight:650;cursor:pointer;}";
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

  // ── DOM references & State ──────────────────────────────────────────────
  var messagesEl = document.getElementById("educator-chat-messages");
  var quotaEl = document.getElementById("educator-chat-quota");
  var sendBtn = document.getElementById("educator-chat-send");
  var honeypot = document.getElementById("educator-chat-hp");
  var shareChatBtn = topbar.querySelector(".educator-share-chat-btn");
  var selectToggleBtn = topbar.querySelector(".educator-select-toggle-btn");
  var resetChatBtn = topbar.querySelector(".educator-reset-chat-btn");
  var selectCancelBtn = selectBar.querySelector(".educator-select-cancel");
  var selectCopyBtn = selectBar.querySelector(".educator-select-copy");
  var selectCountEl = selectBar.querySelector(".educator-select-count");

  var busy = false;
  var typingEl = null;
  var typingTimer = null;
  var origSendBtnText = "";
  var lastUserPrompt = "";

  var chatHistory = []; // { id, text, who, isPlan }
  var selectedMsgIds = {};
  var isSelectMode = false;
  
  if (resetChatBtn) {
    resetChatBtn.addEventListener("click", function () {
      if (busy) return;
      messagesEl.innerHTML = "";
      chatHistory = [];
      selectedMsgIds = {};
      setSelectMode(false);
      // Regenerate session ID to clear context in backend
      sessionID = "sess_" + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      var welcomeText = currentMode === "lesson_plan" ? t.welcomePlan : t.welcomeCase;
      appendMsg(welcomeText, "ai");
      showToast(locale === "ru" ? "Контекст сброшен" : "Context reset");
    });
  }

  // Textarea auto-height and Enter keyboard listener
  if (input && input.tagName.toLowerCase() === "textarea") {
    var adjustHeight = function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 180) + "px";
    };
    input.addEventListener("input", adjustHeight);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });
  }

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

  // ── Multi-select state & logic ──────────────────────────────────────────
  function updateSelectBar() {
    var count = 0;
    for (var k in selectedMsgIds) {
      if (selectedMsgIds[k]) count++;
    }
    selectCountEl.textContent = locale === "ru" ? "Выбрано: " + count : "Selected: " + count;
    selectCopyBtn.textContent = t.copySelected(count);
    selectCopyBtn.disabled = count === 0;
  }

  function setSelectMode(active) {
    isSelectMode = !!active;
    if (isSelectMode) {
      chatRoot.classList.add("educator-chat--select-mode");
      selectToggleBtn.classList.add("educator-tool-btn--active");
    } else {
      chatRoot.classList.remove("educator-chat--select-mode");
      selectToggleBtn.classList.remove("educator-tool-btn--active");
      selectedMsgIds = {};
      var rows = messagesEl.querySelectorAll(".educator-chat-msg-row");
      rows.forEach(function (r) {
        r.classList.remove("educator-chat-msg-row--selected");
        var cb = r.querySelector(".educator-msg-checkbox");
        if (cb) cb.checked = false;
      });
    }
    updateSelectBar();
  }

  selectToggleBtn.addEventListener("click", function () {
    setSelectMode(!isSelectMode);
  });

  selectCancelBtn.addEventListener("click", function () {
    setSelectMode(false);
  });

  selectCopyBtn.addEventListener("click", function () {
    var selectedList = [];
    chatHistory.forEach(function (m) {
      if (selectedMsgIds[m.id]) {
        var role = m.who === "user" ? t.userRole : t.aiRole;
        selectedList.push(role + ":\n" + m.text);
      }
    });
    if (selectedList.length > 0) {
      copyToClipboard(selectedList.join("\n\n---\n\n"));
      setSelectMode(false);
    }
  });

  shareChatBtn.addEventListener("click", function () {
    if (chatHistory.length === 0) return;
    var lines = [t.dialogueTitle, "===================="];
    chatHistory.forEach(function (m) {
      var role = m.who === "user" ? t.userRole : t.aiRole;
      lines.push(role + ":\n" + m.text + "\n");
    });
    shareData(t.dialogueTitle, lines.join("\n"));
  });

  // ── Append message ──────────────────────────────────────────────────────
  function appendMsg(text, who, isPlan) {
    var msgId = "msg_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    chatHistory.push({ id: msgId, text: text, who: who, isPlan: isPlan });

    var row = document.createElement("div");
    row.className = "educator-chat-msg-row educator-chat-msg-row--" + (who || "ai");
    row.setAttribute("data-id", msgId);

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "educator-msg-checkbox";
    checkbox.setAttribute("aria-label", "Select message");

    checkbox.addEventListener("change", function () {
      if (checkbox.checked) {
        selectedMsgIds[msgId] = true;
        row.classList.add("educator-chat-msg-row--selected");
      } else {
        delete selectedMsgIds[msgId];
        row.classList.remove("educator-chat-msg-row--selected");
      }
      updateSelectBar();
    });

    var el = document.createElement("div");
    el.className = "educator-chat-msg educator-chat-msg--" + (who || "ai");
    if (isPlan) el.classList.add("educator-chat-msg--plan");

    el.addEventListener("click", function (e) {
      if (isSelectMode && !e.target.closest(".educator-msg-btn")) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change"));
      }
    });

    if (who === "ai") {
      var bodyEl = document.createElement("div");
      bodyEl.innerHTML = formatMarkdown(text);
      el.appendChild(bodyEl);
    } else {
      el.textContent = String(text || "");
      lastUserPrompt = String(text || "");
    }

    // Action bar (Copy, Share, Report)
    var actions = document.createElement("div");
    actions.className = "educator-msg-actions";

    // Copy button
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "educator-msg-btn";
    copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>' + t.copyMsg + '</span>';
    copyBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      copyToClipboard(text);
    });
    actions.appendChild(copyBtn);

    // Share button
    var shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "educator-msg-btn";
    shareBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg><span>' + (locale === "ru" ? "Переслать" : "Forward") + '</span>';
    var promptForThis = lastUserPrompt;
    shareBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      createCaseLink(promptForThis, text, shareBtn).then(function(res) {
          shareData(t.dialogueTitle, res.text);
      }).catch(function(err) {
          showToast(locale === "ru" ? "Ошибка. Попробуйте позже." : "Error. Try again.");
      });
    });
    actions.appendChild(shareBtn);

    // Feedback button for AI response
    if (who === "ai" && text !== t.welcomeCase && text !== t.welcomePlan) {
      var feedbackBtn = document.createElement("button");
      feedbackBtn.type = "button";
      feedbackBtn.className = "educator-msg-btn";
      feedbackBtn.innerHTML = '<span>⚠️</span> <span>' + t.reportIssue + '</span>';
      var promptForThis = lastUserPrompt;
      feedbackBtn.addEventListener("click", function (e) {
        e.stopPropagation();
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
    }

    el.appendChild(actions);

    if (who === "user") {
      row.appendChild(el);
      row.appendChild(checkbox);
    } else {
      row.appendChild(checkbox);
      row.appendChild(el);
    }

    messagesEl.appendChild(row);
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
    if (input.style) input.style.height = "auto";
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

  var transferBtn = document.getElementById("educator-transfer-case-btn");
  if (transferBtn) {
    transferBtn.addEventListener("click", function() {
       if (chatHistory.length === 0) {
           alert(locale === "ru" ? "Сначала опишите ситуацию в чате." : "Please describe a situation in the chat first.");
           return;
       }
       var lastAi = chatHistory.slice().reverse().find(function(m) { return m.who === 'ai' && m.text !== t.welcomeCase && m.text !== t.welcomePlan; });
       var ans = lastAi ? lastAi.text : "";
       var prompt = lastUserPrompt;
       
       if (!ans) {
           alert(locale === "ru" ? "Сначала опишите ситуацию в чате." : "Please describe a situation in the chat first.");
           return;
       }
       
       var orgCode = localStorage.getItem("educator_org_code");
       var origTransferText = transferBtn.innerHTML;
       transferBtn.disabled = true;
       transferBtn.innerHTML = locale === "ru" ? "<span>⏳</span> Отправка..." : "<span>⏳</span> Sending...";
       
       if (!orgCode) {
           createCaseLink(prompt, ans, null).then(function(res) {
               transferBtn.disabled = false;
               transferBtn.innerHTML = origTransferText;
               
               var msg = (locale === "ru" 
                   ? "К сожалению, мы не нашли организацию в системе. Пожалуйста, передайте эту ссылку вашему психологу:\n" + res.link + "\n\nИ ссылку на подключение к рабочему пространству:\nhttps://prevention.school/workspace/"
                   : "Unfortunately, we do not see your organization in the system yet. Please share this context link with your psychologist:\n" + res.link + "\n\nAnd the workspace connection link:\nhttps://prevention.school/workspace/");
               fallbackCopy(msg);
               alert(msg + "\n\n" + (locale === "ru" ? "(Текст скопирован в буфер обмена)" : "(Text copied to clipboard)"));
           }).catch(function(e) {
               transferBtn.disabled = false;
               transferBtn.innerHTML = origTransferText;
               alert((locale === "ru" ? "Ошибка: " : "Error: ") + e.message);
           });
       } else {
           var requestText = (locale === "ru" ? "Контекст:\n" : "Context:\n") + 
                             (prompt || (locale === "ru" ? "Ситуация в классе" : "Classroom situation")) + 
                             "\n\n" + (locale === "ru" ? "Ответ ИИ:\n" : "AI Response:\n") + ans;
                             
           fetch(apiUrl("/api/share/specialist-request/create"), {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 userId: userId(),
                 app_id: cfg.appId,
                 request_text: requestText,
                 consent: true,
                 locale: locale,
                 include_chat_context: true,
                 terminal_invite_token: orgCode
               })
           })
           .then(function(r) { return r.json(); })
           .then(function(d) {
               transferBtn.disabled = false;
               transferBtn.innerHTML = origTransferText;
               if (d.ok) {
                   alert(locale === "ru" ? "Запрос успешно отправлен школьному психологу!" : "Request successfully sent to your school psychologist!");
               } else {
                   throw new Error(d.error || "Failed to send request");
               }
           }).catch(function(e) {
               transferBtn.disabled = false;
               transferBtn.innerHTML = origTransferText;
               alert((locale === "ru" ? "Ошибка: " : "Error: ") + e.message);
           });
       }
    });
  }

})();
