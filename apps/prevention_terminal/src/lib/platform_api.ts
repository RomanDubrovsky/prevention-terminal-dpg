/**
 * Platform API base URL (terminal, federation, subscription, educators).
 * Teenology PWA uses api.teenology.care — not this module.
 *
 * Canonical: api.prevention.school (Cloudflare Worker → Azure FQDN).
 */

export const PLATFORM_API_CANONICAL = "https://api.prevention.school";
/** Same Azure backend via Cloudflare Worker proxy (workers/platform-api-proxy). */
export const PLATFORM_API_ACTIVE = PLATFORM_API_CANONICAL;

export function platformApiBase(): string {
  const fromEnv = import.meta.env.VITE_TERMINAL_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  // Edition YAML names api.prevention.school; DNS may still point via fallback host.
  return PLATFORM_API_ACTIVE;
}

export function platformAggregateUrl(): string {
  return `${platformApiBase()}/api/terminal/aggregate`;
}
