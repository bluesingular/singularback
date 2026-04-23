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
/**
 * Replace all {{variable}} occurrences in a template string.
 *
 * @param template   Source string containing {{var}} placeholders.
 * @param variables  Map of variable name → replacement value.
 * @returns          Interpolated string. Unknown vars remain as {{var}}.
 */
export declare function interpolateTemplate(template: string, variables: Record<string, string>): string;
/**
 * Apply interpolation to every string value in an object (shallow).
 * Used to interpolate all fields of a SeedTask at once.
 */
export declare function interpolateObject(obj: Record<string, string>, variables: Record<string, string>): Record<string, string>;
//# sourceMappingURL=template.d.ts.map