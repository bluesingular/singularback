/**
 * server/src/services/instance-api-keys.ts
 *
 * Store and retrieve encrypted instance-level API keys in instance_settings.general._apiKeys.
 * Keys are AES-256-GCM encrypted with a key derived from VAULT_MASTER_KEY.
 * Values are never returned to callers — only metadata (configured, updatedAt).
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { instanceSettings } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

export const API_KEY_PROVIDERS = [
  { id: "openrouter",         label: "OpenRouter",               envVar: "OPENROUTER_API_KEY",     description: "Requis pour tous les appels LLM (multi-modèles)" },
  { id: "mistral",            label: "Mistral AI",               envVar: "MISTRAL_API_KEY",        description: "Requis pour les embeddings mémoire (pgvector)" },
  { id: "firecrawl",         label: "Firecrawl",                envVar: "FIRECRAWL_API_KEY",      description: "Navigation web des agents (optionnel — fallback Jina)" },
  { id: "stripe_secret",     label: "Stripe — Clé secrète",     envVar: "STRIPE_SECRET_KEY",      description: "Requis pour la facturation Stripe" },
  { id: "stripe_publishable",label: "Stripe — Clé publique",    envVar: "STRIPE_PUBLISHABLE_KEY", description: "Requis pour Stripe.js côté client" },
  { id: "stripe_webhook",    label: "Stripe — Secret webhook",  envVar: "STRIPE_WEBHOOK_SECRET",  description: "Validation des événements webhook Stripe" },
] as const;

export type ApiKeyProvider = (typeof API_KEY_PROVIDERS)[number]["id"];

interface StoredApiKey {
  enc: string;
  iv: string;
  tag: string;
  updatedAt: string;
}

type ApiKeyStore = Partial<Record<string, StoredApiKey>>;

export interface ApiKeyStatus {
  provider: ApiKeyProvider;
  label: string;
  envVar: string;
  description: string;
  configured: boolean;
  source: "db" | "env" | null;
  updatedAt: string | null;
}

function getInstanceKey(): Buffer {
  const masterKeyHex = process.env.VAULT_MASTER_KEY;
  if (!masterKeyHex || masterKeyHex.length !== 64) {
    throw new Error("VAULT_MASTER_KEY must be a 64-character hex string");
  }
  const master = Buffer.from(masterKeyHex, "hex");
  return Buffer.from(hkdfSync("sha256", master, "", "singular:instance:apikeys", 32));
}

function encrypt(plaintext: string): StoredApiKey {
  const key = getInstanceKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    enc: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    updatedAt: new Date().toISOString(),
  };
}

function decrypt(stored: StoredApiKey): string {
  const key = getInstanceKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(stored.iv, "base64"),
    { authTagLength: 16 },
  );
  decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
  const enc = Buffer.from(stored.enc, "base64");
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}

const SINGLETON_KEY = "default";

export function instanceApiKeysService(db: Db) {
  async function getRow() {
    const rows = await db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.singletonKey, SINGLETON_KEY));
    if (rows[0]) return rows[0];

    const [created] = await db
      .insert(instanceSettings)
      .values({ singletonKey: SINGLETON_KEY, general: {}, experimental: {} })
      .onConflictDoUpdate({ target: [instanceSettings.singletonKey], set: { updatedAt: new Date() } })
      .returning();
    return created;
  }

  async function getStore(): Promise<ApiKeyStore> {
    const row = await getRow();
    return ((row.general as Record<string, unknown>)._apiKeys ?? {}) as ApiKeyStore;
  }

  async function saveStore(store: ApiKeyStore): Promise<void> {
    const row = await getRow();
    const general = { ...(row.general as Record<string, unknown>), _apiKeys: store };
    await db
      .update(instanceSettings)
      .set({ general, updatedAt: new Date() })
      .where(eq(instanceSettings.id, row.id));
  }

  return {
    async list(): Promise<ApiKeyStatus[]> {
      const store = await getStore();
      return API_KEY_PROVIDERS.map((p) => {
        const inDb = store[p.id];
        const inEnv = !!process.env[p.envVar];
        return {
          provider: p.id,
          label: p.label,
          envVar: p.envVar,
          description: p.description,
          configured: !!(inDb || inEnv),
          source: inDb ? "db" : inEnv ? "env" : null,
          updatedAt: inDb?.updatedAt ?? null,
        };
      });
    },

    async upsert(provider: string, value: string): Promise<void> {
      const store = await getStore();
      store[provider] = encrypt(value);
      await saveStore(store);
    },

    async remove(provider: string): Promise<void> {
      const store = await getStore();
      delete store[provider];
      await saveStore(store);
    },

    async resolve(provider: ApiKeyProvider): Promise<string | null> {
      const store = await getStore();
      const inDb = store[provider];
      if (inDb) return decrypt(inDb);
      const meta = API_KEY_PROVIDERS.find((p) => p.id === provider);
      if (meta) return process.env[meta.envVar] ?? null;
      return null;
    },
  };
}
