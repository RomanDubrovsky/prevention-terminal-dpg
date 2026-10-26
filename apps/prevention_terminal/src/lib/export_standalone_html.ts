/**
 * Генератор автономного HTML-сайта школы / института психологии.
 * 
 * Создаёт 100% независимый, самодостаточный HTML5-файл (без внешних зависимостей/CDN),
 * который можно:
 * 1. Открыть прямо с любого диска ПК (двойным кликом) без подключения к интернету.
 * 2. Загрузить на любой хостинг (Beget, Timeweb, Reg.ru, GitHub Pages, Netlify, VPS) как index.html.
 * 3. Передать клиентам или сохранить на флешку как вечную гарантию сохранности сайта.
 */

import type { SchoolSiteSettings, SitePage } from "./site_pages_store.ts";
import type { CreatorCourse } from "./course_students_store.ts";
import type { WebinarItem } from "./webinars_store.ts";

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateStandaloneSchoolHtml(params: {
  settings: SchoolSiteSettings;
  courses: CreatorCourse[];
  webinars: WebinarItem[];
  pages?: SitePage[];
}): string {
  const { settings, courses = [], webinars = [], pages = [] } = params;

  const schoolName = settings.schoolName || "Академия практической психологии";
  const schoolTagline = settings.schoolTagline || "Прикладное образование и супервизии для специалистов помогающих профессий";
  const schoolLogo = settings.schoolLogoEmoji || "🏛️";
  const primaryColor = settings.primaryAccentColor || "#0f766e";
  const email = settings.contactEmail || "info@example.com";
  const phone = settings.contactPhone || "";
  const telegram = settings.telegramUrl || "";
  const inn = settings.inn || "";
  const ogrn = settings.ogrn || "";
  const paymentGateway = settings.paymentGateway || "ЮKassa / Банковский перевод (СБП)";

  // Legal texts
  const ofertaPage = pages.find((p) => p.slug === "oferta" || p.id === "page-oferta");
  const privacyPage = pages.find((p) => p.slug === "personaldata" || p.id === "page-personaldata");
  const consentPage = pages.find((p) => p.slug === "consent" || p.id === "page-consent");

  const ofertaText = ofertaPage?.blocks?.[0]?.content || 
    `Публичная оферта на оказание информационно-консультационных и образовательных услуг.\nИсполнитель: ${schoolName}, ИНН: ${inn}, ОГРН: ${ogrn}.\nEmail: ${email}, Телефон: ${phone}.\nОплата услуг подтверждает полное и безоговорочное согласие с условиями оферты.`;

  const privacyText = privacyPage?.blocks?.[0]?.content ||
    `Политика обработки персональных данных (Федеральный закон № 152-ФЗ).\nОператор: ${schoolName}.\nЦель сбора данных — исполнение образовательного договора, обратная связь и предоставление доступа к учебным материалам. Данные не передаются третьим лицам без согласия.`;

  const consentText = consentPage?.blocks?.[0]?.content ||
    `Согласие на обработку персональных данных.\nНастоящим субъект персональных данных даёт согласие ${schoolName} на обработку предоставленных сведений в соответствии с требованиями 152-ФЗ.`;

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(schoolName)} — Официальный сайт</title>
  <meta name="description" content="${escapeHtml(schoolTagline)}">
  <style>
    :root {
      --primary: ${primaryColor};
      --primary-hover: #0d5f57;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --accent-soft: #f0fdfa;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
      --shadow-md: 0 4px 14px rgba(0,0,0,0.08);
      --shadow-lg: 0 12px 28px rgba(0,0,0,0.12);
      --radius: 12px;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    a {
      color: var(--primary);
      text-decoration: none;
    }
    header {
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 800;
      font-size: 1.15rem;
      color: var(--text);
      text-decoration: none;
    }
    .logo-badge {
      font-size: 1.8rem;
      line-height: 1;
    }
    nav {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    nav a {
      font-size: 0.92rem;
      font-weight: 600;
      color: var(--text-muted);
      transition: color 0.15s;
    }
    nav a:hover {
      color: var(--primary);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: var(--radius);
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25);
    }
    .btn-primary:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: transparent;
      border: 1.5px solid var(--border);
      color: var(--text);
    }
    .btn-outline:hover {
      border-color: var(--primary);
      color: var(--primary);
    }
    .hero {
      background: linear-gradient(180deg, #f0fdfa 0%, var(--bg) 100%);
      padding: 60px 20px 50px;
      text-align: center;
    }
    .hero-container {
      max-width: 860px;
      margin: 0 auto;
    }
    .hero-badge {
      display: inline-block;
      padding: 5px 14px;
      border-radius: 999px;
      background: #ccfbf1;
      color: var(--primary);
      font-size: 0.82rem;
      font-weight: 800;
      margin-bottom: 16px;
    }
    .hero h1 {
      font-size: 2.5rem;
      font-weight: 900;
      line-height: 1.25;
      margin-bottom: 16px;
      color: var(--text);
    }
    .hero p {
      font-size: 1.15rem;
      color: var(--text-muted);
      margin-bottom: 28px;
      max-width: 740px;
      margin-left: auto;
      margin-right: auto;
    }
    .hero-actions {
      display: flex;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 50px 20px;
    }
    .section-title-wrap {
      text-align: center;
      margin-bottom: 36px;
    }
    .section-title {
      font-size: 1.85rem;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .section-subtitle {
      font-size: 1rem;
      color: var(--text-muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 24px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .card-badge {
      display: inline-block;
      align-self: flex-start;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--accent-soft);
      color: var(--primary);
      font-size: 0.76rem;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .card-title {
      font-size: 1.25rem;
      font-weight: 800;
      margin-bottom: 10px;
      line-height: 1.35;
    }
    .card-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      margin-bottom: 16px;
      flex-grow: 1;
    }
    .card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border);
      padding-top: 14px;
      margin-top: 10px;
    }
    .card-price {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--primary);
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }
    .feature-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 22px;
      box-shadow: var(--shadow-sm);
    }
    .feature-icon {
      font-size: 2rem;
      margin-bottom: 12px;
    }
    .feature-title {
      font-size: 1.05rem;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .feature-desc {
      font-size: 0.88rem;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .contacts-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 32px;
      box-shadow: var(--shadow-md);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }
    @media (max-width: 768px) {
      .contacts-box {
        grid-template-columns: 1fr;
      }
      .hero h1 {
        font-size: 1.9rem;
      }
      nav {
        display: none;
      }
    }
    .contact-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }
    .contact-icon {
      font-size: 1.3rem;
      line-height: 1;
    }
    .contact-label {
      font-size: 0.76rem;
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
    }
    .contact-val {
      font-size: 0.98rem;
      font-weight: 700;
      color: var(--text);
    }
    footer {
      background: #0f172a;
      color: #94a3b8;
      padding: 40px 20px 30px;
      font-size: 0.86rem;
    }
    .footer-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .footer-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 20px;
    }
    .footer-links {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .footer-links a {
      color: #cbd5e1;
      font-size: 0.82rem;
      cursor: pointer;
    }
    .footer-links a:hover {
      color: #ffffff;
      text-decoration: underline;
    }
    /* Modal */
    .modal-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal-backdrop.active {
      display: flex;
    }
    .modal-card {
      background: #ffffff;
      border-radius: var(--radius);
      max-width: 650px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      padding: 28px;
      box-shadow: var(--shadow-lg);
      position: relative;
    }
    .modal-close {
      position: absolute;
      top: 18px;
      right: 18px;
      font-size: 1.4rem;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-muted);
    }
  </style>
