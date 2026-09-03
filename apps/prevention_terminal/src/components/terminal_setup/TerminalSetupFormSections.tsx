import GeoMapField from "../GeoMapField.tsx";
import { t } from "../../lib/i18n.ts";

import {
  isBundleEnabled,
  setBundleEnabled,
  SPECIALIST_PRODUCT_BUNDLES,
  MANAGER_PRODUCT_BUNDLES,
} from "../../lib/onboarding_bundles.ts";
import { EDUCATION_ORG_TYPE_LABEL, EDUCATION_ORG_TYPE_VALUES, ORG_SPHERE_LABEL, ORG_SPHERE_VALUES } from "../../lib/terminal_profiles.ts";
import { educationOrgTypeToLegacy, type EducationOrgType, type OrgSphere } from "../../lib/org_sphere.ts";
import {
  ONBOARDING_ORG_SEGMENT,
  ONBOARDING_ORG_SEGMENT_OPTIONS,
  ONBOARDING_PROFILE_ROLE_LABEL,
  presetLabel,
  profileRolesForOrgSegment,
  weeklyHoursToMinutes,
  WEEKLY_HOURS_MAX,
} from "../../lib/terminal_config.ts";
import type { SetupSection } from "../../lib/terminal_setup_constants.ts";
import type { TerminalSetupState } from "../../lib/use_terminal_setup.ts";
import { validateChildInLink, validateParentInLink } from "../../lib/federation_invite.ts";
import { FederationStep } from "./FederationStep.tsx";
import SetupBreadcrumbs from "./SetupBreadcrumbs.tsx";
import SiteWidgetsSection from "./SiteWidgetsSection.tsx";

function ProfileStepIntro() {
  return (
    <p className="muted ob-profile-intro">
      {t(
        "Настройка рабочего места определяет набор инструментов в меню. Его можно изменить позже в разделе «Настройки». Выберите роль — дальше уточним имя и сетевые связи.",
        "Workplace setup determines the set of tools in the menu. It can be changed later in the 'Settings' section. Select a role — next we will specify the name and network connections.",
      )}
    </p>
  );
}

function ModulesStepIntro() {
  return (
    <p className="muted ob-modules-intro">
      {t(
        "Выберите инструменты для рабочего поля. Список можно менять здесь сколько угодно — переход в рабочее место произойдёт только после кнопки «Открыть рабочее место» внизу. Позже модули настраиваются в меню «Настройки».",
        "Choose tools for the workspace. You can change the list here as much as you like — transition to the workplace will happen only after clicking the 'Open Workplace' button below. Later, modules can be configured in the 'Settings' menu.",
      )}
    </p>
  );
}

interface TerminalSetupFormSectionsProps {
  setup: TerminalSetupState;
  section: SetupSection;
  visibleSteps: SetupSection[];
  locale: string;
  busy: boolean;
  onJumpToSection?: (section: SetupSection) => void;
  lockedSteps?: SetupSection[];
  isSettings?: boolean;
}

