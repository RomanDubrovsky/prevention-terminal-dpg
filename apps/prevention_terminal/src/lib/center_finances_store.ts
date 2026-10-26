// Center & Corporate Wellbeing Finances Store (ДДС, P&L, Юнит-экономика, Партнеры/Подрядчики)
// Adapted for psychology centers, clinics, IDA Academy and Corporate Health organizations

import { isDemoModeActive } from "./staging_demo_seed.ts";
import { isCorporateProduct } from "./terminal_product.ts";

export interface FinanceTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: "in" | "out";
  category: string;
  amount: number;
  description: string;
  specialistName?: string;
  paymentMethod?: "sbp" | "card" | "invoice" | "cash";
}

export interface PartnerAgent {
  id: string;
  name: string;
  contact: string;
  promoCode: string;
  commissionRate: number; // e.g. 0.12 (12%)
  totalReferred: number;
  totalSales: number;
  currentBalance: number;
}

export interface UnitEconomicsModel {
  id: string;
  title: string;
  category: "course" | "consultation" | "webinar" | "corporate";
  clientPrice: number;
  variableCost: number; // гонорар специалиста + эквайринг на единицу
  fixedCost: number; // реклама + аренда зала / сервисы на мероприятие или месяц
  plannedUnits: number;
}

const STORAGE_TX_KEY = "ida_center_finances_tx_v2";
const STORAGE_AGENTS_KEY = "ida_center_finances_agents_v2";
const STORAGE_MODELS_KEY = "ida_center_finances_models_v2";

function isCorpContext(): boolean {
  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("corporate-health") || isCorporateProduct()) {
      return true;
    }
  }
  return false;
}

// Default commercial center demo data (B2C & Academy)
const INITIAL_CENTER_TRANSACTIONS: FinanceTransaction[] = [
  {
    id: "tx_1",
    date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    type: "in",
    category: "Индивидуальные консультации B2C",
    amount: 285000,
    description: "Оплата индивидуальных сессий через терминал и онлайн-эквайринг",
    paymentMethod: "card",
  },
  {
    id: "tx_2",
    date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    type: "in",
    category: "Курсы и программы Академии",
    amount: 145000,
    description: "Продажи курса «Клиническая практика тревожных состояний»",
    paymentMethod: "sbp",
  },
  {
    id: "tx_3",
    date: new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10),
    type: "in",
    category: "Корпоративный B2B контракт",
    amount: 90000,
    description: "Тренинг психологической устойчивости для IT-компании (безнал)",
    paymentMethod: "invoice",
  },
  {
    id: "tx_4",
    date: new Date(Date.now() - 86400000 * 1).toISOString().slice(0, 10),
    type: "in",
    category: "Вебинары и мастер-классы",
    amount: 42000,
    description: "Билеты на открытый разбор кейсов в вебинарной комнате",
    paymentMethod: "card",
  },
  {
    id: "tx_5",
    date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    type: "out",
    category: "Выплаты специалистам (гонорары)",
    amount: 171000,
    description: "Сдельная оплата консультаций психологам центра (60%)",
    specialistName: "Штат специалистов (6 чел.)",
    paymentMethod: "invoice",
  },
  {
    id: "tx_6",
    date: new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10),
    type: "out",
    category: "Аренда кабинетов центра",
    amount: 65000,
    description: "Постоянная аренда 3 терапевтических кабинетов и зоны ожидания",
    paymentMethod: "invoice",
  },
  {
    id: "tx_7",
    date: new Date(Date.now() - 86400000 * 6).toISOString().slice(0, 10),
    type: "out",
    category: "Оклады администраторов",
    amount: 50000,
    description: "Окладная часть администраторов ресепшн и клиентской службы",
    paymentMethod: "card",
  },
  {
    id: "tx_8",
    date: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10),
    type: "out",
    category: "Маркетинг и реклама",
    amount: 35000,
    description: "Контекстная реклама Яндекс Директ и посевы в профильных каналах",
    paymentMethod: "card",
  },
  {
    id: "tx_9",
    date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    type: "out",
    category: "Эквайринг и софт (CRM / Облако)",
    amount: 12400,
    description: "Банковский эквайринг (2.2%) + серверное облако видеохостинга",
    paymentMethod: "card",
  },
  {
    id: "tx_10",
    date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    type: "out",
    category: "Расходные материалы центра",
    amount: 4500,
    description: "Печать бланков тестов, арт-материалы, чай/кофе для клиентов",
    paymentMethod: "cash",
  },
];

