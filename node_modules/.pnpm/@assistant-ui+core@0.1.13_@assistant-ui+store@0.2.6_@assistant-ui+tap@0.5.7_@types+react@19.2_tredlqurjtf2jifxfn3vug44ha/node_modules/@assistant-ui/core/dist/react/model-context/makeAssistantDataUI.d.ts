import type { FC } from "react";
import { type AssistantDataUIProps } from "./useAssistantDataUI.js";
export type AssistantDataUI = FC & {
    unstable_data: AssistantDataUIProps;
};
export declare const makeAssistantDataUI: <T = any>(dataUI: AssistantDataUIProps<T>) => AssistantDataUI;
//# sourceMappingURL=makeAssistantDataUI.d.ts.map