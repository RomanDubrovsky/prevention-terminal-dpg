/*
 * Shared diagnostic module — pure helpers.
 *
 * These helpers are deliberately free of DOM, network and app-global access.
 * They can be reused by the current Teenology PWA, specialist workspaces and
 * future sibling apps.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});

    function crisisHintFromAnswer(d) {
        if (!d || typeof d !== 'object') return false;
        if (String(d.safety_note || '').trim()) return true;
        if (Array.isArray(d.crisis_markers) && d.crisis_markers.length > 0) return true;
        return false;
    }

    function sanitizeInsightCopy(s) {
        var t = String(s || '').trim();
        t = t.replace(/^(Принято|Принято\s*)[:：]?\s*/i, '');
        t = t.replace(/\s*Пояснение методики[:：]?\s*/gi, ' ');
        t = t.replace(/\s*К чему это по смыслу[:：]?\s*/gi, ' ');
        t = t.replace(/\s{2,}/g, ' ').trim();
        return t;
    }

    function splitReflectionResourceMethod(raw) {
        raw = sanitizeInsightCopy(raw);
        if (!raw) return { res: '', method: '' };
        var parts = raw.split(/\s+По методическим материалам:\s*/i);
        if (parts.length >= 2) {
            return { res: parts[0].trim(), method: parts.slice(1).join(' ').trim() };
        }
        parts = raw.split(/\s+По смыслу вопроса:\s*/i);
        if (parts.length >= 2) {
            return { res: parts[0].trim(), method: parts.slice(1).join(' ').trim() };
        }
        return { res: raw, method: '' };
    }

    function reportText(val) {
        if (val == null) return '';
        if (Array.isArray(val)) {
            return val.map(function (x) { return reportText(x); }).filter(Boolean).join('\n');
        }
        if (typeof val === 'object') {
            try {
                return JSON.stringify(val, null, 2);
            } catch (_) {
                return '';
            }
        }
        var s = String(val || '').trim();
        if (!s) return '';
        var looksArray = (s[0] === '[' && s[s.length - 1] === ']');
        if (looksArray) {
            try {
                var parsed = JSON.parse(s.replace(/'/g, '"'));
                if (Array.isArray(parsed)) return reportText(parsed);
            } catch (_) {
                s = s
                    .replace(/^\s*\[\s*/, '')
                    .replace(/\s*\]\s*$/, '')
                    .replace(/^\s*['"]|['"]\s*$/g, '')
                    .replace(/['"]\s*,\s*['"]/g, '\n')
                    .replace(/\\n/g, '\n')
                    .trim();
            }
        }
        return s;
    }

    function pulseEmojiToneClass(emoji) {
        var e = String(emoji || '').trim();
        if (e === '😊') return 'pn-diag-emoji--good';
        if (e === '😫' || e === '🚨') return 'pn-diag-emoji--bad';
        return 'pn-diag-emoji--caution';
    }

    function healthBarToneClass(pct, safety) {
        if (safety) return 'pn-diag-health-fill--bad';
        var n = Number(pct);
        if (!Number.isFinite(n)) return 'pn-diag-health-fill--caution';
        if (n >= 73) return 'pn-diag-health-fill--good';
        if (n >= 48) return 'pn-diag-health-fill--caution';
        if (n >= 28) return 'pn-diag-health-fill--risk';
        return 'pn-diag-health-fill--bad';
    }

    function fallbackHealthPercent(yLevel) {
        var m = { Y1_Normal: 82, Y2_Risk: 60, Y3_Problem: 42, Y4_Crisis_Clinical: 9 };
        var k = String(yLevel || '');
        return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : 50;
    }

    function percentOrFallback(value, fallback) {
        var n = typeof value === 'number' ? value : parseInt(String(value != null ? value : ''), 10);
        if (!Number.isFinite(n)) n = fallback;
        return Math.max(0, Math.min(100, n));
    }

    function buildAnswerResultModel(answerData, options) {
        var d = answerData && typeof answerData === 'object' ? answerData : {};
        var opts = options || {};
        var reducedMotion = typeof opts.prefersReducedMotion === 'function'
            ? !!opts.prefersReducedMotion()
            : !!opts.reducedMotion;
        var urgent = crisisHintFromAnswer(d);
        var hasQuestion = !!(d.question && typeof d.question === 'object');
        var done = !!d.done;

        return {
            answerData: d,
            done: done,
            hasQuestion: hasQuestion,
            instantPath: urgent || reducedMotion,
            question: hasQuestion ? d.question : null,
            reducedMotion: reducedMotion,
            remaining: d.remaining,
            urgent: urgent,
        };
    }

    function buildFeedbackCopyModel(answerData) {
        var d = answerData && typeof answerData === 'object' ? answerData : {};
        var split = splitReflectionResourceMethod(String(d.reflection || '').trim());
        return {
            block: sanitizeInsightCopy(String(d.block_transition || '').trim()),
            interim: sanitizeInsightCopy(String(d.interim_insight || '').trim()),
            rationale: split.method,
            reflection: split.res,
        };
    }

    function normalizeSaveProfile(profile) {
        var p = profile && typeof profile === 'object' ? profile : {};
        return {
            email: String(p.email || '').trim().toLowerCase(),
            fullName: String(p.full_name || p.name || '').trim(),
        };
    }

    function validateSaveProfile(profile) {
        var p = normalizeSaveProfile(profile);
        return {
            ok: !!p.email,
            error: p.email ? '' : 'email_required',
            profile: p,
        };
    }

    function buildRegisterLitePayload(profile, context) {
        var p = normalizeSaveProfile(profile);
        var ctx = context || {};
        var body = {
            userId: String(ctx.userId || '').trim(),
            email: p.email,
            full_name: p.fullName,
        };
        var locale = String(ctx.locale || '').trim();
        if (locale) body.locale = locale;
        return body;
    }

    function buildStartPayload(context) {
        var ctx = context || {};
        var locale = String(ctx.locale || 'ru').trim() || 'ru';
        var body = {
            userId: String(ctx.userId || '').trim(),
            locale: locale,
            user_locale: locale,
        };
        var captchaToken = String(ctx.captchaToken || '').trim();
        if (captchaToken) body.captchaToken = captchaToken;
        return body;
    }

    function parseRegisterLiteResponse(data) {
        var d = data && typeof data === 'object' ? data : {};
        return {
            accessToken: String(d.access_token || '').trim(),
            userId: String(d.user_id || '').trim(),
            error: d.error || '',
        };
    }

    function buildResultViewModel(finalizeData) {
        var d = finalizeData && typeof finalizeData === 'object' ? finalizeData : {};
        var rep = d.report && typeof d.report === 'object' ? d.report : {};
        var safety = !!(d.safety_mode || rep.safety_mode);
        var healthPercent = percentOrFallback(rep.relationship_health_percent, fallbackHealthPercent(d.y_level));
        var resourcePercent = percentOrFallback(rep.resource_level_percent, 50);
        var priorityPlan = Array.isArray(rep.priority_plan) ? rep.priority_plan : [];
        var quietModePoints = Array.isArray(rep.quiet_mode_points) ? rep.quiet_mode_points : [];

        return {
            report: rep,
            safetyMode: safety,
            isClinicalCrisis: String(d.y_level || '') === 'Y4_Crisis_Clinical',
            degraded: !!(d.degraded_report || rep.degraded_report),
            respondentRole: String(d.respondent_role || 'parent').toLowerCase(),
            emojiStatus: String(rep.emoji_status || '🤨').trim() || '🤨',
            healthPercent: healthPercent,
            resourcePercent: resourcePercent,
            healthLabel: String(rep.relationship_health_label || '').trim(),
            negativeAnswers: Array.isArray(d.negative_substantive_answers)
                ? d.negative_substantive_answers
                : [],
            quietItems: (healthPercent < 30 || resourcePercent < 30) ? quietModePoints : [],
            planItems: priorityPlan.map(function (s) { return reportText(s); }),
            hasPriorityPlan: priorityPlan.length > 0,
            shortTermPlan: reportText(rep.short_term_plan || rep.measures),
            longTermPlan: reportText(rep.long_term_plan || rep.plan),
        };
    }

    function buildResultCopy(viewModel, callbacks) {
        var vm = viewModel && typeof viewModel === 'object' ? viewModel : {};
        var cb = callbacks || {};
        var role = String(vm.respondentRole || 'parent').toLowerCase();
        var isTeen = role === 'teen';
        var isEnglish = typeof cb.isEnglish === 'function' ? !!cb.isEnglish() : false;
        var healthPercent = Number(vm.healthPercent);
        if (!Number.isFinite(healthPercent)) healthPercent = 50;
        var resourcePercent = Number(vm.resourcePercent);
        if (!Number.isFinite(resourcePercent)) resourcePercent = 50;
        var safety = !!vm.safetyMode;
        var resourceHint = '';

        if (!safety && resourcePercent < 30) {
            resourceHint = isEnglish
                ? 'This looks really hard right now. The most important thing is to find at least 15 minutes for yourself: breathe out, do not answer immediately and do not demand the impossible from yourself.'
                : (isTeen
                    ? 'Похоже, сейчас очень непросто. Самое важное сейчас — найти хотя бы 15 минут для себя: выдохнуть, не отвечать сразу и не требовать от себя невозможного.'
                    : 'Похоже, сейчас вам очень непросто. Самое важное сейчас — найти хотя бы 15 минут для себя: выдохнуть, не отвечать сразу и не требовать от себя невозможного.');
        }

        return {
            healthLabel: vm.degraded && typeof cb.healthLabel === 'function'
                ? cb.healthLabel(healthPercent, safety, role)
                : String(vm.healthLabel || '').trim(),
            resourceHint: resourceHint,
            resourceLabel: isEnglish
                ? 'Your current resource'
                : (isTeen ? 'Твой текущий ресурс' : 'Ваш текущий ресурс'),
        };
    }

    diagnostic.helpers = {
        buildAnswerResultModel: buildAnswerResultModel,
        buildFeedbackCopyModel: buildFeedbackCopyModel,
        buildRegisterLitePayload: buildRegisterLitePayload,
        buildResultCopy: buildResultCopy,
        buildResultViewModel: buildResultViewModel,
        buildStartPayload: buildStartPayload,
        crisisHintFromAnswer: crisisHintFromAnswer,
        sanitizeInsightCopy: sanitizeInsightCopy,
        normalizeSaveProfile: normalizeSaveProfile,
        parseRegisterLiteResponse: parseRegisterLiteResponse,
        splitReflectionResourceMethod: splitReflectionResourceMethod,
        reportText: reportText,
        validateSaveProfile: validateSaveProfile,
        pulseEmojiToneClass: pulseEmojiToneClass,
        healthBarToneClass: healthBarToneClass,
        fallbackHealthPercent: fallbackHealthPercent,
    };
})(typeof window !== 'undefined' ? window : this);
