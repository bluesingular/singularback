import { useAssistantDataUI, } from "./useAssistantDataUI.js";
export const makeAssistantDataUI = (dataUI) => {
    const DataUI = () => {
        useAssistantDataUI(dataUI);
        return null;
    };
    DataUI.unstable_data = dataUI;
    return DataUI;
};
//# sourceMappingURL=makeAssistantDataUI.js.map