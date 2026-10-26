import React, { useState, useMemo, useRef, useEffect } from 'react';
import { t } from '../../lib/i18n.ts';
import { DeepInsight } from './useDeepInsightWatcher.ts';

export interface MapTopicNode {
  id: string;
  label: string;
  category?: 'core' | 'emotion' | 'thought' | 'behavior' | 'relation' | 'trauma' | 'resource';
  status: 'active' | 'sprint' | 'paused' | 'resolved' | 'homework' | 'risk';
  parentId?: string | null;
  dependencies?: string[]; // IDs of nodes this node influences or links to
  insight?: string;
}

export interface SessionSprint {
  phase: '1_exploration' | '2_desensitization' | '3_cognitive_shift' | '4_micro_step';
  goal: string;
  activeTopicId: string;
  microStep?: string;
}

interface SessionMindMapProps {
  transcriptText?: string;
  clientName?: string;
  topics?: MapTopicNode[];
  onTopicsChange?: (topics: MapTopicNode[]) => void;
  sprint?: SessionSprint;
  onSprintChange?: (sprint: SessionSprint) => void;
  onInsertToNotes?: (text: string) => void;
  onLogEvent?: (logEntry: string) => void;
  secondsElapsed?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onCloseExpanded?: () => void;
  theme?: 'light' | 'dark';
  deepInsight?: DeepInsight | null;
  onAcceptDeepInsight?: (insight: DeepInsight, targetStatus: 'sprint' | 'paused' | 'risk') => void;
  onDismissDeepInsight?: (id: string) => void;
}

export const getDefaultTopics = (): MapTopicNode[] => [
  {
    id: 'topic-1',
    label: t('Сильная тревога из-за сроков и учебы', 'Strong anxiety about deadlines and studies'),
    category: 'emotion',
    status: 'sprint',
    parentId: null,
    dependencies: ['topic-2', 'topic-3'],
    insight: t('Начинает трясти, когда приходят новые требования', 'Starts shaking when new requirements arrive')
  },
  {
    id: 'topic-2',
    label: t('Мысль: «Я обязан всё сделать идеально»', 'Thought: "I must do everything perfectly"'),
    category: 'thought',
    status: 'active',
    parentId: 'topic-1',
    dependencies: ['topic-4'],
    insight: t('Страх, что поругают или посчитают глупым', 'Fear of being scolded or seen as foolish')
  },
  {
    id: 'topic-3',
    label: t('Откладывание дел на потом (прокрастинация)', 'Postponing tasks for later (procrastination)'),
    category: 'behavior',
    status: 'active',
    parentId: 'topic-1',
    dependencies: [],
    insight: t('Защита: проще не начинать, чем ошибиться', 'Defense: easier not to start than make a mistake')
  },
  {
    id: 'topic-4',
    label: t('Строгая критика родителей за четверки', 'Strict parental criticism for good but non-top grades'),
    category: 'relation',
    status: 'paused',
    parentId: 'topic-2',
    dependencies: [],
    insight: t('Чувство, что любят только за идеальные оценки', 'Feeling that love is only given for perfect grades')
  },
  {
    id: 'topic-5',
    label: t('Плохо спит перед контрольными', 'Trouble sleeping before exams'),
    category: 'behavior',
    status: 'paused',
    parentId: 'topic-3',
    dependencies: []
  },
  {
    id: 'topic-6',
    label: t('Когда всё получилось вовремя (ресурс)', 'When everything worked out on time (resource)'),
    category: 'resource',
    status: 'resolved',
    parentId: null,
    dependencies: [],
    insight: t('Опора: умеет собраться, если рядом есть поддержка', 'Anchor: can focus when feeling supported')
  }
];

export const getDefaultSprint = (): SessionSprint => ({
  phase: '2_desensitization',
  goal: t('Понять, что ошибка — это нормальный опыт, и снизить напряжение', 'Understand that making a mistake is normal, and ease tension'),
  activeTopicId: 'topic-1',
  microStep: t('Простая мысль-поддержка: «Сделанное пусть неидеально, но уже шаг вперед»', 'Simple supportive thought: "Done even imperfectly is a step forward"')
});

