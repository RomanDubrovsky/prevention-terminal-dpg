/*
 * Shared diagnostic module — DOM render adapter.
 *
 * Phase 3 starts small: centralize low-level DOM operations and stable element
 * ids without changing the current Teenology UI. Later renderers can implement
 * the same surface for specialist workspaces or sibling apps.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});

    function byId(id) {
        try { return document.getElementById(id); } catch (_) { return null; }
    }

    function addClass(id, className) {
        var el = typeof id === 'string' ? byId(id) : id;
        if (el && className) el.classList.add(className);
    }

    function removeClass(id, className) {
        var el = typeof id === 'string' ? byId(id) : id;
        if (el && className) el.classList.remove(className);
    }

    function show(id) {
        removeClass(id, 'hidden');
    }

    function hide(id) {
        addClass(id, 'hidden');
    }

    function setText(id, value) {
        var el = typeof id === 'string' ? byId(id) : id;
        if (el) el.textContent = value == null ? '' : String(value);
    }

    function setHtml(id, value) {
        var el = typeof id === 'string' ? byId(id) : id;
        if (el) el.innerHTML = value == null ? '' : String(value);
    }

    function setProgress(remaining, options) {
        var opts = options || {};
        var total = Number(opts.total);
        if (!Number.isFinite(total) || total < 1) total = 14;
        var rem = Number(remaining);
        if (!Number.isFinite(rem) || rem < 0) return;
        var cur = Math.min(total, Math.max(1, total - rem + 1));
        var pct = (cur / total) * 100;
        var fill = byId('diag-progress-fill');
        var lbl = byId('diag-progress-label');
        show('diag-screen-progress');
        if (fill) fill.style.width = pct + '%';
        if (lbl) {
            lbl.dataset.cur = String(cur);
            lbl.dataset.total = String(total);
            lbl.textContent = opts.isEn ? ('Question ' + cur + ' of ' + total) : ('Вопрос ' + cur + ' из ' + total);
        }
    }

    function resetProgress() {
        hide('diag-screen-progress');
        var fill = byId('diag-progress-fill');
        var lbl = byId('diag-progress-label');
        if (fill) fill.style.width = '0%';
        if (lbl) {
            lbl.textContent = '';
            try {
                delete lbl.dataset.cur;
                delete lbl.dataset.total;
            } catch (_) {}
        }
    }

    function refreshProgressLabelLanguage(options) {
        var opts = options || {};
        var lbl = byId('diag-progress-label');
        if (!lbl || !lbl.dataset || !lbl.dataset.cur || !lbl.dataset.total) return false;
        var cur = lbl.dataset.cur;
        var total = lbl.dataset.total;
        lbl.textContent = opts.isEn ? ('Question ' + cur + ' of ' + total) : ('Вопрос ' + cur + ' из ' + total);
        return true;
    }

    function setScreenState(state) {
        var screen = byId('diagnostic-screen');
        if (!screen) return;
        if (Object.prototype.hasOwnProperty.call(state || {}, 'open')) {
            screen.classList.toggle('hidden', !state.open);
            document.body.classList.toggle('pn-diagnostic-open', !!state.open);
        }
        if (Object.prototype.hasOwnProperty.call(state || {}, 'inProgress')) {
            screen.classList.toggle('pn-diag-screen--in-progress', !!state.inProgress);
        }
        if (Object.prototype.hasOwnProperty.call(state || {}, 'resultVisible')) {
            screen.classList.toggle('pn-diag-result-visible', !!state.resultVisible);
        }
    }

    function isResultVisible() {
        var screen = byId('diagnostic-screen');
        var result = byId('diag-result');
        return !!(screen && result && !result.classList.contains('hidden'));
    }

    function resultElement() {
        return byId('diag-result');
    }

    function isDiagnosticStartReady() {
        return !!(byId('diag-panel') && byId('diag-question'));
    }

    function scrollScreenTop() {
        var screen = byId('diagnostic-screen');
        if (screen) {
            try { screen.scrollTop = 0; } catch (_) {}
        }
    }

    function forceCloseModals() {
        var backdrop = byId('modal-backdrop');
        var modals = [];
        try {
            modals = Array.prototype.slice.call(document.querySelectorAll('.custom-modal'));
        } catch (_) {
            modals = [];
        }
        if (backdrop) {
            backdrop.classList.add('hidden', 'opacity-0');
        }
        modals.forEach(function (modal) {
            if (modal) modal.classList.add('hidden', 'scale-95');
        });
    }

    function hideOnboardingForDiagnostic() {
        var onb = byId('onboarding-screen');
        var chatUi = byId('chat-interface');
        var inChat = !!(chatUi && !chatUi.classList.contains('hidden'));
        if (onb && !inChat) {
            onb.dataset.pnDiagHiddenOnboarding = '1';
            onb.style.display = 'none';
            onb.classList.add('hidden');
        }
    }

    function restoreOnboardingAfterDiagnostic() {
        var onb = byId('onboarding-screen');
        if (onb && onb.dataset.pnDiagHiddenOnboarding === '1') {
            onb.style.display = '';
            onb.classList.remove('hidden');
            try {
                delete onb.dataset.pnDiagHiddenOnboarding;
            } catch (_) {
                onb.removeAttribute('data-pn-diag-hidden-onboarding');
            }
        }
    }

    function fadeOnboardingOut() {
        var onb = byId('onboarding-screen');
        if (onb) onb.classList.add('opacity-0');
    }

    function hideOnboardingScreen() {
        var onb = byId('onboarding-screen');
        if (!onb) return;
        onb.style.display = 'none';
        onb.classList.add('hidden');
    }

    function showChatInterface() {
        show('chat-interface');
    }

    function questionText() {
        var q = byId('diag-question');
        return q ? q.textContent : '';
    }

    function setQuestionText(value) {
        setText('diag-question', value);
    }

    function applyConversionCopy(copy) {
        var c = copy || {};
        setText('diag-conversion-copy', c.body || '');
        setText('diag-conversion-cta-btn', c.cta || '');
    }

    function applyScalesCopy(copy) {
        var c = copy || {};
        setText('diag-pulse-desc', c.pulseDesc || '');
        setText('diag-resource-battery', c.resourceBattery || '');
        setText('diag-resource-sos', c.resourceSos || '');
    }

    function readProfileTeenName() {
        var input = byId('profile-teen-name');
        return input && input.value ? input.value : '';
    }

    function setTurnstileWarning(required, siteOk, message) {
        var warn = byId('diag-turnstile-config-warn');
        if (!warn) return;
        if (required && !siteOk) {
            warn.textContent = String(message || '');
            warn.classList.remove('hidden');
        } else {
            warn.classList.add('hidden');
        }
    }

    function resetTurnstileHost() {
        hide('pn-turnstile-hint');
        setHtml('pn-turnstile-host', '');
        hide('pn-turnstile-host');
    }

    function showTurnstileHost() {
        var host = byId('pn-turnstile-host');
        if (!host) return null;
        show('pn-turnstile-host');
        show('pn-turnstile-hint');
        return host;
    }

    function renderQuestion(question, options) {
        var opts = options || {};
        var q = byId('diag-question');
        var host = byId('diag-buttons');
        var panel = byId('diag-panel');
        if (!host) return;
        host.innerHTML = '';
        var qu = question && typeof question === 'object' ? question : {};
        var isRole = String(qu.id || '').trim() === '__role__'
            || String(qu.axis || '').trim().toLowerCase() === 'role';
        if (panel) {
            panel.classList.toggle('pn-diag-panel--role', isRole);
            panel.classList.add('glass-panel');
            if (!isRole) {
                panel.classList.remove('pn-diag-panel--role');
            } else {
                panel.classList.remove('pn-diag-panel--has-feedback');
                hide('diag-feedback');
            }
        }
        setText(q, (qu.text != null && String(qu.text)) || (opts.fallbackText || 'Ответьте на вопрос теста.'));
        var rawBtns = Array.isArray(qu.buttons) ? qu.buttons : [];
        var btns = rawBtns.length ? rawBtns : (opts.defaultButtons || []);
        var cols = btns.length <= 3 && btns.length >= 2 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1';
        host.className = isRole ? 'pn-diag-role-chips' : ('grid gap-2.5 ' + cols);
        btns.forEach(function (b) {
            var id = String((b && b.id) || '').trim();
            var title = String((b && b.title) || id || '?').trim();
            if (!id) return;
            var el = document.createElement('button');
            el.type = 'button';
            el.textContent = title;
            el.className = isRole
                ? 'pn-diag-role-chip pn-theme-animate text-center break-words'
                : 'pn-diag-answer-chip pn-theme-animate text-center leading-snug min-w-0 break-words';
            el.setAttribute('data-diag-answer', id);
            el.addEventListener('click', function () {
                if (typeof opts.onAnswer === 'function') opts.onAnswer(id);
            });
            host.appendChild(el);
        });
    }

    function setButtonsEnabled(enabled) {
        var host = byId('diag-buttons');
        if (!host) return;
        host.querySelectorAll('button').forEach(function (button) {
            button.disabled = !enabled;
        });
    }

    function renderEmojiStatus(value, toneClass) {
        var em = byId('diag-emoji-status');
        if (!em) return;
        em.textContent = String(value || '🤨').trim() || '🤨';
        em.classList.remove('pn-diag-emoji--good', 'pn-diag-emoji--caution', 'pn-diag-emoji--bad');
        em.classList.add('pn-diag-emoji', toneClass || 'pn-diag-emoji--caution');
    }

    function renderResultMeters(data) {
        var d = data || {};
        setText('diag-resource-label', d.resourceLabel || '');

        var scalesGrid = byId('diag-scales-grid');
        var hpFill = byId('diag-health-fill');
        var hpPctEl = byId('diag-health-pct');
        if (scalesGrid && hpFill && hpPctEl) {
            hpPctEl.textContent = String(d.healthPercent);
            hpFill.style.width = d.healthPercent + '%';
            hpFill.className = 'pn-diag-health-fill ' + (d.healthToneClass || 'pn-diag-health-fill--caution');
            scalesGrid.classList.remove('hidden');
        }

        var resFill = byId('diag-resource-fill');
        var resPctEl = byId('diag-resource-pct');
        if (resFill && resPctEl) {
            resPctEl.textContent = String(d.resourcePercent);
            resFill.style.width = d.resourcePercent + '%';
            resFill.className = 'pn-diag-health-fill ' + (d.resourceToneClass || 'pn-diag-health-fill--caution');
        }

        var resHint = byId('diag-resource-hint');
        if (resHint) {
            if (d.resourceHint) {
                resHint.textContent = String(d.resourceHint);
                resHint.classList.remove('hidden');
            } else {
                resHint.textContent = '';
                resHint.classList.add('hidden');
            }
        }

        var hpLbl = byId('diag-health-label');
        if (hpLbl) {
            if (d.healthLabel) {
                hpLbl.textContent = String(d.healthLabel);
                hpLbl.classList.remove('hidden');
            } else {
                hpLbl.textContent = '';
                hpLbl.classList.add('hidden');
            }
        }
    }

    function renderTextBlock(wrapId, textId, value) {
        var wrap = byId(wrapId);
        var text = byId(textId);
        if (!wrap || !text) return;
        var v = value == null ? '' : String(value);
        if (v) {
            text.textContent = v;
            wrap.classList.remove('hidden');
        } else {
            text.textContent = '';
            wrap.classList.add('hidden');
        }
    }

    function renderList(wrapId, listId, items) {
        var wrap = byId(wrapId);
        var list = byId(listId);
        if (!wrap || !list) return;
        list.innerHTML = '';
        var rows = Array.isArray(items) ? items : [];
        rows.forEach(function (item) {
            var text = String(item || '').trim();
            if (!text) return;
            var li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });
        wrap.classList.toggle('hidden', list.children.length === 0);
    }

    function renderBridgeCta(visible, label) {
        var wrap = byId('pn-diag-bridge-wrap');
        var text = byId('pn-btn-analyze-barriers-label');
        if (!wrap || !text) return;
        if (visible) {
            text.textContent = String(label || '');
            wrap.classList.remove('hidden');
        } else {
            wrap.classList.add('hidden');
        }
    }

    function renderConversionBlock(visible) {
        var block = byId('diag-conversion-block');
        if (block) block.classList.toggle('hidden', !visible);
    }

    function showNextQuestion(model, options) {
        var m = model || {};
        var opts = options || {};
        if (typeof opts.applyQuestion === 'function') opts.applyQuestion(m.question);
        if (typeof opts.setProgress === 'function') opts.setProgress(m.remaining);
        if (typeof opts.animateQuestionIn === 'function') opts.animateQuestionIn();
        setButtonsEnabled(true);
    }

    function showStartedQuestion(model, options) {
        var m = model || {};
        var opts = options || {};
        hide('diag-onboarding-lead');
        setScreenState({ inProgress: true, resultVisible: false });
        show('diag-panel');
        hide('diag-result');
        if (typeof opts.applyQuestion === 'function') opts.applyQuestion(m.question);
        if (typeof opts.setProgress === 'function') opts.setProgress(m.remaining);
        if (typeof opts.animateQuestionIn === 'function') opts.animateQuestionIn();
    }

    function animateQuestionIn(options) {
        var opts = options || {};
        if (opts.reducedMotion) return;
        var wrap = byId('diag-panel-main');
        if (!wrap) return;
        wrap.classList.remove('pn-diag-fade-in-up');
        void wrap.offsetWidth;
        wrap.classList.add('pn-diag-fade-in-up');
        setTimeout(function () {
            wrap.classList.remove('pn-diag-fade-in-up');
        }, typeof opts.durationMs === 'number' ? opts.durationMs : 340);
    }

    async function showInstantQuestion(model, options) {
        var m = model || {};
        var opts = options || {};
        if (typeof opts.feedbackTypeSequence === 'function') {
            await opts.feedbackTypeSequence(m.answerData, true);
        }
        showNextQuestion(m, opts);
    }

    async function showAnimatedQuestion(model, options) {
        var m = model || {};
        var opts = options || {};
        if (typeof opts.feedbackTypeSequence === 'function') {
            void opts.feedbackTypeSequence(m.answerData, false);
        }
        setPanelState({ thinking: true });
        if (typeof opts.sleep === 'function') {
            await opts.sleep(200);
        }
        setPanelState({ thinking: false });
        showNextQuestion(m, opts);
    }

    function renderResultScreen(viewModel, copy, options) {
        var vm = viewModel || {};
        var cp = copy || {};
        var opts = options || {};
        var rep = vm.report || {};
        var safety = !!vm.safetyMode;
        var healthPercent = vm.healthPercent;
        var resourcePercent = vm.resourcePercent;
        var overlayShown = !!opts.overlayShown;
        var loadingEl = opts.loadingEl || null;
        var resultElement = opts.resultElement || null;
        var reportText = typeof opts.reportText === 'function'
            ? opts.reportText
            : function (value) { return value == null ? '' : String(value); };

        if (overlayShown && (safety || vm.isClinicalCrisis)) {
            addClass(loadingEl, 'hidden');
            overlayShown = false;
        }
        hide('diag-panel');

        var degradedBanner = byId('diag-degraded-banner');
        if (degradedBanner) {
            degradedBanner.classList.toggle('hidden', !vm.degraded);
        }

        if (typeof opts.onRespondentRole === 'function') {
            opts.onRespondentRole(vm.respondentRole);
        }
        if (typeof opts.applyConversionCopy === 'function') {
            opts.applyConversionCopy(vm.respondentRole);
        }
        if (typeof opts.applyScalesCopy === 'function') {
            opts.applyScalesCopy(vm.respondentRole);
        }

        renderEmojiStatus(
            vm.emojiStatus,
            typeof opts.pulseEmojiToneClass === 'function'
                ? opts.pulseEmojiToneClass(vm.emojiStatus)
                : ''
        );
        renderResultMeters({
            healthPercent: healthPercent,
            resourcePercent: resourcePercent,
            healthToneClass: typeof opts.healthBarToneClass === 'function'
                ? opts.healthBarToneClass(healthPercent, safety)
                : '',
            resourceToneClass: typeof opts.healthBarToneClass === 'function'
                ? opts.healthBarToneClass(resourcePercent, safety)
                : '',
            resourceLabel: cp.resourceLabel,
            resourceHint: cp.resourceHint,
            healthLabel: cp.healthLabel,
        });
        renderBridgeCta(
            !!opts.bridgeContextToChat && !safety && Array.isArray(vm.negativeAnswers) && vm.negativeAnswers.length > 0,
            typeof opts.bridgeCtaLabel === 'function' ? opts.bridgeCtaLabel(healthPercent) : ''
        );

        setText('diag-headline', reportText(rep.headline));
        setText('diag-mirror', reportText(rep.mirror_paragraph));
        var expertVal = reportText(rep.expert_insight);
        try {
            var meta = document.querySelector('meta[name="app-product-id"]');
            if (meta && String(meta.content).trim() === 'ida') {
                var isRu = true;
                if (typeof window !== 'undefined' && window.location) {
                    var host = window.location.host || '';
                    var search = window.location.search || '';
                    if (search.indexOf('lang=en') >= 0 || host.indexOf('en.') === 0) {
                        isRu = false;
                    }
                }
                var suffix = isRu 
                    ? '\n\n💡 Рекомендация:\nДля безопасной интеграции полученных инсайтов в паре вы можете использовать сторонние мобильные приложения для моделирования сценариев. Обратите внимание на такие решения, как Spicer, Игра теней (Shadows Game), Desire или Kindu.'
                    : '\n\n💡 Recommendation:\nFor safe integration of insights in your relationship, you may look into third-party mobile apps designed to play out relationship scenarios. Consider options like Spicer, Shadows Game, Desire, or Kindu.';
                expertVal += suffix;
            }
        } catch (_) {}
        renderTextBlock('diag-expert-wrap', 'diag-expert', expertVal);
        renderTextBlock('diag-super-wrap', 'diag-super', reportText(rep.superpowers));
        renderTextBlock('diag-growth-wrap', 'diag-growth', reportText(rep.growth_zones));
        renderList('diag-quiet-wrap', 'diag-quiet-list', vm.quietItems);
        renderList('diag-plan-wrap', 'diag-plan-list', vm.planItems);
        renderTextBlock('diag-long-wrap', 'diag-long', vm.longTermPlan);
        if (vm.shortTermPlan && !vm.hasPriorityPlan) {
            renderList('diag-plan-wrap', 'diag-plan-list', [vm.shortTermPlan]);
        }
        renderConversionBlock(!!opts.conversionCta && !safety);

        if (overlayShown) {
            addClass(loadingEl, 'hidden');
            overlayShown = false;
        }
        removeClass(resultElement, 'hidden');
        setScreenState({ resultVisible: true });

        return { overlayShown: overlayShown };
    }

    function resetDiagnosticUi(options) {
        var opts = options || {};
        hide('diag-auth-gate');
        hide('diag-finalize-loading');
        setScreenState({ inProgress: false, resultVisible: false });
        show('diag-onboarding-lead');
        resetProgress();
        setPanelState({ reset: true });
        removeClass('diag-panel-main', 'pn-diag-fade-in-up');
        hide('diag-turnstile-config-warn');
        hide('diag-panel');
        hide('diag-result');
        hide('diag-conversion-block');
        setText('diag-question', '');
        resetFeedback();
        setHtml('diag-buttons', '');
        setText('diag-headline', '');
        setText('diag-mirror', '');
        setText('diag-expert', '');
        setText('diag-super', '');
        setText('diag-growth', '');
        setText('diag-long', '');
        setHtml('diag-plan-list', '');
        hide('diag-expert-wrap');
        hide('diag-super-wrap');
        hide('diag-growth-wrap');
        setHtml('diag-quiet-list', '');
        hide('diag-quiet-wrap');
        hide('diag-plan-wrap');
        hide('diag-long-wrap');
        renderEmojiStatus(opts.emojiStatus || '🤨', opts.emojiToneClass || 'pn-diag-emoji--caution');
        hide('diag-scales-grid');
        hide('pn-diag-bridge-wrap');
        renderResultMeters({
            healthPercent: 0,
            resourcePercent: 0,
            healthToneClass: 'pn-diag-health-fill--caution',
            resourceToneClass: 'pn-diag-health-fill--caution',
            resourceLabel: opts.resourceLabel || '',
            resourceHint: '',
            healthLabel: '',
        });
        hide('diag-scales-grid');
    }

    function feedbackElements() {
        return {
            panel: byId('diag-panel'),
            feedback: byId('diag-feedback'),
            reflectionRow: byId('diag-reflection-row'),
            rationaleRow: byId('diag-rationale-row'),
            blockRow: byId('diag-block-row'),
            interimRow: byId('diag-interim-row'),
            reflection: byId('diag-reflection'),
            rationale: byId('diag-rationale-tail'),
            blockTransition: byId('diag-block-transition'),
            interim: byId('diag-interim'),
        };
    }

    function setPanelState(state) {
        var panel = byId('diag-panel');
        if (!panel) return;
        var s = state || {};
        if (Object.prototype.hasOwnProperty.call(s, 'thinking')) {
            panel.classList.toggle('pn-diag-panel--thinking', !!s.thinking);
        }
        if (Object.prototype.hasOwnProperty.call(s, 'hasFeedback')) {
            panel.classList.toggle('pn-diag-panel--has-feedback', !!s.hasFeedback);
        }
        if (Object.prototype.hasOwnProperty.call(s, 'role')) {
            panel.classList.toggle('pn-diag-panel--role', !!s.role);
        }
        if (s.reset) {
            panel.classList.remove('pn-diag-panel--role', 'pn-diag-panel--thinking', 'pn-diag-panel--has-feedback');
        }
    }

    function resetFeedback() {
        var els = feedbackElements();
        if (els.feedback) els.feedback.classList.add('hidden');
        [els.reflectionRow, els.rationaleRow, els.blockRow, els.interimRow].forEach(function (row) {
            if (row) row.classList.add('hidden');
        });
        [els.reflection, els.rationale, els.blockTransition, els.interim].forEach(function (node) {
            if (node) node.textContent = '';
        });
        setPanelState({ hasFeedback: false });
    }

    function setFeedbackVisible(visible) {
        var fb = byId('diag-feedback');
        if (fb) fb.classList.toggle('hidden', !visible);
        setPanelState({ hasFeedback: !!visible });
    }

    function setFeedbackRow(kind, visible, text) {
        var map = {
            reflection: ['diag-reflection-row', 'diag-reflection'],
            rationale: ['diag-rationale-row', 'diag-rationale-tail'],
            block: ['diag-block-row', 'diag-block-transition'],
            interim: ['diag-interim-row', 'diag-interim'],
        };
        var pair = map[kind];
        if (!pair) return;
        var row = byId(pair[0]);
        var node = byId(pair[1]);
        if (node && text !== undefined) node.textContent = text == null ? '' : String(text);
        if (row) row.classList.toggle('hidden', !visible);
        if (!visible && node && text === undefined) node.textContent = '';
    }

    function setInsightText(target, text) {
        var el = typeof target === 'string' ? byId(target) : target;
        if (!el) return;
        var raw = String(text || '');
        var match = raw.match(/^(Да\.|Нет\.|Иногда\.)(\s+)([\s\S]*)$/);
        if (!match) {
            el.textContent = raw;
            return;
        }
        el.textContent = '';
        var strong = document.createElement('strong');
        strong.className = 'pn-diag-answer-word';
        strong.textContent = match[1];
        el.appendChild(strong);
        el.appendChild(document.createTextNode(match[2] + match[3]));
    }

    function applyAuthModalI18n() {
        var modal = byId('modal-pn-auth');
        if (!modal) return;
        try {
            if (global.PnI18n && typeof global.PnI18n.applyDom === 'function') {
                global.PnI18n.applyDom(modal);
            }
        } catch (_) {}
    }

    var authLoadingInterval = null;
    function startAuthLoadingAnimation() {
        if (authLoadingInterval) clearInterval(authLoadingInterval);
        var subEl = byId('pn-auth-loading-dots');
        if (!subEl) return;
        var phrases = [
            'Настраиваем защищенное соединение',
            'Проверяем статус подписки',
            'Восстанавливаем историю диалогов',
            'Почти готово'
        ];
        var phraseIdx = 0;
        var dotCount = 1;
        subEl.textContent = phrases[0] + '.';
        
        authLoadingInterval = setInterval(function () {
            var base = phrases[phraseIdx];
            dotCount = (dotCount % 3) + 1;
            subEl.textContent = base + '.'.repeat(dotCount);
            if (dotCount === 3) {
                phraseIdx = (phraseIdx + 1) % phrases.length;
            }
        }, 500);
    }

    function stopAuthLoadingAnimation() {
        if (authLoadingInterval) {
            clearInterval(authLoadingInterval);
            authLoadingInterval = null;
        }
    }

    function setAuthStep(step) {
        var stepEmail = byId('pn-auth-step-email');
        var stepCode = byId('pn-auth-step-code');
        var stepLoading = byId('pn-auth-step-loading');
        if (step === 'code') {
            if (stepEmail) stepEmail.classList.add('hidden');
            if (stepCode) stepCode.classList.remove('hidden');
            if (stepLoading) stepLoading.classList.add('hidden');
            stopAuthLoadingAnimation();
        } else if (step === 'loading') {
            if (stepEmail) stepEmail.classList.add('hidden');
            if (stepCode) stepCode.classList.add('hidden');
            if (stepLoading) stepLoading.classList.remove('hidden');
            startAuthLoadingAnimation();
        } else {
            if (stepCode) stepCode.classList.add('hidden');
            if (stepEmail) stepEmail.classList.remove('hidden');
            if (stepLoading) stepLoading.classList.add('hidden');
            stopAuthLoadingAnimation();
        }
        applyAuthModalI18n();
    }

    function setAuthLoadingStatus(message) {
        setText('pn-auth-loading-status', message || '');
    }

    function setAuthLead(message, isError) {
        var lead = byId('pn-auth-modal-lead');
        if (!lead) return;
        lead.textContent = String(message || '');
        lead.classList.remove('hidden');
        lead.style.color = isError ? 'var(--danger, #dc2626)' : 'var(--text-muted)';
    }

    function hideAuthLead() {
        hide('pn-auth-modal-lead');
    }

    function clearAuthCodeError() {
        setText('pn-auth-code-error', '');
        hide('pn-auth-code-error');
    }

    function showAuthCodeError(message) {
        setText('pn-auth-code-error', message || '');
        show('pn-auth-code-error');
    }

    function setButtonBusy(id, busy) {
        var btn = byId(id);
        if (!btn) return;
        btn.disabled = !!busy;
        btn.setAttribute('aria-disabled', busy ? 'true' : 'false');
        btn.classList.toggle('opacity-60', !!busy);
        btn.classList.toggle('pointer-events-none', !!busy);
    }

    function resetAuthModal(options) {
        var opts = options || {};
        setText('pn-auth-modal-title', opts.title || '');
        setAuthLead(opts.lead || '', false);
        setText('pn-auth-email', '');
        setText('pn-auth-code', '');
        var email = byId('pn-auth-email');
        var code = byId('pn-auth-code');
        if (email) email.value = '';
        if (code) code.value = '';
        clearAuthCodeError();
        setAuthStep('email');
        applyAuthModalI18n();
        stopAuthLoadingAnimation();
    }

    function resetAuthToEmail(leadText) {
        var code = byId('pn-auth-code');
        if (code) code.value = '';
        clearAuthCodeError();
        setAuthStep('email');
        setAuthLead(leadText || '', false);
        setTimeout(function () {
            var email = byId('pn-auth-email');
            if (email && email.focus) email.focus();
        }, 80);
    }

    function showAuthCodeStep(email) {
        setText('pn-auth-code-email-display', email || '');
        setAuthStep('code');
        hideAuthLead();
        var code = byId('pn-auth-code');
        if (code) code.value = '';
        setTimeout(function () {
            if (code && code.focus) code.focus();
        }, 80);
    }

    function focusAuthEmail(delayMs) {
        setTimeout(function () {
            var email = byId('pn-auth-email');
            if (email && email.focus) email.focus();
        }, typeof delayMs === 'number' ? delayMs : 80);
    }

    function readAuthEmail() {
        var email = byId('pn-auth-email');
        return email && email.value ? email.value : '';
    }

    function setAuthEmail(value) {
        var email = byId('pn-auth-email');
        if (email) email.value = value == null ? '' : String(value);
    }

    function readAuthCode() {
        var code = byId('pn-auth-code');
        return code && code.value ? code.value : '';
    }

    function resetSaveReportModal() {
        setText('pn-save-diag-error', '');
        hide('pn-save-diag-error');
        var email = byId('pn-save-diag-email');
        var name = byId('pn-save-diag-name');
        if (email) email.value = '';
        if (name) name.value = '';
        return {
            emailInput: email,
            nameInput: name,
            submitBtn: byId('pn-save-diag-submit-btn'),
            errEl: byId('pn-save-diag-error'),
        };
    }

    function focusSaveReportEmail(delayMs) {
        setTimeout(function () {
            var email = byId('pn-save-diag-email');
            if (email && email.focus) email.focus();
        }, typeof delayMs === 'number' ? delayMs : 320);
    }

    function readSaveReportModal() {
        var email = byId('pn-save-diag-email');
        var name = byId('pn-save-diag-name');
        return {
            email: email && email.value ? email.value : '',
            full_name: name && name.value ? name.value : '',
            errEl: byId('pn-save-diag-error'),
            submitBtn: byId('pn-save-diag-submit-btn'),
        };
    }

    function showSaveReportError(message) {
        setText('pn-save-diag-error', message || '');
        show('pn-save-diag-error');
    }

    function hideSaveReportError() {
        hide('pn-save-diag-error');
    }

    function setSaveReportSubmitBusy(submitBtn, busy) {
        var btn = typeof submitBtn === 'string' ? byId(submitBtn) : submitBtn;
        if (!btn) return;
        btn.disabled = !!busy;
        btn.classList.toggle('opacity-60', !!busy);
        btn.classList.toggle('pointer-events-none', !!busy);
    }

    function setAuthGateVisible(visible) {
        var gate = byId('diag-auth-gate');
        if (!gate) return false;
        gate.classList.toggle('hidden', !visible);
        return true;
    }

    diagnostic.renderAdapter = {
        byId: byId,
        addClass: addClass,
        removeClass: removeClass,
        show: show,
        hide: hide,
        setText: setText,
        setHtml: setHtml,
        setProgress: setProgress,
        resetProgress: resetProgress,
        refreshProgressLabelLanguage: refreshProgressLabelLanguage,
        setScreenState: setScreenState,
        isResultVisible: isResultVisible,
        resultElement: resultElement,
        isDiagnosticStartReady: isDiagnosticStartReady,
        scrollScreenTop: scrollScreenTop,
        forceCloseModals: forceCloseModals,
        hideOnboardingForDiagnostic: hideOnboardingForDiagnostic,
        restoreOnboardingAfterDiagnostic: restoreOnboardingAfterDiagnostic,
        fadeOnboardingOut: fadeOnboardingOut,
        hideOnboardingScreen: hideOnboardingScreen,
        showChatInterface: showChatInterface,
        questionText: questionText,
        setQuestionText: setQuestionText,
        applyConversionCopy: applyConversionCopy,
        applyScalesCopy: applyScalesCopy,
        readProfileTeenName: readProfileTeenName,
        setTurnstileWarning: setTurnstileWarning,
        resetTurnstileHost: resetTurnstileHost,
        showTurnstileHost: showTurnstileHost,
        renderQuestion: renderQuestion,
        setButtonsEnabled: setButtonsEnabled,
        renderEmojiStatus: renderEmojiStatus,
        renderResultMeters: renderResultMeters,
        renderTextBlock: renderTextBlock,
        renderList: renderList,
        renderBridgeCta: renderBridgeCta,
        renderConversionBlock: renderConversionBlock,
        animateQuestionIn: animateQuestionIn,
        showAnimatedQuestion: showAnimatedQuestion,
        showInstantQuestion: showInstantQuestion,
        showNextQuestion: showNextQuestion,
        showStartedQuestion: showStartedQuestion,
        renderResultScreen: renderResultScreen,
        resetDiagnosticUi: resetDiagnosticUi,
        feedbackElements: feedbackElements,
        setPanelState: setPanelState,
        resetFeedback: resetFeedback,
        setFeedbackVisible: setFeedbackVisible,
        setFeedbackRow: setFeedbackRow,
        setInsightText: setInsightText,
        applyAuthModalI18n: applyAuthModalI18n,
        setAuthStep: setAuthStep,
        setAuthLoadingStatus: setAuthLoadingStatus,
        setAuthLead: setAuthLead,
        hideAuthLead: hideAuthLead,
        clearAuthCodeError: clearAuthCodeError,
        showAuthCodeError: showAuthCodeError,
        setButtonBusy: setButtonBusy,
        resetAuthModal: resetAuthModal,
        resetAuthToEmail: resetAuthToEmail,
        showAuthCodeStep: showAuthCodeStep,
        focusAuthEmail: focusAuthEmail,
        readAuthEmail: readAuthEmail,
        setAuthEmail: setAuthEmail,
        readAuthCode: readAuthCode,
        resetSaveReportModal: resetSaveReportModal,
        focusSaveReportEmail: focusSaveReportEmail,
        readSaveReportModal: readSaveReportModal,
        showSaveReportError: showSaveReportError,
        hideSaveReportError: hideSaveReportError,
        setSaveReportSubmitBusy: setSaveReportSubmitBusy,
        setAuthGateVisible: setAuthGateVisible,
    };
})(typeof window !== 'undefined' ? window : this);
