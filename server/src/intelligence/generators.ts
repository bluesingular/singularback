/**
 * server/src/intelligence/generators.ts
 *
 * Real card generators for the morning intelligence sweep (M13).
 *
 * Five generators — all injected into generateIntelligenceCards():
 *   trustProposalGenerator  — agent ready for autonomy upgrade
 *   trustAnomalyGenerator   — trust score dropped significantly
 *   goalRiskGenerator       — goal is stalled (no progress in 7 days)
 *   relationshipGapGenerator — important contact not heard from in 14+ days
 *   budgetAlertGenerator    — open budget incident (warn or hard-stop)
 *
 * Each generator is pure: reads DB, returns CandidateCard[]. No side-effects.
 */

import { and, eq, lt, desc, isNull } from "drizzle-orm";
import {
  trustScores,
  trustProposals,
  goals,
  contacts,
  contactEvents,
  budgetIncidents,
  agents,
} from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import type { CandidateCard, CardGenerator } from "./sweep.js";

// ── Autonomy level ordering ───────────────────────────────────────────────────

const AUTONOMY_ORDER = ["building", "supervised", "trusted", "highlyTrusted"];

function nextAutonomyLevel(current: string): string {
  const idx = AUTONOMY_ORDER.indexOf(current);
  return idx >= 0 && idx < AUTONOMY_ORDER.length - 1
    ? AUTONOMY_ORDER[idx + 1]!
    : current;
}

// ── trustProposalGenerator ────────────────────────────────────────────────────
// Surfaces agents that have earned an autonomy upgrade (streak ≥ 10, score ≥ 4.0)
// but have no pending proposal yet.

export const trustProposalGenerator: CardGenerator = async (db: Db, companyId: string): Promise<CandidateCard[]> => {
  const scores = await db
    .select({
      agentId:        trustScores.agentId,
      skillType:      trustScores.skillType,
      score:          trustScores.score,
      autonomyLevel:  trustScores.autonomyLevel,
      approvalStreak: trustScores.approvalStreak,
    })
    .from(trustScores)
    .where(
      and(
        eq(trustScores.companyId, companyId),
        lt(trustScores.score, "4.8"), // never auto-propose autonomous tier
      ),
    );

  const cards: CandidateCard[] = [];

  for (const row of scores) {
    const score = parseFloat(row.score as string);
    const streak = row.approvalStreak;

    if (score < 4.0 || streak < 10) continue;
    if (row.autonomyLevel === "highlyTrusted") continue;

    // Check no pending proposal exists
    const [existing] = await db
      .select({ id: trustProposals.id })
      .from(trustProposals)
      .where(
        and(
          eq(trustProposals.companyId, companyId),
          eq(trustProposals.agentId, row.agentId),
          eq(trustProposals.skillType, row.skillType),
          eq(trustProposals.status, "pending"),
        ),
      )
      .limit(1);

    if (existing) continue;

    const [agent] = await db
      .select({ displayName: agents.displayName })
      .from(agents)
      .where(eq(agents.id, row.agentId))
      .limit(1);

    const name = agent?.displayName ?? "L'agent";
    const next = nextAutonomyLevel(row.autonomyLevel);

    cards.push({
      cardType:   "trust",
      urgency:    3,
      insightKey: `trust:proposal:${row.agentId}:${row.skillType}`,
      title:      `${name} est prêt(e) pour plus d'autonomie`,
      body:       `${name} a complété ${streak} tâches consécutives avec une note de ${score.toFixed(1)}/5. Passage au niveau "${next}" disponible.`,
      actionUrl:  `/agents/${row.agentId}/trust`,
    });
  }

  return cards;
};

// ── trustAnomalyGenerator ─────────────────────────────────────────────────────
// Surfaces agents whose score has dropped below 3.0 (supervised floor).

export const trustAnomalyGenerator: CardGenerator = async (db: Db, companyId: string): Promise<CandidateCard[]> => {
  const scores = await db
    .select({
      agentId:       trustScores.agentId,
      skillType:     trustScores.skillType,
      score:         trustScores.score,
      autonomyLevel: trustScores.autonomyLevel,
    })
    .from(trustScores)
    .where(
      and(
        eq(trustScores.companyId, companyId),
        lt(trustScores.score, "3.0"),
      ),
    );

  const cards: CandidateCard[] = [];

  for (const row of scores) {
    const score = parseFloat(row.score as string);

    const [agent] = await db
      .select({ displayName: agents.displayName })
      .from(agents)
      .where(eq(agents.id, row.agentId))
      .limit(1);

    const name = agent?.displayName ?? "Un agent";

    cards.push({
      cardType:   "anomaly",
      urgency:    score < 2.0 ? 5 : 4,
      insightKey: `anomaly:trust:${row.agentId}:${row.skillType}`,
      title:      `Niveau de confiance bas — ${name}`,
      body:       `Le score de ${name} sur "${row.skillType}" est tombé à ${score.toFixed(1)}/5. Une vérification des tâches récentes est recommandée.`,
      actionUrl:  `/agents/${row.agentId}/trust`,
    });
  }

  return cards;
};

