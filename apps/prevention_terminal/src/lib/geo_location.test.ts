import assert from "node:assert/strict";
import test from "node:test";

import { parseNominatimReverse } from "./geo_location.ts";

test("parseNominatimReverse maps city and region for RU-style address", () => {
  const parsed = parseNominatimReverse({
    lat: "55.655",
    lon: "37.308",
    display_name: "Одинцово, Московская область, Россия",
    address: {
      town: "Одинцово",
      state: "Московская область",
      county: "Одинцовский городской округ",
      country_code: "ru",
    },
  });
  assert.equal(parsed.settlement, "Одинцово");
  assert.equal(parsed.region, "Московская область");
  assert.equal(parsed.municipality, "Одинцовский городской округ");
  assert.equal(parsed.country, "RU");
});
