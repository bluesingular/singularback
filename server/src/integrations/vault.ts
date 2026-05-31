/**
 * server/src/integrations/vault.ts
 *
 * AES-256-GCM credential vault with per-company HKDF key derivation.
 *
 * RULE 2 (code invariant):
 *   - Credentials are decrypted server-side for tool calls ONLY
 *   - The LLM never receives tokens, API keys, or any raw credential
 *   - Master key lives in VAULT_MASTER_KEY env var, never in the database
 *
 * Key derivation:
 *   master_key (32 bytes from env) + company_id → HKDF-SHA256 → 32-byte company key
 *   Each company gets a unique, deterministic key derived from the master.
 *   Compromise of one company key does NOT expose other companies.
 *
 * Encryption:
 *   AES-256-GCM with random 12-byte IV per encryption operation.
 *   GCM auth tag (16 bytes) prevents ciphertext tampering.
 */

import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // bytes
const IV_LENGTH = 12;  // bytes (96-bit IV recommended for GCM)
const TAG_LENGTH = 16; // bytes (128-bit auth tag)

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultError";
  }
}

// ── Key derivation ────────────────────────────────────────────────────────────

/**
 * Derive a 32-byte encryption key for a specific company.
 * Uses HKDF-SHA256: deterministic, non-reversible without the master key.
 */
function getCompanyKey(companyId: string): Buffer {
  const masterKeyHex = process.env.VAULT_MASTER_KEY;
  if (!masterKeyHex) {
    throw new VaultError(
      "VAULT_MASTER_KEY is not configured. Set a 64-character hex string in environment.",
    );
  }
  if (masterKeyHex.length !== 64) {
    throw new VaultError(
      `VAULT_MASTER_KEY must be exactly 64 hex characters (32 bytes). Got ${masterKeyHex.length}.`,
    );
  }

  const master = Buffer.from(masterKeyHex, "hex");
  // HKDF: info = company_id provides domain separation between companies
  return Buffer.from(
    hkdfSync("sha256", master, "", `singular:vault:${companyId}`, KEY_LENGTH),
  );
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

export interface EncryptedBlob {
  enc: Buffer;
  iv: Buffer;
  tag: Buffer;
}

/**
 * Encrypt a plaintext credential string for a specific company.
 * Returns three separate buffers suitable for storage in BYTEA columns.
 *
 * RULE 2: Only call this when persisting credentials — never in LLM context.
 */
export function encryptCredential(companyId: string, plaintext: string): EncryptedBlob {
  const key = getCompanyKey(companyId);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { enc, iv, tag };
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypt a credential blob for a specific company.
 * Throws if the auth tag does not match (ciphertext was tampered).
 *
 * RULE 2: Only call this server-side for tool execution — never log the result.
 */
export function decryptCredential(
  companyId: string,
  enc: Buffer,
  iv: Buffer,
  tag: Buffer,
): string {
  const key = getCompanyKey(companyId);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  try {
    return decipher.update(enc).toString("utf8") + decipher.final("utf8");
  } catch {
    throw new VaultError(
      "Credential decryption failed: auth tag mismatch. The stored credential may be corrupted.",
    );
  }
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/**
 * Encrypt a JSON object (e.g. OAuth token set) as a single blob.
 */
export function encryptJson(companyId: string, data: unknown): EncryptedBlob {
  return encryptCredential(companyId, JSON.stringify(data));
}

/**
 * Decrypt and parse a JSON blob.
 */
export function decryptJson<T = unknown>(
  companyId: string,
  enc: Buffer,
  iv: Buffer,
  tag: Buffer,
): T {
  return JSON.parse(decryptCredential(companyId, enc, iv, tag)) as T;
}

// ── T8: Key versioning ────────────────────────────────────────────────────────

/**
 * T8 — Vault key versioning.
 *
 * Credentials store which key version encrypted them, enabling safe rotation.
 * The current key version is read from VAULT_KEY_VERSION env var (default: 1).
 *
 * On rotation:
 *   1. Generate new VAULT_MASTER_KEY, increment VAULT_KEY_VERSION
 *   2. Run: scripts/rotate-vault-keys
 *      → Decrypts each credential with old key version
 *      → Re-encrypts with new key version
 *      → Updates keyVersion field in DB
 *
 * This is documented in OPERATIONS.md.
 */

export interface VersionedCredential {
  encrypted: Buffer;
  iv:        Buffer;
  tag:       Buffer;
  keyVersion: number;
}

export function getCurrentKeyVersion(): number {
  return parseInt(process.env.VAULT_KEY_VERSION ?? "1", 10);
}

/**
 * Encrypt with the current key version attached.
 * Use this for new credentials (replaces encryptCredential for versioned storage).
 */
export function encryptVersioned(
  companyId: string,
  plaintext: string,
): VersionedCredential {
  const blob = encryptCredential(companyId, plaintext);
  return { ...blob, encrypted: blob.enc, keyVersion: getCurrentKeyVersion() };
}

/**
 * Decrypt a versioned credential.
 * If keyVersion !== currentVersion, decryption uses the key derived from
 * VAULT_MASTER_KEY_V{keyVersion} env var (set during rotation window).
 */
export function decryptVersioned(
  companyId:  string,
  credential: VersionedCredential,
): string {
  const currentVersion = getCurrentKeyVersion();
  if (credential.keyVersion !== currentVersion) {
    // During rotation: use the old key from VAULT_MASTER_KEY_V{n} env var
    const oldKeyHex = process.env[`VAULT_MASTER_KEY_V${credential.keyVersion}`];
    if (!oldKeyHex) {
      throw new VaultError(
        `Key version ${credential.keyVersion} not found. Set VAULT_MASTER_KEY_V${credential.keyVersion} during rotation.`,
      );
    }
    // Temporarily swap env to use old key
    const saved = process.env.VAULT_MASTER_KEY;
    process.env.VAULT_MASTER_KEY = oldKeyHex;
    try {
      return decryptCredential(companyId, credential.encrypted, credential.iv, credential.tag);
    } finally {
      process.env.VAULT_MASTER_KEY = saved;
    }
  }
  return decryptCredential(companyId, credential.encrypted, credential.iv, credential.tag);
}
