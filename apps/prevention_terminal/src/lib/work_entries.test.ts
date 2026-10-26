import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activityKindsForJournalTab,
  emptyWorkEntryDraft,
  totalWorkEntryMinutes,
  workEntryFieldValue,
  workEntryToSourceRow,
  type WorkEntry,
} from "./work_entries.ts";

const sampleEntry: WorkEntry = {
  entry_id: "e1",
  work_date: "2026-09-05",
  minutes_actual: 45,
  activity_kind: "assessment",
  effort_phase: "",
  title: "Скрининг тревожности",
  notes: "рекомендации родителям",
  subject_label: "Иванов П.",
  case_id: null,
  plan_id: null,
  audience_note: "12 лет",
  audience_contingent: "students",
  time_start: "10:00",
  time_end: "10:45",
  referrer: "классный руководитель",
  visit_kind: "primary",
  anonymous_code: "",
  event_form: "",
  diagnostic_kind: "первичная",
  co_executors_text: "",
  created_at: "1",
  updated_at: "1",
};

test("activityKindsForJournalTab maps 4A to assessment", () => {
  assert.deepEqual(activityKindsForJournalTab("journal_4a_diagnostic"), ["assessment"]);
  assert.deepEqual(activityKindsForJournalTab("journal_4b_consultation"), [
    "consultation",
    "family_session",
  ]);
  assert.equal(activityKindsForJournalTab("all"), null);
});

test("emptyWorkEntryDraft picks default kind for journal tab", () => {
  const d = emptyWorkEntryDraft("journal_4f_expert");
  assert.equal(d.activity_kind, "evaluation");
  assert.ok(d.minutes_actual > 0);
});

test("workEntryToSourceRow fills diagnostic journal columns", () => {
  const row = workEntryToSourceRow("journal_4a_diagnostic", sampleEntry, 1);
  assert.equal(row[0], "2026-09-05 10:00–10:45");
  assert.equal(row[1], "Иванов П.");
  assert.equal(row[2], "12 лет");
  assert.match(row[3], /классный руководитель/);
});

test("workEntryFieldValue formats consultation code", () => {
  const coded = { ...sampleEntry, anonymous_code: "К-15", activity_kind: "consultation" as const };
  assert.equal(workEntryFieldValue(coded, "subject_code", 1), "К-15");
});

test("totalWorkEntryMinutes sums positive minutes", () => {
  assert.equal(
    totalWorkEntryMinutes([
      { ...sampleEntry, minutes_actual: 30 },
      { ...sampleEntry, entry_id: "e2", minutes_actual: 45 },
    ]),
    75,
  );
});
