import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SESSION_FORMAT_VALUES, sessionFormatLabel } from "./session_format.ts";

describe("session_format", () => {
  it("exposes clinical session format catalog", () => {
    assert.equal(SESSION_FORMAT_VALUES.length, 7);
    assert.match(sessionFormatLabel("mediation"), /Медиация/);
  });
});
