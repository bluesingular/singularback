import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { checkRedisHealth } from "../queue/redis.js";
import { and, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { heartbeatRuns, instanceUserRoles, invites } from "@paperclipai/db";
import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import { readPersistedDevServerStatus, toDevServerHealthStatus } from "../dev-server-status.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import { serverVersion } from "../version.js";

function shouldExposeFullHealthDetails(
  actorType: "none" | "board" | "agent" | null | undefined,
  deploymentMode: DeploymentMode,
) {
  if (deploymentMode !== "authenticated") return true;
  return actorType === "board" || actorType === "agent";
}

export function healthRoutes(
  db?: Db,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    authReady: boolean;
    companyDeletionEnabled: boolean;
  } = {
    deploymentMode: "local_trusted",
    deploymentExposure: "private",
    authReady: true,
    companyDeletionEnabled: true,
  },
) {
  const router = Router();

  router.get("/", async (req, res) => {
    const actorType = "actor" in req ? req.actor?.type : null;
    const exposeFullDetails = shouldExposeFullHealthDetails(
      actorType,
      opts.deploymentMode,
    );

    if (!db) {
      res.json(
        exposeFullDetails
          ? { status: "ok", version: serverVersion }
          : { status: "ok", deploymentMode: opts.deploymentMode },
      );
      return;
    }

    try {
      await db.execute(sql`SELECT 1`);
    } catch {
      res.status(503).json({
        status: "unhealthy",
        version: serverVersion,
        error: "database_unreachable",
      });
      return;
    }

    let bootstrapStatus: "ready" | "bootstrap_pending" = "ready";
    let bootstrapInviteActive = false;
    if (opts.deploymentMode === "authenticated") {
      const roleCount = await db
        .select({ count: count() })
        .from(instanceUserRoles)
        .where(sql`${instanceUserRoles.role} = 'instance_admin'`)
        .then((rows) => Number(rows[0]?.count ?? 0));
      bootstrapStatus = roleCount > 0 ? "ready" : "bootstrap_pending";

      if (bootstrapStatus === "bootstrap_pending") {
        const now = new Date();
        const inviteCount = await db
          .select({ count: count() })
          .from(invites)
          .where(
            and(
              eq(invites.inviteType, "bootstrap_ceo"),
              isNull(invites.revokedAt),
              isNull(invites.acceptedAt),
              gt(invites.expiresAt, now),
            ),
          )
          .then((rows) => Number(rows[0]?.count ?? 0));
        bootstrapInviteActive = inviteCount > 0;
      }
    }

    const persistedDevServerStatus = readPersistedDevServerStatus();
    let devServer: ReturnType<typeof toDevServerHealthStatus> | undefined;
    if (persistedDevServerStatus && typeof (db as { select?: unknown }).select === "function") {
      const instanceSettings = instanceSettingsService(db);
      const experimentalSettings = await instanceSettings.getExperimental();
      const activeRunCount = await db
        .select({ count: count() })
        .from(heartbeatRuns)
        .where(inArray(heartbeatRuns.status, ["queued", "running"]))
        .then((rows) => Number(rows[0]?.count ?? 0));

      devServer = toDevServerHealthStatus(persistedDevServerStatus, {
        autoRestartEnabled: experimentalSettings.autoRestartDevServerWhenIdle ?? false,
        activeRunCount,
      });
    }

    if (!exposeFullDetails) {
      res.json({
        status: "ok",
        deploymentMode: opts.deploymentMode,
        bootstrapStatus,
        bootstrapInviteActive,
      });
      return;
    }

    res.json({
      status: "ok",
      version: serverVersion,
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      authReady: opts.authReady,
      bootstrapStatus,
      bootstrapInviteActive,
      features: {
        companyDeletionEnabled: opts.companyDeletionEnabled,
      },
      ...(devServer ? { devServer } : {}),
    });
  });

  // T6: Infrastructure health — redis + postgres status
  router.get("/infra", async (_req, res) => {
    const [redis, postgres] = await Promise.all([
      checkRedisHealth(),
      db
        ? db.execute(sql`SELECT 1`).then(() => "ok" as const).catch(() => "degraded" as const)
        : Promise.resolve("degraded" as const),
    ]);
    const healthy = redis === "ok" && postgres === "ok";
    res.status(healthy ? 200 : 503).json({ redis, postgres });
  });

  return router;
}
