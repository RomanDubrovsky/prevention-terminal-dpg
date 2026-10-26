/**
 * useDeepInsightWatcher — "Глубокий ИИ-слой" анализа речи клиента.
 *
 * В отличие от простого keyword-watcher'а, этот хук ищет:
 *  1. Противоречия (incongruence) — «всё нормально» + негативный контекст
 *  2. Защитные механизмы — минимизация, рационализация, проекция
 *  3. Эмоциональное уплощение — отсутствие эмоций при травматичной теме
 *  4. Избегание и переключение — резкая смена темы при приближении к болезненному
 *  5. Повторяющийся паттерн — одна и та же конструкция звучит 3+ раз
 *
 * Работает на основе анализа окна из последних ~300 символов транскрипта
 * с учётом контекстуальных маркеров (а не одиночных ключевых слов).
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface DeepInsight {
  id: string;
  type: 'contradiction' | 'defense' | 'avoidance' | 'repetition' | 'incongruence';
  label: string;
  excerpt: string;
  explanation: string;
  clinicalHint: string;
  severity: 'low' | 'medium' | 'high';
}

// ─── Pattern Definitions ─────────────────────────────────────────────────

interface ContraPattern {
  id: string;
  type: DeepInsight['type'];
  /** Маркеры, обесценивающие переживание (минимизация, отрицание) */
  minimizers: string[];
  /** Контекстные индикаторы реального переживания */
  realityMarkers: string[];
  label: string;
  explanation: string;
  clinicalHint: string;
  severity: DeepInsight['severity'];
}

