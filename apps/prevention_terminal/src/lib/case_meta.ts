import type { TerminalConfig } from "./terminal_config.ts";
import type { AliasDraft, AliasRole } from "./case.ts";
import { newAliasId } from "./case.ts";

/** Preset «тип ситуации» — хранится в case_artifacts_json.situation_kind */
export const SCHOOL_SITUATION_KINDS = [
  "conflict_bullying",
  "student_support",
  "family_school",
  "prevention_event",
] as const;

export const COMMERCIAL_SITUATION_KINDS = [
  "individual_therapy",
  "couple_therapy",
  "group_program",
  "corporate_request",
] as const;

export type SchoolSituationKind = (typeof SCHOOL_SITUATION_KINDS)[number];
export type CommercialSituationKind = (typeof COMMERCIAL_SITUATION_KINDS)[number];
export type SituationKind = SchoolSituationKind | CommercialSituationKind;

export interface SituationKindOption {
  id: SituationKind;
  label: string;
  hint: string;
  example: string;
}

export function isCommercialOrg(cfg: TerminalConfig): boolean {
  return cfg.org_type === "commercial";
}

export function situationKindsForOrg(commercial: boolean): SituationKindOption[] {
  return commercial ? COMMERCIAL_SITUATION_OPTIONS : SCHOOL_SITUATION_OPTIONS;
}

export function defaultSituationKind(commercial: boolean): SituationKind {
  return commercial ? "individual_therapy" : "student_support";
}

export function situationKindLabel(kind: string, commercial: boolean): string {
  const options = situationKindsForOrg(commercial);
  return options.find((o) => o.id === kind)?.label || kind || "Кейс";
}

/** UI-метка роли участника с учётом контекста организации */
export function participantRoleLabel(role: AliasRole, commercial: boolean): string {
  if (!commercial) {
    const school: Record<AliasRole, string> = {
      student: "Ученик",
      parent: "Родитель",
      teacher: "Учитель",
      other: "Другое лицо",
      client: "Клиент",
      partner: "Партнёр",
    };
    return school[role] ?? role;
  }
  const comm: Record<AliasRole, string> = {
    student: "Клиент",
    parent: "Родитель / законный представитель",
    teacher: "Коллега / куратор",
    other: "Участник",
    client: "Клиент",
    partner: "Партнёр",
  };
  return comm[role] ?? role;
}

export function participantRolesForOrg(commercial: boolean): AliasRole[] {
  if (commercial) {
    return ["client", "partner", "parent", "other"];
  }
  return ["student", "parent", "teacher", "other"];
}

export function suggestAliasesForKind(
  kind: SituationKind,
  commercial: boolean,
): AliasDraft[] {
  const mk = (role: AliasRole): AliasDraft => ({
    aliasId: newAliasId(),
    role,
    realName: "",
  });
  if (commercial) {
    switch (kind) {
      case "couple_therapy":
        return [mk("client"), mk("partner")];
      case "group_program":
        return [mk("client"), mk("client"), mk("client")];
      default:
        return [mk("client")];
    }
  }
  switch (kind) {
    case "conflict_bullying":
      return [mk("student"), mk("student"), mk("student"), mk("parent")];
    case "family_school":
      return [mk("student"), mk("parent"), mk("teacher")];
    case "prevention_event":
      return [mk("teacher"), mk("student"), mk("student")];
    default:
      return [mk("student"), mk("parent")];
  }
}

export interface CaseWorkspaceIntro {
  title: string;
  lead: string;
}

export function caseWorkspaceIntro(commercial: boolean): CaseWorkspaceIntro {
  const isIntl = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edition") === "intl";
  if (commercial) {
    return {
      title: isIntl ? "Cases" : "Кейсы",
      lead: isIntl
        ? "Multiple clients in one case — couples, families, groups, or corporate requests: combined synthesis and assessment. Conduct routine individual sessions under 'Consultations'."
        : "Несколько клиентов в одном деле — пара, семья, группа, корпоративный запрос: общий синтез и экспертиза. Обычные индивидуальные визиты ведите в «Консультации».",
    };
  }
  return {
    title: isIntl ? "Cases" : "Кейсы",
    lead: isIntl
      ? "Multiple participants in one case — classroom bullying, family & school, group prevention. Combined synthesis and links from Teenology. Conduct single-student sessions under 'Consultations'."
      : "Несколько участников в одном разборе — буллинг в классе, семья и школа, профилактика с группой. Общий синтез и при необходимости ссылка из Teenology. Работу с одним учеником без совместного разбора ведите в «Консультации».",
  };
}

const SCHOOL_SITUATION_OPTIONS: SituationKindOption[] = [
  {
    id: "conflict_bullying",
    label: "Конфликт / буллинг",
    hint: "Несколько учеников и взрослых в одной ситуации",
    example: "«Конфликт в 7Б, март» — агрессор, жертва, свидетели, родитель",
  },
  {
    id: "student_support",
    label: "Работа с учеником",
    hint: "Один ребёнок в фокусе, при необходимости родитель",
    example: "«Тревожность, 5 класс» — ученик + родитель",
  },
  {
    id: "family_school",
    label: "Семья и школа",
    hint: "Связка семьи, ребёнка и педагога",
    example: "«Семейный кризис, влияние на учёбу»",
  },
  {
    id: "prevention_event",
    label: "Профилактическое мероприятие",
    hint: "Группа, класс, событие с подключением приложения",
    example: "«Неделя толерантности, 8А»",
  },
];

const COMMERCIAL_SITUATION_OPTIONS: SituationKindOption[] = [
  {
    id: "individual_therapy",
    label: "Индивидуальная терапия",
    hint: "Один клиент, при необходимости родитель / сопровождающий",
    example: "«Первичная консультация, тревога»",
  },
  {
    id: "couple_therapy",
    label: "Парная / семейная",
    hint: "Два и более участников в одном деле",
    example: "«Супружеская терапия, договор №12»",
  },
  {
    id: "group_program",
    label: "Групповая программа",
    hint: "Группа клиентов или мероприятие",
    example: "«Группа осознанности, поток 3»",
  },
  {
    id: "corporate_request",
    label: "Корпоративный запрос",
    hint: "Организация и сотрудники",
    example: "«Стресс-менеджмент, отдел продаж»",
  },
];
