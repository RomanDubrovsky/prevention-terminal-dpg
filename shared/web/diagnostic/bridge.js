/*
 * Shared diagnostic module — chat bridge payload.
 *
 * Converts a saved diagnostic report bundle into the hidden chat message that
 * seeds the AI assistant with diagnostic context. Pure data logic only.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});
    var PREFIX = '[DIAGNOSTIC_CONTEXT_BRIDGE]';

    function clampPercent(value, fallback) {
        var n = typeof value === 'number' ? value : parseInt(String(value != null ? value : ''), 10);
        if (!Number.isFinite(n)) n = fallback;
        return Math.max(0, Math.min(100, n));
    }

    function buildPayload(bundle) {
        var raw = bundle || (diagnostic.reportStore && diagnostic.reportStore.read && diagnostic.reportStore.read());
        if (!raw || typeof raw !== 'object') return null;
        var rep = raw.report || {};
        var fallbackHealth = diagnostic.helpers && diagnostic.helpers.fallbackHealthPercent
            ? diagnostic.helpers.fallbackHealthPercent(raw.y_level)
            : 50;
        var hp = clampPercent(rep.relationship_health_percent, fallbackHealth);
        var res = clampPercent(rep.resource_level_percent, 50);
        var role = String(raw.respondent_role || 'parent').toLowerCase();
        if (role !== 'teen') role = 'parent';
        var negs = Array.isArray(raw.negative_substantive_answers) ? raw.negative_substantive_answers : [];
        var entries = negs
            .map(function (row) {
                if (!row || typeof row !== 'object') return null;
                var qid = String(row.question_id || '').trim();
                if (!qid) return null;
                return {
                    question_id: qid,
                    axis: String(row.axis || '').trim(),
                    answer: String(row.answer || '').trim().toLowerCase(),
                    question_text: String(row.question_text || '').trim(),
                };
            })
            .filter(Boolean);
        var steps = Array.isArray(rep.priority_plan) ? rep.priority_plan : [];
        var plan3 = steps
            .map(function (s) { return String(s || '').trim(); })
            .filter(Boolean)
            .slice(0, 3);
        return {
            type: 'diagnostic_context_bridge',
            health_percent: hp,
            resource_level_percent: res,
            respondent_role: role,
            negative_entries: entries,
            priority_plan: plan3,
        };
    }

    function buildMessage(bundle) {
        var payload = buildPayload(bundle);
        return payload ? PREFIX + JSON.stringify(payload) : '';
    }

    diagnostic.bridge = {
        prefix: PREFIX,
        buildPayload: buildPayload,
        buildMessage: buildMessage,
    };
})(typeof window !== 'undefined' ? window : this);
