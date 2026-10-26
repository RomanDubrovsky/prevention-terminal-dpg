import React, { useState } from "react";
import {
  getHomeworkForLessonAndStudent,
  submitHomework,
  type AcademyHomeworkSubmission,
} from "../../lib/academy_lms_store.ts";

interface StudentHomeworkSubmitBlockProps {
  lessonId: string;
  lessonTitle: string;
  moduleId: string | number;
  moduleTitle?: string;
  taskPrompt: string;
  studentName?: string;
  studentEmail?: string;
  isStopLesson?: boolean;
}

export const StudentHomeworkSubmitBlock: React.FC<StudentHomeworkSubmitBlockProps> = ({
  lessonId,
  lessonTitle,
  moduleId,
  moduleTitle,
  taskPrompt,
  studentName = "Студент курса",
  studentEmail = "student@demo.ida-psy.ru",
  isStopLesson,
}) => {
  const [submission, setSubmission] = useState<AcademyHomeworkSubmission | undefined>(() =>
    getHomeworkForLessonAndStudent(lessonId, studentEmail)
  );
  const [answerText, setAnswerText] = useState(submission?.studentAnswer || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSent, setJustSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerText.trim()) return;

    setIsSubmitting(true);
    const result = submitHomework({
      lessonId,
      lessonTitle,
      moduleId,
      moduleTitle,
      studentId: "student-self",
      studentName,
      studentEmail,
      taskPrompt,
      studentAnswer: answerText.trim(),
    });

    setSubmission(result);
    setIsSubmitting(false);
    setJustSent(true);
    setTimeout(() => setJustSent(false), 3000);
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "20px 24px",
        marginTop: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.3rem" }}>📝</span>
          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
            Домашнее задание к уроку
          </h4>
          {isStopLesson && (
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "4px",
                fontWeight: 700,
                border: "1px solid #fde68a",
              }}
            >
              🔒 Стоп-урок
            </span>
          )}
        </div>

        {submission && (
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "12px",
              fontSize: "0.8rem",
              fontWeight: 700,
              background:
                submission.status === "approved"
                  ? "#dcfce7"
                  : submission.status === "pending"
                  ? "#fef3c7"
                  : "#fee2e2",
              color:
                submission.status === "approved"
                  ? "#15803d"
                  : submission.status === "pending"
                  ? "#b45309"
                  : "#b91c1c",
            }}
          >
            {submission.status === "approved"
              ? "✅ Задание принято"
              : submission.status === "pending"
              ? "⏳ На проверке у преподавателя"
              : "🔄 Требуется доработка"}
          </span>
        )}
      </div>

      {/* Task Prompt */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "16px",
          fontSize: "0.88rem",
          color: "#334155",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, color: "#475569", marginBottom: "4px", fontSize: "0.78rem" }}>
          Задание для самостоятельной отработки:
        </div>
        {taskPrompt}
      </div>

      {/* Reviewer Feedback if present */}
      {submission?.reviewerComment && (
        <div
          style={{
            background: submission.status === "approved" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${submission.status === "approved" ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: "8px",
            padding: "12px 16px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            color: submission.status === "approved" ? "#166534" : "#991b1b",
          }}
        >
          <strong>Обратная связь преподавателя ({submission.reviewedBy || "Куратор"}):</strong>
          <div style={{ marginTop: "4px", whiteSpace: "pre-wrap" }}>{submission.reviewerComment}</div>
        </div>
      )}

      {/* Submit Form */}
      {submission?.status === "approved" ? (
        <div style={{ color: "#15803d", fontSize: "0.85rem", fontWeight: 600 }}>
          🎉 Вы успешно сдали и защитили это домашнее задание! Следующий материал открыт.
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Ваш ответ на задание (текст или ссылка на Google Docs / Яндекс.Диск):
            </label>
            <textarea
              rows={5}
              required
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Опишите ваши гипотезы, шаги интервенции или заполненный протокол..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                lineHeight: 1.5,
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {isStopLesson && "⚠️ Без проверки этого задания переход к следующему уроку будет заблокирован."}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: justSent ? "#10b981" : "#4f46e5",
                color: "#fff",
                border: "none",
                padding: "9px 20px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)",
              }}
            >
              {justSent ? "✓ Отправлено!" : submission ? "🔄 Отправить повторно" : "📤 Сдать на проверку"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
