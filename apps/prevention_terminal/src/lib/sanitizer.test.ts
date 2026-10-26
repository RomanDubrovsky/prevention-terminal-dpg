/**
 * Unit-тесты локального санитайзера персональных данных.
 *
 * Запуск (Node 22.6+, TS-stripping встроенный):
 *   npm run test
 * или:
 *   node --experimental-strip-types --test src/lib/sanitizer.test.ts
 *
 * Принципы тестов:
 *   * Каждый детектор покрыт минимум одним позитивным и одним негативным кейсом.
 *   * Негативные кейсы важны не меньше — они гарантируют, что мы не вырезаем
 *     осмысленный контент (годы, артикулы, обычные числа).
 *   * Композиционный тест проверяет порядок применения детекторов.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sanitize, type AliasMap } from "./sanitizer.ts";

describe("sanitize: edge cases", () => {
  it("пустая строка возвращает пустой результат без срабатываний", () => {
    const r = sanitize("", {});
    assert.equal(r.sanitizedText, "");
    assert.equal(r.hasMatches, false);
    assert.deepEqual(r.detectedTypes, []);
  });

  it("текст без персональных данных остаётся без изменений", () => {
    const r = sanitize(
      "Подросток демонстрирует выраженную апатию на занятиях.",
      {},
    );
    assert.equal(
      r.sanitizedText,
      "Подросток демонстрирует выраженную апатию на занятиях.",
    );
    assert.equal(r.hasMatches, false);
    assert.deepEqual(r.detectedTypes, []);
  });

  it("год выпуска не подменяется как паспорт или телефон", () => {
    const r = sanitize("Программа на 2025 учебный год.", {});
    assert.equal(r.sanitizedText, "Программа на 2025 учебный год.");
    assert.equal(r.hasMatches, false);
  });
});

describe("sanitize: aliases (Фаза А)", () => {
  it("полное ФИО из словаря заменяется на маркер", () => {
    const aliases: AliasMap = { "Иванов Петр": "[Ученик №1]" };
    const r = sanitize("Иванов Петр пропустил три урока.", aliases);
    assert.equal(r.sanitizedText, "[Ученик №1] пропустил три урока.");
    assert.deepEqual(r.detectedTypes, ["Name"]);
  });

  it("короткое имя из словаря заменяется на маркер", () => {
    const aliases: AliasMap = { Петя: "[Ученик №1]" };
    const r = sanitize("Петя сказал, что устал.", aliases);
    assert.equal(r.sanitizedText, "[Ученик №1] сказал, что устал.");
  });

  it("при пересечении сначала срабатывает длинная форма", () => {
    const aliases: AliasMap = {
      "Иванов Петр": "[Ученик №1]",
      Петр: "[Ученик №1]",
    };
    const r = sanitize("Иванов Петр и его друг Петр Сидоров.", aliases);
    assert.match(r.sanitizedText, /^\[Ученик №1\] и его друг \[Ученик №1\] Сидоров\.$/);
  });

  it("частичные совпадения не срабатывают (word-boundary дружит с кириллицей)", () => {
    const aliases: AliasMap = { Петя: "[Ученик №1]" };
    const r = sanitize("ПетяКа — это никнейм, не имя.", aliases);
    assert.equal(r.sanitizedText, "ПетяКа — это никнейм, не имя.");
    assert.equal(r.hasMatches, false);
  });
});

describe("sanitize: e-mail", () => {
  it("e-mail заменяется на [Email]", () => {
    const r = sanitize("Связаться можно: parent@example.com", {});
    assert.equal(r.sanitizedText, "Связаться можно: [Email]");
    assert.deepEqual(r.detectedTypes, ["Email"]);
  });

  it("несколько e-mail подряд заменяются все", () => {
    const r = sanitize("a@b.ru, c@d.io", {});
    assert.equal(r.sanitizedText, "[Email], [Email]");
  });
});

describe("sanitize: телефон", () => {
  it("российский номер с +7 и скобками", () => {
    const r = sanitize("Звонить родителю: +7 (495) 123-45-67", {});
    assert.equal(r.sanitizedText, "Звонить родителю: [Телефон]");
    assert.deepEqual(r.detectedTypes, ["Phone"]);
  });

  it("российский номер с 8 в начале", () => {
    const r = sanitize("89991234567 — мама", {});
    assert.match(r.sanitizedText, /^\[Телефон\] — мама$/);
  });

  it("международный формат с пробелами", () => {
    const r = sanitize("Звонить +1 999 123 4567 после 18:00", {});
    assert.match(r.sanitizedText, /\[Телефон\]/);
  });

  it("обычный артикул из 5 цифр НЕ ловится как телефон", () => {
    const r = sanitize("Артикул 12345", {});
    assert.equal(r.sanitizedText, "Артикул 12345");
    assert.equal(r.hasMatches, false);
  });
});

describe("sanitize: документы (СНИЛС, паспорт)", () => {
  it("СНИЛС в формате с дефисами", () => {
    const r = sanitize("СНИЛС родителя: 123-456-789 01", {});
    assert.equal(r.sanitizedText, "СНИЛС родителя: [Документ]");
    assert.deepEqual(r.detectedTypes, ["Document"]);
  });

  it("паспорт в формате серия+номер", () => {
    const r = sanitize("Паспорт 4500 123456 выдан...", {});
    assert.match(r.sanitizedText, /^Паспорт \[Документ\] выдан\.\.\.$/);
  });

  it("паспорт со знаком №", () => {
    const r = sanitize("45 00 № 123456", {});
    assert.equal(r.sanitizedText, "[Документ]");
  });

  it("СНИЛС и паспорт в одном тексте дают один тип Document", () => {
    const r = sanitize("СНИЛС 123-456-789 01, паспорт 4500 123456.", {});
    assert.equal(r.detectedTypes.length, 1);
    assert.deepEqual(r.detectedTypes, ["Document"]);
  });
});

describe("sanitize: организации и адреса", () => {
  it("школа с номером заменяется на [Организация]", () => {
    const r = sanitize("МБОУ Школа №547 в этом районе.", {});
    assert.match(r.sanitizedText, /\[Организация\]/);
    assert.ok(r.detectedTypes.includes("Organization"));
  });

  it("гимназия с номером заменяется на [Организация]", () => {
    const r = sanitize("Гимназия 1521 переходит на пятидневку.", {});
    assert.match(r.sanitizedText, /\[Организация\]/);
  });

  it("улица с топонимом заменяется на [Адрес]", () => {
    const r = sanitize("Живёт на ул. Тверская 14, кв. 5.", {});
    assert.match(r.sanitizedText, /\[Адрес\]/);
    assert.ok(r.detectedTypes.includes("Address"));
  });

  it("город с топонимом заменяется на [Адрес]", () => {
    const r = sanitize("Переехали в г. Казань.", {});
    assert.match(r.sanitizedText, /\[Адрес\]/);
  });

  it("слово «улица» без топонима не ловится (избегаем false-positive)", () => {
    const r = sanitize("Гулял на улице с друзьями.", {});
    assert.equal(r.sanitizedText, "Гулял на улице с друзьями.");
    assert.equal(r.hasMatches, false);
  });
});

describe("sanitize: композиционный поток", () => {
  it("комбинация всех типов: aliases + email + phone + document + org + address", () => {
    const aliases: AliasMap = { "Иванов Петр": "[Ученик №1]" };
    const text = [
      "Карточка: Иванов Петр.",
      "Родитель: mom@example.com, +7 (495) 123-45-67.",
      "Документ: 4500 123456.",
      "Школа №547, г. Москва, ул. Тверская 14.",
    ].join(" ");

    const r = sanitize(text, aliases);

    // Проверяем, что в выходе нет ни одной исходной персональной записи.
    assert.doesNotMatch(r.sanitizedText, /Иванов/);
    assert.doesNotMatch(r.sanitizedText, /mom@example\.com/);
    assert.doesNotMatch(r.sanitizedText, /\+7|495/);
    assert.doesNotMatch(r.sanitizedText, /4500\s?123456/);
    assert.doesNotMatch(r.sanitizedText, /547/);
    assert.doesNotMatch(r.sanitizedText, /Тверская/);

    // Все типы должны быть обнаружены.
    const expected = new Set([
      "Name",
      "Email",
      "Phone",
      "Document",
      "Organization",
      "Address",
    ]);
    for (const t of expected) {
      assert.ok(
        r.detectedTypes.includes(t as never),
        `expected ${t} in detectedTypes, got ${JSON.stringify(r.detectedTypes)}`,
      );
    }
    assert.equal(r.hasMatches, true);
  });

  it("результат строго детерминирован: повторный вызов даёт ту же строку", () => {
    const text = "Звонок +7 999 123 45 67, mail: x@y.ru";
    const r1 = sanitize(text, {});
    const r2 = sanitize(text, {});
    assert.equal(r1.sanitizedText, r2.sanitizedText);
    assert.deepEqual(r1.detectedTypes.sort(), r2.detectedTypes.sort());
  });
});
