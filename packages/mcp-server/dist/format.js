import { PaperclipApiError } from "./client.js";
export function formatTextResponse(value) {
    return {
        content: [
            {
                type: "text",
                text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
            },
        ],
    };
}
export function formatErrorResponse(error) {
    if (error instanceof PaperclipApiError) {
        return formatTextResponse({
            error: error.message,
            status: error.status,
            method: error.method,
            path: error.path,
            body: error.body,
        });
    }
    return formatTextResponse({
        error: error instanceof Error ? error.message : String(error),
    });
}
//# sourceMappingURL=format.js.map