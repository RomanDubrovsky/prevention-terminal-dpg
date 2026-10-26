import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dashboardPeriodRange } from "./dashboard_period.ts";

describe("dashboardPeriodRange", () => {
  it("month starts on first day UTC", () => {
    const now = new Date(Date.UTC(2026, 6, 13));
    const r = dashboardPeriodRange("month", now);
    assert.equal(r.periodStart, "2026-07-01");
    assert.equal(r.periodEnd, "2026-07-13");
  });

  it("week is inclusive 7 days", () => {
    const now = new Date(Date.UTC(2026, 6, 13));
    const r = dashboardPeriodRange("week", now);
    assert.equal(r.periodStart, "2026-07-07");
    assert.equal(r.periodEnd, "2026-07-13");
  });
});

