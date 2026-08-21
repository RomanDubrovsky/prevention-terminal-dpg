import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { generateOpaqueCenterId, slugifyCenterId } from "./center_id.ts";
import { buildVisibleSetupSections } from "./terminal_setup_constants.ts";

describe("site portal setup", () => {
  it("manager gets Site tab and Modules", () => {
    const steps = buildVisibleSetupSections("manager");
    assert.ok(steps.includes("site_widgets"));
    assert.ok(steps.includes("modules"));
  });

  it("specialist keeps Modules tab", () => {
    const steps = buildVisibleSetupSections("specialist");
    assert.ok(steps.includes("modules"));
    assert.equal(steps.includes("site_widgets"), false);
  });

  it("territorial manager has no Site tab", () => {
    const steps = buildVisibleSetupSections("manager", { territorialManager: true });
    assert.equal(steps.includes("site_widgets"), false);
  });

  it("onboarding has profile then federation without organization tab", () => {
    const steps = buildVisibleSetupSections("specialist");
    const profileIdx = steps.indexOf("profile");
    const fedIdx = steps.indexOf("federation");
    assert.ok(profileIdx >= 0 && fedIdx >= 0);
    assert.ok(profileIdx < fedIdx);
    assert.equal(steps.includes("organization"), false);
  });

  it("settings include advanced organization section", () => {
    const steps = buildVisibleSetupSections("specialist", { includeAdvancedOrganization: true });
    assert.ok(steps.includes("organization"));
    assert.ok(steps.indexOf("organization") > steps.indexOf("federation"));
  });

  it("slugify center id transliterates cyrillic", () => {
    assert.equal(slugifyCenterId('Центр «Гармония»'), "tsentr-garmoniya");
  });

  it("generate opaque center id produces CTR- prefix and 8 hex digits", () => {
    const id = generateOpaqueCenterId();
    assert.match(id, /^CTR-[0-9A-F]{8}$/);
  });
});
