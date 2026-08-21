/**
 * Зеркало канонической 4D-матрицы из `core/taxonomy_engine.py`.
 *
 * Этот файл — единственный источник правды на стороне клиента. Любые
 * правки в `taxonomy_engine.py` должны зеркалиться сюда тестом
 * (Phase 2 todo: пайплайн codegen из Python в TS).
 */

export const X_STAGE_VALUES = [
  "X1_Problem",
  "X2_Diag",
  "X3_Goal",
  "X4_Action",
  "X5_Eval",
] as const;
export type XStage = (typeof X_STAGE_VALUES)[number];

export const Y_LEVEL_VALUES = [
  "Y1_Normal",
  "Y2_Risk",
  "Y3_Problem",
  "Y4_Crisis_Clinical",
] as const;
export type YLevel = (typeof Y_LEVEL_VALUES)[number];

export const M_MODALITY_VALUES = [
  "M1_Biology",
  "M2_Psychophysiology",
  "M3_Cognition",
  "M4_Social",
  "M5_Environment",
] as const;
export type MModality = (typeof M_MODALITY_VALUES)[number];

/**
 * EXECUTOR_ROLE — расширенная под ТЗ Терминала пятёрка.
 *
 * Важно: в `core/taxonomy_engine.py` сейчас 6 значений (включая
 * «Педагог-психолог» и «Педагог»). Здесь — строгая пятёрка для UI
 * фильтра «кто заполняет паспорт». Передача на сервер — через
 * EXECUTOR_ROLE_ALIASES в Python (Соц_педагог → Социальный педагог и т.д.).
 */
export const EXECUTOR_ROLE_VALUES_TERMINAL = [
  "Психолог",
  "Соц_педагог",
  "Директор_ОУ",
  "Специалист_РОНО",
  "Министр",
] as const;
export type ExecutorRoleTerminal = (typeof EXECUTOR_ROLE_VALUES_TERMINAL)[number];

export const ORG_SCALE_VALUES = [
  "Individual",
  "Family",
  "Group",
  "Community",
  "Society",
] as const;
export type OrgScale = (typeof ORG_SCALE_VALUES)[number];

/**
 * Лёгкая клиентская проекция TaxonomyPassport. Хранится в локальной
 * SQLite. Перед отправкой на сервер проходит через `sanitizer.ts`.
 */
export interface TaxonomyPassportClient {
  category_key: string;            // нормализуется на сервере до cat_*
  x_stage: XStage;
  y_level: YLevel;
  m_modality: MModality[];
  executor_role: ExecutorRoleTerminal;
  org_scale: OrgScale;
  topic_tags: string[];
  fundamental_axioms?: string[];
  behavior_delta_target?: string;
}

/**
 * ТАКСОНОМИЧЕСКИЙ МАППИНГ ДЛЯ ИНТЕРФЕЙСА ТЕРМИНАЛА (По ТЗ "КОНТАКТ" и универсальной матрице девиаций)
 *
 * Каждому чек-боксу в UI соответствует определённая модальность оси M.
 * При выборе галочек терминал суммирует баллы по каждой группе локально.
 *
 * Контракт для Phase 2 UI:
 *   - Имя ключа группы (M1_M2_Chemical_Dependencies, ...) — внутреннее, не показывается.
 *   - `axis` — каноническое значение(я) оси M_MODALITY_VALUES, передаётся
 *     в TaxonomyPassportClient.m_modality (массив M1..M5).
 *   - `markers` — стабильные машинные идентификаторы; русские пояснения —
 *     в комментариях справа. Тексты для UI берутся из i18n-словаря,
 *     а не отсюда.
 *   - Маркеры пишутся в TaxonomyPassportClient.topic_tags as-is, без перевода.
 *   - Маркер `suicidal_ideation` НЕ устанавливает y_level=Y4 автоматически:
 *     уровень Y4_Crisis_Clinical поднимает отдельный кризисный детектор
 *     (см. workers/pwa-api/src/crisis_detector.py). Здесь это только тег.
 */
