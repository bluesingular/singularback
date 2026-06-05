/**
 * Pack installation service — loads pack manifest and calls installer.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Db } from "@paperclipai/db";
import { installPack } from "../packs/installer.js";
import type { PackManifest } from "../packs/types.js";

const PACKS_DIR = new URL("../../../packs", import.meta.url).pathname;

export function packInstallService(db: Db) {
  /**
   * Load a pack manifest from disk
   */
  async function loadPackManifest(packSlug: string): Promise<PackManifest> {
    const packDir = join(PACKS_DIR, packSlug);
    const packPath = join(packDir, "pack.json");
    const packData = JSON.parse(await readFile(packPath, "utf-8"));

    // Ensure agents have required fields with defaults
    packData.agents = (packData.agents || []).map((agent: any) => ({
      slug: agent.slug,
      name: agent.name,
      description: agent.description || "",
      modelTier: agent.modelTier || "T1_FR",
      skills: agent.skills || [],
    }));

    // Load skills from skill directories
    const skillSlugs = [
      "qualification-cv",
      "candidate-sourcing",
      "candidate-follow-up",
      "candidate-re-engagement",
      "client-email",
      "weekly-client-report",
      "job-posting-writer",
      "market-intelligence",
    ];

    packData.skills = [];
    for (const slug of skillSlugs) {
      try {
        const fullContent = await readFile(join(packDir, "skills", slug, "SKILL.md"), "utf-8");
        // Strip YAML frontmatter (content between --- and ---)
        const parts = fullContent.split("---");
        const skillMarkdown = parts.length >= 3 ? parts.slice(2).join("---").trim() : fullContent;

        packData.skills.push({
          slug,
          name: slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          markdown: skillMarkdown,
          tier: 1,
          gdprRequired: false,
        });
      } catch {
        // Skill file not found, use minimal definition
        packData.skills.push({
          slug,
          name: slug,
          markdown: `# ${slug}\n\nSkill description for ${slug}.`,
          tier: 1,
          gdprRequired: false,
        });
      }
    }

    // Load and transform quality gates
    try {
      const qualityGatesData = JSON.parse(await readFile(join(packDir, "quality-gates.json"), "utf-8"));
      packData.qualityGates = (qualityGatesData.gates || []).map((gate: any) => {
        let gateType = "custom";
        if (gate.id?.includes("batch") || gate.id?.includes("volume")) gateType = "volume_limit";
        else if (gate.id?.includes("whitelist") || gate.id?.includes("contact")) gateType = "recipient_whitelist";
        else if (gate.id?.includes("budget")) gateType = "budget_limit";
        else if (gate.id?.includes("tone") || gate.id?.includes("content") || gate.id?.includes("legal") || gate.id?.includes("gdpr")) gateType = "content_forbidden";

        return { gateType, config: gate, enabled: true };
      });
    } catch {
      packData.qualityGates = [];
    }

    // Load and transform seed tasks (map description → body, fire_delay_minutes → delayMs)
    try {
      const seedTasksData = JSON.parse(await readFile(join(packDir, "seed-tasks.json"), "utf-8"));
      packData.seedTasks = (seedTasksData.seed_tasks || []).map((task: any) => ({
        agentSlug: task.agent_slug || task.agentSlug,
        title: task.title || "",
        body: task.description || task.body || "",
        delayMs: (task.fire_delay_minutes || 0) * 60 * 1000,
      }));
    } catch {
      packData.seedTasks = [];
    }

    // Load and transform activation sequence
    try {
      const activationData = JSON.parse(await readFile(join(packDir, "activation-sequence.json"), "utf-8"));
      packData.activationSequence = (activationData.moments || []).map((moment: any) => ({
        key: moment.key || "",
        dayThreshold: moment.day || 0,
        notificationTitle: moment.push_notification?.title || moment.notificationTitle || "",
        notificationBody: moment.push_notification?.body || moment.notificationBody || "",
      }));
    } catch {
      packData.activationSequence = [];
    }

    return packData as PackManifest;
  }

  /**
   * Get list of available packs with metadata
   */
  async function listAvailablePacks(): Promise<Array<{
    slug: string;
    name: string;
    version: string;
    description: string;
    tagline: string;
    estimated_setup_minutes: number;
    value_proposition: string[];
  }>> {
    try {
      const p1 = await loadPackManifest("p1-recruitment");
      return [
        {
          slug: p1.slug,
          name: p1.name,
          version: p1.version,
          description: p1.description ?? "",
          tagline: p1.tagline ?? "",
          estimated_setup_minutes: p1.estimated_setup_minutes ?? 20,
          value_proposition: p1.value_proposition ?? [],
        },
      ];
    } catch {
      return [];
    }
  }

  /**
   * Install a pack for a company
   */
  async function install(
    companyId: string,
    packSlug: string,
    variables?: Record<string, string>,
  ) {
    const pack = await loadPackManifest(packSlug);
    return await installPack(db, {
      companyId,
      pack,
      variables: variables ?? {},
    });
  }

  return {
    loadPackManifest,
    listAvailablePacks,
    install,
  };
}
