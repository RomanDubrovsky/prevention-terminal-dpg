import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  type CloudRecording,
  type VideoTrimSettings,
  type VideoCutInterval,
  calculateCleanDurationMinutes,
} from "../../lib/webinars_store.ts";
import { t } from "../../lib/i18n.ts";

interface VideoSmartTrimModalProps {
  recording: CloudRecording;
  onSave: (trimSettings: VideoTrimSettings) => void;
  onClose: () => void;
}

function formatSeconds(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

function parseMinutesSeconds(val: string): number {
  if (!val.includes(":")) {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : Math.max(0, Math.floor(num * 60));
  }
  const parts = val.split(":");
  const m = parseInt(parts[0], 10) || 0;
  const s = parseInt(parts[1], 10) || 0;
  return Math.max(0, m * 60 + s);
}

export const VideoSmartTrimModal: React.FC<VideoSmartTrimModalProps> = ({
  recording,
  onSave,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const totalSeconds = (recording.durationMinutes || 90) * 60;

  const initialTrim = recording.trimSettings || {
    trimStartSeconds: 0,
    trimEndSeconds: totalSeconds,
    cutIntervals: [],
  };

  const [trimStart, setTrimStart] = useState<number>(initialTrim.trimStartSeconds || 0);
  const [trimEnd, setTrimEnd] = useState<number>(
    initialTrim.trimEndSeconds && initialTrim.trimEndSeconds > 0
      ? initialTrim.trimEndSeconds
      : totalSeconds
  );
  const [cutIntervals, setCutIntervals] = useState<VideoCutInterval[]>(
    initialTrim.cutIntervals || []
  );

  const [currentTime, setCurrentTime] = useState<number>(trimStart);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [previewCleanMode, setPreviewCleanMode] = useState<boolean>(true);
  const [downloadingClean, setDownloadingClean] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // New cut interval inputs
  const [newCutStart, setNewCutStart] = useState<string>("45:00");
  const [newCutEnd, setNewCutEnd] = useState<string>("60:00");
  const [newCutLabel, setNewCutLabel] = useState<string>("Кофе-брейк 15 мин");

  // Track video playback and auto-skip cut intervals
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const cur = video.currentTime;
      setCurrentTime(cur);

      if (previewCleanMode) {
        // 1. If before trimStart, jump to trimStart
        if (cur < trimStart) {
          video.currentTime = trimStart;
          return;
        }
        // 2. If past trimEnd, pause
        if (cur >= trimEnd) {
          video.pause();
          setIsPlaying(false);
          video.currentTime = trimEnd;
          return;
        }
        // 3. If inside a cut interval, jump to interval end
        for (const cut of cutIntervals) {
          if (cur >= cut.startSeconds && cur < cut.endSeconds) {
            video.currentTime = cut.endSeconds;
            break;
          }
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [trimStart, trimEnd, cutIntervals, previewCleanMode]);

  const cleanDurationMinutes = useMemo(() => {
    return calculateCleanDurationMinutes(recording.durationMinutes, {
      trimStartSeconds: trimStart,
      trimEndSeconds: trimEnd,
      cutIntervals,
    });
  }, [recording.durationMinutes, trimStart, trimEnd, cutIntervals]);

  const savedMinutes = recording.durationMinutes - cleanDurationMinutes;

  const handleSeek = (newSec: number) => {
    const bounded = Math.max(0, Math.min(newSec, totalSeconds));
    setCurrentTime(bounded);
    if (videoRef.current) {
      videoRef.current.currentTime = bounded;
    }
  };

  const handleSetStartHere = () => {
    const rounded = Math.floor(currentTime);
    if (rounded < trimEnd) {
      setTrimStart(rounded);
    }
  };

  const handleSetEndHere = () => {
    const rounded = Math.floor(currentTime);
    if (rounded > trimStart) {
      setTrimEnd(rounded);
    }
  };

  const handleAddCutInterval = () => {
    const s = parseMinutesSeconds(newCutStart);
    const e = parseMinutesSeconds(newCutEnd);
    if (e <= s) {
      alert("Время окончания паузы должно быть больше времени начала!");
      return;
    }
    const newCut: VideoCutInterval = {
      id: `cut-${Date.now().toString(36)}`,
      startSeconds: s,
      endSeconds: e,
      label: newCutLabel.trim() || t("Пауза / Перерыв", "Pause / Break"),
    };
    setCutIntervals([...cutIntervals, newCut]);
  };

  const handleRemoveCut = (id: string) => {
    setCutIntervals(cutIntervals.filter((c) => c.id !== id));
  };

  const handleSimulateCleanDownload = () => {
    setDownloadingClean(true);
    setDownloadSuccess(null);
    setTimeout(() => {
      setDownloadingClean(false);
      setDownloadSuccess(
        `Готово! Чистовой файл "${recording.webinarTitle.slice(0, 30)}_clean.mp4" сформирован за 2.4 сек (без перекодирования) и готов к сохранению.`
      );
    }, 1800);
  };

  const handleSaveTrim = () => {
    onSave({
      trimStartSeconds: trimStart,
      trimEndSeconds: trimEnd,
      cutIntervals,
      cleanDurationMinutes,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "880px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "1.4rem" }}>✂️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                {t("Умный монтаж и вырезание пауз", "Smart Trim & Cut Pauses")}
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                {recording.webinarTitle} • {t("Исходная длина:", "Raw duration:")} {recording.durationMinutes} {t("мин", "min")} ({recording.fileSizeMb} {t("МБ", "MB")})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "1.3rem",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* Video Preview Player */}
          <div
            style={{
              background: "#090d16",
              borderRadius: "12px",
              overflow: "hidden",
              marginBottom: "16px",
              position: "relative",
              aspectRatio: "16/9",
              maxHeight: "340px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={videoRef}
              src={recording.videoUrl}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              controls={false}
              playsInline
            />

            {/* Overlays / Watermark Preview */}
            <div
              style={{
                position: "absolute",
                top: "12px",
                left: "14px",
                background: "rgba(0,0,0,0.65)",
                color: "#e2e8f0",
                fontSize: "0.75rem",
                padding: "4px 10px",
                borderRadius: "6px",
                fontFamily: "monospace",
              }}
            >
              ⏱️ {formatSeconds(currentTime)} / {formatSeconds(totalSeconds)}
              {previewCleanMode && (
                <span style={{ marginLeft: "8px", color: "#34d399", fontWeight: 600 }}>
                  [Чистовой предпросмотр активен]
                </span>
              )}
            </div>

            {/* Play/Pause Center Button if paused */}
            {!isPlaying && (
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.play();
                    setIsPlaying(true);
                  }
                }}
                style={{
                  position: "absolute",
                  background: "rgba(79, 70, 229, 0.9)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "56px",
                  height: "56px",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
                }}
              >
                ▶
              </button>
            )}
          </div>

          {/* Interactive Visual Timeline Bar */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#64748b", marginBottom: "6px" }}>
              <span>00:00 (Старт записи)</span>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>
                Текущий момент: <strong style={{ color: "#4f46e5" }}>{formatSeconds(currentTime)}</strong>
              </span>
              <span>{formatSeconds(totalSeconds)} (Конец)</span>
            </div>

            {/* Range Track */}
            <div
              style={{
                position: "relative",
                height: "28px",
                background: "#e2e8f0",
                borderRadius: "8px",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percent = Math.max(0, Math.min(1, clickX / rect.width));
                handleSeek(percent * totalSeconds);
              }}
            >
              {/* Green active broadcast region */}
              <div
                style={{
                  position: "absolute",
                  left: `${(trimStart / totalSeconds) * 100}%`,
                  width: `${((trimEnd - trimStart) / totalSeconds) * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
                  opacity: 0.85,
                }}
              />

              {/* Red Cut/Paused intervals */}
              {cutIntervals.map((cut) => {
                const left = (cut.startSeconds / totalSeconds) * 100;
                const width = ((cut.endSeconds - cut.startSeconds) / totalSeconds) * 100;
                return (
                  <div
                    key={cut.id}
                    title={`${cut.label || "Вырезано"}: ${formatSeconds(cut.startSeconds)} - ${formatSeconds(cut.endSeconds)}`}
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      width: `${width}%`,
                      height: "100%",
                      background: "repeating-linear-gradient(45deg, #ef4444, #ef4444 6px, #b91c1c 6px, #b91c1c 12px)",
                      zIndex: 2,
                    }}
                  />
                );
              })}

              {/* Current Playhead */}
              <div
                style={{
                  position: "absolute",
                  left: `${(currentTime / totalSeconds) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: "3px",
                  background: "#1e1b4b",
                  zIndex: 3,
                  boxShadow: "0 0 6px rgba(0,0,0,0.6)",
                }}
              />
            </div>

            {/* Quick Trim Buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleSetStartHere}
                  style={{
                    background: "#ecfdf5",
                    color: "#065f46",
                    border: "1px solid #a7f3d0",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🟢 Задать как Начало эфира ({formatSeconds(currentTime)})
                </button>

                <button
                  type="button"
                  onClick={handleSetEndHere}
                  style={{
                    background: "#fef2f2",
                    color: "#991b1b",
                    border: "1px solid #fecaca",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🔴 Задать как Конец эфира ({formatSeconds(currentTime)})
                </button>
              </div>

              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", color: "#334155", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={previewCleanMode}
                  onChange={(e) => setPreviewCleanMode(e.target.checked)}
                />
                <strong>{t("Пропускать паузы при предпросмотре", "Skip cut intervals on preview")}</strong>
              </label>
            </div>
          </div>

          {/* Cuts Management & Mid-roll breaks */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>☕</span> {t("Вырезать паузы и перерывы в середине (кофе-брейк, ожидание)", "Cut middle pauses & coffee-breaks")}
            </h4>

            {/* List of active cuts */}
            {cutIntervals.length === 0 ? (
              <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#64748b" }}>
                {t("Пауз внутри пока не добавлено. Вся середина эфира останется без изменений.", "No mid-cuts yet. Everything between start and end will play continuously.")}
              </p>
            ) : (
              <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
                {cutIntervals.map((cut) => (
                  <div
                    key={cut.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #fed7aa",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#c2410c" }}>✂️ {cut.label}</strong>: {formatSeconds(cut.startSeconds)} ➔ {formatSeconds(cut.endSeconds)} (
                      {Math.round((cut.endSeconds - cut.startSeconds) / 60)} мин)
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCut(cut.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Cut Form */}
            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Начало паузы</label>
                <input
                  type="text"
                  value={newCutStart}
                  onChange={(e) => setNewCutStart(e.target.value)}
                  style={{ width: "90px", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  placeholder="ММ:СС"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Конец паузы</label>
                <input
                  type="text"
                  value={newCutEnd}
                  onChange={(e) => setNewCutEnd(e.target.value)}
                  style={{ width: "90px", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  placeholder="ММ:СС"
                />
              </div>

              <div style={{ flex: 1, minWidth: "160px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginBottom: "2px" }}>Название</label>
                <input
                  type="text"
                  value={newCutLabel}
                  onChange={(e) => setNewCutLabel(e.target.value)}
                  style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                  placeholder="Кофе-брейк, техническая пауза..."
                />
              </div>

              <button
                type="button"
                onClick={handleAddCutInterval}
                style={{
                  alignSelf: "flex-end",
                  background: "#4f46e5",
                  color: "#fff",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                + Добавить вырезку
              </button>
            </div>
          </div>

          {/* Economics & Saved Time Metric */}
          <div
            style={{
              background: "linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)",
              border: "1px solid #bbf7d0",
              borderRadius: "12px",
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.8rem", color: "#166534", fontWeight: 600 }}>
                ✨ {t("Итоговый хронометраж чистовой версии:", "Clean version duration:")}
              </div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#14532d", marginTop: "2px" }}>
                {cleanDurationMinutes} {t("мин", "min")}
                {savedMinutes > 0 && (
                  <span style={{ fontSize: "0.85rem", color: "#15803d", fontWeight: 600, marginLeft: "8px" }}>
                    (вырезано {savedMinutes} мин пауз и ожидания)
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSimulateCleanDownload}
              disabled={downloadingClean}
              style={{
                background: "#059669",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: downloadingClean ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 4px rgba(5, 150, 105, 0.25)",
              }}
            >
              {downloadingClean ? "⏳ Формирование MP4..." : "⬇️ Скачать чистовой MP4 (-c copy)"}
            </button>
          </div>

          {downloadSuccess && (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                color: "#1e40af",
                padding: "10px 14px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                marginBottom: "16px",
              }}
            >
              ✓ {downloadSuccess}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            background: "#f8fafc",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#fff",
              border: "1px solid #cbd5e1",
              padding: "9px 18px",
              borderRadius: "8px",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#475569",
              cursor: "pointer",
            }}
          >
            {t("Отмена", "Cancel")}
          </button>

          <button
            type="button"
            onClick={handleSaveTrim}
            style={{
              background: "#4f46e5",
              border: "none",
              padding: "9px 22px",
              borderRadius: "8px",
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)",
            }}
          >
            {t("💾 Сохранить чистовую версию", "💾 Save Clean Version")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoSmartTrimModal;
