/**
 * Тексты блока подписки ИИ — по аналогии с profilaktika-ai (irpp-edu.ru)
 * и механикой тарифов Teenology (разовая оплата, без автосписаний).
 */

export const AI_SUBSCRIPTION_HERO = {
  title: "ИИ-помощник",
} as const;

export const AI_SUBSCRIPTION_PILLARS = [
  {
    title: "Консультант",
    hint: "Разбор конкретной ситуации: что происходит, какие шаги попробовать. Не запись визита — протокол ведёте в журнале.",
  },
  {
    title: "Супервизия",
    hint: "Ваша работа со случаем: слепые зоны, этика, гипотезы. Не заменяет живую супервизию.",
  },
  {
    title: "Теория",
    hint: "Методика и алгоритмы из базы знаний — без разбора персональных данных клиента.",
  },
] as const;

export const AI_SUBSCRIPTION_TIERS = {
  basic: {
    title: "Базовый",
    price: "0 ₽",
    priceNote: "В терминале бесплатно",
    badge: "Уже доступно",
    hook: "Рабочее место, журналы и дашборд без передачи ФИО в облако.",
    features: [
      "Карточки, реестр, журнал консультаций и приёма",
      "Локальное хранение данных на устройстве",
      "Дашборд специалиста и rollup для руководителя",
      "Ручной ввод планов и отчётов в карточках (без ИИ)",
    ],
  },
  pro: {
    title: "Подписка ИИ · Все возможности",
    subtitle: "Месяц или год",
    recommended: "",
    hook: "",
    features: [
      "Всё из тарифа «Базовый»",
      "Конструктор документов — планы и отчёты",
      "Экспертиза — заключения 025/у, характеристики, анализ случая, рекомендации",
    ],
    monthLabel: "Оплатить месяц",
    yearLabel: "Оплатить год",
    monthPriceFallback: "490 ₽",
    yearPriceFallback: "3 990 ₽",
  },
} as const;

export const AI_SUBSCRIPTION_LEGAL = {
  payment:
    "Продолжая, вы подтверждаете ознакомление с условиями и политикой конфиденциальности. " +
    "Это не экстренная помощь и не замена очному специалисту.",
  checkoutNote:
    "Оплата проходит на защищённом платежном шлюзе Lava.top. Разовый платёж, без автоматических списаний.",
  activationHint:
    "После оплаты активация подписки по ID терминала обычно происходит автоматически в течение нескольких минут.",
  operator: "Оператор витрины и оплаты — Lava.top / PayPal.",
} as const;

export const AI_SUBSCRIPTION_LINKS = {
  terms: "https://prevention.school/",
  privacy: "https://prevention.school/",
  hub: "https://prevention.school/ai-assistant/",
  checkoutRu: "https://prevention.school/payments/terminal-checkout",
} as const;
