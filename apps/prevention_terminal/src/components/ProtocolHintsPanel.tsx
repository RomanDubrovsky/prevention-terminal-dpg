import { useEffect, useMemo, useState } from "react";

import { protocolHintsForThemes, type ProtocolHintLine } from "../lib/protocol_hints.ts";
import {
  fetchLiveProtocolHints,
  formatLiveHintMethods,
  type LiveProtocolHint,
} from "../lib/protocol_hints_api.ts";
import { methodTagLabel } from "../lib/session_tagging.ts";
import { problemKeyLabel } from "../lib/taxonomy_picker.ts";

interface ProtocolHintsPanelProps {
  themeIds: string[];
  /** Подгружать dialogue-протоколы из Postgres (IDA Kit). */
  liveCatalog?: boolean;
  consumerApp?: "ida" | "teenology";
}

function mergeHints(staticHints: ProtocolHintLine[], live: LiveProtocolHint[]): ProtocolHintLine[] {
  if (!live.length) return staticHints;
  const liveByKey = new Map<string, LiveProtocolHint[]>();
  for (const row of live) {
    const key = row.problem_key;
    if (!liveByKey.has(key)) liveByKey.set(key, []);
    liveByKey.get(key)!.push(row);
  }
  return staticHints.map((row) => {
    const rows = liveByKey.get(row.problemKey) || [];
    const hits = rows.filter((item) => item.catalog_hit);
    if (!hits.length) return row;
    const methods = formatLiveHintMethods(hits);
    const stage = hits[0]?.x_stage || row.idaStage;
    const excerpt = hits.find((item) => item.excerpt)?.excerpt || "";
    const catalogNote = hits
      .map((item) => `${methodTagLabel(item.method_tag)}/${item.x_stage}`)
      .join(", ");
    return {
      ...row,
      methods: methods ? methods.split(", ") : row.methods,
      idaStage: stage,
      note: excerpt
        ? `${row.note} Каталог: ${catalogNote}. ${excerpt}`
        : `${row.note} Каталог IDA: ${catalogNote}.`,
    };
  });
}

export default function ProtocolHintsPanel(props: ProtocolHintsPanelProps) {
  const { themeIds, liveCatalog = false, consumerApp = "ida" } = props;
  const staticHints = useMemo(() => protocolHintsForThemes(themeIds), [themeIds]);
  const [liveHints, setLiveHints] = useState<LiveProtocolHint[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!liveCatalog || themeIds.length === 0) {
      setLiveHints([]);
      setLiveError(null);
      return;
    }
    let cancelled = false;
    void fetchLiveProtocolHints({ problemKeys: themeIds, consumerApp })
      .then((rows) => {
        if (!cancelled) {
          setLiveHints(rows);
          setLiveError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLiveHints([]);
          setLiveError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [consumerApp, liveCatalog, themeIds]);

  const hints = useMemo(() => mergeHints(staticHints, liveHints), [liveHints, staticHints]);
  if (!hints.length) return null;

  return (
    <div className="protocol-hints-panel wide">
      <p className="muted tiny">
        Подсказки по каталогу IDA: формат сессии и стадия sprint — ориентир, не замена вашей оценки.
        {liveCatalog && liveHints.some((row) => row.catalog_hit) && " · из каталога protocols"}
      </p>
      {liveError && <p className="muted tiny">Каталог недоступен — показаны локальные подсказки.</p>}
      <ul className="protocol-hints-list">
        {hints.map((row) => (
          <li key={row.problemKey}>
            <strong>{row.problemLabel || problemKeyLabel(row.problemKey)}</strong>
            <span className="muted tiny">
              Формат: {row.formats.join(", ")} · Подходы: {row.methods.join(", ")} · IDA:{" "}
              {row.idaStage}
            </span>
            <p className="tiny">{row.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
