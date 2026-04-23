import { Cell } from "../../core/types.js";
export declare const tapHook: <T extends Cell["type"]>(type: T, init: () => Cell) => Cell & {
    type: T;
};
export declare const registerRenderMountTask: (task: () => void) => void;
//# sourceMappingURL=tapHook.d.ts.map