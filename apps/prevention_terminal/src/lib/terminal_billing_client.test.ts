import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildIrppCheckoutUrl } from "./terminal_checkout_urls.ts";

describe("terminal_billing_client", () => {
  it("buildIrppCheckoutUrl passes terminal id and plan", () => {
    const url = buildIrppCheckoutUrl({
      terminalUserId: "tid-abc-123",
      plan: "year_course",
      promoCode: "TEST10",
      buyerEmail: "psy@school.ru",
    });
    assert.match(url, /^https:\/\/irpp-edu\.ru\/profilaktika-ai\/oplata\/\?/);
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("terminal_user_id"), "tid-abc-123");
    assert.equal(parsed.searchParams.get("plan"), "year");
    assert.equal(parsed.searchParams.get("promo"), "TEST10");
    assert.equal(parsed.searchParams.get("email"), "psy@school.ru");
  });
});
