import test from "node:test";
import assert from "node:assert/strict";

import {
  emptyTargetAudience,
  formatTargetAudienceForAi,
  formatTargetAudienceSummary,
  parseTargetAudienceJson,
  serializeTargetAudience,
  TARGET_CATEGORY_VALUES,
  TARGET_CATEGORY_LABELS_RU,
  getTargetCategoryLabel,
  getTargetCategoryHint,
  getAudienceGroupLabel,
  getAgeBandLabel,
  resolveAudienceContext,
  AGE_BAND_OPTIONS_BY_CONTEXT,
} from "./target_audience.ts";

test("emptyTargetAudience sets default universal category and students row enabled", () => {
  const aud = emptyTargetAudience();
  assert.equal(aud.category, "universal");
  assert.equal(aud.customCategory, "");
  assert.equal(aud.mode, "structured");
  assert.equal(aud.groups[0].group, "students");
  assert.equal(aud.groups[0].enabled, true);
  assert.equal(aud.groups[0].ageBand, "11_14");
});

test("parseTargetAudienceJson defaults legacy JSON without category to universal", () => {
  const legacyJson = JSON.stringify({
    mode: "structured",
    freeText: "",
    groups: [
      { group: "students", enabled: true, count: 20, ageBand: "11_14" },
    ],
  });
  const parsed = parseTargetAudienceJson(legacyJson);
  assert.equal(parsed.category, "universal");
  assert.equal(parsed.groups[0].count, 20);
});

test("parseTargetAudienceJson migrates legacy category keys", () => {
  assert.equal(parseTargetAudienceJson(JSON.stringify({ category: "normotypic" })).category, "universal");
  assert.equal(parseTargetAudienceJson(JSON.stringify({ category: "risk" })).category, "selective");
  assert.equal(parseTargetAudienceJson(JSON.stringify({ category: "deviant" })).category, "secondary");
});

test("round-trips all 8 target categories", () => {
  for (const cat of TARGET_CATEGORY_VALUES) {
    const original = {
      ...emptyTargetAudience(),
      category: cat,
      customCategory: cat === "custom" ? "Подростки-сироты и опекаемые" : "",
      groups: [
        { group: "students" as const, enabled: true, count: 15, ageBand: "11_14" as const },
        { group: "parents" as const, enabled: false, count: null },
        { group: "educators" as const, enabled: false, count: null },
      ],
    };
    const serialized = serializeTargetAudience(original);
    const parsed = parseTargetAudienceJson(serialized);
    assert.equal(parsed.category, cat);
    if (cat === "custom") {
      assert.equal(parsed.customCategory, "Подростки-сироты и опекаемые");
    }
  }
});

test("formatTargetAudienceForAi includes category label and hint", () => {
  const aud = emptyTargetAudience();
  aud.category = "selective";
  aud.groups[0].count = 12;
  const aiFormatted = formatTargetAudienceForAi(aud);
  assert.match(aiFormatted, /трудной жизненной ситуации/);
  assert.match(aiFormatted, /охват: 12 чел/);
});

test("formatTargetAudienceForAi supports custom category text", () => {
  const aud = emptyTargetAudience();
  aud.category = "custom";
  aud.customCategory = "Кадетские классы 8–9";
  aud.groups[0].count = 22;
  const aiFormatted = formatTargetAudienceForAi(aud);
  assert.match(aiFormatted, /Свой вариант: Кадетские классы 8–9/);
  assert.match(aiFormatted, /охват: 22 чел/);
});

test("formatTargetAudienceSummary shows category and participants", () => {
  const aud = emptyTargetAudience();
  aud.category = "gifted";
  aud.groups[0].count = 8;
  const summary = formatTargetAudienceSummary(aud);
  assert.match(summary, /Одарённые/);
  assert.match(summary, /охват 8/);
});

test("formatTargetAudienceSummary shows custom category text when present", () => {
  const aud = emptyTargetAudience();
  aud.category = "custom";
  aud.customCategory = "Студенты 1 курса колледжа";
  aud.groups[0].count = 30;
  const summary = formatTargetAudienceSummary(aud);
  assert.match(summary, /Свой вариант: Студенты 1 курса колледжа/);
  assert.match(summary, /охват 30/);
});

test("corporate context provides specialized labels, hints, and participant groups", () => {
  assert.equal(
    getTargetCategoryLabel("universal", "corporate"),
    "Все сотрудники (общая группа / отдел / кросс-функциональная команда)",
  );
  assert.equal(
    getTargetCategoryLabel("secondary", "corporate"),
    "Тимлиды, руководители и ключевые эксперты (управление выгоранием команд, медиация)",
  );
  assert.match(getTargetCategoryHint("universal", "corporate"), /стрессоустойчивости/);

  assert.equal(getAudienceGroupLabel("students", "corporate"), "Сотрудники / специалисты");
  assert.equal(getAudienceGroupLabel("parents", "corporate"), "Тимлиды / руководители направлений");
  assert.equal(getAudienceGroupLabel("educators", "corporate"), "HR / HRBP / Коучи и фасилитаторы");

  const corpAgeBands = AGE_BAND_OPTIONS_BY_CONTEXT.corporate;
  assert.ok(corpAgeBands.some((b) => b.value === "senior_lead" && b.labelRu.includes("Senior / Lead")));
  assert.ok(corpAgeBands.some((b) => b.value === "management" && b.labelRu.includes("Руководители")));

  const aud = {
    ...emptyTargetAudience(),
    category: "secondary" as const,
    groups: [
      { group: "parents" as const, enabled: true, count: 16, ageBand: "senior_lead" as const },
      { group: "students" as const, enabled: false, count: null },
      { group: "educators" as const, enabled: false, count: null },
    ],
  };

  const aiSummary = formatTargetAudienceForAi(aud, "corporate");
  assert.match(aiSummary, /Тимлиды, руководители/);
  assert.match(aiSummary, /Тимлиды \/ руководители направлений, охват: 16 чел/);

  const shortSummary = formatTargetAudienceSummary(aud, "corporate");
  assert.match(shortSummary, /Тимлиды, руководители/);
  assert.match(shortSummary, /Тимлиды \/ руководители направлений — охват 16/);
});

test("commercial context provides specialized labels and hints", () => {
  assert.equal(
    getTargetCategoryLabel("universal", "commercial"),
    "Все клиенты / открытая группа (навыки саморегуляции, эмоциональная грамотность)",
  );
  assert.equal(getAudienceGroupLabel("students", "commercial"), "Клиенты / участники группы");
  assert.equal(getAudienceGroupLabel("parents", "commercial"), "Члены семьи / близкие / партнёры");
});

test("resolveAudienceContext handles boolean flags and objects", () => {
  assert.equal(resolveAudienceContext(true, false), "corporate");
  assert.equal(resolveAudienceContext(false, true), "commercial");
  assert.equal(resolveAudienceContext(false, false), "education");
  assert.equal(resolveAudienceContext({ org_sphere: "corporate" }), "corporate");
  assert.equal(resolveAudienceContext({ org_type: "commercial" }), "commercial");
  assert.equal(resolveAudienceContext({ org_type: "education" }), "education");
});
