import React, { useState, useEffect } from "react";
import { t } from "../../lib/i18n.ts";

interface LayerData {
  layer_index: number;
  title: string;
  narrative: string;
  revealed_data: Record<string, string>;
  trap_alert?: string;
}

interface LayeredCase {
  id: string;
  title: string;
  domain: string;
  target_audience: string;
  description: string;
  layers: LayerData[];
}

const BUILTIN_CASES: LayeredCase[] = [
  {
    id: "anti_anchor_adhd_trauma",
    title: "Школьник Миша (10 лет): 'Невнимательный и неусидчивый' (СДВГ vs Травма)",
    domain: "Школьная психология и детские трудности",
    target_audience: "Педагоги-психологи, детские психологи",
    description: "Тренировка клинической гибкости: умение различить дефицит внимания и защитную реакцию на семейное насилие/травму.",
    layers: [
      {
        layer_index: 1,
        title: "Слой 1: Жалобы школы и учителей",
        narrative: "Учитель начальных классов жалуется: Миша постоянно отвлекается на уроках, крутится, роняет ручки, вздрагивает при громких звуках и не может сосредоточиться на контрольных. Родители подтверждают: дома он нервный и неусидчивый.",
        revealed_data: {
          "Поведение на уроке": "Вертится, не слышит с первого раза, вздрагивает",
          "Жалоба учителя": "Подозрение на СДВГ или педагогическую запущенность",
          "Оценки": "Резко съехал во 2-й четверти"
        },
        trap_alert: "Ловушка первого впечатления: велик соблазн сразу поставить ярлык 'СДВГ'."
      },
      {
        layer_index: 2,
        title: "Слой 2: Раскрытие семейной обстановки и триггеров",
        narrative: "При доверительном контакте выясняется: 3 месяца назад отец вернулся с вахты, начались ночные скандалы с битьем посуды. Миша вздрагивает, потому что ждет крика. Неусидчивость — это постоянная физиологическая гипербдительность (готовность бежать/прятаться).",
        revealed_data: {
          "Семейный контекст": "Ночные крики, агрессия отца, страх за маму",
          "Физиология": "Хронический выброс адреналина, гипербдительность",
          "Истинное звено": "Травматический стресс и отсутствие физической безопасности"
        },
        trap_alert: "Проверка: готовы ли вы отказаться от первичной гипотезы СДВГ в пользу травмы и безопасности?"
      }
    ]
  },
  {
    id: "anti_anchor_panic_soma",
    title: "Студентка Анна (20 лет): 'Сердечные приступы' (Кардиология vs Панический цикл)",
    domain: "Взрослая психотерапия и тревожные расстройства",
    target_audience: "Психологи, врачи-психотерапевты",
    description: "Тренировка различения соматических жалоб и замкнутого круга катастрофизации телесных ощущений.",
    layers: [
      {
        layer_index: 1,
        title: "Слой 1: Соматические жалобы",
        narrative: "Анна обратилась с жалобами на внезапные приступы удушья, тахикардию (пульс до 140) и страх мгновенной смерти от инфаркта в метро. Вызывала скорую 4 раза.",
        revealed_data: {
          "Симптомы": "Тахикардия, головокружение, нехватка воздуха",
          "Контекст": "Метро, душные аудитории",
          "Поведение": "Избегает поездок в метро, носит корвалол"
        }
      },
      {
        layer_index: 2,
        title: "Слой 2: Результаты обследования и психологический механизм",
        narrative: "Холтер, ЭКГ и гормоны щитовидной железы — в полной норме. При опросе выясняется: приступ запускается обычной мыслью 'ой, сердце как-то странно стукнуло' ➔ катастрофическая оценка 'это инфаркт!' ➔ выброс адреналина ➔ реальное ускорение пульса ➔ подтверждение паники.",
        revealed_data: {
          "Медицинский статус": "Сердце здорово (органической патологии нет)",
          "Механизм": "Катастрофизация естественных вегетативных колебаний",
          "Фокус": "Разрыв петли избегания и проверка реакции тела на выдох"
        }
      }
    ]
  }
];

