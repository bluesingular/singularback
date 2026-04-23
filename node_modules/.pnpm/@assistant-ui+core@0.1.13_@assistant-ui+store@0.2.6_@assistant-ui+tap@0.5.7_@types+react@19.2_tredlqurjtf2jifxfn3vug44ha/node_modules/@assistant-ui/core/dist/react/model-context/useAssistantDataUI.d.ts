import type { DataMessagePartComponent } from "../types/MessagePartComponentTypes.js";
export type AssistantDataUIProps<T = any> = {
    name: string;
    render: DataMessagePartComponent<T>;
};
export declare const useAssistantDataUI: (dataUI: AssistantDataUIProps | null) => void;
//# sourceMappingURL=useAssistantDataUI.d.ts.map