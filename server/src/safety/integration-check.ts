/**
 * server/src/safety/integration-check.ts
 *
 * F5 — Integration disconnection handling.
 *
 * Before any task that requires an integration (declared in skill.metadata.tools),
 * validateRequiredIntegrations() checks whether the needed credentials are
 * connected. If any are missing, the task is blocked immediately with a
 * plain-French notification — never crashes mid-execution.
 */

import { and, eq } from "drizzle-orm";
import { integrations } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "integration-check" });

export class IntegrationDisconnectedError extends Error {
  constructor(public readonly integrationSlug: string) {
    super(`Intégration requise non connectée : ${integrationSlug}`);
    this.name = "IntegrationDisconnectedError";
  }
}

/**
 * Validates that all required integrations for a skill are connected.
 * Required integration slugs come from skill.metadata.tools[].mcp values.
 *
 * @throws IntegrationDisconnectedError if any required integration is missing
 */
export async function validateRequiredIntegrations(
  db:                   Db,
  companyId:            string,
  requiredIntegrations: string[],
): Promise<void> {
  if (requiredIntegrations.length === 0) return;

  for (const slug of requiredIntegrations) {
    const [cred] = await db
      .select({ id: integrations.id, status: integrations.status })
      .from(integrations)
      .where(
        and(
          eq(integrations.companyId, companyId),
          eq(integrations.type, slug),
          eq(integrations.status, "connected"),
        ),
      )
      .limit(1);

    if (!cred) {
      logger.warn({ companyId, slug }, "integration-check: required integration not connected");
      throw new IntegrationDisconnectedError(slug);
    }
  }
}
