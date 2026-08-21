import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLocalLeadSink,
  isPlatformConsultPlaceholder,
  sanitizeIdaSiteWidgets,
  stripLocalhostFromEmbedSnippet,
} from "./site_embed_public.ts";

describe("site embed public", () => {
  it("detects local lead sink", () => {
    assert.equal(isLocalLeadSink("http://127.0.0.1:47831/api/inbox"), true);
    assert.equal(isLocalLeadSink("https://inbox.example.com/api/inbox"), false);
  });

  it("strips localhost attrs from snippet", () => {
    const html =
      '<script defer data-consult-url="https://prevention.school/ida/" data-lead-sink="http://127.0.0.1:47831/api/inbox"></script>';
    const out = stripLocalhostFromEmbedSnippet(html);
    assert.equal(out.includes("data-lead-sink"), false);
    assert.equal(out.includes("data-consult-url"), false);
  });

  it("keeps real consult url", () => {
    const html = '<script data-consult-url="https://irpp-edu.ru/consultants"></script>';
    assert.match(stripLocalhostFromEmbedSnippet(html), /irpp-edu\.ru\/consultants/);
  });

  it("flags platform consult placeholder", () => {
    assert.equal(isPlatformConsultPlaceholder("https://prevention.school/ida/"), true);
    assert.equal(isPlatformConsultPlaceholder("https://irpp-edu.ru/consultants"), false);
  });

  it("sanitizes widgets bundle", () => {
    const out = sanitizeIdaSiteWidgets({
      center_id: "x",
      embed_snippet: '<script data-lead-sink="http://127.0.0.1:47831/api/inbox"></script>',
      registration_embed_snippet: "",
      iconostasis_embed_snippet: "",
      inbox_viewer_embed_snippet: '<iframe src="http://127.0.0.1:47831/inbox-viewer.html"></iframe>',
      inbox_viewer_url: "http://127.0.0.1:47831/inbox-viewer.html",
    });
    assert.equal(out.inbox_viewer_embed_snippet, "");
    assert.equal(out.embed_snippet.includes("127.0.0.1"), false);
  });

  it("keeps public sheets webhook in embed", () => {
    const out = sanitizeIdaSiteWidgets({
      center_id: "x",
      embed_snippet:
        '<script data-lead-sink="https://script.google.com/macros/s/abc/exec"></script>',
      registration_embed_snippet: "",
      iconostasis_embed_snippet: "",
      inbox_viewer_embed_snippet: "",
      inbox_viewer_url: "",
    });
    assert.match(out.embed_snippet, /script\.google\.com/);
  });
});
