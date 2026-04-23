import { FRAME_MESSAGE_CHANNEL, } from "./types.js";
/**
 * Deserializes tools from JSON Schema format back to Tool objects
 */
const deserializeTool = (serializedTool) => ({
    parameters: serializedTool.parameters,
    ...(serializedTool.description && {
        description: serializedTool.description,
    }),
    ...(serializedTool.disabled !== undefined && {
        disabled: serializedTool.disabled,
    }),
    ...(serializedTool.type && { type: serializedTool.type }),
});
/**
 * Deserializes a ModelContext from transmission format
 */
const deserializeModelContext = (serialized) => ({
    ...(serialized.system !== undefined && { system: serialized.system }),
    ...(serialized.tools && {
        tools: Object.fromEntries(Object.entries(serialized.tools).map(([name, tool]) => [
            name,
            deserializeTool(tool),
        ])),
    }),
});
export class AssistantFrameHost {
    _context = {};
    _subscribers = new Set();
    _pendingRequests = new Map();
    _requestCounter = 0;
    _iframeWindow;
    _targetOrigin;
    constructor(iframeWindow, targetOrigin = "*") {
        this._iframeWindow = iframeWindow;
        this._targetOrigin = targetOrigin;
        this.handleMessage = this.handleMessage.bind(this);
        window.addEventListener("message", this.handleMessage);
        this.requestContext();
    }
    handleMessage(event) {
        if (this._targetOrigin !== "*" && event.origin !== this._targetOrigin)
            return;
        if (event.source !== this._iframeWindow)
            return;
        if (event.data?.channel !== FRAME_MESSAGE_CHANNEL)
            return;
        const message = event.data.message;
        switch (message.type) {
            case "model-context-update": {
                this.updateContext(message.context);
                break;
            }
            case "tool-result": {
                const pending = this._pendingRequests.get(message.id);
                if (pending) {
                    if (message.error) {
                        pending.reject(new Error(message.error));
                    }
                    else {
                        pending.resolve(message.result);
                    }
                    this._pendingRequests.delete(message.id);
                }
                break;
            }
        }
    }
    updateContext(serializedContext) {
        const context = deserializeModelContext(serializedContext);
        this._context = {
            ...context,
            tools: context.tools &&
                Object.fromEntries(Object.entries(context.tools).map(([name, tool]) => [
                    name,
                    {
                        ...tool,
                        execute: (args) => this.callTool(name, args),
                    },
                ])),
        };
        this.notifySubscribers();
    }
    callTool(toolName, args) {
        return this.sendRequest({
            type: "tool-call",
            id: `tool-${this._requestCounter++}`,
            toolName,
            args,
        }, 30000, `Tool call "${toolName}" timed out`);
    }
    sendRequest(message, timeout = 30000, timeoutMessage = "Request timed out") {
        return new Promise((resolve, reject) => {
            this._pendingRequests.set(message.id, { resolve, reject });
            this._iframeWindow.postMessage({ channel: FRAME_MESSAGE_CHANNEL, message }, this._targetOrigin);
            const timeoutId = setTimeout(() => {
                const pending = this._pendingRequests.get(message.id);
                if (pending) {
                    pending.reject(new Error(timeoutMessage));
                    this._pendingRequests.delete(message.id);
                }
            }, timeout);
            const originalResolve = this._pendingRequests.get(message.id).resolve;
            const originalReject = this._pendingRequests.get(message.id).reject;
            this._pendingRequests.set(message.id, {
                resolve: (value) => {
                    clearTimeout(timeoutId);
                    originalResolve(value);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    originalReject(error);
                },
            });
        });
    }
    requestContext() {
        this._iframeWindow.postMessage({
            channel: FRAME_MESSAGE_CHANNEL,
            message: {
                type: "model-context-request",
            },
        }, this._targetOrigin);
    }
    notifySubscribers() {
        this._subscribers.forEach((callback) => callback());
    }
    getModelContext() {
        return this._context;
    }
    subscribe(callback) {
        this._subscribers.add(callback);
        return () => this._subscribers.delete(callback);
    }
    dispose() {
        window.removeEventListener("message", this.handleMessage);
        this._subscribers.clear();
        this._pendingRequests.clear();
    }
}
//# sourceMappingURL=host.js.map