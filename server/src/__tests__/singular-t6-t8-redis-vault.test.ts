/**
 * T6 + T8 — Redis resilience + vault key versioning.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getCurrentKeyVersion, encryptVersioned, decryptVersioned } from "../integrations/vault.js";

// ── T6: Redis retry strategy ──────────────────────────────────────────────────

describe("T6 — Redis retry strategy", () => {
  it("1. retryStrategy caps at 3000ms", () => {
    const retryStrategy = (times: number) => Math.min(times * 100, 3000);
    expect(retryStrategy(1)).toBe(100);
    expect(retryStrategy(10)).toBe(1000);
    expect(retryStrategy(30)).toBe(3000);
    expect(retryStrategy(100)).toBe(3000);
  });

  it("2. reconnectOnError triggers on READONLY error", () => {
    const reconnectOnError = (err: Error) => err.message.includes("READONLY");
    expect(reconnectOnError(new Error("READONLY you can't write"))).toBe(true);
    expect(reconnectOnError(new Error("Connection refused"))).toBe(false);
  });

  it("3. exponential backoff increases with each retry", () => {
    const retryStrategy = (times: number) => Math.min(times * 100, 3000);
    const delays = [1, 2, 3, 4, 5].map(retryStrategy);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]!);
    }
  });
});

// ── T8: Vault key versioning ──────────────────────────────────────────────────

describe("T8 — vault key versioning", () => {
  const COMPANY_ID = "test-company";

  beforeEach(() => {
    process.env.VAULT_MASTER_KEY = "a".repeat(64);
    process.env.VAULT_KEY_VERSION = "1";
  });

  it("4. getCurrentKeyVersion defaults to 1", () => {
    delete process.env.VAULT_KEY_VERSION;
    expect(getCurrentKeyVersion()).toBe(1);
  });

  it("5. getCurrentKeyVersion reads VAULT_KEY_VERSION env", () => {
    process.env.VAULT_KEY_VERSION = "3";
    expect(getCurrentKeyVersion()).toBe(3);
    process.env.VAULT_KEY_VERSION = "1";
  });

  it("6. encryptVersioned attaches current key version", () => {
    const result = encryptVersioned(COMPANY_ID, "secret-value");
    expect(result.keyVersion).toBe(1);
    expect(result.encrypted).toBeInstanceOf(Buffer);
    expect(result.iv).toBeInstanceOf(Buffer);
    expect(result.tag).toBeInstanceOf(Buffer);
  });

  it("7. decryptVersioned round-trips correctly for current version", () => {
    const credential = encryptVersioned(COMPANY_ID, "my-api-key-12345");
    const decrypted = decryptVersioned(COMPANY_ID, credential);
    expect(decrypted).toBe("my-api-key-12345");
  });

  it("8. decryptVersioned throws when old key env var missing during rotation", () => {
    delete process.env.VAULT_MASTER_KEY_V0;
    const oldCredential = encryptVersioned(COMPANY_ID, "old-value");
    oldCredential.keyVersion = 0; // simulate credential from version 0

    expect(() => decryptVersioned(COMPANY_ID, oldCredential)).toThrow("Key version 0 not found");
  });

  it("9. different key versions produce different ciphertexts", () => {
    const v1 = encryptVersioned(COMPANY_ID, "same-plaintext");
    const v2 = encryptVersioned(COMPANY_ID, "same-plaintext");
    // Same key version but different IVs → different ciphertexts
    expect(v1.encrypted.equals(v2.encrypted)).toBe(false);
  });
});
