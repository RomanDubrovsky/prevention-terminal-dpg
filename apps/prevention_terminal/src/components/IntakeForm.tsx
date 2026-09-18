/**
 * Phase 3.12a — журнал приёмов кейса.
 *
 * Карточка (`session_no = 0`) и последующие встречи фиксируются
 * append-only записями в `session_records`. Это локальная SQLCipher-зона.
 */

import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

import SectionArchitectPanel from "./SectionArchitectPanel.tsx";
import ParticipantMarkerSelect from "./ParticipantMarkerSelect.tsx";
import PresetSelectWithCustom from "./PresetSelectWithCustom.tsx";
import SpeechDictationButton from "./SpeechDictationButton.tsx";
import AiSubscriptionPaywall from "./AiSubscriptionPaywall.tsx";
import SessionTagsEditor from "./SessionTagsEditor.tsx";
import { appendDictatedChunk } from "../lib/ai_text_utils.ts";
import {
  parseSessionContent,
  type SessionRecord,
} from "../lib/session_records.ts";
import { useTerminalSubscription } from "../lib/use_terminal_subscription.ts";
import {
  formatIntakeThemesSummary,
  intakeThemeSelectionFromDraft,
} from "../lib/client_intake_themes.ts";
import {
  contactedByPresetsForOrg,
  concernForPresetsForOrg,
  initiativePresetsForOrg,
} from "../lib/intake_field_presets.ts";
import { registryGenderChoices, registryGenderLabel } from "../lib/registry_profile.ts";
import { emptySessionTagSelection, formatSessionTagSelectionSummary } from "../lib/session_tagging.ts";
import { problemKeyLabel } from "../lib/taxonomy_picker.ts";
import { useIntakeForm } from "../lib/hooks/useIntakeForm.ts";

interface IntakeFormProps {
  caseId: string;
  embedded?: boolean;
  primaryOnly?: boolean;
  commercial?: boolean;
  terminalUserId?: string;
  onPrimarySaved?: () => void;
}

