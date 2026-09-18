/**
 * Canonical problem_key picker — mirror of core/match_form_schema.py + scopes.
 * Single taxonomy across terminal, match, and session tagging.
 */

import type { SessionTagCatalogItem } from "./session_tagging.ts";

/** Teenology TCM scope (school / youth). */
export const TEENOLOGY_TCM_PROBLEM_KEYS = [
  "EDU_LRN",
  "EDU_PATH",
  "EDU_CAREER",
  "EDU_SELF",
  "DEV_SELF",
  "DEV_EMO",
  "DEV_COMM",
  "DEV_WILL",
  "DEV_TIME",
  "REL_FAM",
  "REL_PEER",
  "REL_LOVE",
  "PREV_BULL",
  "PREV_AGGR",
  "PREV_DEL",
  "PREV_VICT",
  "PREV_CYBER",
  "SEX_CONSENT",
  "SEX_PUBERTY",
  "SEX_SAFETY",
  "SEX_RELATIONS",
  "SEX_IDENTITY",
] as const;

export const IDA_RELATIONSHIP_ADULT_PROBLEM_KEYS = ["REL_DEP"] as const;

export const IDA_ORG_PROBLEM_KEYS = [
  "ORG_LAW",
  "ORG_BURN",
  "ORG_CLIM",
  "ORG_SUP",
] as const;

export const IDA_ADULT_ONLY_PROBLEM_KEYS = [
  ...IDA_RELATIONSHIP_ADULT_PROBLEM_KEYS,
  ...IDA_ORG_PROBLEM_KEYS,
] as const;

export const IDA_CORE_PROBLEM_KEYS = [
  ...TEENOLOGY_TCM_PROBLEM_KEYS,
  ...IDA_ADULT_ONLY_PROBLEM_KEYS,
] as const;

import { getTerminalEdition } from "./terminal_edition.ts";

export const PROBLEM_KEY_LABELS_RU: Record<string, string> = {
  EDU_LRN: "Учёба, оценки, домашние задания",
  EDU_PATH: "Выбор школы, траектория обучения",
  EDU_CAREER: "Профориентация, «кем быть»",
  EDU_SELF: "Уверенность в учёбе, страх ошибки",
  DEV_SELF: "Самооценка, идентичность, «кто я»",
  DEV_EMO: "Эмоции, тревога, злость, апатия",
  DEV_COMM: "Общение, социальные навыки",
  DEV_WILL: "Самоконтроль, импульсивность, границы",
  DEV_TIME: "Режим, прокрастинация, гаджеты и время",
  REL_FAM: "Конфликты в семье, «не слышит», дистанция",
  REL_PEER: "Дружба, одиночество, давление сверстников",
  REL_LOVE: "Первые отношения, расставания",
  REL_DEP: "Созависимость, эмоциональная зависимость в паре",
  PREV_BULL: "Буллинг, травля",
  PREV_AGGR: "Агрессия, вспышки, «срывается»",
  PREV_DEL: "Рискованное поведение, вещества",
  PREV_VICT: "Насилие, травма, жертва",
  PREV_CYBER: "Киберриски, соцсети, онлайн-общение",
  SEX_CONSENT: "Согласие, границы, безопасность",
  SEX_PUBERTY: "Пубертат, изменения тела",
  SEX_SAFETY: "Безопасность, защита от насилия",
  SEX_RELATIONS: "Отношения и близость (просвещение)",
  SEX_IDENTITY: "Гендерная и сексуальная идентичность",
  ORG_LAW: "Правовые/организационные вопросы",
  ORG_BURN: "Выгорание специалиста / родителя",
  ORG_CLIM: "Климат в коллективе, команда",
  ORG_SUP: "Супервизия, поддержка специалистов",
};

export const PROBLEM_KEY_LABELS_EN: Record<string, string> = {
  EDU_LRN: "Studies, grades, homework",
  EDU_PATH: "School choice, learning path",
  EDU_CAREER: "Career counseling, vocational",
  EDU_SELF: "Study confidence, fear of error",
  DEV_SELF: "Self-esteem, identity, self-image",
  DEV_EMO: "Emotions, anxiety, anger, apathy",
  DEV_COMM: "Communication, social skills",
  DEV_WILL: "Self-control, impulsivity, boundaries",
  DEV_TIME: "Schedule, procrastination, screen time",
  REL_FAM: "Family conflicts, parent-child distance",
  REL_PEER: "Friendship, loneliness, peer pressure",
  REL_LOVE: "First relationship, breakups",
  REL_DEP: "Codependency, couple relationships",
  PREV_BULL: "Bullying, harassment",
  PREV_AGGR: "Aggression, outbursts, losing temper",
  PREV_DEL: "Substance use, risky behavior",
  PREV_VICT: "Violence, trauma, victimization",
  PREV_CYBER: "Cyber risks, social networks, online safety",
  SEX_CONSENT: "Consent, boundaries, safety",
  SEX_PUBERTY: "Puberty, body changes",
  SEX_SAFETY: "Safety, abuse prevention",
  SEX_RELATIONS: "Relationships and intimacy education",
  SEX_IDENTITY: "Gender and sexual identity",
  ORG_LAW: "Legal and organizational issues",
  ORG_BURN: "Specialist or parent burnout",
  ORG_CLIM: "Team climate, teamwork",
  ORG_SUP: "Supervision, peer support",
};