export const SessionMindMap: React.FC<SessionMindMapProps> = ({
  transcriptText = '',
  clientName = 'Клиент',
  topics: externalTopics,
  onTopicsChange,
  sprint: externalSprint,
  onSprintChange,
  onInsertToNotes,
  onLogEvent,
  secondsElapsed = 0,
  isExpanded = false,
  onToggleExpand,
  onCloseExpanded,
  theme = 'light',
  deepInsight = null,
  onAcceptDeepInsight,
  onDismissDeepInsight,
}) => {
  const isDark = theme === 'dark';
  const [internalTopics, setInternalTopics] = useState<MapTopicNode[]>(() => getDefaultTopics());
  const [internalSprint, setInternalSprint] = useState<SessionSprint>(() => getDefaultSprint());

  const topics = externalTopics || internalTopics;
  const sprint = externalSprint || internalSprint;

  const activeSprintTopic = topics.find(t => t.id === sprint.activeTopicId) || topics.find(t => t.status === 'sprint');

  const setTopics = (updater: MapTopicNode[] | ((prev: MapTopicNode[]) => MapTopicNode[])) => {
    if (onTopicsChange) {
      const next = typeof updater === 'function' ? updater(topics) : updater;
      onTopicsChange(next);
    } else {
      setInternalTopics(updater);
    }
  };

  const setSprint = (updater: SessionSprint | ((prev: SessionSprint) => SessionSprint)) => {
    if (onSprintChange) {
      const next = typeof updater === 'function' ? updater(sprint) : updater;
      onSprintChange(next);
    } else {
      setInternalSprint(updater);
    }
  };

  // Node selection & inline action menu
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>('topic-1');
  const [linkingFromTopicId, setLinkingFromTopicId] = useState<string | null>(null);

  // Inline child adder state
  const [addingChildForId, setAddingChildForId] = useState<string | null>(null);
  const [childLabelInput, setChildLabelInput] = useState('');
  const childInputRef = useRef<HTMLInputElement>(null);

  // Protocol Guidance Modal / Popover for beginner psychologists
  const [showProtocolGuide, setShowProtocolGuide] = useState(false);

  useEffect(() => {
    if (addingChildForId && childInputRef.current) {
      childInputRef.current.focus();
    }
  }, [addingChildForId]);

  // Speech analysis & Auto-Pilot Phase Detection
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const lastProcessedTranscriptRef = useRef<string>('');

  // Automatic AI Phase Progression based on live speech flow
  useEffect(() => {
    if (!transcriptText || transcriptText === lastProcessedTranscriptRef.current) return;
    lastProcessedTranscriptRef.current = transcriptText;

    const lower = transcriptText.toLowerCase();

    // Heuristics for natural session progression:
    // 4. Wrap-up / Next step: "договор", "до следующ", "домашн", "попроб", "шаг", "задани"
    if (lower.includes('до следующ') || lower.includes('на этой неделе попроб') || lower.includes('задание') || lower.includes('один простой шаг') || lower.includes('итог')) {
      if (sprint.phase !== '4_micro_step') {
        setSprint(prev => ({ ...prev, phase: '4_micro_step' }));
        if (onLogEvent) onLogEvent(`${formatTime(secondsElapsed)} 🤖 ИИ: разговор перешел к подведению итогов и плану на неделю`);
      }
    } 
    // 3. Solution / Shift: "попробовать", "выход", "по-другому", "помочь себе", "справиться", "решение"
    else if (lower.includes('по-другому') || lower.includes('выход') || lower.includes('как можно поступить') || lower.includes('поддержать себя') || lower.includes('попробовать') || lower.includes('решение')) {
      if (sprint.phase !== '3_cognitive_shift' && sprint.phase !== '4_micro_step') {
        setSprint(prev => ({ ...prev, phase: '3_cognitive_shift' }));
        if (onLogEvent) onLogEvent(`${formatTime(secondsElapsed)} 🤖 ИИ: разговор перешел к поиску решений и новому взгляду`);
      }
    }
    // 2. Unpacking: "потому что", "случилось", "произошло", "боюсь", "тревож", "начальник", "мама", "папа", "вчера", "когда"
    else if (lower.includes('потому что') || lower.includes('произошло') || lower.includes('боюсь') || lower.includes('тревож') || lower.includes('чувствую вину') || lower.includes('случилось')) {
      if (sprint.phase === '1_exploration') {
        setSprint(prev => ({ ...prev, phase: '2_desensitization' }));
        if (onLogEvent) onLogEvent(`${formatTime(secondsElapsed)} 🤖 ИИ: перешли к детальному разбору ситуации`);
      }
    }
  }, [transcriptText, sprint.phase, secondsElapsed]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`;
  };

  const logTimestamp = formatTime(secondsElapsed);

  const phaseProtocols: Record<SessionSprint['phase'], {
    name: string;
    stepNum: number;
    color: string;
    clinicalGoal: string;
    recommendedInterventions: string[];
    sampleQuestions: string[];
  }> = {
    '1_exploration': {
      name: t('1. Встреча и контакт', '1. Welcome & Rapport'),
      stepNum: 1,
      color: '#60a5fa',
      clinicalGoal: 'Наладить доверие, успокоить человека и понять, с чем главным мы сегодня разбираемся.',
      recommendedInterventions: [
        'Тёплое приветствие и вопрос о текущем самочувствии',
        'Простая шкала напряжения (от 0 до 10): «На сколько сейчас тяжело?»',
        'Помочь выдохнуть: мягкий вдох носом и долгий спокойный выдох'
      ],
      sampleQuestions: [
        '«Как ты сегодня себя чувствуешь, с чем пришел?»',
        '«Что из происходящего сейчас тревожит больше всего?»'
      ]
    },
    '2_desensitization': {
      name: t('2. В чём дело', '2. Unpacking the Situation'),
      stepNum: 2,
      color: '#f59e0b',
      clinicalGoal: 'Спокойно распутать ситуацию: что именно произошло, какие мысли крутятся в голове и что пугает.',
      recommendedInterventions: [
        'Отделить реальные факты от страхов и домыслов',
        'Посмотреть, что происходит в теле (ком в горле, зажаты плечи)',
        'Заземление: опереться стопами в пол, почувствовать спинку кресла'
      ],
      sampleQuestions: [
        '«Что конкретно произошло? Расскажи по порядку, без спешки.»',
        '«Какая мысль в этот момент пугает или расстраивает сильнее всего?»'
      ]
    },
    '3_cognitive_shift': {
      name: t('3. Поиск решения', '3. Finding Solutions & Shift'),
      stepNum: 3,
      color: '#10b981',
      clinicalGoal: 'Найти другой, более добрый и реалистичный взгляд на вещи, почувствовать облегчение.',
      recommendedInterventions: [
        'Взгляд со стороны: «А что бы ты сказал лучшему другу в такой же ситуации?»',
        'Поиск исключений: «А когда у тебя уже получалось с этим справиться?»',
        'Снять груз идеальности: «Что самое худшее случится на самом деле? И как с этим быть?»'
      ],
      sampleQuestions: [
        '«Как можно взглянуть на это спокойнее и поддержать себя?»',
        '«Что прямо сейчас помогло бы тебе почувствовать больше уверенности?»'
      ]
    },
    '4_micro_step': {
      name: t('4. Итог и план', '4. Wrap-up & Next Step'),
      stepNum: 4,
      color: '#a855f7',
      clinicalGoal: 'Подвести спокойный итог, договориться об одном понятном шаге в жизни и завершить на ресурсе.',
      recommendedInterventions: [
        'Один простой шаг на 5 минут в реальной жизни',
        'Искренняя похвала за смелость и работу на встрече',
        'Короткая памятка или напоминалка в телефон'
      ],
      sampleQuestions: [
        '«С чем ты сегодня уходишь, что было самым ценным?»',
        '«Какой один простой шаг ты готов сделать до нашей следующей встречи?»'
      ]
    },
  };

  const handleNextPhase = () => {
    const phases: SessionSprint['phase'][] = ['1_exploration', '2_desensitization', '3_cognitive_shift', '4_micro_step'];
    const currentIdx = phases.indexOf(sprint.phase);
    const nextPhase = phases[(currentIdx + 1) % phases.length];
    setSprint(prev => ({ ...prev, phase: nextPhase }));

    const activeTopic = topics.find(t => t.id === sprint.activeTopicId);
    if (onLogEvent) {
      onLogEvent(`${logTimestamp} 🎯 Этап разговора: ${phaseProtocols[nextPhase].name}${activeTopic ? ` (вопрос: «${activeTopic.label}»)` : ''}`);
    }
  };

  const handleSetTopicStatus = (id: string, newStatus: MapTopicNode['status']) => {
    const targetTopic = topics.find(t => t.id === id);
    if (!targetTopic) return;

    setTopics(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, status: newStatus };
      }
      if (newStatus === 'sprint' && t.status === 'sprint') {
        return { ...t, status: 'active' };
      }
      return t;
    }));

    if (newStatus === 'sprint') {
      setSprint(prev => ({ ...prev, activeTopicId: id }));
    }

    if (onLogEvent) {
      if (newStatus === 'sprint') {
        onLogEvent(`${logTimestamp} 🎯 Взято в работу: «${targetTopic.label}» — этап: ${phaseProtocols[sprint.phase].name}`);
      } else if (newStatus === 'resolved') {
        onLogEvent(`${logTimestamp} ✅ Разобрались: «${targetTopic.label}»`);
      } else if (newStatus === 'homework') {
        onLogEvent(`${logTimestamp} {t("📝 Задание", "📝 Action Task")} на дом: «${targetTopic.label}»`);
      } else if (newStatus === 'paused') {
        onLogEvent(`${logTimestamp} 📦 Отложено на потом: «${targetTopic.label}»`);
      } else if (newStatus === 'active') {
        onLogEvent(`${logTimestamp} 🔍 Разбираем: «${targetTopic.label}»`);
      }
    }
  };

  // Add child or root topic directly
  const handleAddChildTopic = (parentId: string | null) => {
    if (!childLabelInput.trim()) {
      setAddingChildForId(null);
      return;
    }
    const newTopic: MapTopicNode = {
      id: `topic-${Date.now()}`,
      label: childLabelInput.trim(),
      status: 'active',
      parentId: parentId || null,
      dependencies: parentId ? [parentId] : []
    };

    setTopics(prev => [...prev, newTopic]);
    setSelectedTopicId(newTopic.id);
    setChildLabelInput('');
    setAddingChildForId(null);

    if (onLogEvent) {
      const parentTopic = parentId ? topics.find(t => t.id === parentId) : null;
      onLogEvent(`${logTimestamp} ➕ Добавлена ветвь: «${newTopic.label}»${parentTopic ? ` (вытекает из «${parentTopic.label}»)` : ''}`);
    }
  };

  const handleDeleteTopic = (id: string) => {
    const t = topics.find(item => item.id === id);
    setTopics(prev => prev.filter(item => item.id !== id && item.parentId !== id));
    if (selectedTopicId === id) setSelectedTopicId(null);
    if (addingChildForId === id) setAddingChildForId(null);
    if (linkingFromTopicId === id) setLinkingFromTopicId(null);
    if (t && onLogEvent) {
      onLogEvent(`${logTimestamp} 🗑️ Удалена ветвь: «${t.label}»`);
    }
  };

  const handleLinkNodes = (targetId: string) => {
    if (!linkingFromTopicId || linkingFromTopicId === targetId) {
      setLinkingFromTopicId(null);
      return;
    }

    setTopics(prev => prev.map(item => {
      if (item.id === linkingFromTopicId) {
        const deps = item.dependencies || [];
        if (deps.includes(targetId)) {
          return { ...item, dependencies: deps.filter(d => d !== targetId) };
        } else {
          return { ...item, dependencies: [...deps, targetId] };
        }
      }
      return item;
    }));

    const fromNode = topics.find(t => t.id === linkingFromTopicId);
    const toNode = topics.find(t => t.id === targetId);
    if (fromNode && toNode && onLogEvent) {
      onLogEvent(`${logTimestamp} 🔗 Связь: «${fromNode.label}» ➔ «${toNode.label}»`);
    }

    setLinkingFromTopicId(null);
  };

  const handleAiExtractMap = () => {
    setIsAiAnalyzing(true);
    setTimeout(() => {
      const lower = transcriptText.toLowerCase();
      const hasMother = lower.includes('мам') || lower.includes('родител');
      const hasWork = lower.includes('работ') || lower.includes('начальн') || lower.includes('шеф');
      const hasBody = lower.includes('дых') || lower.includes('плеч') || lower.includes('сердц') || lower.includes('ком');
      
      const newExtracted: MapTopicNode[] = [];
      if (hasMother && !topics.some(t => t.label.includes('матер') || t.label.includes('родител'))) {
        newExtracted.push({
          id: `topic-ai-${Date.now()}-1`,
          label: 'Эмоциональная сепарация от родителей',
          status: 'paused',
          parentId: 'topic-1',
          dependencies: ['topic-1'],
          insight: 'Выделено ИИ из речи: повторяющийся паттерн вины'
        });
      }
      if (hasWork && !topics.some(t => t.label.includes('руковод') || t.label.includes('начальн'))) {
        newExtracted.push({
          id: `topic-ai-${Date.now()}-2`,
          label: 'Конфликт ожиданий с руководителем',
          status: 'active',
          parentId: 'topic-1',
          dependencies: ['topic-1'],
          insight: 'Остро реагирует на тон сообщений и критику'
        });
      }
      if (hasBody && !topics.some(t => t.label.includes('зажим') || t.label.includes('соматик'))) {
        newExtracted.push({
          id: `topic-ai-${Date.now()}-3`,
          label: 'Телесный зажим при приближении дедлайна',
          status: 'active',
          parentId: sprint.activeTopicId || 'topic-1',
          dependencies: [sprint.activeTopicId || 'topic-1'],
          insight: 'Соматический маркер перегрузки и мышечный панцирь'
        });
      }

      if (newExtracted.length > 0) {
        setTopics(prev => [...prev, ...newExtracted]);
        if (onLogEvent) {
          onLogEvent(`${logTimestamp} 🧠 ИИ распознал в речи новые ветви графа: ${newExtracted.map(n => `«${n.label}»`).join(', ')}`);
        }
      } else {
        setShowProtocolGuide(true);
      }
      setIsAiAnalyzing(false);
    }, 700);
  };

  const handleExportMapToNotes = () => {
    if (!onInsertToNotes) return;
    let md = `\n### 🗺️ Граф сессии и ментальная карта (${new Date().toLocaleTimeString().slice(0, 5)}):\n`;
    const sprintT = topics.find(t => t.status === 'sprint');
    if (sprintT) {
      md += `🎯 **В фокусе (мишень):** ${sprintT.label} [Этап: ${phaseProtocols[sprint.phase].name}]\n`;
    }
    const resolved = topics.filter(t => t.status === 'resolved');
    if (resolved.length > 0) {
      md += `✅ **Проработано / Инсайты:**\n` + resolved.map(t => `  • ${t.label}`).join('\n') + `\n`;
    }
    const active = topics.filter(t => t.status === 'active');
    if (active.length > 0) {
      md += `🔍 **В исследовании:**\n` + active.map(t => `  • ${t.label}`).join('\n') + `\n`;
    }
    const hw = topics.filter(t => t.status === 'homework');
    if (hw.length > 0) {
      md += `🔄 **Домашка / Отработка:**\n` + hw.map(t => `  • ${t.label}`).join('\n') + `\n`;
    }
    const paused = topics.filter(t => t.status === 'paused');
    if (paused.length > 0) {
      md += `📦 **В контейнере (отложено):**\n` + paused.map(t => `  • ${t.label}`).join('\n') + `\n`;
    }
    onInsertToNotes(md);
  };

  // MULTI-LEVEL TREE & GRAPH LAYOUT
  const svgLayout = useMemo(() => {
    const W = isExpanded ? 860 : 440;
    const topMargin = 50;
    const rowHeight = isExpanded ? 54 : 48;
    const colWidth = isExpanded ? 160 : 120;
    const startX = isExpanded ? 60 : 45;

    // Calculate depth level for each node
    const depthMap: Record<string, number> = {};
    const getDepth = (id: string, visited: Set<string> = new Set()): number => {
      if (visited.has(id)) return 0;
      visited.add(id);
      const node = topics.find(t => t.id === id);
      if (!node || !node.parentId) return 0;
      return 1 + getDepth(node.parentId, visited);
    };

    topics.forEach(t => {
      depthMap[t.id] = getDepth(t.id);
    });

    // Compute positions: y based on sequential order with hierarchical indent
    const nodePositions: Record<string, { x: number; y: number; level: number }> = {};
    topics.forEach((topic, idx) => {
      const level = Math.min(depthMap[topic.id] || 0, 3);
      nodePositions[topic.id] = {
        x: startX + level * colWidth,
        y: topMargin + idx * rowHeight + rowHeight / 2,
        level
      };
    });

    const rootX = startX - 25;
    const rootY = topMargin + (topics.length * rowHeight) / 2;
    const totalH = Math.max(260, topMargin + topics.length * rowHeight + 80);

    return {
      W,
      H: totalH,
      rootX,
      rootY,
      nodePositions,
      colWidth
    };
  }, [topics, isExpanded]);

  const colors = useMemo(() => ({
    text: isDark ? '#f3f4f6' : '#0f172a',
    textMuted: isDark ? '#9ca3af' : '#64748b',
    border: isDark ? '#27272a' : '#e2e8f0',
    borderSecondary: isDark ? '#3f3f46' : '#cbd5e1',
    cardBg: isDark ? '#18181b' : '#ffffff',
    cardInnerBg: isDark ? '#27272a' : '#f8fafc',
    selectedCardBg: isDark ? '#27272a' : '#f1f5f9',
    svgBg: isDark ? '#141417' : '#f8fafc',
    svgShadow: isDark ? 'inset 0 2px 8px rgba(0,0,0,0.6)' : '0 1px 4px rgba(0,0,0,0.06)',
    btnBg: isDark ? '#27272a' : '#f1f5f9',
    btnBorder: isDark ? '#3f3f46' : '#cbd5e1',
    btnText: isDark ? '#e4e4e7' : '#334155',
    rootCircleFill: isDark ? '#1e1b4b' : '#eff6ff',
    rootCircleStroke: isDark ? '#3b82f6' : '#2563eb',
    rootText: isDark ? '#93c5fd' : '#1d4ed8',
  }), [isDark]);

  const selectedNode = topics.find(t => t.id === selectedTopicId);
  const selectedNodePos = selectedTopicId ? svgLayout.nodePositions[selectedTopicId] : null;
  const currentProtocol = phaseProtocols[sprint.phase];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '10px 12px', gap: '8px', boxSizing: 'border-box' }}>
      
      {/* Top Controls Bar: Minimal, Clinical & Reassuring */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: colors.text, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span>🗺️</span>
            <span>{t('Карта', 'Map')}</span>
          </span>

          {/* Privacy Icon Only */}
          <span 
            style={{ 
              fontSize: '0.75rem', 
              color: colors.textMuted, 
              cursor: 'help',
              opacity: 0.7
            }}
            title={t("🔒 Приватно: этот граф видите только вы. Клиент видит только ваше видео.", "Private: visible only to you. Client sees video only.")}
          >
            🔒
          </span>

          {/* Minimalist Phase Indicator (Automatic with optional manual override) */}
          {activeSprintTopic && (
            <span 
              onClick={handleNextPhase}
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                background: currentProtocol.color + '18',
                color: currentProtocol.color,
                border: `1px solid ${currentProtocol.color}40`,
                borderRadius: '10px',
                padding: '2px 7px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={t("Текущий этап (ИИ определяет автоматически по ходу речи, кликните для ручной смены)", "Current phase (auto-detected by AI, click to change manually)")}
            >
              <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: currentProtocol.color }} />
              {currentProtocol.name.split('. ')[1] || currentProtocol.name}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Quick Add Topic */}
          <button
            type="button"
            onClick={() => {
              setAddingChildForId('root');
              setChildLabelInput('');
            }}
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: isDark ? '#34d399' : '#059669',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={t("Добавить вопрос для обсуждения", "Add topic to discuss")}
          >
            + Вопрос
          </button>

          {/* AI Helper Button */}
          <button
            type="button"
            onClick={handleAiExtractMap}
            disabled={isAiAnalyzing}
            style={{
              background: isAiAnalyzing ? (isDark ? '#374151' : '#e2e8f0') : 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: isDark ? '#93c5fd' : '#1d4ed8',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={t("ИИ-подсказка по речи клиента", "AI suggestion based on speech")}
          >
            {isAiAnalyzing ? '⏳' : '⚡ Подсказка'}
          </button>

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              style={{
                background: isExpanded ? 'rgba(59, 130, 246, 0.25)' : colors.btnBg,
                border: isExpanded ? '1px solid #3b82f6' : `1px solid ${colors.btnBorder}`,
                color: isExpanded ? '#2563eb' : colors.btnText,
                borderRadius: '6px',
                padding: '3px 7px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title={isExpanded ? t("Свернуть граф обратно в панель", "Collapse") : t("Развернуть граф на весь экран", "Fullscreen")}
            >
              {isExpanded ? '🗗' : '⛶'}
            </button>
          )}

          {isExpanded && onCloseExpanded && (
            <button
              type="button"
              onClick={onCloseExpanded}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#dc2626',
                borderRadius: '6px',
                padding: '3px 7px',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Dynamic AI Tip Banner (Compact 1-2 lines, disappears on click) */}
      {showProtocolGuide && (
        <div style={{
          background: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(240, 249, 255, 0.95)',
          border: `1px solid ${currentProtocol.color}66`,
          borderRadius: '8px',
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem' }}>
            <span style={{ fontSize: '0.9rem' }}>💡</span>
            <div>
              <strong style={{ color: currentProtocol.color }}>{currentProtocol.name}:</strong>{' '}
              <span style={{ color: colors.text }}>{currentProtocol.sampleQuestions[0]}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowProtocolGuide(false)}
            style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Linking Mode Banner */}
      {linkingFromTopicId && (
        <div style={{
          background: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid #6366f1',
          borderRadius: '6px',
          padding: '4px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.74rem',
          color: isDark ? '#a5b4fc' : '#4338ca',
          flexShrink: 0
        }}>
          <span>🔗 <strong>{t('Режим связи:', 'Link mode:')}</strong> {t('Кликните на целевой узел, чтобы провести стрелку зависимости', 'Click target node to connect')}</span>
          <button
            type="button"
            onClick={() => setLinkingFromTopicId(null)}
            style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}
          >
            ✕ Отмена
          </button>
        </div>
      )}

      {/* Inline Quick Add Prompt (when adding child or root branch) */}
      {addingChildForId && (
        <div style={{
          background: colors.cardInnerBg,
          border: `1px solid ${colors.borderSecondary}`,
          borderRadius: '8px',
          padding: '6px 10px',
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '0.74rem', color: colors.textMuted, whiteSpace: 'nowrap' }}>
            {addingChildForId === 'root' ? '+ Корневой запрос:' : '{t("+ Следствие", "+ Consequence")} / Глубинная тема:'}
          </span>
          <input
            ref={childInputRef}
            type="text"
            value={childLabelInput}
            onChange={(e) => setChildLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddChildTopic(addingChildForId === 'root' ? null : addingChildForId);
              if (e.key === 'Escape') setAddingChildForId(null);
            }}
            placeholder={addingChildForId === 'root' ? t("Запрос клиента (симптом / ситуация)...", "Client request (symptom / situation)...") : t("Что запускает или вытекает дальше?...", "What triggers or follows next?...")}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '0.76rem',
              borderRadius: '4px',
              border: `1px solid ${colors.borderSecondary}`,
              background: colors.cardBg,
              color: colors.text
            }}
          />
          <button
            type="button"
            onClick={() => handleAddChildTopic(addingChildForId === 'root' ? null : addingChildForId)}
            style={{
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => setAddingChildForId(null)}
            style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Deep Insight Clinical Floating Card (if active) */}
      {deepInsight && (
        <div style={{
          background: isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(245, 243, 255, 0.95)',
          border: '1px solid #7c3aed',
          borderRadius: '8px',
          padding: '6px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '0.73rem', color: colors.text, lineHeight: 1.3, flex: 1 }}>
            <span style={{ fontWeight: 800, color: isDark ? '#c4b5fd' : '#6d28d9', marginRight: '4px' }}>🧠 Подсказка:</span>
            {deepInsight.explanation || deepInsight.clinicalHint || deepInsight.label}
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {onAcceptDeepInsight && (
              <button
                type="button"
                onClick={() => onAcceptDeepInsight(deepInsight, 'sprint')}
                style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}
              >
                В фокус
              </button>
            )}
            {onDismissDeepInsight && (
              <button
                type="button"
                onClick={() => onDismissDeepInsight(deepInsight.id)}
                style={{ background: 'transparent', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '0.75rem' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Central Interactive Graph Canvas - 100% of Space */}
      <div 
        onDoubleClick={() => {
          // Double click on canvas directly opens quick add root branch!
          setAddingChildForId('root');
          setChildLabelInput('');
        }}
        style={{
          flex: 1,
          background: colors.svgBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '10px',
          overflow: 'auto',
          position: 'relative',
          boxShadow: colors.svgShadow
        }}
        title={t("Двойной клик на свободном месте холста добавит новый запрос", "Double-click empty canvas to add a new branch")}
      >
        <svg 
          width={svgLayout.W} 
          height={svgLayout.H} 
          style={{ display: 'block', minHeight: '100%' }}
          onClick={() => {
            // Click on empty canvas deselects
            if (!linkingFromTopicId) {
              setSelectedTopicId(null);
            }
          }}
        >
          <defs>
            <marker id="map-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={isDark ? "#818cf8" : "#6366f1"} />
            </marker>
          </defs>

          {/* Root Client Indicator */}
          <g>
            <circle
              cx={svgLayout.rootX}
              cy={svgLayout.rootY}
              r={12}
              fill={colors.rootCircleFill}
              stroke={colors.rootCircleStroke}
              strokeWidth={2}
            />
            <text
              x={svgLayout.rootX}
              y={svgLayout.rootY + 3.5}
              textAnchor="middle"
              fontSize="9"
              fontWeight="800"
              fill={colors.rootText}
            >
              {clientName.slice(0, 1).toUpperCase()}
            </text>
          </g>

          {/* Hierarchical Tree Connections (Parent -> Child) */}
          {topics.map(t => {
            const childPos = svgLayout.nodePositions[t.id];
            if (!childPos) return null;

            if (t.parentId) {
              const parentPos = svgLayout.nodePositions[t.parentId];
              if (!parentPos) return null;

              // Smooth orthogonal-like bezier from parent to child
              return (
                <path
                  key={`tree-edge-${t.id}`}
                  d={`M ${parentPos.x + 8},${parentPos.y} C ${parentPos.x + (childPos.x - parentPos.x) / 2},${parentPos.y} ${parentPos.x + (childPos.x - parentPos.x) / 2},${childPos.y} ${childPos.x - 8},${childPos.y}`}
                  stroke={t.status === 'sprint' ? '#3b82f6' : (isDark ? '#4b5563' : '#cbd5e1')}
                  strokeWidth={t.status === 'sprint' ? 2 : 1.5}
                  fill="none"
                />
              );
            } else {
              // Connect root topics to Client root circle
              return (
                <path
                  key={`root-edge-${t.id}`}
                  d={`M ${svgLayout.rootX + 12},${svgLayout.rootY} C ${svgLayout.rootX + 35},${svgLayout.rootY} ${childPos.x - 30},${childPos.y} ${childPos.x - 8},${childPos.y}`}
                  stroke={t.status === 'sprint' ? '#3b82f6' : (isDark ? '#374151' : '#e2e8f0')}
                  strokeWidth={t.status === 'sprint' ? 2 : 1}
                  fill="none"
                />
              );
            }
          })}

          {/* Cross-Dependency Influence Curves between arbitrary topics */}
          {topics.map((t) => {
            const fromPos = svgLayout.nodePositions[t.id];
            if (!fromPos || !t.dependencies) return null;

            return t.dependencies.map((depId) => {
              if (depId === t.parentId) return null; // Already rendered by tree connection
              const toPos = svgLayout.nodePositions[depId];
              if (!toPos) return null;

              return (
                <path
                  key={`cross-edge-${t.id}-${depId}`}
                  d={`M ${fromPos.x + 4},${fromPos.y} C ${Math.min(fromPos.x, toPos.x) - 30},${fromPos.y} ${Math.min(fromPos.x, toPos.x) - 30},${toPos.y} ${toPos.x - 8},${toPos.y}`}
                  stroke={isDark ? "#818cf8" : "#6366f1"}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  markerEnd="url(#map-arrow)"
                  fill="none"
                  opacity={0.85}
                />
              );
            });
          })}

          {/* Node Circles & Labels */}
          {topics.map((topic) => {
            const pos = svgLayout.nodePositions[topic.id];
            if (!pos) return null;

            const isSelected = selectedTopicId === topic.id;
            const isSprint = topic.status === 'sprint';
            const isResolved = topic.status === 'resolved';
            const isHomework = topic.status === 'homework';
            const isPaused = topic.status === 'paused';

            let fillColor = isDark ? '#27272a' : '#f8fafc';
            let strokeColor = isDark ? '#4b5563' : '#94a3b8';
            let textColor = colors.text;

            if (isSprint) {
              fillColor = '#2563eb';
              strokeColor = '#60a5fa';
              textColor = '#3b82f6';
            } else if (isResolved) {
              fillColor = '#059669';
              strokeColor = '#34d399';
              textColor = '#059669';
            } else if (isHomework) {
              fillColor = '#7c3aed';
              strokeColor = '#a78bfa';
              textColor = '#7c3aed';
            } else if (isPaused) {
              fillColor = isDark ? '#374151' : '#e2e8f0';
              strokeColor = isDark ? '#6b7280' : '#94a3b8';
              textColor = colors.textMuted;
            }

            return (
              <g
                key={topic.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (linkingFromTopicId) {
                    handleLinkNodes(topic.id);
                  } else {
                    setSelectedTopicId(topic.id);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Active Focus Pulsing Ring */}
                {isSprint && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={14}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0.8}
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSprint ? 10 : 7.5}
                  fill={fillColor}
                  stroke={isSelected ? '#f59e0b' : strokeColor}
                  strokeWidth={isSelected ? 3 : 2}
                />

                {/* Level / Sub-problem visual pip */}
                {pos.level > 0 && (
                  <circle
                    cx={pos.x - 12}
                    cy={pos.y}
                    r={2}
                    fill={isDark ? '#6b7280' : '#cbd5e1'}
                  />
                )}

                {/* Node Label Text */}
                <text
                  x={pos.x + 14}
                  y={pos.y - 1}
                  fontSize={isExpanded ? "12.5" : "11"}
                  fontWeight={isSprint ? '800' : isSelected ? '700' : '500'}
                  fill={textColor}
                >
                  {isExpanded 
                    ? (topic.label.length > 55 ? `${topic.label.slice(0, 54)}…` : topic.label)
                    : (topic.label.length > 24 ? `${topic.label.slice(0, 23)}…` : topic.label)}
                </text>

                {/* Subtitle / Status in clinical terms */}
                <text
                  x={pos.x + 14}
                  y={pos.y + 11}
                  fontSize={isExpanded ? "9.5" : "8.5"}
                  fill={isSprint ? '#2563eb' : isResolved ? '#059669' : isHomework ? '#7c3aed' : colors.textMuted}
                >
                  {isSprint 
                    ? t('🎯 В фокусе (мишень)', '🎯 In focus (target)') 
                    : isResolved 
                    ? t('✓ Проработано', '✓ Processed') 
                    : isHomework 
                    ? t('🔄 Домашка', '🔄 Homework') 
                    : isPaused 
                    ? t('📦 В контейнере', '📦 Container') 
                    : pos.level > 0 ? `↳ ${t('Следствие', 'Sub-issue')}` : t('○ Запрос', '○ Core')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* CONTEXT POPUP ACTION BAR DIRECTLY OVER THE GRAPH */}
        {selectedNode && selectedNodePos && !linkingFromTopicId && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: Math.max(8, selectedNodePos.y - 44),
              left: Math.min(svgLayout.W - 340, Math.max(10, selectedNodePos.x + 14)),
              zIndex: 20,
              background: isDark ? '#1e1e24' : '#ffffff',
              border: `1px solid ${isDark ? '#3b82f6' : '#2563eb'}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              borderRadius: '8px',
              padding: '4px 6px',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
              backdropFilter: 'blur(8px)'
            }}
          >
            {/* Status: Sprint / In Focus */}
            {selectedNode.status !== 'sprint' && (
              <button
                type="button"
                onClick={() => handleSetTopicStatus(selectedNode.id, 'sprint')}
                style={{
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 7px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title={t("Взять эту тему в главное обсуждение прямо сейчас", "Take this topic into main discussion right now")}
              >
                {t("🎯 В работу", "🎯 In Focus")}
              </button>
            )}

            {/* Status: Resolved / Processed */}
            {selectedNode.status !== 'resolved' && (
              <button
                type="button"
                onClick={() => handleSetTopicStatus(selectedNode.id, 'resolved')}
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 7px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title={t("Отметить вопрос как решённый: нашли понимание или ответ", "Mark as sorted out / resolved")}
              >
                {t("✓ Разобрались", "✓ Resolved")}
              </button>
            )}

            {/* Status: Homework */}
            {selectedNode.status !== 'homework' && (
              <button
                type="button"
                onClick={() => handleSetTopicStatus(selectedNode.id, 'homework')}
                style={{
                  background: '#7c3aed',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 7px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title={t("Договориться об одном простом шаге или наблюдении до следующей встречи", "Set as a simple take-home step")}
              >
                {t("📝 Задание", "📝 Action Task")}
              </button>
            )}

            {/* Status: Container / Parking */}
            {selectedNode.status !== 'paused' && (
              <button
                type="button"
                onClick={() => handleSetTopicStatus(selectedNode.id, 'paused')}
                style={{
                  background: isDark ? '#374151' : '#e2e8f0',
                  color: isDark ? '#9ca3af' : '#475569',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  fontSize: '0.68rem',
                  cursor: 'pointer'
                }}
                title={t("Отложить на потом, чтобы не перегружать человека и не сбиваться с главного", "Postpone for later to keep things simple")}
              >
                {t("📦 Отложить", "📦 Postpone")}
              </button>
            )}

            {/* Add Child Level Node */}
            <button
              type="button"
              onClick={() => {
                setAddingChildForId(selectedNode.id);
                setChildLabelInput('');
              }}
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: isDark ? '#93c5fd' : '#1d4ed8',
                border: '1px solid #3b82f6',
                borderRadius: '4px',
                padding: '3px 7px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title={t("Добавить под-тему: из-за чего это или к чему приводит", "Add sub-topic: why or consequences")}
            >
              {t("+ Следствие", "+ Consequence")}
            </button>

            {/* Link Cross Connection */}
            <button
              type="button"
              onClick={() => setLinkingFromTopicId(selectedNode.id)}
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: isDark ? '#a5b4fc' : '#4f46e5',
                border: '1px solid #6366f1',
                borderRadius: '4px',
                padding: '3px 6px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title={t("Показать стрелочкой связь с другой темой", "Connect with arrow to another topic")}
            >
              {t("🔗 Связать", "🔗 Link")}
            </button>

            {/* Delete Node */}
            <button
              type="button"
              onClick={() => handleDeleteTopic(selectedNode.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '2px 4px'
              }}
              title={t("Удалить", "Delete")}
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionMindMap;
