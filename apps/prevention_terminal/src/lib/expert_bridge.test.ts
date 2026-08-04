process.env.VITE_TERMINAL_EDITION = "ru";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

const {
  aggregateCaseExpertFromEntries,
  buildArchitectBridgeContext,
  formatExpertArtifactsBlock,
  mergeExpertArtifacts,
} = await import("./expert_bridge.ts");

describe("expert_bridge", () => {
  it("merges expert by saved_at", () => {
    const merged = mergeExpertArtifacts([
      {
        child_profile: { text: "старая", saved_at: "2026-01-01T00:00:00Z" },
      },
      {
        child_profile: { text: "новая", saved_at: "2026-06-01T00:00:00Z" },
      },
    ]);
    assert.equal(merged.child_profile?.text, "новая");
  });

  it("aggregates expert from consultation entries", () => {
    const expert = aggregateCaseExpertFromEntries([
      {
        entry_id: "a",
        case_id: "c1",
        action_kind: "consultation",
        minutes: 45,
        created_at: "1",
        note: JSON.stringify({
          format: "consultation_session_v1",
          templatePreset: "dap",
          goal: "g",
          artifacts: { expert: { audit: { text: "аудит 1" } } },
        }),
      },
      {
        entry_id: "b",
        case_id: "c1",
        action_kind: "consultation",
        minutes: 45,
        created_at: "2",
        note: JSON.stringify({
          format: "consultation_session_v1",
          templatePreset: "dap",
          goal: "g2",
          artifacts: { expert: { conclusion: { text: "025/у" } } },
        }),
      },
    ]);
    assert.equal(expert?.audit?.text, "аудит 1");
    assert.equal(expert?.conclusion?.text, "025/у");
  });

  it("buildArchitectBridgeContext includes expert block", () => {
    const ctx = buildArchitectBridgeContext({
      baseContext: "Кейс",
      bridgeMode: "expert",
      caseLevelExpert: { fba: { text: "ФАП" } },
      currentArtifacts: { expert: { audit: { text: "аудит" } } },
    });
    assert.ok(ctx.includes("Кейс"));
    assert.ok(ctx.includes("ФАП"));
    assert.ok(formatExpertArtifactsBlock({ fba: { text: "x" } }).includes("ФАП"));
  });

  it("card_only omits expert bridge", () => {
    const ctx = buildArchitectBridgeContext({
      baseContext: "Группа",
      bridgeMode: "card_only",
      currentArtifacts: { expert: { audit: { text: "не должно" } } },
    });
    assert.equal(ctx, "Группа");
  });
});
