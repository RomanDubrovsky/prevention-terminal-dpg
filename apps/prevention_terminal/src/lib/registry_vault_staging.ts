/** Browser staging crypto for .vault.enc — same PRV1 layout as Rust `registry_vault.rs`. */

const VAULT_MAGIC = new Uint8Array([0x50, 0x52, 0x56, 0x31]);
const VAULT_VERSION = 1;
const SALT_LEN = 16;
const NONCE_LEN = 12;

export function normalizeRecoveryKey(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

export async function hashRecoveryKeyHex(normalized: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateRecoveryKeyDisplay(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    parts.push(
      [...bytes.slice(i, i + 4)].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(""),
    );
  }
  return parts.join("-");
}

async function deriveBackupKey(normalized: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const combined = new Uint8Array(salt.length + enc.encode(normalized).length);
  combined.set(salt);
  combined.set(enc.encode(normalized), salt.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return new Uint8Array(digest);
}

export async function encryptVaultBytes(plaintext: Uint8Array, recoveryKey: string): Promise<Uint8Array> {
  const normalized = normalizeRecoveryKey(recoveryKey);
  if (normalized.length !== 64) throw new Error("invalid_recovery_key");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const keyBytes = await deriveBackupKey(normalized, salt);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes as any, "AES-GCM", false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cryptoKey, plaintext as any),
  );
  const out = new Uint8Array(4 + 2 + SALT_LEN + NONCE_LEN + ciphertext.length);
  out.set(VAULT_MAGIC, 0);
  out[4] = VAULT_VERSION & 0xff;
  out[5] = (VAULT_VERSION >> 8) & 0xff;
  out.set(salt, 6);
  out.set(nonce, 6 + SALT_LEN);
  out.set(ciphertext, 6 + SALT_LEN + NONCE_LEN);
  return out;
}

export async function decryptVaultBytes(data: Uint8Array, recoveryKey: string): Promise<Uint8Array> {
  if (data.length < 6 + SALT_LEN + NONCE_LEN + 16) throw new Error("invalid_vault_file");
  for (let i = 0; i < 4; i += 1) {
    if (data[i] !== VAULT_MAGIC[i]) throw new Error("invalid_vault_file");
  }
  const version = data[4]! | (data[5]! << 8);
  if (version !== VAULT_VERSION) throw new Error("unsupported_vault_version");
  const salt = data.slice(6, 6 + SALT_LEN);
  const nonce = data.slice(6 + SALT_LEN, 6 + SALT_LEN + NONCE_LEN);
  const ciphertext = data.slice(6 + SALT_LEN + NONCE_LEN);
  const normalized = normalizeRecoveryKey(recoveryKey);
  if (normalized.length !== 64) throw new Error("decrypt_failed");
  const keyBytes = await deriveBackupKey(normalized, salt);
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes as any, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, cryptoKey, ciphertext as any);
  return new Uint8Array(plain);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}
