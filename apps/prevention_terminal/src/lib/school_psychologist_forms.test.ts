import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSchoolFormDataStream,
  getSchoolForm,
  journalFormForActivityKind,
  packRowToFourCol,
  SCHOOL_JOURNAL_FORM_IDS,
  SCHOOL_PSYCHOLOGIST_FORM_REGISTRY,
} from "./school_psychologist_forms.ts";
import { buildSchoolFormFileName, packSchoolFormDocx } from "./school_form_docx_export.ts";

test("registry covers seven workload journals 4A–4G", () => {
  assert.equal(SCHOOL_JOURNAL_FORM_IDS.length, 7);
  for (const id of SCHOOL_JOURNAL_FORM_IDS) {
    const def = getSchoolForm(id);
    assert.equal(def.category, "workload_journal");
    assert.equal(def.fourCol.headers.length, 4);
  }
});

test("4E expert and 4G org-method are not swapped", () => {
  assert.equal(getSchoolForm("journal_4f_expert").number, "4Е");
  assert.equal(getSchoolForm("journal_4f_expert").title, "Журнал экспертной работы");
  assert.equal(getSchoolForm("journal_4g_org_method").number, "4Ж");
  assert.equal(getSchoolForm("journal_4g_org_method").title, "Журнал организационно-методической работы");
});

test("journalFormForActivityKind maps assessment to 4A", () => {
  assert.equal(journalFormForActivityKind("assessment"), "journal_4a_diagnostic");
  assert.equal(journalFormForActivityKind("consultation"), "journal_4b_consultation");
  assert.equal(journalFormForActivityKind("evaluation"), "journal_4f_expert");
  assert.equal(journalFormForActivityKind("methodology_work"), "journal_4g_org_method");
});

test("packRowToFourCol merges source columns per spec", () => {
  const def = getSchoolForm("journal_4a_diagnostic");
  const packed = packRowToFourCol(
    ["01.09.2026 10:00", "Иванов И.И.", "12", "классный руководитель", "первичная", "рекомендации"],
    def.fourCol.pack,
  );
  assert.equal(packed[0], "01.09.2026 10:00");
  assert.equal(packed[1], "Иванов И.И.; 12");
  assert.equal(packed[2], "классный руководитель; первичная");
  assert.equal(packed[3], "рекомендации");
});

test("buildSchoolFormDataStream emits ROW markers", () => {
  const { body } = buildSchoolFormDataStream("journal_4c_correction_individual", [
    ["05.09.2026", "Петров П.", "Самооценка", "—"],
  ]);
  assert.match(body, /\[ROW\]05\.09\.2026\|Петров П\.\|Самооценка\|—\[\/ROW\]/);
});

test("packSchoolFormDocx returns zip buffer for journal 4B", async () => {
  const buffer = await packSchoolFormDocx({
    formId: "journal_4b_consultation",
    sourceRows: [["1", "10:00", "К-12", "конфликт", "тревога", "лучше", ""]],
    orgName: "ГБОУ №1",
    specialistName: "Сидорова А.А.",
    periodLabel: "сентябрь 2026",
  });
  const bytes = new Uint8Array(buffer);
  assert.ok(bytes.length > 512);
  assert.equal(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]), "PK\u0003\u0004");
});

test("buildSchoolFormFileName includes form number", () => {
  assert.match(buildSchoolFormFileName("form_03b_cycleogram_school"), /^Form_3Б_/);
});

test("all registry entries have four column headers", () => {
  for (const id of Object.keys(SCHOOL_PSYCHOLOGIST_FORM_REGISTRY)) {
    const def = getSchoolForm(id as keyof typeof SCHOOL_PSYCHOLOGIST_FORM_REGISTRY);
    assert.equal(def.fourCol.headers.length, 4, id);
    assert.equal(def.fourCol.pack.length, 4, id);
  }
});
