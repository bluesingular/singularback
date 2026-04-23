import { parsePartialJsonObject } from "assistant-stream/utils";
import { generateId } from "../../utils/id.js";
const convertDataPrefixedPart = (type, data) => {
    if (!type.startsWith("data-"))
        return undefined;
    return { type: "data", name: type.substring(5), data };
};
export const fromThreadMessageLike = (like, fallbackId, fallbackStatus) => {
    const { role, id, createdAt, attachments, status, metadata } = like;
    const common = {
        id: id ?? fallbackId,
        createdAt: createdAt ?? new Date(),
    };
    const content = typeof like.content === "string"
        ? [{ type: "text", text: like.content }]
        : like.content;
    const sanitizeImageContent = ({ image, ...rest }) => {
        const match = image.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.*)$/);
        if (match) {
            return { ...rest, image };
        }
        console.warn(`Invalid image data format detected`);
        return null;
    };
    if (role !== "user" && attachments?.length)
        throw new Error("attachments are only supported for user messages");
    if (role !== "assistant" && status)
        throw new Error("status is only supported for assistant messages");
    if (role !== "assistant" && metadata?.steps)
        throw new Error("metadata.steps is only supported for assistant messages");
    switch (role) {
        case "assistant":
            return {
                ...common,
                role,
                content: content
                    .map((part) => {
                    const type = part.type;
                    switch (type) {
                        case "text":
                        case "reasoning":
                            if (part.text.trim().length === 0)
                                return null;
                            return part;
                        case "file":
                        case "source":
                            return part;
                        case "image":
                            return sanitizeImageContent(part);
                        case "data":
                            return part;
                        case "tool-call": {
                            const { parentId, messages, ...basePart } = part;
                            const commonProps = {
                                ...basePart,
                                toolCallId: part.toolCallId ?? `tool-${generateId()}`,
                                ...(parentId !== undefined && { parentId }),
                                ...(messages !== undefined && { messages }),
                            };
                            if (part.args) {
                                return {
                                    ...commonProps,
                                    args: part.args,
                                    argsText: part.argsText ?? JSON.stringify(part.args),
                                };
                            }
                            return {
                                ...commonProps,
                                args: parsePartialJsonObject(part.argsText ?? "") ?? {},
                                argsText: part.argsText ?? "",
                            };
                        }
                        default: {
                            const converted = convertDataPrefixedPart(type, part.data);
                            if (converted)
                                return converted;
                            throw new Error(`Unsupported assistant message part type: ${type}`);
                        }
                    }
                })
                    .filter((c) => !!c),
                status: status ?? fallbackStatus,
                metadata: {
                    unstable_state: metadata?.unstable_state ?? null,
                    unstable_annotations: metadata?.unstable_annotations ?? [],
                    unstable_data: metadata?.unstable_data ?? [],
                    custom: metadata?.custom ?? {},
                    steps: metadata?.steps ?? [],
                    ...(metadata?.timing && { timing: metadata.timing }),
                    ...(metadata?.submittedFeedback && {
                        submittedFeedback: metadata.submittedFeedback,
                    }),
                },
            };
        case "user":
            return {
                ...common,
                role,
                content: content.map((part) => {
                    const type = part.type;
                    switch (type) {
                        case "text":
                        case "image":
                        case "audio":
                        case "file":
                        case "data":
                            return part;
                        default: {
                            const converted = convertDataPrefixedPart(type, part.data);
                            if (converted)
                                return converted;
                            throw new Error(`Unsupported user message part type: ${type}`);
                        }
                    }
                }),
                attachments: (attachments ?? []).map((att) => ({
                    ...att,
                    content: att.content.map((part) => {
                        const converted = convertDataPrefixedPart(part.type, part.data);
                        return converted ?? part;
                    }),
                })),
                metadata: {
                    custom: metadata?.custom ?? {},
                },
            };
        case "system":
            if (content.length !== 1 || content[0].type !== "text")
                throw new Error("System messages must have exactly one text message part.");
            return {
                ...common,
                role,
                content: content,
                metadata: {
                    custom: metadata?.custom ?? {},
                },
            };
        default: {
            const unsupportedRole = role;
            throw new Error(`Unknown message role: ${unsupportedRole}`);
        }
    }
};
//# sourceMappingURL=thread-message-like.js.map