export const M_MODALITY_MAPPING = {
  // M1 & M2: Биологический и психофизиологический уровень (Аддикции и соматика)
  M1_M2_Chemical_Dependencies: {
    axis: ["M1_Biology", "M2_Psychophysiology"],
    markers: [
      "substance_abuse",       // Употребление нелегальных ПАВ
      "vaping_nicotine",       // Систематический вейпинг / никотиновая зависимость
      "alcoholization",        // Алкоголизация подростка (в т.ч. пивной алкоголизм)
      "pharma_abuse"           // Аптечная наркомания / приём неназначенных препаратов
    ]
  },

  // M3: Личностно-когнитивный уровень (Внутренние кризисы и деструктивные намерения)
  M3_Cognitive_Autoaggression: {
    axis: "M3_Cognition",
    markers: [
      "self_harm",             // Шрамирование, порезы (селфхарм)
      "suicidal_ideation",     // Прямые/косвенные высказывания о нежелании жить
      "depressive_state",      // Выраженные депрессивные состояния / резкая апатия
      "value_deformation",     // Романтизация криминальной субкультуры / деструктивные ценности
      "low_self_esteem"        // Экстремально заниженная самооценка, изоляция
    ]
  },

  // M4: Ближний социальный контур (Семья и сверстники — Внешняя агрессия и насилие)
  M4_Social_Environment: {
    axis: "M4_Social",
    markers: [
      // Подблок: Семья
      "family_violence",       // Физическое или жёсткое эмоциональное насилие в семье
      "parent_divorce",        // Затяжной / конфликтный развод родителей
      "destructive_parenting", // Деструктивный стиль (гиперопека, безнадзорность, потеря контроля)
      "family_deviations",     // Судимости, алкоголизм, наркомания у родителей / братьев / сестёр

      // Подблок: Сверстники
      "bullying_victim",       // Жертва систематической травли в классе
      "bullying_aggressor",    // Инициатор / агрессор буллинга
      "criminal_peer_group"    // Включённость в антиобщественные / криминальные подростковые компании
    ]
  },

  // M5: Макро-среда и условия жизни (Материальные дефициты и цифровые риски)
  M5_Environmental_Risks: {
    axis: "M5_Environment",
    markers: [
      // Подблок: Быт и финансы
      "unsanitary_conditions", // Неудовлетворительное состояние жилья (захламлённость, антисанитария)
      "resource_deficit",      // Отсутствие личного места для сна / учёбы, нехватка одежды / еды
      "acute_financial_need",  // Острая нехватка денег на базовые нужды (проезд, питание)

      // Подблок: Цифровая среда
      "cyberbullying",         // Травля в чатах, распространение порочащего контента в сети
      "gadget_addiction",      // Экстремальная гаджет-зависимость с уходом из реальности
      "ludomania_gambling"     // Лудомания (игровые ставки, онлайн-казино)
    ]
  }
} as const;

/**
 * Все маркеры в плоском списке — для валидации `topic_tags` на клиенте и сервере.
 * Любой маркер, не входящий сюда, считается «свободным» тегом (не из ТЗ КОНТАКТ).
 */
export const M_MODALITY_MARKERS = Object.values(M_MODALITY_MAPPING).flatMap(
  (group) => group.markers
) as readonly string[];

export type MModalityGroupKey = keyof typeof M_MODALITY_MAPPING;

/* =========================================================================
 * Phase A canon enums — sync с docs/terminal/service-management-model.md
 * §5.0 (резолюция 2026-05-24, Q3..Q6) и docs/terminal/phase-a-spec.md §2.
 *
 * Эти enum'ы — контракт между Terminal (SQLCipher) и `terminal-api`
 * (aggregate pipeline, Phase B). ИЗМЕНЕНИЕ ЛЮБОГО ЗНАЧЕНИЯ ТРЕБУЕТ:
 *   1) обновление migration в `src-tauri/src/db.rs`,
 *   2) обновление server-side контракта (Worker + Supabase),
 *   3) пересмотра существующих агрегатов (см. ADR-002),
 *   4) синхронной правки `core/taxonomy_engine.py` (когда там появится
 *      зеркальный блок Phase A — сейчас Python обслуживает только
 *      X/Y/M/ORG_SCALE/EXECUTOR_ROLE 4D-матрицу).
 *
 * Префиксы и имена сознательно ASCII-snake_case без локализации:
 * локализация — обязанность i18n-словаря (см. `apps/prevention_terminal/
 * src/i18n/` после его появления в Phase A).
 * ========================================================================= */

