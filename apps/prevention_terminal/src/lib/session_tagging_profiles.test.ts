import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyAiSessionTagsSuggestion,
  parseSessionTagsJson,
  serializeSessionTags,
} from "./session_tagging.ts";

describe("session_tagging profiles", () => {
  it("serializes and parses session tags json", () => {
    const raw = serializeSessionTags({
      themes: { catalog: ["DEV_EMO"], custom: [] },
      formats: { catalog: ["therapy_work"], custom: [] },
      methods: { catalog: ["cbt"], custom: [] },
    });
    const parsed = parseSessionTagsJson(raw);
    assert.deepEqual(parsed.themes.catalog, ["DEV_EMO"]);
    assert.deepEqual(parsed.formats.catalog, ["therapy_work"]);
  });

  it("applies AI suggestion for group profile without methods", () => {
    const next = applyAiSessionTagsSuggestion(
      {
        themes: { catalog: [], custom: [] },
        formats: { catalog: [], custom: [] },
        methods: { catalog: ["cbt"], custom: [] },
      },
      { theme_ids: ["PREV_BULL"], method_ids: ["nvc"] },
      "group",
    );
    assert.deepEqual(next.themes.catalog, ["PREV_BULL"]);
    assert.deepEqual(next.methods.catalog, []);
  });

  it("appends AI suggestion in consultation profile", () => {
    const next = applyAiSessionTagsSuggestion(
      {
        themes: { catalog: ["DEV_EMO"], custom: [] },
        formats: { catalog: [], custom: [] },
        methods: { catalog: [], custom: [] },
      },
      { theme_ids: ["REL_FAM"], method_ids: ["nvc"] },
      "consultation",
      "append",
    );
    assert.equal(next.themes.catalog.length, 2);
    assert.deepEqual(next.methods.catalog, ["nvc"]);
  });
});
