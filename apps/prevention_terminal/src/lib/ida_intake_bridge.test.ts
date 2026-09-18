import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseIdaIntakeBrief, sessionDraftFromIdaLead } from "./ida_intake_bridge.ts";

describe("ida_intake_bridge", () => {
  it("maps intake brief to commercial primary draft", () => {
    const brief = {
      disclaimer: "Не диагноз",
      summary_bullets: ["Клиент прошёл опрос", "Тема: тревога"],
      taxonomy_codes: { problem_keys: ["DEV_EMO"], crisis_flag: true },
    };
    const lead = {
      id: "lead-1",
      center_id: "c1",
      name: "Анна",
      contact: "+7",
      specialist_id: null,
      intake_json: JSON.stringify(brief),
      source: "ida",
      user_id: null,
      status: "new",
      created_at: "2026-01-01",
    };
    assert.ok(parseIdaIntakeBrief(lead.intake_json));
    const { draft, problemThemes } = sessionDraftFromIdaLead(lead, true);
    assert.match(draft.primaryDescription || "", /тревога/);
    assert.deepEqual(problemThemes.catalog, ["DEV_EMO"]);
    assert.match(draft.riskNotes || "", /острота/);
  });
});
