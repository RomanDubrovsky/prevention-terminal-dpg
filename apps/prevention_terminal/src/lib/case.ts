/**
 * Логика карточки «Личное дело» (Phase 3).
 *
 * Архитектурный принцип: всё здесь — **чистые функции**. Никакого React,
 * никакого Tauri-IPC, никакого DOM. Это позволяет покрыть критичную
 * логику расчёта баллов и сборки паспорта тестами через `node:test`
 * без mock'ов UI и без рантайма.
 *
 * UI (`CaseCreateCard.tsx`) импортирует отсюда `calculateMScores`,
 * `buildCasePassport` и связанные типы.
 */

import {
  M_MODALITY_MAPPING,
  M_MODALITY_MARKERS,
  type ExecutorRoleTerminal,
  type MModality,
  type MModalityGroupKey,
  type OrgScale,
  type TaxonomyPassportClient,
  type XStage,
  type YLevel,
} from "./taxonomy.ts";
import {
  sanitize,
  type AliasMap,
  type DetectedType,
  type SanitizeResult,
} from "./sanitizer.ts";

export type { SanitizeResult, AliasMap, DetectedType } from "./sanitizer.ts";

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

/**
 * Источник верификации одной галочки.
 * Этот перечень фиксирован: документ-психолог должен явно отвечать,
 * на каком основании выставлен риск.
 */
export const VERIFICATION_SOURCES = [
  "child_words",
  "parent_words",
  "specialist_observation",
  "document",
] as const;
export type VerificationSource = (typeof VERIFICATION_SOURCES)[number];

/** UI-метки для дропдауна (рус). Машинные ключи остаются стабильными. */
export const VERIFICATION_SOURCE_LABEL: Record<VerificationSource, string> = {
  child_words: "Со слов ребёнка",
  parent_words: "Со слов родителя",
  specialist_observation: "Наблюдение специалиста",
  document: "Документ",
};

/** UI-метки для каждой группы M (рус). Машинные ключи — из `taxonomy.ts`. */
export const MODALITY_GROUP_LABEL: Record<MModalityGroupKey, string> = {
  M1_M2_Chemical_Dependencies: "Химические зависимости и соматика (M1–M2)",
  M3_Cognitive_Autoaggression: "Личностные кризисы и аутоагрессия (M3)",
  M4_Social_Environment: "Семья и Сверстники / Буллинг (M4)",
  M5_Environmental_Risks: "Материальные и Цифровые риски (M5)",
};

/**
 * Phase 3.7 — категории участников дела для локального словаря ФИО.
 * Дублируется в Rust (`ALLOWED_ALIAS_ROLES` в `lib.rs`). При смене значений
 * править ОБЕ стороны IPC-контракта.
 */
export const ALIAS_ROLES = [
  "student",
  "parent",
  "teacher",
  "other",
  "client",
  "partner",
] as const;
export type AliasRole = (typeof ALIAS_ROLES)[number];

/** UI-метка роли в маркере замены. Менять осторожно — попадает в DOCX. */
export const ALIAS_ROLE_LABEL: Record<AliasRole, string> = {
  student: "Ученик",
  parent: "Родитель",
  teacher: "Учитель",
  other: "Лицо",
  client: "Клиент",
  partner: "Партнёр",
};

/**
 * Один черновик алиаса в форме «Личного дела». В отличие от записи в БД
 * у него ещё нет `role_no` — счётчик вычисляется при сборке `AliasMap`
 * по позиции внутри списка одной роли. Это позволяет психологу свободно
 * переставлять/удалять строки в UI без ручной правки номеров.
 */
export interface AliasDraft {
  /** Стабильный uuid (используется как React key и как PK в БД). */
  aliasId: string;
  role: AliasRole;
  realName: string;
}

/**
 * Снэпшот формы. Хранится в React-стейте через `useState`.
 *   * `checked[marker]` — флаг чек-бокса.
 *   * `sources[marker]` — выбранный источник или `null`, если ещё не выбран.
 *   * `aliases` — упорядоченный список участников дела с реальными ФИО,
 *     которые санитайзер заменяет на нейтральные маркеры. ФИО ВСЕГДА
 *     живут только в локальной зашифрованной БД и не уходят на сервер.
 */
export interface CaseDraft {
  checked: Record<string, boolean>;
  sources: Record<string, VerificationSource | null>;
  executorRole: ExecutorRoleTerminal;
  orgScale: OrgScale;
  aliases: AliasDraft[];
}

