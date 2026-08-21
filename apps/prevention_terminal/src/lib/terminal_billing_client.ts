import { getTerminalEdition } from "./terminal_edition.ts";
import { platformApiBase } from "./platform_api.ts";
import {
  type TerminalBillingPlan,
} from "./terminal_checkout_urls.ts";

export type { TerminalBillingPlan } from "./terminal_checkout_urls.ts";
export { buildIrppCheckoutUrl, defaultCheckoutUrl } from "./terminal_checkout_urls.ts";

export interface TerminalTariffQuote {
  id: TerminalBillingPlan;
  price_label: string;
  currency: string;
}

export interface TerminalPaymentOptions {
  tariffs: TerminalTariffQuote[];
  currency: string;
  country_code: string;
}

const FALLBACK_RU: TerminalPaymentOptions = {
  currency: "RUB",
  country_code: "RU",
  tariffs: [
    { id: "support_month", price_label: "490 ₽", currency: "RUB" },
    { id: "year_course", price_label: "3 990 ₽", currency: "RUB" },
  ],
};

export async function fetchTerminalPaymentOptions(): Promise<TerminalPaymentOptions> {
  if (getTerminalEdition() === "ru") {
    try {
      const q = new URLSearchParams({ locale: "ru", app_id: "specialist_terminal" });
      const res = await fetch(`${platformApiBase()}/api/payments/options?${q}`);
      if (!res.ok) return FALLBACK_RU;
      const data = (await res.json()) as {
        tariffs?: Array<{ id: string; price_label?: string; currency?: string }>;
        currency?: string;
        country_code?: string;
      };
      const tariffs = (data.tariffs || [])
        .filter((t) => t.id === "support_month" || t.id === "year_course")
        .map((t) => ({
          id: t.id as TerminalBillingPlan,
          price_label: String(t.price_label || ""),
          currency: String(t.currency || data.currency || "RUB"),
        }));
      if (!tariffs.length) return FALLBACK_RU;
      return {
        tariffs,
        currency: String(data.currency || "RUB"),
        country_code: String(data.country_code || "RU"),
      };
    } catch {
      return FALLBACK_RU;
    }
  }

  try {
    const q = new URLSearchParams({ locale: "en", app_id: "parent_navigator" });
    const res = await fetch(`${platformApiBase()}/api/payments/options?${q}`);
    if (!res.ok) return FALLBACK_RU;
    const data = (await res.json()) as {
      tariffs?: Array<{ id: string; price_label?: string; currency?: string }>;
      currency?: string;
      country_code?: string;
    };
    const tariffs = (data.tariffs || [])
      .filter((t) => t.id === "support_month" || t.id === "year_course")
      .map((t) => ({
        id: t.id as TerminalBillingPlan,
        price_label: String(t.price_label || ""),
        currency: String(t.currency || "USD"),
      }));
    return {
      tariffs: tariffs.length ? tariffs : FALLBACK_RU.tariffs,
      currency: String(data.currency || "USD"),
      country_code: String(data.country_code || "US"),
    };
  } catch {
    return FALLBACK_RU;
  }
}

export async function startIntlTerminalCheckout(args: {
  terminalUserId: string;
  plan: TerminalBillingPlan;
  promoCode?: string;
  buyerEmail?: string;
}): Promise<{ ok: boolean; checkout_url?: string; message?: string; promo_applied?: boolean }> {
  const payload: Record<string, string> = {
    userId: args.terminalUserId,
    tariffId: args.plan,
    locale: "en",
  };
  if (args.promoCode?.trim()) payload.promoCode = args.promoCode.trim();
  if (args.buyerEmail?.trim()) payload.email = args.buyerEmail.trim();

  const res = await fetch(`${platformApiBase()}/api/payments/checkout?app_id=parent_navigator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    formUrl?: string;
    checkout_url?: string;
    message?: string;
    promo_applied?: boolean;
    error?: string;
    detail?: string;
  };
  if (res.ok && data.promo_applied) {
    return { ok: true, promo_applied: true, message: data.message || "Промокод применён." };
  }
  const url = String(data.formUrl || data.checkout_url || "").trim();
  if (res.ok && url) return { ok: true, checkout_url: url };
  return {
    ok: false,
    message: String(data.message || data.detail || data.error || "Не удалось открыть оплату."),
  };
}

export async function validatePromoCode(code: string): Promise<{ ok: boolean; message: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, message: "Введите промокод." };
  try {
    const res = await fetch(`${platformApiBase()}/api/payments/promo/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoCode: trimmed }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; discount_percent?: number };
    if (data.ok) {
      const pct = data.discount_percent ?? 0;
      return {
        ok: true,
        message: pct >= 100 ? "Промокод действителен — скидка 100%." : `Промокод принят (−${pct}%).`,
      };
    }
    const err = String(data.error || "");
    const map: Record<string, string> = {
      invalid_code: "Промокод не найден.",
      exhausted: "Лимит активаций исчерпан.",
      inactive: "Промокод недоступен.",
      already_used: "Промокод уже использован.",
    };
    return { ok: false, message: map[err] || "Промокод не принят." };
  } catch {
    return { ok: false, message: "Не удалось проверить промокод." };
  }
}
