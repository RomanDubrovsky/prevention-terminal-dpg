import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildThreatHeatmap,
  lastMonths,
  preventionPlanPct,
  summarizePreventionByLink,
  threatCategoryLabel,
} from "./manager_dashboard.ts";

describe("manager_dashboard", () => {
  it("threatCategoryLabel maps known task kinds", () => {
    assert.equal(threatCategoryLabel("bullying_victim"), "Bullying (Victim)");
    assert.equal(threatCategoryLabel("elevated_consultation"), "Elevated Risk Consultations");
  });

  it("lastMonths returns descending recent buckets", () => {
    const months = lastMonths(3);
    assert.equal(months.length, 3);
    assert.match(months[0]!, /^\d{4}-\d{2}$/);
  });

  it("summarizePreventionByLink rolls up L1–L5", () => {
    const summary = summarizePreventionByLink([
      {
        prevention_link: "L1_universal",
        month: "2026-06",
        planned_hours: 2,
        planned_reach: 10,
        actual_hours: 1,
        actual_reach: 5,
      },
      {
        prevention_link: "L1_universal",
        month: "2026-05",
        planned_hours: 1,
        planned_reach: 0,
        actual_hours: 2,
        actual_reach: 0,
      },
    ]);
    const l1 = summary.find((row) => row.prevention_link === "L1_universal");
    assert.ok(l1);
    assert.equal(l1!.planned_hours, 3);
    assert.equal(l1!.actual_hours, 3);
  });

  it("buildThreatHeatmap filters to selected months", () => {
    const matrix = buildThreatHeatmap(
      [
        {
          category_key: "other",
          month: "2026-06",
          incidents: 2,
          severe_incidents: 1,
          avg_severity: 2.5,
        },
        {
          category_key: "other",
          month: "2024-01",
          incidents: 9,
          severe_incidents: 0,
          avg_severity: 1,
        },
      ],
      ["2026-06"],
    );
    assert.equal(matrix.get("other")?.get("2026-06")?.incidents, 2);
    assert.equal(matrix.get("other")?.get("2024-01"), undefined);
  });

  it("preventionPlanPct handles zero plan", () => {
    assert.equal(
      preventionPlanPct({
        prevention_link: "L2_selective",
        month: "2026-06",
        planned_hours: 0,
        planned_reach: 0,
        actual_hours: 1,
        actual_reach: 0,
      }),
      100,
    );
  });
});
