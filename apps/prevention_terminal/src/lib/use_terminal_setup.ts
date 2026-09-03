import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  validateOrgProfileDraft,
  validateSpecialistProfileDraft,
  DEFAULT_ORG_PROFILE,
  DEFAULT_SPECIALIST_PROFILE,
  type OrgProfileInput,
  type SpecialistProfileInput,
} from "./terminal_profiles.ts";
import {
  defaultOrgSphereForSegment,
  legacyToEducationOrgType,
  type EducationOrgType,
  type OrgSphere,
} from "./org_sphere.ts";
import { validateInstallationDraft } from "./installation_meta.ts";
import { persistTerminalSetup } from "./persist_terminal_setup.ts";
import { validateFederationLinks } from "./federation_invite.ts";
import type { InstallationMeta, InstallationMetaInput } from "./installation_meta.ts";
import {
  defaultEnabledModules,
  genInviteCode,
  inferWorkspacePreset,
  isSchoolLikeOrg,
  managerScopeForProfileRole,
  minutesToWeeklyHours,
  normalizeOrgTypePreset,
  onboardingRolePreset,
  orgTypeToOrganizationType,
  profileRolesForOrgSegment,
  resolveWorkspacePreset,
  weeklyHoursToMinutes,
  type OnboardingProfileRole,
  type OrgTypePreset,
  type SpecialistRoleChoice,
  type TerminalConfig,
  type TerminalMode,
  type WorkspacePreset,
} from "./terminal_config.ts";
import { getTerminalEdition } from "./terminal_edition.ts";
import { DEFAULT_INSTALLATION } from "./terminal_setup_constants.ts";
import { detectApproximateLocation } from "./geo_detect.ts";
import { normalizeInstallationLocation } from "./installation_meta.ts";

