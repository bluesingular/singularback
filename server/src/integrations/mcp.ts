/**
 * server/src/integrations/mcp.ts
 *
 * MCP Router — executes tool calls on behalf of agents via server-side integrations.
 *
 * RULE 2: The LLM never sees credentials. Flow:
 *   1. Agent produces tool call (server receives tool name + args)
 *   2. MCPRouter checks agent permission for the integration
 *   3. Vault decrypts access token server-side
 *   4. Tool call executes against external API
 *   5. Clean result returned to agent context (no token in result)
 *   6. Every call logged to tool_call_log (AI Act audit requirement)
 */

import { eq, and } from "drizzle-orm";
import {
  integrations,
  agentIntegrationPermissions,
  toolCallLog,
} from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import { decryptCredential } from "./vault.js";

// ── Error types ───────────────────────────────────────────────────────────────

export class MCPPermissionError extends Error {
  constructor(agentId: string, server: string, permission: string) {
    super(
      `Agent ${agentId} lacks permission "${permission}" on integration "${server}". ` +
      `Grant access via Settings → Integrations.`,
    );
    this.name = "MCPPermissionError";
  }
}

export class MCPIntegrationNotFoundError extends Error {
  constructor(companyId: string, server: string) {
    super(
      `Integration "${server}" is not connected for company ${companyId}. ` +
      `Connect it via Settings → Integrations.`,
    );
    this.name = "MCPIntegrationNotFoundError";
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MCPCallParams {
  agentId: string;
  companyId: string;
  taskId: string;
  /** Integration name: 'gmail' | 'slack' | 'notion' | 'linkedin' | etc. */
  server: string;
  /** MCP tool name within the integration */
  tool: string;
  args: Record<string, unknown>;
  /** Permission level required for this call */
  requiredPerm: string;
}

// ── MCPRouter ─────────────────────────────────────────────────────────────────

export class MCPRouter {
  constructor(private readonly db: Db) {}

  /**
   * Execute an MCP tool call on behalf of an agent.
   * Enforces permission check, vault decryption, and audit logging.
   *
   * RULE 2: access token is decrypted here and passed directly to executeMCPCall.
   * It is never returned to the caller or injected into LLM messages.
   */
  async callTool(params: MCPCallParams): Promise<unknown> {
    // 1. Check agent has the required permission for this integration
    await this.checkPermission(params.agentId, params.companyId, params.server, params.requiredPerm);

    // 2. Load integration and decrypt OAuth access token from vault
    const integration = await this.getIntegration(params.companyId, params.server);
    const accessToken = this.resolveAccessToken(params.companyId, integration);

    // 3. Check if OAuth token needs refresh (non-blocking, best-effort)
    if (
      integration.oauthExpiresAt &&
      integration.oauthExpiresAt < new Date() &&
      integration.oauthRefreshTokenEnc
    ) {
      // Refresh is async and doesn't block execution — fire and forget
      // Full refresh logic implemented per-integration in M4 integration adapters
      void this.scheduleTokenRefresh(params.companyId, params.server);
    }

    // 4. Execute via MCP client (server-side — LLM never sees the token)
    const startTime = Date.now();
    let result: unknown;
    let errorMsg: string | undefined;

    try {
      result = await this.executeMCPCall(
        params.server,
        params.tool,
        params.args,
        accessToken,
      );
    } catch (err) {
      errorMsg = String(err);
      throw err;
    } finally {
      // 5. Log every tool call to audit trail (AI Act — immutable append)
      await this.logToolCall({
        companyId: params.companyId,
        agentId: params.agentId,
        taskId: params.taskId,
        toolType: "mcp",
        toolName: `${params.server}/${params.tool}`,
        input: params.args,
        output: result as Record<string, unknown> | undefined,
        status: errorMsg ? "failed" : "success",
        durationMs: Date.now() - startTime,
        error: errorMsg,
      });
    }

    return result;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async checkPermission(
    agentId: string,
    companyId: string,
    server: string,
    requiredPerm: string,
  ): Promise<void> {
    // Find the integration first to get its id
    const [integration] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.companyId, companyId),
          eq(integrations.type, server),
        ),
      )
      .limit(1);

    if (!integration) {
      throw new MCPIntegrationNotFoundError(companyId, server);
    }

    const [perm] = await this.db
      .select({ permissions: agentIntegrationPermissions.permissions })
      .from(agentIntegrationPermissions)
      .where(
        and(
          eq(agentIntegrationPermissions.agentId, agentId),
          eq(agentIntegrationPermissions.integrationId, integration.id),
        ),
      )
      .limit(1);

    if (!perm || !perm.permissions.includes(requiredPerm)) {
      throw new MCPPermissionError(agentId, server, requiredPerm);
    }
  }