export default function TerminalSetupFormSections(props: TerminalSetupFormSectionsProps) {
  const { setup, section, visibleSteps, locale, busy, onJumpToSection, lockedSteps, isSettings } = props;
  const {
    orgType,
    profileRole,
    workspacePreset,
    isManagerPreset,
    territorialManager,
    schoolLike,
    isEducatorLite,
    jobTitle,
    setJobTitle,
    parentIn,
    setParentIn,
    childIn,
    setChildIn,
    childCode,
    parentCode,
    modules,
    setModules,
    installationDraft,
    setInstallationField,
    orgDraft,
    setOrgDraft,
    specialistDraft,
    setSpecialistDraft,
    weeklyHours,
    setWeeklyHours,
    displayName,
    setDisplayName,
    rolePreset,
    applyProfileRole,
    applyOrgType,
  } = setup;

  const breadcrumbs = (
    <SetupBreadcrumbs
      visibleSteps={visibleSteps}
      currentSection={section}
      setup={setup}
      locale={locale}
      onJumpToSection={onJumpToSection}
      lockedSteps={lockedSteps}
    />
  );

  if (section === "org") {
    return (
      <>
        {breadcrumbs}
        <div className="ob-choices ob-section-body">
        {ONBOARDING_ORG_SEGMENT_OPTIONS.map((opt) => (
          <label key={opt} className="ob-card">
            <input
              type="radio"
              name="orgSegment"
              checked={orgType === opt}
              onChange={() => applyOrgType(opt)}
              disabled={busy || isEducatorLite}
            />
            <strong>{t(ONBOARDING_ORG_SEGMENT[opt].title, opt === "education" ? "Psychological service in education system" : "Commercial psychological center")}</strong>
            <span>{t(ONBOARDING_ORG_SEGMENT[opt].hint, ONBOARDING_ORG_SEGMENT[opt].hint)}</span>
          </label>
        ))}
        </div>

      </>
    );
  }

  if (section === "profile") {
    return (
      <>
        {breadcrumbs}
        {isSettings ? (
          <p className="muted ob-profile-intro" style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
            {t(
              "⚠️ Роль профиля (Психолог / Руководитель) задается при первом запуске и не может быть изменена после создания профиля во избежание сбоев в базе данных. Для смены роли создайте новый рабочий профиль на стартовом экране.",
              "⚠️ Profile role (Psychologist / Manager) is set during first launch and cannot be changed after profile creation to avoid database corruption. To change the role, create a new working profile on the startup screen.",
            )}
          </p>
        ) : (
          <ProfileStepIntro />
        )}
        <div className="ob-choices ob-section-body" style={isSettings ? { opacity: 0.85 } : undefined}>
        {(orgType === "education" || orgType === "commercial") &&
          profileRolesForOrgSegment(orgType).map((role) => {
            const labels = ONBOARDING_PROFILE_ROLE_LABEL[role];
            const hint = orgType === "education" ? labels.hintEducation : labels.hintCommercial;
            const roleLocked = isSettings || (setup.orgDraft.display_name !== "" && (setup.profileRole as string) !== "");
            
            if (roleLocked && profileRole !== role) {
              return null;
            }

            return (
              <label key={role} className="ob-card" style={roleLocked ? { cursor: "default", borderColor: "var(--accent, #0f766e)" } : undefined}>
                {!roleLocked && (
                  <input
                    type="radio"
                    name="profileRole"
                    checked={profileRole === role}
                    onChange={() => applyProfileRole(role)}
                    disabled={busy || isEducatorLite}
                  />
                )}
                <strong>{t(labels.title, role === "psychologist" ? "Psychologist" : role === "director" ? "Director / Manager" : "Education Authority / Department Coordinator")}</strong>
                {!roleLocked && <span>{t(hint, hint)}</span>}
                {roleLocked && <span style={{ color: "var(--accent, #0f766e)", fontWeight: "bold", marginTop: "4px", display: "block", fontSize: "12px" }}>{t("Текущая роль", "Current role")}</span>}
              </label>
            );
          })}
        </div>


        {/* Dynamic step-by-step onboarding plan box */}
        {!isSettings && (
          <div
            style={{
              marginTop: "20px",
              padding: "16px 20px",
              borderRadius: "12px",
              background: profileRole === "psychologist" ? "#f0fdf4" : "#eff6ff",
              border: `1px solid ${profileRole === "psychologist" ? "#bbf7d0" : "#bfdbfe"}`,
              color: profileRole === "psychologist" ? "#166534" : "#1e40af",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "13.5px" }}>
              {profileRole === "psychologist"
                ? t("💡 Пошаговый план для Психолога:", "💡 Step-by-step plan for Psychologist:")
                : t("💡 Пошаговый план для Руководителя / Администратора:", "💡 Step-by-step plan for Manager / Administrator:")}
            </div>
            {profileRole === "psychologist" ? (
              <ol style={{ margin: 0, paddingLeft: "20px" }}>
                <li><strong>{t("Шаг 1 (Имя):", "Step 1 (Name):")}</strong> {t("Заполните ваше имя и наименование центра на следующем шаге («Сеть»).", "Enter your name and center label on the next step ('Network').")}</li>
                <li><strong>{t("Шаг 2 (Привязка):", "Step 2 (Connection):")}</strong> {t("Если вам передали Код организации (PARENT-…), вставьте его в поле «Код организации» на шаге «Сеть».", "If you received an Organization Code (PARENT-…), enter it in the 'Organization Code' field on the 'Network' step.")}</li>
                <li><strong>{t("Шаг 3 (Работа):", "Step 3 (Work):")}</strong> {t("Нажмите «Открыть» — запустится личный кабинет с журналом приёмов, ведением случаев и ИИ-помощником.", "Click 'Open' — your personal workspace with session journal, cases, and AI assistant will launch.")}</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: "20px" }}>
                <li><strong>{t("Шаг 1 (Центр):", "Step 1 (Center):")}</strong> {t("Укажите наименование вашего центра на следующем шаге («Сеть»).", "Enter your center's name on the next step ('Network').")}</li>
                <li><strong>{t("Шаг 2 (Виджеты на сайт):", "Step 2 (Site Widgets):")}</strong> {t("На шаге «Сайт» скопируйте готовые коды формы записи клиентов и иконостаса специалистов для вашего сайта.", "On the 'Site' step, copy booking form & specialist roster snippets for your website.")}</li>
                <li><strong>{t("Шаг 3 (Команда):", "Step 3 (Team):")}</strong> {t("Скопируйте Код вашей организации (PARENT-…) на шаге «Сеть» и передайте его директорам и психологам для подключения.", "Copy your Organization Code (PARENT-…) on the 'Network' step and share it with directors and psychologists to connect.")}</li>
              </ol>
            )}
          </div>
        )}
      </>
    );
  }

  if (section === "federation") {
    const parentInError =
      workspacePreset === "specialist" || workspacePreset === "educator_lite"
        ? validateParentInLink(parentIn)
        : null;
    const childInError = isManagerPreset
      ? validateChildInLink(childIn, { territorial: territorialManager })
      : null;
    return (
      <>
        {breadcrumbs}
        <div className="ob-section-body ob-section-body--full">
          <FederationStep
            busy={busy}
            childCode={childCode}
            childIn={childIn}
            childInError={childInError}
            isManager={isManagerPreset}
            orgType={orgType === "education" || orgType === "commercial" ? orgType : "education"}
            parentCode={parentCode}
            parentIn={parentIn}
            parentInError={parentInError}
            preset={workspacePreset}
            presetName={presetLabel(workspacePreset, locale)}
            profileRole={profileRole}
            territorial={territorialManager}
            displayName={displayName}
            organizationLabel={installationDraft.organization_label}
            orgNamePlaceholder={rolePreset?.organizationPlaceholder}
            onDisplayNameChange={(v) => {
              setDisplayName(v);
              setSpecialistDraft((p) => ({ ...p, display_name: v }));
              if (!orgDraft.display_name) setOrgDraft((p) => ({ ...p, display_name: v }));
            }}
            onOrganizationLabelChange={(v) => {
              setInstallationField("organization_label", v);
              setOrgDraft((p) => ({ ...p, display_name: v }));
            }}
            onChildInChange={setChildIn}
            onParentInChange={setParentIn}
            centerId={setup.centerId ? (setup.centerId.startsWith("CTR-") ? setup.centerId.slice(4) : setup.centerId) : ""}
            setupToken={setup.setupToken}
            onCenterIdChange={(v) => {
              const trimmed = v.trim().toUpperCase();
              if (!trimmed) {
                setup.setCenterId("");
                return;
              }
              const normalized = trimmed.startsWith("CTR-") ? trimmed : `CTR-${trimmed}`;
              setup.setCenterId(normalized);
            }}
            onSetupTokenChange={setup.setSetupToken}
            isSettings={isSettings}
            allowTokenRotation={setup.profileRole === "director" || setup.profileRole === "superadmin"}
          />
        </div>
      </>
    );
  }

  if (section === "organization") {
    return (
      <>
        {breadcrumbs}
        <div className="ob-section-body">
        <p className="muted ob-org-advanced-note">
          {t(
            "Имя пользователя и название организации для сети задаются на вкладке «Сеть». Здесь — детали профиля организации и география (определяется автоматически, при необходимости уточните на карте).",
            "Username and organization name for the network are set on the 'Network' tab. Here are organization profile details and geography (detected automatically, refine on map if needed).",
          )}
        </p>
        {isEducatorLite && (
          <p className="muted ob-educator-lite-note">
            {t("Режим педагога lite — можно изменить местоположение.", "Educator lite mode — you can change location.")}
          </p>
        )}
        <label className="field">
          <span>{t("Должность", "Job Title")}</span>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => {
              const v = e.target.value;
              setJobTitle(v);
              setSpecialistDraft((p) => ({ ...p, role_text: v }));
            }}
            placeholder={rolePreset?.jobTitle ?? (isEducatorLite ? t("Педагог", "Educator") : t("Должность", "Job Title"))}
            disabled={busy}
          />
        </label>

        {workspacePreset === "specialist" && (
          <>
            <label className="field">
              <span>{t("Недельная нагрузка, ч", "Weekly workload, hours")}</span>
              <input
                type="number"
                min={0}
                max={WEEKLY_HOURS_MAX}
                step={0.5}
                value={weeklyHours}
                onChange={(e) => {
                  const hours = Number(e.target.value);
                  setWeeklyHours(hours);
                  setSpecialistDraft((p) => ({
                    ...p,
                    weekly_contract_minutes: weeklyHoursToMinutes(hours),
                  }));
                }}
                placeholder={String(rolePreset?.weeklyHours ?? 36)}
                disabled={busy}
              />
            </label>

            <label className="field">
              <span>{t("Тип ставки (для расчета зарплаты)", "Rate type (for salary calculation)")}</span>
              <select
                value={specialistDraft.rate_type || "fixed"}
                onChange={(e) => {
                  const val = e.target.value as "fixed" | "percent";
                  setSpecialistDraft((p) => ({ ...p, rate_type: val }));
                }}
                disabled={busy}
              >
                <option value="fixed">{t("Фиксированная ставка за сеанс (руб)", "Fixed rate per session (RSD)")}</option>
                <option value="percent">{t("Процент от стоимости сеанса (%)", "Percentage of session cost (%)")}</option>
              </select>
            </label>

            <label className="field">
              <span>{t("Размер ставки", "Rate value")} ({specialistDraft.rate_type === "percent" ? "%" : t("руб.", "RSD")})</span>
              <input
                type="number"
                min={0}
                value={specialistDraft.rate_value ?? 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSpecialistDraft((p) => ({ ...p, rate_value: val }));
                }}
                placeholder={t("Например: 1500 или 40", "e.g. 1500 or 40")}
                disabled={busy}
              />
            </label>
          </>
        )}

        <label className="field">
          <span>{t("Название организации (для отчётности)", "Organization name (for reports)")}</span>
          <input
            type="text"
            value={installationDraft.organization_label}
            onChange={(e) => {
              const v = e.target.value;
              setInstallationField("organization_label", v);
              setOrgDraft((p) => ({ ...p, display_name: v }));
            }}
            placeholder={rolePreset?.organizationPlaceholder ?? t("Название организации", "Organization Name")}
            disabled={busy}
          />
        </label>

        {orgType !== "commercial" && (
          <>
            <label className="field">
              <span>{t("Сфера", "Sphere")}</span>
              <select
                value={orgDraft.org_sphere ?? "education_system"}
                onChange={(e) => {
                  const sphere = e.target.value as OrgSphere;
                  setOrgDraft((p) => ({
                    ...p,
                    org_sphere: sphere,
                    org_sphere_other: sphere === "other" ? p.org_sphere_other : "",
                    education_org_type:
                      sphere === "education_system"
                        ? p.education_org_type ?? "lower_secondary"
                        : null,
                  }));
                }}
                disabled={busy}
              >
                {ORG_SPHERE_VALUES.map((sphere) => (
                  <option key={sphere} value={sphere}>
                    {ORG_SPHERE_LABEL[sphere]}
                  </option>
                ))}
              </select>
            </label>

            {orgDraft.org_sphere === "other" && (
              <label className="field">
                <span>{t("Уточните сферу", "Specify sphere")}</span>
                <input
                  type="text"
                  value={orgDraft.org_sphere_other ?? ""}
                  onChange={(e) =>
                    setOrgDraft((p) => ({
                      ...p,
                      org_sphere_other: e.target.value,
                    }))
                  }
                  placeholder={t("Например: НКО, медицинская организация", "e.g. NGO, medical organization")}
                  disabled={busy}
                />
              </label>
            )}

            {orgDraft.org_sphere === "education_system" && (
              <label className="field">
                <span>{t("Тип организации", "Organization Type")}</span>
                <select
                  value={orgDraft.education_org_type ?? "lower_secondary"}
                  onChange={(e) => {
                    const educationOrgType = e.target.value as EducationOrgType;
                    const legacy = educationOrgTypeToLegacy(educationOrgType);
                    setOrgDraft((p) => ({
                      ...p,
                      education_org_type: educationOrgType,
                      isced_level: legacy.isced_level,
                      org_kind: legacy.org_kind,
                    }));
                  }}
                  disabled={busy}
                >
                  {EDUCATION_ORG_TYPE_VALUES.map((type) => (
                    <option key={type} value={type}>
                      {EDUCATION_ORG_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>{t("Примерное число обучающихся / воспитанников", "Approximate number of students / children")}</span>
              <input
                type="number"
                min={0}
                value={orgDraft.approx_learner_count ?? ""}
                onChange={(e) =>
                  setOrgDraft((p) => ({
                    ...p,
                    approx_learner_count: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder={t("Необязательно", "Optional")}
                disabled={busy}
              />
            </label>
            <label className="field">
              <span>{t("Из них с ОВЗ", "Of which with disabilities (SEN)")}</span>
              <input
                type="number"
                min={0}
                value={orgDraft.approx_learner_ovz_count ?? ""}
                onChange={(e) =>
                  setOrgDraft((p) => ({
                    ...p,
                    approx_learner_ovz_count: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                placeholder={t("Необязательно", "Optional")}
                disabled={busy}
              />
            </label>
          </>
        )}

        <GeoMapField
          country={installationDraft.country}
          settlement={installationDraft.settlement}
          region={installationDraft.region}
          municipality={installationDraft.municipality}
          purposeNote={t("Предоставление доступа к геопозиции не обязательно. Мы собираем примерные данные на уровне города и муниципалитета для понимания географии участников проекта, что имеет для нас большую ценность. При необходимости вы можете просто указать ваш город на карте или поискать вручную.", "Providing access to geolocation is optional. We collect approximate data at the city and municipality level to understand the geography of project participants, which is of great value to us. If necessary, you can simply point to your city on the map or search manually.")}
          onChange={(loc) => {
            setInstallationField("settlement", loc.settlement);
            setInstallationField("region", loc.region);
            setInstallationField("municipality", loc.municipality);
            if (loc.country) setInstallationField("country", loc.country);
            if (loc.lat != null) setInstallationField("lat", loc.lat);
            if (loc.lng != null) setInstallationField("lng", loc.lng);
          }}
          disabled={busy}
        />
        {installationDraft.country && (
          <p className="muted tiny">{t("Страна определена по карте: ", "Country determined by map: ")}{installationDraft.country}</p>
        )}
        </div>
      </>
    );
  }

  if (section === "modules" && (workspacePreset === "specialist" || workspacePreset === "manager")) {
    const productBundles = workspacePreset === "manager" ? MANAGER_PRODUCT_BUNDLES : SPECIALIST_PRODUCT_BUNDLES;
    return (
      <>
        {breadcrumbs}
        <div className="ob-modules ob-section-body">
        <ModulesStepIntro />
        {productBundles.filter((bundle) => !bundle.schoolLikeOnly || schoolLike).map((bundle) => (
          <div key={bundle.id} className="ob-mod">
            <label>
              <input
                type="checkbox"
                checked={isBundleEnabled(bundle.id, modules)}
                onChange={(e) => setModules((prev) => setBundleEnabled(bundle.id, e.target.checked, prev))}
                disabled={busy}
              />
              <span>
                <strong>{t(bundle.title_ru, bundle.title_en)}</strong>
              </span>
            </label>
            <p className="ob-mod-desc">{t(bundle.description_ru, bundle.description_en)}</p>
            <p className="muted tiny ob-mod-upsell">
              {t("Подписка ИИ в одном месте действует во всех включённых модулях.", "AI subscription in one place applies to all enabled modules.")}
            </p>
          </div>
        ))}
        </div>
      </>
    );
  }

  if (section === "site_widgets" && workspacePreset === "manager") {
    return (
      <>
        {breadcrumbs}
        <div className="ob-section-body ob-section-body--full">
          <SiteWidgetsSection
            organizationName={installationDraft.organization_label || orgDraft.display_name}
            centerId={setup.centerId}
            setupToken={setup.setupToken}
            isSchoolLike={schoolLike}
            busy={busy}
            isSettings={isSettings}
            allowTokenRotation={setup.profileRole === "director" || setup.profileRole === "superadmin"}
          />
        </div>
      </>
    );
  }

  return null;
}
