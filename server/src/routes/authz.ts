import type { Request } from "express";
import { forbidden, unauthorized } from "../errors.js";
import type { CompanyRole } from "@paperclipai/shared";

// Role hierarchy score — higher = more access
const ROLE_LEVEL: Record<CompanyRole, number> = {
  owner:    5,
  admin:    4,
  operator: 3,
  api:      3, // service accounts, same level as operator
  viewer:   1,
};

export function assertAuthenticated(req: Request) {
  if (req.actor.type === "none") {
    throw unauthorized();
  }
}

export function assertBoard(req: Request) {
  if (req.actor.type !== "board") {
    throw forbidden("Board access required");
  }
}

export function hasBoardOrgAccess(req: Request) {
  if (req.actor.type !== "board") {
    return false;
  }
  if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
    return true;
  }
  return Array.isArray(req.actor.companyIds) && req.actor.companyIds.length > 0;
}

export function assertBoardOrgAccess(req: Request) {
  assertBoard(req);
  if (hasBoardOrgAccess(req)) {
    return;
  }
  throw forbidden("Company membership or instance admin access required");
}

export function assertInstanceAdmin(req: Request) {
  assertBoard(req);
  if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
    return;
  }
  throw forbidden("Instance admin access required");
}

export function assertCompanyAccess(req: Request, companyId: string) {
  assertAuthenticated(req);
  if (req.actor.type === "agent" && req.actor.companyId !== companyId) {
    throw forbidden("Agent key cannot access another company");
  }
  if (req.actor.type === "board" && req.actor.source !== "local_implicit") {
    const allowedCompanies = req.actor.companyIds ?? [];
    if (!allowedCompanies.includes(companyId)) {
      throw forbidden("User does not have access to this company");
    }
    const method = typeof req.method === "string" ? req.method.toUpperCase() : "GET";
    const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(method);
    if (!isSafeMethod && !req.actor.isInstanceAdmin && Array.isArray(req.actor.memberships)) {
      const membership = req.actor.memberships.find((item) => item.companyId === companyId);
      if (!membership || membership.status !== "active") {
        throw forbidden("User does not have active company access");
      }
      if (membership.membershipRole === "viewer" || ROLE_LEVEL[membership.membershipRole as CompanyRole] === 1) {
        throw forbidden("Viewer access is read-only");
      }
    }
  }
}

/**
 * Require the authenticated user to have at least `minRole` in the active company.
 * Throws 403 if the role is insufficient or ctx is not set.
 *
 * Usage: requireRole(req, "admin")
 */
export function requireRole(req: Request, minRole: CompanyRole): void {
  if (!req.ctx) {
    throw forbidden("Aucune entreprise active pour ce compte.");
  }
  const actual = ROLE_LEVEL[req.ctx.role] ?? 0;
  const required = ROLE_LEVEL[minRole] ?? 0;
  if (actual < required) {
    throw forbidden(`Rôle insuffisant — ${minRole} requis.`);
  }
}

export function getActorInfo(req: Request) {
  assertAuthenticated(req);
  if (req.actor.type === "agent") {
    return {
      actorType: "agent" as const,
      actorId: req.actor.agentId ?? "unknown-agent",
      agentId: req.actor.agentId ?? null,
      runId: req.actor.runId ?? null,
    };
  }

  return {
    actorType: "user" as const,
    actorId: req.actor.userId ?? "board",
    agentId: null,
    runId: req.actor.runId ?? null,
  };
}
