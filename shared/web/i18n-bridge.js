/*
 * Shared web layer — i18n + minimal UI bridge (PNShared.i18n, PNShared.ui).
 *
 * t()/lang() delegate to the app i18n runtime; toast() to the host's toast.
 * This lets shared modules render localized copy and feedback without binding
 * to a specific app's i18n/UI implementation.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    PNShared.i18n = {
        t: function (key, fallback, opts) {
            if (typeof pnT === 'function') return pnT(key, fallback, opts);
            return (fallback !== undefined && fallback !== null) ? fallback : key;
        },
        lang: function () {
            return (typeof pnCurrentLang === 'function') ? pnCurrentLang() : 'en';
        },
    };

    PNShared.ui = {
        toast: function (message) {
            if (typeof showPnToast === 'function') showPnToast(message);
        },
    };
})(typeof window !== 'undefined' ? window : this);
