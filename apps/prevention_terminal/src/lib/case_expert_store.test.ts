import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  flattenCaseExpertForBridge,
  formatFlattenedExpertForContext,
  setParticipantExpert,
} from "./case_expert_store.ts";

describe("case_expert_store", () => {
  it("stores per-participant expert", () => {
    const next = setParticipantExpert({}, "a1", "child_profile", { text: "профиль" });
    assert.equal(next.expert_by_participant?.a1?.child_profile?.text, "профиль");
  });

  it("flattens case and participant expert", () => {
    const flat = flattenCaseExpertForBridge({
      expert: { audit: { text: "общий" } },
      expert_by_participant: {
        p1: { child_profile: { text: "ребёнок" } },
      },
    });
    assert.equal(flat.audit?.text, "общий");
    assert.equal(flat["participant:p1:child_profile"]?.text, "ребёнок");
  });

  it("formats participant block with markers", () => {
    const block = formatFlattenedExpertForContext(
      { "participant:p1:child_profile": { text: "данные" } },
      { p1: "[Ученик №1]" },
    );
    assert.match(block, /Ученик №1/);
    assert.match(block, /данные/);
  });
});
