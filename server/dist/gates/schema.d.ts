/**
 * server/src/gates/schema.ts
 *
 * Output schema validation — validates agent output against the JSON schema
 * declared in the skill's frontmatter before quality gates run.
 *
 * Flow:
 *   Agent produces output → validateOutputSchema() → PASS → runGates()
 *                                                  → FAIL → agent corrects
 *                                                         → 2 failures → escalate
 *
 * Uses Ajv (JSON Schema validator) which is already a project dependency.
 */
export interface SchemaValidationError {
    field: string;
    message: string;
}
export interface SchemaValidationResult {
    valid: boolean;
    errors: SchemaValidationError[];
}
/**
 * Validate agent output against a JSON Schema declared in skill frontmatter.
 *
 * @param output   - The parsed agent output (object)
 * @param schema   - JSON Schema definition from skill's `output.schema` frontmatter
 * @returns        - { valid, errors } — errors is empty when valid
 */
export declare function validateOutputSchema(output: unknown, schema: Record<string, unknown>): SchemaValidationResult;
/**
 * Format validation errors into a human-readable correction prompt
 * for the agent to fix its output.
 */
export declare function formatCorrectionPrompt(errors: SchemaValidationError[]): string;
//# sourceMappingURL=schema.d.ts.map