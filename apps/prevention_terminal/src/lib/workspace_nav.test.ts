process.env.VITE_TERMINAL_EDITION = "ru";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TerminalConfig } from "./terminal_config.ts";

const { AI_MODE_NAV, buildSpecialistNav, defaultSpecialistView } = await import("./workspace_nav.ts");

function baseCfg(): TerminalConfig {
  return {
    terminal_user_id: "tu-test",
    edition: "ru",
    mode: "specialist",
    workspace_preset: "specialist",
    org_type: "education",
    manager_scope: null,
    job_title: "Психолог",
    child_invite_code: "CHILD-TEST",
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
}

describe("workspace nav", () => {
  it("dashboard, AI helper, registry, then work tools and settings", () => {
    const nav = buildSpecialistNav(baseCfg());
    assert.deepEqual(
      nav.slice(0, 9).map((i) => i.id),
      [
        "dashboard",
        "calendar",
        "registry",
        "case_workspace",
        "consultations",
        "ipr",
        "group_work",
        "safe_environment",
        "analytical_report",
      ],
    );
    for (const mode of AI_MODE_NAV) {
      assert.equal(nav.some((i) => i.id === mode.id), true);
    }
    assert.equal(AI_MODE_NAV.length, 1);
    assert.equal(AI_MODE_NAV[0]?.id, "ai_consultant");
    assert.equal(AI_MODE_NAV[0]?.label, "ИИ-Помощник");
    assert.equal(nav.at(-1)?.id, "settings");
    assert.equal(nav.every((item) => Boolean(item.icon)), true);
    assert.equal(defaultSpecialistView(), "dashboard");
  });

  it("hides nav items when modules are disabled", () => {
    const nav = buildSpecialistNav({
      ...baseCfg(),
      enabled_modules: {
        consultation_journal: false,
        ipr: false,
        group_sessions: false,
        safe_environment: false,
        reception_journal: false,
      },
    });
    const ids = nav.map((i) => i.id);
    assert.equal(ids.includes("consultations"), false);
    assert.equal(ids.includes("ipr"), false);
    assert.equal(ids.includes("group_work"), false);
    assert.equal(ids.includes("safe_environment"), false);
    assert.equal(ids.includes("registry"), false);
    assert.equal(ids.includes("workload"), false);
    assert.equal(ids.includes("dashboard"), true);
    assert.equal(ids.includes("ai_consultant"), true);
  });

  it("shows consultations when only reception journal is enabled", () => {
    const nav = buildSpecialistNav({
      ...baseCfg(),
      enabled_modules: {
        consultation_journal: false,
        reception_journal: true,
      },
    });
    assert.equal(nav.some((i) => i.id === "consultations"), true);
  });

  it("shows workload (payments) for commercial orgs", () => {
    const nav = buildSpecialistNav({ ...baseCfg(), org_type: "commercial" });
    const workloadItem = nav.find((i) => i.id === "workload");
    assert.equal(workloadItem != null, true);
    assert.equal(workloadItem?.label, "Учет и выплаты");
  });

  it("hides school-only modules for commercial orgs even when enabled_modules empty", () => {
    const nav = buildSpecialistNav({ ...baseCfg(), org_type: "commercial", enabled_modules: {} });
    assert.equal(nav.some((i) => i.id === "ipr"), false);
    assert.equal(nav.some((i) => i.id === "safe_environment"), false);
    assert.equal(nav.some((i) => i.id === "consultations"), true);
    assert.equal(nav.some((i) => i.id === "registry"), true);
  });

  it("marks AI nav locked without subscription", () => {
    const nav = buildSpecialistNav(baseCfg(), "ru", { aiSubscriptionActive: false });
    const ai = nav.find((i) => i.id === "ai_consultant");
    assert.equal(ai?.locked, true);
  });

  it("manager nav hides AI assistant and Academy by default or when modules disabled", async () => {
    const { buildManagerNav } = await import("./workspace_nav.ts");
    const managerNavDefault = buildManagerNav(
      { aiSubscriptionActive: true },
      { ...baseCfg(), mode: "manager", workspace_preset: "manager", enabled_modules: { ai_assistant: false, academy: false } },
    );
    assert.deepEqual(managerNavDefault.map((i) => i.id), ["dashboard", "leads", "users", "specialists", "feedback", "settings"]);

    const managerNavWithAi = buildManagerNav(
      { aiSubscriptionActive: true },
      { ...baseCfg(), mode: "manager", workspace_preset: "manager", enabled_modules: { ai_assistant: true, academy: true } },
    );
    assert.deepEqual(managerNavWithAi.map((i) => i.id), ["dashboard", "leads", "users", "specialists", "ai_consultant", "academy", "feedback", "settings"]);
  });
});
