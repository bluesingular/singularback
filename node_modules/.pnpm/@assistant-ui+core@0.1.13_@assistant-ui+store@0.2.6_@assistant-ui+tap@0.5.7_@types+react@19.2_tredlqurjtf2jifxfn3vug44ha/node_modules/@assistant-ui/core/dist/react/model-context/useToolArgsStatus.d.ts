type PropFieldStatus = "streaming" | "complete";
export type ToolArgsStatus<TArgs extends Record<string, unknown> = Record<string, unknown>> = {
    status: "running" | "complete" | "incomplete" | "requires-action";
    propStatus: Partial<Record<keyof TArgs, PropFieldStatus>>;
};
export declare const useToolArgsStatus: <TArgs extends Record<string, unknown> = Record<string, unknown>>() => ToolArgsStatus<TArgs>;
export {};
//# sourceMappingURL=useToolArgsStatus.d.ts.map