import type { SecretProvider, SecretProviderDescriptor } from "@paperclipai/shared";
import { localEncryptedProvider } from "./local-encrypted-provider.js";
import {
  awsSecretsManagerProvider,
  gcpSecretManagerProvider,
  vaultProvider,
} from "./external-stub-providers.js";
import type { SecretProviderModule } from "./types.js";
import { unprocessable } from "../errors.js";

// EU-sovereign first: local AES-256-GCM vault is the primary.
// AWS/GCP are stubs kept for upstream compatibility — not offered to customers.
const providers: SecretProviderModule[] = [
  localEncryptedProvider,
  awsSecretsManagerProvider, // stub — not EU-sovereign, not exposed in UI
  gcpSecretManagerProvider,  // stub
  vaultProvider,             // stub — available for self-hosted HashiCorp Vault
];

const providerById = new Map<SecretProvider, SecretProviderModule>(
  providers.map((provider) => [provider.id, provider]),
);

export function getSecretProvider(id: SecretProvider): SecretProviderModule {
  const provider = providerById.get(id);
  if (!provider) throw unprocessable(`Unsupported secret provider: ${id}`);
  return provider;
}

export function listSecretProviders(): SecretProviderDescriptor[] {
  return providers.map((provider) => provider.descriptor);
}
