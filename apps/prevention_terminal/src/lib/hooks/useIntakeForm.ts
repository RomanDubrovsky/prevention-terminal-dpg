import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  EMPTY_SESSION_DRAFT,
  hasSessionDraftContent,
  newSessionRecordId,
  type SessionDraft,
  type SessionRecord,
} from "../session_records.ts";
import { buildCaseBrainContext } from "../case_brain_context.ts";
import { getCaseArtifacts, saveCaseArtifacts } from "../case_store.ts";
import {
  leadLinkFromRow,
  sessionDraftFromIdaLead,
  type CaseIdaLeadLink,
} from "../ida_intake_bridge.ts";
import { structurePrimaryIntakeFromText } from "../intake_ai.ts";
import { listLeads, type LeadRow } from "../inbox_client.ts";
import {
  loadConsultationCaseSummary,
  saveConsultationCaseSummary,
} from "../consultation_case_summary.ts";
import { reportIntakeCustomThemes } from "../taxonomy_intake_report.ts";
import type { ArchitectStageId } from "../architect_picker.ts";
import { inferIntakeThemeIdsFromCatalog } from "../client_intake_themes.ts";
import { suggestSessionTagsFromText } from "../session_tags_ai.ts";
import { problemKeyAllowedMap } from "../taxonomy_picker.ts";

export type IntakeState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "saved"; updatedAt: string }
  | { kind: "error"; message: string };

