const ROUTINE_VARIABLE_MATCHER = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;
/**
 * Built-in variable names that are automatically available in routine templates
 * without needing to be defined in the routine's variables list.
 */
export const BUILTIN_ROUTINE_VARIABLE_NAMES = new Set(["date"]);
export function isBuiltinRoutineVariable(name) {
    return BUILTIN_ROUTINE_VARIABLE_NAMES.has(name);
}
/**
 * Returns current values for all built-in routine variables.
 * `date` expands to the current date in YYYY-MM-DD format (UTC).
 */
export function getBuiltinRoutineVariableValues() {
    return {
        date: new Date().toISOString().slice(0, 10),
    };
}
export function isValidRoutineVariableName(name) {
    return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}
function normalizeRoutineTemplateInput(input) {
    const templates = Array.isArray(input) ? input : [input];
    return templates.filter((template) => typeof template === "string" && template.length > 0);
}
export function extractRoutineVariableNames(template) {
    const found = new Set();
    for (const source of normalizeRoutineTemplateInput(template)) {
        for (const match of source.matchAll(ROUTINE_VARIABLE_MATCHER)) {
            const name = match[1];
            if (name && !found.has(name)) {
                found.add(name);
            }
        }
    }
    return [...found];
}
function defaultRoutineVariable(name) {
    return {
        name,
        label: null,
        type: "text",
        defaultValue: null,
        required: true,
        options: [],
    };
}
export function syncRoutineVariablesWithTemplate(template, existing) {
    const names = extractRoutineVariableNames(template).filter((name) => !isBuiltinRoutineVariable(name));
    const existingByName = new Map((existing ?? []).map((variable) => [variable.name, variable]));
    return names.map((name) => existingByName.get(name) ?? defaultRoutineVariable(name));
}
export function stringifyRoutineVariableValue(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    if (value == null)
        return "";
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
export function interpolateRoutineTemplate(template, values) {
    if (template == null)
        return null;
    if (!values || Object.keys(values).length === 0)
        return template;
    return template.replace(ROUTINE_VARIABLE_MATCHER, (match, rawName) => {
        if (!(rawName in values))
            return match;
        return stringifyRoutineVariableValue(values[rawName]);
    });
}
//# sourceMappingURL=routine-variables.js.map