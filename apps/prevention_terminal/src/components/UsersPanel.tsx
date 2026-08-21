import { useState, useEffect } from "react";
import { t } from "../lib/i18n.ts";
import { platformApiBase } from "../lib/platform_api.ts";
import type { TerminalConfig } from "../lib/terminal_config.ts";

export interface SystemUser {
  id: string;
  name: string;
  email?: string;
  role: "superadmin" | "director" | "specialist" | "admin" | "organization";
  status: "active" | "paused" | "invited";
  jobTitle?: string;
  joinedAt?: string;
  isSelf?: boolean;
}

interface UsersPanelProps {
  terminalConfig: TerminalConfig;
  orgDisplayName: string;
  territorial?: boolean;
  commercial?: boolean;
}

export default function UsersPanel(props: UsersPanelProps) {
  const { terminalConfig, orgDisplayName, territorial = false, commercial = false } = props;

  const [activeTab, setActiveTab] = useState<"all" | "specialists" | "admins" | "orgs">("all");
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New user form state
  const [newUser, setNewUser] = useState<{
    name: string;
    email: string;
    role: "superadmin" | "director" | "specialist" | "admin" | "organization";
    jobTitle: string;
    sendInviteNow: boolean;
  }>({
    name: "",
    email: "",
    role: "director",
    jobTitle: "",
    sendInviteNow: true,
  });

  const [notification, setNotification] = useState<{ msg: string; ok: boolean } | null>(null);

  const parentCode =
    terminalConfig.parent_invite_code ||
    (terminalConfig.child_invite_code
      ? terminalConfig.child_invite_code.replace(/^CHILD-/, "PARENT-")
      : "PARENT-ORG");

  const flash = (msg: string, ok = true) => {
    setNotification({ msg, ok });
    setTimeout(() => setNotification(null), 4500);
  };

  const getInviteUrl = (user: SystemUser) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://ru.prevention.school";
    const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
    const baseUrl = isLocal ? "https://ru.prevention.school/terminal/staging/" : `${origin}/terminal/staging/`;
    const params = new URLSearchParams({
      parent_in: parentCode,
      role: user.role,
      email: user.email || "",
      org: orgDisplayName,
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const getMessengerText = (user: SystemUser) => {
    const roleTitle = getRoleLabel(user.role);
    return `Здравствуйте, ${user.name}!\n\nВас присоединяют к рабочему месту организации "${orgDisplayName}" в роли: ${roleTitle}.\n\nДля автоматического входа перейдите по этой готовой ссылке (все коды организации уже привязаны, вводить ничего не нужно):\n${getInviteUrl(user)}`;
  };

  const copyInviteLink = async (user: SystemUser) => {
    const url = getInviteUrl(user);
    try {
      await navigator.clipboard.writeText(url);
      flash(t("Ссылка-приглашение скопирована в буфер обмена!", "Invite link copied to clipboard!"));
    } catch (e) {
      flash(url, true);
    }
  };

  const copyMessengerText = async (user: SystemUser) => {
    const msg = getMessengerText(user);
    try {
      await navigator.clipboard.writeText(msg);
      flash(t("Текст приглашения для мессенджера скопирован!", "Messenger invite text copied!"));
    } catch (e) {
      flash(msg, true);
    }
  };

  const sendEmailInvite = async (user: SystemUser) => {
    if (!user.email) {
      alert(t("У пользователя не указан email!", "User email is not specified!"));
      return;
    }
    setLoading(true);
    try {
      const inviteUrl = getInviteUrl(user);
      const res = await fetch(`${platformApiBase()}/api/terminal/invite/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
          role: user.role,
          org_name: orgDisplayName,
          invite_link: inviteUrl,
          parent_code: parentCode,
        }),
      }).catch(() => null);

      if (res && res.ok) {
        flash(t(`Приглашение отправлено на почту ${user.email}!`, `Invite sent to ${user.email}!`), true);
      } else {
        await copyInviteLink(user);
        const subject = encodeURIComponent(`Приглашение в Терминал организации ${orgDisplayName}`);
        const body = encodeURIComponent(getMessengerText(user));
        window.open(`mailto:${user.email}?subject=${subject}&body=${body}`, "_blank");
        flash(t(`Ссылка скопирована. Открыт почтовый клиент для ${user.email}`, `Link copied. Email client opened for ${user.email}`), true);
      }
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: "invited" } : u)));
    } catch (e) {
      flash(String(e), false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initializing seed user list
    const selfUser: SystemUser = {
      id: terminalConfig.terminal_user_id || "dir-1",
      name: terminalConfig.full_name || (commercial ? "Руководитель центра" : "Директор школы"),
      email: terminalConfig.contact_email || "director@organization.ru",
      role: "director",
      status: "active",
      jobTitle: commercial ? "Директор центра" : "Директор ОУ",
      joinedAt: "2024-01-15",
      isSelf: true,
    };

    const initialUsers: SystemUser[] = [
      selfUser,
      {
        id: "spec-101",
        name: "Елена Смирнова",
        email: "e.smirnova@prevention.care",
        role: "specialist",
        status: "active",
        jobTitle: "Педагог-психолог",
        joinedAt: "2024-02-01",
      },
      {
        id: "spec-102",
        name: "Михаил Иванов",
        email: "m.ivanov@prevention.care",
        role: "specialist",
        status: "paused",
        jobTitle: "Кризисный психолог",
        joinedAt: "2024-03-10",
      },
      {
        id: "admin-201",
        name: "Ольга Ковалева",
        email: "o.kovaleva@prevention.care",
        role: "admin",
        status: "active",
        jobTitle: "Заместитель директора",
        joinedAt: "2024-01-20",
      },
    ];

    if (!commercial || territorial) {
      initialUsers.push({
        id: "org-301",
        name: "МБОУ СОШ №12 (Подключенная организация)",
        email: "school12@edu.ru",
        role: "organization",
        status: "active",
        jobTitle: "Образовательное учреждение",
        joinedAt: "2024-04-05",
      });
    }

    setUsers(initialUsers);
  }, [terminalConfig, commercial, territorial]);

  const togglePause = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === "active" ? "paused" : "active" } : u
      )
    );
  };

  const deleteUser = (id: string) => {
    if (confirm(t("Вы действительно хотите удалить этого пользователя?", "Are you sure you want to delete this user?"))) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  const saveEdit = () => {
    if (!editingUser) return;
    setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? editingUser : u)));
    setEditingUser(null);
  };

  const addUser = () => {
    if (!newUser.name.trim()) return;
    const created: SystemUser = {
      id: "u-" + Date.now(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.sendInviteNow ? "invited" : "active",
      jobTitle:
        newUser.jobTitle ||
        (newUser.role === "director"
          ? "Директор"
          : newUser.role === "specialist"
          ? "Специалист"
          : newUser.role === "admin"
          ? "Администратор"
          : "Организация"),
      joinedAt: new Date().toISOString().split("T")[0],
    };
    setUsers((prev) => [...prev, created]);
    setShowAddModal(false);
    if (newUser.sendInviteNow && newUser.email) {
      void sendEmailInvite(created);
    } else {
      flash(t("Пользователь добавлен.", "User added."), true);
    }
    setNewUser({ name: "", email: "", role: "director", jobTitle: "", sendInviteNow: true });
  };

  const transferSuperAdminRole = (targetUser: SystemUser) => {
    if (
      !confirm(
        t(
          `Вы действительно хотите передать роль Главного администратора пользователю "${targetUser.name}"? Вы передадите права владельца организации.`,
          `Are you sure you want to transfer Super Admin rights to "${targetUser.name}"? You will step down as primary owner.`
        )
      )
    ) {
      return;
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetUser.id) {
          return { ...u, role: "superadmin" };
        }
        if (u.role === "superadmin" || u.isSelf) {
          return { ...u, role: "director", isSelf: u.isSelf };
        }
        return u;
      })
    );

    flash(
      t(
        `Права Главного администратора переданы пользователю ${targetUser.name}!`,
        `Super Admin role successfully transferred to ${targetUser.name}!`
      ),
      true
    );
  };

  const filteredUsers = users.filter((u) => {
    if (activeTab === "specialists") return u.role === "specialist";
    if (activeTab === "admins") return u.role === "admin" || u.role === "director" || u.role === "superadmin";
    if (activeTab === "orgs") return u.role === "organization";
    return true;
  });

  const getRoleLabel = (role: SystemUser["role"]) => {
    switch (role) {
      case "superadmin":
        return t("👑 Главный администратор (Владелец)", "👑 Super Admin (Owner)");
      case "director":
        return t("Директор / Руководитель", "Director / Manager");
      case "specialist":
        return t("Специалист (Психолог)", "Specialist (Psychologist)");
      case "admin":
        return t("Администратор / Зам", "Admin / Vice Director");
      case "organization":
        return t("Подключенная организация", "Connected Organization");
    }
  };

  return (
    <div className="workspace-panel-stack users-panel">
      <section className="card workspace-panel">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0 }}>{t("Управление пользователями системы", "System User Management")}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {orgDisplayName} — {t("полный список пользователей, учетных записей и подчинённых организаций.", "full list of users, accounts, and connected organizations.")}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              background: "#7c3aed",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            + {t("Добавить / Пригласить", "Add / Invite User")}
          </button>
        </header>

        {/* Role Matrix Explanation Banner */}
        <div
          style={{
            background: "var(--surface-soft, #f8fafc)",
            border: "1px solid var(--line)",
            borderRadius: "10px",
            padding: "14px 16px",
            marginBottom: "20px",
            fontSize: "0.85rem",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ display: "block", marginBottom: "6px", color: "var(--text)" }}>
            💡 {t("Разграничение прав доступа и видов терминала:", "System role access matrix:")}
          </strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginTop: "8px" }}>
            <div style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", padding: "10px", borderRadius: "8px" }}>
              <strong style={{ color: "#7c3aed" }}>🛡️ Административные роли (Главный админ, Директор, Зам)</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
                Доступ к Дашборду руководителя, сводкам всей организации, аналитике, воронке заявок и управлению пользователями.
              </p>
            </div>
            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", padding: "10px", borderRadius: "8px" }}>
              <strong style={{ color: "#10b981" }}>👩‍⚕️ Специалисты (Психологи, педагоги-психологи)</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
                Работают в своем персональном <strong>Терминале специалиста</strong> (кейсы, журнал консультаций, ИПР, календарь). <strong>Не видят дашборд руководителя и управление базой организации.</strong>
              </p>
            </div>
          </div>
        </div>

        {notification && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: "8px",
              marginBottom: "16px",
              background: notification.ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
              color: notification.ok ? "#10b981" : "#ef4444",
              border: `1px solid ${notification.ok ? "#10b981" : "#ef4444"}`,
              fontSize: "0.88rem",
              fontWeight: 600,
              wordBreak: "break-all",
            }}
          >
            {notification.msg}
          </div>
        )}

        {/* Tab Filters */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "20px" }}>
          <button
            onClick={() => setActiveTab("all")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "all" ? "var(--violet)" : "var(--surface-soft)",
              color: activeTab === "all" ? "white" : "var(--text)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("Все аккаунты", "All Accounts")} ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("specialists")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "specialists" ? "var(--violet)" : "var(--surface-soft)",
              color: activeTab === "specialists" ? "white" : "var(--text)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("Специалисты", "Specialists")} ({users.filter((u) => u.role === "specialist").length})
          </button>
          <button
            onClick={() => setActiveTab("admins")}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              background: activeTab === "admins" ? "var(--violet)" : "var(--surface-soft)",
              color: activeTab === "admins" ? "white" : "var(--text)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("Администрация", "Administration")} ({users.filter((u) => u.role === "admin" || u.role === "director").length})
          </button>
          {(!commercial || territorial) && (
            <button
              onClick={() => setActiveTab("orgs")}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: "none",
                background: activeTab === "orgs" ? "var(--violet)" : "var(--surface-soft)",
                color: activeTab === "orgs" ? "white" : "var(--text)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("Организации", "Organizations")} ({users.filter((u) => u.role === "organization").length})
            </button>
          )}
        </div>

        {/* Users Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                <th style={{ padding: "10px", fontSize: "0.85rem" }}>{t("Пользователь / ФИО", "User / Full Name")}</th>
                <th style={{ padding: "10px", fontSize: "0.85rem" }}>{t("Должность / Сущность", "Job Title / Entity")}</th>
                <th style={{ padding: "10px", fontSize: "0.85rem" }}>{t("Системная роль", "System Role")}</th>
                <th style={{ padding: "10px", fontSize: "0.85rem" }}>{t("Контакты / Email", "Contacts / Email")}</th>
                <th style={{ padding: "10px", fontSize: "0.85rem" }}>{t("Статус", "Status")}</th>
                <th style={{ padding: "10px", fontSize: "0.85rem", textAlign: "right" }}>{t("Действия", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--line)", background: u.isSelf ? "rgba(124,58,237,0.03)" : "transparent" }}>
                  <td style={{ padding: "12px 10px", fontWeight: "bold", fontSize: "0.9rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {u.name}
                      {u.isSelf && (
                        <span style={{ background: "rgba(124,58,237,0.15)", color: "#7c3aed", padding: "2px 6px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700 }}>
                          {t("Ваш аккаунт", "Your Account")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "12px 10px", fontSize: "0.85rem", color: "var(--muted)" }}>{u.jobTitle || "—"}</td>
                  <td style={{ padding: "12px 10px", fontSize: "0.85rem" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background:
                          u.role === "superadmin"
                            ? "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(124,58,237,0.2) 100%)"
                            : u.role === "director"
                            ? "rgba(124,58,237,0.1)"
                            : u.role === "admin"
                            ? "rgba(59,130,246,0.1)"
                            : u.role === "organization"
                            ? "rgba(236,72,153,0.1)"
                            : "rgba(16,185,129,0.1)",
                        color:
                          u.role === "superadmin"
                            ? "#b45309"
                            : u.role === "director"
                            ? "#7c3aed"
                            : u.role === "admin"
                            ? "#3b82f6"
                            : u.role === "organization"
                            ? "#ec4899"
                            : "#10b981",
                        border: u.role === "superadmin" ? "1px solid #f59e0b" : "none",
                      }}
                    >
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td style={{ padding: "12px 10px", fontSize: "0.85rem", color: "var(--text)" }}>{u.email || "—"}</td>
                  <td style={{ padding: "12px 10px", fontSize: "0.85rem" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background:
                          u.status === "active"
                            ? "rgba(16,185,129,0.12)"
                            : u.status === "invited"
                            ? "rgba(124,58,237,0.12)"
                            : "rgba(245,158,11,0.12)",
                        color:
                          u.status === "active"
                            ? "#10b981"
                            : u.status === "invited"
                            ? "#7c3aed"
                            : "#f59e0b",
                      }}
                    >
                      {u.status === "active"
                        ? t("Активен", "Active")
                        : u.status === "invited"
                        ? t("Приглашен", "Invited")
                        : t("На паузе", "Paused")}
                    </span>
                  </td>
                  <td style={{ padding: "12px 10px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {!u.isSelf && (u.role === "director" || u.role === "admin") && (
                        <button
                          onClick={() => transferSuperAdminRole(u)}
                          title={t("Передать роль Главного администратора (Владельца)", "Transfer Super Admin / Owner role")}
                          style={{
                            background: "rgba(245,158,11,0.12)",
                            color: "#b45309",
                            border: "1px solid #f59e0b",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          👑 {t("Сделать Главным", "Make Owner")}
                        </button>
                      )}
                      {!u.isSelf && u.email && (
                        <button
                          onClick={() => void sendEmailInvite(u)}
                          title={t("Отправить инструкцию и ссылку на email", "Send instruction and link to email")}
                          style={{
                            background: "rgba(124,58,237,0.1)",
                            color: "#7c3aed",
                            border: "1px solid #7c3aed",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          ✉️ {t("Пригласить", "Invite")}
                        </button>
                      )}
                      {!u.isSelf && (
                        <button
                          onClick={() => void copyInviteLink(u)}
                          title={t("Скопировать прямую ссылку-приглашение", "Copy direct invite link")}
                          style={{
                            background: "var(--surface-soft)",
                            border: "1px solid var(--line)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          🔗 {t("Ссылка", "Link")}
                        </button>
                      )}
                      {!u.isSelf && (
                        <button
                          onClick={() => void copyMessengerText(u)}
                          title={t("Скопировать готовый текст для мессенджера", "Copy ready text for messenger")}
                          style={{
                            background: "var(--surface-soft)",
                            border: "1px solid var(--line)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          💬 {t("Текст", "Text")}
                        </button>
                      )}
                      <button
                        onClick={() => setEditingUser(u)}
                        style={{
                          background: "var(--surface-soft)",
                          border: "1px solid var(--line)",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        ✏️
                      </button>
                      {!u.isSelf && (
                        <>
                          <button
                            onClick={() => togglePause(u.id)}
                            style={{
                              background: u.status === "active" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                              color: u.status === "active" ? "#f59e0b" : "#10b981",
                              border: `1px solid ${u.status === "active" ? "#f59e0b" : "#10b981"}`,
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            {u.status === "active" ? t("Пауза", "Pause") : t("Вкл", "Activate")}
                          </button>
                          <button
                            onClick={() => deleteUser(u.id)}
                            style={{
                              background: "transparent",
                              color: "#ef4444",
                              border: "1px solid #ef4444",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Modal */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--line)",
              padding: "24px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "450px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>{t("Редактирование аккаунта", "Edit Account")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>ФИО / Наименование</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Email / Контакт</label>
                <input
                  type="email"
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Должность</label>
                <input
                  type="text"
                  value={editingUser.jobTitle || ""}
                  onChange={(e) => setEditingUser({ ...editingUser, jobTitle: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}
                />
              </div>
              {!editingUser.isSelf && (
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Системная роль</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}
                  >
                    <option value="specialist">Специалист / Психолог</option>
                    <option value="admin">Администратор / Зам</option>
                    <option value="organization">Подключенная организация</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setEditingUser(null)}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--line)", background: "transparent", cursor: "pointer" }}
              >
                {t("Отмена", "Cancel")}
              </button>
              <button
                onClick={saveEdit}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#7c3aed", color: "white", fontWeight: "bold", cursor: "pointer" }}
              >
                {t("Сохранить", "Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--surface, #ffffff)",
              border: "1px solid var(--line)",
              padding: "24px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "450px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>{t("Новый пользователь", "New User")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>ФИО / Наименование</label>
                <input
                  type="text"
                  placeholder="Иванов Иван Иванович"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Email</label>
                <input
                  type="email"
                  placeholder="user@organization.ru"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Системная роль</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}
                >
                  <option value="director">Руководитель / Директор</option>
                  <option value="specialist">Специалист / Психолог</option>
                  <option value="admin">Администратор / Зам директора</option>
                  <option value="organization">Подключенная организация</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "4px" }}>Должность</label>
                <input
                  type="text"
                  placeholder="Директор / Педагог-психолог"
                  value={newUser.jobTitle}
                  onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}
                />
              </div>
              <div style={{ marginTop: "4px" }}>
                <label style={{ fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={newUser.sendInviteNow}
                    onChange={(e) => setNewUser({ ...newUser, sendInviteNow: e.target.checked })}
                  />
                  <span>Отправить ссылку-приглашение на email</span>
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid var(--line)", background: "transparent", cursor: "pointer" }}
              >
                {t("Отмена", "Cancel")}
              </button>
              <button
                onClick={addUser}
                style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#7c3aed", color: "white", fontWeight: "bold", cursor: "pointer" }}
              >
                {t("Создать", "Create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
