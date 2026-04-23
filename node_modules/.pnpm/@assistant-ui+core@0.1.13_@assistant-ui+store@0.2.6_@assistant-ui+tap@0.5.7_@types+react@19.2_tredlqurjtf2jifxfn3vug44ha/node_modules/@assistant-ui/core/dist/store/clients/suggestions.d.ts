import type { ClientOutput } from "@assistant-ui/store";
export type SuggestionConfig = string | {
    title: string;
    label: string;
    prompt: string;
};
export declare const Suggestions: {
    (): import("@assistant-ui/tap").ResourceElement<ClientOutput<"suggestions">, undefined>;
    (suggestions: SuggestionConfig[]): import("@assistant-ui/tap").ResourceElement<ClientOutput<"suggestions">, SuggestionConfig[]>;
};
//# sourceMappingURL=suggestions.d.ts.map