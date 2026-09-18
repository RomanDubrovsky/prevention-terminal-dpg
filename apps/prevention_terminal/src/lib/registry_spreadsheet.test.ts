import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyRegistryProfile } from "./registry_profile.ts";
import {
  parseRegistrySpreadsheet,
  registrySubjectsToCsv,
} from "./registry_spreadsheet.ts";
import type { RegistrySubjectSummary } from "./registry_store.ts";

function subject(fullName: string, phone = ""): RegistrySubjectSummary {
  return {
    case_id: "c1",
    situation_title: fullName,
    situation_kind: "client",
    participant_count: 0,
    y_level: "",
    x_stage: "",
    created_at: "1700000000",
    updated_at: "1700000000",
    profile: { ...emptyRegistryProfile(), full_name: fullName, phone },
  };
}

describe("registry spreadsheet", () => {
  it("exports and parses round-trip with russian headers", () => {
    const csv = registrySubjectsToCsv([
      subject("Иванова Анна", "+79991234567"),
    ]);
    assert.match(csv, /ФИО/);
    assert.match(csv, /Иванова Анна/);

    const parsed = parseRegistrySpreadsheet(csv);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.profiles.length, 1);
    assert.equal(parsed.profiles[0].full_name, "Иванова Анна");
    assert.equal(parsed.profiles[0].phone, "+79991234567");
  });

  it("accepts semicolon delimiter from Excel RU locale", () => {
    const csv = "\uFEFFФИО;Телефон;Email\r\nПетров Пётр;+7111;test@mail.ru\r\n";
    const parsed = parseRegistrySpreadsheet(csv);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.profiles[0].full_name, "Петров Пётр");
    assert.equal(parsed.profiles[0].email, "test@mail.ru");
  });

  it("maps english CRM headers", () => {
    const csv = "full_name,phone,notes\r\nJane Doe,+1000,from CRM\r\n";
    const parsed = parseRegistrySpreadsheet(csv);
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.profiles[0].full_name, "Jane Doe");
    assert.equal(parsed.profiles[0].notes, "from CRM");
  });

  it("requires FIO column", () => {
    const parsed = parseRegistrySpreadsheet("phone,email\r\n+1,a@b.c\r\n");
    assert.ok(parsed.errors.length > 0);
    assert.equal(parsed.profiles.length, 0);
  });
});
