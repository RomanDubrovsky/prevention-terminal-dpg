import { useState, useCallback, useMemo } from "react";
import {
  emptyProgressNote,
  hasProgressNoteContent,
  setProgressNoteField,
  type UnifiedProgressNote,
  type UnifiedSectionKey,
} from "../progress_note.ts";
import {
  emptyConsultationSessionTags,
  type ConsultationSessionTags,
} from "../session_tagging.ts";
import type { ConsultationPairMeta } from "../consultation_session.ts";
import type { SessionArtifacts } from "../section_artifacts.ts";

export type PanelState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

export function useConsultationForm(initialHintPreset: "dap" = "dap") {
  const [draft, setDraft] = useState<UnifiedProgressNote>(() => emptyProgressNote(initialHintPreset));
  const [minutes, setMinutes] = useState("45");
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pairMeta, setPairMeta] = useState<ConsultationPairMeta | undefined>(undefined);
  const [sessionTags, setSessionTags] = useState<ConsultationSessionTags>(emptyConsultationSessionTags());
  
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<SessionArtifacts>({});
  
  const [state, setState] = useState<PanelState>({ kind: "idle" });
  const [saveOk, setSaveOk] = useState<string | null>(null);
  
  const [aiFilledKeys, setAiFilledKeys] = useState<UnifiedSectionKey[]>([]);

  const startNewSession = useCallback(() => {
    setSavedEntryId(null);
    setArtifacts({});
    setSaveOk(null);
    setVisitDate(new Date().toISOString().slice(0, 10));
    setPairMeta(undefined);
    setDraft(emptyProgressNote(initialHintPreset));
    setMinutes("45");
    setSessionTags(emptyConsultationSessionTags());
    setAiFilledKeys([]);
    setState({ kind: "idle" });
  }, [initialHintPreset]);

  const resetDraft = useCallback(() => {
    if (savedEntryId) {
      startNewSession();
      return;
    }
    setDraft(emptyProgressNote(initialHintPreset));
    setMinutes("45");
    setSessionTags(emptyConsultationSessionTags());
    setAiFilledKeys([]);
    setState({ kind: "idle" });
  }, [initialHintPreset, savedEntryId, startNewSession]);

  const setMetaField = useCallback((key: "modality" | "riskLevel", value: string) => {
    setState({ kind: "idle" });
    if (key === "modality" && value === "pair") {
      setPairMeta((prev) => prev ?? { mode: "joint", coParticipant: "" });
    }
    if (key === "modality" && value !== "pair") {
      setPairMeta(undefined);
    }
    setDraft((prev) => setProgressNoteField(prev, key, value));
  }, []);

  const setSectionField = useCallback((key: UnifiedSectionKey, value: string) => {
    setState({ kind: "idle" });
    setAiFilledKeys((prev) => prev.filter((k) => k !== key));
    setDraft((prev) => setProgressNoteField(prev, key, value));
  }, []);

  const setSectionNotesField = useCallback((key: keyof UnifiedProgressNote, value: string) => {
    setState({ kind: "idle" });
    setDraft((prev) => ({ ...prev, [key]: value } as UnifiedProgressNote));
  }, []);

  const draftDirty = useMemo(
    () => hasProgressNoteContent(draft) || [
      draft.goal_notes, draft.observations_notes, draft.intervention_notes, draft.assessmentResponse_notes, draft.plan_notes
    ].some(s => (s ?? "").trim().length > 0),
    [draft]
  );

  return {
    draft, setDraft,
    minutes, setMinutes,
    visitDate, setVisitDate,
    pairMeta, setPairMeta,
    sessionTags, setSessionTags,
    savedEntryId, setSavedEntryId,
    artifacts, setArtifacts,
    state, setState,
    saveOk, setSaveOk,
    aiFilledKeys, setAiFilledKeys,
    startNewSession, resetDraft,
    setMetaField, setSectionField, setSectionNotesField,
    draftDirty
  };
}
