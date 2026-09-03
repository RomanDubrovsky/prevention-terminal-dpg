import { invoke } from "@tauri-apps/api/core";

import { slugifyCenterId } from "./center_id.ts";
import type { SiteBookingMode } from "./site_pages.ts";

export type { SiteBookingMode } from "./site_pages.ts";
export interface SitePortalConfig {
  center_id: string;
  setup_token: string;
  inbox_login: string;
  inbox_password: string;
  iconostasis_columns: number;
  consult_booking_url: string;
  booking_mode: SiteBookingMode;
  public_site_origin: string;
  site_page_paths_json: string;
  leads_export_webhook_url: string;
  privacy_policy_url: string;
  personal_data_agreement_url: string;
}

export async function getSitePortal(): Promise<SitePortalConfig> {
  return invoke<SitePortalConfig>("site_portal_get");
}

export async function ensureSitePortal(organizationName: string, requestedCenterId?: string, requestedSetupToken?: string): Promise<SitePortalConfig> {
  const centerId = requestedCenterId || slugifyCenterId(organizationName.trim() || "center");
  return invoke<SitePortalConfig>("site_portal_ensure", {
    organizationName: organizationName.trim() || "МЦПО",
    centerId,
    setupToken: requestedSetupToken,
  });
}

export async function updateSitePortal(patch: {
  center_id?: string;
  setup_token?: string;
  inbox_login?: string;
  inbox_password?: string;
  iconostasis_columns?: number;
  consult_booking_url?: string;
  booking_mode?: SiteBookingMode;
  public_site_origin?: string;
  site_page_paths_json?: string;
  leads_export_webhook_url?: string;
  privacy_policy_url?: string;
  personal_data_agreement_url?: string;
}): Promise<SitePortalConfig> {
  return invoke<SitePortalConfig>("site_portal_update", {
    centerId: patch.center_id,
    setupToken: patch.setup_token,
    inboxLogin: patch.inbox_login,
    inboxPassword: patch.inbox_password,
    iconostasisColumns: patch.iconostasis_columns,
    consultBookingUrl: patch.consult_booking_url,
    bookingMode: patch.booking_mode,
    publicSiteOrigin: patch.public_site_origin,
    sitePagePathsJson: patch.site_page_paths_json,
    leadsExportWebhookUrl: patch.leads_export_webhook_url,
    privacyPolicyUrl: patch.privacy_policy_url,
    personalDataAgreementUrl: patch.personal_data_agreement_url,
  });
}

export { effectiveConsultBookingUrl } from "./site_pages.ts";
