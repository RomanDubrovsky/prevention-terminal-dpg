import { AI_SUBSCRIPTION_LINKS } from "../content/ai_subscription_copy.ts";

export type TerminalBillingPlan = "support_month" | "year_course";

export function defaultCheckoutUrl(): string {
  return AI_SUBSCRIPTION_LINKS.checkoutRu;
}

export function buildIrppCheckoutUrl(args: {
  terminalUserId: string;
  plan: TerminalBillingPlan;
  promoCode?: string;
  buyerEmail?: string;
}): string {
  const base = defaultCheckoutUrl();
  const params = new URLSearchParams();
  params.set("terminal_user_id", args.terminalUserId);
  params.set("plan", args.plan === "year_course" ? "year" : "month");
  if (args.promoCode?.trim()) params.set("promo", args.promoCode.trim());
  if (args.buyerEmail?.trim()) params.set("email", args.buyerEmail.trim());
  return `${base}?${params.toString()}`;
}
