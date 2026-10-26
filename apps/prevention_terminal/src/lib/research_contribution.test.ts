import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyResearchKAnonymity,
  researchUploadPeriod,
  shouldUploadResearchContribution,
} from "./research_contribution.ts";
import type { TerminalConfig } from "./terminal_config.ts";

function baseCfg(overrides: Partial<TerminalConfig> = {}): TerminalConfig {
  return {
    terminal_user_id: "term_test",
    edition: "ida",
    mode: "specialist",
    workspace_preset: "specialist",
    org_type: "commercial",
    manager_scope: null,
    job_title: "Психолог",
    child_invite_code: "CHILD-TEST01",
    parent_invite_code: null,
    parent_invite_in: null,
    child_invite_in: null,
    consumer_app: null,
    enabled_modules: {},
    registry_enabled: false,
    onboarding_complete: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("researchUploadPeriod", () => {
  it("returns previous calendar month in UTC", () => {
    const period = researchUploadPeriod(new Date("2026-07-04T12:00:00.000Z"));
    assert.equal(period.periodKey, "2026-06");
    assert.equal(period.periodStart, "2026-06-01");
    assert.equal(period.periodEnd, "2026-06-30");
  });

  it("handles January rollover", () => {
    const period = researchUploadPeriod(new Date("2026-01-15T00:00:00.000Z"));
    assert.equal(period.periodKey, "2025-12");
    assert.equal(period.periodStart, "2025-12-01");
    assert.equal(period.periodEnd, "2025-12-31");
  });
});

describe("shouldUploadResearchContribution", () => {
  it("is false when opt-in disabled", () => {
    assert.equal(
      shouldUploadResearchContribution(
        baseCfg({ research_contribution_enabled: false }),
        new Date("2026-07-04T00:00:00.000Z"),
      ),
      false,
    );
  });

  it("is true when enabled and period not yet uploaded", () => {
    assert.equal(
      shouldUploadResearchContribution(
        baseCfg({
          research_contribution_enabled: true,
          research_contribution_last_period_key: "2026-05",
        }),
        new Date("2026-07-04T00:00:00.000Z"),
      ),
      true,
    );
  });

  it("is false when current target period already uploaded", () => {
    assert.equal(
      shouldUploadResearchContribution(
        baseCfg({
          research_contribution_enabled: true,
          research_contribution_last_period_key: "2026-06",
        }),
        new Date("2026-07-04T00:00:00.000Z"),
      ),
      false,
    );
  });
});

describe("applyResearchKAnonymity", () => {
  it("keeps taxonomy when activity is sufficient", () => {
    const out = applyResearchKAnonymity({
      consultation_count: 2,
      work_minutes: 1,
      y_level_y2_risk: 1,
    });
    assert.equal(out.y_level_y2_risk, 1);
    assert.equal(out.suppressed_low_volume, undefined);
  });

  it("suppresses taxonomy keys on very low volume", () => {
    const out = applyResearchKAnonymity({
      consultation_count: 1,
      y_level_y2_risk: 1,
      x_stage_x2_diag: 2,
      work_minutes: 0,
    });
    assert.equal(out.y_level_y2_risk, undefined);
    assert.equal(out.x_stage_x2_diag, undefined);
    assert.equal(out.consultation_count, 1);
    assert.equal(out.suppressed_low_volume, 1);
  });
});
