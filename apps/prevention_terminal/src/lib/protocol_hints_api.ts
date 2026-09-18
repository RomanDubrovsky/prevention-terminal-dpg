import { platformApiBase } from "./platform_api.ts";
import { methodTagLabel } from "./session_tagging.ts";

export interface LiveProtocolHint {
  problem_key: string;
  method_tag: string;
  x_stage: string;
  status: string;
  excerpt: string;
  catalog_hit: boolean;
}

export async function fetchLiveProtocolHints(args: {
  problemKeys: string[];
  consumerApp?: "ida" | "teenology";
  xStage?: string;
}): Promise<LiveProtocolHint[]> {
  const keys = [...new Set(args.problemKeys.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!keys.length) return [];
  const res = await fetch(`${platformApiBase()}/api/terminal/protocol/hints`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      problem_keys: keys.slice(0, 6),
      consumer_app: args.consumerApp || "ida",
      x_stage: args.xStage || "X1_Problem",
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    hints?: LiveProtocolHint[];
    catalog_available?: boolean;
  };
  if (!data.ok || !data.hints) return [];
  return data.hints;
}

export function formatLiveHintMethods(hints: LiveProtocolHint[]): string {
  const methods = [
    ...new Set(
      hints
        .filter((row) => row.catalog_hit && row.method_tag)
        .map((row) => methodTagLabel(row.method_tag)),
    ),
  ];
  return methods.join(", ");
}
