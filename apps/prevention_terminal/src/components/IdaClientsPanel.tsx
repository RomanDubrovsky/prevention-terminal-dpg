import { useState, useEffect, useCallback } from "react";
import { t } from "../lib/i18n.ts";
import { platformApiBase } from "../lib/platform_api.ts";
import ModuleGuideModal from "./ModuleGuideModal.tsx";

interface CompanionClient {
  link_id: string;
  consumer_user_id: string;
  consumer_name: string;
  status: string;
  created_at: string;
  last_summary: string | null;
  last_summary_week: string | null;
  mood_avg: number | null;
  read_by_specialist: boolean;
}

interface DirarySummary {
  id: string;
  week_start: string;
  summary_text: string;
  mood_avg: number | null;
  raw_event_count: number;
  read_by_specialist: boolean;
}

interface Props {
  specialistId: string;
  setupToken: string;
}

export default function IdaClientsPanel({ specialistId, setupToken }: Props) {
  const [clients, setClients] = useState<CompanionClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<CompanionClient | null>(null);
  const [summaries, setSummaries] = useState<DirarySummary[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const api = platformApiBase();

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/ida/clients?specialist_id=${encodeURIComponent(specialistId)}`);
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [specialistId, api]);

  useEffect(() => { void loadClients(); }, [loadClients]);

  const openClient = async (client: CompanionClient) => {
    setSelectedClient(client);
    setSummariesLoading(true);
    try {
      const res = await fetch(`${api}/api/ida/client-summary?link_id=${client.link_id}`);
      const data = await res.json();
      setSummaries(data.summaries || []);
      // Отмечаем все непрочитанные прочитанными
      for (const s of (data.summaries || []) as DirarySummary[]) {
        if (!s.read_by_specialist) {
          void fetch(`${api}/api/ida/client-summary/${s.id}/read`, { method: "PATCH" });
        }
      }
    } finally {
      setSummariesLoading(false);
    }
  };

  const generateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await fetch(`${api}/api/ida/companion-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialist_id: specialistId }),
      });
      const data = await res.json();
      setInviteLink(data.deep_link || null);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInvite = () => {
    if (inviteLink) {
      void navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const unreadCount = clients.filter(c => c.last_summary && !c.read_by_specialist).length;

  return (
    <div style={{ display: "flex", gap: "0", height: "100%", minHeight: "500px" }}>

      {/* Левая колонка: список клиентов */}
      <div style={{ width: "280px", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "6px" }}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>
              {t("Клиенты IDA", "IDA Clients")}
              {unreadCount > 0 && (
                <span style={{ marginLeft: "8px", background: "#ef4444", color: "white", fontSize: "0.7rem", padding: "2px 6px", borderRadius: "10px" }}>
                  {unreadCount}
                </span>
              )}
            </h3>
            <button
              type="button"
              className="header-guide-btn"
              style={{ fontSize: "0.75rem", padding: "3px 8px" }}
              onClick={() => setShowGuide(true)}
            >
              💡 {t("Как работает мост", "Bridge guide")}
            </button>
          </div>
          
          {/* Инвайт-генератор */}
          {!inviteLink ? (
            <button
              onClick={() => void generateInvite()}
              disabled={generatingInvite}
              style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px dashed var(--violet)", background: "rgba(124,58,237,0.05)", color: "var(--violet)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
            >
              {generatingInvite ? "..." : `🔗 ${t("Пригласить клиента из IDA", "Invite IDA Client")}`}
            </button>
          ) : (
            <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", padding: "10px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "0.8rem", color: "#065f46", fontWeight: 600 }}>
                {t("Ссылка для клиента:", "Client link:")}
              </p>
              <code style={{ fontSize: "0.75rem", wordBreak: "break-all", display: "block", marginBottom: "8px" }}>
                {inviteLink}
              </code>
              <button onClick={copyInvite} style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "none", background: copied ? "#10b981" : "var(--violet)", color: "white", cursor: "pointer", fontSize: "0.8rem" }}>
                {copied ? "✓ " + t("Скопировано!", "Copied!") : t("📋 Скопировать", "📋 Copy")}
              </button>
              <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
                {t("Отправьте клиенту, он введёт код в IDA Ассистент", "Send to client — they enter it in IDA Assistant")}
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
            {t("Загрузка...", "Loading...")}
          </div>
        ) : clients.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            {t("Пока нет привязанных клиентов. Сгенерируйте ссылку выше и отправьте её клиенту из IDA Ассистента.", "No connected clients yet. Generate a link above and send it to your IDA Assistant client.")}
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1 }}>
            {clients.map(client => (
              <button
                key={client.link_id}
                onClick={() => void openClient(client)}
                style={{
                  width: "100%", textAlign: "left", padding: "12px 16px",
                  background: selectedClient?.link_id === client.link_id ? "rgba(124,58,237,0.08)" : "transparent",
                  border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <strong style={{ fontSize: "0.9rem" }}>{client.consumer_name || t("Анонимный", "Anonymous")}</strong>
                  {client.last_summary && !client.read_by_specialist && (
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444", display: "inline-block", marginTop: "4px", flexShrink: 0 }} />
                  )}
                </div>
                {client.last_summary_week && (
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "4px" }}>
                    {t("Сводка:", "Summary:")} {client.last_summary_week}
                    {client.mood_avg != null && ` · ${t("Настроение:", "Mood:")} ${client.mood_avg}/10`}
                  </div>
                )}
                {!client.last_summary && (
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "4px" }}>
                    {t("Сводок ещё нет", "No summaries yet")}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Правая панель: дневник выбранного клиента */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {!selectedClient ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)", gap: "12px" }}>
            <span style={{ fontSize: "2.5rem" }}>📔</span>
            <p style={{ textAlign: "center", maxWidth: "300px", lineHeight: 1.5, fontSize: "0.9rem" }}>
              {t("Выберите клиента слева, чтобы увидеть его еженедельные записи, переданные из IDA Ассистента.", "Select a client on the left to see their weekly diary entries shared from IDA Assistant.")}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px" }}>{selectedClient.consumer_name || t("Анонимный клиент", "Anonymous Client")}</h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                  {t("Дневник из IDA Ассистента · Обновляется раз в неделю", "Diary from IDA Assistant · Updated weekly")}
                </p>
              </div>
              <a
                href={`https://ida-psy.pro/?specialist_id=${specialistId}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "0.8rem", padding: "6px 12px", borderRadius: "20px", border: "1px solid var(--line)", color: "var(--muted)", textDecoration: "none" }}
              >
                {t("Открыть в IDA →", "Open in IDA →")}
              </a>
            </div>

            {summariesLoading ? (
              <p style={{ color: "var(--muted)" }}>{t("Загрузка записей...", "Loading entries...")}</p>
            ) : summaries.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", border: "1px dashed var(--line)", borderRadius: "12px", color: "var(--muted)" }}>
                <p>{t("Клиент ещё не поделился ни одной сводкой. Это происходит автоматически раз в неделю, если у него установлено и активно приложение IDA Ассистент.", "The client hasn't shared any summaries yet. This happens automatically once a week if they have IDA Assistant installed and active.")}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {summaries.map(s => (
                  <div key={s.id} style={{ border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
                    <div style={{ padding: "10px 16px", background: "var(--surface-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)" }}>
                      <strong style={{ fontSize: "0.9rem" }}>
                        {t("Неделя с", "Week of")} {s.week_start}
                      </strong>
                      <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem", color: "var(--muted)" }}>
                        {s.mood_avg != null && <span>😐 {t("Настроение:", "Mood:")} {s.mood_avg}/10</span>}
                        {s.raw_event_count > 0 && <span>💬 {s.raw_event_count} {t("сообщений", "messages")}</span>}
                      </div>
                    </div>
                    <div style={{ padding: "16px", lineHeight: 1.6, fontSize: "0.95rem" }}>
                      {s.summary_text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ModuleGuideModal
        moduleId="ida_clients"
        isCommercial={true}
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onCtaClick={() => void generateInvite()}
      />
    </div>
  );
}