/** Пустой драфт — стартовое значение формы. */
export function emptyDraft(
  executorRole: ExecutorRoleTerminal = "Психолог",
  orgScale: OrgScale = "Individual",
): CaseDraft {
  return {
    checked: {},
    sources: {},
    executorRole,
    orgScale,
    aliases: [],
  };
}

// ---------------------------------------------------------------------------
// Подсчёт баллов
// ---------------------------------------------------------------------------

/** Сколько чек-боксов активно в каждой группе модальностей. */
export function calculateMScores(
  checked: Record<string, boolean>,
): Record<MModalityGroupKey, number> {
  const out = {} as Record<MModalityGroupKey, number>;
  for (const groupKey of Object.keys(M_MODALITY_MAPPING) as MModalityGroupKey[]) {
    const group = M_MODALITY_MAPPING[groupKey];
    out[groupKey] = group.markers.filter((m) => checked[m] === true).length;
  }
  return out;
}

/** Все активные маркеры из draft.checked. */
export function activeMarkers(checked: Record<string, boolean>): string[] {
  return M_MODALITY_MARKERS.filter((m) => checked[m] === true);
}

/**
 * Активные модальности оси M — производные от активных маркеров.
 * Если в группе хотя бы один marker checked → включаем её axis в результат
 * (для групп с `axis: ["M1_Biology","M2_Psychophysiology"]` оба добавятся).
 */
export function activeModalities(
  checked: Record<string, boolean>,
): MModality[] {
  const set = new Set<MModality>();
  for (const groupKey of Object.keys(M_MODALITY_MAPPING) as MModalityGroupKey[]) {
    const group = M_MODALITY_MAPPING[groupKey];
    const anyChecked = group.markers.some((m) => checked[m] === true);
    if (!anyChecked) continue;
    const axis = group.axis;
    if (Array.isArray(axis)) {
      for (const a of axis) set.add(a as MModality);
    } else {
      set.add(axis as MModality);
    }
  }
  return Array.from(set);
}

/**
 * Эвристика стартового Y-уровня по количеству активных маркеров.
 *
 * ВАЖНО: Y4_Crisis_Clinical отсюда НЕ возвращается. Кризисный уровень
 * поднимает только серверный `crisis_detector` по тексту сообщения
 * (см. `workers/pwa-api/src/crisis_detector.py`). Здесь — только базовая
 * шкала по сумме чек-боксов.
 */
export function deriveYLevel(totalActive: number): YLevel {
  if (totalActive === 0) return "Y1_Normal";
  if (totalActive <= 3) return "Y2_Risk";
  return "Y3_Problem";
}

// ---------------------------------------------------------------------------
// Сборка паспорта для отправки в Rust
// ---------------------------------------------------------------------------

/** Каноническая категория начальной диагностики. */
const DEFAULT_CATEGORY_KEY = "generic_prevention";

/** Каноническая X-фаза для интейка / выявления (по ТЗ §3). */
const DEFAULT_X_STAGE: XStage = "X2_Diag";

/**
 * Превратить драфт формы в объект TaxonomyPassport, готовый к
 * `JSON.stringify` и отправке в `db_insert_case`.
 *
 * Сюда **никогда** не должны попадать ФИО / адреса / телефоны. Если пользователь
 * захочет приложить заметки — они идут отдельным потоком через `sanitize()`
 * (см. `sanitizer.ts`), а сюда — только структурные галочки.
 */
export function buildCasePassport(draft: CaseDraft): TaxonomyPassportClient {
  const markers = activeMarkers(draft.checked);
  const modalities = activeModalities(draft.checked);
  return {
    category_key: DEFAULT_CATEGORY_KEY,
    x_stage: DEFAULT_X_STAGE,
    y_level: deriveYLevel(markers.length),
    m_modality: modalities,
    executor_role: draft.executorRole,
    org_scale: draft.orgScale,
    topic_tags: markers,
  };
}

// ---------------------------------------------------------------------------
// Phase 3.7 — локальный словарь алиасов
// ---------------------------------------------------------------------------

/**
 * Подсчётчик per-role внутри одного кейса. Используется и в `buildAliasMap`,
 * и в `buildAliasIpcPayload`, чтобы оба представления нумеровали алиасы
 * одинаково (важный инвариант: маркер в тексте должен совпадать с записью
 * в БД).
 *
 * Алиасы с пустым `realName` намеренно пропускаются: это «черновые» строки,
 * которые психолог только что добавил кнопкой «+ Добавить участника», но
 * ещё не успел заполнить. Их нумерация поднимется автоматически, когда
 * имя будет введено.
 */