export default function LayeredFormulationSimulator(): React.ReactElement {
  const [cases, setCases] = useState<LayeredCase[]>(BUILTIN_CASES);
  const [selectedCase, setSelectedCase] = useState<LayeredCase>(BUILTIN_CASES[0]);
  const [currentLayerIdx, setCurrentLayerIdx] = useState<number>(0);
  const [studentHypothesis, setStudentHypothesis] = useState<string>("");
  const [studentMechanism, setStudentMechanism] = useState<string>("");
  const [studentVerstehen, setStudentVerstehen] = useState<string>("");
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationFeedback, setEvaluationFeedback] = useState<any | null>(null);

  useEffect(() => {
    // Try fetching dynamic cases from backend
    fetch("/api/v1/academy/formulation/cases")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.api_cases) {
          setCases(data.api_cases);
        }
      })
      .catch(() => {});
  }, []);

  const currentLayer = selectedCase.layers[currentLayerIdx];

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setEvaluationFeedback(null);

    const payload = {
      case_id: selectedCase.id,
      layer_index: currentLayer.layer_index,
      user_hypothesis: studentHypothesis,
      mechanism_explained: studentMechanism,
      client_explanation: studentVerstehen,
      prior_hypothesis: currentLayerIdx > 0 ? "СДВГ / Соматическая патология" : "",
    };

    try {
      const resp = await fetch("/api/v1/academy/formulation/evaluate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        const result = await resp.json();
        setEvaluationFeedback(result);
        setIsEvaluating(false);
        return;
      }
    } catch {
      // Fallback local evaluation
    }

    // Heuristic fallback evaluation
    const isLayer2 = currentLayerIdx === 1;
    const lowerHypo = (studentHypothesis + " " + studentMechanism).toLowerCase();
    const flexibilityScore = isLayer2
      ? lowerHypo.includes("травм") || lowerHypo.includes("стресс") || lowerHypo.includes("насили") || lowerHypo.includes("паник") || lowerHypo.includes("катастроф")
        ? 95
        : 45
      : 85;

    setEvaluationFeedback({
      cognitive_flexibility_score: flexibilityScore,
      anchoring_bias_detected: isLayer2 && flexibilityScore < 60,
      feedback: isLayer2 && flexibilityScore >= 80
        ? "🌟 Отличная гибкость! Вы своевременно пересмотрели первичную гипотезу и увидели глубинный механизм вместо поверхностного ярлыка."
        : isLayer2
        ? "⚠️ Внимание: сработал эффект якорения (застревание в первичном впечатлении). Обратите внимание на новые данные семейной обстановки."
        : "✓ Гипотеза зафиксирована. Переходите ко второму слою дела, чтобы проверить её устойчивость.",
      verstehen_score: studentVerstehen.length > 20 ? 90 : 60,
    });
    setIsEvaluating(false);
  };

  const handleNextLayer = () => {
    if (currentLayerIdx < selectedCase.layers.length - 1) {
      setCurrentLayerIdx(currentLayerIdx + 1);
      setEvaluationFeedback(null);
    }
  };

  const handleReset = (c: LayeredCase) => {
    setSelectedCase(c);
    setCurrentLayerIdx(0);
    setStudentHypothesis("");
    setStudentMechanism("");
    setStudentVerstehen("");
    setEvaluationFeedback(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px", gap: "16px", background: "#0b1329", color: "#f1f5f9", overflowY: "auto" }}>
      {/* Title Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.4rem" }}>🕵️‍♂️</span>
            <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#38bdf8" }}>
              {t("Детектив Формулировки: Проверка на эффект якорения", "Formulation Detective: Anti-Anchoring Simulator")}
            </h2>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
            {t(
              "Многослойные клинические дела: тренировка гибкости мышления и преодоления предвзятости первого впечатления",
              "Layered clinical cases: training cognitive flexibility and overcoming first-impression anchoring bias"
            )}
          </p>
        </div>

        {/* Case selector */}
        <div style={{ display: "flex", gap: "8px" }}>
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => handleReset(c)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: selectedCase.id === c.id ? "1px solid #38bdf8" : "1px solid #334155",
                background: selectedCase.id === c.id ? "rgba(56, 189, 248, 0.15)" : "#1e293b",
                color: selectedCase.id === c.id ? "#38bdf8" : "#cbd5e1",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {c.title.split(":")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace: 2 Columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1 }}>
        
        {/* Left Column: Case Narrative & Revealed Data */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: currentLayerIdx === 0 ? "#38bdf8" : "#f59e0b" }}>
              {currentLayer.title}
            </span>
            <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: "12px", background: "#1e293b", color: "#94a3b8" }}>
              Слой {currentLayerIdx + 1} из {selectedCase.layers.length}
            </span>
          </div>

          <div style={{ fontSize: "0.85rem", lineHeight: "1.5", color: "#e2e8f0", background: "#1e293b/40", padding: "12px", borderRadius: "8px", border: "1px solid #334155" }}>
            {currentLayer.narrative}
          </div>

          {currentLayer.trap_alert && (
            <div style={{ display: "flex", gap: "8px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "10px", borderRadius: "8px", fontSize: "0.75rem", color: "#fbbf24" }}>
              <span>⚠️</span>
              <div>
                <strong>Ловушка восприятия:</strong> {currentLayer.trap_alert}
              </div>
            </div>
          )}

          {/* Key Facts */}
          <div>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Объективные данные слоя:
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
              {Object.entries(currentLayer.revealed_data).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#1e293b", borderRadius: "6px", fontSize: "0.75rem" }}>
                  <span style={{ color: "#94a3b8" }}>{k}:</span>
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Student Formulation Input & AI Assessment */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", padding: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 800, color: "#cbd5e1" }}>
            🧠 Ваша формулировка на данном слое:
          </h3>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
              1. Главная гипотеза (В чём суть происходящего):
            </label>
            <input
              type="text"
              value={studentHypothesis}
              onChange={(e) => setStudentHypothesis(e.target.value)}
              placeholder="Сформулируйте гипотезу..."
              style={{ width: "100%", padding: "8px 10px", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#fff", fontSize: "0.8rem", outline: "none" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
              2. Причинный механизм (Петля: триггер ➔ реакция ➔ защитное действие):
            </label>
            <textarea
              rows={2}
              value={studentMechanism}
              onChange={(e) => setStudentMechanism(e.target.value)}
              placeholder="Как проблема воспроизводит сама себя..."
              style={{ width: "100%", padding: "8px 10px", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#fff", fontSize: "0.8rem", outline: "none", resize: "none" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", marginBottom: "4px" }}>
              3. Объяснение простыми словами (Verstehen — для клиента / родителей):
            </label>
            <textarea
              rows={2}
              value={studentVerstehen}
              onChange={(e) => setStudentVerstehen(e.target.value)}
              placeholder="Без птичьего языка, простыми человеческими словами..."
              style={{ width: "100%", padding: "8px 10px", background: "#1e293b", border: "1px solid #334155", borderRadius: "6px", color: "#fff", fontSize: "0.8rem", outline: "none", resize: "none" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
            <button
              onClick={handleEvaluate}
              disabled={isEvaluating || !studentHypothesis.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: isEvaluating ? "#475569" : "#4f46e5",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: isEvaluating || !studentHypothesis.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isEvaluating ? "Оцениваем..." : "⚡ Оценить гибкость и чистоту языка"}
            </button>

            {currentLayerIdx < selectedCase.layers.length - 1 && (
              <button
                onClick={handleNextLayer}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #38bdf8",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Открыть Слой 2 (Поворот дела) →
              </button>
            )}
          </div>

          {/* Feedback Area */}
          {evaluationFeedback && (
            <div style={{ marginTop: "10px", padding: "12px", borderRadius: "8px", background: evaluationFeedback.anchoring_bias_detected ? "rgba(225, 29, 72, 0.15)" : "rgba(16, 185, 129, 0.15)", border: evaluationFeedback.anchoring_bias_detected ? "1px solid rgba(225, 29, 72, 0.4)" : "1px solid rgba(16, 185, 129, 0.4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: evaluationFeedback.anchoring_bias_detected ? "#fb7185" : "#34d399" }}>
                  {evaluationFeedback.anchoring_bias_detected ? "⚠️ Обнаружен эффект якорения" : "✓ Высокая клиническая гибкость"}
                </span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#1e293b", color: "#fff" }}>
                  Гибкость: {evaluationFeedback.cognitive_flexibility_score}%
                </span>
              </div>
              <p style={{ margin: 0, fontSize: "0.75rem", lineHeight: "1.4", color: "#e2e8f0" }}>
                {evaluationFeedback.feedback}
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
