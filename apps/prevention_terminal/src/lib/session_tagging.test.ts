import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCustomSessionTag,
  emptyConsultationSessionTags,
  formatConsultationSessionTagsForAi,
  METHOD_TAG_VALUES,
  parseConsultationSessionTags,
  toggleSessionTagCatalog,
} from "./session_tagging.ts";
import { problemKeyAllowedMap, TEENOLOGY_TCM_PROBLEM_KEYS } from "./taxonomy_picker.ts";

describe("session_tagging", () => {
  it("uses canonical problem_key catalog size", () => {
    assert.equal(TEENOLOGY_TCM_PROBLEM_KEYS.length, 22);
    assert.equal(METHOD_TAG_VALUES.length, 12);
  });

  it("round-trips consultation tags with problem_key", () => {
    const raw = {
      themes: { catalog: ["DEV_EMO"], custom: ["Конфликт с учителем"] },
      formats: { catalog: ["therapy_work"], custom: [] },
      methods: { catalog: ["cbt", "nvc"], custom: [] },
    };
    const parsed = parseConsultationSessionTags(raw);
    assert.deepEqual(parsed.themes.catalog, ["DEV_EMO"]);
    assert.equal(parsed.methods.catalog.length, 2);
    const ai = formatConsultationSessionTagsForAi(parsed);
    assert.match(ai, /Тематика работы/);
    assert.match(ai, /КПТ|CBT/);
  });

  it("migrates legacy theme ids to problem_key on parse", () => {
    const allowed = problemKeyAllowedMap(false);
    const parsed = parseConsultationSessionTags(
      { themes: { catalog: ["anxiety_fears"], custom: [] }, methods: { catalog: [], custom: [] } },
      allowed,
    );
    assert.deepEqual(parsed.themes.catalog, ["DEV_EMO"]);
  });

  it("toggles catalog ids and dedupes custom", () => {
    const allowed = problemKeyAllowedMap(false);
    let selection = toggleSessionTagCatalog(emptyConsultationSessionTags().themes, "PREV_BULL", allowed);
    assert.equal(selection.catalog[0], "PREV_BULL");
    selection = addCustomSessionTag(selection, "Свой запрос");
    selection = addCustomSessionTag(selection, "свой запрос");
    assert.equal(selection.custom.length, 1);
  });
});
