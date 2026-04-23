import type { AdapterModel } from "@paperclipai/adapter-utils";
/**
 * Return the model list appropriate for the current auth mode.
 * When Bedrock env vars are detected, returns Bedrock-native model IDs;
 * otherwise returns standard Anthropic API model IDs.
 */
export declare function listClaudeModels(): Promise<AdapterModel[]>;
/** Check whether a model ID is a Bedrock-native identifier (not an Anthropic API short name). */
/** Bedrock model IDs use region-qualified prefixes (e.g. us.anthropic.*, eu.anthropic.*) or ARNs. */
export declare function isBedrockModelId(model: string): boolean;
//# sourceMappingURL=models.d.ts.map