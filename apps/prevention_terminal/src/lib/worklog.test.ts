/**
 * Unit-тесты чистой логики журнала действий (Phase 3.8).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatWorkDuration,
  newWorkLogEntryId,
  totalWorkMinutes,
  WORK_LOG_ACTION_LABEL,
  WORK_LOG_ACTIONS,
} from "./worklog.ts";

describe("totalWorkMinutes", () => {
  it("суммирует минуты по записям", () => {
    assert.equal(
      totalWorkMinutes([{ minutes: 45 }, { minutes: 30 }, { minutes: 90 }]),
      165,
    );
  });

  it("игнорирует отрицательные и нечисловые значения", () => {
    assert.equal(
      totalWorkMinutes([
        { minutes: 30 },
        { minutes: -10 },
        { minutes: Number.NaN },
      ]),
      30,
    );
  });
});

describe("formatWorkDuration", () => {
  it("форматирует минуты без часов", () => {
    assert.equal(formatWorkDuration(45), "45 мин");
  });

  it("форматирует ровные часы", () => {
    assert.equal(formatWorkDuration(120), "2 ч");
  });

  it("форматирует часы и минуты", () => {
    assert.equal(formatWorkDuration(135), "2 ч 15 мин");
  });
});

describe("WORK_LOG_ACTIONS", () => {
  it("каждый action имеет русскую UI-метку", () => {
    for (const action of WORK_LOG_ACTIONS) {
      assert.ok(WORK_LOG_ACTION_LABEL[action].length > 0);
    }
  });
});

describe("newWorkLogEntryId", () => {
  it("выдаёт UUID-подобное значение", () => {
    assert.match(
      newWorkLogEntryId(),
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
