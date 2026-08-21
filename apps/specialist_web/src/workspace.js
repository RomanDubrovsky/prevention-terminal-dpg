(function () {
    const C = window.SWCommon;
    if (!C) return;

    const state = {
        busy: false,
        history: [],
        specialistCtaShown: false,
        turnsAfterCta: 0,
        closed: false,
    };

    const el = (id) => document.getElementById(id);

    function showScreen(id) {
        document.querySelectorAll('[data-sw-screen]').forEach((n) => {
            n.classList.toggle('hidden', n.getAttribute('data-sw-screen') !== id);
        });
    }

    function appendMsg(role, text) {
        const box = el('sw-chat-messages');
        if (!box) return;
        const row = document.createElement('div');
        row.className = 'sw-msg sw-msg--' + role;
        row.innerHTML = '<div class="sw-msg-bubble">' + C.escapeHtml(text).replace(/\n/g, '<br>') + '</div>';
        box.appendChild(row);
        box.scrollTop = box.scrollHeight;
    }

    function setBusy(on) {
        state.busy = !!on;
        const btn = el('sw-send-btn');
        const input = el('sw-chat-input');
        if (btn) btn.disabled = on;
        if (input) input.disabled = on;
        const typing = el('sw-typing');
        if (typing) typing.classList.toggle('hidden', !on);
    }

    function updateCtaPanel(data) {
        const panel = el('sw-specialist-cta');
        if (!panel) return;
        const show = !!(data && data.show_specialist_request_cta);
        panel.classList.toggle('hidden', !show);
        if (data && data.conversation_closed) {
            state.closed = true;
            const input = el('sw-chat-input');
            const btn = el('sw-send-btn');
            if (input) input.disabled = true;
            if (btn) btn.disabled = true;
        }
    }

    async function sendMessage(text) {
        if (state.busy || state.closed) return;
        const msg = String(text || '').trim();
        if (!msg) return;
        setBusy(true);
        appendMsg('user', msg);
        state.history.push({ role: 'user', text: msg });
        try {
            const data = await C.apiPost('/api/irpp/chat', {
                user_key: C.userKey(),
                message: msg,
                locale: C.locale(),
                history: state.history.slice(-12),
                specialist_cta_shown: state.specialistCtaShown,
                turns_after_specialist_cta: state.turnsAfterCta,
            });
            const reply = String(data.reply || data.text || '').trim();
            if (reply) {
                appendMsg('ai', reply);
                state.history.push({ role: 'assistant', text: reply });
            }
            if (data.show_specialist_request_cta) state.specialistCtaShown = true;
            if (state.specialistCtaShown) state.turnsAfterCta += 1;
            updateCtaPanel(data);
        } catch (err) {
            const hint = (err.payload && (err.payload.detail || err.payload.reply)) || err.message || 'Ошибка сети';
            appendMsg('ai', 'Сейчас не удалось получить ответ. ' + hint);
        } finally {
            setBusy(false);
        }
    }

    async function draftSpecialistRequest() {
        const out = el('sw-draft-output');
        const btn = el('sw-draft-btn');
        if (!out || state.busy) return;
        if (btn) btn.disabled = true;
        out.textContent = 'Готовим черновик…';
        out.classList.remove('hidden');
        try {
            const sessionText = state.history
                .map((h) => (h.role === 'user' ? 'Клиент: ' : 'Помощник: ') + h.text)
                .join('\n');
            const data = await C.apiPost('/api/irpp/specialist-request-draft', {
                session_text: sessionText,
                locale: C.locale(),
            });
            out.textContent = data.specialist_request_text || '';
            const link = el('sw-consultants-link');
            if (link && data.consultants_url) link.href = data.consultants_url;
        } catch (err) {
            out.textContent = 'Не удалось подготовить черновик. Попробуйте позже.';
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function bindOnboarding() {
        const cont = el('sw-onboard-continue');
        const terms = el('sw-accept-terms');
        const privacy = el('sw-accept-privacy');
        const skip = el('sw-skip-onboard');
        function sync() {
            const ok = terms && terms.checked && privacy && privacy.checked;
            if (cont) cont.disabled = !ok;
        }
        if (terms) terms.addEventListener('change', sync);
        if (privacy) privacy.addEventListener('change', sync);
        if (cont) {
            cont.addEventListener('click', () => {
                C.setOnboardingAccepted(skip && skip.checked);
                showScreen('workspace');
            });
        }
        sync();
    }

    function bindWorkspace() {
        const form = el('sw-chat-form');
        const input = el('sw-chat-input');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const v = input ? input.value : '';
                if (input) input.value = '';
                sendMessage(v);
            });
        }
        const draftBtn = el('sw-draft-btn');
        if (draftBtn) draftBtn.addEventListener('click', () => draftSpecialistRequest());
        document.querySelectorAll('[data-sw-quick]').forEach((btn) => {
            btn.addEventListener('click', () => sendMessage(btn.getAttribute('data-sw-quick') || ''));
        });
    }

    function init() {
        bindOnboarding();
        bindWorkspace();
        if (C.shouldSkipOnboarding() || C.onboardingOk()) {
            showScreen('workspace');
        } else {
            showScreen('onboarding');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
