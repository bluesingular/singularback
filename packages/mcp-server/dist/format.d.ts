type McpTextResponse = {
    content: Array<{
        type: "text";
        text: string;
    }>;
};
export declare function formatTextResponse(value: unknown): McpTextResponse;
export declare function formatErrorResponse(error: unknown): McpTextResponse;
export {};
//# sourceMappingURL=format.d.ts.map