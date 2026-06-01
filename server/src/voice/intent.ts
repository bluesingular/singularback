/**
 * server/src/voice/intent.ts
 *
 * §16 — Voice-to-Agent: intent parsing.
 *
 * Takes a voice transcript (from Whisper) and uses a T2 model with structured
 * output to determine:
 *   1. Whether to create a mission (strategic) or a task (specific)
 *   2. Which agent to target (or the orchestrator for routing)
 *   3. The brief / instruction text
 *
 * GDPR: voice transcripts may contain personal data → gdpr_required: true.
 * Always routes through T2_QUALITY_GDPR (Mistral EU).
 *
 * Returns a VoiceIntent that the caller uses to create the appropriate record.
 */

import { callLLM } from "../llm/openrouter.js";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "voice-intent" });

export type VoiceIntentType = "mission" | "task" | "clarification";

export interface VoiceIntent {
  type:           VoiceIntentType;
  targetAgentId:  string | null;   // null = route to orchestrator
  brief:          string;          // the brief / instruction, cleaned from transcript
  title:          string;          // short title (≤ 80 chars)
  confidence:     "high" | "medium" | "low";
  rawTranscript:  string;
}

const INTENT_SYSTEM_PROMPT = `Tu es un analyseur d'intention pour une plateforme d'agents IA.
Tu reçois la transcription d'une note vocale du PDG et tu dois déterminer:
1. S'il s'agit d'une MISSION (objectif stratégique, multi-étapes) ou d'une TÂCHE (action spécifique, mono-agent)
2. L'agent cible si mentionné explicitement (prénom ou nom de rôle)
3. Le brief reformulé proprement en français, sans les hésitations ni les faux départs

Réponds UNIQUEMENT avec ce JSON (aucun autre texte):
{
  "type": "mission" | "task" | "clarification",
  "targetAgent": "<prénom de l'agent ou null>",
  "title": "<titre court ≤ 80 caractères>",
  "brief": "<brief reformulé, phrases complètes>",
  "confidence": "high" | "medium" | "low"
}

Règles:
- "mission" si plusieurs étapes ou plusieurs agents impliqués
- "task" si action précise pour un agent
- "clarification" si la transcription est trop ambiguë pour agir
- confidence "low" si la transcription contient moins de 10 mots ou est très ambiguë`;

export async function parseVoiceIntent(opts: {
  db:          Db;
  companyId:   string;
  transcript:  string;
  agentNames:  string[];   // known agent display names for matching
}): Promise<VoiceIntent> {
  // T2 GDPR: Mistral Medium EU — voice transcripts contain personal data
  const modelName = "mistralai/mistral-medium-3.1";

  const userPrompt = `Transcription vocale:\n"${opts.transcript}"\n\nAgents disponibles: ${opts.agentNames.join(", ") || "aucun listé"}`;

  let raw: string;
  try {
    const res = await callLLM({
      db:           opts.db,
      companyId:    opts.companyId,
      agentId:      "system",
      taskId:       "voice-intent",
      model:        modelName,
      gdprRequired: true,
      skillName:    "voice_intent",
      messages: [
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      maxOutputTokens: 400,
    });
    raw = res.choices[0]?.message?.content ?? "";
  } catch (err) {
    logger.error({ err, companyId: opts.companyId }, "voice-intent: LLM call failed");
    // Fall back to a clarification intent — never drop the transcript
    return {
      type:           "clarification",
      targetAgentId:  null,
      brief:          opts.transcript,
      title:          "Note vocale (analyse échouée)",
      confidence:     "low",
      rawTranscript:  opts.transcript,
    };
  }

  // Strip any markdown fences the model may have added
  const cleaned = raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    logger.warn({ raw, companyId: opts.companyId }, "voice-intent: JSON parse failed");
    return {
      type:           "clarification",
      targetAgentId:  null,
      brief:          opts.transcript,
      title:          "Note vocale (format inattendu)",
      confidence:     "low",
      rawTranscript:  opts.transcript,
    };
  }

  // Match targetAgent name to a known agent ID (case-insensitive first-name match)
  let targetAgentId: string | null = null;
  if (typeof parsed.targetAgent === "string" && parsed.targetAgent) {
    const name = parsed.targetAgent.toLowerCase();
    // Caller will do the DB lookup; we return the name for matching
    targetAgentId = name;   // route will resolve to agent ID
  }

  const type = (["mission", "task", "clarification"].includes(String(parsed.type))
    ? parsed.type
    : "clarification") as VoiceIntentType;

  return {
    type,
    targetAgentId,
    brief:        String(parsed.brief ?? opts.transcript),
    title:        String(parsed.title ?? "Note vocale").slice(0, 80),
    confidence:   (["high", "medium", "low"].includes(String(parsed.confidence))
                    ? parsed.confidence
                    : "low") as "high" | "medium" | "low",
    rawTranscript: opts.transcript,
  };
}
