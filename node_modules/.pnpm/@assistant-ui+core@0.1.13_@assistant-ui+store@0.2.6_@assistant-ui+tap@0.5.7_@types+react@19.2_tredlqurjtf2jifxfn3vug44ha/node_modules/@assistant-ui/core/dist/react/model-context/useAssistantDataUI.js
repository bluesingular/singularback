import { useEffect } from "react";
import { useAui } from "@assistant-ui/store";
export const useAssistantDataUI = (dataUI) => {
    const aui = useAui();
    useEffect(() => {
        if (!dataUI?.name || !dataUI?.render)
            return undefined;
        return aui.dataRenderers().setDataUI(dataUI.name, dataUI.render);
    }, [aui, dataUI?.name, dataUI?.render]);
};
//# sourceMappingURL=useAssistantDataUI.js.map