/**
 * Phase 3.12d — lightweight update notifier.
 *
 * This is intentionally not Tauri's signed auto-updater. The terminal only
 * reads a public manifest and shows a notice if a newer installer exists.
 */

export const DEFAULT_UPDATE_MANIFEST_URL = "https://prevention.school/terminal/latest.json";
export const UPDATE_CHECK_TIMEOUT_MS = 5000;

export type UpdateCheckStatus = "update-available" | "up-to-date" | "unavailable";

export interface UpdateManifest {
  schema_version: 1;
  product: "prevention-terminal";
  channel: "demo" | "stable";
  version: string;
  published_at: string;
  download_url: string;
  notes_url?: string;
  sha256?: string;
  message?: string;
}

export interface UpdateCheckOptions {
  manifestUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  currentVersion: string;
  latest?: UpdateManifest;
  notice?: string;
}

export async function checkForTerminalUpdate(
  currentVersion: string,
  options: UpdateCheckOptions = {},
): Promise<UpdateCheckResult> {
  const current = normalizeVersion(currentVersion);
  if (!current) {
    throw new Error("checkForTerminalUpdate: currentVersion must be non-empty");
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return {
      status: "unavailable",
      currentVersion: current,
      notice: "fetch is not available in this environment.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? UPDATE_CHECK_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(options.manifestUrl ?? resolveDefaultManifestUrl(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        currentVersion: current,
        notice: `Update manifest responded with HTTP ${response.status}.`,
      };
    }

    const manifest = parseUpdateManifest(await response.json());
    const comparison = compareVersions(manifest.version, current);
    if (comparison > 0) {
      return {
        status: "update-available",
        currentVersion: current,
        latest: manifest,
      };
    }

    return {
      status: "up-to-date",
      currentVersion: current,
      latest: manifest,
    };
  } catch (err) {
    return {
      status: "unavailable",
      currentVersion: current,
      notice: `Update check failed: ${String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function parseUpdateManifest(raw: unknown): UpdateManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Update manifest must be an object");
  }

  const data = raw as Partial<UpdateManifest>;
  if (data.schema_version !== 1) {
    throw new Error("Unsupported update manifest schema_version");
  }
  if (data.product !== "prevention-terminal") {
    throw new Error("Unexpected update manifest product");
  }
  if (data.channel !== "demo" && data.channel !== "stable") {
    throw new Error("Unexpected update manifest channel");
  }

  const version = normalizeVersion(data.version ?? "");
  const publishedAt = asNonEmptyString(data.published_at, "published_at");
  const downloadUrl = asNonEmptyString(data.download_url, "download_url");

  return {
    schema_version: 1,
    product: "prevention-terminal",
    channel: data.channel,
    version,
    published_at: publishedAt,
    download_url: downloadUrl,
    notes_url: optionalString(data.notes_url),
    sha256: optionalString(data.sha256),
    message: optionalString(data.message),
  };
}

function resolveDefaultManifestUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const fromEnv = env?.VITE_TERMINAL_UPDATE_MANIFEST_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return DEFAULT_UPDATE_MANIFEST_URL;
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, "");
}

function parseVersionParts(value: string): number[] {
  return normalizeVersion(value)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Update manifest field ${field} must be non-empty`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
