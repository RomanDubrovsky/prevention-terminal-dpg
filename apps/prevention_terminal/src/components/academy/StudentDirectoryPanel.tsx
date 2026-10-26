import React, { useState } from "react";
import {
  getAcademyStudents,
  saveAcademyStudent,
  updateStudentStatus,
  type AcademyStudent,
} from "../../lib/academy_lms_store.ts";

export const StudentDirectoryPanel: React.FC = () => {
  const [students, setStudents] = useState<AcademyStudent[]>(() => getAcademyStudents());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "completed">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Student Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCourse, setNewCourse] = useState("Базовый курс психологического консультирования и КПТ");

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleToggleStatus = (student: AcademyStudent) => {
    const nextStatus = student.status === "active" ? "suspended" : "active";
    updateStudentStatus(student.id, nextStatus);
    setStudents(getAcademyStudents());
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const newStudent: AcademyStudent = {
      id: "stud-" + Date.now(),
      name: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim() || undefined,
      enrolledCourse: newCourse,
      enrolledAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      progressPercent: 0,
      completedLessonsCount: 0,
      totalLessonsCount: 25,
      homeworkCompletedCount: 0,
      status: "active",
    };

    saveAcademyStudent(newStudent);
    setStudents(getAcademyStudents());
    setIsAddModalOpen(false);
    setNewName("");
    setNewEmail("");
    setNewPhone("");
  };

  return (
    <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "#0f172a" }}>
            👥 Студенты и прогресс обучения
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
            Управление доступом, отслеживание прохождения уроков и сдачи заданий
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          style={{
            background: "#4f46e5",
            color: "#fff",
            border: "none",
            padding: "9px 18px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)",
          }}
        >
          + Зачислить студента
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e293b" }}>{students.length}</div>
          <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Всего слушателей</div>
        </div>
        <div style={{ background: "#ecfdf5", padding: "14px 16px", borderRadius: "10px", border: "1px solid #a7f3d0" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#059669" }}>
            {students.filter((s) => s.status === "active").length}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#065f46" }}>Активный доступ</div>
        </div>
        <div style={{ background: "#fffbeb", padding: "14px 16px", borderRadius: "10px", border: "1px solid #fde68a" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#d97706" }}>
            {students.filter((s) => s.status === "suspended").length}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#92400e" }}>Заморожен доступ</div>
        </div>
        <div style={{ background: "#eff6ff", padding: "14px 16px", borderRadius: "10px", border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#2563eb" }}>
            {Math.round(students.reduce((acc, s) => acc + s.progressPercent, 0) / (students.length || 1))}%
          </div>
          <div style={{ fontSize: "0.8rem", color: "#1e40af" }}>Средний прогресс</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Поиск по имени или email..."
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            fontSize: "0.85rem",
          }}
        />
        <div style={{ display: "flex", gap: "6px" }}>
          {(["all", "active", "suspended", "completed"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? "#1e293b" : "#f1f5f9",
                color: statusFilter === st ? "#fff" : "#475569",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {st === "all" && "Все"}
              {st === "active" && "Активные"}
              {st === "suspended" && "Замороженные"}
              {st === "completed" && "Завершили"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", textAlign: "left", color: "#475569" }}>
              <th style={{ padding: "10px 12px" }}>Студент</th>
              <th style={{ padding: "10px 12px" }}>Курс</th>
              <th style={{ padding: "10px 12px", width: "160px" }}>Прогресс</th>
              <th style={{ padding: "10px 12px" }}>Задания</th>
              <th style={{ padding: "10px 12px" }}>Статус доступа</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                  Студентов не найдено
                </td>
              </tr>
            ) : (
              filteredStudents.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px" }}>
                    <div style={{ fontWeight: 700, color: "#1e293b" }}>{s.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{s.email}</div>
                    {s.phone && <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{s.phone}</div>}
                  </td>
                  <td style={{ padding: "12px", color: "#334155" }}>
                    <div style={{ maxWidth: "220px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.enrolledCourse}>
                      {s.enrolledCourse}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                      Зачислен: {new Date(s.enrolledAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.75rem" }}>
                      <span style={{ fontWeight: 700, color: "#1e293b" }}>{s.progressPercent}%</span>
                      <span style={{ color: "#64748b" }}>{s.completedLessonsCount}/{s.totalLessonsCount} уроков</span>
                    </div>
                    <div style={{ background: "#e2e8f0", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          background: s.progressPercent > 70 ? "#10b981" : "#4f46e5",
                          width: `${s.progressPercent}%`,
                          height: "100%",
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px", fontWeight: 600, color: "#334155" }}>
                      📝 {s.homeworkCompletedCount} сдано
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        background:
                          s.status === "active"
                            ? "#dcfce7"
                            : s.status === "suspended"
                            ? "#fee2e2"
                            : "#f3f4f6",
                        color:
                          s.status === "active"
                            ? "#15803d"
                            : s.status === "suspended"
                            ? "#b91c1c"
                            : "#4b5563",
                      }}
                    >
                      {s.status === "active" ? "✓ Активен" : s.status === "suspended" ? "⏸️ Заморожен" : "Завершил"}
                    </span>
                  </td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(s)}
                      style={{
                        background: s.status === "active" ? "#fee2e2" : "#dcfce7",
                        color: s.status === "active" ? "#b91c1c" : "#15803d",
                        border: "none",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {s.status === "active" ? "Заморозить" : "Открыть доступ"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
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
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "14px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: 800 }}>
              👤 Зачислить нового студента
            </h4>
            <form onSubmit={handleAddStudent}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "4px" }}>
                  ФИО студента *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Иван Петров"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "4px" }}>
                  Email (логин для входа) *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ivan@gmail.com"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "4px" }}>
                  Телефон (необязательно)
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+7 (999) 000-00-00"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: "4px" }}>
                  Курс
                </label>
                <select
                  value={newCourse}
                  onChange={(e) => setNewCourse(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="Базовый курс психологического консультирования и КПТ">
                    Базовый курс психологического консультирования и КПТ
                  </option>
                  <option value="Углубленный курс: Травмотерапия и ДПДГ">
                    Углубленный курс: Травмотерапия и ДПДГ
                  </option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ background: "#f1f5f9", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "6px", fontWeight: 700, cursor: "pointer" }}
                >
                  Зачислить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
