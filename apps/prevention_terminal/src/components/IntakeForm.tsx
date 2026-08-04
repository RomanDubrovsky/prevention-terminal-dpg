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
  CONTACTED_BY_PRESETS,
  CONCERN_FOR_PRESETS,
  INITIATIVE_PRESETS,
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

        {commercial && primaryOnly ? (
          <>
            {(inboxLeads.length > 0 || idaLead) && nextIsInitial && (
              <div className="intake-ida-lead-banner wide">
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

            <ParticipantMarkerSelect
              caseId={caseId}
              commercial={commercial}
              label={t("Кто обратился", "Who contacted")}
              hint={t("Роль и маркер участника: клиент, партнёр, родитель…", "Role and participant marker: client, partner, parent...")}
              options={CONTACTED_BY_PRESETS}
              value={draft.contactedBy ?? ""}
              onChange={(v) => setField("contactedBy", v)}
              disabled={state.kind === "saving"}
            />
            <div className="consultation-subject-block wide">
              <strong className="consultation-subject-title">{t("Объект консультирования", "Subject of Consultation")}</strong>
              <p className="muted tiny consultation-subject-lead">
                {t(
                  "Человек этой карточки — обычно тот, кто пришёл на приём. Если родитель пришёл по поводу подростка, объект всё равно родитель (пол и возраст — его). Когда позже придёт сам подросток или партнёр — заведите отдельную карточку и объедините участников в одном деле.",
                  "The person of this card is usually the one who came to the visit. If a parent came regarding a teenager, the subject is still the parent (their gender and age). When the teenager or partner comes later, start a separate card and combine the participants in one case.",
                )}
              </p>
              <div className="consultation-subject-meta intake-grid">
                <label className="field intake-field">
                  <span>{t("Пол", "Gender")}</span>
                  <select
                    value={
                      draft.concernSubjectGender === "unknown"
                        ? ""
                        : (draft.concernSubjectGender ?? "")
                    }
                    disabled={state.kind === "saving"}
                    onChange={(e) => setField("concernSubjectGender", e.target.value)}
                  >
                    <option value="">{t("Не указан", "Not specified")}</option>
                    {registryGenderChoices("ru")
                      .filter((gender) => gender !== "unknown")
                      .map((gender) => (
                        <option key={gender} value={gender}>
                          {registryGenderLabel(gender, "ru")}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field intake-field">
                  <span>{t("Возраст (лет)", "Age (years)")}</span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    step={1}
                    value={draft.concernSubjectAge ?? ""}
                    disabled={state.kind === "saving"}
                    placeholder={t("Например: 42", "e.g. 42")}
                    onChange={(e) => setField("concernSubjectAge", e.target.value)}
                  />
                </label>
              </div>
            </div>
            <ParticipantMarkerSelect
              caseId={caseId}
              commercial={commercial}
              label={t("По поводу кого", "Regarding whom")}
              hint={t("Если запрос не о самом заявителе — фокусный участник (ребёнок, партнёр…).", "If request is not about the applicant — focus participant (child, partner...).")}
              options={CONCERN_FOR_PRESETS}
              value={draft.concernFor ?? ""}
              onChange={(v) => setField("concernFor", v)}
              disabled={state.kind === "saving"}
            />
            <PresetSelectWithCustom
              label={t("По чьей инициативе", "Whose initiative")}
              hint={t("Сам клиент, родственник, организация, направление…", "Client themselves, relative, organization, referral...")}
              options={INITIATIVE_PRESETS}
              value={draft.initiative ?? ""}
              onChange={(v) => setField("initiative", v)}
              customPlaceholder={t("Свой вариант инициативы…", "Custom initiative options...")}
            />
            <AiSplitField
              label={t("Описание проблемы..", "Problem description...")}
              hint={t("На этой вкладке фиксируются только причины обращения (с чем пришёл клиент)! А на следующих вкладках приёмов — уже проблемы, которые психолог выбрал для решения.", "This tab records only the reasons for referral (what the client came with)! And the subsequent visit tabs record the problems the psychologist chose to address.")}
              textVal={draft.primaryDescription ?? ""}
              notesVal={draft.primaryDescription_notes ?? ""}
              onChangeText={(v) => setField("primaryDescription", v)}
              onChangeNotes={(v) => setField("primaryDescription_notes", v)}
              onDictate={(chunk) => setField("primaryDescription_notes", appendDictatedChunk(draft.primaryDescription_notes ?? "", chunk))}
              onGenerate={() => void handleFillAiBlock("primaryDescription")}
              isBusy={blockBusy["primaryDescription"]}
              disabled={state.kind === "saving"}
              subscriptionActive={subscriptionActive}
              className="wide"
            />
            <AiSplitField
              label={t("Риски / красные флаги", "Risks / Red Flags")}
              hint={t("Угроза жизни, селфхарм, насилие, ПАВ, проблемы с законом, опека.", "Life threat, self-harm, violence, substance abuse, law issues, guardianship.")}
              textVal={draft.riskNotes ?? ""}
              notesVal={draft.riskNotes_notes ?? ""}
              onChangeText={(v) => setField("riskNotes", v)}
              onChangeNotes={(v) => setField("riskNotes_notes", v)}
              onDictate={(chunk) => setField("riskNotes_notes", appendDictatedChunk(draft.riskNotes_notes ?? "", chunk))}
              onGenerate={() => void handleFillAiBlock("riskNotes")}
              isBusy={blockBusy["riskNotes"]}
              disabled={state.kind === "saving"}
              subscriptionActive={subscriptionActive}
              className="wide"
            />
            <div className="consultation-form-section wide">
              <div className="consultation-form-section-body">
                <p className="muted tiny" style={{ marginBottom: "12px" }}>
                  {t("Причины обращения — с чем пришли. Проблемы для работы выбираются на вкладках приёмов.", "Reasons for referral — what they came with. Problems to work on are selected in the visit tabs.")}
                </p>
                  <SessionTagsEditor
                    profile={commercial ? "themes_only" : "consultation"}
                    commercial={commercial}
                    value={{ themes: draft.problemThemes ?? emptySessionTagSelection(), formats: emptySessionTagSelection(), methods: emptySessionTagSelection(), techniques: emptySessionTagSelection() }}
                    onChange={(val) => {
                      setField("problemThemes", val.themes as any);
                    }}
                    hideFormatsAndMethods
                    aiAction={
                      subscriptionActive ? (
                        <button
                          type="button"
                          className="ob-btn secondary"
                          disabled={
                            themesAiBusy ||
                            state.kind === "saving" ||
                            !(
                              draft.primaryDescription?.trim() ||
                              draft.riskNotes.trim()
                            )
                          }
                          onClick={() => void handleSuggestThemesFromText()}
                        >
                          {themesAiBusy ? t("ИИ подбирает…", "AI picking…") : t("Подставить причины (ИИ)", "Suggest reasons (AI)")}
                        </button>
                      ) : null
                    }
                  />
              </div>
            </div>
          </>
        ) : (
          <>
            <TextareaField
              label={t("Контекст / источник", "Context / Source")}
              value={draft.requestSource}
              onChange={(v) => setField("requestSource", v)}
              placeholder={t("Кто обратился, по чьей инициативе, что привело к встрече.", "Who contacted, whose initiative, what led to the meeting.")}
            />
            <TextareaField
              label={t("Ситуация / динамика", "Situation / Dynamics")}
              value={draft.presentingProblem}
              onChange={(v) => setField("presentingProblem", v)}
              placeholder={t("Что обсуждалось, что изменилось с прошлого контакта.", "What was discussed, what changed since last contact.")}
            />
            <TextareaField
              label={t("Семейный контекст", "Family Context")}
              value={draft.familyContext}
              onChange={(v) => setField("familyContext", v)}
              placeholder={t("Состав семьи, значимые взрослые, напряжения, ресурсы.", "Family members, significant adults, tensions, resources.")}
            />
            <TextareaField
              label={t("Школьный / социальный контекст", "School / Social Context")}
              value={draft.schoolContext}
              onChange={(v) => setField("schoolContext", v)}
              placeholder={t("Класс, учителя, сверстники, цифровая среда, кружки.", "Grade, teachers, peers, digital environment, clubs.")}
            />
            <TextareaField
              label={t("Ресурсы и сильные стороны", "Resources and Strengths")}
              value={draft.strengths}
              onChange={(v) => setField("strengths", v)}
              placeholder={t("Что уже помогает, на кого можно опереться.", "What already helps, who can be relied upon.")}
            />
            <TextareaField
              label={t("Риски / красные флаги", "Risks / Red Flags")}
              value={draft.riskNotes}
              onChange={(v) => setField("riskNotes", v)}
              placeholder={t("Самоповреждение, насилие, зависимости, угрозы безопасности, ухудшение.", "Self-harm, violence, addictions, safety threats, deterioration.")}
            />
            <TextareaField
              label={t("Цели / план до следующего контакта", "Goals / Plan until next contact")}
              value={draft.goals}
              onChange={(v) => setField("goals", v)}
              placeholder={t("Что делаем дальше, кому что поручено, когда следующий контакт.", "What we do next, who is assigned to what, when next contact is.")}
              className="wide"
            />
          </>
        )}

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
        {expanded && commercial && record.session_no === 0 ? (
          <>
            <SessionValue label={t("Кто обратился", "Who contacted")} value={content.contactedBy ?? ""} />
            {content.concernSubjectGender?.trim() &&
            content.concernSubjectGender !== "unknown" ? (
              <SessionValue
                label={t("Пол объекта", "Subject gender")}
                value={registryGenderLabel(
                  content.concernSubjectGender as "male" | "female" | "unknown",
                  getTerminalEdition() === "intl" ? "en" : "ru",
                )}
              />
            ) : null}
            <SessionValue label={t("Возраст объекта", "Subject age")} value={content.concernSubjectAge ?? ""} />
            <SessionValue label={t("По поводу кого", "Regarding whom")} value={content.concernFor ?? ""} />
            <SessionValue label={t("По чьей инициативе", "Whose initiative")} value={content.initiative ?? ""} />
            <SessionValue label={t("Описание обращения", "Referral description")} value={content.primaryDescription ?? ""} />
          </>
        ) : expanded ? (
          <>
            <SessionValue label={t("Контекст / источник", "Context / Source")} value={content.requestSource} />
            <SessionValue label={t("Ситуация", "Situation")} value={content.presentingProblem} />
            <SessionValue label={t("Семейный контекст", "Family Context")} value={content.familyContext} />
            <SessionValue label={t("Школьный / социальный контекст", "School / Social Context")} value={content.schoolContext} />
            <SessionValue label={t("Ресурсы", "Resources")} value={content.strengths} />
          </>
        ) : null}
        <SessionValue label={t("Риски", "Risks")} value={content.riskNotes} />
        {!commercial && <SessionValue label={t("Цели / план", "Goals / Plan")} value={content.goals} />}
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
  placeholder: string;
  className?: string;
  disabled?: boolean;
  rows?: number;
}

function TextareaField(props: TextareaFieldProps) {
  const { label, value, onChange, placeholder, className, disabled, rows = 4 } = props;
  return (
    <label className={`field intake-field${className ? ` ${className}` : ""}`}>
      <span>{label}</span>
      <textarea
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
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
