import type { WorkspacePreset } from "./terminal_config.ts";

export const INVITE_CODE_RE = /^(CHILD|PARENT)-[A-Z0-9]{4,12}$/;

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

export function validateInviteCodeFormat(code: string): boolean {
  const normalized = normalizeInviteCode(code);
  return normalized.length > 0 && INVITE_CODE_RE.test(normalized);
}

export type InviteCodeKind = "parent" | "child";

export function inviteCodeKind(code: string): InviteCodeKind | null {
  const normalized = normalizeInviteCode(code);
  if (normalized.startsWith("PARENT-")) return "parent";
  if (normalized.startsWith("CHILD-")) return "child";
  return null;
}

/** Specialist / educator_lite: incoming link from manager must be PARENT-… */
export function validateParentInLink(code: string): string | null {
  if (!code.trim()) return null;
  const normalized = normalizeInviteCode(code);
  if (!validateInviteCodeFormat(normalized)) {
    return "Неверный формат ссылки. Ожидается PARENT-… (например, PARENT-ABC123).";
  }
  if (inviteCodeKind(normalized) !== "parent") {
    return "Специалисту нужна ссылка непосредственного руководителя (PARENT-…), а не дочерняя ссылка специалиста (CHILD-…).";
  }
  return null;
}

/** Manager: incoming link from subordinate org/specialist must be CHILD-… */
export function validateChildInLink(
  code: string,
  opts?: { territorial?: boolean },
): string | null {
  if (!code.trim()) return null;
  const normalized = normalizeInviteCode(code);
  if (!validateInviteCodeFormat(normalized)) {
    return "Неверный формат ссылки. Ожидается CHILD-… (например, CHILD-ABC123).";
  }
  if (inviteCodeKind(normalized) !== "child") {
    return opts?.territorial
      ? "Подключайте организации по дочерней ссылке директора (CHILD-…), а не по родительской ссылке руководителя (PARENT-…)."
      : "Подключайте специалистов по дочерней ссылке (CHILD-…), а не по родительской (PARENT-…).";
  }
  return null;
}

export function validateFederationLinks(args: {
  workspacePreset: WorkspacePreset;
  isManagerPreset: boolean;
  territorialManager: boolean;
  parentIn: string;
  childIn: string;
}): string | null {
  const { workspacePreset, isManagerPreset, territorialManager, parentIn, childIn } = args;
  if (workspacePreset === "specialist" || workspacePreset === "educator_lite") {
    return validateParentInLink(parentIn);
  }
  if (isManagerPreset) {
    return validateChildInLink(childIn, { territorial: territorialManager });
  }
  return null;
}
