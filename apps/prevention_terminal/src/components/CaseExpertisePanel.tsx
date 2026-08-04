import { useCallback, useEffect, useMemo, useState } from "react";

import SectionExpertPanel, { type SectionExpertProtocolOption } from "./SectionExpertPanel.tsx";
import { buildCaseBrainContext } from "../lib/case_brain_context.ts";
import {
  getParticipantExpert,
  setParticipantExpert,
} from "../lib/case_expert_store.ts";
import {
  listCaseParticipants,
  participantMarker,
  type CaseParticipant,
} from "../lib/case_participants.ts";
import { getCaseArtifacts, saveCaseArtifacts, type CaseArtifactsPayload } from "../lib/case_store.ts";
import { sendAiTurn } from "../lib/ai_workspace.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import {
  type ExpertArtifact,
  type ExpertProtocolId,
} from "../lib/section_artifacts.ts";
import { getDomainConfig } from "../lib/domain/index.ts";



interface CaseExpertisePanelProps {
  caseId: string;
  terminalUserId?: string;
  commercial?: boolean;
  protocolFilter?: SectionExpertProtocolOption[];
  onExpertUpdated?: () => void;
  /** Без внешней карточки — когда блок уже обёрнут родителем. */
  embedded?: boolean;
  /** Скрыть заголовок/интро (редко). По умолчанию показываем. */
  hideHeading?: boolean;
  title?: string;
  intro?: string;
  activeAliasId?: string;
  onActiveAliasIdChange?: (aliasId: string) => void;
}

