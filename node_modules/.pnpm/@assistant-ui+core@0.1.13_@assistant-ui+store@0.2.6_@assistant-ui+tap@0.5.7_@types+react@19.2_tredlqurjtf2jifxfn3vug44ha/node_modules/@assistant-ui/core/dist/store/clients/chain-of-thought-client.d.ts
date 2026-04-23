import type { ClientOutput } from "@assistant-ui/store";
import type { ChainOfThoughtPart } from "../scopes/chain-of-thought.js";
import type { PartMethods } from "../scopes/part.js";
export declare const ChainOfThoughtClient: (props: {
    parts: readonly ChainOfThoughtPart[];
    getMessagePart: (selector: {
        index: number;
    }) => PartMethods;
}) => import("@assistant-ui/tap").ResourceElement<ClientOutput<"chainOfThought">, {
    parts: readonly ChainOfThoughtPart[];
    getMessagePart: (selector: {
        index: number;
    }) => PartMethods;
}>;
//# sourceMappingURL=chain-of-thought-client.d.ts.map