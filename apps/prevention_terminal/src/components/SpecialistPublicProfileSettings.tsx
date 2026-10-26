import React, { useState, useEffect, useRef } from "react";
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

interface SpecialistExtended {
  phone: string;
  city: string;
  contacts: string;
  profProfile: string;
  education: string;
  specialization: string;
  competencies: string;
  workExperience: string;
  supervision: string;
  clientRequests: string;
  profActivity: string;
  authorPrograms: string;
  expertActivity: string;
  publications: string;
  awards: string;
  selfPresentation: string;
  additionalInfo: string;
}

const INITIAL_EXT: SpecialistExtended = {
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
  awards: "",
  selfPresentation: "",
  additionalInfo: ""
};

function parseCaseExamples(text: string): Record<string, string> {
  const markerDefs = [
    { key: "contactsLine", marker: "Контакты:" },
    { key: "education", marker: "Образование:" },
    { key: "specialization", marker: "Специализация:" },
    { key: "competencies", marker: "Компетенции:" },
    { key: "workExperience", marker: "Опыт работы:" },
    { key: "supervision", marker: "Супервизия:" },
    { key: "clientRequests", marker: "Клиентские запросы:" },
    { key: "profActivity", marker: "Активность:" },
    { key: "authorPrograms", marker: "Программы:" },
    { key: "expertActivity", marker: "Экспертность:" },
    { key: "publications", marker: "Публикации:" },
    { key: "awards", marker: "Награды:" },
    { key: "selfPresentation", marker: "О себе:" },
    { key: "additionalInfo", marker: "Дополнительно:" },
  ];

  const found: { key: string; start: number; contentStart: number }[] = [];
  for (const def of markerDefs) {
    const idx = text.indexOf(def.marker);
    if (idx !== -1) {
      found.push({
        key: def.key,
        start: idx,
        contentStart: idx + def.marker.length
      });
    }
  }

  found.sort((a, b) => a.start - b.start);

  const result: Record<string, string> = {};
  for (let i = 0; i < found.length; i++) {
    const curr = found[i];
    const next = found[i + 1];
    const rawContent = next
      ? text.substring(curr.contentStart, next.start)
      : text.substring(curr.contentStart);
    result[curr.key] = rawContent.trim();
  }

  return result;
}