const CONTRA_PATTERNS: ContraPattern[] = [
  // ── Противоречия: «всё нормально» + негативный контекст ──
  {
    id: 'deep-ok-but-not',
    type: 'contradiction',
    minimizers: ['всё нормально', 'всё хорошо', 'ничего страшного', 'не так уж плохо', 'ничего особенного', 'нормально всё', 'всё ок', 'я в порядке'],
    realityMarkers: ['плачу', 'плакал', 'рыдал', 'не могу', 'не сплю', 'кошмар', 'ужас', 'невыносимо', 'трясёт', 'тошнит', 'хочу умер', 'нет сил', 'задыхаюсь', 'больно', 'разрушает', 'на грани', 'не вынос', 'страшно', 'паник'],
    label: '⚠️ Противоречие: минимизация при выраженном страдании',
    explanation: 'Клиент говорит «всё нормально», но контекст указывает на сильное эмоциональное переживание',
    clinicalHint: 'Возможна алекситимия, привычная минимизация, социально-желательный ответ или подавление аффекта',
    severity: 'high',
  },
  {
    id: 'deep-guilt-deny',
    type: 'contradiction',
    minimizers: ['я не виноват', 'это не моя вина', 'я не отвечаю', 'я ни при чём'],
    realityMarkers: ['виноват', 'моя ошибка', 'из-за меня', 'наказыва', 'стыдно', 'не могу простить себ'],
    label: '⚠️ Противоречие: отрицание вины при скрытом чувстве вины',
    explanation: 'Клиент отрицает ответственность, но одновременно проявляет маркеры вины и самообвинения',
    clinicalHint: 'Внутренний конфликт между защитным отрицанием и глубинным чувством вины. Рассмотреть интроективный паттерн',
    severity: 'high',
  },

  // ── Защитные механизмы ──
  {
    id: 'deep-rationalize',
    type: 'defense',
    minimizers: ['это логично', 'объективно', 'рационально', 'с точки зрения', 'если разобраться', 'по факту'],
    realityMarkers: ['боюсь', 'обижен', 'злюсь', 'ненавижу', 'больно', 'одиноко', 'брошен', 'предал'],
    label: '🛡️ Защита: рационализация при сильном аффекте',
    explanation: 'Клиент интеллектуализирует ситуацию, за которой стоит интенсивное эмоциональное переживание',
    clinicalHint: 'Интеллектуализация как защита от контакта с болезненным чувством. Мягкая конфронтация: «Что вы чувствуете прямо сейчас?»',
    severity: 'medium',
  },
  {
    id: 'deep-projection',
    type: 'defense',
    minimizers: ['он всегда', 'она всегда', 'они все', 'вечно они', 'все люди такие', 'все мужчины', 'все женщины'],
    realityMarkers: ['сам так дела', 'я тоже', 'мне тоже', 'как и я', 'может и я', 'иногда я тоже'],
    label: '🛡️ Защита: проекция собственных качеств на других',
    explanation: 'Клиент приписывает другим людям черты или поведение, которое сам проявляет',
    clinicalHint: 'Проекция как защита от осознания собственных неприемлемых частей. Рассмотреть зеркальное отражение',
    severity: 'medium',
  },
  {
    id: 'deep-minimization',
    type: 'defense',
    minimizers: ['подумаешь', 'мелочь', 'ерунда', 'глупость', 'бред', 'не стоит внимания', 'не о чем говорить'],
    realityMarkers: ['насили', 'удар', 'изнасило', 'избил', 'унижал', 'издевал', 'травм', 'абьюз', 'преследов', 'угрожал', 'домогал'],
    label: '🛡️ Защита: минимизация травматического опыта',
    explanation: 'Клиент обесценивает серьёзный (возможно травматический) опыт словами «ерунда», «подумаешь»',
    clinicalHint: 'Диссоциативная минимизация. Высокая вероятность неотработанной травмы. Нужна осторожная валидация',
    severity: 'high',
  },

  // ── Эмоциональная инконгруэнтность ──
  {
    id: 'deep-smile-pain',
    type: 'incongruence',
    minimizers: ['смеш', 'забавн', 'прикольн', 'ха-ха', 'хахах', 'ржу', 'умора', 'весело'],
    realityMarkers: ['умер', 'бросил', 'развод', 'предал', 'похоронил', 'потерял', 'суицид', 'конец', 'обман'],
    label: '🔍 Инконгруэнтность: смех при описании болезненной ситуации',
    explanation: 'Клиент смеётся или использует юмор, рассказывая о потере, предательстве или травме',
    clinicalHint: 'Защитный юмор, маниакальная защита от депрессии. Возможна диссоциация аффекта от содержания',
    severity: 'high',
  },
  {
    id: 'deep-flat-affect',
    type: 'incongruence',
    minimizers: ['ну да', 'ну вот', 'короче', 'ну типа', 'ну как бы', 'в общем'],
    realityMarkers: ['умер', 'рак', 'аборт', 'выкидыш', 'домашнее насилие', 'суицид', 'попытка', 'скорая', 'реанимация', 'больница'],
    label: '🔍 Инконгруэнтность: эмоциональное уплощение при тяжёлом контенте',
    explanation: 'Клиент описывает тяжёлую ситуацию в подчёркнуто бесстрастной, будничной манере',
    clinicalHint: 'Уплощение аффекта при травматическом материале. Возможна диссоциация, «замораживание» эмоций',
    severity: 'medium',
  },

  // ── Избегание и уход от темы ──
  {
    id: 'deep-topic-switch',
    type: 'avoidance',
    minimizers: ['кстати', 'а вот', 'вообще-то', 'давайте лучше', 'не хочу об этом', 'сменим тему', 'не будем об этом', 'ладно проехали', 'проехали'],
    realityMarkers: ['отец', 'мать', 'насили', 'измен', 'изнасило', 'избил', 'сексуальн', 'детств', 'обид', 'предал', 'травм'],
    label: '🚫 Избегание: уход от болезненной темы',
    explanation: 'Клиент резко переключает тему или просит не говорить о чём-то, что звучало до этого',
    clinicalHint: 'Вербализованное избегание — показатель приближения к горячему материалу. Зафиксировать тему для возврата',
    severity: 'medium',
  },
];

