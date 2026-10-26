import React, { useState } from "react";

export interface VideoProtectionSettings {
  isProtected: boolean;
  watermarkEnabled: boolean;
  noDownloadEnabled: boolean;
  singleSessionEnabled: boolean;
}

interface VideoProtectionModalProps {
  title: string;
  initialSettings?: Partial<VideoProtectionSettings>;
  onSave: (settings: VideoProtectionSettings) => void;
  onClose: () => void;
}

export const VideoProtectionModal: React.FC<VideoProtectionModalProps> = ({
  title,
  initialSettings,
  onSave,
  onClose,
}) => {
  const [isProtected, setIsProtected] = useState<boolean>(initialSettings?.isProtected ?? true);
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(initialSettings?.watermarkEnabled ?? true);
  const [noDownloadEnabled, setNoDownloadEnabled] = useState<boolean>(initialSettings?.noDownloadEnabled ?? true);
  const [singleSessionEnabled, setSingleSessionEnabled] = useState<boolean>(initialSettings?.singleSessionEnabled ?? true);

  const handleSave = () => {
    onSave({
      isProtected,
      watermarkEnabled: isProtected ? watermarkEnabled : false,
      noDownloadEnabled: isProtected ? noDownloadEnabled : false,
      singleSessionEnabled: isProtected ? singleSessionEnabled : false,
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
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "680px",
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
            <span style={{ fontSize: "1.4rem" }}>🛡️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.12rem", fontWeight: 700, color: "#0f172a" }}>
                Защита видео от сливов и складчин
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                {title}
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

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* Main Toggle Banner */}
          <div
            style={{
              background: isProtected ? "linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)" : "#f1f5f9",
              border: `1px solid ${isProtected ? "#a7f3d0" : "#cbd5e1"}`,
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: isProtected ? "#065f46" : "#334155" }}>
                {isProtected ? "🟢 Защита видео включена" : "⚪ Защита отключена (обычный просмотр)"}
              </div>
              <div style={{ fontSize: "0.82rem", color: isProtected ? "#047857" : "#64748b", marginTop: "3px" }}>
                {isProtected
                  ? "Видео защищено от несанкционированного копирования, записи экрана и передачи ссылки третьим лицам."
                  : "Видео проигрывается в стандартном плеере без ограничений и водяных знаков."}
              </div>
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
                style={{ width: "22px", height: "22px", cursor: "pointer", accentColor: "#059669" }}
              />
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
                {isProtected ? "ВКЛ" : "ВЫКЛ"}
              </span>
            </label>
          </div>

          {/* Explanation Cards: What is included */}
          <div style={{ marginBottom: "22px" }}>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🔍</span> Что входит в комплексную защиту видео:
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Feature 1: Watermark */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  background: isProtected && watermarkEnabled ? "#f0fdf4" : "#ffffff",
                  display: "flex",
                  gap: "12px",
                }}
              >
                <input
                  type="checkbox"
                  id="chk-watermark"
                  checked={watermarkEnabled}
                  disabled={!isProtected}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                  style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "#059669", cursor: isProtected ? "pointer" : "default" }}
                />
                <label htmlFor="chk-watermark" style={{ cursor: isProtected ? "pointer" : "default", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: "3px" }}>
                    👤 1. Динамический водяной знак (Email и имя зрителя)
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                    Поверх видео каждые 12 секунд плавно перемещается полупрозрачный email или билет студента. Это непреодолимый психологический барьер: участник складчины не осмелится сделать экранную запись и слить её в сеть, так как его личный контакт намертво впечатан в видео.
                  </div>
                </label>
              </div>

              {/* Feature 2: Anti-Download */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  background: isProtected && noDownloadEnabled ? "#f0fdf4" : "#ffffff",
                  display: "flex",
                  gap: "12px",
                }}
              >
                <input
                  type="checkbox"
                  id="chk-nodownload"
                  checked={noDownloadEnabled}
                  disabled={!isProtected}
                  onChange={(e) => setNoDownloadEnabled(e.target.checked)}
                  style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "#059669", cursor: isProtected ? "pointer" : "default" }}
                />
                <label htmlFor="chk-nodownload" style={{ cursor: isProtected ? "pointer" : "default", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: "3px" }}>
                    🚫 2. Блокировка скачивания и инспекции видео
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                    Отключена кнопка скачивания браузера (<code style={{ background: "#f1f5f9", padding: "1px 4px", borderRadius: 4 }}>nodownload</code>), заблокировано контекстное меню правой кнопки мыши на видео и запрещен режим картинки-в-картинке, чтобы исключить перехват видеопотока браузерными расширениями.
                  </div>
                </label>
              </div>

              {/* Feature 3: Single Session */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  background: isProtected && singleSessionEnabled ? "#f0fdf4" : "#ffffff",
                  display: "flex",
                  gap: "12px",
                }}
              >
                <input
                  type="checkbox"
                  id="chk-singlesession"
                  checked={singleSessionEnabled}
                  disabled={!isProtected}
                  onChange={(e) => setSingleSessionEnabled(e.target.checked)}
                  style={{ marginTop: "3px", width: "18px", height: "18px", accentColor: "#059669", cursor: isProtected ? "pointer" : "default" }}
                />
                <label htmlFor="chk-singlesession" style={{ cursor: isProtected ? "pointer" : "default", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: "3px" }}>
                    👥 3. Запрет одновременных сессий (1 активный поток)
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                    Если студент или покупатель передаст свою персональную ссылку коллеге или в складчину, при одновременном просмотре у первого зрителя видео автоматически приостанавливается с уведомлением. Совместный просмотр по одной ссылке невозможен.
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: "0.82rem",
              color: "#1e40af",
              lineHeight: 1.45,
            }}
          >
            💡 <strong>Совет преподавателю:</strong> Защита действует автоматически как в плеере урока для студентов, так и при отдельной продаже записи вебинара. Никаких дополнительных серверов или платных подписок не требуется.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
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
              padding: "9px 18px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: "0.88rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: "9px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#059669",
              color: "#ffffff",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
            }}
          >
            Сохранить настройки защиты
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoProtectionModal;