export function useTerminalSetup() {
  const edition = getTerminalEdition();

  const [_workspaceChoice, setWorkspaceChoice] = useState<WorkspacePreset>("specialist");
  const [mode, setMode] = useState<TerminalMode>("specialist");
  const [orgType, setOrgType] = useState<OrgTypePreset>("");
  const [profileRole, setProfileRole] = useState<OnboardingProfileRole>("psychologist");
  const [lockedPreset, setLockedPreset] = useState<WorkspacePreset | null>(null);
  const [registryEnabled, setRegistryEnabled] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [childCode, setChildCode] = useState(() => genInviteCode("CHILD"));
  const [parentCode, setParentCode] = useState(() => genInviteCode("PARENT"));
  const [parentIn, setParentIn] = useState("");
  const [childIn, setChildIn] = useState("");
  const [modules, setModules] = useState<Record<string, boolean>>(() =>
    defaultEnabledModules("specialist", "education", "specialist"),
  );

  const [centerId, setCenterId] = useState("");
  const [setupToken, setSetupToken] = useState("");

  const [installationDraft, setInstallationDraft] = useState<InstallationMetaInput>(DEFAULT_INSTALLATION);
  const [orgDraft, setOrgDraft] = useState<OrgProfileInput>(DEFAULT_ORG_PROFILE);
  const [specialistDraft, setSpecialistDraft] = useState<SpecialistProfileInput>(DEFAULT_SPECIALIST_PROFILE);
  const [weeklyHours, setWeeklyHours] = useState(() =>
    minutesToWeeklyHours(DEFAULT_SPECIALIST_PROFILE.weekly_contract_minutes),
  );
  const [displayName, setDisplayName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      invoke<InstallationMeta | null>("installation_get_meta"),
      invoke<TerminalConfig | null>("terminal_get_config"),
      invoke<OrgProfileInput | null>("db_get_org_profile"),
      invoke<SpecialistProfileInput | null>("db_get_specialist_profile"),
    ])
      .then(([meta, terminal, orgProfile, specialistProfile]) => {
        if (!alive) return;
        if (meta) {
          setInstallationDraft({
            country: meta.country || DEFAULT_INSTALLATION.country,
            region: meta.region,
            municipality: meta.municipality,
            settlement: meta.settlement,
            lat: meta.lat ?? null,
            lng: meta.lng ?? null,
            organization_type: meta.organization_type,
            organization_label: meta.organization_label,
            telemetry_consent: meta.telemetry_consent,
          });
        }
        if (terminal) {
          const preset = inferWorkspacePreset(terminal);
          setWorkspaceChoice(preset);
          setMode(terminal.mode);
          setOrgType(normalizeOrgTypePreset(terminal.org_type || ""));
          if (preset === "educator_lite") {
            setLockedPreset("educator_lite");
            setProfileRole("psychologist");
          } else if (terminal.mode === "specialist") {
            setProfileRole("psychologist");
          } else if (terminal.manager_scope === "territorial") {
            setProfileRole("territorial_admin");
          } else {
            setProfileRole("director");
          }
          setRegistryEnabled(terminal.registry_enabled);
          setJobTitle(terminal.job_title);
          setChildCode(terminal.child_invite_code);
          if (terminal.parent_invite_code) setParentCode(terminal.parent_invite_code);
          setParentIn(terminal.parent_invite_in || "");
          setChildIn(terminal.child_invite_in || "");
          setModules(terminal.enabled_modules);
        }
        if (orgProfile) {
          let orgSphere = (orgProfile.org_sphere as OrgSphere | undefined) || "education_system";
          if (orgSphere as string === "education") {
            orgSphere = "education_system";
          }
          let orgKind = orgProfile.org_kind;
          if (orgKind as string === "school") {
            orgKind = "combined_school";
          }
          const educationOrgType =
            (orgProfile.education_org_type as EducationOrgType | null | undefined) ??
            (orgSphere === "education_system"
              ? legacyToEducationOrgType(orgProfile.isced_level, orgKind)
              : null);
          setOrgDraft({
            display_name: orgProfile.display_name,
            isced_level: orgProfile.isced_level,
            org_kind: orgKind,
            normative_overrides: orgProfile.normative_overrides || "{}",
            approx_learner_count: orgProfile.approx_learner_count ?? null,
            org_sphere: orgSphere,
            org_sphere_other: orgProfile.org_sphere_other ?? "",
            education_org_type: educationOrgType,
            approx_learner_ovz_count: orgProfile.approx_learner_ovz_count ?? null,
          });
        }
        if (specialistProfile) {
          setDisplayName(specialistProfile.display_name);
          setWeeklyHours(minutesToWeeklyHours(specialistProfile.weekly_contract_minutes));
          setSpecialistDraft({
            display_name: specialistProfile.display_name,
            role_text: specialistProfile.role_text,
            weekly_contract_minutes: specialistProfile.weekly_contract_minutes,
          });
          if (terminal?.job_title) setJobTitle(terminal.job_title);
          else setJobTitle(specialistProfile.role_text);
        }
        setLoaded(true);
      })
      .catch((err) => {
        if (!alive) return;
        setError(`Не удалось загрузить настройки: ${String(err)}`);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    void detectApproximateLocation().then((loc) => {
      if (!alive) return;
      setInstallationDraft((prev) => {
        if (prev.settlement.trim()) return prev;
        return normalizeInstallationLocation({
          ...prev,
          country: loc.country || prev.country,
          region: loc.region || prev.region,
          municipality: loc.municipality || prev.municipality,
          settlement: loc.settlement || prev.settlement,
          lat: loc.lat ?? prev.lat ?? null,
          lng: loc.lng ?? prev.lng ?? null,
        });
      });
    });
    return () => {
      alive = false;
    };
  }, [loaded]);

  const workspacePreset = useMemo(
    () =>
      lockedPreset ??
      resolveWorkspacePreset(mode, orgType || null, profileRole === "psychologist" ? "specialist" : null),
    [lockedPreset, mode, orgType, profileRole],
  );

  const managerScopeChoice = useMemo(() => managerScopeForProfileRole(profileRole), [profileRole]);
  const isManagerPreset = workspacePreset === "manager";
  const territorialManager = isManagerPreset && managerScopeChoice === "territorial";
  const schoolLike = isSchoolLikeOrg(orgType || null);
  const isEducatorLite = workspacePreset === "educator_lite";

  const profileValidationOptions = useMemo(() => {
    const sphere = orgDraft.org_sphere ?? "education_system";
    return {
      requireEducationOrgType: sphere === "education_system",
      requireOrgSphereOther: sphere === "other",
      requireLearnerCount: false,
    };
  }, [orgDraft.org_sphere]);

  const refreshModuleDefaults = useCallback(
    (nextMode: TerminalMode, nextOrgType: OrgTypePreset, nextRole: SpecialistRoleChoice | null) => {
      const preset = resolveWorkspacePreset(nextMode, nextOrgType || null, nextRole);
      setModules(defaultEnabledModules(nextMode, nextOrgType || null, preset));
    },
    [],
  );

  const setInstallationField = useCallback(
    <K extends keyof InstallationMetaInput>(key: K, value: InstallationMetaInput[K]) => {
      setInstallationDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const applyProfileRole = useCallback(
    (role: OnboardingProfileRole) => {
      if (lockedPreset === "educator_lite") return;
      setProfileRole(role);
      const segment = orgType === "commercial" ? "commercial" : "education";
      const preset = onboardingRolePreset(role, segment);
      const job = preset.jobTitle;

      if (role === "psychologist") {
        setMode("specialist");
        setWorkspaceChoice("specialist");
        refreshModuleDefaults("specialist", orgType, "specialist");
      } else {
        setMode("manager");
        setWorkspaceChoice("manager");
        if (!parentCode) setParentCode(genInviteCode("PARENT"));
        refreshModuleDefaults("manager", orgType, null);
      }

      setJobTitle(job);
      setWeeklyHours(preset.weeklyHours);
      setSpecialistDraft((p) => ({
        ...p,
        role_text: job,
        weekly_contract_minutes: weeklyHoursToMinutes(preset.weeklyHours),
      }));
      setOrgDraft((p) => ({ ...p, org_kind: preset.orgKind }));
      setInstallationDraft((p) => ({
        ...p,
        organization_label: p.organization_label.trim() ? p.organization_label : preset.organizationLabelIfEmpty,
      }));
    },
    [lockedPreset, orgType, parentCode, refreshModuleDefaults],
  );

  const applyOrgType = useCallback(
    (next: Exclude<OrgTypePreset, "">) => {
      if (lockedPreset === "educator_lite") return;
      setOrgType(next);
      setInstallationField("organization_type", orgTypeToOrganizationType(next));
      const nextNormalized = next === "preventive_public" ? "education" : next;
      const sphere = defaultOrgSphereForSegment(nextNormalized);
      setOrgDraft((p) => ({
        ...p,
        org_sphere: sphere,
        org_sphere_other: sphere === "other" ? p.org_sphere_other : "",
        education_org_type:
          sphere === "education_system"
            ? p.education_org_type ?? "lower_secondary"
            : null,
      }));
      const roles = profileRolesForOrgSegment(nextNormalized);
      const role = roles.includes(profileRole) ? profileRole : "psychologist";
      applyProfileRole(role);
    },
    [applyProfileRole, lockedPreset, profileRole, setInstallationField],
  );

  const rolePreset = useMemo(
    () =>
      orgType === "education" || orgType === "commercial"
        ? onboardingRolePreset(profileRole, orgType)
        : null,
    [orgType, profileRole],
  );

  const buildSpecialistPayload = useCallback((): SpecialistProfileInput => {
    if (workspacePreset === "specialist" || workspacePreset === "educator_lite") {
      return {
        display_name: displayName,
        role_text: jobTitle || specialistDraft.role_text,
        weekly_contract_minutes:
          workspacePreset === "educator_lite"
            ? 0
            : weeklyHoursToMinutes(weeklyHours),
        rate_type: specialistDraft.rate_type || "fixed",
        rate_value: specialistDraft.rate_value ?? 0,
      };
    }
    return {
      display_name: displayName,
      role_text: jobTitle,
      weekly_contract_minutes: 0,
      rate_type: specialistDraft.rate_type || "fixed",
      rate_value: specialistDraft.rate_value ?? 0,
    };
  }, [displayName, jobTitle, specialistDraft.role_text, specialistDraft.rate_type, specialistDraft.rate_value, weeklyHours, workspacePreset]);

  const validateAll = useCallback((): string | null => {
    if (!isEducatorLite) {
      if (orgType !== "education" && orgType !== "commercial") {
        return "Выберите тип организации.";
      }
      if (!profileRolesForOrgSegment(orgType).includes(profileRole)) {
        return "Выберите вашу роль.";
      }
    }
    if (!displayName.trim()) return "Укажите имя пользователя.";
    if (!installationDraft.organization_label.trim()) return "Укажите название организации.";
    const installationValidation = validateInstallationDraft(installationDraft, {
      requireSettlement: Boolean(installationDraft.settlement.trim()),
    });
    if (installationValidation) return installationValidation;
    const orgValidation = validateOrgProfileDraft(orgDraft, {
      ...profileValidationOptions,
      requireEducationOrgType: false,
      requireOrgSphereOther: false,
    });
    if (orgValidation) return orgValidation;
    if (workspacePreset === "specialist") {
      const specialistValidation = validateSpecialistProfileDraft(buildSpecialistPayload());
      if (specialistValidation) return specialistValidation;
    } else if (!isEducatorLite && !jobTitle.trim()) {
      return "Укажите должность.";
    }
    const federationError = validateFederationLinks({
      workspacePreset,
      isManagerPreset,
      territorialManager,
      parentIn,
      childIn,
    });
    if (federationError) return federationError;
    return null;
  }, [
    buildSpecialistPayload,
    childIn,
    displayName,
    installationDraft,
    isEducatorLite,
    isManagerPreset,
    jobTitle,
    orgDraft,
    orgType,
    parentIn,
    profileRole,
    profileValidationOptions,
    territorialManager,
    workspacePreset,
  ]);

  const save = useCallback(async () => {
    const validationError = validateAll();
    if (validationError) {
      setError(validationError);
      throw new Error(validationError);
    }
    setError(null);
    setBusy(true);
    try {
      return await persistTerminalSetup({
        installationInput: installationDraft,
        orgDraft,
        specialistPayload: buildSpecialistPayload(),
        edition,
        mode,
        workspacePreset,
        orgType,
        managerScopeChoice,
        jobTitle,
        childCode,
        parentCode,
        parentIn,
        childIn,
        modules,
        registryEnabled,
        isManagerPreset,
        centerId,
        setupToken,
      });
    } finally {
      setBusy(false);
    }
  }, [
    buildSpecialistPayload,
    childCode,
    childIn,
    edition,
    installationDraft,
    isManagerPreset,
    jobTitle,
    managerScopeChoice,
    mode,
    modules,
    orgDraft,
    orgType,
    parentCode,
    parentIn,
    registryEnabled,
    validateAll,
    workspacePreset,
  ]);

  return {
    edition,
    loaded,
    busy,
    error,
    setError,
    orgType,
    profileRole,
    workspacePreset,
    isManagerPreset,
    territorialManager,
    schoolLike,
    isEducatorLite,
    lockedPreset,
    registryEnabled,
    setRegistryEnabled,
    jobTitle,
    setJobTitle,
    childCode,
    parentCode,
    parentIn,
    setParentIn,
    childIn,
    setChildIn,
    centerId,
    setCenterId,
    setupToken,
    setSetupToken,
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
    profileValidationOptions,
    applyProfileRole,
    applyOrgType,
    save,
    validateAll,
  };
}

export type TerminalSetupState = ReturnType<typeof useTerminalSetup>;
