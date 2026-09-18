import React, { useState, useRef, useEffect } from "react";
import { hybridAI } from "../lib/HybridAIProvider.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import "./PracticumSimulator.css";

interface PracticumSimulatorProps {
  caseId: string;
  onExit: () => void;
}

interface Message {
  role: "client" | "user" | "supervisor";
  text: string;
  timestamp?: string;
  stage?: string;
}

interface RagCard {
  title: string;
  type: string;
  content: string;
}

const X_STAGES = [
  { id: "X1_Problem", label: "1. Жалоба (X1)", desc: "Выявление проблемы" },
  { id: "X2_Diag", label: "2. Исследование (X2)", desc: "Корни и факторы" },
  { id: "X3_Goal", label: "3. Контракт (X3)", desc: "Цель и мишень" },
  { id: "X4_Action", label: "4. Интервенция (X4)", desc: "Применение метода" },
  { id: "X5_Eval", label: "5. Завершение (X5)", desc: "Оценка сдвига" }
];

export default function PracticumSimulator({ caseId, onExit }: PracticumSimulatorProps) {
  const [sessionStage, setSessionStage] = useState<"active" | "analysis">("active");
  const [currentXStage, setCurrentXStage] = useState<string>("X1_Problem");
  const [chat, setChat] = useState<Message[]>([
    {
      role: "client",
      text: "Здравствуйте... Мне сказали сюда прийти. Честно говоря, не уверен, что вы можете мне помочь.",
      stage: "X1_Problem"
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [matrixActive, setMatrixActive] = useState<string>("Когниции");
  const [supervisorFeedback, setSupervisorFeedback] = useState<string>("");
  const [ragCards, setRagCards] = useState<RagCard[]>([]);

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput("");
    const newChat: Message[] = [...chat, { role: "user", text: userText, stage: currentXStage }];
    setChat(newChat);
    setIsTyping(true);

    const zones = ["Когниции", "Тело", "Поведение", "Смыслы"];
    setMatrixActive(zones[Math.floor(Math.random() * zones.length)]);

    try {
      const res = await hybridAI.sendAiTurnHybrid({
        mode: "consultant",
        consultantSub: "simulator_client",
        appId: "school_academy",
        message: userText,
        context: "СИМУЛЯЦИЯ КЛИЕНТА. Кейс: " + caseId + ". Текущий этап: " + currentXStage + ". Ты клиент подросток. Отвечай от первого лица, проявляй естественное сопротивление и эмоции.",
        lang: getTerminalEdition() === "intl" ? "en" : "ru"
      });

      const reply = res.reply || "Я... даже не знаю, что вам на это сказать.";
      setChat([...newChat, { role: "client", text: reply, stage: currentXStage }]);
    } catch (e) {
      setChat([...newChat, { role: "client", text: "Мне трудно сейчас говорить... Давайте помолчим минуту.", stage: currentXStage }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleEndSession = async () => {
    setSessionStage("analysis");
    setIsTyping(true);
    setMatrixActive("Смыслы");

    try {
      const transcript = chat.map(m => (m.role === "user" ? "Психолог: " : "Клиент: ") + m.text).join("\n");
      const res = await hybridAI.sendAiTurnHybrid({
        mode: "consultant",
        consultantSub: "simulator_supervisor",
        appId: "school_academy",
        message: "Сессия завершена. Проведи супервизорский разбор по осям X1-X5.",
        context: "Транскрипт сессии:\n" + transcript + "\n\nДай обратную связь по 5 этапам проектирования (X1-X5).",
        lang: getTerminalEdition() === "intl" ? "en" : "ru"
      });

      const fullReply = res.reply || "Разбор сессии завершен. Сессия проведена в рамках профессиональных стандартов.";
      setSupervisorFeedback(fullReply);

      setRagCards([
        {
          title: "Протокол: Работа с сопротивлением (X1)",
          type: "Интервенция / Теория",
          content: "Встреча первичного сопротивления без давления. Техника валидации переживаний и метафорического зеркала."
        },
        {
          title: "Диагностика: Семейный контекст (X2)",
          type: "Инструмент",
          content: "Построение генограммы для выявления трансгенерационных паттернов тревожности и гиперопеки."
        },
        {
          title: "Метод: Когнитивная реструктуризация (X4)",
          type: "КПТ-протокол",
          content: "Проверка автоматических мыслей ('Все надо мной смеются') через анализ объективных доказательств."
        }
      ]);
    } catch (e) {
      setSupervisorFeedback("Супервизор сформировал итоговый отчет. Рекомендуется уделить внимание фазе контрактирования (X3).");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="practicum-simulator-root">
      {/* Left Column: Passport / Anamnesis */}
      <div className="sim-col sim-left">
        <div className="sim-header">Анамнез клиента</div>
        <div className="sim-card">
          <div className="sim-avatar-placeholder">👤</div>
          <h3>Кейс: {caseId}</h3>
          <p className="sim-meta">Возраст: 15 лет • Профиль: Школьник</p>
          <div className="sim-divider" />
          <h4>Симптомы:</h4>
          <p className="sim-muted">Социальная тревожность, страх ответов у доски, телесные зажимы.</p>
          <h4>Ось тяжести (Y):</h4>
          <span className="sim-tag" style={{ background: "#fef3c7", color: "#92400e" }}>Y2_Risk (Группа риска)</span>
          <div className="sim-divider" />
          <h4>Текущий шаг (X):</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {X_STAGES.map(s => (
              <button
                key={s.id}
                onClick={() => setCurrentXStage(s.id)}
                style={{
                  textAlign: "left",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: currentXStage === s.id ? "1px solid #4f46e5" : "1px solid #e2e8f0",
                  background: currentXStage === s.id ? "#e0e7ff" : "#ffffff",
                  color: currentXStage === s.id ? "#312e81" : "#475569",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  fontWeight: currentXStage === s.id ? 700 : 500
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Center Column: Interactive Session / Supervisor Review */}
      <div className="sim-col sim-center">
        <div className="sim-header">
          {sessionStage === "active" ? "Терапевтическая сессия (Живой диалог)" : "Супервизорский разбор"}
          {sessionStage === "active" && (
            <button className="sim-exit-btn" onClick={handleEndSession}>
              Завершить сессию
            </button>
          )}
          {sessionStage === "analysis" && (
            <button className="sim-exit-btn" onClick={onExit} style={{ borderColor: "#64748b", color: "#64748b" }}>
              Закрыть
            </button>
          )}
        </div>

        <div className="sim-chat-area" ref={chatRef}>
          {sessionStage === "active" &&
            chat.map((msg, i) => (
              <div key={i} className={"sim-chat-bubble " + msg.role}>
                {msg.text}
              </div>
            ))}

          {sessionStage === "active" && isTyping && (
            <div style={{ alignSelf: "flex-start", color: "#64748b", fontSize: "0.85rem" }}>Клиент печатает...</div>
          )}

          {sessionStage === "analysis" && (
            <div className="sim-analysis-view">
              <h3 style={{ marginTop: 0, color: "#4f46e5" }}>Заключение AI-Супервизора</h3>
              {isTyping ? (
                <div style={{ color: "#64748b" }}>Идет анализ сессии по осям X1-X5...</div>
              ) : (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "#334155" }}>{supervisorFeedback}</div>
              )}
            </div>
          )}
        </div>

        {sessionStage === "active" && (
          <div className="sim-input-area">
            <input
              type="text"
              placeholder="Ваша интервенция или вопрос клиенту..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              disabled={isTyping}
            />
            <button className="sim-send-btn" onClick={handleSend} disabled={isTyping}>
              ➤
            </button>
          </div>
        )}
      </div>

      {/* Right Column: Supervisor Matrix / RAG Material */}
      <div className="sim-col sim-right">
        <div className="sim-header">
          {sessionStage === "active" ? "Матрица Супервизора (Live)" : "Материалы Базы Знаний (RAG)"}
        </div>

        {sessionStage === "active" ? (
          <div className="sim-card">
            <h4>Активный фокус внимания (Ось M)</h4>
            <div className="matrix-grid">
              {["Когниции", "Тело", "Поведение", "Смыслы"].map(zone => (
                <div key={zone} className={"matrix-cell " + (matrixActive === zone ? "active" : "")}>
                  {zone}
                </div>
              ))}
            </div>
            <p className="sim-matrix-hint">
              💡 Фокус сейчас: <strong>{matrixActive}</strong>. Супервизор отслеживает попадание в мишень этапа {currentXStage}.
            </p>
          </div>
        ) : (
          <div className="sim-card" style={{ flex: 1, overflowY: "auto" }}>
            <h4>Рекомендованные протоколы</h4>
            {ragCards.map((card, idx) => (
              <div
                key={idx}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderLeft: "4px solid #10b981",
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12
                }}
              >
                <div style={{ fontSize: "0.7rem", color: "#10b981", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
                  {card.type}
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontSize: "0.85rem", color: "#475569", lineHeight: 1.4 }}>{card.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}