import React from "react";
import { t } from "../../lib/i18n.ts";
import { WORKSPACE_OPTIONS, type WorkspaceId } from "../WorkspaceSwitcher.tsx";

interface ApplicationsSettingsSectionProps {
  enabledApplications: string[];
  onChangeEnabledApplications: (apps: string[]) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

interface AppPromoInfo {
  landingUrl: string;
  landingLabel: string;
  features: string[];
  audience: string;
}

const APP_PROMO_DATA: Record<string, AppPromoInfo> = {
  school: {
    landingUrl: "https://prevention-ai.ru/",
    landingLabel: "prevention-ai.ru",
    audience: "Для школьных педагогов-психологов, соцпедагогов и образовательных организаций",
    features: [
      "Учёт классов и карточек учащихся с защитой персональных данных",
      "Журнал консультаций и экспресс-диагностика психологического климата",
      "Автоматическое формирование годовых отчётов и ИПР по ФГОС в 1 клик",
      "Скрининг буллинга и алгоритмы безопасной образовательной среды",
    ],
  },
  commercial: {
    landingUrl: "https://ida-psy.ru/",
    landingLabel: "ida-psy.ru",
    audience: "Для частнопрактикующих психологов, психотерапевтов и психологических центров",
    features: [
      "Изолированная база коммерческих клиентов с договорами и учётом оплат",
      "Доказательные протоколы помощи IDA и подсказка интервенций на простом языке",
      "Встроенная защищённая видеокомната и конфиденциальные заметки сессий",
      "Генерация iCal-инвайтов для клиентов без блокировок ссылок в мессенджерах",
    ],
  },
  educator: {
    landingUrl: "https://prevention-ai.ru/teacher.html",
    landingLabel: "prevention-ai.ru/teacher.html",
    audience: "Для классных руководителей, тьюторов и учителей-предметников",
    features: [
      "Быстрый ввод наблюдений без сложного психологического «птичьего языка»",
      "Подготовка к родительским собраниям с готовыми конструктивными тезисами",
      "Раннее выявление трудных ситуаций и передача психологу без бюрократии",
    ],
  },
  creator: {
    landingUrl: "https://academy.ida-psy.ru/",
    landingLabel: "academy.ida-psy.ru",
    audience: "Для авторов курсов, лекторов, тренеров и ведущих вебинаров",
    features: [
      "Проведение живых вебинаров и видеоконференций с интерактивным залом",
      "Управление записями, монетизацией и доступом для студентов",
      "Публикация в общей афише Академии IDA с онлайн-записью слушателей",
    ],
  },
  corporate: {
    landingUrl: "https://corporate-health.ida-psy.pro/",
    landingLabel: "corporate-health.ida-psy.pro",
    audience: "Для корпоративных психологов и HR-директоров B2B-компаний",
    features: [
      "Мониторинг выгорания и стресса команд без деанонимизации сотрудников",
      "Анонимная линия психологической поддержки для персонала",
      "Агрегированная аналитика и отчёты для руководства компании",
    ],
  },
};

export default function ApplicationsSettingsSection({
  enabledApplications,
  onChangeEnabledApplications,
  onSave,
  isSaving = false,
}: ApplicationsSettingsSectionProps) {
  const currentList = enabledApplications.length > 0 ? enabledApplications : ["school"];

  const handleToggle = (id: string) => {
    let next: string[];
    if (currentList.includes(id)) {
      // Don't allow unchecking everything (keep at least one app)
      if (currentList.length === 1) return;
      next = currentList.filter((item) => item !== id);
    } else {
      next = [...currentList, id];
    }
    onChangeEnabledApplications(next);
  };

  return (
    <div className="terminal-setup-section" style={{ maxWidth: "860px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 750, color: "#0f172a", marginBottom: "8px" }}>
          {t("🧩 Мои рабочие приложения и пространства", "🧩 My Applications & Workspaces")}
        </h2>
        <p style={{ fontSize: "0.95rem", color: "#475569", lineHeight: 1.6, margin: 0 }}>
          {t(
            "Выберите направления, в которых вы работаете. Каждое приложение — это полностью отдельный рабочий стол со своими карточками людей и документами.",
            "Select the areas you work in. Each application is a completely isolated workspace with its own client cards and records.",
          )}
        </p>
      </div>

      {/* Простые и понятные пояснения «для тёти Маши из Урюпинска» */}
      <div
        style={{
          background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          border: "1px solid #cbd5e1",
          borderRadius: "14px",
          padding: "20px 22px",
          marginBottom: "28px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <span style={{ fontSize: "1.4rem" }}>💡</span>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1e293b" }}>
            {t("Как это устроено простыми словами:", "How this works in plain words:")}
          </h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "0.92rem", color: "#334155", lineHeight: 1.6 }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>🗂</span>
            <div>
              <strong style={{ color: "#0f172a" }}>
                {t("1. Полный порядок и строгая тайна данных:", "1. Total order & strict privacy:")}
              </strong>
              <br />
              {t(
                "Представьте, что у вас один письменный стол, но на нём лежат закрытые папки. В папке «Школа» лежат только ученики, классы и школьные отчёты. В папке «Частная практика» — только платные клиенты и договоры. Дети из школы никогда случайно не попадут к частным клиентам, а частные — в школьные журналы.",
                "Imagine you have one desk, but separate sealed folders on it. In 'School' you have only students and classes. In 'Private Practice' you have private clients and contracts. They never mix together.",
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>🧠</span>
            <div>
              <strong style={{ color: "#0f172a" }}>
                {t("2. Единый научный мозг платформы:", "2. Unified scientific core:")}
              </strong>
              <br />
              {t(
                "Все приложения работают на базе нашего общего искусственного интеллекта и доказательных протоколов помощи. Вам не нужно заново учить систему — весь научный опыт доступен в любом из ваших кабинетов.",
                "All applications run on our unified AI brain and evidence-based protocols.",
              )}{" "}
              <a
                href="https://prevention-ai.ru/about/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "#2563eb",
                  fontWeight: 650,
                  textDecoration: "underline",
                }}
              >
                {t("Читать подробнее о научной базе и методологии ➔", "Read more about science and methodology ➔")}
              </a>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>🗓</span>
            <div>
              <strong style={{ color: "#0f172a" }}>
                {t("3. Общий календарь без накладок:", "3. Single calendar without overbooking:")}
              </strong>
              <br />
              {t(
                "Ваше физическое время — одно. Поэтому календарь у всех приложений общий: вы сразу видите свои школьные консультации, частных клиентов и вебинары, чтобы не назначить две встречи на одно и то же время. А чтобы экран не рябил, события в календаре можно легко фильтровать галочками.",
                "Your physical time is single. The calendar prevents double-booking while allowing you to toggle filters for different event sources.",
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>🔄</span>
            <div>
              <strong style={{ color: "#0f172a" }}>
                {t("4. Как работает переключатель вверху экрана:", "4. Top bar workspace switcher:")}
              </strong>
              <br />
              {t(
                "Если вы отметите галочками больше одного приложения (например, Школу и Частную практику), в самом верху кабинета появится удобный переключатель в один клик. Если вам нужно только одно — лишние кнопки не будут мозолить глаза.",
                "If you enable more than one application, a quick switcher appears at the top. If only one is enabled, the interface stays clean.",
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Список приложений с галочками */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: "16px" }}>
          {t("Выберите активные приложения:", "Select active applications:")}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {WORKSPACE_OPTIONS.map((opt) => {
            const isChecked = currentList.includes(opt.id);
            const promo = APP_PROMO_DATA[opt.id];

            return (
              <div
                key={opt.id}
                style={{
                  borderRadius: "14px",
                  border: isChecked ? "2px solid #6366f1" : "1px solid #e2e8f0",
                  background: isChecked ? "rgba(238, 242, 255, 0.45)" : "#ffffff",
                  transition: "all 0.15s ease",
                  boxShadow: isChecked ? "0 4px 12px rgba(99, 102, 241, 0.08)" : "0 1px 3px rgba(0,0,0,0.02)",
                  overflow: "hidden",
                }}
              >
                {/* Верхняя строка с чекбоксом */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "16px",
                    padding: "16px 18px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(opt.id)}
                    style={{
                      marginTop: "4px",
                      width: "18px",
                      height: "18px",
                      accentColor: "#6366f1",
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "1.3rem" }}>{opt.icon}</span>
                      <span style={{ fontSize: "1.08rem", fontWeight: 750, color: "#0f172a" }}>
                        {opt.title}
                      </span>
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            background: opt.badgeColor ? `${opt.badgeColor}15` : "rgba(99, 102, 241, 0.1)",
                            color: opt.badgeColor || "#4f46e5",
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: "0.78rem",
                          fontWeight: 650,
                          padding: "2px 8px",
                          borderRadius: "12px",
                          background: isChecked ? "rgba(16, 185, 129, 0.15)" : "rgba(148, 163, 184, 0.15)",
                          color: isChecked ? "#059669" : "#64748b",
                        }}
                      >
                        {isChecked ? t("✓ Включено", "✓ Active") : t("Отключено", "Disabled")}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "#475569", lineHeight: 1.45 }}>
                      {opt.subtitle}
                    </p>
                  </div>
                </label>

                {/* Подробная справка, назначение и ссылка на лендинг */}
                {promo && (
                  <div
                    style={{
                      padding: "12px 18px 16px 52px",
                      borderTop: "1px dashed #e2e8f0",
                      background: isChecked ? "rgba(255, 255, 255, 0.7)" : "#fafafa",
                      fontSize: "0.85rem",
                      color: "#334155",
                    }}
                  >
                    <div style={{ marginBottom: "8px", color: "#64748b", fontWeight: 600 }}>
                      🎯 <strong>{t("Кому подходит:", "Target audience:")}</strong> {promo.audience}
                    </div>

                    <ul style={{ margin: "0 0 12px 0", paddingLeft: "18px", color: "#475569", lineHeight: 1.5 }}>
                      {promo.features.map((feat, idx) => (
                        <li key={idx} style={{ marginBottom: "3px" }}>
                          {feat}
                        </li>
                      ))}
                    </ul>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", paddingTop: "4px" }}>
                      <a
                        href={promo.landingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 12px",
                          borderRadius: "6px",
                          background: "rgba(99, 102, 241, 0.1)",
                          color: "#4f46e5",
                          fontWeight: 650,
                          fontSize: "0.82rem",
                          textDecoration: "none",
                        }}
                      >
                        🌐 {t("Сайт и демо приложения", "Website & Demo")} ({promo.landingLabel}) ➔
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {onSave && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSave}
            disabled={isSaving}
            style={{
              padding: "10px 24px",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isSaving ? t("Сохранение...", "Saving...") : t("✓ Сохранить настройки приложений", "✓ Save applications setup")}
          </button>
        </div>
      )}
    </div>
  );
}
