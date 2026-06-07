import { unprocessable } from "../errors.js";
import type { SecretProviderModule } from "./types.js";

function unavailableProvider(
  id: "vault",
  label: string,
): SecretProviderModule {
  return {
    id,
    descriptor: {
      id,
      label,
      requiresExternalRef: true,
    },
    async createVersion() {
      throw unprocessable(`${id} provider is not configured in this deployment`);
    },
    async resolveVersion() {
      throw unprocessable(`${id} provider is not configured in this deployment`);
    },
  };
}

// Self-hosted HashiCorp Vault — EU-compliant when self-hosted.
// Wire up by implementing resolveVersion() with your Vault HTTP API token.
export const vaultProvider = unavailableProvider("vault", "HashiCorp Vault");
