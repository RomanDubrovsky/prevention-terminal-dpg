/**
 * Карточка создания кейса — контейнер с участниками и таксономией.
 */

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  type ExecutorRoleTerminal,
  EXECUTOR_ROLE_VALUES_TERMINAL,
  ORG_SCALE_VALUES,
  type OrgScale,
} from "../lib/taxonomy.ts";
import {
  buildAliasIpcPayload,
  buildAliasMap,
  buildCasePassport,
  DETECTED_TYPE_LABEL,
  emptyDraft,
  newAliasId,
  newCaseId,
  sanitizeNotes,
  type AliasDraft,
  type AliasRole,
  type CaseDraft,
  type SanitizeResult,
} from "../lib/case.ts";
import {
  defaultSituationKind,
  participantRoleLabel,
  participantRolesForOrg,
  situationKindsForOrg,
  suggestAliasesForKind,
  type SituationKind,
} from "../lib/case_meta.ts";
import { buildParticipantCardLinksFromDraft } from "../lib/case_participant_cards.ts";
import { saveCaseArtifacts } from "../lib/case_store.ts";

type SubmitState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; caseId: string; sanitize: SanitizeResult }
  | { kind: "error"; message: string };

export interface CaseCreateCardProps {
  commercial: boolean;
  onSaved?: (caseId: string) => void;
  onCancel?: () => void;
}

