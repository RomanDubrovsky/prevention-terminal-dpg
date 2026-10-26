import React, { useState } from "react";
import {
  type CloudRecording,
  type RecordingMonetization,
  generateRecordingShareLink,
} from "../../lib/webinars_store.ts";
import { t } from "../../lib/i18n.ts";

interface RecordingMonetizationModalProps {
  recording: CloudRecording;
  onSave: (monetization: RecordingMonetization) => void;
  onClose: () => void;
  onPreviewPlayer: (recordingId: string) => void;
}

export const RecordingMonetizationModal: React.FC<RecordingMonetizationModalProps> = ({
  recording,
  onSave,
  onClose,
  onPreviewPlayer,
}) => {
  const initial = recording.monetization || {
    isPaid: false,
    priceRub: 1490,
    paymentUrl: "",
    accessDays: 90,
    salesCount: 0,
    watermarkEnabled: true,
    singleSessionEnforced: true,
    customOfferTitle: "",
  };

  const [isPaid, setIsPaid] = useState<boolean>(initial.isPaid);
  const [priceRub, setPriceRub] = useState<number>(initial.priceRub || 1490);
  const [paymentUrl, setPaymentUrl] = useState<string>(initial.paymentUrl || "");
  const [accessDays, setAccessDays] = useState<number>(initial.accessDays ?? 90);
  const [watermarkEnabled, setWatermarkEnabled] = useState<boolean>(initial.watermarkEnabled ?? true);
  const [singleSessionEnforced, setSingleSessionEnforced] = useState<boolean>(
    initial.singleSessionEnforced ?? true
  );
  const [customOfferTitle, setCustomOfferTitle] = useState<string>(
    initial.customOfferTitle || `${recording.webinarTitle} — Запись и материалы`
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const shareLink = generateRecordingShareLink(recording.id);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
      alert(`Ссылка скопирована:\n${shareLink}`);
    }
  };

  const handleSave = () => {
    onSave({
      isPaid,
      priceRub: Number(priceRub) || 0,
      paymentUrl: paymentUrl.trim(),
      accessDays: Number(accessDays) || 0,
      salesCount: initial.salesCount || 0,
      watermarkEnabled,
      singleSessionEnforced,
      customOfferTitle: customOfferTitle.trim(),
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
          maxWidth: "740px",
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
            <span style={{ fontSize: "1.4rem" }}>💰</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#0f172a" }}>
                {t("Платная продажа записи и защита от пиратства", "Paid Recording Sales & Anti-Piracy")}
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                {recording.webinarTitle}
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
              background: isPaid ? "linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)" : "#f1f5f9",
              border: `1px solid ${isPaid ? "#a7f3d0" : "#cbd5e1"}`,
              borderRadius: "12px",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: isPaid ? "#065f46" : "#334155" }}>
                {isPaid ? "🟢 Платный доступ к записи активирован" : "⚪ Бесплатный / внутренний доступ"}
              </div>
              <div style={{ fontSize: "0.82rem", color: isPaid ? "#047857" : "#64748b", marginTop: "3px" }}>
                {isPaid
                  ? "Зрители могут смотреть запись только после подтверждения оплаты или ввода билета."
                  : "Запись открыта для всех, у кого есть ссылка."}
              </div>
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                style={{ width: "20px", height: "20px", cursor: "pointer", accentColor: "#059669" }}
              />
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
                {isPaid ? "Включено" : "Выключено"}
              </span>
            </label>
          </div>

          {/* Pricing & Direct Payment Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "18px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b", marginBottom: "6px" }}>
                {t("Стоимость доступа (₽)", "Access Price (RUB)")}
              </label>
              <input
                type="number"
                value={priceRub}
                disabled={!isPaid}
                onChange={(e) => setPriceRub(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#1e293b",
                  background: isPaid ? "#fff" : "#f8fafc",
                }}
                placeholder="1490"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b", marginBottom: "6px" }}>
                {t("Срок доступа зрителя", "Viewer Access Duration")}
              </label>
              <select
                value={accessDays}
                disabled={!isPaid}
                onChange={(e) => setAccessDays(Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.95rem",
                  color: "#1e293b",
                  background: isPaid ? "#fff" : "#f8fafc",
                }}
              >
                <option value={30}>30 дней с момента покупки</option>
                <option value={90}>90 дней (~3 месяца)</option>
                <option value={180}>180 дней (~полгода)</option>
                <option value={365}>1 год</option>
                <option value={0}>Бессрочный доступ навсегда</option>
              </select>
            </div>
          </div>

          {/* Direct Payment URL (Speaker's own gateway) */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
              {t("Ссылка на оплату (Ваша касса: ЮKassa, Prodamus, Тинькофф, СБП)", "Payment Link (Your Gateway: YooKassa, Prodamus, Tinkoff)")}
            </label>
            <p style={{ margin: "0 0 6px 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
              💡 <strong>Прямая оплата на ваш банк:</strong> Вы сами привязываете ссылку на свой банк или интернет-эквайринг (ЮKassa, Т-Банк, СБП, Prodamus). Платформа IDA не имеет отношения к этим деньгам и не берёт комиссию (0%). Все 100% средств поступают напрямую вам.
            </p>
            <input
              type="url"
              value={paymentUrl}
              disabled={!isPaid}
              onChange={(e) => setPaymentUrl(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                color: "#1e293b",
                background: isPaid ? "#fff" : "#f8fafc",
              }}
              placeholder="https://pay.yookassa.ru/... или ссылка на Prodamus / СБП счет"
            />
          </div>

          {/* Offer Title */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b", marginBottom: "6px" }}>
              {t("Заголовок предложения в окне покупки", "Offer title shown on paywall")}
            </label>
            <input
              type="text"
              value={customOfferTitle}
              disabled={!isPaid}
              onChange={(e) => setCustomOfferTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                color: "#1e293b",
                background: isPaid ? "#fff" : "#f8fafc",
              }}
              placeholder="Чистовая запись вебинара + протоколы и конспект"
            />
          </div>

          {/* Anti-Piracy Protections */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "16px 18px",
              marginBottom: "20px",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🛡️</span> {t("Встроенная защита от пиратства и складчин (уровень Kinescope)", "Built-in Anti-Piracy Protection")}
            </h4>

            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  disabled={!isPaid}
                  onChange={(e) => setWatermarkEnabled(e.target.checked)}
                  style={{ marginTop: "3px", accentColor: "#4f46e5" }}
                />
                <div>
                  <strong style={{ fontSize: "0.85rem", color: "#1e293b" }}>
                    {t("Динамический плавающий водяной знак (Email покупателя)", "Dynamic floating watermark (Buyer Email)")}
                  </strong>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Поверх видео плавно перемещается полупрозрачный email покупателя. Никто не выложит экранную запись в открытый доступ, опасаясь блокировки.
                  </div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={singleSessionEnforced}
                  disabled={!isPaid}
                  onChange={(e) => setSingleSessionEnforced(e.target.checked)}
                  style={{ marginTop: "3px", accentColor: "#4f46e5" }}
                />
                <div>
                  <strong style={{ fontSize: "0.85rem", color: "#1e293b" }}>
                    {t("Запрет одновременных просмотров (1 поток на билет)", "Single concurrent session (1 stream per ticket)")}
                  </strong>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Если покупатель перешлет свою ссылку коллеге, при входе второго зрителя видео у первого тут же встанет на паузу. Складчина невозможна.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Sales Link & Preview */}
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e3a8a" }}>
                🔗 {t("Персональная ссылка на продающую страницу записи:", "Recording sales & viewer link:")}
              </div>
              <button
                type="button"
                onClick={() => onPreviewPlayer(recording.id)}
                style={{
                  background: "#fff",
                  color: "#1e40af",
                  border: "1px solid #93c5fd",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                👁️ Открыть плеер зрителя
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                readOnly
                value={shareLink}
                style={{
                  flex: 1,
                  background: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "0.82rem",
                  color: "#334155",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                style={{
                  background: copiedLink ? "#10b981" : "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {copiedLink ? "✓ Скопировано!" : "📋 Скопировать"}
              </button>
            </div>

            {initial.salesCount ? (
              <div style={{ marginTop: "10px", fontSize: "0.8rem", color: "#1e40af", fontWeight: 600 }}>
                📊 Уже оплачено: {initial.salesCount} покупок (выручка автора: ~{(initial.salesCount * priceRub).toLocaleString("ru-RU")} ₽)
              </div>
            ) : null}
          </div>
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
            onClick={handleSave}
            style={{
              background: "#059669",
              border: "none",
              padding: "9px 22px",
              borderRadius: "8px",
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
            }}
          >
            {t("💾 Сохранить настройки продаж", "💾 Save Monetization Settings")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingMonetizationModal;
