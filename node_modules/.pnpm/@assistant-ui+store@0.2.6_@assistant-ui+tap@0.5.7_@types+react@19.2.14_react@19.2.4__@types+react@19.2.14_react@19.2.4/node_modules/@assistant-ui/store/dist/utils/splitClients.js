import { Derived } from "../Derived.js";
import { getTransformScopes } from "../attachTransformScopes.js";
import { tapMemo } from "@assistant-ui/tap";
/**
 * Splits a clients object into root clients and derived clients,
 * applying transformScopes from root client elements.
 */
function splitClients(clients, baseClient) {
    // 1. Collect transforms from root elements and run them iteratively
    const scopes = { ...clients };
    const visited = new Set();
    let changed = true;
    while (changed) {
        changed = false;
        for (const clientElement of Object.values(scopes)) {
            if (clientElement.type === Derived)
                continue;
            if (visited.has(clientElement.type))
                continue;
            visited.add(clientElement.type);
            const transform = getTransformScopes(clientElement.type);
            if (transform) {
                transform(scopes, baseClient);
                changed = true;
                break; // restart iteration since scopes may have new root elements
            }
        }
    }
    // 2. Split result into root/derived
    const rootClients = {};
    const derivedClients = {};
    for (const [key, clientElement] of Object.entries(scopes)) {
        if (clientElement.type === Derived) {
            derivedClients[key] = clientElement;
        }
        else {
            rootClients[key] = clientElement;
        }
    }
    return { rootClients, derivedClients };
}
const tapShallowMemoObject = (object) => {
    // biome-ignore lint/correctness/useExhaustiveDependencies: shallow memo
    return tapMemo(() => object, [...Object.entries(object).flat()]);
};
export const tapSplitClients = (clients, baseClient) => {
    const { rootClients, derivedClients } = splitClients(clients, baseClient);
    return {
        rootClients: tapShallowMemoObject(rootClients),
        derivedClients: tapShallowMemoObject(derivedClients),
    };
};
//# sourceMappingURL=splitClients.js.map