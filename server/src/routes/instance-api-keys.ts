/**
 * server/src/routes/instance-api-keys.ts
 *
 * Instance-level API key management (instance admin only).
 *
 * GET    /instance/api-keys              → list providers + configured status
 * POST   /instance/api-keys              → upsert a key
 * DELETE /instance/api-keys/:provider    → remove a key
 * POST   /instance/api-keys/:provider/test → test connectivity
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { forbidden, notFound } from "../errors.js";
import { instanceApiKeysService, API_KEY_PROVIDERS } from "../services/instance-api-keys.js";

function assertInstanceAdmin(req: Parameters<typeof forbidden>[0] extends Parameters<typeof forbidden>[0] ? any : never) {
  if (req.actor.type !== "board") throw forbidden("Board access required");
  if (!req.actor.isInstanceAdmin && req.actor.source !== "local_implicit") {
    throw forbidden("Instance admin access required");
  }
}

const UpsertSchema = z.object({
  provider: z.string().min(1),
  value:    z.string().min(1),
});

export function instanceApiKeysRoutes(db: Db) {
  const router = Router();
  const svc = instanceApiKeysService(db);

  // GET /instance/api-keys
  router.get("/instance/api-keys", async (req, res) => {
    assertInstanceAdmin(req);
    const list = await svc.list();
    res.json(list);
  });

  // POST /instance/api-keys
  router.post("/instance/api-keys", async (req, res) => {
    assertInstanceAdmin(req);
    const parsed = UpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }
    const known = API_KEY_PROVIDERS.find((p) => p.id === parsed.data.provider);
    if (!known) {
      res.status(400).json({ error: `Unknown provider: ${parsed.data.provider}` });
      return;
    }
    await svc.upsert(parsed.data.provider, parsed.data.value);
    res.status(204).send();
  });

  // DELETE /instance/api-keys/:provider
  router.delete("/instance/api-keys/:provider", async (req, res) => {
    assertInstanceAdmin(req);
    const { provider } = req.params as { provider: string };
    const known = API_KEY_PROVIDERS.find((p) => p.id === provider);
    if (!known) {
      res.status(404).json({ error: "Unknown provider" });
      return;
    }
    await svc.remove(provider);
    res.status(204).send();
  });

  // POST /instance/api-keys/:provider/test
  router.post("/instance/api-keys/:provider/test", async (req, res) => {
    assertInstanceAdmin(req);
    const { provider } = req.params as { provider: string };
    const value = await svc.resolve(provider as any);
    if (!value) {
      res.status(404).json({ ok: false, error: "Not configured" });
      return;
    }

    try {
      if (provider === "openrouter") {
        const r = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${value}` },
        });
        res.json({ ok: r.ok, status: r.status });
      } else if (provider === "mistral") {
        const r = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${value}` },
        });
        res.json({ ok: r.ok, status: r.status });
      } else if (provider === "firecrawl") {
        const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${value}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://example.com" }),
        });
        res.json({ ok: r.ok, status: r.status });
      } else if (provider === "stripe_secret") {
        const r = await fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Bearer ${value}` },
        });
        res.json({ ok: r.ok, status: r.status });
      } else {
        res.json({ ok: true, status: 200, note: "No test available for this provider" });
      }
    } catch (err: unknown) {
      res.status(502).json({ ok: false, error: (err as Error).message });
    }
  });

  return router;
}
