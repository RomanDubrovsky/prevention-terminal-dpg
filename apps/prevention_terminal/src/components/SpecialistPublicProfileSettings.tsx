import { useState, useEffect } from "react";
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
  status: "draft" | "published";
}

interface Props {
  centerId: string;
  setupToken: string;
  terminalUserId: string; // Used as specialist_id on the backend in most cases
}

export default function SpecialistPublicProfileSettings({ centerId, setupToken, terminalUserId }: Props) {
  const [profile, setProfile] = useState<Specialist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Draft form
  const [form, setForm] = useState<Partial<Specialist>>({});

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
            setForm(mySpec);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    
    try {
      const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists/${profile.specialist_id}?setup_token=${setupToken}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(t("Анкета успешно обновлена.", "Profile successfully updated."));
        setProfile({ ...profile, ...form });
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
      <p className="muted tiny" style={{ marginBottom: "20px" }}>
        {t("Эти данные отображаются в каталоге специалистов на сайте вашего центра.", "This data is shown in the specialist directory on your center's website.")}
      </p>

      {error && <div style={{ color: "#ef4444", marginBottom: "16px", fontSize: "0.9rem" }}>{error}</div>}
      {successMsg && <div style={{ color: "#10b981", marginBottom: "16px", fontSize: "0.9rem" }}>{successMsg}</div>}

      <form onSubmit={(e) => void handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <label className="field">
          <span>{t("Имя и фамилия", "Full Name")}</span>
          <input 
            type="text" 
            value={form.display_name || ""} 
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} 
            required 
          />
        </label>
        
        <label className="field">
          <span>{t("Краткое био", "Short Bio")}</span>
          <textarea 
            rows={4}
            value={form.bio_short || ""} 
            onChange={e => setForm(f => ({ ...f, bio_short: e.target.value }))} 
            placeholder={t("Расскажите о себе, методах работы и специализации...", "Tell us about yourself, methods and specialization...")}
          />
        </label>

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

        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
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

        <div style={{ marginTop: "8px" }}>
          <button type="submit" disabled={saving} className="wizard-btn wizard-btn--finish" style={{ margin: 0, width: "auto", padding: "8px 24px" }}>
            {saving ? t("Сохранение...", "Saving...") : t("Сохранить анкету", "Save Profile")}
          </button>
        </div>
      </form>
    </div>
  );
}
