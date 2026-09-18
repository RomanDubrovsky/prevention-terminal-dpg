import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ARCHITECT_DOC_REGISTRY,
  resolveArchitectDocType,
  parseArchitectDocType,
} from "./architect_picker.ts";

describe("architect picker", () => {
  it("maps categories to backend doc_type ids", () => {
    assert.equal(resolveArchitectDocType("consultation", "plan"), "consultation_plan");
    assert.equal(resolveArchitectDocType("group", "report"), "group_report");
    assert.equal(resolveArchitectDocType("safety", "plan"), "organization_plan");
    assert.equal(resolveArchitectDocType("ipr", "plan"), "ipr_plan");
  });

  it("round-trips all registry entries", () => {
    for (const docType of Object.keys(ARCHITECT_DOC_REGISTRY)) {
      const parsed = parseArchitectDocType(docType);
      assert.ok(parsed, docType);
      assert.equal(resolveArchitectDocType(parsed!.category, parsed!.stage), docType);
    }
  });
});
