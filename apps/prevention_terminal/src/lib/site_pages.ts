export type SiteBookingMode = "prevention" | "external";

/** Default URL paths (after domain) for each embed page. */
export interface SitePagePaths {
  consult: string;
  register: string;
  iconostasis: string;
  chat: string;
  school_privacy_mode?: "anonymous" | "hybrid" | "authorized";
}

export const DEFAULT_SITE_PAGE_PATHS: SitePagePaths = {
  consult: "/specialists",
  register: "/staff-register",
  iconostasis: "/specialists",
  chat: "/chat",
  school_privacy_mode: "hybrid",
};

export const SITE_INTEGRATION_SCENARIOS = {
  prevention: {
    id: "prevention" as const,
    title: "Полное решение (заявка через Prevention)",
    hint: "Нет своей CRM записи: чат, каталог специалистов, регистрация психологов и сбор заявок у нас.",
  },
  external: {
    id: "external" as const,
    title: "Интеграция с вашей CRM (своя форма на сайте)",
    hint: "Запись уже в MedFlex, Yclients, Яндекс.Формах и т.п. Ставите только чат; в конце диалога клиент уходит на вашу форму записи.",
  },
} as const;

/** Short how-to for CRM / external booking mode (shown under the scenario fields). */
export const CRM_INTEGRATION_HOW_TO = {
  title: "Как работает этот сценарий",
  steps: [
    "Клиент открывает чат IDA на вашем сайте и кратко описывает запрос.",
    "В конце диалога бот показывает кнопку записи — она открывает вашу CRM или форму (MedFlex, Yclients, Яндекс.Формы и т.п.).",
    "Календарь и запись остаются в вашей системе. Данные из чата в CRM сами не подставляются — клиент заполняет форму у вас.",
  ],
  fieldsTitle: "Что прописать ниже",
  fields: [
    {
      name: "Домен сайта центра",
      detail: "Адрес сайта, куда вставите виджет (например https://center.ru).",
    },
    {
      name: "Страница чата",
      detail: "Путь страницы с виджетом: /chat или / — если чат на главной.",
    },
    {
      name: "Ссылка на систему записи",
      detail:
        "Полный HTTPS-адрес формы или виджета записи из CRM. Скопируйте ссылку из браузера и вставьте целиком.",
    },
  ],
  afterApply:
    "После «Применить» скопируйте один HTML-код чата на страницу сайта. Каталог и регистрация специалистов в этом сценарии не нужны.",
} as const;

export const SITE_PAGE_LABELS: Record<"consult" | "register" | "iconostasis" | "chat", { title: string; hint: string }> = {
  consult: {
    title: "Запись клиента",
    hint: "Ссылка data-consult-url в чате; сюда же ведёт кнопка «Записаться»",
  },
  register: {
    title: "Регистрация психологов",
    hint: "Служебная страница — вставьте код формы регистрации",
  },
  iconostasis: {
    title: "Каталог специалистов",
    hint: "Публичная сетка специалистов (иконостас)",
  },
  chat: {
    title: "Чат с клиентом",
    hint: "Страница, куда вставите HTML-код чата (главная или /chat)",
  },
};

export function normalizeSiteOrigin(raw: string): string {
  let u = String(raw || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, "");
}

export function normalizePagePath(raw: string, fallback = "/"): string {
  const p = String(raw || "").trim();
  if (!p) return fallback;
  return p.startsWith("/") ? p : `/${p}`;
}

export function joinSiteUrl(origin: string, path: string): string {
  const o = normalizeSiteOrigin(origin);
  if (!o) return "";
  const p = normalizePagePath(path, "/");
  if (p === "/") return `${o}/`;
  return `${o}${p}`;
}

export function parseSitePagePaths(json: string | undefined | null): SitePagePaths {
  const base = { ...DEFAULT_SITE_PAGE_PATHS };
  if (!json || !String(json).trim()) return base;
  try {
    const parsed = JSON.parse(String(json)) as Partial<SitePagePaths>;
    return {
      consult: normalizePagePath(parsed.consult ?? base.consult, base.consult),
      register: normalizePagePath(parsed.register ?? base.register, base.register),
      iconostasis: normalizePagePath(parsed.iconostasis ?? base.iconostasis, base.iconostasis),
      chat: normalizePagePath(parsed.chat ?? base.chat, base.chat),
      school_privacy_mode: parsed.school_privacy_mode || base.school_privacy_mode,
    };
  } catch {
    return base;
  }
}

export function serializeSitePagePaths(paths: SitePagePaths): string {
  return JSON.stringify({
    consult: normalizePagePath(paths.consult, DEFAULT_SITE_PAGE_PATHS.consult),
    register: normalizePagePath(paths.register, DEFAULT_SITE_PAGE_PATHS.register),
    iconostasis: normalizePagePath(paths.iconostasis, DEFAULT_SITE_PAGE_PATHS.iconostasis),
    chat: normalizePagePath(paths.chat, DEFAULT_SITE_PAGE_PATHS.chat),
    school_privacy_mode: paths.school_privacy_mode || "hybrid",
  });
}

export function buildSitePageUrls(origin: string, paths: SitePagePaths): Record<"consult" | "register" | "iconostasis" | "chat", string> {
  const o = normalizeSiteOrigin(origin);
  return {
    consult: joinSiteUrl(o, paths.consult),
    register: joinSiteUrl(o, paths.register),
    iconostasis: joinSiteUrl(o, paths.iconostasis),
    chat: joinSiteUrl(o, paths.chat),
  };
}

export function normalizeExternalBookingUrl(raw: string): string {
  let u = String(raw || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

export function consultBookingUrlFromPlan(
  origin: string,
  paths: SitePagePaths,
  bookingMode: SiteBookingMode,
  externalUrl = "",
): string {
  if (bookingMode !== "external") return "";
  const direct = normalizeExternalBookingUrl(externalUrl);
  if (direct) return direct;
  return joinSiteUrl(origin, paths.consult);
}

import { publicConsultUrlForEmbed } from "./site_embed_public.ts";

export function effectiveConsultBookingUrl(cfg: {
  booking_mode: SiteBookingMode;
  consult_booking_url: string;
  public_site_origin: string;
  site_page_paths_json: string;
}): string {
  if (cfg.booking_mode !== "external") return "";
  const stored = publicConsultUrlForEmbed(String(cfg.consult_booking_url || "").trim());
  if (stored) return stored;
  return joinSiteUrl(
    cfg.public_site_origin,
    parseSitePagePaths(cfg.site_page_paths_json).consult,
  );
}

export function deployHint(origin: string, path: string): string {
  const url = joinSiteUrl(origin, path);
  return url ? `Разместите на странице: ${url}` : "Укажите домен сайта выше";
}