export default function SpecialistPublicProfileSettings({ centerId, setupToken, terminalUserId }: Props) {
  const [profile, setProfile] = useState<Specialist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showWidgetCode, setShowWidgetCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states mapping directly to UI fields
  const [form, setForm] = useState<Partial<Specialist>>({});
  const [ext, setExt] = useState<SpecialistExtended>(INITIAL_EXT);

  const initDefaultSpec = () => {
    const defaultSpec: Specialist = {
      specialist_id: terminalUserId && terminalUserId !== "local" ? terminalUserId : "spec-" + Math.random().toString(36).substring(2, 8),
      center_id: centerId || "default-center",
      display_name: "",
      status: "published",
      published_global: true,
      price_base: 3500,
      online: true,
      problem_keys: [],
    };
    setProfile(defaultSpec);
    setForm(defaultSpec);
    setExt(INITIAL_EXT);
  };

  useEffect(() => {
    let active = true;
    const fetchProfile = async () => {
      try {
        const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists?setup_token=${setupToken}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.ok && data.specialists && data.specialists.length > 0 && active) {
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
            const parsed = parseCaseExamples(text);

            const contactsLine = parsed.contactsLine || "";
            const parts = contactsLine.split(" / ");
            const phone = parts[0] || "";
            let city = "";
            let contacts = "";
            if (parts[2] && parts[2].startsWith("Город: ")) {
              city = parts[2].substring(7);
            }
            if (parts[3]) contacts = parts.slice(3).join(" / ");

            // Parse profProfile from bio_short if not explicitly in case_examples
            let profProfile = mySpec.bio_short || "";
            const bioLines = profProfile.split("\n");
            if (bioLines.length > 1 && bioLines[bioLines.length - 1].includes(" / ")) {
              bioLines.pop();
              profProfile = bioLines.join("\n").trim();
            }

            setExt({
              phone: phone.trim(),
              city: city.trim(),
              contacts: contacts.trim(),
              profProfile: profProfile.trim(),
              education: parsed.education || "",
              specialization: parsed.specialization || "",
              competencies: parsed.competencies || "",
              workExperience: parsed.workExperience || "",
              supervision: parsed.supervision || "",
              clientRequests: parsed.clientRequests || "",
              profActivity: parsed.profActivity || "",
              authorPrograms: parsed.authorPrograms || "",
              expertActivity: parsed.expertActivity || "",
              publications: parsed.publications || "",
              awards: parsed.awards || "",
              selfPresentation: parsed.selfPresentation || "",
              additionalInfo: parsed.additionalInfo || ""
            });
          } else {
            initDefaultSpec();
          }
        } else if (active) {
          initDefaultSpec();
        }
      } catch (_err) {
        if (active) {
          initDefaultSpec();
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProfile();
    return () => { active = false; };
  }, [centerId, setupToken, terminalUserId]);

  const handleExtChange = (field: keyof SpecialistExtended, value: string) => {
    setExt(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(t("Пожалуйста, выберите изображение (JPG, PNG, WebP).", "Please select an image file (JPG, PNG, WebP)."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize image to max 400x400 to keep payload compact and fast
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setForm(f => ({ ...f, photo_url: compressedDataUrl }));
        }
      };
      if (typeof event.target?.result === "string") {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    
    const email = form.email || "";
    const bioShort = (ext.profProfile + (ext.phone || email ? '\n' + ext.phone + ' / ' + email : '')).slice(0, 499);
    
    const parts: string[] = [];
    parts.push('Контакты: ' + ext.phone + ' / ' + email + ' / Город: ' + ext.city + (ext.contacts ? ' / ' + ext.contacts : ''));
    if (ext.education) parts.push('Образование: ' + ext.education);
    if (ext.specialization) parts.push('Специализация: ' + ext.specialization);
    if (ext.competencies) parts.push('Компетенции: ' + ext.competencies);
    if (ext.workExperience) parts.push('Опыт работы: ' + ext.workExperience);
    if (ext.supervision) parts.push('Супервизия: ' + ext.supervision);
    if (ext.clientRequests) parts.push('Клиентские запросы: ' + ext.clientRequests);
    if (ext.profActivity) parts.push('Активность: ' + ext.profActivity);
    if (ext.authorPrograms) parts.push('Программы: ' + ext.authorPrograms);
    if (ext.expertActivity) parts.push('Экспертность: ' + ext.expertActivity);
    if (ext.publications) parts.push('Публикации: ' + ext.publications);
    if (ext.awards) parts.push('Награды: ' + ext.awards);
    if (ext.selfPresentation) parts.push('О себе: ' + ext.selfPresentation);
    if (ext.additionalInfo) parts.push('Дополнительно: ' + ext.additionalInfo);

    const caseExamples = parts.join('\n\n').slice(0, 3999);

    const payload = {
      ...form,
      bio_short: bioShort,
      case_examples: caseExamples
    };

    try {
      const url = `${platformApiBase()}/api/ida/centers/${centerId}/specialists/${profile.specialist_id}?setup_token=${setupToken}`;
      let res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = await res.json();
      if (!data.ok && (res.status === 404 || data.error?.includes("not_found"))) {
        const postUrl = `${platformApiBase()}/api/ida/centers/${centerId}/specialists?setup_token=${setupToken}`;
        const postRes = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, specialist_id: profile.specialist_id }),
        });
        data = await postRes.json();
      }
      if (data.ok) {
        setSuccessMsg(t("Анкета успешно сохранена.", "Profile successfully saved."));
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
    <div style={{ marginTop: "12px", padding: "24px", background: "var(--surface-soft)", borderRadius: "14px", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "1.25rem", color: "var(--text-color)" }}>{t("Анкета специалиста", "Specialist Profile")}</h3>
          <p className="muted tiny" style={{ margin: 0, lineHeight: "1.5", maxWidth: "700px" }}>
            {t(
              "Данные анкеты используются для формирования вашей карточки специалиста, публичной умной визитки с онлайн-записью, а также для каталога платформы IDA Psy и профильных центров.",
              "Profile details are used for your specialist card, public smart business card with booking, and IDA Psy platform directory."
            )}
          </p>
        </div>
      </div>

      {profile.status === 'published' && (() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ida-psy.ru';
        const cardBaseUrl = origin.includes('ida-psy.pro') ? 'https://ida-psy.pro' : 'https://ida-psy.ru';
        const displayHost = cardBaseUrl.replace(/^https?:\/\//, '');
        const fullCardUrl = `${cardBaseUrl}/p/${profile.specialist_id}`;
        const embedSnippet = `<script src="${cardBaseUrl}/ida/embed/loader.js" data-specialist-id="${profile.specialist_id}"></script>`;
        
        return (
          <div style={{ padding: "18px 20px", background: "rgba(16, 185, 129, 0.08)", border: "1.5px solid rgba(16, 185, 129, 0.3)", borderRadius: "12px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "10px" }}>
              <div>
                <strong style={{ color: "#065f46", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>✓</span> {t("Ваша Умная Визитка активна", "Your Smart Profile is active")}
                </strong>
                <a href={fullCardUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.95rem", color: "var(--violet)", textDecoration: "none", fontWeight: 700, display: "inline-block", marginTop: "4px" }}>
                  {displayHost}/p/{profile.specialist_id} ↗
                </a>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(fullCardUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  style={{ fontSize: "0.84rem", padding: "6px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", color: "var(--text-color)", cursor: "pointer", fontWeight: 600 }}
                >
                  {copiedLink ? "✓ Скопировано!" : "📋 Скопировать ссылку"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowWidgetCode(!showWidgetCode)}
                  style={{ fontSize: "0.84rem", padding: "6px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", color: "var(--text-color)", cursor: "pointer", fontWeight: 600 }}
                >
                  🌐 Код для личного сайта
                </button>
                <a
                  href={fullCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "0.84rem", padding: "6px 14px", background: "var(--violet, #0f766e)", border: "none", borderRadius: "8px", color: "#fff", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center" }}
                >
                  Открыть ↗
                </a>
              </div>
            </div>

            <p className="muted tiny" style={{ margin: "0", lineHeight: 1.5, color: "#065f46" }}>
              💡 <strong>Как это работает:</strong> По этой ссылке открывается ваша готовая страница с встроенным персональным ИИ-ассистентом. Клиенты могут описать запрос в интерактивном диалоге или записаться в 1 клик. Все заявки со структурированным резюме автоматически поступают в раздел <strong>«📥 Входящие»</strong> вашего терминала.
            </p>

            {showWidgetCode && (
              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px dashed rgba(16, 185, 129, 0.3)" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-color)" }}>
                  HTML-код кнопки записи для любого внешнего сайта (Tilda, WordPress, VK):
                </label>
                <textarea
                  readOnly
                  rows={2}
                  value={embedSnippet}
                  style={{ width: "100%", fontSize: "0.82rem", fontFamily: "monospace", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(embedSnippet);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2500);
                  }}
                  style={{ marginTop: "6px", fontSize: "0.8rem", padding: "4px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "6px", color: "var(--text-color)", cursor: "pointer", fontWeight: 600 }}
                >
                  {copiedCode ? "✓ Код скопирован!" : "📋 Скопировать код виджета"}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {error && <div style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.1)", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.9rem" }}>{error}</div>}
      {successMsg && <div style={{ color: "#10b981", background: "rgba(16, 185, 129, 0.1)", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.9rem" }}>{successMsg}</div>}

      <form onSubmit={(e) => void handleSave(e)} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* БЛОК 1: Личные данные и контакты */}
        <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>👤</span> 1. Личные данные и контакты
          </h4>

          {/* Фото профиля */}
          <div style={{ marginBottom: "18px", paddingBottom: "18px", borderBottom: "1px solid var(--line)" }}>
            <span style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}>
              Фото профиля (для карточки и визитки)
            </span>
            <p className="muted tiny" style={{ margin: "0 0 12px 0" }}>
              Загрузите фото с компьютера/телефона или укажите прямую ссылку на фотографию
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "#f1f5f9", border: "2px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {form.photo_url ? (
                  <img src={form.photo_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "2rem" }}>👤</span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: "240px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    style={{ display: "none" }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "8px 16px", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}
                  >
                    📷 Выбрать фото с устройства
                  </button>
                  {form.photo_url && (
                    <button 
                      type="button" 
                      onClick={() => setForm(f => ({ ...f, photo_url: "" }))}
                      style={{ padding: "8px 12px", background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "0.82rem" }}
                    >
                      Удалить фото
                    </button>
                  )}
                </div>
                <input 
                  type="url" 
                  value={form.photo_url || ""} 
                  onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))} 
                  placeholder="https://... или выберите файл кнопкой выше"
                  style={{ fontSize: "0.85rem" }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <label className="field">
              <span>1. Фамилия, Имя, Отчество (ФИО) *</span>
              <input 
                type="text" 
                value={form.display_name || ""} 
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} 
                placeholder="Иванова Анна Сергеевна"
                required 
              />
            </label>
            <label className="field">
              <span>Телефон / WhatsApp / Telegram *</span>
              <input 
                type="tel" 
                value={ext.phone} 
                onChange={e => handleExtChange("phone", e.target.value)} 
                placeholder="+7 (999) 000-00-00"
                required 
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <label className="field">
              <span>Электронная почта (Email) *</span>
              <input 
                type="email" 
                value={form.email || ""} 
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                placeholder="specialist@example.com"
                required 
              />
            </label>
            <label className="field">
              <span>Город проживания *</span>
              <input 
                type="text" 
                value={ext.city} 
                onChange={e => handleExtChange("city", e.target.value)} 
                placeholder="г. Москва"
                required 
              />
            </label>
          </div>

          <label className="field">
            <span>Дополнительные контакты & Соцсети</span>
            <input 
              type="text" 
              value={ext.contacts} 
              onChange={e => handleExtChange("contacts", e.target.value)} 
              placeholder="t.me/username, vk.com/psychologist"
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Ссылки на личный сайт, профессиональные страницы или мессенджеры.
            </span>
          </label>
        </div>

        {/* БЛОК 2: Образование и квалификация */}
        <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🎓</span> 2. Образование и квалификация
          </h4>
          
          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>2. Профессиональный профиль *</span>
            <input 
              type="text" 
              value={ext.profProfile} 
              onChange={e => handleExtChange("profProfile", e.target.value)} 
              placeholder="Практикующий психолог, семейный консультант"
              required 
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Краткое описание вашей профессиональной роли (например: «Практикующий психолог, детский и семейный консультант»)
            </span>
          </label>

          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>3. Образование *</span>
            <textarea 
              rows={3}
              value={ext.education} 
              onChange={e => handleExtChange("education", e.target.value)} 
              placeholder={"1. МГУ им. Ломоносова, Факультет психологии (2015 г.)\n2. Институт Практической Психологии, Базовый курс (2018 г.)"}
              required 
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Укажите основное высшее профессиональное образование + дополнительное образование в области психологии
            </span>
          </label>

          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>4. Специализация *</span>
            <input 
              type="text" 
              value={ext.specialization} 
              onChange={e => handleExtChange("specialization", e.target.value)} 
              placeholder="КПТ, системная семейная терапия, работа с детско-родительскими отношениями"
              required 
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Направления работы (КПТ, системная семейная терапия, гештальт, арт-терапия и др.)
            </span>
          </label>

          <label className="field">
            <span>5. Ключевые компетенции *</span>
            <textarea 
              rows={3}
              value={ext.competencies} 
              onChange={e => handleExtChange("competencies", e.target.value)} 
              placeholder={"— Диагностика эмоционально-волевой сферы\n— Проработка тревожности, страхов и выгорания"}
              required 
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Ваши сильные стороны и ключевые навыки в консультировании и коррекции
            </span>
          </label>
        </div>

        {/* БЛОК 3: Практика и профессиональный опыт */}
        <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>💼</span> 3. Практика и профессиональный опыт
          </h4>
          
          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>11. Опыт работы в сфере психологии и консультирования *</span>
            <textarea 
              rows={3}
              value={ext.workExperience} 
              onChange={e => handleExtChange("workExperience", e.target.value)} 
              placeholder={"Стаж: 7 лет.\n— 2020–н.в.: Частная психологическая практика\n— 2017–2020: Психологический центр сопровождения семьи"}
              required 
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Стаж работы, текущее и предыдущие места психологической практики
            </span>
          </label>

          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>12. Опыт прохождения супервизии *</span>
            <input 
              type="text" 
              value={ext.supervision} 
              onChange={e => handleExtChange("supervision", e.target.value)} 
              placeholder="120 часов групповой и индивидуальной супервизии"
              required 
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Количество часов индивидуальной/групповой супервизии и личной терапии
            </span>
          </label>

          <label className="field">
            <span>10. Клиентские запросы *</span>
            <textarea 
              rows={3}
              value={ext.clientRequests} 
              onChange={e => handleExtChange("clientRequests", e.target.value)} 
              placeholder={"— Детские страхи, тревожность, адаптация к школе\n— Кризисы в отношениях, эмоциональное выгорание"}
              required 
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              С какими трудностями и клиентскими темами вы работаете
            </span>
          </label>
        </div>

        {/* БЛОК 4: Достижения, программы и публикации */}
        <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🏆</span> 4. Достижения, программы и публикации
          </h4>
          
          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>6. Профессиональная активность</span>
            <textarea 
              rows={2}
              value={ext.profActivity} 
              onChange={e => handleExtChange("profActivity", e.target.value)} 
              placeholder="Член Профессиональной психологической ассоциации, участник интервизорских групп."
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Членство в ассоциациях и профессиональных сообществах
            </span>
          </label>

          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>7. Авторские программы</span>
            <textarea 
              rows={2}
              value={ext.authorPrograms} 
              onChange={e => handleExtChange("authorPrograms", e.target.value)} 
              placeholder="Авторская развивающая программа для детей и родителей."
            />
          </label>

          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>8. Экспертная деятельность</span>
            <textarea 
              rows={2}
              value={ext.expertActivity} 
              onChange={e => handleExtChange("expertActivity", e.target.value)} 
              placeholder="Спикер вебинаров для родителей, эксперт образовательных проектов."
            />
          </label>

          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>9. Публикации</span>
            <textarea 
              rows={2}
              value={ext.publications} 
              onChange={e => handleExtChange("publications", e.target.value)} 
              placeholder="Автор методических статей по практической психологии."
            />
          </label>

          <label className="field">
            <span>14. Награды и дипломы</span>
            <textarea 
              rows={2}
              value={ext.awards} 
              onChange={e => handleExtChange("awards", e.target.value)} 
              placeholder="Благодарственные грамоты, дипломы профессиональных конкурсов."
            />
          </label>
        </div>

        {/* БЛОК 5: Самопрезентация и дополнительная информация */}
        <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>✨</span> 5. Самопрезентация и дополнительная информация
          </h4>
          
          <label className="field mb-3" style={{ marginBottom: "16px" }}>
            <span>Самопрезентация (свободный рассказ о себе)</span>
            <textarea 
              rows={4}
              value={ext.selfPresentation} 
              onChange={e => handleExtChange("selfPresentation", e.target.value)} 
              placeholder={"Здравствуйте! В своей практике я создаю безопасную и бережную атмосферу, помогаю разобраться в сложных ситуациях и найти внутренние ресурсы. В работе опираюсь на доказательные методы..."}
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Расскажите о себе своими словами: ваши ценности, стиль общения, подход к клиентам и почему вам нравится ваша работа.
            </span>
          </label>

          <label className="field">
            <span>Дополнительная информация (заметки и пожелания)</span>
            <textarea 
              rows={3}
              value={ext.additionalInfo} 
              onChange={e => handleExtChange("additionalInfo", e.target.value)} 
              placeholder="Любые дополнительные пожелания, особенности формата работы, дни приёма или комментарии для платформы."
            />
            <span className="muted tiny" style={{ marginTop: "4px" }}>
              Свободное поле для любой информации, которую вы хотите отметить.
            </span>
          </label>
        </div>

        {/* БЛОК 6: Условия приёма, запись и видимость */}
        <div style={{ background: "var(--surface)", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)" }}>
          <h4 style={{ margin: "0 0 16px 0", color: "var(--violet)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>⚙️</span> 6. Условия приёма и публикация
          </h4>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <label className="field">
              <span>{t("Ссылка на онлайн-запись (Yclients, Dikidi, бот)", "Online Booking URL")}</span>
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
                placeholder="3500"
              />
            </label>
          </div>

          <label className="field" style={{ marginBottom: "16px" }}>
            <span>{t("Основные проблемы и темы (через запятую)", "Main problems (comma separated)")}</span>
            <input 
              type="text" 
              value={(form.problem_keys || []).join(", ")} 
              onChange={e => {
                const keys = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                setForm(f => ({ ...f, problem_keys: keys }));
              }} 
              placeholder={t("тревожность, детские страхи, детско-родительские отношения, выгорание...", "anxiety, childhood fears, parent-child relations, burnout...")}
            />
          </label>

          <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input 
                type="checkbox" 
                checked={form.online !== false} 
                onChange={e => setForm(f => ({ ...f, online: e.target.checked }))} 
              />
              <strong>{t("Консультирую онлайн", "Online consultations")}</strong>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input 
                type="checkbox" 
                checked={!!form.offline} 
                onChange={e => setForm(f => ({ ...f, offline: e.target.checked }))} 
              />
              <strong>{t("Принимаю оффлайн", "Offline consultations")}</strong>
            </label>
          </div>

          {/* Crisis and network support */}
          <div style={{ padding: "14px 16px", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "8px", marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", margin: 0 }}>
              <input 
                type="checkbox" 
                checked={form.crisis_capable !== false} 
                onChange={e => setForm(f => ({ ...f, crisis_capable: e.target.checked }))} 
                style={{ marginTop: "4px" }}
              />
              <div>
                <strong style={{ display: "block", marginBottom: "2px" }}>
                  {t("Готовность принимать сетевые запросы помощи и супервизии (ППМС / Район)", "Ready to receive network support requests & supervision")}
                </strong>
                <span style={{ fontSize: "0.83rem", color: "var(--muted)" }}>
                  {t("Коллеги из школ и центров смогут направлять анонимизированные запросы для совместного разбора сложных случаев.", "Colleagues from schools and centers can send requests for case consultations.")}
                </span>
              </div>
            </label>
          </div>

          <div style={{ padding: "14px 16px", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "8px" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer", margin: 0 }}>
              <input 
                type="checkbox" 
                checked={form.published_global !== false} 
                onChange={e => setForm(f => ({ ...f, published_global: e.target.checked }))} 
                style={{ marginTop: "4px" }}
              />
              <div>
                <strong style={{ display: "block", marginBottom: "2px" }}>
                  {t("Публикация в общем каталоге IDA Psy", "Publish in IDA Psy Global Directory")}
                </strong>
                <span style={{ fontSize: "0.83rem", color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                  {t("Разрешить показ вашей анкеты на общей странице каталога специалистов платформы IDA Psy.", "Allow displaying your profile on the main specialists page of the IDA Psy platform.")}
                </span>
                <a 
                  href="https://ida-psy.ru/specialists/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: "var(--violet)", fontSize: "0.82rem", fontWeight: 600, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={e => e.stopPropagation()}
                >
                  <span>🌐</span> {t("Посмотреть общую витрину специалистов ↗", "View public specialists directory ↗")}
                </a>
              </div>
            </label>
          </div>
        </div>

        <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "16px" }}>
          <button 
            type="submit" 
            disabled={saving} 
            className="wizard-btn wizard-btn--finish" 
            style={{ margin: 0, width: "auto", padding: "14px 36px", fontSize: "1.05rem", fontWeight: "bold", cursor: saving ? "wait" : "pointer" }}
          >
            {saving ? t("Сохранение анкеты...", "Saving Profile...") : t("✓ Сохранить анкету", "✓ Save Profile")}
          </button>
          {successMsg && <span style={{ color: "#10b981", fontWeight: 600, fontSize: "0.95rem" }}>{successMsg}</span>}
        </div>
      </form>
    </div>
  );
}
