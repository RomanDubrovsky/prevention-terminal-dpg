import React, { useState } from "react";
import { saveCustomAcademyLesson, type AcademyCustomLesson } from "../../lib/academy_store.ts";
import type { CloudRecording } from "../../lib/webinars_store.ts";

interface LessonConstructorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  recordings: CloudRecording[];
  existingLesson?: AcademyCustomLesson | null;
}

export const LessonConstructorModal: React.FC<LessonConstructorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  recordings,
  existingLesson,
}) => {
  const [moduleId, setModuleId] = useState<string | number>(existingLesson?.moduleId || 1);
  const [moduleTitle, setModuleTitle] = useState(existingLesson?.moduleTitle || "Модуль 1: Базовые навыки и контакт");
  const [title, setTitle] = useState(existingLesson?.title || "");
  const [tag, setTag] = useState(existingLesson?.tag || "КПТ");
  const [selectedRecordingId, setSelectedRecordingId] = useState(existingLesson?.recordingId || "");
  const [videoUrl, setVideoUrl] = useState(existingLesson?.videoUrl || "");
  const [summaryText, setSummaryText] = useState(existingLesson?.summaryText || "");
  const [materialName, setMaterialName] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [homeworkTask, setHomeworkTask] = useState(existingLesson?.homeworkTask || "");
  const [isStopLesson, setIsStopLesson] = useState(existingLesson?.isStopLesson || false);

  if (!isOpen) return null;

  const handleSelectRecording = (recId: string) => {
    setSelectedRecordingId(recId);
    const rec = recordings.find((r) => r.id === recId);
    if (rec) {
      if (!title) setTitle(rec.webinarTitle);
      if (rec.videoUrl) setVideoUrl(rec.videoUrl);
      if (rec.aiSummary?.overview && !summaryText) {
        setSummaryText(rec.aiSummary.overview);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const materials = existingLesson?.materials ? [...existingLesson.materials] : [];
    if (materialName.trim() && materialUrl.trim()) {
      materials.push({ name: materialName.trim(), url: materialUrl.trim(), size: "PDF" });
    }

    const lesson: AcademyCustomLesson = {
      id: existingLesson?.id || "custom-lesson-" + Date.now(),
      moduleId,
      moduleTitle,
      title: title.trim(),
      tag: tag.trim(),
      videoUrl: videoUrl.trim() || undefined,
      recordingId: selectedRecordingId || undefined,
      summaryText: summaryText.trim() || undefined,
      homeworkTask: homeworkTask.trim() || undefined,
      isStopLesson,
      materials: materials.length > 0 ? materials : undefined,
      createdAt: existingLesson?.createdAt || new Date().toISOString(),
    };

    saveCustomAcademyLesson(lesson);
    onSuccess();
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "760px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
              {existingLesson ? "✏️ Редактирование урока" : "➕ Конструктор урока курса"}
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
              Привязка видеозаписи, методических материалов, ДЗ и стоп-урока
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748b",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              fontSize: "1.1rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Модуль курса *
              </label>
              <select
                value={moduleId}
                onChange={(e) => {
                  setModuleId(e.target.value);
                  const titles: Record<string, string> = {
                    "0": "Модуль 0: Знакомство и регламент",
                    "1": "Модуль 1: Базовые навыки и контакт",
                    "2": "Модуль 2: Когнитивно-поведенческая терапия",
                    "3": "Модуль 3: Эмоционально-фокусированная терапия",
                    "4": "Модуль 4: Травма и протоколы ДПДГ",
                    "5": "Модуль 5: Супервизии и практика",
                  };
                  setModuleTitle(titles[e.target.value] || `Модуль ${e.target.value}`);
                }}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value="0">Модуль 0: Введение</option>
                <option value="1">Модуль 1: Базовые навыки</option>
                <option value="2">Модуль 2: КПТ</option>
                <option value="3">Модуль 3: ЭФТ</option>
                <option value="4">Модуль 4: Травма и ДПДГ</option>
                <option value="5">Модуль 5: Супервизии</option>
                <option value="custom">Авторский спецкурс</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                Название урока *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Протокол работы с острым стрессом и заземление"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>

          {/* Video Attachment from S3 */}
          <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
              🎬 Видеозапись урока (из облачного видеохостинга):
            </label>
            {recordings.length > 0 ? (
              <select
                value={selectedRecordingId}
                onChange={(e) => handleSelectRecording(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", marginBottom: "8px" }}
              >
                <option value="">-- Выбрать готовую запись вебинара из S3 --</option>
                {recordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.webinarTitle} ({r.durationMinutes} мин, {new Date(r.recordedAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Или вставьте прямую ссылку на видео HLS / MP4..."
              style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
            />
          </div>

          {/* Lesson Content / Summary */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              📖 Конспект и текст занятия для студентов:
            </label>
            <textarea
              rows={4}
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              placeholder="Ключевые тезисы, пошаговые алгоритмы, правила проведения интервенции..."
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.85rem", boxSizing: "border-box" }}
            />
          </div>

          {/* Attached Materials */}
          <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
              📎 Прикрепить раздаточные материалы / презентацию:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <input
                type="text"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="Название файла (напр. 'Шпаргалка по КПТ.pdf')"
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              />
              <input
                type="text"
                value={materialUrl}
                onChange={(e) => setMaterialUrl(e.target.value)}
                placeholder="Ссылка на файл для скачивания (URL)"
                style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
              />
            </div>
          </div>

          {/* Homework and Stop-lesson */}
          <div style={{ background: "#eff6ff", padding: "16px", borderRadius: "10px", border: "1px solid #bfdbfe", marginBottom: "20px" }}>
            <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#1e40af", marginBottom: "8px" }}>
              📝 Домашнее задание и контроль прохождения
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#1e3a8a", marginBottom: "4px" }}>
                Формулировка задания для студента:
              </label>
              <textarea
                rows={3}
                value={homeworkTask}
                onChange={(e) => setHomeworkTask(e.target.value)}
                placeholder="Например: Заполните протокол СМЭР для учебного кейса или составьте план первой сессии..."
                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #93c5fd", fontSize: "0.85rem", boxSizing: "border-box" }}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.85rem", color: "#1e3a8a", fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={isStopLesson}
                onChange={(e) => setIsStopLesson(e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              🔒 Сделать стоп-уроком (студент не может перейти к следующему уроку без сдачи и принятия этого ДЗ)
            </label>
          </div>

          {/* Footer actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "#f1f5f9", border: "none", padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
            >
              Отмена
            </button>
            <button
              type="submit"
              style={{
                background: "#4f46e5",
                color: "#fff",
                border: "none",
                padding: "8px 24px",
                borderRadius: "6px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(79, 70, 229, 0.25)",
              }}
            >
              💾 Сохранить урок
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
