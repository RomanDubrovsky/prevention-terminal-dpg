import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { protocolHintsForThemes } from "./protocol_hints.ts";

describe("protocol_hints", () => {
  it("returns hints for known problem keys", () => {
    const hints = protocolHintsForThemes(["REL_FAM", "UNKNOWN"]);
    assert.equal(hints.length, 2);
    assert.match(hints[0].problemLabel, /семь/i);
    assert.ok(hints[0].formats.length > 0);
  });
});
