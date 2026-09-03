import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveTechniqueCode,
  rollupSessionTagsForStats,
  rollupToResearchMetrics,
} from "./intervention_techniques.ts";
import { emptyConsultationSessionTags } from "./session_tagging.ts";

describe("intervention_techniques", () => {
  it("resolves CBT technique aliases", () => {
    assert.equal(resolveTechniqueCode("сократовский диалог"), "socratic_questioning");
  });

  it("rolls technique up to method_tag for stats", () => {
    const tags = {
      ...emptyConsultationSessionTags(),
      techniques: { catalog: ["behavioral_experiment"], custom: [] },
    };
    const rollup = rollupSessionTagsForStats(tags);
    assert.ok(rollup.methodTags.includes("cbt"));
    const metrics = rollupToResearchMetrics(rollup);
    assert.equal(metrics.technique_behavioral_experiment, 1);
    assert.equal(metrics.method_tag_cbt, 1);
  });
});
