(function (global) {
    const LS_USER_KEY = 'irpp_web_user_key';
    const LS_TERMS = 'irpp_web_terms_v1';
    const LS_PRIVACY = 'irpp_web_privacy_v1';
    const LS_SKIP_ONBOARD = 'irpp_web_skip_onboard_v1';

    function apiBase() {
        const meta = document.querySelector('meta[name="app-api-base"]');
        const fromMeta = meta && meta.getAttribute('content');
        if (fromMeta && fromMeta.trim() && !fromMeta.includes('__')) {
            return fromMeta.trim().replace(/\/$/, '');
        }
        if (typeof global.__SW_API_BASE__ === 'string' && global.__SW_API_BASE__.trim()) {
            return global.__SW_API_BASE__.trim().replace(/\/$/, '');
        }
        const host = (global.location && global.location.hostname) || '';
        if (host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host)) {
            return 'http://127.0.0.1:8000';
        }
        return 'https://api.prevention.school';
    }

    function userKey() {
        try {
            let k = localStorage.getItem(LS_USER_KEY);
            if (!k) {
                k = 'irpp_web_' + (global.crypto && crypto.randomUUID
                    ? crypto.randomUUID()
                    : String(Date.now()) + '_' + Math.random().toString(36).slice(2, 10));
                localStorage.setItem(LS_USER_KEY, k);
            }
            return k;
        } catch (_) {
            return 'irpp_web_anon';
        }
    }

    function locale() {
        const lang = (navigator.language || 'ru').toLowerCase();
        return lang.startsWith('en') ? 'en' : 'ru';
    }

    async function apiPost(path, body) {
        const url = apiBase() + path;
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            const err = new Error(data.detail || data.error || data.reply || ('HTTP ' + r.status));
            err.status = r.status;
            err.payload = data;
            throw err;
        }
        return data;
    }

    function onboardingOk() {
        try {
            return localStorage.getItem(LS_TERMS) === '1' && localStorage.getItem(LS_PRIVACY) === '1';
        } catch (_) {
            return false;
        }
    }

    function setOnboardingAccepted(skipNext) {
        try {
            localStorage.setItem(LS_TERMS, '1');
            localStorage.setItem(LS_PRIVACY, '1');
            if (skipNext) localStorage.setItem(LS_SKIP_ONBOARD, '1');
        } catch (_) {}
    }

    function shouldSkipOnboarding() {
        try {
            return localStorage.getItem(LS_SKIP_ONBOARD) === '1' && onboardingOk();
        } catch (_) {
            return false;
        }
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    global.SWCommon = {
        apiBase,
        userKey,
        locale,
        apiPost,
        onboardingOk,
        setOnboardingAccepted,
        shouldSkipOnboarding,
        escapeHtml,
        LS_SKIP_ONBOARD,
    };
})(typeof window !== 'undefined' ? window : globalThis);
