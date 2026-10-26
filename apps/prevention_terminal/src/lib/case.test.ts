/**
 * Unit-тесты чистой логики «Личного дела».
 *
 * Запуск (Node 22.6+):
 *   npm run test
 *
 * Все функции, покрытые здесь, — чистые: расчёт баллов, сборка паспорта,
 * эвристика Y-уровня. UI (`CaseCreateCard.tsx`) — отдельная зона ответственности.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  activeModalities,
  buildAliasIpcPayload,
  buildAliasMap,
  buildCasePassport,
  calculateMScores,
  DETECTED_TYPE_LABEL,
  deriveYLevel,
  emptyDraft,
  newAliasId,
  newCaseId,
  sanitizeNotes,
  type AliasDraft,
} from "./case.ts";

describe("calculateMScores", () => {
  it("пустой draft даёт нули во всех группах", () => {
    const scores = calculateMScores({});
    assert.equal(scores.M1_M2_Chemical_Dependencies, 0);
    assert.equal(scores.M3_Cognitive_Autoaggression, 0);
    assert.equal(scores.M4_Social_Environment, 0);
    assert.equal(scores.M5_Environmental_Risks, 0);
  });

  it("счёт по группе равен количеству активных чек-боксов", () => {
    const checked = {
      substance_abuse: true,
      vaping_nicotine: true,
      self_harm: true,
      bullying_victim: false, // false не считается
    };
    const scores = calculateMScores(checked);
    assert.equal(scores.M1_M2_Chemical_Dependencies, 2);
    assert.equal(scores.M3_Cognitive_Autoaggression, 1);
    assert.equal(scores.M4_Social_Environment, 0);
  });

  it("неизвестные маркеры в checked игнорируются", () => {
    const scores = calculateMScores({ unknown_marker: true });
    assert.equal(scores.M1_M2_Chemical_Dependencies, 0);
    assert.equal(scores.M3_Cognitive_Autoaggression, 0);
  });
});

describe("activeModalities", () => {
  it("группа M1–M2 включает обе оси", () => {
    const mods = activeModalities({ substance_abuse: true });
    assert.deepEqual(mods.sort(), ["M1_Biology", "M2_Psychophysiology"]);
  });

  it("несколько групп → объединение модальностей", () => {
    const mods = activeModalities({
      self_harm: true,
      bullying_victim: true,
    });
    assert.deepEqual(mods.sort(), ["M3_Cognition", "M4_Social"]);
  });

  it("пустой draft → пустой массив модальностей", () => {
    assert.deepEqual(activeModalities({}), []);
  });
});

describe("deriveYLevel", () => {
  it("0 маркеров → Y1_Normal", () => {
    assert.equal(deriveYLevel(0), "Y1_Normal");
  });

  it("1..3 маркера → Y2_Risk", () => {
    assert.equal(deriveYLevel(1), "Y2_Risk");
    assert.equal(deriveYLevel(3), "Y2_Risk");
  });

  it("4+ маркеров → Y3_Problem (никогда Y4_Crisis_Clinical)", () => {
    assert.equal(deriveYLevel(4), "Y3_Problem");
    assert.equal(deriveYLevel(100), "Y3_Problem");
  });
});

describe("buildCasePassport", () => {
  it("пустой draft даёт корректный паспорт нормы", () => {
    const draft = emptyDraft();
    const p = buildCasePassport(draft);
    assert.equal(p.category_key, "generic_prevention");
    assert.equal(p.x_stage, "X2_Diag");
    assert.equal(p.y_level, "Y1_Normal");
    assert.deepEqual(p.m_modality, []);
    assert.equal(p.executor_role, "Психолог");
    assert.equal(p.org_scale, "Individual");
    assert.deepEqual(p.topic_tags, []);
  });

  it("один маркер из M4 → корректные m_modality и topic_tags", () => {
    const draft = emptyDraft();
    draft.checked.bullying_victim = true;
    const p = buildCasePassport(draft);
    assert.deepEqual(p.m_modality, ["M4_Social"]);
    assert.deepEqual(p.topic_tags, ["bullying_victim"]);
    assert.equal(p.y_level, "Y2_Risk");
  });

  it("несколько маркеров из разных групп → объединённые оси и Y3", () => {
    const draft = emptyDraft();
    draft.checked.self_harm = true;
    draft.checked.suicidal_ideation = true;
    draft.checked.family_violence = true;
    draft.checked.cyberbullying = true;
    const p = buildCasePassport(draft);
    assert.deepEqual(p.m_modality.sort(), [
      "M3_Cognition",
      "M4_Social",
      "M5_Environment",
    ]);
    assert.equal(p.topic_tags.length, 4);
    assert.equal(p.y_level, "Y3_Problem");
  });

  it("результат сериализуем (JSON.stringify не падает)", () => {
    const draft = emptyDraft();
    draft.checked.substance_abuse = true;
    const json = JSON.stringify(buildCasePassport(draft));
    assert.match(json, /"x_stage":"X2_Diag"/);
    assert.match(json, /"substance_abuse"/);
  });
});

describe("sanitizeNotes", () => {
  it("пустая строка → нулевой результат без срабатываний", () => {
    const r = sanitizeNotes("");
    assert.equal(r.sanitizedText, "");
    assert.equal(r.hasMatches, false);
    assert.deepEqual(r.detectedTypes, []);
  });

  it("только пробелы / переносы → нулевой результат, регулярки не запускаются", () => {
    const r = sanitizeNotes("   \n\t  ");
    assert.equal(r.hasMatches, false);
    assert.deepEqual(r.detectedTypes, []);
  });

  it("телефон в заметке вырезается, тип Phone попадает в отчёт", () => {
    const r = sanitizeNotes("Мама позвонила с номера +7 (495) 123-45-67 утром.");
    assert.match(r.sanitizedText, /\[Телефон\]/);
    assert.equal(r.hasMatches, true);
    assert.ok(r.detectedTypes.includes("Phone"));
  });

  it("работает с локальным словарём алиасов", () => {
    const r = sanitizeNotes("Петя пришёл на встречу.", { Петя: "[Ученик №1]" });
    assert.match(r.sanitizedText, /\[Ученик №1\]/);
    assert.ok(r.detectedTypes.includes("Name"));
  });

  it("каждый DetectedType имеет UI-метку на русском", () => {
    const expected = ["Имя", "Email", "Телефон", "Документ", "Организация", "Адрес"];
    const actual = Object.values(DETECTED_TYPE_LABEL);
    assert.deepEqual(actual, expected);
  });
});

describe("Phase 3.7 aliases", () => {
  const aliases: AliasDraft[] = [
    { aliasId: "a1", role: "student", realName: "Петя Иванов" },
    { aliasId: "a2", role: "student", realName: "Маша Сидорова" },
    { aliasId: "a3", role: "parent", realName: "Анна Иванова" },
    { aliasId: "a4", role: "teacher", realName: "Ирина Петровна" },
    { aliasId: "a5", role: "other", realName: "Сосед" },
  ];

  it("buildAliasMap нумерует участников per-role", () => {
    assert.deepEqual(buildAliasMap(aliases), {
      "Петя Иванов": "[Ученик №1]",
      "Маша Сидорова": "[Ученик №2]",
      "Анна Иванова": "[Родитель №1]",
      "Ирина Петровна": "[Учитель №1]",
      Сосед: "[Лицо №1]",
    });
  });

  it("buildAliasIpcPayload использует те же role_no, что и alias map", () => {
    assert.deepEqual(buildAliasIpcPayload(aliases), [
      {
        alias_id: "a1",
        role: "student",
        role_no: 1,
        real_name: "Петя Иванов",
      },
      {
        alias_id: "a2",
        role: "student",
        role_no: 2,
        real_name: "Маша Сидорова",
      },
      {
        alias_id: "a3",
        role: "parent",
        role_no: 1,
        real_name: "Анна Иванова",
      },
      {
        alias_id: "a4",
        role: "teacher",
        role_no: 1,
        real_name: "Ирина Петровна",
      },
      {
        alias_id: "a5",
        role: "other",
        role_no: 1,
        real_name: "Сосед",
      },
    ]);
  });

  it("пустые имена не попадают ни в alias map, ни в IPC payload", () => {
    const withDraftRows: AliasDraft[] = [
      { aliasId: "draft-1", role: "student", realName: "" },
      { aliasId: "real-1", role: "student", realName: " Петя " },
      { aliasId: "draft-2", role: "parent", realName: "   " },
    ];
    assert.deepEqual(buildAliasMap(withDraftRows), {
      Петя: "[Ученик №1]",
    });
    assert.deepEqual(buildAliasIpcPayload(withDraftRows), [
      {
        alias_id: "real-1",
        role: "student",
        role_no: 1,
        real_name: "Петя",
      },
    ]);
  });

  it("sanitizeNotes использует buildAliasMap для нескольких участников", () => {
    const map = buildAliasMap(aliases);
    const r = sanitizeNotes(
      "Петя Иванов конфликтует. Маша Сидорова тоже участвует, мама Анна Иванова просит помощи.",
      map,
    );
    assert.equal(
      r.sanitizedText,
      "[Ученик №1] конфликтует. [Ученик №2] тоже участвует, мама [Родитель №1] просит помощи.",
    );
    assert.ok(r.detectedTypes.includes("Name"));
  });
});

describe("newCaseId", () => {
  it("выдаёт уникальные значения", () => {
    const a = newCaseId();
    const b = newCaseId();
    assert.notEqual(a, b);
  });

  it("формат UUID-подобный (32 hex + 4 дефиса)", () => {
    const id = newCaseId();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("newAliasId", () => {
  it("выдаёт UUID-подобное значение", () => {
    const id = newAliasId();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
