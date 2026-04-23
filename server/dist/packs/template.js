/**
 * server/src/packs/template.ts
 *
 * Template variable interpolation for pack content.
 *
 * Variables use {{snake_case}} syntax, e.g.:
 *   "Bonjour {{company_name}}, votre agent {{agent_name}} est prêt."
 *
 * Unknown variables are left as-is (not replaced) so unresolved placeholders
 * surface visibly rather than silently producing broken content.
 *
 * Used by:
 *   - Seed task titles and bodies
 *   - Skill markdown content
 *   - Notification messages in activation sequence
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;
/**
 * Replace all {{variable}} occurrences in a template string.
 *
 * @param template   Source string containing {{var}} placeholders.
 * @param variables  Map of variable name → replacement value.
 * @returns          Interpolated string. Unknown vars remain as {{var}}.
 */
export function interpolateTemplate(template, variables) {
    return template.replace(VARIABLE_PATTERN, (_, key) => {
        return Object.prototype.hasOwnProperty.call(variables, key)
            ? variables[key]
            : `{{${key}}}`;
    });
}
/**
 * Apply interpolation to every string value in an object (shallow).
 * Used to interpolate all fields of a SeedTask at once.
 */
export function interpolateObject(obj, variables) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
        result[k] = typeof v === "string" ? interpolateTemplate(v, variables) : v;
    }
    return result;
}
//# sourceMappingURL=template.js.map