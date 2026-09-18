import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_ARCHITECT_URL,
  requestArchitectPlan,
} from "./architect_client.ts";
import { buildMockIpr } from "./ipr_mock.ts";

function makeJsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

test("requestArchitectPlan returns worker document on 200 OK", async () => {
  const mock = buildMockIpr("case-success");
  const envelope = {
    model_mode: "mock",
    case_id: "case-success",
    generated_at: mock.generatedAt,
    ipr_document: mock,
    tokens_used: 0,
    rag_used: [],
  };

  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return makeJsonResponse(envelope);
  };

  const result = await requestArchitectPlan("case-success", {
    fetchImpl,
    baseUrl: "https://example.test/api/v1/terminal/architect",
  });

  assert.equal(result.source, "worker");
  assert.equal(result.document.caseId, "case-success");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/api/v1/terminal/architect");
  assert.equal(calls[0].init?.method, "POST");
});

test("requestArchitectPlan falls back to local plan on network error", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("ECONNREFUSED");
  };

  const result = await requestArchitectPlan("case-offline", { fetchImpl });

  assert.equal(result.source, "local-fallback");
  assert.equal(result.document.caseId, "case-offline");
  assert.match(result.notice ?? "", /Worker unreachable/);
});

test("requestArchitectPlan falls back when worker returns non-200", async () => {
  const fetchImpl: typeof fetch = async () =>
    makeJsonResponse({ error: "internal" }, { status: 500 });

  const result = await requestArchitectPlan("case-500", { fetchImpl });

  assert.equal(result.source, "local-fallback");
  assert.equal(result.document.caseId, "case-500");
  assert.match(result.notice ?? "", /HTTP 500/);
});

test("requestArchitectPlan falls back when response is missing ipr_document", async () => {
  const fetchImpl: typeof fetch = async () =>
    makeJsonResponse({ model_mode: "mock", case_id: "case-missing" });

  const result = await requestArchitectPlan("case-missing", { fetchImpl });

  assert.equal(result.source, "local-fallback");
  assert.match(result.notice ?? "", /missing `ipr_document`/);
});

test("requestArchitectPlan rejects empty case id", async () => {
  await assert.rejects(() => requestArchitectPlan("   "));
});

test("DEFAULT_ARCHITECT_URL points at terminal-api domain", () => {
  assert.match(DEFAULT_ARCHITECT_URL, /\/api\/v1\/terminal\/architect$/);
});
