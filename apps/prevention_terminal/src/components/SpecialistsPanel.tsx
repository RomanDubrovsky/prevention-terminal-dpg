import { useState, useEffect } from "react";
import { t } from "../lib/i18n.ts";
import { platformApiBase } from "../lib/platform_api.ts";

export interface Specialist {
  specialist_id: string;
  center_id: string;
  display_name: string;
  photo_url?: string | null;
  bio_short?: string | null;
  booking_url?: string | null;
  problem_keys?: string[];
  method_tags?: string[];
  crisis_capable?: boolean;
  languages?: string[];
  online?: boolean;
  offline?: boolean;
  email?: string | null;
  status: "draft" | "published";

  // Расширенные поля аналитики и типологии
  years_experience_est?: number | null;
  education?: string | null;
  self_presentation?: string | null;
  supervision?: string | null;
  publications?: string | null;
  completeness_pct?: number;
  typology_tags?: string[];
  total_leads_assigned?: number;
  total_scheduled_sessions?: number;
  total_approved_reviews?: number;
}

export interface ResearchStats {
  total_specialists: number;
  avg_completeness_pct: number;
  experience_distribution: Record<string, number>;
  top_methods: Array<{ tag: string; count: number; pct: number }>;
  top_problems: Array<{ key: string; count: number; pct: number }>;
  typology_distribution: Array<{ tag: string; label: string; count: number; pct: number }>;
  activity_correlation?: {
    by_experience: Record<string, { count: number; avg_leads: number; avg_scheduled: number }>;
    by_top_methods: Record<string, { count: number; avg_leads: number; avg_scheduled: number }>;
    total_leads_system: number;
    total_scheduled_system: number;
    total_reviews_system: number;
  };
}

interface SpecialistsPanelProps {
  centerId: string;
  setupToken: string;
  terminalConfig?: any;
  specialists: Specialist[];
  draftSpecialists: Specialist[];
  onReload: () => void;
  pendingReviews?: any[];
  onApproveReview?: (reviewId: string) => void;
  onDeleteReview?: (reviewId: string) => void;
}

function avatarLetter(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase();
}

function isValidPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  if (url.startsWith("data:image/")) {
    const commaIdx = url.indexOf(",");
    return commaIdx > 10 && url.length > commaIdx + 10;
  }
  return false;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  published: { bg: "rgba(45,212,191,0.12)", color: "#10b981" },
  draft: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
};

const TYPOLOGY_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  senior_expert: { label: "Опытный практик (10+ лет)", icon: "🏛", color: "#b45309", bg: "rgba(245,158,11,0.12)" },
  experienced_practitioner: { label: "Практикующий (5+ лет)", icon: "⭐", color: "#047857", bg: "rgba(16,185,129,0.12)" },
  cbt_structured: { label: "КПТ / Структурированный", icon: "🧩", color: "#1d4ed8", bg: "rgba(59,130,246,0.12)" },
  gestalt_existential: { label: "Гуманитарный / Гештальт", icon: "🌱", color: "#059669", bg: "rgba(16,185,129,0.12)" },
  psychoanalytic_depth: { label: "Глубинный / Психодинамический", icon: "🗝", color: "#6d28d9", bg: "rgba(109,40,217,0.12)" },
  systemic_family: { label: "Семейный / Системный", icon: "👨‍👩‍👧", color: "#c026d3", bg: "rgba(192,38,211,0.12)" },
  creative_art_therapy: { label: "Арт-терапия", icon: "🎨", color: "#ea580c", bg: "rgba(234,88,12,0.12)" },
  body_oriented: { label: "Телесно-ориентированный", icon: "🧘", color: "#0891b2", bg: "rgba(8,145,178,0.12)" },
  supervised_practitioner: { label: "С супервизией", icon: "🛡", color: "#0284c7", bg: "rgba(2,132,199,0.12)" },
  academic_author: { label: "Научно-методический опыт", icon: "📚", color: "#4f46e5", bg: "rgba(79,70,229,0.12)" },
  crisis_interventionist: { label: "Кризисная помощь", icon: "🆘", color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
};

