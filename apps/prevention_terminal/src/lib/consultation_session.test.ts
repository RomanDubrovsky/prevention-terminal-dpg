import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseConsultationSession,
  serializeConsultationSession,
} from "./consultation_session.ts";
import { serializeProgressNote } from "./progress_note.ts";

describe("consultation_session", () => {
  it("round-trips progress note with artifacts", () => {
    const payload = {
      format: "consultation_session_v1" as const,
      progress: {
        format: "progress_note_v2" as const,
        templatePreset: "dap" as const,
        goal: "Снизить тревогу",
        observations: "Напряжён",
        intervention: "Дыхание",
        assessmentResponse: "Стало легче",
        plan: "Повторить",
        modality: "individual" as const,
        riskLevel: "low" as const,
      },
      artifacts: {
        plan_text: "План 1",
        expert: {
          child_profile: { text: "Сильные стороны: …", structured: true },
        },
      },
    };
    const raw = serializeConsultationSession(payload);
    const parsed = parseConsultationSession(raw);
    assert.equal(parsed.progress.goal, "Снизить тревогу");
    assert.equal(parsed.artifacts.plan_text, "План 1");
    assert.ok(parsed.artifacts.expert?.child_profile?.text?.includes("Сильные"));
  });

  it("round-trips session tags", () => {
    const payload = {
      format: "consultation_session_v1" as const,
      progress: {
        format: "progress_note_v2" as const,
        templatePreset: "dap" as const,
        goal: "",
        observations: "",
        intervention: "",
        assessmentResponse: "",
        plan: "",
        modality: "individual" as const,
        riskLevel: "none" as const,
      },
      artifacts: {},
      sessionTags: {
        themes: { catalog: ["DEV_EMO"], custom: [] },
        methods: { catalog: ["cbt"], custom: ["Арт-терапия"] },
      },
    };
    const raw = serializeConsultationSession(payload);
    const parsed = parseConsultationSession(raw);
    assert.equal(parsed.sessionTags?.themes.catalog[0], "DEV_EMO");
    assert.equal(parsed.sessionTags?.methods.custom[0], "Арт-терапия");
  });

  it("migrates legacy progress_note_v2", () => {
    const legacy = serializeProgressNote({
      format: "progress_note_v2",
      templatePreset: "birp",
      goal: "",
      observations: "Поведение",
      intervention: "Беседа",
      assessmentResponse: "Согласие",
      plan: "Контроль",
      modality: "individual",
      riskLevel: "none",
    });
    const parsed = parseConsultationSession(legacy);
    assert.equal(parsed.progress.templatePreset, "birp");
    assert.deepEqual(parsed.artifacts, {});
  });
});
