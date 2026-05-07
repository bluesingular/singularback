/**
 * server/src/routes/members.ts
 *
 * G3 — Member management for a company.
 *
 * GET    /companies/:companyId/singular/members              → list members with user info
 * PATCH  /companies/:companyId/singular/members/:memberId/role → change role (admin+)
 * DELETE /companies/:companyId/singular/members/:memberId      → remove member (admin+, can't remove last owner)
 */

import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { companyMemberships, authUsers } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { COMPANY_ROLES, type CompanyRole } from "@paperclipai/shared";
import { assertCompanyAccess, requireRole } from "./authz.js";
import { notFound } from "../errors.js";

const RoleSchema = z.object({
  role: z.enum(COMPANY_ROLES as [CompanyRole, ...CompanyRole[]]),
});

export function membersRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/singular/members
  // Returns all active members with email + display name. Readable by all roles.
  router.get("/companies/:companyId/singular/members", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);

    const rows = await (db as any)
      .select({
        id:        companyMemberships.id,
        userId:    companyMemberships.principalId,
        role:      companyMemberships.membershipRole,
        status:    companyMemberships.status,
        joinedAt:  companyMemberships.joinedAt,
        email:     authUsers.email,
        name:      authUsers.name,
      })
      .from(companyMemberships)
      .leftJoin(
        authUsers,
        and(
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.principalId, authUsers.id),
        ),
      )
      .where(
        and(
          eq(companyMemberships.companyId, companyId),
          eq(companyMemberships.principalType, "user"),
          eq(companyMemberships.status, "active"),
        ),
      );

    res.json({ members: rows });
  });

  // PATCH /companies/:companyId/singular/members/:memberId/role
  // Requires admin. Only owner can set role to "owner".
  router.patch(
    "/companies/:companyId/singular/members/:memberId/role",
    async (req, res) => {
      const { companyId, memberId } = req.params as {
        companyId: string;
        memberId: string;
      };
      assertCompanyAccess(req, companyId);
      requireRole(req, "admin");

      const { role } = RoleSchema.parse(req.body);

      // Only owner can assign owner role
      if (role === "owner") {
        requireRole(req, "owner");
      }

      const [existing] = await (db as any)
        .select()
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.id, memberId),
            eq(companyMemberships.companyId, companyId),
          ),
        );

      if (!existing) throw notFound("Membre introuvable");

      // Prevent removing the last owner
      if (existing.membershipRole === "owner" && role !== "owner") {
        const [ownerCount] = await (db as any)
          .select({ count: (db as any).sql`count(*)::int` })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.companyId, companyId),
              eq(companyMemberships.membershipRole, "owner"),
              eq(companyMemberships.status, "active"),
            ),
          );
        if ((ownerCount?.count ?? 0) <= 1) {
          res.status(409).json({ error: "Impossible de retirer le rôle du dernier propriétaire." });
          return;
        }
      }

      const [updated] = await (db as any)
        .update(companyMemberships)
        .set({ membershipRole: role, updatedAt: new Date() })
        .where(eq(companyMemberships.id, memberId))
        .returning({ id: companyMemberships.id, role: companyMemberships.membershipRole });

      res.json(updated);
    },
  );

  // DELETE /companies/:companyId/singular/members/:memberId
  // Requires admin. Cannot remove self or last owner.
  router.delete(
    "/companies/:companyId/singular/members/:memberId",
    async (req, res) => {
      const { companyId, memberId } = req.params as {
        companyId: string;
        memberId: string;
      };
      assertCompanyAccess(req, companyId);
      requireRole(req, "admin");

      const [existing] = await (db as any)
        .select()
        .from(companyMemberships)
        .where(
          and(
            eq(companyMemberships.id, memberId),
            eq(companyMemberships.companyId, companyId),
            eq(companyMemberships.status, "active"),
          ),
        );

      if (!existing) throw notFound("Membre introuvable");

      // Prevent removing last owner
      if (existing.membershipRole === "owner") {
        const [ownerCount] = await (db as any)
          .select({ count: (db as any).sql`count(*)::int` })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.companyId, companyId),
              eq(companyMemberships.membershipRole, "owner"),
              eq(companyMemberships.status, "active"),
            ),
          );
        if ((ownerCount?.count ?? 0) <= 1) {
          res.status(409).json({ error: "Impossible de supprimer le dernier propriétaire." });
          return;
        }
      }

      await (db as any)
        .update(companyMemberships)
        .set({ status: "removed", updatedAt: new Date() })
        .where(eq(companyMemberships.id, memberId));

      res.json({ ok: true });
    },
  );

  return router;
}
