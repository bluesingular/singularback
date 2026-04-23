import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PaperclipApiClient } from "./client.js";
import { type PaperclipMcpConfig } from "./config.js";
export declare function createPaperclipMcpServer(config?: PaperclipMcpConfig): {
    server: McpServer;
    tools: import("./tools.js").ToolDefinition[];
    client: PaperclipApiClient;
};
export declare function runServer(config?: PaperclipMcpConfig): Promise<void>;
//# sourceMappingURL=index.d.ts.map