  private async getIntegration(companyId: string, server: string) {
    const [row] = await this.db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.companyId, companyId),
          eq(integrations.type, server),
        ),
      )
      .limit(1);

    if (!row) {
      throw new MCPIntegrationNotFoundError(companyId, server);
    }

    return row;
  }

  private resolveAccessToken(
    companyId: string,
    integration: Awaited<ReturnType<MCPRouter["getIntegration"]>>,
  ): string {
    if (integration.oauthAccessTokenEnc) {
      // OAuth integration: decrypt the access token
      // oauthAccessTokenEnc is stored with its own IV (embedded in the blob for simplicity)
      // Full IV/tag separation is handled by the vault's encryptCredential
      // For now: credentials_enc/iv/tag hold the primary credential (API key or OAuth token)
      return decryptCredential(
        companyId,
        integration.credentialsEnc,
        integration.credentialsIv,
        integration.credentialsTag,
      );
    }

    // Non-OAuth integration (API key): decrypt from credentials blob
    return decryptCredential(
      companyId,
      integration.credentialsEnc,
      integration.credentialsIv,
      integration.credentialsTag,
    );
  }

  /**
   * Execute the actual MCP tool call against the external service.
   * Each integration type has its own adapter (implemented per-service).
   * This stub returns a placeholder — real adapters added in integration modules.
   *
   * RULE 2: accessToken is used here and NOT returned or logged.
   */
  private async executeMCPCall(
    server: string,
    tool: string,
    args: Record<string, unknown>,
    _accessToken: string, // deliberately named with _ — never logged
  ): Promise<unknown> {
    // Integration-specific adapters will be registered here as they are built.
    // Pattern: switch on server, call the appropriate adapter.
    throw new Error(
      `MCP adapter for "${server}/${tool}" is not yet implemented. ` +
      `Add it in server/src/integrations/adapters/${server}.ts`,
    );
  }

  private async scheduleTokenRefresh(companyId: string, server: string): Promise<void> {
    // Full OAuth refresh logic implemented per integration adapter.
    // Emits a refresh job to the background queue in the full implementation.
    void companyId;
    void server;
  }

  private async logToolCall(entry: {
    companyId: string;
    agentId: string;
    taskId: string;
    toolType: string;
    toolName: string;
    input: Record<string, unknown>;
    output: Record<string, unknown> | undefined;
    status: string;
    durationMs: number;
    error: string | undefined;
  }): Promise<void> {
    await this.db.insert(toolCallLog).values({
      companyId: entry.companyId,
      agentId: entry.agentId,
      taskId: entry.taskId,
      toolType: entry.toolType,
      toolName: entry.toolName,
      input: entry.input,
      output: entry.output ?? null,
      status: entry.status,
      durationMs: String(entry.durationMs),
      error: entry.error ?? null,
    });
  }
}

/**
 * Factory — creates a bound MCPRouter for a given DB connection.
 * Usage: const mcp = createMCPRouter(db); await mcp.callTool({...})
 */
export function createMCPRouter(db: Db): MCPRouter {
  return new MCPRouter(db);
}