export default function CaseExpertisePanel(props: CaseExpertisePanelProps) {
  const {
    caseId,
    terminalUserId,
    commercial = false,
    protocolFilter,
    onExpertUpdated,
    embedded = false,
    hideHeading = false,
    title = "Экспертизы",
    intro =
      "Индивидуальные заключения. Результат сохраняется в карточку (текст + структура для учёта).",
    activeAliasId,
    onActiveAliasIdChange,
  } = props;
  const { active: subscriptionActive, paywallUrl } = useTerminalSubscription(terminalUserId);

  const [documentContext, setDocumentContext] = useState("");
  const [artifacts, setArtifacts] = useState<CaseArtifactsPayload>({});
  const [participants, setParticipants] = useState<CaseParticipant[]>([]);
  const [localFocusAliasId, setLocalFocusAliasId] = useState<string>("");
  const focusAliasId = activeAliasId !== undefined ? activeAliasId : localFocusAliasId;
  const setFocusAliasId = onActiveAliasIdChange || setLocalFocusAliasId;
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [synthBusy, setSynthBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [payload, plist, brain] = await Promise.all([
        getCaseArtifacts(caseId),
        listCaseParticipants(caseId),
        buildCaseBrainContext(caseId, { commercial }),
      ]);
      setArtifacts(payload);
      setParticipants(plist);
      setDocumentContext(brain);
      let nextFocus = "";
      if (plist.length > 1) {
        if (focusAliasId && plist.some((p) => p.alias_id === focusAliasId)) {
          nextFocus = focusAliasId;
        }
      }
      setFocusAliasId(nextFocus);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [caseId, commercial]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const savedExpert = useMemo(() => {
    if (focusAliasId) return getParticipantExpert(artifacts, focusAliasId);
    return artifacts.expert || {};
  }, [artifacts, focusAliasId]);

  const focusLabel = useMemo(() => {
    if (!focusAliasId) return "всё дело";
    const p = participants.find((x) => x.alias_id === focusAliasId);
    return p ? participantMarker(p.role, p.role_no) : focusAliasId;
  }, [focusAliasId, participants]);

  async function handleSaveExpert(protocolId: ExpertProtocolId, artifact: ExpertArtifact) {
    let next: CaseArtifactsPayload;
    if (focusAliasId) {
      next = setParticipantExpert(artifacts, focusAliasId, protocolId, artifact);
    } else {
      next = {
        ...artifacts,
        expert: { ...(artifacts.expert || {}), [protocolId]: artifact },
      };
    }
    const saved = await saveCaseArtifacts(caseId, next);
    setArtifacts(saved);
    setSaveOk(`Экспертиза (${focusLabel}) сохранена в деле.`);
    onExpertUpdated?.();
    await reload();
  }

  async function handleSituationSynthesis() {
    if (!subscriptionActive) return;
    setSynthBusy(true);
    setError(null);
    try {
      const lang = getTerminalEdition() === "ru" ? "ru" : "en";
      const result = await sendAiTurn({
        mode: "consultant",
        consultantSub: "case",
        message:
          "Сопоставь профили участников, внешние сигналы и контекст дела. Дай психологу краткий синтез ситуации и 5–7 приоритетных шагов. Без подмены очной работы.",
        context: documentContext,
        terminalUserId,
        lang,
      });
      const text = result.raw_text?.trim() || result.reply.trim();
      const saved = await saveCaseArtifacts(caseId, {
        situation_synthesis: { text, saved_at: new Date().toISOString() },
      });
      setArtifacts(saved);
      setSaveOk("Синтез по ситуации сохранён в деле.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSynthBusy(false);
    }
  }

  const protocols = protocolFilter ?? getDomainConfig().protocols.caseExpertise as { id: ExpertProtocolId, label: string, hint?: string }[];
  /** Tabs «Общее / [Клиент №N]» only for multi-party situations — not for a single consultation card. */
  const showParticipantFocus = participants.length > 1;
  const showSituationSynthesis = showParticipantFocus && !commercial;

  const body = (
    <>
      {!hideHeading && <h3>{title}</h3>}
      {!hideHeading && <p className="muted tiny">{intro}</p>}

      {showParticipantFocus && (
        <div className="case-participant-focus" role="tablist" aria-label="Фокус экспертизы">
          <button
            type="button"
            role="tab"
            className={`case-participant-focus-btn${!focusAliasId ? " active" : ""}`}
            onClick={() => setFocusAliasId("")}
          >
            Общее по делу
          </button>
          {participants.map((p) => (
            <button
              key={p.alias_id}
              type="button"
              role="tab"
              className={`case-participant-focus-btn${focusAliasId === p.alias_id ? " active" : ""}`}
              onClick={() => setFocusAliasId(p.alias_id)}
            >
              {participantMarker(p.role, p.role_no)}
            </button>
          ))}
        </div>
      )}

      {showSituationSynthesis && (
        <div className="case-synthesis-row">
          <button
            type="button"
            className="ob-btn secondary"
            disabled={synthBusy || !subscriptionActive}
            onClick={() => void handleSituationSynthesis()}
          >
            {synthBusy ? "ИИ анализирует…" : "Синтез по ситуации (ИИ)"}
          </button>
          {!subscriptionActive && (
            <span className="muted tiny">по подписке ИИ · {paywallUrl}</span>
          )}
        </div>
      )}

      {artifacts.situation_synthesis?.text && showParticipantFocus && (
        <details className="case-synthesis-preview">
          <summary className="muted tiny">Сохранённый синтез по ситуации</summary>
          <p className="ai-reply compact">{artifacts.situation_synthesis.text}</p>
        </details>
      )}

      {saveOk && <p className="ok tiny">{saveOk}</p>}
      <SectionExpertPanel
        terminalUserId={terminalUserId}
        subscriptionActive={subscriptionActive}
        paywallUrl={paywallUrl}
        documentContext={`${documentContext}\n\nФокус экспертизы: ${focusLabel}`}
        protocols={protocols}
        savedExpert={savedExpert}
        cardSaved
        showFixInArchitect={false}
        hideTitle
        handoffNotice={handoffNotice}
        onHandoffToArchitect={(msg) => setHandoffNotice(msg)}
        onHandoffConsumed={() => setHandoffNotice(null)}
        onSaveExpert={handleSaveExpert}
      />
      {error && <p className="ai-error">{error}</p>}
    </>
  );

  if (embedded) {
    return <div className="case-expertise-panel case-expertise-panel--embedded">{body}</div>;
  }
  return <section className="card case-expertise-panel">{body}</section>;
}
