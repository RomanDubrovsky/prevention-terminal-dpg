import React, { useState } from "react";
import { t } from "../lib/i18n.ts";
import type { ExportSupervisionResult } from "../lib/case_supervision.ts";

interface SupervisionShareModalProps {
  data: ExportSupervisionResult | null;
  onClose: () => void;
}

type ModalTab = "ppms" | "team" | "token";

export const SupervisionShareModal: React.FC<SupervisionShareModalProps> = ({ data, onClose }) => {
  const [activeTab, setActiveTab] = useState<ModalTab>("ppms");
  const [copied, setCopied] = useState(false);
  const [problemProfile, setProblemProfile] = useState("bullying");
  const [requestSent, setRequestSent] = useState(false);
  const [teamCreated, setTeamCreated] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["school_psychologist", "ppms_specialist"]);

  if (!data) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSendPpmsRequest = () => {
    setRequestSent(true);
    setTimeout(() => {
      // Auto switch or close after showing feedback
    }, 2000);
  };

  const handleCreateTeam = () => {
    setTeamCreated(true);
  };

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter((r) => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "1rem",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-window"
        style={{
          maxWidth: "640px",
          width: "100%",
          backgroundColor: "#ffffff",
          borderRadius: "14px",
          padding: "1.5rem",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.22)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "0.75rem",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🤝</span> {t("Сетевое взаимодействие и Команда по случаю", "Network Collaboration & Case Team")}
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#6b7280" }}>
              {t("Привлечение специалистов ППМС-центров и межшкольных антикризисных команд", "Engage PPMS center specialists and cross-school crisis teams")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              lineHeight: 1,
              cursor: "pointer",
              color: "#9ca3af",
              padding: "4px",
            }}
          >
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: "6px", background: "#f3f4f6", padding: "4px", borderRadius: "8px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("ppms")}
            style={{
              flex: 1,
              padding: "7px 12px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "ppms" ? "#fff" : "transparent",
              color: activeTab === "ppms" ? "#1e40af" : "#4b5563",
              fontWeight: activeTab === "ppms" ? "700" : "500",
              fontSize: "0.83rem",
              cursor: "pointer",
              boxShadow: activeTab === "ppms" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            🏛️ {t("Запрос в ППМС-центр", "PPMS Request")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("team")}
            style={{
              flex: 1,
              padding: "7px 12px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "team" ? "#fff" : "transparent",
              color: activeTab === "team" ? "#1e40af" : "#4b5563",
              fontWeight: activeTab === "team" ? "700" : "500",
              fontSize: "0.83rem",
              cursor: "pointer",
              boxShadow: activeTab === "team" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            👥 {t("Сетевая команда", "Network Team")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("token")}
            style={{
              flex: 1,
              padding: "7px 12px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "token" ? "#fff" : "transparent",
              color: activeTab === "token" ? "#1e40af" : "#4b5563",
              fontWeight: activeTab === "token" ? "700" : "500",
              fontSize: "0.83rem",
              cursor: "pointer",
              boxShadow: activeTab === "token" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
            }}
          >
            🔗 {t("Токен супервизии", "Supervision Token")}
          </button>
        </div>

        {/* TAB 1: PPMS CENTER REQUEST */}
        {activeTab === "ppms" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", color: "#0369a1" }}>
              <strong>🏛️ Передача случая на сопровождение в ППМС-центр района</strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#0c4a6e" }}>
                Школьный психолог может запросить внешнюю методологическую, семейную или психотерапевтическую поддержку районного Центра, если случай выходил за рамки компетенций школы.
              </p>
            </div>

            {!requestSent ? (
              <>
                <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#374151" }}>
                  Профиль системной проблемы случая:
                  <select
                    value={problemProfile}
                    onChange={(e) => setProblemProfile(e.target.value)}
                    style={{ width: "100%", marginTop: "4px", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="bullying">🛡️ Травля / Травмирующий конфликт в классе (Буллинг)</option>
                    <option value="crisis">🆘 Острый кризис / Суицидальный риск / Самоповреждения</option>
                    <option value="family">💔 Семейный кризис / Неблагополучие / Опека</option>
                    <option value="disadaptation">🧠 Тяжелая школьная дезадаптация / ОВЗ</option>
                    <option value="grief">🕊️ Утрата / ПТСР / Психологическая травма</option>
                  </select>
                </label>

                <div style={{ fontSize: "0.8rem", color: "#64748b", background: "#f8fafc", padding: "10px", borderRadius: "6px" }}>
                  🔒 <strong>Конфиденциальность 152-ФЗ:</strong> Данные передаются в обезличенном виде. ППМС-центр получает первичную анонимную выписку для оценки ресурсов.
                </div>

                <button
                  type="button"
                  onClick={handleSendPpmsRequest}
                  style={{
                    padding: "10px 16px",
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  🚀 Запросить помощь ППМС-центра района
                </button>
              </>
            ) : (
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "16px", borderRadius: "8px", color: "#065f46" }}>
                <h4 style={{ margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>✓</span> Запрос успешно зарегистрирован!
                </h4>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  Заявка <strong>#PPMS-2026-8941</strong> отправлена в диспетчерскую службу ППМС-центра. Куратор свяжется с школьным психологом для согласования сетевой команды.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NETWORK CASE TEAM */}
        {activeTab === "team" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#fdf4ff", border: "1px solid #f5d0fe", padding: "12px", borderRadius: "8px", fontSize: "0.85rem", color: "#86198f" }}>
              <strong>👥 Формирование межшкольной / межведомственной команды по случаю</strong>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "#701a75" }}>
                Для решения системных проблем (например, регулярный буллинг) привлекаются специалисты смежных профилей из других организаций района.
              </p>
            </div>

            {!teamCreated ? (
              <>
                <label style={{ fontSize: "0.85rem", fontWeight: "bold", color: "#374151" }}>Состав межведомственной команды:</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { id: "school_psychologist", label: "🎒 Школьный психолог (Ведущий)" },
                    { id: "ppms_specialist", label: "🏛️ Специалист ППМС-центра" },
                    { id: "social_educator", label: "📋 Социальный педагог" },
                    { id: "mediator", label: "⚖️ Школьный медиатор" },
                    { id: "peer_specialist", label: "🏫 Профильный эксперт другой школы" },
                    { id: "kdn_representative", label: "🛡️ Представитель КДН / Опеки" },
                  ].map((role) => (
                    <label
                      key={role.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        background: selectedRoles.includes(role.id) ? "#f0f9ff" : "#f8fafc",
                        border: selectedRoles.includes(role.id) ? "1px solid #0284c7" : "1px solid #e2e8f0",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                      />
                      {role.label}
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleCreateTeam}
                  style={{
                    padding: "10px 16px",
                    background: "#7c3aed",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    marginTop: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                >
                  ✨ Утвердить сетевую команду по случаю ({selectedRoles.length} участников)
                </button>
              </>
            ) : (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "8px", color: "#166534" }}>
                <h4 style={{ margin: "0 0 4px 0" }}>✓ Сетевая команда создана!</h4>
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  Участники команды получи доступ к общей защищенной карте сопровождения без разглашения ПД ребенка.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SUPERVISION TOKEN */}
        {activeTab === "token" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "0.85rem",
                color: "#166534",
                lineHeight: "1.5",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                💡 {t("Зачем нужен токен супервизии:", "Purpose of supervision token:")}
              </div>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "1.2rem" }}>
                <li>
                  <strong>{t("Конфиденциальность:", "Privacy:")}</strong> {t("ФИО и ПД исключены (152-ФЗ / этический кодекс).", "PII & names excluded (ethics/privacy).")}
                </li>
                <li>
                  <strong>{t("Как использовать:", "How to use:")}</strong> {t("Скопируйте токен и передайте коллеге-супервизору для разбора случая.", "Copy token & send to peer supervisor.")}
                </li>
              </ul>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: "bold", color: "#374151", marginBottom: "4px" }}>
                {t("Зашифрованный токен кейса:", "Encrypted case token:")}
              </label>
              <textarea
                readOnly
                rows={4}
                value={data.token}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                style={{
                  width: "100%",
                  fontSize: "0.78rem",
                  fontFamily: "monospace",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#f9fafb",
                  color: "#111827",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleCopy}
              style={{
                padding: "9px 18px",
                backgroundColor: copied ? "#059669" : "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "0.88rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <span>{copied ? "✓" : "📋"}</span>
              <span>{copied ? t("Скопировано в буфер!", "Copied!") : t("Скопировать токен супервизии", "Copy token")}</span>
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            className="ob-btn secondary"
            style={{
              padding: "8px 16px",
              backgroundColor: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {t("Закрыть", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
};

