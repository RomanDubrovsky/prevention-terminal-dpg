/**
 * Хранилище страниц и блочного конструктора института / школы психологии.
 * Local-First (localStorage) с готовыми шаблонами (направления, документы, спикеры, курсы).
 */

import { loadCreatorCourses, type CreatorCourse } from "./course_students_store.ts";
import { loadWebinars, type WebinarItem } from "./webinars_store.ts";

export type SiteBlockType =
  | "hero"
  | "direction_info"
  | "courses_grid"
  | "webinars_grid"
  | "speakers_team"
  | "reviews_quotes"
  | "faq_accordion"
  | "text_legal"
  | "contact_lead";

export interface SpeakerItem {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
  bio?: string;
  telegram?: string;
}

export interface ReviewItem {
  id: string;
  authorName: string;
  authorRole?: string;
  text: string;
  rating?: number; // 1-5
  date?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface BulletItem {
  id: string;
  icon?: string;
  title: string;
  text: string;
}

export interface SiteBlockConfig {
  // Hero
  badgeText?: string;
  buttonText?: string;
  buttonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  heroBackgroundGradient?: string;

  // Direction info
  bullets?: BulletItem[];
  highlightBadge?: string;

  // Courses & Webinars
  topicFilter?: string; // e.g. "consulting", "all"
  limitCount?: number;

  // Speakers
  speakers?: SpeakerItem[];

  // Reviews
  reviews?: ReviewItem[];

  // FAQ
  faqItems?: FaqItem[];

  // Contacts
  telegramUrl?: string;
  whatsappPhone?: string;
  phone?: string;
  email?: string;
  address?: string;
  workHours?: string;

