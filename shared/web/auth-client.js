/*
 * Shared web layer — auth/session façade (PNShared.auth).
 *
 * UID / AUTH_TOKEN are `let` bindings in the concatenated bundle scope, so they
 * are NOT window properties and may be in the temporal dead zone at eval time.
 * We therefore read them lazily, guarded by try/typeof, and fall back to the
 * persisted localStorage values (the actual source of truth) when unavailable.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    function lsGet(key) {
        try { return String(localStorage.getItem(key) || ''); } catch (_) { return ''; }
    }

    function getUserId() {
        try { if (typeof UID === 'string' && UID) return UID; } catch (_) {}
        return lsGet('irpp_parent_uid');
    }

    function getToken() {
        try { if (typeof AUTH_TOKEN === 'string' && AUTH_TOKEN) return AUTH_TOKEN; } catch (_) {}
        return lsGet('irpp_parent_access_token');
    }

    function isAuthenticated() {
        return !!getToken();
    }

    function supabaseClient() {
        if (typeof getSupabaseClient === 'function') return getSupabaseClient();
        return null;
    }

    PNShared.auth = {
        getUserId: getUserId,
        getToken: getToken,
        isAuthenticated: isAuthenticated,
        supabaseClient: supabaseClient,
    };
})(typeof window !== 'undefined' ? window : this);
