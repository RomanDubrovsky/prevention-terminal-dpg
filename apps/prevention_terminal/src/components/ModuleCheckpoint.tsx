import { useState, useEffect } from "react";
import ruTestData from "../lib/academy_tests.json" with { type: "json" };
import intlTestData from "../lib/academy_tests_intl.json" with { type: "json" };
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import { t } from "../lib/i18n.ts";
import "./ModuleCheckpoint.css";

interface Question {
  id: string;
  moduleId: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface ModuleCheckpointProps {
  moduleId: number;
  onComplete: (score: number, total: number, failedQuestions: Question[]) => void;
}

export default function ModuleCheckpoint({ moduleId, onComplete }: ModuleCheckpointProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [failed, setFailed] = useState<Question[]>([]);
  const [score, setScore] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Load questions for this module
    const testData = getTerminalEdition() === "intl" ? intlTestData : ruTestData;
    const filtered = (testData as Question[]).filter((q) => q.moduleId === moduleId);
    setQuestions(filtered);
    setCurrentIdx(0);
    setSelectedOpt(null);
    setIsAnswered(false);
    setFailed([]);
    setScore(0);
    setIsDone(false);
  }, [moduleId]);

  if (questions.length === 0) {
    return <div className="checkpoint-container empty">{t("Вопросы для этого модуля загружаются или отсутствуют.", "Questions for this module are loading or missing.")}</div>;
  }

  const q = questions[currentIdx];

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedOpt(idx);
    setIsAnswered(true);

    if (idx === q.correctIndex) {
      setScore((s) => s + 1);
    } else {
      setFailed((prev) => [...prev, q]);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((c) => c + 1);
      setSelectedOpt(null);
      setIsAnswered(false);
    } else {
      setIsDone(true);
      onComplete(score + (selectedOpt === q.correctIndex ? 1 : 0), questions.length, failed);
    }
  };

  if (isDone) {
    return (
      <div className="checkpoint-container done">
        <h2>{t("Чекпойнт пройден", "Checkpoint Completed")}</h2>
        <p>{t("Ваш результат:", "Your score:")} {score} {t("из", "out of")} {questions.length}</p>
        <p className="hint">{t("Результаты отправлены ИИ-Профессору. Вы можете продолжить чтение следующих лекций.", "The results have been sent to the AI Professor. You can continue reading the following lectures.")}</p>
      </div>
    );
  }

  return (
    <div className="checkpoint-container">
      <div className="checkpoint-header">
        <h3>{t("Проверка знаний: Модуль", "Knowledge Check: Module")} {moduleId}</h3>
        <span className="progress">{currentIdx + 1} / {questions.length}</span>
      </div>
      
      <div className="question-box">
        <p className="question-text">{q.question}</p>
        <div className="options-list">
          {q.options.map((opt, idx) => {
            let className = "option-btn";
            if (isAnswered) {
              if (idx === q.correctIndex) className += " correct";
              else if (idx === selectedOpt) className += " incorrect";
            } else if (idx === selectedOpt) {
              className += " selected";
            }

            return (
              <button 
                key={idx} 
                className={className} 
                onClick={() => handleSelect(idx)}
                disabled={isAnswered}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {isAnswered && (
        <div className="explanation-box">
          <div className={`status ${selectedOpt === q.correctIndex ? "success" : "error"}`}>
            {selectedOpt === q.correctIndex ? t("Верно!", "Correct!") : t("Неверно.", "Incorrect.")}
          </div>
          <p>{q.explanation}</p>
          <button className="ob-btn primary next-btn" onClick={handleNext}>
            {currentIdx < questions.length - 1 ? t("Следующий вопрос", "Next Question") : t("Завершить чекпойнт", "Finish Checkpoint")}
          </button>
        </div>
      )}
    </div>
  );
}