  // Custom styling
  theme?: "light" | "dark" | "accent";
}

export interface SiteBlock {
  id: string;
  type: SiteBlockType;
  title?: string;
  subtitle?: string;
  content?: string;
  config?: SiteBlockConfig;
  isHidden?: boolean;
}

export type PageFolder = "general" | "directions" | "events" | "legal";

export interface SitePage {
  id: string;
  slug: string; // e.g. "main", "consulting", "about", "oferta", "personaldata", "consent", "oferta_for_speakers", "speakers"
  title: string;
  folder: PageFolder;
  badge?: string;
  metaDescription?: string;
  blocks: SiteBlock[];
  isPublished: boolean;
  updatedAt: string;
}

export interface SchoolSiteSettings {
  schoolName: string;
  schoolTagline: string;
  schoolLogoEmoji: string;
  inn?: string;
  ogrn?: string;
  contactEmail: string;
  contactPhone?: string;
  telegramUrl?: string;
  customDomain?: string;
  paymentGateway?: string;
  bankComplianceNotes?: string;
  theme: "light" | "dark";
  primaryAccentColor?: string;
}

const SITE_PAGES_STORAGE_KEY = "ida_school_site_pages_v2";
const SITE_SETTINGS_STORAGE_KEY = "ida_school_site_settings_v1";

export const DEFAULT_SCHOOL_SETTINGS: SchoolSiteSettings = {
  schoolName: "Институт психологической помощи",
  schoolTagline: "Практическое образование, супервизии и повышение квалификации психологов",
  schoolLogoEmoji: "🏛️",
  inn: "7701234567",
  ogrn: "1237700123456",
  contactEmail: "info@psy-institute.ru",
  contactPhone: "+7 (495) 123-45-67",
  telegramUrl: "https://t.me/psy_institute",
  customDomain: "",
  paymentGateway: "ЮKassa / СБП (Прямой расчётный счёт)",
  bankComplianceNotes: "Для проверки банком (эквайрингом) обязательно заполните ИНН, ОГРН, Email и проверьте опубликованные страницы Оферты и Политики 152-ФЗ.",
  theme: "light",
  primaryAccentColor: "#0f766e",
};

export const DEFAULT_SITE_PAGES: SitePage[] = [
  // 1. Главная страница
  {
    id: "page-main",
    slug: "main",
    title: "Главная страница института",
    folder: "general",
    badge: "⭐ Главная",
    metaDescription: "Официальный сайт института: курсы, вебинары, преподаватели и повышение квалификации.",
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: "b-hero-main",
        type: "hero",
        title: "Институт психологической помощи",
        subtitle: "Современное прикладное образование для психологов, педагогов и помогающих практиков. Живые супервизии, практические кейсы и удостоверения установленного образца.",
        config: {
          badgeText: "🎓 Набор на учебный семестр открыт",
          buttonText: "📚 Выбрать программу обучения",
          buttonUrl: "#courses",
          secondaryButtonText: "🎙️ Ближайшие вебинары",
          secondaryButtonUrl: "#webinars",
        },
      },
      {
        id: "b-directions-main",
        type: "direction_info",
        title: "Ключевые преимущества обучения",
        subtitle: "Фундаментальная глубина и прикладные алгоритмы работы с клиентами без схоластики и лишней теории",
        config: {
          highlightBadge: "💡 Практика с 1-й недели",
          bullets: [
            {
              id: "dir-1",
              icon: "🤝",
              title: "Практические протоколы консультаций",
              text: "Пошаговый алгоритм первой сессии, терапевтический контракт, речевые модули и техники краткосрочной помощи.",
            },
            {
              id: "dir-2",
              icon: "👥",
              title: "Регулярные супервизии и разбор кейсов",
              text: "Разбор реальных клиентских случаев в закрытых группах под руководством опытных супервизоров.",
            },
            {
              id: "dir-3",
              icon: "📜",
              title: "Удостоверения установленного образца",
              text: "Официальные документы о повышении квалификации с защищенным QR-кодом для подтверждения компетенций.",
            },
            {
              id: "dir-4",
              icon: "💻",
              title: "Бессрочный доступ в личном кабинете",
              text: "Все видеозаписи лекций, конспекты, шаблоны бланков и записи вебинаров доступны в любое время 24/7.",
            },
          ],
        },
      },
      {
        id: "b-courses-main",
        type: "courses_grid",
        title: "Программы и курсы института",
        subtitle: "Выберите программу для старта или повышения квалификации в частной практике",
        config: {
          topicFilter: "all",
          limitCount: 6,
        },
      },
      {
        id: "b-webinars-main",
        type: "webinars_grid",
        title: "Ближайшие вебинары и мастер-классы",
        subtitle: "Живые онлайн-эфиры с ответами на вопросы и записями в вашем личном кабинете",
        config: {
          limitCount: 4,
        },
      },
      {
        id: "b-speakers-main",
        type: "speakers_team",
        title: "Преподаватели и ведущие эксперты",
        subtitle: "Практикующие психологи, кандидаты наук и авторы терапевтических методик",
        config: {
          speakers: [
            {
              id: "sp-1",
              name: "Елена Васильевна Морозова",
              role: "Кандидат психологических наук, доцент",
              bio: "20+ лет практики, автор методических программ по психологическому консультированию, ведущий супервизор института.",
            },
            {
              id: "sp-2",
              name: "Дмитрий Александрович Смирнов",
              role: "Клинический психолог, супервизор",
              bio: "Специалист по тревожным состояниям, кризисной интервенции и работе со сложными кейсами в частной практике.",
            },
            {
              id: "sp-3",
              name: "Анна Сергеевна Белова",
              role: "Семейный системный психолог",
              bio: "Эксперт по детско-родительским отношениям, медиатор семейных конфликтов, автор практических тренингов.",
            },
          ],
        },
      },
      {
        id: "b-reviews-main",
        type: "reviews_quotes",
        title: "Отзывы наших выпускников",
        subtitle: "Честные истории специалистов, открывших или расширивших частную практику",
        config: {
          reviews: [
            {
              id: "rev-1",
              authorName: "Ольга Михайлова",
              authorRole: "Педагог-психолог, г. Санкт-Петербург",
              rating: 5,
              text: "Прошла базовый курс по консультированию. Никакой воды и заумных терминов — чёткие протоколы, речевые модули и схемы первой сессии. Клиенты стали приходить по рекомендациям уже на второй месяц!",
            },
            {
              id: "rev-2",
              authorName: "Сергей Кузнецов",
              authorRole: "Частнопрактикующий психолог, г. Москва",
              rating: 5,
              text: "Супервизии в институте — это лучшее, что случилось с моей практикой. Сложные кейсы больше не пугают, а видеозаписи и материалы в кабинете всегда под рукой.",
            },
            {
              id: "rev-3",
              authorName: "Марина Романова",
              authorRole: "Психолог-консультант, г. Екатеринбург",
              rating: 5,
              text: "Очень ценю понятную подачу материала и практическую направленность. Всё четко, бережно и применимо в реальной работе с первого дня.",
            },
          ],
        },
      },
      {
        id: "b-faq-main",
        type: "faq_accordion",
        title: "Часто задаваемые вопросы",
        subtitle: "Всё об обучении, доступе к урокам и подтверждающих документах",
        config: {
          faqItems: [
            {
              id: "faq-1",
              question: "Как устроен доступ к урокам и вебинарам?",
              answer: "Сразу после оплаты или регистрации вам открывается личный кабинет студента. Все видео, конспекты и записи прямых эфиров доступны с любого устройства (компьютер, планшет, смартфон) 24/7.",
            },
            {
              id: "faq-2",
              question: "Выдаются ли документы об окончании?",
              answer: "Да, после успешного прохождения программы и выполнения практических заданий выдается именной сертификат или удостоверение о повышении квалификации установленного образца с верификацией по QR-коду.",
            },
            {
              id: "faq-3",
              question: "Что делать, если я не смогу присутствовать на живом вебинаре?",
              answer: "Все вебинары автоматически записываются в HD-качестве и появляются в вашем кабинете в течение нескольких часов вместе с презентациями и списком литературы.",
            },
            {
              id: "faq-4",
              question: "Как происходит оплата обучения?",
              answer: "Оплата производится напрямую в адрес школы или преподавателя через защищённый платёжный шлюз (ЮKassa, Т-Банк, СБП, банковские карты). Платформа IDA не является посредником и не удерживает средства — ваш платёж поступает напрямую на расчётный счёт организатора.",
            },
          ],
        },
      },
      {
        id: "b-contact-main",
        type: "contact_lead",
        title: "Остались вопросы? Мы на связи",
        subtitle: "Напишите методисту института в Telegram или позвоните — поможем подобрать подходящую программу",
        config: {
          telegramUrl: "https://t.me/psy_institute",
          phone: "+7 (495) 123-45-67",
          email: "info@psy-institute.ru",
          workHours: "Пн-Пт: 10:00 — 19:00 (МСК)",
        },
      },
    ],
  },

  // 2. Страница курса / направления: Консультирование
  {
    id: "page-consulting",
    slug: "consulting",
    title: "Основы психологического консультирования",
    folder: "directions",
    badge: "🎓 Программа",
    metaDescription: "Практический курс психологического консультирования: первая сессия, контракт, протоколы работы.",
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: "b-hero-consulting",
        type: "hero",
        title: "Практика психологического консультирования",
        subtitle: "От первого контакта с клиентом до устойчивых терапевтических изменений. Чёткие алгоритмы, речевые модули и супервизорская поддержка.",
        config: {
          badgeText: "🎯 Базовый практический курс",
          buttonText: "📚 Выбрать тариф обучения",
          buttonUrl: "#courses",
        },
      },
      {
        id: "b-dir-consulting",
        type: "direction_info",
        title: "Чему вы научитесь на курсе",
        subtitle: "Практические компетенции для уверенного ведения частной практики",
        config: {
          bullets: [
            {
              id: "cb-1",
              icon: "📋",
              title: "Протокол первой диагностической сессии",
              text: "Как формулировать запрос, заключать терапевтический контракт и выстраивать доверительный сеттинг.",
            },
            {
              id: "cb-2",
              icon: "💡",
              title: "Инструменты краткосрочной терапии",
              text: "Техники когнитивной переоценки, эмоциональной регуляции и поведенческих домашних заданий.",
            },
            {
              id: "cb-3",
              icon: "💼",
              title: "Этика и ведение частной практики",
              text: "Установление стоимости сессий, работа с пропусками, границами и предотвращение эмоционального выгорания.",
            },
          ],
        },
      },
      {
        id: "b-courses-consulting",
        type: "courses_grid",
        title: "Программа курса и варианты участия",
        subtitle: "Выберите подходящий формат обучения с супервизией или для самостоятельного изучения",
        config: {
          topicFilter: "consulting",
        },
      },
      {
        id: "b-contact-consulting",
        type: "contact_lead",
        title: "Помощь в выборе программы",
        subtitle: "Свяжитесь с куратором направления",
        config: {
          telegramUrl: "https://t.me/psy_institute",
          email: "consulting@psy-institute.ru",
        },
      },
    ],
  },

  // 3. Страница: Преподаватели и спикеры
  {
    id: "page-speakers",
    slug: "speakers",
    title: "Преподаватели института",
    folder: "general",
    badge: "👥 Команда",
    metaDescription: "Ведущие преподаватели, супервизоры и эксперты Института психологической помощи.",
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: "b-hero-speakers",
        type: "hero",
        title: "Наши преподаватели и супервизоры",
        subtitle: "Эксперты-практики с подтверждённым клиническим и академическим опытом, которые щедро делятся наработками.",
        config: {
          badgeText: "👥 Экспертный совет института",
        },
      },
      {
        id: "b-team-speakers",
        type: "speakers_team",
        title: "Преподавательский состав",
        subtitle: "Каждый преподаватель ведёт собственную частную практику и супервизорские группы",
        config: {
          speakers: [
            {
              id: "sp-team-1",
              name: "Елена Васильевна Морозова",
              role: "Кандидат психологических наук, доцент",
              bio: "Ведущий методист института. Стаж практической работы более 20 лет. Автор методических пособий для психологов и консультантов.",
              telegram: "https://t.me/psy_institute",
            },
            {
              id: "sp-team-2",
              name: "Дмитрий Александрович Смирнов",
              role: "Клинический психолог, супервизор",
              bio: "Ведущий преподаватель программ по когнитивно-поведенческой терапии и работе с кризисными состояниями. Член профессиональных сообществ.",
              telegram: "https://t.me/psy_institute",
            },
            {
              id: "sp-team-3",
              name: "Анна Сергеевна Белова",
              role: "Семейный системный психолог",
              bio: "Ведущая практических курсов по семейному консультированию, детско-родительским отношениям и разрешению конфликтов.",
              telegram: "https://t.me/psy_institute",
            },
          ],
        },
      },
      {
        id: "b-contact-speakers",
        type: "contact_lead",
        title: "Хотите стать спикером или преподавателем института?",
        subtitle: "Мы всегда рады сотрудничеству с опытными психологами и авторами методик. Напишите в учебную часть.",
        config: {
          telegramUrl: "https://t.me/psy_institute",
          email: "speakers@psy-institute.ru",
        },
      },
    ],
  },

  // 4. Страница: Сведения об образовательной организации
  {
    id: "page-about",
    slug: "about",
    title: "Сведения об организации",
    folder: "legal",
    badge: "🏛️ Официально",
    metaDescription: "Основные сведения об Институте психологической помощи, руководство, реквизиты.",
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: "b-legal-about",
        type: "text_legal",
        title: "Сведения об образовательной организации",
        subtitle: "Официальные реквизиты и структура организации",
        content: `### 1. Основные сведения
**Полное наименование:** {{school_name}}  
**Сокращенное наименование:** Институт психологической помощи  
**Дата создания:** 2021 год  
**Электронная почта:** {{email}}  
**Телефон:** {{phone}}  
**Официальный сайт:** {{website}}  

---

### 2. Структура и органы управления
Управление Институтом осуществляется в соответствии с законодательством Российской Федерации и Уставом организации.
* **Руководитель института:** Ректор / Директор образовательных программ
* **Учебно-методический совет:** Координация учебных программ и супервизий
* **Кафедра практического консультирования**
* **Отдел сопровождения студентов и супервизорской поддержки**

---

### 3. Образовательные программы
Институт реализует программы дополнительного профессионального образования (повышение квалификации и практические курсы) по направлениям:
1. Практическое психологическое консультирование и диагностика
2. Краткосрочные терапевтические методы и протоколы интервенций
3. Профилактика эмоционального выгорания и кризисная помощь
4. Супервизорские группы для практикующих специалистов

---

### 4. Реквизиты организации
* **ИНН:** {{inn}}
* **ОГРН:** {{ogrn}}
* **Юридический адрес:** г. Москва, ул. Психологическая, д. 10
* **Режим работы:** Понедельник — Пятница, 10:00 — 19:00 (МСК)`,
      },
    ],
  },

  // 5. Страница: Публичная оферта
  {
    id: "page-oferta",
    slug: "oferta",
    title: "Публичная оферта на оказание услуг",
    folder: "legal",
    badge: "📜 Документ",
    metaDescription: "Публичный договор-оферта на предоставление онлайн-курсов, вебинаров и образовательных услуг.",
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: "b-legal-oferta",
        type: "text_legal",
        title: "Публичная оферта на оказание образовательных и консультационных услуг",
        subtitle: "Редакция от {{date}}",
        content: `### 1. Общие положения
1.1. Настоящий документ является публичной офертой **{{school_name}}** (далее — «Исполнитель») в соответствии со ст. 437 Гражданского кодекса РФ.  
1.2. Акцептом настоящей Оферты признается оплата услуг Исполнителя или регистрация на платформе. Совершая акцепт, Заказчик подтверждает полное и безоговорочное согласие со всеми условиями настоящего Договора.

---

### 2. Предмет договора
2.1. Исполнитель обязуется предоставить Заказчику доступ к образовательным материалам, видеозаписям лекций, живым вебинарам и супервизиям согласно выбранному тарифу, а Заказчик обязуется оплатить данные услуги.  
2.2. Форма оказания услуг: дистанционная (онлайн через личный кабинет платформы).

---

### 3. Порядок оплаты и предоставления доступа
3.1. Стоимость программ указывается на витрине и карточках курсов в рублях РФ.  
3.2. Оплата производится через защищенные платежные шлюзы (ЮKassa / СБП / банковские карты).  
3.3. Доступ к личному кабинету студента открывается автоматически сразу после подтверждения платежа.

---

### 4. Интеллектуальная собственность
4.1. Все учебные материалы, видеозаписи, презентации и конспекты защищены авторским правом. Запрещается копирование, распространение, передача третьим лицам или перепродажа материалов без письменного согласия Исполнителя.

---

### 5. Реквизиты Исполнителя
**Организация:** {{school_name}}  
**ИНН:** {{inn}} | **ОГРН:** {{ogrn}}  
**Email для обращений:** {{email}}`,
      },
    ],
  },

  // 6. Страница: Политика обработки персональных данных (152-ФЗ)
  {
    id: "page-personaldata",
    slug: "personaldata",
    title: "Политика конфиденциальности (152-ФЗ)",
    folder: "legal",
    badge: "🔒 152-ФЗ",
    metaDescription: "Политика в отношении обработки и защиты персональных данных в соответствии с 152-ФЗ.",
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: "b-legal-pd",
        type: "text_legal",
        title: "Политика в отношении обработки персональных данных",
        subtitle: "Соответствие Федеральному закону № 152-ФЗ «О персональных данных»",
        content: `### 1. Назначение и область применения
1.1. Настоящая Политика определяет порядок обработки и защиты персональных данных пользователей сайта и студентов **{{school_name}}** (далее — «Оператор»).  
1.2. Цель Политики — обеспечение защиты прав и свобод человека при обработке его персональных данных, включая защиту прав на неприкосновенность частной жизни.

---

### 2. Состав обрабатываемых данных
Оператор обрабатывает следующие персональные данные при регистрации и обучении:
* Фамилия, имя, отчество;
* Адрес электронной почты (email);
* Номер мобильного телефона;
* Данные мессенджера Telegram (при указании);
* Сведения об оплате и истории прохождения учебных модулей.

---

### 3. Цели обработки персональных данных
* Предоставление доступа к закрытому кабинету студента;
* Отправка ссылок на живые вебинары и учебные материалы;
* Оформление сертификатов и документов об обучении;
* Обратная связь по домашним заданиям и супервизиям.

---

### 4. Безопасность и хранение данных
4.1. Оператор применяет современные средства шифрования и технической защиты данных. Персональные данные не передаются третьим лицам, за исключением случаев, прямо предусмотренных законодательством РФ.

---

### 5. Контакты ответственного лица
Для отзыва согласия на обработку персональных данных направьте обращение на: **{{email}}**  
**Оператор:** {{school_name}}, ИНН: {{inn}}`,
      },
    ],
  },

  // 7. Страница: Согласие на обработку персональных данных
  {
    id: "page-consent",
    slug: "consent",
    title: "Согласие на обработку данных",
    folder: "legal",
    badge: "✍️ Согласие",
    metaDescription: "Согласие на обработку персональных данных и получение информационных уведомлений.",
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: "b-legal-consent",
        type: "text_legal",
        title: "Согласие на обработку персональных данных",
        subtitle: "В соответствии со статьей 9 Федерального закона от 27.07.2006 № 152-ФЗ",
        content: `### Согласие на обработку персональных данных

Заполняя формы регистрации, оформляя заказ или совершая оплату на сайте **{{website}}**, Пользователь подтверждает свое согласие на обработку персональных данных Оператором — **{{school_name}}** (ИНН {{inn}}, ОГРН {{ogrn}}).

#### 1. Перечень обрабатываемых данных
* Фамилия, имя, отчество
* Контактный номер телефона
* Адрес электронной почты (e-mail)
* Никнейм / аккаунт в Telegram

#### 2. Перечень действий с персональными данными
Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передача (в случаях, предусмотренных законодательством РФ), обезличивание, блокирование, удаление, уничтожение персональных данных.

#### 3. Срок действия согласия
Согласие действует с момента предоставления до момента его отзыва путем направления письменного заявления на адрес электронной почты: **{{email}}**.`,
      },
    ],
  },

  // 8. Страница: Оферта для авторов и спикеров
  {
    id: "page-oferta-speakers",
    slug: "oferta_for_speakers",
    title: "Оферта для авторов и спикеров",
    folder: "legal",
    badge: "🎙️ Спикерам",
    metaDescription: "Условия сотрудничества с авторами программ, экспертами и ведущими вебинаров.",
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: "b-legal-speakers-oferta",
        type: "text_legal",
        title: "Договор-оферта о сотрудничестве с авторами и экспертами",
        subtitle: "Условия проведения совместных мастер-классов, вебинаров и курсов",
        content: `### 1. Предмет соглашения
1.1. Настоящая оферта регулирует условия проведения экспертами, психологами и преподавателями (далее — «Автор») авторских вебинаров, курсов и супервизорских групп на платформе **{{school_name}}** (далее — «Платформа»).  
1.2. Платформа предоставляет техническую инфраструктуру (видеоконференцсвязь, прием оплат, личные кабинеты студентов, чаты, выдачу сертификатов), а Автор проводит содержательную часть мероприятия.

---

### 2. Права и авторские права
2.1. Автор сохраняет исключительные авторские права на свои методические материалы, презентации и программы.  
2.2. Платформе предоставляется неисключительное право на публикацию записи вебинара в закрытом кабинете зарегистрированных слушателей.

---

### 3. Финансовые условия и выплаты
3.1. Вознаграждение Автора рассчитывается согласно согласованному проценту или фиксированной ставке за проведённое мероприятие.  
3.2. Выплаты производятся в течение 3 рабочих дней после завершения мероприятия или расчетного периода на расчетный счет или банковские реквизиты Автора (самозанятый / ИП).

---

### 4. Контакты куратора спикеров
По вопросам сотрудничества: **{{email}}** | Telegram: [Написать куратору]({{website}})`,
      },
    ],
  },
];

