import { t } from "../lib/i18n.ts";
import { useState, useMemo, useEffect } from "react";
import SpeechDictationButton from "./SpeechDictationButton.tsx";
import DocumentSmartChat from "./DocumentSmartChat.tsx";
import { appendDictatedChunk } from "../lib/ai_text_utils.ts";
import { parseConsultationSession } from "../lib/consultation_session.ts";
import { parseWorkLogNote, MODALITY_LABELS, RISK_LEVEL_LABELS } from "../lib/progress_note.ts";
import { formatConsultationSessionTagsSummary } from "../lib/session_tagging.ts";
import { formatWorkDuration } from "../lib/worklog.ts";
import { requestOpenConsultationCase } from "../lib/workspace_navigation.ts";
import {
  CONTACT_RISK_SPHERES,
  CONTACT_PROTECTIVE_SPHERES,
  CONTACT_ACTION_TAXONOMY,
  CONTACT_OFFENSE_ARTICLES,
  calculateRiskProfile,
  generateSixMonthPreventionRoute,
} from "./IprContactSedFullTaxonomy.ts";
import type { ArchitectStageId } from "../lib/architect_picker.ts";

export interface ContactSedData {
  demographics?: {
    gender?: string;
    birthDate?: string;
    birthPlace?: string;
    citizenship?: string;
    registrationAddress?: string;
    actualAddress?: string;
    phone?: string;
    socialLinks?: string;
    documents?: string;
    parents?: string;
  };
  offense?: {
    basis?: string;
    articles?: string;
    clientCategory?: string;
    registrations?: string;
    isSop?: boolean;
    sopDateStart?: string;
    sopDateEnd?: string;
    criminalBlockEnabled?: boolean;
  };
  narcology?: {
    enabled?: boolean;
    detectionSource?: string; // e.g., 'mvd', 'smp', 'school', 'parents', 'anonymous'
    examProtocolNum?: string; // ХТИ protocol number
    examDate?: string; // Date of ХТИ or exam
    substance?: string; // e.g. cannabinoids, synthetic, amphetamine, alcohol, unknown
    dispensaryStatus?: string; // e.g. 'none', 'voluntary', 'registered', 'evading'
    koapDeadline?: string; // Date for 60 days КоАП
    cleanTestsCount?: number; // Number of clean tests
    leisureActivities?: string; // кружки/секции
  };
  suicideRisk?: {
    enabled?: boolean;
    scale?: string; // C-SSRS / NSSI
    riskLevel?: string; // none, low, moderate, high, critical
    indicators?: string[];
    lastCrisisDate?: string;
    safetyPlanAgreed?: boolean;
    consultedPsychiatrist?: boolean;
    notes?: string;
  };
  eatingDisorderRisk?: {
    enabled?: boolean;
    scale?: string; // SCOFF / EAT-26
    riskLevel?: string; // none, moderate, high
    indicators?: string[];
    weightDynamics?: string;
    notes?: string;
  };
  bullyingRisk?: {
    enabled?: boolean;
    scale?: string; // Olweus / Бочавер
    role?: string; // victim, aggressor, follower, witness, none
    forms?: string[]; // verbal, physical, cyber, boycott, extortion
    location?: string;
    safetyMeasures?: string;
    notes?: string;
  };
  schoolAnxietyRisk?: {
    enabled?: boolean;
    scale?: string; // PHQ-A / GAD-7 / SRAS-R / Филлипс
    riskLevel?: string; // none, mild, moderate, severe
    primaryReason?: string;
    indicators?: string[];
    safetyMeasures?: string;
    notes?: string;
  };
  cyberRisk?: {
    enabled?: boolean;
    scale?: string; // CSTAG / Threat Assessment
    riskLevel?: string; // low, moderate, high
    indicators?: string[];
    notes?: string;
  };
  runawayRisk?: {
    enabled?: boolean;
    frequency?: string; // single, repeated, systemic
    triggers?: string;
    lastEpisodeDate?: string;
    indicators?: string[];
    notes?: string;
  };
  familyViolenceRisk?: {
    enabled?: boolean;
    scale?: string; // ACEs / СОП
    indicators?: string[];
    cpsInvolved?: boolean;
    notes?: string;
  };
  gadgetAddictionRisk?: {
    enabled?: boolean;
    scale?: string; // IAT / CIAS / DSM-5 IGD
    screenTimeHoursDaily?: number;
    indicators?: string[];
    sleepDisruption?: boolean;
    notes?: string;
  };
  risks?: Record<string, string[]>; // { sphereId: [riskKey1, riskKey2] }
  protectiveFactors?: Record<string, string[]>; // { sphereId: [protectiveKey1, protectiveKey2] }
  actions?: {
    id: string;
    category: string;
    actionName: string;
    plannedDate?: string;
    actualDate?: string;
    executor?: string;
    notes?: string;
  }[];
  conclusions?: {
    status?: string;
    monthsExtension?: number;
    closeReason?: string;
    notes?: string;
  };
  professionalOverride?: {
    enabled?: boolean;
    overriddenLevel?: "norm" | "moderate" | "elevated" | "critical";
    justification?: string;
  };
}

interface IprContactSedSectionProps {
  data: ContactSedData;
  onChange: (newData: ContactSedData) => void;
  disabled?: boolean;
  terminalUserId?: string;
  subscriptionActive: boolean;
  paywallUrl: string;
  caseVisits?: any[];
  caseArtifacts?: any;
  adolescentName?: string;
  caseId?: string | null;
}

const FREQUENT_ARTICLES = [
  { code: "ст. 7.27 КоАП РФ", label: "ст. 7.27 КоАП (Мелкое хищение)" },
  { code: "ст. 6.9 КоАП РФ", label: "ст. 6.9 КоАП (Потребление наркотиков)" },
  { code: "ст. 20.20 КоАП РФ", label: "ст. 20.20 КоАП (Распитие алкоголя)" },
  { code: "ст. 20.21 КоАП РФ", label: "ст. 20.21 КоАП (Появление в сост. опьянения)" },
  { code: "ст. 20.1 КоАП РФ", label: "ст. 20.1 КоАП (Мелкое хулиганство)" },
  { code: "ст. 6.1.1 КоАП РФ", label: "ст. 6.1.1 КоАП (Побои)" },
  { code: "ст. 20.22 КоАП РФ", label: "ст. 20.22 КоАП (Опьянение до 16 лет)" },
  { code: "ст. 158 УК РФ", label: "ст. 158 УК (Кража)" },
  { code: "ст. 228 УК РФ", label: "ст. 228 УК (Наркотики)" },
  { code: "ст. 213 УК РФ", label: "ст. 213 УК (Хулиганство)" },
];

