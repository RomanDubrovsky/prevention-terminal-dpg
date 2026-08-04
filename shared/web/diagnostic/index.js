/*
 * Shared diagnostic module — public surface.
 *
 * Phase 0 exposes a stable factory without taking over the current app flow.
 * Later phases will move start/answer/finalize/render logic behind this object.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});

    function resolveVariant(config, explicitVariant) {
        var variants = diagnostic.variants || {};
        var requested = String(
            explicitVariant
            || (config && config.variant)
            || (config && config.audience)
            || 'user',
        ).toLowerCase();
        if (variants[requested]) return variants[requested];
        if (requested === 'parent' || requested === 'teen') return variants.user || null;
        return variants.user || null;
    }

    function applyVariant(config, variant, explicitFeatures) {
        var cfg = Object.assign({}, config || {});
        var v = variant || {};
        cfg.audience = String(v.audience || cfg.audience || 'user');
        cfg.variant = String(v.id || cfg.variant || cfg.audience || 'user');
        cfg.features = Object.assign({}, cfg.features || {}, v.features || {}, explicitFeatures || {});
        cfg.resultActions = Array.isArray(cfg.resultActions)
            ? cfg.resultActions.slice()
            : (Array.isArray(v.resultActions) ? v.resultActions.slice() : []);
        return cfg;
    }

    function createDiagnostic(options) {
        var opts = options || {};
        var baseConfig = diagnostic.normalizeConfig ? diagnostic.normalizeConfig(opts.config) : (opts.config || {});
        var variant = resolveVariant(baseConfig, opts.variant);
        var explicitFeatures = opts.config && opts.config.features && typeof opts.config.features === 'object'
            ? opts.config.features
            : null;
        var config = applyVariant(baseConfig, variant, explicitFeatures);
        return {
            config: config,
            variant: variant,
            host: diagnostic.createHost ? diagnostic.createHost(opts.host) : (opts.host || {}),
            version: diagnostic.version,
        };
    }

    diagnostic.version = '0.1.0';
    diagnostic.ready = true;
    diagnostic.resolveVariant = resolveVariant;
    diagnostic.applyVariant = applyVariant;
    diagnostic.createDiagnostic = createDiagnostic;
})(typeof window !== 'undefined' ? window : this);