export default function CaseCreateCard(props: CaseCreateCardProps) {
  const { commercial, onSaved, onCancel } = props;
  const kindOptions = useMemo(() => situationKindsForOrg(commercial), [commercial]);

  const [situationTitle, setSituationTitle] = useState("");
  const [situationKind, setSituationKind] = useState<SituationKind>(() =>
    defaultSituationKind(commercial),
  );
  const [draft, setDraft] = useState<CaseDraft>(() => emptyDraft());
  const [notesRaw, setNotesRaw] = useState("");
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  const selectedKindOption = kindOptions.find((o) => o.id === situationKind);
  const roleOptions = useMemo(() => participantRolesForOrg(commercial), [commercial]);

  const aliasMap = useMemo(() => buildAliasMap(draft.aliases), [draft.aliases]);
  const notesSanitized = useMemo(
    () => sanitizeNotes(notesRaw, aliasMap),
    [notesRaw, aliasMap],
  );

  const applyKindPreset = useCallback(
    (kind: SituationKind) => {
      setSituationKind(kind);
      setDraft((prev) => {
        const hasNamed = prev.aliases.some((a) => a.realName.trim().length > 0);
        if (hasNamed) return prev;
        return { ...prev, aliases: suggestAliasesForKind(kind, commercial) };
      });
    },
    [commercial],
  );

  const addAlias = useCallback(() => {
    setSubmit({ kind: "idle" });
    setDraft((prev) => ({
      ...prev,
      aliases: [
        ...prev.aliases,
        { aliasId: newAliasId(), role: commercial ? "client" : "student", realName: "" },
      ],
    }));
  }, [commercial]);

  const updateAlias = useCallback(
    (aliasId: string, patch: Partial<Pick<AliasDraft, "role" | "realName">>) => {
      setSubmit({ kind: "idle" });
      setDraft((prev) => ({
        ...prev,
        aliases: prev.aliases.map((a) => (a.aliasId === aliasId ? { ...a, ...patch } : a)),
      }));
    },
    [],
  );

  const removeAlias = useCallback((aliasId: string) => {
    setSubmit({ kind: "idle" });
    setDraft((prev) => ({
      ...prev,
      aliases: prev.aliases.filter((a) => a.aliasId !== aliasId),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const title = situationTitle.trim();
      if (!title) {
        setSubmit({ kind: "error", message: "Укажите название дела — коротко, как вы его узнаете в работе." });
        return;
      }
      if (draft.aliases.length === 0 && !notesSanitized.sanitizedText.trim()) {
        setSubmit({
          kind: "error",
          message: "Добавьте хотя бы одного участника или опишите контекст кейса.",
        });
        return;
      }
      setSubmit({ kind: "saving" });
      try {
        const passport = buildCasePassport(draft);
        const caseId = newCaseId();
        const aliases = buildAliasIpcPayload(draft.aliases);
        await invoke("db_insert_case", {
          caseId,
          taxonomyPassportJson: JSON.stringify(passport),
          notesSanitized: notesSanitized.sanitizedText,
          aliases,
        });
        const participant_links = await buildParticipantCardLinksFromDraft(
          aliases.map((a) => ({
            aliasId: a.alias_id,
            role: a.role,
            realName: a.real_name,
            roleNo: a.role_no,
          })),
        );
        await saveCaseArtifacts(caseId, {
          record_kind: "situation",
          situation_title: title,
          situation_kind: situationKind,
          situation_notes_append: notesSanitized.sanitizedText || undefined,
          participant_links,
        });
        setSubmit({ kind: "saved", caseId, sanitize: notesSanitized });
        onSaved?.(caseId);
      } catch (err) {
        const msg = typeof err === "string" ? err : String(err);
        setSubmit({
          kind: "error",
          message: msg.includes("DB is locked")
            ? "БД заблокирована. Разблокируйте мастер-паролем и повторите."
            : `Не удалось сохранить дело: ${msg}`,
        });
      }
    },
    [draft, notesSanitized, onSaved, situationKind, situationTitle],
  );

  return (
    <section className="card case-create-card">
      <header className="case-form-header">
        <h2>Новый кейс</h2>
      </header>

      <form onSubmit={handleSubmit} className="case-form-body">
        <label className="field wide">
          <span>Название дела</span>
          <input
            type="text"
            value={situationTitle}
            onChange={(e) => {
              setSituationTitle(e.target.value);
              setSubmit({ kind: "idle" });
            }}
            placeholder={selectedKindOption?.example || "Краткое рабочее название"}
            autoComplete="off"
          />
        </label>

        <fieldset className="situation-kind-fieldset wide">
          <legend>Тип кейса</legend>
          <div className="situation-kind-grid">
            {kindOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`situation-kind-btn${situationKind === opt.id ? " active" : ""}`}
                onClick={() => applyKindPreset(opt.id)}
              >
                <strong>{opt.label}</strong>
                <span className="muted tiny">{opt.hint}</span>
              </button>
            ))}
          </div>
          {selectedKindOption && (
            <p className="muted tiny situation-kind-example">Пример: {selectedKindOption.example}</p>
          )}
        </fieldset>

        <fieldset className="aliases-section wide">
          <legend>Участники (локально, без облака)</legend>
          <p className="muted tiny">
            Добавьте всех, кого нужно учитывать в анализе. Можно указать имена из карточек
            консультаций — это правильно: ФИО хранятся только на этом компьютере и в запрос к ИИ не
            уходят. В заметках и отчётах они автоматически заменяются маркерами{" "}
            <code>[Ученик №1]</code> / <code>[Клиент №1]</code>.
          </p>
          <AliasList
            aliases={draft.aliases}
            commercial={commercial}
            roleOptions={roleOptions}
            onAdd={addAlias}
            onUpdate={updateAlias}
            onRemove={removeAlias}
          />
        </fieldset>

        <fieldset className="notes-section wide">
          <legend>Контекст кейса</legend>
          <span className="muted tiny">
            Напишите или надиктуйте развёрнуто. После создания дела отчёт можно сформировать по всем
            материалам и карточкам участников.
          </span>
          <textarea
            className="notes-textarea"
            value={notesRaw}
            onChange={(e) => {
              setNotesRaw(e.target.value);
              setSubmit({ kind: "idle" });
            }}
            placeholder="Кратко: что произошло, кто вовлечён, что уже сделано…"
            rows={5}
          />
          {notesRaw.trim() && (
            <details className="notes-preview" open={notesSanitized.hasMatches}>
              <summary>Превью очищенного текста</summary>
              <pre className="notes-preview-text">{notesSanitized.sanitizedText}</pre>
            </details>
          )}
        </fieldset>

        {!commercial && (
          <div className="meta-row wide">
            <label className="field inline">
              <span>Роль специалиста</span>
              <select
                value={draft.executorRole}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, executorRole: e.target.value as ExecutorRoleTerminal }))
                }
              >
                {EXECUTOR_ROLE_VALUES_TERMINAL.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="field inline">
              <span>Масштаб</span>
              <select
                value={draft.orgScale}
                onChange={(e) => setDraft((p) => ({ ...p, orgScale: e.target.value as OrgScale }))}
              >
                {ORG_SCALE_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="case-form-footer wide">
          <button type="submit" className="ob-btn" disabled={submit.kind === "saving"}>
            {submit.kind === "saving" ? "Сохраняем…" : "Создать дело"}
          </button>
          {onCancel && (
            <button type="button" className="ob-btn secondary" onClick={onCancel}>
              Отмена
            </button>
          )}
        </div>

        {submit.kind === "saved" && (
          <p className="ok tiny wide">
            Кейс «{situationTitle.trim()}» сохранён локально. ID: <code>{submit.caseId}</code>
            {submit.sanitize.hasMatches && (
              <>
                {" "}
                · из заметок удалены персональные данные:{" "}
                {submit.sanitize.detectedTypes.map((t) => DETECTED_TYPE_LABEL[t]).join(", ")}
              </>
            )}
          </p>
        )}
        {submit.kind === "error" && <p className="error wide">{submit.message}</p>}
      </form>
    </section>
  );
}

