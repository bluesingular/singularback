/**
 * server/src/routes/integrations.ts
 *
 * Integration management — connect external services (Gmail, Slack, Notion…).
 * Credentials stored AES-256-GCM encrypted via company vault.
 *
 * GET    /companies/:companyId/integrations                         → list (no credentials)
 * POST   /companies/:companyId/integrations                         → create / connect
 * PATCH  /companies/:companyId/integrations/:id                     → update config
 * DELETE /companies/:companyId/integrations/:id                     → disconnect
 * GET    /companies/:companyId/integrations/:id/permissions         → agent permission grants
 * POST   /companies/:companyId/integrations/:id/permissions         → grant agent permissions
 * DELETE /companies/:companyId/integrations/:id/permissions/:agentId → revoke permissions
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { integrations, agentIntegrationPermissions, agents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { encryptCredential, decryptCredential } from "../integrations/vault.js";

const INTEGRATION_TYPES = [
  "gmail", "linkedin", "slack", "calendly", "notion",
  "airtable", "google_calendar", "hubspot", "custom",
] as const;

const PERMISSIONS_BY_TYPE: Record<string, string[]> = {
  gmail:           ["read_email", "send_email", "manage_labels"],
  linkedin:        ["search_profiles", "send_message", "view_profile"],
  slack:           ["send_message", "read_channel", "manage_webhooks"],
  calendly:        ["read_events", "create_event"],
  notion:          ["read_pages", "write_pages", "create_database"],
  airtable:        ["read_records", "write_records"],
  google_calendar: ["read_events", "create_event", "update_event"],
  hubspot:         ["read_contacts", "write_contacts", "read_deals"],
  custom:          ["api_read", "api_write"],
};

const CreateIntegrationSchema = z.object({
  type:        z.enum(INTEGRATION_TYPES),
  name:        z.string().min(1).max(100),
  credentials: z.string().min(1),
  config:      z.record(z.unknown()).optional().default({}),
  scopes:      z.array(z.string()).optional().default([]),
});

const UpdateIntegrationSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  credentials: z.string().min(1).optional(),
  config:      z.record(z.unknown()).optional(),
  status:      z.enum(["connected", "disconnected", "error"]).optional(),
});

const GrantPermissionsSchema = z.object({
  agentId:     z.string().uuid(),
  permissions: z.array(z.string()).min(1),
});

function safeIntegration(row: typeof integrations.$inferSelect) {
  const { credentialsEnc, credentialsIv, credentialsTag,
          oauthAccessTokenEnc, oauthRefreshTokenEnc, ...safe } = row;
  return safe;
}

export function integrationRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/integrations
  router.get("/companies/:companyId/integrations", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const rows = await db
      .select()
      .from(integrations)
      .where(eq(integrations.companyId, companyId))
      .orderBy(integrations.createdAt);

    res.json(rows.map(safeIntegration));
  });

  // POST /companies/:companyId/integrations
  router.post("/companies/:companyId/integrations", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const parsed = CreateIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid integration", details: parsed.error.flatten() });
      return;
    }

    const { type, name, credentials, config, scopes } = parsed.data;
    const { enc, iv, tag } = encryptCredential(companyId, credentials);

    const [integration] = await db
      .insert(integrations)
      .values({
        companyId,
        type,
        name,
        status:          "connected",
        credentialsEnc:  enc,
        credentialsIv:   iv,
        credentialsTag:  tag,
        config:          config as Record<string, unknown>,
        scopes,
      })
      .returning();

    res.status(201).json(safeIntegration(integration));
  });

  // PATCH /companies/:companyId/integrations/:id
  router.patch("/companies/:companyId/integrations/:id", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const parsed = UpdateIntegrationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name)        updates.name   = parsed.data.name;
    if (parsed.data.status)      updates.status = parsed.data.status;
    if (parsed.data.config)      updates.config = parsed.data.config;
    if (parsed.data.credentials) {
      const { enc, iv, tag } = encryptCredential(companyId, parsed.data.credentials);
      updates.credentialsEnc = enc;
      updates.credentialsIv  = iv;
      updates.credentialsTag = tag;
    }

    const [updated] = await db
      .update(integrations)
      .set(updates as any)
      .where(and(eq(integrations.id, id), eq(integrations.companyId, companyId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    res.json(safeIntegration(updated));
  });

  // DELETE /companies/:companyId/integrations/:id
  router.delete("/companies/:companyId/integrations/:id", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const [deleted] = await db
      .delete(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.companyId, companyId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    res.status(204).send();
  });

  // GET /companies/:companyId/integrations/:id/permissions
  router.get("/companies/:companyId/integrations/:id/permissions", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);

    const rows = await db
      .select({
        id:          agentIntegrationPermissions.id,
        agentId:     agentIntegrationPermissions.agentId,
        agentName:   agents.name,
        permissions: agentIntegrationPermissions.permissions,
        grantedAt:   agentIntegrationPermissions.grantedAt,
      })
      .from(agentIntegrationPermissions)
      .innerJoin(agents, eq(agents.id, agentIntegrationPermissions.agentId))
      .where(eq(agentIntegrationPermissions.integrationId, id));

    const integration = await db
      .select({ type: integrations.type })
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.companyId, companyId)))
      .then((r) => r[0]);

    const available = integration ? (PERMISSIONS_BY_TYPE[integration.type] ?? []) : [];
    res.json({ grants: rows, availablePermissions: available });
  });

  // POST /companies/:companyId/integrations/:id/permissions
  router.post("/companies/:companyId/integrations/:id/permissions", async (req, res) => {
    const { companyId, id } = req.params as { companyId: string; id: string };
    assertCompanyAccess(req, companyId);
    requireRole(req, "admin");

    const parsed = GrantPermissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const { agentId, permissions } = parsed.data;

    const [grant] = await db
      .insert(agentIntegrationPermissions)
      .values({ agentId, integrationId: id, permissions, grantedBy: req.actor.userId ?? null })
      .onConflictDoUpdate({
        target: [agentIntegrationPermissions.agentId, agentIntegrationPermissions.integrationId],
        set: { permissions, grantedAt: new Date() },
      })
      .returning();

    res.status(201).json(grant);
  });

  // DELETE /companies/:companyId/integrations/:id/permissions/:agentId
  router.delete("/companies/:companyId/integrations/:id/permissions/:agentId", async (req, res) => {
    const { id, agentId } = req.params as { companyId: string; id: string; agentId: string };
    assertCompanyAccess(req, req.params.companyId);
    requireRole(req, "admin");

    await db
      .delete(agentIntegrationPermissions)
      .where(
        and(
          eq(agentIntegrationPermissions.integrationId, id),
          eq(agentIntegrationPermissions.agentId, agentId),
        ),
      );

    res.status(204).send();
  });

  return router;
}
