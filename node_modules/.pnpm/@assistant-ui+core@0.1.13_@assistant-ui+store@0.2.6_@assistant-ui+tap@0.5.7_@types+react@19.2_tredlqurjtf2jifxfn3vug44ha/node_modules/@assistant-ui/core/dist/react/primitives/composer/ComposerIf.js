import { useAuiState } from "@assistant-ui/store";
const useComposerIf = (props) => {
    return useAuiState((s) => {
        if (props.editing === true && !s.composer.isEditing)
            return false;
        if (props.editing === false && s.composer.isEditing)
            return false;
        const isDictating = s.composer.dictation != null;
        if (props.dictation === true && !isDictating)
            return false;
        if (props.dictation === false && isDictating)
            return false;
        return true;
    });
};
/**
 * @deprecated Use `<AuiIf condition={(s) => s.composer...} />` instead.
 */
export const ComposerPrimitiveIf = ({ children, ...query }) => {
    const result = useComposerIf(query);
    return result ? children : null;
};
ComposerPrimitiveIf.displayName = "ComposerPrimitive.If";
//# sourceMappingURL=ComposerIf.js.map