/** Intervention techniques registry — mirror of core/intervention_techniques.py */

import type { MethodTag } from "./session_tagging.ts";
import type { ConsultationSessionTags } from "./session_tagging.ts";

export interface InterventionTechniqueRecord {
  code: string;
  labelRu: string;
  methodTag: MethodTag;
  xStage?: string;
  aliases: string[];
}

/** Seed registry; extend after KB inventory + governance review. */
export const INTERVENTION_TECHNIQUE_REGISTRY: InterventionTechniqueRecord[] = [
  { code: "thought_record", labelRu: "Дневник мыслей", methodTag: "cbt", xStage: "X4_Action", aliases: ["дневник мыслей"] },
  { code: "cognitive_restructuring", labelRu: "Когнитивная реструктуризация", methodTag: "cbt", xStage: "X4_Action", aliases: ["когнитивная реструктуризация", "реструктуризация мыслей"] },
  { code: "socratic_questioning", labelRu: "Сократовский диалог", methodTag: "cbt", xStage: "X4_Action", aliases: ["сократовский диалог"] },
  { code: "behavioral_experiment", labelRu: "Поведенческий эксперимент", methodTag: "cbt", xStage: "X4_Action", aliases: ["поведенческий эксперимент"] },
  { code: "exposure_in_vivo", labelRu: "Экспозиция in vivo", methodTag: "cbt", xStage: "X4_Action", aliases: ["экспозиция in vivo"] },
  { code: "activity_scheduling", labelRu: "Планирование активности", methodTag: "cbt", xStage: "X4_Action", aliases: ["планирование активности", "поведенческая активация"] },
  { code: "problem_solving_therapy", labelRu: "Проблемно-ориентированная терапия", methodTag: "cbt", aliases: ["проблемно-ориентирован"] },
  { code: "decatastrophizing", labelRu: "Декатастрофизация", methodTag: "cbt", aliases: ["декатастрофизация"] },
  { code: "defusion", labelRu: "Дефузия", methodTag: "act", xStage: "X4_Action", aliases: ["дефузия"] },
  { code: "values_clarification", labelRu: "Прояснение ценностей", methodTag: "act", xStage: "X3_Goal", aliases: ["прояснение ценностей"] },
  { code: "mi_oars", labelRu: "Мотивационное интервью (OARS)", methodTag: "nvc", aliases: ["oars", "мотивационное интервью"] },
  { code: "empty_chair", labelRu: "Техника «пустой стул»", methodTag: "gestalt", aliases: ["пустой стул"] },
  { code: "miracle_question", labelRu: "Чудесный вопрос", methodTag: "sfbt", aliases: ["чудесный вопрос"] },
  { code: "genogram", labelRu: "Генограмма", methodTag: "family_sys", aliases: ["генограмма"] },
  { code: "psychoeducation_block", labelRu: "Психообразовательный блок", methodTag: "cbt", xStage: "X1_Problem", aliases: ["психообразование"] },
];

export const INTERVENTION_TECHNIQUE_CODES = INTERVENTION_TECHNIQUE_REGISTRY.map((t) => t.code);

const TECHNIQUE_BY_CODE = new Map(INTERVENTION_TECHNIQUE_REGISTRY.map((t) => [t.code, t]));

const ALIAS_TO_TECHNIQUE = new Map<string, string>();
for (const tech of INTERVENTION_TECHNIQUE_REGISTRY) {
  ALIAS_TO_TECHNIQUE.set(tech.labelRu.toLowerCase(), tech.code);
  for (const alias of tech.aliases) {
    ALIAS_TO_TECHNIQUE.set(alias.toLowerCase(), tech.code);
  }
  ALIAS_TO_TECHNIQUE.set(tech.code.replace(/_/g, " "), tech.code);
}

function normalizePhrase(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveTechniqueCode(textOrCode: string): string | null {
  const raw = String(textOrCode || "").trim();
  if (!raw) return null;
  if (TECHNIQUE_BY_CODE.has(raw)) return raw;
  const norm = normalizePhrase(raw);
  if (ALIAS_TO_TECHNIQUE.has(norm)) return ALIAS_TO_TECHNIQUE.get(norm) ?? null;
  for (const [alias, code] of [...ALIAS_TO_TECHNIQUE.entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (norm.includes(alias) || alias.includes(norm)) return code;
  }
  return null;
}

export function methodTagForTechniqueCode(code: string): MethodTag | null {
  return TECHNIQUE_BY_CODE.get(code)?.methodTag ?? null;
}

export function interventionTechniqueLabel(code: string): string {
  return TECHNIQUE_BY_CODE.get(code)?.labelRu ?? code;
}

export interface MethodTagRollup {
  methodTags: string[];
  techniqueCodes: string[];
  directMethodTags: string[];
  unmappedCustom: string[];
}

export function rollupSessionTagsForStats(tags: ConsultationSessionTags): MethodTagRollup {
  const direct = [...new Set(tags.methods.catalog)];
  const techniques = [...new Set(tags.techniques?.catalog ?? [])];
  const unmapped: string[] = [];

  for (const label of [...tags.methods.custom, ...(tags.techniques?.custom ?? [])]) {
    const text = label.trim();
    if (!text) continue;
    const tech = resolveTechniqueCode(text);
    if (tech) {
      if (!techniques.includes(tech)) techniques.push(tech);
      continue;
    }
    unmapped.push(text);
  }

  const methodTags = new Set<string>(direct);
  for (const code of techniques) {
    const mt = methodTagForTechniqueCode(code);
    if (mt) methodTags.add(mt);
  }

  return {
    methodTags: [...methodTags],
    techniqueCodes: techniques,
    directMethodTags: direct,
    unmappedCustom: unmapped,
  };
}

export function rollupToResearchMetrics(rollup: MethodTagRollup): Record<string, number> {
  const out: Record<string, number> = {};
  for (const mt of rollup.methodTags) {
    const key = `method_tag_${mt}`;
    out[key] = (out[key] ?? 0) + 1;
  }
  for (const code of rollup.techniqueCodes) {
    const key = `technique_${code}`;
    out[key] = (out[key] ?? 0) + 1;
  }
  if (rollup.unmappedCustom.length) {
    out.unmapped_custom_method_labels = rollup.unmappedCustom.length;
  }
  return out;
}
