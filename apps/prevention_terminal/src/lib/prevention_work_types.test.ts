import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCustomWorkType,
  formatPreventionWorkTypesForAi,
  formatPreventionWorkTypesSummary,
  parsePreventionWorkTypesJson,
  PREVENTION_WORK_TYPE_CATALOG,
  preventionWorkTypesGroupedByTier,
  serializePreventionWorkTypes,
  toggleCatalogWorkType,
} from "./prevention_work_types.ts";

describe("prevention_work_types", () => {
  it("catalog mirrors guide work types", () => {
    assert.ok(PREVENTION_WORK_TYPE_CATALOG.length >= 15);
    assert.equal(PREVENTION_WORK_TYPE_CATALOG[0].id, "L1_universal_0");
  });

  it("groups catalog by prevention tier", () => {
    const grouped = preventionWorkTypesGroupedByTier();
    assert.equal(grouped.length, 3);
    assert.ok(grouped[0].links.length >= 3);
  });

  it("round-trips JSON selection", () => {
    const id = PREVENTION_WORK_TYPE_CATALOG[0].id;
    const raw = serializePreventionWorkTypes({
      catalog: [id, "unknown_id"],
      custom: ["  Школьный медиацентр  ", ""],
    });
    const parsed = parsePreventionWorkTypesJson(raw);
    assert.deepEqual(parsed.catalog, [id]);
    assert.deepEqual(parsed.custom, ["Школьный медиацентр"]);
  });

  it("toggles catalog ids and dedupes custom entries", () => {
    const id = PREVENTION_WORK_TYPE_CATALOG[1].id;
    let selection = toggleCatalogWorkType({ catalog: [], custom: [] }, id);
    assert.deepEqual(selection.catalog, [id]);
    selection = toggleCatalogWorkType(selection, id);
    assert.deepEqual(selection.catalog, []);
    selection = addCustomWorkType(selection, "Кружок");
    selection = addCustomWorkType(selection, "кружок");
    assert.equal(selection.custom.length, 1);
  });

  it("formats summary and AI block", () => {
    const id = PREVENTION_WORK_TYPE_CATALOG[0].id;
    const selection = { catalog: [id], custom: ["Свой формат"] };
    assert.match(formatPreventionWorkTypesSummary(selection), /Свой формат/);
    const ai = formatPreventionWorkTypesForAi(selection);
    assert.match(ai, /^• /m);
  });
});
