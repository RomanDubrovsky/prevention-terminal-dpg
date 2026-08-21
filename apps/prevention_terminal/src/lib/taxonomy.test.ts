/**
 * Unit-тесты Phase A canon enums в taxonomy.ts.
 *
 * Цель — зафиксировать значения и их количество, чтобы любая случайная
 * правка (добавили / переименовали / удалили) сразу же ловилась тестом,
 * а не уходила в production. Эти enum'ы — контракт между Terminal и
 * `terminal-api`, и расхождение ломает агрегатный pipeline (ADR-002).
 *
 * Запуск (Node 22.6+):
 *   node --experimental-strip-types --test src/lib/taxonomy.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ACTIVITY_KIND_DEFAULT_MINUTES,
  ACTIVITY_KIND_VALUES,
  ISCED_LEVEL_VALUES,
  ORG_KIND_VALUES,
  SECTION_KIND_VALUES,
  SUBJECT_CATEGORY_VALUES,
  TASK_KIND_VALUES,
  isActivityKind,
  isIscedLevel,
  isOrgKind,
  isSectionKind,
  isSubjectCategory,
  isTaskKind,
} from "./taxonomy.ts";

describe("Phase A canon enums (service-management-model.md §5.0)", () => {
  it("TASK_KIND_VALUES: 15 значений, точный список из §Q3", () => {
    assert.equal(TASK_KIND_VALUES.length, 15);
    assert.deepEqual([...TASK_KIND_VALUES], [
      "bullying_victim",
      "bullying_aggressor",
      "self_harm_suicidal",
      "academic_motivation",
      "family_conflict",
      "family_crisis",
      "addiction_substance",
      "addiction_screen",
      "anxiety_fears",
      "depressive_state",
      "loneliness_isolation",
      "identity_self_esteem",
      "trauma_experience",
      "criminal_behavior",
      "other",
    ]);
  });

  it("ACTIVITY_KIND_VALUES: 11 значений в каноническом порядке §Q4", () => {
    assert.equal(ACTIVITY_KIND_VALUES.length, 11);
    assert.deepEqual([...ACTIVITY_KIND_VALUES], [
      "intake",
      "individual_session",
      "group_session",
      "family_session",
      "assessment",
      "consultation",
      "program_event",
      "referral",
      "evaluation",
      "methodology_work",
      "admin_other",
    ]);
  });

  it("ACTIVITY_KIND_DEFAULT_MINUTES: норматив есть для каждого вида, значения из §5.0", () => {
    for (const kind of ACTIVITY_KIND_VALUES) {
      const minutes = ACTIVITY_KIND_DEFAULT_MINUTES[kind];
      assert.equal(typeof minutes, "number", `минуты для "${kind}" должны быть числом`);
      assert.ok(minutes > 0, `минуты для "${kind}" должны быть > 0`);
      assert.ok(Number.isInteger(minutes), `минуты для "${kind}" должны быть целым`);
    }
    assert.equal(ACTIVITY_KIND_DEFAULT_MINUTES.intake, 60);
    assert.equal(ACTIVITY_KIND_DEFAULT_MINUTES.individual_session, 45);
    assert.equal(ACTIVITY_KIND_DEFAULT_MINUTES.assessment, 90);
    assert.equal(ACTIVITY_KIND_DEFAULT_MINUTES.referral, 15);
    assert.equal(ACTIVITY_KIND_DEFAULT_MINUTES.admin_other, 15);
  });

  it("SUBJECT_CATEGORY_VALUES: 6 значений из §Q5", () => {
    assert.equal(SUBJECT_CATEGORY_VALUES.length, 6);
    assert.deepEqual([...SUBJECT_CATEGORY_VALUES], [
      "normal",
      "gifted",
      "sen",
      "hardship",
      "migrant",
      "other",
    ]);
  });

  it("SECTION_KIND_VALUES: 13 секций case_view из phase-a-spec §3.4", () => {
    assert.equal(SECTION_KIND_VALUES.length, 13);
    assert.deepEqual([...SECTION_KIND_VALUES], [
      "socio_demographics",
      "housing",
      "family",
      "health",
      "personality",
      "learning",
      "leisure_employment",
      "peers",
      "digital_risks",
      "risk_blocks",
      "protective_factors",
      "referral_reasons",
      "consents",
    ]);
  });

  it("ORG_KIND_VALUES: 6 спецтипов из §Q6", () => {
    assert.equal(ORG_KIND_VALUES.length, 6);
    assert.deepEqual([...ORG_KIND_VALUES], [
      "combined_school",
      "special_education",
      "out_of_school",
      "psych_support_center",
      "private_practice",
      "other",
    ]);
  });

  it("ISCED_LEVEL_VALUES: 9 уровней UNESCO (0..8 включительно)", () => {
    assert.equal(ISCED_LEVEL_VALUES.length, 9);
    assert.deepEqual([...ISCED_LEVEL_VALUES], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("Phase A canon type-guards", () => {
  it("isTaskKind: принимает каноническое значение, отвергает мусор", () => {
    assert.equal(isTaskKind("bullying_victim"), true);
    assert.equal(isTaskKind("other"), true);
    assert.equal(isTaskKind("not_a_real_kind"), false);
    assert.equal(isTaskKind(""), false);
    assert.equal(isTaskKind(null), false);
    assert.equal(isTaskKind(undefined), false);
    assert.equal(isTaskKind(42), false);
  });

  it("isActivityKind: принимает каноническое значение, отвергает мусор", () => {
    assert.equal(isActivityKind("individual_session"), true);
    assert.equal(isActivityKind("admin_other"), true);
    assert.equal(isActivityKind("session"), false);
    assert.equal(isActivityKind(null), false);
  });

  it("isSubjectCategory: канон и мусор", () => {
    assert.equal(isSubjectCategory("sen"), true);
    assert.equal(isSubjectCategory("normal"), true);
    assert.equal(isSubjectCategory("special"), false);
  });

  it("isSectionKind: канон и мусор", () => {
    assert.equal(isSectionKind("risk_blocks"), true);
    assert.equal(isSectionKind("consents"), true);
    assert.equal(isSectionKind("risks"), false);
  });

  it("isOrgKind: канон и мусор", () => {
    assert.equal(isOrgKind("private_practice"), true);
    assert.equal(isOrgKind("psych_support_center"), true);
    assert.equal(isOrgKind("public_school"), false);
  });

  it("isIscedLevel: только целые числа 0..8", () => {
    for (let i = 0; i <= 8; i++) {
      assert.equal(isIscedLevel(i), true, `ISCED ${i} должен приниматься`);
    }
    assert.equal(isIscedLevel(-1), false);
    assert.equal(isIscedLevel(9), false);
    assert.equal(isIscedLevel(1.5), false);
    assert.equal(isIscedLevel("3"), false);
    assert.equal(isIscedLevel(null), false);
  });
});