/**
 * Q3 — типы задач, которые решает специалист в кейсе.
 *
 * 15 закрытых значений + `other` со свободным пояснением. Совпадает с
 * модулями Teenology (родитель и психолог думают в одних категориях).
 * См. service-management-model.md §5.0 → таблица «task_kind».
 *
 * NB: `criminal_behavior` — равноправный пункт, а не основа таксономии
 * (отвергнуто в ADR-001/§4.1 PROJECT_MAP).
 */
export const TASK_KIND_VALUES = [
  "bullying_victim",
  "bullying_aggressor",
  "self_harm_suicidal",
  "academic_motivation",
  "family_conflict",
  "family_crisis",
  "addiction_substance",
  "addiction_screen",
  "anxiety_fears",
  "depressive_state",
  "loneliness_isolation",
  "identity_self_esteem",
  "trauma_experience",
  "criminal_behavior",
  "other",
] as const;
export type TaskKind = (typeof TASK_KIND_VALUES)[number];

/**
 * Q4 — типы трудовых действий (ось `activity_kind`).
 *
 * 11 закрытых значений. Каждый имеет нормативное время (мин/единицу),
 * которое организация может переопределить в `org_profile.normative_overrides`
 * (см. phase-a-spec.md §2.1).
 *
 * Эти 11 значений уже используются в SQL-схеме `case_touches` (Migration
 * 0007). При расхождении TypeScript-зеркала и БД эта константа — источник
 * правды для UI, БД — источник правды для аналитики.
 */
export const ACTIVITY_KIND_VALUES = [
  "intake",
  "individual_session",
  "group_session",
  "family_session",
  "assessment",
  "consultation",
  "program_event",
  "referral",
  "evaluation",
  "methodology_work",
  "admin_other",
] as const;
export type ActivityKind = (typeof ACTIVITY_KIND_VALUES)[number];

/**
 * Нормативное время на единицу `activity_kind` в минутах.
 *
 * Это «стартовое» значение для расчёта планового бюджета и для подстановки
 * `minutes_planned` / `minutes_actual` в `case_touches`, когда специалист
 * не ввёл явное время. Реальная организация может переопределить через
 * `org_profile.normative_overrides` (`{activity_kind: minutes_per_unit}`).
 *
 * Источник: service-management-model.md §5.0 + §Q4 («Вариант C»).
 */
export const ACTIVITY_KIND_DEFAULT_MINUTES: Readonly<Record<ActivityKind, number>> = {
  intake: 60,
  individual_session: 45,
  group_session: 60,
  family_session: 60,
  assessment: 90,
  consultation: 30,
  program_event: 60,
  referral: 15,
  evaluation: 30,
  methodology_work: 60,
  admin_other: 15,
};

/**
 * Q5 — категория учащегося.
 *
 * 6 закрытых значений. Локально допустим множественный выбор (см.
 * `case_subject_categories.is_primary` в spec §2.2). В агрегат уходит
 * primary-категория + флаг secondary, с k-anonymity ≥ 5 на стороне
 * Terminal (ADR-002).
 */
export const SUBJECT_CATEGORY_VALUES = [
  "normal",
  "gifted",
  "sen",
  "hardship",
  "migrant",
  "other",
] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORY_VALUES)[number];

/**
 * Секции личного дела (`case_intake_sections.section_kind`).
 *
 * 13 секций — табы в case_view (spec §3.4). Универсальная структура без
 * региональной специфики: блоки риска (буллинг / селфхарм / аддикции /
 * криминал / травма) — равноправные внутри `risk_blocks`, не отдельные
 * табы. Это сознательное решение для международной версии (ADR-005).
 */
export const SECTION_KIND_VALUES = [
  "socio_demographics",
  "housing",
  "family",
  "health",
  "personality",
  "learning",
  "leisure_employment",
  "peers",
  "digital_risks",
  "risk_blocks",
  "protective_factors",
  "referral_reasons",
  "consents",
] as const;
export type SectionKind = (typeof SECTION_KIND_VALUES)[number];

