(function () {
    'use strict';

    var STORAGE_KEY = 'ida_portal_setup_token';
    var API_BASE = document.querySelector('meta[name="app-api-base"]')?.getAttribute('content') || 'https://api.prevention.school';

    function getSetupToken() {
        return localStorage.getItem(STORAGE_KEY) || '';
    }

    function setSetupToken(token) {
        if (!token) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, token);
        }
    }

    function checkAuth() {
        var token = getSetupToken();
        var isLoginPage = window.location.pathname.endsWith('/portal/') || window.location.pathname.endsWith('/portal/index.html');
        
        if (!token && !isLoginPage) {
            window.location.href = '/portal/';
            return;
        }

        if (token) {
            // Verify session
            fetch(API_BASE + '/api/ida/centers/session?setup_token=' + encodeURIComponent(token))
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (!d.ok || !d.center) {
                        setSetupToken('');
                        if (!isLoginPage) window.location.href = '/portal/';
                    } else {
                        // Store center info
                        sessionStorage.setItem('ida_center_id', d.center.center_id || '');
                        sessionStorage.setItem('ida_center_name', d.center.display_name || '');
                        if (isLoginPage) window.location.href = '/portal/inbox.html';
                        updateHeader(d.center);
                    }
                })
                .catch(function () {
                    // Network issue, keep token for now but allow offline bypass
                });
        }
    }

    function updateHeader(center) {
        var el = document.getElementById('sw-center-name');
        if (el && center) {
            el.textContent = center.display_name || 'Личный кабинет';
        }
    }

    function logout() {
        setSetupToken('');
        sessionStorage.clear();
        window.location.href = '/portal/';
    }

    // Export helpers globally
    window.IDA_AUTH = {
        getSetupToken: getSetupToken,
        setSetupToken: setSetupToken,
        checkAuth: checkAuth,
        logout: logout,
        API_BASE: API_BASE
    };

    // Run auth check automatically
    if (typeof window !== 'undefined') {
        document.addEventListener('DOMContentLoaded', checkAuth);
    }
})();
