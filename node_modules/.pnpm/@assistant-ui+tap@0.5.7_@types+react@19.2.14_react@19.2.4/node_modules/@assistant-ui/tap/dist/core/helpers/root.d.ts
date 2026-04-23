import { Cell, ResourceFiber, ResourceFiberRoot } from "../types.js";
export declare const createResourceFiberRoot: (dispatchUpdate: (cb: () => boolean) => void) => ResourceFiberRoot;
export declare const commitRoot: (root: ResourceFiberRoot) => void;
export declare const setRootVersion: (root: ResourceFiberRoot, version: number) => void;
export declare const markCellDirty: (fiber: ResourceFiber<any, any>, cell: Cell & {
    type: "reducer";
}) => void;
//# sourceMappingURL=root.d.ts.map