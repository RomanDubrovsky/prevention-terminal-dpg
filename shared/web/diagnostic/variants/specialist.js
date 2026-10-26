/*
 * Shared diagnostic module — specialist variant.
 *
 * Intended for future school psychologist / professional workspaces. It keeps
 * the same diagnostic flow and backend contract, but changes the available
 * post-result capabilities away from consumer conversion/paywall UI.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});
    var variants = (diagnostic.variants = diagnostic.variants || {});

    variants.specialist = {
        id: 'specialist',
        audience: 'specialist',
        label: 'Specialist diagnostic',
        features: {
            bridgeContextToChat: false,
            conversionCta: false,
            paywallAfterResult: false,
            specialistExports: true,
            specialistCaseNotes: true,
            printableReport: true,
        },
        resultActions: ['print_report', 'export_summary', 'case_notes'],
    };
})(typeof window !== 'undefined' ? window : this);
