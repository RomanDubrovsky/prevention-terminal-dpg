import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSitePageUrls,
  consultBookingUrlFromPlan,
  joinSiteUrl,
  normalizeSiteOrigin,
  parseSitePagePaths,
} from "./site_pages.ts";

describe("site pages", () => {
  it("normalizes origin", () => {
    assert.equal(normalizeSiteOrigin("irpp-edu.ru"), "https://irpp-edu.ru");
    assert.equal(normalizeSiteOrigin("https://irpp-edu.ru/"), "https://irpp-edu.ru");
  });

  it("joins origin and path", () => {
    assert.equal(joinSiteUrl("https://irpp-edu.ru", "/consultants"), "https://irpp-edu.ru/consultants");
    assert.equal(joinSiteUrl("https://irpp-edu.ru", "/"), "https://irpp-edu.ru/");
  });

  it("builds default page URLs", () => {
    const urls = buildSitePageUrls("irpp-edu.ru", parseSitePagePaths(""));
    assert.equal(urls.consult, "https://irpp-edu.ru/consultants");
    assert.equal(urls.chat, "https://irpp-edu.ru/chat");
    assert.equal(urls.register, "https://irpp-edu.ru/register-staff");
    assert.equal(urls.iconostasis, "https://irpp-edu.ru/specialists");
  });

  it("consult booking from plan", () => {
    const url = consultBookingUrlFromPlan(
      "https://center.ru",
      parseSitePagePaths(""),
      "external",
    );
    assert.equal(url, "https://center.ru/consultants");
  });

  it("prefers direct CRM booking URL", () => {
    const url = consultBookingUrlFromPlan(
      "https://center.ru",
      parseSitePagePaths(""),
      "external",
      "https://medflex.ru/clinic/book",
    );
    assert.equal(url, "https://medflex.ru/clinic/book");
  });
});
