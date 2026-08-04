import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  defaultEnabledModules,
  inferManagerScope,
  inferWorkspacePreset,
  isSchoolLikeOrg,
  isTerminalConfigComplete,
  isTerminalModuleEnabled,
  moduleList,
  moduleOfferedInOnboarding,
  needsRoleStep,
  normalizeOrgTypePreset,
  onboardingRolePreset,
  resolveWorkspacePreset,
  weeklyHoursToMinutes,
} from "./terminal_config.ts";

describe("workspace presets", () => {
  it("manager preset for dashboard mode", () => {
    assert.equal(resolveWorkspacePreset("manager", "education", null), "manager");
    assert.equal(resolveWorkspacePreset("manager", "commercial", null), "manager");
  });

  it("specialist only for commercial workspace", () => {
    assert.equal(resolveWorkspacePreset("specialist", "commercial", null), "specialist");
    assert.equal(needsRoleStep("specialist", "commercial"), false);
  });

  it("school workspace no longer has separate role step", () => {
    assert.equal(needsRoleStep("specialist", "education"), false);
    assert.equal(resolveWorkspacePreset("specialist", "education", "educator_lite"), "educator_lite");
    assert.equal(resolveWorkspacePreset("specialist", "education", "specialist"), "specialist");
  });

  it("legacy government maps to education", () => {
    assert.equal(normalizeOrgTypePreset("government"), "education");
  });

  it("preventive_public is school-like for modules", () => {
    assert.equal(isSchoolLikeOrg("preventive_public"), true);
    const mods = defaultEnabledModules("specialist", "preventive_public", "specialist");
    assert.equal(mods.safe_environment, true);
    assert.equal(mods.ipr, true);
  });

  it("territorial manager scope for preventive_public", () => {
    assert.equal(inferManagerScope("preventive_public", "manager"), "territorial");
    assert.equal(inferManagerScope("education", "manager"), "institution");
    assert.equal(inferManagerScope("education", "manager", "territorial"), "territorial");
  });

  it("onboarding role presets match assignment", () => {
    assert.equal(onboardingRolePreset("director", "education").jobTitle, "Директор");
    assert.equal(onboardingRolePreset("psychologist", "commercial").jobTitle, "Психолог");
    assert.equal(onboardingRolePreset("territorial_admin", "education").weeklyHours, 0);
    assert.equal(onboardingRolePreset("psychologist", "education").weeklyHours, 36);
  });

  it("manager onboarding excludes specialist-only group_sessions", () => {
    const mod = moduleList().find((m) => m.id === "group_sessions");
    assert.ok(mod);
    assert.equal(moduleOfferedInOnboarding("manager", mod!, "education"), false);
    const mgrMods = defaultEnabledModules("manager", "education", "manager");
    assert.equal(mgrMods.group_sessions, false);
  });

  it("manager onboarding excludes site widget settings", () => {
    for (const id of ["embed_client_widget", "specialist_registration_widget", "specialist_iconostasis"]) {
      const mod = moduleList().find((m) => m.id === id);
      assert.ok(mod);
      assert.equal(moduleOfferedInOnboarding("manager", mod!, "commercial"), false);
    }
    const mgrMods = defaultEnabledModules("manager", "commercial", "manager");
    assert.equal(mgrMods.embed_client_widget, false);
  });

  it("specialist preset excludes manager-only modules by default", () => {
    const mods = defaultEnabledModules("specialist", "education", "specialist");
    assert.equal(mods.embed_client_widget, false);
    assert.equal(mods.specialist_registration_widget, false);
    assert.equal(mods.specialist_iconostasis, false);
    assert.equal(mods.consumer_app_link, false);
  });

  it("educator lite modules are minimal and free", () => {
    const mods = defaultEnabledModules("specialist", "education", "educator_lite");
    assert.equal(mods.ai_consultant_lite, true);
    assert.equal(mods.group_sessions, true);
    assert.equal(mods.reception_journal, false);
    assert.equal(mods.consultation_journal, false);
  });

  it("weekly hours conversion", () => {
    assert.equal(weeklyHoursToMinutes(36), 2160);
  });

  it("isTerminalModuleEnabled blocks school-only modules for commercial", () => {
    const cfg = {
      terminal_user_id: "x",
      edition: "ru",
      mode: "specialist" as const,
      workspace_preset: "specialist" as const,
      org_type: "commercial" as const,
      manager_scope: null,
      job_title: "Психолог",
      child_invite_code: "CHILD-ABC",
      parent_invite_code: null,
      parent_invite_in: null,
      child_invite_in: null,
      consumer_app: null,
      enabled_modules: {},
      registry_enabled: false,
      onboarding_complete: true,
      created_at: "",
      updated_at: "",
    };
    assert.equal(isTerminalModuleEnabled(cfg, "ipr"), false);
    assert.equal(isTerminalModuleEnabled(cfg, "safe_environment"), false);
    assert.equal(isTerminalModuleEnabled(cfg, "consultation_journal"), true);
    assert.equal(isTerminalModuleEnabled({ ...cfg, org_type: "education" }, "ipr"), true);
  });

  it("infers educator lite from legacy config", () => {
    const cfg = {
      terminal_user_id: "x",
      edition: "ru",
      mode: "specialist" as const,
      workspace_preset: "" as const,
      org_type: "education" as const,
      manager_scope: null,
      job_title: "Педагог",
      child_invite_code: "CHILD-ABC",
      parent_invite_code: null,
      parent_invite_in: null,
      child_invite_in: null,
      consumer_app: null,
      enabled_modules: { ai_consultant_lite: true, group_sessions: true },
      registry_enabled: false,
      onboarding_complete: true,
      created_at: "",
      updated_at: "",
    };
    assert.equal(inferWorkspacePreset({ ...cfg, workspace_preset: undefined as never }), "educator_lite");
    assert.equal(isTerminalConfigComplete(cfg), true);
  });
});
