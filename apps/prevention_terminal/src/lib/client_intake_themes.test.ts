import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  catalogFromIntakeThemeIds,
  CLIENT_INTAKE_THEMES,
  toggleIntakeTheme,
} from "./client_intake_themes.ts";

describe("client_intake_themes", () => {
  it("covers B17-style labels with canonical keys", () => {
    assert.ok(CLIENT_INTAKE_THEMES.length >= 40);
    const suicide = CLIENT_INTAKE_THEMES.find((t) => t.id === "suicide");
    assert.ok(suicide?.problemKeys.includes("PREV_VICT"));
  });

  it("toggle theme updates catalog keys", () => {
    const next = toggleIntakeTheme(
      { intake_theme_ids: [], catalog: [], custom: [] },
      "depression_apathy",
      true,
    );
    assert.deepEqual(next.intake_theme_ids, ["depression_apathy"]);
    assert.deepEqual(catalogFromIntakeThemeIds(next.intake_theme_ids, true), ["DEV_EMO"]);
  });

  it("merges keys from multiple themes", () => {
    const keys = catalogFromIntakeThemeIds(["infidelity", "divorce"], true);
    assert.ok(keys.includes("REL_FAM"));
    assert.ok(keys.includes("REL_DEP"));
  });
});
