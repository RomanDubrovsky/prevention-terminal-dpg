import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sessionDraftFromIdaLead } from "./ida_intake_bridge.ts";
import type { LeadRow } from "./inbox_client.ts";
import { hasSessionDraftContent } from "./session_records.ts";

describe("ida_case_from_lead helpers", () => {
  it("builds primary draft from lead intake", () => {
    const lead: LeadRow = {
      id: "lead-1",
      name: "Анна",
      contact: "+7",
      intake_json: JSON.stringify({
        summary_bullets: ["Конфликт с подростком"],
        taxonomy_codes: { problem_keys: ["REL_FAM"] },
      }),
      center_id: "c1",
      specialist_id: null,
      source: "ida",
      user_id: null,
      status: "new",
      created_at: "2026-07-06",
    };
    const { draft, problemThemes } = sessionDraftFromIdaLead(lead, true);
    assert.ok(hasSessionDraftContent(draft));
    assert.match(String(draft.contactedBy), /Анна/);
    assert.deepEqual(problemThemes.catalog, ["REL_FAM"]);
  });
});
