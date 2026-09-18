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
    "В настоящий момент сервис работает только на платном тарифе. В тестовом режиме подключение и оплата осуществляются по личной заявке.",
  checkoutNote:
    "Для подключения доступа напишите на admin@prevention-ai.ru или в Telegram: @RomanDubrovsky",
  activationHint:
    "После подтверждения заявки доступ к функциям ИИ и распознавания речи активируется для вашего терминала.",
  operator: "Контакты: admin@prevention-ai.ru · Telegram: @RomanDubrovsky",
} as const;

export const AI_SUBSCRIPTION_LINKS = {
  terms: "https://prevention.school/",
  privacy: "https://prevention.school/",
  hub: "https://prevention.school/ai-assistant/",
  checkoutRu: "https://prevention.school/payments/terminal-checkout",
} as const;