/**
 * Q6 — тип образовательной организации (`org_kind`).
 *
 * Пара (`isced_level`, `org_kind`):
 *   - `isced_level` (0..8) — UNESCO ISCED, основная классификация.
 *   - `org_kind` — 6 спецтипов, не привязанных к уровню ISCED. Когда
 *     организация подпадает под обычный ISCED-уровень, в `org_kind`
 *     указывается ближайший по смыслу спецтип или `combined_school`
 *     (1–11 в одной школе) — конкретный маппинг закрывается формой
 *     InstallationWizard.
 *
 * Решение принято для готовности к международному рынку без миграций
 * схемы (ADR-005 + service-management-model.md §5.0 → Q6).
 */
export const ORG_KIND_VALUES = [
  "combined_school",
  "special_education",
  "out_of_school",
  "psych_support_center",
  "private_practice",
  "other",
] as const;
export type OrgKind = (typeof ORG_KIND_VALUES)[number];

/**
 * UNESCO ISCED levels (0..8).
 *
 *   0 — pre-primary, 1 — primary, 2 — lower secondary,
 *   3 — upper secondary, 4 — post-secondary non-tertiary,
 *   5 — short-cycle tertiary, 6 — bachelor, 7 — master, 8 — doctoral.
 *
 * Лежит рядом с `org_kind`, потому что в `org_profile` хранится пара
 * (`isced_level` + `org_kind`). UI показывает понятный label через i18n,
 * в БД хранятся обе колонки.
 */
export const ISCED_LEVEL_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export type IscedLevel = (typeof ISCED_LEVEL_VALUES)[number];

/**
 * Phase A Sprint 2 — Individual Prevention Plan lifecycle.
 *
 * `IPR_STATUS_VALUES` — статус плана (ИПР):
 *   - `draft`     — психолог начал заполнять, ещё не утверждён;
 *   - `active`    — план выполняется, шаги планируются и закрываются;
 *   - `completed` — все шаги закрыты, план достиг цели;
 *   - `archived`  — план снят с активной работы (закрыли кейс /
 *                   перешли на новый план следующего учебного года).
 *
 * `IPR_STEP_STATUS_VALUES` — статус отдельного шага:
 *   - `planned`     — шаг запланирован;
 *   - `in_progress` — шаг в работе;
 *   - `completed`   — шаг закрыт успешно;
 *   - `skipped`     — шаг пропущен (например, отпала необходимость).
 *
 * Каноничные значения зеркалятся в `core/taxonomy_engine.py`
 * (`IPR_STATUS_VALUES`, `IPR_STEP_STATUS_VALUES`) и проверяются
 * drift-тестом `tests/test_taxonomy_sync.py`.
 *
 * Эти же значения зашиты как CHECK constraint в SQL-миграции 0011
 * (`apps/prevention_terminal/src-tauri/src/db.rs`). При изменении
 * значений править все три стороны.
 */
export const IPR_STATUS_VALUES = [
  "draft",
  "active",
  "completed",
  "archived",
] as const;
export type IprStatus = (typeof IPR_STATUS_VALUES)[number];

export const IPR_STEP_STATUS_VALUES = [
  "planned",
  "in_progress",
  "completed",
  "skipped",
] as const;
export type IprStepStatus = (typeof IPR_STEP_STATUS_VALUES)[number];

/**
 * Phase A Sprint 3 — годовой план психолога (`year_plan_tasks.task_kind`).
 */
export const YEAR_PLAN_TASK_KIND_VALUES = [
  "prevention_campaign",
  "screening",
  "training_program",
  "consultation_program",
  "methodology_work",
  "admin_other",
] as const;
export type YearPlanTaskKind = (typeof YEAR_PLAN_TASK_KIND_VALUES)[number];

export const YEAR_PLAN_TASK_STATUS_VALUES = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type YearPlanTaskStatus = (typeof YEAR_PLAN_TASK_STATUS_VALUES)[number];

/**
 * Phase A Sprint 3 — входящие запросы (`request_log`).
 */
export const REQUEST_SOURCE_VALUES = [
  "parent",
  "teacher",
  "administration",
  "student",
  "external_specialist",
  "self_initiated",
  "other",
] as const;
export type RequestSource = (typeof REQUEST_SOURCE_VALUES)[number];

