/*
 * Shared web layer — API client façade (PNShared.api).
 *
 * Phase 0 delegates to the existing app globals so behavior (including the
 * app_id=parent_navigator query injection done by window.apiUrl) is byte-for-byte
 * unchanged. Globals are only touched at call time, never at module eval time,
 * so concatenation order with the app modules is irrelevant.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    function url(path) {
        if (typeof apiUrl === 'function') return apiUrl(path);
        var p = String(path || '');
        if (/^https?:\/\//i.test(p)) return p;
        var base = (PNShared.config && PNShared.config.apiBase()) || '';
        return base + (p.charAt(0) === '/' ? '' : '/') + p;
    }

    function authHeaders(extra) {
        if (typeof apiAuthHeaders === 'function') return apiAuthHeaders(extra || {});
        return Object.assign({}, extra || {});
    }

    function headersBearerOnly(extra) {
        if (typeof apiHeadersBearerOnly === 'function') return apiHeadersBearerOnly(extra || {});
        return Object.assign({}, extra || {});
    }

    function withUserId(u) {
        if (typeof pnUrlWithUserId === 'function') return pnUrlWithUserId(u);
        return u;
    }

    function fetchTimeout(resource, init, timeoutMs) {
        if (typeof pnFetchWithTimeout === 'function') return pnFetchWithTimeout(resource, init, timeoutMs);
        return fetch(resource, init);
    }

    async function fetchJson(path, init) {
        var res = await fetch(url(path), init || {});
        var text = await res.text();
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (_) { data = null; } }
        if (!res.ok) {
            var err = new Error('HTTP ' + res.status);
            err.status = res.status;
            err.data = data;
            err.body = text;
            throw err;
        }
        return data;
    }

    PNShared.api = {
        url: url,
        authHeaders: authHeaders,
        headersBearerOnly: headersBearerOnly,
        withUserId: withUserId,
        fetchTimeout: fetchTimeout,
        fetchJson: fetchJson,
    };
})(typeof window !== 'undefined' ? window : this);
