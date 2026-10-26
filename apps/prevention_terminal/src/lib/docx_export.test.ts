import assert from "node:assert/strict";
import { test } from "node:test";

import { buildIprFileName, packIprDocx } from "./docx_export.ts";
import { buildMockIpr } from "./ipr_mock.ts";

test("buildMockIpr returns canonical demo payload without raw PII", () => {
  const data = buildMockIpr("case-123", new Date("2026-05-22T00:00:00Z"));

  assert.equal(data.caseId, "case-123");
  assert.equal(data.modelMode, "mock");
  assert.ok(data.contextSummary.length >= 2);
  assert.ok(data.recommendations.length >= 3);
  assert.match(JSON.stringify(data), /\[Ученик №1\]/);
});

test("buildIprFileName sanitizes unsafe characters", () => {
  assert.equal(
    buildIprFileName("case:123/unsafe name"),
    "IPR_case-123-unsafe-name_demo.docx",
  );
});

test("packIprDocx returns a DOCX/ZIP buffer", async () => {
  const buffer = await packIprDocx(buildMockIpr("case-zip"));
  const bytes = new Uint8Array(buffer);

  assert.ok(bytes.length > 1024);
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), "PK\u0003\u0004");
});
