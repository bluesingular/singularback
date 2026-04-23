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
export declare class VaultError extends Error {
    constructor(message: string);
}
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
export declare function encryptCredential(companyId: string, plaintext: string): EncryptedBlob;
/**
 * Decrypt a credential blob for a specific company.
 * Throws if the auth tag does not match (ciphertext was tampered).
 *
 * RULE 2: Only call this server-side for tool execution — never log the result.
 */
export declare function decryptCredential(companyId: string, enc: Buffer, iv: Buffer, tag: Buffer): string;
/**
 * Encrypt a JSON object (e.g. OAuth token set) as a single blob.
 */
export declare function encryptJson(companyId: string, data: unknown): EncryptedBlob;
/**
 * Decrypt and parse a JSON blob.
 */
export declare function decryptJson<T = unknown>(companyId: string, enc: Buffer, iv: Buffer, tag: Buffer): T;
//# sourceMappingURL=vault.d.ts.map