import { tapReducer } from "./tap-reducer.js";
const stateReducer = (state, action) => typeof action === "function"
    ? action(state)
    : action;
const stateInit = (initial) => typeof initial === "function" ? initial() : initial;
export function tapState(initial) {
    return tapReducer(stateReducer, initial, stateInit);
}
//# sourceMappingURL=tap-state.js.map