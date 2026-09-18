import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateChildInLink,
  validateInviteCodeFormat,
  validateParentInLink,
} from "./federation_invite.ts";

describe("federation_invite", () => {
  it("accepts valid invite formats", () => {
    assert.equal(validateInviteCodeFormat("PARENT-ABC123"), true);
    assert.equal(validateInviteCodeFormat("child-xyz9876"), true);
  });

  it("rejects CHILD in parentIn field", () => {
    const err = validateParentInLink("CHILD-ABC123");
    assert.ok(err?.includes("PARENT"));
  });

  it("rejects PARENT in childIn field", () => {
    const err = validateChildInLink("PARENT-ABC123");
    assert.ok(err?.includes("CHILD"));
  });

  it("allows empty optional links", () => {
    assert.equal(validateParentInLink(""), null);
    assert.equal(validateChildInLink("  "), null);
  });
});