// Corporate organization demo data (Large enterprise wellbeing budget & EAP)
const INITIAL_CORP_TRANSACTIONS: FinanceTransaction[] = [
  {
    id: "tx_c1",
    date: new Date(Date.now() - 86400000 * 1).toISOString().slice(0, 10),
    type: "in",
    category: "Квартальный бюджет Wellbeing & HR",
    amount: 1850000,
    description: "Выделенный корпоративный бюджет холдинга на программу психологического здоровья (Q4)",
    paymentMethod: "invoice",
  },
  {
    id: "tx_c2",
    date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    type: "in",
    category: "Софинансирование ДМС / EAP-пакет",
    amount: 420000,
    description: "Компенсация корпоративной программы расширенной психологической помощи со стороны страховой компании",
    paymentMethod: "invoice",
  },
  {
    id: "tx_c3",
    date: new Date(Date.now() - 86400000 * 5).toISOString().slice(0, 10),
    type: "in",
    category: "Спецпроекты антикризисной устойчивости",
    amount: 250000,
    description: "Целевое финансирование фасилитации и медиации продуктовых команд",
    paymentMethod: "invoice",
  },
  {
    id: "tx_c4",
    date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    type: "out",
    category: "Выплаты корпоративным психологам",
    amount: 680000,
    description: "Оплата индивидуальных консультаций и дежурств корпоративных психологов (550 сессий в мес.)",
    specialistName: "Внутренняя служба психологов (8 специалистов)",
    paymentMethod: "invoice",
  },
  {
    id: "tx_c5",
    date: new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10),
    type: "out",
    category: "Воркшопы и тренинги для тимлидов",
    amount: 240000,
    description: "Проведение тренингов «Управление стрессом и эмоциональным климатом в спринтах» для 120 лидов",
    paymentMethod: "invoice",
  },
  {
    id: "tx_c6",
    date: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10),
    type: "out",
    category: "Платформа EAP / Лицензии ПО и скрининг",
    amount: 145000,
    description: "Корпоративные лицензии платформы мониторинга выгорания, онлайн-скрининга и защищенных комнат видеосвязи",
    paymentMethod: "invoice",
  },
  {
    id: "tx_c7",
    date: new Date(Date.now() - 86400000 * 6).toISOString().slice(0, 10),
    type: "out",
    category: "Кризисные интервенции и медиации",
    amount: 95000,
    description: "Внешний аудит конфликтов между департаментами Аналитики и Продаж, супервизия",
    paymentMethod: "invoice",
  },
  {
    id: "tx_c8",
    date: new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10),
    type: "out",
    category: "Программа Wellbeing в офисах (Релакс-зоны)",
    amount: 68000,
    description: "Оснащение комнат эмоциональной разгрузки в центральных офисах, инвентарь и биофидбэк",
    paymentMethod: "invoice",
  },
];

const INITIAL_CENTER_AGENTS: PartnerAgent[] = [
  {
    id: "ag_1",
    name: "Клиника «МедЭксперт» (Неврологическое отделение)",
    contact: "+7 (911) 234-56-78, zav_otd@medexpert.pro",
    promoCode: "MEDEXPERT10",
    commissionRate: 0.12,
    totalReferred: 18,
    totalSales: 72000,
    currentBalance: 8640,
  },
  {
    id: "ag_2",
    name: "Частная школа / Гимназия «Логос»",
    contact: "+7 (921) 345-67-89, psych_logos@school.ru",
    promoCode: "LOGOS_KIDS",
    commissionRate: 0.10,
    totalReferred: 9,
    totalSales: 36000,
    currentBalance: 3600,
  },
  {
    id: "ag_3",
    name: "Доктор Смирнов В. А. (Врач-психотерапевт)",
    contact: "+7 (905) 888-12-34, doc.smirnov@mail.ru",
    promoCode: "DR_SMIRNOV",
    commissionRate: 0.15,
    totalReferred: 14,
    totalSales: 63000,
    currentBalance: 9450,
  },
];

const INITIAL_CORP_AGENTS: PartnerAgent[] = [
  {
    id: "ag_c1",
    name: "Провайдер ДМС «АльфаСтрахование / Корп-Медицина»",
    contact: "+7 (495) 788-09-99, corporate_eap@alfastrah.ru",
    promoCode: "CORP_INSURANCE_Q4",
    commissionRate: 0.08,
    totalReferred: 142,
    totalSales: 568000,
    currentBalance: 45440,
  },
  {
    id: "ag_c2",
    name: "HR Tech Консалтинг «Люди и Процессы»",
    contact: "+7 (985) 120-44-33, hr_advisors@peopleproc.ru",
    promoCode: "HR_PARTNER_HUB",
    commissionRate: 0.10,
    totalReferred: 65,
    totalSales: 390000,
    currentBalance: 39000,
  },
  {
    id: "ag_c3",
    name: "Центр коучинга и фасилитации топ-менеджмента",
    contact: "+7 (916) 444-22-11, exec_coaching@corp-leaders.pro",
    promoCode: "EXEC_COACH_2026",
    commissionRate: 0.12,
    totalReferred: 28,
    totalSales: 280000,
    currentBalance: 33600,
  },
];