export const REQUEST_URGENCY_VALUES = ["normal", "high", "crisis"] as const;
export type RequestUrgency = (typeof REQUEST_URGENCY_VALUES)[number];

export const REQUEST_STATUS_VALUES = [
  "open",
  "in_triage",
  "converted_to_case",
  "closed_without_case",
] as const;
export type RequestStatus = (typeof REQUEST_STATUS_VALUES)[number];

/**
 * Phase A Sprint 4 — направления во внешнюю помощь (`referrals`).
 */
export const REFERRAL_TARGET_VALUES = [
  "psychiatric_dispensary",
  "private_psychologist",
  "crisis_center",
  "social_services",
  "medical_clinic",
  "other",
] as const;
export type ReferralTarget = (typeof REFERRAL_TARGET_VALUES)[number];

export const REFERRAL_STATUS_VALUES = [
  "pending",
  "sent",
  "acknowledged",
  "completed",
  "cancelled",
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUS_VALUES)[number];

/** Reuses `REQUEST_URGENCY_VALUES` for referral urgency. */
export const REFERRAL_URGENCY_VALUES = REQUEST_URGENCY_VALUES;
export type ReferralUrgency = RequestUrgency;

/**
 * Type-guard'ы — нужны UI-формам и валидаторам, чтобы безопасно
 * приводить строку из формы / БД к union-типу без `as`.
 */
export function isTaskKind(value: unknown): value is TaskKind {
  return typeof value === "string" && (TASK_KIND_VALUES as readonly string[]).includes(value);
}
export function isActivityKind(value: unknown): value is ActivityKind {
  return typeof value === "string" && (ACTIVITY_KIND_VALUES as readonly string[]).includes(value);
}
export function isSubjectCategory(value: unknown): value is SubjectCategory {
  return typeof value === "string" && (SUBJECT_CATEGORY_VALUES as readonly string[]).includes(value);
}
export function isSectionKind(value: unknown): value is SectionKind {
  return typeof value === "string" && (SECTION_KIND_VALUES as readonly string[]).includes(value);
}
export function isOrgKind(value: unknown): value is OrgKind {
  return typeof value === "string" && (ORG_KIND_VALUES as readonly string[]).includes(value);
}
export function isIprStatus(value: unknown): value is IprStatus {
  return typeof value === "string" && (IPR_STATUS_VALUES as readonly string[]).includes(value);
}
export function isIprStepStatus(value: unknown): value is IprStepStatus {
  return typeof value === "string" && (IPR_STEP_STATUS_VALUES as readonly string[]).includes(value);
}
export function isYearPlanTaskKind(value: unknown): value is YearPlanTaskKind {
  return typeof value === "string" && (YEAR_PLAN_TASK_KIND_VALUES as readonly string[]).includes(value);
}
export function isYearPlanTaskStatus(value: unknown): value is YearPlanTaskStatus {
  return typeof value === "string" && (YEAR_PLAN_TASK_STATUS_VALUES as readonly string[]).includes(value);
}
export function isRequestSource(value: unknown): value is RequestSource {
  return typeof value === "string" && (REQUEST_SOURCE_VALUES as readonly string[]).includes(value);
}
export function isRequestUrgency(value: unknown): value is RequestUrgency {
  return typeof value === "string" && (REQUEST_URGENCY_VALUES as readonly string[]).includes(value);
}
export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUS_VALUES as readonly string[]).includes(value);
}
export function isReferralTarget(value: unknown): value is ReferralTarget {
  return typeof value === "string" && (REFERRAL_TARGET_VALUES as readonly string[]).includes(value);
}
export function isReferralStatus(value: unknown): value is ReferralStatus {
  return typeof value === "string" && (REFERRAL_STATUS_VALUES as readonly string[]).includes(value);
}
export function isReferralUrgency(value: unknown): value is ReferralUrgency {
  return isRequestUrgency(value);
}
export function isIscedLevel(value: unknown): value is IscedLevel {
  return typeof value === "number" && (ISCED_LEVEL_VALUES as readonly number[]).includes(value);
}
