/**
 * Legal Banner & Consent Modal System
 * Compliance with 152-FZ (Russian Federal Law on Personal Data)
 */
(function() {
  'use strict';

  var COOKIE_KEY = 'cookie_consent_v1';

  function isConsentAccepted() {
    try {
      if (localStorage.getItem(COOKIE_KEY) === 'accepted') return true;
      if (localStorage.getItem('pn_cookie_consent_v1') === 'accepted' || localStorage.getItem('pn_cookie_consent_v1') === 'rejected') return true;
    } catch (e) {}
    try {
      if (document.cookie && document.cookie.indexOf(COOKIE_KEY + '=accepted') !== -1) return true;
      if (document.cookie && document.cookie.indexOf('pn_cookie_consent_v1=') !== -1) return true;
    } catch (e) {}
    return false;
  }

  function markConsentAccepted() {
    try {
      localStorage.setItem(COOKIE_KEY, 'accepted');
    } catch (e) {}
    try {
      document.cookie = COOKIE_KEY + '=accepted; path=/; max-age=31536000; SameSite=Lax';
    } catch (e) {}
  }

  function isIdaSite() {
    var host = (window.location.hostname || '').toLowerCase();
    var title = (document.title || '').toLowerCase();
    return host.indexOf('ida') !== -1 || title.indexOf('ida') !== -1;
  }

  function getBaseLegalPath(slug) {
    var path = window.location.pathname || '';
    if (path.indexOf('/ru/') === 0) {
      return '/ru/' + slug + '/';
    }
    return '/' + slug + '/';
  }

  function injectStyles() {
    if (document.getElementById('legal-framework-styles')) return;

    var css = `
      .legal-cookie-banner {
        position: fixed;
        bottom: 18px;
        left: 50%;
        transform: translateX(-50%) translateY(120%);
        width: min(880px, calc(100% - 24px));
        background: rgba(15, 23, 42, 0.95);
        color: #f8fafc;
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 16px 48px -8px rgba(0, 0, 0, 0.45);
        border-radius: 14px;
        padding: 14px 20px;
        z-index: 2147483640;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
        opacity: 0;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-sizing: border-box;
      }
      .legal-cookie-banner.visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      .legal-cookie-content {
        font-size: 0.86rem;
        line-height: 1.5;
        color: #e2e8f0;
        flex: 1;
      }
      .legal-cookie-content a {
        color: #38bdf8;
        text-decoration: underline;
        font-weight: 500;
        transition: color 0.15s;
      }
      .legal-cookie-content a:hover {
        color: #7dd3fc;
      }
      .legal-cookie-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .legal-cookie-btn {
        background: #0f766e;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 8px 20px;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s, transform 0.1s;
        white-space: nowrap;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .legal-cookie-btn:hover {
        background: #0d9488;
      }
      .legal-cookie-btn:active {
        transform: scale(0.97);
      }
      .legal-cookie-close-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 1.25rem;
        line-height: 1;
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s, background-color 0.15s;
      }
      .legal-cookie-close-btn:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.1);
      }
      @media (max-width: 680px) {
        .legal-cookie-banner {
          flex-direction: column;
          align-items: stretch;
          bottom: 10px;
          padding: 14px 16px;
          gap: 12px;
          width: calc(100% - 16px);
        }
        .legal-cookie-actions {
          justify-content: flex-end;
        }
        .legal-cookie-btn {
          width: 100%;
          text-align: center;
          padding: 10px 16px;
        }
      }

      /* Legal Modal Overlay */
      .legal-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 2147483645;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.25s ease, visibility 0.25s ease;
      }
      .legal-modal-backdrop.active {
        opacity: 1;
        visibility: visible;
      }
      .legal-modal-dialog {
        background: #ffffff;
        color: #1f2937;
        width: min(720px, 100%);
        max-height: 85vh;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transform: scale(0.95);
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      html[data-theme="dark"] .legal-modal-dialog {
        background: #111827;
        color: #f3f4f6;
        border: 1px solid #374151;
      }
      .legal-modal-backdrop.active .legal-modal-dialog {
        transform: scale(1);
      }
      .legal-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 24px;
        border-bottom: 1px solid #e5e7eb;
      }
      html[data-theme="dark"] .legal-modal-header {
        border-bottom-color: #1f2937;
      }
      .legal-modal-header h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
      }
      .legal-modal-close {
        background: transparent;
        border: none;
        color: #6b7280;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: color 0.15s, background-color 0.15s;
      }
      .legal-modal-close:hover {
        color: #111827;
        background-color: #f3f4f6;
      }
      html[data-theme="dark"] .legal-modal-close:hover {
        color: #f9fafb;
        background-color: #1f2937;
      }
      .legal-modal-body {
        padding: 20px 24px;
        overflow-y: auto;
        font-size: 0.9rem;
        line-height: 1.65;
        color: #374151;
      }
      html[data-theme="dark"] .legal-modal-body {
        color: #d1d5db;
      }
      .legal-modal-body h4 {
        margin: 16px 0 8px;
        font-size: 0.98rem;
        font-weight: 600;
        color: #111827;
      }
      html[data-theme="dark"] .legal-modal-body h4 {
        color: #f9fafb;
      }
      .legal-modal-body p {
        margin: 0 0 12px;
      }
      .legal-modal-body ul {
        margin: 0 0 14px;
        padding-left: 20px;
      }
      .legal-modal-body li {
        margin-bottom: 6px;
      }
      .legal-modal-footer {
        padding: 14px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        background: #f9fafb;
      }
      html[data-theme="dark"] .legal-modal-footer {
        background: #0f172a;
        border-top-color: #1f2937;
      }
      .legal-modal-btn-primary {
        background: #0f766e;
        color: #ffffff;
        border: none;
        border-radius: 8px;
        padding: 9px 20px;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
      }
      .legal-modal-btn-primary:hover {
        background: #0d9488;
      }
      .legal-modal-btn-link {
        color: #6b7280;
        background: none;
        border: none;
        text-decoration: underline;
        font-size: 0.85rem;
        cursor: pointer;
        padding: 9px 12px;
      }
      .legal-modal-btn-link:hover {
        color: #111827;
      }
      html[data-theme="dark"] .legal-modal-btn-link {
        color: #9ca3af;
      }
      html[data-theme="dark"] .legal-modal-btn-link:hover {
        color: #f3f4f6;
      }
    `;

    var styleEl = document.createElement('style');
    styleEl.id = 'legal-framework-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function initCookieBanner() {
    if (isConsentAccepted()) return;
    if (document.querySelector('.legal-cookie-banner') || document.getElementById('pn-cookie-banner')) return;

    var privacyUrl = getBaseLegalPath('privacy');
    var cookiesUrl = getBaseLegalPath('cookies');

    var banner = document.createElement('div');
    banner.className = 'legal-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Уведомление об использовании файлов cookie');

    banner.innerHTML = `
      <div class="legal-cookie-content">
        Мы используем файлы cookie и сервисы веб-аналитики для корректной работы сайта.
        Оставаясь на сайте, вы соглашаетесь с <a href="${privacyUrl}" target="_blank" rel="noopener noreferrer">Политикой конфиденциальности</a> и <a href="${cookiesUrl}" target="_blank" rel="noopener noreferrer">Политикой использования cookie</a>.
      </div>
      <div class="legal-cookie-actions">
        <button type="button" class="legal-cookie-btn" id="legal-cookie-accept-btn">Понятно</button>
        <button type="button" class="legal-cookie-close-btn" id="legal-cookie-close-btn" aria-label="Закрыть уведомление">&times;</button>
      </div>
    `;

    document.body.appendChild(banner);

    // Trigger animation
    requestAnimationFrame(function() {
      banner.classList.add('visible');
    });

    function dismissBanner(e) {
      if (e) {
        try {
          e.preventDefault();
          e.stopPropagation();
        } catch (_) {}
      }
      markConsentAccepted();
      banner.classList.remove('visible');
      banner.style.pointerEvents = 'none';
      setTimeout(function() {
        if (banner.parentNode) {
          banner.parentNode.removeChild(banner);
        }
      }, 300);
    }

    var acceptBtn = banner.querySelector('#legal-cookie-accept-btn');
    var closeBtn = banner.querySelector('#legal-cookie-close-btn');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', dismissBanner);
      acceptBtn.addEventListener('touchend', dismissBanner);
      acceptBtn.onclick = dismissBanner;
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', dismissBanner);
      closeBtn.addEventListener('touchend', dismissBanner);
      closeBtn.onclick = dismissBanner;
    }
  }

  // Global delegated click capture to guarantee dismissal even if other scripts stop propagation
  document.addEventListener('click', function(e) {
    if (e.target && (e.target.closest('#legal-cookie-accept-btn') || e.target.closest('#legal-cookie-close-btn') || e.target.closest('.legal-cookie-btn') || e.target.closest('.legal-cookie-close-btn'))) {
      markConsentAccepted();
      var b = document.querySelector('.legal-cookie-banner');
      if (b) {
        b.classList.remove('visible');
        b.style.pointerEvents = 'none';
        setTimeout(function() {
          if (b.parentNode) b.parentNode.removeChild(b);
        }, 300);
      }
    }
  }, true);

  function getConsentModalHtml(isIda) {
    var brandName = isIda ? 'IDA Psy' : 'Профилактика-AI';
    var operatorEmail = isIda ? 'admin@ida-psy.ru' : 'admin@prevention-ai.ru';
    var consentUrl = getBaseLegalPath('consent');

    return `
      <div class="legal-modal-dialog" role="dialog" aria-labelledby="legal-modal-title" aria-modal="true">
        <div class="legal-modal-header">
          <h3 id="legal-modal-title">Согласие на обработку персональных данных</h3>
          <button type="button" class="legal-modal-close" aria-label="Закрыть">&times;</button>
        </div>
        <div class="legal-modal-body">
          <p>В соответствии со статьей 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных», свободно, своей волей и в своем интересе я даю согласие Оператору платформы <strong>${brandName}</strong> на обработку моих персональных данных со следующими условиями:</p>

          <h4>1. Перечень обрабатываемых данных</h4>
          <ul>
            <li>Фамилия, имя, отчество (ФИО);</li>
            <li>Контактный номер телефона;</li>
            <li>Адрес электронной почты (E-mail);</li>
            <li>Сведения о месте работы / организации, должности и специализации;</li>
            <li>Сведения об образовании, квалификации и профессиональном стаже (при заполнении анкеты специалиста);</li>
            <li>Технические данные: IP-адрес, тип устройства, сессионные файлы cookie и данные веб-аналитики.</li>
          </ul>

          <h4>2. Цели обработки</h4>
          <ul>
            <li>Обработка входящих обращений, заявок на подключение, тестирование и пилотное внедрение платформы;</li>
            <li>Включение в реестр специалистов и аккредитация в системе ${brandName};</li>
            <li>Предоставление доступа к электронным рабочим местам и терминалам платформы;</li>
            <li>Техническая и методическая поддержка пользователей;</li>
            <li>Анализ эффективности работы сервиса и сбор агрегированной статистики без раскрытия клиентской тайны.</li>
          </ul>

          <h4>3. Гарантия локализации и конфиденциальности</h4>
          <p>Обработка и хранение персональных данных осуществляются с использованием защищенных сертифицированных баз данных в строгом соответствии с требованиями законодательства РФ (ст. 18 ч. 5 152-ФЗ).</p>
          <p>${isIda ? '<strong>Архитектура Zero-PII:</strong> Персональные данные клиентов и протоколы терапевтических сессий хранятся локально в зашифрованном виде на ПК специалиста и не передаются на серверы платформы.' : '<strong>Защита тайны:</strong> Персональные данные учащихся хранятся в защищенном локальном сейфе образовательной организации и изолированы от публичного контура.'}</p>

          <h4>4. Срок действия и порядок отзыва</h4>
          <p>Согласие действует с момента его предоставления до достижения целей обработки либо до момента его отзыва. Согласие может быть отозвано в любой момент путем направления письменного заявления на e-mail: <strong>${operatorEmail}</strong> с темой «Отзыв согласия на обработку персональных данных».</p>
        </div>
        <div class="legal-modal-footer">
          <a href="${consentUrl}" class="legal-modal-btn-link" target="_blank" rel="noopener noreferrer">Открыть страницу целиком</a>
          <button type="button" class="legal-modal-btn-primary legal-modal-ok-btn">Ознакомлен(а)</button>
        </div>
      </div>
    `;
  }

  function initConsentModal() {
    var modalBackdrop = null;

    function openModal() {
      if (!modalBackdrop) {
        modalBackdrop = document.createElement('div');
        modalBackdrop.className = 'legal-modal-backdrop';
        modalBackdrop.innerHTML = getConsentModalHtml(isIdaSite());
        document.body.appendChild(modalBackdrop);

        var closeBtn = modalBackdrop.querySelector('.legal-modal-close');
        var okBtn = modalBackdrop.querySelector('.legal-modal-ok-btn');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (okBtn) okBtn.addEventListener('click', closeModal);

        modalBackdrop.addEventListener('click', function(e) {
          if (e.target === modalBackdrop) {
            closeModal();
          }
        });

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && modalBackdrop.classList.contains('active')) {
            closeModal();
          }
        });
      }

      requestAnimationFrame(function() {
        modalBackdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    function closeModal() {
      if (modalBackdrop) {
        modalBackdrop.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    // Intercept clicks on links that trigger consent modal
    document.addEventListener('click', function(e) {
      var target = e.target.closest('[data-legal-modal="consent"]');
      if (target) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        openModal();
      }
    });
  }

  function init() {
    injectStyles();
    initCookieBanner();
    initConsentModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
