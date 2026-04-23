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
import { Ajv } from "ajv";
import addFormats from "ajv-formats";
const ajv = new Ajv({ allErrors: true });
// @ts-expect-error — ajv-formats CJS/ESM interop with NodeNext
addFormats(ajv);
// ── Validator ─────────────────────────────────────────────────────────────────
/**
 * Validate agent output against a JSON Schema declared in skill frontmatter.
 *
 * @param output   - The parsed agent output (object)
 * @param schema   - JSON Schema definition from skill's `output.schema` frontmatter
 * @returns        - { valid, errors } — errors is empty when valid
 */
export function validateOutputSchema(output, schema) {
    const validate = ajv.compile(schema);
    const valid = validate(output);
    if (valid) {
        return { valid: true, errors: [] };
    }
    const errors = (validate.errors ?? []).map((err) => {
        const field = err.instancePath
            ? err.instancePath.replace(/^\//, "").replace(/\//g, ".")
            : err.params && "missingProperty" in err.params
                ? String(err.params.missingProperty)
                : "(root)";
        return {
            field,
            message: err.message ?? "validation failed",
        };
    });
    return { valid: false, errors };
}
/**
 * Format validation errors into a human-readable correction prompt
 * for the agent to fix its output.
 */
export function formatCorrectionPrompt(errors) {
    const lines = errors.map((e) => `- ${e.field}: ${e.message}`);
    return (`Your output is missing or has invalid required fields. Please correct:\n` +
        lines.join("\n"));
}
//# sourceMappingURL=schema.js.map