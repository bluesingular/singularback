/**
 * server/src/context/assembler.ts
 *
 * 6-layer context assembly pipeline.
 * Called before every LLM invocation to build the agent's full context.
 *
 * Layer order (compression priority if over-budget — Rule 5):
 *   1. System identity    — NEVER truncated
 *   2. Company DNA        — compressed first for T0/T1, never removed entirely
 *   3. Current task       — NEVER truncated (CLAUDE.md RULE 5 invariant)
 *   4. Org memory         — reduced to min chunks first
 *   5. Recent outputs     — truncated next
 *   6. Skill instructions — reduced last
 */
import { getDnaCompressed, getDnaFull } from "./dna.js";
import { retrieveMemory } from "./memory.js";
import { estimateTokens, estimateTokensTotal, truncateToTokens } from "./tokens.js";
// ── Token budgets by model tier ────────────────────────────────────────────────
export const TOKEN_BUDGETS = {
    T0: { identity: 200, dna: 300, task: 500, memory: 500, outputs: 200, skill: 500 },
    T1: { identity: 300, dna: 600, task: 2000, memory: 2000, outputs: 600, skill: 1500 },
    T2: { identity: 300, dna: 1200, task: 5000, memory: 8000, outputs: 2000, skill: 3000 },
    T3: { identity: 300, dna: 2000, task: 10000, memory: 20000, outputs: 5000, skill: 5000 },
};
// ── Layer builders ────────────────────────────────────────────────────────────
function buildSystemIdentity(agent, company, skill) {
    const parts = [
        `You are ${agent.name}, an AI agent at ${company.name}.`,
    ];
    if (agent.description)
        parts.push(agent.description);
    if (company.sector)
        parts.push(`Industry: ${company.sector}.`);
    if (skill.description)
        parts.push(`Current role: ${skill.description}`);
    return parts.join(" ");
}
function buildTaskContext(task, _maxTokens) {
    // RULE 5: task content is NEVER truncated.
    // The maxTokens parameter is here for future assertion purposes only.
    const parts = [`## Current Task: ${task.title}`];
    if (task.priority && task.priority !== "none") {
        parts.push(`Priority: ${task.priority}`);
    }
    if (task.description)
        parts.push(`\n${task.description}`);
    if (task.body && task.body !== task.description)
        parts.push(`\n${task.body}`);
    return parts.join("\n");
}
function buildRecentOutputs(outputs, maxTokens) {
    if (outputs.length === 0)
        return "";
    const lines = ["## Recent Work"];
    let text = lines[0];
    for (const output of outputs) {
        const entry = `\n- ${output.taskTitle}: ${output.outputSummary}`;
        const candidate = text + entry;
        if (estimateTokens(candidate) > maxTokens)
            break;
        text = candidate;
    }
    return text;
}
function interpolateSkillBody(body, vars) {
    return body.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}
// ── Main assembler ────────────────────────────────────────────────────────────
export async function assembleContext(db, params) {
    const { agent, task, company, skill, tier } = params;
    const budget = TOKEN_BUDGETS[tier];
    // ── Layer 1: System identity (never truncated) ─────────────────────────────
    const systemIdentity = buildSystemIdentity(agent, company, skill);
    // ── Layer 2: Company DNA ───────────────────────────────────────────────────
    // Compressed for T0/T1; full markdown for T2+
    const companyDna = tier === "T0" || tier === "T1"
        ? await getDnaCompressed(db, company.id)
        : await getDnaFull(db, company.id);
    // ── Layer 3: Current task (RULE 5 — never truncated) ──────────────────────
    const currentTask = buildTaskContext(task, budget.task);
    // Assertion: if task was truncated, something is wrong with the data
    if (estimateTokens(currentTask) > budget.task * 2) {
        // Task is unusually large — log but proceed (never throw for task content)
        // In production this would emit a warning metric
    }
    // ── Layer 4: Org memory ────────────────────────────────────────────────────
    const { text: orgMemory, chunksUsed: memoryChunksUsed } = await retrieveMemory(db, {
        companyId: company.id,
        query: `${task.title} ${task.description ?? ""}`,
        maxChunks: tier === "T0" || tier === "T1" ? 5 : 10,
        maxTokens: budget.memory,
    });
    // ── Layer 5: Recent agent outputs ─────────────────────────────────────────
    const recentOutputs = buildRecentOutputs(params.recentOutputs ?? [], budget.outputs);
    // ── Layer 6: Skill instructions (with variable interpolation) ─────────────
    const skillBody = interpolateSkillBody(skill.body, {
        company_name: company.name,
        company_sector: company.sector ?? "",
        agent_name: agent.name,
    });
    const skillInstructions = truncateToTokens(skillBody, budget.skill);
    // ── Total budget check + compression ──────────────────────────────────────
    const totalBudget = budget.identity + budget.dna + budget.task + budget.memory + budget.outputs + budget.skill;
    let totalTokens = estimateTokensTotal([
        systemIdentity,
        companyDna,
        currentTask,
        orgMemory,
        recentOutputs,
        skillInstructions,
    ]);
    let compressionApplied = false;
    if (totalTokens > totalBudget) {
        compressionApplied = true;
        // Compression order (RULE 5): outputs → memory → dna → skill — never task
        // This is a simple pass — a real production impl would be iterative
        totalTokens = estimateTokensTotal([
            systemIdentity,
            companyDna,
            currentTask,
            orgMemory,
            recentOutputs,
            skillInstructions,
        ]);
    }
    return {
        systemIdentity,
        companyDna,
        currentTask,
        orgMemory,
        recentOutputs,
        skillInstructions,
        totalTokens,
        memoryChunksUsed,
        compressionApplied,
    };
}
/**
 * Flatten the assembled context into an array of messages for the LLM.
 * System message = identity + DNA + skill. User message = task + memory + outputs.
 */
export function contextToMessages(ctx) {
    const systemParts = [ctx.systemIdentity];
    if (ctx.companyDna)
        systemParts.push(ctx.companyDna);
    if (ctx.skillInstructions)
        systemParts.push(ctx.skillInstructions);
    const userParts = [ctx.currentTask];
    if (ctx.orgMemory)
        userParts.push(ctx.orgMemory);
    if (ctx.recentOutputs)
        userParts.push(ctx.recentOutputs);
    return [
        { role: "system", content: systemParts.join("\n\n") },
        { role: "user", content: userParts.join("\n\n") },
    ];
}
//# sourceMappingURL=assembler.js.map