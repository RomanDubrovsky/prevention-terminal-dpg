import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_SESSION_DRAFT,
  hasSessionDraftContent,
  parseSessionContent,
} from "./session_records.ts";

test("hasSessionDraftContent ignores whitespace-only drafts", () => {
  assert.equal(hasSessionDraftContent(EMPTY_SESSION_DRAFT), false);
  assert.equal(
    hasSessionDraftContent({ ...EMPTY_SESSION_DRAFT, goals: "   " }),
    false,
  );
});

test("hasSessionDraftContent accepts any meaningful field", () => {
  assert.equal(
    hasSessionDraftContent({
      ...EMPTY_SESSION_DRAFT,
      presentingProblem: "Конфликт в классе",
    }),
    true,
  );
});

test("parseSessionContent fills missing fields and rejects malformed JSON", () => {
  assert.deepEqual(
    parseSessionContent('{"requestSource":"мама","goals":"снизить тревогу"}'),
    {
      ...EMPTY_SESSION_DRAFT,
      requestSource: "мама",
      goals: "снизить тревогу",
    },
  );
  assert.deepEqual(parseSessionContent("{not json"), EMPTY_SESSION_DRAFT);
});
