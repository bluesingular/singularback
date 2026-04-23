const TRANSFORM_SCOPES = Symbol("assistant-ui.transform-scopes");
export function attachTransformScopes(resource, transform) {
    const r = resource;
    if (r[TRANSFORM_SCOPES]) {
        throw new Error("transformScopes is already attached to this resource");
    }
    r[TRANSFORM_SCOPES] = transform;
}
export function forwardTransformScopes(target, source) {
    const sourceTransform = getTransformScopes(source);
    if (!sourceTransform)
        return;
    const r = target;
    const existingTransform = r[TRANSFORM_SCOPES];
    if (existingTransform) {
        r[TRANSFORM_SCOPES] = (scopes, parent) => {
            sourceTransform(scopes, parent);
            existingTransform(scopes, parent);
        };
    }
    else {
        r[TRANSFORM_SCOPES] = sourceTransform;
    }
}
export function getTransformScopes(resource) {
    return resource[TRANSFORM_SCOPES];
}
//# sourceMappingURL=attachTransformScopes.js.map