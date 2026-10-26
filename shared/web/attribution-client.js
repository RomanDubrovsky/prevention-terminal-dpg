/*
 * Shared web layer — partner attribution façade (PNShared.attribution).
 *
 * Backend is the authoritative attribution store; the frontend only captures
 * first-touch ref/utm/promo and resyncs after registration. This façade exposes
 * that capability to shared modules without binding them to the app globals.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    PNShared.attribution = {
        read: function () {
            return (typeof pnPartnerAttributionRead === 'function') ? pnPartnerAttributionRead() : null;
        },
        payload: function () {
            return (typeof pnPartnerAttributionPayload === 'function') ? pnPartnerAttributionPayload() : null;
        },
        syncServer: function () {
            return (typeof pnSyncPartnerAttributionServer === 'function') ? pnSyncPartnerAttributionServer() : undefined;
        },
    };
})(typeof window !== 'undefined' ? window : this);
