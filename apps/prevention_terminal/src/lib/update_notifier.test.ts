import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_UPDATE_MANIFEST_URL,
  checkForTerminalUpdate,
  compareVersions,
} from "./update_notifier.ts";

function makeManifest(version: string) {
  return {
    schema_version: 1,
    product: "prevention-terminal",
    channel: "demo",
    version,
    published_at: "2026-05-22T00:00:00Z",
    download_url: "https://prevention.school/terminal/downloads/prevention-terminal-demo.msi",
    notes_url: "https://prevention.school/terminal/",
    message: "Доступна новая демо-сборка Терминала.",
  };
}

function makeJsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

test("compareVersions handles common semantic versions", () => {
  assert.equal(compareVersions("0.0.2", "0.0.1"), 1);
  assert.equal(compareVersions("v1.2.0", "1.2"), 0);
  assert.equal(compareVersions("1.9.0", "1.10.0"), -1);
});

test("checkForTerminalUpdate returns update-available for newer manifest", async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return makeJsonResponse(makeManifest("0.0.2"));
  };

  const result = await checkForTerminalUpdate("0.0.1", {
    fetchImpl,
    manifestUrl: "https://example.test/latest.json",
  });

  assert.equal(result.status, "update-available");
  assert.equal(result.latest?.version, "0.0.2");
  assert.equal(calls[0].url, "https://example.test/latest.json");
  assert.equal(calls[0].init?.method, "GET");
});

test("checkForTerminalUpdate returns up-to-date for same manifest version", async () => {
  const fetchImpl: typeof fetch = async () => makeJsonResponse(makeManifest("0.0.1"));

  const result = await checkForTerminalUpdate("0.0.1", { fetchImpl });

  assert.equal(result.status, "up-to-date");
});

test("checkForTerminalUpdate fails softly on network error", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("offline");
  };

  const result = await checkForTerminalUpdate("0.0.1", { fetchImpl });

  assert.equal(result.status, "unavailable");
  assert.match(result.notice ?? "", /offline/);
});

test("checkForTerminalUpdate fails softly on non-200 manifest response", async () => {
  const fetchImpl: typeof fetch = async () =>
    makeJsonResponse({ error: "not found" }, { status: 404 });

  const result = await checkForTerminalUpdate("0.0.1", { fetchImpl });

  assert.equal(result.status, "unavailable");
  assert.match(result.notice ?? "", /HTTP 404/);
});

test("checkForTerminalUpdate rejects an unexpected manifest shape as unavailable", async () => {
  const fetchImpl: typeof fetch = async () =>
    makeJsonResponse({ schema_version: 1, product: "other-app" });

  const result = await checkForTerminalUpdate("0.0.1", { fetchImpl });

  assert.equal(result.status, "unavailable");
  assert.match(result.notice ?? "", /Unexpected update manifest product/);
});

test("DEFAULT_UPDATE_MANIFEST_URL points at prevention.school terminal manifest", () => {
  assert.equal(DEFAULT_UPDATE_MANIFEST_URL, "https://prevention.school/terminal/latest.json");
});
