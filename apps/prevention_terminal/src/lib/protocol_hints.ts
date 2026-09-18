import { sessionFormatLabel, type SessionFormatId } from "./session_format.ts";
import { methodTagLabel } from "./session_tagging.ts";
import { problemKeyLabel } from "./taxonomy_picker.ts";

/** Curated hints: problem_key → suggested session formats and IDA sprint stage. */
const PROBLEM_HINTS: Record<
  string,
  { formats: SessionFormatId[]; methods: string[]; idaStage: string; note: string }
> = {
  REL_FAM: {
    formats: ["mediation", "therapy_work"],
    methods: ["nvc", "family_sys"],
    idaStage: "X1_Problem",
    note: "Конфликт в семье — часто начинают с переговорной рамки (ННО/медиация), затем рабочие сессии.",
  },
  DEV_EMO: {
    formats: ["diagnostic", "therapy_work"],
    methods: ["cbt", "act"],
    idaStage: "X1_Problem",
    note: "Тревога/эмоции — intake + КПТ/ACT; протоколы IDA на стадии X1_Problem.",
  },
  PREV_AGGR: {
    formats: ["diagnostic", "therapy_work"],
    methods: ["cbt", "schema"],
    idaStage: "X2_Diag",
    note: "Поведение и агрессия — уточнить функцию; при необходимости ФАП на шаге «Проблема».",
  },
  PREV_BULL: {
    formats: ["psychoeducation", "therapy_work"],
    methods: ["cbt", "nvc"],
    idaStage: "X1_Problem",
    note: "Травля — психообразование + навыки; при кризисе — отдельный формат вмешательства.",
  },
  REL_LOVE: {
    formats: ["diagnostic", "therapy_work"],
    methods: ["cbt", "gestalt"],
    idaStage: "X1_Problem",
    note: "Отношения — диагностическая беседа, затем рабочие сессии.",
  },
  REL_DEP: {
    formats: ["motivational_interview", "therapy_work"],
    methods: ["cbt", "schema"],
    idaStage: "X1_Problem",
    note: "Зависимые отношения — МИ для мотивации + схема/КПТ.",
  },
};

const DEFAULT_HINT = {
  formats: ["diagnostic", "therapy_work"] as SessionFormatId[],
  methods: ["cbt", "nvc"],
  idaStage: "X1_Problem",
  note: "По выбранным темам IDA подберёт dialogue-протоколы на стадии знакомства с проблемой.",
};

export interface ProtocolHintLine {
  problemKey: string;
  problemLabel: string;
  formats: string[];
  methods: string[];
  idaStage: string;
  note: string;
}

export function protocolHintsForThemes(themeIds: string[]): ProtocolHintLine[] {
  const unique = [...new Set(themeIds.map((id) => String(id || "").trim()).filter(Boolean))];
  return unique.slice(0, 4).map((problemKey) => {
    const row = PROBLEM_HINTS[problemKey] || DEFAULT_HINT;
    return {
      problemKey,
      problemLabel: problemKeyLabel(problemKey),
      formats: row.formats.map((id) => sessionFormatLabel(id)),
      methods: row.methods.map((id) => methodTagLabel(id)),
      idaStage: row.idaStage,
      note: row.note,
    };
  });
}
