type PreparedOpenCodeRuntimeConfig = {
    env: Record<string, string>;
    notes: string[];
    cleanup: () => Promise<void>;
};
export declare function prepareOpenCodeRuntimeConfig(input: {
    env: Record<string, string>;
    config: Record<string, unknown>;
}): Promise<PreparedOpenCodeRuntimeConfig>;
export {};
//# sourceMappingURL=runtime-config.d.ts.map