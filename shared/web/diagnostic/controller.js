/*
 * Shared diagnostic module — controller boundary.
 *
 * The controller owns flow actions that can be expressed through diagnostic
 * runtime services plus host callbacks. It must not reach into Teenology app
 * globals directly; app-specific UI, storage and chat side effects stay behind
 * callbacks.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});

    function noop() {}

    function createController(runtime, callbacks) {
        var rt = runtime || {};
        var cb = callbacks || {};

        function feature(name) {
            var features = (rt.config && rt.config.features) || {};
            return !!features[name];
        }

        function t(key, fallback, opts) {
            if (typeof cb.t === 'function') return cb.t(key, fallback, opts);
            return fallback || key;
        }

        function toast(message) {
            if (typeof cb.toast === 'function') cb.toast(message);
        }

        async function captchaMode(options) {
            var opts = options || {};
            var r = await rt.api.captchaMode({
                host: rt.host,
                timeoutMs: opts.timeoutMs,
            });
            var data = await r.json().catch(function () { return {}; });
            return {
                ok: !!r.ok,
                status: r.status,
                data: data,
            };
        }

        async function startTest(body, options) {
            var opts = options || {};
            var r = await rt.api.start(body, {
                host: rt.host,
                timeoutMs: opts.timeoutMs,
            });
            var data = await r.json().catch(function () { return {}; });
            return {
                ok: !!r.ok,
                status: r.status,
                data: data,
                rateLimited: r.status === 429 || (data && data.error === 'rate_limited_24h'),
            };
        }

        function startFailureMessage(data) {
            var d = data || {};
            if (d.error === 'captcha_required') {
                return t(
                    'teenology:diagnostic.errors.captcha_required',
                    'Тест: нужна Cloudflare Turnstile или отключение проверки локально (workers/pwa-api .dev.vars → PWA_DIAGNOSTIC_SKIP_TURNSTILE=1).'
                );
            }
            if (d.error === 'user_required') {
                return t(
                    'teenology:diagnostic.errors.user_required',
                    'Тест: не найден идентификатор профиля на устройстве. Обновите страницу.'
                );
            }
            if (d.error) {
                return t('teenology:diagnostic.errors.start_generic', 'Тест: ' + String(d.error), { error: String(d.error) });
            }
            return t(
                'teenology:diagnostic.errors.start_failed',
                'Не удалось запустить тест. Обновите страницу и попробуйте снова.'
            );
        }

        function startGuardMessage(reason, context) {
            var ctx = context || {};
            if (reason === 'anon_limit_reached') {
                var limit = Number(ctx.limit);
                if (!Number.isFinite(limit) || limit < 1) limit = 5;
                return t(
                    'teenology:diagnostic.errors.anon_limit_reached',
                    'Вы уже прошли ' + limit + ' бесплатных тестов с этого устройства. Войдите в аккаунт, чтобы запускать новые проходы и сохранять историю.',
                    { limit: limit }
                );
            }
            if (reason === 'turnstile_missing_key') {
                return t(
                    'teenology:diagnostic.errors.turnstile_missing_key',
                    'Тест не запускается: на странице нет ключа Turnstile. Нужна переменная PN_PAGES_TURNSTILE_SITE_KEY при сборке и домен в консоли Turnstile.'
                );
            }
            return '';
        }

        function startRuntimeMessage(reason) {
            if (reason === 'turnstile_load_failed') {
                return t(
                    'teenology:diagnostic.errors.turnstile_load_failed',
                    'Не удалось загрузить проверку Turnstile. Обновите страницу и убедитесь, что блокировщики скриптов отключены.'
                );
            }
            if (reason === 'start_prep_failed') {
                return t(
                    'teenology:diagnostic.errors.start_prep_failed',
                    'Не удалось подготовить запуск теста. Проверьте сеть и попробуйте снова.'
                );
            }
            if (reason === 'turnstile_required') {
                return t(
                    'teenology:diagnostic.errors.turnstile_required',
                    'Сначала пройдите проверку Turnstile выше.'
                );
            }
            if (reason === 'server_timeout') {
                return t(
                    'teenology:diagnostic.errors.server_timeout',
                    'Сервер не ответил вовремя. Проверьте сеть и попробуйте ещё раз.'
                );
            }
            if (reason === 'server_unreachable') {
                return t(
                    'teenology:diagnostic.errors.server_unreachable',
                    'Не удалось связаться с сервером теста.'
                );
            }
            if (reason === 'no_connection') {
                return t(
                    'teenology:diagnostic.errors.no_connection',
                    'Нет связи с сервером тестирования.'
                );
            }
            return '';
        }

        async function applyStartResult(result, callbacks) {
            var action = callbacks || {};
            var res = result || {};
            var data = res.data || {};
            if (res.rateLimited) {
                if (typeof action.onRateLimited === 'function') {
                    await action.onRateLimited(res);
                }
                return { ok: false, status: 'rate_limited', data: data };
            }
            if (!res.ok || !data.test_id) {
                if (typeof action.onFailure === 'function') {
                    await action.onFailure(res);
                }
                return { ok: false, status: 'failed', data: data };
            }
            if (typeof action.onSuccess === 'function') {
                await action.onSuccess(data, res);
            }
            return { ok: true, status: 'success', data: data };
        }

        async function convertTest(testId, options) {
            var opts = options || {};
            var r = await rt.api.convert(testId, {
                host: rt.host,
                auth: opts.auth,
            });
            var data = await r.json().catch(function () { return {}; });
            return {
                ok: !!r.ok,
                status: r.status,
                data: data,
            };
        }

        async function ensureConvertAndUnlock() {
            var tok = typeof cb.getAuthToken === 'function' ? String(cb.getAuthToken() || '').trim() : '';
            if (!tok) {
                if (typeof cb.openSaveReportModal === 'function') cb.openSaveReportModal();
                toast(t(
                    'teenology:diagnostic.errors.save_email_hint',
                    'Сохраните результат с email — так откроется чат и бот запомнит профиль.',
                ));
                return false;
            }
            if (typeof cb.setAuthToken === 'function') cb.setAuthToken(tok);

            var testId = typeof cb.getCurrentTestId === 'function' ? String(cb.getCurrentTestId() || '').trim() : '';
            if (!testId && rt.store && typeof rt.store.readTestId === 'function') {
                testId = rt.store.readTestId();
            }
            if (!testId) {
                toast(t('teenology:diagnostic.errors.complete_first', 'Сначала завершите тест.'));
                return false;
            }

            try {
                var result = await convertTest(testId);
                if (!result.ok && result.status !== 404) {
                    toast((result.data && result.data.error) || 'Не удалось зафиксировать результат для чата.');
                    return false;
                }
            } catch (_) {
                toast(t('teenology:diagnostic.errors.finalize_connection', 'Нет связи. Повторите чуть позже.'));
                return false;
            }

            if (typeof cb.refreshSubscriptionStatus === 'function') {
                await cb.refreshSubscriptionStatus();
            }
            return true;
        }

        async function openChatFromBridge() {
            if (!feature('bridgeContextToChat')) return false;
            var ok = await ensureConvertAndUnlock();
            if (!ok) return false;

            var bridgeMsg = rt.bridge && typeof rt.bridge.buildMessage === 'function'
                ? rt.bridge.buildMessage()
                : '';
            if (!bridgeMsg) {
                toast(t(
                    'teenology:diagnostic.errors.no_test_data',
                    'Нет данных теста. Обновите страницу или пройдите его заново.',
                ));
                return false;
            }

            if (typeof cb.enterChatWithBridge === 'function') {
                await cb.enterChatWithBridge(bridgeMsg);
            }
            return true;
        }

        async function submitAnswer(testId, answer) {
            var r = await rt.api.answer(testId, answer, { host: rt.host });
            var data = await r.json().catch(function () { return {}; });
            return {
                ok: !!r.ok,
                status: r.status,
                data: data,
            };
        }

        async function registerLite(payload, options) {
            var opts = options || {};
            var host = rt.host || {};
            var api = host.api || {};
            var helpers = rt.helpers || diagnostic.helpers || {};
            var url = typeof api.url === 'function'
                ? api.url('/api/auth/register-lite')
                : '/api/auth/register-lite';
            var fetcher = typeof api.fetchTimeout === 'function'
                ? api.fetchTimeout
                : function (resource, init) { return fetch(resource, init); };
            var r = await fetcher(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload || {}),
            }, opts.timeoutMs);
            var data = await r.json().catch(function () { return {}; });
            var parsed = helpers && typeof helpers.parseRegisterLiteResponse === 'function'
                ? helpers.parseRegisterLiteResponse(data)
                : {
                    accessToken: String((data && data.access_token) || '').trim(),
                    userId: String((data && data.user_id) || '').trim(),
                    error: data && data.error,
                };
            return {
                ok: !!r.ok,
                status: r.status,
                data: data,
                parsed: parsed,
            };
        }

        async function finalizeTest(testId) {
            var r = await rt.api.finalize(testId, { host: rt.host });
            var data = await r.json().catch(function () { return {}; });
            return {
                ok: !!r.ok,
                status: r.status,
                data: data,
            };
        }

        async function applyAnswerResult(answerData, callbacks) {
            var action = callbacks || {};
            var helpers = rt.helpers || diagnostic.helpers || {};
            var model = helpers && typeof helpers.buildAnswerResultModel === 'function'
                ? helpers.buildAnswerResultModel(answerData, {
                    prefersReducedMotion: action.prefersReducedMotion,
                    reducedMotion: action.reducedMotion,
                })
                : { answerData: answerData || {}, hasQuestion: false, done: false };

            if (model.hasQuestion) {
                if (model.instantPath) {
                    if (typeof action.onInstantQuestion === 'function') {
                        await action.onInstantQuestion(model);
                    }
                    return true;
                }
                if (typeof action.onAnimatedQuestion === 'function') {
                    await action.onAnimatedQuestion(model);
                }
                return true;
            }

            if (model.done) {
                if (typeof action.onDone === 'function') {
                    await action.onDone(model);
                }
                return true;
            }

            if (typeof action.onUnhandled === 'function') {
                return !!(await action.onUnhandled(model));
            }
            return false;
        }

        async function applyRegisterLiteSuccess(parsed, callbacks) {
            var action = callbacks || {};
            var p = parsed || {};
            if (typeof action.setAuthSession === 'function') {
                await action.setAuthSession(p);
            }
            if (typeof action.syncAttribution === 'function') {
                await action.syncAttribution(p);
            }
            if (typeof action.markOnboardingDone === 'function') {
                await action.markOnboardingDone(p);
            }
            if (typeof action.convertCurrentTest === 'function') {
                await action.convertCurrentTest(p);
            }
            if (typeof action.clearDiagnosticReport === 'function') {
                await action.clearDiagnosticReport(p);
            }
            if (typeof action.pullLocale === 'function') {
                await action.pullLocale(p);
            }
            if (typeof action.scheduleInstallExplainer === 'function') {
                await action.scheduleInstallExplainer(p);
            }
            return true;
        }

        async function applySaveReportSubmitSuccess(callbacks) {
            var action = callbacks || {};
            if (typeof action.closeModal === 'function') {
                await action.closeModal();
            }
            if (typeof action.closeDiagnosticScreen === 'function') {
                await action.closeDiagnosticScreen();
            }
            if (typeof action.clearDiagnosticReport === 'function') {
                await action.clearDiagnosticReport();
            }
            if (typeof action.openConversionPaywall === 'function') {
                await action.openConversionPaywall();
            }
            if (typeof action.markUserInitiatedStart === 'function') {
                await action.markUserInitiatedStart();
            }
            if (typeof action.startSignupChat === 'function') {
                await action.startSignupChat();
            }
            return true;
        }

        return {
            applyAnswerResult: applyAnswerResult,
            applyRegisterLiteSuccess: applyRegisterLiteSuccess,
            applySaveReportSubmitSuccess: applySaveReportSubmitSuccess,
            applyStartResult: applyStartResult,
            captchaMode: captchaMode,
            convertTest: convertTest,
            ensureConvertAndUnlock: ensureConvertAndUnlock,
            finalizeTest: finalizeTest,
            openChatFromBridge: openChatFromBridge,
            registerLite: registerLite,
            startGuardMessage: startGuardMessage,
            startFailureMessage: startFailureMessage,
            startRuntimeMessage: startRuntimeMessage,
            startTest: startTest,
            submitAnswer: submitAnswer,
            on: noop,
        };
    }

    diagnostic.createController = createController;
})(typeof window !== 'undefined' ? window : this);
