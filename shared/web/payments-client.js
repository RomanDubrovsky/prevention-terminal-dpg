/*
 * Shared web layer — payments façade (PNShared.payments).
 *
 * Phase 0 delegates to the existing tariffs entry point. Checkout creation
 * itself lives on the backend (Lava); the frontend only opens the plan picker.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    PNShared.payments = {
        openTariffs: function () {
            if (typeof openServiceTariffs === 'function') return openServiceTariffs();
            return undefined;
        },
    };
})(typeof window !== 'undefined' ? window : this);
