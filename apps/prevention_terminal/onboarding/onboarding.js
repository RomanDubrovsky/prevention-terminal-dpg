(function () {
    'use strict';

    var MODULES = [
        { id: 'reporting_panel', title: 'Отчётная панель', desc: 'Сводка нагрузки и активности. Всегда включена.', always: true, school: true, comm: true },
        { id: 'reception_journal', title: 'Журнал приёма', desc: 'ФИО клиентов/учеников. Только локально, зашифровано.', school: true, comm: true },
        { id: 'consultation_journal', title: 'Журнал консультаций', desc: 'Ход консультации, problem_key, протоколы. ИИ: Architect/Expert.', paid: true, school: true, comm: true },
        { id: 'ipr', title: 'ИПР — личное дело', desc: 'Школьное сопровождение, digital twin. Только госорганизация.', paid: true, schoolOnly: true, school: true },
        { id: 'group_sessions', title: 'Групповые занятия', desc: 'План и отчёт групповой работы.', paid: true, school: true, comm: true },
        { id: 'safe_environment', title: 'Безопасная среда', desc: 'Школьная программа; rollup из других модулей.', paid: true, schoolOnly: true, school: true },
        { id: 'embed_client_widget', title: 'Виджет на сайт (чат)', desc: 'IDA embed + подбор специалиста.', manager: true, comm: true },
        { id: 'specialist_registration_widget', title: 'Регистрация специалистов', desc: 'Форма профиля с тегами таксономии.', manager: true, comm: true },
        { id: 'specialist_iconostasis', title: 'Иконостас специалистов', desc: 'Публичная страница ростера.', manager: true, comm: true },
        { id: 'consumer_app_link', title: 'Связь с Teenology / IDA', desc: 'Мост специалист ↔ клиентское приложение.', specialist: true },
    ];

    var step = 1;
    var maxStep = 6;
    var state = { mode: 'specialist', modules: {}, terminal_id: '' };

    function genCode(prefix) {
        return prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    function $(id) { return document.getElementById(id); }

    function showStep(n) {
        step = n;
        document.querySelectorAll('.ob__pane').forEach(function (p) {
            p.classList.toggle('ob__hidden', Number(p.getAttribute('data-step')) !== n);
        });
        $('ob-step-label').textContent = 'Шаг ' + n + ' из ' + maxStep;
        $('ob-back').disabled = n <= 1;
        $('ob-next').textContent = n >= maxStep ? 'Завершить' : 'Далее';
        if (n === 2) refreshFederationUI();
        if (n === 4) refreshConsumerUI();
        if (n === 5) renderModules();
        if (n === 6) finish();
    }

    function mode() {
        var r = document.querySelector('input[name="mode"]:checked');
        return r ? r.value : 'specialist';
    }

    function orgType() {
        var s = document.querySelector('[name="org_type"]');
        return s ? s.value : '';
    }

    function refreshFederationUI() {
        var m = mode();
        $('ob-child-code').value = state.child_code || genCode('CHILD');
        state.child_code = $('ob-child-code').value;
        $('ob-fed-hint').textContent =
            m === 'specialist'
                ? 'Специалист получает дочернюю ссылку для прикрепления к дашборду руководителя.'
                : 'Дашборд получает родительскую и дочернюю ссылки для построения иерархии.';
        $('ob-parent-block').classList.toggle('ob__hidden', m === 'specialist');
        $('ob-child-in-block').classList.toggle('ob__hidden', m === 'specialist');
        if (m === 'manager') {
            $('ob-parent-code').value = state.parent_code || genCode('PARENT');
            state.parent_code = $('ob-parent-code').value;
        }
    }

    function refreshConsumerUI() {
        if (mode() !== 'specialist') {
            $('ob-consumer-choices').classList.add('ob__hidden');
            return;
        }
        $('ob-consumer-choices').classList.remove('ob__hidden');
        var ot = orgType();
        document.querySelectorAll('.ob__school-only').forEach(function (el) {
            el.classList.toggle('ob__hidden', ot !== 'government');
        });
        document.querySelectorAll('.ob__comm-only').forEach(function (el) {
            el.classList.toggle('ob__hidden', ot !== 'commercial');
        });
    }

    function defaultModules() {
        var ot = orgType();
        var m = mode();
        var out = {};
        MODULES.forEach(function (mod) {
            if (mod.always) { out[mod.id] = true; return; }
            if (mod.manager && m !== 'manager') { out[mod.id] = false; return; }
            if (mod.specialist && m !== 'specialist') { out[mod.id] = false; return; }
            if (mod.schoolOnly && ot !== 'government') { out[mod.id] = false; return; }
            if (ot === 'government') out[mod.id] = !!mod.school;
            else if (ot === 'commercial') out[mod.id] = !!mod.comm;
            else out[mod.id] = mod.id === 'reception_journal' || mod.id === 'consultation_journal';
        });
        return out;
    }

    function renderModules() {
        if (!Object.keys(state.modules).length) state.modules = defaultModules();
        var root = $('ob-modules');
        root.innerHTML = '';
        MODULES.forEach(function (mod) {
            if (mod.always) return;
            var div = document.createElement('div');
            div.className = 'ob__mod';
            var checked = state.modules[mod.id] ? 'checked' : '';
            var paid = mod.paid ? '<span class="ob__mod-tag">ИИ платно</span>' : '';
            div.innerHTML =
                '<label><input type="checkbox" data-mod="' + mod.id + '" ' + checked + ' />' +
                '<span><strong>' + mod.title + '</strong>' + paid + '</span></label>' +
                '<p class="ob__mod-desc">' + mod.desc + '</p>';
            root.appendChild(div);
        });
        root.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                state.modules[cb.getAttribute('data-mod')] = cb.checked;
            });
        });
    }

    function finish() {
        state.terminal_id = state.terminal_id || 'term_' + crypto.randomUUID().slice(0, 8);
        $('ob-terminal-id').textContent = state.terminal_id;
        var profile = {};
        var fd = new FormData($('ob-profile-form'));
        fd.forEach(function (v, k) { profile[k] = v; });
        var payload = {
            terminal_id: state.terminal_id,
            mode: mode(),
            federation: {
                child_code: state.child_code,
                parent_code: state.parent_code,
                parent_in: $('ob-parent-in').value,
                child_in: $('ob-child-in').value,
            },
            profile: profile,
            consumer: document.querySelector('input[name="consumer"]:checked')?.value || '',
            modules: state.modules,
        };
        $('ob-summary').textContent = JSON.stringify(payload, null, 2);
        try { localStorage.setItem('prevention_terminal_config', JSON.stringify(payload)); } catch (_) {}
    }

    function nextStep() {
        if (step === 3 && mode() === 'manager') return 5;
        return step + 1;
    }
    function prevStep() {
        if (step === 5 && mode() === 'manager') return 3;
        return step - 1;
    }

    $('ob-next').addEventListener('click', function () {
        if (step === 3) {
            var name = document.querySelector('[name="display_name"]');
            if (!name || !name.value.trim()) { name.focus(); return; }
        }
        var n = nextStep();
        if (n <= maxStep) showStep(n);
        else showStep(maxStep);
    });
    $('ob-back').addEventListener('click', function () {
        var p = prevStep();
        if (p >= 1) showStep(p);
    });
    document.querySelectorAll('.ob__copy').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var el = $(btn.getAttribute('data-target'));
            if (el) navigator.clipboard.writeText(el.value);
        });
    });
    document.querySelectorAll('input[name="mode"]').forEach(function (r) {
        r.addEventListener('change', function () { state.modules = {}; });
    });

    state.child_code = genCode('CHILD');
    showStep(1);
})();