export function loadSchoolSettings(): SchoolSiteSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SCHOOL_SETTINGS;
  try {
    const raw = localStorage.getItem(SITE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SCHOOL_SETTINGS;
    return { ...DEFAULT_SCHOOL_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    console.error("Error loading school site settings:", err);
    return DEFAULT_SCHOOL_SETTINGS;
  }
}

export function saveSchoolSettings(settings: SchoolSiteSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SITE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Error saving school site settings:", err);
  }
}

export function loadSitePages(): SitePage[] {
  if (typeof localStorage === "undefined") return DEFAULT_SITE_PAGES;
  try {
    const raw = localStorage.getItem(SITE_PAGES_STORAGE_KEY);
    if (!raw) {
      saveSitePages(DEFAULT_SITE_PAGES);
      return DEFAULT_SITE_PAGES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveSitePages(DEFAULT_SITE_PAGES);
      return DEFAULT_SITE_PAGES;
    }
    return parsed;
  } catch (err) {
    console.error("Error loading site pages:", err);
    return DEFAULT_SITE_PAGES;
  }
}

export function saveSitePages(pages: SitePage[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SITE_PAGES_STORAGE_KEY, JSON.stringify(pages));
  } catch (err) {
    console.error("Error saving site pages:", err);
  }
}

export function getPageBySlug(slug: string): SitePage | undefined {
  const pages = loadSitePages();
  const normalized = (slug || "main").trim().toLowerCase().replace(/^\/+/, "");
  return pages.find((p) => p.slug.toLowerCase() === normalized || (normalized === "" && p.slug === "main"));
}

