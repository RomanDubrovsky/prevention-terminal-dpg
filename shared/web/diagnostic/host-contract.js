/*
 * Shared diagnostic module — host contract.
 *
 * Diagnostics should not reach into app globals directly. The host provides
 * API, auth, i18n, UI and chat capabilities; app-specific modules can replace
 * any part of this object when embedding diagnostic flows in another product
 * or in a specialist-facing workspace.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});

    function noop() {}

    function createDiagnosticHost(overrides) {
        var o = overrides || {};
        var api = Object.assign({}, PNShared.api || {}, o.api || {});
        var auth = Object.assign({}, PNShared.auth || {}, o.auth || {});
        var i18n = Object.assign({}, PNShared.i18n || {}, o.i18n || {});
        var ui = Object.assign({}, PNShared.ui || {}, o.ui || {});
        var chat = Object.assign({}, PNShared.chat || {}, o.chat || {});
        var attribution = Object.assign({}, PNShared.attribution || {}, o.attribution || {});
        var payments = Object.assign({}, PNShared.payments || {}, o.payments || {});

        return {
            api: {
                url: api.url || function (path) { return String(path || ''); },
                authHeaders: api.authHeaders || function (extra) { return Object.assign({}, extra || {}); },
                headersBearerOnly: api.headersBearerOnly || function (extra) { return Object.assign({}, extra || {}); },
                withUserId: api.withUserId || function (url) { return url; },
                fetchTimeout: api.fetchTimeout || function (resource, init) { return fetch(resource, init); },
                fetchJson: api.fetchJson,
            },
            auth: {
                getUserId: auth.getUserId || function () { return ''; },
                getToken: auth.getToken || function () { return ''; },
                isAuthenticated: auth.isAuthenticated || function () { return false; },
                supabaseClient: auth.supabaseClient || function () { return null; },
            },
            i18n: {
                t: i18n.t || function (_key, fallback) { return fallback || _key; },
                lang: i18n.lang || function () { return 'en'; },
            },
            ui: {
                toast: ui.toast || noop,
            },
            chat: {
                send: chat.send || noop,
            },
            attribution: {
                read: attribution.read || function () { return null; },
                payload: attribution.payload || function () { return null; },
                syncServer: attribution.syncServer || noop,
            },
            payments: {
                openTariffs: payments.openTariffs || noop,
            },
        };
    }

    diagnostic.createHost = createDiagnosticHost;
    diagnostic.hostContractVersion = '0.1.0';
})(typeof window !== 'undefined' ? window : this);
