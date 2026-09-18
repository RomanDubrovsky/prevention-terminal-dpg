import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseOnboardingEntry,
  resolveOnboardingEntryForProduct,
} from "./onboarding_entry.ts";

describe("parseOnboardingEntry", () => {
  it("defaults without param", () => {
    const e = parseOnboardingEntry("");
    assert.equal(e.kind, "default");
    assert.equal(e.orgType, null);
    assert.equal(e.skipOrgStep, false);
  });

  it("school landing skips org step", () => {
    const e = parseOnboardingEntry("education");
    assert.equal(e.kind, "education");
    assert.equal(e.orgType, "education");
    assert.equal(e.skipOrgStep, true);
  });

  it("center landing skips org step", () => {
    const e = parseOnboardingEntry("commercial");
    assert.equal(e.orgType, "commercial");
    assert.equal(e.skipOrgStep, true);
  });

  it("educator entry bypasses wizard", () => {
    const e = parseOnboardingEntry("educator");
    assert.equal(e.kind, "educator");
    assert.equal(e.orgType, "education");
    assert.equal(e.skipOrgStep, true);
  });
});

describe("resolveOnboardingEntryForProduct", () => {
  it("ida product locks commercial org without URL param", () => {
    const e = resolveOnboardingEntryForProduct("", "ida");
    assert.equal(e.orgType, "commercial");
    assert.equal(e.skipOrgStep, true);
    assert.equal(e.presetSource, "product");
  });

  it("school product locks education org", () => {
    const e = resolveOnboardingEntryForProduct("", "school");
    assert.equal(e.orgType, "education");
    assert.equal(e.skipOrgStep, true);
    assert.equal(e.presetSource, "product");
  });

  it("platform defers to URL entry", () => {
    const e = resolveOnboardingEntryForProduct("commercial", "platform");
    assert.equal(e.orgType, "commercial");
    assert.equal(e.presetSource, "url");
  });
});