export function createDefaultPage(title: string, slug: string, folder: PageFolder = "directions"): SitePage {
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || `page-${Date.now()}`;
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    slug: cleanSlug,
    title: title.trim() || "Новая страница",
    folder,
    badge: folder === "directions" ? "🎓 Направление" : folder === "events" ? "🎙️ Мероприятие" : "📄 Страница",
    metaDescription: `Страница: ${title.trim()}`,
    isPublished: true,
    updatedAt: new Date().toISOString(),
    blocks: [
      {
        id: `b-hero-${Date.now()}`,
        type: "hero",
        title: title.trim() || "Заголовок страницы",
        subtitle: "Краткое описание направления, программы или темы для ваших студентов.",
        config: {
          badgeText: "✨ Новая программа",
          buttonText: "📚 Записаться на курс",
          buttonUrl: "#courses",
        },
      },
      {
        id: `b-info-${Date.now()}`,
        type: "direction_info",
        title: "О программе и методе",
        subtitle: "Ключевые преимущества и результаты обучения",
        config: {
          bullets: [
            {
              id: `bul-1-${Date.now()}`,
              icon: "✓",
              title: "Практический навык",
              text: "Разбор реальных алгоритмов и протоколов психологической помощи.",
            },
            {
              id: `bul-2-${Date.now()}`,
              icon: "✓",
              title: "Материалы и записи",
              text: "Доступ в личный кабинет студента с бессрочным сохранением базы знаний.",
            },
          ],
        },
      },
      {
        id: `b-courses-${Date.now()}`,
        type: "courses_grid",
        title: "Курсы направления",
        subtitle: "Выберите курс для записи",
        config: {
          topicFilter: "all",
        },
      },
      {
        id: `b-contacts-${Date.now()}`,
        type: "contact_lead",
        title: "Задать вопрос методисту",
        subtitle: "Свяжитесь с нами для консультации",
        config: {
          telegramUrl: "https://t.me/psy_institute",
          email: "info@psy-institute.ru",
        },
      },
    ],
  };
}