export function useIntakeForm(
  caseId: string,
  commercial: boolean,
  primaryOnly: boolean,
  terminalUserId?: string,
  subscriptionActive?: boolean,
  onPrimarySaved?: () => void
) {
  const [draft, setDraft] = useState<SessionDraft>(EMPTY_SESSION_DRAFT);
  const [records, setRecords] = useState<SessionRecord[]>([]);
  const [state, setState] = useState<IntakeState>({ kind: "loading" });
  const [caseContext, setCaseContext] = useState("");
  const [planText, setPlanText] = useState("");
  const [planSaveOk, setPlanSaveOk] = useState<string | null>(null);
  const [idaLead, setIdaLead] = useState<CaseIdaLeadLink | null>(null);
  const [inboxLeads, setInboxLeads] = useState<LeadRow[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [blockBusy, setBlockBusy] = useState<Record<string, boolean>>({});
  const [themesAiBusy, setThemesAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const loadRecords = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const rows = await invoke<SessionRecord[]>("db_list_session_records", {
        caseId,
      });
      setRecords(rows);
      setDraft(EMPTY_SESSION_DRAFT);
      setState({ kind: "idle" });
    } catch (err) {
      setState({
        kind: "error",
        message: `Не удалось загрузить приёмы: ${String(err)}`,
      });
    }
  }, [caseId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!primaryOnly || !commercial) return;
    let cancelled = false;
    void Promise.all([
      buildCaseBrainContext(caseId, { commercial }),
      loadConsultationCaseSummary(caseId),
      getCaseArtifacts(caseId),
      listLeads(undefined, 20).catch(() => [] as LeadRow[]),
    ]).then(([ctx, summary, artifacts, leads]) => {
      if (cancelled) return;
      setCaseContext(ctx);
      setPlanText(summary.plan_text || "");
      setIdaLead(artifacts.ida_lead ?? null);
      setInboxLeads(leads.filter((row) => row.status !== "closed"));
      if (artifacts.ida_lead?.lead_id) setSelectedLeadId(artifacts.ida_lead.lead_id);
    });
    return () => {
      cancelled = true;
    };
  }, [caseId, commercial, primaryOnly, records.length]);

  const primaryRecord = records.find((record) => record.session_no === 0);
  const nextIsInitial = !primaryRecord;
  const displayRecords = primaryOnly ? (primaryRecord ? [primaryRecord] : []) : records;

  const setField = useCallback((key: keyof SessionDraft, value: string) => {
    setState({ kind: "idle" });
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!hasSessionDraftContent(draft)) {
        setState({
          kind: "error",
          message: "Заполните хотя бы одно поле перед сохранением приёма.",
        });
        return;
      }
      setState({ kind: "saving" });
      try {
        await invoke("db_add_session_record", {
          recordId: newSessionRecordId(),
          caseId,
          contentJson: JSON.stringify(draft),
          isInitial: nextIsInitial,
        });
        await loadRecords();
        setState({ kind: "saved", updatedAt: "только что" });
        void reportIntakeCustomThemes({
          customThemes: draft.problemThemes?.custom || [],
          catalogKeys: draft.problemThemes?.catalog || [],
          intakeThemeIds: draft.problemThemes?.intake_theme_ids,
          commercial,
          source: "primary_intake",
        });
        onPrimarySaved?.();
      } catch (err) {
        setState({
          kind: "error",
          message: `Не удалось сохранить приём: ${String(err)}`,
        });
      }
    },
    [caseId, draft, loadRecords, nextIsInitial, commercial, onPrimarySaved],
  );

  async function handleSaveCasePlan(stage: ArchitectStageId, text: string) {
    const summary = await loadConsultationCaseSummary(caseId);
    const next = {
      ...summary,
      plan_text: stage === "plan" ? text : summary.plan_text || planText,
    };
    await saveConsultationCaseSummary(caseId, next);
    setPlanText(next.plan_text || "");
    setPlanSaveOk("План консультации сохранён в деле.");
  }

  async function handleLinkLead(leadId: string) {
    const lead = inboxLeads.find((row) => row.id === leadId);
    if (!lead) return;
    const link = leadLinkFromRow(lead);
    await saveCaseArtifacts(caseId, { ida_lead: link });
    setIdaLead(link);
    setSelectedLeadId(leadId);
  }

  function applyLeadToDraft(lead: LeadRow) {
    const { draft: partial, problemThemes } = sessionDraftFromIdaLead(lead, commercial);
    setDraft((prev) => ({
      ...prev,
      ...partial,
      problemThemes,
    }));
    setState({ kind: "idle" });
    setAiNotice("Данные из заявки IDA подставлены — проверьте поля.");
  }

  async function handleApplyIdaLead() {
    const lead =
      inboxLeads.find((row) => row.id === (selectedLeadId || idaLead?.lead_id)) ||
      (idaLead?.intake_json
        ? ({
            id: idaLead.lead_id,
            name: idaLead.name || "",
            contact: idaLead.contact || "",
            intake_json: idaLead.intake_json,
            center_id: "",
            specialist_id: null,
            source: "ida",
            user_id: null,
            status: "new",
            created_at: "",
          } satisfies LeadRow)
        : null);
    if (!lead) return;
    applyLeadToDraft(lead);
    await saveCaseArtifacts(caseId, {
      ida_lead: {
        ...leadLinkFromRow(lead),
        applied_to_primary_at: new Date().toISOString(),
      },
    });
    setIdaLead((prev) => ({
      ...(prev || leadLinkFromRow(lead)),
      applied_to_primary_at: new Date().toISOString(),
    }));
  }

  async function handleFillAiBlock(blockKey: keyof SessionDraft) {
    if (!subscriptionActive) {
      setShowPaywall(true);
      return;
    }
    const narrative = [draft.primaryDescription_notes, draft.riskNotes_notes]
      .filter((s) => s?.trim())
      .join("\n\n")
      .trim();
    if (!narrative) {
      setState({ kind: "error", message: "Напишите или надиктуйте заметки слева." });
      return;
    }
    setBlockBusy((prev) => ({ ...prev, [blockKey]: true }));
    setAiNotice(null);
    setShowPaywall(false);
    setState({ kind: "idle" });
    try {
      const result = await structurePrimaryIntakeFromText({
        text: narrative,
        caseContext,
        terminalUserId,
        lang: "ru",
      });
      const allowed = problemKeyAllowedMap(commercial);
      const themeIds = (result.theme_ids || []).filter((id) => allowed.has(id));
      const intakeThemeIds = inferIntakeThemeIdsFromCatalog(themeIds);
      setDraft((prev) => ({
        ...prev,
        contactedBy: result.segments.contactedBy || prev.contactedBy || "",
        concernFor: result.segments.concernFor || prev.concernFor || "",
        initiative: result.segments.initiative || prev.initiative || "",
        primaryDescription: blockKey === "primaryDescription" ? (result.segments.primaryDescription || prev.primaryDescription || "") : prev.primaryDescription,
        riskNotes: blockKey === "riskNotes" ? (result.segments.riskNotes || prev.riskNotes || "") : prev.riskNotes,
        problemThemes: {
          catalog: themeIds,
          custom: result.custom_themes || [],
          ...(intakeThemeIds.length ? { intake_theme_ids: intakeThemeIds } : {}),
        },
      }));
      setAiNotice(result.reply || "Поля карточки и причины обращения заполнены — проверьте и сохраните.");
    } catch (err) {
      const code = String(err);
      if (code.includes("subscription_required")) setShowPaywall(true);
      else setState({ kind: "error", message: `ИИ не смог разложить карточку: ${code}` });
    } finally {
      setBlockBusy((prev) => ({ ...prev, [blockKey]: false }));
    }
  }

  async function handleSuggestThemesFromText() {
    const narrative = [draft.primaryDescription_notes, draft.riskNotes_notes].filter((s) => s?.trim()).join("\n\n").trim();
    if (!narrative) {
      setState({
        kind: "error",
        message: "Нужен рассказ об обращении или описание — ИИ подберёт причины по тексту.",
      });
      return;
    }
    setThemesAiBusy(true);
    setAiNotice(null);
    setShowPaywall(false);
    setState({ kind: "idle" });
    try {
      const result = await suggestSessionTagsFromText({
        text: narrative,
        caseContext,
        profile: "themes_only",
        terminalUserId,
        lang: "ru",
      });
      const hasExisting = draft.problemThemes && (draft.problemThemes.catalog.length > 0 || draft.problemThemes.custom.length > 0);
      if (hasExisting) {
        setAiNotice(result.reply || "ИИ предложил рекомендации, но ваши сохраненные галочки оставлены без изменений.");
      } else {
        const allowed = problemKeyAllowedMap(commercial);
        const themeIds = (result.sessionTags.theme_ids || []).filter((id) => allowed.has(id));
        const custom = result.sessionTags.custom_themes || [];
        const intakeThemeIds = inferIntakeThemeIdsFromCatalog(themeIds);
        setDraft((prev) => ({
          ...prev,
          problemThemes: {
            catalog: themeIds,
            custom,
            ...(intakeThemeIds.length ? { intake_theme_ids: intakeThemeIds } : {}),
          },
        }));
        setAiNotice(result.reply || "Причины обращения подставлены — проверьте галочки.");
      }
    } catch (err) {
      const code = String(err);
      if (code.includes("subscription_required")) setShowPaywall(true);
      else setState({ kind: "error", message: `ИИ не смог подобрать причины: ${code}` });
    } finally {
      setThemesAiBusy(false);
    }
  }

  return {
    draft,
    setDraft,
    records,
    state,
    caseContext,
    planText,
    setPlanText,
    planSaveOk,
    idaLead,
    inboxLeads,
    selectedLeadId,
    setSelectedLeadId,
    blockBusy,
    themesAiBusy,
    aiNotice,
    setAiNotice,
    showPaywall,
    setShowPaywall,
    primaryRecord,
    nextIsInitial,
    displayRecords,
    setField,
    handleSubmit,
    handleSaveCasePlan,
    handleLinkLead,
    handleApplyIdaLead,
    handleFillAiBlock,
    handleSuggestThemesFromText,
  };
}
