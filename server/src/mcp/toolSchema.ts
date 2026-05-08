/**
 * G12 — MCP tool schema generation.
 *
 * Converts a ParsedSkill into an MCP ToolDefinition.
 * MCP tool names must match ^[a-zA-Z0-9_-]{1,64}$.
 *
 * Naming convention: {agentSlug}_{skillSlug}
 *   e.g. "sophie_sourcing_qualification_cv"
 */

import type { ParsedSkill, InputDeclaration } from "../skills/parser.js";

// ── MCP protocol types ────────────────────────────────────────────────────────

export interface McpToolDefinition {
  name:        string;
  description: string;
  inputSchema: {
    type:       "object";
    properties: Record<string, JsonSchemaProperty>;
    required:   string[];
  };
}

interface JsonSchemaProperty {
  type:        string;
  description: string;
  format?:     string;
}

// ── Conversion ────────────────────────────────────────────────────────────────

/**
 * Normalises a string to a valid MCP tool name segment:
 * lowercase, spaces/hyphens → underscores, truncated to 32 chars.
 */
export function toToolNameSegment(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/-/g, "_")
    .replace(/__+/g, "_")
    .slice(0, 32);
}

/**
 * Builds the MCP tool name for an (agent, skill) pair.
 * Format: {agentSlug}_{skillSlug}  (max 64 chars total)
 */
export function buildToolName(agentName: string, skillName: string): string {
  const agentSeg = toToolNameSegment(agentName);
  const skillSeg = toToolNameSegment(skillName);
  return `${agentSeg}_${skillSeg}`.slice(0, 64);
}

/**
 * Maps an InputDeclaration type to a JSON Schema primitive type.
 * "file" inputs become strings (the caller passes base64 or a URL).
 */
function inputTypeToJsonSchemaType(type: InputDeclaration["type"]): string {
  switch (type) {
    case "file":    return "string"; // base64 or URL
    case "object":  return "object";
    case "array":   return "array";
    case "boolean": return "boolean";
    case "number":  return "number";
    default:        return "string";
  }
}

/**
 * Converts a ParsedSkill's inputs into an MCP inputSchema.
 */
export function skillToInputSchema(skill: ParsedSkill): McpToolDefinition["inputSchema"] {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const input of skill.inputs) {
    properties[input.name] = {
      type:        inputTypeToJsonSchemaType(input.type),
      description: input.description,
      ...(input.type === "file" ? { format: "uri-or-base64" } : {}),
    };
    if (input.required) required.push(input.name);
  }

  // If skill has no declared inputs, accept a free-form `task_description`
  if (skill.inputs.length === 0) {
    properties["task_description"] = {
      type:        "string",
      description: "Description of the task to perform",
    };
    required.push("task_description");
  }

  return { type: "object", properties, required };
}

/**
 * Converts a ParsedSkill + agent name into a complete MCP ToolDefinition.
 */
export function skillToMcpTool(agentName: string, skill: ParsedSkill): McpToolDefinition {
  return {
    name:        buildToolName(agentName, skill.name),
    description: skill.purpose || skill.description || skill.name,
    inputSchema: skillToInputSchema(skill),
  };
}
