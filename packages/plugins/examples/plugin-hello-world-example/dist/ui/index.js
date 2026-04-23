import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const WIDGET_LABEL = "Hello world plugin widget";
/**
 * Example dashboard widget showing the smallest possible UI contribution.
 */
export function HelloWorldDashboardWidget({ context }) {
    return (_jsxs("section", { "aria-label": WIDGET_LABEL, children: [_jsx("strong", { children: "Hello world" }), _jsx("div", { children: "This widget was added by @paperclipai/plugin-hello-world-example." }), _jsxs("div", { children: ["Company context: ", context.companyId] })] }));
}
//# sourceMappingURL=index.js.map