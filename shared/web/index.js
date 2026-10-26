/*
 * Shared web layer — readiness marker (PNShared).
 *
 * Concatenated last among shared/web/* so that by this point config/api/auth/
 * attribution/payments/chat/i18n surfaces are all attached. Marks the layer as
 * ready and announces it once for late consumers.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    PNShared.version = '0.1.0';
    PNShared.ready = true;

    try {
        if (typeof document !== 'undefined' && document.dispatchEvent) {
            document.dispatchEvent(new CustomEvent('pnshared:ready', { detail: { version: PNShared.version } }));
        }
    } catch (_) {}
})(typeof window !== 'undefined' ? window : this);
