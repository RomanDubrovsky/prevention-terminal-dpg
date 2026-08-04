/*
 * Shared web layer — chat façade (PNShared.chat).
 *
 * Phase 0 delegates to the app handleSend(); shared modules (e.g. diagnostic
 * bridging its context into chat) can call this without knowing the host's
 * internal send implementation.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});

    PNShared.chat = {
        send: function (forceText, displayText, isHidden) {
            if (typeof handleSend === 'function') return handleSend(forceText, displayText, isHidden);
            return undefined;
        },
    };
})(typeof window !== 'undefined' ? window : this);
