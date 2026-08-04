import { useState, useMemo } from "react";
import SpeechDictationButton from "./SpeechDictationButton.tsx";
import DocumentSmartChat from "./DocumentSmartChat.tsx";
import { appendDictatedChunk } from "../lib/ai_text_utils.ts";
import { CONTACT_RISK_SPHERES, CONTACT_ACTION_TAXONOMY } from "./IprContactSedFullTaxonomy.ts";
import type { ArchitectStageId } from "../lib/architect_picker.ts";

export interface ContactSedData {
  demographics?: {
    gender?: string;
    birthDate?: string;
    birthPlace?: string;
    citizenship?: string;
    registrationAddress?: string;
    actualAddress?: string;
    phone?: string;
    socialLinks?: string;
    documents?: string;
    parents?: string;
  };
  offense?: {
    basis?: string;
    articles?: string;
    clientCategory?: string;
    registrations?: string;
    isSop?: boolean;
    sopDateStart?: string;
    sopDateEnd?: string;
  };
  risks?: Record<string, string[]>; // { sphereId: [riskKey1, riskKey2] }
  actions?: {
    id: string;
    category: string;
    actionName: string;
    plannedDate?: string;
    actualDate?: string;
    executor?: string;
    notes?: string;
  }[];
  conclusions?: {
    status?: string;
    monthsExtension?: number;
    closeReason?: string;
    notes?: string;
  };
}

interface IprContactSedSectionProps {
  data: ContactSedData;
  onChange: (newData: ContactSedData) => void;
  disabled?: boolean;
  terminalUserId?: string;
  subscriptionActive: boolean;
  paywallUrl: string;
  caseVisits?: any[];
  caseArtifacts?: any;
}