export default function SpecialistsPanel(props: SpecialistsPanelProps) {
  const { centerId, setupToken, terminalConfig, specialists, draftSpecialists, onReload, pendingReviews = [], onApproveReview, onDeleteReview } = props;

  // Режим вкладки: 'catalog' (витрина/иконостас) или 'research' (статистика и типология)
  const [activeTab, setActiveTab] = useState<"catalog" | "research">("catalog");

  // Обогащенные данные из ростера бэкенда
  const [enrichedMap, setEnrichedMap] = useState<Record<string, Partial<Specialist>>>({});
  const [researchData, setResearchData] = useState<ResearchStats | null>(null);
  const [loadingResearch, setLoadingResearch] = useState<boolean>(false);

  // Фильтр по типологии в каталоге
  const [typologyFilter, setTypologyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Specialist>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ msg: string; ok: boolean } | null>(null);

  // Invite Modal State
  const [inviteModalSpec, setInviteModalSpec] = useState<Specialist | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

  const parentCode = terminalConfig?.parent_invite_code || (terminalConfig?.child_invite_code ? terminalConfig.child_invite_code.replace(/^CHILD-/, "PARENT-") : "PARENT-ORG");
  const orgDisplayName = terminalConfig?.org_name || "Организация";

  function cleanToken(raw: string): string {
    return raw.includes(":") ? raw.split(":")[0] : raw;
  }

  // Загрузка обогащенного ростера и исследования
  const loadAnalytics = async () => {
    try {
      const cid = centerId || "global";
      // 1. Загрузка ростера со стажем и активностью
      const rosterRes = await fetch(`${platformApiBase()}/api/ida/centers/${cid}/specialists/roster?published_only=false`).catch(() => null);
      if (rosterRes && rosterRes.ok) {
        const data = await rosterRes.json().catch(() => null);
        if (data && data.ok && Array.isArray(data.specialists)) {
          const map: Record<string, Partial<Specialist>> = {};
          for (const s of data.specialists) {
            if (s.specialist_id) {
              map[s.specialist_id] = s;
            }
          }
          setEnrichedMap(map);
        }
      }

      // 2. Загрузка исследования
      setLoadingResearch(true);
      const resRes = await fetch(`${platformApiBase()}/api/ida/centers/${cid}/specialists/research`).catch(() => null);
      if (resRes && resRes.ok) {
        const rdata = await resRes.json().catch(() => null);
        if (rdata && rdata.ok && rdata.research) {
          setResearchData(rdata.research);
        }
      }
    } catch (e) {
      console.warn("Error loading specialists analytics:", e);
    } finally {
      setLoadingResearch(false);
    }
  };

  useEffect(() => {
    void loadAnalytics();
  }, [centerId]);

  const rawSpecs: Specialist[] = [
    ...specialists,
    ...draftSpecialists.filter(
      (d) => !specialists.some((s) => s.specialist_id === d.specialist_id),
    ),
  ];

  // Сливаем базовые данные с обогащенными из аналитического модуля
  const allSpecs: Specialist[] = rawSpecs.map((s) => {
    const extra = enrichedMap[s.specialist_id] || {};
    return {
      ...s,
      ...extra,
    };
  });

  // Фильтрация специалистов
  const filteredSpecs = allSpecs.filter((s) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (s.display_name || "").toLowerCase().includes(q);
      const bioMatch = (s.bio_short || "").toLowerCase().includes(q);
      const selfMatch = (s.self_presentation || "").toLowerCase().includes(q);
      const probMatch = (s.problem_keys || []).some((k) => k.toLowerCase().includes(q));
      const methMatch = (s.method_tags || []).some((m) => m.toLowerCase().includes(q));
      if (!nameMatch && !bioMatch && !selfMatch && !probMatch && !methMatch) {
        return false;
      }
    }
    if (typologyFilter !== "all") {
      const tags = s.typology_tags || [];
      if (!tags.includes(typologyFilter)) {
        return false;
      }
    }
    return true;
  });

  function flash(msg: string, ok: boolean) {
    setStatusMsg({ msg, ok });
    setTimeout(() => setStatusMsg(null), 3500);
  }

  function startEdit(spec: Specialist) {
    setEditingId(spec.specialist_id);
    setEditForm({ display_name: spec.display_name, bio_short: spec.bio_short || "", booking_url: spec.booking_url || "", status: spec.status });
  }

  function cancelEdit() { setEditingId(null); setEditForm({}); }

  async function saveEdit(spec: Specialist) {
    setSaving(true);
    try {
      const token = cleanToken(setupToken);
      const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists/${spec.specialist_id}?setup_token=${token}`;
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      const data = await res.json();
      if (data.ok) { flash(t("Профиль обновлён.", "Profile updated."), true); cancelEdit(); onReload(); void loadAnalytics(); }
      else flash(t("Ошибка: ", "Error: ") + (data.error || "unknown"), false);
    } catch (e) { flash(String(e), false); }
    finally { setSaving(false); }
  }

  async function toggleStatus(spec: Specialist) {
    setTogglingId(spec.specialist_id);
    try {
      const token = cleanToken(setupToken);
      const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists/${spec.specialist_id}?setup_token=${token}`;
      const newStatus = spec.status === "published" ? "draft" : "published";
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
      const data = await res.json();
      if (data.ok) { 
        if (newStatus === "published") {
          setInviteModalSpec(spec);
          setInviteEmail(spec.email || "");
        } else {
          flash(t("Переведён в черновик.", "Moved to draft."), true);
        }
        onReload();
        void loadAnalytics();
      }
      else flash(t("Ошибка: ", "Error: ") + (data.error || "unknown"), false);
    } catch (e) { flash(String(e), false); }
    finally { setTogglingId(null); }
  }

  const b64EncodeUnicode = (str: string) => {
    try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_match, p1) => String.fromCharCode(parseInt(p1, 16))));
    } catch { return ""; }
  };

  const getInviteUrl = (spec: Specialist) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://ru.prevention.school";
    const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
    const baseUrl = isLocal ? "https://ru.prevention.school/terminal/staging/" : `${origin}/terminal/staging/`;
    const params = new URLSearchParams({
      parent_in: parentCode,
      role: "specialist",
      email: inviteEmail || "",
      n64: b64EncodeUnicode(spec.display_name || ""),
      o64: b64EncodeUnicode(orgDisplayName),
      auto_login: "1",
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const getMessengerText = (spec: Specialist) => {
    return `Здравствуйте, ${spec.display_name}!\n\nВас присоединяют к рабочему месту организации "${orgDisplayName}" в роли: Специалист (психолог).\n\nДля автоматического входа перейдите по этой готовой ссылке:\n${getInviteUrl(spec)}`;
  };

  const sendEmailInvite = async () => {
    if (!inviteEmail || !inviteModalSpec) {
      alert(t("Введите email!", "Enter email!"));
      return;
    }
    setSendingInvite(true);
    try {
      const inviteUrl = getInviteUrl(inviteModalSpec);
      const res = await fetch(`${platformApiBase()}/api/terminal/invite/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteModalSpec.display_name,
          role: "specialist",
          org_name: orgDisplayName,
          invite_link: inviteUrl,
          parent_code: parentCode,
        }),
      }).catch(() => null);

      const data = res ? await res.json().catch(() => null) : null;

      if (res && res.ok && data && data.ok) {
        flash(t(`Приглашение отправлено на почту ${inviteEmail}!`, `Invite sent to ${inviteEmail}!`), true);
      } else {
        const url = getInviteUrl(inviteModalSpec);
        await navigator.clipboard.writeText(url).catch(()=>{});
        const subject = encodeURIComponent(`Приглашение в Терминал организации ${orgDisplayName}`);
        const body = encodeURIComponent(getMessengerText(inviteModalSpec));
        window.location.href = `mailto:${inviteEmail}?subject=${subject}&body=${body}`;
        flash(t(`Ссылка скопирована. Открыт почтовый клиент.`, `Link copied. Email client opened.`), true);
      }
      setInviteModalSpec(null);
    } catch (e) {
      flash(String(e), false);
    } finally {
      setSendingInvite(false);
    }
  };

  async function doDelete(spec: Specialist) {
    setDeletingId(spec.specialist_id); setConfirmDeleteId(null);
    try {
      const token = cleanToken(setupToken);
      const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists/${spec.specialist_id}?setup_token=${token}`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) { flash(t("Специалист удалён.", "Specialist deleted."), true); onReload(); void loadAnalytics(); }
      else flash(t("Ошибка удаления: ", "Delete error: ") + (data.error || "unknown"), false);
    } catch (e) { flash(String(e), false); }
    finally { setDeletingId(null); }
  }

  const cardStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "0", transition: "box-shadow 0.2s" };
  const avatarStyle: React.CSSProperties = { width: "56px", height: "56px", borderRadius: "50%", flexShrink: 0, objectFit: "cover" };
  const avatarFallbackStyle: React.CSSProperties = { width: "56px", height: "56px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "1.3rem", userSelect: "none" };
  const inputStyle: React.CSSProperties = { background: "var(--surface-soft, #f9fafb)", border: "1px solid var(--line)", padding: "6px 10px", borderRadius: "6px", color: "var(--text)", fontSize: "0.9rem", width: "100%", boxSizing: "border-box" };
  const btnBase: React.CSSProperties = { border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "0.8rem", transition: "opacity 0.2s" };

  return (
    <section className="card dashboard-section" id="specialists-management-panel">
      {/* Шапка и переключатель режимов */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.25rem" }}>{t("Команда специалистов и типология", "Specialists team & typology")}</h3>
          <p className="muted tiny" style={{ marginTop: "4px", marginBottom: 0 }}>
            {t("Единый каталог, параметры мэтчинга, опыт и статистические исследования деятельности.", "Unified roster, matching parameters, experience and practice research.")}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed", padding: "4px 10px", borderRadius: "8px", fontWeight: 700, fontSize: "0.85rem" }}>
            {specialists.length} {t("опубл.", "publ.")} / {draftSpecialists.length} {t("черн.", "drafts")}
          </span>
        </div>
      </div>

      {/* Вкладки: Каталог / Исследования */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--line)", paddingBottom: "10px", marginBottom: "16px" }}>
        <button
          onClick={() => setActiveTab("catalog")}
          style={{
            ...btnBase,
            background: activeTab === "catalog" ? "#7c3aed" : "var(--surface-soft)",
            color: activeTab === "catalog" ? "#ffffff" : "var(--text)",
            border: activeTab === "catalog" ? "none" : "1px solid var(--line)",
            padding: "8px 16px",
            fontSize: "0.85rem",
          }}
        >
          👥 {t("Каталог команды («Иконостас»)", "Team Catalog")} ({filteredSpecs.length})
        </button>
        <button
          onClick={() => setActiveTab("research")}
          style={{
            ...btnBase,
            background: activeTab === "research" ? "#7c3aed" : "var(--surface-soft)",
            color: activeTab === "research" ? "#ffffff" : "var(--text)",
            border: activeTab === "research" ? "none" : "1px solid var(--line)",
            padding: "8px 16px",
            fontSize: "0.85rem",
          }}
        >
          📊 {t("Статистика и типология психологов", "Typology & Practice Analytics")}
        </button>
      </div>

      {statusMsg && (
        <div style={{ padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", background: statusMsg.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: statusMsg.ok ? "#10b981" : "#ef4444", border: `1px solid ${statusMsg.ok ? "#10b981" : "#ef4444"}`, fontSize: "0.9rem", fontWeight: 600 }}>
          {statusMsg.msg}
        </div>
      )}

      {/* ВКЛАДКА 1: КАТАЛОГ («ИКОНОСТАС») */}
      {activeTab === "catalog" && (
        <div>
          {/* Панель фильтров и поиска */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ flex: 1, minWidth: "220px" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("Поиск по имени, подходу, темам или «О себе»...", "Search by name, method, themes or bio...")}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{t("Типология:", "Typology:")}</span>
              <select
                value={typologyFilter}
                onChange={(e) => setTypologyFilter(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}
              >
                <option value="all">{t("Все типологии", "All typologies")}</option>
                <option value="senior_expert">🏛 Опытный практик (10+ лет)</option>
                <option value="experienced_practitioner">⭐ Практикующий (5+ лет)</option>
                <option value="cbt_structured">🧩 КПТ / Структурированный</option>
                <option value="gestalt_existential">🌱 Гуманитарный / Гештальт</option>
                <option value="psychoanalytic_depth">🗝 Психодинамический</option>
                <option value="systemic_family">👨‍👩‍👧 Семейный / Системный</option>
                <option value="creative_art_therapy">🎨 Арт-терапия</option>
                <option value="body_oriented">🧘 Телесно-ориентированный</option>
                <option value="supervised_practitioner">🛡 С супервизией</option>
                <option value="academic_author">📚 Научный опыт</option>
                <option value="crisis_interventionist">🆘 Кризисная помощь</option>
              </select>
            </div>
          </div>

          {filteredSpecs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)", background: "var(--surface-soft, #f9fafb)", borderRadius: "12px", border: "1px dashed var(--line)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>👩‍⚕️</div>
              <p style={{ margin: 0, fontSize: "0.95rem" }}>
                {searchQuery || typologyFilter !== "all"
                  ? t("Нет специалистов, подходящих под выбранные фильтры.", "No specialists match the selected filters.")
                  : t("Специалистов пока нет. Зарегистрируйте первого через форму на сайте.", "No specialists yet. Register the first one via the registration form on your website.")}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {filteredSpecs.map((spec) => {
                const isEditing = editingId === spec.specialist_id;
                const isDeleting = deletingId === spec.specialist_id;
                const isToggling = togglingId === spec.specialist_id;
                const confirmingDelete = confirmDeleteId === spec.specialist_id;
                const sc = STATUS_COLORS[spec.status] || STATUS_COLORS.draft;
                const validPhoto = isValidPhotoUrl(spec.photo_url);

                const completeness = spec.completeness_pct ?? 0;
                const yearsExp = spec.years_experience_est;
                const leadsCount = spec.total_leads_assigned ?? 0;
                const sessionsCount = spec.total_scheduled_sessions ?? 0;
                const reviewsCount = spec.total_approved_reviews ?? 0;
                const typologies = spec.typology_tags || [];

                return (
                  <div key={spec.specialist_id} style={cardStyle}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", width: "100%" }}>
                      {validPhoto
                        ? <img src={spec.photo_url!} alt={spec.display_name} style={avatarStyle} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        : <div style={avatarFallbackStyle}>{avatarLetter(spec.display_name)}</div>}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: "1.05rem" }}>{spec.display_name}</strong>
                          <span style={{ background: sc.bg, color: sc.color, padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" }}>
                            {spec.status === "published" ? t("Опубликован", "Published") : t("Черновик", "Draft")}
                          </span>

                          {/* Стаж работы */}
                          {yearsExp !== null && yearsExp !== undefined && (
                            <span style={{ background: "rgba(16,185,129,0.1)", color: "#059669", padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 600 }}>
                              ⏳ Стаж: ~{yearsExp} {yearsExp === 1 ? "год" : yearsExp < 5 ? "года" : "лет"}
                            </span>
                          )}

                          {/* Заполненность анкеты */}
                          <span style={{ background: completeness >= 75 ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)", color: completeness >= 75 ? "#059669" : "#d97706", padding: "2px 8px", borderRadius: "6px", fontSize: "0.72rem", fontWeight: 600 }}>
                            📋 Профиль: {completeness}%
                          </span>

                          {!validPhoto && <span style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "2px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 600 }} title={t("Фото повреждено.", "Photo corrupted.")}>{t("⚠ Нет фото", "⚠ No photo")}</span>}
                        </div>

                        {/* Краткое описание */}
                        {spec.bio_short && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>{spec.bio_short}</p>}

                        {/* Свободное поле «О себе» (если есть) */}
                        {spec.self_presentation && (
                          <div style={{ marginTop: "6px", padding: "6px 10px", background: "rgba(124,58,237,0.04)", borderLeft: "3px solid #7c3aed", borderRadius: "0 6px 6px 0", fontSize: "0.82rem", color: "var(--text)", lineHeight: 1.35, fontStyle: "italic" }}>
                            «{spec.self_presentation}»
                          </div>
                        )}

                        {/* Типологические бейджи */}
                        {typologies.length > 0 && (
                          <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {typologies.map((tag) => {
                              const meta = TYPOLOGY_META[tag] || { label: tag, icon: "🏷", color: "#475569", bg: "rgba(71,85,105,0.08)" };
                              return (
                                <span
                                  key={tag}
                                  style={{
                                    background: meta.bg,
                                    color: meta.color,
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  <span>{meta.icon}</span>
                                  <span>{meta.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Темы и запросы */}
                        {(spec.problem_keys || []).length > 0 && (
                          <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {(spec.problem_keys || []).slice(0, 5).map((key) => <span key={key} style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem" }}>{key}</span>)}
                            {(spec.problem_keys || []).length > 5 && <span style={{ fontSize: "0.7rem", color: "var(--muted)", padding: "2px 6px" }}>+{(spec.problem_keys || []).length - 5}</span>}
                          </div>
                        )}

                        {/* Показатели деятельности и форматы */}
                        <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "var(--muted)", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                          {spec.online && <span>🌐 {t("Онлайн", "Online")}</span>}
                          {spec.offline && <span>🏠 {t("Оффлайн", "Offline")}</span>}
                          {spec.crisis_capable && <span style={{ color: "#ef4444", fontWeight: 600 }}>🆘 {t("Кризисный", "Crisis")}</span>}

                          {/* Метрики работы */}
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>
                            📥 Заявок: {leadsCount}
                          </span>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>
                            📅 Сессий: {sessionsCount}
                          </span>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>
                            ⭐ Отзывов: {reviewsCount}
                          </span>

                          <span style={{ fontFamily: "monospace", opacity: 0.7 }}>ID: {spec.specialist_id}</span>
                        </div>
                      </div>

                      {/* Кнопки управления */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                        <button onClick={() => isEditing ? cancelEdit() : startEdit(spec)} disabled={isDeleting || isToggling}
                          style={{ ...btnBase, background: "var(--surface-soft)", color: "var(--text)", border: "1px solid var(--line)" }}>
                          {isEditing ? t("Отмена", "Cancel") : t("✏ Редактировать", "✏ Edit")}
                        </button>
                        <button onClick={() => void toggleStatus(spec)} disabled={isDeleting || isToggling || isEditing}
                          style={{ ...btnBase, background: "var(--surface-soft)", color: "var(--text)", border: "1px solid var(--line)", opacity: isToggling ? 0.6 : 1 }}>
                          {isToggling ? "..." : spec.status === "published" ? t("В черновик", "Unpublish") : t("Опубликовать", "Publish")}
                        </button>
                        <button onClick={() => { setInviteModalSpec(spec); setInviteEmail(spec.email || ""); }} disabled={isDeleting || isToggling || isEditing}
                          style={{ ...btnBase, background: "var(--surface-soft)", color: "var(--text)", border: "1px solid var(--line)", opacity: isToggling ? 0.6 : 1 }}>
                          🔗 {t("Ссылка для входа", "Login link")}
                        </button>
                        {confirmingDelete ? (
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button onClick={() => void doDelete(spec)} disabled={isDeleting} style={{ ...btnBase, background: "#ef4444", color: "white", fontSize: "0.75rem", padding: "4px 8px" }}>
                              {isDeleting ? "..." : t("Да, удалить", "Yes, delete")}
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} style={{ ...btnBase, background: "transparent", color: "var(--muted)", border: "1px solid var(--line)", fontSize: "0.75rem", padding: "4px 8px" }}>
                              {t("Нет", "No")}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(spec.specialist_id)} disabled={isDeleting || isToggling || isEditing}
                            style={{ ...btnBase, background: "transparent", color: "#ef4444", border: "1px solid var(--line)", opacity: isDeleting ? 0.5 : 1 }}>
                            {t("🗑 Удалить", "🗑 Delete")}
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing && (
                      <div style={{ marginTop: "16px", padding: "16px", background: "var(--surface-soft, #f9fafb)", borderRadius: "8px", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <h4 style={{ margin: "0 0 4px", fontSize: "0.95rem" }}>{t("Редактирование профиля", "Edit profile")}</h4>
                        <div>
                          <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>{t("Имя и фамилия", "Full name")}</label>
                          <input id={`edit-name-${spec.specialist_id}`} style={inputStyle} value={editForm.display_name || ""} onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))} placeholder={t("Имя специалиста", "Specialist name")} />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>{t("Краткое био", "Short bio")}</label>
                          <textarea id={`edit-bio-${spec.specialist_id}`} style={{ ...inputStyle, minHeight: "80px", resize: "vertical" } as React.CSSProperties} value={editForm.bio_short || ""} onChange={(e) => setEditForm((f) => ({ ...f, bio_short: e.target.value }))} placeholder={t("Описание специалиста...", "Specialist description...")} />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>{t("Ссылка на запись", "Booking URL")}</label>
                          <input id={`edit-booking-${spec.specialist_id}`} style={inputStyle} type="url" value={editForm.booking_url || ""} onChange={(e) => setEditForm((f) => ({ ...f, booking_url: e.target.value }))} placeholder="https://..." />
                        </div>
                        <div>
                          <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>{t("Статус", "Status")}</label>
                          <select id={`edit-status-${spec.specialist_id}`} style={inputStyle} value={editForm.status || spec.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as "draft" | "published" }))}>
                            <option value="draft">{t("Черновик", "Draft")}</option>
                            <option value="published">{t("Опубликован", "Published")}</option>
                          </select>
                        </div>
                        {!validPhoto && (
                          <div style={{ padding: "10px 12px", borderRadius: "6px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)", fontSize: "0.82rem", color: "#ef4444" }}>
                            ⚠️ {t("Фото повреждено. Удалите специалиста и создайте заново через форму регистрации.", "Photo corrupted. Delete and re-create via the registration form.")}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button onClick={() => void saveEdit(spec)} disabled={saving} style={{ ...btnBase, background: "#7c3aed", color: "white", opacity: saving ? 0.6 : 1 }}>
                            {saving ? t("Сохраняем...", "Saving...") : t("💾 Сохранить", "💾 Save")}
                          </button>
                          <button onClick={cancelEdit} style={{ ...btnBase, background: "transparent", color: "var(--muted)", border: "1px solid var(--line)" }}>
                            {t("Отмена", "Cancel")}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Отзывы на модерации для конкретного специалиста */}
                    {pendingReviews.some((r) => r.specialist_id === spec.specialist_id) && (
                      <div style={{ marginTop: "16px", borderTop: "1px dashed var(--line)", paddingTop: "12px" }}>
                        <h4 style={{ margin: "0 0 8px", fontSize: "0.9rem", color: "var(--text)" }}>
                          {t("Отзывы на модерации:", "Reviews pending moderation:")}
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {pendingReviews
                            .filter((r) => r.specialist_id === spec.specialist_id)
                            .map((rev: any, rIdx: number) => (
                              <div key={rIdx} style={{ background: "var(--surface-soft, #f9fafb)", border: "1px solid var(--line)", padding: "10px", borderRadius: "8px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <strong style={{ fontSize: "0.85rem" }}>{rev.author_name}</strong>
                                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                    {rev.created_at ? new Date(rev.created_at * 1000).toLocaleDateString() : ""}
                                  </span>
                                </div>
                                <p style={{ margin: "6px 0 0", fontSize: "0.85rem", color: "var(--text)" }}>{rev.text_content}</p>
                                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                  <button
                                    onClick={() => onApproveReview?.(rev.id)}
                                    style={{ ...btnBase, background: "var(--surface-soft)", color: "var(--text)", border: "1px solid var(--line)" }}
                                  >
                                    {t("Одобрить", "Approve")}
                                  </button>
                                  <button
                                    onClick={() => onDeleteReview?.(rev.id)}
                                    style={{ ...btnBase, background: "transparent", color: "#ef4444", border: "1px solid var(--line)" }}
                                  >
                                    {t("Отклонить", "Reject")}
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ВКЛАДКА 2: ИССЛЕДОВАНИЯ И СТАТИСТИКА */}
      {activeTab === "research" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {loadingResearch ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              ⏳ {t("Идёт расчет статистических показателей и срезов...", "Calculating statistical indicators...")}
            </div>
          ) : !researchData || researchData.total_specialists === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", background: "var(--surface-soft)", borderRadius: "12px" }}>
              📊 {t("Недостаточно данных для построения исследования. Заполните анкеты специалистов.", "Not enough data for research report yet.")}
            </div>
          ) : (
            <>
              {/* Верхние ключевые метрики */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>👥 Всего специалистов</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", marginTop: "4px" }}>
                    {researchData.total_specialists}
                  </div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>📋 Средняя полнота анкет</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>
                    {researchData.avg_completeness_pct}%
                  </div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>📥 Всего заявок (лидов)</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#3b82f6", marginTop: "4px" }}>
                    {researchData.activity_correlation?.total_leads_system ?? 0}
                  </div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>📅 Назначено сессий</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#8b5cf6", marginTop: "4px" }}>
                    {researchData.activity_correlation?.total_scheduled_system ?? 0}
                  </div>
                </div>
              </div>

              {/* Распределение по опыту работы (стажу) */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "18px", borderRadius: "12px" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "1rem" }}>⏳ Распределение по опыту работы (стажу)</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.entries(researchData.experience_distribution).map(([bracket, count]) => {
                    const pct = researchData.total_specialists > 0 ? Math.round((count / researchData.total_specialists) * 100) : 0;
                    return (
                      <div key={bracket} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                          <span><strong>{bracket}</strong></span>
                          <span style={{ color: "var(--muted)" }}>{count} чел. ({pct}%)</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", background: "var(--line)", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #7c3aed, #a855f7)", borderRadius: "4px" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Типологии специалистов на платформе */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "18px", borderRadius: "12px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem" }}>🧩 Типологии и стили практики</h4>
                <p style={{ margin: "0 0 14px 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                  Классификация на основе подходов, подтвержденного стажа, супервизии и методов работы:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
                  {researchData.typology_distribution.map((item) => {
                    const meta = TYPOLOGY_META[item.tag] || { icon: "🏷", color: "#64748b", bg: "rgba(100,116,139,0.1)" };
                    return (
                      <div key={item.tag} style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "1.1rem" }}>{meta.icon}</span>
                          <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{item.label}</div>
                            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>Доля: {item.pct}%</div>
                          </div>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: meta.color }}>{item.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Связь опыта со средней активностью (лиды и сессии) */}
              {researchData.activity_correlation?.by_experience && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "18px", borderRadius: "12px" }}>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "1rem" }}>📈 Связь опыта психолога с показателями деятельности</h4>
                  <p style={{ margin: "0 0 14px 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                    Сколько в среднем обращений и подтвержденных встреч приходится на специалиста в каждой группе стажа:
                  </p>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left", color: "var(--muted)" }}>
                          <th style={{ padding: "8px 12px" }}>Категория опыта</th>
                          <th style={{ padding: "8px 12px" }}>Кол-во</th>
                          <th style={{ padding: "8px 12px" }}>Ср. заявок (лидов)</th>
                          <th style={{ padding: "8px 12px" }}>Ср. назначенных встреч</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(researchData.activity_correlation.by_experience).map(([grp, row]) => (
                          <tr key={grp} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{grp}</td>
                            <td style={{ padding: "10px 12px" }}>{row.count} чел.</td>
                            <td style={{ padding: "10px 12px", color: "#2563eb", fontWeight: 700 }}>{row.avg_leads}</td>
                            <td style={{ padding: "10px 12px", color: "#16a34a", fontWeight: 700 }}>{row.avg_scheduled}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Топ методов и тем обращений */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>🛠 Топ используемых подходов</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {researchData.top_methods.slice(0, 7).map((m) => (
                      <div key={m.tag} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                        <span>{m.tag}</span>
                        <span style={{ fontWeight: 600 }}>{m.count} ({m.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "16px", borderRadius: "12px" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>🎯 Топ тематик клиентских запросов</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {researchData.top_problems.slice(0, 7).map((p) => (
                      <div key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                        <span>{p.key}</span>
                        <span style={{ fontWeight: 600 }}>{p.count} ({p.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Общие отзывы без привязки к специалисту */}
      {pendingReviews.filter((rev) => !allSpecs.some((s) => s.specialist_id === rev.specialist_id)).length > 0 && (
        <div style={{ marginTop: "24px", borderTop: "2px solid var(--line)", paddingTop: "16px" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: "0.95rem" }}>{t("Отзывы без указания специалиста (на модерации)", "Unmatched reviews (pending moderation)")}</h4>
          <p className="muted tiny" style={{ marginBottom: "12px" }}>
            {t("Эти отзывы не привязаны к конкретному специалисту или специалист был удален.", "These reviews are not linked to a specific specialist or the specialist was deleted.")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pendingReviews
              .filter((rev) => !allSpecs.some((s) => s.specialist_id === rev.specialist_id))
              .map((rev: any, rIdx: number) => (
                <div key={rIdx} style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{rev.author_name}</strong>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      {rev.specialist_id ? `${t("Для ID:", "For ID:")} ${rev.specialist_id}` : t("Общий отзыв", "General review")}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0", fontSize: "0.85rem" }}>{rev.text_content}</p>
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      onClick={() => onApproveReview?.(rev.id)}
                      style={{ ...btnBase, background: "var(--surface-soft)", color: "var(--text)", border: "1px solid var(--line)" }}
                    >
                      {t("Одобрить", "Approve")}
                    </button>
                    <button
                      onClick={() => onDeleteReview?.(rev.id)}
                      style={{ ...btnBase, background: "transparent", color: "#ef4444", border: "1px solid var(--line)" }}
                    >
                      {t("Отклонить", "Reject")}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Модальное окно приглашения */}
      {inviteModalSpec && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--line)", padding: "24px", borderRadius: "12px", width: "100%", maxWidth: "450px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 8px 0" }}>{t("Отправить приглашение", "Send Invite")}</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>
              {t("Анкета опубликована. Введите email психолога, чтобы отправить ему ссылку для входа с кодом вашей организации:", "Profile published. Enter the psychologist's email to send them a login link with your organization's code:")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Email</label>
                <input type="email" placeholder="psy@organization.ru" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setInviteModalSpec(null)} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--line)", background: "transparent", cursor: "pointer" }}>
                {t("Пропустить", "Skip")}
              </button>
              <button onClick={() => void sendEmailInvite()} disabled={sendingInvite} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#7c3aed", color: "white", fontWeight: "bold", cursor: "pointer", opacity: sendingInvite ? 0.6 : 1 }}>
                {sendingInvite ? t("Отправка...", "Sending...") : t("Отправить", "Send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