</head>
<body>

  <!-- Шапка сайта -->
  <header>
    <div class="header-container">
      <a href="#" class="logo">
        <span class="logo-badge">${escapeHtml(schoolLogo)}</span>
        <div>
          <div>${escapeHtml(schoolName)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">${escapeHtml(schoolTagline)}</div>
        </div>
      </a>

      <nav>
        <a href="#courses">Курсы и программы</a>
        ${webinars.length > 0 ? `<a href="#webinars">Вебинары</a>` : ""}
        <a href="#advantages">Преимущества</a>
        <a href="#contacts">Контакты</a>
        <button type="button" class="btn btn-outline" onclick="openStudentModal()" style="padding: 7px 14px; font-size: 0.82rem;">
          🔑 Вход для слушателей
        </button>
      </nav>
    </div>
  </header>

  <!-- Главный баннер (Hero) -->
  <section class="hero">
    <div class="hero-container">
      <div class="hero-badge">🎓 Набор на программы открыт</div>
      <h1>${escapeHtml(schoolName)}</h1>
      <p>${escapeHtml(schoolTagline)}</p>
      <div class="hero-actions">
        <a href="#courses" class="btn btn-primary">📚 Смотреть программы обучения</a>
        <a href="#contacts" class="btn btn-outline">📞 Связаться с институтом</a>
      </div>
    </div>
  </section>

  <!-- Блок: Программы и курсы -->
  <section id="courses" class="container">
    <div class="section-title-wrap">
      <h2 class="section-title">Образовательные программы и курсы</h2>
      <p class="section-subtitle">Практические протоколы, живые супервизии и удостоверения установленного образца</p>
    </div>

    ${courses.length === 0 ? `
      <div style="text-align: center; padding: 40px; background: #fff; border-radius: 12px; border: 1px dashed var(--border); color: var(--text-muted);">
        Программы сейчас формируются преподавательским составом. Обратитесь в приёмную комиссию для предзаписи.
      </div>
    ` : `
      <div class="grid">
        ${courses.map((course) => {
          const lessonCount = course.lessons?.length || 0;
          const priceText = course.price ? (course.price.toLocaleString("ru-RU") + " ₽") : "По запросу";
          const duration = course.durationWeeks ? (course.durationWeeks + " нед.") : "Практический курс";
          return `
          <div class="card">
            <div>
              <div class="card-badge">⏳ ${escapeHtml(duration)} · 📖 ${lessonCount} уроков</div>
              <h3 class="card-title">${escapeHtml(course.title)}</h3>
              <p class="card-desc">${escapeHtml(course.description || "Комплексная программа подготовки и практической отработки методологии.")}</p>
            </div>
            <div>
              <div class="card-meta">
                <div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">Стоимость обучения:</div>
                  <div class="card-price">${escapeHtml(priceText)}</div>
                </div>
                <button type="button" class="btn btn-primary" onclick="openEnrollModal('${escapeHtml(course.title)}')" style="padding: 8px 14px; font-size: 0.84rem;">
                  Записаться
                </button>
              </div>
            </div>
          </div>
          `;
        }).join("")}
      </div>
    `}
  </section>

  ${webinars.length > 0 ? `
  <!-- Блок: Расписание вебинаров -->
  <section id="webinars" class="container" style="padding-top: 0;">
    <div class="section-title-wrap">
      <h2 class="section-title">🎙️ Живые вебинары и мастер-классы</h2>
      <p class="section-subtitle">Открытые разборы кейсов, супервизии и лекции экспертов</p>
    </div>
    <div class="grid">
      ${webinars.map((webinar) => {
        const cost = webinar.price ? (webinar.price.toLocaleString("ru-RU") + " ₽") : "Бесплатно";
        return `
        <div class="card">
          <div>
            <div class="card-badge">📅 ${escapeHtml(webinar.scheduledDate || "Скоро")} · 🕒 ${escapeHtml(webinar.scheduledTime || "19:00")}</div>
            <h3 class="card-title">${escapeHtml(webinar.title)}</h3>
            <p class="card-desc">${escapeHtml(webinar.description || "Интерактивный мастер-класс с практической демонстрацией методик.")}</p>
            ${webinar.speakerName ? `<div style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 12px;">Спикер: ${escapeHtml(webinar.speakerName)}</div>` : ""}
          </div>
          <div class="card-meta">
            <div class="card-price">${escapeHtml(cost)}</div>
            <button type="button" class="btn btn-primary" onclick="openEnrollModal('Вебинар: ${escapeHtml(webinar.title)}')" style="padding: 8px 14px; font-size: 0.84rem;">
              Участвовать
            </button>
          </div>
        </div>
        `;
      }).join("")}
    </div>
  </section>
  ` : ""}

  <!-- Блок: Преимущества института -->
  <section id="advantages" class="container" style="background: var(--card-bg); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); max-width: 100%;">
    <div style="max-width: 1200px; margin: 0 auto;">
      <div class="section-title-wrap">
        <h2 class="section-title">Почему выбирают наш институт</h2>
        <p class="section-subtitle">Современные стандарты психологической практики без схоластики и лишней теории</p>
      </div>

      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">🤝</div>
          <h3 class="feature-title">Практические протоколы</h3>
          <p class="feature-desc">Готовые пошаговые алгоритмы первой встречи, формулирования терапевтического контракта и техник быстрой стабилизации.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">👥</div>
          <h3 class="feature-title">Живые супервизии</h3>
          <p class="feature-desc">Регулярные разборы реальных клиентских случаев под руководством аккредитованных супервизоров.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">📜</div>
          <h3 class="feature-title">Официальные документы</h3>
          <p class="feature-desc">Удостоверения о повышении квалификации установленного образца с защищённым QR-кодом для проверки подлинности.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">💻</div>
          <h3 class="feature-title">Удобная платформа</h3>
          <p class="feature-desc">Доступ к материалам с любого устройства, домашние задания с проверкой и закрытый чат для профессионального обмена.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Блок: Контакты и реквизиты -->
  <section id="contacts" class="container">
    <div class="section-title-wrap">
      <h2 class="section-title">Контакты и приёмная комиссия</h2>
      <p class="section-subtitle">Ответим на любые вопросы о зачислении, рассрочке и программе обучения</p>
    </div>

    <div class="contacts-box">
      <div>
        <h3 style="font-size: 1.25rem; font-weight: 800; margin-bottom: 20px;">Свяжитесь с нами напрямую:</h3>
        
        ${email ? `
        <div class="contact-item">
          <span class="contact-icon">✉️</span>
          <div>
            <div class="contact-label">Электронная почта</div>
            <a href="mailto:${escapeHtml(email)}" class="contact-val">${escapeHtml(email)}</a>
          </div>
        </div>
        ` : ""}

        ${phone ? `
        <div class="contact-item">
          <span class="contact-icon">📞</span>
          <div>
            <div class="contact-label">Телефон приёмной</div>
            <a href="tel:${escapeHtml(phone)}" class="contact-val">${escapeHtml(phone)}</a>
          </div>
        </div>
        ` : ""}

        ${telegram ? `
        <div class="contact-item">
          <span class="contact-icon">💬</span>
          <div>
            <div class="contact-label">Telegram-канал / Бот</div>
            <a href="${escapeHtml(telegram)}" target="_blank" rel="noopener" class="contact-val">Открыть диалог в Telegram</a>
          </div>
        </div>
        ` : ""}

        <div class="contact-item">
          <span class="contact-icon">💳</span>
          <div>
            <div class="contact-label">Оплата и эквайринг</div>
            <div class="contact-val" style="font-size: 0.88rem; font-weight: 600;">${escapeHtml(paymentGateway)}</div>
          </div>
        </div>
      </div>

      <div style="background: var(--bg); padding: 24px; border-radius: var(--radius); border: 1px solid var(--border);">
        <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 14px;">Юридические реквизиты:</h3>
        <p style="font-size: 0.88rem; margin-bottom: 8px;"><b>Организация:</b> ${escapeHtml(schoolName)}</p>
        ${inn ? `<p style="font-size: 0.88rem; margin-bottom: 8px;"><b>ИНН:</b> ${escapeHtml(inn)}</p>` : ""}
        ${ogrn ? `<p style="font-size: 0.88rem; margin-bottom: 8px;"><b>ОГРН:</b> ${escapeHtml(ogrn)}</p>` : ""}
        <p style="font-size: 0.84rem; color: var(--text-muted); margin-top: 14px; line-height: 1.45;">
          Деятельность осуществляется в соответствии с законодательством РФ. Для оплаты и заключения договора свяжитесь с куратором курса.
        </p>
      </div>
    </div>
  </section>

  <!-- Подвал сайта -->
  <footer>
    <div class="footer-container">
      <div class="footer-top">
        <div>
          <div style="font-weight: 800; font-size: 1rem; color: #ffffff;">${escapeHtml(schoolName)}</div>
          <div style="font-size: 0.76rem; margin-top: 4px;">${escapeHtml(schoolTagline)}</div>
        </div>
        <div class="footer-links">
          <a onclick="openLegalModal('oferta')">📜 Договор оферты</a>
          <a onclick="openLegalModal('privacy')">🔒 Политика конфиденциальности (152-ФЗ)</a>
          <a onclick="openLegalModal('consent')">✍️ Согласие на обработку данных</a>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 0.78rem;">
        <div>© ${new Date().getFullYear()} ${escapeHtml(schoolName)}. Все права защищены.</div>
        <div style="color: #64748b;">Автономный независимый сайт школы</div>
      </div>
    </div>
  </footer>

  <!-- Модальное окно записи на курс -->
  <div id="enrollModal" class="modal-backdrop">
    <div class="modal-card">
      <button type="button" class="modal-close" onclick="closeModal('enrollModal')">✕</button>
      <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 6px;">Подать заявку на обучение</h3>
      <p id="enrollCourseTitle" style="font-size: 0.9rem; color: var(--primary); font-weight: 700; margin-bottom: 20px;"></p>
      
      <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 20px;">
        Для записи и получения персонального счёта свяжитесь с куратором удобным способом:
      </p>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${telegram ? `
          <a href="${escapeHtml(telegram)}" target="_blank" rel="noopener" class="btn btn-primary" style="width: 100%;">
            💬 Написать в Telegram
          </a>
        ` : ""}
        ${email ? `
          <a id="enrollMailtoLink" href="mailto:${escapeHtml(email)}" class="btn btn-outline" style="width: 100%;">
            ✉️ Отправить письмо на ${escapeHtml(email)}
          </a>
        ` : ""}
        ${phone ? `
          <a href="tel:${escapeHtml(phone)}" class="btn btn-outline" style="width: 100%;">
            📞 Позвонить по номеру ${escapeHtml(phone)}
          </a>
        ` : ""}
      </div>
    </div>
  </div>

  <!-- Модальное окно входа студента -->
  <div id="studentModal" class="modal-backdrop">
    <div class="modal-card">
      <button type="button" class="modal-close" onclick="closeModal('studentModal')">✕</button>
      <h3 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 8px;">🔑 Вход в личный кабинет слушателя</h3>
      <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 18px;">
        Введите персональный код доступа, выданный вам куратором курса:
      </p>
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <input type="text" id="studentCodeInput" placeholder="Например: STU-12345" style="flex: 1; padding: 10px 14px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 0.95rem; font-weight: 700;">
        <button type="button" class="btn btn-primary" onclick="handleStudentCodeSubmit()">Войти</button>
      </div>
      <div id="studentCodeNotice" style="font-size: 0.82rem; color: #ef4444; display: none;"></div>
      <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 16px;">
        Если вы ещё не получили персональный код, обратитесь в приёмную комиссию по адресу <b>${escapeHtml(email)}</b>.
      </p>
    </div>
  </div>

  <!-- Модальное окно юридических документов -->
  <div id="legalModal" class="modal-backdrop">
    <div class="modal-card">
      <button type="button" class="modal-close" onclick="closeModal('legalModal')">✕</button>
      <h3 id="legalModalTitle" style="font-size: 1.25rem; font-weight: 800; margin-bottom: 14px;"></h3>
      <div id="legalModalContent" style="font-size: 0.86rem; color: var(--text-muted); white-space: pre-wrap; line-height: 1.6; max-height: 60vh; overflow-y: auto; padding: 14px; background: var(--bg); border-radius: 8px; border: 1px solid var(--border);"></div>
    </div>
  </div>

  <script>
    const legalTexts = {
      oferta: {
        title: "Договор публичной оферты",
        text: ${JSON.stringify(ofertaText)}
      },
      privacy: {
        title: "Политика обработки персональных данных (152-ФЗ)",
        text: ${JSON.stringify(privacyText)}
      },
      consent: {
        title: "Согласие на обработку персональных данных",
        text: ${JSON.stringify(consentText)}
      }
    };

    function openEnrollModal(courseTitle) {
      document.getElementById('enrollCourseTitle').innerText = courseTitle;
      const mailtoLink = document.getElementById('enrollMailtoLink');
      if (mailtoLink) {
        mailtoLink.href = "mailto:${escapeHtml(email)}?subject=" + encodeURIComponent("Заявка на обучение: " + courseTitle);
      }
      document.getElementById('enrollModal').classList.add('active');
    }

    function openStudentModal() {
      document.getElementById('studentModal').classList.add('active');
      document.getElementById('studentCodeInput').focus();
    }

    function openLegalModal(type) {
      const doc = legalTexts[type];
      if (!doc) return;
      document.getElementById('legalModalTitle').innerText = doc.title;
      document.getElementById('legalModalContent').innerText = doc.text;
      document.getElementById('legalModal').classList.add('active');
    }

    function closeModal(id) {
      document.getElementById(id).classList.remove('active');
    }

    function handleStudentCodeSubmit() {
      const code = (document.getElementById('studentCodeInput').value || '').trim();
      const notice = document.getElementById('studentCodeNotice');
      if (!code) {
        notice.innerText = "Пожалуйста, введите ваш код доступа.";
        notice.style.display = "block";
        return;
      }
      // Перенаправление на LMS или уведомление
      const currentHost = window.location.origin;
      if (currentHost && !currentHost.startsWith("file:")) {
        window.location.href = currentHost + "/?student=" + encodeURIComponent(code);
      } else {
        alert("Код доступа принят: " + code + "\\n\\nВы открыли сайт из локального файла. Для онлайн-обучения перейдите по постоянной ссылке вашей школы.");
      }
    }

    // Закрытие по клику вне модалки
    window.onclick = function(event) {
      if (event.target.classList.contains('modal-backdrop')) {
        event.target.classList.remove('active');
      }
    };
  </script>
</body>
</html>`;

  return html;
}

export function downloadStandaloneHtmlFile(params: {
  settings: SchoolSiteSettings;
  courses: CreatorCourse[];
  webinars: WebinarItem[];
  pages?: SitePage[];
  fileName?: string;
}): void {
  const html = generateStandaloneSchoolHtml(params);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const schoolSlug = (params.settings.schoolName || "school")
    .toLowerCase()
    .replace(/[^a-zа-я0-9_-]/gi, "_")
    .slice(0, 30);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = params.fileName || `site_${schoolSlug}_${dateStr}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
