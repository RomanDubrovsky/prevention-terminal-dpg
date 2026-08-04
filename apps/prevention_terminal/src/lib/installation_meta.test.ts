import assert from "node:assert/strict";
import test from "node:test";

import {
  isInstallationMetaComplete,
  normalizeInstallationLocation,
  validateInstallationDraft,
  type InstallationMeta,
} from "./installation_meta.ts";

const completeMeta: InstallationMeta = {
  install_id: "install_demo",
  country: "RU",
  region: "Москва",
  municipality: "ЦАО",
  settlement: "Москва",
  organization_type: "school",
  organization_label: "Школа 123",
  org_unit_id: null,
  org_unit_status: "manual_pending_review",
  telemetry_consent: true,
  created_at: "0",
  updated_at: "0",
};

test("isInstallationMetaComplete requires settlement from map and organization fields", () => {
  assert.equal(isInstallationMetaComplete(null), false);
  assert.equal(isInstallationMetaComplete(completeMeta), true);
  assert.equal(
    isInstallationMetaComplete({ ...completeMeta, settlement: " " }),
    false,
  );
  assert.equal(
    isInstallationMetaComplete({
      ...completeMeta,
      region: "",
      municipality: "",
    }),
    true,
  );
});

test("normalizeInstallationLocation fills region and municipality from settlement", () => {
  const normalized = normalizeInstallationLocation({
    ...completeMeta,
    region: "",
    municipality: "",
  });
  assert.equal(normalized.region, "Москва");
  assert.equal(normalized.municipality, "Москва");
});

test("validateInstallationDraft requires settlement on map", () => {
  assert.equal(validateInstallationDraft(completeMeta), null);
  assert.match(
    validateInstallationDraft({ ...completeMeta, settlement: "" }) ?? "",
    /населённый пункт на карте/,
  );
});
