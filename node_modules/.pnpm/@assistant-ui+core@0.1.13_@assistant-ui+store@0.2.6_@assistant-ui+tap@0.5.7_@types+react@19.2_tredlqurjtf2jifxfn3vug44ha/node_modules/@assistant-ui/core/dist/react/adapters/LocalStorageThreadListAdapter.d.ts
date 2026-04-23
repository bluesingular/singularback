import type { RemoteThreadListAdapter } from "../../index.js";
import type { TitleGenerationAdapter } from "./TitleGenerationAdapter.js";
export type AsyncStorageLike = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
};
type LocalStorageAdapterOptions = {
    storage: AsyncStorageLike;
    prefix?: string | undefined;
    titleGenerator?: TitleGenerationAdapter | undefined;
};
export declare const createLocalStorageAdapter: (options: LocalStorageAdapterOptions) => RemoteThreadListAdapter;
export {};
//# sourceMappingURL=LocalStorageThreadListAdapter.d.ts.map