// ── goalRiskGenerator ─────────────────────────────────────────────────────────
// Surfaces active goals with no update in the last 7 days.

export const goalRiskGenerator: CardGenerator = async (db: Db, companyId: string): Promise<CandidateCard[]> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const stalledGoals = await db
    .select({
      id:    goals.id,
      title: goals.title,
      updatedAt: goals.updatedAt,
    })
    .from(goals)
    .where(
      and(
        eq(goals.companyId, companyId),
        eq(goals.status, "active"),
        lt(goals.updatedAt, sevenDaysAgo),
      ),
    )
    .orderBy(goals.updatedAt)
    .limit(3);

  return stalledGoals.map((goal) => ({
    cardType:   "goal" as const,
    urgency:    3 as const,
    insightKey: `goal:stalled:${goal.id}`,
    title:      `Objectif sans mise à jour — ${goal.title}`,
    body:       `Cet objectif n'a pas évolué depuis plus de 7 jours. Vérifiez si un agent peut progresser dessus.`,
    actionUrl:  `/goals/${goal.id}`,
  }));
};

// ── relationshipGapGenerator ──────────────────────────────────────────────────
// Surfaces contacts with no event in 14+ days (high-value contacts at risk).

export const relationshipGapGenerator: CardGenerator = async (db: Db, companyId: string): Promise<CandidateCard[]> => {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Contacts that have events but none recently
  const allContacts = await db
    .select({ id: contacts.id, fullName: contacts.fullName })
    .from(contacts)
    .where(eq(contacts.companyId, companyId))
    .limit(50);

  const cards: CandidateCard[] = [];

  for (const contact of allContacts) {
    const [lastEvent] = await db
      .select({ occurredAt: contactEvents.occurredAt })
      .from(contactEvents)
      .where(
        and(
          eq(contactEvents.contactId, contact.id),
          eq(contactEvents.companyId, companyId),
        ),
      )
      .orderBy(desc(contactEvents.occurredAt))
      .limit(1);

    // Skip contacts with no history at all — no relationship to gap
    if (!lastEvent) continue;

    if (lastEvent.occurredAt < fourteenDaysAgo) {
      const daysSince = Math.floor(
        (Date.now() - lastEvent.occurredAt.getTime()) / 86_400_000,
      );

      cards.push({
        cardType:   "relationship",
        urgency:    daysSince > 30 ? 4 : 2,
        insightKey: `relationship:gap:${contact.id}`,
        title:      `Aucun contact récent — ${contact.fullName}`,
        body:       `Aucune interaction depuis ${daysSince} jours. Une prise de contact pourrait maintenir la relation.`,
        actionUrl:  `/contacts/${contact.id}`,
      });

      if (cards.length >= 3) break; // cap per sweep — top 3 is enforced upstream too
    }
  }

  return cards;
};

// ── budgetAlertGenerator ──────────────────────────────────────────────────────
// Surfaces open budget incidents (warn threshold or hard-stop triggered).

export const budgetAlertGenerator: CardGenerator = async (db: Db, companyId: string): Promise<CandidateCard[]> => {
  const incidents = await db
    .select({
      id:              budgetIncidents.id,
      thresholdType:   budgetIncidents.thresholdType,
      amountLimit:     budgetIncidents.amountLimit,
      amountObserved:  budgetIncidents.amountObserved,
      metric:          budgetIncidents.metric,
    })
    .from(budgetIncidents)
    .where(
      and(
        eq(budgetIncidents.companyId, companyId),
        eq(budgetIncidents.status, "open"),
      ),
    )
    .orderBy(desc(budgetIncidents.createdAt))
    .limit(3);

  return incidents.map((inc) => {
    const pct = Math.round((inc.amountObserved / inc.amountLimit) * 100);
    const isHardStop = inc.thresholdType === "hard_stop";

    return {
      cardType:   "anomaly" as const,
      urgency:    (isHardStop ? 5 : 3) as 5 | 3,
      insightKey: `budget:incident:${inc.id}`,
      title:      isHardStop
        ? "Limite budgétaire atteinte — agents en pause"
        : `Budget à ${pct}% — surveillance recommandée`,
      body: isHardStop
        ? `La limite mensuelle a été atteinte. Les agents sont en pause jusqu'à la remise à zéro ou une intervention manuelle.`
        : `La consommation mensuelle a atteint ${pct}% de la limite définie. Au rythme actuel, la limite sera atteinte avant la fin du mois.`,
      actionUrl: `/settings/billing`,
    };
  });
};
