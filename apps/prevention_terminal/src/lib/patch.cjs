const fs = require('fs');
let code = fs.readFileSync('c:\\\\Prevention_V3\\\\apps\\\\prevention_terminal\\\\src\\\\lib\\\\client_intake_themes.ts', 'utf8');

// 1. Interface
code = code.replace(
  '  label: string;\\n  group: string;',
  '  label: string;\\n  label_en?: string;\\n  group: string;'
);

// 2. Groups
code = code.replace(
  'export const CLIENT_INTAKE_THEME_GROUPS: { id: string; label: string }[] = [',
  'export const CLIENT_INTAKE_THEME_GROUPS: { id: string; label: string; label_en?: string }[] = ['
);

const groupsTranslations = {
  family_parenting: "Family & Parenting",
  relationships: "Relationships & Intimacy",
  emotions: "Emotions, Anxiety & Mood",
  behavior_risk: "Behavior, Addictions & Risks",
  self_identity: "Self-Discovery & Identity",
  social: "Social Life",
  education_career: "Education, Career & Goals",
  body_health: "Body, Sleep & Health",
  crisis_loss: "Crises & Loss",
  work_burnout: "Work & Burnout",
  sexuality: "Sexuality",
  other: "Other (custom)"
};

for (const [id, label] of Object.entries(groupsTranslations)) {
  const regex = new RegExp(`({ id: "${id}", label: "[^"]+" })`);
  code = code.replace(regex, `{ id: "${id}", label: "$&" }`.replace(/{\\s*id: [^,]+,\\s*label: [^}]+}/, (m) => m.slice(0,-1) + `, label_en: "${label}" }`));
}

// 3. Themes
const themesTranslations = {
  teen_parenting: "Adolescent support, parenting challenges",
  child_problems: "Child-related problems",
  family_issues: "Family problems",
  divorce: "Divorce",
  adult_children_parents: "Relationships between parents and adult children",
  family_patterns: "Recurring family patterns, generational scripts",
  conflicts: "Conflicts (family and workplace)",
  codependency: "Codependency, relationship addiction",
  emotional_dependency: "Emotional dependency on another person",
  infidelity: "Infidelity",
  jealousy: "Pathological jealousy",
  dating_difficulties: "Difficulties building romantic relationships",
  loneliness: "Loneliness",
  social_adaptation: "Social adaptation, social phobia",
  surroundings: "Relationships with others",
  low_self_esteem: "Low self-esteem",
  know_yourself: "Difficulty understanding one's own desires (self-discovery)",
  assertiveness: "Difficulty expressing desires and defending opinions",
  midlife_crisis: "Midlife crisis",
  emotional_poverty: "Emotional numbness",
  depression_apathy: "Depression, apathy, loss of meaning",
  anxiety_panic: "Panic attacks, elevated anxiety",
  fears_phobias: "Fears and phobias",
  stress: "Stress",
  neurosis: "Neuroses and emotional disorders",
  obsessive: "Obsessive behavior and thoughts",
  sleep: "Sleep disorders, insomnia, nightmares",
  psychosomatic: "Psychosomatic issues, health concerns",
  eating: "Eating disorders",
  aggression: "Aggression, anger outbursts",
  addictions: "Addictions (alcohol, drugs, tobacco, gaming)",
  suicide: "Suicidal behavior",
  violence_trauma: "Trauma from violence (physical, psychological, or sexual)",
  bereavement: "Loss, death of a loved one",
  life_crises: "Support through life crises",
  psych_disorder_suspicion: "Suspected mental disorder",
  burnout: "Burnout (emotional, professional)",
  business_difficulties: "Business difficulties",
  money_problems: "Financial problems",
  career_orientation: "Career choice and orientation",
  decision_goals: "Decision-making difficulties, goal setting",
  goal_support: "Psychological support toward achieving goals",
  learning: "Studies, motivation, school (adolescent / young adult)",
  sexuality: "Sex, sexuality",
  fertility: "Psychological infertility, pregnancy and birth preparation",
  serious_illness: "Supporting seriously ill patients, helping relatives",
  dreams: "Dreams, dream analysis",
  bullying: "Bullying (school, social environment)",
  cyber_risks: "Online risks, social media, cyberbullying"
};

for (const [id, label] of Object.entries(themesTranslations)) {
  const regex = new RegExp(`(id: "${id}",[\\s\\S]*?label: "[^"]+")`);
  code = code.replace(regex, `$1,\\n    label_en: "${label}"`);
}

// 4. Helpers and edition check
const helpers = `const isIntl = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edition') === 'intl';

export function clientIntakeThemeLabel(theme: ClientIntakeTheme): string {
  return isIntl && theme.label_en ? theme.label_en : theme.label;
}

export function clientIntakeGroupLabel(group: {id: string; label: string; label_en?: string}): string {
  return isIntl && group.label_en ? group.label_en : group.label;
}
`;

code = code.replace(
  'export const CLIENT_INTAKE_THEME_GROUPS',
  helpers + '\\nexport const CLIENT_INTAKE_THEME_GROUPS'
);

// 5. Update clientIntakeThemeGroups
code = code.replace(
  'export function clientIntakeThemeGroups(): { id: string; label: string; themes: ClientIntakeTheme[] }[]',
  'export function clientIntakeThemeGroups(): { id: string; label: string; label_en?: string; themes: ClientIntakeTheme[] }[]'
);

// 6. Update formatIntakeThemesSummary
const formatOld = `export function formatIntakeThemesSummary(sel: IntakeThemeSelection): string {
  const labels = sel.intake_theme_ids
    .map((id) => THEME_BY_ID.get(id)?.label || id)
    .filter(Boolean);
  const parts = [...labels, ...sel.custom];
  if (!parts.length && !sel.catalog.length) return "";
  if (!parts.length) {
    return sel.catalog.map((k) => problemKeyLabel(k)).join(", ");
  }
  const codes = sel.catalog.length
    ? \` · коды: \${[...new Set(sel.catalog.map((k) => problemKeyLabel(k)))].join(", ")}\`
    : "";
  return \`\${parts.join("; ")}\${codes}\`;
}`;

const formatNew = `export function formatIntakeThemesSummary(sel: IntakeThemeSelection): string {
  const labels = sel.intake_theme_ids
    .map((id) => {
      const theme = THEME_BY_ID.get(id);
      return theme ? clientIntakeThemeLabel(theme) : id;
    })
    .filter(Boolean);
  const parts = [...labels, ...sel.custom];
  if (!parts.length && !sel.catalog.length) return "";
  if (!parts.length) {
    return sel.catalog.map((k) => problemKeyLabel(k)).join(", ");
  }
  const codesStr = isIntl ? "codes:" : "коды:";
  const codes = sel.catalog.length
    ? \` · \${codesStr} \${[...new Set(sel.catalog.map((k) => problemKeyLabel(k)))].join(", ")}\`
    : "";
  return \`\${parts.join("; ")}\${codes}\`;
}`;

code = code.replace(formatOld, formatNew);

fs.writeFileSync('c:\\\\Prevention_V3\\\\apps\\\\prevention_terminal\\\\src\\\\lib\\\\client_intake_themes.ts', code);
