/*
 * Shared web layer — app-aware configuration surface (PNShared.config).
 *
 * Phase 0: a thin façade over the existing window.PN_APP_CONFIG and the
 * window.apiUrl/__PN_API_BASE__ globals. Nothing is moved yet — this only
 * establishes a stable boundary that future apps (and the diagnostic module)
 * can depend on instead of reaching for app-specific globals directly.
 *
 * Future apps override PNShared.config.app to change identity/audience while
 * reusing the same shared modules.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    function raw() {
        var cfg = global.PN_APP_CONFIG;
        if (cfg && typeof cfg.refresh === 'function') {
            try { return cfg.refresh(); } catch (_) { return cfg; }
        }
        return cfg || {};
    }

    function get(key, fallback) {
        var v = raw()[key];
        if (v === undefined || v === null || v === '') {
            return fallback === undefined ? '' : fallback;
        }
        return v;
    }

    function apiBase() {
        if (typeof global.__PN_API_BASE__ === 'string' && global.__PN_API_BASE__) {
            return global.__PN_API_BASE__.replace(/\/$/, '');
        }
        return String(get('apiBase', '')).replace(/\/$/, '');
    }

    function metaContent(name) {
        try {
            var el = document.querySelector('meta[name="' + name + '"]');
            var v = el && el.getAttribute('content');
            return v && String(v).trim() ? String(v).trim() : '';
        } catch (_) {
            return '';
        }
    }

    function productAppId() {
        return metaContent('app-product-id') || 'parent_navigator';
    }

    function productAudience() {
        return metaContent('app-product-audience') || 'user';
    }

    PNShared.config = {
        raw: raw,
        get: get,
        apiBase: apiBase,
        /* Identity consumed by shared modules (diagnostic, etc.) and future apps.
           Sibling apps override via meta app-product-id / app-product-audience. */
        app: { id: productAppId(), audience: productAudience() },
    };
})(typeof window !== 'undefined' ? window : this);
