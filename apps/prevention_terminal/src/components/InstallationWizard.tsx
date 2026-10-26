import { useCallback, useEffect, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  ORGANIZATION_TYPE_LABEL,
  ORGANIZATION_TYPES,
  validateInstallationDraft,
  type InstallationMeta,
  type InstallationMetaInput,
  type OrganizationType,
} from "../lib/installation_meta.ts";
import {
  DEFAULT_ORG_PROFILE,
  DEFAULT_SPECIALIST_PROFILE,
  ISCED_LEVEL_LABEL,
  ORG_KIND_LABEL,
  validateOrgProfileDraft,
  validateSpecialistProfileDraft,
  ORG_SPHERE_LABEL,
  ORG_SPHERE_VALUES,
  type OrgSphere,
  type OrgProfile,
  type OrgProfileInput,
  type SpecialistProfile,
  type SpecialistProfileInput,
} from "../lib/terminal_profiles.ts";
import {
  ISCED_LEVEL_VALUES,
  ORG_KIND_VALUES,
  type IscedLevel,
  type OrgKind,
} from "../lib/taxonomy.ts";

interface InstallationWizardProps {
  onCompleted: (payload: {
    meta: InstallationMeta;
    orgProfile: OrgProfile;
    specialistProfile: SpecialistProfile;
  }) => void;
}

const DEFAULT_DRAFT: InstallationMetaInput = {
  country: "RU",
  region: "",
  municipality: "",
  settlement: "",
  organization_type: "school",
  organization_label: "",
  telemetry_consent: false,
};

type WizardStep = "org" | "specialist";

