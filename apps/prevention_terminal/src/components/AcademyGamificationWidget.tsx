import { useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../lib/i18n.ts";
import { useAcademyProgress, ACHIEVEMENTS, getRank } from "../lib/academy_progress.ts";

export default function AcademyGamificationWidget() {
  const progress = useAcademyProgress();
  const [showAchievements, setShowAchievements] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showCert, setShowCert] = useState(false);
  const [fullName, setFullName] = useState("");

  const level = Math.floor(progress.points / 100) + 1;
  const xpInCurrentLevel = progress.points % 100;
  const rank = getRank(progress.points);
  
  const isEn = navigator.language.startsWith("en");

  // Progress metrics
  const totalLectures = 20;
  const totalTests = 3;
  const totalCases = 6;
  
  const completedLectures = (progress.readLectures || []).filter(id => typeof id === 'number' || !isNaN(Number(id))).length;
  const completedTests = (progress.completedTests || []).length;
  const completedCases = (progress.completedCases || []).length;

  const totalRequired = totalLectures + totalTests + totalCases;
  const totalCompleted = Math.min(totalRequired, completedLectures + completedTests + completedCases);
  const progressPercent = Math.round((totalCompleted / totalRequired) * 100);
  const isGraduated = completedLectures >= totalLectures && completedTests >= totalTests && completedCases >= totalCases;

  // Generate unique certificate ID
  const certId = `PS-ACAD-${(progress.points * 7 + 1043).toString(16).toUpperCase()}`;

  return (
    <div className="gamification-bar" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      height: "38px",
      minHeight: "38px",
      background: "#ffffff",
      borderBottom: "1px solid var(--border-color, #e2e8f0)",
      fontSize: "0.8rem",
      color: "var(--text-main, #1e293b)",
      boxSizing: "border-box",
      flexShrink: 0
    }}>
      {/* Left: Rank & Level */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 10px",
          borderRadius: "16px",
          background: "rgba(15, 118, 110, 0.08)",
          border: "1px solid rgba(15, 118, 110, 0.2)",
          color: "#0f766e",
          fontWeight: 700,
          fontSize: "0.8rem"
        }}>
          <span>{rank.icon}</span>
          <span>{isEn ? rank.en : rank.title}</span>
          <span style={{ opacity: 0.65, fontWeight: 500 }}>• {t("Ур.", "Lvl")} {level}</span>
        </div>

        {/* XP Mini Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "70px", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${xpInCurrentLevel}%`,
              background: "linear-gradient(90deg, #0f766e, #10b981)",
              borderRadius: "3px",
              transition: "width 0.4s ease"
            }} />
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
            {xpInCurrentLevel}/100 XP
          </span>
          <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
            ({progress.points} {t("очков", "pts")})
          </span>
        </div>
      </div>

      {/* Right: Streak, Journey Map & Cert Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: "rgba(249, 115, 22, 0.1)",
          border: "1px solid rgba(249, 115, 22, 0.25)",
          borderRadius: "14px",
          padding: "2px 8px",
          color: "#ea580c",
          fontSize: "0.75rem",
          fontWeight: 700
        }} title={t("Серия дней активности", "Daily active streak")}>
          🔥 {progress.streak} {t("дн.", "d.")}
        </div>

        {/* Journey Map Button */}
        <button 
          onClick={() => setShowMap(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "rgba(37, 99, 235, 0.08)",
            border: "1px solid rgba(37, 99, 235, 0.2)",
            color: "#2563eb",
            borderRadius: "8px",
            padding: "4px 10px",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          🗺️ {t("Карта обучения", "Journey Map")} ({progressPercent}%)
        </button>

        {/* Certificate Button (Active when graduated) */}
        <button 
          onClick={() => setShowCert(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: isGraduated ? "linear-gradient(135deg, #d97706, #b45309)" : "#f1f5f9",
            border: isGraduated ? "1px solid #d97706" : "1px solid #cbd5e1",
            color: isGraduated ? "#ffffff" : "#94a3b8",
            borderRadius: "8px",
            padding: "4px 10px",
            fontSize: "0.75rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: isGraduated ? "0 2px 5px rgba(217,119,6,0.2)" : "none"
          }}
        >
          🎓 {t("Сертификат", "Certificate")} {isGraduated ? "✨" : `(${totalCompleted}/${totalRequired})`}
        </button>

        {/* Achievements trigger button */}
        <button 
          onClick={() => setShowAchievements(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            color: "#334155",
            borderRadius: "8px",
            padding: "4px 10px",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          <span>🏆</span>
        </button>
      </div>

      {/* 1. Achievements Modal */}
      {showAchievements && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999999, backdropFilter: "blur(6px)" }} onClick={() => setShowAchievements(false)}>
          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "480px", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)", color: "#1e293b" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "700", color: "#0f766e" }}>🏆 {t("Академические Достижения", "Academic Achievements")}</h3>
              <button onClick={() => setShowAchievements(false)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {ACHIEVEMENTS.map(ach => {
                const unlocked = progress.unlockedAchievements.includes(ach.id);
                return (
                  <div key={ach.id} style={{ display: "flex", alignItems: "center", gap: "14px", background: unlocked ? "rgba(15, 118, 110, 0.06)" : "#f8fafc", border: unlocked ? "1px solid rgba(15, 118, 110, 0.25)" : "1px solid #e2e8f0", borderRadius: "12px", padding: "12px", opacity: unlocked ? 1 : 0.5 }}>
                    <span style={{ fontSize: "1.8rem" }}>{ach.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h5 style={{ margin: "0 0 2px 0", fontSize: "0.85rem", fontWeight: "700", color: unlocked ? "#0f766e" : "#64748b" }}>{isEn ? ach.nameEn : ach.name}</h5>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.3 }}>{isEn ? ach.descEn : ach.desc}</p>
                    </div>
                    {unlocked && <span style={{ fontSize: "0.7rem", color: "#0f766e", fontWeight: "700", background: "rgba(15, 118, 110, 0.1)", padding: "3px 8px", borderRadius: "6px" }}>✓ {t("Получено", "Unlocked")}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Journey Map Modal */}
      {showMap && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999999, backdropFilter: "blur(6px)" }} onClick={() => setShowMap(false)}>
          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "16px", padding: "24px", width: "90%", maxWidth: "520px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)", color: "#1e293b" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "800", color: "#2563eb" }}>🗺️ {t("Карта твоего прогресса", "Your Journey Map")}</h3>
              <button onClick={() => setShowMap(false)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            
            <div style={{ marginBottom: "20px", padding: "12px", background: "rgba(37,99,235,0.05)", border: "1px solid rgba(37,99,235,0.15)", borderRadius: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "0.85rem", marginBottom: "6px" }}>
                <span>{t("Общий прогресс обучения", "Total progress")}</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progressPercent}%`, background: "linear-gradient(90deg, #2563eb, #10b981)", borderRadius: "4px" }} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Theory Checklist */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px", fontWeight: 700 }}>
                  📚 {t("Теоретический трек", "Theory Track")} ({completedLectures}/{totalLectures})
                </h4>
                <div style={{ fontSize: "0.8rem", color: "#475569" }}>
                  {completedLectures === totalLectures ? (
                    <span style={{ color: "#0f766e", fontWeight: 600 }}>✓ {t("Все теоретические модули изучены!", "All theoretical lectures read!")}</span>
                  ) : (
                    <span>{t("Необходимо прочитать оставшиеся лекции в левой панели меню.", "Read the remaining lectures in the left panel.")}</span>
                  )}
                </div>
              </div>

              {/* Checkpoints Checklist */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px", fontWeight: 700 }}>
                  📝 {t("Контрольные рубежи", "Checkpoints")} ({completedTests}/{totalTests})
                </h4>
                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  {[1, 2, 3].map(num => {
                    const passed = (progress.completedTests || []).includes(`test-${num}`);
                    return (
                      <div key={num} style={{
                        flex: 1, padding: "8px", borderRadius: "8px", textAlign: "center", fontSize: "0.75rem",
                        background: passed ? "rgba(16, 185, 129, 0.08)" : "#f8fafc",
                        border: passed ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid #e2e8f0",
                        color: passed ? "#059669" : "#64748b", fontWeight: 600
                      }}>
                        {t(`Зачет ${num}`, `Quiz ${num}`)}: {passed ? "✓" : "○"}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Practice Simulations Checklist */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", paddingBottom: "4px", fontWeight: 700 }}>
                  🎯 {t("Клинический супервизорский трек", "Clinical Simulations")} ({completedCases}/{totalCases})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { id: "case_suicide_01", name: t("Кейс 1.1: Скрининг витальных рисков (mhGAP)", "Case 1.1: Vital risks") },
                    { id: "case_ed_01", name: t("Кейс 1.2: Первичная оценка РПП (Анорексия)", "Case 1.2: ED assessment") },
                    { id: "case_deviance_01", name: t("Кейс 2.1: Мотивационное интервью при девиации", "Case 2.1: Deviancy MI") },
                    { id: "case_panic_01", name: t("Кейс 3.1: Купирование паники (DBT)", "Case 3.1: Panic attack DBT") },
                    { id: "case_bullying_01", name: t("Кейс 4.1: Социофобия после буллинга (КПТ)", "Case 4.1: Social anxiety CBT") },
                    { id: "case_parents_01", name: t("Кейс 5.1: Конфликт Учитель-Родитель (ОРКТ)", "Case 5.1: SFBT mediation") },
                  ].map(c => {
                    const done = (progress.completedCases || []).includes(c.id);
                    return (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: "6px", background: done ? "rgba(16,185,129,0.04)" : "#fafafa", fontSize: "0.8rem", border: "1px solid #f1f5f9" }}>
                        <span style={{ color: done ? "#1e293b" : "#64748b" }}>{c.name}</span>
                        <span style={{ fontWeight: 700, color: done ? "#10b981" : "#cbd5e1" }}>{done ? "✓ Passed" : "Locked"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {isGraduated && (
              <div style={{ marginTop: "20px", textAlign: "center" }}>
                <button onClick={() => { setShowMap(false); setShowCert(true); }} className="ob-btn primary" style={{ width: "100%" }}>
                  🎓 {t("Открыть свой Сертификат выпускника!", "Generate Graduation Certificate!")}
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 3. Certificate Modal */}
      {showCert && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999999, backdropFilter: "blur(8px)" }} onClick={() => setShowCert(false)}>
          <div style={{ background: "#ffffff", borderRadius: "20px", padding: "30px", width: "95%", maxWidth: "800px", boxShadow: "0 25px 60px -15px rgba(0,0,0,0.5)", color: "#1e293b" }} onClick={(e) => e.stopPropagation()}>
            
            {/* Input name if not set */}
            {!fullName ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: "1.4rem", fontWeight: 800 }}>🎓 {t("Подтверждение квалификации", "Qualification verification")}</h3>
                <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "24px" }}>
                  {isGraduated 
                    ? t("Введите ваше полное имя для генерации официального Сертификата выпускника Академии:", "Enter your full name to generate the official Academy Graduation Certificate:")
                    : t("Вы можете предварительно просмотреть бланк сертификата. Чтобы получить официальный подписанный сертификат с уникальным номером, необходимо полностью пройти все чекпойнты и клинические симуляции.", "You can preview the certificate mockup. Complete all modules and simulations to get your unique official ID.")}
                </p>
                <div style={{ display: "flex", gap: "10px", maxWidth: "450px", margin: "0 auto" }}>
                  <input 
                    type="text" 
                    placeholder={t("Иванов Иван Иванович", "John Doe")} 
                    style={{ flex: 1, padding: "12px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "1rem" }}
                    id="cert-name-input"
                  />
                  <button 
                    onClick={() => {
                      const input = document.getElementById("cert-name-input") as HTMLInputElement;
                      if (input?.value.trim()) setFullName(input.value.trim());
                    }} 
                    className="ob-btn primary"
                  >
                    {t("Создать бланки", "Generate")}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Print area wrapper */}
                <div id="print-certificate-area" style={{
                  padding: "40px",
                  border: "12px double #0f766e",
                  borderRadius: "8px",
                  background: "#fffdf9",
                  position: "relative",
                  fontFamily: "'Georgia', serif",
                  textAlign: "center",
                  color: "#1e3a5f"
                }}>
                  {/* Decorative background watermark */}
                  <div style={{ position: "absolute", inset: 0, opacity: 0.03, pointerEvents: "none", fontSize: "10rem", display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-25deg)" }}>
                    Teenology Care
                  </div>

                  <h1 style={{ margin: "0 0 8px 0", fontSize: "2rem", letterSpacing: "1px", fontWeight: "normal", textTransform: "uppercase", color: "#0f766e" }}>
                    СЕРТИФИКАТ ВЫПУСКНИКА
                  </h1>
                  <h4 style={{ margin: "0 0 30px 0", fontSize: "0.95rem", letterSpacing: "2px", fontWeight: "normal", color: "#64748b" }}>
                    TEENOLOGY ACADEMY OF CLINICAL PREVENTION
                  </h4>

                  <p style={{ fontSize: "1rem", fontStyle: "italic", margin: "0 0 10px 0", color: "#475569" }}>
                    Настоящим подтверждается, что
                  </p>

                  <h2 style={{ fontSize: "2.2rem", fontWeight: "bold", margin: "0 0 20px 0", borderBottom: "2px solid #0f766e", display: "inline-block", padding: "0 40px 10px 40px", color: "#0f766e" }}>
                    {fullName}
                  </h2>

                  <p style={{ maxWidth: "600px", margin: "0 auto 20px auto", fontSize: "1.05rem", lineHeight: "1.6", color: "#334155" }}>
                    успешно завершил(а) полный курс обучения и клинической практики по программе <br />
                    <strong>«Разработка профилактических программ и системная психотерапия подростков»</strong>.
                  </p>

                  <p style={{ maxWidth: "550px", margin: "0 auto 30px auto", fontSize: "0.9rem", color: "#475569", lineHeight: "1.5" }}>
                    Освоил(а) пятиступенчатую матрицу Навигатора Консультанта: <br />
                    <em>mhGAP Клинический Триаж • Мотивационное интервью (OARS) • Регуляция острого аффекта (DBT) • Когнитивная реструктуризация (КПТ) • Семейные системные интервенции (ОРКТ)</em>.
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "40px", padding: "0 20px" }}>
                    <div style={{ textAlign: "left", fontSize: "0.85rem", color: "#64748b" }}>
                      <div><strong>Регистрационный номер:</strong> {certId}</div>
                      <div><strong>Статус:</strong> {isGraduated ? "Верифицирован (100% практики)" : "Предосмотр (Курс не завершен)"}</div>
                      <div><strong>Дата выдачи:</strong> {new Date().toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontStyle: "italic", fontSize: "1rem", color: "#0f766e", borderBottom: "1px dashed #cbd5e1", paddingBottom: "6px", display: "inline-block" }}>
                        Р. Г. Дубровский
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>Руководитель Академии Teenology</div>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "24px" }}>
                  <button onClick={() => setFullName("")} className="ob-btn secondary">
                    {t("← Изменить имя", "← Change Name")}
                  </button>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setShowCert(false)} className="ob-btn secondary">
                      {t("Закрыть", "Close")}
                    </button>
                    {isGraduated && (
                      <button 
                        onClick={() => {
                          const printContents = document.getElementById('print-certificate-area')?.innerHTML;
                          if (printContents) {
                            const win = window.open("", "_blank");
                            if (win) {
                              win.document.write(`
                                <html>
                                  <head>
                                    <title>Certificate - ${fullName}</title>
                                    <style>
                                      body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
                                      @media print {
                                        body { padding: 0; }
                                      }
                                    </style>
                                  </head>
                                  <body>
                                    <div style="width: 100%; max-width: 750px;">
                                      ${printContents}
                                    </div>
                                    <script>
                                      window.onload = function() {
                                        window.print();
                                        window.close();
                                      }
                                    </script>
                                  </body>
                                </html>
                              `);
                              win.document.close();
                            }
                          }
                        }} 
                        className="ob-btn primary"
                      >
                        🖨️ {t("Распечатать / Сохранить в PDF", "Print / Save PDF")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
