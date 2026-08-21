import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AI_SUBSCRIPTION_HERO,
  AI_SUBSCRIPTION_LEGAL,
  AI_SUBSCRIPTION_LINKS,
  AI_SUBSCRIPTION_PILLARS,
  AI_SUBSCRIPTION_TIERS,
} from "../content/ai_subscription_copy.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import {
  buildIrppCheckoutUrl,
  fetchTerminalPaymentOptions,
  startIntlTerminalCheckout,
  validatePromoCode,
  type TerminalBillingPlan,
  type TerminalPaymentOptions,
} from "../lib/terminal_billing_client.ts";
import { fetchTerminalSubscription } from "../lib/terminal_subscription.ts";

interface AiSubscriptionCheckoutProps {
  terminalUserId?: string;
  compact?: boolean;
  soft?: boolean;
  context?: string;
  onDismiss?: () => void;
  onActivated?: () => void;
}

function priceFor(options: TerminalPaymentOptions | null, plan: TerminalBillingPlan, fallback: string): string {
  const row = options?.tariffs.find((t) => t.id === plan);
  return row?.price_label || fallback;
}

export default function AiSubscriptionCheckout(props: AiSubscriptionCheckoutProps) {
  const { terminalUserId, compact, soft, context, onDismiss, onActivated } = props;
  const editionRu = getTerminalEdition() === "ru";

  const [options, setOptions] = useState<TerminalPaymentOptions | null>(null);
  const [promo, setPromo] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [promoHint, setPromoHint] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void fetchTerminalPaymentOptions().then(setOptions);
  }, []);

  const tiers = AI_SUBSCRIPTION_TIERS;

  const monthPrice = useMemo(
    () => priceFor(options, "support_month", tiers.pro.monthPriceFallback),
    [options, tiers.pro.monthPriceFallback],
  );
  const yearPrice = useMemo(
    () => priceFor(options, "year_course", tiers.pro.yearPriceFallback),
    [options, tiers.pro.yearPriceFallback],
  );

  const openCheckout = useCallback(
    async (plan: TerminalBillingPlan) => {
      if (!terminalUserId) {
        setStatus("Сначала завершите установку терминала — нужен ID устройства.");
        return;
      }
      setBusy(true);
      setStatus(null);
      try {
        if (editionRu) {
          const url = buildIrppCheckoutUrl({
            terminalUserId,
            plan,
            promoCode: promo,
            buyerEmail,
          });
          window.open(url, "_blank", "noopener,noreferrer");
          setStatus(
            "Страница оплаты ИРПП открыта в новой вкладке. После оплаты нажмите «Проверить активацию».",
          );
          return;
        }
        const result = await startIntlTerminalCheckout({
          terminalUserId,
          plan,
          promoCode: promo,
          buyerEmail,
        });
        if (result.promo_applied) {
          setStatus(result.message || "Промокод применён. Обновите статус подписки.");
          onActivated?.();
          return;
        }
        if (result.checkout_url) {
          window.open(result.checkout_url, "_blank", "noopener,noreferrer");
          setStatus("Страница оплаты открыта. После завершения проверьте активацию.");
          return;
        }
        setStatus(result.message || "Не удалось начать оплату.");
      } finally {
        setBusy(false);
      }
    },
    [buyerEmail, editionRu, onActivated, promo, terminalUserId],
  );

  const handlePromoCheck = useCallback(async () => {
    setPromoHint(null);
    const result = await validatePromoCode(promo);
    setPromoHint(result.message);
  }, [promo]);

  const handleRefreshStatus = useCallback(async () => {
    if (!terminalUserId) return;
    setChecking(true);
    setStatus(null);
    try {
      const sub = await fetchTerminalSubscription(terminalUserId);
      if (sub.active) {
        setStatus("Подписка ИИ активна. Можно пользоваться конструктором документов.");
        onActivated?.();
      } else {
        setStatus(sub.message || "Подписка пока не активна. Если оплата прошла — подождите несколько минут.");
      }
    } catch {
      setStatus("Не удалось проверить статус. Повторите позже.");
    } finally {
      setChecking(false);
    }
  }, [onActivated, terminalUserId]);

  return (
    <section
      className={`ai-subscription-checkout${compact ? " ai-subscription-checkout--compact" : ""}${soft ? " ai-subscription-checkout--soft" : ""}`}
    >
      <header className="ai-subscription-hero">
        <h3>{soft ? "Нужна подписка ИИ" : context?.trim() || AI_SUBSCRIPTION_HERO.title}</h3>
      </header>

      <div className="consultant-mode-switch ai-subscription-pillars-preview" role="list" aria-label="Режимы ИИ-помощника">
        {AI_SUBSCRIPTION_PILLARS.map((item) => (
          <div key={item.title} className="consultant-mode-btn" role="listitem">
            <span className="consultant-mode-btn-label">{item.title}</span>
            <span className="consultant-mode-btn-hint">{item.hint}</span>
          </div>
        ))}
      </div>

      <div className="ai-pricing-grid">
        <article className="ai-pricing-tier ai-pricing-tier-basic">
          <div className="ai-pricing-tier-head">
            <div>
              <p className="ai-pricing-tier-title">{tiers.basic.title}</p>
              <p className="ai-pricing-tier-price">{tiers.basic.price}</p>
              <p className="muted tiny">{tiers.basic.priceNote}</p>
            </div>
            <span className="ai-pricing-badge">{tiers.basic.badge}</span>
          </div>
          <p className="muted tiny">{tiers.basic.hook}</p>
          <ul className="ai-paywall-features">
            {tiers.basic.features.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>

        <article className="ai-pricing-tier ai-pricing-tier-pro">
          <div className="ai-pricing-tier-head">
            <div>
              <p className="ai-pricing-tier-title">
                {tiers.pro.title}
                {tiers.pro.recommended ? (
                  <span className="ai-pricing-recommended">{tiers.pro.recommended}</span>
                ) : null}
              </p>
              <p className="muted tiny">{tiers.pro.subtitle}</p>
            </div>
          </div>
          {tiers.pro.hook ? <p className="muted tiny">{tiers.pro.hook}</p> : null}
          <ul className="ai-paywall-features">
            {tiers.pro.features.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <div className="ai-pricing-pay-row">
            <button
              type="button"
              className="ai-pricing-pay-outline"
              disabled={busy}
              onClick={() => void openCheckout("support_month")}
            >
              <span>{tiers.pro.monthLabel}</span>
              <span className="ai-pricing-pay-price">{monthPrice}</span>
            </button>
            <button
              type="button"
              className="ai-pricing-pay-primary"
              disabled={busy}
              onClick={() => void openCheckout("year_course")}
            >
              <span>{tiers.pro.yearLabel}</span>
              <span className="ai-pricing-pay-price">{yearPrice}</span>
            </button>
          </div>
        </article>
      </div>

      {terminalUserId && (
        <div className="ai-subscription-device">
          <span className="muted tiny">ID терминала для активации после оплаты:</span>
          <code>{terminalUserId}</code>
        </div>
      )}

      <div className="ai-subscription-promo">
        <label className="field">
          <span>Email для счёта (необязательно)</span>
          <input
            type="email"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            placeholder="name@school.ru"
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Промокод</span>
          <div className="ai-subscription-promo-row">
            <input
              type="text"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Код со страницы ИРПП"
            />
            <button type="button" className="ob-btn" disabled={!promo.trim()} onClick={() => void handlePromoCheck()}>
              Проверить
            </button>
          </div>
        </label>
        {promoHint && <p className={`tiny${promoHint.includes("не") ? "" : " ai-promo-ok"}`}>{promoHint}</p>}
      </div>

      <div className="ai-paywall-actions">
        <a className="ai-paywall-cta" href={AI_SUBSCRIPTION_LINKS.hub} target="_blank" rel="noreferrer">
          О сервисе profilaktika-ai
        </a>
        {terminalUserId && (
          <button type="button" className="ob-btn" disabled={checking} onClick={() => void handleRefreshStatus()}>
            {checking ? "Проверяем…" : "Проверить активацию"}
          </button>
        )}
        {soft && onDismiss && (
          <button type="button" className="ai-paywall-dismiss" onClick={onDismiss}>
            Пока без ИИ
          </button>
        )}
      </div>

      {status && <p className="muted tiny ai-subscription-status">{status}</p>}

      <p className="muted tiny ai-subscription-legal">{AI_SUBSCRIPTION_LEGAL.checkoutNote}</p>
      <p className="muted tiny ai-subscription-legal">{AI_SUBSCRIPTION_LEGAL.activationHint}</p>
      <p className="muted tiny ai-subscription-legal">{AI_SUBSCRIPTION_LEGAL.payment}</p>
      <p className="muted tiny ai-subscription-legal">{AI_SUBSCRIPTION_LEGAL.operator}</p>
    </section>
  );
}
