import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PREVENTION_LINK_GUIDE,
  PREVENTION_LINK_LABELS_RU,
  preventionLinkGuideGrouped,
  preventionLinkLabel,
} from "./prevention_link.ts";

describe("prevention_link", () => {
  it("labels omit L1–L5 prefixes", () => {
    for (const label of Object.values(PREVENTION_LINK_LABELS_RU)) {
      assert.doesNotMatch(label, /^L[1-5]\s*[—-]/);
    }
  });

  it("guide covers all five links grouped by tier", () => {
    assert.equal(PREVENTION_LINK_GUIDE.length, 5);
    const grouped = preventionLinkGuideGrouped();
    assert.equal(grouped.length, 3);
    assert.equal(grouped[0].entries.length, 3);
    assert.equal(grouped[1].entries.length, 1);
    assert.equal(grouped[2].entries.length, 1);
  });

  it("preventionLinkLabel resolves canonical keys", () => {
    assert.equal(preventionLinkLabel("L2_selective"), "Selective Prevention");
  });
});