export function createBlock(type: SiteBlockType): SiteBlock {
  const id = `b-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case "hero":
      return {
        id,
        type: "hero",
        title: "Главный заголовок экрана",
        subtitle: "Понятное описание предложения или программы без сложных терминов.",
        config: {
          badgeText: "🔥 Популярное",
          buttonText: "📚 Записаться",
          buttonUrl: "#courses",
        },
      };
    case "direction_info":
      return {
        id,
        type: "direction_info",
        title: "О направлении и методе",
        subtitle: "Почему этот инструмент необходим в вашей практике",
        config: {
          bullets: [
            { id: `b-1-${Date.now()}`, icon: "💡", title: "Практический протокол", text: "Пошаговый план работы с первой сессии" },
            { id: `b-2-${Date.now()}`, icon: "🛡️", title: "Безопасность и этика", text: "Экологичные техники без ретравматизации" },
          ],
        },
      };
    case "courses_grid":
      return {
        id,
        type: "courses_grid",
        title: "Курсы и программы",
        subtitle: "Выберите программу для начала обучения",
        config: {
          topicFilter: "all",
          limitCount: 6,
        },
      };
    case "webinars_grid":
      return {
        id,
        type: "webinars_grid",
        title: "Вебинары и мастер-классы",
        subtitle: "Живые онлайн-эфиры и записи",
        config: {
          limitCount: 4,
        },
      };
    case "speakers_team":
      return {
        id,
        type: "speakers_team",
        title: "Наши преподаватели и спикеры",
        subtitle: "Практикующие специалисты и супервизоры",
        config: {
          speakers: [
            { id: `sp-1-${Date.now()}`, name: "Имя Фамилия Преподавателя", role: "Психолог, супервизор", bio: "15+ лет практики" },
          ],
        },
      };
    case "reviews_quotes":
      return {
        id,
        type: "reviews_quotes",
        title: "Отзывы студентов",
        subtitle: "Что говорят выпускники о наших программах",
        config: {
          reviews: [
            { id: `rev-1-${Date.now()}`, authorName: "Анна Смирнова", authorRole: "Психолог", text: "Отличный практический курс, помог начать частную практику!", rating: 5 },
          ],
        },
      };
    case "faq_accordion":
      return {
        id,
        type: "faq_accordion",
        title: "Вопросы и ответы",
        subtitle: "Часто задаваемые вопросы по обучению",
        config: {
          faqItems: [
            { id: `faq-1-${Date.now()}`, question: "Как получить доступ к курсу?", answer: "Доступ открывается сразу после оплаты в личном кабинете по персональному коду или Email." },
            { id: `faq-2-${Date.now()}`, question: "Как и куда производится оплата?", answer: "Оплата перечисляется напрямую преподавателю или школе через их официальный банковский эквайринг (ЮKassa, Т-Банк, СБП). Платформа IDA не является посредником и не имеет отношения к вашим средствам." },
          ],
        },
      };
    case "text_legal":
      return {
        id,
        type: "text_legal",
        title: "Официальный документ",
        subtitle: "Условия и положения",
        content: "### Текст документа\n\nЗдесь можно указать условия, оферту или сведения об организации.",
      };
    case "contact_lead":
      return {
        id,
        type: "contact_lead",
        title: "Контакты и запись",
        subtitle: "Свяжитесь с нами любым удобным способом",
        config: {
          telegramUrl: "https://t.me/psy_institute",
          email: "info@psy-institute.ru",
          phone: "+7 (495) 123-45-67",
        },
      };
  }
}

/**
 * Подстановка переменных {{school_name}}, {{inn}}, {{ogrn}}, {{email}}, {{date}} в текст/документы
 */
export function interpolateLegalVariables(text: string, settings: SchoolSiteSettings): string {
  if (!text) return "";
  const curDate = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  return text
    .replace(/\{\{school_name\}\}/g, settings.schoolName || "Институт психологической помощи")
    .replace(/\{\{inn\}\}/g, settings.inn || "7701234567")
    .replace(/\{\{ogrn\}\}/g, settings.ogrn || "1237700123456")
    .replace(/\{\{email\}\}/g, settings.contactEmail || "info@psy-institute.ru")
    .replace(/\{\{phone\}\}/g, settings.contactPhone || "+7 (495) 123-45-67")
    .replace(/\{\{website\}\}/g, typeof window !== "undefined" ? window.location.origin : "https://academy.ida-psy.ru")
    .replace(/\{\{date\}\}/g, curDate);
}