function AliasList(props: {
  aliases: readonly AliasDraft[];
  commercial: boolean;
  roleOptions: readonly AliasRole[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Pick<AliasDraft, "role" | "realName">>) => void;
  onRemove: (id: string) => void;
}) {
  const { aliases, commercial, roleOptions, onAdd, onUpdate, onRemove } = props;
  return (
    <div className="aliases-list">
      {aliases.length === 0 ? (
        <p className="muted tiny">
          Участники не добавлены — нажмите «+ Участник» или выберите тип кейса. Можно указать имена
          из карточек консультаций: их ПДн в запрос к ИИ не попадут — в заметках имена автоматически
          очищаются и заменяются маркерами.
        </p>
      ) : (
        aliases.map((alias, index) => (
          <div key={alias.aliasId} className="alias-row">
            <label className="field alias-role-field">
              <span>Роль</span>
              <select
                value={alias.role}
                onChange={(e) => onUpdate(alias.aliasId, { role: e.target.value as AliasRole })}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {participantRoleLabel(role, commercial)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field alias-name-field">
              <span>ФИО / имя</span>
              <input
                type="text"
                value={alias.realName}
                onChange={(e) => onUpdate(alias.aliasId, { realName: e.target.value })}
                placeholder="Только локально"
                autoComplete="off"
              />
            </label>
            <div className="alias-marker">
              <span className="muted tiny">Маркер</span>
              <code>{aliasMarkerLabel(aliases, index, commercial)}</code>
            </div>
            <button type="button" className="link danger-link" onClick={() => onRemove(alias.aliasId)}>
              Удалить
            </button>
          </div>
        ))
      )}
      <button type="button" className="ob-btn secondary" onClick={onAdd}>
        + Участник
      </button>
    </div>
  );
}

function aliasMarkerLabel(aliases: readonly AliasDraft[], rowIndex: number, commercial: boolean): string {
  const alias = aliases[rowIndex];
  if (!alias?.realName.trim()) return "после ввода имени";
  let n = 0;
  for (let i = 0; i <= rowIndex; i += 1) {
    const current = aliases[i];
    if (current.role === alias.role && current.realName.trim()) n += 1;
  }
  const label = participantRoleLabel(alias.role, commercial);
  return `[${label} №${n}]`;
}
