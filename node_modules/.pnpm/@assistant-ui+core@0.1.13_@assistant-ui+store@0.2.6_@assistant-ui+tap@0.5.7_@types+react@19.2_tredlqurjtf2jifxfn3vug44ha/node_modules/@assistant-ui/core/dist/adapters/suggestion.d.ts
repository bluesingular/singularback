import type { ThreadMessage } from "../types/message.js";
import type { ThreadSuggestion } from "../runtime/interfaces/thread-runtime-core.js";
type SuggestionAdapterGenerateOptions = {
    messages: readonly ThreadMessage[];
};
export type SuggestionAdapter = {
    generate: (options: SuggestionAdapterGenerateOptions) => Promise<readonly ThreadSuggestion[]> | AsyncGenerator<readonly ThreadSuggestion[], void>;
};
export {};
//# sourceMappingURL=suggestion.d.ts.map