/*
 * Shared web layer — universal Pulse/Battery state signals (PNShared.stateSignals).
 *
 * All Teenology-family apps share the same backend table
 * (teenology_state_indicators) keyed by (user_id, app_id). Each app sets
 * PNShared.config.app.id before boot; this module routes diary/chat/diagnostic
 * aggregate signals and indicator reads through the same API surface.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    function appId() {
        try {
            var app = PNShared.config && PNShared.config.app;
            var id = app && app.id ? String(app.id).trim() : '';
            return id || 'parent_navigator';
        } catch (_) {
            return 'parent_navigator';
        }
    }

    function apiUrl(path) {
        if (typeof global.apiUrl === 'function') return global.apiUrl(path);
        if (PNShared.api && typeof PNShared.api.url === 'function') return PNShared.api.url(path);
        return String(path || '');
    }

    function withUserAndApp(baseUrl) {
        var u = String(baseUrl || '');
        try {
            if (typeof global.pnUrlWithUserId === 'function') return global.pnUrlWithUserId(u);
            if (PNShared.api && typeof PNShared.api.withUserId === 'function') u = PNShared.api.withUserId(u);
        } catch (_) {}
        try {
            var sep = u.indexOf('?') >= 0 ? '&' : '?';
            u += sep + 'app_id=' + encodeURIComponent(appId());
        } catch (_) {}
        return u;
    }

    function authJsonHeaders(extra) {
        try {
            if (typeof global.apiAuthHeaders === 'function') {
                return global.apiAuthHeaders(Object.assign({ 'Content-Type': 'application/json' }, extra || {}));
            }
        } catch (_) {}
        return Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    }

    function bearerHeaders(extra) {
        try {
            if (typeof global.apiHeadersBearerOnly === 'function') return global.apiHeadersBearerOnly(extra || {});
            if (PNShared.api && typeof PNShared.api.headersBearerOnly === 'function') {
                return PNShared.api.headersBearerOnly(extra || {});
            }
        } catch (_) {}
        return Object.assign({}, extra || {});
    }

    /**
     * POST /api/state/signal — privacy-safe aggregate (diary, etc.).
     * Never sends free text; only taxonomy codes + severity/y_level.
     */
    async function sendAggregateSignal(fields) {
        var uid = '';
        try { uid = (typeof global.UID === 'string' && global.UID) ? global.UID : ''; } catch (_) {}
        if (!uid) return null;
        var body = Object.assign({}, fields || {}, {
            userId: uid,
            app_id: appId(),
            source: (fields && fields.source) || 'diary_aggregate',
        });
        try {
            var res = await fetch(apiUrl('/api/state/signal'), {
                method: 'POST',
                headers: authJsonHeaders(),
                body: JSON.stringify(body),
            });
            if (!res.ok) return null;
            try { return await res.json(); } catch (_) { return { ok: true }; }
        } catch (_) {
            return null;
        }
    }

    /** GET /api/state/indicators — compact pulse/battery read model. */
    async function fetchIndicators() {
        try {
            var res = await fetch(withUserAndApp(apiUrl('/api/state/indicators')), {
                headers: bearerHeaders(),
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (_) {
            return null;
        }
    }

    PNShared.stateSignals = {
        appId: appId,
        withUserAndApp: withUserAndApp,
        sendAggregateSignal: sendAggregateSignal,
        fetchIndicators: fetchIndicators,
    };

    try { global.pnAppId = appId; } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
