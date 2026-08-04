import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyRegistryProfile,
  normalizeRegistryGenderForLocale,
  parseRegistryProfile,
  registryGenderChoices,
  registryGenderLabel,
} from "./registry_profile.ts";
import {
  filterRegistrySubjectsByFio,
  type RegistrySubjectSummary,
} from "./registry_store.ts";

function subject(name: string, caseId = "c1"): RegistrySubjectSummary {
  return {
    case_id: caseId,
    situation_title: name,
    situation_kind: "student",
    updated_at: "1",
    profile: { ...emptyRegistryProfile(), full_name: name },
  };
}

describe("registry profile parse", () => {
  it("fills contact fields with defaults for legacy cards", () => {
    const parsed = parseRegistryProfile({ full_name: "Иванов", gender: "male" });
    assert.equal(parsed.phone, "");
    assert.equal(parsed.email, "");
    assert.equal(parsed.address, "");
    assert.equal(parsed.contact_person, "");
  });

  it("round-trips extended contact fields", () => {
    const parsed = parseRegistryProfile({
      full_name: "Петров",
      phone: "+7 900 111-22-33",
      email: "a@b.ru",
      address: "Москва",
      contact_person: "Мама",
    });
    assert.equal(parsed.phone, "+7 900 111-22-33");
    assert.equal(parsed.email, "a@b.ru");
    assert.equal(parsed.address, "Москва");
    assert.equal(parsed.contact_person, "Мама");
  });
});

describe("registry gender locale", () => {
  it("hides «other» in Russian UI choices", () => {
    assert.deepEqual(registryGenderChoices("ru"), ["unknown", "male", "female"]);
    assert.ok(registryGenderChoices("en").includes("other"));
  });

  it("maps stored other to unknown in Russian", () => {
    assert.equal(normalizeRegistryGenderForLocale("other", "ru"), "unknown");
    assert.equal(normalizeRegistryGenderForLocale("other", "en"), "other");
    assert.equal(registryGenderLabel("other", "ru"), "Не указан");
  });
});

describe("filterRegistrySubjectsByFio", () => {
  it("requires at least two characters", () => {
    const rows = [subject("Иванов Иван")];
    assert.deepEqual(filterRegistrySubjectsByFio(rows, "И"), []);
    assert.equal(filterRegistrySubjectsByFio(rows, "Ив").length, 1);
  });

  it("excludes current card when editing", () => {
    const rows = [subject("Иванов Иван", "a"), subject("Иванов Петр", "b")];
    assert.equal(filterRegistrySubjectsByFio(rows, "Иванов", "a").length, 1);
    assert.equal(filterRegistrySubjectsByFio(rows, "Иванов", "a")[0]?.case_id, "b");
  });
});
