import { useState, useEffect } from "react";
import { t } from "../lib/i18n.ts";
import { platformApiBase } from "../lib/platform_api.ts";
import { problemKeyLabel } from "../lib/taxonomy_picker.ts";

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
  price_base?: number;
  online?: boolean;
  offline?: boolean;
  status: "draft" | "published";
  published_global?: boolean;
  case_examples?: string | null;
  email?: string | null;
}

interface Props {
  centerId: string;
  setupToken: string;
  terminalUserId: string;
}

function safeExtract(text: string, marker: string, nextMarker?: string): string {
  const idx = text.indexOf(marker);
  if (idx === -1) return "";
  const start = idx + marker.length;
  let end = text.length;
  if (nextMarker) {
    const nextIdx = text.indexOf(nextMarker, start);
    if (nextIdx !== -1) end = nextIdx;
  }
  return text.substring(start, end).replace(/\n\n$/, "").trim();
}

export default function SpecialistPublicProfileSettings({ centerId, setupToken, terminalUserId }: Props) {
  const [profile, setProfile] = useState<Specialist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states mapping directly to UI fields
  const [form, setForm] = useState<Partial<Specialist>>({});
  const [ext, setExt] = useState({
    phone: "",
    city: "",
    contacts: "",
    profProfile: "",
    education: "",
    specialization: "",
    competencies: "",
    workExperience: "",
    supervision: "",
    clientRequests: "",
    profActivity: "",
    authorPrograms: "",
    expertActivity: "",
    publications: "",
    awards: ""
  });

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      try {
        const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists?setup_token=${setupToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.ok && data.specialists && active) {
          const specs = data.specialists as Specialist[];
          const mySpec = specs.find(s => s.specialist_id === terminalUserId) || specs[0];
          
          if (mySpec) {
            setProfile(mySpec);
            
            let humanKeys: string[] = [];
            for (const k of (mySpec.problem_keys || [])) {
              const label = problemKeyLabel(k);
              const parts = label.split(",").map(p => p.trim());
              humanKeys.push(...parts);
            }
            humanKeys = Array.from(new Set(humanKeys));

            setForm({ ...mySpec, problem_keys: humanKeys });

            // Parse case_examples back into extended fields
            const text = mySpec.case_examples || "";
            const contactsLine = safeExtract(text, "Контакты: ", "\n\nОбразование:");
            const parts = contactsLine.split(" / ");
            const phone = parts[0] || "";
            let city = "";
            let contacts = "";
            if (parts[2] && parts[2].startsWith("Город: ")) {
              city = parts[2].substring(7);
            }
            if (parts[3]) contacts = parts.slice(3).join(" / ");

            // Parse profProfile from bio_short
            let profProfile = mySpec.bio_short || "";
            const bioLines = profProfile.split("\n");
            if (bioLines.length > 1 && bioLines[bioLines.length - 1].includes(" / ")) {
              bioLines.pop();
              profProfile = bioLines.join("\n").trim();
            }

            setExt({
              phone,
              city,
              contacts,
              profProfile,
              education: safeExtract(text, "Образование: ", "\n\nСпециализация:"),
              specialization: safeExtract(text, "Специализация: ", "\n\nКомпетенции:"),
              competencies: safeExtract(text, "Компетенции: ", "\n\nОпыт работы:"),
              workExperience: safeExtract(text, "Опыт работы: ", "\n\nСупервизия:"),
              supervision: safeExtract(text, "Супервизия: ", "\n\nКлиентские запросы:"),
              clientRequests: safeExtract(text, "Клиентские запросы: ", "\n\nАктивность:"),
              profActivity: safeExtract(text, "Активность: ", "\n\nПрограммы:"),
              authorPrograms: safeExtract(text, "Программы: ", "\n\nЭкспертность:"),
              expertActivity: safeExtract(text, "Экспертность: ", "\n\nПубликации:"),
              publications: safeExtract(text, "Публикации: ", "\n\nНаграды:"),
              awards: safeExtract(text, "Награды: ")
            });
          }
        }
      } catch (err) {
        if (active) setError(String(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProfile();
    return () => { active = false; };
  }, [centerId, setupToken, terminalUserId]);

  const handleExtChange = (field: keyof typeof ext, value: string) => {
    setExt(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    
    const email = form.email || "";
    const bioShort = (ext.profProfile + '\n' + ext.phone + ' / ' + email).slice(0, 499);
    const caseExamples = (
      'Контакты: ' + ext.phone + ' / ' + email + ' / Город: ' + ext.city + (ext.contacts ? ' / ' + ext.contacts : '') + '\n\n' +
      'Образование: ' + ext.education + '\n\n' +
      'Специализация: ' + ext.specialization + '\n\n' +
      'Компетенции: ' + ext.competencies + '\n\n' +
      'Опыт работы: ' + ext.workExperience + '\n\n' +
      'Супервизия: ' + ext.supervision + '\n\n' +
      'Клиентские запросы: ' + ext.clientRequests + '\n\n' +
      'Активность: ' + ext.profActivity + '\n\n' +
      'Программы: ' + ext.authorPrograms + '\n\n' +
      'Экспертность: ' + ext.expertActivity + '\n\n' +
      'Публикации: ' + ext.publications + '\n\n' +
      'Награды: ' + ext.awards
    ).slice(0, 3999);

    const payload = {
      ...form,
      bio_short: bioShort,
      case_examples: caseExamples
    };

    try {
      const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists/${profile.specialist_id}?setup_token=${setupToken}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(t("Анкета успешно обновлена.", "Profile successfully updated."));
        setProfile({ ...profile, ...payload });
      } else {
        setError(data.error || "Update error");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="muted tiny p-4">{t("Загрузка анкеты...", "Loading profile...")}</div>;
  if (!profile) return <div className="muted tiny p-4">{t("Анкета не найдена на сервере.", "Profile not found on server.")}</div>;

  return (
    <div style={{ marginTop: "24px", padding: "20px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px solid var(--line)" }}>
      <h3 style={{ marginTop: 0, marginBottom: "16px" }}>{t("Моя публичная анкета", "My Public Profile")}</h3>
      <p className="muted tiny" style={{ marginBottom: "20px", lineHeight: "1.5" }}>
        {t("Это публичная анкета. Она может выводиться на:", "This is a public profile. It can be displayed on:")}
        <br/>1) {t("Вашей странице-визитке", "Your personal business card page")};
        <br/>2) {t("В общем списке всех специалистов, зарегистрированных на платформе IDA PRO (галка публикации ниже)", "In the general list of specialists on IDA PRO platform (see publication checkbox below)")};
        <br/>3) {t("На сайте организации (для этого надо знать код организации и вставить его в специальное поле на вкладке настроек виджета)", "On the organization's website (requires organization code in widget settings)")}.
      </p>

      {profile.status === 'published' && (() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ida-psy.ru';
        const cardBaseUrl = (origin.includes('localhost') || origin.includes('127.0.0.1')) ? 'https://ida-psy.ru' : origin;
        const displayHost = cardBaseUrl.replace(/^https?:\/\//, '');
        const fullCardUrl = `${cardBaseUrl}/p/${profile.specialist_id}`;
        const demoCardUrl = `${cardBaseUrl}/solo-demo.html`;
        return (
          <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <strong style={{ color: "#065f46", display: "block" }}>{t("Ваша Умная Визитка активна", "Your Smart Profile is active")}</strong>
              <a href={fullCardUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.9rem", color: "var(--violet)", textDecoration: "none", fontWeight: 600 }}>
                Моя публичная анкета ({displayHost}/p/{profile.specialist_id})
              </a>
            </div>
            <a href={demoCardUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", padding: "6px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "20px", color: "var(--text-color)", textDecoration: "none" }}>
              Пример демо-визитки
            </a>
          </div>
        );
      })()}

      {error && <div style={{ color: "#ef4444", marginBottom: "16px", fontSize: "0.9rem" }}>{error}</div>}
      {successMsg && <div style={{ color: "#10b981", marginBottom: "16px", fontSize: "0.9rem" }}>{successMsg}</div>}

      <form onSubmit={(e) => void handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Basic fields */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <label className="field">
            <span>{t("Имя и фамилия", "Full Name")} *</span>
            <input 
              type="text" 
              value={form.display_name || ""} 
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} 
              required 
            />
          </label>
          <label className="field">
            <span>Email *</span>
            <input 
              type="email" 
              value={form.email || ""} 
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
              required 
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <label className="field">
            <span>Телефон / Мессенджер *</span>
            <input 
              type="tel" 
              value={ext.phone} 
              onChange={e => handleExtChange("phone", e.target.value)} 
              required 
            />
          </label>
          <label className="field">
            <span>Город проживания *</span>
            <input 
              type="text" 
              value={ext.city} 
              onChange={e => handleExtChange("city", e.target.value)} 
              required 
            />
          </label>
          <label className="field">
            <span>Дополнительные контакты / Соцсети</span>
            <input 
              type="text" 
              value={ext.contacts} 
              onChange={e => handleExtChange("contacts", e.target.value)} 
            />
          </label>
        </div>

        <label className="field">
          <span>{t("Ссылка на онлайн-запись (Yclients и др.)", "Online Booking URL")}</span>
          <input 
            type="url" 
            value={form.booking_url || ""} 
            onChange={e => setForm(f => ({ ...f, booking_url: e.target.value }))} 
            placeholder="https://"
          />
        </label>

        <label className="field">
          <span>{t("Базовая цена за сессию (₽)", "Base Session Price (₽)")}</span>
          <input 
            type="number" 
            value={form.price_base || 0} 
            onChange={e => setForm(f => ({ ...f, price_base: Number(e.target.value) }))} 
            placeholder="0"
          />
        </label>

        <label className="field">
          <span>{t("Основные проблемы (через запятую)", "Main problems (comma separated)")}</span>
          <input 
            type="text" 
            value={(form.problem_keys || []).join(", ")} 
            onChange={e => {
              const keys = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
              setForm(f => ({ ...f, problem_keys: keys }));
            }} 
            placeholder={t("тревога, депрессия, выгорание...", "anxiety, depression, burnout...")}
          />
        </label>
        
        {/* Professional profile */}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: "12px", paddingTop: "20px" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)" }}>Квалификация и образование</h4>
          
          <label className="field mb-3">
            <span>Краткое описание вашей профессиональной роли *</span>
            <input 
              type="text" 
              value={ext.profProfile} 
              onChange={e => handleExtChange("profProfile", e.target.value)} 
              placeholder="Практикующий психолог, семейный консультант"
              required 
            />
          </label>
          <label className="field mb-3">
            <span>Образование *</span>
            <textarea 
              rows={3}
              value={ext.education} 
              onChange={e => handleExtChange("education", e.target.value)} 
              required 
            />
          </label>
          <label className="field mb-3">
            <span>Специализация *</span>
            <input 
              type="text" 
              value={ext.specialization} 
              onChange={e => handleExtChange("specialization", e.target.value)} 
              required 
            />
          </label>
          <label className="field">
            <span>Ключевые компетенции *</span>
            <textarea 
              rows={3}
              value={ext.competencies} 
              onChange={e => handleExtChange("competencies", e.target.value)} 
              required 
            />
          </label>
        </div>

        {/* Experience */}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: "12px", paddingTop: "20px" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)" }}>Практика и профессиональный опыт</h4>
          
          <label className="field mb-3">
            <span>Опыт работы в сфере психологии и консультирования *</span>
            <textarea 
              rows={3}
              value={ext.workExperience} 
              onChange={e => handleExtChange("workExperience", e.target.value)} 
              required 
            />
          </label>
          <label className="field mb-3">
            <span>Опыт прохождения супервизии *</span>
            <input 
              type="text" 
              value={ext.supervision} 
              onChange={e => handleExtChange("supervision", e.target.value)} 
              required 
            />
          </label>
          <label className="field">
            <span>Клиентские запросы *</span>
            <textarea 
              rows={3}
              value={ext.clientRequests} 
              onChange={e => handleExtChange("clientRequests", e.target.value)} 
              required 
            />
          </label>
        </div>

        {/* Activity & Awards */}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: "12px", paddingTop: "20px" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)" }}>Достижения, программы и публикации</h4>
          
          <label className="field mb-3">
            <span>Профессиональная активность</span>
            <textarea 
              rows={2}
              value={ext.profActivity} 
              onChange={e => handleExtChange("profActivity", e.target.value)} 
            />
          </label>
          <label className="field mb-3">
            <span>Авторские программы</span>
            <textarea 
              rows={2}
              value={ext.authorPrograms} 
              onChange={e => handleExtChange("authorPrograms", e.target.value)} 
            />
          </label>
          <label className="field mb-3">
            <span>Экспертная деятельность</span>
            <textarea 
              rows={2}
              value={ext.expertActivity} 
              onChange={e => handleExtChange("expertActivity", e.target.value)} 
            />
          </label>
          <label className="field mb-3">
            <span>Публикации</span>
            <textarea 
              rows={2}
              value={ext.publications} 
              onChange={e => handleExtChange("publications", e.target.value)} 
            />
          </label>
          <label className="field">
            <span>Награды и дипломы</span>
            <textarea 
              rows={2}
              value={ext.awards} 
              onChange={e => handleExtChange("awards", e.target.value)} 
            />
          </label>
        </div>

        {/* Config / Categories */}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: "12px", paddingTop: "20px" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)" }}>Категории приема</h4>
          <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input 
                type="checkbox" 
                checked={!!form.online} 
                onChange={e => setForm(f => ({ ...f, online: e.target.checked }))} 
              />
              {t("Консультирую онлайн", "Online consultations")}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input 
                type="checkbox" 
                checked={!!form.offline} 
                onChange={e => setForm(f => ({ ...f, offline: e.target.checked }))} 
              />
              {t("Принимаю оффлайн", "Offline consultations")}
            </label>
          </div>

          <div style={{ padding: "16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", margin: 0 }}>
              <input 
                type="checkbox" 
                checked={!!form.published_global} 
                onChange={e => setForm(f => ({ ...f, published_global: e.target.checked }))} 
                style={{ marginTop: "4px" }}
              />
              <div>
                <strong style={{ display: "block", marginBottom: "4px" }}>
                  {t("Публикация в общем каталоге IDA Pro", "Publish in IDA Pro Global Directory")}
                </strong>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {t("Разрешить показ вашей анкеты на главной странице специалистов платформы, помимо вашего центра.", "Allow displaying your profile on the main specialists page of the platform, in addition to your center.")}
                </span>
              </div>
            </label>
          </div>
        </div>

        <div style={{ marginTop: "8px" }}>
          <button type="submit" disabled={saving} className="wizard-btn wizard-btn--finish" style={{ margin: 0, width: "auto", padding: "12px 32px", fontSize: "1.05rem", fontWeight: "bold" }}>
            {saving ? t("Сохранение...", "Saving...") : t("Сохранить анкету", "Save Profile")}
          </button>
        </div>
      </form>
    </div>
  );
}
