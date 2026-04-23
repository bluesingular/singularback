// @assistant-ui/core/internal - Internal implementation details
// Not part of the public API. Used by @assistant-ui/react and other framework bindings.
export { 
// Sentinel
SKIP_UPDATE, 
// Base classes
BaseSubscribable, BaseSubject, 
// Subject implementations
ShallowMemoizeSubject, LazyMemoizeSubject, NestedSubscriptionSubject, EventSubscriptionSubject, } from "./subscribable/subscribable.js";
// ID generation
export { generateId, generateOptimisticId, isOptimisticId, generateErrorMessageId, isErrorMessageId, } from "./utils/id.js";
// Message utilities
export { getThreadMessageText } from "./utils/text.js";
// Composite context provider
export { CompositeContextProvider } from "./utils/composite-context-provider.js";
export * from "./runtime/internal.js";
export * from "./runtimes/internal.js";
//# sourceMappingURL=internal.js.map