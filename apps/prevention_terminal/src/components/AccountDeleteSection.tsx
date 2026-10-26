import React, { useState } from "react";
import { t } from "../lib/i18n.ts";
import { platformApiBase } from "../lib/platform_api.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";

interface AccountDeleteSectionProps {
  terminalConfig?: TerminalConfig;
  terminalUserId?: string;
  specialistName?: string;
}

export default function AccountDeleteSection({
  terminalConfig,
  terminalUserId,
  specialistName,
}: AccountDeleteSectionProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleExportBackup = () => {
    try {
      const dump: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          dump[key] = localStorage.getItem(key) || "";
        }
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `prevention_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Backup export error:", e);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirmed) return;

    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(t("Удаляем данные и анкету…", "Deleting data and profile…"));

    try {
      const centerId = terminalConfig?.organization_id;
      const setupToken = terminalConfig?.terminal_api_key;
      const effectiveUserId = terminalUserId || terminalConfig?.terminal_user_id;

      // 1. Попытка удалить серверную анкету специалиста, если она была зарегистрирована
      if (centerId && setupToken) {
        try {
          // Ищем профили специалиста в этом центре для удаления
          const listRes = await fetch(
            `${platformApiBase()}/api/ida/centers/${centerId}/specialists?setup_token=${setupToken}`,
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            const specs: Array<{ specialist_id: string; display_name: string }> =
              listData.specialists || [];

            for (const sp of specs) {
              if (
                sp.specialist_id === effectiveUserId ||
                (specialistName && sp.display_name === specialistName) ||
                specs.length === 1
              ) {
                await fetch(
                  `${platformApiBase()}/api/ida/centers/${centerId}/specialists/${sp.specialist_id}?setup_token=${setupToken}`,
                  { method: "DELETE" },
                );
              }
            }
          }
        } catch (serverErr) {
          console.warn("Could not delete server specialist profile:", serverErr);
        }
      }

      // 2. Очистка баз данных IndexedDB (если использовались)
      if (typeof window !== "undefined" && "indexedDB" in window && window.indexedDB.databases) {
        try {
          const dbs = await window.indexedDB.databases();
          for (const db of dbs) {
            if (db.name) {
              window.indexedDB.deleteDatabase(db.name);
            }
          }
        } catch {
          // Игнорируем ошибки неподдерживаемых API
        }
      }

      // 3. Полная очистка локальных хранилищ браузера
      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.clear();
      }

      setStatusMsg(
        t(
          "Аккаунт и все данные успешно удалены. Перенаправляем…",
          "Account and all data successfully deleted. Redirecting…",
        ),
      );
      setDone(true);

      // 4. Перезагрузка на чистую стартовую страницу
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = window.location.origin + window.location.pathname;
        }
      }, 1500);
    } catch (err) {
      console.error("Account deletion failed:", err);
      setErrorMsg(
        t(
          "Произошла ошибка при удалении части данных. Локальные данные очищены.",
          "An error occurred while deleting part of data. Local storage cleared.",
        ),
      );
      setBusy(false);
    }
  };

  return (
    <div className="account-delete-container" style={{ maxWidth: "720px", padding: "8px 0" }}>
      <div
        className="card danger-card"
        style={{
          border: "1px solid #fca5a5",
          background: "rgba(254, 242, 242, 0.6)",
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <span style={{ fontSize: "28px" }}>⚠️</span>
          <div>
            <h3 style={{ margin: 0, color: "#991b1b", fontSize: "18px", fontWeight: 600 }}>
              {t("Удаление аккаунта и всех данных", "Delete Account and All Data")}
            </h3>
            <p style={{ margin: "4px 0 0", color: "#7f1d1d", fontSize: "13px" }}>
              {t(
                "Полная очистка локального рабочего места и отзыв серверных данных (152-ФЗ / GDPR).",
                "Full local workspace wipe and server data revocation (152-FZ / GDPR compliant).",
              )}
            </p>
          </div>
        </div>

        <div style={{ color: "#374151", fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
          <p style={{ fontWeight: 600, marginBottom: "8px" }}>
            {t("Что произойдёт при подтверждении:", "What will happen upon confirmation:")}
          </p>
          <ul style={{ paddingLeft: "20px", margin: "0 0 16px 0" }}>
            <li style={{ marginBottom: "6px" }}>
              <strong>{t("Локальные записи:", "Local records:")}</strong>{" "}
              {t(
                "Все карточки клиентов, протоколы консультаций, журналы приёма и локальные настройки на этом устройстве будут безвозвратно стёрты.",
                "All client cards, consultation protocols, journals and local settings on this device will be permanently erased.",
              )}
            </li>
            <li style={{ marginBottom: "6px" }}>
              <strong>{t("Публичная анкета специалиста:", "Specialist public profile:")}</strong>{" "}
              {t(
                "Если ваша анкета была зарегистрирована или опубликована в каталоге, она будет удалена с серверов платформы.",
                "If your profile was registered or published in the catalog, it will be deleted from platform servers.",
              )}
            </li>
            <li>
              <strong>{t("Сессии и ключи:", "Sessions and keys:")}</strong>{" "}
              {t(
                "Все сессионные токены, локальные ключи и привязки будут аннулированы.",
                "All session tokens, local keys and bindings will be revoked.",
              )}
            </li>
          </ul>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px", color: "#111827" }}>
                {t("Сохранить копию перед удалением", "Save a backup before deleting")}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                {t(
                  "Вы можете скачать резервный архив ваших данных на компьютер.",
                  "You can download a backup archive of your data to your computer.",
                )}
              </div>
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={handleExportBackup}
              disabled={busy || done}
              style={{
                fontSize: "13px",
                padding: "6px 14px",
                whiteSpace: "nowrap",
                cursor: "pointer",
                borderRadius: "6px",
              }}
            >
              📥 {t("Скачать архив", "Download backup")}
            </button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #fecaca", paddingTop: "16px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              cursor: busy || done ? "default" : "pointer",
              userSelect: "none",
              marginBottom: "16px",
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy || done}
              onChange={(e) => setConfirmed(e.target.checked)}
              style={{ marginTop: "3px", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "13px", color: "#991b1b", fontWeight: 500 }}>
              {t(
                "Я подтверждаю, что хочу безвозвратно удалить свой аккаунт, анкету и все связанные данные без возможности восстановления.",
                "I confirm that I want to permanently delete my account, profile, and all associated data without the possibility of recovery.",
              )}
            </span>
          </label>

          {errorMsg && (
            <div
              style={{
                background: "#fee2e2",
                color: "#b91c1c",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              {errorMsg}
            </div>
          )}

          {statusMsg && (
            <div
              style={{
                background: "#f0fdf4",
                color: "#15803d",
                padding: "10px 14px",
                borderRadius: "6px",
                fontSize: "13px",
                marginBottom: "14px",
                fontWeight: 500,
              }}
            >
              {statusMsg}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleDeleteAccount()}
            disabled={!confirmed || busy || done}
            style={{
              background: confirmed && !busy && !done ? "#dc2626" : "#fca5a5",
              color: "#ffffff",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: confirmed && !busy && !done ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              transition: "background 0.2s ease",
            }}
          >
            {busy ? (
              <>⏳ {t("Удаление…", "Deleting…")}</>
            ) : done ? (
              <>✓ {t("Удалено", "Deleted")}</>
            ) : (
              <>🗑️ {t("Удалить аккаунт и данные", "Delete account and data")}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
