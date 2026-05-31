/**
 * server/src/packs/team-roster.ts
 *
 * WAR-5: Team roster generation.
 *
 * Generates the team-roster.md markdown injected into the orchestrator's
 * context at every session start via the {team_roster} token.
 *
 * Format per spec:
 *   # Your team — {company_name}
 *   ## {display_name} ({status})
 *   Role: {skill.role_description}
 *   Trust level: {autonomy_level} ({trust_score}/5 over {task_count} tasks)
 *   Schedule: {schedule}
 */

import { and, eq } from "drizzle-orm";
import { agents, companies, trustScores } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";

const AUTONOMY_LABELS: Record<string, string> = {
  building:      "en apprentissage",
  supervised:    "supervisé",
  trusted:       "de confiance",
  highlyTrusted: "autonome",
};

export async function buildTeamRosterMd(db: Db, companyId: string): Promise<string> {
  const [company] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const activeAgents = await db
    .select({
      id:          agents.id,
      displayName: agents.displayName,
      status:      agents.status,
      capabilities: agents.capabilities,
    })
    .from(agents)
    .where(
      and(
        eq(agents.companyId, companyId),
        eq(agents.teamRosterVisible, true),
      ),
    );

  const agentScores = await db
    .select({
      agentId:       trustScores.agentId,
      score:         trustScores.score,
      autonomyLevel: trustScores.autonomyLevel,
      taskCount:     trustScores.taskCountWindow,
    })
    .from(trustScores)
    .where(eq(trustScores.companyId, companyId));

  const scoreByAgent = new Map(agentScores.map((s) => [s.agentId, s]));

  const lines = [`# Votre équipe — ${company?.name ?? "Votre entreprise"}`, ""];

  for (const agent of activeAgents) {
    const trust = scoreByAgent.get(agent.id);
    const statusLabel = agent.status === "active" ? "actif"
      : agent.status === "paused" ? "en pause"
      : "désactivé";

    lines.push(`## ${agent.displayName} (${statusLabel})`);

    if (agent.capabilities) {
      lines.push(`Rôle : ${agent.capabilities}`);
    }

    if (trust) {
      const autonomyLabel = AUTONOMY_LABELS[trust.autonomyLevel] ?? trust.autonomyLevel;
      const score = parseFloat(trust.score as string).toFixed(1);
      lines.push(`Niveau de confiance : ${autonomyLabel} (${score}/5 sur ${trust.taskCount} tâches)`);
    } else {
      lines.push(`Niveau de confiance : en apprentissage (nouveau)`);
    }

    lines.push("");
  }

  return lines.join("\n");
}