export default function IprContactSedSection({
  data,
  onChange,
  disabled,
  terminalUserId,
  subscriptionActive,
  paywallUrl,
  caseVisits = [],
  caseArtifacts = {},
}: IprContactSedSectionProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "actions" | "reports">("profile");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ demographics: true });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateDemoField = (field: string, val: string) => {
    onChange({
      ...data,
      demographics: {
        ...(data.demographics || {}),
        [field]: val,
      },
    });
  };

  const updateOffenseField = (field: string, val: any) => {
    onChange({
      ...data,
      offense: {
        ...(data.offense || {}),
        [field]: val,
      },
    });
  };

  const toggleRiskItem = (sphereId: string, itemKey: string) => {
    const sphereRisks = data.risks?.[sphereId] || [];
    const newSphereRisks = sphereRisks.includes(itemKey)
      ? sphereRisks.filter((k) => k !== itemKey)
      : [...sphereRisks, itemKey];

    onChange({
      ...data,
      risks: {
        ...(data.risks || {}),
        [sphereId]: newSphereRisks,
      },
    });
  };

  // РџРѕРґСЃС‡РµС‚ СЂРёСЃРєРѕРІ РїРѕ СЃС„РµСЂР°Рј РёР· РїРѕР»РЅРѕР№ С‚Р°РєСЃРѕРЅРѕРјРёРё
  const riskStats = useMemo(() => {
    let totalCount = 0;
    const bySphere: Record<string, number> = {};
    for (const sphere of CONTACT_RISK_SPHERES) {
      const count = (data.risks?.[sphere.id] || []).length;
      bySphere[sphere.id] = count;
      totalCount += count;
    }
    return { totalCount, bySphere };
  }, [data.risks]);

  // РЈРїСЂР°РІР»РµРЅРёРµ С‚СЂСѓРґРѕРІС‹РјРё РґРµР№СЃС‚РІРёСЏРјРё
  const addAction = (category: string, defaultName: string = "") => {
    const newAct = {
      id: crypto.randomUUID(),
      category,
      actionName: defaultName,
      plannedDate: "",
      executor: "",
      notes: "",
    };
    onChange({
      ...data,
      actions: [...(data.actions || []), newAct],
    });
  };

  const updateAction = (id: string, field: string, value: any) => {
    onChange({
      ...data,
      actions: (data.actions || []).map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    });
  };

  const removeAction = (id: string) => {
    onChange({
      ...data,
      actions: (data.actions || []).filter((a) => a.id !== id),
    });
  };

  // РљРѕРЅС‚РµРєСЃС‚ РґР»СЏ РР-РїРѕРјРѕС‰РЅРёРєР°
  const serializedStateText = useMemo(() => {
    return `[РўРµРєСѓС‰Р°СЏ РєР°СЂС‚Р° СЃРѕРїСЂРѕРІРѕР¶РґР°РµРјРѕРіРѕ]
Р”РµРјРѕРіСЂР°С„РёСЏ: ${JSON.stringify(data.demographics || {})}
РЎС‚Р°С‚СЊРё/РЈС‡РµС‚ (РћС†РµРЅРєР° СЃРёС‚СѓР°С†РёРё): ${JSON.stringify(data.offense || {})}
РћС‚РјРµС‡РµРЅРЅС‹Рµ СЂРёСЃРєРё: ${JSON.stringify(data.risks || {})}
Р—Р°РїР»Р°РЅРёСЂРѕРІР°РЅРЅС‹Рµ РґРµР№СЃС‚РІРёСЏ: ${JSON.stringify(data.actions || [])}
РС‚РѕРі: ${JSON.stringify(data.conclusions || {})}`;
  }, [data]);

  // РџСЂРёРјРµРЅРµРЅРёРµ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ Р°РІС‚РѕР·Р°РїРѕР»РЅРµРЅРёСЏ РР
  const handleApplyAiFields = async (_stage: ArchitectStageId, _text: string, segments?: Record<string, string>) => {
    if (segments) {
      // РР РїСЂРёСЃР»Р°Р» СЃС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅС‹Рµ РїРѕР»СЏ
      const nextDemo = { ...data.demographics };
      const nextOffense = { ...data.offense };
      const nextRisks = { ...data.risks };

      if (segments.gender) nextDemo.gender = segments.gender.toLowerCase().includes("Р¶РµРЅ") ? "female" : "male";
      if (segments.birthPlace) nextDemo.birthPlace = segments.birthPlace;
      if (segments.citizenship) nextDemo.citizenship = segments.citizenship;
      if (segments.parents) nextDemo.parents = segments.parents;
      if (segments.actualAddress) nextDemo.actualAddress = segments.actualAddress;
      
      if (segments.basis) nextOffense.basis = segments.basis;
      if (segments.articles) nextOffense.articles = segments.articles;
      if (segments.registrations) nextOffense.registrations = segments.registrations;

      // РђРЅР°Р»РёР· СЂРёСЃРєРѕРІ
      if (segments.detected_risks) {
        try {
          const parsed = JSON.parse(segments.detected_risks);
          Object.keys(parsed).forEach((k) => {
            if (Array.isArray(parsed[k])) {
              nextRisks[k] = parsed[k];
            }
          });
        } catch {
          // fallback
        }
      }

      onChange({
        ...data,
        demographics: nextDemo,
        offense: nextOffense,
        risks: nextRisks,
      });
    }
  };

  const handleApplyAiPlan = async (_stage: ArchitectStageId, _text: string, segments?: Record<string, string>) => {
    if (segments && segments.suggested_actions) {
      try {
        const parsed = JSON.parse(segments.suggested_actions);
        if (Array.isArray(parsed)) {
          const nextActions = [...(data.actions || [])];
          parsed.forEach((act: any) => {
            if (act.category && act.actionName) {
              nextActions.push({
                id: crypto.randomUUID(),
                category: act.category,
                actionName: act.actionName,
                notes: act.notes || "",
                executor: act.executor || "",
                plannedDate: act.plannedDate || "",
              });
            }
          });
          onChange({ ...data, actions: nextActions });
        }
      } catch {
        // fallback
      }
    }
  };

  const handleApplyAiReport = async (_stage: ArchitectStageId, text: string, segments?: Record<string, string>) => {
    if (segments) {
      onChange({
        ...data,
        conclusions: {
          ...(data.conclusions || {}),
          status: segments.status || data.conclusions?.status,
          closeReason: segments.closeReason || data.conclusions?.closeReason,
          notes: text,
        }
      });
    }
  };

  return (
    <div className="ipr-contact-sed-block" style={{ marginTop: "24px" }}>
      {/* Р›РµРЅС‚Р° РїСЂРѕС€Р»С‹С… РєРѕРЅСЃСѓР»СЊС‚Р°С†РёР№ Рё РїСЂРѕС‚РѕРєРѕР»РѕРІ РЅР° СЂРµР±РµРЅРєР° */}
      <div className="visits-badge-strip" style={{ marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <span className="muted tiny" style={{ marginRight: "6px" }}>Linked case traces:</span>
        {caseVisits.length === 0 ? (
          <span className="muted tiny">No consultations.</span>
        ) : (
          caseVisits.map((v: any, idx: number) => (
            <span
              key={v.entry_id}
              className="badge"
              style={{
                fontSize: "0.8rem",
                padding: "4px 8px",
                borderRadius: "4px",
                background: "rgba(107, 114, 128, 0.1)",
                color: "var(--text-muted)",
              }}
            >
              рџ—“ Session {caseVisits.length - idx} ({v.visit_date || new Date(v.created_at).toLocaleDateString("en-US")})
            </span>
          ))
        )}

        {/* РќР°Р№РґРµРЅРЅС‹Рµ СЌРєСЃРїРµСЂС‚РЅС‹Рµ РїСЂРѕС‚РѕРєРѕР»С‹ */}
        {caseArtifacts?.expert && Object.keys(caseArtifacts.expert).map((key) => {
          const art = caseArtifacts.expert[key];
          if (!art || !art.text) return null;
          const labels: Record<string, string> = {
            conclusion: "025/u",
            fba: "FBA",
            bip: "BIP",
            child_profile: "Profile",
          };
          return (
            <span
              key={key}
              className="badge violet"
              style={{
                fontSize: "0.8rem",
                padding: "4px 8px",
                borderRadius: "4px",
                background: "rgba(139, 92, 246, 0.15)",
                color: "var(--violet)",
                fontWeight: "bold",
              }}
              title={art.text.slice(0, 200) + "..."}
            >
              рџ”¬ {labels[key] || key}
            </span>
          );
        })}
      </div>

      {/* Р’РєР»Р°РґРєРё РјРѕРґСѓР»СЏ */}
      <div className="group-session-editor-tabs" style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
        <button
          type="button"
          className={`ob-btn ${activeTab === "profile" ? "" : "secondary"}`}
          onClick={() => setActiveTab("profile")}
        >
          рџ—‚ Personal File
        </button>
        <button
          type="button"
          className={`ob-btn ${activeTab === "actions" ? "" : "secondary"}`}
          onClick={() => setActiveTab("actions")}
        >
          рџ¤ќ Social Support
        </button>
        <button
          type="button"
          className={`ob-btn ${activeTab === "reports" ? "" : "secondary"}`}
          onClick={() => setActiveTab("reports")}
        >
          рџ“Љ Reports & Summary
        </button>

        {/* РЎРІРѕРґРЅС‹Р№ РёРЅРґРёРєР°С‚РѕСЂ СЂРёСЃРєР° */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="muted tiny">Cumulative Risk Index:</span>
          <strong
            style={{
              padding: "4px 10px",
              borderRadius: "20px",
              background: riskStats.totalCount > 10 ? "rgba(239, 68, 68, 0.15)" : riskStats.totalCount > 4 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
              color: riskStats.totalCount > 10 ? "#ef4444" : riskStats.totalCount > 4 ? "#f59e0b" : "#10b981",
              border: "1px solid currentColor",
            }}
          >
            {riskStats.totalCount} {riskStats.totalCount > 10 ? "рџ”ґ High" : riskStats.totalCount > 4 ? "рџџЎ Medium" : "рџџў Low"}
          </strong>
        </div>
      </div>

      {/* в”Ђв”Ђ Р’РєР»Р°РґРєР° 1: Р›РёС‡РЅРѕРµ РґРµР»Рѕ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      {activeTab === "profile" && (
        <div className="contact-tab-content">
          <details open={openSections.demographics} className="consultation-form-section wide" style={{ marginBottom: "16px" }}>
            <summary onClick={(e) => { e.preventDefault(); toggleSection("demographics"); }}>
              1.1. Social Demographics
            </summary>
            <div className="consultation-form-section-body intake-grid">
              <label className="field intake-field">
                <span>Gender *</span>
                <select value={data.demographics?.gender || ""} onChange={(e) => updateDemoField("gender", e.target.value)} disabled={disabled}>
                  <option value="">РќРµ РІС‹Р±СЂР°РЅ</option>
                  <option value="male">РњСѓР¶СЃРєРѕР№</option>
                  <option value="female">Р–РµРЅСЃРєРёР№</option>
                </select>
              </label>
              <label className="field intake-field">
                <span>Р”Р°С‚Р° СЂРѕР¶РґРµРЅРёСЏ *</span>
                <input type="date" value={data.demographics?.birthDate || ""} onChange={(e) => updateDemoField("birthDate", e.target.value)} disabled={disabled} />
              </label>
              <label className="field intake-field">
                <span>Р“СЂР°Р¶РґР°РЅСЃС‚РІРѕ *</span>
                <input type="text" value={data.demographics?.citizenship || ""} onChange={(e) => updateDemoField("citizenship", e.target.value)} placeholder="Р РѕСЃСЃРёСЏ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ" disabled={disabled} />
              </label>
              <label className="field intake-field wide">
                <span>РњРµСЃС‚Рѕ СЂРѕР¶РґРµРЅРёСЏ *</span>
                <input type="text" value={data.demographics?.birthPlace || ""} onChange={(e) => updateDemoField("birthPlace", e.target.value)} disabled={disabled} />
              </label>
              <label className="field intake-field wide">
                <span>РђРґСЂРµСЃ СЂРµРіРёСЃС‚СЂР°С†РёРё *</span>
                <input type="text" value={data.demographics?.registrationAddress || ""} onChange={(e) => updateDemoField("registrationAddress", e.target.value)} disabled={disabled} />
              </label>
              <label className="field intake-field wide">
                <span>РђРґСЂРµСЃ С„Р°РєС‚РёС‡РµСЃРєРѕРіРѕ РїСЂРѕР¶РёРІР°РЅРёСЏ</span>
                <input type="text" value={data.demographics?.actualAddress || ""} onChange={(e) => updateDemoField("actualAddress", e.target.value)} placeholder="РЎРѕРІРїР°РґР°РµС‚ / РёРЅРѕР№" disabled={disabled} />
              </label>
              <label className="field intake-field">
                <span>РўРµР»РµС„РѕРЅ / РњРµСЃСЃРµРЅРґР¶РµСЂС‹</span>
                <input type="text" value={data.demographics?.phone || ""} onChange={(e) => updateDemoField("phone", e.target.value)} disabled={disabled} />
              </label>
              <label className="field intake-field">
                <span>РЎСЃС‹Р»РєРё РЅР° СЃРѕС†РёР°Р»СЊРЅС‹Рµ СЃРµС‚Рё</span>
                <input type="text" value={data.demographics?.socialLinks || ""} onChange={(e) => updateDemoField("socialLinks", e.target.value)} disabled={disabled} />
              </label>
              <label className="field intake-field wide">
                <span>Р”РѕРєСѓРјРµРЅС‚С‹ *</span>
                <textarea rows={2} value={data.demographics?.documents || ""} onChange={(e) => updateDemoField("documents", e.target.value)} placeholder="РџР°СЃРїРѕСЂС‚ / РЎРІРёРґРµС‚РµР»СЊСЃС‚РІРѕ Рѕ СЂРѕР¶РґРµРЅРёРё, РЎРќРР›РЎ, РїРѕР»РёСЃ..." disabled={disabled} />
              </label>
              <label className="field intake-field wide">
                <span>Р РѕРґРёС‚РµР»Рё (Р·Р°РєРѕРЅРЅС‹Рµ РїСЂРµРґСЃС‚Р°РІРёС‚РµР»Рё) *</span>
                <textarea rows={2} value={data.demographics?.parents || ""} onChange={(e) => updateDemoField("parents", e.target.value)} placeholder="Р¤РРћ, РєРѕРЅС‚Р°РєС‚С‹, СЃС‚РµРїРµРЅСЊ СЂРѕРґСЃС‚РІР°, С…Р°СЂР°РєС‚РµСЂ Р·Р°РЅСЏС‚РёР№..." disabled={disabled} />
              </label>
            </div>
          </details>

          {/* РР-Р°СЃСЃРёСЃС‚РµРЅС‚ РґР»СЏ Р·Р°РїРѕР»РЅРµРЅРёСЏ Р›РёС‡РЅРѕРіРѕ Р”РµР»Р° Рё Р РёСЃРєРѕРІ */}
          <div style={{ marginBottom: "20px" }}>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="ipr"
              documentContext={serializedStateText}
              cardSaved={true}
              onApplyResult={handleApplyAiFields}
              showFillCardButton={true}
              fillCardButtonLabel="Р—Р°РїРѕР»РЅРёС‚СЊ РїРѕР»СЏ Р›РёС‡РЅРѕРіРѕ РґРµР»Р° (РР)"
              showPlanButton={false}
              showReportButton={false}
            />
          </div>

          <h3 style={{ margin: "24px 0 12px 0", fontSize: "1.1rem" }}>РЎС„РµСЂС‹ СЂРёСЃРєРѕРІ Рё С„Р°РєС‚РѕСЂС‹ СѓСЏР·РІРёРјРѕСЃС‚Рё</h3>
          {CONTACT_RISK_SPHERES.map((sphere) => {
            const count = riskStats.bySphere[sphere.id] || 0;
            const isOpen = openSections[sphere.id] || false;

            return (
              <details key={sphere.id} open={isOpen} className="consultation-form-section wide" style={{ marginBottom: "12px" }}>
                <summary onClick={(e) => { e.preventDefault(); toggleSection(sphere.id); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{sphere.title}</span>
                  <span style={{
                    fontSize: "0.85rem",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: count > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(107, 114, 128, 0.1)",
                    color: count > 0 ? "#ef4444" : "var(--text-muted)",
                    marginLeft: "12px",
                  }}>
                    Risk factors: {count}
                  </span>
                </summary>
                <div className="consultation-form-section-body" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px" }}>
                  {sphere.items.map((item) => {
                    const checked = (data.risks?.[sphere.id] || []).includes(item.key);
                    return (
                      <label key={item.key} style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "0.95rem", padding: "4px 0" }}>
                        <input
                          type="checkbox"
                          style={{ marginTop: "4px" }}
                          checked={checked}
                          onChange={() => toggleRiskItem(sphere.id, item.key)}
                          disabled={disabled}
                        />
                        <span style={{ color: checked ? "#ef4444" : "var(--text)" }}>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* в”Ђв”Ђ Р’РєР»Р°РґРєР° 2: РЎРѕС†РёР°Р»СЊРЅРѕРµ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      {activeTab === "actions" && (
        <div className="contact-tab-content">
          {/* РР-РїРѕРјРѕС‰РЅРёРє РґР»СЏ СЃРѕР·РґР°РЅРёСЏ РїР»Р°РЅР° РјРµСЂ */}
          <div style={{ marginBottom: "20px" }}>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="ipr"
              documentContext={serializedStateText}
              cardSaved={true}
              onApplyResult={handleApplyAiPlan}
              showPlanButton={true}
              planButtonLabel="РЎРѕР·РґР°С‚СЊ РїР»Р°РЅ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёСЏ (РР)"
              showReportButton={false}
              showFillCardButton={false}
            />
          </div>

          <p className="muted tiny" style={{ marginBottom: "16px" }}>
            РўСЂСѓРґРѕРІС‹Рµ РґРµР№СЃС‚РІРёСЏ Рё РјРµСЂРѕРїСЂРёСЏС‚РёСЏ РїРѕ РЅР°РїСЂР°РІР»РµРЅРёСЏРј СЂР°Р±РѕС‚С‹. РќР°Р¶РјРёС‚Рµ В«пј‹ Р”РѕР±Р°РІРёС‚СЊВ» РІ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РµР№ РєР°С‚РµРіРѕСЂРёРё.
          </p>

          {CONTACT_ACTION_TAXONOMY.map((cat) => {
            const catActions = (data.actions || []).filter((a) => a.category === cat.id);

            return (
              <div key={cat.id} className="card" style={{ marginBottom: "16px", padding: "18px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--violet)" }}>{cat.title}</h4>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      className="tiny-select"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          addAction(cat.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      style={{ padding: "4px", fontSize: "0.85rem" }}
                      disabled={disabled}
                    >
                      <option value="">-- Р‘С‹СЃС‚СЂС‹Р№ РІС‹Р±РѕСЂ РґРµР№СЃС‚РІРёСЏ --</option>
                      {cat.actions.map((actName) => (
                        <option key={actName} value={actName}>{actName}</option>
                      ))}
                    </select>
                    <button type="button" className="ob-btn secondary tiny" onClick={() => addAction(cat.id)} disabled={disabled}>
                      пј‹ РЎРІРѕС‘ РґРµР№СЃС‚РІРёРµ
                    </button>
                  </div>
                </div>

                {catActions.length === 0 ? (
                  <p className="muted tiny">РњРµСЂРѕРїСЂРёСЏС‚РёСЏ РЅРµ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅС‹.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--line)" }}>
                        <th style={{ textAlign: "left", padding: "6px" }}>РўСЂСѓРґРѕРІРѕРµ РґРµР№СЃС‚РІРёРµ *</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "130px" }}>РџР»Р°РЅ (РґР°С‚Р°)</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "130px" }}>Fact (РґР°С‚Р°)</th>
                        <th style={{ textAlign: "left", padding: "6px", width: "160px" }}>РСЃРїРѕР»РЅРёС‚РµР»СЊ</th>
                        <th style={{ textAlign: "left", padding: "6px" }}>РџРѕСЏСЃРЅРµРЅРёСЏ РѕР¶РёРґР°РµРјС‹С…/РґРѕСЃС‚РёРіРЅСѓС‚С‹С… СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ</th>
                        <th style={{ width: "40px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {catActions.map((act) => (
                        <tr key={act.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.actionName}
                              onChange={(e) => updateAction(act.id, "actionName", e.target.value)}
                              placeholder="РўСЂСѓРґРѕРІРѕРµ РґРµР№СЃС‚РІРёРµ"
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="date"
                              value={act.plannedDate || ""}
                              onChange={(e) => updateAction(act.id, "plannedDate", e.target.value)}
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="date"
                              value={act.actualDate || ""}
                              onChange={(e) => updateAction(act.id, "actualDate", e.target.value)}
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.executor || ""}
                              onChange={(e) => updateAction(act.id, "executor", e.target.value)}
                              placeholder="РСЃРїРѕР»РЅРёС‚РµР»СЊ"
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px" }}>
                            <input
                              type="text"
                              value={act.notes || ""}
                              onChange={(e) => updateAction(act.id, "notes", e.target.value)}
                              placeholder="РўРµРєСЃС‚РѕРІРѕРµ РїРѕСЏСЃРЅРµРЅРёРµ"
                              style={{ width: "100%", padding: "4px" }}
                              disabled={disabled}
                            />
                          </td>
                          <td style={{ padding: "6px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => removeAction(act.id)}
                              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--danger)" }}
                              disabled={disabled}
                            >
                              вњ•
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* в”Ђв”Ђ Р’РєР»Р°РґРєР° 3: РћС‚С‡РµС‚С‹ Рё РС‚РѕРі в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      {activeTab === "reports" && (
        <div className="contact-tab-content">
          <div style={{ marginBottom: "20px" }}>
            <DocumentSmartChat
              terminalUserId={terminalUserId}
              subscriptionActive={subscriptionActive}
              paywallUrl={paywallUrl}
              category="ipr"
              documentContext={serializedStateText}
              cardSaved={true}
              onApplyResult={handleApplyAiReport}
              showReportButton={true}
              reportButtonLabel="РЎРѕР·РґР°С‚СЊ РѕС‚С‡РµС‚ (РР)"
              showPlanButton={false}
              showFillCardButton={false}
            />
          </div>

          <div className="contact-tab-content card" style={{ padding: "20px", border: "1px solid var(--line)" }}>
            <h4 style={{ margin: "0 0 14px 0" }}>Р РµР·СѓР»СЊС‚Р°С‚ СЃРѕС†РёР°Р»СЊРЅРѕРіРѕ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёСЏ (Р¤РѕСЂРјР° в„– 3)</h4>
            <div className="intake-grid" style={{ marginBottom: "20px" }}>
              <label className="field intake-field wide">
                <span>Р РµС€РµРЅРёРµ РїРѕ РёС‚РѕРіР°Рј СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёСЏ *</span>
                <select
                  value={data.conclusions?.status || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      conclusions: { ...(data.conclusions || {}), status: e.target.value },
                    })
                  }
                  disabled={disabled}
                >
                  <option value="">РќРµ РїСЂРёРЅСЏС‚Рѕ / РЎРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ РїСЂРѕРґРѕР»Р¶Р°РµС‚СЃСЏ</option>
                  <option value="completed">Р—Р°РІРµСЂС€РёС‚СЊ СЃРѕС†РёР°Р»СЊРЅРѕРµ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ РєР»РёРµРЅС‚Р° РІ СЃРІСЏР·Рё СЃ РІС‹РїРѕР»РЅРµРЅРёРµРј РїР»Р°РЅР° РРџР </option>
                  <option value="extended">РџСЂРѕРґР»РёС‚СЊ СЃРѕС†РёР°Р»СЊРЅРѕРµ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ</option>
                  <option value="cancelled_other">Р—Р°РІРµСЂС€РёС‚СЊ СЃРѕС†РёР°Р»СЊРЅРѕРµ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ РєР»РёРµРЅС‚Р° РїРѕ РґСЂСѓРіРёРј РїСЂРёС‡РёРЅР°Рј</option>
                </select>
              </label>

              {data.conclusions?.status === "extended" && (
                <label className="field intake-field">
                  <span>РџСЂРѕРґР»РёС‚СЊ РЅР° СЃСЂРѕРє (РєРѕР»РёС‡РµСЃС‚РІРѕ РјРµСЃСЏС†РµРІ)</span>
                  <input
                    type="number"
                    min={1}
                    value={data.conclusions?.monthsExtension || ""}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        conclusions: {
                          ...(data.conclusions || {}),
                          monthsExtension: Number.parseInt(e.target.value, 10) || undefined,
                        },
                      })
                    }
                    disabled={disabled}
                  />
                </label>
              )}

              {data.conclusions?.status === "cancelled_other" && (
                <label className="field intake-field wide">
                  <span>РћСЃРЅРѕРІР°РЅРёСЏ СЃРЅСЏС‚РёСЏ СЃ СЂРµРіР»Р°РјРµРЅС‚РЅРѕРіРѕ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёСЏ РІ РћРЎРЎРќРџ *</span>
                  <select
                    value={data.conclusions?.closeReason || ""}
                    onChange={(e) =>
                      onChange({
                        ...data,
                        conclusions: { ...(data.conclusions || {}), closeReason: e.target.value },
                      })
                    }
                    disabled={disabled}
                  >
                    <option value="">РќРµ РІС‹Р±СЂР°РЅРѕ</option>
                    <option value="transfer_oksp">РџРµСЂРµРґР°С‡Р° РІ РћРљРЎРџ РІ СЃРІСЏР·Рё СЃ СЃРѕРІРµСЂС€РµРЅРёРµРј РїСЂРµСЃС‚СѓРїР»РµРЅРёСЏ Рё РјРµСЂРѕР№ РЅРµ СЃРІСЏР·Р°РЅРЅРѕР№ СЃ Р»РёС€РµРЅРёРµРј СЃРІРѕР±РѕРґС‹</option>
                    <option value="custody_prison">Р—Р°РєР»СЋС‡РµРЅРёРµ РїРѕРґ СЃС‚СЂР°Р¶Сѓ РёР»Рё СЂРµР°Р»СЊРЅРѕРµ РѕСЃСѓР¶РґРµРЅРёРµ СЃ Р»РёС€РµРЅРёРµРј СЃРІРѕР±РѕРґС‹</option>
                    <option value="shelter">РџРѕРјРµС‰РµРЅРёРµ РєР»РёРµРЅС‚Р° РІ СЃРѕС†РёРѕР·Р°С‰РёС‚РЅРѕРµ СѓС‡СЂРµР¶РґРµРЅРёРµ</option>
                    <option value="health_oo">РџРѕРјРµС‰РµРЅРёРµ РєР»РёРµРЅС‚Р° РІ СѓС‡СЂРµР¶РґРµРЅРёРµ Р·РґСЂР°РІРѕРѕС…СЂР°РЅРµРЅРёСЏ</option>
                    <option value="social_service">РќР° СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ РІ СѓС‡СЂРµР¶РґРµРЅРёРµ СЃРѕС†РёР°Р»СЊРЅРѕРіРѕ РѕР±СЃР»СѓР¶РёРІР°РЅРёСЏ РЅР°СЃРµР»РµРЅРёСЏ (РљР¦РЎРћРќ)</option>
                    <option value="closed_school">Р’ СЃРїРµС†РёР°Р»СЊРЅРѕРµ СѓС‡РµР±РЅРѕ-РІРѕСЃРїРёС‚Р°С‚РµР»СЊРЅРѕРµ СѓС‡СЂРµР¶РґРµРЅРёРµ Р·Р°РєСЂС‹С‚РѕРіРѕ С‚РёРїР°</option>
                    <option value="relocation">РЎРјРµРЅР° РїРѕСЃС‚РѕСЏРЅРЅРѕРіРѕ РјРµСЃС‚Р° Р¶РёС‚РµР»СЊСЃС‚РІР° (РІС‹РµР·Рґ Р·Р° РїСЂРµРґРµР»С‹ РЎР°РЅРєС‚-РџРµС‚РµСЂР±СѓСЂРіР°)</option>
                    <option value="no_contact">РќРµРІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёСЏ РїРѕ РЅРµР·Р°РІРёСЃСЏС‰РёРј РїСЂРёС‡РёРЅР°Рј (РЅРµС‚ РєРѕРЅС‚Р°РєС‚Р°/РЅРµРґРѕСЃС‚СѓРїРµРЅ)</option>
                    <option value="age_18">Р”РѕСЃС‚РёР¶РµРЅРёРµ 18 Р»РµС‚</option>
                    <option value="death">РЎРјРµСЂС‚СЊ РєР»РёРµРЅС‚Р°</option>
                  </select>
                </label>
              )}

              <details open={openSections.offense} className="consultation-form-section wide" style={{ marginBottom: "16px" }}>
                <summary onClick={(e) => { e.preventDefault(); toggleSection("offense"); }}>
                  1.2. РћС†РµРЅРєР° РїСЂР°РІРѕРЅР°СЂСѓС€РµРЅРёСЏ / РїСЂРѕР±Р»РµРјС‹ (СЃС‚Р°С‚СЊРё РђРЈ Рё РЈРљ, СѓС‡РµС‚С‹)
                </summary>
                <div className="consultation-form-section-body intake-grid">
                  <label className="field intake-field wide">
                    <span>РћСЃРЅРѕРІР°РЅРёСЏ РїРѕСЃС‚Р°РЅРѕРІРєРё РЅР° СЃРѕС†РёР°Р»СЊРЅРѕРµ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ *</span>
                    <input type="text" value={data.offense?.basis || ""} onChange={(e) => updateOffenseField("basis", e.target.value)} placeholder="РџРѕСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РљР”РќРёР—Рџ, СЃРѕРѕР±С‰РµРЅРёРµ РџР”Рќ, РЅР°РїСЂР°РІР»РµРЅРёРµ РЈРР Рё С‚.Рґ." disabled={disabled} />
                  </label>
                  <label className="field intake-field wide">
                    <span>РљР»Р°СЃСЃРёС„РёРєР°С†РёСЏ РїСЂР°РІРѕРЅР°СЂСѓС€РµРЅРёСЏ (СЃС‚Р°С‚СЊРё РђРЈ Рё РЈРљ, РєРѕРјРјРµРЅС‚Р°СЂРёР№) *</span>
                    <input type="text" value={data.offense?.articles || ""} onChange={(e) => updateOffenseField("articles", e.target.value)} placeholder="РќР°РїСЂРёРјРµСЂ: СЃС‚. 20.21 РљРѕРђРџ Р Р¤ (Р°Р»РєРѕРіРѕР»СЊ), СЃС‚. 158 РЈРљ Р Р¤ (РєСЂР°Р¶Р°)" disabled={disabled} />
                  </label>
                  <label className="field intake-field">
                    <span>РљР°С‚РµРіРѕСЂРёСЏ РєР»РёРµРЅС‚Р° *</span>
                    <select value={data.offense?.clientCategory || ""} onChange={(e) => updateOffenseField("clientCategory", e.target.value)} disabled={disabled}>
                      <option value="">РќРµ РІС‹Р±СЂР°РЅР°</option>
                      <option value="adm">РЎРѕРІРµСЂС€РёРІС€РёРµ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РёРІРЅС‹Рµ РїСЂР°РІРѕРЅР°СЂСѓС€РµРЅРёСЏ</option>
                      <option value="crim_underage">РЎРѕРІРµСЂС€РёРІС€РёРµ РѕР±С‰РµСЃС‚РІРµРЅРЅРѕ-РѕРїР°СЃРЅС‹Рµ РґРµСЏРЅРёСЏ (РґРѕ РІРѕР·СЂР°СЃС‚Р° СѓРі. РѕС‚РІ.)</option>
                      <option value="crim_non_rehab">РћСЃРІРѕР±РѕР¶РґРµРЅРЅС‹Рµ РѕС‚ СѓРі. РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё РїРѕ РЅРµСЂРµР°Р±РёР»РёС‚РёСЂСѓСЋС‰РёРј РѕСЃРЅРѕРІР°РЅРёСЏРј</option>
                      <option value="prevention">Р’ С†РµР»СЏС… РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ РїСЂР°РІРѕРЅР°СЂСѓС€РµРЅРёР№</option>
                      <option value="convicted_non_custodial">РћСЃСѓР¶РґРµРЅРЅС‹Рµ Рє РЅР°РєР°Р·Р°РЅРёСЏРј Р±РµР· Р»РёС€РµРЅРёСЏ СЃРІРѕР±РѕРґС‹</option>
                      <option value="crim_prosecuted">РќР°С…РѕРґСЏС‰РёРµСЃСЏ РІ СЃС„РµСЂРµ СѓРіРѕР»РѕРІРЅРѕРіРѕ РїСЂРµСЃР»РµРґРѕРІР°РЅРёСЏ</option>
                    </select>
                  </label>
                  <label className="field intake-field">
                    <span>РљР»РёРµРЅС‚ СЃРѕСЃС‚РѕРёС‚ (СЃРѕСЃС‚РѕСЏР») РЅР° СѓС‡С‘С‚Рµ</span>
                    <input type="text" value={data.offense?.registrations || ""} onChange={(e) => updateOffenseField("registrations", e.target.value)} placeholder="РћР”Рќ РЈРњР’Р”, РљР”Рќ, РѕРїРµРєР°, РџРќР”, РќР”..." disabled={disabled} />
                  </label>
                  <div className="field intake-field wide" style={{ display: "flex", gap: "20px", alignItems: "center", marginTop: "10px" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input type="checkbox" checked={data.offense?.isSop || false} onChange={(e) => updateOffenseField("isSop", e.target.checked)} disabled={disabled} />
                      <span>РџСЂРёР·РЅР°РЅ РЅР°С…РѕРґСЏС‰РёРјСЃСЏ РІ СЃРѕС†РёР°Р»СЊРЅРѕ РѕРїР°СЃРЅРѕРј РїРѕР»РѕР¶РµРЅРёРё (РЎРћРџ)</span>
                    </label>
                    {data.offense?.isSop && (
                      <div style={{ display: "inline-flex", gap: "10px", alignItems: "center" }}>
                        <input type="date" value={data.offense?.sopDateStart || ""} onChange={(e) => updateOffenseField("sopDateStart", e.target.value)} placeholder="Р”Р°С‚Р° РїРѕСЃС‚Р°РЅРѕРІРєРё" disabled={disabled} />
                        <span>вЂ”</span>
                        <input type="date" value={data.offense?.sopDateEnd || ""} onChange={(e) => updateOffenseField("sopDateEnd", e.target.value)} placeholder="Р”Р°С‚Р° СЃРЅСЏС‚РёСЏ" disabled={disabled} />
                      </div>
                    )}
                  </div>
                </div>
              </details>

              <div className="field intake-field wide">
                <span>Р—Р°РєР»СЋС‡РёС‚РµР»СЊРЅРѕРµ С‚РµРєСЃС‚РѕРІРѕРµ СЂРµР·СЋРјРµ</span>
                <textarea
                  rows={4}
                  value={data.conclusions?.notes || ""}
                  onChange={(e) =>
                    onChange({
                      ...data,
                      conclusions: { ...(data.conclusions || {}), notes: e.target.value },
                    })
                  }
                  placeholder="РљСЂР°С‚РєРѕРµ РѕРїРёСЃР°РЅРёРµ РґРёРЅР°РјРёРєРё, СЂРµР°Р»РёР·РѕРІР°РЅРЅС‹С… РјРµСЂРѕРїСЂРёСЏС‚РёР№ Рё РёС‚РѕРіРѕРІС‹С… СЌС„С„РµРєС‚РѕРІ СЂРµР°Р±РёР»РёС‚Р°С†РёРё..."
                  disabled={disabled}
                />
                <div className="workspace-actions" style={{ marginTop: "8px" }}>
                  <SpeechDictationButton
                    onText={(chunk) =>
                      onChange({
                        ...data,
                        conclusions: {
                          ...(data.conclusions || {}),
                          notes: appendDictatedChunk(data.conclusions?.notes || "", chunk),
                        },
                      })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
