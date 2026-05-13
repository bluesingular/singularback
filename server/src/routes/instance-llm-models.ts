/**
 * GET /instance/llm-models — expose the model registry + GDPR metadata to the admin UI.
 * Instance-admin readable; no writes (routing logic lives in llm/router.ts).
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { forbidden } from "../errors.js";

export const MODEL_REGISTRY = [
  {
    tier: "T0",
    label: "Micro (T0)",
    model: "mistralai/ministral-3b",
    fallback: "google/gemma-3-1b",
    gdprSafe: true,
    euHosted: true,
    maxInputTokens: 8_000,
    maxOutputTokens: 1_000,
    costPerMTokenEur: 0.04,
    useCase: "Tâches simples, classification, résumés courts",
  },
  {
    tier: "T1_FR_GDPR",
    label: "Standard FR/GDPR (T1)",
    model: "mistralai/mistral-small-3.2",
    fallback: "mistralai/mistral-small-3.2",
    gdprSafe: true,
    euHosted: true,
    maxInputTokens: 32_000,
    maxOutputTokens: 4_000,
    costPerMTokenEur: 0.10,
    useCase: "Données personnelles, tâches françaises, compliance EU",
  },
  {
    tier: "T1_EN",
    label: "Standard EN (T1)",
    model: "deepseek/deepseek-chat-v3-5",
    fallback: "mistralai/mistral-small-3.2",
    gdprSafe: false,
    euHosted: false,
    maxInputTokens: 64_000,
    maxOutputTokens: 8_000,
    costPerMTokenEur: 0.06,
    useCase: "Tâches sans données personnelles, contexte anglophone",
    warning: "Interdit pour les compétences gdpr_required:true",
  },
  {
    tier: "T2_SPEED",
    label: "Avancé — Vitesse (T2)",
    model: "google/gemini-flash-1.5",
    fallback: "mistralai/mistral-medium-3.1",
    gdprSafe: false,
    euHosted: false,
    maxInputTokens: 128_000,
    maxOutputTokens: 8_000,
    costPerMTokenEur: 0.08,
    useCase: "Tâches longues nécessitant de la vitesse",
  },
  {
    tier: "T2_QUALITY_GDPR",
    label: "Avancé — Qualité/GDPR (T2)",
    model: "mistralai/mistral-medium-3.1",
    fallback: null,
    gdprSafe: true,
    euHosted: true,
    maxInputTokens: 128_000,
    maxOutputTokens: 8_000,
    costPerMTokenEur: 0.28,
    useCase: "Tâches de qualité avec données personnelles",
  },
  {
    tier: "T3",
    label: "Frontier (T3)",
    model: "anthropic/claude-sonnet-4-5",
    fallback: null,
    gdprSafe: true,
    euHosted: false,
    maxInputTokens: 200_000,
    maxOutputTokens: 16_000,
    costPerMTokenEur: 3.00,
    useCase: "Raisonnement complexe, analyses stratégiques",
    note: "GDPR via DPA Anthropic (contractuel)",
  },
] as const;

export function instanceLlmModelsRoutes(_db: Db) {
  const router = Router();

  router.get("/instance/llm-models", (req, res) => {
    if (req.actor.type !== "board") throw forbidden("Board access required");
    res.json(MODEL_REGISTRY);
  });

  return router;
}
