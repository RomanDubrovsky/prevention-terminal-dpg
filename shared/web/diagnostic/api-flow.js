/*
 * Shared diagnostic module — API flow client.
 *
 * Keeps endpoint URLs, headers and timeout choices behind the diagnostic host
 * boundary while the app module still owns UI transitions and error copy.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});

    function host(input) {
        return diagnostic.createHost ? diagnostic.createHost(input) : (input || {});
    }

    function jsonHeaders(h, extra) {
        return h.api.authHeaders(Object.assign({ 'Content-Type': 'application/json' }, extra || {}));
    }

    function bareJsonHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    function captchaMode(options) {
        var h = host(options && options.host);
        var timeoutMs = (options && options.timeoutMs) || 8000;
        return h.api.fetchTimeout(h.api.url('/api/diagnostic/captcha-mode'), { method: 'GET' }, timeoutMs);
    }

    function start(body, options) {
        var h = host(options && options.host);
        var timeoutMs = (options && options.timeoutMs) || 25000;
        return h.api.fetchTimeout(
            h.api.url('/api/diagnostic/start'),
            {
                method: 'POST',
                headers: bareJsonHeaders(),
                body: JSON.stringify(body || {}),
            },
            timeoutMs,
        );
    }

    function answer(testId, answerValue, options) {
        var h = host(options && options.host);
        return fetch(h.api.url('/api/diagnostic/answer'), {
            method: 'POST',
            headers: bareJsonHeaders(),
            body: JSON.stringify({ test_id: testId, answer: answerValue }),
        });
    }

    function finalize(testId, options) {
        var h = host(options && options.host);
        return fetch(h.api.url('/api/diagnostic/finalize'), {
            method: 'POST',
            headers: jsonHeaders(h),
            body: JSON.stringify({ test_id: testId }),
        });
    }

    function convert(testId, options) {
        var h = host(options && options.host);
        var useAuth = !options || options.auth !== false;
        return fetch(h.api.url('/api/diagnostic/convert'), {
            method: 'POST',
            headers: useAuth ? jsonHeaders(h) : bareJsonHeaders(),
            body: JSON.stringify({ test_id: testId }),
        });
    }

    diagnostic.apiFlow = {
        captchaMode: captchaMode,
        start: start,
        answer: answer,
        finalize: finalize,
        convert: convert,
    };
})(typeof window !== 'undefined' ? window : this);