const INITIAL_CENTER_MODELS: UnitEconomicsModel[] = [
  {
    id: "ue_1",
    title: "Курс «Практическая терапия тревоги» (Академия)",
    category: "course",
    clientPrice: 6900,
    variableCost: 900, // эквайринг + печатные сертификаты
    fixedCost: 35000, // гонорар лектора + таргет на набор
    plannedUnits: 15,
  },
  {
    id: "ue_2",
    title: "Индивидуальная консультация психолога (1 час)",
    category: "consultation",
    clientPrice: 3500,
    variableCost: 2100, // гонорар специалиста 60%
    fixedCost: 500, // пропорциональная стоимость аренды часа кабинета
    plannedUnits: 80,
  },
  {
    id: "ue_3",
    title: "Групповой вебинар / Мастер-класс",
    category: "webinar",
    clientPrice: 1500,
    variableCost: 150, // эквайринг и комиссии
    fixedCost: 18000, // продвижение и гонорар ведущего
    plannedUnits: 25,
  },
];

const INITIAL_CORP_MODELS: UnitEconomicsModel[] = [
  {
    id: "ue_c1",
    title: "Пакет EAP: 1 сотрудник в год (скрининг + 4 сессии)",
    category: "corporate",
    clientPrice: 14500,
    variableCost: 6800, // оплата сессий психологов + софт
    fixedCost: 450000, // годовое лицензирование платформы и супервизии
    plannedUnits: 180,
  },
  {
    id: "ue_c2",
    title: "Индивидуальная сессия корпоративного психолога",
    category: "consultation",
    clientPrice: 3200,
    variableCost: 1800, // ставка психолога
    fixedCost: 400, // амортизация рабочих мест и защищенная видеосвязь
    plannedUnits: 350,
  },
  {
    id: "ue_c3",
    title: "Воркшоп для продуктовых команд (до 25 чел.)",
    category: "webinar",
    clientPrice: 45000,
    variableCost: 8000, // материалы и аналитика команды
    fixedCost: 15000, // гонорар ведущего тренера-психолога
    plannedUnits: 8,
  },
];

export function getFinanceTransactions(): FinanceTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_TX_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  if (!isDemoModeActive()) return [];
  return isCorpContext() ? INITIAL_CORP_TRANSACTIONS : INITIAL_CENTER_TRANSACTIONS;
}

export function saveFinanceTransaction(tx: FinanceTransaction): void {
  const all = getFinanceTransactions();
  const existingIdx = all.findIndex((t) => t.id === tx.id);
  let updated: FinanceTransaction[];
  if (existingIdx >= 0) {
    updated = [...all];
    updated[existingIdx] = tx;
  } else {
    updated = [tx, ...all];
  }
  localStorage.setItem(STORAGE_TX_KEY, JSON.stringify(updated));
}

export function deleteFinanceTransaction(id: string): void {
  const all = getFinanceTransactions();
  const updated = all.filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_TX_KEY, JSON.stringify(updated));
}

export function getPartnerAgents(): PartnerAgent[] {
  try {
    const raw = localStorage.getItem(STORAGE_AGENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  if (!isDemoModeActive()) return [];
  return isCorpContext() ? INITIAL_CORP_AGENTS : INITIAL_CENTER_AGENTS;
}

export function savePartnerAgent(agent: PartnerAgent): void {
  const all = getPartnerAgents();
  const existingIdx = all.findIndex((a) => a.id === agent.id);
  let updated: PartnerAgent[];
  if (existingIdx >= 0) {
    updated = [...all];
    updated[existingIdx] = agent;
  } else {
    updated = [agent, ...all];
  }
  localStorage.setItem(STORAGE_AGENTS_KEY, JSON.stringify(updated));
}

export function payPartnerAgent(id: string, amount: number): void {
  const all = getPartnerAgents();
  const agent = all.find((a) => a.id === id);
  if (!agent) return;
  agent.currentBalance = Math.max(0, agent.currentBalance - amount);
  localStorage.setItem(STORAGE_AGENTS_KEY, JSON.stringify(all));

  // Auto-record payout transaction in Cash Flow
  saveFinanceTransaction({
    id: `payout_${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    type: "out",
    category: isCorpContext() ? "Взаиморасчеты с партнерами и провайдерами" : "Выплата партнерской комиссии",
    amount,
    description: `Выплата по партнерской программе / агентскому договору «${agent.name}» (код: ${agent.promoCode})`,
    paymentMethod: "invoice",
  });
}

export function getUnitEconomicsModels(): UnitEconomicsModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_MODELS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  if (!isDemoModeActive()) return [];
  return isCorpContext() ? INITIAL_CORP_MODELS : INITIAL_CENTER_MODELS;
}

export function saveUnitEconomicsModel(model: UnitEconomicsModel): void {
  const all = getUnitEconomicsModels();
  const existingIdx = all.findIndex((m) => m.id === model.id);
  let updated: UnitEconomicsModel[];
  if (existingIdx >= 0) {
    updated = [...all];
    updated[existingIdx] = model;
  } else {
    updated = [model, ...all];
  }
  localStorage.setItem(STORAGE_MODELS_KEY, JSON.stringify(updated));
}

