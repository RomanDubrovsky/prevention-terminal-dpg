import React, { useState } from "react";
import {
  getHomeworkSubmissions,
  reviewHomework,
  type AcademyHomeworkSubmission,
} from "../../lib/academy_lms_store.ts";

export const HomeworkReviewPanel: React.FC = () => {
  const [submissions, setSubmissions] = useState<AcademyHomeworkSubmission[]>(() => getHomeworkSubmissions());
  const [filterStatus, setFilterStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [selectedHw, setSelectedHw] = useState<AcademyHomeworkSubmission | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  const filteredSubmissions = submissions.filter((s) => {
    if (filterStatus === "all") return true;
    return s.status === filterStatus;
  });

  const handleOpenReview = (hw: AcademyHomeworkSubmission) => {
    setSelectedHw(hw);
    setReviewComment(hw.reviewerComment || "");
  };

  const handleSaveDecision = (decision: "approved" | "rejected") => {
    if (!selectedHw) return;
    reviewHomework(selectedHw.id, decision, reviewComment);
    setSubmissions(getHomeworkSubmissions());
    setSelectedHw(null);
    setReviewComment("");
  };

  return (
    <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            📥 Проверка домашних заданий
            {pendingCount > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontWeight: 700,
                }}
              >
                {pendingCount} новых
              </span>
            )}
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
            Очередь практических кейсов, протоколов и ответов студентов на проверку
          </p>
        </div>

        {/* Status Filters */}
        <div style={{ display: "flex", gap: "6px" }}>
          {(
            [
              { id: "pending", label: `⏳ На проверке (${pendingCount})` },
              { id: "approved", label: "✅ Принятые" },
              { id: "rejected", label: "🔄 На доработке" },
              { id: "all", label: "Все" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              style={{
                background: filterStatus === tab.id ? "#1e293b" : "#f1f5f9",
                color: filterStatus === tab.id ? "#fff" : "#475569",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submissions List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredSubmissions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", background: "#f8fafc", borderRadius: "10px" }}>
            🎉 В этом разделе пока нет заданий
          </div>
        ) : (
          filteredSubmissions.map((hw) => (
            <div
              key={hw.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px 18px",
                background: hw.status === "pending" ? "#fbfbfe" : "#fff",
                borderLeft:
                  hw.status === "pending"
                    ? "4px solid #f59e0b"
                    : hw.status === "approved"
                    ? "4px solid #10b981"
                    : "4px solid #ef4444",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: "260px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#1e293b" }}>{hw.studentName}</span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>({hw.studentEmail})</span>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background:
                        hw.status === "pending"
                          ? "#fef3c7"
                          : hw.status === "approved"
                          ? "#dcfce7"
                          : "#fee2e2",
                      color:
                        hw.status === "pending"
                          ? "#b45309"
                          : hw.status === "approved"
                          ? "#15803d"
                          : "#b91c1c",
                    }}
                  >
                    {hw.status === "pending"
                      ? "⏳ Ожидает проверки"
                      : hw.status === "approved"
                      ? "✅ Принято"
                      : "🔄 На доработку"}
                  </span>
                </div>

                <div style={{ fontSize: "0.82rem", color: "#4f46e5", fontWeight: 600, marginBottom: "8px" }}>
                  📖 Урок: {hw.lessonTitle}
                </div>

                <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "6px", fontSize: "0.82rem", color: "#334155", marginBottom: "8px" }}>
                  <div style={{ fontWeight: 700, color: "#64748b", marginBottom: "4px", fontSize: "0.75rem" }}>
                    🎯 Задание: {hw.taskPrompt}
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", color: "#0f172a" }}>{hw.studentAnswer}</div>
                </div>

                {hw.reviewerComment && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: "6px", fontSize: "0.8rem", color: "#166534" }}>
                    <strong>Отзыв преподавателя:</strong> {hw.reviewerComment}
                  </div>
                )}

                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px" }}>
                  Сдано: {new Date(hw.submittedAt).toLocaleString()}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => handleOpenReview(hw)}
                  style={{
                    background: hw.status === "pending" ? "#4f46e5" : "#f1f5f9",
                    color: hw.status === "pending" ? "#fff" : "#334155",
                    border: "none",
                    padding: "7px 14px",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {hw.status === "pending" ? "📝 Проверить" : "Редактировать отзыв"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review Modal */}
      {selectedHw && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelectedHw(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "580px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: "0 0 12px 0", fontSize: "1.1rem", fontWeight: 800 }}>
              📝 Проверка задания: {selectedHw.studentName}
            </h4>
            <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "16px" }}>
              Урок: <strong>{selectedHw.lessonTitle}</strong>
            </div>

            <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.85rem" }}>
              <div style={{ fontWeight: 700, color: "#64748b", marginBottom: "6px", fontSize: "0.78rem" }}>
                Формулировка задания:
              </div>
              <p style={{ margin: "0 0 12px 0", color: "#334155" }}>{selectedHw.taskPrompt}</p>

              <div style={{ fontWeight: 700, color: "#64748b", marginBottom: "6px", fontSize: "0.78rem" }}>
                Ответ студента:
              </div>
              <div style={{ whiteSpace: "pre-wrap", color: "#0f172a", background: "#fff", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                {selectedHw.studentAnswer}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "6px" }}>
                💬 Ваш комментарий и рекомендации студенту:
              </label>
              <textarea
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Напишите обратную связь: что получилось хорошо, какие нюансы учесть на практике..."
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectedHw(null)}
                style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}
              >
                Отмена
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => handleSaveDecision("rejected")}
                  style={{
                    background: "#fee2e2",
                    color: "#b91c1c",
                    border: "1px solid #fecaca",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🔄 Вернуть на доработку
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDecision("approved")}
                  style={{
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    padding: "8px 20px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✅ Принять задание
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
