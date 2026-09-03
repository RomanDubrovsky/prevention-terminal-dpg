import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyRegistryProfile } from "./registry_profile.ts";
import type { CaseSummary } from "./case_store.ts";
import type { GroupSessionEntry } from "./group_sessions.ts";
import type { IprRecord } from "./ipr_store.ts";
import type { RegistrySubjectSummary } from "./registry_store.ts";
import {
  sortCaseSummaries,
  sortGroupSessions,
  sortIprRecords,
  sortRegistrySubjects,
} from "./workspace_list_sort.ts";

function lite(title: string, created: string, updated = created): CaseSummary {
  return {
    case_id: title,
    situation_title: title,
    situation_kind: "client",
    participant_count: 0,
    y_level: "",
    x_stage: "",
    created_at: created,
    updated_at: updated,
  };
}

function registry(name: string, created: string, updated = created): RegistrySubjectSummary {
  return {
    case_id: name,
    situation_title: name,
    situation_kind: "student",
    participant_count: 0,
    y_level: "",
    x_stage: "",
    created_at: created,
    updated_at: updated,
    profile: { ...emptyRegistryProfile(), full_name: name },
  };
}

function ipr(title: string, created: string, updated = created): IprRecord {
  return {
    id: title,
    case_id: "c1",
    title,
    description: "",
    status: "draft",
    plan_text: "",
    report_text: "",
    artifacts_json: "",
    audience_json: "",
    session_tags_json: "",
    created_at: created,
    updated_at: updated,
  };
}

function group(title: string, sessionDate: string, created = "100"): GroupSessionEntry {
  return {
    session_id: title,
    title,
    session_date: sessionDate,
    duration_minutes: 45,
    theme: "",
    notes: "",
    plan_text: "",
    report_text: "",
    artifacts_json: "",
    audience_json: "",
    prevention_link: "",
    prevention_work_types_json: "",
    session_tags_json: "",
    created_at: created,
    updated_at: created,
  };
}

describe("workspace_list_sort", () => {
  it("sorts lite cards by name and created", () => {
    const rows = [lite("Яблоко", "100"), lite("Абрикос", "200"), lite("Банан", "150")];
    assert.deepEqual(
      sortCaseSummaries(rows, "name_asc").map((r) => r.situation_title),
      ["Абрикос", "Банан", "Яблоко"],
    );
    assert.deepEqual(
      sortCaseSummaries(rows, "created_desc").map((r) => r.situation_title),
      ["Абрикос", "Банан", "Яблоко"],
    );
    assert.deepEqual(
      sortCaseSummaries(rows, "created_asc").map((r) => r.situation_title),
      ["Яблоко", "Банан", "Абрикос"],
    );
  });

  it("sorts by last visit (updated_at)", () => {
    const rows = [
      lite("a", "100", "300"),
      lite("b", "300", "100"),
      lite("c", "200", "200"),
    ];
    assert.deepEqual(
      sortCaseSummaries(rows, "updated_desc").map((r) => r.situation_title),
      ["a", "c", "b"],
    );
  });

  it("sorts registry subjects and ipr plans", () => {
    const reg = [registry("Яковлев", "1"), registry("Антонов", "2")];
    assert.deepEqual(
      sortRegistrySubjects(reg, "name_asc").map((r) => r.profile.full_name),
      ["Антонов", "Яковлев"],
    );
    const plans = [ipr("Б", "10"), ipr("А", "20")];
    assert.deepEqual(sortIprRecords(plans, "name_asc").map((r) => r.title), ["А", "Б"]);
  });

  it("sorts group sessions by session date", () => {
    const rows = [
      group("old", "2024-01-01"),
      group("new", "2026-06-01"),
      group("mid", "2025-03-01"),
    ];
    assert.deepEqual(
      sortGroupSessions(rows, "created_desc").map((r) => r.title),
      ["new", "mid", "old"],
    );
    assert.deepEqual(
      sortGroupSessions(rows, "created_asc").map((r) => r.title),
      ["old", "mid", "new"],
    );
  });
});
