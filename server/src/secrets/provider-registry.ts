import type { SecretProvider, SecretProviderDescriptor } from "@paperclipai/shared";
import { localEncryptedProvider } from "./local-encrypted-provider.js";
import { vaultProvider } from "./external-stub-providers.js";
import type { SecretProviderModule } from "./types.js";
import { unprocessable } from "../errors.js";

// EU-sovereign only: local AES-256-GCM (primary) + self-hosted HashiCorp Vault.
const providers: SecretProviderModule[] = [
  localEncryptedProvider,
  vaultProvider,
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
