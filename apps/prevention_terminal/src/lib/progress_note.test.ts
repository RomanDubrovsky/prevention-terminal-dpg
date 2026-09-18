import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyProgressNoteSegments,
  countFilledSections,
  emptyProgressNote,
  hasProgressNoteContent,
  isElevatedRisk,
  parseWorkLogNote,
  PRESET_HINTS,
  serializeProgressNote,
  UNIFIED_NOTE_FORMAT,
} from "./progress_note.ts";

describe("progress_note", () => {
  it("PRESET_HINTS are strings for React rendering", () => {
    for (const hint of Object.values(PRESET_HINTS)) {
      assert.equal(typeof hint, "string");
      assert.ok(hint.length > 0);
    }
  });

  it("serializes and parses unified v2 round-trip", () => {
    const draft = {
      ...emptyProgressNote("girp"),
      goal: "Снизить конфликты.",
      observations: "Клиент раздражён после перемены.",
      intervention: "Ролевая игра.",
      assessmentResponse: "Появились альтернативные реплики.",
      plan: "Практика в классе.",
      riskLevel: "low" as const,
    };
    const raw = serializeProgressNote(draft);
    const parsed = parseWorkLogNote(raw);
    assert.equal(parsed.kind, "structured");
    if (parsed.kind !== "structured") return;
    assert.equal(parsed.content.format, UNIFIED_NOTE_FORMAT);
    assert.equal(parsed.content.goal, draft.goal);
    assert.equal(parsed.content.templatePreset, "girp");
    assert.equal(parsed.content.riskLevel, "low");
  });

  it("migrates legacy dap_v1 into unified fields", () => {
    const legacy = JSON.stringify({
      format: "dap_v1",
      data: "Тревога.",
      assessment: "Ситуационная.",
      plan: "Дыхание.",
      modality: "individual",
      riskLevel: "moderate",
    });
    const parsed = parseWorkLogNote(legacy);
    assert.equal(parsed.kind, "structured");
    if (parsed.kind !== "structured") return;
    assert.equal(parsed.migratedFrom, "dap_v1");
    assert.equal(parsed.content.observations, "Тревога.");
    assert.equal(parsed.content.assessmentResponse, "Ситуационная.");
    assert.equal(parsed.content.templatePreset, "dap");
  });

  it("migrates legacy birp_v1 into unified fields", () => {
    const legacy = JSON.stringify({
      format: "birp_v1",
      behavior: "Избегание.",
      intervention: "КПТ.",
      response: "Смягчение.",
      plan: "Дневник.",
      modality: "individual",
      riskLevel: "none",
    });
    const parsed = parseWorkLogNote(legacy);
    if (parsed.kind !== "structured") return;
    assert.equal(parsed.migratedFrom, "birp_v1");
    assert.equal(parsed.content.observations, "Избегание.");
    assert.equal(parsed.content.intervention, "КПТ.");
    assert.equal(parsed.content.assessmentResponse, "Смягчение.");
  });

  it("migrates legacy girp_v1 into unified fields", () => {
    const legacy = JSON.stringify({
      format: "girp_v1",
      goal: "Цель ИПР.",
      intervention: "Упражнение.",
      response: "Прогресс.",
      plan: "Повтор.",
      modality: "individual",
      riskLevel: "none",
    });
    const parsed = parseWorkLogNote(legacy);
    if (parsed.kind !== "structured") return;
    assert.equal(parsed.content.goal, "Цель ИПР.");
    assert.equal(parsed.content.templatePreset, "girp");
  });

  it("treats plain text as legacy note", () => {
    assert.equal(parseWorkLogNote("Созвон").kind, "legacy");
  });

  it("hasProgressNoteContent requires at least one section", () => {
    assert.equal(hasProgressNoteContent(emptyProgressNote()), false);
    assert.equal(hasProgressNoteContent({ ...emptyProgressNote(), plan: "ДЗ" }), true);
  });

  it("applyProgressNoteSegments merges AI output into draft", () => {
    const base = { ...emptyProgressNote("dap"), goal: "Уже есть цель" };
    const merged = applyProgressNoteSegments(base, {
      goal: "Новая цель",
      observations: "Наблюдения",
      riskLevel: "moderate",
    });
    assert.match(merged.goal, /Уже есть цель/);
    assert.match(merged.goal, /Новая цель/);
    assert.equal(merged.observations, "Наблюдения");
    assert.equal(merged.riskLevel, "moderate");
  });

  it("applyProgressNoteSegments replace mode overwrites sections", () => {
    const base = { ...emptyProgressNote("dap"), goal: "Старое" };
    const merged = applyProgressNoteSegments(
      base,
      { goal: "Новое", observations: "Факты" },
      "dap",
      "replace",
    );
    assert.equal(merged.goal, "Новое");
    assert.equal(merged.observations, "Факты");
  });

  it("countFilledSections counts non-empty protocol fields", () => {
    assert.equal(countFilledSections(emptyProgressNote()), 0);
    assert.equal(countFilledSections({ ...emptyProgressNote(), plan: "x", goal: "y" }), 2);
  });

  it("isElevatedRisk flags moderate and above", () => {
    assert.equal(isElevatedRisk("none"), false);
    assert.equal(isElevatedRisk("crisis"), true);
  });
});
