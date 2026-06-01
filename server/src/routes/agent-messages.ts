/**
 * server/src/routes/agent-messages.ts
 *
 * AG-2 — Agent peer message routes.
 *
 * GET  /companies/:companyId/missions/:missionId/agent-messages
 *      List all messages for a mission (operator drill-down)
 *
 * POST /companies/:companyId/missions/:missionId/agent-messages
 *      Send a message from one agent to another (or broadcast)
 *
 * POST /companies/:companyId/missions/:missionId/agent-messages/:messageId/reply
 *      Record a reply (called by the receiving agent at execution time)
 *
 * GET  /companies/:companyId/missions/:missionId/agents/:agentId/pending-messages
 *      Pending messages to inject into an agent's context (called by worker)
 */

import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";
import {
  sendAgentMessage,
  getMissionMessages,
  getPendingMessagesForAgent,
  replyToAgentMessage,
} from "../missions/agent-messages.js";
import { notFound } from "../errors.js";
import pino from "pino";

const logger = pino({ name: "agent-messages" });

const sendMessageSchema = z.object({
  fromAgentId: z.string().uuid(),
  toAgentId:   z.string().uuid().nullable().default(null),
  content:     z.string().min(1).max(2000),
  messageType: z.enum(["question", "finding", "confirmation", "alert"]),
});

const replySchema = z.object({
  replyContent: z.string().min(1).max(2000),
});

export function agentMessageRoutes(db: Db): Router {
  const router = Router();

  // GET /companies/:companyId/missions/:missionId/agent-messages
  router.get(
    "/companies/:companyId/missions/:missionId/agent-messages",
    async (req, res, next) => {
      try {
        const { companyId, missionId } = req.params as {
          companyId: string;
          missionId: string;
        };
        assertCompanyAccess(req, companyId);

        const messages = await getMissionMessages(db, missionId, companyId);
        res.json({ ok: true, data: messages });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /companies/:companyId/missions/:missionId/agent-messages
  router.post(
    "/companies/:companyId/missions/:missionId/agent-messages",
    async (req, res, next) => {
      try {
        const { companyId, missionId } = req.params as {
          companyId: string;
          missionId: string;
        };
        assertCompanyAccess(req, companyId);

        const body = sendMessageSchema.parse(req.body);
        const id = await sendAgentMessage(db, {
          missionId,
          companyId,
          fromAgentId: body.fromAgentId,
          toAgentId:   body.toAgentId,
          content:     body.content,
          messageType: body.messageType,
        });

        logger.info({ companyId, missionId, id, messageType: body.messageType }, "agent message sent");
        res.status(201).json({ ok: true, data: { id } });
      } catch (err) {
        next(err);
      }
    },
  );

  // POST /companies/:companyId/missions/:missionId/agent-messages/:messageId/reply
  router.post(
    "/companies/:companyId/missions/:missionId/agent-messages/:messageId/reply",
    async (req, res, next) => {
      try {
        const { companyId, missionId, messageId } = req.params as {
          companyId: string;
          missionId: string;
          messageId: string;
        };
        assertCompanyAccess(req, companyId);
        void missionId;

        const { replyContent } = replySchema.parse(req.body);
        await replyToAgentMessage(db, { messageId, companyId, replyContent });

        res.json({ ok: true, data: null });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /companies/:companyId/missions/:missionId/agents/:agentId/pending-messages
  router.get(
    "/companies/:companyId/missions/:missionId/agents/:agentId/pending-messages",
    async (req, res, next) => {
      try {
        const { companyId, missionId, agentId } = req.params as {
          companyId: string;
          missionId: string;
          agentId:   string;
        };
        assertCompanyAccess(req, companyId);

        const messages = await getPendingMessagesForAgent(db, missionId, agentId, companyId);
        res.json({ ok: true, data: messages });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