export default function IprContactSedSection({
  data,
  onChange,
  disabled,
  terminalUserId,
  subscriptionActive,
  paywallUrl,
  caseVisits = [],
  caseArtifacts = {},
  adolescentName = "Подросток",
  caseId,
}: IprContactSedSectionProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "actions" | "reports">("profile");
  // По умолчанию все блоки свернуты, раскрываются по мере необходимости
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [traceModal, setTraceModal] = useState<{
    title: string;
    badge?: string;
    text?: string;
    sections?: { label: string; value: string }[];
    caseId?: string;
    actionKind?: string;
  } | null>(null);
  const [copiedTraceNotice, setCopiedTraceNotice] = useState(false);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateDemoField = (field: string, val: string) => {
    onChange({
      ...data,
      demographics: {
        ...(data.demographics || {}),
        [field]: val,
      },
    });
  };

  const updateOffenseField = (field: string, val: any) => {
    onChange({
      ...data,
      offense: {
        ...(data.offense || {}),
        [field]: val,
      },
    });
  };

  const updateNarcologyField = (field: string, val: any) => {
    onChange({
      ...data,
      narcology: {
        ...(data.narcology || {}),
        [field]: val,
      },
    });
  };

  const updateSuicideRiskField = (field: string, val: any) => {
    onChange({
      ...data,
      suicideRisk: {
        ...(data.suicideRisk || {}),
        [field]: val,
      },
    });
  };

  const toggleSuicideIndicator = (key: string) => {
    const list = data.suicideRisk?.indicators || [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({
      ...data,
      suicideRisk: {
        ...(data.suicideRisk || {}),
        indicators: next,
      },
    });
  };

  const updateEatingDisorderField = (field: string, val: any) => {
    onChange({
      ...data,
      eatingDisorderRisk: {
        ...(data.eatingDisorderRisk || {}),
        [field]: val,
      },
    });
  };

  const toggleEatingDisorderIndicator = (key: string) => {
    const list = data.eatingDisorderRisk?.indicators || [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({
      ...data,
      eatingDisorderRisk: {
        ...(data.eatingDisorderRisk || {}),
        indicators: next,
      },
    });
  };

  const updateBullyingField = (field: string, val: any) => {
    onChange({
      ...data,
      bullyingRisk: {
        ...(data.bullyingRisk || {}),
        [field]: val,
      },
    });
  };

  const toggleBullyingForm = (formKey: string) => {
    const list = data.bullyingRisk?.forms || [];
    const next = list.includes(formKey) ? list.filter((f) => f !== formKey) : [...list, formKey];
    onChange({
      ...data,
      bullyingRisk: {
        ...(data.bullyingRisk || {}),
        forms: next,
      },
    });
  };

  const updateSchoolAnxietyField = (field: string, val: any) => {
    onChange({
      ...data,
      schoolAnxietyRisk: {
        ...(data.schoolAnxietyRisk || {}),
        [field]: val,
      },
    });
  };

  const toggleSchoolAnxietyIndicator = (key: string) => {
    const list = data.schoolAnxietyRisk?.indicators || [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({
      ...data,
      schoolAnxietyRisk: {
        ...(data.schoolAnxietyRisk || {}),
        indicators: next,
      },
    });
  };

  const updateCyberRiskField = (field: string, val: any) => {
    onChange({
      ...data,
      cyberRisk: {
        ...(data.cyberRisk || {}),
        [field]: val,
      },
    });
  };

  const toggleCyberRiskIndicator = (key: string) => {
    const list = data.cyberRisk?.indicators || [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({
      ...data,
      cyberRisk: {
        ...(data.cyberRisk || {}),
        indicators: next,
      },
    });
  };

  const updateRunawayRiskField = (field: string, val: any) => {
    onChange({
      ...data,
      runawayRisk: {
        ...(data.runawayRisk || {}),
        [field]: val,
      },
    });
  };

  const toggleRunawayIndicator = (key: string) => {
    const list = data.runawayRisk?.indicators || [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({
      ...data,
      runawayRisk: {
        ...(data.runawayRisk || {}),
        indicators: next,
      },
    });
  };

  const updateFamilyViolenceField = (field: string, val: any) => {
    onChange({
      ...data,
      familyViolenceRisk: {
        ...(data.familyViolenceRisk || {}),
        [field]: val,
      },
    });
  };

  const toggleFamilyViolenceIndicator = (key: string) => {
    const list = data.familyViolenceRisk?.indicators || [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({
      ...data,
      familyViolenceRisk: {
        ...(data.familyViolenceRisk || {}),
        indicators: next,
      },
    });
  };

  const updateGadgetRiskField = (field: string, val: any) => {
    onChange({
      ...data,
      gadgetAddictionRisk: {
        ...(data.gadgetAddictionRisk || {}),
        [field]: val,
      },
    });
  };

  const toggleGadgetIndicator = (key: string) => {
    const list = data.gadgetAddictionRisk?.indicators || [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    onChange({
      ...data,
      gadgetAddictionRisk: {
        ...(data.gadgetAddictionRisk || {}),
        indicators: next,
      },
    });
  };

  const toggleRiskItem = (sphereId: string, itemKey: string) => {
    const sphereRisks = data.risks?.[sphereId] || [];
    const newSphereRisks = sphereRisks.includes(itemKey)
      ? sphereRisks.filter((k) => k !== itemKey)
      : [...sphereRisks, itemKey];

    onChange({
      ...data,
      risks: {
        ...(data.risks || {}),
        [sphereId]: newSphereRisks,
      },
    });
  };

  const toggleProtectiveItem = (sphereId: string, itemKey: string) => {
    const sphereProtective = data.protectiveFactors?.[sphereId] || [];
    const newSphereProtective = sphereProtective.includes(itemKey)
      ? sphereProtective.filter((k) => k !== itemKey)
      : [...sphereProtective, itemKey];

    onChange({
      ...data,
      protectiveFactors: {
        ...(data.protectiveFactors || {}),
        [sphereId]: newSphereProtective,
      },
    });
  };

  // Расчет баллов и кумулятивного индекса риска (0–100%) по 9 сферам, 3 субшкалам и Override
  const riskProfile = useMemo(() => {
    return calculateRiskProfile(
      data.risks || {},
      data.protectiveFactors || {},
      {
        isCriminalCategory: Boolean(data.offense?.clientCategory && data.offense.clientCategory !== "prevention"),
        isSop: data.offense?.isSop,
        specialized: {
          suicideRisk: data.suicideRisk,
          eatingDisorderRisk: data.eatingDisorderRisk,
          bullyingRisk: data.bullyingRisk,
          schoolAnxietyRisk: data.schoolAnxietyRisk,
          cyberRisk: data.cyberRisk,
          runawayRisk: data.runawayRisk,
          familyViolenceRisk: data.familyViolenceRisk,
          gadgetAddictionRisk: data.gadgetAddictionRisk,
          narcology: data.narcology,
        },
        professionalOverride: data.professionalOverride,
      }
    );
  }, [
    data.risks,
    data.protectiveFactors,
    data.offense?.clientCategory,
    data.offense?.isSop,
    data.suicideRisk,
    data.eatingDisorderRisk,
    data.bullyingRisk,
    data.schoolAnxietyRisk,
    data.cyberRisk,
    data.runawayRisk,
    data.familyViolenceRisk,
    data.gadgetAddictionRisk,
    data.narcology,
    data.professionalOverride,
  ]);

  const protectiveSpheresMap = useMemo(() => {
    const map: Record<string, (typeof CONTACT_PROTECTIVE_SPHERES)[0]> = {};
    for (const sph of CONTACT_PROTECTIVE_SPHERES) {
      map[sph.id] = sph;
    }
    return map;
  }, []);

  const sphereScoresMap = riskProfile.sphereScores || {};

  // Проверка активности криминального блока показателей
  const isCriminalBlockActive = Boolean(
    data.offense?.criminalBlockEnabled ||
    (data.offense?.articles && data.offense.articles.trim().length > 0) ||
    (data.offense?.basis && data.offense.basis.trim().length > 0) ||
    data.offense?.isSop ||
    (data.offense?.clientCategory && data.offense.clientCategory !== "prevention" && data.offense.clientCategory !== "")
  );

  const toggleCriminalBlock = (enabled: boolean) => {
    updateOffenseField("criminalBlockEnabled", enabled);
  };

  const isNarcologyBlockActive = Boolean(
    data.narcology?.enabled ||
    (data.narcology?.detectionSource && data.narcology.detectionSource.trim().length > 0) ||
    (data.narcology?.substance && data.narcology.substance.trim().length > 0) ||
    (data.narcology?.dispensaryStatus && data.narcology.dispensaryStatus.trim().length > 0)
  );

  const toggleNarcologyBlock = (enabled: boolean) => {
    updateNarcologyField("enabled", enabled);
  };

  const handleToggleArticle = (code: string) => {
    const current = data.offense?.articles || "";
    let parts = current ? current.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (parts.includes(code)) {
      parts = parts.filter((p) => p !== code);
    } else {
      parts.push(code);
    }
    updateOffenseField("articles", parts.join(", "));
  };

  // Автоматическое формирование 6-месячного маршрута со всеми обоснованиями
  const handleGenerateSixMonthRoute = () => {
    const route = generateSixMonthPreventionRoute({
      adolescentName: adolescentName || "Подросток",
      articles: data.offense?.articles,
      risks: data.risks,
      protectiveFactors: data.protectiveFactors,
    });

    const existing = data.actions || [];
    if (existing.length > 0) {
      if (!window.confirm("В плане уже есть запланированные действия. Заменить их типовым 6-месячным профилактическим маршрутом? (Нажмите Отмена, чтобы дописать к текущим)")) {
        onChange({
          ...data,
          actions: [...existing, ...route],
        });
        return;
      }
    }
    onChange({
      ...data,
      actions: route,
    });
  };

  // Управление действиями
  const addAction = (category: string, defaultName: string = "") => {
    const newAct = {
      id: crypto.randomUUID(),
      category,
      actionName: defaultName,
      plannedDate: "",
      executor: "",
      notes: "",
    };
    onChange({
      ...data,
      actions: [...(data.actions || []), newAct],
    });
  };

  const updateAction = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      actions: (data.actions || []).map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    });
  };

  const removeAction = (id: string) => {
    onChange({
      ...data,
      actions: (data.actions || []).filter((a) => a.id !== id),
    });
  };

  // Контекст для ИИ-помощника
  const serializedStateText = useMemo(() => {
    return `[Текущая карта сопровождаемого]
Демография: ${JSON.stringify(data.demographics || {})}
Статьи/Учет (Криминальный блок): ${JSON.stringify(data.offense || {})}
Нарко-профилактика (ПАВ): ${JSON.stringify(data.narcology || {})}
Суицидальный риск / NSSI: ${JSON.stringify(data.suicideRisk || {})}
Риск РПП (пищевое поведение): ${JSON.stringify(data.eatingDisorderRisk || {})}
Риск буллинга: ${JSON.stringify(data.bullyingRisk || {})}
Школьная тревожность / отказ: ${JSON.stringify(data.schoolAnxietyRisk || {})}
Киберугрозы / деструктивные группы: ${JSON.stringify(data.cyberRisk || {})}
Самовольные уходы / бродяжничество: ${JSON.stringify(data.runawayRisk || {})}
Семейное неблагополучие / насилие (ACEs): ${JSON.stringify(data.familyViolenceRisk || {})}
Экранная / игровая зависимость: ${JSON.stringify(data.gadgetAddictionRisk || {})}
Отмеченные риски (уязвимости по 9 сферам): ${JSON.stringify(data.risks || {})}
Защитные ресурсы (опоры): ${JSON.stringify(data.protectiveFactors || {})}
Индекс риска: ${riskProfile.cumulativeIndex}% (${riskProfile.levelLabel})
Запланированные действия: ${JSON.stringify(data.actions || [])}
Итог: ${JSON.stringify(data.conclusions || {})}`;
  }, [data, riskProfile]);

  const handleApplyAiFields = async (_stage: ArchitectStageId, _text: string, segments?: Record<string, string>) => {
    if (segments) {
      const nextDemo = { ...data.demographics };
      const nextOffense = { ...data.offense };
      const nextRisks = { ...data.risks };

      if (segments.gender) nextDemo.gender = segments.gender.toLowerCase().includes("жен") ? "female" : "male";
      if (segments.birthPlace) nextDemo.birthPlace = segments.birthPlace;
      if (segments.citizenship) nextDemo.citizenship = segments.citizenship;
      if (segments.parents) nextDemo.parents = segments.parents;
      if (segments.actualAddress) nextDemo.actualAddress = segments.actualAddress;

      if (segments.basis) nextOffense.basis = segments.basis;
      if (segments.articles) nextOffense.articles = segments.articles;
      if (segments.registrations) nextOffense.registrations = segments.registrations;

      if (segments.detected_risks) {
        try {
          const parsed = JSON.parse(segments.detected_risks);
          Object.keys(parsed).forEach((k) => {
            if (Array.isArray(parsed[k])) {
              nextRisks[k] = parsed[k];
            }
          });
        } catch {
          // fallback
        }
      }

      onChange({
        ...data,
        demographics: nextDemo,
        offense: nextOffense,
        risks: nextRisks,
      });
    }
  };

  const handleApplyAiPlan = async (_stage: ArchitectStageId, _text: string, segments?: Record<string, string>) => {
    if (segments && segments.suggested_actions) {
      try {
        const parsed = JSON.parse(segments.suggested_actions);
        if (Array.isArray(parsed)) {
          const nextActions = [...(data.actions || [])];
          parsed.forEach((act: any) => {
            if (act.category && act.actionName) {
              nextActions.push({
                id: crypto.randomUUID(),
                category: act.category,
                actionName: act.actionName,
                notes: act.notes || "",
                executor: act.executor || "",
                plannedDate: act.plannedDate || "",
              });
            }
          });
          onChange({ ...data, actions: nextActions });
        }
      } catch {
        // fallback
      }
    }
  };

  const handleApplyAiReport = async (_stage: ArchitectStageId, text: string, segments?: Record<string, string>) => {
    if (segments) {
      onChange({
        ...data,
        conclusions: {
          ...(data.conclusions || {}),
          status: segments.status || data.conclusions?.status,
          closeReason: segments.closeReason || data.conclusions?.closeReason,
          notes: text,
        },
      });
    }
  };

  // Закрытие модалки по Escape
  useEffect(() => {
    if (!traceModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTraceModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [traceModal]);

  // Сортировка следов дела по реальной календарной дате проведения и расчет правильной нумерации встреч
  const sortedTraces = useMemo(() => {
    if (!caseVisits || caseVisits.length === 0) return [];

    const getVisitTime = (v: any): number => {
      if (v.note) {
        try {
          const s = parseConsultationSession(v.note);
          if (s.visitDate) {
            const t = new Date(s.visitDate).getTime();
            if (!Number.isNaN(t) && t > 0) return t;
          }
        } catch {
          // fallback
        }
      }
      if (v.visit_date) {
        const t = new Date(v.visit_date).getTime();
        if (!Number.isNaN(t) && t > 0) return t;
      }
      const raw = v.created_at ? Number(v.created_at) : 0;
      if (raw > 0) {
        return raw < 1e11 ? raw * 1000 : raw;
      }
      return 0;
    };

    const formatVisitDate = (v: any): string => {
      if (v.note) {
        try {
          const s = parseConsultationSession(v.note);
          if (s.visitDate) {
            const d = new Date(s.visitDate);
            if (!Number.isNaN(d.getTime())) {
              return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
            }
          }
        } catch {
          // fallback
        }
      }
      if (v.visit_date) {
        const d = new Date(v.visit_date);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
        }
        return v.visit_date;
      }
      const raw = v.created_at ? Number(v.created_at) : 0;
      if (raw > 0) {
        const ms = raw < 1e11 ? raw * 1000 : raw;
        return new Date(ms).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
      }
      return "—";
    };

    // Сортируем индивидуальные консультации хронологически от первой к последней
    const consultations = caseVisits
      .filter((v: any) => v.action_kind !== "group_session")
      .map((v: any) => ({
        entry: v,
        time: getVisitTime(v),
        dateStr: formatVisitDate(v),
      }))
      .sort((a, b) => a.time - b.time);

    // Присваиваем стабильные порядковые номера встреч (Встреча 1, Встреча 2...)
    const sessionNumberMap = new Map<string, number>();
    consultations.forEach((c, idx) => {
      sessionNumberMap.set(c.entry.entry_id, idx + 1);
    });

    const all = caseVisits.map((v: any) => {
      const isGroup = v.action_kind === "group_session";
      const cleanTitle = (v.action_title || "").replace(/^Групповое занятие:\s*/i, "").trim();
      const time = getVisitTime(v);
      const dateStr = formatVisitDate(v);
      const sessionNumber = isGroup ? undefined : sessionNumberMap.get(v.entry_id);

      return {
        entry_id: v.entry_id,
        isGroup,
        cleanTitle,
        time,
        dateStr,
        sessionNumber,
        rawEntry: v,
      };
    });

    // Отображаем хронологически слева направо (от первых контактов к текущим)
    return all.sort((a, b) => a.time - b.time);
  }, [caseVisits]);

  return (
    <div className="ipr-contact-sed-block" style={{ marginTop: "24px" }}>
      {/* Лента консультаций и протоколов */}
      <div className="visits-badge-strip" style={{ marginBottom: "16px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        <span className="muted tiny" style={{ marginRight: "4px", fontWeight: 600 }}>Связанные следы дела:</span>
        {sortedTraces.length === 0 ? (
          <span className="muted tiny">Занятия и консультации пока не добавлены.</span>
        ) : (
          sortedTraces.map((trace) => {
            const v = trace.rawEntry;
            const isGroup = trace.isGroup;
            const dateStr = trace.dateStr;
            const cleanTitle = trace.cleanTitle;
            const meetingNum = trace.sessionNumber;

            const handleOpenTrace = () => {
              if (isGroup) {
                setTraceModal({
                  title: `👥 Групповое занятие: ${cleanTitle || "Занятие"} (${dateStr})`,
                  badge: "Групповая работа",
                  text: v.note || "Протокол группового занятия не содержит текста.",
                });
                return;
              }

              const session = parseConsultationSession(v.note || "");
              const parsedNote = parseWorkLogNote(v.note || "");
              const tagsSummary = session.sessionTags ? formatConsultationSessionTagsSummary(session.sessionTags) : "";
              const durationText = v.minutes ? formatWorkDuration(v.minutes) : "";

              const sections: { label: string; value: string }[] = [];
              if (durationText) {
                sections.push({ label: "⏱️ Длительность встречи", value: durationText });
              }
              if (tagsSummary) {
                sections.push({ label: "🏷️ Темы и фокус", value: tagsSummary });
              }
              if (session.progress.goal?.trim()) {
                sections.push({ label: "🎯 Цель и запрос встречи", value: session.progress.goal.trim() });
              }
              if (session.progress.observations?.trim()) {
                sections.push({ label: "🔍 Наблюдения и факты (что сообщил клиент)", value: session.progress.observations.trim() });
              }
              if (session.progress.intervention?.trim()) {
                sections.push({ label: "💡 Проведенная работа (поиск решения)", value: session.progress.intervention.trim() });
              }
              if (session.progress.assessmentResponse?.trim()) {
                sections.push({ label: "🧠 Реакция и результат (оценка специалиста)", value: session.progress.assessmentResponse.trim() });
              }
              if (session.progress.plan?.trim()) {
                sections.push({ label: "🌱 Итог, план и договорённости (задание)", value: session.progress.plan.trim() });
              }
              if (session.clinicalNarrative?.trim()) {
                sections.push({ label: "📝 Заметки специалиста", value: session.clinicalNarrative.trim() });
              } else if (parsedNote.kind === "legacy" && parsedNote.text.trim() && !parsedNote.text.trim().startsWith("{")) {
                sections.push({ label: "📝 Заметки по встрече", value: parsedNote.text.trim() });
              }
              if (session.transcript?.trim()) {
                sections.push({ label: "🎙️ Стенограмма аудиозаписи", value: session.transcript.trim() });
              }

              const fallbackText = v.note && !v.note.trim().startsWith("{") ? v.note.trim() : "Записи по встрече отсутствуют.";

              setTraceModal({
                title: `📝 Встреча ${meetingNum || ""} (${dateStr})`,
                badge: isGroup ? "Группа" : "Индивидуальная консультация",
                sections: sections.length > 0 ? sections : undefined,
                text: sections.length === 0 ? fallbackText : undefined,
                caseId: v.case_id || caseId || undefined,
                actionKind: "consultation",
              });
            };

            return (
              <button
                key={trace.entry_id}
                type="button"
                className="badge"
                onClick={handleOpenTrace}
                title="Нажмите, чтобы открыть результаты встречи"
                style={{
                  fontSize: "0.8rem",
                  padding: "4px 9px",
                  borderRadius: "5px",
                  background: isGroup ? "rgba(16, 185, 129, 0.12)" : "rgba(37, 99, 235, 0.08)",
                  color: isGroup ? "var(--accent-emerald, #059669)" : "var(--accent-blue, #2563eb)",
                  border: isGroup ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(37, 99, 235, 0.25)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.15s ease",
                }}
              >
                <span>
                  {isGroup
                    ? `👥 Группа${cleanTitle ? `: ${cleanTitle}` : ""} (${dateStr})`
                    : `📝 Встреча ${meetingNum} (${dateStr})`}
                </span>
                <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>🔍</span>
              </button>
            );
          })
        )}

        {/* Экспертные протоколы */}
        {caseArtifacts?.expert && Object.keys(caseArtifacts.expert).map((key) => {
          const art = caseArtifacts.expert[key];
          if (!art || !art.text) return null;
          const labels: Record<string, string> = {
            conclusion: "Заключение",
            fba: "Анализ поведения",
            bip: "План действий",
            child_profile: "Профиль подростка",
          };
          const title = labels[key] || key;
          return (
            <button
              key={key}
              type="button"
              className="badge violet"
              onClick={() =>
                setTraceModal({
                  title: `🔬 Экспертный протокол: ${title}`,
                  badge: "Протокол дела",
                  text: art.text,
                })
              }
              title="Нажмите, чтобы открыть экспертный протокол"
              style={{
                fontSize: "0.8rem",
                padding: "4px 9px",
                borderRadius: "5px",
                background: "rgba(139, 92, 246, 0.15)",
                color: "var(--violet, #7c3aed)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                fontWeight: "bold",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              🔬 {title}
            </button>
          );
        })}

        {caseId && (
          <button
            type="button"
            className="ob-btn secondary tiny"
            style={{
              fontSize: "11px",
              padding: "3px 8px",
              borderRadius: "4px",
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer",
              fontWeight: 600,
            }}
            onClick={() => requestOpenConsultationCase(caseId)}
            title="Перейти в полный журнал консультаций по этому ребёнку"
          >
            <span>{t("📂 Журнал консультаций", "📂 Consultation Journal")}</span>
            <span>↗</span>
          </button>
        )}
      </div>

      {/* Вкладки модуля */}
      <div className="group-session-editor-tabs" style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          className={`ob-btn ${activeTab === "profile" ? "" : "secondary"}`}
          onClick={() => setActiveTab("profile")}
        >
          {t("📁 Форма №1: Личное дело и шкала рисков", "📁 Form #1: Case Profile & Risk Scale")}
        </button>
        <button
          type="button"
          className={`ob-btn ${activeTab === "actions" ? "" : "secondary"}`}
          onClick={() => setActiveTab("actions")}
        >
          {t("🤝 Форма №2: План ИПР", "🤝 Form #2: IPP Plan")}
        </button>
        <button
          type="button"
          className={`ob-btn ${activeTab === "reports" ? "" : "secondary"}`}
          onClick={() => setActiveTab("reports")}
        >
          {t("📊 Форма №3: Мониторинг и отчетность", "📊 Form #3: Monitoring & Reports")}
        </button>

        {/* Сводный индикатор кумулятивного риска */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="muted tiny">{t("Индекс риска:", "Risk Index:")}</span>
          <strong
            style={{
              padding: "4px 12px",
              borderRadius: "20px",
              background:
                riskProfile.overallLevel === "critical"
                  ? "rgba(239, 68, 68, 0.15)"
                  : riskProfile.overallLevel === "high"
                  ? "rgba(249, 115, 22, 0.15)"
                  : riskProfile.overallLevel === "moderate"
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(16, 185, 129, 0.15)",
              color:
                riskProfile.overallLevel === "critical"
                  ? "#ef4444"
                  : riskProfile.overallLevel === "high"
                  ? "#f97316"
                  : riskProfile.overallLevel === "moderate"
                  ? "#f59e0b"
                  : "#10b981",
              border: "1px solid currentColor",
              fontSize: "0.85rem",
            }}
          >
            {riskProfile.cumulativeIndex}% — {riskProfile.levelLabel}
          </strong>
        </div>
      </div>

      {/* ── Вкладка 1: Личное дело и оценка рисков ────────────────────────────────────────── */}
      {activeTab === "profile" && (
        <div className="contact-tab-content">
          {/* 1.1. Социально-демографические данные (по умолчанию свернуты) */}
          <details open={Boolean(openSections.demographics)} className="consultation-form-section wide" style={{ marginBottom: "16px" }}>
            <summary onClick={(e) => { e.preventDefault(); toggleSection("demographics"); }}>
              1.1. Социально-демографические данные подростка
            </summary>
            <div className="consultation-form-section-body intake-grid">
              <label className="field intake-field">
                <span>Пол *</span>
                <select
                  value={data.demographics?.gender || ""}
                  onChange={(e) => updateDemoField("gender", e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Не выбран</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </label>
              <label className="field intake-field">
                <span>Дата рождения *</span>
                <input
                  type="date"
                  value={data.demographics?.birthDate || ""}
                  onChange={(e) => updateDemoField("birthDate", e.target.value)}
                  disabled={disabled}
                />
              </label>
              <label className="field intake-field">
                <span>Гражданство *</span>
                <input
                  type="text"
                  value={data.demographics?.citizenship || ""}
                  onChange={(e) => updateDemoField("citizenship", e.target.value)}
                  placeholder="РФ по умолчанию"
                  disabled={disabled}
                />
              </label>
              <label className="field intake-field wide">
                <span>Место рождения *</span>
                <input
                  type="text"
                  value={data.demographics?.birthPlace || ""}
                  onChange={(e) => updateDemoField("birthPlace", e.target.value)}
                  disabled={disabled}
                />
              </label>
              <label className="field intake-field wide">
                <span>Адрес регистрации *</span>
                <input
                  type="text"
                  value={data.demographics?.registrationAddress || ""}
                  onChange={(e) => updateDemoField("registrationAddress", e.target.value)}
                  disabled={disabled}
                />
              </label>
              <label className="field intake-field wide">
                <span>Адрес фактического проживания</span>
                <input
                  type="text"
                  value={data.demographics?.actualAddress || ""}
                  onChange={(e) => updateDemoField("actualAddress", e.target.value)}
                  placeholder="Совпадает / иной адрес"
                  disabled={disabled}
                />
              </label>
              <label className="field intake-field">
                <span>Телефон / Мессенджеры</span>
                <input
                  type="text"
                  value={data.demographics?.phone || ""}
                  onChange={(e) => updateDemoField("phone", e.target.value)}
                  disabled={disabled}
                />
              </label>
              <label className="field intake-field">
                <span>Ссылки на социальные сети</span>
                <input
                  type="text"
                  value={data.demographics?.socialLinks || ""}
                  onChange={(e) => updateDemoField("socialLinks", e.target.value)}
                  disabled={disabled}
                />
              </label>
              <label className="field intake-field wide">
                <span>Документы *</span>
                <textarea
                  rows={2}
                  value={data.demographics?.documents || ""}
                  onChange={(e) => updateDemoField("documents", e.target.value)}
                  placeholder="Паспорт / Свидетельство о рождении, СНИЛС, полис..."
                  disabled={disabled}
                />
              </label>
              <label className="field intake-field wide">
                <span>Родители (законные представители) *</span>
                <textarea
                  rows={2}
                  value={data.demographics?.parents || ""}
                  onChange={(e) => updateDemoField("parents", e.target.value)}
                  placeholder="ФИО, контакты, степень родства, характер занятий..."
                  disabled={disabled}
                />
              </label>
            </div>
          </details>

          {/* ИИ-ассистент */}
          <div style={{ marginBottom: "20px" }}>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="ipr"
              documentContext={serializedStateText}
              cardSaved={true}
              onApplyResult={handleApplyAiFields}
              showFillCardButton={true}
              fillCardButtonLabel="Заполнить поля Личного дела (ИИ)"
              showPlanButton={false}
              showReportButton={false}
            />
          </div>

          {/* ── Дашборд кумулятивного риска и защитных ресурсов (ОРВ) ── */}
          <div
            style={{
              margin: "24px 0 16px 0",
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "var(--bg-card, #ffffff)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem" }}>
                  ⚖️ Шкала риска и защитных ресурсов (ОРВ / 9 жизненных сфер)
                </h3>
                <span className="muted tiny">
                  Оценка соотношения факторов риска (уязвимостей) и защитных ресурсов (опор) подростка по методике оценки рисков и защитных факторов (ОРВ).
                </span>
              </div>
              <strong
                style={{
                  padding: "4px 12px",
                  borderRadius: "20px",
                  background:
                    riskProfile.overallLevel === "critical"
                      ? "rgba(239, 68, 68, 0.15)"
                      : riskProfile.overallLevel === "high"
                      ? "rgba(249, 115, 22, 0.15)"
                      : riskProfile.overallLevel === "moderate"
                      ? "rgba(245, 158, 11, 0.15)"
                      : "rgba(16, 185, 129, 0.15)",
                  color:
                    riskProfile.overallLevel === "critical"
                      ? "#ef4444"
                      : riskProfile.overallLevel === "high"
                      ? "#f97316"
                      : riskProfile.overallLevel === "moderate"
                      ? "#f59e0b"
                      : "#10b981",
                  border: "1px solid currentColor",
                  fontSize: "0.85rem",
                }}
              >
                {riskProfile.cumulativeIndex}% — {riskProfile.levelLabel}
              </strong>
            </div>

            {/* Градиентная шкала 0–100% с маркером */}
            <div style={{ position: "relative", height: "14px", borderRadius: "7px", background: "linear-gradient(to right, #10b981 0%, #10b981 25%, #f59e0b 26%, #f59e0b 55%, #f97316 56%, #f97316 75%, #ef4444 76%, #b91c1c 100%)", margin: "16px 0 24px 0" }}>
              <div
                style={{
                  position: "absolute",
                  left: `${Math.min(Math.max(riskProfile.cumulativeIndex, 2), 98)}%`,
                  top: "-6px",
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: "0",
                    height: "0",
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: "8px solid #111827",
                  }}
                />
                <span
                  style={{
                    background: "#111827",
                    color: "#ffffff",
                    fontSize: "0.75rem",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontWeight: 600,
                    marginTop: "16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {riskProfile.cumulativeIndex}%
                </span>
              </div>
            </div>

            {/* Карточки метрик */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(239, 68, 68, 0.07)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <span className="muted tiny" style={{ display: "block" }}>🔴 Факторы риска (уязвимости)</span>
                <strong style={{ fontSize: "1.2rem", color: "#ef4444" }}>{riskProfile.totalRiskCount}</strong>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.07)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <span className="muted tiny" style={{ display: "block" }}>🟢 Защитные ресурсы (опоры)</span>
                <strong style={{ fontSize: "1.2rem", color: "#10b981" }}>{riskProfile.totalProtectiveCount}</strong>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "rgba(99, 102, 241, 0.07)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
                <span className="muted tiny" style={{ display: "block" }}>⚖️ Итоговый индекс риска</span>
                <strong style={{ fontSize: "1.2rem", color: "var(--violet)" }}>{riskProfile.effectiveIndex}%</strong>
              </div>
            </div>

            {/* ── 3 РАЗДЕЛЬНЫХ СУБШКАЛЫ (ВЕДОМСТВЕННЫЙ ФОКУС) ── */}
            <div style={{ marginBottom: "16px", padding: "12px", borderRadius: "8px", background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)" }}>
              <strong style={{ fontSize: "0.9rem", display: "block", marginBottom: "8px" }}>
                📊 Ведомственная дифференциация рисков (3 субшкалы):
              </strong>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
                {Object.values(riskProfile.subscales).map((sub) => (
                  <div
                    key={sub.category}
                    style={{
                      padding: "10px",
                      borderRadius: "6px",
                      background: "var(--bg-card, #fff)",
                      border: `1px solid ${sub.color}40`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{sub.name}</span>
                      <span style={{ color: sub.color, fontWeight: 700, fontSize: "0.85rem" }}>{sub.rawScore}%</span>
                    </div>
                    <div className="muted tiny" style={{ marginBottom: "4px" }}>
                      Уровень: <strong style={{ color: sub.color }}>{sub.levelLabel}</strong> ({sub.riskCount} 🔴 / {sub.protectiveCount} 🟢)
                    </div>
                    <div className="muted tiny" style={{ fontSize: "0.75rem", opacity: 0.85 }}>
                      🏛️ {sub.targetAgency}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ПРОФЕССИОНАЛЬНАЯ КОРРЕКЦИЯ СПЕЦИАЛИСТА (OVERRIDE) ── */}
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 14px",
                borderRadius: "8px",
                background: data.professionalOverride?.enabled ? "rgba(99, 102, 241, 0.08)" : "rgba(0,0,0,0.01)",
                border: data.professionalOverride?.enabled ? "1px solid var(--violet)" : "1px dashed var(--border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>
                  <input
                    type="checkbox"
                    checked={data.professionalOverride?.enabled || false}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        professionalOverride: {
                          ...(data.professionalOverride || {}),
                          enabled: e.target.checked,
                          overriddenLevel: data.professionalOverride?.overriddenLevel || riskProfile.overallLevel,
                        },
                      })
                    }
                    disabled={disabled}
                  />
                  <span>👨‍⚖️ Профессиональная экспертная коррекция уровня риска (Override)</span>
                </label>
                {data.professionalOverride?.enabled && (
                  <span style={{ fontSize: "0.75rem", background: "var(--violet)", color: "#fff", padding: "2px 8px", borderRadius: "10px" }}>
                    Ручная калибровка активна
                  </span>
                )}
              </div>

              {data.professionalOverride?.enabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span className="muted tiny">Итоговое экспертное суждение специалиста:</span>
                    <select
                      value={data.professionalOverride.overriddenLevel || riskProfile.overallLevel}
                      onChange={(e) =>
                        onChange({
                          ...data,
                          professionalOverride: {
                            ...(data.professionalOverride || {}),
                            overriddenLevel: e.target.value as any,
                          },
                        })
                      }
                      style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.85rem" }}
                      disabled={disabled}
                    >
                      <option value="norm">🟢 Зона нормы / Минимальный риск</option>
                      <option value="moderate">🟡 Умеренный риск (Группа внимания)</option>
                      <option value="elevated">🟠 Повышенный риск (СОП / Учет)</option>
                      <option value="critical">🔴 Критический риск рецидива / Кризис</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={data.professionalOverride.justification || ""}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        professionalOverride: {
                          ...(data.professionalOverride || {}),
                          justification: e.target.value,
                        },
                      })
                    }
                    placeholder="Обязательное клиническое / социальное обоснование изменения расчетного уровня..."
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.85rem" }}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>

            {/* Пояснение нормы и уровня риска */}
            <div style={{ fontSize: "0.85rem", padding: "10px 14px", borderRadius: "8px", background: "rgba(0,0,0,0.02)", borderLeft: "4px solid var(--violet)" }}>
              <strong>Нормативное обоснование: </strong>{riskProfile.normExplanation}
            </div>

            {/* Предупреждение о критических факторах безопасности */}
            {riskProfile.criticalAlert?.active && (
              <div
                style={{
                  marginTop: "10px",
                  fontSize: "0.85rem",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid #ef4444",
                  color: "#b91c1c",
                }}
              >
                <strong>🚨 Зафиксированы критические маркеры безопасности: </strong>
                {riskProfile.criticalAlert.reasons.join("; ")}
              </div>
            )}
          </div>

          <h3 style={{ margin: "24px 0 12px 0", fontSize: "1.05rem" }}>
            Базовая оценка по 9 сферам жизнедеятельности (🔴 Риски vs 🟢 Защитные ресурсы)
          </h3>
          {CONTACT_RISK_SPHERES.map((sphere) => {
            const riskCount = (data.risks?.[sphere.id] || []).length;
            const protSphere = protectiveSpheresMap[sphere.id];
            const protCount = (data.protectiveFactors?.[sphere.id] || []).length;
            const scoreObj = sphereScoresMap[sphere.id];
            const isOpen = Boolean(openSections[sphere.id]);

            return (
              <details
                key={sphere.id}
                open={isOpen}
                className="consultation-form-section wide"
                style={{ marginBottom: "12px", border: riskCount > 0 ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid var(--border)" }}
              >
                <summary
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSection(sphere.id);
                  }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}
                >
                  <span style={{ fontWeight: 600 }}>{sphere.title}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {scoreObj && (
                      <span
                        style={{
                          fontSize: "0.8rem",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: scoreObj.riskScore > 60 ? "rgba(239, 68, 68, 0.12)" : scoreObj.riskScore > 25 ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                          color: scoreObj.color,
                          fontWeight: 600,
                        }}
                      >
                        {scoreObj.riskScore}% ({riskCount} 🔴 / {protCount} 🟢)
                      </span>
                    )}
                  </div>
                </summary>

                <div
                  className="consultation-form-section-body"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "16px",
                    padding: "16px",
                  }}
                >
                  {/* Левая колонка: Факторы риска */}
                  <div
                    style={{
                      background: "rgba(239, 68, 68, 0.03)",
                      border: "1px solid rgba(239, 68, 68, 0.18)",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "1px solid rgba(239, 68, 68, 0.15)", paddingBottom: "6px" }}>
                      <strong style={{ fontSize: "0.88rem", color: "#ef4444" }}>
                        🔴 Факторы риска (уязвимости)
                      </strong>
                      <span className="muted tiny">{riskCount} из {sphere.items.length}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {sphere.items.map((item) => {
                        const checked = (data.risks?.[sphere.id] || []).includes(item.key);
                        return (
                          <label
                            key={item.key}
                            style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.88rem", padding: "2px 0" }}
                          >
                            <input
                              type="checkbox"
                              style={{ marginTop: "3px" }}
                              checked={checked}
                              onChange={() => toggleRiskItem(sphere.id, item.key)}
                              disabled={disabled}
                            />
                            <span style={{ color: checked ? "#ef4444" : "var(--text)", fontWeight: checked ? 500 : 400 }}>
                              {item.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Правая колонка: Защитные факторы (опоры) */}
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.03)",
                      border: "1px solid rgba(16, 185, 129, 0.18)",
                      borderRadius: "8px",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "1px solid rgba(16, 185, 129, 0.15)", paddingBottom: "6px" }}>
                      <strong style={{ fontSize: "0.88rem", color: "#10b981" }}>
                        🟢 Защитные ресурсы (опоры)
                      </strong>
                      <span className="muted tiny">{protCount} из {protSphere?.items?.length || 0}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {(!protSphere || protSphere.items.length === 0) ? (
                        <span className="muted tiny">Нет специфических защитных факторов для данной сферы.</span>
                      ) : (
                        protSphere.items.map((item) => {
                          const checked = (data.protectiveFactors?.[sphere.id] || []).includes(item.key);
                          return (
                            <label
                              key={item.key}
                              style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.88rem", padding: "2px 0" }}
                            >
                              <input
                                type="checkbox"
                                style={{ marginTop: "3px" }}
                                checked={checked}
                                onChange={() => toggleProtectiveItem(sphere.id, item.key)}
                                disabled={disabled}
                              />
                              <span style={{ color: checked ? "#10b981" : "var(--text)", fontWeight: checked ? 500 : 400 }}>
                                {item.label}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}

          {/* ═══════════════════════════════════════════════════════════════════════════════════════ */}
          {/* ── СПЕЦИАЛИЗИРОВАННЫЕ ПРОФИЛИ РИСКОВ И ВЕДОМСТВЕННОГО УЧЕТА (В КОНЦЕ) ─────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════════════════════════ */}
          <div style={{ marginTop: "32px", marginBottom: "16px", borderTop: "2px dashed var(--border)", paddingTop: "20px" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🎯</span> Специализированные профили рисков и оснований учета
            </h3>
            <p className="muted tiny" style={{ margin: "0 0 16px 0" }}>
              Специализированные блоки на основе признанных диагностических шкал и ведомственных регламентов (C-SSRS, SCOFF/EAT-26, Olweus, PHQ-A/GAD-7, CIAS, CSTAG, КоАП/УК РФ). Заполняются только при наличии показаний. Все блоки по умолчанию свернуты.
            </p>
          </div>

          {/* ⚠️ 1.2. Оценка рисков суицидального и самоповреждающего поведения (C-SSRS / NSSI) */}
          {!data.suicideRisk?.enabled ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(220, 38, 38, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  ⚠️ 1.2. Оценка рисков суицидального и самоповреждающего поведения (C-SSRS / NSSI)
                </strong>
                <span className="muted tiny">
                  Колумбийская шкала серьезности суицидального риска (C-SSRS) и протокол оценки несуицидальных самоповреждений.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  updateSuicideRiskField("enabled", true);
                  setOpenSections((prev) => ({ ...prev, suicideRisk: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить блок C-SSRS / NSSI
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.suicideRisk)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(220, 38, 38, 0.35)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("suicideRisk"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>⚠️ 1.2. Оценка рисков суицидального и самоповреждающего поведения (C-SSRS / NSSI)</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок оценки суицидального риска?")) {
                      updateSuicideRiskField("enabled", false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field">
                  <span>Уровень суицидального риска *</span>
                  <select
                    value={data.suicideRisk?.riskLevel || "none"}
                    onChange={(e) => updateSuicideRiskField("riskLevel", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="none">Риск не выявлен</option>
                    <option value="low">Низкий (пассивные мысли без плана)</option>
                    <option value="moderate">Умеренный (мысли о способах / выраженный дистресс)</option>
                    <option value="high">Высокий (намерение / план / подготовка)</option>
                    <option value="critical">Критический (неотложная психиатрическая помощь)</option>
                  </select>
                </label>

                <label className="field intake-field">
                  <span>Дата последнего острого кризиса / эпизода</span>
                  <input
                    type="date"
                    value={data.suicideRisk?.lastCrisisDate || ""}
                    onChange={(e) => updateSuicideRiskField("lastCrisisDate", e.target.value)}
                    disabled={disabled}
                  />
                </label>

                <div className="field intake-field wide" style={{ background: "rgba(220, 38, 38, 0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(220, 38, 38, 0.15)" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#dc2626", display: "block", marginBottom: "8px" }}>
                    Клинические маркеры (C-SSRS / NSSI):
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
                    {[
                      { key: "wish_dead", label: "Пассивные мысли о смерти («уснуть и не проснуться»)" },
                      { key: "non_specific", label: "Неспецифические суицидальные мысли без плана" },
                      { key: "active_methods", label: "Обдумывание конкретных способов и средств" },
                      { key: "intent_plan", label: "Выраженное намерение с планом и сроками" },
                      { key: "past_attempts", label: "Суицидальные попытки / прерванные действия в анамнезе" },
                      { key: "nssi_cuts", label: "Несуицидальные самоповреждения (порезы, ожоги, удары)" },
                      { key: "farewell", label: "Прощальные признаки (раздача вещей, посты, письма)" },
                      { key: "lethal_access", label: "Наличие прямого доступа к опасным средствам" },
                    ].map((ind) => {
                      const checked = (data.suicideRisk?.indicators || []).includes(ind.key);
                      return (
                        <label key={ind.key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            style={{ marginTop: "2px" }}
                            checked={checked}
                            onChange={() => toggleSuicideIndicator(ind.key)}
                            disabled={disabled}
                          />
                          <span style={{ color: checked ? "#dc2626" : "var(--text)", fontWeight: checked ? 600 : 400 }}>
                            {ind.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="field intake-field wide" style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={data.suicideRisk?.safetyPlanAgreed || false}
                      onChange={(e) => updateSuicideRiskField("safetyPlanAgreed", e.target.checked)}
                      disabled={disabled}
                    />
                    <span>Согласован план безопасности / антисуицидальный контракт</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={data.suicideRisk?.consultedPsychiatrist || false}
                      onChange={(e) => updateSuicideRiskField("consultedPsychiatrist", e.target.checked)}
                      disabled={disabled}
                    />
                    <span>Направлен / проконсультирован врачом-психиатром</span>
                  </label>
                </div>

                <label className="field intake-field wide">
                  <span>Заметки специалиста / Принятые меры безопасности</span>
                  <input
                    type="text"
                    value={data.suicideRisk?.notes || ""}
                    onChange={(e) => updateSuicideRiskField("notes", e.target.value)}
                    placeholder="Информирование законных представителей, контакты кризисных служб, маршрут..."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* 🍽️ 1.3. Оценка рисков нарушений пищевого поведения (РПП / SCOFF, EAT-26) */}
          {!data.eatingDisorderRisk?.enabled ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(245, 158, 11, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  🍽️ 1.3. Оценка рисков нарушений пищевого поведения (РПП / SCOFF, EAT-26)
                </strong>
                <span className="muted tiny">
                  Скрининг анорексии, булимии, компульсивного переедания по международным критериям SCOFF и EAT-26.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  updateEatingDisorderField("enabled", true);
                  setOpenSections((prev) => ({ ...prev, eatingDisorderRisk: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить блок РПП (SCOFF)
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.eatingDisorderRisk)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(245, 158, 11, 0.35)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("eatingDisorderRisk"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>🍽️ 1.3. Оценка рисков нарушений пищевого поведения (РПП / SCOFF, EAT-26)</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок оценки РПП?")) {
                      updateEatingDisorderField("enabled", false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field">
                  <span>Степень риска РПП *</span>
                  <select
                    value={data.eatingDisorderRisk?.riskLevel || "none"}
                    onChange={(e) => updateEatingDisorderField("riskLevel", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="none">Риск не выявлен (0–1 балл SCOFF)</option>
                    <option value="moderate">Умеренный риск (2–3 балла / субклинические ограничения)</option>
                    <option value="high">Высокий клинический риск (≥4 балла / требуется педиатр/психиатр)</option>
                  </select>
                </label>

                <label className="field intake-field">
                  <span>Динамика веса и особенности питания</span>
                  <input
                    type="text"
                    value={data.eatingDisorderRisk?.weightDynamics || ""}
                    onChange={(e) => updateEatingDisorderField("weightDynamics", e.target.value)}
                    placeholder="Резкое похудение / отказ от обедов в школе / ИМТ"
                    disabled={disabled}
                  />
                </label>

                <div className="field intake-field wide" style={{ background: "rgba(245, 158, 11, 0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.15)" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#d97706", display: "block", marginBottom: "8px" }}>
                    Маркеры опросника SCOFF и EAT-26:
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
                    {[
                      { key: "scoff_vomit", label: "Вызывание рвоты из-за чувства переполнения или вины (S)" },
                      { key: "scoff_control", label: "Страх потерять контроль над количеством еды (C)" },
                      { key: "scoff_weight_drop", label: "Резкое падение веса (>5 кг за месяц) при нормальном росте (O)" },
                      { key: "scoff_fat_belief", label: "Считает себя «толстым(-ой)» при видимой худобе (F)" },
                      { key: "scoff_food_obsession", label: "Навязчивые мысли о еде, калориях и строгие ограничения (F)" },
                      { key: "laxatives_use", label: "Прием слабительных, мочегонных или блокаторов аппетита" },
                      { key: "binge_eating", label: "Тайные приступы компульсивного переедания" },
                      { key: "excessive_sports", label: "Изнуряющие тренировки для «сжигания» съеденного" },
                    ].map((ind) => {
                      const checked = (data.eatingDisorderRisk?.indicators || []).includes(ind.key);
                      return (
                        <label key={ind.key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            style={{ marginTop: "2px" }}
                            checked={checked}
                            onChange={() => toggleEatingDisorderIndicator(ind.key)}
                            disabled={disabled}
                          />
                          <span style={{ color: checked ? "#d97706" : "var(--text)", fontWeight: checked ? 600 : 400 }}>
                            {ind.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="field intake-field wide">
                  <span>Заметки специалиста / Рекомендации</span>
                  <input
                    type="text"
                    value={data.eatingDisorderRisk?.notes || ""}
                    onChange={(e) => updateEatingDisorderField("notes", e.target.value)}
                    placeholder="Беседа с родителями, консультация гастроэнтеролога/диетолога..."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* 👥 1.4. Оценка рисков участия в буллинге / школьной травле (Шкала Olweus / Бочавер) */}
          {!data.bullyingRisk?.enabled ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(59, 130, 246, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  👥 1.4. Оценка рисков участия в буллинге / школьной травле (Шкала Olweus / Бочавер)
                </strong>
                <span className="muted tiny">
                  Определение ролевой структуры (жертва, агрессор, последователь, свидетель) и форм буллинга / кибербуллинга.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  updateBullyingField("enabled", true);
                  setOpenSections((prev) => ({ ...prev, bullyingRisk: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить блок буллинга (Olweus)
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.bullyingRisk)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(59, 130, 246, 0.35)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("bullyingRisk"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>👥 1.4. Оценка рисков участия в буллинге / школьной травле (Шкала Olweus / Бочавер)</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок оценки буллинга?")) {
                      updateBullyingField("enabled", false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field">
                  <span>Ролевая позиция в ситуации травли *</span>
                  <select
                    value={data.bullyingRisk?.role || "none"}
                    onChange={(e) => updateBullyingField("role", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="none">Не вовлечен в буллинг</option>
                    <option value="victim">Жертва травли (мишень нападок и бойкота)</option>
                    <option value="aggressor">Агрессор / Инициатор буллинга (булли)</option>
                    <option value="follower">Помощник / Последователь агрессора</option>
                    <option value="witness">Запуганный свидетель / Наблюдатель</option>
                  </select>
                </label>

                <label className="field intake-field">
                  <span>Локация и среда проявления</span>
                  <input
                    type="text"
                    value={data.bullyingRisk?.location || ""}
                    onChange={(e) => updateBullyingField("location", e.target.value)}
                    placeholder="Класс, коридоры/раздевалки, школьный чат, соцсети..."
                    disabled={disabled}
                  />
                </label>

                <div className="field intake-field wide" style={{ background: "rgba(59, 130, 246, 0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(59, 130, 246, 0.15)" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#2563eb", display: "block", marginBottom: "8px" }}>
                    Формы проявления травли:
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
                    {[
                      { key: "verbal", label: "Вербальный (оскорбления, клички, насмешки, унижение достоинства)" },
                      { key: "physical", label: "Физический (толчки, удары, порча вещей, физическое насилие)" },
                      { key: "cyber", label: "Кибербуллинг (травля в групповых чатах, мемы, слив фото)" },
                      { key: "boycott", label: "Социальный бойкот (намеренная изоляция, игнорирование)" },
                      { key: "extortion", label: "Вымогательство денег или материальных ценностей" },
                    ].map((frm) => {
                      const checked = (data.bullyingRisk?.forms || []).includes(frm.key);
                      return (
                        <label key={frm.key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            style={{ marginTop: "2px" }}
                            checked={checked}
                            onChange={() => toggleBullyingForm(frm.key)}
                            disabled={disabled}
                          />
                          <span style={{ color: checked ? "#2563eb" : "var(--text)", fontWeight: checked ? 600 : 400 }}>
                            {frm.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="field intake-field wide">
                  <span>Принятые меры / Школьная служба примирения (медиация)</span>
                  <input
                    type="text"
                    value={data.bullyingRisk?.safetyMeasures || ""}
                    onChange={(e) => updateBullyingField("safetyMeasures", e.target.value)}
                    placeholder="Круг сообщества, беседа с классом, пересаживание, медиативный договор..."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* 🎒 1.5. Оценка школьной тревожности, фобии и школьного отказа (PHQ-A / GAD-7 / SRAS-R) */}
          {!data.schoolAnxietyRisk?.enabled ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(245, 158, 11, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  🎒 1.5. Оценка школьной тревожности, фобии и школьного отказа (PHQ-A / GAD-7 / SRAS-R)
                </strong>
                <span className="muted tiny">
                  Оценка школьной тревожности, экзаменационного стресса, соматизации и избегания школы (PHQ-A, GAD-7, SRAS-R, тест Филлипса).
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  updateSchoolAnxietyField("enabled", true);
                  setOpenSections((prev) => ({ ...prev, schoolAnxietyRisk: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить блок школьной тревожности
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.schoolAnxietyRisk)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(245, 158, 11, 0.35)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("schoolAnxietyRisk"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>🎒 1.5. Оценка школьной тревожности, фобии и школьного отказа (PHQ-A / GAD-7 / SRAS-R)</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок оценки школьной тревожности?")) {
                      updateSchoolAnxietyField("enabled", false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field">
                  <span>Уровень школьной тревожности / дистресса *</span>
                  <select
                    value={data.schoolAnxietyRisk?.level || "none"}
                    onChange={(e) => updateSchoolAnxietyField("level", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="none">В пределах нормы (адаптивный)</option>
                    <option value="mild">Легкая тревожность (ситуативное волнение перед контрольными)</option>
                    <option value="moderate">Умеренная тревожность (регулярный стресс, снижение продуктивности)</option>
                    <option value="high">Высокая тревожность (выраженный страх, вегетативные симптомы)</option>
                    <option value="severe">Критическая дезадаптация / полный отказ от посещения школы</option>
                  </select>
                </label>

                <label className="field intake-field">
                  <span>Пропущено дней / уроков за месяц по причине тревоги</span>
                  <input
                    type="number"
                    min="0"
                    value={data.schoolAnxietyRisk?.missedDaysMonth || 0}
                    onChange={(e) => updateSchoolAnxietyField("missedDaysMonth", parseInt(e.target.value) || 0)}
                    disabled={disabled}
                  />
                </label>

                <div className="field intake-field wide" style={{ background: "rgba(245, 158, 11, 0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.15)" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#d97706", display: "block", marginBottom: "8px" }}>
                    Специфика проявлений и маркеры (PHQ-A / GAD-7 / тест Филлипса):
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
                    {[
                      { key: "exam_fear", label: "Острый страх проверки знаний и контрольных (экзаменационный стресс)" },
                      { key: "blackboard_fear", label: "Страх ответа у доски и публичного внимания в классе" },
                      { key: "teacher_conflict", label: "Повышенная тревога в контактах с педагогами" },
                      { key: "social_inhibition", label: "Страх отвержения сверстниками, замкнутость на переменах" },
                      { key: "general_worry", label: "Постоянное беспокойство и предчувствие неприятностей" },
                      { key: "depressive_mood", label: "Сниженный фон настроения, апатия, потеря учебного интереса" },
                    ].map((ind) => {
                      const checked = (data.schoolAnxietyRisk?.indicators || []).includes(ind.key);
                      return (
                        <label key={ind.key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            style={{ marginTop: "2px" }}
                            checked={checked}
                            onChange={() => toggleSchoolAnxietyIndicator(ind.key)}
                            disabled={disabled}
                          />
                          <span style={{ color: checked ? "#d97706" : "var(--text)", fontWeight: checked ? 600 : 400 }}>
                            {ind.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="field intake-field wide" style={{ display: "flex", gap: "24px", flexWrap: "wrap", alignItems: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={data.schoolAnxietyRisk?.schoolRefusal || false}
                      onChange={(e) => updateSchoolAnxietyField("schoolRefusal", e.target.checked)}
                      disabled={disabled}
                    />
                    <span>Школьный отказ (систематический уход с уроков или нежелание выходить в школу)</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={data.schoolAnxietyRisk?.panicEpisodes || false}
                      onChange={(e) => updateSchoolAnxietyField("panicEpisodes", e.target.checked)}
                      disabled={disabled}
                    />
                    <span>Эпизоды паники / вегетативные кризы в школе</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={data.schoolAnxietyRisk?.somatization || false}
                      onChange={(e) => updateSchoolAnxietyField("somatization", e.target.checked)}
                      disabled={disabled}
                    />
                    <span>Соматические жалобы перед школой (головная боль, боли в животе, тошнота)</span>
                  </label>
                </div>

                <label className="field intake-field wide">
                  <span>Триггеры тревоги / конкретные учебные предметы или ситуации</span>
                  <input
                    type="text"
                    value={data.schoolAnxietyRisk?.triggers || ""}
                    onChange={(e) => updateSchoolAnxietyField("triggers", e.target.value)}
                    placeholder="Конкретные предметы, сдача нормативов, шумный класс, смена школы..."
                    disabled={disabled}
                  />
                </label>

                <label className="field intake-field wide">
                  <span>Заметки психолога / Маршрут поддержки и адаптации</span>
                  <input
                    type="text"
                    value={data.schoolAnxietyRisk?.notes || ""}
                    onChange={(e) => updateSchoolAnxietyField("notes", e.target.value)}
                    placeholder="План мягкой адаптации, согласование с учителями, техники саморегуляции..."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* 📱 1.6. Оценка рисков экранной, игровой и интернет-зависимости (IAT / CIAS / DSM-5 IGD) */}
          {!data.gadgetAddictionRisk?.enabled ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(6, 182, 212, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  📱 1.6. Оценка рисков экранной, игровой и интернет-зависимости (IAT / CIAS / DSM-5 IGD)
                </strong>
                <span className="muted tiny">
                  Тест интернет-зависимости Янг (IAT), шкала Чена (CIAS), игровое расстройство DSM-5 IGD.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  updateGadgetRiskField("enabled", true);
                  setOpenSections((prev) => ({ ...prev, gadgetAddictionRisk: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить блок гаджет-зависимости
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.gadgetAddictionRisk)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(6, 182, 212, 0.35)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("gadgetAddictionRisk"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>📱 1.6. Оценка рисков экранной, игровой и интернет-зависимости (IAT / CIAS / DSM-5 IGD)</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок экранной зависимости?")) {
                      updateGadgetRiskField("enabled", false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field">
                  <span>Экранное время в день (часов) *</span>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={data.gadgetAddictionRisk?.screenTimeHoursDaily || 0}
                    onChange={(e) => updateGadgetRiskField("screenTimeHoursDaily", parseInt(e.target.value) || 0)}
                    disabled={disabled}
                  />
                </label>

                <div className="field intake-field wide" style={{ background: "rgba(6, 182, 212, 0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(6, 182, 212, 0.15)" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#0891b2", display: "block", marginBottom: "8px" }}>
                    Маркеры игровой и цифровой дезадаптации (IAT / CIAS):
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
                    {[
                      { key: "excessive_hours", label: "Время за экраном более 6–8 часов в сутки (не для учебы)" },
                      { key: "withdrawal_aggression", label: "Вспышки агрессии и истерики при попытке ограничить доступ к гаджету" },
                      { key: "hobbies_abandoned", label: "Отказ от прежних увлечений, спорта и живого общения с друзьями" },
                      { key: "night_gaming", label: "Ночные игры, хроническое недосыпание, пропуски первых уроков" },
                      { key: "grades_drop", label: "Резкое падение школьной успеваемости из-за погружения в сеть" },
                      { key: "donates_spending", label: "Тайные траты родительских денег на донаты и внутриигровые покупки" },
                      { key: "lying_about_time", label: "Ложь о реальном количестве времени, проводимом за гаджетом" },
                    ].map((ind) => {
                      const checked = (data.gadgetAddictionRisk?.indicators || []).includes(ind.key);
                      return (
                        <label key={ind.key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            style={{ marginTop: "2px" }}
                            checked={checked}
                            onChange={() => toggleGadgetIndicator(ind.key)}
                            disabled={disabled}
                          />
                          <span style={{ color: checked ? "#0891b2" : "var(--text)", fontWeight: checked ? 600 : 400 }}>
                            {ind.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="field intake-field wide" style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={data.gadgetAddictionRisk?.sleepDisruption || false}
                      onChange={(e) => updateGadgetRiskField("sleepDisruption", e.target.checked)}
                      disabled={disabled}
                    />
                    <span>Выраженное нарушение режима сна и бодрствования</span>
                  </label>
                </div>

                <label className="field intake-field wide">
                  <span>Заметки специалиста / Программа цифрового баланса</span>
                  <input
                    type="text"
                    value={data.gadgetAddictionRisk?.notes || ""}
                    onChange={(e) => updateGadgetRiskField("notes", e.target.value)}
                    placeholder="План цифровой гигиены, включение в спортивные секции, семейные договоренности..."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* 🏃 1.7. Оценка рисков самовольных уходов, побегов из дома и бродяжничества (Runaway Risk) */}
          {!data.runawayRisk?.enabled ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(234, 88, 12, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  🏃 1.7. Оценка рисков самовольных уходов, побегов из дома и бродяжничества
                </strong>
                <span className="muted tiny">
                  Оценка склонности к бродяжничеству, самовольным уходам из семьи или учреждений, розыскным мероприятиям.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  updateRunawayRiskField("enabled", true);
                  setOpenSections((prev) => ({ ...prev, runawayRisk: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить блок самовольных уходов
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.runawayRisk)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(234, 88, 12, 0.35)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("runawayRisk"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>🏃 1.7. Оценка рисков самовольных уходов, побегов из дома и бродяжничества</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок самовольных уходов?")) {
                      updateRunawayRiskField("enabled", false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field">
                  <span>Частота и характер уходов *</span>
                  <select
                    value={data.runawayRisk?.frequency || "single"}
                    onChange={(e) => updateRunawayRiskField("frequency", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="single">Однократный уход (эпизодический на фоне ссоры)</option>
                    <option value="repeated">Повторные уходы (2–3 эпизода)</option>
                    <option value="systemic">Систематические побеги и бродяжничество</option>
                  </select>
                </label>

                <label className="field intake-field">
                  <span>Дата последнего эпизода ухода</span>
                  <input
                    type="date"
                    value={data.runawayRisk?.lastEpisodeDate || ""}
                    onChange={(e) => updateRunawayRiskField("lastEpisodeDate", e.target.value)}
                    disabled={disabled}
                  />
                </label>

                <div className="field intake-field wide" style={{ background: "rgba(234, 88, 12, 0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(234, 88, 12, 0.15)" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#ea580c", display: "block", marginBottom: "8px" }}>
                    Маркеры риска бродяжничества:
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
                    {[
                      { key: "conflict_escape", label: "Побег как протест на семейные/школьные запреты" },
                      { key: "night_hangouts", label: "Ночевки в ТЦ, подъездах, на вокзалах или у малознакомых людей" },
                      { key: "police_search", label: "Объявлялся в розыск ОВД / ПСО «ЛизаАлерт»" },
                      { key: "offenses_on_run", label: "Совершение краж или попрошайничество во время ухода" },
                      { key: "offline_disconnection", label: "Выключение телефона и удаление геолокации" },
                    ].map((ind) => {
                      const checked = (data.runawayRisk?.indicators || []).includes(ind.key);
                      return (
                        <label key={ind.key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            style={{ marginTop: "2px" }}
                            checked={checked}
                            onChange={() => toggleRunawayIndicator(ind.key)}
                            disabled={disabled}
                          />
                          <span style={{ color: checked ? "#ea580c" : "var(--text)", fontWeight: checked ? 600 : 400 }}>
                            {ind.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="field intake-field wide">
                  <span>Триггеры уходов и принятые меры</span>
                  <input
                    type="text"
                    value={data.runawayRisk?.triggers || ""}
                    onChange={(e) => updateRunawayRiskField("triggers", e.target.value)}
                    placeholder="Причины уходов, договоренности с семьей, организация досуга..."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* 🛡️ 1.8. Оценка рисков семейного неблагополучия, насилия и пренебрежения нуждами (ACEs / СОП) */}
          {!data.familyViolenceRisk?.enabled ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(185, 28, 28, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  🛡️ 1.8. Оценка рисков семейного неблагополучия, жестокого обращения и насилия (ACEs / СОП)
                </strong>
                <span className="muted tiny">
                  Неблагоприятный детский опыт (Adverse Childhood Experiences, ACEs), физическое/эмоциональное насилие, депривация.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  updateFamilyViolenceField("enabled", true);
                  setOpenSections((prev) => ({ ...prev, familyViolenceRisk: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить блок ACEs / СОП
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.familyViolenceRisk)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(185, 28, 28, 0.35)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("familyViolenceRisk"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>🛡️ 1.8. Оценка рисков семейного неблагополучия, жестокого обращения и насилия (ACEs / СОП)</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок семейного насилия?")) {
                      updateFamilyViolenceField("enabled", false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <div className="field intake-field wide" style={{ background: "rgba(185, 28, 28, 0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(185, 28, 28, 0.15)" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#b91c1c", display: "block", marginBottom: "8px" }}>
                    Факторы неблагоприятного детского опыта (ACEs) и нарушения прав ребенка:
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
                    {[
                      { key: "physical_violence", label: "Физическое насилие или следы побоев в семье" },
                      { key: "emotional_pressure", label: "Эмоциональное насилие (унижения, травля, угрозы)" },
                      { key: "neglect_food_clothes", label: "Пренебрежение базовыми нуждами (голод, одежда не по сезону)" },
                      { key: "medical_denial", label: "Непредоставление медицинской помощи при заболеваниях" },
                      { key: "witness_abuse", label: "Свидетель домашнего насилия между взрослыми" },
                      { key: "parental_addiction", label: "Тяжелая алкогольная / наркотическая зависимость родителей" },
                      { key: "left_alone", label: "Оставление ребенка без присмотра на длительный срок" },
                      { key: "sexual_risk", label: "Риск сексуализированного насилия или домогательств" },
                    ].map((ind) => {
                      const checked = (data.familyViolenceRisk?.indicators || []).includes(ind.key);
                      return (
                        <label key={ind.key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            style={{ marginTop: "2px" }}
                            checked={checked}
                            onChange={() => toggleFamilyViolenceIndicator(ind.key)}
                            disabled={disabled}
                          />
                          <span style={{ color: checked ? "#b91c1c" : "var(--text)", fontWeight: checked ? 600 : 400 }}>
                            {ind.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="field intake-field wide" style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={data.familyViolenceRisk?.cpsInvolved || false}
                      onChange={(e) => updateFamilyViolenceField("cpsInvolved", e.target.checked)}
                      disabled={disabled}
                    />
                    <span>Информация передана в Органы опеки и попечительства / КДНиЗП</span>
                  </label>
                </div>

                <label className="field intake-field wide">
                  <span>Заметки специалиста / Реабилитационная работа с семьей</span>
                  <input
                    type="text"
                    value={data.familyViolenceRisk?.notes || ""}
                    onChange={(e) => updateFamilyViolenceField("notes", e.target.value)}
                    placeholder="Психологическое консультирование семьи, социальная помощь, привлечение КЦСОН..."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* 🌐 1.9. Оценка рисков вовлечения в деструктивные группы, киберугроз и скулшутинга (CSTAG / Threat Assessment) */}
          {!data.cyberRisk?.enabled ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(147, 51, 234, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  🌐 1.9. Оценка рисков вовлечения в деструктивные сообщества, киберугроз и экстремизма (CSTAG)
                </strong>
                <span className="muted tiny">
                  Протоколы оценки угроз безопасности образовательной среды (Threat Assessment), радикализация, дропперство.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  updateCyberRiskField("enabled", true);
                  setOpenSections((prev) => ({ ...prev, cyberRisk: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить блок киберугроз (CSTAG)
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.cyberRisk)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(147, 51, 234, 0.35)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("cyberRisk"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>🌐 1.9. Оценка рисков вовлечения в деструктивные группы, киберугроз и экстремизма (CSTAG)</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок киберугроз?")) {
                      updateCyberRiskField("enabled", false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field">
                  <span>Уровень угрозы безопасности *</span>
                  <select
                    value={data.cyberRisk?.riskLevel || "low"}
                    onChange={(e) => updateCyberRiskField("riskLevel", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="low">Низкий (транзиторный интерес / любопытство)</option>
                    <option value="moderate">Умеренный (активное участие в закрытых каналах)</option>
                    <option value="high">Высокий (прямая угроза / экстремистские проявления)</option>
                  </select>
                </label>

                <div className="field intake-field wide" style={{ background: "rgba(147, 51, 234, 0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(147, 51, 234, 0.15)" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#9333ea", display: "block", marginBottom: "8px" }}>
                    Маркеры деструктивного поведения и радикализации:
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px" }}>
                    {[
                      { key: "school_shooting", label: "Интерес к теме скулшутинга / колумбайна, идеализация стрелков" },
                      { key: "destructive_symbols", label: "Размещение экстремистской, нацистской или сатанинской символики" },
                      { key: "hate_speech", label: "Агрессивные высказывания, язык вражды, манифесты ненависти" },
                      { key: "deadly_challenges", label: "Участие в смертельно опасных челленджах (руфинг, зацепинг)" },
                      { key: "suspicious_chats", label: "Контакты с неизвестными вербовщиками, риск шантажа / сексторшена" },
                      { key: "criminal_drifting", label: "Вовлечение в дропперство, сваттинг или закладки через Telegram" },
                      { key: "weapons_interest", label: "Поиск схем изготовления оружия или взрывчатых веществ" },
                    ].map((ind) => {
                      const checked = (data.cyberRisk?.indicators || []).includes(ind.key);
                      return (
                        <label key={ind.key} style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            style={{ marginTop: "2px" }}
                            checked={checked}
                            onChange={() => toggleCyberRiskIndicator(ind.key)}
                            disabled={disabled}
                          />
                          <span style={{ color: checked ? "#9333ea" : "var(--text)", fontWeight: checked ? 600 : 400 }}>
                            {ind.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label className="field intake-field wide">
                  <span>Заметки специалиста / Взаимодействие с Центром «Э», ОДН, ФСБ</span>
                  <input
                    type="text"
                    value={data.cyberRisk?.notes || ""}
                    onChange={(e) => updateCyberRiskField("notes", e.target.value)}
                    placeholder="Проведенные профилактические беседы, мониторинг аккаунтов..."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* 💊 1.10. Профилактика наркомании / ПАВ */}
          {!isNarcologyBlockActive ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(16, 185, 129, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  💊 1.10. Профилактика наркомании / ПАВ
                </strong>
                <span className="muted tiny">
                  Употребление алкоголя, вейпов, наркотических и токсических веществ, протоколы ХТИ, учет в НД.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  toggleNarcologyBlock(true);
                  setOpenSections((prev) => ({ ...prev, narcology: true }));
                }}
                disabled={disabled}
              >
                ＋ Включить нарко-блок
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.narcology)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("narcology"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>💊 1.10. Профилактика наркомании / ПАВ</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок профилактики наркомании?")) {
                      toggleNarcologyBlock(false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field">
                  <span>Источник выявления *</span>
                  <select
                    value={data.narcology?.detectionSource || ""}
                    onChange={(e) => updateNarcologyField("detectionSource", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Не выбран</option>
                    <option value="mvd">ОВД (МВД)</option>
                    <option value="smp">СМП (Скорая)</option>
                    <option value="school">Образовательная организация</option>
                    <option value="parents">Родители / Законные представители</option>
                    <option value="anonymous">Анонимное тестирование / Опрос</option>
                  </select>
                </label>

                <label className="field intake-field">
                  <span>Вещество (ПАВ) *</span>
                  <select
                    value={data.narcology?.substance || ""}
                    onChange={(e) => updateNarcologyField("substance", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Не указано</option>
                    <option value="alcohol">Алкоголь</option>
                    <option value="cannabinoids">Каннабиноиды (Марихуана, гашиш)</option>
                    <option value="synthetic">Синтетика (Мефедрон, a-PVP)</option>
                    <option value="amphetamine">Амфетаминовый ряд</option>
                    <option value="opoids">Опиаты (Героин, метадон)</option>
                    <option value="unknown">Неизвестное вещество (отказ/скрыто)</option>
                    <option value="poly">Полинаркомания</option>
                  </select>
                </label>

                <label className="field intake-field">
                  <span>Статус учета в наркодиспансере *</span>
                  <select
                    value={data.narcology?.dispensaryStatus || ""}
                    onChange={(e) => updateNarcologyField("dispensaryStatus", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Нет данных</option>
                    <option value="none">Не состоит</option>
                    <option value="voluntary">Добровольное обращение (анонимно)</option>
                    <option value="registered">Профилактический / диспансерный учет</option>
                    <option value="evading">Уклоняется от лечения / наблюдения</option>
                  </select>
                </label>

                <label className="field intake-field">
                  <span>Протокол медосвидетельствования (ХТИ)</span>
                  <input
                    type="text"
                    value={data.narcology?.examProtocolNum || ""}
                    onChange={(e) => updateNarcologyField("examProtocolNum", e.target.value)}
                    placeholder="№ протокола"
                    disabled={disabled}
                  />
                </label>

                <label className="field intake-field">
                  <span>Дата медосвидетельствования</span>
                  <input
                    type="date"
                    value={data.narcology?.examDate || ""}
                    onChange={(e) => updateNarcologyField("examDate", e.target.value)}
                    disabled={disabled}
                  />
                </label>

                <label className="field intake-field">
                  <span>Контроль сроков (60 дней, КоАП 6.9/6.8)</span>
                  <input
                    type="date"
                    value={data.narcology?.koapDeadline || ""}
                    onChange={(e) => updateNarcologyField("koapDeadline", e.target.value)}
                    disabled={disabled}
                  />
                </label>

                <label className="field intake-field">
                  <span>Кол-во 'чистых' тестов (маркер)</span>
                  <input
                    type="number"
                    min="0"
                    value={data.narcology?.cleanTestsCount || 0}
                    onChange={(e) => updateNarcologyField("cleanTestsCount", parseInt(e.target.value) || 0)}
                    disabled={disabled}
                  />
                </label>

                <label className="field intake-field">
                  <span>Досуговая занятость (кружки/секции)</span>
                  <input
                    type="text"
                    value={data.narcology?.leisureActivities || ""}
                    onChange={(e) => updateNarcologyField("leisureActivities", e.target.value)}
                    placeholder="Спорт, творчество и т.д."
                    disabled={disabled}
                  />
                </label>
              </div>
            </details>
          )}

          {/* ⚖️ 1.11. Оценка правонарушения / Основание учета (статьи КоАП / УК РФ, КДНиЗП) */}
          {!isCriminalBlockActive ? (
            <div
              style={{
                marginBottom: "14px",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px dashed var(--border)",
                background: "rgba(99, 102, 241, 0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "0.92rem", color: "var(--text)" }}>
                  ⚖️ 1.11. Оценка правонарушения / Основание учета (статьи КоАП / УК РФ, КДНиЗП)
                </strong>
                <span className="muted tiny">
                  Учет в ОДН/КДНиЗП, статьи КоАП/УК РФ, статус СОП. По умолчанию скрыт для обычных школьных случаев.
                </span>
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
                onClick={() => {
                  toggleCriminalBlock(true);
                  setOpenSections((prev) => ({ ...prev, offense: true }));
                }}
                disabled={disabled}
              >
                ＋ Подключить статьи КоАП/УК РФ
              </button>
            </div>
          ) : (
            <details open={Boolean(openSections.offense)} className="consultation-form-section wide" style={{ marginBottom: "14px", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
              <summary
                onClick={(e) => { e.preventDefault(); toggleSection("offense"); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <span>⚖️ 1.11. Оценка правонарушения / Основание учета (статьи КоАП / УК РФ, КДНиЗП)</span>
                <button
                  type="button"
                  className="ob-btn secondary tiny"
                  style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Отключить блок статей и правонарушений для этой карточки?")) {
                      toggleCriminalBlock(false);
                    }
                  }}
                  disabled={disabled}
                >
                  Скрыть блок статей
                </button>
              </summary>
              <div className="consultation-form-section-body intake-grid">
                <label className="field intake-field wide">
                  <span>Основание постановки на социальное сопровождение *</span>
                  <input
                    type="text"
                    value={data.offense?.basis || ""}
                    onChange={(e) => updateOffenseField("basis", e.target.value)}
                    placeholder="Постановление КДНиЗП, сообщение ОДН УМВД, направление..."
                    disabled={disabled}
                  />
                </label>

                {/* Выбор статей правонарушений */}
                <div className="field intake-field wide" style={{ background: "var(--bg-subtle, rgba(0,0,0,0.02))", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                      Квалификация правонарушения (статьи КоАП РФ и УК РФ) *
                    </span>
                    <select
                      style={{ fontSize: "0.85rem", maxWidth: "340px" }}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleToggleArticle(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      disabled={disabled}
                    >
                      <option value="">＋ Выбрать статью из каталога КоАП / УК РФ...</option>
                      <optgroup label="КоАП РФ (Административные)">
                        {CONTACT_OFFENSE_ARTICLES.filter((a) => a.lawType === "КоАП РФ").map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} — {a.title}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="УК РФ (Уголовные)">
                        {CONTACT_OFFENSE_ARTICLES.filter((a) => a.lawType === "УК РФ").map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} — {a.title}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Быстрые чипы частых статей */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                    <span className="muted tiny" style={{ alignSelf: "center", marginRight: "4px" }}>Частые:</span>
                    {FREQUENT_ARTICLES.map((art) => {
                      const isSelected = (data.offense?.articles || "").includes(art.code);
                      return (
                        <button
                          key={art.code}
                          type="button"
                          onClick={() => handleToggleArticle(art.code)}
                          disabled={disabled}
                          style={{
                            fontSize: "0.8rem",
                            padding: "3px 8px",
                            borderRadius: "14px",
                            cursor: "pointer",
                            border: isSelected ? "1px solid #ef4444" : "1px solid var(--border)",
                            background: isSelected ? "rgba(239, 68, 68, 0.15)" : "var(--bg-card)",
                            color: isSelected ? "#ef4444" : "var(--text)",
                            fontWeight: isSelected ? 600 : 400,
                          }}
                          title={art.label}
                        >
                          {isSelected ? "✓ " : ""}{art.code}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={data.offense?.articles || ""}
                    onChange={(e) => updateOffenseField("articles", e.target.value)}
                    placeholder="Например: ст. 7.27 ч. 2 КоАП РФ (мелкое хищение), ст. 158 УК РФ"
                    disabled={disabled}
                    style={{ width: "100%" }}
                  />
                  <span className="muted tiny" style={{ marginTop: "4px", display: "block" }}>
                    Кликните по статье выше или введите вручную несколько статей через запятую.
                  </span>
                </div>

                <label className="field intake-field">
                  <span>Категория клиента *</span>
                  <select
                    value={data.offense?.clientCategory || ""}
                    onChange={(e) => updateOffenseField("clientCategory", e.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Не выбрана</option>
                    <option value="adm">Совершившие административные правонарушения</option>
                    <option value="crim_underage">Совершившие общественно-опасные деяния (до возраста уг. отв.)</option>
                    <option value="crim_non_rehab">Освобожденные от уг. ответственности по нереабилитирующим основаниям</option>
                    <option value="prevention">В целях предупреждения правонарушений</option>
                    <option value="convicted_non_custodial">Осужденные к наказаниям без лишения свободы</option>
                    <option value="crim_prosecuted">Находящиеся в сфере уголовного преследования</option>
                  </select>
                </label>
                <label className="field intake-field">
                  <span>Органы учета (где состоит на учете)</span>
                  <input
                    type="text"
                    value={data.offense?.registrations || ""}
                    onChange={(e) => updateOffenseField("registrations", e.target.value)}
                    placeholder="КДНиЗП, ОДН УМВД, наркодиспансер..."
                    disabled={disabled}
                  />
                </label>
                <div className="field intake-field wide" style={{ display: "flex", gap: "20px", alignItems: "center", marginTop: "10px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={data.offense?.isSop || false}
                      onChange={(e) => updateOffenseField("isSop", e.target.checked)}
                      disabled={disabled}
                    />
                    <span>Признан находящимся в социально опасном положении (СОП)</span>
                  </label>
                  {data.offense?.isSop && (
                    <div style={{ display: "inline-flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="date"
                        value={data.offense?.sopDateStart || ""}
                        onChange={(e) => updateOffenseField("sopDateStart", e.target.value)}
                        placeholder="Дата постановки"
                        disabled={disabled}
                      />
                      <span>—</span>
                      <input
                        type="date"
                        value={data.offense?.sopDateEnd || ""}
                        onChange={(e) => updateOffenseField("sopDateEnd", e.target.value)}
                        placeholder="Дата снятия"
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Вкладка 2: Действия специалистов (План ИПР) ─────────────────────────── */}
      {activeTab === "actions" && (
        <div className="contact-tab-content">
          <div style={{ marginBottom: "20px" }}>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="ipr"
              documentContext={serializedStateText}
              cardSaved={true}
              onApplyResult={handleApplyAiPlan}
              showPlanButton={true}
              planButtonLabel="Сформировать план сопровождения (ИИ)"
              showReportButton={false}
              showFillCardButton={false}
            />
          </div>

          {/* Баннер автоматической генерации 6-месячного маршрута */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.25)",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 320px" }}>
              <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--text)", marginBottom: "4px" }}>
                ⚡ Профилактический маршрут на 6 месяцев (с нормативно-педагогическими обоснованиями)
              </strong>
              <span className="muted tiny" style={{ lineHeight: "1.4", display: "block" }}>
                Формирует согласованные шаги по 3 фазам сопровождения:
                <strong> Фаза I</strong> (1–2 мес: контакт и стабилизация),
                <strong> Фаза II</strong> (3–4 мес: профориентация, АЗН, спорт),
                <strong> Фаза III</strong> (5–6 мес: закрепление и заседание КДНиЗП) с указанием межведомственных исполнителей и нормативных обоснований для комиссии.
              </span>
            </div>
            <button
              type="button"
              className="ob-btn primary"
              style={{ fontSize: "0.88rem", padding: "8px 16px", whiteSpace: "nowrap" }}
              onClick={handleGenerateSixMonthRoute}
              disabled={disabled}
            >
              ⚡ Сформировать маршрут на 6 месяцев
            </button>
          </div>

          <p className="muted tiny" style={{ marginBottom: "16px" }}>
            Матрица согласованных мероприятий специалистов службы сопровождения (психолога, юриста, специалиста по работе с молодежью, социального педагога). Выберите типовое действие или добавьте своё.
          </p>

          {CONTACT_ACTION_TAXONOMY.map((cat) => {
            const catActions = (data.actions || []).filter((a) => a.category === cat.id);

            return (
              <div key={cat.id} className="card" style={{ marginBottom: "16px", padding: "18px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--violet)" }}>{cat.title}</h4>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      className="tiny-select"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          addAction(cat.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      style={{ padding: "4px", fontSize: "0.85rem" }}
                      disabled={disabled}
                    >
                      <option value="">-- Быстрый выбор действия --</option>
                      {cat.actions.map((actName) => (
                        <option key={actName} value={actName}>{actName}</option>
                      ))}
                    </select>
                    <button type="button" className="ob-btn secondary tiny" onClick={() => addAction(cat.id)} disabled={disabled}>
                      ＋ Своё действие
                    </button>
                  </div>
                </div>

                {catActions.length === 0 ? (
                  <p className="muted tiny">Мероприятия по данному направлению пока не запланированы.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line)" }}>
                        <th style={{ textAlign: "left", padding: "6px" }}>Действие *</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "130px" }}>План (дата)</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "130px" }}>Факт (дата)</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "160px" }}>Исполнитель</th>
                        <th style={{ textAlign: "left", padding: "6px" }}>Ожидаемый / достигнутый результат</th>
                        <th style={{ width: "40px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {catActions.map((act) => (
                        <tr key={act.id} style={{ borderBottom: "1px solid var(--bg-subtle, rgba(0,0,0,0.05))" }}>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.actionName}
                              onChange={(e) => updateAction(act.id, "actionName", e.target.value)}
                              placeholder="Название мероприятия..."
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="date"
                              value={act.plannedDate || ""}
                              onChange={(e) => updateAction(act.id, "plannedDate", e.target.value)}
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="date"
                              value={act.actualDate || ""}
                              onChange={(e) => updateAction(act.id, "actualDate", e.target.value)}
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.executor || ""}
                              onChange={(e) => updateAction(act.id, "executor", e.target.value)}
                              placeholder="ФИО / Должность"
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.notes || ""}
                              onChange={(e) => updateAction(act.id, "notes", e.target.value)}
                              placeholder="Пояснение / результат"
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeAction(act.id)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger)" }}
                              disabled={disabled}
                              title="Удалить строку"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Вкладка 3: Мониторинг, отчетность и результаты ────────────────────────── */}
      {activeTab === "reports" && (
        <div className="contact-tab-content">
          <div style={{ marginBottom: "20px" }}>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="ipr"
              documentContext={serializedStateText}
              cardSaved={true}
              onApplyResult={handleApplyAiReport}
              showReportButton={true}
              reportButtonLabel="Составить отчет для КДНиЗП (ИИ)"
              showPlanButton={false}
              showFillCardButton={false}
            />
          </div>

          {/* ── Сводный протокол результативности и мониторинга динамики ── */}
          {(() => {
            const completedCount = (data.actions || []).filter((a) => Boolean(a.actualDate && a.actualDate.trim())).length;
            const totalCount = (data.actions || []).length;
            const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const isSuccess = pct >= 70;

            const handleGenerateQuickSummary = () => {
              const activeSpheresNames: string[] = [];
              for (const sph of CONTACT_RISK_SPHERES) {
                const count = (data.risks?.[sph.id] || []).length;
                if (count > 0) activeSpheresNames.push(sph.title);
              }
              const spheresText = activeSpheresNames.length > 0 ? activeSpheresNames.join(", ") : "основным направлениям риска";

              let specializedSections = "";

              if (data.suicideRisk?.enabled) {
                specializedSections += `\n\n4. СУИЦИДАЛЬНЫЙ РИСК И САМОПОВРЕЖДЕНИЕ (C-SSRS / NSSI):
- Уровень риска: ${data.suicideRisk.riskLevel || "не указан"}.
- План безопасности: ${data.suicideRisk.safetyPlanAgreed ? "согласован" : "в процессе"}.
- Консультация психиатра: ${data.suicideRisk.consultedPsychiatrist ? "пройдена" : "рекомендована"}.
- Заметки: ${data.suicideRisk.notes || "—"}.`;
              }

              if (data.eatingDisorderRisk?.enabled) {
                specializedSections += `\n\n5. РИСК НАРУШЕНИЙ ПИЩЕВОГО ПОВЕДЕНИЯ (SCOFF / EAT-26):
- Уровень риска: ${data.eatingDisorderRisk.riskLevel || "не указан"}.
- Динамика веса: ${data.eatingDisorderRisk.weightDynamics || "—"}.
- Заметки: ${data.eatingDisorderRisk.notes || "—"}.`;
              }

              if (data.bullyingRisk?.enabled) {
                specializedSections += `\n\n6. БУЛЛИНГ И ШКОЛЬНАЯ ТРАВЛЯ (OLWEUS):
- Ролевая позиция: ${data.bullyingRisk.role || "не определена"}.
- Формы: ${(data.bullyingRisk.forms || []).join(", ") || "не указаны"}.
- Меры безопасности: ${data.bullyingRisk.safetyMeasures || "—"}.`;
              }

              if (data.schoolAnxietyRisk?.enabled) {
                specializedSections += `\n\n7. ШКОЛЬНАЯ ТРЕВОЖНОСТЬ, ДИСТРЕСС И ШКОЛЬНЫЙ ОТКАЗ (PHQ-A / GAD-7 / SRAS-R):
- Уровень: ${data.schoolAnxietyRisk.level || "не указан"}.
- Пропущено дней/уроков: ${data.schoolAnxietyRisk.missedDaysMonth || 0}.
- Школьный отказ / страх школы: ${data.schoolAnxietyRisk.schoolRefusal ? "выражен" : "нет"}.
- Заметки: ${data.schoolAnxietyRisk.notes || "—"}.`;
              }

              if (data.gadgetAddictionRisk?.enabled) {
                specializedSections += `\n\n8. ЭКРАННАЯ И ИГРОВАЯ ЗАВИСИМОСТЬ (IAT / CIAS):
- Экранное время: ${data.gadgetAddictionRisk.screenTimeHoursDaily || 0} ч/день.
- Нарушение сна: ${data.gadgetAddictionRisk.sleepDisruption ? "выражено" : "нет"}.
- Программа: ${data.gadgetAddictionRisk.notes || "—"}.`;
              }

              if (data.runawayRisk?.enabled) {
                specializedSections += `\n\n9. САМОВОЛЬНЫЕ УХОДЫ И БРОДЯЖНИЧЕСТВО (RUNAWAY RISK):
- Частота: ${data.runawayRisk.frequency || "—"}.
- Триггеры: ${data.runawayRisk.triggers || "—"}.`;
              }

              if (data.familyViolenceRisk?.enabled) {
                specializedSections += `\n\n10. СЕМЕЙНОЕ НЕБЛАГОПОЛУЧИЕ И НАСИЛИЕ (ACEs / СОП):
- Органы опеки: ${data.familyViolenceRisk.cpsInvolved ? "информированы" : "нет необходимости"}.
- Реабилитация: ${data.familyViolenceRisk.notes || "—"}.`;
              }

              if (data.cyberRisk?.enabled) {
                specializedSections += `\n\n11. ДЕСТРУКТИВНЫЕ ГРУППЫ И КИБЕРУГРОЗЫ (CSTAG):
- Уровень угрозы: ${data.cyberRisk.riskLevel || "не указан"}.
- Заметки / Взаимодействие: ${data.cyberRisk.notes || "—"}.`;
              }

              if (data.narcology?.enabled) {
                const tests = data.narcology.cleanTestsCount || 0;
                specializedSections += `\n\n12. АНТИНАРКОТИЧЕСКИЙ БЛОК (ПАВ):
- Статус ПАВ: ${data.narcology.substance || "не указано"}.
- Статус в наркодиспансере: ${data.narcology.dispensaryStatus || "нет данных"}.
- Протокол ХТИ: ${data.narcology.examProtocolNum ? `№${data.narcology.examProtocolNum}` : "отсутствует"}.
- Чистые тесты (динамика): ${tests} шт.
- Досуг и занятость: ${data.narcology.leisureActivities || "не указано"}.`;
              }

              if (data.offense?.enabled) {
                specializedSections += `\n\n13. ОСНОВАНИЕ УЧЕТА / ПРАВОНАРУШЕНИЕ:
- Категория: ${data.offense.category || "не указана"}.
- Статья КоАП / УК РФ: ${[data.offense.articleCoap, data.offense.articleUk].filter(Boolean).join(", ") || "—"}.
- Постановление КДНиЗП: ${data.offense.kdnResolutionNum ? `№${data.offense.kdnResolutionNum} от ${data.offense.kdnResolutionDate || ""}` : "—"}.
- Принятые меры: ${data.offense.remedialMeasures || "—"}.`;
              }

              const text = `ЗАКЛЮЧЕНИЕ ПО ИТОГАМ РЕАЛИЗАЦИИ ИПР
Несовершеннолетний: ${adolescentName || "Подросток"}
Срок реализации: 6 месяцев

1. ВЫПОЛНЕНИЕ ПЛАНА МЕРОПРИЯТИЙ:
- Реализовано действий: ${completedCount} из ${totalCount} (${pct}%).
- Проведена адресная работа по сферам: ${spheresText}.
- Задействованы субъекты системы профилактики: ОДН ОМВД, школа, районный центр занятости (АЗН), социальные центры, спортсекции.

2. ДИНАМИКА ФАКТОРОВ РИСКА И РЕСУРСОВ:
- Исходный уровень риска: ${riskProfile.riskLevel} (${riskProfile.cumulativeIndex}%).
- Выявлено и проработано факторов риска: ${riskProfile.totalRiskCount}.
- Сформировано защитных ресурсов и факторов устойчивости: ${riskProfile.totalProtectiveCount}.
- Повторных правонарушений и срывов за период сопровождения не допущено.
- Учебная дисциплина и занятость стабилизированы.

3. ИТОГОВОЕ ХОДАТАЙСТВО И РЕШЕНИЕ:
${pct >= 60 
  ? "Ходатайствуем перед КДНиЗП о завершении индивидуального профилактического сопровождения несовершеннолетнего в связи с успешным выполнением плана ИПР и достижением устойчивой положительной динамики." 
  : "Рекомендовано продлить реализацию плана ИПР на 3 месяца для закрепления позитивных изменений и завершения индивидуального маршрута."}${specializedSections}`;

              onChange({
                ...data,
                conclusions: {
                  ...(data.conclusions || {}),
                  status: pct >= 60 ? (data.conclusions?.status || "completed") : (data.conclusions?.status || "extended"),
                  notes: text,
                },
              });
            };

            return (
              <div
                className="contact-tab-content card"
                style={{
                  padding: "20px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                      📋 Сводный протокол мониторинга и результативности ИПР
                    </h3>
                    <div style={{ fontSize: "12.5px", color: "#475569" }}>
                      Объективная оценка динамики подопечного: {adolescentName || "Подросток"} (на основе Формы №1 и Формы №2)
                    </div>
                  </div>
                  <div
                    style={{
                      background: isSuccess ? "#f0fdf4" : "#fffbeb",
                      border: `1px solid ${isSuccess ? "#86efac" : "#fde68a"}`,
                      color: isSuccess ? "#166534" : "#92400e",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 800,
                      textAlign: "right",
                    }}
                  >
                    {isSuccess ? "✓ Положительная динамика" : "⚠ Требует внимания"}
                  </div>
                </div>

                {/* Статистическая линейка */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "4px solid #ef4444", borderRadius: "8px", padding: "10px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Индекс риска (входной)</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#dc2626", marginTop: "2px" }}>
                      {riskProfile.cumulativeIndex}% ({riskProfile.levelLabel})
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "4px solid #3b82f6", borderRadius: "8px", padding: "10px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Выполнение мероприятий</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#2563eb", marginTop: "2px" }}>
                      {completedCount} из {totalCount} ({pct}%)
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "4px solid #10b981", borderRadius: "8px", padding: "10px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Факторы устойчивости</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#16a34a", marginTop: "2px" }}>
                      +{riskProfile.totalProtectiveCount} опор / ресурсов
                    </div>
                  </div>
                </div>

                {/* Раскладка по сферам */}
                <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "12px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                    Сферы внимания и закрытые уязвимости:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {CONTACT_RISK_SPHERES.map((sph) => {
                      const riskCount = (data.risks?.[sph.id] || []).length;
                      const protCount = (data.protectiveFactors?.[sph.id] || []).length;
                      const hasItems = riskCount > 0 || protCount > 0;
                      if (!hasItems) return null;

                      return (
                        <div
                          key={sph.id}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "11.5px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{sph.title}:</span>
                          {riskCount > 0 && (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>
                              {riskCount} риск{riskCount > 1 ? "а" : ""}
                            </span>
                          )}
                          {protCount > 0 && (
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>
                              +{protCount} ресурс{protCount > 1 ? "а" : ""}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Кнопка быстрой автогенерации официального заключения */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleGenerateQuickSummary}
                    disabled={disabled}
                    style={{
                      background: "#4f46e5",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "background 0.15s",
                    }}
                  >
                    <span>⚡ Сформировать проект заключения и ходатайства для КДНиЗП</span>
                  </button>
                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                    Автоматически сведет статистику рисков, специализированных профилей, выполненные шаги и готовый текст для комиссии в поле ниже.
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="contact-tab-content card" style={{ padding: "20px", border: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 14px 0" }}>Результат индивидуального сопровождения (Форма № 3)</h4>
            <div className="intake-grid" style={{ marginBottom: "20px" }}>
              <label className="field intake-field wide">
                <span>Решение по итогам сопровождения *</span>
                <select
                  value={data.conclusions?.status || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      conclusions: { ...(data.conclusions || {}), status: e.target.value },
                    })
                  }
                  disabled={disabled}
                >
                  <option value="">Не принято / Сопровождение продолжается</option>
                  <option value="completed">Завершить социальное сопровождение клиента в связи с выполнением плана ИПР</option>
                  <option value="extended">Продлить социальное сопровождение</option>
                  <option value="cancelled_other">Завершить социальное сопровождение клиента по другим причинам</option>
                </select>
              </label>

              {data.conclusions?.status === "extended" && (
                <label className="field intake-field">
                  <span>Продлить на срок (количество месяцев)</span>
                  <input
                    type="number"
                    min={1}
                    value={data.conclusions?.monthsExtension || ""}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        conclusions: {
                          ...(data.conclusions || {}),
                          monthsExtension: Number.parseInt(e.target.value, 10) || undefined,
                        },
                      })
                    }
                    disabled={disabled}
                  />
                </label>
              )}

              {data.conclusions?.status === "cancelled_other" && (
                <label className="field intake-field wide">
                  <span>Основания снятия с сопровождения *</span>
                  <select
                    value={data.conclusions?.closeReason || ""}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        conclusions: { ...(data.conclusions || {}), closeReason: e.target.value },
                      })
                    }
                    disabled={disabled}
                  >
                    <option value="">Не выбрано</option>
                    <option value="transfer_oksp">Передача на специализированный учет в связи с мерой, не связанной с лишением свободы</option>
                    <option value="custody_prison">Заключение под стражу или реальное осуждение с лишением свободы</option>
                    <option value="shelter">Помещение клиента в социозащитное учреждение</option>
                    <option value="health_oo">Помещение клиента в учреждение здравоохранения</option>
                    <option value="social_service">На сопровождение в учреждение социального обслуживания населения (КЦСОН)</option>
                    <option value="closed_school">В специальное учебно-воспитательное учреждение закрытого типа</option>
                    <option value="relocation">Смена постоянного места жительства (выезд за пределы региона)</option>
                    <option value="no_contact">Невозможность сопровождения по независящим причинам (нет контакта / недоступен)</option>
                    <option value="age_18">Достижение 18 лет</option>
                    <option value="death">Смерть клиента</option>
                  </select>
                </label>
              )}

              <div className="field intake-field wide">
                <span>Заключительное текстовое резюме (динамика, эффекты, рекомендации для КДНиЗП)</span>
                <textarea
                  rows={5}
                  value={data.conclusions?.notes || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      conclusions: { ...(data.conclusions || {}), notes: e.target.value },
                    })
                  }
                  placeholder="Краткое описание динамики, реализованных мероприятий, снижения рисков и итоговых рекомендаций..."
                  disabled={disabled}
                />
                <div className="workspace-actions" style={{ marginTop: "8px" }}>
                  <SpeechDictationButton
                    onText={(chunk) =>
                      onChange({
                        ...data,
                        conclusions: {
                          ...(data.conclusions || {}),
                          notes: appendDictatedChunk(data.conclusions?.notes || "", chunk),
                        },
                      })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Быстрый просмотр следов дела: встреч, групп и протоколов */}
      {traceModal && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: "16px",
          }}
          onClick={() => setTraceModal(null)}
        >
          <div
            className="modal-window"
            style={{
              maxWidth: "740px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "12px",
                marginBottom: "16px",
              }}
            >
              <div>
                {traceModal.badge && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "#e0e7ff",
                      color: "#4338ca",
                      display: "inline-block",
                      marginBottom: "6px",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {traceModal.badge}
                  </span>
                )}
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                  {traceModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTraceModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.6rem",
                  cursor: "pointer",
                  color: "#64748b",
                  lineHeight: 1,
                  padding: "4px 8px",
                }}
                title="Закрыть"
              >
                &times;
              </button>
            </div>

            <div
              style={{
                overflowY: "auto",
                flex: 1,
                lineHeight: "1.6",
                fontSize: "13.5px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                paddingRight: "4px",
              }}
            >
              {traceModal.sections && traceModal.sections.length > 0 ? (
                traceModal.sections.map((sec, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "10px 14px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#334155",
                        marginBottom: "4px",
                      }}
                    >
                      {sec.label}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", color: "#0f172a" }}>{sec.value}</div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    color: "#0f172a",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "12px 16px",
                  }}
                >
                  {traceModal.text}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "16px",
                borderTop: "1px solid #e2e8f0",
                paddingTop: "14px",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ob-btn secondary"
                  style={{ fontSize: "12.5px" }}
                  onClick={async () => {
                    try {
                      const fullText =
                        traceModal.sections && traceModal.sections.length > 0
                          ? traceModal.sections.map((s) => `${s.label}:\n${s.value}`).join("\n\n")
                          : traceModal.text || "";
                      await navigator.clipboard.writeText(fullText);
                      setCopiedTraceNotice(true);
                      setTimeout(() => setCopiedTraceNotice(false), 2000);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  {copiedTraceNotice ? "✓ Скопировано!" : "📋 Скопировать текст"}
                </button>
                {(traceModal.caseId || caseId) && (
                  <button
                    type="button"
                    className="ob-btn primary"
                    style={{
                      fontSize: "12.5px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      const targetId = traceModal.caseId || caseId;
                      if (targetId) {
                        setTraceModal(null);
                        requestOpenConsultationCase(targetId);
                      }
                    }}
                    title="Перейти в интерактивный журнал консультаций по этому ребёнку"
                  >
                    <span>📂 Открыть в Журнале консультаций</span>
                    <span>↗</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="ob-btn secondary"
                style={{ fontSize: "12.5px" }}
                onClick={() => setTraceModal(null)}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
