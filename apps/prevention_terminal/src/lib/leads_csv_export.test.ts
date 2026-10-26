import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { leadsToCsv } from "./leads_csv_export.ts";

describe("leads csv export", () => {
  it("builds csv with header", () => {
    const csv = leadsToCsv([
      {
        id: "1",
        center_id: "c",
        name: "Иван",
        contact: "+7999",
        specialist_id: null,
        intake_json: '{"history":"тест"}',
        source: "center_embed",
        user_id: null,
        status: "new",
        created_at: "1710000000",
      },
    ]);
    assert.match(csv, /created_at/);
    assert.match(csv, /Иван/);
  });
});
