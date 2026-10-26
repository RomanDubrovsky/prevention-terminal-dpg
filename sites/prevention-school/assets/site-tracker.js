/**
 * Zero-PII Site Tracker & Compliance Loader
 * Telemetry has been migrated to Yandex Cloud / Yandex Metrika.
 */
(function() {
  if (typeof document !== 'undefined' && !document.getElementById('legal-framework-styles')) {
    var s = document.createElement('script');
    s.src = '/assets/legal-banner.js';
    s.defer = true;
    document.head.appendChild(s);
  }
})();
