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
import type { Db } from "@paperclipai/db";
export declare class MCPPermissionError extends Error {
    constructor(agentId: string, server: string, permission: string);
}
export declare class MCPIntegrationNotFoundError extends Error {
    constructor(companyId: string, server: string);
}
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
export declare class MCPRouter {
    private readonly db;
    constructor(db: Db);
    /**
     * Execute an MCP tool call on behalf of an agent.
     * Enforces permission check, vault decryption, and audit logging.
     *
     * RULE 2: access token is decrypted here and passed directly to executeMCPCall.
     * It is never returned to the caller or injected into LLM messages.
     */
    callTool(params: MCPCallParams): Promise<unknown>;
    private checkPermission;
    private getIntegration;
    private resolveAccessToken;
    /**
     * Execute the actual MCP tool call against the external service.
     * Each integration type has its own adapter (implemented per-service).
     * This stub returns a placeholder — real adapters added in integration modules.
     *
     * RULE 2: accessToken is used here and NOT returned or logged.
     */
    private executeMCPCall;
    private scheduleTokenRefresh;
    private logToolCall;
}
/**
 * Factory — creates a bound MCPRouter for a given DB connection.
 * Usage: const mcp = createMCPRouter(db); await mcp.callTool({...})
 */
export declare function createMCPRouter(db: Db): MCPRouter;
//# sourceMappingURL=mcp.d.ts.map