export default function InstallationWizard(props: InstallationWizardProps) {
  const { onCompleted } = props;
  const [draft, setDraft] = useState<InstallationMetaInput>(DEFAULT_DRAFT);
  const [orgDraft, setOrgDraft] = useState<OrgProfileInput>(DEFAULT_ORG_PROFILE);
  const [specialistDraft, setSpecialistDraft] =
    useState<SpecialistProfileInput>(DEFAULT_SPECIALIST_PROFILE);
  const [step, setStep] = useState<WizardStep>("org");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      invoke<InstallationMeta | null>("installation_get_meta"),
      invoke<OrgProfile | null>("db_get_org_profile"),
      invoke<SpecialistProfile | null>("db_get_specialist_profile"),
    ])
      .then(([meta, orgProfile, specialistProfile]) => {
        if (!alive) return;
        if (meta) {
          setDraft({
            country: meta.country || DEFAULT_DRAFT.country,
            region: meta.region,
            municipality: meta.municipality,
            settlement: meta.settlement,
            organization_type: (meta.organization_type || "school") as OrganizationType,
            organization_label: meta.organization_label,
            telemetry_consent: meta.telemetry_consent,
          });
        }
        if (orgProfile) {
          let orgSphere = orgProfile.org_sphere || "education_system";
          if (orgSphere as string === "education") {
            orgSphere = "education_system";
          }
          let orgKind = orgProfile.org_kind;
          if (orgKind as string === "school") {
            orgKind = "combined_school";
          }
          setOrgDraft({
            display_name: orgProfile.display_name,
            isced_level: orgProfile.isced_level,
            org_kind: orgKind,
            org_sphere: orgSphere,
            normative_overrides: orgProfile.normative_overrides || "{}",
          });
        }
        if (specialistProfile) {
          setSpecialistDraft({
            display_name: specialistProfile.display_name,
            role_text: specialistProfile.role_text,
            weekly_contract_minutes: specialistProfile.weekly_contract_minutes,
          });
        }
      })
      .catch((err) => setError(`Не удалось загрузить текущие профили: ${String(err)}`));
    return () => {
      alive = false;
    };
  }, []);

  const setField = useCallback(
    <K extends keyof InstallationMetaInput>(key: K, value: InstallationMetaInput[K]) => {
      setError(null);
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setOrgField = useCallback(
    <K extends keyof OrgProfileInput>(key: K, value: OrgProfileInput[K]) => {
      setError(null);
      setOrgDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setSpecialistField = useCallback(
    <K extends keyof SpecialistProfileInput>(key: K, value: SpecialistProfileInput[K]) => {
      setError(null);
      setSpecialistDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const goNext = useCallback(() => {
    const installationValidation = validateInstallationDraft(draft);
    if (installationValidation) {
      setError(installationValidation);
      return;
    }
    const orgValidation = validateOrgProfileDraft(orgDraft);
    if (orgValidation) {
      setError(orgValidation);
      return;
    }
    setError(null);
    setStep("specialist");
  }, [draft, orgDraft]);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const validation = validateInstallationDraft(draft);
      if (validation) {
        setError(validation);
        return;
      }
      const orgValidation = validateOrgProfileDraft(orgDraft);
      if (orgValidation) {
        setError(orgValidation);
        setStep("org");
        return;
      }
      const specialistValidation = validateSpecialistProfileDraft(specialistDraft);
      if (specialistValidation) {
        setError(specialistValidation);
        return;
      }
      setBusy(true);
      try {
        const meta = await invoke<InstallationMeta>("installation_save_meta", {
          input: draft,
        });
        await invoke("db_save_org_profile", { payload: orgDraft });
        await invoke("db_save_specialist_profile", { payload: specialistDraft });
        const [orgProfile, specialistProfile] = await Promise.all([
          invoke<OrgProfile | null>("db_get_org_profile"),
          invoke<SpecialistProfile | null>("db_get_specialist_profile"),
        ]);
        if (!orgProfile || !specialistProfile) {
          throw new Error("profiles were not saved");
        }
        onCompleted({ meta, orgProfile, specialistProfile });
      } catch (err) {
        setError(`Не удалось сохранить профили Терминала: ${String(err)}`);
      } finally {
        setBusy(false);
      }
    },
    [draft, onCompleted, orgDraft, specialistDraft],
  );

  return (
    <section className="card installation-wizard">
      <h2>Первичная настройка Терминала</h2>
      <p className="muted">
        Мастер-пароль уже создан. Теперь запишем локальные профили организации
        и специалиста в SQLCipher. Эти данные не содержат клиентских персональных данных.
      </p>

      <div className="wizard-steps" aria-label="Шаги настройки">
        <button type="button" className={step === "org" ? "active" : ""} onClick={() => setStep("org")}>
          1. Организация
        </button>
        <button
          type="button"
          className={step === "specialist" ? "active" : ""}
          onClick={goNext}
        >
          2. Специалист
        </button>
      </div>

      <form className="installation-form" onSubmit={handleSubmit}>
        {step === "org" ? (
          <>
            <label className="field">
              <span>Страна</span>
              <select
                value={draft.country}
                onChange={(event) => setField("country", event.target.value)}
                disabled={busy}
              >
                <option value="RU">Россия</option>
                <option value="GE">Грузия</option>
                <option value="KZ">Казахстан</option>
                <option value="OTHER">Другая страна</option>
              </select>
            </label>

            <TextField
              label="Регион / область / штат"
              value={draft.region}
              onChange={(value) => setField("region", value)}
              placeholder="Например: Москва, Московская область, Татарстан"
              disabled={busy}
            />
            <TextField
              label="Муниципалитет / район"
              value={draft.municipality}
              onChange={(value) => setField("municipality", value)}
              placeholder="Например: ЦАО, Одинцовский район"
              disabled={busy}
            />
            <TextField
              label="Населённый пункт"
              value={draft.settlement}
              onChange={(value) => setField("settlement", value)}
              placeholder="Например: Москва, Одинцово"
              disabled={busy}
            />

            <label className="field">
              <span>Тип организации для каталога</span>
              <select
                value={draft.organization_type}
                onChange={(event) =>
                  setField("organization_type", event.target.value as OrganizationType)
                }
                disabled={busy}
              >
                {ORGANIZATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ORGANIZATION_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </label>

            <TextField
              label="Название организации"
              value={draft.organization_label}
              onChange={(value) => {
                setField("organization_label", value);
                if (!orgDraft.display_name || orgDraft.display_name === draft.organization_label) {
                  setOrgField("display_name", value);
                }
              }}
              placeholder="Например: ГБОУ Школа №123"
              disabled={busy}
            />

            <label className="field">
              <span>Сфера организации</span>
              <select
                value={orgDraft.org_sphere}
                onChange={(event) => setOrgField("org_sphere", event.target.value as OrgSphere)}
                disabled={busy}
              >
                {ORG_SPHERE_VALUES.map((sphere) => (
                  <option key={sphere} value={sphere}>
                    {ORG_SPHERE_LABEL[sphere]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Сфера организации</span>
              <select
                value={orgDraft.org_sphere}
                onChange={(event) => setOrgField("org_sphere", event.target.value as OrgSphere)}
                disabled={busy}
              >
                {ORG_SPHERE_VALUES.map((sphere) => (
                  <option key={sphere} value={sphere}>
                    {ORG_SPHERE_LABEL[sphere]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Уровень ISCED</span>
              <select
                value={orgDraft.isced_level}
                onChange={(event) =>
                  setOrgField("isced_level", Number(event.target.value) as IscedLevel)
                }
                disabled={busy}
              >
                {ISCED_LEVEL_VALUES.map((level) => (
                  <option key={level} value={level}>
                    {ISCED_LEVEL_LABEL[level]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Тип организации Phase A</span>
              <select
                value={orgDraft.org_kind}
                onChange={(event) => setOrgField("org_kind", event.target.value as OrgKind)}
                disabled={busy}
              >
                {ORG_KIND_VALUES.map((kind) => (
                  <option key={kind} value={kind}>
                    {ORG_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <TextField
              label="Имя специалиста"
              value={specialistDraft.display_name}
              onChange={(value) => setSpecialistField("display_name", value)}
              placeholder="Например: Анна Иванова"
              disabled={busy}
            />
            <TextField
              label="Роль / должность"
              value={specialistDraft.role_text}
              onChange={(value) => setSpecialistField("role_text", value)}
              placeholder="Например: педагог-психолог"
              disabled={busy}
            />
            <label className="field">
              <span>Недельная нагрузка, минут</span>
              <input
                type="number"
                min={0}
                max={10080}
                value={specialistDraft.weekly_contract_minutes}
                onChange={(event) =>
                  setSpecialistField("weekly_contract_minutes", Number(event.target.value))
                }
                disabled={busy}
              />
            </label>
            <p className="muted">
              По умолчанию 1620 минут: 40 часов, пересчитанные в условные
              рабочие минуты для локальной нагрузки.
            </p>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <div className="workspace-actions wizard-nav">
          {step === "specialist" && (
            <button type="button" className="wizard-btn wizard-btn--back" disabled={busy} onClick={() => setStep("org")}>
              Назад
            </button>
          )}
          {step === "org" ? (
            <button type="button" className="wizard-btn wizard-btn--next" disabled={busy} onClick={goNext}>
              Далее
            </button>
          ) : (
            <button type="submit" className="wizard-btn wizard-btn--finish" disabled={busy}>
              {busy ? "Сохраняем…" : "Сохранить и открыть Терминал"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="text"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
    </label>
  );
}
