/**
 * Phase 3.10 — клиент ИИ-Архитектора (Cloudflare Worker, demo-режим).
 *
 * Идея: попробовать сходить в Worker за структурированным IprDocument; если
 * сети нет или Worker недоступен — без падения сгенерировать тот же документ
 * локально через `buildMockIpr` и пометить источник как `local-fallback`.
 *
 * Никаких персональных данных на этом пути не отправляется: контекст уже прошёл локальный
 * санитайзер, а сам Worker в demo-режиме игнорирует контекст и возвращает
 * каноничный mock.
 */

import { buildMockIpr, type IprDocumentData } from "./ipr_mock.ts";

export const DEFAULT_ARCHITECT_URL = "https://terminal-api.prevention.school/api/v1/terminal/architect";
export const ARCHITECT_REQUEST_TIMEOUT_MS = 8000;

export type ArchitectSource = "worker" | "local-fallback";

export interface ArchitectClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  anonymizedContext?: string;
}

export interface ArchitectResponseEnvelope {
  model_mode: "mock" | "live";
  case_id: string;
  generated_at: string;
  ipr_document: IprDocumentData;
  tokens_used: number;
  rag_used: string[];
}

export interface ArchitectResult {
  document: IprDocumentData;
  source: ArchitectSource;
  notice?: string;
}

/**
 * Запросить план у Архитектора. Возвращает либо ответ Worker'а, либо локальный
 * fallback. Никогда не выбрасывает исключение для сетевых ошибок — это часть
 * контракта: UI-слой не должен ронять страницу, если воркер недоступен.
 */
export async function requestArchitectPlan(
  caseId: string,
  options: ArchitectClientOptions = {},
): Promise<ArchitectResult> {
  const trimmed = caseId.trim();
  if (!trimmed) {
    throw new Error("requestArchitectPlan: caseId must be a non-empty string");
  }

  const baseUrl = options.baseUrl ?? resolveDefaultBaseUrl();
  const timeoutMs = options.timeoutMs ?? ARCHITECT_REQUEST_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    return {
      document: buildMockIpr(trimmed),
      source: "local-fallback",
      notice: "fetch is not available in this environment; used local demo plan.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        case_id: trimmed,
        client_mode: "demo",
        anonymized_context: options.anonymizedContext ?? "",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await safeReadText(response);
      return {
        document: buildMockIpr(trimmed),
        source: "local-fallback",
        notice:
          `Worker responded with HTTP ${response.status}; used local demo plan. ` +
          (detail ? `Server detail: ${truncate(detail, 240)}` : ""),
      };
    }

    const data = (await response.json()) as Partial<ArchitectResponseEnvelope>;
    const document = data?.ipr_document;
    if (!document || typeof document !== "object" || !("caseId" in document)) {
      return {
        document: buildMockIpr(trimmed),
        source: "local-fallback",
        notice: "Worker response missing `ipr_document`; used local demo plan.",
      };
    }

    return { document, source: "worker" };
  } catch (err) {
    return {
      document: buildMockIpr(trimmed),
      source: "local-fallback",
      notice: `Worker unreachable (${String(err)}); used local demo plan.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function resolveDefaultBaseUrl(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_TERMINAL_API_URL;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return DEFAULT_ARCHITECT_URL;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