function newRoleCounters(): Record<AliasRole, number> {
  return { student: 0, parent: 0, teacher: 0, other: 0, client: 0, partner: 0 };
}

/**
 * Сборка карты `{ "Иван Иванов": "[Ученик №1]" }` для санитайзера.
 *
 * Контракт нумерации: внутри одного кейса номера идут per-role в порядке,
 * в котором участник был добавлен. Это совпадает с порядком, который
 * `buildAliasIpcPayload` пишет в БД, чтобы при последующем открытии кейса
 * текст заметок и таблица `pd_aliases` ссылались на одни и те же номера.
 *
 * Если в массиве есть дубликат `realName` — выживает ПОСЛЕДНИЙ (более
 * поздняя запись «съест» более раннюю в map). Это поведение по умолчанию,
 * мы не сигналим о коллизии — UI должен помешать дубликатам входить.
 */
export function buildAliasMap(aliases: AliasDraft[]): AliasMap {
  const counters = newRoleCounters();
  const map: AliasMap = {};
  for (const a of aliases) {
    const name = a.realName.trim();
    if (name.length === 0) continue;
    counters[a.role] += 1;
    map[name] = `[${ALIAS_ROLE_LABEL[a.role]} №${counters[a.role]}]`;
  }
  return map;
}

/**
 * Сборка payload для Rust IPC-команды `db_insert_case`. Tauri 2 авто-конвертит
 * camelCase → snake_case на стороне Rust по `serde`-полям, поэтому здесь
 * имена полей оставляем в snake_case — это формат, который ожидает Rust:
 * `alias_id`, `role`, `role_no`, `real_name`.
 *
 * Пустые `realName` отфильтровываются — иначе мы бы вставили в БД мусор.
 * Это согласовано с фильтрацией в Rust (`trim().is_empty()` → continue),
 * но дешевле отбросить их на фронте, чтобы не гонять зря IPC-полезную нагрузку.
 */
export interface AliasIpcPayload {
  alias_id: string;
  role: AliasRole;
  role_no: number;
  real_name: string;
}

export function buildAliasIpcPayload(aliases: AliasDraft[]): AliasIpcPayload[] {
  const counters = newRoleCounters();
  const out: AliasIpcPayload[] = [];
  for (const a of aliases) {
    const name = a.realName.trim();
    if (name.length === 0) continue;
    counters[a.role] += 1;
    out.push({
      alias_id: a.aliasId,
      role: a.role,
      role_no: counters[a.role],
      real_name: name,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// UUID для caseId / aliasId
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Санитайзер заметок (Phase 3.5)
// ---------------------------------------------------------------------------

/**
 * UI-метки для типов вырезанных сущностей. Используются в подписи
 * «Из заметок удалены: Имя, Телефон, …». Машинные ключи приходят
 * из `sanitizer.ts` и здесь только переводятся для отображения.
 */
export const DETECTED_TYPE_LABEL: Record<DetectedType, string> = {
  Name: "Имя",
  Email: "Email",
  Phone: "Телефон",
  Document: "Документ",
  Organization: "Организация",
  Address: "Адрес",
};

/**
 * Тонкий доменный враппер над `sanitize`. Сейчас он просто проксирует
 * вызов, но даёт точку для будущих расширений (валидация длины,
 * нормализация переносов строк, лимит на размер заметок).
 *
 * Если `rawText` пустой / только пробелы — возвращает «чистый» нулевой
 * результат без работы регулярок, чтобы UI не показывал ложно-позитивные
 * чипы «удалено: ничего».
 */
export function sanitizeNotes(
  rawText: string,
  aliases: AliasMap = {},
): SanitizeResult {
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return { sanitizedText: "", hasMatches: false, detectedTypes: [] };
  }
  return sanitize(rawText, aliases);
}

/**
 * Случайный UUID v4 для нового кейса или алиаса.
 *
 * Tauri 2 webview (Chromium) поддерживает `crypto.randomUUID()` нативно;
 * fallback нужен только для Node:test runner'а, который запускается без
 * полноценного `crypto.randomUUID` в более старых сборках. На рантайме
 * приложения первая ветка всегда срабатывает.
 */
function newUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // Fallback (только для тестового рантайма): псевдо-UUID на Math.random.
  // Не криптостойкий — для UI рантайма не используется.
  const hex = (n: number) =>
    Math.floor(Math.random() * Math.pow(16, n))
      .toString(16)
      .padStart(n, "0");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

export function newCaseId(): string {
  return newUuid();
}

/** Phase 3.7 — uuid для нового алиаса. Семантически отличается от `caseId`. */
export function newAliasId(): string {
  return newUuid();
}
