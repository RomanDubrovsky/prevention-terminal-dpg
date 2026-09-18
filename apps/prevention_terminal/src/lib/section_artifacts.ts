import { getDomainConfig } from "./domain/index.ts";

export type ExpertProtocolId = "audit" | "conclusion" | "fba" | "bip" | "mdr" | "child_profile" | "program_audit";

export interface ExpertArtifact {
  text: string;
  segments?: Record<string, string>;
  structured?: boolean;
  saved_at?: string;
}

export interface SessionArtifacts {
  plan_text?: string;
  report_text?: string;
  plan_segments?: Record<string, string>;
  report_segments?: Record<string, string>;
  expert?: Partial<Record<ExpertProtocolId, ExpertArtifact>>;
  architect_handoff?: string;
  contact_sed?: Record<string, any>;
}

export const EMPTY_ARTIFACTS: SessionArtifacts = {};

export function emptyExpertArtifact(): ExpertArtifact {
  return { text: "" };
}

/** Normalize expert artifact to a single privacy-safe text body. */
export function formatExpertArtifactBody(artifact: ExpertArtifact): string {
  const text = String(artifact.text || "").trim();
  if (text) return text;
  if (artifact.segments) {
    return Object.entries(artifact.segments)
      .map(([k, v]) => `${k}: ${String(v || "").trim()}`)
      .filter((line) => line.length > 2)
      .join("\n");
  }
  return "";
}

export function artifactFromAiResult(result: {
  reply?: string;
  raw_text?: string;
  segments?: Record<string, string>;
  structured?: boolean;
}): ExpertArtifact {
  const text =
    String(result.raw_text || "").trim() ||
    (result.segments
      ? Object.values(result.segments)
          .map((v) => String(v || "").trim())
          .filter(Boolean)
          .join("\n\n")
      : "") ||
    String(result.reply || "").trim();
  return {
    text,
    segments: result.segments,
    structured: result.structured,
    saved_at: new Date().toISOString(),
  };
}

export function mergeArtifacts(base: SessionArtifacts, patch: Partial<SessionArtifacts>): SessionArtifacts {
  return {
    ...base,
    ...patch,
    expert: { ...base.expert, ...patch.expert },
  };
}

export function expertLabel(id: ExpertProtocolId): string {
  return getDomainConfig().labels[id];
}

/** Backend protocol id — maps frontend keys to what the AI endpoint accepts. */
export function expertApiProtocol(id: ExpertProtocolId): string {
  if (id === "child_profile" || id === "program_audit") return "audit";
  if (id === "bip") return "bip";
  return id;
}
