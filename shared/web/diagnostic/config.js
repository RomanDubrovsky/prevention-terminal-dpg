/*
 * Shared diagnostic module — runtime configuration.
 *
 * Phase 0 only defines the stable shape that future apps can override. The
 * existing Teenology diagnostic flow still lives in the app module; upcoming
 * steps will move logic here behind this config boundary.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});

    function sharedApp() {
        return (PNShared.config && PNShared.config.app) || {};
    }

    function normalizeConfig(input) {
        var app = sharedApp();
        var cfg = input || {};
        var features = Object.assign(
            {
                bridgeContextToChat: true,
                conversionCta: true,
                paywallAfterResult: true,
                specialistExports: false,
            },
            cfg.features || {},
        );

        return {
            appId: String(cfg.appId || app.id || 'parent_navigator'),
            audience: String(cfg.audience || app.audience || 'user'),
            domain: String(cfg.domain || 'teenology'),
            locale: String(cfg.locale || (PNShared.i18n && PNShared.i18n.lang && PNShared.i18n.lang()) || 'en'),
            features: features,
        };
    }

    diagnostic.defaultConfig = normalizeConfig();
    diagnostic.normalizeConfig = normalizeConfig;
})(typeof window !== 'undefined' ? window : this);
