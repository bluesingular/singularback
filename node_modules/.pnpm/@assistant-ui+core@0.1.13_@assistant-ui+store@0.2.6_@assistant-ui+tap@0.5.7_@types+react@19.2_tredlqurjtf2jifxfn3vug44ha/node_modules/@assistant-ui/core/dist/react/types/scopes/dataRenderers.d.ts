import type { DataMessagePartComponent } from "../MessagePartComponentTypes.js";
import type { Unsubscribe } from "../../../index.js";
export type DataRenderersState = {
    renderers: Record<string, DataMessagePartComponent[]>;
};
export type DataRenderersMethods = {
    getState(): DataRenderersState;
    setDataUI(name: string, render: DataMessagePartComponent): Unsubscribe;
};
export type DataRenderersClientSchema = {
    methods: DataRenderersMethods;
};
//# sourceMappingURL=dataRenderers.d.ts.map