export default function IntakeForm(props: IntakeFormProps) {
  const {
    caseId,
    embedded = false,
    primaryOnly = false,
    commercial = false,
    terminalUserId,
    onPrimarySaved,
  } = props;
  const { active: subscriptionActive, paywallUrl } = useTerminalSubscription(terminalUserId);
  
  const {
    draft,
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
  } = useIntakeForm(
    caseId,
    commercial,
    primaryOnly,
    terminalUserId,
    subscriptionActive,
    onPrimarySaved
  );

  const Wrapper = embedded ? "div" : "section";
  const wrapperClass = embedded
    ? primaryOnly
      ? "intake-form-embedded intake-form-primary-only"
      : "intake-form-embedded"
    : "card workspace-card";

  return (
    <Wrapper className={wrapperClass}>
      {!primaryOnly && (
      <header className="workspace-card-header">
        <div>
          <h2>{embedded ? t("Приём и динамика", "Visit and Dynamics") : t("Приёмы и динамика", "Visits and Dynamics")}</h2>
          <p className="muted">
            {t(
              "Карточка дела, жалобы, контекст и последующие встречи — отдельными записями. История не перезаписывается.",
              "Case card, complaints, context, and follow-up sessions — as separate records. History is not overwritten.",
            )}
          </p>
        </div>
        {state.kind === "loading" && <span className="muted tiny">{t("Загрузка…", "Loading…")}</span>}
      </header>
      )}

      {primaryOnly && (
        <header className="consultation-panel-head">
          <p className="muted tiny">
            {t(
              "Карточка дела. На этой вкладке фиксируются только причины обращения (с чем пришёл клиент)! А на следующих вкладках приёмов — уже проблемы, которые психолог выбрал для решения.",
              "Case card. This tab records only the reasons for referral (what the client came with)! And the subsequent visit tabs record the problems the psychologist chose to address.",
            )}
          </p>
        </header>
      )}

      {!primaryOnly && (
      <div className="session-record-list">
        {displayRecords.length === 0 && state.kind !== "loading" ? (
          <p className="muted tiny">
            {t(
              "Приёмов пока нет. Сохраните карточку, чтобы начать историю сопровождения.",
              "No visits yet. Save the card to start the supervision history.",
            )}
          </p>
        ) : (
          displayRecords.map((record) => (
            <SessionRecordCard key={record.record_id} record={record} commercial={commercial} />
          ))
        )}
      </div>
      )}

      {primaryOnly && primaryRecord ? (
        <>
          <SessionRecordCard record={primaryRecord} expanded commercial={commercial} />
          {commercial && (
            <section className="card consultation-intake-plan">
              <h4>{t("План консультации", "Consultation Plan")}</h4>
              <p className="muted tiny">
                {t(
                  "Готовьтесь к встрече после сохранения карточки. ИИ опирается на всё дело: карточку, визиты и сохранённые экспертизы (если уже были). План можно сгенерировать до первого приёма — по заявке с сайта и заполненной карточке.",
                  "Prepare for the meeting after saving the card. AI relies on the whole case: card, visits, and saved assessments (if any). The plan can be generated before the first visit — from the website request and completed card.",
                )}
              </p>
              <SectionArchitectPanel
                terminalUserId={terminalUserId}
                subscriptionActive={subscriptionActive}
                paywallUrl={paywallUrl}
                category="consultation"
                documentContext={caseContext}
                architectContext={caseContext}
                bridgeMode="expert"
                planButtonLabel={t("План консультации", "Consultation Plan")}
                reportButtonLabel={t("Отчёт по делу", "Case Report")}
                cardSaved
                savedPlanText={planText}
                manualPlanText={planText}
                onManualPlanChange={setPlanText}
                onSaveToCard={handleSaveCasePlan}
                showReportSection={false}
                hideBranding
                panelIntro={t("Сформируйте план консультации или вставьте текст вручную.", "Generate a consultation plan or paste text manually.")}
                emphasizeModeButtons
              />
              {planSaveOk && <p className="ok tiny">{planSaveOk}</p>}
            </section>
          )}
        </>
      ) : (
      <form className="intake-grid" onSubmit={handleSubmit}>
        <div className="session-form-heading wide">
          <strong>
            {nextIsInitial ? t("Карточка", "Card") : primaryOnly ? "" : t("Новый повторный приём", "New Follow-up Visit")}
          </strong>
          {!primaryOnly && (
          <span className="muted tiny">
            {nextIsInitial
              ? t("Будет сохранён как session_no = 0.", "Will be saved as session_no = 0.")
              : t("Будет сохранён следующей записью в истории кейса.", "Will be saved as the next record in case history.")}
          </span>
          )}
        </div>

        {commercial && primaryOnly && (
          <>
            {(inboxLeads.length > 0 || idaLead) && nextIsInitial && (
              <div className="intake-ida-lead-banner wide" style={{ marginBottom: "16px" }}>
                <p className="muted tiny">
                  {t(
                    "Заявка с виджета IDA: подставьте бриф в карточку (без копирования контактов в поля протокола).",
                    "Request from IDA widget: insert brief into the card (without copying contacts into protocol fields).",
                  )}
                </p>
                {inboxLeads.length > 0 && (
                  <label className="field intake-field">
                  <span>{t("Заявка inbox", "Inbox request")}</span>
                    <select
                      value={selectedLeadId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedLeadId(id);
                        if (id) void handleLinkLead(id);
                      }}
                    >
                      <option value="">{t("Выберите заявку…", "Select request…")}</option>
                      {inboxLeads.map((lead) => (
                        <option key={lead.id} value={lead.id}>
                          {lead.name} · {lead.created_at.slice(0, 10)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className="ob-btn secondary"
                  disabled={!selectedLeadId && !idaLead?.intake_json}
                  onClick={() => void handleApplyIdaLead()}
                >
                  {t("Заполнить из заявки IDA", "Fill from IDA request")}
                </button>
              </div>
            )}

            {aiNotice && <p className="ok tiny">{aiNotice}</p>}
            {showPaywall && (
              <AiSubscriptionPaywall
                soft
                terminalUserId={terminalUserId}
                context={t("ИИ-раскладка карточки — по подписке.", "AI card parsing is available via subscription.")}
                onDismiss={() => setShowPaywall(false)}
              />
            )}

            <div className="consultation-form-section wide" style={{ marginBottom: "16px", padding: "12px 14px", background: "rgba(241, 245, 249, 0.5)", borderRadius: "8px", border: "1px solid var(--line)" }}>
              <strong style={{ fontSize: "0.85rem", color: "#475569", display: "block", marginBottom: "8px" }}>
                {t("Участники и инициатива обращения", "Participants and referral initiative")}
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                <ParticipantMarkerSelect
                  caseId={caseId}
                  commercial={commercial}
                  label={t("Кто обратился", "Who contacted")}
                  hint={t("Роль: клиент, партнёр, родитель…", "Role: client, partner, parent...")}
                  options={contactedByPresetsForOrg(commercial)}
                  value={draft.contactedBy ?? ""}
                  onChange={(v) => setField("contactedBy", v)}
                  disabled={state.kind === "saving"}
                />
                <ParticipantMarkerSelect
                  caseId={caseId}
                  commercial={commercial}
                  label={t("По поводу кого", "Regarding whom")}
                  hint={t("Фокусный участник (ребёнок, партнёр…).", "Focus participant (child, partner...).")}
                  options={concernForPresetsForOrg(commercial)}
                  value={draft.concernFor ?? ""}
                  onChange={(v) => setField("concernFor", v)}
                  disabled={state.kind === "saving"}
                />
                <PresetSelectWithCustom
                  label={t("По чьей инициативе", "Whose initiative")}
                  hint={t("Сам клиент, родственник, направление…", "Client themselves, relative, referral...")}
                  options={initiativePresetsForOrg(commercial)}
                  value={draft.initiative ?? ""}
                  onChange={(v) => setField("initiative", v)}
                  customPlaceholder={t("Свой вариант…", "Custom option...")}
                />
              </div>
            </div>
          </>
        )}

        {/* Voice dictation recommendations & guidance block */}
        <div
          className="wide"
          style={{
            marginBottom: "20px",
            padding: "14px 18px",
            background: "rgba(139, 92, 246, 0.05)",
            border: "1px solid rgba(139, 92, 246, 0.2)",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ fontSize: "1.2rem" }}>🎙️</span>
            <strong style={{ color: "#6d28d9" }}>
              {t("Голосовой ввод и рекомендации: как надиктовывать карточку", "Voice input and recommendations: how to dictate the card")}
            </strong>
          </div>
          <div style={{ fontSize: "0.88rem", color: "#334155", lineHeight: 1.5 }}>
            <p style={{ margin: "0 0 6px 0" }}>
              {t(
                "💡 Вы можете заполнять любое поле голосом с помощью кнопок «Надиктовать»:",
                "💡 You can fill out any field by voice using the \"Dictate\" buttons:"
              )}
            </p>
            <ul style={{ margin: "0 0 6px 0", paddingLeft: "20px" }}>
              <li>
                <strong>{t("Свободный рассказ:", "Free narrative:")}</strong>{" "}
                {t(
                  "Говорите связным текстом своими словами — о клиенте, его окружении, ресурсах, рисках и договоренностях.",
                  "Speak in coherent text in your own words — about the client, their environment, resources, risks and agreements."
                )}
              </li>
              <li>
                <strong>{t("Называть разделы вслух:", "Naming sections aloud:")}</strong>{" "}
                {t(
                  "Называть заголовки полей необязательно, но можно выделять их для себя (например: «Контекст: обратилась мама... Семья: двое детей... Риски: нет... План: встреча во вторник...»).",
                  "Naming field titles is optional, but you can highlight them (e.g.: \"Context: mother contacted... Family: two kids... Risks: none... Plan: meeting on Tuesday...\")."
                )}
              </li>
              <li>
                <strong>{t("Цели и план:", "Goals and plan:")}</strong>{" "}
                {t(
                  "Зафиксируйте договоренности и шаги до следующего контакта отдельной кнопкой «Надиктовать» в поле «Цели / план».",
                  "Record agreements and steps until the next contact using the dedicated \"Dictate\" button in the \"Goals / Plan\" field."
                )}
              </li>
            </ul>
          </div>
        </div>

        {/* 7 Core Card Sections */}
        <TextareaField
          label={t("Контекст / источник", "Context / Source")}
          hint={t("Кто обратился, по чьей инициативе, что привело к встрече.", "Who contacted, whose initiative, what led to the meeting.")}
          value={draft.requestSource}
          onChange={(v) => setField("requestSource", v)}
          onDictate={(chunk) => setField("requestSource", appendDictatedChunk(draft.requestSource, chunk))}
          placeholder={t("Кто обратился, по чьей инициативе, что привело к встрече.", "Who contacted, whose initiative, what led to the meeting.")}
          disabled={state.kind === "saving"}
        />
        <TextareaField
          label={t("Ситуация / динамика", "Situation / Dynamics")}
          hint={t("Что обсуждалось, что изменилось с прошлого контакта.", "What was discussed, what changed since last contact.")}
          value={draft.presentingProblem}
          onChange={(v) => setField("presentingProblem", v)}
          onDictate={(chunk) => setField("presentingProblem", appendDictatedChunk(draft.presentingProblem, chunk))}
          placeholder={t("Что обсуждалось, что изменилось с прошлого контакта.", "What was discussed, what changed since last contact.")}
          disabled={state.kind === "saving"}
        />
        <TextareaField
          label={t("Семейный контекст", "Family Context")}
          hint={t("Состав семьи, значимые взрослые, напряжения, ресурсы.", "Family members, significant adults, tensions, resources.")}
          value={draft.familyContext}
          onChange={(v) => setField("familyContext", v)}
          onDictate={(chunk) => setField("familyContext", appendDictatedChunk(draft.familyContext, chunk))}
          placeholder={t("Состав семьи, значимые взрослые, напряжения, ресурсы.", "Family members, significant adults, tensions, resources.")}
          disabled={state.kind === "saving"}
        />
        <TextareaField
          label={t("Школьный / социальный контекст", "School / Social Context")}
          hint={t("Класс, учителя, сверстники, цифровая среда, кружки.", "Grade, teachers, peers, digital environment, clubs.")}
          value={draft.schoolContext}
          onChange={(v) => setField("schoolContext", v)}
          onDictate={(chunk) => setField("schoolContext", appendDictatedChunk(draft.schoolContext, chunk))}
          placeholder={t("Класс, учителя, сверстники, цифровая среда, кружки.", "Grade, teachers, peers, digital environment, clubs.")}
          disabled={state.kind === "saving"}
        />
        <TextareaField
          label={t("Ресурсы и сильные стороны", "Resources and Strengths")}
          hint={t("Что уже помогает, на кого можно опереться.", "What already helps, who can be relied upon.")}
          value={draft.strengths}
          onChange={(v) => setField("strengths", v)}
          onDictate={(chunk) => setField("strengths", appendDictatedChunk(draft.strengths, chunk))}
          placeholder={t("Что уже помогает, на кого можно опереться.", "What already helps, who can be relied upon.")}
          disabled={state.kind === "saving"}
        />
        <TextareaField
          label={t("Риски / красные флаги", "Risks / Red Flags")}
          hint={t("Самоповреждение, насилие, зависимости, угрозы безопасности, ухудшение.", "Self-harm, violence, addictions, safety threats, deterioration.")}
          value={draft.riskNotes}
          onChange={(v) => setField("riskNotes", v)}
          onDictate={(chunk) => setField("riskNotes", appendDictatedChunk(draft.riskNotes, chunk))}
          placeholder={t("Самоповреждение, насилие, зависимости, угрозы безопасности, ухудшение.", "Self-harm, violence, addictions, safety threats, deterioration.")}
          disabled={state.kind === "saving"}
        />
        <TextareaField
          label={t("Цели / план до следующего контакта", "Goals / Plan until next contact")}
          hint={t("Что делаем дальше, кому что поручено, когда следующий контакт.", "What we do next, who is assigned to what, when next contact is.")}
          value={draft.goals}
          onChange={(v) => setField("goals", v)}
          onDictate={(chunk) => setField("goals", appendDictatedChunk(draft.goals, chunk))}
          placeholder={t("Что делаем дальше, кому что поручено, когда следующий контакт.", "What we do next, who is assigned to what, when next contact is.")}
          className="wide"
          disabled={state.kind === "saving"}
        />

        <div className="workspace-actions">
          <button type="submit" disabled={state.kind === "saving"}>
            {state.kind === "saving"
              ? t("Сохраняем…", "Saving…")
              : nextIsInitial
                ? t("Сохранить", "Save")
                : t("Добавить повторный приём", "Add Follow-up Visit")}
          </button>
          {state.kind === "saved" && (
            <span className="ok-inline">{t("Сохранено: ", "Saved: ")}{state.updatedAt}</span>
          )}
          {state.kind === "error" && <span className="error-inline">{state.message}</span>}
        </div>
      </form>
      )}
    </Wrapper>
  );
}

function SessionRecordCard(props: {
  record: SessionRecord;
  expanded?: boolean;
  commercial?: boolean;
}) {
  const { record, expanded = false, commercial = false } = props;
  const content = parseSessionContent(record.content_json);
  const title =
    record.session_no === 0
      ? t("Карточка", "Card")
      : `${t("Повторный приём №", "Follow-up Visit No.")}${record.session_no}`;

  return (
    <article className="session-record-entry">
      <header>
        <div>
          <strong>{title}</strong>
          <span className="muted tiny">{formatTimestamp(record.recorded_at)}</span>
        </div>
      </header>
      <dl>
        {expanded && (
          <>
            {content.contactedBy && <SessionValue label={t("Кто обратился", "Who contacted")} value={content.contactedBy} />}
            {content.concernSubjectGender?.trim() && content.concernSubjectGender !== "unknown" && (
              <SessionValue
                label={t("Пол объекта", "Subject gender")}
                value={registryGenderLabel(
                  content.concernSubjectGender as "male" | "female" | "unknown",
                  getTerminalEdition() === "intl" ? "en" : "ru",
                )}
              />
            )}
            {content.concernSubjectAge && <SessionValue label={t("Возраст объекта", "Subject age")} value={content.concernSubjectAge} />}
            {content.concernFor && <SessionValue label={t("По поводу кого", "Regarding whom")} value={content.concernFor} />}
            {content.initiative && <SessionValue label={t("По чьей инициативе", "Whose initiative")} value={content.initiative} />}
            {content.primaryDescription && <SessionValue label={t("Описание обращения", "Referral description")} value={content.primaryDescription} />}

            <SessionValue label={t("Контекст / источник", "Context / Source")} value={content.requestSource} />
            <SessionValue label={t("Ситуация / динамика", "Situation / Dynamics")} value={content.presentingProblem} />
            <SessionValue label={t("Семейный контекст", "Family Context")} value={content.familyContext} />
            <SessionValue label={t("Школьный / социальный контекст", "School / Social Context")} value={content.schoolContext} />
            <SessionValue label={t("Ресурсы и сильные стороны", "Resources and Strengths")} value={content.strengths} />
          </>
        )}
        <SessionValue label={t("Риски / красные флаги", "Risks / Red Flags")} value={content.riskNotes} />
        <SessionValue label={t("Цели / план до следующего контакта", "Goals / Plan until next contact")} value={content.goals} />
        {content.problemThemes && (() => {
          const themeSummary = commercial
            ? formatIntakeThemesSummary(
                intakeThemeSelectionFromDraft(content.problemThemes, commercial),
              )
            : formatSessionTagSelectionSummary(content.problemThemes, problemKeyLabel);
          return themeSummary ? (
            <>
              <dt>{t("Причины обращения", "Reasons for referral")}</dt>
              <dd>{themeSummary}</dd>
            </>
          ) : null;
        })()}
      </dl>
    </article>
  );
}

function SessionValue(props: { label: string; value: string }) {
  if (!props.value.trim()) return null;
  return (
    <>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </>
  );
}

interface TextareaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onDictate?: (chunk: string) => void;
  placeholder: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
}

function TextareaField(props: TextareaFieldProps) {
  const { label, value, onChange, onDictate, placeholder, hint, className, disabled, rows = 4 } = props;
  return (
    <div
      className={`field intake-field card-section-field${className ? ` ${className}` : ""}`}
      style={{
        marginBottom: "16px",
        background: "rgba(248, 250, 252, 0.6)",
        padding: "14px 16px",
        borderRadius: "8px",
        border: "1px solid var(--line, #e2e8f0)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text, #1e293b)" }}>{label}</span>
          {hint && <p className="muted tiny" style={{ margin: "2px 0 0 0", color: "#64748b" }}>{hint}</p>}
        </div>
        {onDictate && (
          <SpeechDictationButton
            onText={onDictate}
            disabled={disabled}
            className="ob-btn secondary tiny"
          />
        )}
      </div>
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: "100%",
          marginTop: "8px",
          borderRadius: "6px",
          border: "1px solid #cbd5e1",
          padding: "10px 12px",
          fontFamily: "inherit",
          fontSize: "0.9rem",
          background: "#fff",
          boxSizing: "border-box",
        }}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface AiSplitFieldProps {
  label: string;
  hint: string;
  textVal: string;
  notesVal: string;
  onChangeText: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onDictate: (v: string) => void;
  onGenerate: () => void;
  isBusy?: boolean;
  disabled?: boolean;
  subscriptionActive?: boolean;
  highlighted?: boolean;
  className?: string;
}

function AiSplitField(props: AiSplitFieldProps) {
  const { label, hint, textVal, notesVal, onChangeText, onChangeNotes, onDictate, onGenerate, isBusy, disabled, subscriptionActive, highlighted, className } = props;
  return (
    <div className={`summary-split-block${className ? ` ${className}` : ""}`} style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label className="field intake-field">
          <span>{label} ({t("заметки", "notes")})</span>
          <span className="muted tiny dap-field-hint">{hint}</span>
          <textarea
            value={notesVal}
            onChange={(e) => onChangeNotes(e.target.value)}
            rows={4}
          />
        </label>
        <div className="workspace-actions">
          <SpeechDictationButton
            onText={onDictate}
            disabled={disabled || isBusy}
          />
          {subscriptionActive && (
            <button
              type="button"
              className="ob-btn"
              disabled={isBusy || disabled}
              onClick={onGenerate}
            >
              {isBusy ? t("Думает…", "Thinking…") : t("Сформировать (ИИ)", "Generate (AI)")}
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <label className={`field intake-field dap-field${highlighted ? " dap-field--ai-filled" : ""}`}>
          <span>{t("Итог: ", "Result: ")}{label}</span>
          <textarea
            value={textVal}
            onChange={(e) => onChangeText(e.target.value)}
            rows={4}
          />
        </label>
      </div>
    </div>
  );
}

function formatTimestamp(raw: string): string {
  const seconds = Number.parseInt(raw, 10);
  if (!Number.isFinite(seconds)) return raw;
  return new Date(seconds * 1000).toLocaleString(getTerminalEdition() === "intl" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
