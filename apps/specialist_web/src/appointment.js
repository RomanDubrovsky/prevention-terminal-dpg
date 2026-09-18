(function () {
    const C = window.SWCommon;
    if (!C) return;

    const el = (id) => document.getElementById(id);

    function showStatus(text, ok) {
        const box = el('ap-status');
        if (!box) return;
        box.textContent = text;
        box.classList.remove('hidden', 'ap-status--ok', 'ap-status--err');
        box.classList.add(ok ? 'ap-status--ok' : 'ap-status--err');
    }

    async function submitForm(e) {
        e.preventDefault();
        const name = String((el('ap-name') && el('ap-name').value) || '').trim();
        const contact = String((el('ap-contact') && el('ap-contact').value) || '').trim();
        const history = String((el('ap-message') && el('ap-message').value) || '').trim();
        if (!name || !contact) {
            showStatus('Укажите имя и контакт для связи.', false);
            return;
        }
        const btn = el('ap-submit');
        if (btn) btn.disabled = true;
        showStatus('Отправляем…', true);
        try {
            await C.apiPost('/api/consulting/lead', {
                name,
                contact,
                history,
                userId: C.userKey(),
                source: 'appointment_prevention_school',
            });
            showStatus('Заявка принята. Специалист свяжется с вами по указанному контакту.', true);
            const form = el('ap-form');
            if (form) form.reset();
        } catch (err) {
            showStatus('Не удалось отправить заявку. Попробуйте позже или напишите на почту с сайта prevention.school.', false);
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function init() {
        const form = el('ap-form');
        if (form) form.addEventListener('submit', submitForm);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
