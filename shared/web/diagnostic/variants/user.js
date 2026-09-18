/*
 * Shared diagnostic module — regular user variant.
 *
 * This matches today's Teenology parent/teen PWA behavior: report, save/auth,
 * bridge into chat and conversion CTA after the result.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});
    var variants = (diagnostic.variants = diagnostic.variants || {});

    variants.user = {
        id: 'user',
        audience: 'user',
        label: 'Regular user diagnostic',
        features: {
            bridgeContextToChat: true,
            conversionCta: true,
            paywallAfterResult: true,
            specialistExports: false,
            specialistCaseNotes: false,
            printableReport: false,
        },
        resultActions: ['save_report', 'chat_bridge', 'conversion_cta'],
    };
})(typeof window !== 'undefined' ? window : this);
