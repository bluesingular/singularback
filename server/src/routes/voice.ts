/**
 * server/src/routes/voice.ts
 *
 * §16 — Voice-to-Agent.
 *
 * POST /companies/:companyId/voice
 *   Accepts an audio file (multipart/form-data, field: "audio").
 *   Transcribes via Whisper, parses intent, creates a mission or task.
 *
 * Response:
 *   { ok: true, data: { type: "mission"|"task", id, title, confidence } }
 *
 * GDPR: audio may contain personal data → gdpr_required: true throughout.
 * Raw audio is NOT persisted — only the encrypted transcript.
 */

import { Router } from "express";
import multer from "multer";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { agents, missions, issues } from "@paperclipai/db";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { badRequest } from "../errors.js";
import { transcribeVoice, UnsupportedTypeError } from "../tools/extractInput.js";
import { parseVoiceIntent } from "../voice/intent.js";
import pino from "pino";

const logger = pino({ name: "voice-routes" });

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB (Whisper limit)

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_AUDIO_BYTES },
});

export function voiceRoutes(db: Db): Router {
  const router = Router();

  /**
   * POST /companies/:companyId/voice
   *
   * Accepts multipart form with:
   *   - audio: the audio file (required)
   *   - orchestratorId: UUID of orchestrator agent (optional, used for missions)
   */
  router.post(
    "/companies/:companyId/voice",
    upload.single("audio"),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);

        if (!req.file) {
          res.status(400).json({ ok: false, error: { code: "SWWARM_MISSING_AUDIO", message: "Fichier audio manquant." } });
          return;
        }

        const mimeType = req.file.mimetype;

        // 1. Transcribe — always GDPR-flagged (voice = personal data)
        let transcript: string;
        try {
          const extraction = await transcribeVoice(req.file.buffer, mimeType, { gdprRequired: true });
          transcript = extraction.text ?? "";
        } catch (err) {
          if (err instanceof UnsupportedTypeError) {
            res.status(400).json({ ok: false, error: { code: "SWWARM_UNSUPPORTED_AUDIO", message: "Format audio non supporté." } });
            return;
          }
          throw err;
        }

        if (!transcript.trim()) {
          res.status(422).json({ ok: false, error: { code: "SWWARM_EMPTY_TRANSCRIPT", message: "Aucune parole détectée dans l'audio." } });
          return;
        }

        // 2. Fetch agent display names for intent matching
        const agentRows = await db
          .select({ id: agents.id, displayName: agents.displayName })
          .from(agents)
          .where(and(eq(agents.companyId, companyId), eq(agents.status, "active")));

        const agentNames = agentRows.map((a) => a.displayName);

        // 3. Parse intent
        const intent = await parseVoiceIntent({
          db,
          companyId,
          transcript,
          agentNames,
        });

        // Resolve targetAgent name → ID
        let resolvedAgentId: string | null = null;
        if (intent.targetAgentId) {
          const matched = agentRows.find(
            (a) => a.displayName.toLowerCase().includes(intent.targetAgentId!.toLowerCase()),
          );
          resolvedAgentId = matched?.id ?? null;
        }

        // 4. Create mission or task based on intent
        if (intent.type === "clarification") {
          // Return transcript for operator to clarify — don't create anything
          res.status(200).json({
            ok: true,
            data: {
              type:       "clarification",
              id:         null,
              title:      intent.title,
              transcript,
              confidence: intent.confidence,
            },
          });
          return;
        }

        const actor = getActorInfo(req);
        const orchestratorId = req.body?.orchestratorId ?? resolvedAgentId ?? null;

        if (intent.type === "mission") {
          const [mission] = await db.insert(missions).values({
            companyId,
            title:          intent.title,
            brief:          intent.brief,
            orchestratorId: orchestratorId ?? null,
            status:         "active",
          }).returning({ id: missions.id, title: missions.title });

          logger.info({ companyId, missionId: mission.id, confidence: intent.confidence }, "voice: mission created");

          res.status(201).json({
            ok: true,
            data: {
              type:       "mission",
              id:         mission.id,
              title:      mission.title,
              transcript,
              confidence: intent.confidence,
            },
          });
        } else {
          // task
          const [task] = await db.insert(issues).values({
            companyId,
            title:            intent.title,
            description:      intent.brief,
            status:           "todo",
            priority:         "medium",
            assigneeAgentId:  resolvedAgentId ?? null,
            createdByUserId:  actor.actorType === "user" ? actor.actorId : null,
          }).returning({ id: issues.id, title: issues.title });

          logger.info({ companyId, taskId: task.id, confidence: intent.confidence }, "voice: task created");

          res.status(201).json({
            ok: true,
            data: {
              type:       "task",
              id:         task.id,
              title:      task.title,
              transcript,
              confidence: intent.confidence,
            },
          });
        }
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
