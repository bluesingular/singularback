/**
 * server/src/trust/bootstrap.ts
 *
 * Gap C — Trust bootstrapping protocol.
 *
 * Set sensible starting trust when a pack is installed — prevents the
 * 30-task approval marathon for new companies.
 *
 * Hard constraints (ALL MANDATORY — CLAUDE.md):
 *   ❌ initial_score NEVER ≥ 4.8 — minimum 10 tasks required for autonomous tier
 *   ❌ initial_score NEVER < 2.5 — operators deserve a usable product from day 1
 *   ❌ External send actions ALWAYS start in full approval regardless of score
 *   ✓  Cap at 3.9 ('supervised') for any new company — first 10 tasks monitored
 *
 * Components:
 *   pack_track_record:  0-2.0 — avg trust across all pack installs globally (stub: 1.5)
 *   task_type_risk:     0-1.5 — drafting/analysis = 1.5, external_send = 0.3
 *   industry_profile:   0-0.5 — professional_services = 0.3, financial = 0.1, other = 0.5
 *   operator_history:   0-1.0 — returning operator avg approval rate (0 for new)
 */

import { eq } from "drizzle-orm";
import { trustScores, agents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "trust-bootstrap" });

// Hard bounds
const MIN_SCORE = 2.5;
const MAX_SCORE = 3.9;   // cap at 'supervised' for new companies

export interface BootstrappedTrust {
  initialScore: number;
  components: {
    packTrackRecord: number;
    taskTypeRisk:    number;
    industryProfile: number;
    operatorHistory: number;
  };
}

export interface BootstrapParams {
  companyId:     string;
  industrySlug?: string;    // e.g. "professional_services" | "financial" | "retail"
  skillType?:    string;    // to determine task_type_risk
}

function packTrackRecord(): number {
  // Stub: in production, query avg trust score across all companies using this pack
  return 1.5;
}

function taskTypeRisk(skillType?: string): number {
  if (!skillType) return 1.0;
  if (skillType.includes("send") || skillType.includes("email") || skillType.includes("communication")) {
    return 0.3; // external communications = low starting trust
  }
  if (skillType.includes("draft") || skillType.includes("analysis") || skillType.includes("qualification")) {
    return 1.5; // drafting/analysis = safe to auto-progress
  }
  return 1.0;
}

function industryProfile(industrySlug?: string): number {
  if (!industrySlug) return 0.5;
  if (industrySlug.includes("financial") || industrySlug.includes("legal")) return 0.1;
  if (industrySlug.includes("professional") || industrySlug.includes("consulting")) return 0.3;
  return 0.5;
}

/**
 * Calculate the bootstrapped trust score for a new agent+skill pair.
 * Called at pack install for each agent×skill combination.
 */
export function calculateBootstrappedScore(params: BootstrapParams): BootstrappedTrust {
  const ptr = packTrackRecord();
  const ttr = taskTypeRisk(params.skillType);
  const ip  = industryProfile(params.industrySlug);
  const oh  = 0; // no history for new companies

  const raw = ptr + ttr + ip + oh;

  // Clamp to [MIN_SCORE, MAX_SCORE]
  const initialScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, raw));

  return {
    initialScore,
    components: {
      packTrackRecord: ptr,
      taskTypeRisk:    ttr,
      industryProfile: ip,
      operatorHistory: oh,
    },
  };
}

/**
 * Write bootstrapped trust scores for all agents in a newly installed pack.
 * Called by the pack installer after agents are created.
 */
export async function bootstrapAgentTrust(
  db:        Db,
  companyId: string,
  agentIds:  string[],
  params:    Omit<BootstrapParams, "companyId">,
): Promise<void> {
  for (const agentId of agentIds) {
    // Get the agent's skill types to bootstrap per-skill trust
    const [agent] = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    const skillTypes: string[] = (agent?.metadata as any)?.skillsAssigned ?? ["general"];

    for (const skillType of skillTypes) {
      const { initialScore } = calculateBootstrappedScore({
        companyId,
        skillType,
        ...params,
      });

      await (db as any)
        .insert(trustScores)
        .values({
          companyId,
          agentId,
          skillType,
          score:          String(initialScore),
          autonomyLevel:  initialScore >= 3.0 ? "supervised" : "building",
          approvalStreak: 0,
          taskCountWindow: 0,
        })
        .onConflictDoNothing();

      logger.info(
        { companyId, agentId, skillType, initialScore },
        "trust-bootstrap: score set",
      );
    }
  }
}
