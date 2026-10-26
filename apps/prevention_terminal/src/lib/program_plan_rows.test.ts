import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractProgramPlanTable,
  formatPlanTextFromTable,
  programPlanTableFromDataStream,
  serializeDataStreamBody,
} from "./program_plan_rows.ts";

describe("program_plan_rows", () => {
  it("parses DATA_STREAM rows with header row", () => {
    const body = [
      "[ROW]Направление|Мероприятие|Срок|Охват|Ответственный[/ROW]",
      "[ROW]Буллинг|Классный час|октябрь|25 чел|классный руководитель[/ROW]",
      "[ROW]Кибербезопасность|Лекция|ноябрь|120 чел|психолог[/ROW]",
    ].join("\n");
    const table = programPlanTableFromDataStream(body);
    assert.equal(table.headers[0], "Направление");
    assert.equal(table.rows.length, 2);
    assert.equal(table.rows[0][1], "Классный час");
  });

  it("round-trips through serializeDataStreamBody", () => {
    const table = programPlanTableFromDataStream(
      "[ROW]Буллинг|Классный час|октябрь|25|психолог[/ROW]",
    );
    const body = serializeDataStreamBody(table);
    assert.match(body, /\[ROW\]Буллинг\|Классный час/);
    const again = programPlanTableFromDataStream(body);
    assert.equal(again.rows[0][1], "Классный час");
  });

  it("extracts from architect segments", () => {
    const table = extractProgramPlanTable({
      segments: {
        data_stream_body: "[ROW]L1|Тренинг|сентябрь|30|куратор[/ROW]",
      },
    });
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0][0], "L1");
  });

  it("formats human-readable plan summary", () => {
    const text = formatPlanTextFromTable({
      headers: ["Направление", "Мероприятие"],
      rows: [["Буллинг", "Классный час"]],
    });
    assert.match(text, /План мероприятий/);
    assert.match(text, /Классный час/);
  });
});