export interface ProblemKeyGroup {
  id: string;
  label: string;
  keys: readonly string[];
}

export const PROBLEM_KEY_GROUPS = (_commercial = false): ProblemKeyGroup[] => {
  const isIntl = getTerminalEdition() === "intl";
  return [
    {
      id: "education",
      label: isIntl ? "Education and Career" : "Учёба и карьера",
      keys: ["EDU_LRN", "EDU_PATH", "EDU_CAREER", "EDU_SELF"],
    },
    {
      id: "development",
      label: isIntl ? "Development and Emotions" : "Развитие и эмоции",
      keys: ["DEV_SELF", "DEV_EMO", "DEV_COMM", "DEV_WILL", "DEV_TIME"],
    },
    {
      id: "relationships",
      label: isIntl ? "Family and Relationships" : "Семья и отношения",
      keys: ["REL_FAM", "REL_PEER", "REL_LOVE", "REL_DEP"],
    },
    {
      id: "prevention",
      label: isIntl ? "Risks and Safety" : "Риски и безопасность",
      keys: ["PREV_BULL", "PREV_AGGR", "PREV_DEL", "PREV_VICT", "PREV_CYBER"],
    },
    {
      id: "sexuality_edu",
      label: isIntl ? "Sexuality Education" : "Половое просвещение",
      keys: ["SEX_CONSENT", "SEX_PUBERTY", "SEX_SAFETY", "SEX_RELATIONS", "SEX_IDENTITY"],
    },
    {
      id: "adult_org",
      label: isIntl ? "Work and Legal Issues" : "Работа, право, профессиональный контур",
      keys: IDA_ORG_PROBLEM_KEYS,
    },
  ];
};

/** Legacy session theme ids → canonical problem_key (read migration). */
export const LEGACY_THEME_TO_PROBLEM_KEY: Record<string, string> = {
  bullying_victim: "PREV_BULL",
  bullying_aggressor: "PREV_AGGR",
  self_harm_suicidal: "PREV_VICT",
  academic_motivation: "EDU_LRN",
  family_conflict: "REL_FAM",
  family_crisis: "REL_FAM",
  addiction_substance: "PREV_DEL",
  addiction_screen: "PREV_DEL",
  anxiety_fears: "DEV_EMO",
  depressive_state: "DEV_EMO",
  loneliness_isolation: "REL_PEER",
  identity_self_esteem: "DEV_SELF",
  trauma_experience: "PREV_VICT",
  criminal_behavior: "PREV_AGGR",
};

export function problemKeysForOrg(commercial: boolean): readonly string[] {
  return commercial ? IDA_CORE_PROBLEM_KEYS : TEENOLOGY_TCM_PROBLEM_KEYS;
}

export function problemKeyLabel(id: string): string {
  const isIntl = getTerminalEdition() === "intl";
  if (isIntl && PROBLEM_KEY_LABELS_EN[id]) return PROBLEM_KEY_LABELS_EN[id];
  return PROBLEM_KEY_LABELS_RU[id] ?? id;
}

export function normalizeProblemKeyId(id: string, allowed: ReadonlySet<string>): string | null {
  const key = String(id || "").trim();
  if (!key) return null;
  if (allowed.has(key)) return key;
  const mapped = LEGACY_THEME_TO_PROBLEM_KEY[key];
  if (mapped && allowed.has(mapped)) return mapped;
  return null;
}

export function problemKeyGroupsForOrg(commercial: boolean): ProblemKeyGroup[] {
  const allowed = new Set(problemKeysForOrg(commercial));
  return PROBLEM_KEY_GROUPS(commercial).map((grp) => ({
    ...grp,
    keys: grp.keys.filter((k) => allowed.has(k)),
  })).filter((grp) => grp.keys.length > 0);
}

export function problemKeyCatalogForOrg(commercial: boolean): SessionTagCatalogItem[] {
  return problemKeysForOrg(commercial).map((id) => ({ id, label: problemKeyLabel(id) }));
}

export function problemKeyAllowedMap(commercial: boolean): Map<string, SessionTagCatalogItem> {
  return new Map(problemKeyCatalogForOrg(commercial).map((item) => [item.id, item]));
}
