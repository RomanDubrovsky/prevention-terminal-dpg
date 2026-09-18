import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  matchConsultationCard,
  normalizePersonName,
} from "./case_participant_cards.ts";

describe("case_participant_cards", () => {
  it("normalizePersonName collapses whitespace and case", () => {
    assert.equal(normalizePersonName("  Иван   Петров "), "иван петров");
  });

  it("matchConsultationCard exact title", () => {
    const clients = [
      {
        case_id: "c1",
        title: "Иван Петров",
        kind: "lite" as const,
        created_at: "1",
        situation_kind: "",
      },
    ];
    assert.equal(matchConsultationCard("иван петров", clients)?.case_id, "c1");
  });

  it("matchConsultationCard unique partial", () => {
    const clients = [
      {
        case_id: "c1",
        title: "Иванов Пётр",
        kind: "lite" as const,
        created_at: "1",
        situation_kind: "",
      },
      {
        case_id: "c2",
        title: "Сидоров",
        kind: "lite" as const,
        created_at: "1",
        situation_kind: "",
      },
    ];
    assert.equal(matchConsultationCard("Иванов", clients)?.case_id, "c1");
  });

  it("matchConsultationCard ambiguous partial → null", () => {
    const clients = [
      {
        case_id: "c1",
        title: "Иванов Пётр",
        kind: "lite" as const,
        created_at: "1",
        situation_kind: "",
      },
      {
        case_id: "c2",
        title: "Иванов Алексей",
        kind: "lite" as const,
        created_at: "1",
        situation_kind: "",
      },
    ];
    assert.equal(matchConsultationCard("Иванов", clients), null);
  });
});
