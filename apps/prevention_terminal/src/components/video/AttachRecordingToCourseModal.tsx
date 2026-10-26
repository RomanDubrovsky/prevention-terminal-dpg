import React, { useState } from "react";
import { type CloudRecording } from "../../lib/webinars_store.ts";
import { saveCustomAcademyLesson } from "../../lib/academy_store.ts";
import { t } from "../../lib/i18n.ts";

interface AttachRecordingToCourseModalProps {
  rec: CloudRecording;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AttachRecordingToCourseModal({
  rec,
  onClose,
  onSuccess,
}: AttachRecordingToCourseModalProps) {
  const [selectedModule, setSelectedModule] = useState<string>("module_practice");
  const [lessonTitle, setLessonTitle] = useState(rec.webinarTitle);
  const [lessonTag, setLessonTag] = useState("Мастер-класс");
  const [includeSummary, setIncludeSummary] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableModules = [
    { id: "module_theory", title: "Модуль 1. ТЕОРИЯ И КЛИНИЧЕСКИЕ ОСНОВЫ" },
    { id: "module_protocols", title: "Модуль 2. ПРОТОКОЛЫ И ТЕХНОЛОГИИ" },
    { id: "module_practice", title: "Модуль 3. ПРАКТИКА И СИМУЛЯЦИИ" },
    { id: "module_webinars", title: "Спецкурс: АВТОРСКИЕ ВЕБИНАРЫ И РАЗБОРЫ" },
  ];

  const handleSave = () => {
    const modObj = availableModules.find((m) => m.id === selectedModule) || availableModules[0];
    
    saveCustomAcademyLesson({
      id: `lesson-${rec.id}`,
      moduleId: selectedModule,
      moduleTitle: modObj.title,
      title: lessonTitle.trim() || rec.webinarTitle,
      tag: lessonTag.trim() || "Вебинар",
      recordingId: rec.id,
      videoUrl: `https://academy.ida-psy.ru/?mode=recording&id=${rec.id}`,
      summaryText: includeSummary ? rec.summary?.takeaways?.join("\n\n") : undefined,
      timecodes: rec.summary?.timecodes?.map((tc) => ({
        time: tc.time,
        title: tc.title,
        seconds: 0,
      })),
      createdAt: new Date().toISOString(),
    });

    setSavedSuccess(true);
    setTimeout(() => {
      if (onSuccess) onSuccess();
      onClose();
    }, 1200);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "580px",
          padding: "24px 28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <span style={{ fontSize: "0.8rem", background: "#e0e7ff", color: "#4338ca", padding: "2px 8px", borderRadius: "4px", fontWeight: 700 }}>
              {t("Интеграция с Академией", "Academy Integration")}
            </span>
            <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.25rem", fontWeight: 800, color: "#1e293b" }}>
              🎓 {t("Превратить вебинар в урок курса", "Convert Webinar to Course Lesson")}
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
              {rec.webinarTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "8px",
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
              color: "#64748b",
            }}
          >
            ✕
          </button>
        </div>

        {savedSuccess ? (
          <div style={{ padding: "30px 20px", textAlign: "center", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
            <span style={{ fontSize: "2.5rem" }}>🎉</span>
            <h4 style={{ margin: "10px 0 4px 0", color: "#15803d", fontSize: "1.1rem", fontWeight: 700 }}>
              {t("Урок успешно добавлен в Академию!", "Lesson successfully added to Academy!")}
            </h4>
            <p style={{ margin: 0, color: "#166534", fontSize: "0.85rem" }}>
              {t("Запись, таймкоды и конспект теперь доступны студентам курса.", "Recording, timecodes, and notes are now accessible to students.")}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                📚 {t("В какой модуль курса поместить:", "Target Course Module:")}
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              >
                {availableModules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                🏷️ {t("Название урока:", "Lesson Title:")}
              </label>
              <input
                type="text"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                🔖 {t("Тематический тег / Направление:", "Topic Tag / Direction:")}
              </label>
              <input
                type="text"
                value={lessonTag}
                onChange={(e) => setLessonTag(e.target.value)}
                placeholder="КПТ, Тревожность, Практикум..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <input
                type="checkbox"
                checked={includeSummary}
                onChange={(e) => setIncludeSummary(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.85rem", color: "#334155" }}>
                ✨ <strong>{t("Включить автоматические тезисы и таймкоды", "Include AI summary and timecodes")}</strong>
              </span>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                {t("Отмена", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                🎓 {t("Добавить в курс", "Add to Course")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
