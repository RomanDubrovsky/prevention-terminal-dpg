/*
 * Shared diagnostic module — local report bundle store.
 *
 * The backend is authoritative for diagnostic scoring/report generation. This
 * store only keeps the latest client-side report bundle so the UI can re-render
 * after language switches, bridge context into chat and seed state indicators
 * while offline.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});
    var KEY = 'pn_diag_report_bundle_v1';

    function read() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return null;
            var obj = JSON.parse(raw);
            return obj && typeof obj === 'object' ? obj : null;
        } catch (_) {
            return null;
        }
    }

    function save(bundle) {
        try {
            localStorage.setItem(KEY, JSON.stringify(bundle || {}));
            return true;
        } catch (_) {
            return false;
        }
    }

    function update(mutator) {
        var bundle = read();
        if (!bundle) return null;
        var next = typeof mutator === 'function' ? mutator(bundle) : bundle;
        if (!next || typeof next !== 'object') return null;
        return save(next) ? next : null;
    }

    function remove() {
        try {
            localStorage.removeItem(KEY);
            return true;
        } catch (_) {
            return false;
        }
    }

    function hasSaved() {
        var obj = read();
        return !!(obj && (obj.bundle || obj.report || obj.snapshot));
    }

    function readTestId() {
        var obj = read();
        return obj ? String(obj.test_id || '').trim() : '';
    }

    function readIndicators(fallback) {
        var obj = read();
        if (!obj || !obj.report) return null;
        if (obj.state_indicators && typeof obj.state_indicators === 'object') {
            return obj.state_indicators;
        }
        return typeof fallback === 'function' ? fallback(obj) : null;
    }

    function buildBundle(finalizeData, fallbackTestId, safetyMode) {
        var d = finalizeData && typeof finalizeData === 'object' ? finalizeData : {};
        var rep = d.report && typeof d.report === 'object' ? d.report : {};
        var safety = typeof safetyMode === 'boolean'
            ? safetyMode
            : !!(d.safety_mode || rep.safety_mode);

        return {
            test_id: d.test_id || fallbackTestId || '',
            category: d.category,
            y_level: d.y_level,
            respondent_role: String(d.respondent_role || 'parent').toLowerCase(),
            safety_mode: safety,
            report: rep,
            four_d_snapshot: rep.four_d_snapshot || null,
            negative_substantive_answers: Array.isArray(d.negative_substantive_answers)
                ? d.negative_substantive_answers
                : [],
            state_indicators: (d.state_indicators && typeof d.state_indicators === 'object')
                ? d.state_indicators
                : null,
            saved_at: Date.now(),
        };
    }

    diagnostic.reportStore = {
        key: KEY,
        buildBundle: buildBundle,
        read: read,
        save: save,
        update: update,
        remove: remove,
        hasSaved: hasSaved,
        readTestId: readTestId,
        readIndicators: readIndicators,
    };
})(typeof window !== 'undefined' ? window : this);
