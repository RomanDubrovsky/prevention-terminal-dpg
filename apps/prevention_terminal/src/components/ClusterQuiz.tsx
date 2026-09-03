import React, { useState } from 'react';
import { t } from '../lib/i18n.ts';
import { addPoints } from '../lib/academy_progress.ts';
import ruTestData from "../lib/academy_tests.json" with { type: "json" };
import intlTestData from "../lib/academy_tests_intl.json" with { type: "json" };
import { getTerminalEdition } from "../lib/terminal_edition.ts";

interface QuizQuestion {
  q: string;
  opts: string[];
  ans: number;
  exp: string;
}

interface ClusterQuizProps {
  moduleId: number;
  onPassed: () => void;
}

export default function ClusterQuiz({ moduleId, onPassed }: ClusterQuizProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQuiz = async () => {
    setLoading(true);
    setError(null);
    try {
      const testData = getTerminalEdition() === "intl" ? intlTestData : ruTestData;
      const filtered = (testData as any[]).filter((q) => q.moduleId === moduleId);
      
      if (filtered.length === 0) {
        throw new Error("No questions found for this module");
      }

      // Randomly select 3 questions
      const shuffled = [...filtered].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);
      
      const mappedQuestions = selected.map(q => ({
        q: q.question,
        opts: q.options,
        ans: q.correctIndex,
        exp: q.explanation
      }));

      setQuestions(mappedQuestions);
      setCurrentIdx(0);
      setSelectedIdx(null);
      setShowExplanation(false);
    } catch (e) {
      console.error(e);
      setError(t("Не удалось загрузить тест. Попробуйте еще раз.", "Failed to load test. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (idx: number) => {
    if (showExplanation) return;
    setSelectedIdx(idx);
    setShowExplanation(true);
    
    // Award point if correct?
    // Let's keep it simple.
  };

  const handleNext = () => {
    if (!questions) return;
    
    // Award 5 points for answering correct
    if (selectedIdx === questions[currentIdx].ans) {
      addPoints(5);
    }
    
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedIdx(null);
      setShowExplanation(false);
    } else {
      // Finished
      addPoints(10); // Bonus for finishing quiz
      onPassed();
    }
  };

  if (!questions) {
    return (
      <div className="cluster-quiz-start" style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-highlight, #f0fdf4)', borderRadius: '12px', textAlign: 'center' }}>
        <h3 style={{ marginTop: 0 }}>{t("Проверьте свои знания", "Test Your Knowledge")}</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {t("Сгенерировать мини-тест по карточкам этого кластера?", "Generate a mini-quiz based on this cluster's cards?")}
        </p>
        <button 
          onClick={generateQuiz} 
          disabled={loading}
          style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          {loading ? t("Генерация...", "Generating...") : t("Сгенерировать тест", "Generate Quiz")}
        </button>
        {error && <div style={{ color: 'red', marginTop: '8px', fontSize: '0.8rem' }}>{error}</div>}
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="cluster-quiz" style={{ marginTop: '24px', padding: '20px', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>{t("Вопрос", "Question")} {currentIdx + 1} {t("из", "of")} {questions.length}</span>
      </div>
      
      <h3 style={{ marginTop: 0, marginBottom: '16px' }}>{q.q}</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {q.opts.map((opt, idx) => {
          let btnStyle: React.CSSProperties = {
            padding: '12px',
            textAlign: 'left',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            cursor: showExplanation ? 'default' : 'pointer',
            transition: 'all 0.2s'
          };
          
          if (showExplanation) {
            if (idx === q.ans) {
              btnStyle.background = '#dcfce7'; // green
              btnStyle.borderColor = '#22c55e';
            } else if (idx === selectedIdx) {
              btnStyle.background = '#fee2e2'; // red
              btnStyle.borderColor = '#ef4444';
            }
          } else if (selectedIdx === idx) {
            btnStyle.background = 'var(--primary-light)';
            btnStyle.borderColor = 'var(--primary)';
          }

          return (
            <button key={idx} style={btnStyle} onClick={() => handleSelect(idx)}>
              {opt}
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-highlight)', borderRadius: '8px', fontSize: '0.9rem' }}>
          <strong>{t("Объяснение", "Explanation")}:</strong> {q.exp}
        </div>
      )}

      {showExplanation && (
        <button 
          onClick={handleNext}
          style={{ marginTop: '16px', width: '100%', padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          {currentIdx < questions.length - 1 ? t("Дальше", "Next") : t("Завершить", "Finish")}
        </button>
      )}
    </div>
  );
}