// ── Repeating patterns detector ──
// When a client repeats the same phrase/construction 3+ times in a short window
const REPETITION_PHRASES = [
  { root: 'не знаю', label: 'Повторяющееся «не знаю» — блокировка или диссоциация', hint: 'Клиент может блокировать осознание или использовать «не знаю» как защиту от контакта' },
  { root: 'не помню', label: 'Повторяющееся «не помню» — возможна диссоциативная амнезия', hint: 'Проверить, не связано ли с определённым периодом или событием' },
  { root: 'должен', label: 'Паттерн долженствования — императивное мышление', hint: 'Когнитивное искажение: «Должен» → «Хотел бы». Выявить иррациональное убеждение' },
  { root: 'всегда', label: 'Сверхобобщение — «всегда» как искажение', hint: 'Когнитивное искажение: чёрно-белое мышление и сверхобобщение' },
  { root: 'никогда', label: 'Сверхобобщение — «никогда» как искажение', hint: 'Когнитивное искажение: поляризованное мышление' },
  { root: 'виноват', label: 'Навязчивое самообвинение', hint: 'Рассмотреть интроективную конфигурацию и возможную депрессию' },
];

// ─── Hook ─────────────────────────────────────────────────────────────────

interface UseDeepInsightWatcherOptions {
  rawTranscriptText: string;
  topics: { id: string; label: string }[];
  enabled?: boolean;
  /** How many chars of recent transcript to analyze */
  windowSize?: number;
  /** Min seconds between insight emissions to avoid flooding */
  cooldownMs?: number;
}

export function useDeepInsightWatcher({
  rawTranscriptText,
  topics,
  enabled = true,
  windowSize = 400,
  cooldownMs = 30_000,
}: UseDeepInsightWatcherOptions) {
  const [currentInsight, setCurrentInsight] = useState<DeepInsight | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());
  const lastEmitTimeRef = useRef<number>(0);

  const dismiss = useCallback((id: string) => {
    dismissedRef.current.add(id);
    setCurrentInsight(prev => (prev?.id === id ? null : prev));
  }, []);

  useEffect(() => {
    if (!enabled || !rawTranscriptText || rawTranscriptText.length < 40) return;

    const now = Date.now();
    if (now - lastEmitTimeRef.current < cooldownMs) return;

    const recentText = rawTranscriptText.slice(-windowSize).toLowerCase();

    // ── 1. Check contra-patterns (contradictions, defenses, incongruence) ──
    for (const pat of CONTRA_PATTERNS) {
      if (dismissedRef.current.has(pat.id)) continue;

      const hasMinimizer = pat.minimizers.some(m => recentText.includes(m));
      const matchedReality = pat.realityMarkers.find(r => recentText.includes(r));

      if (hasMinimizer && matchedReality) {
        // Extract an excerpt surrounding the reality marker
        const idx = recentText.lastIndexOf(matchedReality);
        const start = Math.max(0, idx - 40);
        const end = Math.min(recentText.length, idx + matchedReality.length + 50);
        const rawSnippet = rawTranscriptText.slice(
          Math.max(0, rawTranscriptText.length - windowSize + start),
          Math.max(0, rawTranscriptText.length - windowSize + end)
        );
        const excerpt = (start > 0 ? '…' : '') + rawSnippet.trim() + (end < recentText.length ? '…' : '');

        setCurrentInsight({
          id: pat.id,
          type: pat.type,
          label: pat.label,
          excerpt,
          explanation: pat.explanation,
          clinicalHint: pat.clinicalHint,
          severity: pat.severity,
        });
        lastEmitTimeRef.current = now;
        return;
      }
    }

    // ── 2. Check repetition patterns ──
    for (const rep of REPETITION_PHRASES) {
      const repId = `deep-rep-${rep.root.replace(/\s/g, '_')}`;
      if (dismissedRef.current.has(repId)) continue;

      const regex = new RegExp(rep.root, 'gi');
      const matches = recentText.match(regex);
      if (matches && matches.length >= 3) {
        setCurrentInsight({
          id: repId,
          type: 'repetition',
          label: `🔁 ${rep.label}`,
          excerpt: `«${rep.root}» — встречается ${matches.length} раз в последних репликах`,
          explanation: rep.hint,
          clinicalHint: rep.hint,
          severity: 'medium',
        });
        lastEmitTimeRef.current = now;
        return;
      }
    }
  }, [rawTranscriptText, enabled, windowSize, cooldownMs, topics]);

  return { currentInsight, dismissInsight: dismiss };
}
