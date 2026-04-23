export class PaperclipApiError extends Error {
    status;
    method;
    path;
    body;
    constructor(input) {
        super(input.message);
        this.name = "PaperclipApiError";
        this.status = input.status;
        this.method = input.method;
        this.path = input.path;
        this.body = input.body;
    }
}
function isWriteMethod(method) {
    return !["GET", "HEAD"].includes(method.toUpperCase());
}
function buildErrorMessage(method, path, status, body) {
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        return `${method} ${path} failed with ${status}: ${body.error}`;
    }
    return `${method} ${path} failed with ${status}`;
}
async function parseResponseBody(response) {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
export class PaperclipApiClient {
    config;
    constructor(config) {
        this.config = config;
    }
    get defaults() {
        return {
            companyId: this.config.companyId,
            agentId: this.config.agentId,
            runId: this.config.runId,
        };
    }
    resolveCompanyId(companyId) {
        const resolved = companyId?.trim() || this.config.companyId;
        if (!resolved) {
            throw new Error("companyId is required because PAPERCLIP_COMPANY_ID is not set");
        }
        return resolved;
    }
    resolveAgentId(agentId) {
        const resolved = agentId?.trim() || this.config.agentId;
        if (!resolved) {
            throw new Error("agentId is required because PAPERCLIP_AGENT_ID is not set");
        }
        return resolved;
    }
    async requestJson(method, path, options = {}) {
        if (!path.startsWith("/")) {
            throw new Error(`API path must start with "/": ${path}`);
        }
        const url = new URL(path.slice(1), `${this.config.apiUrl}/`);
        const headers = {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: "application/json",
        };
        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json";
        }
        if ((options.includeRunId ?? isWriteMethod(method)) && this.config.runId) {
            headers["X-Paperclip-Run-Id"] = this.config.runId;
        }
        const response = await fetch(url, {
            method,
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const parsedBody = await parseResponseBody(response);
        if (!response.ok) {
            throw new PaperclipApiError({
                status: response.status,
                method: method.toUpperCase(),
                path,
                body: parsedBody,
                message: buildErrorMessage(method.toUpperCase(), path, response.status, parsedBody),
            });
        }
        return parsedBody;
    }
}
//# sourceMappingURL=client.js.map