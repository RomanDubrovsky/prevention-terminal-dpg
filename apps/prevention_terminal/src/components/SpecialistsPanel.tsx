import { useState } from "react";
import { t } from "../lib/i18n.ts";
import { platformApiBase } from "../lib/platform_api.ts";

interface Specialist {
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

export default function SpecialistsPanel(props: SpecialistsPanelProps) {
  const { centerId, setupToken, terminalConfig, specialists, draftSpecialists, onReload, pendingReviews = [], onApproveReview, onDeleteReview } = props;

  const allSpecs: Specialist[] = [
    ...specialists,
    ...draftSpecialists.filter(
      (d) => !specialists.some((s) => s.specialist_id === d.specialist_id),
    ),
  ];

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

  function flash(msg: string, ok: boolean) {
    setStatusMsg({ msg, ok });
    setTimeout(() => setStatusMsg(null), 3500);
  }

  function startEdit(spec: Specialist) {
    setEditingId(spec.specialist_id);
    setEditForm({ display_name: spec.display_name, bio_short: spec.bio_short || "", booking_url: spec.booking_url || "", status: spec.status });
  }

  function cancelEdit() { setEditingId(null); setEditForm({}); }

  function cleanToken(raw: string): string {
    return raw.includes(":") ? raw.split(":")[0] : raw;
  }

  async function saveEdit(spec: Specialist) {
    setSaving(true);
    try {
      const token = cleanToken(setupToken);
      const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists/${spec.specialist_id}?setup_token=${token}`;
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      const data = await res.json();
      if (data.ok) { flash(t("Профиль обновлён.", "Profile updated."), true); cancelEdit(); onReload(); }
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
      }
      else flash(t("Ошибка: ", "Error: ") + (data.error || "unknown"), false);
    } catch (e) { flash(String(e), false); }
    finally { setTogglingId(null); }
  }

  const b64EncodeUnicode = (str: string) => {
    try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))));
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
    return `Здравствуйте, ${spec.display_name}!\n\nВас присоединяют к рабочему месту организации "${orgDisplayName}" в роли: Специалист (психолог).\n\nДля автоматического входа перейдите по этой готовой ссылке (все коды организации уже привязаны, вводить ничего не нужно):\n${getInviteUrl(spec)}`;
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
      if (data.ok) { flash(t("Специалист удалён.", "Specialist deleted."), true); onReload(); }
      else flash(t("Ошибка удаления: ", "Delete error: ") + (data.error || "unknown"), false);
    } catch (e) { flash(String(e), false); }
    finally { setDeletingId(null); }
  }

  const cardStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", gap: "0", transition: "box-shadow 0.2s" };
  const avatarStyle: React.CSSProperties = { width: "52px", height: "52px", borderRadius: "50%", flexShrink: 0, objectFit: "cover" };
  const avatarFallbackStyle: React.CSSProperties = { width: "52px", height: "52px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "1.3rem", userSelect: "none" };
  const inputStyle: React.CSSProperties = { background: "var(--surface-soft, #f9fafb)", border: "1px solid var(--line)", padding: "6px 10px", borderRadius: "6px", color: "var(--text)", fontSize: "0.9rem", width: "100%", boxSizing: "border-box" };
  const btnBase: React.CSSProperties = { border: "none", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "0.8rem", transition: "opacity 0.2s" };

  return (
    <section className="card dashboard-section" id="specialists-management-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: 0 }}>{t("Команда специалистов", "Specialist team")}</h3>
          <p className="muted tiny" style={{ marginTop: "4px", marginBottom: 0 }}>{t("Публикуйте, редактируйте и удаляйте профили.", "Publish, edit, and delete specialist profiles.")}</p>
        </div>
        <span style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed", padding: "4px 10px", borderRadius: "8px", fontWeight: 700, fontSize: "0.85rem" }}>
          {specialists.length} {t("опубл.", "publ.")} / {draftSpecialists.length} {t("черн.", "drafts")}
        </span>
      </div>

      {statusMsg && (
        <div style={{ padding: "10px 16px", borderRadius: "8px", marginBottom: "16px", background: statusMsg.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: statusMsg.ok ? "#10b981" : "#ef4444", border: `1px solid ${statusMsg.ok ? "#10b981" : "#ef4444"}`, fontSize: "0.9rem", fontWeight: 600 }}>
          {statusMsg.msg}
        </div>
      )}

      {allSpecs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--muted)", background: "var(--surface-soft, #f9fafb)", borderRadius: "12px", border: "1px dashed var(--line)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>👩‍⚕️</div>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>{t("Специалистов пока нет. Зарегистрируйте первого через форму на сайте.", "No specialists yet. Register the first one via the registration form on your website.")}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {allSpecs.map((spec) => {
            const isEditing = editingId === spec.specialist_id;
            const isDeleting = deletingId === spec.specialist_id;
            const isToggling = togglingId === spec.specialist_id;
            const confirmingDelete = confirmDeleteId === spec.specialist_id;
            const sc = STATUS_COLORS[spec.status] || STATUS_COLORS.draft;
            const validPhoto = isValidPhotoUrl(spec.photo_url);
            return (
              <div key={spec.specialist_id} style={cardStyle}>
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", width: "100%" }}>
                  {validPhoto
                    ? <img src={spec.photo_url!} alt={spec.display_name} style={avatarStyle} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    : <div style={avatarFallbackStyle}>{avatarLetter(spec.display_name)}</div>}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1rem" }}>{spec.display_name}</strong>
                      <span style={{ background: sc.bg, color: sc.color, padding: "2px 8px", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" }}>
                        {spec.status === "published" ? t("Опубликован", "Published") : t("Черновик", "Draft")}
                      </span>
                      {!validPhoto && <span style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", padding: "2px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 600 }} title={t("Фото повреждено.", "Photo corrupted.")}>{t("⚠ Нет фото", "⚠ No photo")}</span>}
                    </div>
                    {spec.bio_short && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.4 }}>{spec.bio_short}</p>}
                    {(spec.problem_keys || []).length > 0 && (
                      <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {(spec.problem_keys || []).slice(0, 5).map((key) => <span key={key} style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem" }}>{key}</span>)}
                        {(spec.problem_keys || []).length > 5 && <span style={{ fontSize: "0.7rem", color: "var(--muted)", padding: "2px 6px" }}>+{(spec.problem_keys || []).length - 5}</span>}
                      </div>
                    )}
                    <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "var(--muted)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {spec.online && <span>🌐 {t("Онлайн", "Online")}</span>}
                      {spec.offline && <span>🏠 {t("Оффлайн", "Offline")}</span>}
                      {spec.crisis_capable && <span style={{ color: "#ef4444" }}>🆘 {t("Кризисный", "Crisis")}</span>}
                      <span style={{ fontFamily: "monospace" }}>ID: {spec.specialist_id}</span>
                    </div>
                  </div>

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
